/**
 * PIN Generator Utilities
 * 
 * Serviços para:
 * - Gerar PINs aleatórios de 6 dígitos
 * - Hash de PIN com bcrypt
 * - Verificação de PIN contra hash
 */

import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;
const PIN_LENGTH = 6;

/**
 * Gera um PIN aleatório de 6 dígitos
 * 
 * @returns PIN como string (ex: "123456")
 * 
 * @example
 * const pin = generateRandomPin();
 * // "523891"
 */
export function generateRandomPin(): string {
  // Gera número aleatório entre 100000 e 999999
  const min = Math.pow(10, PIN_LENGTH - 1);
  const max = Math.pow(10, PIN_LENGTH) - 1;
  const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
  
  return randomNumber.toString();
}

/**
 * Faz hash de um PIN usando bcrypt
 * 
 * @param pin - PIN em texto plano (6 dígitos)
 * @returns Promise com hash bcrypt
 * 
 * @throws Error se PIN tiver formato inválido
 * 
 * @example
 * const hash = await hashPin("123456");
 * // "$2b$10$..."
 */
export async function hashPin(pin: string): Promise<string> {
  // Validação básica
  if (!pin || typeof pin !== 'string') {
    throw new Error('PIN must be a string');
  }
  
  if (!/^\d{6}$/.test(pin)) {
    throw new Error('PIN must be exactly 6 digits');
  }
  
  // Hash com bcrypt
  const hash = await bcrypt.hash(pin, SALT_ROUNDS);
  return hash;
}

/**
 * Verifica se um PIN em texto plano corresponde a um hash bcrypt
 * 
 * @param pin - PIN em texto plano
 * @param hash - Hash bcrypt armazenado
 * @returns Promise<boolean> true se corresponder, false caso contrário
 * 
 * @example
 * const isValid = await verifyPin("123456", "$2b$10$...");
 * // true
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  try {
    if (!pin || !hash) {
      return false;
    }
    
    // Comparar PIN com hash
    const isMatch = await bcrypt.compare(pin, hash);
    return isMatch;
  } catch (error) {
    // Se houver erro (ex: hash inválido), retorna false
    console.error('[PIN] Erro ao verificar PIN:', error);
    return false;
  }
}

/**
 * Valida se um PIN tem o formato correto
 * 
 * @param pin - PIN a validar
 * @returns true se PIN é válido (6 dígitos)
 * 
 * @example
 * isValidPinFormat("123456")  // true
 * isValidPinFormat("12345")   // false
 * isValidPinFormat("abcdef")  // false
 */
export function isValidPinFormat(pin: string): boolean {
  if (!pin || typeof pin !== 'string') {
    return false;
  }
  
  return /^\d{6}$/.test(pin);
}
