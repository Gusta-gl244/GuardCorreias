import { useEffect, useState } from 'react';
import { ClipboardList, GripVertical, Pencil, Check, X } from 'lucide-react';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import {
  getChecklistTemplates,
  updateChecklistTemplate,
} from '@/app/data/store';
import { useDataSync } from '@/hooks/useDataSync';
import type { ChecklistTemplate } from '@/app/data/types';

/**
 * O domínio real (planilha FL04-75-21031) tem um único checklist fixo de 10
 * itens por correia — não existe mais "checklist por tipo de estação" nem
 * múltiplos templates. Este painel edita só os rótulos dos itens desse
 * checklist único; a lista de itens em si é fixa (reflete o processo real
 * de inspeção), então não há "criar novo checklist" nem "excluir item".
 */
export function ChecklistsPanel() {
  const { syncCounter } = useDataSync();
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');

  function refresh() {
    setTemplate(getChecklistTemplates()[0] ?? null);
  }
  useEffect(() => { refresh(); }, [syncCounter]);

  function startEdit(itemId: string, currentLabel: string) {
    setEditingId(itemId);
    setEditingLabel(currentLabel);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingLabel('');
  }

  function confirmEdit() {
    if (!template || !editingId || !editingLabel.trim()) return;
    const updated: ChecklistTemplate = {
      ...template,
      items: template.items.map((i) => (i.id === editingId ? { ...i, label: editingLabel.trim() } : i)),
    };
    updateChecklistTemplate(updated);
    setEditingId(null);
    setEditingLabel('');
    refresh();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h2 className="text-sm flex items-center gap-1.5" style={{ color: '#193A2A' }}>
          <ClipboardList className="w-4 h-4" />Checklist de Inspeção de Correia
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Os 10 itens fixos do processo real de inspeção. Você pode ajustar o texto de cada item, mas a lista em si não muda — é o mesmo checklist aplicado a todas as correias.
        </p>
      </div>

      {!template && (
        <Card className="p-8 text-center text-sm text-gray-400">Checklist ainda não carregado.</Card>
      )}

      {template && (
        <Card className="overflow-hidden">
          <div className="divide-y divide-gray-50">
            {template.items.map((item, i) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <GripVertical className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                <span className="text-xs text-gray-400 w-5 shrink-0">{i + 1}.</span>
                {editingId === item.id ? (
                  <>
                    <Input
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') cancelEdit(); }}
                      autoFocus
                      className="flex-1 h-8 text-sm"
                    />
                    <button onClick={confirmEdit} className="text-[#193A2A] hover:opacity-70 shrink-0">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={cancelEdit} className="text-gray-300 hover:text-red-500 shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-gray-700">{item.label}</span>
                    <button onClick={() => startEdit(item.id, item.label)} className="text-gray-300 hover:text-[#AA8933] shrink-0">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
