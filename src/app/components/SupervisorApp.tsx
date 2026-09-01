import { useEffect, useState } from 'react';
import {
  LogOut,
  RefreshCw,
  Plus,
  Layers,
  ClipboardList,
  LayoutDashboard,
  Trash2,
  Wrench,
  X,
  FileText,
  Download,
} from 'lucide-react';
import guardCorreiasIcon from '../../assets/brand/guardcorreias-logo.png';
import grupoLogo from '../../assets/brand/grupo-mvv-bnmc.png';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Textarea } from './ui/textarea';
import {
  getStore,
  getAreas,
  addBelt,
  deleteBelt,
  addInspectionOrder,
  updateInspectionOrder,
  getMaintenanceHistoryForBelt,
  generateId,
  generateOrderId,
} from '../data/store';
import { settingsAPI, inspectionsAPI } from '@/api/client';
import { downloadBlob } from '@/utils/backupManager';
import type { Belt, InspectionOrder, Inspection } from '../data/types';
import { HEALTH_STATUS_COLORS, HEALTH_STATUS_LABELS } from '../data/beltStatus';
import { forceSync, useDataSync } from '@/hooks/useDataSync';
import type { User } from '../App';

interface SupervisorAppProps {
  user: User;
  onLogout: () => void;
}

type Tab = 'visao-geral' | 'correias' | 'ordens' | 'relatorios';

