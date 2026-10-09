import type { Belt, BeltHealthStatus, InspectionOrder } from './types';

// Cor da correia no mapa satélite: verde / amarelo / vermelho.
export const HEALTH_STATUS_COLORS: Record<BeltHealthStatus, string> = {
  saudavel: '#16a34a',
  atencao: '#eab308',
  critico: '#dc2626',
};

export const HEALTH_STATUS_LABELS: Record<BeltHealthStatus, string> = {
  saudavel: 'Saudável',
  atencao: 'Atenção',
  critico: 'Crítico',
};

export type BeltDemandStatus =
  | 'sem-demanda'    // cinza — nenhuma ordem associada
  | 'atribuida'      // azul — ordem atribuída, ainda não iniciada
  | 'em-andamento'   // amarelo — inspeção em andamento
  | 'atrasada';      // vermelho escuro — ordem com prazo vencido

export const DEMAND_STATUS_COLORS: Record<BeltDemandStatus, string> = {
  'sem-demanda': '#6b7280',
  atribuida: '#2563eb',
  'em-andamento': '#eab308',
  atrasada: '#7f1d1d',
};

/**
 * Status da demanda (ordens de inspeção) de uma correia — independente da
 * saúde física (healthStatus, atualizada só quando uma inspeção é
 * concluída). Usado para destacar no mapa/dashboard se há trabalho pendente.
 */
export function computeBeltDemandStatus(belt: Belt, orders: InspectionOrder[], now: number = Date.now()): BeltDemandStatus {
  const beltOrders = orders.filter((o) => o.beltId === belt.id && o.status !== 'concluido' && o.status !== 'cancelado');
  const isOverdue = beltOrders.some((o) => o.deadline && new Date(o.deadline).getTime() < now);
  if (isOverdue) return 'atrasada';
  if (beltOrders.some((o) => o.status === 'em-andamento' || o.status === 'pausado')) return 'em-andamento';
  if (beltOrders.some((o) => o.status === 'pendente')) return 'atribuida';
  return 'sem-demanda';
}
