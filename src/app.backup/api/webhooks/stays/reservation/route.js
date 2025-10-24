/**
 * Endpoint de Webhook para Reservas Stays
 * 
 * POST /api/webhooks/stays/reservation
 * 
 * Recebe webhooks de eventos de reserva e armazena em memória
 * 
 * Headers esperados:
 * - X-Webhook-Signature: assinatura HMAC-SHA256 (opcional em mock mode)
 * - Content-Type: application/json
 * 
 * Body esperado:
 * {
 *   "event": "reservation.created" | "reservation.updated" | "reservation.cancelled",
 *   "timestamp": "2025-10-23T12:00:00Z",
 *   "data": { reservation data },
 *   "metadata": { optional metadata }
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "eventId": "uuid",
 *   "timestamp": "2025-10-23T12:00:00Z"
 * }
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');

// Importar tipos e validadores (em TypeScript real, seria imports normais)
const {
  validateWebhookSignature,
  validateWebhookPayload,
  createWebhookConfig,
} = require('./webhook-validator');

const { webhookEventStore } = require('./webhook-event-store');

// Importar queue de jobs (BullMQ)
let revokePinQueue = null;
try {
  // Importar queue sob demanda
  const { getRevokePinQueue } = require('../../../jobs/queues');
  revokePinQueue = getRevokePinQueue();
} catch (error) {
  console.warn(
    '[Webhook] ⚠️ Aviso: Fila de revogação de PIN não disponível:',
    error.message
  );
}

// Router Express
const router = express.Router();

// Configurar webhook a partir de env
const webhookConfig = createWebhookConfig({
  STAYS_WEBHOOK_SECRET: process.env.STAYS_WEBHOOK_SECRET,
  STAYS_ENABLE_MOCK: process.env.STAYS_ENABLE_MOCK,
  NODE_ENV: process.env.NODE_ENV,
});

/**
 * POST /api/webhooks/stays/reservation
 * 
 * Receber webhook de reserva
 */
