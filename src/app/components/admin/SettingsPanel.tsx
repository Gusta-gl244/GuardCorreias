import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Save } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { settingsAPI } from '@/api/client';

interface GeneralSettings {
  plantName?: string;
  plantLocation?: string;
  tagPattern?: string;
  tagPatternExample?: string;
}

const DEFAULTS: GeneralSettings = {
  plantName: 'Mineração Vale Verde — Projeto Serrote',
  plantLocation: 'Craíbas/Arapiraca, AL',
  tagPattern: '^\\d{4}-CV-\\d{3}$',
  tagPatternExample: '2101-CV-001',
};

export function SettingsPanel() {
  const [form, setForm] = useState<GeneralSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    settingsAPI
      .get('general')
      .then((value: GeneralSettings) => {
        if (value && Object.keys(value).length > 0) setForm({ ...DEFAULTS, ...value });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setError('');
    setSaved(false);
    try {
      new RegExp(form.tagPattern || '');
    } catch {
      setError('Padrão de tag inválido — não é uma expressão regular válida.');
      return;
    }
    try {
      setSaving(true);
      await settingsAPI.set('general', form);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar configurações');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="max-w-2xl mx-auto text-sm text-gray-400 text-center py-8">Carregando...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="text-sm flex items-center gap-1.5" style={{ color: '#193A2A' }}>
        <SettingsIcon className="w-4 h-4" />Configurações do Sistema
      </h2>

      <Card className="p-4 space-y-3">
        <h3 className="text-xs text-gray-500 uppercase tracking-wide">Planta</h3>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Nome</label>
          <Input value={form.plantName || ''} onChange={(e) => setForm({ ...form, plantName: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Localização</label>
          <Input value={form.plantLocation || ''} onChange={(e) => setForm({ ...form, plantLocation: e.target.value })} />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="text-xs text-gray-500 uppercase tracking-wide">Validação de correias</h3>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Padrão de tag (expressão regular)</label>
          <Input
            value={form.tagPattern || ''}
            onChange={(e) => setForm({ ...form, tagPattern: e.target.value })}
            className="font-mono"
          />
          <p className="text-xs text-gray-400 mt-1">
            Usado para validar a tag ao cadastrar uma correia. Padrão real da planta: ÁREA-CV-SEQ.
          </p>
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Exemplo mostrado no formulário</label>
          <Input value={form.tagPatternExample || ''} onChange={(e) => setForm({ ...form, tagPatternExample: e.target.value })} className="font-mono" />
        </div>
      </Card>

      {error && <div className="text-xs text-red-600 bg-red-50 rounded p-2">{error}</div>}
      {saved && <div className="text-xs text-green-700 bg-green-50 rounded p-2">Configurações salvas.</div>}

      <Button className="text-white" style={{ backgroundColor: '#193A2A' }} onClick={handleSave} disabled={saving}>
        <Save className="w-4 h-4 mr-1.5" />{saving ? 'Salvando...' : 'Salvar configurações'}
      </Button>
    </div>
  );
}
