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

// Tipos para o job
export interface GeneratePinJobData {
  reservationId: string;
  lockId: string;
  checkOutAt: string; // ISO datetime string
}

export interface GeneratePinJobResult {
  success: boolean;
  credentialId?: string;
  pin?: string; // Plain text - apenas para envio ao hóspede
  hash?: string;
  validFrom?: string;
  validTo?: string;
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
  
  try {
    const { reservationId, lockId, checkOutAt } = job.data;
    
    console.log(`[Generate PIN] Iniciando para reserva ${reservationId}`);
    
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
      throw new Error(
        `Lock ${lockId} is not associated with accommodation ${reservation.accommodationId}`
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
      
      console.log(`[Generate PIN] Credencial anterior revogada: ${existingCredential.id}`);
    }
    
    // =====================================================================
    // PASSO 4: Gerar PIN aleatório
    // =====================================================================
    const plainPin = generateRandomPin();
    console.log(`[Generate PIN] PIN gerado: ${plainPin}`);
    
    // =====================================================================
    // PASSO 5: Hash PIN com bcrypt
    // =====================================================================
    const hashedPin = await hashPin(plainPin);
    console.log(`[Generate PIN] PIN hasheado com bcrypt`);
    
    // =====================================================================
    // PASSO 6: Salvar em Credential
    // =====================================================================
    const now = new Date();
    
    const credential = await prisma.credential.create({
      data: {
        reservationId: reservationId,
        lockId: lockId,
        pin: hashedPin,
        plainPin: plainPin, // Armazenar temporariamente para envio ao hóspede
        status: 'ACTIVE',
        validFrom: now,
        validTo: checkOutDate,
        createdBy: 'system-pin-generator',
      },
    });
    
    console.log(`[Generate PIN] ✅ PIN gerado para reserva ${reservationId}`);
    console.log(`  Credential ID: ${credential.id}`);
    console.log(`  Lock ID: ${lockId}`);
    console.log(`  Valid From: ${credential.validFrom.toISOString()}`);
    console.log(`  Valid To: ${credential.validTo.toISOString()}`);
    
    // =====================================================================
    // PASSO 7: Log de auditoria
    // =====================================================================
    await prisma.auditLog.create({
      data: {
        action: 'CREATE_CREDENTIAL',
        entity: 'Credential',
        entityId: credential.id,
        userId: 'system-pin-generator',
        details: {
          reservationId: reservationId,
          lockId: lockId,
          validFrom: credential.validFrom.toISOString(),
          validTo: credential.validTo.toISOString(),
        },
      },
    });
    
    // =====================================================================
    // PASSO 8: Retornar resultado
    // =====================================================================
    return {
      success: true,
      credentialId: credential.id,
      pin: plainPin, // Será usado para enviar ao hóspede
      hash: hashedPin,
      validFrom: credential.validFrom.toISOString(),
      validTo: credential.validTo.toISOString(),
    };
    
  } catch (error) {
    console.error('[Generate PIN] ❌ Erro ao gerar PIN:', error);
    
    // Log de erro em auditoria
    try {
      await prisma.auditLog.create({
        data: {
          action: 'CREATE_CREDENTIAL_ERROR',
          entity: 'Credential',
          entityId: job.data.reservationId,
          userId: 'system-pin-generator',
          details: {
            error: error instanceof Error ? error.message : String(error),
            jobId: job.id,
          },
        },
      });
    } catch (auditError) {
      console.error('[Generate PIN] Erro ao criar audit log:', auditError);
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
    
  } finally {
    await prisma.$disconnect();
  }
}

// Exportar para ser usado em worker
export default processGeneratePin;
