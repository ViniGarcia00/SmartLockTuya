/**
 * Tipos e interfaces para webhooks de reservas Stays
 * 
 * Suporta eventos:
 * - reservation.created
 * - reservation.updated
 * - reservation.cancelled
 */

/**
 * Tipos de eventos de webhook
 */
export type WebhookEventType =
  | 'reservation.created'
  | 'reservation.updated'
  | 'reservation.cancelled';

/**
 * Status da reserva
 */
export type ReservationStatus =
  | 'confirmed'
  | 'pending'
  | 'cancelled'
  | 'completed'
  | 'no-show';

/**
 * Dados de uma reserva dentro do webhook
 */
export interface WebhookReservation {
  id: string;
  accommodationId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkInDate: string; // ISO 8601
  checkOutDate: string; // ISO 8601
  status: ReservationStatus;
  numberOfGuests: number;
  totalPrice: number;
  currency: string;
  notes?: string;
  lockCode?: string;
  externalId?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * Payload completo do webhook
 */
export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string; // ISO 8601
  data: WebhookReservation;
  metadata?: {
    source?: string;
    userId?: string;
    [key: string]: any;
  };
}

/**
 * Evento de webhook armazenado em memória
 */
export interface WebhookEvent {
  id: string; // UUID gerado pelo servidor
  eventType: WebhookEventType;
  payload: WebhookPayload;
  receivedAt: Date;
  signature?: string; // Assinatura HMAC recebida
  isValid: boolean; // Se a assinatura foi validada
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Resposta padrão para webhook
 */
export interface WebhookResponse {
  success: boolean;
  eventId: string;
  message?: string;
  timestamp: string;
}

/**
 * Erro ao processar webhook
 */
export interface WebhookError extends WebhookResponse {
  success: false;
  error: string;
  code: 
    | 'INVALID_SIGNATURE'
    | 'INVALID_PAYLOAD'
    | 'MISSING_EVENT_TYPE'
    | 'MISSING_DATA'
    | 'INVALID_DATA'
    | 'INTERNAL_ERROR';
  details?: string;
}

/**
 * Resultado da validação de assinatura
 */
export interface ValidationResult {
  isValid: boolean;
  reason?: string; // Motivo da falha, se houver
}

/**
 * Configuração de webhook
 */
export interface WebhookConfig {
  enabled: boolean;
  secret: string; // WEBHOOK_SECRET da env
  mockMode: boolean; // Se deve usar mock (aceitar sem validar)
  maxEventsInMemory: number; // Máximo de eventos armazenados
  retentionMinutes: number; // Minutos para manter eventos em memória
}

/**
 * Estatísticas de webhooks
 */
export interface WebhookStats {
  totalReceived: number;
  totalValid: number;
  totalInvalid: number;
  byEventType: Record<WebhookEventType, number>;
  lastEventAt?: Date;
}
