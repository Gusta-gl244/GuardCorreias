import { useEffect, useState } from 'react';
import { Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { rolesAPI } from '@/api/client';
import type { Role, PermissionModule, ModulePermissions, BaseShell } from '@/app/data/types';

const MODULES: { id: PermissionModule; label: string }[] = [
  { id: 'belts', label: 'Correias' },
  { id: 'checklistTemplates', label: 'Checklists' },
  { id: 'severities', label: 'Severidades' },
  { id: 'inspectionOrders', label: 'Ordens de Inspeção' },
  { id: 'inspections', label: 'Inspeções' },
  { id: 'media', label: 'Mídia' },
  { id: 'areas', label: 'Áreas' },
  { id: 'users', label: 'Usuários' },
  { id: 'roles', label: 'Papéis & Permissões' },
  { id: 'settings', label: 'Configurações' },
  { id: 'auditLog', label: 'Auditoria' },
  { id: 'backups', label: 'Backup' },
];

const ACTIONS: { id: keyof ModulePermissions; label: string }[] = [
  { id: 'view', label: 'Ver' },
  { id: 'create', label: 'Criar' },
  { id: 'edit', label: 'Editar' },
  { id: 'delete', label: 'Excluir' },
];

const EMPTY_PERMISSIONS: ModulePermissions = { view: false, create: false, edit: false, delete: false };

function emptyMatrix(): Record<PermissionModule, ModulePermissions> {
  return Object.fromEntries(MODULES.map((m) => [m.id, { ...EMPTY_PERMISSIONS }])) as Record<PermissionModule, ModulePermissions>;
}

export function RolesPanel() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<Record<PermissionModule, ModulePermissions>>(emptyMatrix());
  const [saving, setSaving] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', label: '', baseShell: 'tecnico' as BaseShell });
  const [error, setError] = useState('');

  function refresh() {
    setLoading(true);
    rolesAPI
      .getAll()
      .then((list: Role[]) => setRoles(list))
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar papéis'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { refresh(); }, []);

  function selectRole(role: Role) {
    setSelectedId(role.id);
    const merged = emptyMatrix();
    for (const m of MODULES) {
      if (role.permissions?.[m.id]) merged[m.id] = { ...EMPTY_PERMISSIONS, ...role.permissions[m.id] };
    }
    setDraftPermissions(merged);
  }

  function toggle(moduleId: PermissionModule, action: keyof ModulePermissions) {
    setDraftPermissions((prev) => ({
      ...prev,
      [moduleId]: { ...prev[moduleId], [action]: !prev[moduleId][action] },
    }));
  }

  async function handleSave() {
    if (!selectedId) return;
    setSaving(true);
    setError('');
    try {
      await rolesAPI.update(selectedId, { permissions: draftPermissions });
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar permissões');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    setError('');
    if (!newRole.name.trim() || !newRole.label.trim()) {
      setError('Preencha nome interno e rótulo do papel.');
      return;
    }
    try {
      setSaving(true);
      await rolesAPI.create({ ...newRole, name: newRole.name.trim().toLowerCase().replace(/\s+/g, '-'), permissions: emptyMatrix() });
      setNewRole({ name: '', label: '', baseShell: 'tecnico' });
      setShowNewForm(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar papel');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(role: Role) {
    if (role.isSystem) return;
    if (!confirm(`Excluir o papel "${role.label}"?`)) return;
    try {
      await rolesAPI.delete(role.id);
      if (selectedId === role.id) setSelectedId(null);
      refresh();
    } catch {
      alert('Falha ao excluir papel.');
    }
  }

  const selectedRole = roles.find((r) => r.id === selectedId) || null;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm flex items-center gap-1.5" style={{ color: '#193A2A' }}>
          <ShieldCheck className="w-4 h-4" />Papéis & Permissões ({roles.length})
        </h2>
        <Button size="sm" className="text-white" style={{ backgroundColor: '#AA8933' }} onClick={() => setShowNewForm(!showNewForm)}>
          <Plus className="w-4 h-4 mr-1.5" />Novo Papel
        </Button>
      </div>

      {error && <div className="text-xs text-red-600 bg-red-50 rounded p-2">{error}</div>}

      {showNewForm && (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Nome interno *</label>
              <Input placeholder="ex: auditor" value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Rótulo *</label>
              <Input placeholder="ex: Auditor" value={newRole.label} onChange={(e) => setNewRole({ ...newRole, label: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Casca de tela</label>
              <select
                value={newRole.baseShell}
                onChange={(e) => setNewRole({ ...newRole, baseShell: e.target.value as BaseShell })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="tecnico">Técnico</option>
                <option value="supervisor">Supervisor</option>
                <option value="superadm">Administrador</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-400">A casca de tela decide qual das 3 telas do app esse papel usa. As permissões começam todas desmarcadas — ajuste depois de criar.</p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowNewForm(false)}>Cancelar</Button>
            <Button className="flex-1 text-white" style={{ backgroundColor: '#193A2A' }} onClick={handleCreate} disabled={saving}>
              {saving ? 'Criando...' : 'Criar Papel'}
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
        <div className="space-y-2">
          {loading && <div className="text-xs text-gray-400 p-3">Carregando...</div>}
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => selectRole(role)}
              className="w-full text-left p-3 rounded-lg border transition-colors"
              style={{
                borderColor: selectedId === role.id ? '#AA8933' : '#e5e7eb',
                backgroundColor: selectedId === role.id ? 'rgba(170,137,51,0.08)' : 'white',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: '#193A2A' }}>{role.label}</span>
                {role.isSystem && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">sistema</span>}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">{role.name} · casca: {role.baseShell}</div>
            </button>
          ))}
        </div>

        <Card className="p-4">
          {!selectedRole && <div className="text-sm text-gray-400 text-center py-8">Selecione um papel para editar as permissões.</div>}
          {selectedRole && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm" style={{ color: '#193A2A' }}>Matriz de permissões — {selectedRole.label}</h3>
                {!selectedRole.isSystem && (
                  <button onClick={() => handleDelete(selectedRole)} className="text-gray-300 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-1.5 pr-2 font-normal">Módulo</th>
                      {ACTIONS.map((a) => (
                        <th key={a.id} className="py-1.5 px-2 font-normal text-center">{a.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MODULES.map((m) => (
                      <tr key={m.id} className="border-t border-gray-100">
                        <td className="py-2 pr-2" style={{ color: '#193A2A' }}>{m.label}</td>
                        {ACTIONS.map((a) => (
                          <td key={a.id} className="py-2 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={draftPermissions[m.id]?.[a.id] ?? false}
                              onChange={() => toggle(m.id, a.id)}
                              className="w-4 h-4 accent-[#193A2A]"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end pt-2">
                <Button size="sm" className="text-white" style={{ backgroundColor: '#193A2A' }} onClick={handleSave} disabled={saving}>
                  <Save className="w-3.5 h-3.5 mr-1.5" />{saving ? 'Salvando...' : 'Salvar permissões'}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
