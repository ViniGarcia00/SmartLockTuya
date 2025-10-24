'use client';

import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ReservationTable from './components/ReservationTable';
import { Reservation, Accommodation, Credential } from '../../../types';

interface ReservationData {
  reservations: Reservation[];
  accommodations: Accommodation[];
  credentials: Credential[];
  total: number;
  page: number;
}

export default function ReservationsPage() {
  const [data, setData] = useState<ReservationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [status, setStatus] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [page, setPage] = useState(1);

  // Carregar reservas
  useEffect(() => {
    const fetchReservations = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (fromDate) params.append('from', fromDate);
        if (toDate) params.append('to', toDate);
        params.append('page', page.toString());

        const response = await fetch(
          `/api/admin/reservations?${params.toString()}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Erro ao carregar reservas');
        }

        const result = await response.json() as any;
        setData(result?.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    fetchReservations();
  }, [status, fromDate, toDate, page]);

  const handleStatusChange = (value: string) => {
    setStatus(value);
    setPage(1);
  };

  const handleFromDateChange = (value: string) => {
    setFromDate(value);
    setPage(1);
  };

  const handleToDateChange = (value: string) => {
    setToDate(value);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">📅 Reservas</h1>
          <p className="text-slate-400">
            Gerencie todas as reservas e seus PINs de acesso
          </p>
        </div>

        {/* Filtros */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              >
                <option value="">Todos</option>
                <option value="confirmed">Confirmado</option>
                <option value="pending">Pendente</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>

            {/* From Date */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                De
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => handleFromDateChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Até
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => handleToDateChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  setStatus('');
                  setFromDate('');
                  setToDate('');
                  setPage(1);
                }}
                className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium transition"
              >
                🔄 Limpar
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
            <div className="inline-block">
              <div className="animate-spin inline-block w-8 h-8 border-4 border-slate-600 border-t-blue-500 rounded-full"></div>
              <p className="text-slate-400 mt-4">Carregando reservas...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-red-200">
            ❌ {error}
          </div>
        ) : data && data.reservations.length > 0 ? (
          <>
            <ReservationTable
              reservations={data.reservations}
              accommodations={data.accommodations}
              credentials={data.credentials}
            />

            {/* Paginação */}
            <div className="mt-6 flex justify-between items-center">
              <p className="text-slate-400">
                Total: <span className="font-bold text-white">{data.total}</span>{' '}
                reservas
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-medium transition"
                >
                  ← Anterior
                </button>
                <div className="px-4 py-2 bg-slate-800 text-white rounded font-medium border border-slate-700">
                  Página {page}
                </div>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={data.reservations.length < 10}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-medium transition"
                >
                  Próxima →
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
            <p className="text-slate-400 mb-4">📭 Nenhuma reserva encontrada</p>
            <button
              onClick={() => {
                setStatus('');
                setFromDate('');
                setToDate('');
                setPage(1);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
