import { useState, useRef, useEffect } from 'react';
import { Camera, MapPin, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';

interface PhotoUploadWithGeoProps {
  inspectionId: string;
  componentId?: string;
  componentName?: string;
  anomalyId?: string;
  anomalyName?: string;
  onPhotoCapture?: (photoData: any) => void;
  onPhotoUpload?: (response: any) => void;
}

export function PhotoUploadWithGeo({
  inspectionId,
  componentId,
  componentName,
  anomalyId,
  anomalyName,
  onPhotoCapture,
  onPhotoUpload
}: PhotoUploadWithGeoProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [useCamera, setUseCamera] = useState(false);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  
  const { location, error: geoError, loading: geoLoading, requestLocation } = useGeolocation();

  // Iniciar câmera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setUseCamera(true);
      }
    } catch (err) {
      setUploadMessage('Erro ao acessar câmera');
      setUploadStatus('error');
    }
  };

  // Capturar foto da câmera
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const context = canvasRef.current.getContext('2d');
    if (!context) return;

    // Desenhar frame atual do vídeo
    context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

    // Parar câmera
    const stream = videoRef.current.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
    setUseCamera(false);
    setIsCapturingPhoto(true);
  };

  // Resetar câmera
  const resetCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
    setUseCamera(false);
    setIsCapturingPhoto(false);
  };

  // Upload de foto
  const uploadPhoto = async () => {
    if (!canvasRef.current || !inspectionId) return;

    try {
      setUploadStatus('uploading');
      setUploadMessage('Enviando foto...');

      canvasRef.current.toBlob(async (blob) => {
        if (!blob) {
          setUploadStatus('error');
          setUploadMessage('Erro ao processar imagem');
          return;
        }

        const formData = new FormData();
        formData.append('file', blob, 'photo.jpg');
        formData.append('inspectionId', inspectionId);
        if (componentId) formData.append('componentId', componentId);
        if (componentName) formData.append('componentName', componentName);
        if (anomalyId) formData.append('anomalyId', anomalyId);
        if (anomalyName) formData.append('anomalyName', anomalyName);
        
        // Adicionar dados de geolocalização
        if (location) {
          formData.append('latitude', location.latitude.toString());
          formData.append('longitude', location.longitude.toString());
          formData.append('accuracy', location.accuracy.toString());
        }

        // Caption automática com contexto
        const caption = `${componentName || 'Geral'} ${anomalyName ? `- ${anomalyName}` : ''} @ ${new Date().toLocaleString('pt-BR')}${location ? ` [GPS: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}]` : ''}`;
        formData.append('caption', caption);

        const response = await fetch('/api/photos/upload', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          setUploadStatus('success');
          setUploadMessage('Foto enviada com sucesso! ✓');
          
          onPhotoUpload?.(data);
          
          // Limpar após 2 segundos
          setTimeout(() => {
            setIsCapturingPhoto(false);
            setUploadStatus('idle');
            setUploadMessage('');
          }, 2000);
        } else {
          setUploadStatus('error');
          setUploadMessage('Erro ao enviar foto');
        }
      }, 'image/jpeg', 0.9);
    } catch (err) {
      setUploadStatus('error');
      setUploadMessage('Erro ao processar upload');
    }
  };

  // Upload de arquivo (fallback)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !inspectionId) return;

    try {
      setUploadStatus('uploading');
      setUploadMessage('Enviando foto...');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('inspectionId', inspectionId);
      if (componentId) formData.append('componentId', componentId);
      if (componentName) formData.append('componentName', componentName);
      if (anomalyId) formData.append('anomalyId', anomalyId);
      if (anomalyName) formData.append('anomalyName', anomalyName);

      // Adicionar GPS se disponível
      if (location) {
        formData.append('latitude', location.latitude.toString());
        formData.append('longitude', location.longitude.toString());
        formData.append('accuracy', location.accuracy.toString());
      }

      const caption = `${componentName || 'Geral'} ${anomalyName ? `- ${anomalyName}` : ''} @ ${new Date().toLocaleString('pt-BR')}${location ? ` [GPS: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}]` : ''}`;
      formData.append('caption', caption);

      const response = await fetch('/api/photos/upload', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setUploadStatus('success');
        setUploadMessage('Foto enviada com sucesso! ✓');
        
        onPhotoUpload?.(data);

        setTimeout(() => {
          setUploadStatus('idle');
          setUploadMessage('');
        }, 2000);
      } else {
        setUploadStatus('error');
        setUploadMessage('Erro ao enviar foto');
      }
    } catch (err) {
      setUploadStatus('error');
      setUploadMessage('Erro ao processar upload');
    }
  };

  return (
    <div className="space-y-3">
      {/* Status GPS */}
      {location && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="text-green-800 font-medium">GPS Capturado</p>
            <p className="text-green-700 text-xs mt-0.5">
              Lat: {location.latitude.toFixed(5)}, Lon: {location.longitude.toFixed(5)}
              <br />
              Precisão: ±{location.accuracy.toFixed(1)}m
            </p>
          </div>
        </div>
      )}

      {geoError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-yellow-700">{geoError}</div>
        </div>
      )}

      {/* Câmera */}
      {useCamera && (
        <div className="space-y-2">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-80 object-cover rounded-lg bg-black"
          />
          <div className="flex gap-2">
            <button
              onClick={capturePhoto}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700"
            >
              <Camera className="w-4 h-4" />
              Capturar
            </button>
            <button
              onClick={resetCamera}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Preview */}
      {isCapturingPhoto && (
        <div className="space-y-2">
          <canvas
            ref={canvasRef}
            width={1280}
            height={960}
            className="w-full h-80 object-cover rounded-lg bg-gray-200 hidden"
          />
          <img
            src={canvasRef.current?.toDataURL()}
            alt="Preview"
            className="w-full h-80 object-cover rounded-lg"
          />
          <div className="flex gap-2">
            <button
              onClick={uploadPhoto}
              disabled={uploadStatus === 'uploading'}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-green-700 disabled:bg-gray-400"
            >
              <CheckCircle2 className="w-4 h-4" />
              {uploadStatus === 'uploading' ? 'Enviando...' : 'Enviar Foto'}
            </button>
            <button
              onClick={resetCamera}
              disabled={uploadStatus === 'uploading'}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg disabled:bg-gray-300"
            >
              Recapturar
            </button>
          </div>
        </div>
      )}

      {/* Botões Principais */}
      {!useCamera && !isCapturingPhoto && (
        <div className="flex flex-col gap-2">
          <button
            onClick={startCamera}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700"
          >
            <Camera className="w-4 h-4" />
            Usar Câmera
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg"
          >
            Escolher Arquivo
          </button>

          <button
            onClick={requestLocation}
            disabled={geoLoading || !!location}
            className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-purple-700 disabled:bg-gray-400"
          >
            <MapPin className="w-4 h-4" />
            {geoLoading ? 'Capturando GPS...' : location ? 'GPS Capturado' : 'Capturar Localização'}
          </button>
        </div>
      )}

      {/* Status */}
      {uploadStatus !== 'idle' && (
        <div className={`p-3 rounded-lg text-sm ${
          uploadStatus === 'success' ? 'bg-green-100 text-green-800' :
          uploadStatus === 'error' ? 'bg-red-100 text-red-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          {uploadMessage}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
