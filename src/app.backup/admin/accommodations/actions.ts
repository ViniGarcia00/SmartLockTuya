'use server';

import { prisma } from '../../../lib/prisma';
import { revalidatePath } from 'next/cache';

/**
 * Sincronizar acomodações da API de Stays
 * POST /admin/stays/sync-accommodations
 */
export async function syncAccommodations() {
  try {
    const response = await fetch('http://localhost:3000/api/admin/stays/sync-accommodations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Erro ao sincronizar: ${response.statusText}`);
    }

    const data = await response.json() as any;

    // Revalidar cache
    revalidatePath('/admin/accommodations');

    return {
      success: true,
      message: `${data?.synced || 0} acomodações sincronizadas`,
      data,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao sincronizar acomodações';
    console.error('[syncAccommodations]', message);
    return {
      success: false,
      message,
    };
  }
}

/**
 * Vincular fechadura a uma acomodação
 * 
 * Chama POST /api/admin/mappings com validações 1:1
 */
export async function mapLock(accommodationId: string, lockId: string) {
  try {
    // Buscar token do usuário (em um app real, viria do JWT/sessão)
    const token = process.env.ADMIN_TOKEN || '';

    const response = await fetch('http://localhost:3000/api/admin/mappings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        accommodationId,
        lockId,
      }),
    });

    const data = await response.json() as { error?: string; message?: string; mapping?: unknown };

    if (!response.ok) {
      throw new Error(data.error || `Erro ao mapear: ${response.statusText}`);
    }

    revalidatePath('/admin/accommodations');

    return {
      success: true,
      message: data.message || 'Fechadura mapeada com sucesso',
      mapping: data.mapping,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao mapear fechadura';
    console.error('[mapLock]', message);
    return {
      success: false,
      message,
    };
  }
}

/**
 * Desvincular fechadura de uma acomodação
 * 
 * Chama POST /api/admin/mappings com lockId=null (desmapeamento)
 */
export async function unmapLock(accommodationId: string) {
  try {
    const token = process.env.ADMIN_TOKEN || '';

    const response = await fetch('http://localhost:3000/api/admin/mappings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        accommodationId,
        lockId: null, // null = desmapar
      }),
    });

    const data = await response.json() as { error?: string; message?: string; mapping?: unknown };

    if (!response.ok) {
      throw new Error(data.error || `Erro ao desmapar: ${response.statusText}`);
    }

    revalidatePath('/admin/accommodations');

    return {
      success: true,
      message: data.message || 'Fechadura desmapeada com sucesso',
      mapping: data.mapping,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao desmapar fechadura';
    console.error('[unmapLock]', message);
    return {
      success: false,
      message,
    };
  }
}

/**
 * Versão legada: vinculateLock (redirecionado para mapLock)
 */
export async function vinculateLock(accommodationId: string, lockId: string) {
  return mapLock(accommodationId, lockId);
}

/**
 * Versão legada: devinculateLock (redirecionado para unmapLock)
 */
export async function devinculateLock(accommodationId: string) {
  return unmapLock(accommodationId);
}

/**
 * Carregar acomodações com suas fechaduras mapeadas
 */
export async function getAccommodationsWithLocks() {
  try {
    // Buscar todas as acomodações
    const accommodations = await prisma.accommodation.findMany({
      orderBy: { name: 'asc' },
    });

    // Buscar todos os locks
    const locks = await prisma.lock.findMany({
      orderBy: { name: 'asc' },
    });

    // Buscar mapeamentos
    const mappings = await prisma.accommodationLockMapping.findMany({
      include: {
        lock: true,
      },
    });

    // Criar mapa de mapeamentos para fácil acesso
    const mappingMap = new Map(mappings.map((m: { accommodationId: string }) => [m.accommodationId, m]));

    // Encontrar locks sem mapeamento
    const mappedLockIds = new Set(mappings.map((m: { lockId: string }) => m.lockId));
    const unmappedLocks = locks.filter((lock: { id: string }) => !mappedLockIds.has(lock.id));

    return {
      accommodations,
      locks,
      mappings: mappingMap,
      unmappedLocks,
    };
  } catch (error) {
    console.error('[getAccommodationsWithLocks]', error);
    throw error;
  }
}

/**
 * Buscar sugestões de match automático
 * 
 * Chama GET /api/admin/matches/suggestions
 */
export async function getMatchSuggestions(options?: {
  threshold?: number;
  maxSuggestions?: number;
}) {
  try {
    const token = process.env.ADMIN_TOKEN || '';
    const params = new URLSearchParams();

    if (options?.threshold !== undefined) {
      params.append('threshold', options.threshold.toString());
    }
    if (options?.maxSuggestions !== undefined) {
      params.append('maxSuggestions', options.maxSuggestions.toString());
    }

    const url = `http://localhost:3000/api/admin/matches/suggestions${
      params.toString() ? `?${params}` : ''
    }`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = (await response.json()) as {
      success?: boolean;
      suggestions?: Array<{ accommodationId: string; lockId: string; score: number }>;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || `Erro ao buscar sugestões: ${response.statusText}`);
    }

    return {
      success: true,
      suggestions: data.suggestions || [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar sugestões';
    console.error('[getMatchSuggestions]', message);
    return {
      success: false,
      message,
      suggestions: [],
    };
  }
}

/**
 * Aplicar sugestões de match automático em lote
 *
 * @param suggestions - Array de { accommodationId, lockId, score }
 * @returns { applied: N, failed: N, errors: [] }
 */
export async function applyMatchSuggestions(
  suggestions: Array<{ accommodationId: string; lockId: string }>
) {
  try {
    let applied = 0;
    let failed = 0;
    const errors: Array<{ accommodationId: string; error: string }> = [];

    for (const suggestion of suggestions) {
      try {
        const result = await mapLock(suggestion.accommodationId, suggestion.lockId);

        if (result.success) {
          applied++;
        } else {
          failed++;
          errors.push({
            accommodationId: suggestion.accommodationId,
            error: result.message || 'Erro desconhecido',
          });
        }
      } catch (error) {
        failed++;
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        errors.push({
          accommodationId: suggestion.accommodationId,
          error: message,
        });
      }
    }

    revalidatePath('/admin/accommodations');

    return {
      success: true,
      applied,
      failed,
      total: suggestions.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `${applied} mapeamentos aplicados, ${failed} falharam`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao aplicar sugestões';
    console.error('[applyMatchSuggestions]', message);
    return {
      success: false,
      message,
      applied: 0,
      failed: suggestions.length,
      total: suggestions.length,
    };
  }
}
