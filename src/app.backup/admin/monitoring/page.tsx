/**
 * PASSO 19 - Admin Monitoring Dashboard
 * 
 * Painel de observabilidade em tempo real
 * Mostra:
 * - PINs ativos
 * - Jobs agendados
 * - Dead Letter Queue
 * - Taxa de sucesso
 * - Latência
 * - Feed de eventos ao vivo
 */

'use client';

import { useEffect, useState } from 'react';

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

interface MonitoringEvent {
  eventType: string;
  timestamp: string;
  requestId?: string;
  reservationId?: string;
  bookingId?: string;
  jobId?: string;
  duration?: number;
  data: Record<string, any>;
}

interface HealthStatus {
  success: boolean;
  status: 'healthy' | 'degraded' | 'warning' | 'error';
  timestamp: string;
  alerts: {
    dlqAlert: boolean;
    latencyAlert: boolean;
    errorAlert: boolean;
  };
}

export default function MonitoringDashboard() {
  const [stats, setStats] = useState<MonitoringStats | null>(null);
  const [events, setEvents] = useState<MonitoringEvent[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5s

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`,
  };

  /**
   * Buscar estatísticas
   */
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/monitoring/stats', { headers });
      const data = await response.json();

      if (data.success) {
        setStats(data.data);
      } else {
        setError('Failed to fetch stats');
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  /**
   * Buscar eventos
   */
  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/admin/monitoring/events?limit=50', {
        headers,
      });
      const data = await response.json();

      if (data.success) {
        setEvents(data.data.events);
      }
    } catch (err) {
      console.error('Error fetching events:', err);
    }
  };

  /**
   * Buscar health status
   */
  const fetchHealth = async () => {
    try {
      const response = await fetch('/api/admin/monitoring/health', { headers });
      const data = await response.json();
      setHealth(data);
    } catch (err) {
      console.error('Error fetching health:', err);
    }
  };

  /**
   * Limpar histórico
   */
  const handleClearHistory = async () => {
    if (!confirm('Tem certeza que deseja limpar o histórico de eventos?')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/monitoring/clear-history', {
        method: 'POST',
        headers,
      });

      const data = await response.json();

      if (data.success) {
        setEvents([]);
        alert('Event history cleared');
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  /**
   * Carregar dados iniciais
   */
  useEffect(() => {
    fetchStats();
    fetchEvents();
    fetchHealth();
    setLoading(false);
  }, []);

  /**
   * Auto-refresh
   */
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchStats();
      fetchEvents();
      fetchHealth();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 p-8">
        <div className="text-center text-white">
          <p>Loading monitoring dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">📊 Monitoring Dashboard</h1>
          <p className="text-slate-400">Real-time system observability and health metrics</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Health Status Bar */}
        {health && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              health.status === 'healthy'
                ? 'bg-green-900/20 border-green-500'
                : health.status === 'degraded'
                  ? 'bg-yellow-900/20 border-yellow-500'
                  : 'bg-red-900/20 border-red-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-200">System Status</p>
                <p className="text-lg font-bold text-white capitalize">{health.status}</p>
              </div>
              <div className="text-right">
                {health.alerts.dlqAlert && (
                  <p className="text-yellow-400 text-sm">⚠️ DLQ Alert</p>
                )}
                {health.alerts.latencyAlert && (
                  <p className="text-yellow-400 text-sm">⚠️ High Latency</p>
                )}
                {health.alerts.errorAlert && (
                  <p className="text-red-400 text-sm">🔴 Errors Detected</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            {/* Active Credentials */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="text-slate-400 text-sm font-medium mb-2">Active PINs</div>
              <div className="text-3xl font-bold text-white">{stats.activeCredentials}</div>
              <div className="text-slate-500 text-xs mt-2">Active credentials</div>
            </div>

            {/* Scheduled Jobs */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="text-slate-400 text-sm font-medium mb-2">Scheduled Jobs</div>
              <div className="text-3xl font-bold text-white">{stats.scheduledJobs}</div>
              <div className="text-slate-500 text-xs mt-2">Pending executions</div>
            </div>

            {/* Dead Letter Queue */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="text-slate-400 text-sm font-medium mb-2">Dead Letter Queue</div>
              <div
                className={`text-3xl font-bold ${stats.dlqCount > 5 ? 'text-red-400' : 'text-white'}`}
              >
                {stats.dlqCount}
              </div>
              <div className="text-slate-500 text-xs mt-2">Failed jobs</div>
            </div>

            {/* Success Rate */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="text-slate-400 text-sm font-medium mb-2">Success Rate</div>
              <div
                className={`text-3xl font-bold ${stats.successRate < 95 ? 'text-yellow-400' : 'text-green-400'}`}
              >
                {stats.successRate}%
              </div>
              <div className="text-slate-500 text-xs mt-2">Last 24 hours</div>
            </div>

            {/* Average Latency */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="text-slate-400 text-sm font-medium mb-2">Avg Latency</div>
              <div
                className={`text-3xl font-bold ${stats.avgLatency > 5000 ? 'text-red-400' : 'text-white'}`}
              >
                {stats.avgLatency}ms
              </div>
              <div className="text-slate-500 text-xs mt-2">Queue processing</div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="mb-8 flex items-center gap-4">
          <label className="flex items-center gap-2 text-white cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Auto Refresh</span>
          </label>

          {autoRefresh && (
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
              className="px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
            >
              <option value={1000}>1 second</option>
              <option value={5000}>5 seconds</option>
              <option value={10000}>10 seconds</option>
              <option value={30000}>30 seconds</option>
              <option value={60000}>1 minute</option>
            </select>
          )}

          <button
            onClick={() => {
              fetchStats();
              fetchEvents();
              fetchHealth();
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition"
          >
            🔄 Refresh Now
          </button>

          <button
            onClick={handleClearHistory}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition"
          >
            🗑️ Clear History
          </button>
        </div>

        {/* Events Feed */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">📜 Event Feed (Last 50)</h2>

          {events.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No events recorded yet</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {events.map((event, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-700 rounded border border-slate-600 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-blue-300">
                          {event.eventType}
                        </span>
                        {event.duration && (
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              event.duration > 5000
                                ? 'bg-red-900/30 text-red-300'
                                : 'bg-green-900/30 text-green-300'
                            }`}
                          >
                            {event.duration}ms
                          </span>
                        )}
                      </div>

                      <div className="text-slate-300 text-xs">
                        {event.reservationId && (
                          <p>Reservation: {event.reservationId}</p>
                        )}
                        {event.jobId && <p>Job: {event.jobId}</p>}
                        {event.requestId && <p>Request: {event.requestId}</p>}
                      </div>

                      <div className="text-slate-400 text-xs mt-1">
                        {event.data.error && (
                          <p className="text-red-300">
                            Error: {event.data.error.message}
                          </p>
                        )}
                        {event.data.message && (
                          <p>{event.data.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="text-slate-500 text-xs text-right whitespace-nowrap">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Last Updated */}
        <div className="mt-8 text-center text-slate-500 text-sm">
          {stats && (
            <p>
              Last updated: {new Date(stats.timestamp).toLocaleString()}
              {autoRefresh && ` (Auto-refresh every ${refreshInterval / 1000}s)`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
