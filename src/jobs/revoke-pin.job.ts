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
import { LockProviderFactory } from '../lib/lock-provider-factory';
import { v4 as uuidv4 } from 'uuid';

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
  const requestId = uuidv4();
  
  try {
    const { reservationId } = job.data;
    
    console.log(
      `[Revoke PIN] [${requestId}] Iniciando revogação para reserva ${reservationId}`
    );
    
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
      include: {
        lock: true, // Incluir dados da lock para access lock provider
      },
    });
    
    console.log(
      `[Revoke PIN] [${requestId}] Encontradas ${activeCredentials.length} credenciais ativas`
    );
    
    if (activeCredentials.length === 0) {
      console.log(
        `[Revoke PIN] [${requestId}] ℹ️  Nenhuma credencial ativa para revogar`
      );
      
      return {
        success: true,
        revokedCredentials: 0,
        credentialIds: [],
      };
    }
    
    // =====================================================================
    // PASSO 4: Criar instância do provider e revogar cada credential
    // =====================================================================
    const lockProvider = LockProviderFactory.create();
    const now = new Date();
    const revokedIds: string[] = [];
    const failedCredentials: Array<{ credentialId: string; error: string }> =
      [];
    
    for (const credential of activeCredentials) {
      try {
        console.log(
          `[Revoke PIN] [${requestId}] Revogando credential ${credential.id}...`
        );
        
        // Chamar lock provider para revogar PIN no dispositivo
        const providerResult = await lockProvider.revokePin(
          credential.lockId,
          credential.providerRef || credential.pin // Usar providerRef ou PIN como fallback
        );
        
        console.log(
          `[Revoke PIN] [${requestId}] Lock provider retornou:`,
          providerResult
        );
        
        // Atualizar status no banco de dados
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
          `[Revoke PIN] [${requestId}] ✅ Credential revogada: ${credential.id}`
        );
        
      } catch (credentialError) {
        const errorMsg =
          credentialError instanceof Error
            ? credentialError.message
            : String(credentialError);
        
        console.error(
          `[Revoke PIN] [${requestId}] ❌ Erro ao revogar credential ${credential.id}:`,
          errorMsg
        );
        
        failedCredentials.push({
          credentialId: credential.id,
          error: errorMsg,
        });
        
        // Continuar processando outras credentials (não falhar tudo por uma)
      }
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
          failedCount: failedCredentials.length,
          credentialIds: revokedIds,
          failedCredentials: failedCredentials,
          revokedAt: now.toISOString(),
          requestId: requestId,
        },
      },
    });
    
    console.log(`[Revoke PIN] [${requestId}] ✅ PIN revogado para reserva`);
    console.log(`  Total revogados: ${revokedIds.length}`);
    console.log(`  Total falhados: ${failedCredentials.length}`);
    
    // =====================================================================
    // PASSO 6: Retornar resultado
    // =====================================================================
    if (failedCredentials.length > 0) {
      const error = `Revoked ${revokedIds.length} credentials, but ${failedCredentials.length} failed`;
      
      return {
        success: false,
        revokedCredentials: revokedIds.length,
        credentialIds: revokedIds,
        error: error,
      };
    }
    
    return {
      success: true,
      revokedCredentials: revokedIds.length,
      credentialIds: revokedIds,
    };
    
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : String(error);
    
    console.error(
      `[Revoke PIN] [${requestId}] ❌ Erro ao revogar PIN:`,
      errorMsg
    );
    
    // Log de erro em auditoria
    try {
      await prisma.auditLog.create({
        data: {
          action: 'REVOKE_CREDENTIAL_ERROR',
          entity: 'Credential',
          entityId: job.data.reservationId,
          userId: 'system-pin-revoke',
          details: {
            error: errorMsg,
            jobId: job.id,
            requestId: requestId,
            stack: error instanceof Error ? error.stack : undefined,
          },
        },
      });
    } catch (auditError) {
      console.error(
        `[Revoke PIN] [${requestId}] Erro ao criar audit log:`,
        auditError
      );
    }
    
    return {
      success: false,
      error: errorMsg,
    };
    
  } finally {
    await prisma.$disconnect();
  }
}

// Exportar para ser usado em worker
export default processRevokePin;
