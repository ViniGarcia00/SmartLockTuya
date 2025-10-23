/**
 * PIN Generator and Jobs Tests
 * 
 * Testes para:
 * - Geração de PIN aleatório
 * - Hash e verificação com bcrypt
 */

import {
  generateRandomPin,
  hashPin,
  verifyPin,
  isValidPinFormat,
} from '../lib/pin-generator';

describe('PIN Generator', () => {
  
  // =====================================================================
  // TESTES: generateRandomPin()
  // =====================================================================
  describe('generateRandomPin', () => {
    
    it('deve gerar PIN de 6 dígitos', () => {
      const pin = generateRandomPin();
      
      expect(pin).toMatch(/^\d{6}$/);
      expect(pin.length).toBe(6);
    });
    
    it('deve gerar PINs diferentes a cada chamada', () => {
      const pins = new Set();
      for (let i = 0; i < 10; i++) {
        pins.add(generateRandomPin());
      }
      
      expect(pins.size).toBeGreaterThan(1);
    });
    
    it('PIN deve conter apenas dígitos', () => {
      const pin = generateRandomPin();
      
      expect(pin).toMatch(/^[0-9]*$/);
      expect(pin).not.toMatch(/[a-zA-Z]/);
    });
  });
  
  // =====================================================================
  // TESTES: isValidPinFormat()
  // =====================================================================
  describe('isValidPinFormat', () => {
    
    it('deve validar PIN correto de 6 dígitos', () => {
      expect(isValidPinFormat('123456')).toBe(true);
      expect(isValidPinFormat('000000')).toBe(true);
      expect(isValidPinFormat('999999')).toBe(true);
    });
    
    it('deve rejeitar PIN com menos de 6 dígitos', () => {
      expect(isValidPinFormat('12345')).toBe(false);
      expect(isValidPinFormat('1')).toBe(false);
    });
    
    it('deve rejeitar PIN com mais de 6 dígitos', () => {
      expect(isValidPinFormat('1234567')).toBe(false);
      expect(isValidPinFormat('12345678')).toBe(false);
    });
    
    it('deve rejeitar PIN com caracteres não numéricos', () => {
      expect(isValidPinFormat('12345a')).toBe(false);
      expect(isValidPinFormat('abcdef')).toBe(false);
      expect(isValidPinFormat('123-456')).toBe(false);
    });
    
    it('deve rejeitar PIN nulo ou vazio', () => {
      expect(isValidPinFormat('')).toBe(false);
      expect(isValidPinFormat(null as any)).toBe(false);
      expect(isValidPinFormat(undefined as any)).toBe(false);
    });
  });
  
  // =====================================================================
  // TESTES: hashPin()
  // =====================================================================
  describe('hashPin', () => {
    
    it('deve fazer hash de PIN válido', async () => {
      const pin = '123456';
      const hash = await hashPin(pin);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.startsWith('$2b$')).toBe(true); // bcrypt hash format
      expect(hash.length).toBeGreaterThan(20); // bcrypt hash é bem grande
    });
    
    it('deve rejeitar PIN inválido', async () => {
      const invalidPins = ['12345', '1234567', 'abcdef', ''];
      
      for (const pin of invalidPins) {
        try {
          await hashPin(pin);
          fail(`Should have thrown error for PIN: ${pin}`);
        } catch (error) {
          expect(error).toBeDefined();
        }
      }
    });
    
    it('deve fazer hash diferente para chamadas consecutivas (salt aleatório)', async () => {
      const pin = '123456';
      const hash1 = await hashPin(pin);
      const hash2 = await hashPin(pin);
      
      // Hashes devem ser diferentes devido ao salt aleatório
      expect(hash1).not.toBe(hash2);
    });
    
    it('deve lançar erro para PIN não string', async () => {
      try {
        await hashPin(123456 as any);
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
  
  // =====================================================================
  // TESTES: verifyPin()
  // =====================================================================
  describe('verifyPin', () => {
    
    let hash: string;
    const pin = '123456';
    
    beforeAll(async () => {
      hash = await hashPin(pin);
    });
    
    it('deve verificar PIN correto', async () => {
      const isValid = await verifyPin(pin, hash);
      
      expect(isValid).toBe(true);
    });
    
    it('deve rejeitar PIN incorreto', async () => {
      const isValid = await verifyPin('654321', hash);
      
      expect(isValid).toBe(false);
    });
    
    it('deve rejeitar PIN vazio', async () => {
      const isValid = await verifyPin('', hash);
      
      expect(isValid).toBe(false);
    });
    
    it('deve retornar false para hash inválido', async () => {
      const isValid = await verifyPin(pin, 'invalid-hash');
      
      expect(isValid).toBe(false);
    });
    
    it('deve retornar false para hash vazio', async () => {
      const isValid = await verifyPin(pin, '');
      
      expect(isValid).toBe(false);
    });
  });
  
  // =====================================================================
  // TESTES DE INTEGRAÇÃO
  // =====================================================================
  describe('Integration Tests', () => {
    
    it('deve gerar PIN, fazer hash, e depois verificar', async () => {
      // Simular fluxo completo
      const pin = generateRandomPin();
      expect(isValidPinFormat(pin)).toBe(true);
      
      const hash = await hashPin(pin);
      expect(hash).toBeDefined();
      
      const isValid = await verifyPin(pin, hash);
      expect(isValid).toBe(true);
      
      // PIN errado deve falhar
      const isInvalid = await verifyPin('000000', hash);
      expect(isInvalid).toBe(false);
    });

    it('fluxo completo: gerar múltiplos PINs, todos devem ser validáveis', async () => {
      const pins = [];
      const hashes = [];
      
      // Gerar 5 PINs
      for (let i = 0; i < 5; i++) {
        const pin = generateRandomPin();
        pins.push(pin);
        
        const hash = await hashPin(pin);
        hashes.push(hash);
      }
      
      // Verificar que cada PIN corresponde ao seu hash
      for (let i = 0; i < pins.length; i++) {
        const isValid = await verifyPin(pins[i], hashes[i]);
        expect(isValid).toBe(true);
      }
      
      // Verificar que cada PIN NÃO corresponde a outro hash
      for (let i = 0; i < pins.length; i++) {
        for (let j = 0; j < pins.length; j++) {
          if (i !== j) {
            const isValid = await verifyPin(pins[i], hashes[j]);
            expect(isValid).toBe(false);
          }
        }
      }
    });
  });
});
