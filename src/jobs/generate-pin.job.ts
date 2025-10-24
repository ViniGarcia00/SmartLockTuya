/**
 * Generate PIN Job
 * 
 * BullMQ job processor para gerar PIN temporário de 6 dígitos
 * e salvar em Credential com validade
 * 
 * Job Data:
 * {
 *   reservationId: string
 *   lockId: string
 *   checkOutAt: ISO datetime string
 * }
 * 
 * Result:
 * {
 *   success: true
 *   credentialId: string
 *   pin: string (plain text, apenas para envio ao hóspede)
 *   hash: string (hash bcrypt armazenado)
 *   validFrom: ISO datetime
 *   validTo: ISO datetime
 * }
 */

import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { generateRandomPin, hashPin } from '../lib/pin-generator';
import { LockProviderFactory } from '../lib/lock-provider-factory';

// Tipos para o job
export interface GeneratePinJobData {
  reservationId: string;
  lockId: string;
  checkOutAt: string; // ISO datetime string
  requestId?: string; // Para rastreamento em logs
}

export interface GeneratePinJobResult {
  success: boolean;
  credentialId?: string;
  pin?: string; // Plain text - apenas para envio ao hóspede
  hash?: string;
  validFrom?: string;
  validTo?: string;
  lockProviderResponse?: any; // Resposta do lock provider
  error?: string;
}

/**
 * Processa job de geração de PIN
 * 
 * Fluxo:
 * 1. Busca reservation e lock
 * 2. Gera PIN aleatório de 6 dígitos
 * 3. Faz hash com bcrypt
 * 4. Salva em Credential com validFrom=now e validTo=checkOutAt
 * 5. Log da ação
 * 
 * @param job - BullMQ Job com GeneratePinJobData
 * @returns GeneratePinJobResult
 */
