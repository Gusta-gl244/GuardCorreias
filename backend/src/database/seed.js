import bcrypt from 'bcryptjs';
import * as queries from './queries-postgres.js';

/**
 * Matriz de permissões padrão dos 3 papéis do sistema — ponto de partida
 * editável depois pelo admin em Papéis & Permissões. Cada módulo tem 4
 * ações (view/create/edit/delete); módulos omitidos ficam totalmente
 * fechados (equivalente a todas as ações "false").
 *
 * Duas decisões não óbvias, ligadas a fluxos que já existem no app:
 * - "tecnico" tem belts.edit (não só view): ao concluir uma inspeção, o app
 *   recalcula sozinho healthStatus/critica da correia (ver completeOrder em
 *   src/app/data/store.ts) — isso É uma escrita em "belts" partindo do
 *   técnico, então sem essa permissão a funcionalidade existente quebraria.
 * - "tecnico" tem inspectionOrders.create/edit (não só view): ele cria
 *   ordens livres ao escolher uma correia direto no mapa (routeMode
 *   'livre'), e inicia/pausa/conclui ordens atualizando o próprio status.
 */
const FULL = { view: true, create: true, edit: true, delete: true };
const VIEW_ONLY = { view: true, create: false, edit: false, delete: false };
const NONE = { view: false, create: false, edit: false, delete: false };

const DEFAULT_PERMISSIONS = {
  tecnico: {
    users: NONE,
    roles: NONE,
    areas: VIEW_ONLY,
    belts: { view: true, create: false, edit: true, delete: false },
    checklistTemplates: VIEW_ONLY,
    severities: VIEW_ONLY,
    inspectionOrders: { view: true, create: true, edit: true, delete: false },
    inspections: { view: true, create: true, edit: true, delete: false },
    media: { view: true, create: true, edit: false, delete: false },
    settings: NONE,
    auditLog: NONE,
    backups: NONE,
  },
  supervisor: {
    users: VIEW_ONLY,
    roles: NONE,
    areas: VIEW_ONLY,
    belts: FULL,
    checklistTemplates: VIEW_ONLY,
    severities: VIEW_ONLY,
    inspectionOrders: FULL,
    inspections: { view: true, create: false, edit: true, delete: false },
    media: { view: true, create: false, edit: true, delete: false },
    settings: NONE,
    auditLog: NONE,
    backups: NONE,
  },
  superadm: {
    users: FULL,
    roles: FULL,
    areas: FULL,
    belts: FULL,
    checklistTemplates: FULL,
    severities: FULL,
    inspectionOrders: FULL,
    inspections: FULL,
    media: FULL,
    settings: FULL,
    auditLog: FULL,
    backups: FULL,
  },
};

/**
 * Semeia os 3 papéis do sistema (isSystem: true — não podem ser renomeados
 * nem excluídos, mas a matriz de permissões continua editável pelo admin).
 * "baseShell" igual ao nome nos 3 casos porque são os papéis originais do
 * app; papéis customizados criados depois podem apontar para qualquer uma
 * das 3 cascas de UI.
 */
export async function seedRolesIfEmpty() {
  const existing = await queries.getAllRoles();
  if (existing.length > 0) return;

  console.log('🔐 Nenhum papel encontrado — semeando os 3 papéis do sistema...');
  const roles = [
    { name: 'tecnico', label: 'Técnico', baseShell: 'tecnico' },
    { name: 'supervisor', label: 'Supervisor', baseShell: 'supervisor' },
    { name: 'superadm', label: 'Administrador', baseShell: 'superadm' },
  ];
  for (const r of roles) {
    await queries.createRole({ ...r, isSystem: true, permissions: DEFAULT_PERMISSIONS[r.name] });
  }
  console.log('✅ Papéis do sistema semeados.');
}

/**
 * Semeia o catálogo de áreas com os códigos reais do Projeto Serrote
 * (Mineração Vale Verde) — ver Referencias/SR-0000-PRC-CP-0001-R-10.pdf,
 * pág. 2. Editável depois pelo admin; isso só evita começar com a lista
 * vazia quando a convenção real já é conhecida.
 */
export async function seedAreasIfEmpty() {
  const existing = await queries.getAllAreas();
  if (existing.length > 0) return;

  console.log('🗺️  Nenhuma área encontrada — semeando catálogo de áreas...');
  const areas = [
    { code: '2101', name: 'Britagem Primária' },
    { code: '2102', name: 'Britagem Secundária/Terciária' },
    { code: '2103', name: 'Peneiramento Terciário' },
    { code: '2201', name: 'Pilha de Estocagem' },
    { code: '2202', name: 'Moagem' },
    { code: '2203', name: 'Flotação e Remoagem' },
    { code: '2205', name: 'Espessador de Rejeito' },
    { code: '2206', name: 'Espessador e Tanque de Concentrado' },
    { code: '2207', name: 'Filtragem e Estocagem de Concentrado' },
    { code: '2208', name: 'Reagentes' },
    { code: '2209', name: 'Casa de Compressores' },
    { code: '2212', name: 'Reservatório/Tratamento/Bombeamento de Água' },
  ];
  for (const a of areas) await queries.createArea(a);
  console.log('✅ Catálogo de áreas semeado.');
}

