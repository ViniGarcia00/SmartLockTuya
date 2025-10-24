'use server';

import { query } from '@/config/database';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

const generatePinQueue = new Queue('generatePin', { connection: redis });
const revokePinQueue = new Queue('revokePin', { connection: redis });

export async function reprocessReservation(reservationId: string) {
  try {
    // Buscar reserva
    const result = await query(
      'SELECT * FROM reservations WHERE id = $1',
      [reservationId]
    );

    if (result.rows.length === 0) {
      return { success: false, message: 'Reserva não encontrada' };
    }

    const reservation = result.rows[0];

    // Se tem PIN ativo, revogar primeiro
    if (reservation.credentialId) {
      const credResult = await query(
        'SELECT * FROM credentials WHERE id = $1',
        [reservation.credentialId]
      );

      if (credResult.rows.length > 0) {
        const credential = credResult.rows[0];

        if (credential.isActive && !credential.revokedAt) {
          // Adicionar job de revogação
          await revokePinQueue.add(
            'revoke',
            {
              credentialId: credential.id,
              lockId: credential.lockId,
            },
            { delay: 0 }
          );

          // Atualizar credential como revogado
          await query(
            'UPDATE credentials SET revokedAt = NOW(), isActive = false WHERE id = $1',
            [credential.id]
          );
        }
      }
    }

    // Reagendar geração de PIN
    const checkIn = new Date(reservation.checkIn);
    const delayMs = checkIn.getTime() - Date.now();

    await generatePinQueue.add(
      'generate',
      {
        reservationId: reservation.id,
        accommodationId: reservation.accommodationId,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
      },
      { delay: Math.max(0, delayMs) }
    );

    // Atualizar status
    await query(
      'UPDATE reservations SET processedAt = NOW(), status = $1 WHERE id = $2',
      ['confirmed', reservationId]
    );

    return {
      success: true,
      message: 'Reserva reprocessada com sucesso',
    };
  } catch (error) {
    console.error('Erro ao reprocessar reserva:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}