export async function processGeneratePin(
  job: Job<GeneratePinJobData>
): Promise<GeneratePinJobResult> {
  const prisma = new PrismaClient();
  const requestId = job.data.requestId || job.id || 'unknown';
  
  try {
    const { reservationId, lockId, checkOutAt } = job.data;
    
    console.log(`[Generate PIN] [${requestId}] Iniciando para reserva ${reservationId}`);
    
    // =====================================================================
    // PASSO 1: Validar dados do job
    // =====================================================================
    if (!reservationId || !lockId || !checkOutAt) {
      throw new Error('Missing required job data: reservationId, lockId, checkOutAt');
    }
    
    const checkOutDate = new Date(checkOutAt);
    if (isNaN(checkOutDate.getTime())) {
      throw new Error('Invalid checkOutAt datetime format');
    }
    
    // =====================================================================
    // PASSO 2: Verificar se reservation e lock existem
    // =====================================================================
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { accommodation: true },
    });
    
    if (!reservation) {
      throw new Error(`Reservation not found: ${reservationId}`);
    }
    
    const lock = await prisma.lock.findUnique({
      where: { id: lockId },
    });
    
    if (!lock) {
      throw new Error(`Lock not found: ${lockId}`);
    }
    
    // Verificar se accommodation da reservation tem essa lock
    const accommodationLock = await prisma.accommodationLock.findFirst({
      where: {
        accommodationId: reservation.accommodationId,
        lockId: lockId,
      },
    });
    
    if (!accommodationLock) {
      // DLQ: Lock não mapeado para esta acomodação
      throw new Error(
        `Lock ${lockId} is not associated with accommodation ${reservation.accommodationId} (DLQ)`
      );
    }
    
    // =====================================================================
    // PASSO 3: Revogar credential anterior (se existir)
    // =====================================================================
    const existingCredential = await prisma.credential.findUnique({
      where: {
        reservationId_lockId: {
          reservationId: reservationId,
          lockId: lockId,
        },
      },
    });
    
    if (existingCredential && existingCredential.status !== 'REVOKED') {
      await prisma.credential.update({
        where: { id: existingCredential.id },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
        },
      });
      
      console.log(`[Generate PIN] [${requestId}] Credencial anterior revogada: ${existingCredential.id}`);
    }
    
    // =====================================================================
    // PASSO 4: Gerar PIN aleatório
    // =====================================================================
    const plainPin = generateRandomPin();
    console.log(`[Generate PIN] [${requestId}] PIN gerado: ${plainPin}`);
    
    // =====================================================================
    // PASSO 5: Hash PIN com bcrypt
    // =====================================================================
    const hashedPin = await hashPin(plainPin);
    console.log(`[Generate PIN] [${requestId}] PIN hasheado com bcrypt`);
    
    // =====================================================================
    // PASSO 6: Chamar Lock Provider para criar PIN temporário
    // =====================================================================
    let lockProviderResponse: any = null;
    const now = new Date();
    
    try {
      const lockProvider = LockProviderFactory.create();
      console.log(`[Generate PIN] [${requestId}] Chamando lockProvider.createTimedPin()`);
      
      lockProviderResponse = await lockProvider.createTimedPin(
        lockId,
        plainPin,
        now,
        checkOutDate
      );
      
      console.log(`[Generate PIN] [${requestId}] ✅ Lock provider retornou:`, lockProviderResponse);
    } catch (lockError) {
      console.error(`[Generate PIN] [${requestId}] ❌ Erro ao chamar lock provider:`, lockError);
      
      // Log do erro do lock provider
      await prisma.auditLog.create({
        data: {
          action: 'LOCK_PROVIDER_ERROR',
          entity: 'Lock',
          entityId: lockId,
          userId: 'system-pin-generator',
          details: {
            error: lockError instanceof Error ? lockError.message : String(lockError),
            requestId: requestId,
            reservationId: reservationId,
          },
        },
      });
      
      // Re-lançar para trigger de retry automático
      throw new Error(`Lock provider failed: ${lockError instanceof Error ? lockError.message : String(lockError)}`);
    }
    
    // =====================================================================
    // PASSO 7: Salvar ou atualizar Credential
    // =====================================================================
    const credential = await prisma.credential.upsert({
      where: {
        reservationId_lockId: {
          reservationId: reservationId,
          lockId: lockId,
        },
      },
      update: {
        pin: hashedPin,
        plainPin: plainPin,
        status: 'ACTIVE',
        validFrom: now,
        validTo: checkOutDate,
        revokedAt: null, // Limpar revogação anterior
      },
      create: {
        reservationId: reservationId,
        lockId: lockId,
        pin: hashedPin,
        plainPin: plainPin,
        status: 'ACTIVE',
        validFrom: now,
        validTo: checkOutDate,
        createdBy: 'system-pin-generator',
      },
    });
    
    console.log(`[Generate PIN] [${requestId}] ✅ PIN criado com sucesso`);
    console.log(`  Credential ID: ${credential.id}`);
    console.log(`  Lock ID: ${lockId}`);
    console.log(`  Valid From: ${credential.validFrom.toISOString()}`);
    console.log(`  Valid To: ${credential.validTo.toISOString()}`);
    
    // =====================================================================
    // PASSO 8: Log de auditoria
    // =====================================================================
    await prisma.auditLog.create({
      data: {
        action: 'CREATE_CREDENTIAL',
        entity: 'Credential',
        entityId: credential.id,
        userId: 'system-pin-generator',
        details: {
          requestId: requestId,
          reservationId: reservationId,
          lockId: lockId,
          validFrom: credential.validFrom.toISOString(),
          validTo: credential.validTo.toISOString(),
          lockProviderStatus: lockProviderResponse?.success,
        },
      },
    });
    
    // =====================================================================
    // PASSO 9: Retornar resultado
    // =====================================================================
    return {
      success: true,
      credentialId: credential.id,
      pin: plainPin, // Será usado para enviar ao hóspede
      hash: hashedPin,
      validFrom: credential.validFrom.toISOString(),
      validTo: credential.validTo.toISOString(),
      lockProviderResponse: lockProviderResponse,
    };
    
  } catch (error) {
    console.error(`[Generate PIN] [${requestId}] ❌ Erro ao gerar PIN:`, error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isDLQError = errorMessage.includes('DLQ');
    
    // =====================================================================
    // Tratamento de Erro: DLQ vs Retry
    // =====================================================================
    
    if (isDLQError) {
      // Lock não mapeado → Dead Letter Queue (sem retry)
      console.error(`[Generate PIN] [${requestId}] 📛 ERRO CRÍTICO - Enviando para DLQ: ${errorMessage}`);
      
      try {
        await prisma.auditLog.create({
          data: {
            action: 'CREATE_CREDENTIAL_DLQ',
            entity: 'Credential',
            entityId: job.data.reservationId,
            userId: 'system-pin-generator',
            details: {
              requestId: requestId,
              error: errorMessage,
              jobId: job.id,
              attempts: job.attemptsMade,
              reason: 'Lock not mapped to accommodation',
            },
          },
        });
      } catch (auditError) {
        console.error(`[Generate PIN] [${requestId}] Erro ao criar audit log de DLQ:`, auditError);
      }
      
      // Retornar falha sem retry
      return {
        success: false,
        error: `[DLQ] ${errorMessage}`,
      };
    } else {
      // Erro de lock provider ou outro → Retry automático (até 3x)
      const attempts = (job.attemptsMade || 0) + 1;
      const maxRetries = 3;
      
      console.warn(`[Generate PIN] [${requestId}] ⚠️ Tentativa ${attempts}/${maxRetries}: ${errorMessage}`);
      
      try {
        await prisma.auditLog.create({
          data: {
            action: 'CREATE_CREDENTIAL_RETRY',
            entity: 'Credential',
            entityId: job.data.reservationId,
            userId: 'system-pin-generator',
            details: {
              requestId: requestId,
              error: errorMessage,
              jobId: job.id,
              attempt: attempts,
              maxRetries: maxRetries,
            },
          },
        });
      } catch (auditError) {
        console.error(`[Generate PIN] [${requestId}] Erro ao criar audit log de retry:`, auditError);
      }
      
      // Se atingiu max retries, mover para DLQ
      if (attempts >= maxRetries) {
        console.error(`[Generate PIN] [${requestId}] 📛 Max retries atingido. Movendo para DLQ.`);
        
        try {
          await prisma.auditLog.create({
            data: {
              action: 'CREATE_CREDENTIAL_FAILED_DLQ',
              entity: 'Credential',
              entityId: job.data.reservationId,
              userId: 'system-pin-generator',
              details: {
                requestId: requestId,
                error: errorMessage,
                jobId: job.id,
                finalAttempt: attempts,
              },
            },
          });
        } catch (auditError) {
          console.error(`[Generate PIN] [${requestId}] Erro ao criar audit log de failed DLQ:`, auditError);
        }
        
        return {
          success: false,
          error: `Failed after ${maxRetries} retries: ${errorMessage}`,
        };
      }
      
      // Lançar erro para trigger de retry automático pelo BullMQ
      throw error;
    }
    
  } finally {
    await prisma.$disconnect();
  }
}

// Exportar para ser usado em worker
export default processGeneratePin;
