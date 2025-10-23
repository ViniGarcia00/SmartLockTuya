/**
 * Webhook Handler para Eventos de Reserva
 * 
 * Processa webhooks de reservation.created, updated, cancelled
 * Agenda/cancela jobs de PIN automaticamente
 */

import { PrismaClient } from '@prisma/client';
import { schedulePinJobs, cancelPinJobs } from './pin-jobs';

const prisma = new PrismaClient();

export interface ReservationWebhookPayload {
  event: 'reservation.created' | 'reservation.updated' | 'reservation.cancelled';
  timestamp: string;
  data: {
    id: string; // stays reservation ID
    accommodationId: string; // stays accommodation ID
    checkInAt: string; // ISO datetime
    checkOutAt: string; // ISO datetime
    status: string;
    guestName: string;
    guestEmail?: string;
  };
  metadata?: any;
}

/**
 * Handler principal para webhook de reserva
 * 
 * Fluxo:
 * - reservation.created: Agendar generatePin e revokePin
 * - reservation.updated: Re-agendar se datas mudarem
 * - reservation.cancelled: Cancelar jobs e revogar PINs
 * 
 * @param webhook Payload do webhook
 * @returns { success, message, jobIds? }
 */
export async function handleReservationWebhook(
  webhook: ReservationWebhookPayload
): Promise<{
  success: boolean;
  message: string;
  jobIds?: { generateJobId: string; revokeJobId: string };
  error?: string;
}> {
  try {
    console.log(`[Webhook Handler] Processando webhook: ${webhook.event}`);
    console.log(`  Reservation ID: ${webhook.data.id}`);
    console.log(`  Check-in: ${webhook.data.checkInAt}`);
    console.log(`  Check-out: ${webhook.data.checkOutAt}`);
    
    // =====================================================================
    // PASSO 1: Buscar ou criar Accommodation
    // =====================================================================
    let accommodation = await prisma.accommodation.findUnique({
      where: { staysAccommodationId: webhook.data.accommodationId },
    });
    
    if (!accommodation) {
      console.log(
        `[Webhook Handler] Acomodação não existe, criando: ${webhook.data.accommodationId}`
      );
      
      accommodation = await prisma.accommodation.create({
        data: {
          staysAccommodationId: webhook.data.accommodationId,
          name: `Accommodation ${webhook.data.accommodationId}`,
          status: 'ACTIVE',
        },
      });
    }
    
    // =====================================================================
    // PASSO 2: Buscar ou criar Reservation
    // =====================================================================
    let reservation = await prisma.reservation.findUnique({
      where: { staysReservationId: webhook.data.id },
    });
    
    if (!reservation) {
      console.log(
        `[Webhook Handler] Reserva não existe, criando: ${webhook.data.id}`
      );
      
      reservation = await prisma.reservation.create({
        data: {
          staysReservationId: webhook.data.id,
          accommodationId: accommodation.id,
          checkInAt: new Date(webhook.data.checkInAt),
          checkOutAt: new Date(webhook.data.checkOutAt),
          status: 'CONFIRMED',
        },
      });
    }
    
    // =====================================================================
    // PASSO 3: Processar por tipo de evento
    // =====================================================================
    
    if (webhook.event === 'reservation.created') {
      return await handleReservationCreated(
        reservation.id,
        accommodation.id,
        webhook.data
      );
      
    } else if (webhook.event === 'reservation.updated') {
      return await handleReservationUpdated(
        reservation.id,
        webhook.data
      );
      
    } else if (webhook.event === 'reservation.cancelled') {
      return await handleReservationCancelled(reservation.id);
      
    } else {
      return {
        success: false,
        message: `Unknown event type: ${webhook.event}`,
        error: 'UNKNOWN_EVENT',
      };
    }
    
  } catch (error) {
    console.error('[Webhook Handler] ❌ Erro ao processar webhook:', error);
    
    return {
      success: false,
      message: 'Error processing webhook',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Handle: reservation.created
 * 
 * Agenda jobs de PIN para a nova reserva
 */
async function handleReservationCreated(
  reservationId: string,
  accommodationId: string,
  data: ReservationWebhookPayload['data']
): Promise<{
  success: boolean;
  message: string;
  jobIds?: { generateJobId: string; revokeJobId: string };
}> {
  try {
    console.log(`[Webhook Handler] Processando reservation.created`);
    
    // =====================================================================
    // PASSO 1: Buscar locks da acomodação
    // =====================================================================
    const accommodationLocks = await prisma.accommodationLock.findMany({
      where: { accommodationId },
      include: { lock: true },
    });
    
    if (accommodationLocks.length === 0) {
      console.warn(
        `[Webhook Handler] ⚠️  Nenhuma lock associada à acomodação ${accommodationId}`
      );
      
      return {
        success: true,
        message: 'Reservation created but no locks found for accommodation',
      };
    }
    
    // =====================================================================
    // PASSO 2: Agendar jobs para cada lock
    // =====================================================================
    let lastJobIds: { generateJobId: string; revokeJobId: string } | undefined;
    
    for (const accLock of accommodationLocks) {
      try {
        const jobIds = await schedulePinJobs(
          reservationId,
          accLock.lockId,
          data.checkInAt,
          data.checkOutAt
        );
        
        lastJobIds = jobIds;
        
        console.log(
          `[Webhook Handler] ✓ Jobs agendados para lock ${accLock.lockId}`
        );
        
      } catch (lockError) {
        console.error(
          `[Webhook Handler] Erro ao agendar jobs para lock ${accLock.lockId}:`,
          lockError
        );
        // Continua com próximas locks mesmo se uma falhar
      }
    }
    
    // =====================================================================
    // PASSO 3: Log de auditoria
    // =====================================================================
    await prisma.auditLog.create({
      data: {
        action: 'RESERVATION_CREATED',
        entity: 'Reservation',
        entityId: reservationId,
        userId: 'webhook-handler',
        details: {
          event: 'reservation.created',
          lockCount: accommodationLocks.length,
          checkInAt: data.checkInAt,
          checkOutAt: data.checkOutAt,
        },
      },
    });
    
    return {
      success: true,
      message: `Reservation created and PIN jobs scheduled for ${accommodationLocks.length} lock(s)`,
      jobIds: lastJobIds,
    };
    
  } catch (error) {
    console.error('[Webhook Handler] Erro em handleReservationCreated:', error);
    
    return {
      success: false,
      message: 'Error handling reservation created',
    };
  }
}

/**
 * Handle: reservation.updated
 * 
 * Re-agenda jobs se datas mudarem, senão apenas atualiza status
 */
async function handleReservationUpdated(
  reservationId: string,
  data: ReservationWebhookPayload['data']
): Promise<{
  success: boolean;
  message: string;
  jobIds?: { generateJobId: string; revokeJobId: string };
}> {
  try {
    console.log(`[Webhook Handler] Processando reservation.updated`);
    
    // =====================================================================
    // PASSO 1: Buscar reservation atual
    // =====================================================================
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });
    
    if (!reservation) {
      console.error(
        `[Webhook Handler] Reservation não encontrada: ${reservationId}`
      );
      
      return {
        success: false,
        message: 'Reservation not found',
      };
    }
    
    // =====================================================================
    // PASSO 2: Verificar se datas mudaram
    // =====================================================================
    const checkInChanged = 
      new Date(reservation.checkInAt).getTime() !== new Date(data.checkInAt).getTime();
    const checkOutChanged = 
      new Date(reservation.checkOutAt).getTime() !== new Date(data.checkOutAt).getTime();
    
    if (!checkInChanged && !checkOutChanged) {
      console.log(`[Webhook Handler] Datas não mudaram, apenas atualizando status`);
      
      // Apenas atualizar status
      await prisma.reservation.update({
        where: { id: reservationId },
        data: {
          status: 'CONFIRMED',
        },
      });
      
      return {
        success: true,
        message: 'Reservation updated (dates unchanged)',
      };
    }
    
    // =====================================================================
    // PASSO 3: Cancelar jobs antigos
    // =====================================================================
    try {
      await cancelPinJobs(reservationId);
      console.log(`[Webhook Handler] Jobs anteriores cancelados`);
    } catch (cancelError) {
      console.warn(`[Webhook Handler] Erro ao cancelar jobs anteriores:`, cancelError);
    }
    
    // =====================================================================
    // PASSO 4: Agendar novos jobs com datas atualizadas
    // =====================================================================
    const credentials = await prisma.credential.findMany({
      where: {
        reservationId,
        status: 'ACTIVE',
      },
      include: { lock: true },
    });
    
    let lastJobIds: { generateJobId: string; revokeJobId: string } | undefined;
    
    for (const credential of credentials) {
      try {
        const jobIds = await schedulePinJobs(
          reservationId,
          credential.lockId,
          data.checkInAt,
          data.checkOutAt
        );
        
        lastJobIds = jobIds;
        
      } catch (lockError) {
        console.error(
          `[Webhook Handler] Erro ao reagendar jobs para lock ${credential.lockId}:`,
          lockError
        );
      }
    }
    
    // =====================================================================
    // PASSO 5: Atualizar reservation no DB
    // =====================================================================
    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        checkInAt: new Date(data.checkInAt),
        checkOutAt: new Date(data.checkOutAt),
        status: 'CONFIRMED',
      },
    });
    
    // =====================================================================
    // PASSO 6: Log de auditoria
    // =====================================================================
    await prisma.auditLog.create({
      data: {
        action: 'RESERVATION_UPDATED',
        entity: 'Reservation',
        entityId: reservationId,
        userId: 'webhook-handler',
        details: {
          event: 'reservation.updated',
          checkInChanged,
          checkOutChanged,
          newCheckInAt: data.checkInAt,
          newCheckOutAt: data.checkOutAt,
        },
      },
    });
    
    return {
      success: true,
      message: 'Reservation updated and PIN jobs rescheduled',
      jobIds: lastJobIds,
    };
    
  } catch (error) {
    console.error('[Webhook Handler] Erro em handleReservationUpdated:', error);
    
    return {
      success: false,
      message: 'Error handling reservation updated',
    };
  }
}

