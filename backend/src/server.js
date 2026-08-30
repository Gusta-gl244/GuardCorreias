import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { initDb, closeDb } from './database/postgres-connection.js';
import { initializeDatabase } from './database/init-postgres.js';
import { seedTestAccountsIfEmpty, seedDefaultsIfEmpty, seedRolesIfEmpty, seedAreasIfEmpty } from './database/seed.js';
import { initBackupScheduler } from './scheduler/backupScheduler.js';
import { requireAuth } from './middleware/auth.js';

import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import rolesRouter from './routes/roles.js';
import areasRouter from './routes/areas.js';
import beltsRouter from './routes/belts.js';
import checklistTemplatesRouter from './routes/checklistTemplates.js';
import severitiesRouter from './routes/severities.js';
import inspectionOrdersRouter from './routes/inspectionOrders.js';
import inspectionsRouter from './routes/inspections.js';
import mediaRouter from './routes/media.js';
import syncRouter from './routes/sync.js';
import backupsRouter from './routes/backups.js';
import diagnosticsRouter from './routes/diagnostics.js';
import settingsRouter from './routes/settings.js';
import auditLogRouter from './routes/auditLog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
// Limite maior que o padrão do INSPEC360 (10mb) — inspeções de correia
// carregam fotos/áudios/vídeos curtos como base64 no mesmo payload de
// sincronização (ver backend/src/database/init-postgres.js, tabela media).
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

app.use(express.static(path.join(__dirname, '../public')));

const distPath = path.join(__dirname, '../../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// ─────────────────────────────────────────────────────────────────────────────
// ROTAS PÚBLICAS (sem autenticação)
// ─────────────────────────────────────────────────────────────────────────────

app.use('/api/auth', authRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: 'postgresql', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROTAS AUTENTICADAS
// ─────────────────────────────────────────────────────────────────────────────

app.use('/api/users', requireAuth, usersRouter);
app.use('/api/roles', requireAuth, rolesRouter);
app.use('/api/areas', requireAuth, areasRouter);
app.use('/api/belts', requireAuth, beltsRouter);
app.use('/api/checklist-templates', requireAuth, checklistTemplatesRouter);
app.use('/api/severities', requireAuth, severitiesRouter);
app.use('/api/inspection-orders', requireAuth, inspectionOrdersRouter);
app.use('/api/inspections', requireAuth, inspectionsRouter);
app.use('/api/media', requireAuth, mediaRouter);
app.use('/api/sync', requireAuth, syncRouter);
app.use('/api/backups', requireAuth, backupsRouter);
app.use('/api/diagnostics', requireAuth, diagnosticsRouter);
app.use('/api/settings', requireAuth, settingsRouter);
app.use('/api/audit-log', requireAuth, auditLogRouter);

// ─────────────────────────────────────────────────────────────────────────────
// SPA FALLBACK
// ─────────────────────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../../dist/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Frontend not built. Run: npm run build' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

async function startServer() {
  try {
    if (!process.env.DATABASE_URL) {
      const { ensureLocalDatabase } = await import('./database/dev-bootstrap.js');
      await ensureLocalDatabase();
    }

    console.log('🔧 Inicializando banco de dados PostgreSQL...');
    await initDb();
    await initializeDatabase();
    await seedRolesIfEmpty();
    await seedTestAccountsIfEmpty();
    await seedDefaultsIfEmpty();
    await seedAreasIfEmpty();
    await initBackupScheduler();
    console.log('✅ Banco de dados inicializado com sucesso!');

    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║          🛡️  GuardCorreias — Backend Operacional             ║
╚════════════════════════════════════════════════════════════╝

📡 Servidor em: http://localhost:${PORT}
🔧 API em: http://localhost:${PORT}/api
🏥 Health Check: http://localhost:${PORT}/api/health

Pressione Ctrl+C para parar
      `);
    });
  } catch (error) {
    console.error('❌ ERRO ao iniciar servidor:', error.message);
    console.error('📝 Stack:', error.stack);
    process.exit(1);
  }
}

startServer();

process.on('SIGINT', async () => {
  console.log('\n📴 Encerrando servidor...');
  const { stopLocalDatabase } = await import('./database/dev-bootstrap.js');
  await stopLocalDatabase().catch(() => {});
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n📴 Encerrando servidor...');
  const { stopLocalDatabase } = await import('./database/dev-bootstrap.js');
  await stopLocalDatabase().catch(() => {});
  closeDb();
  process.exit(0);
});
