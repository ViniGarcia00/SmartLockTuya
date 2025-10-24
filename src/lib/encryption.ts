/**
 * Módulo de Criptografia e Hash
 * 
 * Responsabilidades:
 * - Hashing de PINs com bcrypt
 * - Hashing de emails com SHA256 (LGPD)
 * - Constantes de segurança
 */

import bcrypt from 'bcrypt';
import crypto from 'crypto';

// ============================================================================
// CONSTANTES DE SEGURANÇA
// ============================================================================

/** Número de rounds de salt para bcrypt */
export const BCRYPT_ROUNDS = 12;

/** Algoritmo de hash para emails (LGPD) */
export const EMAIL_HASH_ALGORITHM = 'sha256';

/** Iterações para PBKDF2 (futuro uso) */
export const PBKDF2_ITERATIONS = 100000;

// ============================================================================
// PIN ENCRYPTION
// ============================================================================

/**
 * Hash de PIN com bcrypt
 * 
 * Segurança:
 * - Impossível reverter o hash
 * - Cada hash é único mesmo para o mesmo PIN
 * - Resistente a força bruta com salt automático
 * 
 * @param plainPin - PIN em texto plano (não deve ser armazenado)
 * @returns Hash seguro do PIN
 * @throws Error se PIN inválido ou vazio
 */
export async function encryptPin(plainPin: string): Promise<string> {
  if (!plainPin || plainPin.length !== 7) {
    throw new Error('PIN must be exactly 7 digits');
  }

  if (!/^\d+$/.test(plainPin)) {
    throw new Error('PIN must contain only digits');
  }

  try {
    const hash = await bcrypt.hash(plainPin, BCRYPT_ROUNDS);
    return hash;
  } catch (error) {
    throw new Error(`Failed to encrypt PIN: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validar PIN contra hash
 * 
 * @param plainPin - PIN em texto plano
 * @param hashedPin - Hash armazenado
 * @returns true se PIN corresponde ao hash
 */
export async function validatePin(plainPin: string, hashedPin: string): Promise<boolean> {
  try {
    if (!plainPin || plainPin.length !== 7) {
      return false;
    }

    if (!/^\d+$/.test(plainPin)) {
      return false;
    }

    return await bcrypt.compare(plainPin, hashedPin);
  } catch (error) {
    console.error('Error validating PIN:', error);
    return false;
  }
}

// ============================================================================
// EMAIL HASHING (LGPD)
// ============================================================================

/**
 * Hash de email com SHA256 para conformidade LGPD
 * 
 * Usado para:
 * - Validação de integridade
 * - Verificação de duplicatas sem armazenar email em plaintext
 * - Rastreabilidade de dados pessoais
 * 
 * IMPORTANTE:
 * - Email original ainda é armazenado em database (necessário para contato)
 * - Este hash é para fins de auditoria e LGPD
 * 
 * @param email - Email em texto plano
 * @returns Hash SHA256 do email
 */
export function hashEmail(email: string): string {
  if (!email || email.trim().length === 0) {
    throw new Error('Email cannot be empty');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const hash = crypto
    .createHash(EMAIL_HASH_ALGORITHM)
    .update(normalizedEmail)
    .digest('hex');

  return hash;
}

/**
 * Validar email contra hash
 * 
 * @param email - Email em texto plano
 * @param emailHash - Hash SHA256 armazenado
 * @returns true se email corresponde ao hash
 */
export function validateEmailHash(email: string, emailHash: string): boolean {
  try {
    const hash = hashEmail(email);
    return hash === emailHash;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Gerar salt aleatório para segurança adicional
 * 
 * @param length - Tamanho do salt em bytes
 * @returns Salt hexadecimal
 */
export function generateSalt(length: number = 16): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Gerar hash PBKDF2 (futuro uso para senhas)
 * 
 * @param password - Senha em texto plano
 * @param salt - Salt (aleatório se não fornecido)
 * @returns {hash, salt} para armazenamento
 */
export function pbkdf2Hash(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || generateSalt();
  
  const hash = crypto
    .pbkdf2Sync(password, actualSalt, PBKDF2_ITERATIONS, 64, 'sha256')
    .toString('hex');

  return { hash, salt: actualSalt };
}

/**
 * Validar senha com PBKDF2
 * 
 * @param password - Senha em texto plano
 * @param hash - Hash armazenado
 * @param salt - Salt armazenado
 * @returns true se senha corresponde
 */
export function validatePbkdf2(password: string, hash: string, salt: string): boolean {
  try {
    const { hash: newHash } = pbkdf2Hash(password, salt);
    return newHash === hash;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// SANITIZATION
// ============================================================================

/**
 * Remover dados sensíveis de objeto
 * 
 * @param obj - Objeto com dados sensíveis
 * @param sensitiveFields - Lista de campos sensíveis a remover
 * @returns Cópia do objeto com campos sensíveis removidos
 */
export function sanitize<T extends Record<string, any>>(
  obj: T,
  sensitiveFields: string[] = ['password', 'pin', 'token', 'secret']
): Partial<T> {
  const sanitized = { ...obj };

  sensitiveFields.forEach((field) => {
    if (field in sanitized) {
      delete (sanitized as any)[field];
    }
  });

  return sanitized;
}

/**
 * Redact sensitive values em strings (para logs)
 * 
 * @param value - Valor a redact
 * @param showChars - Número de caracteres a mostrar no início/fim
 * @returns Valor redacted
 */
export function redact(value: string, showChars: number = 2): string {
  if (value.length <= showChars * 2) {
    return '*'.repeat(value.length);
  }

  const start = value.substring(0, showChars);
  const end = value.substring(value.length - showChars);
  const middle = '*'.repeat(value.length - showChars * 2);

  return `${start}${middle}${end}`;
}

// ============================================================================
// EXPORT SUMMARY
// ============================================================================

export const ENCRYPTION_SUMMARY = {
  bcryptRounds: BCRYPT_ROUNDS,
  emailHashAlgorithm: EMAIL_HASH_ALGORITHM,
  pbkdf2Iterations: PBKDF2_ITERATIONS,
  functions: [
    'encryptPin - Hash PIN com bcrypt',
    'validatePin - Validar PIN contra hash',
    'hashEmail - Hash email com SHA256 (LGPD)',
    'validateEmailHash - Validar email contra hash',
    'generateSalt - Gerar salt aleatório',
    'pbkdf2Hash - Hash PBKDF2 para senhas',
    'validatePbkdf2 - Validar senha PBKDF2',
    'sanitize - Remover campos sensíveis',
    'redact - Redact valor em logs',
  ],
} as const;
