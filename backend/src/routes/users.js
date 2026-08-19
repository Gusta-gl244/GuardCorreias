import express from 'express';
import bcrypt from 'bcryptjs';
import * as queries from '../database/queries-postgres.js';
import { requirePermission } from '../middleware/auth.js';

const router = express.Router();

// GET /api/users - Obter todos os usuários (sem o hash da senha)
router.get('/', requirePermission('users', 'view'), async (req, res) => {
  try {
    const users = await queries.getAllUsers();
    res.json(users.map(({ passwordHash, ...u }) => u));
  } catch (error) {
    console.error('❌ Erro ao buscar usuários:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/users/:id - Obter usuário por ID (o próprio usuário sempre pode
// ler seu registro, mesmo sem a permissão "users.view", para o app carregar
// o perfil de quem está logado)
router.get('/:id', async (req, res) => {
  try {
    if (req.user.sub !== req.params.id) {
      const role = await queries.getRoleByName(req.user.role);
      if (!role?.permissions?.users?.view) return res.status(403).json({ error: 'Sem permissão para esta ação' });
    }
    const user = await queries.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    const { passwordHash, ...rest } = user;
    res.json(rest);
  } catch (error) {
    console.error('❌ Erro ao buscar usuário:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users - Criar novo usuário
router.post('/', requirePermission('users', 'create'), async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Senha obrigatória (mínimo 6 caracteres)' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await queries.createUser({ ...rest, passwordHash });
    await queries.logSystemEvent('Usuários', 'info', `Usuário criado: ${user.name} (${user.role})`, req.user);
    const { passwordHash: _omit, ...safeUser } = user;
    res.status(201).json(safeUser);
  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/users/:id - Atualizar usuário. Qualquer usuário pode editar o
// próprio registro (nome, telefone, avatar, senha) sem precisar da
// permissão "users.edit" — mas nesse caso "role"/"status" são descartados do
// corpo da requisição, para ninguém conseguir se auto-promover trocando o
// próprio papel. Editar outro usuário, ou mudar role/status do próprio,
// exige a permissão.
router.put('/:id', async (req, res) => {
  try {
    const isSelf = req.user.sub === req.params.id;
    const { password, role: newRole, status: newStatus, ...rest } = req.body;
    const updates = { ...rest };

    if (isSelf) {
      const role = await queries.getRoleByName(req.user.role);
      if (role?.permissions?.users?.edit) {
        if (newRole !== undefined) updates.role = newRole;
        if (newStatus !== undefined) updates.status = newStatus;
      }
      // sem a permissão, role/status ficam de fora — usuário comum não se auto-promove
    } else {
      const role = await queries.getRoleByName(req.user.role);
      if (!role?.permissions?.users?.edit) return res.status(403).json({ error: 'Sem permissão para esta ação' });
      if (newRole !== undefined) updates.role = newRole;
      if (newStatus !== undefined) updates.status = newStatus;
    }

    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres' });
      updates.passwordHash = await bcrypt.hash(password, 10);
    }
    const user = await queries.updateUser(req.params.id, updates);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    const { passwordHash, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    console.error('❌ Erro ao atualizar usuário:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/users/:id - Excluir usuário
router.delete('/:id', requirePermission('users', 'delete'), async (req, res) => {
  try {
    const user = await queries.getUserById(req.params.id);
    await queries.deleteUser(req.params.id);
    await queries.logSystemEvent('Usuários', 'warning', `Usuário excluído: ${user?.name || req.params.id}`, req.user);
    res.status(204).send();
  } catch (error) {
    console.error('❌ Erro ao excluir usuário:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
