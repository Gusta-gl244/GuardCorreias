import { initDb, runSQL } from './postgres-connection.js';

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA
//
// Mesmo padrão do INSPEC360: cada entidade de topo é uma tabela real com
// colunas de sincronização ("updatedAt", "deletedAt" como tombstone,
// "deviceId" para saber se o registro nasceu offline). Listas aninhadas que o
// frontend sempre lê/grava como uma unidade só (roletes de uma estação,
// itens de checklist, estações+achados de uma inspeção) viram colunas JSONB
// em vez de tabelas filhas.
// ─────────────────────────────────────────────────────────────────────────────

export async function initializeDatabase() {
  console.log('🔧 Inicializando banco PostgreSQL...');

  await initDb();
  console.log('✅ Conexão PostgreSQL estabelecida');

  await runSQL(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      "passwordHash" TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      phone TEXT,
      avatar TEXT,
      "lastLogin" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      "deletedAt" TEXT
    )
  `);

  // "role" referenciava um CHECK fixo em 3 valores — removido para dar lugar
  // a papéis customizáveis (tabela "roles" abaixo). A validação de que o
  // valor corresponde a um papel existente passa a ser feita na rota, não
  // mais pelo banco (mesmo padrão já usado para a tag de correia).
  await runSQL(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);

  // ── Papéis e permissões ─────────────────────────────────────────────────
  // "baseShell" decide qual casca de UI o papel usa (TecnicoApp/SupervisorApp/
  // SuperAdmApp) — desacopla "nome do papel" de "qual tela renderiza", então
  // um papel customizado (ex.: "Auditor") pode existir sem precisar de uma
  // tela própria, herdando a casca que fizer mais sentido.
  // "permissions" é { modulo: { view, create, edit, delete } }.
  await runSQL(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      "baseShell" TEXT NOT NULL CHECK("baseShell" IN ('tecnico', 'supervisor', 'superadm')),
      "isSystem" BOOLEAN NOT NULL DEFAULT FALSE,
      permissions JSONB NOT NULL DEFAULT '{}',
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      "deletedAt" TEXT
    )
  `);

  // ── Catálogo de áreas da planta (ex.: 2101 Britagem Primária) ───────────
  await runSQL(`
    CREATE TABLE IF NOT EXISTS areas (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      "deletedAt" TEXT
    )
  `);

  // ── Correias ────────────────────────────────────────────────────────────
  await runSQL(`
    CREATE TABLE IF NOT EXISTS belts (
      id TEXT PRIMARY KEY,
      tag TEXT NOT NULL,
      name TEXT NOT NULL,
      area TEXT,
      comprimento REAL,
      largura REAL,
      velocidade REAL,
      capacidade REAL,
      path JSONB NOT NULL DEFAULT '[]',
      lat REAL,
      lng REAL,
      "healthStatus" TEXT NOT NULL DEFAULT 'saudavel' CHECK("healthStatus" IN ('saudavel', 'atencao', 'critico')),
      critica BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT NOT NULL DEFAULT 'ativa' CHECK(status IN ('ativa', 'inativa', 'manutencao')),
      observation TEXT,
      "createdBy" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      "deletedAt" TEXT,
      "deviceId" TEXT
    )
  `);

  // ── Estações de inspeção (cabeça → estações → retorno) ─────────────────
  await runSQL(`
    CREATE TABLE IF NOT EXISTS "beltStations" (
      id TEXT PRIMARY KEY,
      "beltId" TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'intermediaria' CHECK(type IN ('cabeca', 'intermediaria', 'esticadora', 'retorno', 'descarga')),
      ordem INTEGER NOT NULL DEFAULT 0,
      lat REAL,
      lng REAL,
      roletes JSONB NOT NULL DEFAULT '[]',
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      "deletedAt" TEXT,
      "deviceId" TEXT
    )
  `);

  // ── Modelos de checklist (itens padrão por tipo de estação) ────────────
  await runSQL(`
    CREATE TABLE IF NOT EXISTS "checklistTemplates" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT,
      "appliesTo" TEXT NOT NULL DEFAULT 'geral',
      items JSONB NOT NULL DEFAULT '[]',
      weight INTEGER NOT NULL DEFAULT 1,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      "deletedAt" TEXT
    )
  `);

  await runSQL(`
    CREATE TABLE IF NOT EXISTS severities (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      color TEXT,
      points INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      "deletedAt" TEXT
    )
  `);

  // ── Ordens de inspeção (demandas criadas pelo supervisor) ──────────────
  await runSQL(`
    CREATE TABLE IF NOT EXISTS "inspectionOrders" (
      id TEXT PRIMARY KEY,
      "beltId" TEXT NOT NULL,
      "technicianId" TEXT,
      "supervisorId" TEXT,
      priority TEXT CHECK(priority IN ('baixa', 'media', 'alta')),
      recorrente BOOLEAN NOT NULL DEFAULT FALSE,
      "recorrenciaRegra" TEXT,
      deadline TEXT,
      "scheduledDate" TEXT,
      status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente', 'em-andamento', 'pausado', 'concluido', 'cancelado')),
      "routeMode" TEXT NOT NULL DEFAULT 'sugerida' CHECK("routeMode" IN ('sugerida', 'livre')),
      "startedAt" TEXT,
      "pausedAt" TEXT,
      "resumedAt" TEXT,
      "completedAt" TEXT,
      "inspectionId" TEXT,
      "supervisorNotes" TEXT,
      "reviewStatus" TEXT NOT NULL DEFAULT 'aguardando' CHECK("reviewStatus" IN ('aguardando', 'aprovado', 'complemento', 'rejeitado')),
      "activityLog" JSONB NOT NULL DEFAULT '[]',
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      "deletedAt" TEXT,
      "deviceId" TEXT
    )
  `);

  // ── Inspeções (registro central, ID = INS-AAAAMMDD-TAG-XXX) ────────────
  await runSQL(`
    CREATE TABLE IF NOT EXISTS inspections (
      id TEXT PRIMARY KEY,
      "orderId" TEXT,
      "beltId" TEXT NOT NULL,
      "beltTag" TEXT,
      "beltName" TEXT,
      "supervisorId" TEXT,
      "supervisorNome" TEXT,
      "tecnicoId" TEXT,
      "tecnicoNome" TEXT,
      "dataHoraAbertura" TEXT NOT NULL,
      "dataHoraFim" TEXT,
      status TEXT NOT NULL DEFAULT 'aberto' CHECK(status IN ('aberto', 'em-andamento', 'pausado', 'concluido', 'cancelado')),
      "routeMode" TEXT NOT NULL DEFAULT 'sugerida',
      stations JSONB NOT NULL DEFAULT '[]',
      anomalias JSONB NOT NULL DEFAULT '[]',
      "resumoAutomatico" TEXT,
      assinatura JSONB,
      "historicoPausas" JSONB NOT NULL DEFAULT '[]',
      "observacoesGerais" TEXT,
      origem TEXT NOT NULL DEFAULT 'app' CHECK(origem IN ('app', 'importado')),
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      "deletedAt" TEXT,
      "deviceId" TEXT
    )
  `);

  // ── Mídias de campo (fotos/vídeos/áudios), sempre vinculadas a uma
  // inspeção — é essa vinculação que forma a "pasta por ID" exigida: não
  // existe pasta física até o momento da exportação/backup (sem disco
  // persistente no Render), mas toda mídia já nasce agrupada pelo mesmo
  // inspectionId, pronta para virar fotos/videos/audios/ num ZIP a qualquer
  // momento (ver GET /api/inspections/:id/export).
  await runSQL(`
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      "inspectionId" TEXT NOT NULL,
      "beltTag" TEXT,
      tipo TEXT NOT NULL CHECK(tipo IN ('foto', 'video', 'audio')),
      "stationId" TEXT,
      "roleteId" TEXT,
      filename TEXT NOT NULL,
      "mimeType" TEXT,
      "dataBase64" TEXT NOT NULL,
      "sizeBytes" INTEGER,
      lat REAL,
      lng REAL,
      "capturedAt" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      "deletedAt" TEXT,
      "deviceId" TEXT
    )
  `);

  await runSQL(`
    CREATE TABLE IF NOT EXISTS "systemLogs" (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      level TEXT NOT NULL CHECK(level IN ('info', 'warning', 'error', 'success')),
      module TEXT NOT NULL,
      message TEXT NOT NULL,
      "userId" TEXT,
      "userName" TEXT
    )
  `);

  await runSQL(`
    CREATE TABLE IF NOT EXISTS backups (
      id TEXT PRIMARY KEY,
      "createdAt" TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('manual', 'scheduled')),
      "sizeBytes" INTEGER NOT NULL,
      data BYTEA NOT NULL
    )
  `);

  await runSQL(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      "updatedAt" TEXT NOT NULL
    )
  `);

  // TAG é única só entre correias ATIVAS (índice parcial) — não uma
  // constraint de coluna simples, que impediria reaproveitar a TAG de uma
  // correia excluída (soft-delete: a linha continua existindo com
  // "deletedAt" preenchido, então uma UNIQUE comum colidiria para sempre).
  // O DROP CONSTRAINT cobre o banco já existente antes desta correção; em
  // banco novo é um no-op silencioso.
  await runSQL(`ALTER TABLE belts DROP CONSTRAINT IF EXISTS belts_tag_key`);
  await runSQL(`CREATE UNIQUE INDEX IF NOT EXISTS belts_tag_active_unique ON belts (tag) WHERE "deletedAt" IS NULL`);

  // Índices usados pelo motor de sincronização (pull por "updatedAt") e pela
  // montagem da pasta por inspeção (media por inspectionId).
  await runSQL(`CREATE INDEX IF NOT EXISTS idx_belts_updated ON belts ("updatedAt")`);
  await runSQL(`CREATE INDEX IF NOT EXISTS idx_stations_updated ON "beltStations" ("updatedAt")`);
  await runSQL(`CREATE INDEX IF NOT EXISTS idx_orders_updated ON "inspectionOrders" ("updatedAt")`);
  await runSQL(`CREATE INDEX IF NOT EXISTS idx_inspections_updated ON inspections ("updatedAt")`);
  await runSQL(`CREATE INDEX IF NOT EXISTS idx_users_updated ON users ("updatedAt")`);
  await runSQL(`CREATE INDEX IF NOT EXISTS idx_media_inspection ON media ("inspectionId")`);
  await runSQL(`CREATE INDEX IF NOT EXISTS idx_areas_updated ON areas ("updatedAt")`);

  console.log('✅ Todas as tabelas criadas/verificadas com sucesso!');
}
