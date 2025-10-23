/**
 * Testes para LockProviderFactory
 * 
 * Valida:
 * - Criação de instância MockLockProvider
 * - Singleton pattern
 * - Obtenção de tipo de provedor
 * - Reset da instância
 * 
 * Comando: npm test -- src/lib/lock-provider-factory.test.ts
 */

import { LockProviderFactory } from './lock-provider-factory';
import { MockLockProvider } from './mock-lock-provider';

describe('LockProviderFactory', () => {
  beforeEach(() => {
    LockProviderFactory.reset();
    // Garante que LOCK_PROVIDER é 'mock'
    process.env.LOCK_PROVIDER = 'mock';
  });

  afterEach(() => {
    LockProviderFactory.reset();
  });

  describe('create', () => {
    it('deve criar instância de MockLockProvider quando LOCK_PROVIDER=mock', () => {
      process.env.LOCK_PROVIDER = 'mock';
      LockProviderFactory.reset();

      const provider = LockProviderFactory.create();

      expect(provider).toBeInstanceOf(MockLockProvider);
    });

    it('deve retornar singleton - mesma instância em múltiplas chamadas', () => {
      const provider1 = LockProviderFactory.create();
      const provider2 = LockProviderFactory.create();

      expect(provider1).toBe(provider2);
    });

    it('deve lançar erro se tipo de provedor é tuya (não implementado)', () => {
      process.env.LOCK_PROVIDER = 'tuya';
      LockProviderFactory.reset();

      expect(() => LockProviderFactory.create()).toThrow(
        'TuyaLockProvider não implementado ainda'
      );
    });

    it('deve lançar erro se tipo de provedor é august (não implementado)', () => {
      process.env.LOCK_PROVIDER = 'august';
      LockProviderFactory.reset();

      expect(() => LockProviderFactory.create()).toThrow(
        'AugustLockProvider não implementado ainda'
      );
    });

    it('deve lançar erro se tipo de provedor é yale (não implementado)', () => {
      process.env.LOCK_PROVIDER = 'yale';
      LockProviderFactory.reset();

      expect(() => LockProviderFactory.create()).toThrow(
        'YaleLockProvider não implementado ainda'
      );
    });

    it('deve lançar erro se tipo de provedor é desconhecido', () => {
      process.env.LOCK_PROVIDER = 'unknown-provider';
      LockProviderFactory.reset();

      expect(() => LockProviderFactory.create()).toThrow(
        'Provedor de fechadura desconhecido: unknown-provider'
      );
    });
  });

  describe('getProviderType', () => {
    it('deve retornar tipo mock quando LOCK_PROVIDER=mock', () => {
      process.env.LOCK_PROVIDER = 'mock';

      const type = LockProviderFactory.getCurrentProviderType();

      expect(type).toBe('mock');
    });

    it('deve retornar tipo configurado em LOCK_PROVIDER', () => {
      process.env.LOCK_PROVIDER = 'tuya';

      const type = LockProviderFactory.getCurrentProviderType();

      expect(type).toBe('tuya');
    });

    it('deve retornar mock como padrão se LOCK_PROVIDER não está definido', () => {
      delete process.env.LOCK_PROVIDER;

      const type = LockProviderFactory.getCurrentProviderType();

      expect(type).toBe('mock');
    });
  });

  describe('reset', () => {
    it('deve resetar singleton permitindo nova instância', () => {
      const provider1 = LockProviderFactory.create();
      LockProviderFactory.reset();
      const provider2 = LockProviderFactory.create();

      expect(provider1).not.toBe(provider2);
      expect(provider2).toBeInstanceOf(MockLockProvider);
    });

    it('deve permitir trocar de tipo de provedor após reset', () => {
      process.env.LOCK_PROVIDER = 'mock';
      const provider1 = LockProviderFactory.create();
      expect(provider1).toBeInstanceOf(MockLockProvider);

      LockProviderFactory.reset();
      process.env.LOCK_PROVIDER = 'tuya';

      expect(() => LockProviderFactory.create()).toThrow(
        'TuyaLockProvider não implementado ainda'
      );
    });
  });

  describe('Integration with MockLockProvider', () => {
    it('deve criar provider e usar createTimedPin', async () => {
      const provider = LockProviderFactory.create();
      const result = await provider.createTimedPin(
        'lock-001',
        '123456',
        new Date('2025-10-24T15:00:00Z'),
        new Date('2025-10-26T11:00:00Z')
      );

      expect(result).toHaveProperty('providerRef');
      expect(result.providerRef).toBeDefined();
    });

    it('deve criar provider e usar revokePin', async () => {
      const provider = LockProviderFactory.create();
      const createResult = await provider.createTimedPin(
        'lock-001',
        '123456',
        new Date('2025-10-24T15:00:00Z'),
        new Date('2025-10-26T11:00:00Z')
      );

      const revokeResult = await provider.revokePin(
        'lock-001',
        createResult.providerRef
      );

      expect(revokeResult.success).toBe(true);
    });
  });
});
