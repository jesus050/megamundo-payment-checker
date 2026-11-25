import React, { useState, useEffect } from 'react';
import { formatCurrencyCOP } from '@megamundo/shared';
import { formatRelativeTime } from '../services/time';
import { Check, X } from 'lucide-react';

export interface PaymentNotificationData {
  id: string;
  amount: number;
  status: string;
  provider: string;
  reference: string;
  paidAt?: string | Date;
  createdAt: string | Date;
  account?: {
    alias?: string;
    lastFourDigits?: string;
  };
}

interface Props {
  incomingPayment: PaymentNotificationData | null;
}

export const PaymentNotificationModal: React.FC<Props> = ({ incomingPayment }) => {
  const [queue, setQueue] = useState<PaymentNotificationData[]>([]);
  const [activePayment, setActivePayment] = useState<PaymentNotificationData | null>(null);

  useEffect(() => {
    if (!incomingPayment) return;
    if (activePayment?.id === incomingPayment.id) return;

    setQueue((prev) => {
      if (prev.some((p) => p.id === incomingPayment.id)) return prev;
      return [...prev, incomingPayment];
    });
  }, [incomingPayment, activePayment]);

  useEffect(() => {
    if (!activePayment && queue.length > 0) {
      const next = queue[0];
      if (next) {
        setActivePayment(next);
        setQueue((prev) => prev.slice(1));
      }
    }
  }, [queue, activePayment]);

  useEffect(() => {
    if (!activePayment) return;

    const timer = setTimeout(() => {
      setActivePayment(null);
    }, 4500);

    return () => clearTimeout(timer);
  }, [activePayment]);

  if (!activePayment) return null;

  const accountLastDigits = activePayment.account?.lastFourDigits || '5027';
  const relativeTime = formatRelativeTime(activePayment.paidAt || activePayment.createdAt);

  return (
    <div className="fixed inset-x-0 top-5 z-50 flex justify-center px-4 pointer-events-none">
      <div className="bg-white border border-slate-200 border-t-4 border-t-brand-primary rounded-2xl shadow-xl px-6 py-5 max-w-sm w-full pointer-events-auto text-center relative animate-in fade-in slide-in-from-top-4 duration-200">
        {/* Botón X */}
        <button
          onClick={() => setActivePayment(null)}
          className="absolute right-3 top-3 p-1 rounded-lg text-slate-400 hover:text-brand-text hover:bg-slate-100 transition"
          title="Cerrar notificación"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Check verde semántico */}
        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto mb-2 shadow-xs">
          <Check className="w-7 h-7 stroke-[3]" />
        </div>

        {/* Etiqueta PAGO RECIBIDO con acento de marca */}
        <div className="flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider text-brand-primary">
          <span>PAGO CONFIRMADO</span>
          <span className="w-1.5 h-1.5 rounded-full bg-brand-accent"></span>
        </div>

        {/* Monto destacado en Dark Blue */}
        <div className="text-3xl sm:text-4xl font-black text-brand-text font-mono tracking-tight my-1.5">
          {formatCurrencyCOP(activePayment.amount)}
        </div>

        {/* Cuenta y tiempo */}
        <div className="text-xs font-semibold text-slate-500">
          <span>Cuenta •••• {accountLastDigits}</span>
          <span className="mx-1.5">·</span>
          <span className="text-brand-text font-bold">{relativeTime}</span>
        </div>

        {/* Indicador de cola con acento amarillo suave */}
        {queue.length > 0 && (
          <div className="mt-2 text-[10px] font-bold text-amber-900 bg-brand-accent/20 border border-brand-accent/40 py-0.5 px-2 rounded-full inline-block">
            +{queue.length} pago{queue.length > 1 ? 's' : ''} más en cola
          </div>
        )}
      </div>
    </div>
  );
};
