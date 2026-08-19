import express from 'express';
import * as queries from '../database/queries-postgres.js';

const router = express.Router();

// GET /api/inspection-orders - Obter todas as ordens de inspeção
router.get('/', async (req, res) => {
  try {
    res.json(await queries.getAllInspectionOrders());
  } catch (error) {
    console.error('❌ Erro ao buscar ordens de inspeção:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/inspection-orders/:id
router.get('/:id', async (req, res) => {
  try {
    const order = await queries.getInspectionOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Ordem não encontrada' });
    res.json(order);
  } catch (error) {
    console.error('❌ Erro ao buscar ordem:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/inspection-orders
router.post('/', async (req, res) => {
  try {
    const order = await queries.createInspectionOrder(req.body);
    res.status(201).json(order);
  } catch (error) {
    console.error('❌ Erro ao criar ordem:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/inspection-orders/:id
router.put('/:id', async (req, res) => {
  try {
    const order = await queries.updateInspectionOrder(req.params.id, req.body);
    if (!order) return res.status(404).json({ error: 'Ordem não encontrada' });
    res.json(order);
  } catch (error) {
    console.error('❌ Erro ao atualizar ordem:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/inspection-orders/:id
router.delete('/:id', async (req, res) => {
  try {
    await queries.deleteInspectionOrder(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('❌ Erro ao excluir ordem:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