router.post('/', async (req, res) => {
  try {
    // =====================================================================
    // PASSO 1: Extrair e validar assinatura
    // =====================================================================
    const signature = req.headers['x-webhook-signature'];
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    // Converter body para string para validação de assinatura
    const rawBody = JSON.stringify(req.body);

    console.log(`\n[Webhook] Recebido: ${req.body?.event || 'unknown'}`);
    console.log(`  IP: ${ipAddress}`);
    console.log(`  Signature: ${signature ? 'presente' : 'ausente'}`);

    // Validar assinatura
    const signatureValidation = validateWebhookSignature(
      rawBody,
      signature || '',
      webhookConfig.secret,
      webhookConfig.mockMode
    );

    if (!signatureValidation.isValid) {
      console.error(`[Webhook] Assinatura inválida: ${signatureValidation.reason}`);

      return res.status(401).json({
        success: false,
        error: 'Invalid webhook signature',
        code: 'INVALID_SIGNATURE',
        timestamp: new Date().toISOString(),
        details: webhookConfig.mockMode
          ? 'Mock mode - signature validation disabled'
          : signatureValidation.reason,
      });
    }

    // =====================================================================
    // PASSO 2: Validar estrutura do payload
    // =====================================================================
    const payloadValidation = validateWebhookPayload(req.body);

    if (!payloadValidation.isValid) {
      console.error(`[Webhook] Payload inválido: ${payloadValidation.error}`);

      return res.status(400).json({
        success: false,
        error: 'Invalid webhook payload',
        code: 'INVALID_PAYLOAD',
        details: payloadValidation.error,
        timestamp: new Date().toISOString(),
      });
    }

    // =====================================================================
    // PASSO 3: Armazenar evento em memória
    // =====================================================================
    const event = webhookEventStore.addEvent(
      req.body, // payload
      signature, // signature original recebida
      signatureValidation.isValid, // isValid
      ipAddress,
      userAgent
    );

    // =====================================================================
    // PASSO 3.5: Se reserva foi cancelada, revogar PIN imediatamente
    // =====================================================================
    if (req.body?.event === 'reservation.cancelled' && revokePinQueue) {
      const reservationId = req.body?.data?.id;
      const reservationStatus = req.body?.data?.status;
      const checkOutAt = req.body?.data?.checkOutAt
        ? new Date(req.body.data.checkOutAt)
        : null;
      const now = new Date();

      console.log(
        `[Webhook] 🔐 Detectada revogação de reserva: ${reservationId}`
      );
      console.log(`  Status: ${reservationStatus}`);
      console.log(`  CheckOut: ${checkOutAt?.toISOString()}`);

      // Verificar se ainda estamos dentro do prazo de revogação
      // (não revogar se o checkout já passou)
      if (checkOutAt && checkOutAt > now) {
        try {
          // Adicionar job à fila de revogação de PIN
          const revocationJob = await revokePinQueue.add(
            {
              reservationId: reservationId,
            },
            {
              jobId: `revoke-pin-${reservationId}-webhook`,
              priority: 10, // Alta prioridade para revogação imediata
              attempts: 3, // Tentar 3 vezes
              backoff: {
                type: 'exponential',
                delay: 2000,
              },
              removeOnComplete: true,
            }
          );

          console.log(`[Webhook] ✅ Job de revogação enfileirado:`);
          console.log(`  Job ID: ${revocationJob.id}`);
          console.log(`  Reservation ID: ${reservationId}`);

          // Cancelar qualquer job de revogação agendado para o futuro
          try {
            const allJobs = await revokePinQueue.getJobs([
              'scheduled',
              'waiting',
            ]);
            const scheduledJobs = allJobs.filter(
              (j) =>
                j.data?.reservationId === reservationId &&
                j.id !== revocationJob.id
            );

            for (const job of scheduledJobs) {
              await job.remove();
              console.log(
                `[Webhook] ℹ️ Job de revogação agendado cancelado: ${job.id}`
              );
            }
          } catch (cancelError) {
            console.warn(
              '[Webhook] ⚠️ Erro ao cancelar jobs agendados:',
              cancelError.message
            );
          }
        } catch (queueError) {
          console.error(
            '[Webhook] ❌ Erro ao enfileirar job de revogação:',
            queueError.message
          );

          // Não falhar o webhook por erro na fila, apenas logar
          event.details = {
            ...event.details,
            revocationQueueError: queueError.message,
          };
        }
      } else {
        console.log(
          `[Webhook] ℹ️ Checkout já passou, não revogando PIN: ${checkOutAt?.toISOString()}`
        );
      }
    }

    // =====================================================================
    // PASSO 4: Log detalhado do evento
    // =====================================================================
    console.log(`[Webhook] ✅ Evento armazenado: ${event.id}`);
    console.log(`  Event Type: ${event.eventType}`);
    console.log(`  Reservation ID: ${event.payload.data.id}`);
    console.log(`  Guest: ${event.payload.data.guestName}`);
    console.log(`  Status: ${event.payload.data.status}`);
    console.log(`  Valid: ${event.isValid}`);
    console.log(
      `  Store Size: ${webhookEventStore.getSize()}/${webhookConfig.maxEventsInMemory}`
    );

    // =====================================================================
    // PASSO 6: Retornar resposta de sucesso
    // =====================================================================
    return res.status(202).json({
      success: true,
      eventId: event.id,
      timestamp: new Date().toISOString(),
      message: `Webhook received and stored: ${event.eventType}`,
    });
  } catch (error) {
    console.error('[Webhook] Erro ao processar webhook:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
      details:
        process.env.NODE_ENV === 'development'
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined,
    });
  }
});

/**
 * GET /api/webhooks/stays/reservation/events
 * 
 * Listar eventos armazenados (apenas para debug)
 */
router.get('/events', async (req, res) => {
  try {
    const eventType = req.query.type; // Filtrar por tipo
    const limit = Math.min(parseInt(req.query.limit || '50'), 100); // Máximo 100
    const offset = parseInt(req.query.offset || '0');

    let events = webhookEventStore.getAllEvents();

    // Filtrar por tipo
    if (eventType) {
      events = events.filter((e) => e.eventType === eventType);
    }

    // Aplicar paginação
    const total = events.length;
    const paginated = events
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())
      .slice(offset, offset + limit);

    const stats = webhookEventStore.getStats();

    return res.status(200).json({
      success: true,
      data: paginated,
      pagination: {
        total,
        offset,
        limit,
        pages: Math.ceil(total / limit),
      },
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Webhook] Erro ao listar eventos:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to list events',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/webhooks/stays/reservation/stats
 * 
 * Obter estatísticas de webhooks
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = webhookEventStore.getStats();

    return res.status(200).json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Webhook] Erro ao obter estatísticas:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to get statistics',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/webhooks/stays/reservation/events/:eventId
 * 
 * Obter evento específico
 */
router.get('/events/:eventId', async (req, res) => {
  try {
    const event = webhookEventStore.getEvent(req.params.eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found',
        eventId: req.params.eventId,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      data: event,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Webhook] Erro ao obter evento:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to get event',
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
