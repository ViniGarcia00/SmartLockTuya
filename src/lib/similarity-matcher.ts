/**
 * Similarity Matcher Service
 *
 * Usa algoritmo de similaridade de strings para sugerir matches
 * entre acomodações e fechaduras baseado em similaridade de nomes
 *
 * Padrão Levenshtein distance via string-similarity package
 */

import { findBestMatch, compareTwoStrings } from 'string-similarity';

export interface MatchSuggestion {
  accommodationId: string;
  accommodationName: string;
  lockId: string;
  lockAlias: string;
  score: number; // 0-1, higher is better
}

export interface SimilarityMatcherOptions {
  threshold?: number; // Default: 0.8 (80% similarity)
  maxSuggestions?: number; // Max suggestions per accommodation
}

/**
 * Calcula similaridade entre dois nomes
 *
 * @param str1 - Primeiro nome (ex: "Suite Master")
 * @param str2 - Segundo nome (ex: "Master Bedroom")
 * @returns Score entre 0 e 1 (1 = idêntico)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  // Normalizar: lowercase, trim, remover caracteres especiais
  const normalized1 = str1
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '');

  const normalized2 = str2
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '');

  if (normalized1 === normalized2) return 1; // Perfeito match

  return compareTwoStrings(normalized1, normalized2);
}

/**
 * Sugere matches entre acomodações e fechaduras sem mapeamento
 *
 * @param accommodations - Array de acomodações sem mapping
 * @param locks - Array de fechaduras sem mapping
 * @param options - Configurações (threshold, maxSuggestions)
 * @returns Array de sugestões ordenadas por score decrescente
 */
export function suggestMatches(
  accommodations: Array<{ id: string; name: string }>,
  locks: Array<{ id: string; alias?: string | null }>,
  options: SimilarityMatcherOptions = {}
): MatchSuggestion[] {
  const threshold = options.threshold ?? 0.8;
  const maxSuggestions = options.maxSuggestions ?? 1; // Default: 1 sugestão por acomodação

  const suggestions: MatchSuggestion[] = [];

  // Para cada acomodação, encontrar locks similares
  for (const accommodation of accommodations) {
    const lockScores = locks.map((lock) => ({
      lock,
      score: calculateSimilarity(
        accommodation.name,
        lock.alias || lock.id
      ),
    }));

    // Ordenar por score decrescente
    lockScores.sort((a, b) => b.score - a.score);

    // Pegar as top N que passem no threshold
    for (let i = 0; i < Math.min(maxSuggestions, lockScores.length); i++) {
      const { lock, score } = lockScores[i];

      if (score >= threshold) {
        suggestions.push({
          accommodationId: accommodation.id,
          accommodationName: accommodation.name,
          lockId: lock.id,
          lockAlias: lock.alias || lock.id,
          score,
        });
      }
    }
  }

  // Ordenar todas as sugestões por score decrescente
  suggestions.sort((a, b) => b.score - a.score);

  return suggestions;
}

/**
 * Versão com dados completos (para UI)
 * Retorna sugestões com mais detalhes
 */
export interface DetailedMatchSuggestion extends MatchSuggestion {
  confidenceLevel: 'high' | 'medium'; // high >= 0.9, medium >= 0.8
  explanation: string;
}

/**
 * Sugere matches com detalhes e explicações
 */
export function suggestMatchesWithDetails(
  accommodations: Array<{ id: string; name: string }>,
  locks: Array<{ id: string; alias?: string | null; location?: string | null }>,
  options: SimilarityMatcherOptions = {}
): DetailedMatchSuggestion[] {
  const suggestions = suggestMatches(accommodations, locks, options);

  return suggestions.map((suggestion) => ({
    ...suggestion,
    confidenceLevel: suggestion.score >= 0.9 ? 'high' : 'medium',
    explanation: `Similaridade de nome: "${suggestion.accommodationName}" ↔ "${suggestion.lockAlias}" (${Math.round(
      suggestion.score * 100
    )}%)`,
  }));
}

/**
 * Filtra duplicatas de sugestões (se um lock foi sugerido múltiplas vezes)
 * Mantém apenas o melhor match
 */
export function deduplicateSuggestions(
  suggestions: MatchSuggestion[]
): MatchSuggestion[] {
  const deduplicated = new Map<string, MatchSuggestion>();

  for (const suggestion of suggestions) {
    const key = suggestion.lockId; // Chave: lockId
    const existing = deduplicated.get(key);

    if (!existing || suggestion.score > existing.score) {
      deduplicated.set(key, suggestion);
    }
  }

  return Array.from(deduplicated.values()).sort((a, b) => b.score - a.score);
}

/**
 * Valida se uma sugestão é válida antes de aplicar
 *
 * @param suggestion - Sugestão a validar
 * @param accommodations - Array de acomodações
 * @param locks - Array de fechaduras
 * @returns { valid, reason? }
 */
export function validateSuggestion(
  suggestion: MatchSuggestion,
  accommodations: Array<{ id: string; name: string }>,
  locks: Array<{ id: string; alias?: string | null }>
): { valid: boolean; reason?: string } {
  const accommodationExists = accommodations.some(
    (a) => a.id === suggestion.accommodationId
  );
  if (!accommodationExists) {
    return { valid: false, reason: 'Acomodação não encontrada' };
  }

  const lockExists = locks.some((l) => l.id === suggestion.lockId);
  if (!lockExists) {
    return { valid: false, reason: 'Fechadura não encontrada' };
  }

  if (suggestion.score < 0.8) {
    return { valid: false, reason: 'Score abaixo do threshold' };
  }

  return { valid: true };
}

/**
 * Batch apply de sugestões
 * Retorna status de cada aplicação
 */
export function validateBatchSuggestions(
  suggestions: MatchSuggestion[],
  accommodations: Array<{ id: string; name: string }>,
  locks: Array<{ id: string; alias?: string | null }>
): Array<MatchSuggestion & { valid: boolean; reason?: string }> {
  return suggestions.map((suggestion) => {
    const validation = validateSuggestion(suggestion, accommodations, locks);
    return {
      ...suggestion,
      valid: validation.valid,
      reason: validation.reason,
    };
  });
}

/**
 * Cria ID de batch para rastreamento de aplicação em lote
 */
export function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Testa se um nome é um bom candidato para matching automático
 * (ex: não é "Acomodação 1" ou "Lock 1", muito genérico)
 */
export function isGoodCandidate(
  name: string,
  type: 'accommodation' | 'lock'
): boolean {
  if (!name || name.length < 3) return false;

  const normalized = name.toLowerCase().trim();

  // Nomes muito genéricos não são bons candidatos
  const genericPatterns = [
    /^(acomodação|quarto|suite|lock|fechadura)\s*\d+$/,
    /^(room|accommodation|lock)\s*\d+$/,
    /^#\d+$/,
    /^[a-z]{1,3}$/,
  ];

  for (const pattern of genericPatterns) {
    if (pattern.test(normalized)) return false;
  }

  // Se contém apenas números, não é bom
  if (/^\d+$/.test(normalized)) return false;

  return true;
}
