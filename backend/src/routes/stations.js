import express from 'express';
import * as queries from '../database/queries-postgres.js';
import { requirePermission } from '../middleware/auth.js';

const router = express.Router();

// GET /api/stations?beltId=... - Obter estações (todas ou de uma correia)
router.get('/', requirePermission('stations', 'view'), async (req, res) => {
  try {
    const { beltId } = req.query;
    res.json(beltId ? await queries.getStationsByBelt(beltId) : await queries.getAllStations());
  } catch (error) {
    console.error('❌ Erro ao buscar estações:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/stations/:id
router.get('/:id', requirePermission('stations', 'view'), async (req, res) => {
  try {
    const station = await queries.getStationById(req.params.id);
    if (!station) return res.status(404).json({ error: 'Estação não encontrada' });
    res.json(station);
  } catch (error) {
    console.error('❌ Erro ao buscar estação:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/stations
router.post('/', requirePermission('stations', 'create'), async (req, res) => {
  try {
    const station = await queries.createStation(req.body);
    res.status(201).json(station);
  } catch (error) {
    console.error('❌ Erro ao criar estação:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/stations/:id
router.put('/:id', requirePermission('stations', 'edit'), async (req, res) => {
  try {
    const station = await queries.updateStation(req.params.id, req.body);
    if (!station) return res.status(404).json({ error: 'Estação não encontrada' });
    res.json(station);
  } catch (error) {
    console.error('❌ Erro ao atualizar estação:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/stations/:id
router.delete('/:id', requirePermission('stations', 'delete'), async (req, res) => {
  try {
    await queries.deleteStation(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('❌ Erro ao excluir estação:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
