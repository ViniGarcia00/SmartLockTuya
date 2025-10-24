/**
 * Middleware de Autenticação para Admin
 * 
 * Responsabilidades:
 * - Validar autenticação em rotas /admin/*
 * - Retornar 401 se não autenticado
 * - Em MOCK mode: permitir sem validar (para testes)
 * - Log de tentativas não autorizadas
 */

import { Request, Response, NextFunction } from 'express';
import { SecureLogger } from '../../../lib/logger';
import jwt from 'jsonwebtoken';

// ============================================================================
// TYPES
// ============================================================================

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'admin' | 'user';
    iat: number;
    exp: number;
  };
  requestId: string;
  logger: any;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Rotas públicas que não requerem autenticação */
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/webhooks/stays', // Webhook não precisa de auth
  '/health',
  '/metrics',
];

/** Rotas admin que requerem autenticação */
const ADMIN_ROUTES = ['/admin', '/api/admin'];

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Middleware de autenticação
 * 
 * Valida:
 * 1. Token JWT no header Authorization
 * 2. Token não expirado
 * 3. Token válido (não foi alterado)
 * 
 * Em MOCK mode: passa sem validar (para testes)
 */
export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const requestId = req.requestId || SecureLogger.getRequestId();
  const isMockMode = process.env.MOCK_STAYS_API === 'true';

  try {
    // Verificar se é rota pública
    if (isPublicRoute(req.path)) {
      return next();
    }

    // Em MOCK mode, permitir sem validar
    if (isMockMode) {
      req.user = {
        id: 'mock-user-id',
        email: 'mock@example.com',
        role: 'admin',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
      };
      SecureLogger.debug(requestId, 'MOCK MODE: Authentication bypassed');
      return next();
    }

    // Extrair token do header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      SecureLogger.warn(requestId, 'Authentication failed: No token provided', {
        path: req.path,
        method: req.method,
      });
      return void res.status(401).json({
        success: false,
        error: 'No authentication token provided',
        code: 'MISSING_TOKEN',
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer "

    // Verificar token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    jwt.verify(token, secret, (err: any, decoded: any) => {
      if (err) {
        SecureLogger.warn(requestId, 'Authentication failed: Invalid token', {
          path: req.path,
          method: req.method,
          error: err.message,
        });
        return void res.status(401).json({
          success: false,
          error: 'Invalid or expired token',
          code: 'INVALID_TOKEN',
        });
      }

      // Validar payload
      if (!decoded || !decoded.id) {
        SecureLogger.warn(requestId, 'Authentication failed: Invalid token payload', {
          path: req.path,
          method: req.method,
        });
        return void res.status(401).json({
          success: false,
          error: 'Invalid token payload',
          code: 'INVALID_PAYLOAD',
        });
      }

      // Anexar user ao request
      req.user = decoded;

      // Log de sucesso
      SecureLogger.debug(requestId, 'Authentication successful', {
        userId: decoded.id,
        role: decoded.role,
      });

      next();
    });
  } catch (error) {
    SecureLogger.error(requestId, 'Authentication error', error as Error, {
      path: req.path,
      method: req.method,
    });

    res.status(500).json({
      success: false,
      error: 'Authentication error',
      code: 'AUTH_ERROR',
    });
  }
}

/**
 * Middleware para validar role admin
 */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  const requestId = req.requestId || SecureLogger.getRequestId();

  if (!req.user) {
    SecureLogger.warn(requestId, 'Admin access denied: No user', {
      path: req.path,
      method: req.method,
    });
    return void res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'MISSING_AUTH',
    });
  }

  if (req.user.role !== 'admin') {
    SecureLogger.warn(requestId, 'Admin access denied: Insufficient permissions', {
      path: req.path,
      method: req.method,
      userId: req.user.id,
      role: req.user.role,
    });
    return void res.status(403).json({
      success: false,
      error: 'Admin access required',
      code: 'INSUFFICIENT_PERMISSIONS',
    });
  }

  SecureLogger.debug(requestId, 'Admin access granted', {
    userId: req.user.id,
  });

  next();
}

/**
 * Middleware para validar se é admin ou proprietário
 */
export function requireAdminOrOwner(req: AuthRequest, res: Response, next: NextFunction): void {
  const requestId = req.requestId || SecureLogger.getRequestId();

  if (!req.user) {
    SecureLogger.warn(requestId, 'Access denied: No user', {
      path: req.path,
      method: req.method,
    });
    return void res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'MISSING_AUTH',
    });
  }

  const userId = (req.query.userId || req.body?.userId || req.params.userId) as string;

  if (req.user.role === 'admin' || req.user.id === userId) {
    SecureLogger.debug(requestId, 'Access granted (admin or owner)', {
      userId: req.user.id,
      role: req.user.role,
      targetUserId: userId,
    });
    return next();
  }

  SecureLogger.warn(requestId, 'Access denied: Not admin or owner', {
    path: req.path,
    method: req.method,
    userId: req.user.id,
    role: req.user.role,
    targetUserId: userId,
  });

  res.status(403).json({
    success: false,
    error: 'Access denied',
    code: 'FORBIDDEN',
  });
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Verificar se rota é pública
 */
function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some((route) => path.startsWith(route));
}

/**
 * Verificar se é rota admin
 */
export function isAdminRoute(path: string): boolean {
  return ADMIN_ROUTES.some((route) => path.startsWith(route));
}

/**
 * Gerar token JWT
 */
export function generateToken(userId: string, email: string, role: 'admin' | 'user' = 'user'): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

  return jwt.sign(
    {
      id: userId,
      email,
      role,
    },
    secret as string,
    {
      expiresIn,
      issuer: 'smartlock-tuya',
      algorithm: 'HS256' as const,
    } as jwt.SignOptions
  );
}

/**
 * Decodificar token (sem validar assinatura)
 * CUIDADO: Usar apenas para debugging
 */
export function decodeToken(token: string): any {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
}

// ============================================================================
// EXPORT SUMMARY
// ============================================================================

export const AUTH_MIDDLEWARE_SUMMARY = {
  public_routes: PUBLIC_ROUTES,
  admin_routes: ADMIN_ROUTES,
  features: [
    'Validar token JWT',
    'Validar expiration',
    'Validar payload',
    'Retornar 401 se não autenticado',
    'Retornar 403 se sem permissões',
    'Log de tentativas não autorizadas',
    'Mock mode para testes',
    'Suporte a role (admin/user)',
  ],
} as const;
