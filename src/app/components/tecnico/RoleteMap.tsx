import { useState } from 'react';
import { X } from 'lucide-react';
import type { Rolete, RoleteAnomaly, SeverityOption } from '../../data/types';
import { ROLETE_TIPO_LABELS } from '../../data/beltConstants';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { PhotoManager } from '@/components/PhotoManager';

interface RoleteMapProps {
  stationName: string;
  roletes: Rolete[];
  anomalies: RoleteAnomaly[];
  severities: SeverityOption[];
  photosByAnomaly: Record<string, string[]>;
  onPhotosChange: (anomalyId: string, photos: string[]) => void;
  onAddAnomaly: (anomaly: RoleteAnomaly) => void;
  onRemoveAnomaly: (anomalyId: string) => void;
}

/** Mapa de roletes interativo: toca no rolete problemático para registrar a
 * anomalia — roletes sem toque ficam implicitamente OK, sem exigir marcar
 * um por um (o checklist geral da estação já cobre a inspeção básica). */
export function RoleteMap({
  stationName,
  roletes,
  anomalies,
  severities,
  photosByAnomaly,
  onPhotosChange,
  onAddAnomaly,
  onRemoveAnomaly,
}: RoleteMapProps) {
  const [selectedRolete, setSelectedRolete] = useState<Rolete | null>(null);
  const [descricao, setDescricao] = useState('');
  const [severity, setSeverity] = useState(severities[0]?.id ?? '');

  if (roletes.length === 0) {
    return (
      <p className="text-xs text-gray-400 text-center py-3">
        Nenhum rolete cadastrado para esta estação.
      </p>
    );
  }

  function anomalyFor(roleteId: string) {
    return anomalies.find((a) => a.roleteId === roleteId);
  }

  function openRolete(r: Rolete) {
    const existing = anomalyFor(r.id);
    setDescricao(existing?.descricao ?? '');
    setSeverity(existing?.severity ?? severities[0]?.id ?? '');
    setSelectedRolete(r);
  }

  function confirmAnomaly() {
    if (!selectedRolete || !descricao.trim()) return;
    const existing = anomalyFor(selectedRolete.id);
    onAddAnomaly({
      id: existing?.id ?? crypto.randomUUID(),
      stationId: '',
      stationName,
      roleteId: selectedRolete.id,
      tipo: selectedRolete.tipo,
      descricao: descricao.trim(),
      severity,
      mediaIds: existing?.mediaIds ?? [],
    });
    setSelectedRolete(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {roletes.map((r) => {
          const anomaly = anomalyFor(r.id);
          const sev = anomaly ? severities.find((s) => s.id === anomaly.severity) : null;
          const color = sev?.color ?? '#d1d5db';
          return (
            <button
              key={r.id}
              onClick={() => openRolete(r)}
              className="shrink-0 flex flex-col items-center gap-1"
            >
              <div
                className="w-9 h-9 rounded-full border-2 flex items-center justify-center text-[10px] transition-all"
                style={{
                  borderColor: color,
                  backgroundColor: anomaly ? `${color}22` : '#fff',
                  color: anomaly ? color : '#9ca3af',
                }}
              >
                {r.posicao}
              </div>
              <span className="text-[9px] text-gray-400 text-center leading-tight max-w-[48px]">
                {ROLETE_TIPO_LABELS[r.tipo]}
              </span>
            </button>
          );
        })}
      </div>

      {selectedRolete && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm" style={{ color: '#193A2A' }}>
              Rolete {selectedRolete.posicao} — {ROLETE_TIPO_LABELS[selectedRolete.tipo]}
            </h4>
            <button onClick={() => setSelectedRolete(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="text-xs text-gray-600 mb-1 block">Severidade</label>
            <div className="grid grid-cols-2 gap-1.5">
              {severities.map((sev) => (
                <button
                  key={sev.id}
                  onClick={() => setSeverity(sev.id)}
                  className="text-xs py-1.5 px-2 rounded-lg border-2 transition-all"
                  style={{
                    borderColor: severity === sev.id ? sev.color : '#e5e7eb',
                    backgroundColor: severity === sev.id ? `${sev.color}20` : '#fff',
                    color: severity === sev.id ? sev.color : '#9ca3af',
                  }}
                >
                  {sev.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-600 mb-1 block">Descrição do problema *</label>
            <Textarea
              placeholder="Ex.: rolete travado, desgaste excessivo..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              className="text-sm bg-white"
            />
          </div>

          {anomalyFor(selectedRolete.id) && (
            <PhotoManager
              componentName={stationName}
              anomalyName={`Rolete ${selectedRolete.posicao}`}
              photos={photosByAnomaly[anomalyFor(selectedRolete.id)!.id] ?? []}
              onPhotosChange={(photos) => onPhotosChange(anomalyFor(selectedRolete.id)!.id, photos)}
            />
          )}

          <div className="flex gap-2">
            {anomalyFor(selectedRolete.id) && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-red-600 border-red-200"
                onClick={() => { onRemoveAnomaly(anomalyFor(selectedRolete.id)!.id); setSelectedRolete(null); }}
              >
                Remover
              </Button>
            )}
            <Button
              size="sm"
              className="flex-1 text-white"
              style={{ backgroundColor: '#AA8933' }}
              onClick={confirmAnomaly}
              disabled={!descricao.trim()}
            >
              Confirmar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
