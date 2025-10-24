/**
 * API Route: POST /api/admin/mappings
 * 
 * Responsável por mapear/desmapar acomodações com fechaduras
 * 
 * Body: { accommodationId, lockId? }
 * - Se lockId fornecido: mapear
 * - Se lockId null/undefined: desmapar
 * 
 * Retorna: { success: boolean, mapping?, error? }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  mapAccommodationToLock,
  unmapAccommodation,
} from '../../../../lib/mapping-service';
import { prisma } from '../../../../lib/prisma';

/**
 * Middleware para autenticação e logging
 */
function validateRequest(req: NextRequest) {
  // Extrair token do header Authorization
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return {
      valid: false,
      error: 'Missing Authorization header',
      userId: null,
    };
  }

  // Em um ambiente real, verificar JWT aqui
  // Por enquanto, usar um mock
  return {
    valid: true,
    userId: 'admin', // Mock: extrair do JWT
  };
}

/**
 * Logger para atividades de mapeamento
 */
async function logMappingActivity(data: {
  action: 'map' | 'unmap';
  accommodationId: string;
  lockId?: string | null;
  createdBy?: string;
  success: boolean;
  error?: string;
}) {
  try {
    // Aqui você pode salvar em um banco de dados de logs
    console.log(
      `[MAPPING-LOG] ${data.action.toUpperCase()} - Accommodation: ${data.accommodationId}, Lock: ${data.lockId || 'null'}, User: ${data.createdBy || 'unknown'}, Success: ${data.success}${data.error ? `, Error: ${data.error}` : ''}`
    );
  } catch (error) {
    console.error('[MAPPING-LOG] Error logging activity:', error);
  }
}

/**
 * POST /api/admin/mappings
 * Mapeia ou desmapeia uma acomodação
 */
export async function POST(request: NextRequest) {
  try {
    // ====================================================================
    // AUTENTICAÇÃO
    // ====================================================================
    const auth = validateRequest(request);
    if (!auth.valid) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    // ====================================================================
    // PARSE BODY
    // ====================================================================
    const body = await request.json();
    const { accommodationId, lockId } = body;

    // Validar campos obrigatórios
    if (!accommodationId) {
      return NextResponse.json(
        { success: false, error: 'accommodationId is required' },
        { status: 400 }
      );
    }

    // ====================================================================
    // EXECUTAR MAPEAMENTO/DESMAPEAMENTO
    // ====================================================================
    let result;
    const createdBy = auth.userId || 'admin';

    if (lockId === null || lockId === undefined || lockId === '') {
      // Desmapar
      result = await unmapAccommodation(accommodationId);

      // Log
      await logMappingActivity({
        action: 'unmap',
        accommodationId,
        createdBy,
        success: result.success,
        error: result.error,
      });
    } else {
      // Mapear
      result = await mapAccommodationToLock(accommodationId, lockId, createdBy);

      // Log
      await logMappingActivity({
        action: 'map',
        accommodationId,
        lockId,
        createdBy,
        success: result.success,
        error: result.error,
      });
    }

    // ====================================================================
    // RESPOSTA
    // ====================================================================
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        mapping: result.mapping,
        message: lockId
          ? 'Fechadura mapeada com sucesso'
          : 'Fechadura desmapeada com sucesso',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[POST /api/admin/mappings] Error:', error);

    const message = error instanceof Error ? error.message : 'Erro desconhecido';

    return NextResponse.json(
      {
        success: false,
        error: `Erro ao processar mapeamento: ${message}`,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/mappings
 * Retorna todos os mapeamentos com suas acomodações e fechaduras
 */
export async function GET(request: NextRequest) {
  try {
    // Autenticar
    const auth = validateRequest(request);
    if (!auth.valid) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    // Buscar todos os mapeamentos com dados relacionados
    const mappings = await prisma.accommodationLock.findMany({
      include: {
        accommodation: true,
        lock: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(
      {
        success: true,
        mappings,
        count: mappings.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/admin/mappings] Error:', error);

    const message = error instanceof Error ? error.message : 'Erro desconhecido';

    return NextResponse.json(
      {
        success: false,
        error: `Erro ao buscar mapeamentos: ${message}`,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/mappings
 * Deleta um mapeamento específico
 * 
 * Query params: ?accommodationId=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    // Autenticar
    const auth = validateRequest(request);
    if (!auth.valid) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    // Extrair accommodationId da query
    const { searchParams } = new URL(request.url);
    const accommodationId = searchParams.get('accommodationId');

    if (!accommodationId) {
      return NextResponse.json(
        { success: false, error: 'accommodationId query parameter is required' },
        { status: 400 }
      );
    }

    // Executar unmapping
    const result = await unmapAccommodation(accommodationId);

    // Log
    await logMappingActivity({
      action: 'unmap',
      accommodationId,
      createdBy: auth.userId || 'admin',
      success: result.success,
      error: result.error,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Mapeamento deletado com sucesso',
        mapping: result.mapping,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[DELETE /api/admin/mappings] Error:', error);

    const message = error instanceof Error ? error.message : 'Erro desconhecido';

    return NextResponse.json(
      {
        success: false,
        error: `Erro ao deletar mapeamento: ${message}`,
      },
      { status: 500 }
    );
  }
}
