import { useEffect, useState } from 'react';
import { AlertTriangle, Plus, Trash2, Pencil } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { getSeverities, addSeverity, updateSeverity, deleteSeverity, generateId } from '@/app/data/store';
import { useDataSync } from '@/hooks/useDataSync';
import type { SeverityOption } from '@/app/data/types';

function emptyForm() {
  return { id: '', label: '', color: '#AA8933', points: 1, description: '' };
}

export function SeveritiesPanel() {
  const { syncCounter } = useDataSync();
  const [severities, setSeverities] = useState<SeverityOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');

  function refresh() {
    setSeverities([...getSeverities()].sort((a, b) => a.points - b.points));
  }
  useEffect(() => { refresh(); }, [syncCounter]);

  function startEdit(sev: SeverityOption) {
    setForm({ id: sev.id, label: sev.label, color: sev.color, points: sev.points, description: sev.description });
    setShowForm(true);
  }
  function startNew() {
    setForm(emptyForm());
    setShowForm(true);
  }

  function handleSave() {
    setError('');
    if (!form.label.trim()) { setError('Dê um nome à severidade.'); return; }

    const sev: SeverityOption = {
      id: form.id || generateId(),
      label: form.label.trim(),
      color: form.color,
      points: Number(form.points) || 0,
      description: form.description.trim(),
    };
    if (form.id) updateSeverity(sev);
    else addSeverity(sev);
    setShowForm(false);
    refresh();
  }

  function handleDelete(id: string) {
    if (!confirm('Excluir esta severidade? Achados já registrados mantêm o valor gravado.')) return;
    deleteSeverity(id);
    refresh();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm flex items-center gap-1.5" style={{ color: '#193A2A' }}>
          <AlertTriangle className="w-4 h-4" />Severidades ({severities.length})
        </h2>
        <Button size="sm" className="text-white" style={{ backgroundColor: '#AA8933' }} onClick={startNew}>
          <Plus className="w-4 h-4 mr-1.5" />Nova Severidade
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-[1fr_60px_80px] gap-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Nome *</label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Cor</label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-full h-9 rounded-lg border border-gray-200 cursor-pointer"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Peso</label>
              <Input type="number" value={form.points} onChange={(e) => setForm({ ...form, points: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Descrição</label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          {error && <div className="text-xs text-red-600 bg-red-50 rounded p-2">{error}</div>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button className="flex-1 text-white" style={{ backgroundColor: '#193A2A' }} onClick={handleSave}>
              {form.id ? 'Salvar alterações' : 'Criar severidade'}
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {severities.map((sev) => (
          <Card key={sev.id} className="p-3.5 flex items-center gap-3">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: sev.color }} />
            <div className="flex-1">
              <div className="text-sm" style={{ color: '#193A2A' }}>{sev.label} <span className="text-xs text-gray-400">· peso {sev.points}</span></div>
              {sev.description && <div className="text-xs text-gray-400">{sev.description}</div>}
            </div>
            <button onClick={() => startEdit(sev)} className="text-gray-300 hover:text-[#AA8933] shrink-0">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => handleDelete(sev.id)} className="text-gray-300 hover:text-red-500 shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </Card>
        ))}
        {severities.length === 0 && <div className="text-sm text-gray-400 text-center py-8">Nenhuma severidade cadastrada.</div>}
      </div>
    </div>
  );
}
