import express from 'express';
import * as queries from '../database/queries-postgres.js';

const router = express.Router();

// GET /api/belts - Obter todas as correias
router.get('/', async (req, res) => {
  try {
    res.json(await queries.getAllBelts());
  } catch (error) {
    console.error('❌ Erro ao buscar correias:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/belts/:id - Obter correia por ID
router.get('/:id', async (req, res) => {
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
router.post('/', async (req, res) => {
  try {
    const belt = await queries.createBelt(req.body);
    res.status(201).json(belt);
  } catch (error) {
    console.error('❌ Erro ao criar correia:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/belts/:id - Atualizar correia
router.put('/:id', async (req, res) => {
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
router.delete('/:id', async (req, res) => {
  try {
    await queries.deleteBelt(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('❌ Erro ao excluir correia:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
