import { useState, useRef } from 'react';
import { Camera, MapPin, Trash2 } from 'lucide-react';
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
  
  const { location, error: geoError } = useGeolocation();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    for (const file of files) {
      try {
        // Adicionar watermark à imagem
        const blobWithWatermark = await addWatermarkToImage(file, {
          latitude: location?.latitude,
          longitude: location?.longitude,
          accuracy: location?.accuracy,
          componentName,
          anomalyName
        });

        // Converter blob para base64
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          onPhotosChange([...photos, base64]);
        };
        reader.readAsDataURL(blobWithWatermark);
      } catch (err) {
        console.error('Erro ao processar arquivo', err);
      }
    }

    // Reset input
    e.target.value = '';
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
      <div className="flex gap-2">
        <button
          onClick={() => setShowCamera(true)}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm"
          style={{ color: '#193A2A' }}
        >
          <Camera className="w-4 h-4" />
          Câmera
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm"
          style={{ color: '#193A2A' }}
        >
          📁 Galeria
        </button>
      </div>

      {/* Photos Preview */}
      {photos.length > 0 && (
        <div>
          <p className="text-xs text-gray-600 mb-2 font-medium">
            Fotos ({photos.length})
            {location && ' • GPS Registrado'}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo, i) => (
              <div key={i} className="relative group">
                <img
                  src={photo}
                  alt={`Foto ${i + 1}`}
                  className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-pointer"
                  onClick={() => setViewingIndex(i)}
                />
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[9px] px-1.5 py-0.5 rounded">
                  {i + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
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
