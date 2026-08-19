// As 3 cascas de UI que o app sabe renderizar (TecnicoApp/SupervisorApp/
// SuperAdmApp). Um papel customizado (criado no Admin) sempre aponta para
// uma destas 3 — é o que decide qual tela ele usa, independente do nome do
// papel em si.
export type BaseShell = 'tecnico' | 'supervisor' | 'superadm';

// Nome do papel: os 3 nomes do sistema continuam existindo, mas agora é
// texto livre — um admin pode criar papéis customizados (ex.: "auditor").
export type UserRole = string | null;

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  baseShell: BaseShell;
  avatar?: string;
}

// ─── BANCO DE USUÁRIOS ────────────────────────────────────────────────────────
export interface SystemUser {
  id: string;
  name: string;
  email: string;
  // Sem campo de senha aqui de propósito: a senha nunca existe em texto
  // puro no frontend, só como hash no servidor.
  role: string;
  status: 'active' | 'inactive';
  lastLogin: string;
  avatar?: string;
  phone?: string;
  createdAt?: string;
  // Só vem preenchido na resposta de login (ver POST /api/auth/login) — uma
  // linha de "users" pura, vinda de GET /api/users, não sabe sua própria
  // casca de UI sem consultar a tabela "roles".
  baseShell?: BaseShell;
}

// ─── PAPÉIS E PERMISSÕES ───────────────────────────────────────────────────────
export interface ModulePermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export type PermissionModule =
  | 'users' | 'roles' | 'areas' | 'belts' | 'stations'
  | 'checklistTemplates' | 'severities' | 'inspectionOrders'
  | 'inspections' | 'media' | 'settings' | 'auditLog' | 'backups';

export type PermissionMatrix = Partial<Record<PermissionModule, ModulePermissions>>;

export interface Role {
  id: string;
  name: string;
  label: string;
  baseShell: BaseShell;
  isSystem: boolean;
  permissions: PermissionMatrix;
  createdAt?: string;
}

// ─── ÁREAS DA PLANTA ────────────────────────────────────────────────────────────
export interface Area {
  id: string;
  code: string;
  name: string;
  createdAt?: string;
}

// ─── CORREIAS ─────────────────────────────────────────────────────────────────
export type BeltHealthStatus = 'saudavel' | 'atencao' | 'critico';
export type BeltOperationalStatus = 'ativa' | 'inativa' | 'manutencao';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Belt {
  id: string;
  tag: string;                   // ex: CV2203
  name: string;
  area?: string;                 // Britagem Primária, Peneiramento Secundário, Moagem, etc.
  comprimento?: number;          // metros
  largura?: number;              // mm
  velocidade?: number;           // m/s
  capacidade?: number;           // t/h
  path: LatLng[];                // traçado da correia sobre o mapa satélite
  lat?: number;                  // ponto de referência (cabeça)
  lng?: number;
  healthStatus: BeltHealthStatus; // cor no mapa: verde / amarelo / vermelho
  critica?: boolean;
  status: BeltOperationalStatus;
  observation?: string;
  createdBy?: string;
  createdAt: string;
}

// ─── ESTAÇÕES DE INSPEÇÃO (cabeça → estações → retorno) ───────────────────────
export type StationType = 'cabeca' | 'intermediaria' | 'esticadora' | 'retorno' | 'descarga';
export type RoleteStatus = 'ok' | 'atencao' | 'critico' | 'nao-inspecionado';
export type RoleteTipo = 'carga' | 'retorno' | 'impacto' | 'alinhamento';

export interface Rolete {
  id: string;
  tipo: RoleteTipo;
  posicao: number;               // posição/ordem na estação, usado para desenhar o mapa de roletes
  status?: RoleteStatus;
}

export interface BeltStation {
  id: string;
  beltId: string;
  name: string;                  // ex: "Cabeça", "Estação 01", "Esticadora", "Retorno"
  type: StationType;
  ordem: number;                 // sequência na rota
  lat?: number;
  lng?: number;
  roletes: Rolete[];
  createdAt: string;
}

// ─── CHECKLIST (regras de validação por tipo de estação) ──────────────────────
export interface ChecklistItem {
  id: string;
  label: string;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  icon: string;
  appliesTo: string;             // tipo de estação (StationType) ou 'geral'
  items: ChecklistItem[];        // máximo recomendado 8–12 itens
  weight: number;
}

// ─── SEVERIDADE ────────────────────────────────────────────────────────────────
export interface SeverityOption {
  id: string;
  label: string;
  color: string;
  points: number;
  description: string;
}

