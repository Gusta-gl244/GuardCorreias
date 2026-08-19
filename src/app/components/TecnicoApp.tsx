import { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList,
  Map as MapIcon,
  Settings,
  LogOut,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Pause,
  Play,
  Camera,
  User as UserIcon,
  Lock,
  Info,
  Calendar,
  RefreshCw,
  Search,
  PlayCircle,
} from 'lucide-react';
import guardCorreiasIcon from '../../assets/brand/guardcorreias-logo.png';
import grupoLogo from '../../assets/brand/grupo-mvv-bnmc.png';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { InspectionFlow } from './tecnico/InspectionFlow';
import { BeltMapComponent } from './tecnico/BeltMapComponent';
import {
  getStore,
  getPendingOrders,
  getActiveOrders,
  startOrder,
  getBeltById,
  createFreeInspectionOrder,
  updateUserProfile,
} from '../data/store';
import type { InspectionOrder, Belt } from '../data/types';
import { HEALTH_STATUS_COLORS } from '../data/beltStatus';
import type { User } from '../App';
import { forceSync, useDataSync } from '@/hooks/useDataSync';

interface TecnicoAppProps {
  user: User;
  onLogout: () => void;
}

type Tab = 'demandas' | 'mapa' | 'config';
type Screen =
  | { type: 'menu' }
  | { type: 'order-detail'; orderId: string }
  | { type: 'inspection'; orderId: string }
  | { type: 'belt-picker' };

