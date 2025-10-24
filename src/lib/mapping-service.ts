/**
 * Mapping Service para Acomodação ↔ Fechadura
 * 
 * Gerencia os vínculos 1:1 entre acomodações e fechaduras com validações rigorosas.
 * 
 * Regras:
 * - 1 acomodação → máximo 1 fechadura
 * - 1 fechadura → máximo 1 acomodação
 * - Atualizar existente se já houver mapeamento
 * - Deletar se lockId = null
 */

import { prisma } from './prisma';
import { Prisma } from '@prisma/client';

/**
 * Resultado de uma operação de mapeamento
 */
export interface MappingResult {
  success: boolean;
  error?: string;
  mapping?: {
    id: string;
    accommodationId: string;
    lockId: string;
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
  };
}

/**
 * Mapeia uma acomodação a uma fechadura
 * 
 * @param accommodationId - ID da acomodação
 * @param lockId - ID da fechadura (ou null para desvincular)
 * @param createdBy - Usuário que fez o mapeamento (opcional)
 * @returns Resultado da operação
 */
export async function mapAccommodationToLock(
  accommodationId: string,
  lockId: string | null,
  createdBy?: string
): Promise<MappingResult> {
  try {
    // Se lockId é null, desmapear
    if (lockId === null || lockId === undefined || lockId === '') {
      return await unmapAccommodation(accommodationId);
    }

    // ======================================================================
    // VALIDAÇÕES
    // ======================================================================

    // 1. Verificar se acomodação existe
    const accommodation = await prisma.accommodation.findUnique({
      where: { id: accommodationId },
    });

    if (!accommodation) {
      return {
        success: false,
        error: `Acomodação com ID "${accommodationId}" não encontrada`,
      };
    }

    // 2. Verificar se fechadura existe
    const lock = await prisma.lock.findUnique({
      where: { id: lockId },
    });

    if (!lock) {
      return {
        success: false,
        error: `Fechadura com ID "${lockId}" não encontrada`,
      };
    }

    // 3. Verificar se a fechadura já está mapeada para outra acomodação
    const existingMapping = await prisma.accommodationLock.findFirst({
      where: {
        lockId: lockId,
        accommodationId: {
          not: accommodationId, // Permitir re-mapeamento para mesma acomodação
        },
      },
    });

    if (existingMapping) {
      return {
        success: false,
        error: `Fechadura já está mapeada para acomodação "${existingMapping.accommodationId}". Uma fechadura pode estar vinculada a apenas 1 acomodação.`,
      };
    }

    // ======================================================================
    // OPERAÇÃO DE MAPEAMENTO
    // ======================================================================

    // Verificar se já existe mapeamento para esta acomodação
    const currentMapping = await prisma.accommodationLock.findFirst({
      where: { accommodationId },
    });

    let mapping;

    if (currentMapping) {
      // Atualizar mapeamento existente
      mapping = await prisma.accommodationLock.update({
        where: { id: currentMapping.id },
        data: {
          lockId: lockId,
          updatedAt: new Date(),
          // Não sobrescrever createdBy se não fornecido
          ...(createdBy && { createdBy }),
        },
      });
    } else {
      // Criar novo mapeamento
      mapping = await prisma.accommodationLock.create({
        data: {
          accommodationId,
          lockId,
          createdBy: createdBy || 'system',
        },
      });
    }

    return {
      success: true,
      mapping: {
        id: mapping.id,
        accommodationId: mapping.accommodationId,
        lockId: mapping.lockId,
        createdBy: mapping.createdBy || undefined,
        createdAt: mapping.createdAt,
        updatedAt: mapping.updatedAt,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[mapping-service] mapAccommodationToLock error:', error);

    return {
      success: false,
      error: `Erro ao mapear acomodação: ${message}`,
    };
  }
}

/**
 * Desmapeia uma acomodação (remove o vínculo com fechadura)
 * 
 * @param accommodationId - ID da acomodação
 * @returns Resultado da operação
 */
export async function unmapAccommodation(
  accommodationId: string
): Promise<MappingResult> {
  try {
    // Verificar se acomodação existe
    const accommodation = await prisma.accommodation.findUnique({
      where: { id: accommodationId },
    });

    if (!accommodation) {
      return {
        success: false,
        error: `Acomodação com ID "${accommodationId}" não encontrada`,
      };
    }

    // Procurar mapeamento existente
    const mapping = await prisma.accommodationLock.findFirst({
      where: { accommodationId },
    });

    if (!mapping) {
      return {
        success: false,
        error: `Nenhum mapeamento encontrado para acomodação "${accommodationId}"`,
      };
    }

    // Deletar mapeamento
    const deleted = await prisma.accommodationLock.delete({
      where: { id: mapping.id },
    });

    return {
      success: true,
      mapping: {
        id: deleted.id,
        accommodationId: deleted.accommodationId,
        lockId: deleted.lockId,
        createdBy: deleted.createdBy || undefined,
        createdAt: deleted.createdAt,
        updatedAt: deleted.updatedAt,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[mapping-service] unmapAccommodation error:', error);

    return {
      success: false,
      error: `Erro ao desmapar acomodação: ${message}`,
    };
  }
}

/**
 * Obtém o mapeamento de uma acomodação
 * 
 * @param accommodationId - ID da acomodação
 * @returns Mapeamento ou null
 */
export async function getAccommodationMapping(accommodationId: string) {
  try {
    return await prisma.accommodationLock.findFirst({
      where: { accommodationId },
      include: {
        accommodation: true,
        lock: true,
      },
    });
  } catch (error) {
    console.error('[mapping-service] getAccommodationMapping error:', error);
    return null;
  }
}

/**
 * Obtém todas as fechaduras mapeadas (com acomodação)
 * 
 * @returns Lista de mapeamentos
 */
export async function getMappedLocks() {
  try {
    return await prisma.accommodationLock.findMany({
      include: {
        accommodation: true,
        lock: true,
      },
    });
  } catch (error) {
    console.error('[mapping-service] getMappedLocks error:', error);
    return [];
  }
}

/**
 * Obtém todas as fechaduras NÃO mapeadas
 * 
 * @returns Lista de fechaduras sem acomodação
 */
export async function getUnmappedLocks() {
  try {
    // Pegar IDs das fechaduras que já possuem mapeamento
    const mappedLockIds = await prisma.accommodationLock.findMany({
      select: { lockId: true },
    });

    const mappedIds = mappedLockIds.map((m: { lockId: string }) => m.lockId);

    // Retornar fechaduras que não estão em mappedIds
    return await prisma.lock.findMany({
      where: {
        id: {
          notIn: mappedIds,
        },
      },
    });
  } catch (error) {
    console.error('[mapping-service] getUnmappedLocks error:', error);
    return [];
  }
}

/**
 * Valida se um mapeamento atende às regras 1:1
 * 
 * @param accommodationId - ID da acomodação
 * @param lockId - ID da fechadura
 * @returns { valid: boolean, reason?: string }
 */
export async function validateMapping(
  accommodationId: string,
  lockId: string
): Promise<{ valid: boolean; reason?: string }> {
  try {
    // Verificar se acomodação existe
    const accommodation = await prisma.accommodation.findUnique({
      where: { id: accommodationId },
    });

    if (!accommodation) {
      return { valid: false, reason: 'Acomodação não encontrada' };
    }

    // Verificar se fechadura existe
    const lock = await prisma.lock.findUnique({
      where: { id: lockId },
    });

    if (!lock) {
      return { valid: false, reason: 'Fechadura não encontrada' };
    }

    // Verificar se fechadura já está mapeada para outra acomodação
    const existingMapping = await prisma.accommodationLock.findFirst({
      where: {
        lockId,
        accommodationId: { not: accommodationId },
      },
    });

    if (existingMapping) {
      return {
        valid: false,
        reason: `Fechadura já está mapeada para outra acomodação`,
      };
    }

    return { valid: true };
  } catch (error) {
    console.error('[mapping-service] validateMapping error:', error);
    return { valid: false, reason: 'Erro ao validar mapeamento' };
  }
}
