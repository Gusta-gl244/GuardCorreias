import express from 'express';
import * as queries from '../database/queries-postgres.js';

const router = express.Router();

// GET /api/checklist-templates
router.get('/', async (req, res) => {
  try {
    res.json(await queries.getAllChecklistTemplates());
  } catch (error) {
    console.error('❌ Erro ao buscar checklists:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/checklist-templates/:id
router.get('/:id', async (req, res) => {
  try {
    const tpl = await queries.getChecklistTemplateById(req.params.id);
    if (!tpl) return res.status(404).json({ error: 'Checklist não encontrado' });
    res.json(tpl);
  } catch (error) {
    console.error('❌ Erro ao buscar checklist:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/checklist-templates
router.post('/', async (req, res) => {
  try {
    const tpl = await queries.createChecklistTemplate(req.body);
    res.status(201).json(tpl);
  } catch (error) {
    console.error('❌ Erro ao criar checklist:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/checklist-templates/:id
router.put('/:id', async (req, res) => {
  try {
    const tpl = await queries.updateChecklistTemplate(req.params.id, req.body);
    if (!tpl) return res.status(404).json({ error: 'Checklist não encontrado' });
    res.json(tpl);
  } catch (error) {
    console.error('❌ Erro ao atualizar checklist:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/checklist-templates/:id
router.delete('/:id', async (req, res) => {
  try {
    await queries.deleteChecklistTemplate(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('❌ Erro ao excluir checklist:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
