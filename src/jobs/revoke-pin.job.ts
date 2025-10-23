/**
 * Revoke PIN Job
 * 
 * BullMQ job processor para revogar PIN de uma reserva
 * Marca Credential como revoked
 * 
 * Job Data:
 * {
 *   reservationId: string
 * }
 * 
 * Result:
 * {
 *   success: true
 *   revokedCredentials: number (quantos PINs foram revogados)
 * }
 */

import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';

// Tipos para o job
export interface RevokePinJobData {
  reservationId: string;
}

export interface RevokePinJobResult {
  success: boolean;
  revokedCredentials?: number;
  credentialIds?: string[];
  error?: string;
}

/**
 * Processa job de revogação de PIN
 * 
 * Fluxo:
 * 1. Busca todos os PINs ativos da reserva
 * 2. Marca como REVOKED
 * 3. Log da ação
 * 
 * @param job - BullMQ Job com RevokePinJobData
 * @returns RevokePinJobResult
 */
export async function processRevokePin(
  job: Job<RevokePinJobData>
): Promise<RevokePinJobResult> {
  const prisma = new PrismaClient();
  
  try {
    const { reservationId } = job.data;
    
    console.log(`[Revoke PIN] Iniciando revogação para reserva ${reservationId}`);
    
    // =====================================================================
    // PASSO 1: Validar dados do job
    // =====================================================================
    if (!reservationId) {
      throw new Error('Missing required job data: reservationId');
    }
    
    // =====================================================================
    // PASSO 2: Verificar se reservation existe
    // =====================================================================
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });
    
    if (!reservation) {
      throw new Error(`Reservation not found: ${reservationId}`);
    }
    
    // =====================================================================
    // PASSO 3: Buscar todas as credentials ativas dessa reserva
    // =====================================================================
    const activeCredentials = await prisma.credential.findMany({
      where: {
        reservationId: reservationId,
        status: 'ACTIVE',
      },
    });
    
    console.log(
      `[Revoke PIN] Encontradas ${activeCredentials.length} credenciais ativas`
    );
    
    if (activeCredentials.length === 0) {
      console.log(
        `[Revoke PIN] ℹ️  Nenhuma credencial ativa para revogar em ${reservationId}`
      );
      
      return {
        success: true,
        revokedCredentials: 0,
        credentialIds: [],
      };
    }
    
    // =====================================================================
    // PASSO 4: Revogar todas as credentials
    // =====================================================================
    const now = new Date();
    const revokedIds: string[] = [];
    
    for (const credential of activeCredentials) {
      await prisma.credential.update({
        where: { id: credential.id },
        data: {
          status: 'REVOKED',
          revokedAt: now,
          revokedBy: 'system-pin-revoke',
        },
      });
      
      revokedIds.push(credential.id);
      
      console.log(
        `[Revoke PIN] ✅ Credencial revogada: ${credential.id} (Lock: ${credential.lockId})`
      );
    }
    
    // =====================================================================
    // PASSO 5: Log de auditoria
    // =====================================================================
    await prisma.auditLog.create({
      data: {
        action: 'REVOKE_CREDENTIAL',
        entity: 'Credential',
        entityId: reservationId,
        userId: 'system-pin-revoke',
        details: {
          reservationId: reservationId,
          revokedCount: revokedIds.length,
          credentialIds: revokedIds,
          revokedAt: now.toISOString(),
        },
      },
    });
    
    console.log(`[Revoke PIN] ✅ PIN revogado para reserva ${reservationId}`);
    console.log(`  Total revogados: ${revokedIds.length}`);
    console.log(`  Credential IDs: ${revokedIds.join(', ')}`);
    
    // =====================================================================
    // PASSO 6: Retornar resultado
    // =====================================================================
    return {
      success: true,
      revokedCredentials: revokedIds.length,
      credentialIds: revokedIds,
    };
    
  } catch (error) {
    console.error('[Revoke PIN] ❌ Erro ao revogar PIN:', error);
    
    // Log de erro em auditoria
    try {
      await prisma.auditLog.create({
        data: {
          action: 'REVOKE_CREDENTIAL_ERROR',
          entity: 'Credential',
          entityId: job.data.reservationId,
          userId: 'system-pin-revoke',
          details: {
            error: error instanceof Error ? error.message : String(error),
            jobId: job.id,
          },
        },
      });
    } catch (auditError) {
      console.error('[Revoke PIN] Erro ao criar audit log:', auditError);
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
export default processRevokePin;
