import { prisma } from './prisma';
import { createStaysClient } from './stays-client';

// Create singleton instance
const staysClient = createStaysClient();

// Simple logger
const logger = {
  info: console.log,
  warn: console.warn,
  error: console.error,
};

export interface ReconciliationStats {
  fetched: number;
  created: number;
  updated: number;
  orphaned: number;
  deleted: number;
  errors: number;
  duration: number;
}

export interface ReconciliationResult {
  success: boolean;
  stats: ReconciliationStats;
  error?: string;
  startedAt: Date;
  completedAt: Date;
}

/**
 * Serviço de reconciliação periódica com Stays API
 */
export class ReconciliationService {
  /**
   * Executar reconciliação completa
   * - Sincronizar reservas
   * - Limpar órfãos
   * - Atualizar jobs
   */
  async reconcile(): Promise<ReconciliationResult> {
    const startedAt = new Date();
    const stats: ReconciliationStats = {
      fetched: 0,
      created: 0,
      updated: 0,
      orphaned: 0,
      deleted: 0,
      errors: 0,
      duration: 0,
    };

    let lastLog: any = null;

    try {
      logger.info('🔄 Iniciando reconciliação com Stays API...');

      // 1. Buscar timestamp da última execução
      lastLog = await prisma.reconciliationLog.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      const lastRunAt = lastLog?.lastRunAt || new Date(0);
      logger.info(`📅 Última reconciliação: ${lastRunAt.toISOString()}`);

      // 2. Buscar reservas atualizadas desde última execução
      const response = await staysClient.getReservationUpdatedSince(
        lastRunAt
      );
      
      const staysReservations = response.data || [];
      stats.fetched = staysReservations.length;
      logger.info(`📥 Fetched ${stats.fetched} reservations from Stays API`);

      // 3. Processar cada reserva (transação)
      for (const staysRes of staysReservations) {
        await this.processStaysReservation(staysRes, stats);
      }

      // 4. Limpar orphaned jobs
      const orphanedCount = await this.cleanupOrphanedJobs();
      stats.orphaned = orphanedCount;

      // 5. Registrar execução
      const completedAt = new Date();
      stats.duration = completedAt.getTime() - startedAt.getTime();

      await prisma.reconciliationLog.create({
        data: {
          lastRunAt: new Date(),
          duration: stats.duration,
          created: stats.created,
          updated: stats.updated,
          orphaned: stats.orphaned,
          deleted: stats.deleted,
          errors: stats.errors,
          status: 'success',
        },
      });

      const result: ReconciliationResult = {
        success: true,
        stats,
        startedAt,
        completedAt,
      };

      logger.info('✅ Reconciliação concluída', stats);
      return result;
    } catch (error) {
      stats.errors++;
      const completedAt = new Date();
      stats.duration = completedAt.getTime() - startedAt.getTime();

      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Erro em reconciliação:', errorMsg);

      // Registrar falha
      await prisma.reconciliationLog.create({
        data: {
          lastRunAt: lastLog?.lastRunAt || new Date(0),
          duration: stats.duration,
          created: stats.created,
          updated: stats.updated,
          orphaned: stats.orphaned,
          deleted: stats.deleted,
          errors: stats.errors,
          status: 'failed',
        },
      }).catch((e) => {
        logger.error('Erro ao registrar log de reconciliação:', e);
      });

      return {
        success: false,
        stats,
        error: errorMsg,
        startedAt,
        completedAt,
      };
    }
  }

