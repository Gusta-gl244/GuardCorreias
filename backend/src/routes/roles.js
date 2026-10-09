import express from 'express';
import * as queries from '../database/queries-postgres.js';
import { requirePermission } from '../middleware/auth.js';

const router = express.Router();

// GET /api/roles/me - Papel e matriz de permissões do usuário autenticado.
// Sem exigência de permissão além de estar logado: é assim que o frontend
// (usePermissions()) sabe o que mostrar/esconder na própria sessão, e um
// dispositivo em campo precisa conseguir ler isso mesmo sem a permissão
// "roles.view" (que normalmente só o admin tem).
router.get('/me', async (req, res) => {
  try {
    const role = await queries.getRoleByName(req.user.role);
    if (!role) return res.status(404).json({ error: 'Papel não encontrado' });
    res.json(role);
  } catch (error) {
    console.error('❌ Erro ao buscar papel atual:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/roles
router.get('/', requirePermission('roles', 'view'), async (req, res) => {
  try {
    res.json(await queries.getAllRoles());
  } catch (error) {
    console.error('❌ Erro ao buscar papéis:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/roles - Cria um papel customizado (nunca "isSystem": só o seed cria os 3 papéis do sistema)
router.post('/', requirePermission('roles', 'create'), async (req, res) => {
  try {
    const { name, label, baseShell, permissions } = req.body;
    if (!name || !label || !baseShell) {
      return res.status(400).json({ error: 'name, label e baseShell são obrigatórios' });
    }
    const role = await queries.createRole({ name, label, baseShell, permissions, isSystem: false });
    await queries.logSystemEvent('Papéis', 'info', `Papel criado: ${role.label} (${role.name})`, req.user);
    res.status(201).json(role);
  } catch (error) {
    console.error('❌ Erro ao criar papel:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/roles/:id - Edita label/baseShell/permissions. Papéis do sistema
// (tecnico/supervisor/superadm) podem ter a matriz de permissões editada,
// mas não o nome — trocar o nome quebraria o login de quem já tem esse
// valor gravado em users.role.
router.put('/:id', requirePermission('roles', 'edit'), async (req, res) => {
  try {
    const existing = await queries.getRoleById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Papel não encontrado' });
    const { name, ...rest } = req.body;
    if (existing.isSystem && name !== undefined && name !== existing.name) {
      return res.status(400).json({ error: 'Não é possível renomear um papel do sistema' });
    }
    const role = await queries.updateRole(req.params.id, rest);
    await queries.logSystemEvent('Papéis', 'info', `Papel atualizado: ${role.label} (${role.name})`, req.user);
    res.json(role);
  } catch (error) {
    console.error('❌ Erro ao atualizar papel:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/roles/:id
router.delete('/:id', requirePermission('roles', 'delete'), async (req, res) => {
  try {
    const existing = await queries.getRoleById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Papel não encontrado' });
    if (existing.isSystem) return res.status(400).json({ error: 'Papéis do sistema não podem ser excluídos' });
    await queries.deleteRole(req.params.id);
    await queries.logSystemEvent('Papéis', 'warning', `Papel excluído: ${existing.label} (${existing.name})`, req.user);
    res.status(204).send();
  } catch (error) {
    console.error('❌ Erro ao excluir papel:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
