import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { DashboardView } from './views/DashboardView';
import { TerminalView } from './views/TerminalView';
import { SimulatorView } from './views/SimulatorView';
import { LoginView } from './views/LoginView';

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500 font-bold">
        Cargando Megamundo...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Navbar />
      <main className="flex-1">{children}</main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginView />} />
          <Route
            path="/"
            element={
              <ProtectedLayout>
                <DashboardView />
              </ProtectedLayout>
            }
          />
          <Route
            path="/terminal"
            element={
              <ProtectedLayout>
                <TerminalView />
              </ProtectedLayout>
            }
          />
          {import.meta.env.DEV && (
            <Route
              path="/dev/payments"
              element={
                <ProtectedLayout>
                  <SimulatorView />
                </ProtectedLayout>
              }
            />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
