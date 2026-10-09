import { useEffect, useState } from 'react';
import {
  LogOut,
  RefreshCw,
  Plus,
  Users as UsersIcon,
  Database,
  Activity,
  Trash2,
  ShieldCheck,
  MapPinned,
  ClipboardList,
  AlertTriangle,
  Settings as SettingsIcon,
  History,
} from 'lucide-react';
import guardCorreiasIcon from '../../assets/brand/guardcorreias-logo.png';
import grupoLogo from '../../assets/brand/grupo-mvv-bnmc.png';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { BackupPanel } from './BackupPanel';
import { RolesPanel } from './admin/RolesPanel';
import { AreasPanel } from './admin/AreasPanel';
import { ChecklistsPanel } from './admin/ChecklistsPanel';
import { SeveritiesPanel } from './admin/SeveritiesPanel';
import { SettingsPanel } from './admin/SettingsPanel';
import { AuditLogPanel } from './admin/AuditLogPanel';
import { getStore, addUser, deleteUser } from '../data/store';
import * as api from '@/api/client';
import { rolesAPI } from '@/api/client';
import type { SystemUser, Role } from '../data/types';
import { forceSync, useDataSync } from '@/hooks/useDataSync';
import type { User } from '../App';

interface SuperAdmAppProps {
  user: User;
  onLogout: () => void;
}

type Tab = 'usuarios' | 'papeis' | 'areas' | 'checklists' | 'severidades' | 'configuracoes' | 'auditoria' | 'backup' | 'status';

const NAV: { id: Tab; label: string; icon: typeof UsersIcon }[] = [
  { id: 'usuarios', label: 'Usuários', icon: UsersIcon },
  { id: 'papeis', label: 'Papéis & Permissões', icon: ShieldCheck },
  { id: 'areas', label: 'Áreas', icon: MapPinned },
  { id: 'checklists', label: 'Checklists', icon: ClipboardList },
  { id: 'severidades', label: 'Severidades', icon: AlertTriangle },
  { id: 'configuracoes', label: 'Configurações', icon: SettingsIcon },
  { id: 'auditoria', label: 'Auditoria', icon: History },
  { id: 'backup', label: 'Backup', icon: Database },
  { id: 'status', label: 'Status', icon: Activity },
];

