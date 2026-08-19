import jwt from 'jsonwebtoken';
import * as queries from '../database/queries-postgres.js';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('❌ JWT_SECRET não definida em produção — obrigatória para assinar tokens de login.');
}

// Em dev local, sem JWT_SECRET configurada, usa uma chave fixa de desenvolvimento
// (nunca aceita em produção — checagem acima).
const SECRET = JWT_SECRET || 'dev-only-secret-nao-usar-em-producao';
const TOKEN_TTL = '30d'; // técnico pode passar dias em campo sem reabrir sessão

// "baseShell" decide qual casca de UI o papel do usuário usa
// (TecnicoApp/SupervisorApp/SuperAdmApp). Vai embutido no token para o
// frontend decidir a casca sem round-trip extra no boot. Se o papel não for
// encontrado (ex.: banco recém-migrado, seed ainda não rodou), cai para o
// próprio nome do papel — os 3 papéis do sistema têm baseShell === name.
export async function signToken(user) {
  const role = await queries.getRoleByName(user.role).catch(() => null);
  const baseShell = role?.baseShell || user.role;
  return jwt.sign(
    { sub: user.id, role: user.role, baseShell, name: user.name, email: user.email },
    SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado' });

  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Sessão inválida ou expirada' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Sem permissão para esta ação' });
    next();
  };
}

/**
 * Autorização granular: consulta a matriz de permissões do papel do usuário
 * (tabela "roles") a cada requisição — sempre reflete o que o admin
 * configurou agora, mesmo que o JWT do usuário tenha sido emitido antes da
 * última mudança (só "baseShell"/nome do papel ficam presos ao token; a
 * permissão em si nunca fica velha).
 */
export function requirePermission(module, action) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    try {
      const role = await queries.getRoleByName(req.user.role);
      if (!role?.permissions?.[module]?.[action]) {
        return res.status(403).json({ error: 'Sem permissão para esta ação' });
      }
      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
}
