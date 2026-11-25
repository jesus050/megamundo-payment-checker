import React from 'react';
import { formatCurrencyCOP } from '@megamundo/shared';
import { formatRelativeTime } from '../services/time';
import { CheckCircle2, Clock, XCircle, AlertTriangle } from 'lucide-react';

export interface PaymentItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  providerReference: string;
  providerPaymentId: string;
  paidAt?: string | null;
  createdAt: string;
  paymentAccount?: {
    alias: string;
    lastFourDigits: string;
    provider: string;
  };
  sale?: {
    id: string;
    saleNumber: string;
    amount: number;
    status: string;
  } | null;
}

interface Props {
  payment: PaymentItem;
  onClick?: () => void;
}

export const PaymentRow: React.FC<Props> = ({ payment, onClick }) => {
  const isApproved = payment.status === 'APPROVED';
  const isPending = payment.status === 'PENDING' || payment.status === 'PROCESSING';
  const isRejected = payment.status === 'REJECTED' || payment.status === 'CANCELLED';
  const isError = payment.status === 'ERROR';

  const relativeTime = formatRelativeTime(payment.paidAt || payment.createdAt);
  const accountLastDigits = payment.paymentAccount?.lastFourDigits || '5027';

  let statusLabel = 'CONFIRMADO';
  if (isPending) statusLabel = 'PENDIENTE';
  else if (isRejected) statusLabel = 'RECHAZADO';
  else if (isError) statusLabel = 'ERROR';

  return (
    <div
      onClick={onClick}
      className={`px-4 py-3 rounded-xl border transition-all duration-150 cursor-pointer flex items-center justify-between gap-4 bg-white ${
        isApproved
          ? 'border-slate-200 hover:border-brand-primary hover:shadow-xs'
          : isPending
          ? 'border-amber-200/90 bg-amber-50/20 hover:border-amber-400'
          : 'border-rose-200/90 bg-rose-50/20 hover:border-rose-400'
      }`}
    >
      {/* Lado izquierdo: Monto + Icono + Info Secundaria */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
            isApproved
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
              : isPending
              ? 'bg-amber-50 text-amber-600 border border-amber-200/60'
              : 'bg-rose-50 text-rose-600 border border-rose-200/60'
          }`}
        >
          {isApproved && <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />}
          {isPending && <Clock className="w-5 h-5 stroke-[2.5]" />}
          {isRejected && <XCircle className="w-5 h-5 stroke-[2.5]" />}
          {isError && <AlertTriangle className="w-5 h-5 stroke-[2.5]" />}
        </div>

        <div className="min-w-0">
          {/* 1. MONTO (brand-text con máximo peso tipográfico) */}
          <div className="text-xl sm:text-2xl font-black text-brand-text font-mono tracking-tight leading-none">
            {formatCurrencyCOP(payment.amount)}
          </div>

          {/* 3. TIEMPO + 4. CUENTA + 5. REFERENCIA */}
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-1 truncate">
            <span className="text-brand-text/80 font-semibold">{relativeTime}</span>
            <span>·</span>
            <span>Cuenta •••• {accountLastDigits}</span>
            {payment.providerReference && (
              <>
                <span>·</span>
                <span className="font-mono text-slate-700">Ref {payment.providerReference}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Lado derecho: 2. ESTADO SEMÁNTICO */}
      <div className="shrink-0 text-right">
        <span
          className={`inline-block text-xs font-black uppercase tracking-wide px-3 py-1 rounded-full ${
            isApproved
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : isPending
              ? 'bg-amber-50 text-amber-800 border border-amber-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  );
};