export function TecnicoApp({ user, onLogout }: TecnicoAppProps) {
  const [activeTab, setActiveTab] = useState<Tab>('demandas');
  const [screen, setScreen] = useState<Screen>({ type: 'menu' });
  const [pendingOrders, setPendingOrders] = useState<InspectionOrder[]>([]);
  const [activeOrders, setActiveOrders] = useState<InspectionOrder[]>([]);
  const [belts, setBelts] = useState<Belt[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'info' } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [beltSearch, setBeltSearch] = useState('');
  const { syncCounter } = useDataSync();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(user.avatar);
  const [settingsSaved, setSettingsSaved] = useState(false);

  function refresh() {
    setPendingOrders(getPendingOrders(user.id));
    setActiveOrders(getActiveOrders(user.id));
    setBelts(getStore().belts);
  }

  useEffect(() => {
    refresh();
  }, [user.id, syncCounter]);

  const criticalBelts = useMemo(() => belts.filter((b) => b.healthStatus === 'critico'), [belts]);
  const filteredBelts = useMemo(() => {
    const q = beltSearch.trim().toLowerCase();
    if (!q) return belts;
    return belts.filter((b) => b.tag.toLowerCase().includes(q) || b.name.toLowerCase().includes(q));
  }, [belts, beltSearch]);

  async function handleForceSync() {
    setSyncing(true);
    const success = await forceSync();
    setSyncing(false);
    refresh();
    showToast(success ? '✅ Dados sincronizados com sucesso!' : '⚠️ Erro ao sincronizar. Tente novamente.', success ? 'success' : 'info');
  }

  function showToast(msg: string, type: 'success' | 'info' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function handleStartOrder(orderId: string) {
    const updated = startOrder(orderId, user.id, user.name);
    if (updated) {
      refresh();
      setScreen({ type: 'inspection', orderId });
    }
  }

  function handleStartFreeInspection(beltId: string) {
    const order = createFreeInspectionOrder(beltId, user.id, user.name);
    handleStartOrder(order.id);
  }

  function handleResumeOrder(orderId: string) {
    startOrder(orderId, user.id, user.name);
    refresh();
    setScreen({ type: 'inspection', orderId });
  }

  function handleOrderComplete() {
    refresh();
    setScreen({ type: 'menu' });
    setActiveTab('demandas');
    showToast('Inspeção concluída com sucesso!');
  }

  function handleOrderPause() {
    refresh();
    setScreen({ type: 'menu' });
    setActiveTab('demandas');
    showToast('Progresso salvo. Inspeção pausada.', 'info');
  }

  function handleBackFromOrder() {
    refresh();
    setScreen({ type: 'menu' });
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function handleSaveSettings() {
    if (newPassword && newPassword !== confirmPassword) {
      showToast('As senhas não coincidem.', 'info');
      return;
    }
    const updates: Record<string, string> = {};
    if (avatarPreview) updates.avatar = avatarPreview;
    if (newPassword) updates.password = newPassword;
    updateUserProfile(user.id, updates);
    setSettingsSaved(true);
    setNewPassword('');
    setConfirmPassword('');
    showToast('Configurações salvas!');
    setTimeout(() => setSettingsSaved(false), 2000);
  }

  // ── Tela de inspeção ativa ───────────────────────────────────────────────
  if (screen.type === 'inspection') {
    const store = getStore();
    const order = store.inspectionOrders.find((o) => o.id === screen.orderId);
    if (!order) { setScreen({ type: 'menu' }); return null; }
    return (
      <InspectionFlow
        order={order}
        user={user}
        onBack={handleBackFromOrder}
        onComplete={handleOrderComplete}
        onPause={handleOrderPause}
      />
    );
  }

  // ── Seletor de correia (TAG / busca / mapa) ──────────────────────────────
  if (screen.type === 'belt-picker') {
    return (
      <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f5f5f5' }}>
        <div className="sticky top-0 z-10 shadow-sm" style={{ backgroundColor: '#193A2A' }}>
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => setScreen({ type: 'menu' })} className="text-white">
              <ChevronRight className="w-6 h-6 rotate-180" />
            </button>
            <div className="text-white text-sm">Selecionar Correia</div>
          </div>
          <div className="px-4 pb-3 relative">
            <Search className="w-4 h-4 absolute left-7 top-1/2 -translate-y-1/2 text-white/50" />
            <Input
              value={beltSearch}
              onChange={(e) => setBeltSearch(e.target.value)}
              placeholder="Buscar por TAG ou nome..."
              className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/50"
            />
          </div>
        </div>

        <div className="flex-1 p-4 space-y-2 pb-8">
          {filteredBelts.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center shadow-sm">
              <p className="text-sm text-gray-500">Nenhuma correia encontrada.</p>
            </div>
          ) : (
            filteredBelts.map((belt) => (
              <button
                key={belt.id}
                onClick={() => handleStartFreeInspection(belt.id)}
                className="w-full bg-white rounded-xl p-3.5 shadow-sm flex items-center gap-3 text-left"
              >
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: HEALTH_STATUS_COLORS[belt.healthStatus] }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm" style={{ color: '#193A2A' }}>{belt.tag}</div>
                  <div className="text-xs text-gray-500 truncate">{belt.name}</div>
                </div>
                <PlayCircle className="w-5 h-5 text-gray-300 shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // ── Badges auxiliares ────────────────────────────────────────────────────
  function PriorityBadge({ priority }: { priority: string }) {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      alta: { label: 'Alta', color: '#dc2626', bg: '#fee2e2' },
      media: { label: 'Média', color: '#AA8933', bg: '#fff8e1' },
      baixa: { label: 'Baixa', color: '#193A2A', bg: '#e8f5e9' },
    };
    const c = map[priority] || map.baixa;
    return <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: c.color, backgroundColor: c.bg }}>{c.label}</span>;
  }

  function OrderCard({ order, showResume = false }: { order: InspectionOrder; showResume?: boolean }) {
    const belt = getBeltById(order.beltId);
    const isLate = order.deadline ? new Date(order.deadline) < new Date() : false;
    const isPaused = order.status === 'pausado';

    return (
      <Card className="overflow-hidden shadow-sm">
        <div className="h-1" style={{ backgroundColor: '#193A2A' }} />
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <PriorityBadge priority={order.priority} />
                {order.routeMode === 'livre' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Rota livre</span>
                )}
                {isPaused && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex items-center gap-1">
                    <Pause className="w-2.5 h-2.5" />Pausada
                  </span>
                )}
              </div>
              <h3 className="text-sm" style={{ color: '#193A2A' }}>{belt ? `${belt.tag} — ${belt.name}` : 'Correia não encontrada'}</h3>
              {belt?.area && <div className="text-xs text-gray-500 mt-0.5">{belt.area}</div>}
            </div>
            <div className="text-right shrink-0">
              {order.deadline && (
                <div className="flex items-center gap-1 text-xs" style={{ color: isLate ? '#dc2626' : '#6b7280' }}>
                  <Calendar className="w-3 h-3" />
                  <span>{new Date(order.deadline).toLocaleDateString('pt-BR')}</span>
                </div>
              )}
              {isLate && <div className="text-xs text-red-500 flex items-center gap-1 mt-0.5"><AlertTriangle className="w-3 h-3" />Atrasado</div>}
            </div>
          </div>

          <div className="flex gap-2">
            {showResume ? (
              <Button size="sm" className="flex-1 text-white" style={{ backgroundColor: '#193A2A' }} onClick={() => handleResumeOrder(order.id)}>
                <Play className="w-4 h-4 mr-1.5" />Continuar
              </Button>
            ) : (
              <Button size="sm" className="flex-1 text-white" style={{ backgroundColor: '#AA8933' }} onClick={() => handleStartOrder(order.id)}>
                <Play className="w-4 h-4 mr-1.5" />Iniciar
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setScreen({ type: 'order-detail', orderId: order.id })}>
              <Info className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // ── Detalhe da demanda ───────────────────────────────────────────────────
  if (screen.type === 'order-detail') {
    const store = getStore();
    const order = store.inspectionOrders.find((o) => o.id === screen.orderId);
    if (!order) { setScreen({ type: 'menu' }); return null; }
    const belt = getBeltById(order.beltId);
    const isPaused = order.status === 'pausado';
    const isPending = order.status === 'pendente';

    return (
      <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f5f5f5' }}>
        <div className="sticky top-0 z-10 shadow-sm" style={{ backgroundColor: '#193A2A' }}>
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => setScreen({ type: 'menu' })} className="text-white">
              <ChevronRight className="w-6 h-6 rotate-180" />
            </button>
            <div className="text-white text-sm">Detalhes da Demanda</div>
          </div>
        </div>

        <div className="flex-1 p-4 pb-32 space-y-4">
          {belt && (
            <Card className="p-4">
              <div className="text-xs text-gray-500 mb-1">Correia</div>
              <div className="text-base" style={{ color: '#193A2A' }}>{belt.tag} — {belt.name}</div>
              <div className="text-xs text-gray-500">{belt.area || '—'}</div>
            </Card>
          )}

          <Card className="p-4 space-y-3">
            {order.supervisorNotes && (
              <div>
                <div className="text-xs text-gray-500">Observações do Supervisor</div>
                <div className="text-sm">{order.supervisorNotes}</div>
              </div>
            )}
            {order.deadline && (
              <div>
                <div className="text-xs text-gray-500">Prazo</div>
                <div className="text-sm">{new Date(order.deadline).toLocaleDateString('pt-BR')}</div>
              </div>
            )}
          </Card>

          {order.activityLog && order.activityLog.length > 0 && (
            <Card className="p-4">
              <div className="text-xs text-gray-500 mb-2">Histórico</div>
              <div className="space-y-2">
                {order.activityLog.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: '#AA8933' }} />
                    <div>
                      <span className="text-gray-700">{log.action}</span>
                      <span className="text-gray-400 ml-1">– {new Date(log.timestamp).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3">
          {(isPending || isPaused) && (
            <Button className="w-full text-white" style={{ backgroundColor: '#AA8933' }} onClick={() => handleStartOrder(order.id)}>
              <Play className="w-4 h-4 mr-2" />{isPaused ? 'Continuar' : 'Iniciar'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Menu principal ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f5f5f5' }}>
      {toast && (
        <div className="fixed top-4 left-4 right-4 z-50 rounded-xl px-4 py-3 shadow-lg text-white text-sm text-center transition-all"
          style={{ backgroundColor: toast.type === 'success' ? '#193A2A' : '#AA8933' }}>
          {toast.msg}
        </div>
      )}

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
            <div className="text-white text-xs opacity-75">Técnico</div>
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

      <div className="flex-1 pb-20 overflow-y-auto">
        {activeTab === 'demandas' && (
          <div className="p-4 space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 bg-white rounded-xl p-3 shadow-sm text-center">
                <div className="text-xl" style={{ color: '#193A2A' }}>{pendingOrders.length}</div>
                <div className="text-xs text-gray-500">Pendentes</div>
              </div>
              <div className="flex-1 bg-white rounded-xl p-3 shadow-sm text-center">
                <div className="text-xl" style={{ color: '#AA8933' }}>{activeOrders.length}</div>
                <div className="text-xs text-gray-500">Em andamento</div>
              </div>
              <div className="flex-1 bg-white rounded-xl p-3 shadow-sm text-center">
                <div className="text-xl" style={{ color: '#dc2626' }}>{criticalBelts.length}</div>
                <div className="text-xs text-gray-500">Correias críticas</div>
              </div>
            </div>

            <Button
              className="w-full text-white h-14 text-base"
              style={{ backgroundColor: '#AA8933' }}
              onClick={() => setScreen({ type: 'belt-picker' })}
            >
              <PlayCircle className="w-5 h-5 mr-2" />
              Iniciar Inspeção
            </Button>

            {criticalBelts.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs text-gray-500 uppercase tracking-wide px-1">Correias Críticas — Atenção</h2>
                {criticalBelts.map((belt) => (
                  <button
                    key={belt.id}
                    onClick={() => handleStartFreeInspection(belt.id)}
                    className="w-full bg-white rounded-xl p-3 shadow-sm flex items-center gap-3 text-left border-l-4"
                    style={{ borderColor: '#dc2626' }}
                  >
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm" style={{ color: '#193A2A' }}>{belt.tag} — {belt.name}</div>
                      <div className="text-xs text-gray-500">{belt.area || '—'}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {pendingOrders.length === 0 && activeOrders.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center shadow-sm">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: '#193A2A' }} />
                <h3 className="text-sm" style={{ color: '#193A2A' }}>Sem demandas do dia</h3>
                <p className="text-xs text-gray-500 mt-1">Você está em dia com suas atividades.</p>
              </div>
            ) : (
              <>
                {pendingOrders.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-xs text-gray-500 uppercase tracking-wide px-1">Minhas Demandas do Dia</h2>
                    {pendingOrders.map((order) => <OrderCard key={order.id} order={order} />)}
                  </div>
                )}
                {activeOrders.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-xs text-gray-500 uppercase tracking-wide px-1">Em Andamento / Pausadas</h2>
                    {activeOrders.map((order) => <OrderCard key={order.id} order={order} showResume />)}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'mapa' && (
          <div className="p-3 h-[calc(100vh-140px)]">
            <BeltMapComponent
              belts={belts}
              stations={getStore().beltStations}
              onBeltClick={(belt) => handleStartFreeInspection(belt.id)}
              onStationClick={(station) => handleStartFreeInspection(station.beltId)}
            />
          </div>
        )}

        {activeTab === 'config' && (
          <div className="p-4 space-y-4">
            <Card className="p-4">
              <h3 className="text-sm mb-3" style={{ color: '#193A2A' }}>Foto de Perfil</h3>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center" style={{ backgroundColor: '#193A2A' }}>
                  {avatarPreview ? <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" /> : <UserIcon className="w-8 h-8 text-white" />}
                </div>
                <div>
                  <label className="cursor-pointer">
                    <span className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg text-white" style={{ backgroundColor: '#AA8933' }}>
                      <Camera className="w-4 h-4" />Alterar foto
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </label>
                  <p className="text-xs text-gray-500 mt-1">JPG, PNG (máx. 2MB)</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <h3 className="text-sm" style={{ color: '#193A2A' }}>Informações da Conta</h3>
              <div><div className="text-xs text-gray-500">Nome</div><div className="text-sm">{user.name}</div></div>
              <div><div className="text-xs text-gray-500">E-mail</div><div className="text-sm">{user.email}</div></div>
              <div><div className="text-xs text-gray-500">Perfil</div><div className="text-sm">Técnico de Campo</div></div>
            </Card>

            <Card className="p-4 space-y-3">
              <h3 className="text-sm flex items-center gap-2" style={{ color: '#193A2A' }}>
                <Lock className="w-4 h-4" />Alterar Senha
              </h3>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Nova senha</label>
                <Input type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Confirmar nova senha</label>
                <Input type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
              <Button className="w-full text-white" style={{ backgroundColor: '#193A2A' }} onClick={handleSaveSettings}>
                {settingsSaved ? <><CheckCircle2 className="w-4 h-4 mr-2" />Salvo!</> : 'Salvar alterações'}
              </Button>
            </Card>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-10">
        <div className="flex">
          {(
            [
              { id: 'demandas', label: 'Demandas', icon: ClipboardList, badge: pendingOrders.length },
              { id: 'mapa', label: 'Mapa Satélite', icon: MapIcon, badge: 0 },
              { id: 'config', label: 'Configurações', icon: Settings, badge: 0 },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="flex-1 flex flex-col items-center py-2 gap-0.5 relative">
                <div className="relative">
                  <Icon className="w-5 h-5" style={{ color: active ? '#AA8933' : '#9ca3af' }} />
                  {tab.badge > 0 && (
                    <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full text-white text-[9px] flex items-center justify-center" style={{ backgroundColor: '#dc2626' }}>
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px]" style={{ color: active ? '#AA8933' : '#9ca3af' }}>{tab.label}</span>
                {active && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full" style={{ backgroundColor: '#AA8933' }} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
