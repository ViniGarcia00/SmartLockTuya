import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const reservationId = params.id;

    // Buscar reserva
    const reservationResult = await query(
      'SELECT credentialId FROM reservations WHERE id = $1',
      [reservationId]
    );

    if (reservationResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Reserva não encontrada' },
        { status: 404 }
      );
    }

    const credentialId = reservationResult.rows[0].credentialId;

    if (!credentialId) {
      return NextResponse.json(
        { error: 'PIN não gerado ainda' },
        { status: 404 }
      );
    }

    // Buscar credential com PIN
    const credentialResult = await query(
      `
      SELECT 
        id,
        pin,
        isActive,
        expiresAt,
        revokedAt
      FROM credentials
      WHERE id = $1 AND isActive = true AND revokedAt IS NULL
      `,
      [credentialId]
    );

    if (credentialResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'PIN não está ativo' },
        { status: 404 }
      );
    }

    const credential = credentialResult.rows[0];

    // Máscarar PIN: mostrar apenas últimos 2 dígitos
    const maskedPin = `${'*'.repeat(credential.pin.length - 2)}${credential.pin.slice(-2)}`;

    return NextResponse.json({
      data: {
        pin: maskedPin,
        expiresAt: credential.expiresAt,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar PIN:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar PIN' },
      { status: 500 }
    );
  }
}
