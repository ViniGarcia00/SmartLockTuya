/**
 * BullMQ Queue Configuration
 *
 * Configuração de filas para processamento de jobs:
 * - generatePin: Gerar PINs 1h antes do check-in
 * - revokePin: Revogar PINs no check-out
 *
 * Usa Redis como backend de persistência
 */

import { Queue } from "bullmq";
import Redis from "ioredis";

// Logger simples para não adicionar dependências extras
const logger = {
  info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ""),
  warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ""),
  error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ""),
};

// Redis URL do ambiente
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

/**
 * Instância Redis compartilhada para filas
 * Configurada com retry automático e timeout
 */
export const redisConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: false,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

// Event listeners para debug
redisConnection.on("connect", () => {
  logger.info("✓ Redis connected", { url: REDIS_URL });
});

redisConnection.on("error", (err) => {
  logger.error("✗ Redis connection error", { error: err.message });
});

redisConnection.on("close", () => {
  logger.warn("⚠ Redis connection closed");
});

/**
 * Fila para gerar PINs
 *
 * Job data:
 * {
 *   reservationId: string
 *   lockId: string
 *   pin: string (hashed)
 *   checkInAt: string (ISO date)
 * }
 *
 * Scheduled 1 hora antes do check-in
 */
export const generatePinQueue = new Queue("generatePin", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

/**
 * Fila para revogar PINs
 *
 * Job data:
 * {
 *   reservationId: string
 *   lockId: string
 *   checkOutAt: string (ISO date)
 * }
 *
 * Scheduled no horário exato do check-out
 */
export const revokePinQueue = new Queue("revokePin", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

/**
 * Event listeners para monitorar filas
 */
// Note: Event listeners comentados pois BullMQ v5+ usa um padrão diferente
// Usar @on decorators em Worker classes em vez disso

/**
 * Limpar e desconectar (chamado no graceful shutdown)
 */
export async function closeQueues() {
  try {
    await generatePinQueue.close();
    await revokePinQueue.close();
    await redisConnection.quit();
    logger.info("✓ Queues and Redis connection closed");
  } catch (error) {
    logger.error("Error closing queues", { error });
  }
}

/**
 * Health check para verificar se Redis está conectado
 */
export async function getQueueHealth() {
  try {
    const ping = await redisConnection.ping();
    const stats = {
      redis: ping === "PONG" ? "connected" : "disconnected",
      generatePinQueue: {
        waiting: (await generatePinQueue.getWaiting()).length,
        active: (await generatePinQueue.getActive()).length,
        failed: (await generatePinQueue.getFailed()).length,
        completed: (await generatePinQueue.getCompleted()).length,
      },
      revokePinQueue: {
        waiting: (await revokePinQueue.getWaiting()).length,
        active: (await revokePinQueue.getActive()).length,
        failed: (await revokePinQueue.getFailed()).length,
        completed: (await revokePinQueue.getCompleted()).length,
      },
    };
    return stats;
  } catch (error) {
    return {
      redis: "error",
      error: (error as Error).message,
    };
  }
}
