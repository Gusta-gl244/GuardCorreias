import { useEffect, useState } from 'react';
import { MapPinned, Plus, Trash2, Pencil } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { getAreas, addArea, updateArea, deleteArea } from '@/app/data/store';
import { useDataSync } from '@/hooks/useDataSync';
import type { Area } from '@/app/data/types';

export function AreasPanel() {
  const { syncCounter } = useDataSync();
  const [areas, setAreas] = useState<Area[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function refresh() {
    setAreas([...getAreas()].sort((a, b) => a.code.localeCompare(b.code)));
  }
  useEffect(() => { refresh(); }, [syncCounter]);

  function startEdit(area: Area) {
    setEditingId(area.id);
    setForm({ code: area.code, name: area.name });
    setShowForm(true);
  }
  function startNew() {
    setEditingId(null);
    setForm({ code: '', name: '' });
    setShowForm(true);
  }

  async function handleSave() {
    setError('');
    if (!form.code.trim() || !form.name.trim()) {
      setError('Preencha código e nome da área.');
      return;
    }
    try {
      setSaving(true);
      if (editingId) await updateArea(editingId, form);
      else await addArea(form);
      setShowForm(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar área');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta área? Correias que já usam este código continuam com o valor gravado.')) return;
    try {
      await deleteArea(id);
      refresh();
    } catch {
      alert('Falha ao excluir área.');
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm flex items-center gap-1.5" style={{ color: '#193A2A' }}>
          <MapPinned className="w-4 h-4" />Áreas ({areas.length})
        </h2>
        <Button size="sm" className="text-white" style={{ backgroundColor: '#AA8933' }} onClick={startNew}>
          <Plus className="w-4 h-4 mr-1.5" />Nova Área
        </Button>
      </div>
      <p className="text-xs text-gray-400">
        Catálogo usado no cadastro de correias (campo "área"). Vem pré-carregado com os códigos do
        Projeto Serrote — edite ou complete para refletir a planta real.
      </p>

      {showForm && (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Código *</label>
              <Input placeholder="ex: 2101" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Nome *</label>
              <Input placeholder="ex: Britagem Primária" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
          </div>
          {error && <div className="text-xs text-red-600 bg-red-50 rounded p-2">{error}</div>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button className="flex-1 text-white" style={{ backgroundColor: '#193A2A' }} onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar área'}
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {areas.map((area) => (
          <Card key={area.id} className="p-3.5 flex items-center gap-3">
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0">{area.code}</span>
            <div className="flex-1 text-sm" style={{ color: '#193A2A' }}>{area.name}</div>
            <button onClick={() => startEdit(area)} className="text-gray-300 hover:text-[#AA8933] shrink-0">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => handleDelete(area.id)} className="text-gray-300 hover:text-red-500 shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </Card>
        ))}
        {areas.length === 0 && <div className="text-sm text-gray-400 text-center py-8">Nenhuma área cadastrada.</div>}
      </div>
    </div>
  );
}
