import { useEffect, useState } from 'react';
import { ClipboardList, Plus, Trash2, Pencil, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import {
  getChecklistTemplates,
  addChecklistTemplate,
  updateChecklistTemplate,
  deleteChecklistTemplate,
  generateId,
} from '@/app/data/store';
import { useDataSync } from '@/hooks/useDataSync';
import type { ChecklistTemplate, ChecklistItem } from '@/app/data/types';

const APPLIES_TO_OPTIONS = [
  { value: 'geral', label: 'Geral (qualquer estação)' },
  { value: 'cabeca', label: 'Cabeça' },
  { value: 'intermediaria', label: 'Intermediária' },
  { value: 'esticadora', label: 'Esticadora' },
  { value: 'retorno', label: 'Retorno' },
  { value: 'descarga', label: 'Descarga' },
];

function emptyForm() {
  return { id: '', name: '', icon: '🔧', appliesTo: 'geral', weight: 1, items: [] as ChecklistItem[] };
}

export function ChecklistsPanel() {
  const { syncCounter } = useDataSync();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [newItemLabel, setNewItemLabel] = useState('');
  const [error, setError] = useState('');

  function refresh() {
    setTemplates(getChecklistTemplates());
  }
  useEffect(() => { refresh(); }, [syncCounter]);

  function startEdit(tpl: ChecklistTemplate) {
    setForm({ id: tpl.id, name: tpl.name, icon: tpl.icon, appliesTo: tpl.appliesTo, weight: tpl.weight, items: [...tpl.items] });
    setShowForm(true);
  }
  function startNew() {
    setForm(emptyForm());
    setShowForm(true);
  }

  function addItem() {
    if (!newItemLabel.trim()) return;
    setForm((f) => ({ ...f, items: [...f.items, { id: generateId(), label: newItemLabel.trim() }] }));
    setNewItemLabel('');
  }
  function removeItem(id: string) {
    setForm((f) => ({ ...f, items: f.items.filter((i) => i.id !== id) }));
  }

  function handleSave() {
    setError('');
    if (!form.name.trim()) { setError('Dê um nome ao checklist.'); return; }
    if (form.items.length === 0) { setError('Adicione ao menos um item.'); return; }

    const tpl: ChecklistTemplate = {
      id: form.id || generateId(),
      name: form.name.trim(),
      icon: form.icon || '🔧',
      appliesTo: form.appliesTo,
      weight: form.weight,
      items: form.items,
    };
    if (form.id) updateChecklistTemplate(tpl);
    else addChecklistTemplate(tpl);
    setShowForm(false);
    refresh();
  }

  function handleDelete(id: string) {
    if (!confirm('Excluir este checklist? Inspeções já feitas não são afetadas.')) return;
    deleteChecklistTemplate(id);
    refresh();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm flex items-center gap-1.5" style={{ color: '#193A2A' }}>
          <ClipboardList className="w-4 h-4" />Checklists ({templates.length})
        </h2>
        <Button size="sm" className="text-white" style={{ backgroundColor: '#AA8933' }} onClick={startNew}>
          <Plus className="w-4 h-4 mr-1.5" />Novo Checklist
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-[1fr_80px] gap-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Nome *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Ícone</label>
              <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Aplica-se a</label>
            <select
              value={form.appliesTo}
              onChange={(e) => setForm({ ...form, appliesTo: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              {APPLIES_TO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-600 mb-1 block">Itens ({form.items.length})</label>
            <div className="space-y-1.5 mb-2">
              {form.items.map((item) => (
                <div key={item.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                  <span className="flex-1 text-sm text-gray-700">{item.label}</span>
                  <button onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {form.items.length === 0 && <p className="text-xs text-gray-400">Nenhum item ainda.</p>}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Descrição do item (ex: Roletes de carga)"
                value={newItemLabel}
                onChange={(e) => setNewItemLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
              />
              <Button variant="outline" onClick={addItem}>Adicionar</Button>
            </div>
          </div>

          {error && <div className="text-xs text-red-600 bg-red-50 rounded p-2">{error}</div>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button className="flex-1 text-white" style={{ backgroundColor: '#193A2A' }} onClick={handleSave}>
              {form.id ? 'Salvar alterações' : 'Criar checklist'}
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {templates.map((tpl) => (
          <Card key={tpl.id} className="p-3.5 flex items-center gap-3">
            <span className="text-lg shrink-0">{tpl.icon}</span>
            <div className="flex-1">
              <div className="text-sm" style={{ color: '#193A2A' }}>{tpl.name}</div>
              <div className="text-xs text-gray-400">{tpl.items.length} itens · aplica-se a: {tpl.appliesTo}</div>
            </div>
            <button onClick={() => startEdit(tpl)} className="text-gray-300 hover:text-[#AA8933] shrink-0">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => handleDelete(tpl.id)} className="text-gray-300 hover:text-red-500 shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </Card>
        ))}
        {templates.length === 0 && <div className="text-sm text-gray-400 text-center py-8">Nenhum checklist cadastrado.</div>}
      </div>
    </div>
  );
}
