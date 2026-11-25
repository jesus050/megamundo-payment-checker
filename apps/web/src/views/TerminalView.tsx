import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getPaymentsApi } from '../services/api';
import { realtimeClient, ConnectionStatus } from '../services/realtime';
import { soundService } from '../services/sound';
import { formatCurrencyCOP } from '@megamundo/shared';
import { formatRelativeTime, formatTimeCompact } from '../services/time';
import { Check, Search, X } from 'lucide-react';

interface TerminalPayment {
  id: string;
  amount: number;
  status: string;
  provider: string;
  providerReference: string;
  providerPaymentId: string;
  paidAt?: string | null;
  createdAt: string;
  paymentAccount?: {
    alias: string;
    lastFourDigits: string;
  };
  sale?: {
    saleNumber: string;
  } | null;
}

export const TerminalView: React.FC = () => {
  const [payments, setPayments] = useState<TerminalPayment[]>([]);
  const [amountQuery, setAmountQuery] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    realtimeClient.getStatus()
  );

  const loadRecentPayments = useCallback(async () => {
    try {
      const data = await getPaymentsApi({
        lastMinutes: 15,
        limit: 50,
      });
      setPayments(data.payments || []);
    } catch (e) {
      console.error('Error al cargar pagos en terminal:', e);
    }
  }, []);

  useEffect(() => {
    loadRecentPayments();

    const unsubStatus = realtimeClient.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    const unsubCreated = realtimeClient.onPaymentCreated((payload) => {
      const incoming = payload.payment;
      if (!incoming) return;

      setPayments((prev) => [incoming, ...prev]);

      if (incoming.status === 'APPROVED') {
        soundService.playPaymentConfirmed();
      }
    });

    const unsubUpdated = realtimeClient.onPaymentUpdated((payload) => {
      const updated = payload.payment;
      if (!updated) return;
      setPayments((prev) =>
        prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
      );
    });

    const interval = setInterval(loadRecentPayments, 45000);

    return () => {
      unsubStatus();
      unsubCreated();
      unsubUpdated();
      clearInterval(interval);
    };
  }, [loadRecentPayments]);

  const latestApprovedPayment = useMemo(() => {
    return payments.find((p) => p.status === 'APPROVED') || null;
  }, [payments]);

  const filteredPayments = useMemo(() => {
    const trimmed = amountQuery.trim();
    if (!trimmed) return payments;
    const searchVal = Number(trimmed);
    if (!isNaN(searchVal) && searchVal > 0) {
      return payments.filter((p) => p.amount === searchVal);
    }
    return payments.filter(
      (p) =>
        p.providerReference?.toLowerCase().includes(trimmed.toLowerCase()) ||
        p.sale?.saleNumber?.toLowerCase().includes(trimmed.toLowerCase())
    );
  }, [payments, amountQuery]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 space-y-4">
      {/* Cabecera distintiva de la Terminal de Caja: Azul Megamundo + Acento Amarillo */}
      <div className="bg-brand-primary text-white rounded-2xl px-5 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white text-brand-primary flex items-center justify-center font-black text-sm shadow-xs">
            M
          </div>
          <div>
            <div className="text-sm font-black tracking-tight leading-tight flex items-center gap-1.5">
              <span>TERMINAL DE CAJA</span>
              <span className="w-2 h-2 rounded-full bg-brand-accent"></span>
            </div>
            <div className="text-[11px] text-white/80 font-medium">
              Verificador automático en mostrador
            </div>
          </div>
        </div>

        {/* Indicador de conexión en la terminal */}
        <div className="flex items-center gap-2">
          {connectionStatus === 'connected' ? (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-brand-text/40 border border-white/20 px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>ACTIVO</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-bold text-brand-accent bg-brand-text/50 border border-brand-accent/30 px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-brand-accent animate-ping"></span>
              <span>RECONECTANDO</span>
            </div>
          )}
        </div>
      </div>

      {/* TARJETA HERO: ÚLTIMO PAGO RECIBIDO */}
      <div className="bg-white border-2 border-brand-primary rounded-2xl p-6 text-center shadow-xs relative overflow-hidden">
        {/* Detalle sutil de marca en la esquina */}
        <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden pointer-events-none">
          <div className="w-8 h-8 bg-brand-accent rotate-45 transform origin-bottom-left translate-x-3 -translate-y-3"></div>
        </div>

        <div className="text-[11px] font-black uppercase tracking-widest text-brand-primary mb-2 flex items-center justify-center gap-1.5">
          <span>ÚLTIMO PAGO RECIBIDO</span>
        </div>

        {latestApprovedPayment ? (
          <div className="space-y-2">
            {/* Check verde semántico */}
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-xs">
              <Check className="w-7 h-7 stroke-[3]" />
            </div>

            {/* Monto muy grande en Dark Blue brand-text */}
            <div className="text-4xl sm:text-6xl font-black text-brand-text font-mono tracking-tight">
              {formatCurrencyCOP(latestApprovedPayment.amount)}
            </div>

            {/* Estado CONFIRMADO verde suave */}
            <div>
              <span className="inline-block px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                CONFIRMADO
              </span>
            </div>

            {/* Tiempo y Cuenta */}
            <div className="text-xs sm:text-sm font-semibold text-slate-500 pt-1">
              <span className="text-brand-text font-bold">
                {formatRelativeTime(latestApprovedPayment.paidAt || latestApprovedPayment.createdAt)}
              </span>
              <span className="mx-2">·</span>
              <span>Cuenta •••• {latestApprovedPayment.paymentAccount?.lastFourDigits || '5027'}</span>
              {latestApprovedPayment.providerReference && (
                <>
                  <span className="mx-2">·</span>
                  <span className="font-mono text-slate-700 font-bold">
                    Ref {latestApprovedPayment.providerReference}
                  </span>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="py-8 text-slate-400 font-medium text-sm">
            Esperando confirmación de pagos de la jornada...
          </div>
        )}
      </div>

      {/* BÚSQUEDA RÁPIDA POR MONTO */}
      <div className="relative">
        <Search className="w-4 h-4 text-brand-primary absolute left-3.5 top-3" />
        <input
          type="text"
          value={amountQuery}
          onChange={(e) => setAmountQuery(e.target.value)}
          placeholder="Buscar por valor (ej. 185000)..."
          className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold font-mono text-brand-text focus:border-brand-primary focus:ring-1 focus:ring-brand-primary focus:outline-none transition shadow-2xs"
        />
        {amountQuery && (
          <button
            onClick={() => setAmountQuery('')}
            className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-brand-text rounded"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* SECCIÓN: PAGOS RECIENTES */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 bg-brand-background border-b border-slate-200 flex items-center justify-between text-xs font-bold text-brand-text uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <span>PAGOS RECIENTES</span>
            <span className="text-[10px] text-slate-400 font-medium lowercase">(últimos 15 min)</span>
          </div>
          <span className="text-brand-primary font-mono font-black">
            {filteredPayments.length} transacción{filteredPayments.length === 1 ? '' : 'es'}
          </span>
        </div>

        <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
          {filteredPayments.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-medium">
              {amountQuery
                ? `No hay pagos recientes con monto $${amountQuery}`
                : 'No se registran pagos en los últimos 15 minutos.'}
            </div>
          ) : (
            filteredPayments.map((p) => {
              const isApproved = p.status === 'APPROVED';
              const compactTime = formatTimeCompact(p.paidAt || p.createdAt);
              const relTime = formatRelativeTime(p.paidAt || p.createdAt);

              return (
                <div
                  key={p.id}
                  className="px-4 py-2.5 flex items-center justify-between hover:bg-brand-background transition text-sm"
                >
                  {/* Monto en Dark Blue */}
                  <div className="font-mono font-black text-brand-text text-base">
                    {formatCurrencyCOP(p.amount)}
                  </div>

                  {/* Estado y Hora */}
                  <div className="flex items-center gap-2">
                    {isApproved ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Confirmado</span>
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        {p.status}
                      </span>
                    )}

                    <span className="text-xs font-semibold text-slate-500 font-mono" title={relTime}>
                      {compactTime}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
