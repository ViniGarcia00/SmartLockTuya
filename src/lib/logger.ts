/**
 * Sistema de Logging Seguro
 * 
 * Conformidade:
 * - NUNCA loga PIN em plaintext
 * - NUNCA loga dados sensíveis (emails, nomes, tokens)
 * - Adiciona requestId para rastreabilidade
 * - Adiciona bookingId/reservationId para auditoria
 * - Remove headers Authorization/credentials
 */

import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { redact, sanitize } from './encryption';

// ============================================================================
// TYPES
// ============================================================================

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export interface LogContext {
  requestId: string;
  reservationId?: string;
  bookingId?: string;
  userId?: string;
  accommodationId?: string;
  lockId?: string;
  timestamp: string;
  level: LogLevel;
}

export interface LogEntry {
  context: LogContext;
  message: string;
  data?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// ============================================================================
// SENSITIVE FIELDS
// ============================================================================

/** Campos que NUNCA devem ser loggados */
const SENSITIVE_FIELDS = [
  'pin',
  'pinHash',
  'password',
  'email',
  'guestEmail',
  'guestName',
  'token',
  'accessToken',
  'refreshToken',
  'authToken',
  'authorization',
  'bearerToken',
  'apiKey',
  'secret',
  'apiSecret',
  'clientSecret',
  'sessionToken',
  'creditCard',
  'ssn',
];

/** Headers que NUNCA devem ser loggados */
const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'x-api-key',
  'x-auth-token',
  'x-access-token',
];

// ============================================================================
// LOGGER CLASS
// ============================================================================

export class SecureLogger {
  private static requestIdMap = new Map<string, string>();
  private static readonly MAX_MAP_SIZE = 10000; // Evitar memory leak

  /**
   * Gerar ou recuperar requestId
   */
  static getRequestId(key?: string): string {
    if (key && this.requestIdMap.has(key)) {
      return this.requestIdMap.get(key)!;
    }

    const requestId = uuidv4();

    if (key) {
      // Implementar LRU para evitar memory leak
      if (this.requestIdMap.size > this.MAX_MAP_SIZE) {
        const firstKey = this.requestIdMap.keys().next().value as string | undefined;
        if (firstKey) {
          this.requestIdMap.delete(firstKey);
        }
      }
      this.requestIdMap.set(key, requestId);
    }

    return requestId;
  }

  /**
   * Extrair dados seguros de request
   */
  static extractRequestInfo(req: Request): {
    requestId: string;
    method: string;
    path: string;
    ip: string;
  } {
    const requestId = SecureLogger.getRequestId(req.url);

    return {
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip || 'UNKNOWN',
    };
  }

