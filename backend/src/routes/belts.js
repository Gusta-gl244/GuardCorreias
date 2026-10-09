import express from 'express';
import * as queries from '../database/queries-postgres.js';
import { requirePermission } from '../middleware/auth.js';

const router = express.Router();

// GET /api/belts - Obter todas as correias
router.get('/', requirePermission('belts', 'view'), async (req, res) => {
  try {
    res.json(await queries.getAllBelts());
  } catch (error) {
    console.error('❌ Erro ao buscar correias:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/belts/:id - Obter correia por ID
router.get('/:id', requirePermission('belts', 'view'), async (req, res) => {
  try {
    const belt = await queries.getBeltById(req.params.id);
    if (!belt) return res.status(404).json({ error: 'Correia não encontrada' });
    res.json(belt);
  } catch (error) {
    console.error('❌ Erro ao buscar correia:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/belts - Criar nova correia
router.post('/', requirePermission('belts', 'create'), async (req, res) => {
  try {
    const belt = await queries.createBelt(req.body);
    await queries.logSystemEvent('Correias', 'info', `Correia criada: ${belt.tag} — ${belt.name}`, req.user);
    res.status(201).json(belt);
  } catch (error) {
    console.error('❌ Erro ao criar correia:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/belts/:id - Atualizar correia
router.put('/:id', requirePermission('belts', 'edit'), async (req, res) => {
  try {
    const belt = await queries.updateBelt(req.params.id, req.body);
    if (!belt) return res.status(404).json({ error: 'Correia não encontrada' });
    res.json(belt);
  } catch (error) {
    console.error('❌ Erro ao atualizar correia:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/belts/:id - Excluir correia
router.delete('/:id', requirePermission('belts', 'delete'), async (req, res) => {
  try {
    const belt = await queries.getBeltById(req.params.id);
    await queries.deleteBelt(req.params.id);
    await queries.logSystemEvent('Correias', 'warning', `Correia excluída: ${belt?.tag || req.params.id}`, req.user);
    res.status(204).send();
  } catch (error) {
    console.error('❌ Erro ao excluir correia:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
