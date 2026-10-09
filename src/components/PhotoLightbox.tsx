import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';

interface PhotoLightboxProps {
  photos: string[];
  initialIndex: number;
  onClose: () => void;
  /** Nome de arquivo por foto (opcional); usado ao baixar. */
  fileNamePrefix?: string;
}

/**
 * Visualizador de foto em tela cheia. Antes desta implementação não havia
 * nenhum jeito de abrir uma foto capturada em tamanho real em nenhum lugar
 * do app (nem durante a inspeção/execução, nem no relatório) — só
 * miniaturas pequenas sem interação.
 */
export function PhotoLightbox({ photos, initialIndex, onClose, fileNamePrefix = 'foto' }: PhotoLightboxProps) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + photos.length) % photos.length);
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % photos.length);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [photos.length, onClose]);

  if (photos.length === 0) return null;
  const current = photos[index];

  return (
    <div
      className="fixed inset-0 bg-black/90 z-[3000] flex flex-col items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <a
          href={current}
          download={`${fileNamePrefix}_${index + 1}.jpg`}
          onClick={(e) => e.stopPropagation()}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          title="Baixar foto"
        >
          <Download className="w-5 h-5" />
        </a>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {photos.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIndex((i) => (i - 1 + photos.length) % photos.length); }}
          className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          title="Foto anterior"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      <img
        src={current}
        alt={`Foto ${index + 1} de ${photos.length}`}
        className="max-w-full max-h-[85vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />

      {photos.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIndex((i) => (i + 1) % photos.length); }}
          className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          title="Próxima foto"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {photos.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-xs bg-black/40 px-3 py-1 rounded-full">
          {index + 1} / {photos.length}
        </div>
      )}
    </div>
  );
}
