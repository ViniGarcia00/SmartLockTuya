/**
 * PASSO 18 - Segurança: Helmet Middleware
 * Security headers configuration for Express.js
 *
 * Implementa headers HTTP de segurança conforme recomendações OWASP:
 * - Content-Security-Policy (CSP): Previne XSS
 * - X-Frame-Options: Previne clickjacking
 * - X-Content-Type-Options: Previne MIME sniffing
 * - Strict-Transport-Security: Força HTTPS
 * - X-XSS-Protection: Proteção adicional contra XSS
 * - Referrer-Policy: Controla informações de referência
 */

import { Request, Response, NextFunction } from 'express';
import { SecureLogger } from '../../../lib/logger';

/**
 * Security headers configuration
 */
export interface SecurityHeadersConfig {
  enableCSP?: boolean;
  enableHSTS?: boolean;
  enableXFrameOptions?: boolean;
  enableXContentTypeOptions?: boolean;
  enableXXSSProtection?: boolean;
  enableReferrerPolicy?: boolean;
  csrfProtection?: boolean;
  trustProxy?: boolean;
  cspDirectives?: Record<string, string[]>;
  hstsMaxAge?: number;
  hstsIncludeSubdomains?: boolean;
  hstsPreload?: boolean;
}

/**
 * Default security headers configuration
 */
const DEFAULT_CONFIG: SecurityHeadersConfig = {
  enableCSP: true,
  enableHSTS: true,
  enableXFrameOptions: true,
  enableXContentTypeOptions: true,
  enableXXSSProtection: true,
  enableReferrerPolicy: true,
  csrfProtection: true,
  trustProxy: true,
  hstsMaxAge: 31536000, // 1 year in seconds
  hstsIncludeSubdomains: true,
  hstsPreload: true,
  cspDirectives: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'", 'data:', 'https:'],
    'connect-src': ["'self'", 'https:'],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  },
};

/**
 * Helmet middleware factory
 * Aplica headers de segurança recomendados pelo OWASP
 *
 * @param config - Configuração personalizada dos headers
 * @returns Express middleware function
 *
 * @example
 * app.use(helmetMiddleware());
 * // Com configuração customizada
 * app.use(helmetMiddleware({
 *   enableCSP: true,
 *   hstsMaxAge: 31536000,
 * }));
 */
export const helmetMiddleware = (config: SecurityHeadersConfig = DEFAULT_CONFIG) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const finalConfig = { ...DEFAULT_CONFIG, ...config };
      const requestId = (req as any).requestId || 'unknown';

      // Content-Security-Policy
      if (finalConfig.enableCSP && finalConfig.cspDirectives) {
        const cspDirectivesArray: string[] = [];
        for (const [key, values] of Object.entries(finalConfig.cspDirectives)) {
          cspDirectivesArray.push(`${key} ${values.join(' ')}`);
        }
        res.setHeader('Content-Security-Policy', cspDirectivesArray.join('; '));
      }

      // Strict-Transport-Security (HSTS)
      if (finalConfig.enableHSTS) {
        let hstsValue = `max-age=${finalConfig.hstsMaxAge || 31536000}`;
        if (finalConfig.hstsIncludeSubdomains !== false) {
          hstsValue += '; includeSubDomains';
        }
        if (finalConfig.hstsPreload) {
          hstsValue += '; preload';
        }
        res.setHeader('Strict-Transport-Security', hstsValue);
      }

      // X-Frame-Options (Clickjacking protection)
      if (finalConfig.enableXFrameOptions) {
        res.setHeader('X-Frame-Options', 'DENY');
      }

      // X-Content-Type-Options (MIME sniffing prevention)
      if (finalConfig.enableXContentTypeOptions) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      }

      // X-XSS-Protection
      if (finalConfig.enableXXSSProtection) {
        res.setHeader('X-XSS-Protection', '1; mode=block');
      }

      // Referrer-Policy
      if (finalConfig.enableReferrerPolicy) {
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      }

      // Permissions-Policy (Feature-Policy)
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

      // Remove X-Powered-By header
      res.removeHeader('X-Powered-By');

      // Add security timestamp header
      res.setHeader('X-Secure-Timestamp', new Date().toISOString());

      // Log security headers applied
      SecureLogger.debug(
        requestId,
        'Security headers applied',
        {
          csp: finalConfig.enableCSP,
          hsts: finalConfig.enableHSTS,
          xFrameOptions: finalConfig.enableXFrameOptions,
          xContentTypeOptions: finalConfig.enableXContentTypeOptions,
          xXSSProtection: finalConfig.enableXXSSProtection,
          referrerPolicy: finalConfig.enableReferrerPolicy,
        }
      );

      next();
    } catch (error) {
      SecureLogger.error(
        (req as any).requestId || 'unknown',
        'Error applying security headers',
        error as Error
      );
      next();
    }
  };
};

