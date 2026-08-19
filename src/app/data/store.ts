import type {
  AppData,
  SystemUser,
  Belt,
  BeltStation,
  ChecklistTemplate,
  SeverityOption,
  InspectionOrder,
  Inspection,
  StationInspection,
  MediaItem,
  SystemLog,
} from './types';
import { STORAGE_KEY, TOKEN_KEY } from './constants';
import { enqueueMutation, runSyncCycle } from '@/sync/engine';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const LOG_RESET_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 horas

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Helpers de Storage ──────────────────────────────────────────────────────

export function getStore(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (!parsed.belts) parsed.belts = [];
      if (!parsed.beltStations) parsed.beltStations = [];
      if (!parsed.checklistTemplates) parsed.checklistTemplates = [];
      if (!parsed.severities) parsed.severities = [];
      if (!parsed.inspectionOrders) parsed.inspectionOrders = [];
      if (!parsed.inspections) parsed.inspections = [];
      if (!parsed.media) parsed.media = [];
      if (!parsed.systemLogs) parsed.systemLogs = [];
      if (!parsed.logsLastReset) parsed.logsLastReset = new Date().toISOString();
      return parsed;
    }
  } catch {
    // corrompido – resetar
  }
  return getInitialData();
}

/**
 * Grava a cópia local (localStorage) e notifica os componentes. Não fala com
 * o servidor diretamente — quem chama é responsável por também enfileirar a
 * mutação específica via enqueueMutation() quando o que mudou precisa ser
 * sincronizado (a maioria dos casos; logs locais são a exceção).
 */
export function saveStore(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('dataRefresh', { detail: { timestamp: Date.now(), source: 'local-write' } }));
  } catch (err) {
    console.error('[Storage] Falha ao gravar localmente:', err);
  }
}

/**
 * Hidratação inicial: roda um ciclo completo de sincronização (drena
 * qualquer mutação pendente de uma sessão anterior, depois busca tudo do
 * servidor) antes da UI renderizar de verdade.
 */
export async function loadFromBackend(): Promise<void> {
  await runSyncCycle();
}

export function getInitialData(): AppData {
  // Tudo começa vazio de propósito — nenhum dado de exemplo é semeado aqui.
  // O catálogo de checklist/severidades vem do servidor (semeado no boot do
  // backend) assim que o primeiro pull autenticado completa; correias e
  // estações ficam vazias até a importação dos dados reais da planta.
  return {
    users: [],
    belts: [],
    beltStations: [],
    checklistTemplates: [],
    severities: [],
    inspectionOrders: [],
    inspections: [],
    media: [],
    activityLog: [],
    systemLogs: [],
    logsLastReset: new Date().toISOString(),
  };
}