export function SupervisorApp({ user, onLogout }: SupervisorAppProps) {
  const [activeTab, setActiveTab] = useState<Tab>('visao-geral');
  const [syncing, setSyncing] = useState(false);
  const { syncCounter } = useDataSync();

  const [belts, setBelts] = useState<Belt[]>([]);
  const [orders, setOrders] = useState<InspectionOrder[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [technicians, setTechnicians] = useState<{ id: string; name: string }[]>([]);

  function refresh() {
    const store = getStore();
    setBelts(store.belts);
    setOrders(store.inspectionOrders);
    setInspections(store.inspections);
    setTechnicians(store.users.filter((u) => u.role === 'tecnico').map((u) => ({ id: u.id, name: u.name })));
  }

  useEffect(() => { refresh(); }, [syncCounter]);

  async function handleForceSync() {
    setSyncing(true);
    await forceSync();
    setSyncing(false);
    refresh();
  }

  const pendingCount = orders.filter((o) => o.status === 'pendente').length;
  const activeCount = orders.filter((o) => o.status === 'em-andamento' || o.status === 'pausado').length;
  const criticalCount = belts.filter((b) => b.healthStatus === 'critico').length;

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
            <div className="text-white text-xs opacity-75">Supervisor</div>
            <div className="text-white text-sm">{user.name}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleForceSync} disabled={syncing} className="text-white hover:bg-white/10">
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="ghost" size="sm" onClick={onLogout} className="text-white hover:bg-white/10">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex px-4 gap-1 pb-2">
          {([
            { id: 'visao-geral', label: 'Visão Geral', icon: LayoutDashboard },
            { id: 'correias', label: 'Correias', icon: Layers },
            { id: 'ordens', label: 'Ordens de Inspeção', icon: ClipboardList },
            { id: 'relatorios', label: 'Relatórios', icon: FileText },
          ] as const).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ backgroundColor: active ? 'rgba(170,137,51,0.25)' : 'transparent', color: active ? '#AA8933' : 'rgba(255,255,255,0.7)' }}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 p-4">
        {activeTab === 'visao-geral' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Correias cadastradas', val: belts.length, color: '#193A2A' },
                { label: 'Ordens pendentes', val: pendingCount, color: '#AA8933' },
                { label: 'Em andamento', val: activeCount, color: '#2563eb' },
                { label: 'Correias críticas', val: criticalCount, color: '#dc2626' },
              ].map((s) => (
                <Card key={s.label} className="p-4 text-center">
                  <div className="text-2xl" style={{ color: s.color }}>{s.val}</div>
                  <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                </Card>
              ))}
            </div>

            {criticalCount > 0 && (
              <Card className="p-4">
                <h3 className="text-sm mb-3" style={{ color: '#193A2A' }}>Prioridade — precisa de atenção agora</h3>
                <div className="space-y-2">
                  {belts.filter((b) => b.healthStatus === 'critico').map((b) => (
                    <div key={b.id} className="flex items-center gap-2 text-sm">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: HEALTH_STATUS_COLORS.critico }} />
                      <span>{b.tag} — {b.name}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card className="p-4">
              <h3 className="text-sm mb-3" style={{ color: '#193A2A' }}>Últimas Ordens</h3>
              {orders.length === 0 ? (
                <p className="text-xs text-gray-400">Nenhuma ordem criada ainda.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {orders.slice(0, 8).map((o) => {
                    const belt = belts.find((b) => b.id === o.beltId);
                    return (
                      <div key={o.id} className="py-2 flex items-center justify-between text-sm">
                        <span>{belt ? `${belt.tag} — ${belt.name}` : o.beltId}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{o.status}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === 'correias' && (
          <BeltsPanel belts={belts} onRefresh={refresh} />
        )}

        {activeTab === 'ordens' && (
          <OrdersPanel orders={orders} belts={belts} technicians={technicians} onRefresh={refresh} />
        )}

        {activeTab === 'relatorios' && (
          <ReportsPanel inspections={inspections} />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Correias
// ─────────────────────────────────────────────────────────────────────────────

const BELT_FORM_DEFAULTS = {
  tag: '', name: '', area: '', tipoCorreia: '', lat: '', lng: '',
  comprimento: '', largura: '', velocidade: '', capacidade: '',
  critica: false, status: 'ativa' as Belt['status'], observation: '',
};

function BeltsPanel({ belts, onRefresh }: { belts: Belt[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedBelt, setSelectedBelt] = useState<Belt | null>(null);
  const [form, setForm] = useState(BELT_FORM_DEFAULTS);
  const [error, setError] = useState('');
  const areas = getAreas();
  const [tagPattern, setTagPattern] = useState({ pattern: '', example: '2101-CV-001' });

  useEffect(() => {
    settingsAPI.get('general').then((s: { tagPattern?: string; tagPatternExample?: string }) => {
      if (s?.tagPattern) setTagPattern({ pattern: s.tagPattern, example: s.tagPatternExample || tagPattern.example });
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCreateBelt() {
    setError('');
    if (!form.tag.trim() || !form.name.trim()) {
      setError('Preencha ao menos TAG e nome.');
      return;
    }
    if (tagPattern.pattern) {
      try {
        if (!new RegExp(tagPattern.pattern).test(form.tag.trim().toUpperCase())) {
          setError(`TAG fora do padrão esperado (ex: ${tagPattern.example}).`);
          return;
        }
      } catch {
        // padrão configurado inválido — não bloqueia o cadastro por causa disso
      }
    }
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
    const belt: Belt = {
      id: generateId(),
      tag: form.tag.trim().toUpperCase(),
      name: form.name.trim(),
      area: form.area.trim() || undefined,
      tipoCorreia: form.tipoCorreia.trim() || undefined,
      comprimento: form.comprimento ? Number(form.comprimento) : undefined,
      largura: form.largura ? Number(form.largura) : undefined,
      velocidade: form.velocidade ? Number(form.velocidade) : undefined,
      capacidade: form.capacidade ? Number(form.capacidade) : undefined,
      path: hasCoords ? [{ lat, lng }, { lat: lat + 0.0015, lng: lng + 0.0015 }] : [],
      lat: hasCoords ? lat : undefined,
      lng: hasCoords ? lng : undefined,
      healthStatus: 'saudavel',
      critica: form.critica,
      status: form.status,
      observation: form.observation.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    addBelt(belt);
    setForm(BELT_FORM_DEFAULTS);
    setShowForm(false);
    onRefresh();
  }

  function handleDeleteBelt(id: string) {
    if (!confirm('Excluir esta correia?')) return;
    deleteBelt(id);
    onRefresh();
  }

  if (selectedBelt) {
    return <BeltDetailPanel belt={selectedBelt} onBack={() => setSelectedBelt(null)} />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm" style={{ color: '#193A2A' }}>Correias Cadastradas ({belts.length})</h2>
        <Button size="sm" className="text-white" style={{ backgroundColor: '#AA8933' }} onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1.5" />Nova Correia
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">TAG *</label>
              <Input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder={tagPattern.example} />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Área</label>
              <select
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Selecione...</option>
                {areas.map((a) => <option key={a.id} value={a.name}>{a.code} — {a.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Nome *</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Correia Transportadora 03" />
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Tipo de correia</label>
            <Input
              value={form.tipoCorreia}
              onChange={(e) => setForm({ ...form, tipoCorreia: e.target.value })}
              placeholder='Ex.: 36" x 3 lonas x coberturas 5/16" – 1/8" EXTRA ABRASÃO - 1100 METROS'
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Latitude (cabeça)</label>
              <Input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="-9.6734" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Longitude (cabeça)</label>
              <Input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="-36.7430" />
            </div>
          </div>
          <p className="text-[11px] text-gray-400">Coordenadas são opcionais — sem elas a correia não aparece no mapa satélite ainda, mas pode ser usada normalmente nas inspeções.</p>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Comprimento (m)</label>
              <Input type="number" value={form.comprimento} onChange={(e) => setForm({ ...form, comprimento: e.target.value })} placeholder="450" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Largura (mm)</label>
              <Input type="number" value={form.largura} onChange={(e) => setForm({ ...form, largura: e.target.value })} placeholder="1000" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Velocidade (m/s)</label>
              <Input type="number" value={form.velocidade} onChange={(e) => setForm({ ...form, velocidade: e.target.value })} placeholder="3.5" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Capacidade (t/h)</label>
              <Input type="number" value={form.capacidade} onChange={(e) => setForm({ ...form, capacidade: e.target.value })} placeholder="770" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Situação operacional</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Belt['status'] })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="ativa">Ativa</option>
                <option value="inativa">Inativa</option>
                <option value="manutencao">Em manutenção</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600 mb-1">
              <input type="checkbox" checked={form.critica} onChange={(e) => setForm({ ...form, critica: e.target.checked })} className="w-4 h-4 accent-[#193A2A]" />
              Correia crítica (prioridade de inspeção)
            </label>
          </div>

          <div>
            <label className="text-xs text-gray-600 mb-1 block">Observações</label>
            <Textarea value={form.observation} onChange={(e) => setForm({ ...form, observation: e.target.value })} rows={2} />
          </div>

          {error && <div className="text-xs text-red-600 bg-red-50 rounded p-2">{error}</div>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button className="flex-1 text-white" style={{ backgroundColor: '#193A2A' }} onClick={handleCreateBelt}>Criar Correia</Button>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {belts.map((belt) => (
          <Card key={belt.id} className="p-3.5 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: HEALTH_STATUS_COLORS[belt.healthStatus] }} />
            <button className="flex-1 min-w-0 text-left" onClick={() => setSelectedBelt(belt)}>
              <div className="text-sm" style={{ color: '#193A2A' }}>{belt.tag} — {belt.name}</div>
              <div className="text-xs text-gray-500">
                {belt.area || '—'} · {HEALTH_STATUS_LABELS[belt.healthStatus]}
              </div>
            </button>
            <button onClick={() => handleDeleteBelt(belt.id)} className="text-gray-300 hover:text-red-500 shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </Card>
        ))}
        {belts.length === 0 && !showForm && (
          <Card className="p-8 text-center text-sm text-gray-400">Nenhuma correia cadastrada ainda.</Card>
        )}
      </div>
    </div>
  );
}

/**
 * Ficha da correia: dados de cadastro + Histórico de Manutenção/Troca —
 * derivado automaticamente das inspeções concluídas dessa correia que
 * tiveram algum item NOK com nº de OM preenchido (ver getMaintenanceHistoryForBelt
 * em src/app/data/store.ts). Não é uma tabela editável — evita registrar o
 * mesmo dado duas vezes (uma na inspeção, outra "à mão" aqui).
 */
function BeltDetailPanel({ belt, onBack }: { belt: Belt; onBack: () => void }) {
  const history = getMaintenanceHistoryForBelt(belt.id);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 text-sm">← Correias</button>
      </div>

      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: HEALTH_STATUS_COLORS[belt.healthStatus] }} />
          <h2 className="text-sm" style={{ color: '#193A2A' }}>{belt.tag} — {belt.name}</h2>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-600 pt-1">
          <div>Área: <span className="text-gray-800">{belt.area || '—'}</span></div>
          <div>Saúde: <span className="text-gray-800">{HEALTH_STATUS_LABELS[belt.healthStatus]}</span></div>
          <div>Comprimento: <span className="text-gray-800">{belt.comprimento ? `${belt.comprimento} m` : '—'}</span></div>
          <div>Largura: <span className="text-gray-800">{belt.largura ? `${belt.largura} mm` : '—'}</span></div>
          <div>Velocidade: <span className="text-gray-800">{belt.velocidade ? `${belt.velocidade} m/s` : '—'}</span></div>
          <div>Capacidade: <span className="text-gray-800">{belt.capacidade ? `${belt.capacidade} t/h` : '—'}</span></div>
        </div>
        {belt.tipoCorreia && (
          <div className="pt-1">
            <div className="text-xs text-gray-500">Tipo de correia</div>
            <div className="text-sm text-gray-800">{belt.tipoCorreia}</div>
          </div>
        )}
        {belt.observation && (
          <div className="pt-1">
            <div className="text-xs text-gray-500">Observações</div>
            <div className="text-sm text-gray-800">{belt.observation}</div>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5 text-gray-400" />
          <h3 className="text-sm" style={{ color: '#193A2A' }}>Histórico de Manutenção/Troca ({history.length})</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {history.map((h) => (
            <div key={h.inspectionId} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-500">{new Date(h.data).toLocaleDateString('pt-BR')}</span>
                {h.ordem && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">OM: {h.ordem}</span>}
              </div>
              <div className="text-sm text-gray-800 mt-0.5">{h.atividade}</div>
            </div>
          ))}
          {history.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              Nenhuma manutenção registrada ainda — aparece aqui automaticamente quando uma inspeção concluída tiver algum item NOK com nº de OM preenchido.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ordens de Inspeção
// ─────────────────────────────────────────────────────────────────────────────

function OrdersPanel({
  orders, belts, technicians, onRefresh,
}: {
  orders: InspectionOrder[];
  belts: Belt[];
  technicians: { id: string; name: string }[];
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ omNumero: '', beltId: '', technicianId: '', priority: 'media' as InspectionOrder['priority'], deadline: '', notes: '' });
  const [formError, setFormError] = useState('');

  function handleCreateOrder() {
    if (!form.omNumero.trim()) {
      setFormError('Informe o número da OM antes de criar a ordem.');
      return;
    }
    if (!form.beltId || !form.technicianId) return;
    setFormError('');
    const now = new Date().toISOString();
    const order: InspectionOrder = {
      id: generateOrderId(),
      omNumero: form.omNumero.trim(),
      beltId: form.beltId,
      technicianId: form.technicianId,
      supervisorId: '',
      priority: form.priority,
      deadline: form.deadline || now,
      scheduledDate: now,
      status: 'pendente',
      routeMode: 'sugerida',
      createdAt: now,
      supervisorNotes: form.notes || undefined,
      activityLog: [],
    };
    addInspectionOrder(order);
    setForm({ omNumero: '', beltId: '', technicianId: '', priority: 'media', deadline: '', notes: '' });
    setShowForm(false);
    onRefresh();
  }

  function handleCancel(order: InspectionOrder) {
    updateInspectionOrder({ ...order, status: 'cancelado' });
    onRefresh();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm" style={{ color: '#193A2A' }}>Ordens de Inspeção ({orders.length})</h2>
        <Button size="sm" className="text-white" style={{ backgroundColor: '#AA8933' }} onClick={() => setShowForm(!showForm)} disabled={belts.length === 0 || technicians.length === 0}>
          <Plus className="w-4 h-4 mr-1.5" />Nova Ordem
        </Button>
      </div>

      {(belts.length === 0 || technicians.length === 0) && (
        <Card className="p-3 text-xs text-amber-700 bg-amber-50 border-amber-200">
          {belts.length === 0 ? 'Cadastre ao menos uma correia antes de criar uma ordem.' : 'Cadastre ao menos um técnico (aba Usuários do Admin) antes de criar uma ordem.'}
        </Card>
      )}

      {showForm && (
        <Card className="p-4 space-y-3">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Nº da OM *</label>
            <Input
              value={form.omNumero}
              onChange={(e) => { setForm({ ...form, omNumero: e.target.value }); setFormError(''); }}
              placeholder="Ex.: 123456"
              className="text-sm"
            />
          </div>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Correia *</label>
            <select value={form.beltId} onChange={(e) => setForm({ ...form, beltId: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Selecione...</option>
              {belts.map((b) => <option key={b.id} value={b.id}>{b.tag} — {b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Técnico *</label>
            <select value={form.technicianId} onChange={(e) => setForm({ ...form, technicianId: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Selecione...</option>
              {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Prioridade</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as InspectionOrder['priority'] })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Prazo</label>
              <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Observações para o técnico</label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button className="flex-1 text-white" style={{ backgroundColor: '#193A2A' }} onClick={handleCreateOrder}>Enviar Demanda</Button>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {orders.map((o) => {
          const belt = belts.find((b) => b.id === o.beltId);
          const tech = technicians.find((t) => t.id === o.technicianId);
          return (
            <Card key={o.id} className="p-3.5 flex items-center gap-3">
              <div className="flex-1">
                <div className="text-sm" style={{ color: '#193A2A' }}>{belt ? `${belt.tag} — ${belt.name}` : o.beltId}</div>
                <div className="text-xs text-gray-500">{tech?.name || o.technicianId} · {o.id}</div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{o.status}</span>
              {o.status === 'pendente' && (
                <button onClick={() => handleCancel(o)} className="text-gray-300 hover:text-red-500 shrink-0">
                  <X className="w-4 h-4" />
                </button>
              )}
            </Card>
          );
        })}
        {orders.length === 0 && !showForm && (
          <Card className="p-8 text-center text-sm text-gray-400">Nenhuma ordem de inspeção criada ainda.</Card>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Relatórios
// ─────────────────────────────────────────────────────────────────────────────

function ReportsPanel({ inspections }: { inspections: Inspection[] }) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const completed = [...inspections]
    .filter((i) => i.status === 'concluido')
    .sort((a, b) => (b.dataHoraFim || b.dataHoraAbertura).localeCompare(a.dataHoraFim || a.dataHoraAbertura));

  async function handleDownload(insp: Inspection) {
    setDownloadingId(insp.id);
    try {
      const blob = await inspectionsAPI.exportZip(insp.id);
      downloadBlob(blob, `${insp.id}.zip`);
    } catch {
      alert('Falha ao baixar o relatório. Verifique sua conexão e tente novamente.');
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h2 className="text-sm" style={{ color: '#193A2A' }}>Relatórios de Inspeção ({completed.length})</h2>
      <p className="text-xs text-gray-500">
        Cada download traz uma pasta com as fotos da inspeção e uma planilha (relatorio.xlsx) organizada com os 10 itens do checklist, resultado, observações e nº de OM.
      </p>

      <div className="space-y-2">
        {completed.map((insp) => (
          <Card key={insp.id} className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#f0fdf4' }}>
              <FileText className="w-4 h-4" style={{ color: '#16a34a' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate" style={{ color: '#193A2A' }}>{insp.beltTag} — {insp.beltName}</div>
              <div className="text-xs text-gray-500">
                {(insp.dataHoraFim || insp.dataHoraAbertura).slice(0, 10)} · {insp.tecnicoNome}
                {insp.omNumero && ` · OM ${insp.omNumero}`}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDownload(insp)}
              disabled={downloadingId === insp.id}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              {downloadingId === insp.id ? 'Baixando...' : 'Baixar'}
            </Button>
          </Card>
        ))}
        {completed.length === 0 && (
          <Card className="p-8 text-center text-sm text-gray-400">Nenhuma inspeção concluída ainda.</Card>
        )}
      </div>
    </div>
  );
}