/**
 * CSRF Protection middleware
 * Valida tokens CSRF em requisições state-changing
 *
 * @returns Express middleware function
 */
export const csrfProtectionMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = (req as any).requestId || 'unknown';

    // Skip CSRF check para métodos safe (GET, HEAD, OPTIONS)
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // Em MOCK mode, pular validação CSRF
    if (process.env.MOCK_STAYS_API === 'true') {
      SecureLogger.debug(requestId, 'CSRF check skipped in MOCK mode', {});
      return next();
    }

    // Validar X-CSRF-Token header
    const csrfToken = req.headers['x-csrf-token'] as string;
    const sessionCsrfToken = (req as any).session?.csrfToken;

    if (!csrfToken || csrfToken !== sessionCsrfToken) {
      SecureLogger.warn(
        requestId,
        'CSRF token validation failed',
        {
          method: req.method,
          path: req.path,
          provided: !!csrfToken,
          match: csrfToken === sessionCsrfToken,
        }
      );

      return res.status(403).json({
        success: false,
        error: 'CSRF token validation failed',
        code: 'CSRF_INVALID',
      });
    }

    SecureLogger.debug(
      requestId,
      'CSRF token validation passed',
      { method: req.method, path: req.path }
    );

    next();
  };
};

/**
 * Rate limiting middleware simples
 * Implementação básica de rate limiting por IP
 *
 * @param windowMs - Janela de tempo em millisegundos
 * @param maxRequests - Máximo de requisições por janela
 * @returns Express middleware function
 *
 * @example
 * app.use(rateLimitMiddleware(900000, 100)); // 100 requests per 15 minutes
 */
interface RateLimitStore {
  [ip: string]: { count: number; resetTime: number };
}

const rateLimitStore: RateLimitStore = {};

export const rateLimitMiddleware = (windowMs: number = 900000, maxRequests: number = 100) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = (req as any).requestId || 'unknown';
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    // Inicializar ou resetar contador se janela expirou
    if (!rateLimitStore[ip] || now > rateLimitStore[ip].resetTime) {
      rateLimitStore[ip] = {
        count: 1,
        resetTime: now + windowMs,
      };
      return next();
    }

    // Incrementar contador
    rateLimitStore[ip].count++;

    // Verificar limite
    if (rateLimitStore[ip].count > maxRequests) {
      SecureLogger.warn(
        requestId,
        'Rate limit exceeded',
        {
          ip,
          count: rateLimitStore[ip].count,
          maxRequests,
          windowMs,
        }
      );

      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('Retry-After', Math.ceil((rateLimitStore[ip].resetTime - now) / 1000).toString());

      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((rateLimitStore[ip].resetTime - now) / 1000),
      });
    }

    // Adicionar headers de rate limit
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - rateLimitStore[ip].count).toString());
    res.setHeader('X-RateLimit-Reset', rateLimitStore[ip].resetTime.toString());

    next();
  };
};

/**
 * Middleware para limpar dados sensíveis de erros
 * Previne vazamento de informações técnicas
 */
export const sanitizeErrorMiddleware = () => {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    const requestId = (req as any).requestId || 'unknown';

    // Em produção, não expor detalhes técnicos
    const isProduction = process.env.NODE_ENV === 'production';

    SecureLogger.error(
      requestId,
      'Uncaught error in middleware',
      err,
      {
        path: req.path,
        method: req.method,
        ip: req.ip,
      }
    );

    const statusCode = err.statusCode || err.status || 500;
    const message = isProduction ? 'Internal Server Error' : err.message;

    res.status(statusCode).json({
      success: false,
      error: message,
      code: err.code || 'INTERNAL_ERROR',
      ...(isProduction === false && { details: err.stack }),
    });
  };
};

/**
 * Export all middleware as default object
 */
export default {
  helmetMiddleware,
  csrfProtectionMiddleware,
  rateLimitMiddleware,
  sanitizeErrorMiddleware,
};
