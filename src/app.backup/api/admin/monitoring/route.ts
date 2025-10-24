/**
 * PASSO 19 - API de Monitoramento
 * Endpoints para o dashboard de observabilidade
 */

import { Router, Request, Response } from 'express';
import { structuredLogger } from '../../../../lib/structured-logger';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Interface para stats de monitoramento
interface MonitoringStats {
  timestamp: string;
  activeCredentials: number;
  scheduledJobs: number;
  dlqCount: number;
  successRate: number;
  avgLatency: number;
  alerts: {
    dlqAlert: boolean;
    latencyAlert: boolean;
    errorAlert: boolean;
  };
}

/**
 * GET /api/admin/monitoring/stats
 * Retorna estatísticas de monitoramento
 */
router.get(
  '/stats',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const requestId = (req as any).requestId;

      structuredLogger.debug('Fetching monitoring stats', { requestId });

      // Simular dados - em produção, buscar do Redis/BD
      // TODO: Integrar com BullMQ para dados reais
      const stats: MonitoringStats = {
        timestamp: new Date().toISOString(),
        activeCredentials: 0, // Buscar de: SELECT COUNT(*) FROM credentials WHERE active = true
        scheduledJobs: 0, // Buscar de: await queue.getJobCounts()
        dlqCount: 0, // Buscar de: await queue.getDLQ()
        successRate: structuredLogger.getEventStats().successRate,
        avgLatency: calculateAverageLatency(structuredLogger.getEventHistory()),
        alerts: structuredLogger.checkAlerts(),
      };

      structuredLogger.debug('Monitoring stats retrieved', {
        requestId,
        metadata: stats,
      });

      return res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      structuredLogger.error(
        'Error fetching monitoring stats',
        error as Error,
        {
          requestId: (req as any).requestId,
        }
      );

      return res.status(500).json({
        success: false,
        error: 'Failed to fetch monitoring stats',
      });
    }
  }
);

/**
 * GET /api/admin/monitoring/events
 * Retorna histórico de eventos
 * Query: ?limit=50
 */
router.get(
  '/events',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const requestId = (req as any).requestId;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

      structuredLogger.debug('Fetching event history', {
        requestId,
        metadata: { limit },
      });

      const events = structuredLogger.getEventHistory(limit);

      structuredLogger.debug('Event history retrieved', {
        requestId,
        metadata: {
          count: events.length,
        },
      });

      return res.json({
        success: true,
        data: {
          events,
          count: events.length,
        },
      });
    } catch (error) {
      structuredLogger.error(
        'Error fetching event history',
        error as Error,
        {
          requestId: (req as any).requestId,
        }
      );

      return res.status(500).json({
        success: false,
        error: 'Failed to fetch event history',
      });
    }
  }
);

/**
 * GET /api/admin/monitoring/health
 * Health check do sistema
 */
router.get(
  '/health',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const requestId = (req as any).requestId;
      const alerts = structuredLogger.checkAlerts();

      // Determinar health status
      const isHealthy = !alerts.dlqAlert && !alerts.latencyAlert;
      const status = isHealthy ? 'healthy' : alerts.dlqAlert ? 'degraded' : 'warning';

      structuredLogger.debug('Health check performed', {
        requestId,
        metadata: { status, alerts },
      });

      return res.status(isHealthy ? 200 : 503).json({
        success: isHealthy,
        status,
        timestamp: new Date().toISOString(),
        alerts,
      });
    } catch (error) {
      structuredLogger.error(
        'Error checking system health',
        error as Error,
        {
          requestId: (req as any).requestId,
        }
      );

      return res.status(503).json({
        success: false,
        status: 'error',
        error: 'Health check failed',
      });
    }
  }
);

/**
 * POST /api/admin/monitoring/clear-history
 * Limpar histórico de eventos
 */
router.post(
  '/clear-history',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const requestId = (req as any).requestId;

      structuredLogger.warn('Clearing event history', {
        requestId,
        metadata: {
          action: 'clear_history',
          timestamp: new Date().toISOString(),
        },
      });

      structuredLogger.clearHistory();

      return res.json({
        success: true,
        message: 'Event history cleared',
      });
    } catch (error) {
      structuredLogger.error(
        'Error clearing event history',
        error as Error,
        {
          requestId: (req as any).requestId,
        }
      );

      return res.status(500).json({
        success: false,
        error: 'Failed to clear history',
      });
    }
  }
);

/**
 * Helper: Calcular latência média
 */
function calculateAverageLatency(events: any[]): number {
  if (events.length === 0) return 0;

  const withDuration = events.filter((e) => e.duration);
  if (withDuration.length === 0) return 0;

  const totalDuration = withDuration.reduce((sum, e) => sum + e.duration, 0);
  return Math.round(totalDuration / withDuration.length);
}

export default router;
