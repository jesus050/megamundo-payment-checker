import React, { useState } from 'react';
import { PaymentItem } from './PaymentRow';
import { formatCurrencyCOP, formatDateFull, formatTimeShort } from '@megamundo/shared';
import { associatePaymentToSaleApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { X, CheckCircle2, ShoppingBag, CreditCard, Link as LinkIcon, AlertTriangle } from 'lucide-react';

interface Props {
  payment: PaymentItem | null;
  onClose: () => void;
  onPaymentUpdated: (updated: any) => void;
}

export const PaymentDetailModal: React.FC<Props> = ({ payment, onClose, onPaymentUpdated }) => {
  const { isCashier, isAdmin } = useAuth();
  const [saleNumber, setSaleNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!payment) return null;

  const handleAssociate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleNumber.trim()) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await associatePaymentToSaleApi(payment.id, saleNumber.trim());
      setSuccessMsg('Venta asociada exitosamente');
      onPaymentUpdated(res.payment);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Error al asociar venta');
    } finally {
      setLoading(false);
    }
  };

  const isApproved = payment.status === 'APPROVED';
  const timeExact = formatTimeShort(payment.paidAt || payment.createdAt);
  const dateExact = formatDateFull(payment.paidAt || payment.createdAt);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Cabecera */}
        <div className="bg-slate-50 px-6 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-brand-primary" />
            <h3 className="font-black text-brand-text text-base">Detalle de Pago</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-brand-text hover:bg-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-6 space-y-4">
          {/* Monto y Estado */}
          <div className="text-center py-4 bg-brand-background rounded-xl border border-slate-200/80">
            <div className="text-3xl font-black text-brand-text font-mono tracking-tight">
              {formatCurrencyCOP(payment.amount)}
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isApproved ? 'CONFIRMADO' : payment.status}</span>
            </div>
          </div>

          {/* Atributos */}
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-400 font-bold block uppercase text-[10px]">Cuenta</span>
              <span className="font-bold text-brand-text font-mono">
                •••• {payment.paymentAccount?.lastFourDigits || '5027'}
              </span>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-400 font-bold block uppercase text-[10px]">Proveedor</span>
              <span className="font-bold text-brand-text uppercase">{payment.provider}</span>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-400 font-bold block uppercase text-[10px]">Referencia</span>
              <span className="font-bold text-brand-text font-mono truncate block">
                {payment.providerReference || 'N/A'}
              </span>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-400 font-bold block uppercase text-[10px]">Hora exacta</span>
              <span className="font-bold text-brand-text">{timeExact}</span>
            </div>
          </div>

          <div className="text-xs text-slate-500">
            Fecha: <span className="font-semibold text-brand-text">{dateExact}</span>
          </div>

          <div className="text-[11px] text-slate-400 font-mono truncate">
            ID Transacción: {payment.providerPaymentId}
          </div>

          {/* Venta vinculada */}
          <div className="pt-3 border-t border-slate-100">
            {payment.sale ? (
              <div className="bg-brand-primary-light border border-brand-primary/20 p-3 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShoppingBag className="w-4 h-4 text-brand-primary" />
                  <div>
                    <span className="text-[10px] text-brand-primary font-bold block uppercase">Venta Vinculada</span>
                    <span className="text-sm font-extrabold text-brand-text font-mono">
                      {payment.sale.saleNumber}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold text-brand-primary uppercase px-2 py-0.5 bg-white border border-brand-primary/30 rounded">
                  {payment.sale.status}
                </span>
              </div>
            ) : (isCashier || isAdmin) ? (
              <form onSubmit={handleAssociate} className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-brand-text">
                  <LinkIcon className="w-3.5 h-3.5 text-brand-primary" />
                  <span>Vincular a número de venta</span>
                </div>

                {error && (
                  <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={saleNumber}
                    onChange={(e) => setSaleNumber(e.target.value)}
                    placeholder="Ej. MM-1058"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold uppercase focus:ring-1 focus:ring-brand-primary focus:outline-none"
                    disabled={loading}
                    required
                  />
                  {/* Botón Principal: Fondo brand-primary y hover brand-primary-dark */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-dark text-white font-bold text-xs rounded-lg transition disabled:opacity-50"
                  >
                    {loading ? 'Vinculando...' : 'Vincular'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-xs text-slate-400 italic">
                Sin venta vinculada.
              </div>
            )}
          </div>
        </div>

        {/* Pie */}
        <div className="bg-slate-50 px-6 py-2.5 border-t border-slate-200 flex justify-end">
          {/* Botón secundario: Fondo blanco, borde y texto brand-primary */}
          <button
            onClick={onClose}
            className="px-4 py-1 text-xs font-bold text-brand-primary hover:bg-slate-100 rounded-lg transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
