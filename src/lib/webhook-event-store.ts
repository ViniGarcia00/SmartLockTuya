/**
 * Gerenciador de eventos de webhook em memória
 * 
 * Armazena eventos recebidos em memória até o limite configurado
 * Com suporte a retenção temporal
 */

import { v4 as uuidv4 } from 'uuid';
import type { WebhookEvent, WebhookPayload, WebhookStats } from './webhook.types';

/**
 * Armazenamento em memória de eventos de webhook
 */
class WebhookEventStore {
  private events: Map<string, WebhookEvent> = new Map();
  private maxEvents: number = 1000;
  private retentionMinutes: number = 60;

  /**
   * Adicionar evento ao armazenamento
   */
  addEvent(
    payload: WebhookPayload,
    signature: string | undefined,
    isValid: boolean,
    ipAddress?: string,
    userAgent?: string
  ): WebhookEvent {
    const eventId = uuidv4();

    const event: WebhookEvent = {
      id: eventId,
      eventType: payload.event,
      payload,
      receivedAt: new Date(),
      signature,
      isValid,
      ipAddress,
      userAgent,
    };

    this.events.set(eventId, event);

    // Limpar eventos antigos
    this.cleanupOldEvents();

    // Se excedeu limite, remover evento mais antigo
    if (this.events.size > this.maxEvents) {
      const oldestEventId = Array.from(this.events.entries())
        .sort((a, b) => a[1].receivedAt.getTime() - b[1].receivedAt.getTime())
        [0][0];

      this.events.delete(oldestEventId);
      console.warn(
        `[Webhook] Event store size exceeded. Removed oldest event: ${oldestEventId}`
      );
    }

    console.log(
      `[Webhook] Event stored: ${eventId} (${payload.event}) - ${this.events.size}/${this.maxEvents}`
    );

    return event;
  }

  /**
   * Obter evento pelo ID
   */
  getEvent(eventId: string): WebhookEvent | undefined {
    return this.events.get(eventId);
  }

  /**
   * Obter todos os eventos
   */
  getAllEvents(): WebhookEvent[] {
    return Array.from(this.events.values());
  }

  /**
   * Obter eventos por tipo
   */
  getEventsByType(eventType: string): WebhookEvent[] {
    return Array.from(this.events.values()).filter(
      (event) => event.eventType === eventType
    );
  }

  /**
   * Obter eventos válidos
   */
  getValidEvents(): WebhookEvent[] {
    return Array.from(this.events.values()).filter((event) => event.isValid);
  }

  /**
   * Obter eventos de um período (últimas X horas)
   */
  getRecentEvents(hoursAgo: number = 1): WebhookEvent[] {
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    return Array.from(this.events.values()).filter(
      (event) => event.receivedAt >= cutoffTime
    );
  }

  /**
   * Limpar eventos expirados
   */
  private cleanupOldEvents(): void {
    const cutoffTime = new Date(
      Date.now() - this.retentionMinutes * 60 * 1000
    );

    for (const [eventId, event] of this.events.entries()) {
      if (event.receivedAt < cutoffTime) {
        this.events.delete(eventId);
      }
    }
  }

  /**
   * Obter estatísticas
   */
  getStats(): WebhookStats {
    const allEvents = Array.from(this.events.values());
    const validEvents = allEvents.filter((e) => e.isValid);

    const stats: WebhookStats = {
      totalReceived: allEvents.length,
      totalValid: validEvents.length,
      totalInvalid: allEvents.length - validEvents.length,
      byEventType: {
        'reservation.created': 0,
        'reservation.updated': 0,
        'reservation.cancelled': 0,
      },
      lastEventAt: allEvents.length > 0 ? allEvents[0].receivedAt : undefined,
    };

    for (const event of allEvents) {
      stats.byEventType[event.eventType]++;
    }

    return stats;
  }

  /**
   * Limpar todo o armazenamento
   */
  clear(): void {
    this.events.clear();
    console.log('[Webhook] Event store cleared');
  }

  /**
   * Configurar tamanho máximo
   */
  setMaxEvents(max: number): void {
    this.maxEvents = max;
  }

  /**
   * Configurar retenção em minutos
   */
  setRetentionMinutes(minutes: number): void {
    this.retentionMinutes = minutes;
  }

  /**
   * Obter tamanho atual
   */
  getSize(): number {
    return this.events.size;
  }
}

// Instância global (singleton)
export const webhookEventStore = new WebhookEventStore();
