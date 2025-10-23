/**
 * BullMQ Queue Processor
 *
 * Processa jobs das filas:
 * - generatePin: Gerar PINs para reservas
 * - revokePin: Revogar PINs expirados
 *
 * Implementa retry logic e lock por reservationId
 */

import { Worker, Job } from "bullmq";
import { redisConnection } from "./queue";

const logger = {
  info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ""),
  warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ""),
  error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ""),
};

/**
 * Interface para data de job de geração de PIN
 */
export interface GeneratePinJobData {
  reservationId: string;
  lockId: string;
  pin: string; // hashed
  checkInAt: string; // ISO date
}

/**
 * Interface para data de job de revogação de PIN
 */
export interface RevokePinJobData {
  reservationId: string;
  lockId: string;
  checkOutAt: string; // ISO date
}

/**
 * Set em Redis para rastrear jobs em processamento
 * Evita duplicatas processando o mesmo job simultaneamente
 */
const PROCESSING_SET = "processing:jobs";
const LOCK_EXPIRE = 60; // segundos

/**
 * Verificar e criar lock para evitar processamento duplicado
 */
async function acquireLock(
  reservationId: string
): Promise<{ acquired: boolean; releaseToken?: string }> {
  const lockKey = `lock:${reservationId}`;
  const token = `${Date.now()}-${Math.random()}`;

  try {
    const result = await redisConnection.set(lockKey, token, "EX", LOCK_EXPIRE, "NX");
    if (result === "OK") {
      return { acquired: true, releaseToken: token };
    }
    return { acquired: false };
  } catch (error) {
    logger.error("Error acquiring lock", { error, lockKey });
    return { acquired: false };
  }
}

/**
 * Liberar lock
 */
async function releaseLock(lockKey: string, token: string) {
  try {
    const currentToken = await redisConnection.get(`lock:${lockKey}`);
    if (currentToken === token) {
      await redisConnection.del(`lock:${lockKey}`);
    }
  } catch (error) {
    logger.error("Error releasing lock", { error, lockKey });
  }
}

/**
 * Processar job de geração de PIN
 *
 * Chamado 1 hora antes do check-in
 */
async function processGeneratePin(job: Job<GeneratePinJobData>) {
  const { reservationId, lockId, pin, checkInAt } = job.data;

  logger.info("Processing Generate PIN job", {
    jobId: job.id,
    reservationId,
    lockId,
    checkInAt,
    attempt: job.attemptsMade + 1,
  });

  // Tentar adquirir lock
  const lock = await acquireLock(reservationId);
  if (!lock.acquired) {
    logger.warn("Could not acquire lock, job will retry", { reservationId });
    throw new Error(`Lock not acquired for reservation ${reservationId}`);
  }

  try {
    // Simular processamento (em produção, chamaria Tuya API)
    logger.info("Mock: Sending PIN to Tuya Lock", {
      reservationId,
      lockId,
      pin: "***",
      validFrom: checkInAt,
    });

    // Simular operação de 100ms
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Registrar sucesso
    const successKey = `pin:generated:${reservationId}`;
    await redisConnection.setex(successKey, 86400, JSON.stringify({ pin, lockId, checkInAt }));

    logger.info("Generate PIN job completed successfully", {
      jobId: job.id,
      reservationId,
    });

    return {
      success: true,
      reservationId,
      lockId,
      message: "PIN generated successfully",
    };
  } catch (error) {
    logger.error("Error generating PIN", {
      jobId: job.id,
      reservationId,
      error: (error as Error).message,
    });
    throw error;
  } finally {
    // Sempre liberar lock
    if (lock.releaseToken) {
      await releaseLock(reservationId, lock.releaseToken);
    }
  }
}

/**
 * Processar job de revogação de PIN
 *
 * Chamado no horário exato do check-out
 */
async function processRevokePin(job: Job<RevokePinJobData>) {
  const { reservationId, lockId, checkOutAt } = job.data;

  logger.info("Processing Revoke PIN job", {
    jobId: job.id,
    reservationId,
    lockId,
    checkOutAt,
    attempt: job.attemptsMade + 1,
  });

  // Tentar adquirir lock
  const lock = await acquireLock(reservationId);
  if (!lock.acquired) {
    logger.warn("Could not acquire lock, job will retry", { reservationId });
    throw new Error(`Lock not acquired for reservation ${reservationId}`);
  }

  try {
    // Simular processamento (em produção, chamaria Tuya API)
    logger.info("Mock: Revoking PIN from Tuya Lock", {
      reservationId,
      lockId,
      revokedAt: checkOutAt,
    });

    // Simular operação de 100ms
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Registrar revogação
    const revokeKey = `pin:revoked:${reservationId}`;
    await redisConnection.setex(revokeKey, 86400, JSON.stringify({ lockId, checkOutAt }));

    logger.info("Revoke PIN job completed successfully", {
      jobId: job.id,
      reservationId,
    });

    return {
      success: true,
      reservationId,
      lockId,
      message: "PIN revoked successfully",
    };
  } catch (error) {
    logger.error("Error revoking PIN", {
      jobId: job.id,
      reservationId,
      error: (error as Error).message,
    });
    throw error;
  } finally {
    // Sempre liberar lock
    if (lock.releaseToken) {
      await releaseLock(reservationId, lock.releaseToken);
    }
  }
}

/**
 * Worker para processadores de queue
 * Chamado para registrar os workers (em outro arquivo)
 */
export function createWorkers() {
  const generatePinWorker = new Worker("generatePin", processGeneratePin, {
    connection: redisConnection,
    concurrency: 5, // Processar até 5 jobs simultâneos
  });

  const revokePinWorker = new Worker("revokePin", processRevokePin, {
    connection: redisConnection,
    concurrency: 5,
  });

  // Event listeners
  generatePinWorker.on("completed", (job) => {
    logger.info("[Worker] Generate PIN completed", { jobId: job.id });
  });

  generatePinWorker.on("failed", (job, err) => {
    logger.error("[Worker] Generate PIN failed", {
      jobId: job?.id,
      error: err?.message,
    });
  });

  revokePinWorker.on("completed", (job) => {
    logger.info("[Worker] Revoke PIN completed", { jobId: job.id });
  });

  revokePinWorker.on("failed", (job, err) => {
    logger.error("[Worker] Revoke PIN failed", {
      jobId: job?.id,
      error: err?.message,
    });
  });

  return { generatePinWorker, revokePinWorker };
}

/**
 * Exportar para testes
 */
export { processGeneratePin, processRevokePin, acquireLock, releaseLock };
