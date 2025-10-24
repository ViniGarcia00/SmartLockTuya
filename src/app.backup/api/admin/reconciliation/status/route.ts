import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/admin/reconciliation/status
 * Retorna status da última reconciliação e próxima execução
 */
export async function GET(req: NextRequest) {
  try {
    // Autenticação
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Buscar última execução
    const result = await query(
      `SELECT 
        id,
        "lastRunAt",
        "startedAt",
        "completedAt",
        duration,
        fetched,
        created,
        updated,
        orphaned,
        deleted,
        errors,
        status,
        message
      FROM reconciliation_logs
      ORDER BY "completedAt" DESC NULLS LAST
      LIMIT 1`
    );

    const lastRun = result.rows[0] || null;

    // Calcular próxima execução (cada 30 minutos)
    let nextRun: Date | null = null;
    if (lastRun?.completedAt) {
      const lastCompleted = new Date(lastRun.completedAt);
      nextRun = new Date(lastCompleted.getTime() + 30 * 60 * 1000); // +30 minutes
    } else if (lastRun?.startedAt) {
      const lastStarted = new Date(lastRun.startedAt);
      nextRun = new Date(lastStarted.getTime() + 30 * 60 * 1000);
    }

    return NextResponse.json({
      data: {
        lastRun: lastRun
          ? {
              id: lastRun.id,
              startedAt: lastRun.startedAt,
              completedAt: lastRun.completedAt,
              duration: lastRun.duration,
              status: lastRun.status,
              message: lastRun.message,
              stats: {
                fetched: lastRun.fetched,
                created: lastRun.created,
                updated: lastRun.updated,
                orphaned: lastRun.orphaned,
                deleted: lastRun.deleted,
                errors: lastRun.errors,
              },
            }
          : null,
        nextRun,
        currentStatus: lastRun?.status || 'never_run',
        schedule: '*/30 * * * * (Every 30 minutes)',
      },
    });
  } catch (error) {
    console.error('Error fetching reconciliation status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reconciliation status' },
      { status: 500 }
    );
  }
}