export function resetStore(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function refreshCurrentData(): void {
  window.dispatchEvent(new CustomEvent('dataRefresh', { detail: { timestamp: Date.now() } }));
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function authenticate(email: string, password: string): Promise<SystemUser | null> {
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;

    const { token, user } = await res.json();
    localStorage.setItem(TOKEN_KEY, token);

    const store = getStore();
    const idx = store.users.findIndex((u) => u.id === user.id);
    const merged: SystemUser = { ...(idx >= 0 ? store.users[idx] : {}), ...user } as SystemUser;
    if (idx >= 0) store.users[idx] = merged;
    else store.users.push(merged);
    saveStore(store);

    runSyncCycle().catch(() => {});
    return merged;
  } catch (err) {
    console.error('[Auth] Falha no login:', err);
    return null;
  }
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ─── IDs ─────────────────────────────────────────────────────────────────────

export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * ID de ordem de inspeção curto e rastreável: OI-AAAAMMDD-XXXX.
 */
export function generateOrderId(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `OI-${datePart}-${suffix}`;
}

/**
 * ID de inspeção no formato INS-AAAAMMDD-TAGCORREIA-XXX exigido — gerado no
 * dispositivo, sem round-trip ao servidor, porque a inspeção precisa nascer
 * com um ID mesmo 100% offline. Por isso o sufixo é um código curto
 * aleatório (não um contador sequencial estrito, que exigiria consultar o
 * servidor) — mesma lógica já usada em generateOrderId(). O backend também
 * sabe gerar um sufixo sequencial (001, 002...) para inspeções criadas
 * diretamente pela API sem um id do cliente.
 */
export function generateInspectionId(beltTag: string): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `INS-${datePart}-${beltTag}-${suffix}`;
}

// ─── Correias ────────────────────────────────────────────────────────────────

export function getBelts(): Belt[] {
  return getStore().belts;
}
export function getBeltById(id: string): Belt | undefined {
  return getStore().belts.find((b) => b.id === id);
}
export function addBelt(belt: Belt): void {
  const store = getStore();
  store.belts.push(belt);
  addSystemLog({ level: 'info', module: 'Correias', message: `Nova correia cadastrada: ${belt.tag} — ${belt.name}` });
  saveStore(store);
  enqueueMutation('belts', 'create', belt.id, belt);
}
export function updateBelt(updated: Belt): void {
  const store = getStore();
  const idx = store.belts.findIndex((b) => b.id === updated.id);
  if (idx >= 0) store.belts[idx] = updated;
  saveStore(store);
  enqueueMutation('belts', 'update', updated.id, updated);
}
export function deleteBelt(id: string): void {
  const store = getStore();
  store.belts = store.belts.filter((b) => b.id !== id);
  saveStore(store);
  enqueueMutation('belts', 'delete', id);
}

// ─── Estações ────────────────────────────────────────────────────────────────

export function getStationsByBelt(beltId: string): BeltStation[] {
  return getStore()
    .beltStations.filter((s) => s.beltId === beltId)
    .sort((a, b) => a.ordem - b.ordem);
}
export function getStationById(id: string): BeltStation | undefined {
  return getStore().beltStations.find((s) => s.id === id);
}
export function addStation(station: BeltStation): void {
  const store = getStore();
  store.beltStations.push(station);
  saveStore(store);
  enqueueMutation('beltStations', 'create', station.id, station);
}
export function updateStation(updated: BeltStation): void {
  const store = getStore();
  const idx = store.beltStations.findIndex((s) => s.id === updated.id);
  if (idx >= 0) store.beltStations[idx] = updated;
  saveStore(store);
  enqueueMutation('beltStations', 'update', updated.id, updated);
}
export function deleteStation(id: string): void {
  const store = getStore();
  store.beltStations = store.beltStations.filter((s) => s.id !== id);
  saveStore(store);
  enqueueMutation('beltStations', 'delete', id);
}

// ─── Checklist templates ───────────────────────────────────────────────────

export function getChecklistTemplates(): ChecklistTemplate[] {
  return getStore().checklistTemplates;
}
/** Itens de checklist aplicáveis a uma estação: o modelo específico do tipo
 * dela, ou o modelo 'geral' como fallback. */
export function getChecklistForStationType(stationType: string): ChecklistTemplate | undefined {
  const templates = getChecklistTemplates();
  return templates.find((t) => t.appliesTo === stationType) ?? templates.find((t) => t.appliesTo === 'geral');
}
export function addChecklistTemplate(tpl: ChecklistTemplate): void {
  const store = getStore();
  store.checklistTemplates.push(tpl);
  saveStore(store);
  enqueueMutation('checklistTemplates', 'create', tpl.id, tpl);
}
export function updateChecklistTemplate(updated: ChecklistTemplate): void {
  const store = getStore();
  const idx = store.checklistTemplates.findIndex((t) => t.id === updated.id);
  if (idx >= 0) store.checklistTemplates[idx] = updated;
  saveStore(store);
  enqueueMutation('checklistTemplates', 'update', updated.id, updated);
}
export function deleteChecklistTemplate(id: string): void {
  const store = getStore();
  store.checklistTemplates = store.checklistTemplates.filter((t) => t.id !== id);
  saveStore(store);
  enqueueMutation('checklistTemplates', 'delete', id);
}

// ─── Severidades ─────────────────────────────────────────────────────────────

export function getSeverities(): SeverityOption[] {
  return getStore().severities;
}
export function addSeverity(sev: SeverityOption): void {
  const store = getStore();
  store.severities.push(sev);
  saveStore(store);
  enqueueMutation('severities', 'create', sev.id, sev);
}

// ─── Ordens de Inspeção (demandas) ─────────────────────────────────────────

/** Cria e já inicia uma inspeção "livre" (rota escolhida pelo próprio
 * técnico, fora de uma demanda enviada pelo supervisor) — usado quando o
 * técnico escolhe a correia direto na busca por TAG ou no mapa satélite. */
export function createFreeInspectionOrder(beltId: string, userId: string, userName: string): InspectionOrder {
  const now = new Date().toISOString();
  const order: InspectionOrder = {
    id: generateOrderId(),
    beltId,
    technicianId: userId,
    supervisorId: '',
    priority: 'media',
    deadline: now,
    scheduledDate: now,
    status: 'pendente',
    routeMode: 'livre',
    createdAt: now,
    activityLog: [],
  };
  addInspectionOrder(order);
  return order;
}

export function getOrdersByTechnician(technicianId: string): InspectionOrder[] {
  return getStore().inspectionOrders.filter((o) => o.technicianId === technicianId);
}
export function getPendingOrders(technicianId: string): InspectionOrder[] {
  return getOrdersByTechnician(technicianId).filter((o) => o.status === 'pendente');
}
export function getActiveOrders(technicianId: string): InspectionOrder[] {
  return getOrdersByTechnician(technicianId).filter((o) => o.status === 'em-andamento' || o.status === 'pausado');
}
export function getAllInspectionOrders(): InspectionOrder[] {
  return getStore().inspectionOrders;
}
export function getInspectionOrderById(id: string): InspectionOrder | undefined {
  return getStore().inspectionOrders.find((o) => o.id === id);
}

function syncOrder(order: InspectionOrder) {
  enqueueMutation('inspectionOrders', 'update', order.id, order);
}
function syncInspection(insp: Inspection) {
  enqueueMutation('inspections', 'update', insp.id, insp);
}

export function addInspectionOrder(order: InspectionOrder): void {
  const store = getStore();
  store.inspectionOrders.push(order);
  addSystemLog({ level: 'info', module: 'Ordens', message: `Nova ordem de inspeção criada: ${order.id}` });
  saveStore(store);
  enqueueMutation('inspectionOrders', 'create', order.id, order);
}
export function updateInspectionOrder(updated: InspectionOrder): void {
  const store = getStore();
  const idx = store.inspectionOrders.findIndex((o) => o.id === updated.id);
  if (idx >= 0) store.inspectionOrders[idx] = updated;
  saveStore(store);
  enqueueMutation('inspectionOrders', 'update', updated.id, updated);
}
export function deleteInspectionOrder(id: string): void {
  const store = getStore();
  store.inspectionOrders = store.inspectionOrders.filter((o) => o.id !== id);
  saveStore(store);
  enqueueMutation('inspectionOrders', 'delete', id);
}

/** Monta a lista de estações vazias (status 'pendente') prontas para o
 * checklist, na ordem da rota da correia. */
function buildEmptyStations(beltId: string): StationInspection[] {
  return getStationsByBelt(beltId).map((s) => ({
    stationId: s.id,
    stationName: s.name,
    stationType: s.type,
    status: 'pendente',
    checklist: (getChecklistForStationType(s.type)?.items ?? []).map((item) => ({
      itemId: item.id,
      label: item.label,
      result: 'pendente' as const,
      mediaIds: [],
    })),
    roleteAnomalies: [],
    mediaIds: [],
  }));
}

/** Inicia (ou retoma) uma ordem de inspeção — cria o registro de Inspection
 * na primeira vez, ou apenas reabre o já existente se estava pausado. */
export function startOrder(orderId: string, userId: string, userName: string): InspectionOrder | null {
  const store = getStore();
  const order = store.inspectionOrders.find((o) => o.id === orderId);
  if (!order) return null;

  const now = new Date().toISOString();
  const isFirstStart = !order.startedAt;
  order.status = 'em-andamento';
  order.startedAt = order.startedAt || now;
  order.resumedAt = now;

  if (!order.activityLog) order.activityLog = [];
  order.activityLog.push({
    timestamp: now, userId, userName,
    action: isFirstStart ? 'Ordem iniciada' : 'Ordem retomada',
    details: 'Status: em andamento',
  });

  let insp = store.inspections.find((i) => i.orderId === orderId);
  if (!insp) {
    const belt = store.belts.find((b) => b.id === order.beltId);
    const supervisor = store.users.find((u) => u.id === order.supervisorId);
    insp = {
      id: generateInspectionId(belt?.tag || 'CORREIA'),
      orderId,
      beltId: order.beltId,
      beltTag: belt?.tag || order.beltId,
      beltName: belt?.name || order.beltId,
      supervisorId: order.supervisorId,
      supervisorNome: supervisor?.name || order.supervisorId,
      tecnicoId: userId,
      tecnicoNome: userName,
      dataHoraAbertura: now,
      status: 'em-andamento',
      routeMode: order.routeMode || 'sugerida',
      stations: buildEmptyStations(order.beltId),
      anomalias: [],
      historicoPausas: [],
      origem: 'app',
    };
    store.inspections.push(insp);
    order.inspectionId = insp.id;
    enqueueMutation('inspections', 'create', insp.id, insp);
  } else {
    insp.status = 'em-andamento';
    const lastPause = insp.historicoPausas[insp.historicoPausas.length - 1];
    if (lastPause && !lastPause.resumedAt) lastPause.resumedAt = now;
    syncInspection(insp);
  }

  addSystemLog({ level: 'info', module: 'Ordens', message: `Ordem ${orderId} iniciada por ${userName}` });
  saveStore(store);
  syncOrder(order);
  return order;
}

export function pauseOrder(orderId: string, userId: string, userName: string, motivo?: string): InspectionOrder | null {
  const store = getStore();
  const order = store.inspectionOrders.find((o) => o.id === orderId);
  if (!order) return null;

  const now = new Date().toISOString();
  order.status = 'pausado';
  order.pausedAt = now;
  if (!order.activityLog) order.activityLog = [];
  order.activityLog.push({ timestamp: now, userId, userName, action: 'Ordem pausada', details: motivo || 'Pausado pelo técnico' });

  const insp = store.inspections.find((i) => i.orderId === orderId);
  if (insp) {
    insp.status = 'pausado';
    insp.historicoPausas.push({ pausedAt: now, motivo, userId, userName });
    syncInspection(insp);
  }

  addSystemLog({ level: 'info', module: 'Ordens', message: `Ordem ${orderId} pausada por ${userName}` });
  saveStore(store);
  syncOrder(order);
  return order;
}

export function completeOrder(orderId: string, userId: string, userName: string): InspectionOrder | null {
  const store = getStore();
  const order = store.inspectionOrders.find((o) => o.id === orderId);
  if (!order) return null;

  const now = new Date().toISOString();
  order.status = 'concluido';
  order.completedAt = now;
  if (!order.activityLog) order.activityLog = [];
  order.activityLog.push({ timestamp: now, userId, userName, action: 'Ordem concluída', details: 'Inspeção finalizada pelo técnico' });

  const insp = store.inspections.find((i) => i.orderId === orderId);
  if (insp) {
    insp.status = 'concluido';
    insp.dataHoraFim = now;
    syncInspection(insp);

    const belt = store.belts.find((b) => b.id === order.beltId);
    if (belt) {
      const hasCritico = insp.stations.some((s) => s.status === 'critico');
      const hasAtencao = insp.stations.some((s) => s.status === 'atencao');
      belt.healthStatus = hasCritico ? 'critico' : hasAtencao ? 'atencao' : 'saudavel';
      belt.critica = hasCritico;
      enqueueMutation('belts', 'update', belt.id, belt);
    }
  }

  addSystemLog({ level: 'success', module: 'Ordens', message: `Ordem ${orderId} concluída por ${userName}` });
  saveStore(store);
  syncOrder(order);
  return order;
}

/** Salva o progresso do checklist (chamado a cada resposta, para nunca
 * perder trabalho em caso de fechamento inesperado do app). */
export function saveInspectionProgress(inspectionId: string, stations: StationInspection[], observacoesGerais?: string): void {
  const store = getStore();
  const insp = store.inspections.find((i) => i.id === inspectionId);
  if (!insp) return;
  insp.stations = stations;
  insp.anomalias = stations.flatMap((s) => s.roleteAnomalies);
  if (observacoesGerais !== undefined) insp.observacoesGerais = observacoesGerais;
  saveStore(store);
  syncInspection(insp);
}

export function signInspection(inspectionId: string, nome: string, imagemBase64?: string): void {
  const store = getStore();
  const insp = store.inspections.find((i) => i.id === inspectionId);
  if (!insp) return;
  insp.assinatura = { nome, dataHora: new Date().toISOString(), imagemBase64 };
  saveStore(store);
  syncInspection(insp);
}

export function getInspections(): Inspection[] {
  return getStore().inspections;
}
export function getInspectionById(id: string): Inspection | undefined {
  return getStore().inspections.find((i) => i.id === id);
}
export function getInspectionByOrderId(orderId: string): Inspection | undefined {
  return getStore().inspections.find((i) => i.orderId === orderId);
}

// ─── Mídia (fotos / vídeos / áudios) ───────────────────────────────────────

export function addMedia(item: MediaItem): void {
  const store = getStore();
  store.media.push(item);
  saveStore(store);
  enqueueMutation('media', 'create', item.id, item);
}
export function getMediaForInspection(inspectionId: string): MediaItem[] {
  return getStore().media.filter((m) => m.inspectionId === inspectionId);
}
export function deleteMedia(id: string): void {
  const store = getStore();
  store.media = store.media.filter((m) => m.id !== id);
  saveStore(store);
  enqueueMutation('media', 'delete', id);
}

// ─── Usuários (CRUD passa pela API autenticada — nunca pelo outbox genérico,
// porque criar/trocar senha exige hash feito no servidor) ────────────────────

export async function addUser(user: SystemUser & { password?: string }): Promise<SystemUser> {
  const { password, ...rest } = user;
  const res = await fetch(`${API_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ ...rest, password }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Falha ao criar usuário');
  const created = await res.json();

  const store = getStore();
  store.users.push(created);
  addSystemLog({ level: 'info', module: 'Usuários', message: `Novo usuário criado: ${created.name} (${created.role})` });
  saveStore(store);
  return created;
}

export async function updateUser(updated: SystemUser & { password?: string }): Promise<SystemUser> {
  const { password, ...rest } = updated;
  const res = await fetch(`${API_URL}/users/${updated.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ ...rest, ...(password ? { password } : {}) }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Falha ao atualizar usuário');
  const saved = await res.json();

  const store = getStore();
  const idx = store.users.findIndex((u) => u.id === saved.id);
  if (idx >= 0) store.users[idx] = saved;
  saveStore(store);
  return saved;
}

export async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/users/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok && res.status !== 204) throw new Error('Falha ao excluir usuário');

  const store = getStore();
  store.users = store.users.filter((u) => u.id !== id);
  saveStore(store);
}

