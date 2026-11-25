import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { realtimeClient, ConnectionStatus } from '../services/realtime';
import { soundService } from '../services/sound';
import {
  Volume2,
  VolumeX,
  LogOut,
  LayoutDashboard,
  Terminal,
  Beaker,
  MoreVertical,
  Wifi,
  WifiOff,
} from 'lucide-react';

export const Navbar: React.FC<{ onManualRefresh?: () => void }> = ({ onManualRefresh }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    realtimeClient.getStatus()
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(soundService.isEnabled());
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [realLogoUrl, setRealLogoUrl] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    // Verificar si existe un logo real válido en /branding/
    const checkImage = (src: string): Promise<boolean> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          // Descartar placeholders vacíos o 1x1, requerir dimensiones válidas
          if (img.naturalWidth > 1 && img.naturalHeight > 1) {
            resolve(true);
          } else {
            resolve(false);
          }
        };
        img.onerror = () => resolve(false);
        img.src = src;
      });
    };

    const detectLogo = async () => {
      // 1. Preferir SVG vectorial
      if (await checkImage('/branding/megamundo-logo.svg')) {
        if (isMounted) setRealLogoUrl('/branding/megamundo-logo.svg');
        return;
      }
      // 2. Alternativa PNG
      if (await checkImage('/branding/megamundo-logo.png')) {
        if (isMounted) setRealLogoUrl('/branding/megamundo-logo.png');
        return;
      }
    };

    detectLogo();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const unsub = realtimeClient.onStatusChange((status) => {
      setConnectionStatus(status);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleSound = () => {
    const next = soundService.toggle();
    setSoundEnabled(next);
    if (next) {
      soundService.playPaymentConfirmed();
    }
  };

  const isDev = import.meta.env.DEV;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          {/* Logo Megamundo: Logo real si existe asset válido, de lo contrario fallback provisional */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 group">
              {realLogoUrl ? (
                <img
                  src={realLogoUrl}
                  alt="Megamundo"
                  className="h-8 w-auto max-h-8 object-contain rounded-lg shadow-xs"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-brand-primary flex items-center justify-center text-white font-black text-base shadow-xs group-hover:bg-brand-primary-dark transition relative">
                  M
                  <span className="w-2 h-2 rounded-full bg-brand-accent absolute -top-0.5 -right-0.5 ring-2 ring-white"></span>
                </div>
              )}
              <div className="flex items-baseline gap-1">
                <span className="font-black text-brand-text tracking-tight text-base sm:text-lg">
                  MEGAMUNDO
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-brand-accent hidden sm:inline-block"></span>
              </div>
            </Link>

            {/* Indicador de conexión (Verde exclusivamente semántico) */}
            <div className="ml-2 pl-3 border-l border-slate-200 flex items-center">
              {connectionStatus === 'connected' ? (
                <div
                  className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full text-xs font-bold"
                  title="Conexión en tiempo real activa"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>CONECTADO</span>
                </div>
              ) : connectionStatus === 'connecting' ? (
                <div
                  className="flex items-center gap-1.5 text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 rounded-full text-xs font-bold"
                  title="Reconectando con el servidor..."
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                  <span>RECONECTANDO...</span>
                </div>
              ) : (
                <div
                  className="flex items-center gap-1.5 text-rose-700 bg-rose-50 border border-rose-200/80 px-2.5 py-0.5 rounded-full text-xs font-bold"
                  title="Sin conexión en tiempo real"
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>SIN CONEXIÓN</span>
                </div>
              )}
            </div>
          </div>

          {/* Navegación y Controles */}
          <div className="flex items-center gap-2 sm:gap-3">
            <nav className="flex items-center gap-1.5">
              <Link
                to="/"
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition flex items-center gap-1.5 ${
                  location.pathname === '/'
                    ? 'bg-brand-primary-light text-brand-primary'
                    : 'text-slate-600 hover:text-brand-text hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>

              <Link
                to="/terminal"
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition flex items-center gap-1.5 ${
                  location.pathname === '/terminal'
                    ? 'bg-brand-primary text-white shadow-xs'
                    : 'text-slate-700 hover:text-brand-text hover:bg-slate-100'
                }`}
              >
                <Terminal className="w-4 h-4" />
                <span>Terminal</span>
              </Link>

              {/* Simulador Dev (estrictamente solo en desarrollo) */}
              {isDev && (
                <Link
                  to="/dev/payments"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    location.pathname === '/dev/payments'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'text-slate-600 hover:bg-amber-50 hover:text-amber-800'
                  }`}
                  title="Simulador de desarrollo"
                >
                  <Beaker className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Simulador</span>
                </Link>
              )}
            </nav>

            {/* Toggle de audio */}
            <button
              onClick={handleToggleSound}
              className={`p-1.5 rounded-lg border transition ${
                soundEnabled
                  ? 'bg-white border-slate-200 text-brand-primary hover:bg-slate-50'
                  : 'bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-600'
              }`}
              title={soundEnabled ? 'Sonido activado' : 'Sonido desactivado'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Menú de opciones secundarias */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-brand-text hover:bg-slate-100 transition border border-transparent hover:border-slate-200"
                title="Opciones"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 text-xs z-50 animate-in fade-in zoom-in-95">
                  {user && (
                    <div className="px-3 py-2 border-b border-slate-100">
                      <div className="font-bold text-brand-text truncate">{user.name}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {user.role}
                      </div>
                    </div>
                  )}

                  {onManualRefresh && (
                    <button
                      onClick={() => {
                        onManualRefresh();
                        setMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-brand-text hover:bg-slate-50 font-medium"
                    >
                      Refrescar datos
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (realtimeClient.getStatus() !== 'connected') {
                        realtimeClient.connect();
                      }
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-brand-text hover:bg-slate-50 font-medium flex items-center gap-2"
                  >
                    {connectionStatus === 'connected' ? (
                      <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <WifiOff className="w-3.5 h-3.5 text-rose-500" />
                    )}
                    <span>Verificar conexión</span>
                  </button>

                  <div className="border-t border-slate-100 my-1"></div>

                  <button
                    onClick={() => {
                      logout();
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 font-bold flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
