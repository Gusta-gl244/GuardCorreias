import { runSQL, getQuery, getQueryOne } from './postgres-connection.js';
import { v4 as uuidv4 } from 'uuid';

// ═════════════════════════════════════════════════════════════════════════════
// Helpers genéricos de sincronização
//
// upsertLWW: cria ou atualiza um registro só se o timestamp recebido for
// mais novo (ou igual) que o já gravado — "last write wins" por registro,
// nunca por coleção inteira. Mesmo motor genérico do INSPEC360 (lê as
// colunas reais da tabela via information_schema, não precisa saber o shape
// de cada entidade).
// ═════════════════════════════════════════════════════════════════════════════

const TABLES = {
  users: { pk: 'id' },
  belts: { pk: 'id' },
  beltStations: { pk: 'id', quoted: '"beltStations"' },
  checklistTemplates: { pk: 'id', quoted: '"checklistTemplates"' },
  severities: { pk: 'id' },
  inspectionOrders: { pk: 'id', quoted: '"inspectionOrders"' },
  inspections: { pk: 'id' },
  media: { pk: 'id' },
};

function tableName(entity) {
  const t = TABLES[entity];
  if (!t) throw new Error(`Entidade de sincronização desconhecida: ${entity}`);
  return t.quoted || `"${entity}"`;
}

export async function getUpdatedSince(entity, since) {
  const t = tableName(entity);
  if (!since) {
    return getQuery(`SELECT * FROM ${t} WHERE "deletedAt" IS NULL ORDER BY "updatedAt" ASC`);
  }
  return getQuery(`SELECT * FROM ${t} WHERE "updatedAt" > $1 AND "deletedAt" IS NULL ORDER BY "updatedAt" ASC`, [since]);
}

export async function getDeletedSince(entity, since) {
  const t = tableName(entity);
  if (!since) return [];
  const rows = await getQuery(`SELECT id FROM ${t} WHERE "deletedAt" > $1`, [since]);
  return rows.map((r) => r.id);
}

/**
 * Upsert com last-write-wins por registro — "mais novo" é decidido por
 * causalidade (o registro mudou no servidor, por causa de OUTRO dispositivo,
 * desde a última vez que este dispositivo o viu?), nunca comparando relógios
 * de dispositivos entre si. Ver INSPEC360 para o raciocínio completo por trás
 * desta escolha — reaproveitado sem alterações aqui.
 */
export async function upsertLWW(entity, id, payload, clientUpdatedAt, deviceId) {
  const t = tableName(entity);
  const columns = await getColumns(entity);
  const hasDeviceIdColumn = columns.includes('deviceId');

  const existingSelect = hasDeviceIdColumn ? '"updatedAt", "deviceId"' : '"updatedAt"';
  const existing = await getQueryOne(`SELECT ${existingSelect} FROM ${t} WHERE id = $1`, [id]);

  const knownUpdatedAt = payload?.updatedAt ?? null;
  const sameDeviceAsLastWriter =
    hasDeviceIdColumn && !!existing && !!deviceId && existing.deviceId === deviceId;
  const hasConflict =
    !!existing &&
    !!knownUpdatedAt &&
    new Date(existing.updatedAt).getTime() !== new Date(knownUpdatedAt).getTime() &&
    !sameDeviceAsLastWriter;

  if (hasConflict) {
    return { conflict: true, record: await getQueryOne(`SELECT * FROM ${t} WHERE id = $1`, [id]) };
  }

  const now = new Date().toISOString();
  const row = { ...payload, id, updatedAt: now, deviceId: deviceId ?? payload.deviceId ?? null, deletedAt: null };
  if (!existing) row.createdAt = row.createdAt || clientUpdatedAt || now;

  const fields = columns.filter((c) => c in row);
  const values = fields.map((f) => serializeValue(row[f]));
  const setClause = fields.map((f, i) => `"${f}" = $${i + 2}`).join(', ');
  const insertCols = fields.map((f) => `"${f}"`).join(', ');
  const insertVals = fields.map((_, i) => `$${i + 2}`).join(', ');

  await runSQL(
    `INSERT INTO ${t} (id, ${insertCols}) VALUES ($1, ${insertVals})
     ON CONFLICT (id) DO UPDATE SET ${setClause}`,
    [id, ...values]
  );

  return { conflict: false, record: await getQueryOne(`SELECT * FROM ${t} WHERE id = $1`, [id]) };
}

