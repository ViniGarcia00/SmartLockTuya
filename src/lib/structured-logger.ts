/**
 * PASSO 19 - Observabilidade: Structured Logger (Winston)
 * 
 * Sistema de logging estruturado com Winston
 * Logs em formato JSON para análise e monitoramento
 * 
 * Features:
 * - Timestamps ISO 8601
 * - RequestID para rastreabilidade
 * - ReservationID/BookingID para auditoria
 * - JobID para jobs BullMQ
 * - Stack traces para erros
 * - Duração de operações
 * - Alertas automáticos (DLQ, latência)
 */

import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

/**
 * Log levels com prioridades
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Contexto de log estruturado
 */
export interface LogContext {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  reservationId?: string;
  bookingId?: string;
  jobId?: string;
  userId?: string;
  accommodationId?: string;
  credentialId?: string;
  duration?: number; // milliseconds
  stackTrace?: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    code?: string;
  };
}

/**
 * Eventos de observabilidade
 */
export interface ObservabilityEvent {
  eventType: string;
  timestamp: string;
  requestId?: string;
  reservationId?: string;
  bookingId?: string;
  jobId?: string;
  data: Record<string, any>;
  duration?: number;
}

/**
 * Winston Logger Configuration
 */
class StructuredLogger {
  private logger: winston.Logger;
  private eventHistory: ObservabilityEvent[] = [];
  private readonly MAX_EVENTS = 1000; // Manter últimos 1000 eventos

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'smartlock-tuya' },
      transports: this.getTransports(),
    });
  }

  /**
   * Configurar transportes Winston
   */
  private getTransports(): winston.transport[] {
    const transports: winston.transport[] = [];

    // Console em desenvolvimento
    if (process.env.NODE_ENV !== 'production') {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              return `${timestamp} [${level}]: ${message} ${
                Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
              }`;
            })
          ),
        })
      );
    }

    // Arquivo de logs geral
    transports.push(
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 10485760, // 10MB
        maxFiles: 10,
      })
    );

    // Arquivo apenas erros
    transports.push(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 10485760,
        maxFiles: 5,
      })
    );

    // Arquivo apenas alertas críticos
    transports.push(
      new winston.transports.File({
        filename: 'logs/critical.log',
        level: 'warn',
        maxsize: 5242880, // 5MB
        maxFiles: 3,
      })
    );

    return transports;
  }

  /**
   * Log Debug
   */
  debug(message: string, context?: Partial<LogContext>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log Info
   */
  info(message: string, context?: Partial<LogContext>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log Warning
   */
  warn(message: string, context?: Partial<LogContext>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log Error
   */
  error(message: string, error?: Error, context?: Partial<LogContext>): void {
    const logContext: Partial<LogContext> = {
      ...context,
      error: error
        ? {
            name: error.name,
            message: error.message,
            code: (error as any).code,
          }
        : undefined,
      stackTrace: error?.stack,
    };
    this.log(LogLevel.ERROR, message, logContext);
  }

  /**
   * Log Critical
   */
  critical(message: string, error?: Error, context?: Partial<LogContext>): void {
    const logContext: Partial<LogContext> = {
      ...context,
      error: error
        ? {
            name: error.name,
            message: error.message,
            code: (error as any).code,
          }
        : undefined,
      stackTrace: error?.stack,
    };
    this.log(LogLevel.CRITICAL, message, logContext);
  }

  /**
   * Log operação com duração
   */
  logOperation(
    message: string,
    duration: number,
    context?: Partial<LogContext>
  ): void {
    this.info(message, {
      ...context,
      duration,
    });

    // Alertar se latência > 5s
    if (duration > 5000) {
      this.warn(`High latency detected: ${duration}ms`, {
        ...context,
        duration,
      });
    }
  }

  /**
   * Core logging function
   */
  private log(level: LogLevel, message: string, context?: Partial<LogContext>): void {
    const timestamp = new Date().toISOString();
    const requestId = context?.requestId || uuidv4();

    const logEntry: LogContext = {
      timestamp,
      level,
      message,
      requestId,
      ...context,
    };

    this.logger.log(level, message, logEntry);

    // Guardar para histórico de eventos
    this.recordEvent(logEntry);
  }

  /**
   * Registrar evento observabilidade
   */
  recordEvent(logEntry: LogContext): void {
    const event: ObservabilityEvent = {
      eventType: this.extractEventType(logEntry.message),
      timestamp: logEntry.timestamp,
      requestId: logEntry.requestId,
      reservationId: logEntry.reservationId,
      bookingId: logEntry.bookingId,
      jobId: logEntry.jobId,
      duration: logEntry.duration,
      data: {
        message: logEntry.message,
        level: logEntry.level,
        metadata: logEntry.metadata,
        error: logEntry.error,
      },
    };

    this.eventHistory.push(event);

    // Manter apenas últimos eventos
    if (this.eventHistory.length > this.MAX_EVENTS) {
      this.eventHistory = this.eventHistory.slice(-this.MAX_EVENTS);
    }
  }

  /**
   * Extrair tipo de evento da mensagem
   */
  private extractEventType(message: string): string {
    const patterns: Record<string, string> = {
      'pin.*created': 'pin_created',
      'pin.*revoked': 'pin_revoked',
      'reservation.*upserted': 'reservation_upserted',
      'job.*failed': 'job_failed',
      'reconciliation.*completed': 'reconciliation_completed',
      'sync.*completed': 'sync_completed',
      'webhook.*received': 'webhook_received',
    };

    for (const [pattern, eventType] of Object.entries(patterns)) {
      if (new RegExp(pattern, 'i').test(message)) {
        return eventType;
      }
    }

    return 'other';
  }

  /**
   * Obter histórico de eventos
   */
  getEventHistory(limit: number = 50): ObservabilityEvent[] {
    return this.eventHistory.slice(-limit);
  }

  /**
   * Limpar histórico
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Gerar estatísticas dos eventos
   */
  getEventStats(): {
    totalEvents: number;
    eventTypes: Record<string, number>;
    recentEvents: ObservabilityEvent[];
    successRate: number;
  } {
    const last24h = this.eventHistory.filter(
      (e) =>
        new Date(e.timestamp).getTime() >
        Date.now() - 24 * 60 * 60 * 1000
    );

    const eventTypes: Record<string, number> = {};
    const errors = last24h.filter((e) => e.data.level === 'error');

    for (const event of last24h) {
      eventTypes[event.eventType] =
        (eventTypes[event.eventType] || 0) + 1;
    }

    const successRate =
      last24h.length > 0
        ? ((last24h.length - errors.length) / last24h.length) * 100
        : 100;

    return {
      totalEvents: this.eventHistory.length,
      eventTypes,
      recentEvents: this.eventHistory.slice(-50),
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  /**
   * Checklist de alertas
   */
  checkAlerts(): {
    dlqAlert: boolean;
    latencyAlert: boolean;
    errorAlert: boolean;
  } {
    const lastEvents = this.eventHistory.slice(-100);
    const dlqErrors = lastEvents.filter(
      (e) =>
        e.data.level === 'error' &&
        (e.eventType === 'job_failed' || e.data.error)
    );

    const highLatency = lastEvents.filter((e) => (e.duration || 0) > 5000);

    return {
      dlqAlert: dlqErrors.length > 5, // DLQ > 5
      latencyAlert: highLatency.length > 10, // Mais de 10 operações lentas
      errorAlert: dlqErrors.length > 0,
    };
  }
}

/**
 * Instância singleton
 */
export const structuredLogger = new StructuredLogger();

/**
 * Middleware Express para adicionar requestId
 */
export function requestIdMiddleware(req: any, res: any, next: any): void {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', req.requestId);
  next();
}

/**
 * Middleware Express para logging de requisições
 */
export function requestLoggingMiddleware(req: any, res: any, next: any): void {
  const start = Date.now();

  // Interceptar response para logar ao final
  const originalJson = res.json;
  res.json = function (data: any) {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    structuredLogger.info(
      `${req.method} ${req.path} - ${statusCode}`,
      {
        requestId: req.requestId,
        duration,
        metadata: {
          method: req.method,
          path: req.path,
          statusCode,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      }
    );

    return originalJson.call(this, data);
  };

  next();
}

/**
 * Helper para logar eventos de negócio
 */
export function logBusinessEvent(
  eventType: string,
  data: Record<string, any>,
  context?: Partial<LogContext>
): void {
  const message = `${eventType}: ${JSON.stringify(data).substring(0, 100)}`;

  structuredLogger.info(message, {
    ...context,
    metadata: data,
  });
}

/**
 * Helper para logar erros de job
 */
export function logJobError(
  jobId: string,
  error: Error,
  retryCount: number,
  context?: Partial<LogContext>
): void {
  structuredLogger.error(`Job failed: ${jobId}`, error, {
    ...context,
    jobId,
    metadata: {
      retryCount,
      timestamp: new Date().toISOString(),
    },
  });

  // Alertar se muitas tentativas
  if (retryCount > 3) {
    structuredLogger.warn(
      `Job retry threshold exceeded: ${jobId}`,
      {
        jobId,
        metadata: { retryCount },
      }
    );
  }
}

/**
 * Helper para logar operação de PIN
 */
export function logPinOperation(
  operation: 'created' | 'revoked' | 'validated',
  reservationId: string,
  credentialId: string,
  context?: Partial<LogContext>
): void {
  structuredLogger.info(`PIN ${operation}: ${credentialId}`, {
    ...context,
    reservationId,
    credentialId,
    metadata: {
      operation,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Helper para logar reconciliação
 */
export function logReconciliation(
  created: number,
  updated: number,
  orphaned: number,
  duration: number,
  context?: Partial<LogContext>
): void {
  structuredLogger.info(
    `Reconciliation completed: ${created} created, ${updated} updated, ${orphaned} orphaned`,
    {
      ...context,
      duration,
      metadata: {
        created,
        updated,
        orphaned,
      },
    }
  );
}

export default structuredLogger;
