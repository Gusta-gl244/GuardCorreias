import express from 'express';
import * as queries from '../database/queries-postgres.js';

const router = express.Router();

// GET /api/severities
router.get('/', async (req, res) => {
  try {
    res.json(await queries.getAllSeverities());
  } catch (error) {
    console.error('❌ Erro ao buscar severidades:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/severities
router.post('/', async (req, res) => {
  try {
    const sev = await queries.createSeverity(req.body);
    res.status(201).json(sev);
  } catch (error) {
    console.error('❌ Erro ao criar severidade:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
