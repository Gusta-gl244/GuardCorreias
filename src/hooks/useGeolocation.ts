import { useOnlineStatus } from '@/context/OfflineContext';
import type { GeolocationData } from '@/context/OfflineContext';

export type { GeolocationData };

interface UseGeolocationReturn {
  location: GeolocationData | null;
  error: string | null;
  loading: boolean;
  requestLocation: () => void;
}

/**
 * A localização é capturada automaticamente pelo OfflineProvider assim que o
 * app abre (e mantida atualizada em segundo plano via watchPosition), então
 * nenhum componente precisa mais solicitar/repetir a captura manualmente.
 * requestLocation é mantido apenas por compatibilidade de interface (no-op).
 */
export function useGeolocation(): UseGeolocationReturn {
  const { location, locationError } = useOnlineStatus();

  return {
    location,
    error: locationError,
    loading: false,
    requestLocation: () => {},
  };
}