  /**
   * Processar uma reserva do Stays
   */
  private async processStaysReservation(
    staysRes: any,
    stats: ReconciliationStats
  ): Promise<void> {
    try {
      // Buscar reserva existente
      const existing = await prisma.reservation.findFirst({
        where: { staysReservationId: staysRes.id },
      });

      if (!existing) {
        // Criar nova reserva
        await this.createReservationFromStays(staysRes, stats);
      } else {
        // Atualizar se necessário
        await this.updateReservationFromStays(existing, staysRes, stats);
      }
    } catch (error) {
      stats.errors++;
      logger.error(
        `Erro ao processar reserva ${staysRes.id}:`,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Criar reserva a partir do Stays
   */
  private async createReservationFromStays(
    staysRes: any,
    stats: ReconciliationStats
  ): Promise<void> {
    const reservation = await prisma.reservation.create({
      data: {
        staysReservationId: staysRes.id,
        guestName: staysRes.guestName,
        guestEmail: staysRes.guestEmail,
        accommodationId: staysRes.accommodationId,
        checkIn: new Date(staysRes.checkIn),
        checkOut: new Date(staysRes.checkOut),
        status: 'confirmed',
        externalData: staysRes,
      },
    });

    stats.created++;
    logger.info(`✓ Criada reserva: ${reservation.id} (${staysRes.id})`);

    // Reagendar jobs
    await this.scheduleJobs(reservation);
  }

  /**
   * Atualizar reserva se dados mudaram
   */
  private async updateReservationFromStays(
    existing: any,
    staysRes: any,
    stats: ReconciliationStats
  ): Promise<void> {
    const needsUpdate =
      existing.guestName !== staysRes.guestName ||
      existing.guestEmail !== staysRes.guestEmail ||
      existing.status !== (staysRes.status || 'confirmed');

    if (needsUpdate) {
      const updated = await prisma.reservation.update({
        where: { id: existing.id },
        data: {
          guestName: staysRes.guestName,
          guestEmail: staysRes.guestEmail,
          status: staysRes.status || 'confirmed',
          externalData: staysRes,
        },
      });

      stats.updated++;
      logger.info(`✓ Atualizada reserva: ${updated.id}`);

      // Reagendar jobs se necessário
      if (updated.status === 'confirmed') {
        await this.scheduleJobs(updated);
      }
    }
  }

  /**
   * Agendar jobs de PIN para uma reserva
   */
  private async scheduleJobs(reservation: any): Promise<void> {
    try {
      const { Queue } = require('bullmq');
      const Redis = require('ioredis');

      const redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      });

      const generatePinQueue = new Queue('generatePin', {
        connection: redis,
      });
      const revokePinQueue = new Queue('revokePin', { connection: redis });

      const checkIn = new Date(reservation.checkIn);
      const checkOut = new Date(reservation.checkOut);
      const now = new Date();

      // Schedule PIN generation (2 horas antes do check-in)
      if (checkIn > now) {
        const generateDelay = checkIn.getTime() - now.getTime() - 2 * 60 * 60 * 1000;

        await generatePinQueue.add(
          'generate',
          {
            reservationId: reservation.id,
            accommodationId: reservation.accommodationId,
            checkIn: reservation.checkIn,
            checkOut: reservation.checkOut,
          },
          { delay: Math.max(0, generateDelay), jobId: `gen-${reservation.id}` }
        );
      }

      // Schedule PIN revocation (24 horas após check-out)
      const revokeDelay = checkOut.getTime() - now.getTime() + 24 * 60 * 60 * 1000;

      await revokePinQueue.add(
        'revoke',
        {
          reservationId: reservation.id,
        },
        {
          delay: Math.max(0, revokeDelay),
          jobId: `rev-${reservation.id}`,
        }
      );

      await redis.quit();
    } catch (error) {
      logger.warn('Erro ao agendar jobs:', error instanceof Error ? error.message : 'Unknown');
    }
  }

  /**
   * Limpar jobs órfãos (sem Reservation correspondente)
   */
  private async cleanupOrphanedJobs(): Promise<number> {
    try {
      const { Queue } = require('bullmq');
      const Redis = require('ioredis');

      const redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      });

      const generatePinQueue = new Queue('generatePin', {
        connection: redis,
      });
      const revokePinQueue = new Queue('revokePin', { connection: redis });

      let orphanedCount = 0;

      // Buscar jobs ativos
      const allJobs = [
        ...(await generatePinQueue.getJobs()),
        ...(await revokePinQueue.getJobs()),
      ];

      for (const job of allJobs) {
        const reservationId = job.data.reservationId;

        if (!reservationId) continue;

        const reservation = await prisma.reservation.findUnique({
          where: { id: reservationId },
        });

        if (!reservation) {
          // Job órfão - remover
          await job.remove();
          orphanedCount++;
          logger.warn(`🗑️ Removido job órfão: ${job.id}`);
        }
      }

      await redis.quit();
      return orphanedCount;
    } catch (error) {
      logger.error(
        'Erro ao limpar jobs órfãos:',
        error instanceof Error ? error.message : 'Unknown'
      );
      return 0;
    }
  }
}

export const reconciliationService = new ReconciliationService();
