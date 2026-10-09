import express from 'express';
import * as queries from '../database/queries-postgres.js';
import { requirePermission } from '../middleware/auth.js';

const router = express.Router();

// GET /api/areas - qualquer usuário autenticado pode ler o catálogo (é
// preenchido no formulário de correia, usado por supervisor e técnico)
router.get('/', async (req, res) => {
  try {
    res.json(await queries.getAllAreas());
  } catch (error) {
    console.error('❌ Erro ao buscar áreas:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/areas
router.post('/', requirePermission('areas', 'create'), async (req, res) => {
  try {
    const { code, name } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'code e name são obrigatórios' });
    const area = await queries.createArea({ code, name });
    await queries.logSystemEvent('Áreas', 'info', `Área criada: ${area.code} — ${area.name}`, req.user);
    res.status(201).json(area);
  } catch (error) {
    console.error('❌ Erro ao criar área:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/areas/:id
router.put('/:id', requirePermission('areas', 'edit'), async (req, res) => {
  try {
    const area = await queries.updateArea(req.params.id, req.body);
    if (!area) return res.status(404).json({ error: 'Área não encontrada' });
    res.json(area);
  } catch (error) {
    console.error('❌ Erro ao atualizar área:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/areas/:id
router.delete('/:id', requirePermission('areas', 'delete'), async (req, res) => {
  try {
    const area = await queries.getAreaById(req.params.id);
    await queries.deleteArea(req.params.id);
    await queries.logSystemEvent('Áreas', 'warning', `Área excluída: ${area?.code || req.params.id}`, req.user);
    res.status(204).send();
  } catch (error) {
    console.error('❌ Erro ao excluir área:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
