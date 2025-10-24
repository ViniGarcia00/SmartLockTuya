/**
 * Factory para criar instâncias de LockProvider
 * 
 * Implementa padrão Factory para:
 * 1. Centralizar criação de provedores
 * 2. Permitir fácil alternância entre provedores
 * 3. Facilitar injeção de dependência
 * 
 * Uso:
 * const provider = LockProviderFactory.create();
 * const result = await provider.createTimedPin(...);
 */

import { ILockProvider, LockProviderType } from './lock-provider.interface';
import { MockLockProvider } from './mock-lock-provider';

/**
 * Factory class para criar lock providers
 */
export class LockProviderFactory {
  /**
   * Instância singleton do provider
   */
  private static instance: ILockProvider | null = null;

  /**
   * Obter o tipo de provedor configurado (lê em tempo de execução)
   */
  private static getProviderType(): LockProviderType {
    return (process.env.LOCK_PROVIDER as LockProviderType) || 'mock';
  }

  /**
   * Cria ou retorna instância do provider configurado
   * 
   * @returns Instância do lock provider
   * @throws Error se tipo de provedor é desconhecido
   * 
   * @example
   * const provider = LockProviderFactory.create();
   * await provider.createTimedPin('lock-1', '123456', new Date(), new Date());
   */
  static create(): ILockProvider {
    // Retorna singleton se já criado
    if (this.instance) {
      return this.instance;
    }

    // Cria nova instância baseado no tipo
    const providerType = this.getProviderType();

    switch (providerType) {
      case 'mock':
        this.instance = new MockLockProvider();
        console.log('[LockProviderFactory] Usando MockLockProvider');
        break;

      case 'tuya':
        // Futuro: import TuyaLockProvider e instanciar
        throw new Error('TuyaLockProvider não implementado ainda');

      case 'august':
        // Futuro: import AugustLockProvider e instanciar
        throw new Error('AugustLockProvider não implementado ainda');

      case 'yale':
        // Futuro: import YaleLockProvider e instanciar
        throw new Error('YaleLockProvider não implementado ainda');

      default:
        throw new Error(`Provedor de fechadura desconhecido: ${providerType}`);
    }

    return this.instance;
  }

  /**
   * Retorna o tipo de provedor ativo
   * Útil para logging/debugging
   */
  static getCurrentProviderType(): LockProviderType {
    return this.getProviderType();
  }

  /**
   * Reseta a instância singleton
   * Útil para testes
   */
  static reset(): void {
    this.instance = null;
  }

  /**
   * Define uma instância customizada do provider
   * Útil para testes com mocks
   */
  static setProvider(provider: ILockProvider): void {
    this.instance = provider;
  }
}
