/**
 * PIN Jobs Scheduling Utilities
 * 
 * Helper functions para agendar e gerenciar jobs de PIN
 * Integra com webhooks de reserva
 */

import { generatePinQueue, revokePinQueue } from '../lib/queue';
import { scheduleGeneratePin, scheduleRevokePin, cancelScheduledJobs } from '../lib/queue-utils';

/**
 * Agenda jobs de PIN baseado em datas de checkin/checkout
 * 
 * Lógica:
 * - Se checkInAt ≤ agora + 2h → agenda generatePin imediatamente
 * - Senão → agenda generatePin para (checkInAt - 2h)
 * - Agenda revokePin para exatamente checkOutAt
 * 
 * @param reservationId ID da reserva
 * @param lockId ID da fechadura  
 * @param checkInAt Data/hora de checkin (ISO string)
 * @param checkOutAt Data/hora de checkout (ISO string)
 * @returns { generateJobId, revokeJobId }
 * 
 * @example
 * await schedulePinJobs("res-123", "lock-456", "2025-10-24T15:00:00Z", "2025-10-26T11:00:00Z")
 */
export async function schedulePinJobs(
  reservationId: string,
  lockId: string,
  checkInAt: string,
  checkOutAt: string
): Promise<{ generateJobId: string; revokeJobId: string }> {
  console.log(`[PIN Jobs] Agendando jobs para reserva ${reservationId}`);
  
  try {
    // Validar dados
    if (!reservationId || !lockId || !checkInAt || !checkOutAt) {
      throw new Error('Missing required parameters');
    }
    
    const checkInDate = new Date(checkInAt);
    const checkOutDate = new Date(checkOutAt);
    const now = new Date();
    
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      throw new Error('Invalid date format');
    }
    
    if (checkOutDate <= checkInDate) {
      throw new Error('checkOutAt must be after checkInAt');
    }
    
    // =====================================================================
    // LÓGICA: Decidir quando agendar generatePin
    // =====================================================================
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const scheduleTime = checkInDate.getTime() - (2 * 60 * 60 * 1000); // 2 horas antes
    
    let generateDelay: number;
    let willScheduleImmediately = false;
    
    if (checkInDate <= twoHoursFromNow) {
      // CheckIn em menos de 2 horas - agenda imediatamente
      generateDelay = 0;
      willScheduleImmediately = true;
      console.log(`[PIN Jobs] CheckIn iminente (< 2h) - agendando generatePin imediatamente`);
    } else {
      // CheckIn em mais de 2 horas - agenda para 2h antes
      generateDelay = Math.max(0, scheduleTime - now.getTime());
      console.log(
        `[PIN Jobs] CheckIn em ${Math.round(generateDelay / 1000 / 60)} minutos - agendando generatePin para 2h antes`
      );
    }
    
    // =====================================================================
    // Agendar generatePin
    // =====================================================================
    const generateJobId = `gen-pin-${reservationId}`;
    const generateJob = await generatePinQueue.add(
      generateJobId,
      {
        reservationId,
        lockId,
        checkOutAt: checkOutAt, // Passa checkOutAt para validar PIN em Credential
      },
      {
        jobId: generateJobId,
        delay: generateDelay,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    );
    
    console.log(`[PIN Jobs] ✓ Job generatePin agendado: ${generateJobId}`);
    console.log(`  Lock ID: ${lockId}`);
    console.log(`  Delay: ${generateDelay}ms (${Math.round(generateDelay / 1000 / 60)} minutos)`);
    console.log(`  Timestamp agendado: ${new Date(now.getTime() + generateDelay).toISOString()}`);
    
    // =====================================================================
    // Agendar revokePin
    // =====================================================================
    const revokeDelay = Math.max(0, checkOutDate.getTime() - now.getTime());
    const revokeJobId = `revoke-pin-${reservationId}`;
    
    const revokeJob = await revokePinQueue.add(
      revokeJobId,
      {
        reservationId,
      },
      {
        jobId: revokeJobId,
        delay: revokeDelay,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    );
    
    console.log(`[PIN Jobs] ✓ Job revokePin agendado: ${revokeJobId}`);
    console.log(`  Delay: ${revokeDelay}ms (${Math.round(revokeDelay / 1000 / 60)} minutos)`);
    console.log(`  Timestamp agendado: ${new Date(now.getTime() + revokeDelay).toISOString()}`);
    
    console.log(`[PIN Jobs] ✅ Jobs agendados com sucesso para reserva ${reservationId}`);
    
    return {
      generateJobId,
      revokeJobId,
    };
    
  } catch (error) {
    console.error('[PIN Jobs] ❌ Erro ao agendar jobs:', error);
    throw error;
  }
}

/**
 * Cancela todos os jobs de PIN de uma reserva
 * 
 * Cancela tanto generatePin quanto revokePin
 * 
 * @param reservationId ID da reserva
 * @returns { cancelled: true, generateJobId: string, revokeJobId: string }
 * 
 * @example
 * await cancelPinJobs("res-123")
 */
export async function cancelPinJobs(
  reservationId: string
): Promise<{ cancelled: boolean; generateJobId: string; revokeJobId: string }> {
  console.log(`[PIN Jobs] Cancelando jobs para reserva ${reservationId}`);
  
  try {
    const generateJobId = `gen-pin-${reservationId}`;
    const revokeJobId = `revoke-pin-${reservationId}`;
    
    // Buscar e remover job de generatePin
    const generateJob = await generatePinQueue.getJob(generateJobId);
    if (generateJob) {
      await generateJob.remove();
      console.log(`[PIN Jobs] ✓ Job generatePin removido: ${generateJobId}`);
    } else {
      console.log(`[PIN Jobs] ℹ️  Job generatePin não encontrado: ${generateJobId}`);
    }
    
    // Buscar e remover job de revokePin
    const revokeJob = await revokePinQueue.getJob(revokeJobId);
    if (revokeJob) {
      await revokeJob.remove();
      console.log(`[PIN Jobs] ✓ Job revokePin removido: ${revokeJobId}`);
    } else {
      console.log(`[PIN Jobs] ℹ️  Job revokePin não encontrado: ${revokeJobId}`);
    }
    
    console.log(`[PIN Jobs] ✅ Jobs cancelados com sucesso para reserva ${reservationId}`);
    
    return {
      cancelled: true,
      generateJobId,
      revokeJobId,
    };
    
  } catch (error) {
    console.error('[PIN Jobs] ❌ Erro ao cancelar jobs:', error);
    throw error;
  }
}

/**
 * Obter status de jobs de PIN
 * 
 * @param reservationId ID da reserva
 * @returns { generateJobStatus?, revokeJobStatus? }
 */
export async function getPinJobsStatus(reservationId: string): Promise<{
  generateJob?: {
    id: string;
    state: string;
    progress: number;
    attempts: number;
    delay: number;
  };
  revokeJob?: {
    id: string;
    state: string;
    progress: number;
    attempts: number;
    delay: number;
  };
}> {
  try {
    const generateJobId = `gen-pin-${reservationId}`;
    const revokeJobId = `revoke-pin-${reservationId}`;
    
    const result: any = {};
    
    // Status de generatePin
    const generateJob = await generatePinQueue.getJob(generateJobId);
    if (generateJob) {
      const state = await generateJob.getState();
      result.generateJob = {
        id: generateJobId,
        state,
        progress: generateJob.progress as number,
        attempts: generateJob.attemptsMade,
        delay: generateJob.delay,
      };
    }
    
    // Status de revokePin
    const revokeJob = await revokePinQueue.getJob(revokeJobId);
    if (revokeJob) {
      const state = await revokeJob.getState();
      result.revokeJob = {
        id: revokeJobId,
        state,
        progress: revokeJob.progress as number,
        attempts: revokeJob.attemptsMade,
        delay: revokeJob.delay,
      };
    }
    
    return result;
    
  } catch (error) {
    console.error('[PIN Jobs] Erro ao obter status dos jobs:', error);
    return {};
  }
}
