/**
 * Validador de assinatura HMAC para webhooks
 * 
 * Suporta:
 * - Modo MOCK: sempre retorna true (para testes)
 * - Modo PROD: valida assinatura HMAC-SHA256
 */

import crypto from 'crypto';
import type { ValidationResult, WebhookConfig } from './webhook.types';

/**
 * Gerar assinatura HMAC-SHA256
 * 
 * @param body Corpo da requisição (JSON string)
 * @param secret Chave secreta do webhook
 * @returns Assinatura em formato hexadecimal
 */
export function generateWebhookSignature(body: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
}

/**
 * Validar assinatura HMAC de webhook
 * 
 * @param body Corpo da requisição original (JSON string)
 * @param receivedSignature Assinatura recebida no header X-Webhook-Signature
 * @param secret Chave secreta do webhook
 * @param mockMode Se true, sempre retorna true (para testes)
 * @returns Resultado da validação
 * 
 * @example
 * // Em modo MOCK (aceita qualquer coisa)
 * const result = validateWebhookSignature(body, sig, secret, true);
 * // { isValid: true }
 * 
 * @example
 * // Em modo PROD (valida assinatura)
 * const result = validateWebhookSignature(body, sig, secret, false);
 * // { isValid: true/false, reason: "..." }
 */
export function validateWebhookSignature(
  body: string,
  receivedSignature: string,
  secret: string,
  mockMode: boolean = false
): ValidationResult {
  // =========================================================================
  // MODO MOCK: Aceitar sem validar
  // =========================================================================
  if (mockMode) {
    return {
      isValid: true,
      reason: 'Mock mode enabled - signature not validated',
    };
  }

  // =========================================================================
  // MODO PRODUÇÃO: Validar assinatura HMAC-SHA256
  // =========================================================================

  // Validar se signature foi fornecida
  if (!receivedSignature || receivedSignature.length === 0) {
    return {
      isValid: false,
      reason: 'Missing X-Webhook-Signature header',
    };
  }

  // Validar se secret foi fornecido
  if (!secret || secret.length === 0) {
    return {
      isValid: false,
      reason: 'Webhook secret not configured',
    };
  }

  try {
    // Gerar assinatura esperada
    const expectedSignature = generateWebhookSignature(body, secret);

    // Comparar com timing-safe comparison para evitar timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(receivedSignature),
      Buffer.from(expectedSignature)
    );

    if (isValid) {
      return {
        isValid: true,
        reason: 'Signature valid',
      };
    } else {
      return {
        isValid: false,
        reason: 'Signature mismatch',
      };
    }
  } catch (error) {
    // Erro ao comparar (ex: comprimentos diferentes)
    return {
      isValid: false,
      reason: 'Signature validation failed',
    };
  }
}

/**
 * Criar configuração de webhook a partir de variáveis de ambiente
 * 
 * @param env Variáveis de ambiente
 * @returns Configuração de webhook
 */
export function createWebhookConfig(env: {
  STAYS_WEBHOOK_SECRET?: string;
  STAYS_ENABLE_MOCK?: string;
  NODE_ENV?: string;
}): WebhookConfig {
  const mockMode = 
    env.STAYS_ENABLE_MOCK === 'true' || 
    env.NODE_ENV === 'test' ||
    env.NODE_ENV === 'development';

  return {
    enabled: true,
    secret: env.STAYS_WEBHOOK_SECRET || 'default-webhook-secret-dev-only',
    mockMode,
    maxEventsInMemory: 1000,
    retentionMinutes: 60, // Manter eventos por 1 hora em memória
  };
}

/**
 * Validar payload de webhook (estrutura básica)
 * 
 * @param payload Payload recebido
 * @returns Se o payload é válido
 */
export function validateWebhookPayload(payload: any): {
  isValid: boolean;
  error?: string;
} {
  // Verificar campos obrigatórios
  if (!payload.event) {
    return {
      isValid: false,
      error: 'Missing required field: event',
    };
  }

  if (!payload.data) {
    return {
      isValid: false,
      error: 'Missing required field: data',
    };
  }

  if (!payload.timestamp) {
    return {
      isValid: false,
      error: 'Missing required field: timestamp',
    };
  }

  // Verificar tipo de evento válido
  const validEvents = [
    'reservation.created',
    'reservation.updated',
    'reservation.cancelled',
  ];

  if (!validEvents.includes(payload.event)) {
    return {
      isValid: false,
      error: `Invalid event type: ${payload.event}`,
    };
  }

  // Verificar dados da reserva
  const data = payload.data;
  const requiredFields = [
    'id',
    'accommodationId',
    'guestName',
    'guestEmail',
    'checkInDate',
    'checkOutDate',
    'status',
  ];

  for (const field of requiredFields) {
    if (!data[field]) {
      return {
        isValid: false,
        error: `Missing required reservation field: ${field}`,
      };
    }
  }

  return {
    isValid: true,
  };
}