export function SuperAdmApp({ user, onLogout }: SuperAdmAppProps) {
  const [activeTab, setActiveTab] = useState<Tab>('usuarios');
  const [syncing, setSyncing] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const { syncCounter } = useDataSync();
  const [users, setUsers] = useState<SystemUser[]>([]);

  function refresh() {
    setUsers(getStore().users);
  }
  useEffect(() => { refresh(); }, [syncCounter]);

  async function handleForceSync() {
    setSyncing(true);
    await forceSync();
    setSyncing(false);
    refresh();
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f5f5f5' }}>
      <div className="sticky top-0 z-10 shadow-md" style={{ backgroundColor: '#193A2A' }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <img src={guardCorreiasIcon} alt="" className="h-8 w-8 object-contain" />
            <span className="text-white text-[15px] tracking-wide leading-none">
              Guard<span style={{ color: '#AA8933' }}>Correias</span>
            </span>
            <div className="w-px h-6 bg-white/15 hidden sm:block" />
            <img src={grupoLogo} alt="Mineração Vale Verde · BNMC" className="h-6 w-auto rounded hidden sm:block" />
          </div>
          <div className="flex-1 px-3">
            <div className="text-white text-xs opacity-75">Administrador</div>
            <div className="text-white text-sm">{user.name}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleForceSync} disabled={syncing} className="text-white hover:bg-white/10">
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="ghost" size="sm" onClick={onLogout} className="text-white hover:bg-white/10">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <nav className="w-52 shrink-0 border-r border-gray-200 bg-white p-2 hidden md:block">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="w-full flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-colors mb-0.5 text-left"
                style={{
                  backgroundColor: active ? 'rgba(170,137,51,0.12)' : 'transparent',
                  color: active ? '#AA8933' : '#193A2A',
                }}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Navegação em abas horizontais roláveis no mobile, onde a coluna lateral vira oculta */}
        <div className="md:hidden flex gap-1 px-3 py-2 overflow-x-auto border-b border-gray-200 bg-white">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors shrink-0"
                style={{ backgroundColor: active ? 'rgba(170,137,51,0.12)' : 'transparent', color: active ? '#AA8933' : '#193A2A' }}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          {activeTab === 'usuarios' && <UsersPanel users={users} onRefresh={refresh} />}
          {activeTab === 'papeis' && <RolesPanel />}
          {activeTab === 'areas' && <AreasPanel />}
          {activeTab === 'checklists' && <ChecklistsPanel />}
          {activeTab === 'severidades' && <SeveritiesPanel />}
          {activeTab === 'configuracoes' && <SettingsPanel />}
          {activeTab === 'auditoria' && <AuditLogPanel />}
          {activeTab === 'backup' && (
            <div className="max-w-3xl mx-auto">
              <Card className="p-6 text-center">
                <Database className="w-10 h-10 mx-auto mb-3" style={{ color: '#193A2A' }} />
                <p className="text-sm text-gray-600 mb-4">Backups completos, exportações e agendamento automático.</p>
                <Button className="text-white" style={{ backgroundColor: '#193A2A' }} onClick={() => setShowBackup(true)}>
                  Abrir Centro de Backup
                </Button>
              </Card>
              {showBackup && <BackupPanel onClose={() => setShowBackup(false)} />}
            </div>
          )}
          {activeTab === 'status' && <StatusPanel />}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Usuários
// ─────────────────────────────────────────────────────────────────────────────

function UsersPanel({ users, onRefresh }: { users: SystemUser[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'tecnico' });

  useEffect(() => {
    rolesAPI.getAll().then((list: Role[]) => {
      setRoles(list);
      if (list.length > 0 && !list.some((r) => r.name === form.role)) {
        setForm((f) => ({ ...f, role: list[0].name }));
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate() {
    setError('');
    if (!form.name.trim() || !form.email.trim() || !form.password || form.password.length < 6) {
      setError('Preencha nome, e-mail e uma senha com ao menos 6 caracteres.');
      return;
    }
    try {
      setSaving(true);
      await addUser({
        id: '',
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        status: 'active',
        lastLogin: '',
        password: form.password,
      });
      setForm({ name: '', email: '', password: '', role: roles[0]?.name || 'tecnico' });
      setShowForm(false);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar usuário');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este usuário?')) return;
    try {
      await deleteUser(id);
      onRefresh();
    } catch {
      alert('Falha ao excluir usuário.');
    }
  }

  const roleLabels: Record<string, string> = Object.fromEntries(roles.map((r) => [r.name, r.label]));

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm" style={{ color: '#193A2A' }}>Usuários ({users.length})</h2>
        <Button size="sm" className="text-white" style={{ backgroundColor: '#AA8933' }} onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1.5" />Novo Usuário
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Nome *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">E-mail *</label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Senha (mín. 6) *</label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Perfil</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                {roles.map((r) => <option key={r.id} value={r.name}>{r.label}</option>)}
              </select>
            </div>
          </div>
          {error && <div className="text-xs text-red-600 bg-red-50 rounded p-2">{error}</div>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button className="flex-1 text-white" style={{ backgroundColor: '#193A2A' }} onClick={handleCreate} disabled={saving}>
              {saving ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {users.map((u) => (
          <Card key={u.id} className="p-3.5 flex items-center gap-3">
            <div className="flex-1">
              <div className="text-sm" style={{ color: '#193A2A' }}>{u.name}</div>
              <div className="text-xs text-gray-500">{u.email}</div>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{roleLabels[u.role] || u.role}</span>
            <button onClick={() => handleDelete(u.id)} className="text-gray-300 hover:text-red-500 shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Status / Diagnóstico
// ─────────────────────────────────────────────────────────────────────────────

function StatusPanel() {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.diagnosticsAPI.get().then(setDiagnostics).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h2 className="text-sm" style={{ color: '#193A2A' }}>Status do Sistema</h2>
      {error && <Card className="p-4 text-sm text-red-600">{error}</Card>}
      {!diagnostics && !error && <Card className="p-8 text-center text-sm text-gray-400">Carregando...</Card>}
      {diagnostics && (
        <>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: diagnostics.database?.connected ? '#16a34a' : '#dc2626' }} />
              <span className="text-sm">Banco de dados: {diagnostics.database?.connected ? 'conectado' : 'desconectado'} ({diagnostics.database?.driver})</span>
            </div>
            <p className="text-xs text-gray-500">Uptime do servidor: {Math.round((diagnostics.server?.uptimeSeconds || 0) / 60)} min · Node {diagnostics.server?.nodeVersion}</p>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm mb-3" style={{ color: '#193A2A' }}>Registros no banco</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(diagnostics.counts || {}).map(([key, val]) => (
                <div key={key} className="text-center bg-gray-50 rounded-lg p-2">
                  <div className="text-lg" style={{ color: '#193A2A' }}>{String(val)}</div>
                  <div className="text-[10px] text-gray-500">{key}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm mb-1" style={{ color: '#193A2A' }}>Backup automático</h3>
            <p className="text-xs text-gray-500">{diagnostics.backupSchedule?.enabled ? `Ativo — a cada ${diagnostics.backupSchedule.intervalHours}h` : 'Desativado'}</p>
            {diagnostics.lastBackup && (
              <p className="text-xs text-gray-500 mt-1">Último backup: {new Date(diagnostics.lastBackup.createdAt).toLocaleString('pt-BR')}</p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
