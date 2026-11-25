import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('cajero@megamundo.com');
  const [password, setPassword] = useState('Cajero123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  const setDemoUser = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="min-h-screen bg-brand-background flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-lg border border-slate-200 max-w-md w-full overflow-hidden">
        {/* Cabecera de marca: Azul Megamundo + Acento Amarillo */}
        <div className="bg-brand-primary px-8 pt-8 pb-6 text-white text-center relative">
          <div className="w-14 h-14 bg-white text-brand-primary rounded-2xl mx-auto flex items-center justify-center font-black text-2xl shadow-md mb-3 relative">
            M
            <span className="w-3.5 h-3.5 rounded-full bg-brand-accent absolute -top-1 -right-1 ring-2 ring-white"></span>
          </div>
          <h1 className="text-2xl font-black tracking-tight flex items-center justify-center gap-1.5">
            <span>MEGAMUNDO</span>
          </h1>
          <p className="text-white/80 text-xs font-semibold uppercase tracking-wider mt-0.5">
            Verificador de Pagos QR
          </p>
        </div>

        {/* Formulario */}
        <div className="p-8 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-brand-text block mb-1">Correo Electrónico</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-brand-background border border-slate-200 rounded-xl text-sm font-semibold text-brand-text focus:ring-1 focus:ring-brand-primary focus:border-brand-primary focus:bg-white focus:outline-none"
                  placeholder="cajero@megamundo.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-brand-text block mb-1">Contraseña</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-brand-background border border-slate-200 rounded-xl text-sm font-semibold text-brand-text focus:ring-1 focus:ring-brand-primary focus:border-brand-primary focus:bg-white focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Botón Principal: Fondo brand-primary con hover brand-primary-dark */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-primary hover:bg-brand-primary-dark text-white font-bold text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'Iniciando sesión...' : 'Ingresar al Sistema'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Cuentas de demostración */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block text-center">
              Acceso rápido:
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setDemoUser('cajero@megamundo.com', 'Cajero123!')}
                className="px-2 py-1.5 bg-white hover:bg-brand-primary-light border border-slate-200 hover:border-brand-primary text-brand-text hover:text-brand-primary rounded-lg text-xs font-bold transition text-center"
              >
                Cajero
              </button>
              <button
                type="button"
                onClick={() => setDemoUser('admin@megamundo.com', 'Admin123!')}
                className="px-2 py-1.5 bg-white hover:bg-brand-primary-light border border-slate-200 hover:border-brand-primary text-brand-text hover:text-brand-primary rounded-lg text-xs font-bold transition text-center"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => setDemoUser('auditor@megamundo.com', 'Auditor123!')}
                className="px-2 py-1.5 bg-white hover:bg-brand-primary-light border border-slate-200 hover:border-brand-primary text-brand-text hover:text-brand-primary rounded-lg text-xs font-bold transition text-center"
              >
                Auditor
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
