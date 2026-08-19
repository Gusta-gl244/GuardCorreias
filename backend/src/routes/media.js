import express from 'express';
import * as queries from '../database/queries-postgres.js';
import { requirePermission } from '../middleware/auth.js';

const router = express.Router();

// GET /api/media/:id - Um único arquivo de mídia, com o base64 completo
// (a listagem em /api/inspections/:id/media omite esse campo por peso)
router.get('/:id', requirePermission('media', 'view'), async (req, res) => {
  try {
    const item = await queries.getMediaById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Mídia não encontrada' });
    res.json(item);
  } catch (error) {
    console.error('❌ Erro ao buscar mídia:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/media - Upload direto (fora do outbox offline, ex.: quando já
// online). O fluxo offline normal passa pelo /api/sync/push com
// entity: 'media', que cai no mesmo upsertLWW genérico.
router.post('/', requirePermission('media', 'create'), async (req, res) => {
  try {
    const item = await queries.createMedia(req.body);
    res.status(201).json(item);
  } catch (error) {
    console.error('❌ Erro ao salvar mídia:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/media/:id
router.delete('/:id', requirePermission('media', 'delete'), async (req, res) => {
  try {
    await queries.deleteMedia(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('❌ Erro ao excluir mídia:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
