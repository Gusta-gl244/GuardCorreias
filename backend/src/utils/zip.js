import archiver from 'archiver';
import { PassThrough } from 'stream';
import { getQuery } from '../database/postgres-connection.js';

const TABLES_TO_EXPORT = [
  'users', 'belts', '"checklistTemplates"', 'severities',
  '"inspectionOrders"', 'inspections', '"systemLogs"',
];

/**
 * Monta um ZIP em memória com um .json por tabela e, dentro de
 * media/{inspectionId}/{fotos|videos|audios}/, todo arquivo de campo já
 * extraído do base64 para um arquivo real — o backup completo do sistema,
 * pronto para restaurar ou auditar offline, guardado no próprio Postgres
 * (sem disco persistente no Render).
 */
export async function buildFullBackupZip() {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const chunks = [];
  const stream = new PassThrough();
  archive.pipe(stream);

  const done = new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', resolve);
    stream.on('error', reject);
    archive.on('error', reject);
  });

  for (const table of TABLES_TO_EXPORT) {
    const plainName = table.replace(/"/g, '');
    const rows = await getQuery(`SELECT * FROM ${table} WHERE "deletedAt" IS NULL`);
    archive.append(JSON.stringify(rows, null, 2), { name: `${plainName}.json` });
  }

  const mediaRows = await getQuery(`SELECT * FROM media WHERE "deletedAt" IS NULL`);
  const folderFor = { foto: 'fotos', video: 'videos', audio: 'audios' };
  for (const m of mediaRows) {
    const base64 = (m.dataBase64 || '').replace(/^data:[^;]+;base64,/, '');
    archive.append(Buffer.from(base64, 'base64'), {
      name: `media/${m.inspectionId}/${folderFor[m.tipo] || 'outros'}/${m.filename}`,
    });
  }

  archive.append(
    JSON.stringify({ generatedAt: new Date().toISOString(), mediaCount: mediaRows.length }, null, 2),
    { name: 'manifest.json' }
  );

  await archive.finalize();
  await done;

  return Buffer.concat(chunks);
}
