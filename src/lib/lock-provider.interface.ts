/**
 * Interface para provedores de fechadura (Adapter Pattern)
 * Define contrato que qualquer provedor de fechadura deve implementar
 * 
 * Padrão: Adapter Pattern permite integração com diferentes provedores
 * (Mock, Tuya, August, Yale, etc.) sem alterar código consumidor
 */

export interface ILockProvider {
  /**
   * Cria um PIN temporário com validação automática
   * 
   * @param lockId - ID único da fechadura no provedor
   * @param pin - PIN de 6 dígitos a ser criado
   * @param validFrom - Data/hora início de validade
   * @param validTo - Data/hora fim de validade
   * @returns Promise com referência do provedor para futuro revogamento
   * @throws Error se falhar criar o PIN
   * 
   * @example
   * const result = await lockProvider.createTimedPin(
   *   'lock-001',
   *   '123456',
   *   new Date('2025-10-24T15:00:00Z'),
   *   new Date('2025-10-26T11:00:00Z')
   * );
   * console.log(result.providerRef); // UUID ou ID do provedor
   */
  createTimedPin(
    lockId: string,
    pin: string,
    validFrom: Date,
    validTo: Date
  ): Promise<{ providerRef: string }>;

  /**
   * Revoga um PIN temporário
   * 
   * @param lockId - ID único da fechadura no provedor
   * @param providerRef - Referência retornada por createTimedPin
   * @returns Promise com resultado da revogação
   * @throws Error se falhar revogar o PIN
   * 
   * @example
   * const result = await lockProvider.revokePin(
   *   'lock-001',
   *   'pin-ref-uuid-123'
   * );
   * console.log(result.success); // true se sucesso
   */
  revokePin(
    lockId: string,
    providerRef: string
  ): Promise<{ success: boolean }>;
}

/**
 * Tipo para factory de provedores
 * Permite identificar qual provedor está ativo
 */
export type LockProviderType = 'mock' | 'tuya' | 'august' | 'yale';
