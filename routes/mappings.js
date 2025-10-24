/**
 * Rota Express para Mapeamento de Acomodações ↔ Fechaduras
 * 
 * POST /api/admin/mappings - Mapear/desmapar
 * GET /api/admin/mappings - Listar mapeamentos
 * DELETE /api/admin/mappings/:accommodationId - Deletar mapeamento
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, logActivity } = require('../middleware/auth');

/**
 * Logger para atividades de mapeamento
 */
async function logMappingActivity(data) {
  try {
    console.log(
      `[MAPPING-LOG] ${data.action.toUpperCase()} - Accommodation: ${data.accommodationId}, Lock: ${data.lockId || 'null'}, User: ${data.createdBy || 'unknown'}, Success: ${data.success}${data.error ? `, Error: ${data.error}` : ''}`
    );
  } catch (error) {
    console.error('[MAPPING-LOG] Error logging activity:', error);
  }
}

/**
 * Mapeia uma acomodação a uma fechadura com validações 1:1
 *
 * Body: { accommodationId, lockId? }
 * - Se lockId fornecido: mapear
 * - Se lockId null/undefined: desmapar
 *
 * Retorna: { success: boolean, mapping?, error? }
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { accommodationId, lockId } = req.body;
    const userId = req.user?.id || 'admin';

    // ====================================================================
    // VALIDAÇÃO
    // ====================================================================
    if (!accommodationId) {
      return res.status(400).json({
        success: false,
        error: 'accommodationId é obrigatório',
      });
    }

    // ====================================================================
    // VERIFICAR EXISTÊNCIA DE ACOMODAÇÃO
    // ====================================================================
    const accommodationResult = await query(
      'SELECT id FROM accommodations WHERE id = $1',
      [accommodationId]
    );

    if (accommodationResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Acomodação com ID "${accommodationId}" não encontrada`,
      });
    }

    // ====================================================================
    // SE lockId = null/undefined → DESMAPAR
    // ====================================================================
    if (lockId === null || lockId === undefined || lockId === '') {
      try {
        // Procurar mapeamento existente
        const mappingResult = await query(
          'SELECT * FROM accommodation_lock_mappings WHERE accommodation_id = $1',
          [accommodationId]
        );

        if (mappingResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: `Nenhum mapeamento encontrado para acomodação "${accommodationId}"`,
          });
        }

        // Deletar mapeamento
        const deletedMapping = mappingResult.rows[0];
        await query(
          'DELETE FROM accommodation_lock_mappings WHERE id = $1',
          [deletedMapping.id]
        );

        // Log
        await logMappingActivity({
          action: 'unmap',
          accommodationId,
          createdBy: userId,
          success: true,
        });

        return res.status(200).json({
          success: true,
          message: 'Fechadura desmapeada com sucesso',
          mapping: {
            id: deletedMapping.id,
            accommodationId: deletedMapping.accommodation_id,
            lockId: deletedMapping.lock_id,
            createdBy: deletedMapping.created_by,
            createdAt: deletedMapping.created_at,
            updatedAt: deletedMapping.updated_at,
          },
        });
      } catch (error) {
        console.error('[POST /api/admin/mappings - UNMAP] Error:', error);
        const message = error instanceof Error ? error.message : 'Erro desconhecido';

        await logMappingActivity({
          action: 'unmap',
          accommodationId,
          createdBy: userId,
          success: false,
          error: message,
        });

        return res.status(500).json({
          success: false,
          error: `Erro ao desmapar: ${message}`,
        });
      }
    }

    // ====================================================================
    // SE lockId fornecido → MAPEAR
    // ====================================================================

    // 1. Verificar se fechadura existe
    const lockResult = await query(
      'SELECT id FROM locks WHERE id = $1',
      [lockId]
    );

    if (lockResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Fechadura com ID "${lockId}" não encontrada`,
      });
    }

    // 2. Verificar se fechadura já está mapeada para OUTRA acomodação
    const conflictResult = await query(
      `SELECT * FROM accommodation_lock_mappings 
       WHERE lock_id = $1 AND accommodation_id != $2`,
      [lockId, accommodationId]
    );

    if (conflictResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Fechadura já está mapeada para outra acomodação (${conflictResult.rows[0].accommodation_id}). Uma fechadura pode estar vinculada a apenas 1 acomodação.`,
      });
    }

    // 3. Verificar se acomodação já possui mapeamento
    const existingMappingResult = await query(
      'SELECT * FROM accommodation_lock_mappings WHERE accommodation_id = $1',
      [accommodationId]
    );

    try {
      let mapping;

      if (existingMappingResult.rows.length > 0) {
        // ATUALIZAR mapeamento existente
        const existingMapping = existingMappingResult.rows[0];
        const updateResult = await query(
          `UPDATE accommodation_lock_mappings 
           SET lock_id = $1, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2 RETURNING *`,
          [lockId, existingMapping.id]
        );
        mapping = updateResult.rows[0];
      } else {
        // CRIAR novo mapeamento
        const createResult = await query(
          `INSERT INTO accommodation_lock_mappings (accommodation_id, lock_id, created_by) 
           VALUES ($1, $2, $3) RETURNING *`,
          [accommodationId, lockId, userId]
        );
        mapping = createResult.rows[0];
      }

      // Log
      await logMappingActivity({
        action: 'map',
        accommodationId,
        lockId,
        createdBy: userId,
        success: true,
      });

      return res.status(200).json({
        success: true,
        message: 'Fechadura mapeada com sucesso',
        mapping: {
          id: mapping.id,
          accommodationId: mapping.accommodation_id,
          lockId: mapping.lock_id,
          createdBy: mapping.created_by,
          createdAt: mapping.created_at,
          updatedAt: mapping.updated_at,
        },
      });
    } catch (error) {
      console.error('[POST /api/admin/mappings - MAP] Error:', error);
      const message = error instanceof Error ? error.message : 'Erro desconhecido';

      await logMappingActivity({
        action: 'map',
        accommodationId,
        lockId,
        createdBy: userId,
        success: false,
        error: message,
      });

      return res.status(500).json({
        success: false,
        error: `Erro ao mapear: ${message}`,
      });
    }
  } catch (error) {
    console.error('[POST /api/admin/mappings] Error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';

    return res.status(500).json({
      success: false,
      error: `Erro ao processar mapeamento: ${message}`,
    });
  }
});

/**
 * GET /api/admin/mappings
 * Retorna todos os mapeamentos com suas acomodações e fechaduras
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        alm.id,
        alm.accommodation_id,
        alm.lock_id,
        alm.created_by,
        alm.created_at,
        alm.updated_at,
        a.name as accommodation_name,
        a.status as accommodation_status,
        l.alias as lock_alias,
        l.device_id,
        l.vendor
      FROM accommodation_lock_mappings alm
      LEFT JOIN accommodations a ON alm.accommodation_id = a.id
      LEFT JOIN locks l ON alm.lock_id = l.id
      ORDER BY alm.created_at DESC`
    );

    return res.status(200).json({
      success: true,
      mappings: result.rows.map((row) => ({
        id: row.id,
        accommodationId: row.accommodation_id,
        lockId: row.lock_id,
        accommodation: {
          id: row.accommodation_id,
          name: row.accommodation_name,
          status: row.accommodation_status,
        },
        lock: {
          id: row.lock_id,
          alias: row.lock_alias,
          deviceId: row.device_id,
          vendor: row.vendor,
        },
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      count: result.rows.length,
    });
  } catch (error) {
    console.error('[GET /api/admin/mappings] Error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';

    return res.status(500).json({
      success: false,
      error: `Erro ao buscar mapeamentos: ${message}`,
    });
  }
});

/**
 * DELETE /api/admin/mappings/:accommodationId
 * Deleta um mapeamento específico
 */
