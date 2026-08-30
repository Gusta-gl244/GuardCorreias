import { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MinusCircle,
  Flag,
} from 'lucide-react';
import type { ChecklistAnswer, ItemResult, InspectionOrder } from '../../data/types';
import {
  getInspectionByOrderId,
  getBeltById,
  saveInspectionProgress,
  completeOrder,
  pauseOrder,
  signInspection,
  addMedia,
  getMediaForInspection,
  generateId,
} from '../../data/store';
import { ITEM_RESULT_CONFIG, RESULTS_REQUIRING_EVIDENCE } from '../../data/beltConstants';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { PhotoManager } from '@/components/PhotoManager';
import { SignaturePad } from '@/components/SignaturePad';
import { useGeolocation } from '@/hooks/useGeolocation';
import type { User } from '../../App';

interface InspectionFlowProps {
  order: InspectionOrder;
  user: User;
  onBack: () => void;
  onComplete: () => void;
  onPause: () => void;
}

const RESULT_ICONS: Record<ItemResult, typeof CheckCircle2> = {
  ok: CheckCircle2,
  nok: XCircle,
  co: AlertTriangle,
  na: MinusCircle,
};

type Stage = 'checklist' | 'observacoes' | 'assinatura';

export function InspectionFlow({ order, user, onBack, onComplete, onPause }: InspectionFlowProps) {
  const insp = getInspectionByOrderId(order.id);
  const belt = insp ? getBeltById(insp.beltId) : undefined;
  const { location } = useGeolocation();

  const [checklist, setChecklist] = useState<ChecklistAnswer[]>(insp?.checklist ?? []);
  const [observacoesGerais, setObservacoesGerais] = useState(insp?.observacoesGerais ?? '');
  const [stage, setStage] = useState<Stage>('checklist');
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseMotivo, setPauseMotivo] = useState('');
  const [signatureImg, setSignatureImg] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [validationError, setValidationError] = useState('');

  const mediaMap = useMemo(() => {
    if (!insp) return new Map<string, string>();
    return new Map(getMediaForInspection(insp.id).map((m) => [m.id, m.dataBase64]));
  }, [insp, checklist]);

  const answeredCount = checklist.filter((c) => c.result !== null).length;
  const progress = checklist.length === 0 ? 0 : Math.round((answeredCount / checklist.length) * 100);

  if (!insp) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center" style={{ backgroundColor: '#f5f5f5' }}>
        <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
        <p className="text-sm text-gray-600 mb-4">Não foi possível carregar esta inspeção.</p>
        <Button onClick={onBack} variant="outline">Voltar</Button>
      </div>
    );
  }

  if (checklist.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center" style={{ backgroundColor: '#f5f5f5' }}>
        <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
        <p className="text-sm text-gray-600 mb-4">
          O checklist de inspeção ainda não foi configurado. Peça ao administrador para cadastrar os itens em Checklists.
        </p>
        <Button onClick={onBack} variant="outline">Voltar</Button>
      </div>
    );
  }

  function save(updated: ChecklistAnswer[]) {
    setChecklist(updated);
    saveInspectionProgress(insp!.id, updated);
  }

  function setItemResult(itemId: string, result: ItemResult) {
    const updated = checklist.map((c) =>
      c.itemId === itemId
        ? { ...c, result, omNumero: result === 'nok' ? c.omNumero : undefined }
        : c
    );
    save(updated);
    setValidationError('');
  }

  function setItemObservation(itemId: string, observation: string) {
    save(checklist.map((c) => (c.itemId === itemId ? { ...c, observation } : c)));
  }

  function setItemOmNumero(itemId: string, omNumero: string) {
    save(checklist.map((c) => (c.itemId === itemId ? { ...c, omNumero } : c)));
  }

  function itemPhotos(item: ChecklistAnswer): string[] {
    return (item.mediaIds ?? []).map((id) => mediaMap.get(id)).filter((v): v is string => !!v);
  }

  /** Converte o array de fotos (base64) devolvido pelo PhotoManager em
   * MediaItems sincronizáveis, mantendo só a lista de IDs no item do
   * checklist — as fotos em si vivem na coleção "media" (ligada ao ID da
   * inspeção, formando a pasta exigida no export). */
  function handleItemPhotosChange(itemId: string, newPhotos: string[]) {
    const item = checklist.find((c) => c.itemId === itemId)!;
    const mediaIds = item.mediaIds ?? [];
    const keptIds = mediaIds.filter((id) => newPhotos.includes(mediaMap.get(id) || '__none__'));
    const existingBase64 = new Set(keptIds.map((id) => mediaMap.get(id)));
    const addedIds: string[] = [];
    for (const photo of newPhotos) {
      if (existingBase64.has(photo)) continue;
      const id = generateId();
      addMedia({
        id,
        inspectionId: insp!.id,
        beltTag: insp!.beltTag,
        tipo: 'foto',
        filename: `foto_${Date.now()}_${id.slice(0, 6)}.jpg`,
        mimeType: 'image/jpeg',
        dataBase64: photo,
        lat: location?.latitude,
        lng: location?.longitude,
        capturedAt: new Date().toISOString(),
      });
      addedIds.push(id);
    }
    save(checklist.map((c) => (c.itemId === itemId ? { ...c, mediaIds: [...keptIds, ...addedIds] } : c)));
  }

  // ── Validação do checklist ──────────────────────────────────────────────
  function checklistIssues(): string | null {
    if (checklist.some((c) => c.result === null)) {
      return 'Responda todos os itens do checklist antes de continuar.';
    }
    const missingEvidence = checklist.filter(
      (c) => c.result && RESULTS_REQUIRING_EVIDENCE.includes(c.result) && itemPhotos(c).length === 0
    );
    if (missingEvidence.length > 0) {
      return `Itens marcados como NOK ou CO exigem ao menos uma foto: ${missingEvidence.map((c) => c.label).join(', ')}.`;
    }
    const missingObservation = checklist.filter(
      (c) => c.result && RESULTS_REQUIRING_EVIDENCE.includes(c.result) && !c.observation?.trim()
    );
    if (missingObservation.length > 0) {
      return `Itens marcados como NOK ou CO exigem uma observação detalhada: ${missingObservation.map((c) => c.label).join(', ')}.`;
    }
    return null;
  }

  function goToObservacoes() {
    const issue = checklistIssues();
    if (issue) {
      setValidationError(issue);
      return;
    }
    setValidationError('');
    setStage('observacoes');
  }

  function handleSaveObservacoes() {
    saveInspectionProgress(insp!.id, checklist, observacoesGerais);
    setStage('assinatura');
  }

  function handlePause() {
    pauseOrder(order.id, user.id, user.name, pauseMotivo || 'Pausa solicitada pelo técnico');
    onPause();
  }

  async function handleFinalConfirm() {
    if (!user.name) return;
    setSigning(true);
    signInspection(insp.id, user.name, signatureImg ?? undefined);
    completeOrder(order.id, user.id, user.name);
    setSigning(false);
    onComplete();
  }

  const nokItems = checklist.filter((c) => c.result === 'nok');
  const coItems = checklist.filter((c) => c.result === 'co');
  const okItems = checklist.filter((c) => c.result === 'ok');
  const naItems = checklist.filter((c) => c.result === 'na');

  // ── Assinatura ───────────────────────────────────────────────────────────
  if (stage === 'assinatura') {
    return (
      <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f5f5f5' }}>
        <div className="sticky top-0 z-10 px-4 py-3 shadow-sm flex items-center gap-3" style={{ backgroundColor: '#193A2A' }}>
          <button onClick={() => setStage('observacoes')} className="text-white"><ChevronLeft className="w-6 h-6" /></button>
          <div className="flex-1 text-white text-sm">Assinatura Digital</div>
        </div>
        <div className="flex-1 p-4 space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-600 mb-3">
              Confirme a conclusão da inspeção <strong>{insp.id}</strong> com sua assinatura.
            </p>
            <p className="text-xs text-gray-500 mb-3">Técnico: <strong>{user.name}</strong></p>
            <SignaturePad onChange={setSignatureImg} />
          </div>
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-lg">
          <Button
            className="w-full text-white"
            style={{ backgroundColor: '#193A2A' }}
            onClick={handleFinalConfirm}
            disabled={!signatureImg || signing}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {signing ? 'Concluindo...' : 'Confirmar e Concluir Inspeção'}
          </Button>
        </div>
      </div>
    );
  }

  // ── Observações Gerais ──────────────────────────────────────────────────
  if (stage === 'observacoes') {
    return (
      <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f5f5f5' }}>
        <div className="sticky top-0 z-10 px-4 py-3 shadow-sm flex items-center gap-3" style={{ backgroundColor: '#193A2A' }}>
          <button onClick={() => setStage('checklist')} className="text-white"><ChevronLeft className="w-6 h-6" /></button>
          <div className="flex-1 text-white text-sm">Resumo — {insp.id}</div>
        </div>

        <div className="flex-1 p-4 space-y-4 pb-32">
          <div className="grid grid-cols-4 gap-2">
            {[
              { val: okItems.length, key: 'ok' as const },
              { val: nokItems.length, key: 'nok' as const },
              { val: coItems.length, key: 'co' as const },
              { val: naItems.length, key: 'na' as const },
            ].map(({ val, key }) => (
              <div key={key} className="bg-white rounded-xl p-3 text-center shadow-sm">
                <div className="text-2xl" style={{ color: ITEM_RESULT_CONFIG[key].color }}>{val}</div>
                <div className="text-xs text-gray-500">{ITEM_RESULT_CONFIG[key].label}</div>
              </div>
            ))}
          </div>

          {nokItems.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm" style={{ color: '#193A2A' }}>Itens NOK ({nokItems.length})</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {nokItems.map((c) => (
                  <div key={c.itemId} className="px-4 py-3">
                    <div className="text-sm" style={{ color: '#193A2A' }}>{c.label}</div>
                    {c.observation && <div className="text-xs text-gray-500 mt-0.5">{c.observation}</div>}
                    {c.omNumero && <div className="text-xs mt-1" style={{ color: '#AA8933' }}>Nº da OM: {c.omNumero}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm px-4 py-3">
            <label className="text-xs text-gray-600 mb-1.5 block">Observações das Avarias Encontradas</label>
            <Textarea
              placeholder="Anotações gerais sobre avarias ou necessidade de manutenção..."
              value={observacoesGerais}
              onChange={(e) => setObservacoesGerais(e.target.value)}
              rows={4}
              className="text-sm"
            />
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-lg">
          <Button className="w-full text-white" style={{ backgroundColor: '#193A2A' }} onClick={handleSaveObservacoes}>
            Continuar para Assinatura
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  // ── Pausa ────────────────────────────────────────────────────────────────
  if (showPauseModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-end bg-black/50">
        <div className="w-full bg-white rounded-t-2xl p-6 space-y-4">
          <h3 className="text-base" style={{ color: '#193A2A' }}>Pausar Inspeção</h3>
          <p className="text-sm text-gray-600">O progresso será salvo. Você pode retomar de onde parou.</p>
          <Textarea placeholder="Motivo da pausa (opcional)" value={pauseMotivo} onChange={(e) => setPauseMotivo(e.target.value)} rows={3} />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowPauseModal(false)}>Cancelar</Button>
            <Button className="flex-1 text-white" style={{ backgroundColor: '#AA8933' }} onClick={handlePause}>Pausar</Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Checklist (tela principal) ──────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f5f5f5' }}>
      <div className="sticky top-0 z-10 shadow-sm" style={{ backgroundColor: '#193A2A' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="text-white"><ChevronLeft className="w-6 h-6" /></button>
          <div className="flex-1">
            <div className="text-white text-xs opacity-75">{insp.beltTag} — {insp.beltName}</div>
            {belt?.tipoCorreia && <div className="text-white/70 text-[11px] truncate">{belt.tipoCorreia}</div>}
          </div>
          <button onClick={() => setShowPauseModal(true)} className="text-white/80 hover:text-white">
            <Flag className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between text-xs text-white/70 mb-1">
            <span>Checklist de Inspeção</span>
            <span>{answeredCount}/{checklist.length} respondidos</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/20">
            <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: '#AA8933' }} />
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-3 pb-32 space-y-2.5">
        {checklist.map((item, i) => {
          const requiresEvidence = item.result != null && RESULTS_REQUIRING_EVIDENCE.includes(item.result);
          return (
            <div key={item.itemId} className="bg-white rounded-xl shadow-sm px-4 py-3">
              <div className="flex items-start gap-2 mb-2.5">
                <span className="text-xs text-gray-400 shrink-0 mt-0.5">{i + 1}.</span>
                <span className="text-sm flex-1" style={{ color: '#193A2A' }}>{item.label}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(['ok', 'nok', 'co', 'na'] as const).map((r) => {
                  const cfg = ITEM_RESULT_CONFIG[r];
                  const Icon = RESULT_ICONS[r];
                  const active = item.result === r;
                  return (
                    <button
                      key={r}
                      onClick={() => setItemResult(item.itemId, r)}
                      className="flex items-center justify-center gap-1 py-1.5 rounded-lg border-2 text-xs transition-all"
                      style={{
                        borderColor: active ? cfg.color : '#e5e7eb',
                        backgroundColor: active ? cfg.bg : '#f9fafb',
                        color: active ? cfg.color : '#9ca3af',
                      }}
                      title={cfg.description}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>

              {requiresEvidence && (
                <div className="mt-2.5 space-y-2 rounded-lg p-2.5" style={{ backgroundColor: ITEM_RESULT_CONFIG[item.result!].bg }}>
                  <Textarea
                    placeholder="Descreva o problema (obrigatório)"
                    value={item.observation || ''}
                    onChange={(e) => setItemObservation(item.itemId, e.target.value)}
                    rows={2}
                    className="text-xs bg-white"
                  />
                  <PhotoManager
                    componentName={insp.beltTag}
                    anomalyName={item.label}
                    photos={itemPhotos(item)}
                    onPhotosChange={(photos) => handleItemPhotosChange(item.itemId, photos)}
                  />
                  {itemPhotos(item).length === 0 && (
                    <p className="text-[11px]" style={{ color: ITEM_RESULT_CONFIG[item.result!].color }}>
                      📷 Foto e observação obrigatórias para itens NOK ou CO.
                    </p>
                  )}
                  {item.result === 'nok' && (
                    <div>
                      <label className="text-[11px] text-gray-500 mb-1 block">Nº da OM aberta (opcional)</label>
                      <Input
                        value={item.omNumero || ''}
                        onChange={(e) => setItemOmNumero(item.itemId, e.target.value)}
                        placeholder="Ex.: 123456"
                        className="text-xs bg-white h-8"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg p-3 space-y-2">
        {validationError && (
          <p className="text-[11px] text-red-600 text-center">{validationError}</p>
        )}
        <Button className="w-full text-white" style={{ backgroundColor: '#193A2A' }} onClick={goToObservacoes}>
          Continuar
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
