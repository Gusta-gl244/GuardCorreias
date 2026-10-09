import { useState, useRef } from 'react';
import { Camera, X, CheckCircle2, AlertCircle, Loader } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { addWatermarkToCanvas } from '@/utils/watermarkImage';

interface CameraWithWatermarkProps {
  componentName?: string;
  anomalyName?: string;
  onPhotoCapture: (base64: string) => void;
  onClose: () => void;
}

export function CameraWithWatermark({
  componentName,
  anomalyName,
  onPhotoCapture,
  onClose
}: CameraWithWatermarkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { location } = useGeolocation();

  // capture="environment" entrega o arquivo ao app de câmera nativo do
  // dispositivo — com zoom, autofoco, flash e captura em alta resolução
  // controlados pelo próprio SO — em vez de um preview de câmera customizado
  // via getUserMedia (que não expõe esses controles nativos).
  const processFile = async (file: File) => {
    try {
      setIsProcessing(true);
      setError(null);

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const img = new Image();
      img.onload = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);

        const blob = await addWatermarkToCanvas(canvas, {
          latitude: location?.latitude,
          longitude: location?.longitude,
          accuracy: location?.accuracy,
          componentName,
          anomalyName
        });

        const reader2 = new FileReader();
        reader2.onload = () => {
          setPreviewImage(reader2.result as string);
          setIsProcessing(false);
        };
        reader2.readAsDataURL(blob);
      };
      img.onerror = () => {
        setError('Erro ao processar imagem.');
        setIsProcessing(false);
      };
      img.src = dataUrl;
    } catch (err) {
      setError('Erro ao processar imagem.');
      setIsProcessing(false);
    }
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) processFile(file);
  };

  const confirmPhoto = () => {
    if (previewImage) {
      onPhotoCapture(previewImage);
    }
  };

  const retakePhoto = () => {
    setPreviewImage(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-medium" style={{ color: '#193A2A' }}>
            Capturar Foto com Marca d'água
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Tela de escolha */}
          {!previewImage && !isProcessing && (
            <div className="w-full h-80 bg-gradient-to-b from-blue-50 to-white rounded-lg flex flex-col items-center justify-center gap-6 p-6">
              <div className="text-center">
                <Camera className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                <h4 className="text-lg font-semibold text-gray-800 mb-2">Como capturar a foto?</h4>
              </div>

              <div className="flex flex-col gap-2 w-full">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full px-4 py-3 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
                >
                  📷 Usar Câmera
                </button>
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  className="w-full px-4 py-3 text-sm rounded-lg border-2 border-blue-600 text-blue-600 hover:bg-blue-50 transition-colors font-medium"
                >
                  📁 Usar Galeria
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 w-full">
                <div className="text-xs text-blue-700 space-y-1">
                  <p className="font-medium">Marca d'água será adicionada:</p>
                  <ul className="space-y-0.5">
                    <li>✓ {componentName || 'Componente'}</li>
                    {anomalyName && <li>✓ {anomalyName}</li>}
                    <li>✓ Data e Hora</li>
                    {location && <li>✓ GPS: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Processando */}
          {isProcessing && !previewImage && (
            <div className="w-full h-80 flex flex-col items-center justify-center gap-3">
              <Loader className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-sm text-gray-500">Processando imagem...</p>
            </div>
          )}

          {/* Preview */}
          {previewImage && (
            <>
              <img
                src={previewImage}
                alt="Preview"
                className="w-full h-80 object-cover rounded-lg"
              />
              <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <p className="text-xs text-green-700">Marca d'água adicionada!</p>
              </div>
            </>
          )}

          {/* Erro */}
          {error && !previewImage && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />

          {/* capture="environment" abre o app de câmera nativo do dispositivo */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelected}
            className="hidden"
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelected}
            className="hidden"
          />
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 p-4 flex gap-2">
          {previewImage ? (
            <>
              <button
                onClick={retakePhoto}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Recapturar
              </button>
              <button
                onClick={confirmPhoto}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirmar
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
