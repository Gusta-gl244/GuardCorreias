import { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { isUpdateAvailable, reloadForUpdate } from '@/utils/checkForUpdates';
import { Button } from './ui/button';

export function UpdateNotification() {
  const [showNotification, setShowNotification] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);

  useEffect(() => {
    const handleUpdateAvailable = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('[UpdateNotification] Nova versão disponível:', customEvent.detail);
      setUpdateInfo(customEvent.detail);
      setShowNotification(true);
    };

    window.addEventListener('updateAvailable', handleUpdateAvailable);
    
    // Verificar se já há atualização disponível
    if (isUpdateAvailable()) {
      setShowNotification(true);
    }

    return () => window.removeEventListener('updateAvailable', handleUpdateAvailable);
  }, []);

  if (!showNotification) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-blue-600 text-white rounded-lg shadow-lg p-4 flex gap-3 items-start animate-slide-in">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-sm">✨ Nova versão disponível</h3>
          <p className="text-xs text-blue-100 mt-1">
            Uma atualização foi detectada. Clique abaixo para recarregar e atualizar.
          </p>
          {updateInfo?.lastUpdate && (
            <p className="text-xs text-blue-100 mt-0.5">
              📝 {updateInfo.lastUpdate}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowNotification(false)}
          className="text-blue-200 hover:text-white flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <div className="flex gap-2 mt-2">
        <Button
          onClick={reloadForUpdate}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
        >
          🔄 Atualizar Agora
        </Button>
        <Button
          onClick={() => setShowNotification(false)}
          variant="outline"
          className="text-xs h-8"
        >
          Depois
        </Button>
      </div>
    </div>
  );
}
