'use client';

export default function PINModal({
  reservationId,
  pin,
  onClose,
}: {
  reservationId: string;
  pin: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-white mb-4">🔐 PIN da Reserva</h2>

        <div className="bg-slate-900 border border-slate-700 rounded p-4 mb-6">
          <p className="text-slate-400 text-sm mb-2">Código PIN:</p>
          <div className="flex items-center gap-3">
            <code className="text-2xl font-mono text-green-400 tracking-wider">
              {pin}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(pin);
                alert('✅ PIN copiado!');
              }}
              className="p-2 hover:bg-slate-700 rounded transition"
              title="Copiar PIN"
            >
              📋
            </button>
          </div>
        </div>

        <p className="text-slate-400 text-sm mb-4">
          ⚠️ Este PIN é sensível. Guarde em local seguro.
        </p>

        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
