import React, { useState } from 'react';
import { simulatePaymentApi } from '../services/api';
import { formatCurrencyCOP } from '@megamundo/shared';
import { Beaker, Send, Copy, ShieldAlert, History, Zap } from 'lucide-react';

export const SimulatorView: React.FC = () => {
  const [amount, setAmount] = useState<number>(185000);
  const [reference, setReference] = useState<string>('MM-TEST-001');
  const [accountLastDigits, setAccountLastDigits] = useState<string>('5027');
  const [status, setStatus] = useState<string>('APPROVED');
  const [saleNumber, setSaleNumber] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [responseLog, setResponseLog] = useState<any | null>(null);

  const handleSimulate = async (customOptions: any = {}) => {
    setLoading(true);
    setResponseLog(null);

    const payload = {
      amount,
      reference,
      accountLastDigits,
      status,
      saleNumber: saleNumber || undefined,
      ...customOptions,
    };

    try {
      const res = await simulatePaymentApi(payload);
      setResponseLog(res);
    } catch (err: any) {
      setResponseLog({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Escenarios rápidos de prueba
  const handleTestDuplicate = () => {
    const fixedEventId = `mock-fixed-duplicate-${Date.now()}`;
    // Primer envío
    handleSimulate({ externalEventId: fixedEventId }).then(() => {
      // Segundo envío duplicado idéntico
      setTimeout(() => {
        handleSimulate({ externalEventId: fixedEventId });
      }, 500);
    });
  };

  const handleTestInvalidSignature = () => {
    handleSimulate({ simulateInvalidSignature: true });
  };

  const handleTestSameAmountTwice = () => {
    const refA = `MM-BATCH-A-${Math.floor(100 + Math.random() * 900)}`;
    const refB = `MM-BATCH-B-${Math.floor(100 + Math.random() * 900)}`;

    handleSimulate({ reference: refA, amount: 185000 }).then(() => {
      setTimeout(() => {
        handleSimulate({ reference: refB, amount: 185000 });
      }, 600);
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Cabecera */}
      <div className="bg-purple-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-700 text-purple-200 flex items-center justify-center">
            <Beaker className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-purple-300">
              Ambiente de Desarrollo
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Simulador de Pagos Mock (Pipeline Real de Bancolombia)
            </h1>
          </div>
        </div>

        <p className="mt-3 text-sm text-purple-200 max-w-3xl leading-relaxed">
          Esta herramienta inyecta notificaciones bancarias recorriendo exactamente el mismo flujo interno:
          captura de payload crudo, verificación de firma simulada, chequeo de idempotencia, creación de PaymentEvent,
          persistencia en base de datos y emisión en tiempo real a las pantallas de caja.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Formulario de Simulación */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Parámetros de la Notificación</span>
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Monto (COP)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black font-mono focus:ring-2 focus:ring-purple-500 focus:bg-white focus:outline-none"
                placeholder="185000"
                required
              />
              <span className="text-xs text-slate-400 font-semibold mt-1 block">
                Valor formateado: {formatCurrencyCOP(amount || 0)}
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Referencia Bancaria</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono focus:ring-2 focus:ring-purple-500 focus:bg-white focus:outline-none"
                placeholder="MM-TEST-001"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Últimos 4 dígitos cuenta</label>
                <input
                  type="text"
                  value={accountLastDigits}
                  onChange={(e) => setAccountLastDigits(e.target.value)}
                  maxLength={4}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono focus:ring-2 focus:ring-purple-500 focus:bg-white focus:outline-none"
                  placeholder="5027"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Estado de Pago</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-purple-500 focus:bg-white focus:outline-none"
                >
                  <option value="APPROVED">APPROVED (Aprobado)</option>
                  <option value="REJECTED">REJECTED (Rechazado)</option>
                  <option value="PENDING">PENDING (Pendiente)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Número de Venta (Opcional - ej. MM-1058)
              </label>
              <input
                type="text"
                value={saleNumber}
                onChange={(e) => setSaleNumber(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase focus:ring-2 focus:ring-purple-500 focus:bg-white focus:outline-none"
                placeholder="MM-1058"
              />
            </div>

            <button
              onClick={() => handleSimulate()}
              disabled={loading}
              className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-black text-base rounded-2xl shadow-lg shadow-purple-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
              <span>{loading ? 'PROCESANDO SIMULACIÓN...' : 'SIMULAR PAGO'}</span>
            </button>
          </div>

          {/* Pruebas de simulación avanzada */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <span className="text-xs font-black uppercase text-slate-400 block tracking-wider">
              Pruebas Rápidas de Escenarios Críticos:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={handleTestDuplicate}
                disabled={loading}
                className="p-3 rounded-xl border border-slate-200 hover:border-purple-400 bg-slate-50 text-left transition text-xs font-bold text-slate-700 hover:bg-purple-50 flex flex-col gap-1"
                title="Envía dos webhooks idénticos para validar que no duplique pagos"
              >
                <Copy className="w-4 h-4 text-purple-600" />
                <span>Webhook Duplicado (Idempotencia)</span>
              </button>

              <button
                onClick={handleTestInvalidSignature}
                disabled={loading}
                className="p-3 rounded-xl border border-slate-200 hover:border-rose-400 bg-slate-50 text-left transition text-xs font-bold text-slate-700 hover:bg-rose-50 flex flex-col gap-1"
                title="Envía firma corrupta para verificar rechazo de seguridad"
              >
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Firma Inválida (Seguridad)</span>
              </button>

              <button
                onClick={handleTestSameAmountTwice}
                disabled={loading}
                className="p-3 rounded-xl border border-slate-200 hover:border-emerald-400 bg-slate-50 text-left transition text-xs font-bold text-slate-700 hover:bg-emerald-50 flex flex-col gap-1"
                title="Envía 2 pagos independientes del mismo monto"
              >
                <Zap className="w-4 h-4 text-emerald-600" />
                <span>2 Pagos Mismo Monto</span>
              </button>
            </div>
          </div>
        </div>

        {/* Consola de Respuesta y Auditoría */}
        <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col justify-between border border-slate-800">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-purple-400 flex items-center gap-2">
                <History className="w-4 h-4" />
                <span>Respuesta del Servidor y Estado del Evento</span>
              </h3>

              {responseLog?.result?.status && (
                <span
                  className={`text-xs font-black uppercase px-2.5 py-1 rounded-lg ${
                    responseLog.result.status === 'PROCESSED'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : responseLog.result.status === 'IGNORED_DUPLICATE'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  }`}
                >
                  {responseLog.result.status}
                </span>
              )}
            </div>

            <div className="space-y-3 font-mono text-xs">
              {responseLog ? (
                <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto text-emerald-400">
                  {JSON.stringify(responseLog, null, 2)}
                </pre>
              ) : (
                <div className="p-8 text-center text-slate-500 font-sans text-sm">
                  Presiona "SIMULAR PAGO" para observar la respuesta del webhook y el registro en la base de datos.
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 text-xs text-slate-400">
            Los pagos simulados exitosamente aparecerán en tiempo real en la pantalla de{' '}
            <span className="text-white font-bold">Dashboard</span> y en el{' '}
            <span className="text-white font-bold">Terminal de Caja</span>.
          </div>
        </div>
      </div>
    </div>
  );
};
