/**
 * Validação de variáveis de ambiente com Zod
 * Garante que todas as variáveis necessárias estão presentes e com tipos corretos
 */

import { z } from 'zod';

/**
 * Schema de validação para variáveis de ambiente
 */
const envSchema = z.object({
  // Ambiente e porta
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  
  // Autenticação
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter no mínimo 32 caracteres'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET deve ter no mínimo 32 caracteres'),
  
  // Banco de Dados PostgreSQL
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().default('tuya_locks_db'),
  DB_USER: z.string().default('tuya_admin'),
  DB_PASSWORD: z.string(),
  
  // Redis (Cache)
  REDIS_URL: z.string().url().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  
  // Configuração Stays
  STAYS_CLIENT_ID: z.string().min(1, 'STAYS_CLIENT_ID é obrigatório'),
  STAYS_CLIENT_SECRET: z.string().min(1, 'STAYS_CLIENT_SECRET é obrigatório'),
  STAYS_BASE_URL: z.string().url().default('https://api.staysapp.com'),
  STAYS_ENABLE_MOCK: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default(() => false),
  
  // Email
  EMAIL_SERVICE: z.string().default('gmail'),
  EMAIL_USER: z.string().email('EMAIL_USER deve ser um email válido').optional(),
  EMAIL_PASSWORD: z.string().optional(),
  
  // Aplicação
  APP_URL: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug'])
    .default('info'),
});

/**
 * Tipo das variáveis de ambiente validadas
 */
export type Environment = z.infer<typeof envSchema>;

/**
 * Instância das variáveis de ambiente validadas
 */
let validatedEnv: Environment | null = null;

/**
 * Validar e retornar variáveis de ambiente
 * @throws Error se validação falhar
 */
export function getEnvironment(): Environment {
  if (validatedEnv) {
    return validatedEnv;
  }

  try {
    // Parse e validar variáveis de ambiente
    const parsed = envSchema.parse(process.env);
    validatedEnv = parsed;

    // Log das variáveis carregadas (sem secrets)
    console.log('[ENV] Variáveis de ambiente validadas com sucesso');
    console.log(`[ENV] NODE_ENV: ${parsed.NODE_ENV}`);
    console.log(`[ENV] PORT: ${parsed.PORT}`);
    console.log(`[ENV] DATABASE: ${parsed.DB_USER}@${parsed.DB_HOST}:${parsed.DB_PORT}/${parsed.DB_NAME}`);
    console.log(`[ENV] REDIS: ${parsed.REDIS_HOST}:${parsed.REDIS_PORT}`);
    console.log(`[ENV] STAYS_BASE_URL: ${parsed.STAYS_BASE_URL}`);
    console.log(`[ENV] STAYS_ENABLE_MOCK: ${parsed.STAYS_ENABLE_MOCK}`);

    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));

      console.error('[ENV] Erro ao validar variáveis de ambiente:');
      issues.forEach((issue) => {
        console.error(`  - ${issue.path}: ${issue.message}`);
      });

      throw new Error(
        `Validação de ambiente falhou:\n${issues.map((i) => `  ${i.path}: ${i.message}`).join('\n')}`
      );
    }

    throw error;
  }
}

/**
 * Resetar variáveis de ambiente validadas (útil para testes)
 */
export function resetEnvironment(): void {
  validatedEnv = null;
}

/**
 * Obter valor específico de uma variável de ambiente
 * @param key Chave da variável
 * @param defaultValue Valor padrão se não encontrada
 */
export function getEnv<K extends keyof Environment>(
  key: K,
  defaultValue?: Environment[K]
): Environment[K] {
  const env = getEnvironment();
  const value = env[key];

  if (value === undefined && defaultValue !== undefined) {
    return defaultValue;
  }

  return value;
}

/**
 * Verificar se está em ambiente de produção
 */
export function isProduction(): boolean {
  return getEnv('NODE_ENV') === 'production';
}

/**
 * Verificar se está em ambiente de desenvolvimento
 */
export function isDevelopment(): boolean {
  return getEnv('NODE_ENV') === 'development';
}

/**
 * Verificar se está em ambiente de teste
 */
export function isTest(): boolean {
  return getEnv('NODE_ENV') === 'test';
}

/**
 * Verificar se modo MOCK está ativado
 */
export function isMockEnabled(): boolean {
  return getEnv('STAYS_ENABLE_MOCK', false);
}

/**
 * Validação especializada para Stays
 */
export const staysEnvSchema = z.object({
  clientId: z.string().min(1, 'Client ID do Stays é obrigatório'),
  clientSecret: z.string().min(1, 'Client Secret do Stays é obrigatório'),
  baseURL: z.string().url('URL base do Stays deve ser válida'),
  enableMock: z.boolean().default(false),
  redisUrl: z.string().url().optional(),
});

/**
 * Obter configuração Stays a partir das variáveis de ambiente
 */
export function getStaysConfig() {
  const env = getEnvironment();
  
  return staysEnvSchema.parse({
    clientId: env.STAYS_CLIENT_ID,
    clientSecret: env.STAYS_CLIENT_SECRET,
    baseURL: env.STAYS_BASE_URL,
    enableMock: env.STAYS_ENABLE_MOCK,
    redisUrl: env.REDIS_URL,
  });
}

/**
 * Validação especializada para banco de dados
 */
export const databaseEnvSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive(),
  name: z.string().min(1),
  user: z.string().min(1),
  password: z.string().min(1),
});

/**
 * Obter configuração do banco de dados a partir das variáveis de ambiente
 */
export function getDatabaseConfig() {
  const env = getEnvironment();
  
  return databaseEnvSchema.parse({
    host: env.DB_HOST,
    port: env.DB_PORT,
    name: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
  });
}

/**
 * Validação especializada para Redis
 */
export const redisEnvSchema = z.object({
  url: z.string().url().optional(),
  host: z.string().min(1),
  port: z.number().int().positive(),
  password: z.string().optional(),
});

/**
 * Obter configuração do Redis a partir das variáveis de ambiente
 */
export function getRedisConfig() {
  const env = getEnvironment();
  
  return redisEnvSchema.parse({
    url: env.REDIS_URL,
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
  });
}

/**
 * Gerar URL de conexão do banco de dados PostgreSQL
 */
export function getDatabaseUrl(): string {
  const config = getDatabaseConfig();
  return `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${config.name}`;
}

/**
 * Gerar URL de conexão do Redis
 */
export function getRedisUrl(): string {
  const config = getRedisConfig();
  
  if (config.url) {
    return config.url;
  }

  if (config.password) {
    return `redis://:${config.password}@${config.host}:${config.port}`;
  }

  return `redis://${config.host}:${config.port}`;
}

/**
 * Export padrão com todas as funções
 */
export default {
  getEnvironment,
  resetEnvironment,
  getEnv,
  isProduction,
  isDevelopment,
  isTest,
  isMockEnabled,
  getStaysConfig,
  getDatabaseConfig,
  getRedisConfig,
  getDatabaseUrl,
  getRedisUrl,
  envSchema,
  staysEnvSchema,
  databaseEnvSchema,
  redisEnvSchema,
};
