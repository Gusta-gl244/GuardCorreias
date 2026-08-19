import type { AppData } from '@/app/data/types';

/**
 * Exporta todos os dados (cópia local) em JSON — útil para uma cópia rápida
 * em disco. O backup completo e organizado (com mídias como arquivos reais)
 * é o ZIP gerado pelo servidor, ver src/api/client.js#backupsAPI.
 */
export function exportDataAsJSON(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

export function exportBeltsAsCSV(data: AppData): string {
  const headers = ['ID', 'TAG', 'Nome', 'Área', 'Status Operacional', 'Saúde', 'Data de Criação'];
  const rows = data.belts.map((b) => [
    b.id, b.tag, b.name, b.area || '', b.status, b.healthStatus, b.createdAt || '',
  ]);
  return [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
}

export function exportInspectionOrdersAsCSV(data: AppData): string {
  const headers = ['ID', 'Correia', 'Técnico', 'Supervisor', 'Prioridade', 'Status', 'Prazo', 'Data de Criação'];
  const rows = data.inspectionOrders.map((order) => [
    order.id, order.beltId, order.technicianId, order.supervisorId,
    order.priority, order.status, order.deadline, order.createdAt,
  ]);
  return [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
}

export function downloadFile(content: string, filename: string, type: 'json' | 'csv' = 'json'): void {
  const mimeType = type === 'json' ? 'application/json' : 'text/csv';
  downloadBlob(new Blob([content], { type: mimeType }), filename);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString('pt-BR', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}