export function updateUserProfile(userId: string, updates: Partial<SystemUser> & { password?: string }): void {
  const store = getStore();
  const idx = store.users.findIndex((u) => u.id === userId);
  if (idx < 0) return;
  const { password, ...rest } = updates;
  store.users[idx] = { ...store.users[idx], ...rest };
  saveStore(store);

  fetch(`${API_URL}/users/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ ...rest, ...(password ? { password } : {}) }),
  }).catch((err) => console.error('[Perfil] Falha ao salvar no servidor:', err));
}

export function getUserById(id: string): SystemUser | undefined {
  return getStore().users.find((u) => u.id === id);
}

// ─── System Log helpers (locais a este dispositivo — não sincronizados) ─────

export function addSystemLog(entry: Omit<SystemLog, 'id' | 'timestamp'>): void {
  try {
    const store = getStore();
    if (!store.systemLogs) store.systemLogs = [];
    const lastReset = store.logsLastReset ? new Date(store.logsLastReset).getTime() : 0;
    if (Date.now() - lastReset > LOG_RESET_INTERVAL_MS) {
      store.systemLogs = [];
      store.logsLastReset = new Date().toISOString();
      store.systemLogs.push({ id: generateId(), timestamp: new Date().toISOString(), level: 'info', module: 'Sistema', message: 'Logs resetados automaticamente (ciclo 24h)' });
    }
    store.systemLogs.push({ id: generateId(), timestamp: new Date().toISOString(), ...entry });
    if (store.systemLogs.length > 500) store.systemLogs = store.systemLogs.slice(-500);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent('dataRefresh', { detail: { timestamp: Date.now(), source: 'system-log' } }));
  } catch {
    // silent fail
  }
}

export function getSystemLogs(): SystemLog[] {
  return (getStore().systemLogs ?? []).slice().reverse();
}

export function resetSystemLogs(): void {
  const store = getStore();
  store.systemLogs = [];
  store.logsLastReset = new Date().toISOString();
  store.systemLogs.push({ id: generateId(), timestamp: new Date().toISOString(), level: 'info', module: 'Sistema', message: 'Logs resetados manualmente pelo administrador' });
  saveStore(store);
}

export function getLogsNextReset(): Date | null {
  const store = getStore();
  if (!store.logsLastReset) return null;
  return new Date(new Date(store.logsLastReset).getTime() + LOG_RESET_INTERVAL_MS);
}
