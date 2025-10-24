/**
 * Similarity Matcher - JavaScript implementation
 * 
 * Implementação simples para cálculo de score de similaridade
 * entre acomodações e fechaduras (match suggestions)
 */

const stringSimilarity = require('string-similarity');

/**
 * Calcula sugestões de match automático
 * @param {Array} accommodations - Acomodações disponíveis
 * @param {Array} locks - Fechaduras disponíveis
 * @param {number|Object} options - Threshold (número) ou opções { threshold, maxSuggestions }
 * @returns {Array} Sugestões ordenadas por score
 */
function suggestMatches(accommodations, locks, options = 0.8) {
  // Normalizar opções
  let threshold = 0.8;
  if (typeof options === 'number') {
    threshold = options;
  } else if (typeof options === 'object' && options.threshold) {
    threshold = options.threshold;
  }

  if (!accommodations || !locks || accommodations.length === 0 || locks.length === 0) {
    return [];
  }

  const suggestions = [];

  for (const accom of accommodations) {
    for (const lock of locks) {
      // Calcular similaridade entre nomes
      const nameScore = stringSimilarity.compareTwoStrings(
        (accom.name || '').toLowerCase(),
        (lock.alias || '').toLowerCase()
      );

      // Considerar ID também se houver padrão
      let idScore = 0;
      if (accom.id && lock.id) {
        idScore = stringSimilarity.compareTwoStrings(
          accom.id.toLowerCase(),
          lock.id.toLowerCase()
        );
      }

      // Score final é media ponderada
      const finalScore = (nameScore * 0.7) + (idScore * 0.3);

      if (finalScore >= threshold) {
        suggestions.push({
          accommodationId: accom.id,
          accommodationName: accom.name,
          lockId: lock.id,
          lockAlias: lock.alias || 'Unknown',
          score: Math.round(finalScore * 1000) / 1000, // 3 decimals
          matchedBy: 'string-similarity',
        });
      }
    }
  }

  // Ordenar por score descendente
  return suggestions.sort((a, b) => b.score - a.score);
}

/**
 * Calcula sugestões com detalhes completos
 */
function suggestMatchesWithDetails(accommodations, locks, options = 0.8) {
  // Normalizar opções
  let threshold = 0.8;
  if (typeof options === 'number') {
    threshold = options;
  } else if (typeof options === 'object' && options.threshold) {
    threshold = options.threshold;
  }

  const suggestions = suggestMatches(accommodations, locks, threshold);
  
  return suggestions.map(suggestion => ({
    ...suggestion,
    details: {
      accommodationDetails: accommodations.find(a => a.id === suggestion.accommodationId),
      lockDetails: locks.find(l => l.id === suggestion.lockId),
      createdAt: new Date().toISOString(),
    },
  }));
}

module.exports = {
  suggestMatches,
  suggestMatchesWithDetails,
};
