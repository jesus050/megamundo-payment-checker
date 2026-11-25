import React, { useState, useEffect, useCallback } from 'react';
import { getPaymentsApi } from '../services/api';
import { realtimeClient } from '../services/realtime';
import { soundService } from '../services/sound';
import { PaymentRow, PaymentItem } from '../components/PaymentRow';
import { PaymentDetailModal } from '../components/PaymentDetailModal';
import { PaymentNotificationModal, PaymentNotificationData } from '../components/PaymentNotificationModal';
import { Search, SlidersHorizontal, X, AlertCircle } from 'lucide-react';

export const DashboardView: React.FC = () => {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Buscador unificado
  const [query, setQuery] = useState<string>('');

  // Filtros avanzados desplegables
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [accountFilter, setAccountFilter] = useState<string>('');
  const [timeFilter, setTimeFilter] = useState<string>('');

  // Modales
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null);
  const [incomingAlert, setIncomingAlert] = useState<PaymentNotificationData | null>(null);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {};
      const trimmed = query.trim();

      if (trimmed) {
        const num = Number(trimmed);
        if (!isNaN(num) && num > 0) {
          params.amount = num;
        } else {
          params.reference = trimmed;
        }
      }

      if (statusFilter) params.status = statusFilter;
      if (accountFilter) params.account = accountFilter;
      if (timeFilter) params.lastMinutes = Number(timeFilter);

      const data = await getPaymentsApi(params);
      setPayments(data.payments || []);
    } catch (err: any) {
      setError(err.message || 'Error al obtener pagos');
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter, accountFilter, timeFilter]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    realtimeClient.connect();

    const unsubCreated = realtimeClient.onPaymentCreated((payload) => {
      const incoming = payload.payment;
      if (!incoming) return;

      setPayments((prev) => [incoming, ...prev]);

      if (incoming.status === 'APPROVED') {
        soundService.playPaymentConfirmed();
        setIncomingAlert(incoming);
      }
    });

    const unsubUpdated = realtimeClient.onPaymentUpdated((payload) => {
      const updated = payload.payment;
      if (!updated) return;
      setPayments((prev) =>
        prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
      );
    });

    return () => {
      unsubCreated();
      unsubUpdated();
    };
  }, []);

  const hasActiveFilters = Boolean(statusFilter || accountFilter || timeFilter || query);

  const handleClearFilters = () => {
    setQuery('');
    setStatusFilter('');
    setAccountFilter('');
    setTimeFilter('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-4">
      {/* Alerta de nuevo pago */}
      <PaymentNotificationModal incomingPayment={incomingAlert} />

      {/* Modal de detalles */}
      <PaymentDetailModal
        payment={selectedPayment}
        onClose={() => setSelectedPayment(null)}
        onPaymentUpdated={(updated) => {
          setPayments((prev) =>
            prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
          );
        }}
      />

      {/* Título en Dark Blue con acento de marca sutil */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-black text-brand-text tracking-tight">
            Verificación de pagos
          </h1>
          <span className="w-2 h-2 rounded-full bg-brand-accent"></span>
        </div>
      </div>

      {/* Buscador unificado y botón de filtros con acentos Megamundo */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-brand-primary absolute left-3.5 top-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar monto, referencia o número de venta..."
              className="w-full pl-10 pr-4 py-2 bg-brand-background border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-brand-text placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary focus:outline-none transition"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-brand-text p-0.5 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 border transition ${
              showFilters || statusFilter || accountFilter || timeFilter
                ? 'bg-brand-primary-light border-brand-primary text-brand-primary'
                : 'bg-white border-slate-300 text-brand-text hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-brand-primary" />
            <span>Filtros</span>
            {(statusFilter || accountFilter || timeFilter) && (
              <span className="w-2 h-2 rounded-full bg-brand-accent"></span>
            )}
          </button>
        </div>

        {/* Panel desplegable de filtros avanzados */}
        {showFilters && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-100">
            <div>
              <label className="text-[11px] font-bold text-brand-text block mb-1">Estado</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-brand-background border border-slate-200 rounded-lg text-xs font-semibold text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="">Todos los estados</option>
                <option value="APPROVED">Confirmado</option>
                <option value="PENDING">Pendiente</option>
                <option value="REJECTED">Rechazado</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-brand-text block mb-1">Cuenta (últimos 4 dígitos)</label>
              <input
                type="text"
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                placeholder="Ej. 5027"
                maxLength={4}
                className="w-full px-2.5 py-1.5 bg-brand-background border border-slate-200 rounded-lg text-xs font-semibold text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-brand-text block mb-1">Período</label>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-brand-background border border-slate-200 rounded-lg text-xs font-semibold text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="">Cualquier momento</option>
                <option value="15">Últimos 15 minutos</option>
                <option value="60">Última hora</option>
                <option value="1440">Últimas 24 horas</option>
              </select>
            </div>

            {hasActiveFilters && (
              <div className="sm:col-span-3 flex justify-end pt-1">
                <button
                  onClick={handleClearFilters}
                  className="text-xs font-bold text-slate-500 hover:text-brand-primary transition flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Limpiar filtros</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lista de pagos */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1 text-xs text-slate-500 font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-brand-text">Pagos</span>
            <span className="bg-brand-primary-light text-brand-primary px-2 py-0.2 rounded-full text-[11px] font-mono font-bold">
              {payments.length}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-normal">Actualización automática</span>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading && payments.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs font-medium bg-white rounded-xl border border-slate-200">
            Cargando transacciones...
          </div>
        ) : payments.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs font-medium bg-white rounded-xl border border-slate-200">
            No se encontraron pagos con los criterios actuales.
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <PaymentRow
                key={p.id}
                payment={p}
                onClick={() => setSelectedPayment(p)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
