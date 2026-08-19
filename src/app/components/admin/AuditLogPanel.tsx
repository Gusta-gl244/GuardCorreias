import { useEffect, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { auditLogAPI } from '@/api/client';
import type { SystemLog } from '@/app/data/types';

const LEVEL_COLOR: Record<string, string> = {
  info: '#193A2A',
  success: '#16a34a',
  warning: '#AA8933',
  error: '#dc2626',
};

export function AuditLogPanel() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [level, setLevel] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');

  function refresh() {
    setLoading(true);
    setError('');
    auditLogAPI
      .getAll({ level: level || undefined, module: moduleFilter || undefined, limit: 200 })
      .then((data: SystemLog[]) => setLogs(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar log de auditoria'))
      .finally(() => setLoading(false));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refresh(); }, [level, moduleFilter]);

  const modules = Array.from(new Set(logs.map((l) => l.module))).sort();

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm flex items-center gap-1.5" style={{ color: '#193A2A' }}>
          <History className="w-4 h-4" />Auditoria
        </h2>
        <Button variant="ghost" size="sm" onClick={refresh}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex gap-2">
        <select value={level} onChange={(e) => setLevel(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs">
          <option value="">Todos os níveis</option>
          <option value="info">Info</option>
          <option value="success">Sucesso</option>
          <option value="warning">Atenção</option>
          <option value="error">Erro</option>
        </select>
        <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs">
          <option value="">Todos os módulos</option>
          {modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {error && <div className="text-xs text-red-600 bg-red-50 rounded p-2">{error}</div>}

      <Card className="p-0 overflow-hidden">
        <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className="p-3 flex items-start gap-3 text-xs">
              <span className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ backgroundColor: LEVEL_COLOR[log.level] || '#9ca3af' }} />
              <div className="flex-1">
                <div className="text-gray-700">{log.message}</div>
                <div className="text-gray-400 mt-0.5">
                  {log.module} · {log.userName || 'sistema'} · {new Date(log.timestamp).toLocaleString('pt-BR')}
                </div>
              </div>
            </div>
          ))}
          {!loading && logs.length === 0 && <div className="text-sm text-gray-400 text-center py-8">Nenhum registro encontrado.</div>}
        </div>
      </Card>
    </div>
  );
}
