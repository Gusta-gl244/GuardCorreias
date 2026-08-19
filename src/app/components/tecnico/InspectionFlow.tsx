import { useMemo, useState, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Mic,
  Square,
  Flag,
} from 'lucide-react';
import type { InspectionOrder, StationInspection, ChecklistAnswer, RoleteAnomaly, ItemResult } from '../../data/types';
import {
  getInspectionByOrderId,
  saveInspectionProgress,
  completeOrder,
  pauseOrder,
  signInspection,
  getSeverities,
  getStationById,
  addMedia,
  getMediaForInspection,
  generateId,
} from '../../data/store';
import { ITEM_RESULT_CONFIG, STATION_TYPE_LABELS } from '../../data/beltConstants';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { PhotoManager } from '@/components/PhotoManager';
import { RoleteMap } from './RoleteMap';
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

export function InspectionFlow({ order, user, onBack, onComplete, onPause }: InspectionFlowProps) {
  const insp = getInspectionByOrderId(order.id);
  const SEVERITIES = getSeverities();
  const { location } = useGeolocation();

  const [stations, setStations] = useState<StationInspection[]>(insp?.stations ?? []);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseMotivo, setPauseMotivo] = useState('');
  const [signatureImg, setSignatureImg] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);

  const totalStations = stations.length;
  const current = stations[currentIdx];
  const stationDef = current ? getStationById(current.stationId) : undefined;
  const roletes = stationDef?.roletes ?? [];

  const mediaMap = useMemo(() => {
    if (!insp) return new Map<string, string>();
    return new Map(getMediaForInspection(insp.id).map((m) => [m.id, m.dataBase64]));
  }, [insp, stations]);

  const progress = totalStations === 0 ? 0 : Math.round(((currentIdx) / totalStations) * 100);

  if (!insp || !current) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center" style={{ backgroundColor: '#f5f5f5' }}>
        <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
        <p className="text-sm text-gray-600 mb-4">
          Esta correia ainda não tem estações cadastradas. Peça ao administrador para cadastrar a rota antes de iniciar a inspeção.
        </p>
        <Button onClick={onBack} variant="outline">Voltar</Button>
      </div>
    );
  }

  function save(updated: StationInspection[]) {
    setStations(updated);
    saveInspectionProgress(insp!.id, updated);
  }

  function updateCurrent(patch: Partial<StationInspection>) {
    const updated = stations.map((s, i) => (i === currentIdx ? { ...s, ...patch } : s));
    save(updated);
  }

  function setItemResult(itemId: string, result: ItemResult) {
    const checklist = current.checklist.map((c) => (c.itemId === itemId ? { ...c, result } : c));
    const status = deriveStationStatus(checklist, current.roleteAnomalies);
    updateCurrent({ checklist, status });
  }

  function setItemObservation(itemId: string, observation: string) {
    const checklist = current.checklist.map((c) => (c.itemId === itemId ? { ...c, observation } : c));
    updateCurrent({ checklist });
  }

  function photosForMediaIds(mediaIds: string[]): string[] {
    return mediaIds.map((id) => mediaMap.get(id)).filter((v): v is string => !!v);
  }

  /** Converte o array de fotos (base64) devolvido pelo PhotoManager em
   * MediaItems sincronizáveis, mantendo só a lista de IDs no registro da
   * inspeção — as fotos em si vivem na coleção "media" (ligada ao ID da
   * inspeção, formando a pasta exigida no export). */
  function syncPhotos(mediaIds: string[], newPhotos: string[], tipo: 'foto' | 'video', stationId: string, roleteId?: string): string[] {
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
        tipo,
        stationId,
        roleteId,
        filename: `${tipo}_${Date.now()}_${id.slice(0, 6)}.${tipo === 'foto' ? 'jpg' : 'webm'}`,
        mimeType: tipo === 'foto' ? 'image/jpeg' : 'audio/webm',
        dataBase64: photo,
        lat: location?.latitude,
        lng: location?.longitude,
        capturedAt: new Date().toISOString(),
      });
      addedIds.push(id);
    }
    return [...keptIds, ...addedIds];
  }

  function handleItemPhotosChange(itemId: string, newPhotos: string[]) {
    const item = current.checklist.find((c) => c.itemId === itemId)!;
    const mediaIds = syncPhotos(item.mediaIds ?? [], newPhotos, 'foto', current.stationId);
    const checklist = current.checklist.map((c) => (c.itemId === itemId ? { ...c, mediaIds } : c));
    updateCurrent({ checklist });
  }

  function itemPhotos(item: ChecklistAnswer): string[] {
    return photosForMediaIds(item.mediaIds ?? []);
  }

  function handleRoleteAnomalyAdd(anomaly: RoleteAnomaly) {
    const already = current.roleteAnomalies.some((a) => a.id === anomaly.id);
    const roleteAnomalies = already
      ? current.roleteAnomalies.map((a) => (a.id === anomaly.id ? { ...anomaly, stationId: current.stationId } : a))
      : [...current.roleteAnomalies, { ...anomaly, stationId: current.stationId }];
    const status = deriveStationStatus(current.checklist, roleteAnomalies);
    updateCurrent({ roleteAnomalies, status });
  }

  function handleRoleteAnomalyRemove(anomalyId: string) {
    const roleteAnomalies = current.roleteAnomalies.filter((a) => a.id !== anomalyId);
    const status = deriveStationStatus(current.checklist, roleteAnomalies);
    updateCurrent({ roleteAnomalies, status });
  }

  function handleRoletePhotosChange(anomalyId: string, newPhotos: string[]) {
    const anomaly = current.roleteAnomalies.find((a) => a.id === anomalyId)!;
    const mediaIds = syncPhotos(anomaly.mediaIds, newPhotos, 'foto', current.stationId, anomaly.roleteId);
    const roleteAnomalies = current.roleteAnomalies.map((a) => (a.id === anomalyId ? { ...a, mediaIds } : a));
    updateCurrent({ roleteAnomalies });
  }

  // ── Áudio (segure para gravar) ────────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          const id = generateId();
          addMedia({
            id,
            inspectionId: insp!.id,
            beltTag: insp!.beltTag,
            tipo: 'audio',
            stationId: current.stationId,
            filename: `audio_${Date.now()}.webm`,
            mimeType: 'audio/webm',
            dataBase64: base64,
            lat: location?.latitude,
            lng: location?.longitude,
            capturedAt: new Date().toISOString(),
          });
          updateCurrent({ mediaIds: [...current.mediaIds, id] });
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      alert('Não foi possível acessar o microfone.');
    }
  }
  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  // ── Navegação ────────────────────────────────────────────────────────────
  function allItemsAnswered() {
    return current.checklist.every((c) => c.result !== 'pendente');
  }
  function missingRequiredPhotos() {
    return current.checklist.some(
      (c) => (c.result === 'atencao' || c.result === 'critico') && itemPhotos(c).length === 0
    );
  }

  function goNext() {
    if (!allItemsAnswered()) {
      alert('Responda todos os itens do checklist antes de avançar.');
      return;
    }
    if (missingRequiredPhotos()) {
      alert('Itens marcados como Atenção ou Crítico exigem pelo menos uma foto.');
      return;
    }
    if (currentIdx < totalStations - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      setShowSummary(true);
    }
  }
  function goPrev() {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
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

  // ── Assinatura ───────────────────────────────────────────────────────────
  if (showSignature) {
    return (
      <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f5f5f5' }}>
        <div className="sticky top-0 z-10 px-4 py-3 shadow-sm flex items-center gap-3" style={{ backgroundColor: '#193A2A' }}>
          <button onClick={() => setShowSignature(false)} className="text-white"><ChevronLeft className="w-6 h-6" /></button>
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

  // ── Resumo ───────────────────────────────────────────────────────────────
  if (showSummary) {
    const totalAnomalias = stations.reduce((s, st) => s + st.roleteAnomalies.length, 0);
    const criticas = stations.filter((s) => s.status === 'critico').length;
    const atencao = stations.filter((s) => s.status === 'atencao').length;
    const ok = stations.filter((s) => s.status === 'ok').length;

    return (
      <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f5f5f5' }}>
        <div className="sticky top-0 z-10 px-4 py-3 shadow-sm flex items-center gap-3" style={{ backgroundColor: '#193A2A' }}>
          <button onClick={() => setShowSummary(false)} className="text-white"><ChevronLeft className="w-6 h-6" /></button>
          <div className="flex-1 text-white text-sm">Resumo da Inspeção — {insp.id}</div>
        </div>

        <div className="flex-1 p-4 space-y-4 pb-32">
          <div className="grid grid-cols-3 gap-2">
            {[
              { val: ok, label: 'OK', color: '#16a34a' },
              { val: atencao, label: 'Atenção', color: '#AA8933' },
              { val: criticas, label: 'Crítico', color: '#dc2626' },
            ].map(({ val, label, color }) => (
              <div key={label} className="bg-white rounded-xl p-3 text-center shadow-sm">
                <div className="text-2xl" style={{ color }}>{val}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            ))}
          </div>

          {totalAnomalias > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm" style={{ color: '#193A2A' }}>Anomalias em Roletes ({totalAnomalias})</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {stations.flatMap((s) => s.roleteAnomalies.map((a) => {
                  const sev = SEVERITIES.find((sv) => sv.id === a.severity);
                  return (
                    <div key={a.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs text-gray-500">{s.stationName}</div>
                          <div className="text-sm" style={{ color: '#193A2A' }}>{a.descricao}</div>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full text-white shrink-0" style={{ backgroundColor: sev?.color || '#6b7280' }}>
                          {sev?.label || a.severity}
                        </span>
                      </div>
                    </div>
                  );
                }))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm" style={{ color: '#193A2A' }}>Todas as Estações</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {stations.map((s, i) => {
                const cfg = ITEM_RESULT_CONFIG[s.status === 'pendente' ? 'pendente' : s.status];
                return (
                  <button key={s.stationId} onClick={() => { setShowSummary(false); setCurrentIdx(i); }} className="w-full flex items-center px-4 py-2.5 gap-3 text-left">
                    <span style={{ color: cfg.color }}>
                      {s.status === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : s.status === 'pendente' ? null : <AlertTriangle className="w-4 h-4" />}
                    </span>
                    <span className="flex-1 text-sm">{s.stationName}</span>
                    {s.roleteAnomalies.length > 0 && (
                      <span className="text-xs text-gray-400">{s.roleteAnomalies.length} rolete(s)</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-lg">
          <Button className="w-full text-white" style={{ backgroundColor: '#193A2A' }} onClick={() => setShowSignature(true)}>
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

  // ── Estação atual ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f5f5f5' }}>
      <div className="sticky top-0 z-10 shadow-sm" style={{ backgroundColor: '#193A2A' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="text-white"><ChevronLeft className="w-6 h-6" /></button>
          <div className="flex-1">
            <div className="text-white text-xs opacity-75">{insp.beltTag} — {insp.beltName}</div>
            <div className="text-white text-sm">{current.stationName} · {STATION_TYPE_LABELS[current.stationType]}</div>
          </div>
          <button onClick={() => setShowPauseModal(true)} className="text-white/80 hover:text-white">
            <Flag className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between text-xs text-white/70 mb-1">
            <span>Estação {currentIdx + 1} de {totalStations}</span>
            <span>{progress}% concluído</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/20">
            <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: '#AA8933' }} />
          </div>
        </div>
      </div>

      <div className="flex gap-1 px-4 py-2 overflow-x-auto">
        {stations.map((s, i) => {
          const cfg = ITEM_RESULT_CONFIG[s.status === 'pendente' ? 'pendente' : s.status];
          return (
            <button
              key={s.stationId}
              onClick={() => setCurrentIdx(i)}
              className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs transition-all"
              style={{
                backgroundColor: i === currentIdx ? '#AA8933' : s.status !== 'pendente' ? cfg.color : '#d1d5db',
                border: i === currentIdx ? '2px solid #AA8933' : 'none',
              }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="flex-1 px-4 pb-32 space-y-3">
        {/* Checklist */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm" style={{ color: '#193A2A' }}>Checklist</h3>
            {!recording ? (
              <button
                onPointerDown={startRecording}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500"
              >
                <Mic className="w-3.5 h-3.5" /> Segurar p/ gravar
              </button>
            ) : (
              <button
                onPointerUp={stopRecording}
                onPointerLeave={stopRecording}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg text-white animate-pulse"
                style={{ backgroundColor: '#dc2626' }}
              >
                <Square className="w-3 h-3" /> Gravando...
              </button>
            )}
          </div>

          <div className="divide-y divide-gray-50">
            {current.checklist.map((item) => (
              <div key={item.itemId} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm flex-1">{item.label}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['ok', 'atencao', 'critico'] as const).map((r) => {
                    const cfg = ITEM_RESULT_CONFIG[r];
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
                      >
                        {r === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5" /> : r === 'atencao' ? <AlertTriangle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>

                {(item.result === 'atencao' || item.result === 'critico') && (
                  <div className="mt-2.5 space-y-2 bg-amber-50 rounded-lg p-2.5">
                    <Textarea
                      placeholder="Descreva o problema (opcional)"
                      value={item.observation || ''}
                      onChange={(e) => setItemObservation(item.itemId, e.target.value)}
                      rows={2}
                      className="text-xs bg-white"
                    />
                    <PhotoManager
                      componentName={current.stationName}
                      anomalyName={item.label}
                      photos={itemPhotos(item)}
                      onPhotosChange={(photos) => handleItemPhotosChange(item.itemId, photos)}
                    />
                    {itemPhotos(item).length === 0 && (
                      <p className="text-[11px] text-amber-700">📷 Foto obrigatória para itens com Atenção ou Crítico.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Mapa de roletes */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden px-4 py-3">
          <h3 className="text-sm mb-3" style={{ color: '#193A2A' }}>Mapa de Roletes</h3>
          <RoleteMap
            stationName={current.stationName}
            roletes={roletes}
            anomalies={current.roleteAnomalies}
            severities={SEVERITIES}
            photosByAnomaly={Object.fromEntries(current.roleteAnomalies.map((a) => [a.id, photosForMediaIds(a.mediaIds)]))}
            onPhotosChange={handleRoletePhotosChange}
            onAddAnomaly={handleRoleteAnomalyAdd}
            onRemoveAnomaly={handleRoleteAnomalyRemove}
          />
        </div>

        {/* Notas */}
        <div className="bg-white rounded-xl shadow-sm px-4 py-3">
          <label className="text-xs text-gray-600 mb-1.5 block">Observações da estação</label>
          <Textarea
            placeholder="Anotações adicionais..."
            value={current.notes || ''}
            onChange={(e) => updateCurrent({ notes: e.target.value })}
            rows={2}
            className="text-sm"
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg p-3">
        <div className="flex gap-2">
          <Button variant="outline" className="flex-none px-4" onClick={goPrev} disabled={currentIdx === 0}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button
            className="flex-1 text-white"
            style={{ backgroundColor: currentIdx === totalStations - 1 ? '#193A2A' : '#AA8933' }}
            onClick={goNext}
          >
            {currentIdx === totalStations - 1 ? (
              <><CheckCircle2 className="w-4 h-4 mr-2" />Revisar e Concluir</>
            ) : (
              <>Próxima Estação<ChevronRight className="w-4 h-4 ml-2" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function deriveStationStatus(checklist: ChecklistAnswer[], roleteAnomalies: RoleteAnomaly[]): StationInspection['status'] {
  const hasCriticoItem = checklist.some((c) => c.result === 'critico');
  const hasAtencaoItem = checklist.some((c) => c.result === 'atencao');
  const hasCriticoRolete = roleteAnomalies.some((a) => a.severity === 'critica');
  const allAnswered = checklist.every((c) => c.result !== 'pendente');
  if (hasCriticoItem || hasCriticoRolete) return 'critico';
  if (hasAtencaoItem || roleteAnomalies.length > 0) return 'atencao';
  if (allAnswered) return 'ok';
  return 'pendente';
}
