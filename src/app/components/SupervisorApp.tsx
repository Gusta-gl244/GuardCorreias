import { useEffect, useState } from 'react';
import {
  LogOut,
  RefreshCw,
  Plus,
  MapPin,
  Layers,
  ClipboardList,
  LayoutDashboard,
  Trash2,
  X,
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
  addStation,
  deleteStation,
  addInspectionOrder,
  updateInspectionOrder,
  generateId,
  generateOrderId,
} from '../data/store';
import { settingsAPI } from '@/api/client';
import type { Belt, BeltStation, InspectionOrder, RoleteTipo } from '../data/types';
import { HEALTH_STATUS_COLORS, HEALTH_STATUS_LABELS } from '../data/beltStatus';
import { STATION_TYPE_LABELS } from '../data/beltConstants';
import { forceSync, useDataSync } from '@/hooks/useDataSync';
import type { User } from '../App';

interface SupervisorAppProps {
  user: User;
  onLogout: () => void;
}

type Tab = 'visao-geral' | 'correias' | 'ordens';

export function SupervisorApp({ user, onLogout }: SupervisorAppProps) {
  const [activeTab, setActiveTab] = useState<Tab>('visao-geral');
  const [syncing, setSyncing] = useState(false);
  const { syncCounter } = useDataSync();

  const [belts, setBelts] = useState<Belt[]>([]);
  const [stations, setStations] = useState<BeltStation[]>([]);
  const [orders, setOrders] = useState<InspectionOrder[]>([]);
  const [technicians, setTechnicians] = useState<{ id: string; name: string }[]>([]);

  function refresh() {
    const store = getStore();
    setBelts(store.belts);
    setStations(store.beltStations);
    setOrders(store.inspectionOrders);
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
          <BeltsPanel belts={belts} stations={stations} onRefresh={refresh} />
        )}

        {activeTab === 'ordens' && (
          <OrdersPanel orders={orders} belts={belts} technicians={technicians} onRefresh={refresh} />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Correias + Estações
// ─────────────────────────────────────────────────────────────────────────────

const BELT_FORM_DEFAULTS = {
  tag: '', name: '', area: '', lat: '', lng: '',
  comprimento: '', largura: '', velocidade: '', capacidade: '',
  critica: false, status: 'ativa' as Belt['status'], observation: '',
};

function BeltsPanel({ belts, stations, onRefresh }: { belts: Belt[]; stations: BeltStation[]; onRefresh: () => void }) {
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
    if (!confirm('Excluir esta correia? As estações vinculadas também devem ser removidas.')) return;
    deleteBelt(id);
    onRefresh();
  }

  if (selectedBelt) {
    return (
      <StationsPanel
        belt={selectedBelt}
        stations={stations.filter((s) => s.beltId === selectedBelt.id)}
        onBack={() => setSelectedBelt(null)}
        onRefresh={onRefresh}
      />
    );
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
                {belt.area || '—'} · {stations.filter((s) => s.beltId === belt.id).length} estação(ões) · {HEALTH_STATUS_LABELS[belt.healthStatus]}
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

const ROLETE_TIPOS: RoleteTipo[] = ['carga', 'retorno', 'impacto', 'alinhamento'];

function StationsPanel({ belt, stations, onBack, onRefresh }: { belt: Belt; stations: BeltStation[]; onBack: () => void; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'intermediaria' as BeltStation['type'], lat: '', lng: '', numRoletes: '3' });

  function handleCreateStation() {
    if (!form.name.trim()) return;
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    const n = Math.max(0, parseInt(form.numRoletes, 10) || 0);
    const station: BeltStation = {
      id: generateId(),
      beltId: belt.id,
      name: form.name.trim(),
      type: form.type,
      ordem: stations.length + 1,
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
      roletes: Array.from({ length: n }, (_, i) => ({
        id: generateId(),
        tipo: ROLETE_TIPOS[i % ROLETE_TIPOS.length],
        posicao: i + 1,
      })),
      createdAt: new Date().toISOString(),
    };
    addStation(station);
    setForm({ name: '', type: 'intermediaria', lat: '', lng: '', numRoletes: '3' });
    setShowForm(false);
    onRefresh();
  }

  function handleDeleteStation(id: string) {
    if (!confirm('Excluir esta estação?')) return;
    deleteStation(id);
    onRefresh();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 text-sm">← Correias</button>
      </div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm" style={{ color: '#193A2A' }}>{belt.tag} — Rota de Inspeção ({stations.length} estações)</h2>
        <Button size="sm" className="text-white" style={{ backgroundColor: '#AA8933' }} onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1.5" />Nova Estação
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 space-y-3">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Nome *</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Estação 01" />
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Tipo</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as BeltStation['type'] })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              {Object.entries(STATION_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Latitude</label>
              <Input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="-9.6734" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Longitude</label>
              <Input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="-36.7430" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Número de roletes</label>
            <Input type="number" min={0} value={form.numRoletes} onChange={(e) => setForm({ ...form, numRoletes: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button className="flex-1 text-white" style={{ backgroundColor: '#193A2A' }} onClick={handleCreateStation}>Criar Estação</Button>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {stations.sort((a, b) => a.ordem - b.ordem).map((s) => (
          <Card key={s.id} className="p-3.5 flex items-center gap-3">
            <MapPin className="w-4 h-4 text-gray-300 shrink-0" />
            <div className="flex-1">
              <div className="text-sm" style={{ color: '#193A2A' }}>{s.ordem}. {s.name}</div>
              <div className="text-xs text-gray-500">{STATION_TYPE_LABELS[s.type]} · {s.roletes.length} roletes</div>
            </div>
            <button onClick={() => handleDeleteStation(s.id)} className="text-gray-300 hover:text-red-500 shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </Card>
        ))}
        {stations.length === 0 && !showForm && (
          <Card className="p-8 text-center text-sm text-gray-400">Nenhuma estação cadastrada — o técnico não conseguirá iniciar uma inspeção nesta correia até cadastrar ao menos uma.</Card>
        )}
      </div>
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
  const [form, setForm] = useState({ beltId: '', technicianId: '', priority: 'media' as InspectionOrder['priority'], deadline: '', notes: '' });

  function handleCreateOrder() {
    if (!form.beltId || !form.technicianId) return;
    const now = new Date().toISOString();
    const order: InspectionOrder = {
      id: generateOrderId(),
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
    setForm({ beltId: '', technicianId: '', priority: 'media', deadline: '', notes: '' });
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