  /**
   * Remover dados sensíveis de objeto
   */
  private static sanitizeData(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item));
    }

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();

      // Se é campo sensível, redact
      if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field))) {
        if (typeof value === 'string' && value.length > 0) {
          sanitized[key] = this.maskValue(value);
        } else {
          sanitized[key] = '[REDACTED]';
        }
        continue;
      }

      // Se é um objeto aninhado, sanitizar recursivamente
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Mascarar valor sensível
   */
  private static maskValue(value: string): string {
    if (value.length <= 4) {
      return '*'.repeat(value.length);
    }
    return redact(value, 2);
  }

  /**
   * Remover headers sensíveis
   */
  private static sanitizeHeaders(headers: any): any {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(headers)) {
      if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Criar contexto de log
   */
  private static createContext(
    requestId: string,
    level: LogLevel,
    options?: {
      reservationId?: string;
      bookingId?: string;
      userId?: string;
      accommodationId?: string;
      lockId?: string;
    }
  ): LogContext {
    return {
      requestId,
      timestamp: new Date().toISOString(),
      level,
      ...options,
    };
  }

  /**
   * Log DEBUG
   */
  static debug(
    requestId: string,
    message: string,
    data?: any,
    context?: Omit<LogContext, 'requestId' | 'timestamp' | 'level'>
  ) {
    const ctx = this.createContext(requestId, LogLevel.DEBUG, context);
    const entry: LogEntry = {
      context: ctx,
      message,
      data: data ? this.sanitizeData(data) : undefined,
    };

    console.debug(JSON.stringify(entry));
  }

  /**
   * Log INFO
   */
  static info(
    requestId: string,
    message: string,
    data?: any,
    context?: Omit<LogContext, 'requestId' | 'timestamp' | 'level'>
  ) {
    const ctx = this.createContext(requestId, LogLevel.INFO, context);
    const entry: LogEntry = {
      context: ctx,
      message,
      data: data ? this.sanitizeData(data) : undefined,
    };

    console.info(JSON.stringify(entry));
  }

  /**
   * Log WARN
   */
  static warn(
    requestId: string,
    message: string,
    data?: any,
    context?: Omit<LogContext, 'requestId' | 'timestamp' | 'level'>
  ) {
    const ctx = this.createContext(requestId, LogLevel.WARN, context);
    const entry: LogEntry = {
      context: ctx,
      message,
      data: data ? this.sanitizeData(data) : undefined,
    };

    console.warn(JSON.stringify(entry));
  }

  /**
   * Log ERROR
   */
  static error(
    requestId: string,
    message: string,
    error?: Error,
    data?: any,
    context?: Omit<LogContext, 'requestId' | 'timestamp' | 'level'>
  ) {
    const ctx = this.createContext(requestId, LogLevel.ERROR, context);
    const entry: LogEntry = {
      context: ctx,
      message,
      data: data ? this.sanitizeData(data) : undefined,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    };

    console.error(JSON.stringify(entry));
  }

  /**
   * Log CRITICAL (e.g., breach attempt)
   */
  static critical(
    requestId: string,
    message: string,
    error?: Error,
    data?: any,
    context?: Omit<LogContext, 'requestId' | 'timestamp' | 'level'>
  ) {
    const ctx = this.createContext(requestId, LogLevel.CRITICAL, context);
    const entry: LogEntry = {
      context: ctx,
      message,
      data: data ? this.sanitizeData(data) : undefined,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    };

    console.error(JSON.stringify(entry)); // Critical logs também em stderr
  }

  /**
   * Log de operação com sucesso
   * Exemplo: "PIN gerado {requestId} reservationId={id}"
   */
  static logOperation(
    requestId: string,
    operation: string,
    status: 'SUCCESS' | 'FAILURE',
    context?: Omit<LogContext, 'requestId' | 'timestamp' | 'level'>,
    data?: any
  ) {
    const message = `Operation: ${operation} [${status}]`;
    const level = status === 'SUCCESS' ? LogLevel.INFO : LogLevel.WARN;
    const ctx = this.createContext(requestId, level, context);

    const entry: LogEntry = {
      context: ctx,
      message,
      data: data ? this.sanitizeData(data) : undefined,
    };

    if (status === 'SUCCESS') {
      console.info(JSON.stringify(entry));
    } else {
      console.warn(JSON.stringify(entry));
    }
  }

  /**
   * Log de request HTTP
   */
  static logRequest(req: Request, additional?: any) {
    const info = this.extractRequestInfo(req);
    const sanitizedHeaders = this.sanitizeHeaders(req.headers);

    const data = {
      method: info.method,
      path: info.path,
      ip: info.ip,
      headers: sanitizedHeaders,
      body: req.body ? this.sanitizeData(req.body) : undefined,
      query: req.query ? this.sanitizeData(req.query) : undefined,
      ...additional,
    };

    this.info(info.requestId, 'HTTP Request', data);
  }

  /**
   * Log de response HTTP
   */
  static logResponse(
    requestId: string,
    statusCode: number,
    message?: string,
    data?: any,
    context?: Omit<LogContext, 'requestId' | 'timestamp' | 'level'>
  ) {
    const level = statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    const ctx = this.createContext(requestId, level, context);

    const entry: LogEntry = {
      context: ctx,
      message: message || `HTTP ${statusCode}`,
      data: data ? this.sanitizeData(data) : { statusCode },
    };

    if (level === LogLevel.WARN) {
      console.warn(JSON.stringify(entry));
    } else {
      console.info(JSON.stringify(entry));
    }
  }
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Middleware para adicionar requestId a todos os requests
 */
export function requestIdMiddleware(req: Request, res: any, next: any) {
  const requestId = SecureLogger.getRequestId(`${Date.now()}-${Math.random()}`);
  (req as any).requestId = requestId;
  (req as any).logger = {
    debug: (msg: string, data?: any, ctx?: any) => SecureLogger.debug(requestId, msg, data, ctx),
    info: (msg: string, data?: any, ctx?: any) => SecureLogger.info(requestId, msg, data, ctx),
    warn: (msg: string, data?: any, ctx?: any) => SecureLogger.warn(requestId, msg, data, ctx),
    error: (msg: string, err?: Error, data?: any, ctx?: any) =>
      SecureLogger.error(requestId, msg, err, data, ctx),
  };

  next();
}

// ============================================================================
// EXPORT SUMMARY
// ============================================================================

export const LOGGER_SUMMARY = {
  features: [
    'Nunca loga PIN em plaintext',
    'Nunca loga dados sensíveis (emails, nomes, tokens)',
    'Adiciona requestId em todo log',
    'Adiciona bookingId/reservationId para rastreabilidade',
    'Remove headers Authorization/credentials',
    'Sanitiza recursivamente objetos aninhados',
  ],
  sensitiveFields: SENSITIVE_FIELDS,
  sensitiveHeaders: SENSITIVE_HEADERS,
} as const;
