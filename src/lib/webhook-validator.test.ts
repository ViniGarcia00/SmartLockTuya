/**
 * Testes para webhook-validator.ts
 * 
 * Testa:
 * - Modo MOCK (sempre true)
 * - Modo PROD com assinatura válida
 * - Modo PROD com assinatura inválida
 * - Validação de payload
 */

import { 
  validateWebhookSignature, 
  generateWebhookSignature,
  validateWebhookPayload,
  createWebhookConfig,
} from './webhook-validator';

describe('Webhook Validator', () => {
  // ========================================================================
  // TESTE 1: Modo MOCK - Aceita qualquer assinatura
  // ========================================================================
  describe('Mock Mode - validateWebhookSignature', () => {
    it('should accept any signature in mock mode', () => {
      const body = JSON.stringify({ event: 'reservation.created' });
      const signature = 'any-signature-value';
      const secret = 'any-secret';

      const result = validateWebhookSignature(body, signature, secret, true);

      expect(result.isValid).toBe(true);
      expect(result.reason).toContain('Mock mode');
    });

    it('should accept empty signature in mock mode', () => {
      const body = 'any-body';
      const signature = '';
      const secret = 'any-secret';

      const result = validateWebhookSignature(body, signature, secret, true);

      expect(result.isValid).toBe(true);
    });
  });

  // ========================================================================
  // TESTE 2: Modo PROD - Assinatura válida
  // ========================================================================
  describe('Prod Mode - Valid Signature', () => {
    it('should accept valid signature', () => {
      const body = JSON.stringify({
        event: 'reservation.created',
        data: { id: 'RES-001' },
      });
      const secret = 'webhook-secret-key';

      // Gerar assinatura válida
      const signature = generateWebhookSignature(body, secret);

      const result = validateWebhookSignature(body, signature, secret, false);

      expect(result.isValid).toBe(true);
      expect(result.reason).toBe('Signature valid');
    });

    it('should generate consistent signatures', () => {
      const body = 'same-body';
      const secret = 'same-secret';

      const sig1 = generateWebhookSignature(body, secret);
      const sig2 = generateWebhookSignature(body, secret);

      expect(sig1).toBe(sig2);
    });
  });

  // ========================================================================
  // TESTE 3: Modo PROD - Assinatura inválida
  // ========================================================================
  describe('Prod Mode - Invalid Signature', () => {
    it('should reject invalid signature', () => {
      const body = JSON.stringify({
        event: 'reservation.created',
        data: { id: 'RES-001' },
      });
      const secret = 'webhook-secret-key';
      const wrongSignature = 'invalid-signature-value';

      const result = validateWebhookSignature(
        body,
        wrongSignature,
        secret,
        false
      );

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('mismatch');
    });

    it('should reject when signature missing', () => {
      const body = 'some-body';
      const secret = 'some-secret';
      const signature = '';

      const result = validateWebhookSignature(body, signature, secret, false);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Missing');
    });

    it('should reject when body is tampered', () => {
      const body1 = JSON.stringify({ event: 'reservation.created' });
      const body2 = JSON.stringify({ event: 'reservation.updated' });
      const secret = 'webhook-secret-key';

      // Gerar assinatura para body1
      const signature = generateWebhookSignature(body1, secret);

      // Tentar validar body2 com assinatura de body1
      const result = validateWebhookSignature(body2, signature, secret, false);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('mismatch');
    });
  });

  // ========================================================================
  // TESTE 4: Validação de payload
  // ========================================================================
  describe('Payload Validation - validateWebhookPayload', () => {
    const validPayload = {
      event: 'reservation.created',
      timestamp: new Date().toISOString(),
      data: {
        id: 'RES-001',
        accommodationId: 'ACC-001',
        guestName: 'João Silva',
        guestEmail: 'joao@example.com',
        checkInDate: '2025-10-24',
        checkOutDate: '2025-10-26',
        status: 'confirmed',
      },
    };

    it('should accept valid payload', () => {
      const result = validateWebhookPayload(validPayload);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject payload without event', () => {
      const payload = { ...validPayload } as any;
      delete payload.event;

      const result = validateWebhookPayload(payload);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('event');
    });

    it('should reject payload without data', () => {
      const payload = { ...validPayload } as any;
      delete payload.data;

      const result = validateWebhookPayload(payload);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('data');
    });

    it('should reject payload without timestamp', () => {
      const payload = { ...validPayload } as any;
      delete payload.timestamp;

      const result = validateWebhookPayload(payload);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('timestamp');
    });

    it('should reject invalid event type', () => {
      const payload = {
        ...validPayload,
        event: 'invalid.event.type',
      };

      const result = validateWebhookPayload(payload);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid event type');
    });

    it('should reject payload missing required reservation fields', () => {
      const payload = {
        event: 'reservation.created',
        timestamp: new Date().toISOString(),
        data: {
          id: 'RES-001',
          // Faltam outros campos
        },
      };

      const result = validateWebhookPayload(payload);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Missing');
    });

    it('should accept all valid event types', () => {
      const eventTypes = [
        'reservation.created',
        'reservation.updated',
        'reservation.cancelled',
      ];

      for (const eventType of eventTypes) {
        const payload = { ...validPayload, event: eventType };
        const result = validateWebhookPayload(payload);
        expect(result.isValid).toBe(true);
      }
    });
  });

  // ========================================================================
  // TESTE 5: Configuração de webhook
  // ========================================================================
  describe('Webhook Config - createWebhookConfig', () => {
    it('should enable mock mode in development', () => {
      const env = {
        NODE_ENV: 'development',
        STAYS_WEBHOOK_SECRET: 'dev-secret',
      };

      const config = createWebhookConfig(env);

      expect(config.mockMode).toBe(true);
      expect(config.enabled).toBe(true);
    });

    it('should enable mock mode when STAYS_ENABLE_MOCK is true', () => {
      const env = {
        NODE_ENV: 'production',
        STAYS_ENABLE_MOCK: 'true',
        STAYS_WEBHOOK_SECRET: 'prod-secret',
      };

      const config = createWebhookConfig(env);

      expect(config.mockMode).toBe(true);
    });

    it('should disable mock mode in production without flag', () => {
      const env = {
        NODE_ENV: 'production',
        STAYS_WEBHOOK_SECRET: 'prod-secret',
      };

      const config = createWebhookConfig(env);

      expect(config.mockMode).toBe(false);
    });

    it('should use provided secret', () => {
      const env = {
        STAYS_WEBHOOK_SECRET: 'custom-webhook-secret',
      };

      const config = createWebhookConfig(env);

      expect(config.secret).toBe('custom-webhook-secret');
    });

    it('should use default secret if not provided', () => {
      const env = {};

      const config = createWebhookConfig(env);

      expect(config.secret).toContain('default');
    });
  });

  // ========================================================================
  // TESTE 6: Casos extremos (Edge Cases)
  // ========================================================================
  describe('Edge Cases', () => {
    it('should handle very long signatures', () => {
      const body = 'some-body';
      const secret = 'some-secret';
      const longSignature = 'x'.repeat(1000);

      const result = validateWebhookSignature(
        body,
        longSignature,
        secret,
        false
      );

      expect(result.isValid).toBe(false);
    });

    it('should handle unicode characters in body', () => {
      const body = JSON.stringify({
        event: 'reservation.created',
        data: { guestName: 'João Müller 中文' },
      });
      const secret = 'webhook-secret';

      const signature = generateWebhookSignature(body, secret);
      const result = validateWebhookSignature(body, signature, secret, false);

      expect(result.isValid).toBe(true);
    });

    it('should be case-sensitive for signatures', () => {
      const body = 'some-body';
      const secret = 'some-secret';

      const signature = generateWebhookSignature(body, secret);
      const uppercaseSignature = signature.toUpperCase();

      const result = validateWebhookSignature(
        body,
        uppercaseSignature,
        secret,
        false
      );

      expect(result.isValid).toBe(false);
    });
  });
});