// ─── ORDENS DE INSPEÇÃO (demandas criadas pelo supervisor) ────────────────────
export type InspectionOrderStatus = 'pendente' | 'em-andamento' | 'pausado' | 'concluido' | 'cancelado';
export type Priority = 'alta' | 'media' | 'baixa';
export type RouteMode = 'sugerida' | 'livre';
export type ReviewStatus = 'aguardando' | 'aprovado' | 'complemento' | 'rejeitado';

export interface ActivityLogEntry {
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  details?: string;
}

export interface InspectionOrder {
  id: string;                    // OI-AAAAMMDD-XXXX
  beltId: string;
  technicianId: string;
  supervisorId: string;
  priority: Priority;
  recorrente?: boolean;
  recorrenciaRegra?: string;     // 'diaria' | 'semanal' | 'mensal' (texto livre por ora)
  deadline: string;
  scheduledDate: string;
  status: InspectionOrderStatus;
  routeMode: RouteMode;
  createdAt: string;
  startedAt?: string;
  pausedAt?: string;
  resumedAt?: string;
  completedAt?: string;
  inspectionId?: string;         // FK → Inspection.id
  supervisorNotes?: string;
  reviewStatus?: ReviewStatus;   // revisão do supervisor após conclusão
  activityLog: ActivityLogEntry[];
}

// ─── INSPEÇÃO (registro central de campo) ──────────────────────────────────────
export type ItemResult = 'ok' | 'atencao' | 'critico' | 'pendente';
export type InspectionStatus = 'aberto' | 'em-andamento' | 'pausado' | 'concluido' | 'cancelado';

export interface ChecklistAnswer {
  itemId: string;
  label: string;
  result: ItemResult;
  observation?: string;
  mediaIds: string[];
}

export interface RoleteAnomaly {
  id: string;
  stationId: string;
  stationName: string;
  roleteId?: string;
  tipo?: RoleteTipo;
  descricao: string;
  severity: string;              // FK → SeverityOption.id
  observation?: string;
  mediaIds: string[];
}

export interface StationInspection {
  stationId: string;
  stationName: string;
  stationType: StationType;
  status: 'pendente' | 'ok' | 'atencao' | 'critico';
  checklist: ChecklistAnswer[];
  roleteAnomalies: RoleteAnomaly[];
  notes?: string;
  mediaIds: string[];
}

export interface PauseHistoryEntry {
  pausedAt: string;
  resumedAt?: string;
  motivo?: string;
  userId: string;
  userName: string;
}

export interface InspectionSignature {
  nome: string;
  dataHora: string;
  imagemBase64?: string;
}

export interface Inspection {
  id: string;                    // INS-AAAAMMDD-TAG-XXX
  orderId?: string;
  beltId: string;
  beltTag: string;
  beltName: string;
  supervisorId?: string;
  supervisorNome?: string;
  tecnicoId: string;
  tecnicoNome: string;
  dataHoraAbertura: string;
  dataHoraFim?: string;
  status: InspectionStatus;
  routeMode: RouteMode;
  stations: StationInspection[];
  anomalias: RoleteAnomaly[];    // lista achatada de todas as estações, para dashboards
  resumoAutomatico?: string;
  assinatura?: InspectionSignature;
  historicoPausas: PauseHistoryEntry[];
  observacoesGerais?: string;
  origem: 'app' | 'importado';
}

// ─── MÍDIA (fotos / vídeos / áudios de campo) ──────────────────────────────────
export type MediaType = 'foto' | 'video' | 'audio';

export interface MediaItem {
  id: string;
  inspectionId: string;          // vínculo que forma a "pasta" da inspeção
  beltTag?: string;
  tipo: MediaType;
  stationId?: string;
  roleteId?: string;
  filename: string;
  mimeType: string;
  dataBase64: string;
  sizeBytes?: number;
  lat?: number;
  lng?: number;
  capturedAt: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  module: string;
  message: string;
  userId?: string;
  userName?: string;
}

// ─── ESTADO GLOBAL DO SISTEMA ───────────────────────────────────────────────────
export interface AppData {
  users: SystemUser[];
  areas: Area[];
  belts: Belt[];
  beltStations: BeltStation[];
  checklistTemplates: ChecklistTemplate[];
  severities: SeverityOption[];
  inspectionOrders: InspectionOrder[];
  inspections: Inspection[];
  media: MediaItem[];
  activityLog: ActivityLogEntry[];
  systemLogs: SystemLog[];
  logsLastReset?: string;
}
