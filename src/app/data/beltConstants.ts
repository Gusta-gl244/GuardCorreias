import type { ItemResult, RoleteStatus, RoleteTipo, StationType } from './types';

export const STATION_TYPE_LABELS: Record<StationType, string> = {
  cabeca: 'Cabeça',
  intermediaria: 'Estação',
  esticadora: 'Esticadora',
  retorno: 'Retorno',
  descarga: 'Descarga',
};

export const ROLETE_TIPO_LABELS: Record<RoleteTipo, string> = {
  carga: 'Rolete de Carga',
  retorno: 'Rolete de Retorno',
  impacto: 'Rolete de Impacto',
  alinhamento: 'Rolete de Alinhamento',
};

export const ITEM_RESULT_CONFIG: Record<ItemResult, { label: string; color: string; bg: string }> = {
  ok: { label: 'OK', color: '#16a34a', bg: '#e8f5e9' },
  atencao: { label: 'Atenção', color: '#AA8933', bg: '#fff8e1' },
  critico: { label: 'Crítico', color: '#dc2626', bg: '#fee2e2' },
  pendente: { label: 'Pendente', color: '#9ca3af', bg: '#f9fafb' },
};

export const ROLETE_STATUS_CONFIG: Record<RoleteStatus, { label: string; color: string }> = {
  ok: { label: 'OK', color: '#16a34a' },
  atencao: { label: 'Atenção', color: '#AA8933' },
  critico: { label: 'Crítico', color: '#dc2626' },
  'nao-inspecionado': { label: 'Não inspecionado', color: '#d1d5db' },
};

/** Estação-tipo (rota sugerida padrão): Cabeça → Estações intermediárias → Retorno. */
export const STATION_ROUTE_ORDER: StationType[] = ['cabeca', 'intermediaria', 'esticadora', 'retorno', 'descarga'];
