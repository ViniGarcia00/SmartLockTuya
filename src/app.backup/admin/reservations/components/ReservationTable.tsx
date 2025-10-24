'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Reservation, Accommodation, Credential } from '../../../../types';
import { reprocessReservation } from '../actions';
import PINModal from './PINModal';

interface ReservationTableProps {
  reservations: Reservation[];
  accommodations: Accommodation[];
  credentials: Credential[];
}

export default function ReservationTable({
  reservations,
  accommodations,
  credentials,
}: ReservationTableProps) {
  const [reprocessing, setReprocessing] = useState<string | null>(null);
  const [selectedPIN, setSelectedPIN] = useState<{
    reservationId: string;
    pin: string;
  } | null>(null);

  const getAccommodationName = (accommodationId: string) => {
    const accommodation = accommodations.find((a) => a.id === accommodationId);
    return accommodation?.name || 'N/A';
  };

  const getPINStatus = (reservation: Reservation) => {
    if (!reservation.accommodationId) {
      return { label: 'Sem mapeamento', color: 'bg-red-500/20 text-red-300', icon: '❌' };
    }

    if (!reservation.credentialId) {
      return { label: 'Aguardando geração', color: 'bg-yellow-500/20 text-yellow-300', icon: '⏳' };
    }

    const credential = credentials.find((c) => c.id === reservation.credentialId);

    if (credential?.isActive && credential?.expiresAt && new Date(credential.expiresAt) > new Date()) {
      return { label: 'PIN Ativo', color: 'bg-green-500/20 text-green-300', icon: '✓' };
    }

    if (credential?.revokedAt) {
      return { label: 'Revogado', color: 'bg-gray-500/20 text-gray-300', icon: '✕' };
    }

    return { label: 'Aguardando geração', color: 'bg-yellow-500/20 text-yellow-300', icon: '⏳' };
  };

  const getStatusBadge = (status: string) => {
    const statuses: Record<string, { label: string; color: string; icon: string }> = {
      confirmed: { label: 'Confirmado', color: 'bg-blue-500/20 text-blue-300', icon: '✓' },
      pending: { label: 'Pendente', color: 'bg-amber-500/20 text-amber-300', icon: '⏳' },
      cancelled: { label: 'Cancelado', color: 'bg-red-500/20 text-red-300', icon: '✕' },
    };
    const s = statuses[status] || statuses.pending;
    return <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${s.color}`}>
      {s.icon} {s.label}
    </span>;
  };

  const handleReprocess = async (reservationId: string) => {
    try {
      setReprocessing(reservationId);
      const result = await reprocessReservation(reservationId);

      if (result.success) {
        alert('✅ Reserva reprocessada com sucesso!');
        // Recarregar página
        window.location.reload();
      } else {
        alert(`❌ Erro: ${result.message}`);
      }
    } finally {
      setReprocessing(null);
    }
  };

  const handleViewPIN = async (reservationId: string) => {
    try {
      const response = await fetch(
        `/api/admin/reservations/${reservationId}/pin`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao buscar PIN');
      }

      const data = await response.json();
      setSelectedPIN({ reservationId, pin: data.data.pin });
    } catch (err) {
      alert(`❌ ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  };

  return (
    <>
      <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-700">
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  ID
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Acomodação
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Check-in
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Check-out
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  PIN
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((reservation, index) => {
                const pinStatus = getPINStatus(reservation);
                const isActive =
                  pinStatus.label === 'PIN Ativo';

                return (
                  <tr
                    key={reservation.id}
                    className={`border-b border-slate-700 hover:bg-slate-700/50 transition ${
                      index % 2 === 0 ? 'bg-slate-800/50' : 'bg-slate-800'
                    }`}
                  >
                    <td className="px-6 py-4 text-sm font-mono text-slate-300">
                      {reservation.id.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {getAccommodationName(reservation.accommodationId)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {format(parseISO(reservation.checkIn), 'dd/MM/yyyy', {
                        locale: ptBR,
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {format(parseISO(reservation.checkOut), 'dd/MM/yyyy', {
                        locale: ptBR,
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {getStatusBadge(reservation.status)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${pinStatus.color}`}>
                        {pinStatus.icon} {pinStatus.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm space-x-2">
                      <button
                        onClick={() => handleReprocess(reservation.id)}
                        disabled={reprocessing === reservation.id}
                        className="inline-px-3 py-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition"
                      >
                        {reprocessing === reservation.id ? '⏳' : '🔄'} Reprocessar
                      </button>
                      {isActive && (
                        <button
                          onClick={() => handleViewPIN(reservation.id)}
                          className="inline-px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition"
                        >
                          👁️ Ver PIN
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de PIN */}
      {selectedPIN && (
        <PINModal
          reservationId={selectedPIN.reservationId}
          pin={selectedPIN.pin}
          onClose={() => setSelectedPIN(null)}
        />
      )}
    </>
  );
}