export async function softDelete(entity, id) {
  const t = tableName(entity);
  const now = new Date().toISOString();
  await runSQL(`UPDATE ${t} SET "deletedAt" = $1, "updatedAt" = $1 WHERE id = $2`, [now, id]);
  return { id, deletedAt: now };
}

const columnCache = new Map();
async function getColumns(entity) {
  if (columnCache.has(entity)) return columnCache.get(entity);
  const t = tableName(entity).replace(/"/g, '');
  const rows = await getQuery(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name NOT IN ('id')`,
    [t]
  );
  const cols = rows.map((r) => r.column_name);
  columnCache.set(entity, cols);
  return cols;
}

function serializeValue(v) {
  if (v !== null && typeof v === 'object') return JSON.stringify(v);
  return v;
}

// ═════════════════════════════════════════════════════════════════════════════
// USERS
// ═════════════════════════════════════════════════════════════════════════════

export async function getAllUsers() {
  return getQuery('SELECT * FROM users WHERE "deletedAt" IS NULL ORDER BY "createdAt" ASC');
}

export async function getUserById(id) {
  return getQueryOne('SELECT * FROM users WHERE id = $1 AND "deletedAt" IS NULL', [id]);
}

export async function getUserByEmail(email) {
  return getQueryOne('SELECT * FROM users WHERE email = $1 AND "deletedAt" IS NULL', [email]);
}

export async function createUser(data) {
  const id = data.id || uuidv4();
  const now = new Date().toISOString();
  await runSQL(
    `INSERT INTO users (id, name, email, "passwordHash", role, status, phone, avatar, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
    [id, data.name, data.email, data.passwordHash, data.role || 'tecnico', data.status || 'active', data.phone || null, data.avatar || null, now]
  );
  return getUserById(id);
}

export async function updateUser(id, data) {
  const fields = [];
  const params = [];
  let i = 1;
  const map = { name: 'name', email: 'email', passwordHash: '"passwordHash"', role: 'role', status: 'status', phone: 'phone', avatar: 'avatar', lastLogin: '"lastLogin"' };
  for (const [key, col] of Object.entries(map)) {
    if (data[key] !== undefined) { fields.push(`${col} = $${i}`); params.push(data[key]); i++; }
  }
  fields.push(`"updatedAt" = $${i}`); params.push(new Date().toISOString()); i++;
  params.push(id);
  await runSQL(`UPDATE users SET ${fields.join(', ')} WHERE id = $${i}`, params);
  return getUserById(id);
}

export async function deleteUser(id) {
  return softDelete('users', id);
}

// ═════════════════════════════════════════════════════════════════════════════
// BELTS (correias)
// ═════════════════════════════════════════════════════════════════════════════

export async function getAllBelts() {
  return getQuery('SELECT * FROM belts WHERE "deletedAt" IS NULL ORDER BY tag ASC');
}

export async function getBeltById(id) {
  return getQueryOne('SELECT * FROM belts WHERE id = $1 AND "deletedAt" IS NULL', [id]);
}

export async function createBelt(data) {
  const now = new Date().toISOString();
  const result = await upsertLWW('belts', data.id || uuidv4(), { ...data, createdAt: data.createdAt || now }, now, data.deviceId);
  return result.record;
}

export async function updateBelt(id, data) {
  const now = new Date().toISOString();
  const result = await upsertLWW('belts', id, data, now, data.deviceId);
  return result.record;
}

export async function deleteBelt(id) {
  return softDelete('belts', id);
}

// ═════════════════════════════════════════════════════════════════════════════
// BELT STATIONS (estações de inspeção)
// ═════════════════════════════════════════════════════════════════════════════

export async function getAllStations() {
  return getQuery('SELECT * FROM "beltStations" WHERE "deletedAt" IS NULL ORDER BY "beltId" ASC, ordem ASC');
}

export async function getStationsByBelt(beltId) {
  return getQuery('SELECT * FROM "beltStations" WHERE "beltId" = $1 AND "deletedAt" IS NULL ORDER BY ordem ASC', [beltId]);
}

export async function getStationById(id) {
  return getQueryOne('SELECT * FROM "beltStations" WHERE id = $1 AND "deletedAt" IS NULL', [id]);
}

export async function createStation(data) {
  const now = new Date().toISOString();
  const result = await upsertLWW('beltStations', data.id || uuidv4(), { ...data, createdAt: data.createdAt || now }, now, data.deviceId);
  return result.record;
}

export async function updateStation(id, data) {
  const now = new Date().toISOString();
  const result = await upsertLWW('beltStations', id, data, now, data.deviceId);
  return result.record;
}

export async function deleteStation(id) {
  return softDelete('beltStations', id);
}

// ═════════════════════════════════════════════════════════════════════════════
// CHECKLIST TEMPLATES
// ═════════════════════════════════════════════════════════════════════════════

export async function getAllChecklistTemplates() {
  return getQuery('SELECT * FROM "checklistTemplates" WHERE "deletedAt" IS NULL ORDER BY name ASC');
}

export async function getChecklistTemplateById(id) {
  return getQueryOne('SELECT * FROM "checklistTemplates" WHERE id = $1 AND "deletedAt" IS NULL', [id]);
}

export async function createChecklistTemplate(data) {
  const now = new Date().toISOString();
  const result = await upsertLWW('checklistTemplates', data.id || uuidv4(), { ...data, createdAt: now, items: data.items || [] }, now);
  return result.record;
}

export async function updateChecklistTemplate(id, data) {
  const now = new Date().toISOString();
  const result = await upsertLWW('checklistTemplates', id, data, now);
  return result.record;
}

export async function deleteChecklistTemplate(id) {
  return softDelete('checklistTemplates', id);
}

// ═════════════════════════════════════════════════════════════════════════════
// SEVERITIES
// ═════════════════════════════════════════════════════════════════════════════

export async function getAllSeverities() {
  return getQuery('SELECT * FROM severities WHERE "deletedAt" IS NULL ORDER BY points ASC');
}

export async function createSeverity(data) {
  const now = new Date().toISOString();
  const result = await upsertLWW('severities', data.id || uuidv4(), { ...data, createdAt: now }, now);
  return result.record;
}

// ═════════════════════════════════════════════════════════════════════════════
// INSPECTION ORDERS (demandas do supervisor)
// ═════════════════════════════════════════════════════════════════════════════

export async function getAllInspectionOrders() {
  return getQuery('SELECT * FROM "inspectionOrders" WHERE "deletedAt" IS NULL ORDER BY "createdAt" DESC');
}

export async function getInspectionOrderById(id) {
  return getQueryOne('SELECT * FROM "inspectionOrders" WHERE id = $1 AND "deletedAt" IS NULL', [id]);
}

export async function createInspectionOrder(data) {
  const now = new Date().toISOString();
  const result = await upsertLWW('inspectionOrders', data.id || uuidv4(), { ...data, createdAt: data.createdAt || now }, now, data.deviceId);
  return result.record;
}

export async function updateInspectionOrder(id, data) {
  const now = data.updatedAt || new Date().toISOString();
  const result = await upsertLWW('inspectionOrders', id, data, now, data.deviceId);
  return result.record;
}

export async function deleteInspectionOrder(id) {
  return softDelete('inspectionOrders', id);
}

// ═════════════════════════════════════════════════════════════════════════════
// INSPECTIONS
// ═════════════════════════════════════════════════════════════════════════════

export async function getAllInspections() {
  return getQuery('SELECT * FROM inspections WHERE "deletedAt" IS NULL ORDER BY "dataHoraAbertura" DESC');
}

export async function getInspectionById(id) {
  return getQueryOne('SELECT * FROM inspections WHERE id = $1 AND "deletedAt" IS NULL', [id]);
}

/**
 * ID legível e rastreável no formato exigido: INS-AAAAMMDD-TAGCORREIA-XXX
 * (ex.: INS-20260818-CV2203-001). O sufixo de 3 dígitos conta quantas
 * inspeções (incluindo excluídas, para nunca reutilizar um número) já
 * existem para essa correia nesse mesmo dia — suficiente para o volume de
 * inspeções de uma planta, e ordena naturalmente por data.
 */
export async function generateInspectionId(beltTag) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `INS-${datePart}-${beltTag}-`;
  const rows = await getQuery(`SELECT COUNT(*)::int AS n FROM inspections WHERE id LIKE $1`, [`${prefix}%`]);
  const seq = (rows[0]?.n || 0) + 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

export async function createInspection(data) {
  const now = new Date().toISOString();
  const id = data.id || (await generateInspectionId(data.beltTag || 'CORREIA'));
  const result = await upsertLWW('inspections', id, { ...data, dataHoraAbertura: data.dataHoraAbertura || now }, now, data.deviceId);
  return result.record;
}

export async function updateInspection(id, data) {
  const now = data.updatedAt || new Date().toISOString();
  const result = await upsertLWW('inspections', id, data, now, data.deviceId);
  return result.record;
}

export async function deleteInspection(id) {
  return softDelete('inspections', id);
}

// ═════════════════════════════════════════════════════════════════════════════
// MEDIA (fotos/vídeos/áudios de campo)
// ═════════════════════════════════════════════════════════════════════════════

export async function getMediaByInspection(inspectionId) {
  return getQuery('SELECT * FROM media WHERE "inspectionId" = $1 AND "deletedAt" IS NULL ORDER BY "createdAt" ASC', [inspectionId]);
}

export async function getMediaById(id) {
  return getQueryOne('SELECT * FROM media WHERE id = $1 AND "deletedAt" IS NULL', [id]);
}

export async function createMedia(data) {
  const now = new Date().toISOString();
  const result = await upsertLWW('media', data.id || uuidv4(), { ...data, createdAt: data.createdAt || now }, now, data.deviceId);
  return result.record;
}

export async function deleteMedia(id) {
  return softDelete('media', id);
}

// ═════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═════════════════════════════════════════════════════════════════════════════

export async function getSetting(key) {
  const row = await getQueryOne('SELECT value FROM settings WHERE key = $1', [key]);
  return row ? row.value : null;
}

export async function setSetting(key, value) {
  const now = new Date().toISOString();
  await runSQL(
    `INSERT INTO settings (key, value, "updatedAt") VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = $2, "updatedAt" = $3`,
    [key, JSON.stringify(value), now]
  );
  return value;
}

// ═════════════════════════════════════════════════════════════════════════════
// BACKUPS
// ═════════════════════════════════════════════════════════════════════════════

export async function createBackup({ kind, data }) {
  const id = uuidv4();
  const now = new Date().toISOString();
  await runSQL(
    `INSERT INTO backups (id, "createdAt", kind, "sizeBytes", data) VALUES ($1, $2, $3, $4, $5)`,
    [id, now, kind, data.length, data]
  );
  return { id, createdAt: now, kind, sizeBytes: data.length };
}

export async function listBackups() {
  return getQuery('SELECT id, "createdAt", kind, "sizeBytes" FROM backups ORDER BY "createdAt" DESC');
}

export async function getBackupData(id) {
  return getQueryOne('SELECT data FROM backups WHERE id = $1', [id]);
}

export async function deleteBackup(id) {
  await runSQL('DELETE FROM backups WHERE id = $1', [id]);
  return true;
}

export async function pruneBackups(retentionCount) {
  const ids = await getQuery(
    'SELECT id FROM backups ORDER BY "createdAt" DESC OFFSET $1',
    [retentionCount]
  );
  for (const row of ids) await deleteBackup(row.id);
  return ids.length;
}

// ═════════════════════════════════════════════════════════════════════════════
// SYSTEM LOGS
// ═════════════════════════════════════════════════════════════════════════════

export async function addSystemLog(entry) {
  const id = uuidv4();
  const now = new Date().toISOString();
  await runSQL(
    `INSERT INTO "systemLogs" (id, timestamp, level, module, message, "userId", "userName")
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, now, entry.level, entry.module, entry.message, entry.userId || null, entry.userName || null]
  );
  return { id, timestamp: now, ...entry };
}

export async function getRecentSystemLogs(limit = 200) {
  return getQuery('SELECT * FROM "systemLogs" ORDER BY timestamp DESC LIMIT $1', [limit]);
}
