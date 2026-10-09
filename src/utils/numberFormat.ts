/**
 * Converte texto digitado em número, aceitando tanto o formato brasileiro
 * (vírgula como separador decimal, ponto como separador de milhar opcional)
 * quanto o formato internacional (ponto como decimal).
 *
 * parseFloat()/Number() sozinhos não entendem vírgula como separador
 * decimal — parseFloat() simplesmente para de ler no primeiro caractere que
 * não reconhece, então "748000,25" virava silenciosamente 748000 (a parte
 * decimal era descartada sem nenhum aviso); Number() com vírgula retorna
 * NaN direto. Isso fazia formulários com coordenadas/medidas digitadas no
 * formato brasileiro salvarem valores errados ou zerados.
 */
export function parseDecimal(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;

  let normalized = trimmed;
  if (normalized.includes(',')) {
    // Vírgula presente: ponto (se houver) é separador de milhar — remove —
    // e a vírgula vira o separador decimal.
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  }

  const value = parseFloat(normalized);
  return Number.isNaN(value) ? 0 : value;
}
