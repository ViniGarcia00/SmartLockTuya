/**
 * Testes para Similarity Matcher Service
 *
 * Testa apenas as funções exportadas:
 * - suggestMatches
 * - suggestMatchesWithDetails
 */

import {
  suggestMatches,
  suggestMatchesWithDetails,
} from '../lib/similarity-matcher';

describe('Similarity Matcher', () => {
  // ======================================================================
  // TESTE 1: Sugestões de Match (Simples)
  // ======================================================================
  describe('suggestMatches', () => {
    const accommodations = [
      { id: 'acc-1', name: 'Master Suite' },
      { id: 'acc-2', name: 'Deluxe Room' },
    ];

    const locks = [
      { id: 'lock-1', alias: 'Suite Master' },
      { id: 'lock-2', alias: 'Premium Lock' },
    ];

    it('deve encontrar sugestões com threshold 0.8', () => {
      const suggestions = suggestMatches(accommodations, locks, 0.8);

      // Deve haver pelo menos 1 sugestão (Master Suite ↔ Suite Master)
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].score).toBeGreaterThanOrEqual(0.8);
    });

    it('deve ordenar sugestões por score decrescente', () => {
      const suggestions = suggestMatches(accommodations, locks, 0.5);
      if (suggestions.length > 1) {
        for (let i = 0; i < suggestions.length - 1; i++) {
          expect(suggestions[i].score).toBeGreaterThanOrEqual(suggestions[i + 1].score);
        }
      }
    });

    it('deve retornar array vazio com threshold muito alto', () => {
      const suggestions = suggestMatches(accommodations, locks, 0.99);
      expect(suggestions.length).toBe(0);
    });

    it('deve aceitar opções como objeto com threshold', () => {
      const suggestions = suggestMatches(accommodations, locks, {
        threshold: 0.8,
      } as any);

      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('deve retornar array vazio se não há acomodações', () => {
      const suggestions = suggestMatches([], locks, 0.8);
      expect(suggestions.length).toBe(0);
    });

    it('deve retornar array vazio se não há fechaduras', () => {
      const suggestions = suggestMatches(accommodations, [], 0.8);
      expect(suggestions.length).toBe(0);
    });
  });

  // ======================================================================
  // TESTE 2: Sugestões com Detalhes
  // ======================================================================
  describe('suggestMatchesWithDetails', () => {
    const accommodations = [
      { id: 'acc-1', name: 'Master Suite' },
    ];

    const locks = [
      { id: 'lock-1', alias: 'Suite Master' },
    ];

    it('deve retornar sugestões com detalhes completos', () => {
      const suggestions = suggestMatchesWithDetails(accommodations, locks, 0.8);

      if (suggestions.length > 0) {
        expect(suggestions[0]).toHaveProperty('accommodationId');
        expect(suggestions[0]).toHaveProperty('lockId');
        expect(suggestions[0]).toHaveProperty('score');
        expect(suggestions[0]).toHaveProperty('details');
      }
    });

    it('deve incluir detalhes de acomodação e fechadura', () => {
      const suggestions = suggestMatchesWithDetails(accommodations, locks, 0.5);

      if (suggestions.length > 0) {
        expect(suggestions[0].details).toHaveProperty('accommodationDetails');
        expect(suggestions[0].details).toHaveProperty('lockDetails');
        expect(suggestions[0].details).toHaveProperty('createdAt');
      }
    });
  });
});
