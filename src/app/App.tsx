import { useState, useEffect } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { TecnicoApp } from './components/TecnicoApp';
import { SupervisorApp } from './components/SupervisorApp';
import { SuperAdmApp } from './components/SuperAdmApp';
import { loadFromBackend } from './data/store';
import { initUpdateCheck } from '@/utils/checkForUpdates';
import { usePeriodSync } from '@/hooks/usePeriodSync';
import type { UserRole, BaseShell } from './data/types';

export type { UserRole };

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  // Decide qual das 3 cascas de UI renderizar — independe do nome do papel
  // (que agora pode ser customizado no Admin). Ver Role.baseShell em
  // data/types.ts.
  baseShell: BaseShell;
  avatar?: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    // Restaurar usuário do localStorage (persistir sessão)
    const stored = localStorage.getItem('guardcorreias_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [backendReady, setBackendReady] = useState(false);

  // Sincronizar dados periodicamente — só depois de autenticado, já que
  // toda rota de sincronização exige um token válido.
  usePeriodSync(!!user);

  useEffect(() => {
    loadFromBackend().finally(() => setBackendReady(true));
    // Verificar atualizações periodicamente (sem fazer reload)
    initUpdateCheck();
  }, []);

  // Salvar usuário no localStorage quando mudar
  useEffect(() => {
    if (user) {
      localStorage.setItem('guardcorreias_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('guardcorreias_user');
    }
  }, [user]);

  if (!backendReady) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        height: '100vh', background: '#193A2A', gap: '16px',
      }}>
        <div style={{ color: '#AA8933', fontSize: '24px', fontWeight: 700, fontFamily: 'sans-serif' }}>
          GuardCorreias
        </div>
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%',
          border: '3px solid #AA893355', borderTopColor: '#AA8933',
          animation: 'spin 0.8s linear infinite',
        }} />
        <div style={{ color: '#ffffff88', fontSize: '13px', fontFamily: 'sans-serif' }}>
          Sincronizando dados...
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const handleLogin = (userData: User) => setUser(userData);
  const handleLogout = () => setUser(null);

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  function AppContent() {
    switch (user.baseShell) {
      case 'tecnico':   return <TecnicoApp user={user} onLogout={handleLogout} />;
      case 'supervisor': return <SupervisorApp user={user} onLogout={handleLogout} />;
      case 'superadm':  return <SuperAdmApp user={user} onLogout={handleLogout} />;
      default:          return <LoginScreen onLogin={handleLogin} />;
    }
  }

  return <AppContent />;
}