router.delete('/:accommodationId', authenticateToken, async (req, res) => {
  try {
    const { accommodationId } = req.params;
    const userId = req.user?.id || 'admin';

    if (!accommodationId) {
      return res.status(400).json({
        success: false,
        error: 'accommodationId é obrigatório',
      });
    }

    // Procurar mapeamento existente
    const mappingResult = await query(
      'SELECT * FROM accommodation_lock_mappings WHERE accommodation_id = $1',
      [accommodationId]
    );

    if (mappingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Nenhum mapeamento encontrado para acomodação "${accommodationId}"`,
      });
    }

    const mapping = mappingResult.rows[0];

    // Deletar mapeamento
    await query(
      'DELETE FROM accommodation_lock_mappings WHERE id = $1',
      [mapping.id]
    );

    // Log
    await logMappingActivity({
      action: 'unmap',
      accommodationId,
      lockId: mapping.lock_id,
      createdBy: userId,
      success: true,
    });

    return res.status(200).json({
      success: true,
      message: 'Mapeamento deletado com sucesso',
      mapping: {
        id: mapping.id,
        accommodationId: mapping.accommodation_id,
        lockId: mapping.lock_id,
        createdBy: mapping.created_by,
        createdAt: mapping.created_at,
        updatedAt: mapping.updated_at,
      },
    });
  } catch (error) {
    console.error('[DELETE /api/admin/mappings/:accommodationId] Error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';

    const { accommodationId } = req.params;
    await logMappingActivity({
      action: 'unmap',
      accommodationId,
      createdBy: req.user?.id || 'admin',
      success: false,
      error: message,
    });

    return res.status(500).json({
      success: false,
      error: `Erro ao deletar mapeamento: ${message}`,
    });
  }
});

module.exports = router;
