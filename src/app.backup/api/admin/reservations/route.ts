import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json(
        { error: 'Token não fornecido' },
        { status: 401 }
      );
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
    }

    // Query params
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = 10;
    const offset = (page - 1) * limit;

    // Construir WHERE clause
    let whereConditions: string[] = [];
    let params: any[] = [];

    if (status) {
      whereConditions.push('r.status = $' + (params.length + 1));
      params.push(status);
    }

    if (fromDate) {
      whereConditions.push('r.checkIn >= $' + (params.length + 1));
      params.push(fromDate);
    }

    if (toDate) {
      whereConditions.push('r.checkOut <= $' + (params.length + 1));
      params.push(toDate);
    }

    const whereClause =
      whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Query de count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM reservations r ${whereClause}`,
      params
    );
    const total = countResult.rows[0].total;

    // Query de dados
    params.push(limit);
    params.push(offset);

    const dataResult = await query(
      `
      SELECT 
        r.id,
        r.accommodationId,
        r.credentialId,
        r.checkIn,
        r.checkOut,
        r.status,
        r.processedAt,
        a.id as "accommodationId",
        a.name as "accommodationName",
        c.id as "credentialId",
        c.isActive,
        c.expiresAt,
        c.revokedAt
      FROM reservations r
      LEFT JOIN accommodations a ON r.accommodationId = a.id
      LEFT JOIN credentials c ON r.credentialId = c.id
      ${whereClause}
      ORDER BY r.checkIn DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      params
    );

    // Buscar todas as acomodações e credenciais para o cliente
    const accommodationsResult = await query(
      'SELECT id, name FROM accommodations'
    );
    const credentialsResult = await query(
      'SELECT id, isActive, expiresAt, revokedAt FROM credentials'
    );

    // Transformar dados
    const reservations = dataResult.rows.map((row: any) => ({
      id: row.id,
      accommodationId: row.accommodationId,
      credentialId: row.credentialId,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      status: row.status,
      processedAt: row.processedAt,
    }));

    return NextResponse.json({
      data: {
        reservations,
        accommodations: accommodationsResult.rows,
        credentials: credentialsResult.rows,
        total,
        page,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar reservas:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar reservas' },
      { status: 500 }
    );
  }
}
