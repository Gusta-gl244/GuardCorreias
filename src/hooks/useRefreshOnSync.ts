import { useEffect, useCallback } from 'react';
import { refreshCurrentData } from '@/app/data/store';

/**
 * Hook para sincronizar dados quando detectado mudanças de outro dispositivo
 * NÃO recarrega a página (mantém a sessão do usuário)
 */
export function useRefreshOnSync() {
  const handleDataSync = useCallback(() => {
    console.log('[Refresh] ✅ Dados sincronizados! Atualizando interface...');
    // Apenas recarregar os dados do localStorage (NÃO recarregar a página)
    refreshCurrentData();
  }, []);

  useEffect(() => {
    const handleSync = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('[Refresh] dataSync recebido:', customEvent.detail);
      
      // Sincronizar dados (NÃO fazer reload)
      if (customEvent.detail?.source !== 'self') {
        handleDataSync();
      }
    };

    window.addEventListener('dataSync', handleSync);
    return () => window.removeEventListener('dataSync', handleSync);
  }, [handleDataSync]);
}
