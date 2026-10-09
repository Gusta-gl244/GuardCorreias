import { useState, useRef } from 'react';
import { Camera, ImagePlus, LoaderCircle, MapPin, Trash2, ZoomIn } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { addWatermarkToImage, addWatermarkToCanvas } from '@/utils/watermarkImage';
import { CameraWithWatermark } from './CameraWithWatermark';
import { PhotoLightbox } from './PhotoLightbox';

interface PhotoManagerProps {
  componentId?: string;
  componentName?: string;
  anomalyId?: string;
  anomalyName?: string;
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  inspectionId?: string;
}

export function PhotoManager({
  componentId,
  componentName,
  anomalyId,
  anomalyName,
  photos,
  onPhotosChange,
  inspectionId
}: PhotoManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showGeoInfo, setShowGeoInfo] = useState(false);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [processingPhotos, setProcessingPhotos] = useState(false);
  
  const { location, error: geoError } = useGeolocation();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    setProcessingPhotos(true);
    try {
      const processedPhotos: string[] = [];
      for (const file of files) {
        try {
          const blobWithWatermark = await addWatermarkToImage(file, {
            latitude: location?.latitude,
            longitude: location?.longitude,
            accuracy: location?.accuracy,
            componentName,
            anomalyName,
          });
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Formato de imagem inválido'));
            reader.onerror = () => reject(reader.error || new Error('Falha ao ler imagem'));
            reader.readAsDataURL(blobWithWatermark);
          });
          processedPhotos.push(base64);
        } catch (err) {
          console.error('Erro ao processar arquivo', err);
        }
      }

      if (processedPhotos.length > 0) onPhotosChange([...photos, ...processedPhotos]);
    } finally {
      setProcessingPhotos(false);
    }
  };

  const removePhoto = (index: number) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {/* GPS Status */}
      {location && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
          <div className="text-xs">
            <p className="text-green-800 font-medium">GPS: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</p>
            <p className="text-green-700">Precisão: ±{location.accuracy.toFixed(1)}m</p>
          </div>
        </div>
      )}

      {!location && !geoError && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-500 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
          Obtendo localização em segundo plano...
        </div>
      )}

      {geoError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-700">
          {geoError}
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setShowCamera(true)}
          disabled={processingPhotos}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-gray-50 disabled:opacity-50"
          style={{ color: '#193A2A' }}
        >
          <Camera className="h-5 w-5" />
          Câmera
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={processingPhotos}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-gray-50 disabled:opacity-50"
          style={{ color: '#193A2A' }}
        >
          {processingPhotos ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          {processingPhotos ? 'Processando...' : 'Galeria'}
        </button>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">Fotos registradas</p>
            {location && <p className="mt-0.5 text-xs text-green-700">GPS registrado</p>}
          </div>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">{photos.length}</span>
        </div>

        {photos.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo, i) => (
              <div key={`${i}-${photo.slice(-24)}`} className="relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setViewingIndex(i)}
                  aria-label={`Visualizar foto ${i + 1}`}
                  className="group relative block aspect-[4/3] w-full overflow-hidden bg-gray-100"
                >
                  <img src={photo} alt={`Foto ${i + 1}`} className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/75 to-transparent px-2 pb-2 pt-6 text-xs font-semibold text-white">
                    <ZoomIn className="h-4 w-4" />
                    Visualizar
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  disabled={processingPhotos}
                  aria-label={`Remover foto ${i + 1}`}
                  title="Remover foto"
                  className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white text-red-700 shadow-md transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
                <div className="px-2.5 py-2 text-xs font-medium text-gray-600">Foto {i + 1}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-h-20 items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white/70 px-4 text-sm text-gray-500">
            <ImagePlus className="h-5 w-5" />
            Nenhuma foto registrada
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        disabled={processingPhotos}
        className="hidden"
      />

      {/* Camera Modal */}
      {showCamera && (
        <CameraWithWatermark
          componentName={componentName}
          anomalyName={anomalyName}
          onPhotoCapture={(base64) => {
            onPhotosChange([...photos, base64]);
            setShowCamera(false);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {viewingIndex !== null && (
        <PhotoLightbox
          photos={photos}
          initialIndex={viewingIndex}
          onClose={() => setViewingIndex(null)}
          fileNamePrefix={componentName || 'foto'}
        />
      )}
    </div>
  );
}
