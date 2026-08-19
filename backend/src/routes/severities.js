import express from 'express';
import * as queries from '../database/queries-postgres.js';
import { requirePermission } from '../middleware/auth.js';

const router = express.Router();

// GET /api/severities
router.get('/', requirePermission('severities', 'view'), async (req, res) => {
  try {
    res.json(await queries.getAllSeverities());
  } catch (error) {
    console.error('❌ Erro ao buscar severidades:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/severities
router.post('/', requirePermission('severities', 'create'), async (req, res) => {
  try {
    const sev = await queries.createSeverity(req.body);
    await queries.logSystemEvent('Severidades', 'info', `Severidade criada: ${sev.label}`, req.user);
    res.status(201).json(sev);
  } catch (error) {
    console.error('❌ Erro ao criar severidade:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
