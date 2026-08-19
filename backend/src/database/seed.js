import bcrypt from 'bcryptjs';
import * as queries from './queries-postgres.js';

/**
 * Cria exatamente 3 contas reais (senha com hash de verdade, gravadas no
 * Postgres) só na primeira vez que o sistema sobe com a tabela de usuários
 * vazia — bootstrap de banco, não um mock embutido no bundle do frontend.
 * Nenhuma correia/estação é semeada aqui — o cadastro de ativos fica vazio
 * até a importação dos dados reais da planta.
 */
export async function seedTestAccountsIfEmpty() {
  const existing = await queries.getAllUsers();
  if (existing.length > 0) return;

  console.log('👤 Nenhum usuário encontrado — criando as 3 contas de teste iniciais...');

  const accounts = [
    { name: 'Técnico Teste', email: 'tecnico@guardcorreias.com', role: 'tecnico' },
    { name: 'Supervisor Teste', email: 'supervisor@guardcorreias.com', role: 'supervisor' },
    { name: 'Administrador', email: 'admin@guardcorreias.com', role: 'superadm' },
  ];
  const password = 'guardcorreias';
  const passwordHash = await bcrypt.hash(password, 10);

  for (const acc of accounts) {
    await queries.createUser({ ...acc, passwordHash, status: 'active' });
  }

  console.log(`✅ Contas de teste criadas (senha para todas: "${password}"). Altere depois de testar.`);
}

/**
 * Semeia as severidades padrão (baixa/média/alta/crítica) e um checklist
 * genérico por tipo de estação — só na primeira vez que essas tabelas
 * estiverem vazias. Diferente das contas de teste, isso NÃO é dado
 * inventado sobre o ativo físico (correias/estações continuam vazias); é
 * configuração de sistema (escala de severidade, itens de checklist),
 * equivalente ao catálogo de componentes que o INSPEC360 populava a partir
 * da planilha real — aqui, como ainda não há planilha real do cliente,
 * usamos um checklist de referência baseado em prática comum de inspeção de
 * correias transportadoras, editável depois pelo admin.
 */
export async function seedDefaultsIfEmpty() {
  const severities = await queries.getAllSeverities();
  if (severities.length === 0) {
    console.log('⚙️  Semeando severidades padrão...');
    const defaults = [
      { id: 'baixa', label: 'Baixa', color: '#16a34a', points: 1, description: 'Sem risco imediato, acompanhar na próxima rota' },
      { id: 'media', label: 'Média', color: '#AA8933', points: 2, description: 'Necessita atenção em breve' },
      { id: 'alta', label: 'Alta', color: '#ea580c', points: 3, description: 'Risco relevante, priorizar manutenção' },
      { id: 'critica', label: 'Crítica', color: '#dc2626', points: 4, description: 'Risco de parada não programada, ação imediata' },
    ];
    for (const s of defaults) await queries.createSeverity(s);
  }

  const templates = await queries.getAllChecklistTemplates();
  if (templates.length === 0) {
    console.log('⚙️  Semeando checklist padrão de estação...');
    const defaultTemplate = {
      id: 'checklist-estacao-padrao',
      name: 'Checklist Padrão de Estação',
      icon: '🔧',
      appliesTo: 'geral',
      weight: 1,
      items: [
        { id: 'roletes-carga', label: 'Roletes de carga (giro e alinhamento)' },
        { id: 'roletes-retorno', label: 'Roletes de retorno (giro e alinhamento)' },
        { id: 'roletes-impacto', label: 'Roletes de impacto' },
        { id: 'alinhamento-correia', label: 'Alinhamento da correia' },
        { id: 'emendas', label: 'Emendas (integridade)' },
        { id: 'raspadores', label: 'Raspadores / limpadores' },
        { id: 'protecoes', label: 'Proteções e guarda-corpos' },
        { id: 'estrutura', label: 'Estrutura de suporte (corrosão / deformação)' },
        { id: 'motores-redutores', label: 'Motores e redutores (ruído / vibração / vazamento)' },
        { id: 'sistema-frenagem', label: 'Sistema de frenagem / catraca' },
        { id: 'chave-emergencia', label: 'Chaves de emergência (puxa-fio)' },
        { id: 'limpeza-geral', label: 'Limpeza geral / acúmulo de material' },
      ],
    };
    await queries.createChecklistTemplate(defaultTemplate);
  }
}