/**
 * Cria exatamente 3 contas reais (senha com hash de verdade, gravadas no
 * Postgres) só na primeira vez que o sistema sobe com a tabela de usuários
 * vazia — bootstrap de banco, não um mock embutido no bundle do frontend.
 * Nenhuma correia/estação é semeada aqui — o cadastro de ativos fica vazio
 * até a importação dos dados reais da planta.
 */
export async function seedTestAccountsIfEmpty() {
  const existing = await queries.getAllUsers();
  if (existing.length > 0) return;

  console.log('👤 Nenhum usuário encontrado — criando as 3 contas de teste iniciais...');

  const accounts = [
    { name: 'Técnico Teste', email: 'tecnico@guardcorreias.com', role: 'tecnico' },
    { name: 'Supervisor Teste', email: 'supervisor@guardcorreias.com', role: 'supervisor' },
    { name: 'Administrador', email: 'admin@guardcorreias.com', role: 'superadm' },
  ];
  const password = 'guardcorreias';
  const passwordHash = await bcrypt.hash(password, 10);

  for (const acc of accounts) {
    await queries.createUser({ ...acc, passwordHash, status: 'active' });
  }

  console.log(`✅ Contas de teste criadas (senha para todas: "${password}"). Altere depois de testar.`);
}

/**
 * Semeia as severidades padrão (baixa/média/alta/crítica) e o checklist
 * único de inspeção de correia — só na primeira vez que essas tabelas
 * estiverem vazias. Diferente das contas de teste, isso NÃO é dado
 * inventado sobre o ativo físico (correias continuam vazias); é
 * configuração de sistema (escala de severidade, itens de checklist).
 *
 * Os 10 itens do checklist são os mesmos, na mesma ordem, da planilha real
 * usada hoje em campo (form FL04-75-21031, "Chek list - Inspeção de
 * correias.xlsx") — não é mais um checklist genérico inventado, é o
 * processo real do cliente. Editável depois pelo admin em Checklists.
 */
export async function seedDefaultsIfEmpty() {
  const severities = await queries.getAllSeverities();
  if (severities.length === 0) {
    console.log('⚙️  Semeando severidades padrão...');
    const defaults = [
      { id: 'baixa', label: 'Baixa', color: '#16a34a', points: 1, description: 'Sem risco imediato, acompanhar na próxima rota' },
      { id: 'media', label: 'Média', color: '#AA8933', points: 2, description: 'Necessita atenção em breve' },
      { id: 'alta', label: 'Alta', color: '#ea580c', points: 3, description: 'Risco relevante, priorizar manutenção' },
      { id: 'critica', label: 'Crítica', color: '#dc2626', points: 4, description: 'Risco de parada não programada, ação imediata' },
    ];
    for (const s of defaults) await queries.createSeverity(s);
  }

  // Roda em TODO boot (não só "se vazio"): garante que existe exatamente um
  // checklist, o canônico ("checklist-inspecao-correia", os 10 itens reais
  // da planilha FL04-75-21031) — e remove qualquer outro que tenha sobrado
  // de antes da reestruturação (ex.: "checklist-estacao-padrao", 12 itens
  // genéricos inventados). Sem isso, um banco de produção que já existia
  // antes dessa mudança ficaria com os dois templates ao mesmo tempo, e o
  // app (que hoje assume "um checklist só") podia acabar usando o errado.
  const templates = await queries.getAllChecklistTemplates();
  const canonicalId = 'checklist-inspecao-correia';
  for (const t of templates) {
    if (t.id !== canonicalId) {
      console.log(`🧹 Removendo checklist obsoleto de antes da reestruturação: "${t.name}" (${t.id})`);
      await queries.deleteChecklistTemplate(t.id);
    }
  }
  const hasCanonical = templates.some((t) => t.id === canonicalId);
  if (!hasCanonical) {
    console.log('⚙️  Semeando checklist único de inspeção de correia...');
    const defaultTemplate = {
      id: canonicalId,
      name: 'Checklist de Inspeção de Correia',
      icon: '📋',
      appliesTo: 'geral',
      weight: 1,
      items: [
        { id: 'emenda-borda', label: 'Emenda e Borda' },
        { id: 'guias-materiais', label: 'Guias de Materiais' },
        { id: 'estado-correia', label: 'Estado da Correia Transportadora' },
        { id: 'rolo-motriz-movido', label: 'Rolo Motriz e Movido' },
        { id: 'roletes-carga-retorno-alinhantes', label: 'Roletes de Carga, Retorno e Auto Alinhantes' },
        { id: 'raspadores-borrachas', label: 'Raspadores e Borrachas de Contenção' },
        { id: 'estrutura-protecoes-contrapeso', label: 'Estrutura e Proteções de Tambores de Contrapeso' },
        { id: 'alinhamento-correia', label: 'Alinhamento da Correia' },
        { id: 'material-acumulado-limpeza', label: 'Material Acumulado e Limpeza' },
        { id: 'cabos-roldanas-contrapeso', label: 'Cabos, Roldanas e Contrapeso' },
      ],
    };
    await queries.createChecklistTemplate(defaultTemplate);
  }
}
