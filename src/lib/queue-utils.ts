/**
 * Queue Utilities
 *
 * Funções helper para scheduling e gerenciamento de jobs
 */

import { generatePinQueue, revokePinQueue } from "./queue";
import { GeneratePinJobData, RevokePinJobData } from "./queue-processor";

const logger = {
  info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ""),
  warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ""),
  error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ""),
};

/**
 * Agendar geração de PIN
 *
 * Schedula para 1 hora antes do check-in
 *
 * @param reservationId ID da reserva
 * @param lockId ID da fechadura
 * @param pin PIN hashed
 * @param checkInAt Data/hora do check-in (ISO string)
 */
export async function scheduleGeneratePin(
  reservationId: string,
  lockId: string,
  pin: string,
  checkInAt: string
) {
  try {
    // Calcular delay: 1 hora antes do check-in
    const checkInDate = new Date(checkInAt);
    const scheduleDate = new Date(checkInDate.getTime() - 60 * 60 * 1000); // 1 hora antes

    const jobData: GeneratePinJobData = {
      reservationId,
      lockId,
      pin,
      checkInAt,
    };

    // Job ID único por reserva
    const jobId = `gen-pin-${reservationId}`;

    const job = await generatePinQueue.add(jobId, jobData, {
      jobId,
      delay: Math.max(0, scheduleDate.getTime() - Date.now()),
      removeOnComplete: true,
      removeOnFail: false,
    });

    logger.info("Scheduled Generate PIN job", {
      jobId: job.id,
      reservationId,
      lockId,
      scheduledFor: scheduleDate.toISOString(),
      checkInAt,
    });

    return job;
  } catch (error) {
    logger.error("Error scheduling Generate PIN job", {
      reservationId,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Agendar revogação de PIN
 *
 * Schedula para o horário exato do check-out
 *
 * @param reservationId ID da reserva
 * @param lockId ID da fechadura
 * @param checkOutAt Data/hora do check-out (ISO string)
 */
export async function scheduleRevokePin(
  reservationId: string,
  lockId: string,
  checkOutAt: string
) {
  try {
    const checkOutDate = new Date(checkOutAt);

    const jobData: RevokePinJobData = {
      reservationId,
      lockId,
      checkOutAt,
    };

    // Job ID único por reserva
    const jobId = `revoke-pin-${reservationId}`;

    const job = await revokePinQueue.add(jobId, jobData, {
      jobId,
      delay: Math.max(0, checkOutDate.getTime() - Date.now()),
      removeOnComplete: true,
      removeOnFail: false,
    });

    logger.info("Scheduled Revoke PIN job", {
      jobId: job.id,
      reservationId,
      lockId,
      scheduledFor: checkOutDate.toISOString(),
    });

    return job;
  } catch (error) {
    logger.error("Error scheduling Revoke PIN job", {
      reservationId,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Cancelar jobs agendados para uma reserva
 *
 * Cancela tanto geração quanto revogação
 *
 * @param reservationId ID da reserva
 */
export async function cancelScheduledJobs(reservationId: string) {
  try {
    const generateJobId = `gen-pin-${reservationId}`;
    const revokeJobId = `revoke-pin-${reservationId}`;

    let generateJob = await generatePinQueue.getJob(generateJobId);
    let revokeJob = await revokePinQueue.getJob(revokeJobId);

    const results = {
      generatePinCancelled: false,
      revokePinCancelled: false,
    };

    if (generateJob) {
      await generateJob.remove();
      results.generatePinCancelled = true;
      logger.info("Cancelled Generate PIN job", { jobId: generateJobId });
    }

    if (revokeJob) {
      await revokeJob.remove();
      results.revokePinCancelled = true;
      logger.info("Cancelled Revoke PIN job", { jobId: revokeJobId });
    }

    if (!generateJob && !revokeJob) {
      logger.warn("No scheduled jobs found to cancel", { reservationId });
    }

    return results;
  } catch (error) {
    logger.error("Error cancelling scheduled jobs", {
      reservationId,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Buscar status de um job agendado
 */
export async function getScheduledJobStatus(
  reservationId: string,
  type: "generate" | "revoke"
) {
  try {
    const jobId = type === "generate" ? `gen-pin-${reservationId}` : `revoke-pin-${reservationId}`;
    const queue = type === "generate" ? generatePinQueue : revokePinQueue;

    const job = await queue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();

    return {
      jobId: job.id,
      state,
      data: job.data,
      attempts: job.attemptsMade,
      delay: job.delay,
    };
  } catch (error) {
    logger.error("Error getting job status", {
      reservationId,
      type,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Listar todos os jobs em uma fila
 */
export async function listQueueJobs(queueName: "generatePin" | "revokePin") {
  try {
    const queue = queueName === "generatePin" ? generatePinQueue : revokePinQueue;

    const waiting = await queue.getWaiting();
    const active = await queue.getActive();
    const completed = await queue.getCompleted();
    const failed = await queue.getFailed();

    return {
      waiting: waiting.map((j) => ({ id: j.id, data: j.data })),
      active: active.map((j) => ({ id: j.id, data: j.data })),
      completed: completed.map((j) => ({ id: j.id, data: j.data })),
      failed: failed.map((j) => ({ id: j.id, data: j.data, failedReason: j.failedReason })),
    };
  } catch (error) {
    logger.error("Error listing queue jobs", {
      queueName,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Limpar jobs falhados de uma fila
 */
export async function clearFailedJobs(queueName: "generatePin" | "revokePin") {
  try {
    const queue = queueName === "generatePin" ? generatePinQueue : revokePinQueue;
    const failed = await queue.getFailed();

    for (const job of failed) {
      await job.remove();
    }

    logger.info("Cleared failed jobs", { queueName, count: failed.length });
    return { cleared: failed.length };
  } catch (error) {
    logger.error("Error clearing failed jobs", {
      queueName,
      error: (error as Error).message,
    });
    throw error;
  }
}