/**
 * Handle: reservation.cancelled
 * 
 * Cancela jobs e revoga PINs imediatamente
 */
async function handleReservationCancelled(
  reservationId: string
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    console.log(`[Webhook Handler] Processando reservation.cancelled`);
    
    // =====================================================================
    // PASSO 1: Cancelar jobs
    // =====================================================================
    try {
      await cancelPinJobs(reservationId);
      console.log(`[Webhook Handler] Jobs cancelados`);
    } catch (cancelError) {
      console.warn(`[Webhook Handler] Erro ao cancelar jobs:`, cancelError);
    }
    
    // =====================================================================
    // PASSO 2: Revogar PINs imediatamente
    // =====================================================================
    const now = new Date();
    
    await prisma.credential.updateMany({
      where: {
        reservationId,
        status: 'ACTIVE',
      },
      data: {
        status: 'REVOKED',
        revokedAt: now,
        revokedBy: 'webhook-handler-cancellation',
      },
    });
    
    console.log(`[Webhook Handler] ✓ PINs revogados`);
    
    // =====================================================================
    // PASSO 3: Atualizar reservation status
    // =====================================================================
    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: 'CANCELLED',
      },
    });
    
    // =====================================================================
    // PASSO 4: Log de auditoria
    // =====================================================================
    await prisma.auditLog.create({
      data: {
        action: 'RESERVATION_CANCELLED',
        entity: 'Reservation',
        entityId: reservationId,
        userId: 'webhook-handler',
        details: {
          event: 'reservation.cancelled',
          pinsRevoked: true,
        },
      },
    });
    
    return {
      success: true,
      message: 'Reservation cancelled, jobs cancelled and PINs revoked',
    };
    
  } catch (error) {
    console.error('[Webhook Handler] Erro em handleReservationCancelled:', error);
    
    return {
      success: false,
      message: 'Error handling reservation cancellation',
    };
  }
}

export default handleReservationWebhook;
