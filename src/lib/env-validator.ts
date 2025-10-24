/**
 * Validador de Variáveis de Ambiente
 * 
 * Responsabilidades:
 * - Validar presença obrigatória de variáveis
 * - Falhar early durante build/startup
 * - Validar formato e valores
 * - Prover defaults seguros
 */

// ============================================================================
// TYPES
// ============================================================================

export interface EnvConfig {
  // Node
  NODE_ENV: 'development' | 'production' | 'test';

  // Server
  PORT: number;
  APP_URL: string;

  // Database
  DATABASE_URL: string;

  // Redis
  REDIS_URL: string;

  // JWT
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;

  // Session
  SESSION_SECRET: string;

  // Stays Integration
  STAYS_CLIENT_ID: string;
  STAYS_CLIENT_SECRET: string;
  STAYS_API_URL: string;

  // Email
  EMAIL_SERVICE: string;
  EMAIL_USER: string;
  EMAIL_PASSWORD: string;

  // Optional / Feature Flags
  LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error';
  MOCK_STAYS_API?: boolean;
}

// ============================================================================
// REQUIRED VARIABLES
// ============================================================================

/** Variáveis obrigatórias por ambiente */
const REQUIRED_BY_ENV = {
  development: [
    'NODE_ENV',
    'PORT',
    'APP_URL',
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'SESSION_SECRET',
  ],
  production: [
    'NODE_ENV',
    'PORT',
    'APP_URL',
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'SESSION_SECRET',
    'STAYS_CLIENT_ID',
    'STAYS_CLIENT_SECRET',
    'STAYS_API_URL',
    'EMAIL_SERVICE',
    'EMAIL_USER',
    'EMAIL_PASSWORD',
  ],
  test: [
    'NODE_ENV',
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'SESSION_SECRET',
  ],
} as const;

// ============================================================================
// VALIDATOR
// ============================================================================

/**
 * Validar todas as variáveis de ambiente
 * 
 * @throws Error com lista de variáveis faltantes
 */
export function validateEnv(): EnvConfig {
  const nodeEnv = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test';
  const required = REQUIRED_BY_ENV[nodeEnv];
  const missing: string[] = [];

  // Validar obrigatórias
  for (const variable of required) {
    if (!process.env[variable]) {
      missing.push(variable);
    }
  }

  if (missing.length > 0) {
    const errorMessage = `
╔════════════════════════════════════════════════════════════╗
║  ❌ MISSING ENVIRONMENT VARIABLES                          ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  Environment: ${nodeEnv.padEnd(50)} ║
║                                                            ║
║  Missing variables:                                        ║
${missing.map((v) => `║    • ${v.padEnd(48)}║`).join('\n')}
║                                                            ║
║  Solution:                                                 ║
║  1. Create .env file in project root                       ║
║  2. Copy from .env.example                                 ║
║  3. Fill in your values                                    ║
║                                                            ║
║  Documentation: docs/ENVIRONMENT.md                        ║
╚════════════════════════════════════════════════════════════╝
    `;

    throw new Error(errorMessage);
  }

  // Validar formatos
  validateFormats();

  // Build config
  return {
    NODE_ENV: nodeEnv,
    PORT: parseInt(process.env.PORT || '3000', 10),
    APP_URL: process.env.APP_URL!,
    DATABASE_URL: process.env.DATABASE_URL!,
    REDIS_URL: process.env.REDIS_URL!,
    JWT_SECRET: process.env.JWT_SECRET!,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
    SESSION_SECRET: process.env.SESSION_SECRET!,
    STAYS_CLIENT_ID: process.env.STAYS_CLIENT_ID || '',
    STAYS_CLIENT_SECRET: process.env.STAYS_CLIENT_SECRET || '',
    STAYS_API_URL: process.env.STAYS_API_URL || '',
    EMAIL_SERVICE: process.env.EMAIL_SERVICE || '',
    EMAIL_USER: process.env.EMAIL_USER || '',
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || '',
    LOG_LEVEL: (process.env.LOG_LEVEL || 'info') as any,
    MOCK_STAYS_API: process.env.MOCK_STAYS_API === 'true',
  };
}

/**
 * Validar formatos de variáveis
 */
function validateFormats(): void {
  const errors: string[] = [];

  // Validar PORT
  if (process.env.PORT) {
    const port = parseInt(process.env.PORT, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push('PORT must be a valid port number (1-65535)');
    }
  }

  // Validar DATABASE_URL
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgresql://')) {
    errors.push('DATABASE_URL must start with "postgresql://"');
  }

  // Validar REDIS_URL
  if (process.env.REDIS_URL && !process.env.REDIS_URL.startsWith('redis://')) {
    errors.push('REDIS_URL must start with "redis://"');
  }

  // Validar APP_URL
  if (process.env.APP_URL) {
    try {
      new URL(process.env.APP_URL);
    } catch {
      errors.push('APP_URL must be a valid URL (e.g., http://localhost:3000)');
    }
  }

  // Validar STAYS_API_URL
  if (process.env.STAYS_API_URL) {
    try {
      new URL(process.env.STAYS_API_URL);
    } catch {
      errors.push('STAYS_API_URL must be a valid URL');
    }
  }

  if (errors.length > 0) {
    const errorMessage = `
╔════════════════════════════════════════════════════════════╗
║  ❌ INVALID ENVIRONMENT VARIABLES                          ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
${errors.map((e) => `║  • ${e.padEnd(53)}║`).join('\n')}
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `;

    throw new Error(errorMessage);
  }
}

/**
 * Obter single variable com valor padrão
 */
export function getEnvVariable(
  name: keyof typeof process.env,
  defaultValue?: string
): string | undefined {
  return process.env[name] || defaultValue;
}

/**
 * Obter boolean variable
 */
export function getEnvBoolean(name: keyof typeof process.env, defaultValue: boolean = false): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;
  return value === 'true' || value === '1' || value === 'yes';
}

/**
 * Obter numeric variable
 */
export function getEnvNumber(name: keyof typeof process.env, defaultValue?: number): number {
  const value = process.env[name];
  if (!value) return defaultValue || 0;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? (defaultValue || 0) : parsed;
}

// ============================================================================
// EXPORT SUMMARY
// ============================================================================

export const ENV_VALIDATOR_SUMMARY = {
  required_development: REQUIRED_BY_ENV.development,
  required_production: REQUIRED_BY_ENV.production,
  required_test: REQUIRED_BY_ENV.test,
  features: [
    'Validar presença obrigatória',
    'Validar formatos (URL, port, database)',
    'Falhar early durante build/startup',
    'Prover valores padrão seguros',
    'Prover mensagens de erro claras',
  ],
} as const;
