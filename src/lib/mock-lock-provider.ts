/**
 * Implementação Mock de ILockProvider
 * Usado para testes e desenvolvimento sem integração real com fechaduras
 * 
 * Características:
 * - Gera UUIDs fake para providerRef
 * - Simula criar/revogar PINs com logs
 * - Sempre retorna sucesso
 * - Ideal para testes end-to-end
 */

import { ILockProvider } from './lock-provider.interface';

/**
 * Gera um UUID v4 simples sem dependência externa
 * Formato: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class MockLockProvider implements ILockProvider {
  private static readonly logger = console; // Em produção, seria Winston/Pino

  /**
   * Simula criação de PIN na fechadura
   * 
   * Fluxo:
   * 1. Gera UUID para referência
   * 2. Loga criação
   * 3. Retorna referência
   */
  async createTimedPin(
    lockId: string,
    pin: string,
    validFrom: Date,
    validTo: Date
  ): Promise<{ providerRef: string }> {
    // Validações básicas
    if (!lockId) {
      throw new Error('lockId é obrigatório');
    }
    if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      throw new Error('PIN deve ter exatamente 6 dígitos');
    }
    if (!(validFrom instanceof Date) || !(validTo instanceof Date)) {
      throw new Error('validFrom e validTo devem ser instâncias de Date');
    }
    if (validFrom >= validTo) {
      throw new Error('validFrom deve ser antes de validTo');
    }

    // Simula criação
    const providerRef = generateUUID();

    // Log
    MockLockProvider.logger.log(
      `[MockLock] PIN criado para lockId=${lockId}, pin=${pin}, ` +
      `validFrom=${validFrom.toISOString()}, validTo=${validTo.toISOString()}, ` +
      `providerRef=${providerRef}`
    );

    return {
      providerRef,
    };
  }

  /**
   * Simula revogação de PIN na fechadura
   * 
   * Fluxo:
   * 1. Valida referência
   * 2. Loga revogação
   * 3. Retorna sucesso
   */
  async revokePin(
    lockId: string,
    providerRef: string
  ): Promise<{ success: boolean }> {
    // Validações básicas
    if (!lockId) {
      throw new Error('lockId é obrigatório');
    }
    if (!providerRef) {
      throw new Error('providerRef é obrigatório');
    }

    // Simula revogação
    const success = true;

    // Log
    MockLockProvider.logger.log(
      `[MockLock] PIN revogado para lockId=${lockId}, providerRef=${providerRef}`
    );

    return {
      success,
    };
  }
}
