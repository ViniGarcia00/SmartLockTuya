import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { reconciliationService } from '../lib/reconciliation-service';

// Logger simples
const logger = {
  info: console.log,
  error: console.error,
  warn: console.warn,
};

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

export const reconciliationQueue = new Queue('reconciliation', {
  connection: redis,
});

/**
 * Job de reconciliação periódica com Stays API
 * Executa a cada 30 minutos
 */
export async function registerReconciliationJob() {
  try {
    // Adicionar job recorrente
    await reconciliationQueue.add(
      'periodic',
      {},
      {
        repeat: {
          pattern: '*/30 * * * *', // A cada 30 minutos
        },
        attempts: 3, // Tentar 3 vezes em caso de erro
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    );

    logger.info('✅ Reconciliation job registered (pattern: */30 * * * *)');
  } catch (error) {
    logger.error('Erro ao registrar job de reconciliação:', error);
  }
}

/**
 * Worker que processa o job de reconciliação
 */
export const reconciliationWorker = new Worker(
  'reconciliation',
  async (job) => {
    logger.info(`🔄 Processing reconciliation job: ${job.id}`);

    try {
      const result = await reconciliationService.reconcile();

      if (result.success) {
        logger.info('✅ Reconciliation completed successfully', result.stats);
        return {
          success: true,
          stats: result.stats,
          completedAt: result.completedAt,
        };
      } else {
        logger.error('❌ Reconciliation failed:', result.error);
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      logger.error('❌ Reconciliation job error:', error);
      throw error; // Will trigger retry
    }
  },
  {
    connection: redis,
    concurrency: 1, // Only one reconciliation at a time
  }
);

/**
 * Event listeners
 */
reconciliationWorker.on('completed', (job) => {
  logger.info(`✓ Reconciliation job ${job.id} completed`);
});

reconciliationWorker.on('failed', (job, err) => {
  if (job) {
    logger.error(`✗ Reconciliation job ${job.id} failed:`, err?.message);
  }
});

reconciliationWorker.on('error', (error) => {
  logger.error('Reconciliation worker error:', error);
});

export default reconciliationQueue;
