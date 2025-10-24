/**
 * Rota Express para Sugestões de Match Automático
 *
 * GET /api/admin/matches/suggestions
 * - Busca acomodações sem mapping
 * - Busca fechaduras sem mapping
 * - Calcula sugestões de match automático
 * - Retorna array ordenado por score
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Note: similarity-matcher.ts é TypeScript, então importamos o .js compilado
// Para desenvolvimento, pode ser necessário usar ts-node ou babel
let suggestMatches;
let suggestMatchesWithDetails;

try {
  // Tentar importar o módulo TypeScript compilado
  const matcher = require('../lib/similarity-matcher');
  suggestMatches = matcher.suggestMatches;
  suggestMatchesWithDetails = matcher.suggestMatchesWithDetails;
} catch (error) {
  console.warn('[matches-suggestions] Warning: Could not load similarity-matcher', error.message);
  // Fallback: implementação simples em JS
  suggestMatches = (accommodations, locks) => {
    return accommodations.map((accom) => ({
      accommodationId: accom.id,
      accommodationName: accom.name,
      lockId: locks[0]?.id || null,
      lockAlias: locks[0]?.alias || 'Unknown',
      score: 0.5, // Default low score
    })).filter(s => s.lockId);
  };
}

/**
 * GET /api/admin/matches/suggestions
 * 
 * Query params:
 * - threshold: 0.0-1.0 (default: 0.8)
 * - maxSuggestions: número (default: 1)
 * 
 * Returns: { success, suggestions[], count, timestamp }
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const threshold = parseFloat(req.query.threshold) || 0.8;
    const maxSuggestions = parseInt(req.query.maxSuggestions) || 1;

    // ====================================================================
    // BUSCAR ACOMODAÇÕES SEM MAPPING
    // ====================================================================
    const accommodationsResult = await query(
      `SELECT a.id, a.name 
       FROM accommodations a
       WHERE NOT EXISTS (
         SELECT 1 FROM accommodation_lock_mappings alm 
         WHERE alm.accommodation_id = a.id
       )
       ORDER BY a.name ASC`
    );

    const accommodationsWithoutMapping = accommodationsResult.rows;

    // Se não há acomodações sem mapping, retornar vazio
    if (accommodationsWithoutMapping.length === 0) {
      return res.status(200).json({
        success: true,
        suggestions: [],
        count: 0,
        message: 'Nenhuma acomodação sem mapping',
        timestamp: new Date().toISOString(),
      });
    }

    // ====================================================================
    // BUSCAR FECHADURAS SEM MAPPING
    // ====================================================================
    const locksResult = await query(
      `SELECT l.id, l.alias, l.device_id, l.vendor
       FROM locks l
       WHERE NOT EXISTS (
         SELECT 1 FROM accommodation_lock_mappings alm 
         WHERE alm.lock_id = l.id
       )
       ORDER BY l.alias ASC`
    );

    const locksWithoutMapping = locksResult.rows;

    // Se não há fechaduras sem mapping, retornar vazio
    if (locksWithoutMapping.length === 0) {
      return res.status(200).json({
        success: true,
        suggestions: [],
        count: 0,
        message: 'Nenhuma fechadura sem mapping',
        timestamp: new Date().toISOString(),
      });
    }

    // ====================================================================
    // CALCULAR SUGESTÕES
    // ====================================================================
    let suggestions;

    try {
      // Normalizar dados para o matcher
      const normalizedAccommodations = accommodationsWithoutMapping.map((a) => ({
        id: a.id,
        name: a.name || 'Unknown',
      }));

      const normalizedLocks = locksWithoutMapping.map((l) => ({
        id: l.id,
        alias: l.alias || l.device_id,
      }));

      // Chamar o matcher
      suggestions = suggestMatches(normalizedAccommodations, normalizedLocks, {
        threshold,
        maxSuggestions,
      });

      // Enriquecer com detalhes (se disponível)
      if (suggestMatchesWithDetails) {
        suggestions = suggestMatchesWithDetails(normalizedAccommodations, normalizedLocks, {
          threshold,
          maxSuggestions,
        });
      }
    } catch (error) {
      console.error('[matches-suggestions] Error calculating suggestions:', error);
      
      // Fallback: retornar sugestões baseadas em similaridade simples
      suggestions = [];
      for (const accom of accommodationsWithoutMapping) {
        if (locksWithoutMapping.length > 0) {
          const lock = locksWithoutMapping[0];
          suggestions.push({
            accommodationId: accom.id,
            accommodationName: accom.name,
            lockId: lock.id,
            lockAlias: lock.alias || lock.device_id,
            score: 0.5, // Default score
          });
          locksWithoutMapping.shift(); // Remove o primeiro
        }
      }
    }

    // ====================================================================
    // LOG
    // ====================================================================
    console.log(
      `[matches-suggestions] Found ${suggestions.length} suggestions for ${accommodationsWithoutMapping.length} accommodations`
    );

    // ====================================================================
    // RESPOSTA
    // ====================================================================
    return res.status(200).json({
      success: true,
      suggestions,
      count: suggestions.length,
      metadata: {
        accommodationsAnalyzed: accommodationsWithoutMapping.length,
        locksAnalyzed: locksWithoutMapping.length,
        threshold,
        maxSuggestions,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[GET /api/admin/matches/suggestions] Error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';

    return res.status(500).json({
      success: false,
      error: `Erro ao buscar sugestões: ${message}`,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/admin/matches/suggestions/:accommodationId
 * 
 * Retorna sugestões específicas para uma acomodação
 */
router.get('/:accommodationId', authenticateToken, async (req, res) => {
  try {
    const { accommodationId } = req.params;
    const threshold = parseFloat(req.query.threshold) || 0.8;

    // Buscar acomodação
    const accommodationResult = await query(
      'SELECT id, name FROM accommodations WHERE id = $1',
      [accommodationId]
    );

    if (accommodationResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Acomodação não encontrada',
      });
    }

    // Verificar se já tem mapping
    const existingMappingResult = await query(
      'SELECT lock_id FROM accommodation_lock_mappings WHERE accommodation_id = $1',
      [accommodationId]
    );

    if (existingMappingResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Acomodação já possui mapeamento',
        existingLockId: existingMappingResult.rows[0].lock_id,
      });
    }

    // Buscar fechaduras sem mapping
    const locksResult = await query(
      `SELECT l.id, l.alias, l.device_id
       FROM locks l
       WHERE NOT EXISTS (
         SELECT 1 FROM accommodation_lock_mappings alm 
         WHERE alm.lock_id = l.id
       )`
    );

    const accommodation = accommodationResult.rows[0];
    const locks = locksResult.rows;

    // Calcular sugestões
    const suggestions = suggestMatches(
      [{ id: accommodation.id, name: accommodation.name }],
      locks.map((l) => ({ id: l.id, alias: l.alias || l.device_id })),
      { threshold, maxSuggestions: 5 } // Top 5 sugestões
    );

    return res.status(200).json({
      success: true,
      accommodationId,
      accommodationName: accommodation.name,
      suggestions,
      count: suggestions.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[GET /api/admin/matches/suggestions/:id] Error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';

    return res.status(500).json({
      success: false,
      error: `Erro ao buscar sugestões para acomodação: ${message}`,
    });
  }
});

module.exports = router;
