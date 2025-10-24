/**
 * PASSO 19 - Observability Event Loggers
 * 
 * Helpers para registrar eventos-chave de negócio
 * Integra com structured-logger.ts
 */

import { structuredLogger, logBusinessEvent, logJobError, logPinOperation } from './structured-logger';

/**
 * Registrar evento: Reserva upsertada
 */
export function logReservationUpserted(
  reservationId: string,
  status: 'confirmed' | 'pending' | 'cancelled',
  checkInAt: string,
  requestId?: string
): void {
  logBusinessEvent(
    'reservation_upserted',
    {
      reservationId,
      status,
      checkInAt,
      timestamp: new Date().toISOString(),
    },
    {
      requestId,
      reservationId,
      metadata: {
        event: 'reservation_upserted',
        status,
      },
    }
  );
}

/**
 * Registrar evento: PIN criado
 */
export function logPinCreated(
  reservationId: string,
  credentialId: string,
  validFrom: string,
  validTo: string,
  requestId?: string
): void {
  logPinOperation('created', reservationId, credentialId, {
    requestId,
    reservationId,
    credentialId,
    metadata: {
      validFrom,
      validTo,
      duration: new Date(validTo).getTime() - new Date(validFrom).getTime(),
    },
  });
}

/**
 * Registrar evento: PIN revogado
 */
export function logPinRevoked(
  reservationId: string,
  credentialId: string,
  revokedAt: string,
  requestId?: string
): void {
  logPinOperation('revoked', reservationId, credentialId, {
    requestId,
    reservationId,
    credentialId,
    metadata: {
      revokedAt,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Registrar evento: Job falhou
 */
export function logJobFailed(
  jobId: string,
  error: Error,
  retryCount: number,
  requestId?: string
): void {
  logJobError(jobId, error, retryCount, {
    requestId,
    jobId,
    metadata: {
      retryCount,
      failedAt: new Date().toISOString(),
    },
  });

  // Alertar se muitas falhas (DLQ > 5)
  if (retryCount > 5) {
    structuredLogger.warn(`Job exceeded max retries: ${jobId}`, {
      jobId,
      metadata: {
        retryCount,
      },
    });
  }
}

/**
 * Registrar evento: Reconciliação completada
 */
export function logReconciliationCompleted(
  created: number,
  updated: number,
  orphaned: number,
  duration: number,
  requestId?: string
): void {
  structuredLogger.info(
    `Reconciliation completed: ${created} created, ${updated} updated, ${orphaned} orphaned`,
    {
      requestId,
      duration,
      metadata: {
        event: 'reconciliation_completed',
        created,
        updated,
        orphaned,
        timestamp: new Date().toISOString(),
      },
    }
  );
}

/**
 * Registrar evento: Webhook recebido
 */
export function logWebhookReceived(
  provider: string, // 'stays', 'tuya', etc
  eventType: string,
  reservationId?: string,
  requestId?: string
): void {
  logBusinessEvent(
    'webhook_received',
    {
      provider,
      eventType,
      reservationId,
      receivedAt: new Date().toISOString(),
    },
    {
      requestId,
      reservationId,
      metadata: {
        provider,
        eventType,
      },
    }
  );
}

/**
 * Registrar evento: Sincronização completada
 */
export function logSyncCompleted(
  provider: string, // 'stays', 'accommodations', etc
  synced: number,
  failed: number,
  duration: number,
  requestId?: string
): void {
  structuredLogger.info(
    `Sync completed from ${provider}: ${synced} synced, ${failed} failed`,
    {
      requestId,
      duration,
      metadata: {
        event: 'sync_completed',
        provider,
        synced,
        failed,
        timestamp: new Date().toISOString(),
      },
    }
  );

  // Alertar se muitas falhas
  if (failed > 0) {
    structuredLogger.warn(
      `Sync had failures: ${provider} - ${failed} items failed`,
      {
        requestId,
        metadata: {
          provider,
          failed,
        },
      }
    );
  }
}

/**
 * Registrar evento: Erro de integração
 */
export function logIntegrationError(
  provider: string,
  endpoint: string,
  error: Error,
  requestId?: string
): void {
  structuredLogger.error(
    `Integration error: ${provider} - ${endpoint}`,
    error,
    {
      requestId,
      metadata: {
        provider,
        endpoint,
        errorCode: (error as any).code,
        timestamp: new Date().toISOString(),
      },
    }
  );
}

/**
 * Registrar evento: Performance warning
 */
export function logPerformanceWarning(
  operation: string,
  duration: number,
  threshold: number,
  requestId?: string
): void {
  structuredLogger.warn(
    `Performance warning: ${operation} took ${duration}ms (threshold: ${threshold}ms)`,
    {
      requestId,
      duration,
      metadata: {
        operation,
        threshold,
        exceeded: duration - threshold,
        timestamp: new Date().toISOString(),
      },
    }
  );
}

/**
 * Registrar evento: Security event
 */
export function logSecurityEvent(
  eventType: string, // 'failed_auth', 'unauthorized_access', etc
  userId?: string,
  details?: Record<string, any>,
  requestId?: string
): void {
  structuredLogger.warn(
    `Security event: ${eventType}`,
    {
      requestId,
      userId,
      metadata: {
        event: eventType,
        ...details,
        timestamp: new Date().toISOString(),
      },
    }
  );
}

/**
 * Registrar evento: Data compliance
 */
export function logComplianceEvent(
  eventType: string, // 'data_access', 'data_export', 'data_deletion', etc
  userId: string,
  details?: Record<string, any>,
  requestId?: string
): void {
  structuredLogger.info(
    `Compliance event: ${eventType} by user ${userId}`,
    {
      requestId,
      userId,
      metadata: {
        event: eventType,
        ...details,
        timestamp: new Date().toISOString(),
      },
    }
  );
}

export default {
  logReservationUpserted,
  logPinCreated,
  logPinRevoked,
  logJobFailed,
  logReconciliationCompleted,
  logWebhookReceived,
  logSyncCompleted,
  logIntegrationError,
  logPerformanceWarning,
  logSecurityEvent,
  logComplianceEvent,
};
