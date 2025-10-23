/**
 * Testes para MockLockProvider
 * 
 * Valida:
 * - Criação de PIN com UUID fake
 * - Revogação de PIN
 * - Validações de entrada
 * - Logs corretos
 * 
 * Comando: npm test -- src/lib/mock-lock-provider.test.ts
 */

import { MockLockProvider } from './mock-lock-provider';

describe('MockLockProvider', () => {
  let provider: MockLockProvider;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    provider = new MockLockProvider();
    // Captura logs para validação
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('createTimedPin', () => {
    const validFrom = new Date('2025-10-24T15:00:00Z');
    const validTo = new Date('2025-10-26T11:00:00Z');

    it('deve criar PIN com sucesso e retornar providerRef UUID', async () => {
      const result = await provider.createTimedPin(
        'lock-001',
        '123456',
        validFrom,
        validTo
      );

      // Valida resultado
      expect(result).toHaveProperty('providerRef');
      expect(result.providerRef).toBeDefined();
      expect(typeof result.providerRef).toBe('string');

      // UUID v4 tem este padrão
      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(result.providerRef).toMatch(uuidPattern);
    });

    it('deve logar criação de PIN com detalhes corretos', async () => {
      const pin = '654321';
      await provider.createTimedPin('lock-002', pin, validFrom, validTo);

      expect(consoleSpy).toHaveBeenCalled();
      const logMessage = consoleSpy.mock.calls[0][0];

      expect(logMessage).toContain('[MockLock] PIN criado');
      expect(logMessage).toContain('lockId=lock-002');
      expect(logMessage).toContain(`pin=${pin}`);
      expect(logMessage).toContain(validFrom.toISOString());
      expect(logMessage).toContain(validTo.toISOString());
      expect(logMessage).toContain('providerRef=');
    });

    it('deve lançar erro se lockId está vazio', async () => {
      await expect(
        provider.createTimedPin('', '123456', validFrom, validTo)
      ).rejects.toThrow('lockId é obrigatório');
    });

    it('deve lançar erro se PIN não tem exatamente 6 dígitos', async () => {
      await expect(
        provider.createTimedPin('lock-001', '12345', validFrom, validTo)
      ).rejects.toThrow('PIN deve ter exatamente 6 dígitos');

      await expect(
        provider.createTimedPin('lock-001', '1234567', validFrom, validTo)
      ).rejects.toThrow('PIN deve ter exatamente 6 dígitos');

      await expect(
        provider.createTimedPin('lock-001', 'abcdef', validFrom, validTo)
      ).rejects.toThrow('PIN deve ter exatamente 6 dígitos');
    });

    it('deve lançar erro se PIN é null/undefined', async () => {
      await expect(
        provider.createTimedPin('lock-001', null as any, validFrom, validTo)
      ).rejects.toThrow('PIN deve ter exatamente 6 dígitos');

      await expect(
        provider.createTimedPin('lock-001', undefined as any, validFrom, validTo)
      ).rejects.toThrow('PIN deve ter exatamente 6 dígitos');
    });

    it('deve lançar erro se validFrom ou validTo não são Dates', async () => {
      await expect(
        provider.createTimedPin(
          'lock-001',
          '123456',
          '2025-10-24T15:00:00Z' as any,
          validTo
        )
      ).rejects.toThrow('validFrom e validTo devem ser instâncias de Date');

      await expect(
        provider.createTimedPin(
          'lock-001',
          '123456',
          validFrom,
          '2025-10-26T11:00:00Z' as any
        )
      ).rejects.toThrow('validFrom e validTo devem ser instâncias de Date');
    });

    it('deve lançar erro se validFrom >= validTo', async () => {
      const now = new Date();
      const later = new Date(now.getTime() - 1000); // 1s antes

      await expect(
        provider.createTimedPin('lock-001', '123456', now, later)
      ).rejects.toThrow('validFrom deve ser antes de validTo');

      // Mesmo tempo também deve falhar
      await expect(
        provider.createTimedPin('lock-001', '123456', now, now)
      ).rejects.toThrow('validFrom deve ser antes de validTo');
    });

    it('deve gerar UUIDs únicos para cada PIN', async () => {
      const result1 = await provider.createTimedPin(
        'lock-001',
        '111111',
        validFrom,
        validTo
      );

      const result2 = await provider.createTimedPin(
        'lock-001',
        '222222',
        validFrom,
        validTo
      );

      expect(result1.providerRef).not.toBe(result2.providerRef);
    });
  });

  describe('revokePin', () => {
    it('deve revogar PIN com sucesso', async () => {
      const result = await provider.revokePin('lock-001', 'provider-ref-123');

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
    });

    it('deve logar revogação de PIN com detalhes corretos', async () => {
      const lockId = 'lock-003';
      const providerRef = 'ref-uuid-456';

      await provider.revokePin(lockId, providerRef);

      expect(consoleSpy).toHaveBeenCalled();
      const logMessage = consoleSpy.mock.calls[0][0];

      expect(logMessage).toContain('[MockLock] PIN revogado');
      expect(logMessage).toContain(`lockId=${lockId}`);
      expect(logMessage).toContain(`providerRef=${providerRef}`);
    });

    it('deve lançar erro se lockId está vazio', async () => {
      await expect(
        provider.revokePin('', 'provider-ref-123')
      ).rejects.toThrow('lockId é obrigatório');
    });

    it('deve lançar erro se providerRef está vazio', async () => {
      await expect(
        provider.revokePin('lock-001', '')
      ).rejects.toThrow('providerRef é obrigatório');

      await expect(
        provider.revokePin('lock-001', null as any)
      ).rejects.toThrow('providerRef é obrigatório');

      await expect(
        provider.revokePin('lock-001', undefined as any)
      ).rejects.toThrow('providerRef é obrigatório');
    });

    it('deve revogar múltiplos PINs independentemente', async () => {
      const result1 = await provider.revokePin('lock-001', 'ref-1');
      const result2 = await provider.revokePin('lock-002', 'ref-2');
      const result3 = await provider.revokePin('lock-001', 'ref-3');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);

      // Verifica que foram 3 logs diferentes
      expect(consoleSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('Integration', () => {
    const validFrom = new Date('2025-10-24T15:00:00Z');
    const validTo = new Date('2025-10-26T11:00:00Z');

    it('deve criar PIN, obter referência, e depois revogar', async () => {
      // Cria
      const createResult = await provider.createTimedPin(
        'lock-001',
        '123456',
        validFrom,
        validTo
      );

      expect(createResult.providerRef).toBeDefined();

      // Revoga
      const revokeResult = await provider.revokePin(
        'lock-001',
        createResult.providerRef
      );

      expect(revokeResult.success).toBe(true);

      // Verifica logs
      expect(consoleSpy).toHaveBeenCalledTimes(2);
      const createLog = consoleSpy.mock.calls[0][0];
      const revokeLog = consoleSpy.mock.calls[1][0];

      expect(createLog).toContain('[MockLock] PIN criado');
      expect(revokeLog).toContain('[MockLock] PIN revogado');
      expect(revokeLog).toContain(createResult.providerRef);
    });

    it('deve simular múltiplas reservas com PINs diferentes', async () => {
      const lock1Results = await provider.createTimedPin(
        'lock-1',
        '111111',
        validFrom,
        validTo
      );

      const lock2Results = await provider.createTimedPin(
        'lock-2',
        '222222',
        validFrom,
        validTo
      );

      const lock3Results = await provider.createTimedPin(
        'lock-3',
        '333333',
        validFrom,
        validTo
      );

      // Todos diferentes
      expect(lock1Results.providerRef).not.toBe(lock2Results.providerRef);
      expect(lock2Results.providerRef).not.toBe(lock3Results.providerRef);

      // Revoga todos
      const revoke1 = await provider.revokePin(
        'lock-1',
        lock1Results.providerRef
      );
      const revoke2 = await provider.revokePin(
        'lock-2',
        lock2Results.providerRef
      );
      const revoke3 = await provider.revokePin(
        'lock-3',
        lock3Results.providerRef
      );

      expect(revoke1.success).toBe(true);
      expect(revoke2.success).toBe(true);
      expect(revoke3.success).toBe(true);
    });
  });
});
