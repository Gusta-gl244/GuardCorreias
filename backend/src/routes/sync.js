import express from 'express';
import * as queries from '../database/queries-postgres.js';

const router = express.Router();

// "users" e "areas" só entram no PULL (cache offline de leitura — nomes de
// usuário para exibição, catálogo de áreas para o formulário de correia em
// campo). Mudanças nessas duas entidades só valem através das rotas
// dedicadas (/api/users, /api/areas), que fazem hash de senha e checagem de
// permissão específica — nunca através deste push genérico.
const PUSH_ENTITIES = ['belts', 'beltStations', 'checklistTemplates', 'severities', 'inspectionOrders', 'inspections', 'media'];
const PULL_ENTITIES = [...PUSH_ENTITIES, 'users', 'areas'];

// Mapeia entidade de sincronização → módulo de permissão (a maioria é 1:1;
// "beltStations" vira o módulo "stations" para casar com o nome usado no
// resto do Admin/rotas REST).
const PERMISSION_MODULE = {
  belts: 'belts',
  beltStations: 'stations',
  checklistTemplates: 'checklistTemplates',
  severities: 'severities',
  inspectionOrders: 'inspectionOrders',
  inspections: 'inspections',
  media: 'media',
};
const PERMISSION_ACTION = { create: 'create', update: 'edit', delete: 'delete' };

// GET /api/sync/pull?since=<ISO> — tudo que mudou (ou tudo, na primeira vez)
router.get('/pull', async (req, res) => {
  try {
    const since = req.query.since || null;
    const serverTime = new Date().toISOString();

    const data = {};
    const deleted = {};
    for (const entity of PULL_ENTITIES) {
      data[entity] = await queries.getUpdatedSince(entity, since);
      deleted[entity] = await queries.getDeletedSince(entity, since);
    }

    res.json({ serverTime, since, data, deleted });
  } catch (error) {
    console.error('❌ Erro no pull de sincronização:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sync/push — { mutations: [{ entity, op, id, payload, clientUpdatedAt, deviceId }] }
//
// Este é o caminho real por onde correias/estações/checklists/severidades/
// ordens/inspeções/mídia são criadas e editadas pelo app (SupervisorApp e
// TecnicoApp gravam no outbox local, que é drenado para cá) — as rotas REST
// dedicadas (/api/belts, /api/stations etc.) existem em paralelo mas não são
// o caminho de escrita usado pelo frontend. A checagem de permissão
// precisava estar aqui, não só nas rotas REST, senão continuaria sendo
// possível burlar o controle de acesso via o outbox.
router.post('/push', async (req, res) => {
  try {
    const { mutations } = req.body;
    if (!Array.isArray(mutations)) {
      return res.status(400).json({ error: 'mutations deve ser um array' });
    }

    // Papel resolvido uma única vez por requisição (não por mutação) — o
    // usuário autenticado é o mesmo do início ao fim do lote.
    const role = await queries.getRoleByName(req.user.role);

    const results = [];
    for (const m of mutations) {
      try {
        if (!PUSH_ENTITIES.includes(m.entity)) {
          results.push({ clientOpId: m.clientOpId, status: 'error', error: `Entidade não sincronizável via push: ${m.entity}` });
          continue;
        }

        const module = PERMISSION_MODULE[m.entity];
        const action = PERMISSION_ACTION[m.op];
        if (!role?.permissions?.[module]?.[action]) {
          results.push({ clientOpId: m.clientOpId, status: 'error', error: 'Sem permissão para esta ação' });
          continue;
        }

        if (m.op === 'delete') {
          const record = await queries.softDelete(m.entity, m.id);
          results.push({ clientOpId: m.clientOpId, status: 'ok', record });
        } else {
          const { conflict, record } = await queries.upsertLWW(m.entity, m.id, m.payload, m.clientUpdatedAt, m.deviceId);
          results.push({ clientOpId: m.clientOpId, status: conflict ? 'conflict' : 'ok', record });
        }
      } catch (err) {
        console.error(`❌ Erro aplicando mutação (${m.entity}/${m.id}):`, err.message);
        results.push({ clientOpId: m.clientOpId, status: 'error', error: err.message });
      }
    }

    res.json({ results, serverTime: new Date().toISOString() });
  } catch (error) {
    console.error('❌ Erro no push de sincronização:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
