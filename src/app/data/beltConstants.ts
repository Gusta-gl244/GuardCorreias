import type { ItemResult } from './types';

/**
 * Config visual dos 4 estados da legenda real da planilha (FL04-75-21031):
 * OK / NOK / CO ("com observação") / NA ("não aplicável"). `null`
 * (não respondido ainda) é tratado à parte pelos componentes, não tem
 * entrada aqui.
 */
export const ITEM_RESULT_CONFIG: Record<ItemResult, { label: string; description: string; color: string; bg: string }> = {
  ok: { label: 'OK', description: 'Em boas condições físicas', color: '#16a34a', bg: '#e8f5e9' },
  nok: { label: 'NOK', description: 'Não em boas condições físicas', color: '#dc2626', bg: '#fee2e2' },
  co: { label: 'CO', description: 'Com observação', color: '#AA8933', bg: '#fff8e1' },
  na: { label: 'NA', description: 'Não aplicável', color: '#6b7280', bg: '#f3f4f6' },
};

/** Itens que exigem foto + observação detalhada obrigatórias antes de avançar. */
export const RESULTS_REQUIRING_EVIDENCE: ItemResult[] = ['nok', 'co'];
