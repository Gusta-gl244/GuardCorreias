import express from 'express';
import * as queries from '../database/queries-postgres.js';
import { requirePermission } from '../middleware/auth.js';

const router = express.Router();

// GET /api/settings/:key - leitura aberta a qualquer usuário autenticado:
// configurações como o padrão de tag de correia ou "exigir foto em
// atenção/crítico" precisam chegar ao técnico/supervisor em campo, não só
// ao admin. Só a escrita é restrita.
router.get('/:key', async (req, res) => {
  try {
    const value = await queries.getSetting(req.params.key);
    res.json(value ?? {});
  } catch (error) {
    console.error('❌ Erro ao buscar configuração:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/settings/:key
router.put('/:key', requirePermission('settings', 'edit'), async (req, res) => {
  try {
    const value = await queries.setSetting(req.params.key, req.body);
    await queries.logSystemEvent('Configurações', 'info', `Configuração "${req.params.key}" atualizada`, req.user);
    res.json(value);
  } catch (error) {
    console.error('❌ Erro ao salvar configuração:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
