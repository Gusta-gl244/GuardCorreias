import express from 'express';
import * as queries from '../database/queries-postgres.js';
import { requirePermission } from '../middleware/auth.js';

const router = express.Router();

// GET /api/audit-log?module=&level=&userId=&since=&until=&limit=
router.get('/', requirePermission('auditLog', 'view'), async (req, res) => {
  try {
    const { module, level, userId, since, until, limit } = req.query;
    const logs = await queries.getFilteredSystemLogs({
      module: module || undefined,
      level: level || undefined,
      userId: userId || undefined,
      since: since || undefined,
      until: until || undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json(logs);
  } catch (error) {
    console.error('❌ Erro ao buscar log de auditoria:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
