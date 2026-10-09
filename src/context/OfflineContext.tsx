import React, { createContext, useContext, useEffect, useState } from 'react'
import { offlineStorage } from '../storage/indexedDB'

export interface GeolocationData {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

interface OfflineContextType {
  isOnline: boolean
  pendingCount: number
  hasPendingRequests: boolean
  pushError: string | null
  pullError: string | null
  location: GeolocationData | null
  locationError: string | null
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined)

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [pushError, setPushError] = useState<string | null>(null)
  const [pullError, setPullError] = useState<string | null>(null)
  const [location, setLocation] = useState<GeolocationData | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)

  // Captura GPS automaticamente ao abrir o app e mantém atualizado em segundo
  // plano (watchPosition), para que toda foto tirada já tenha coordenadas
  // sem exigir um botão manual de "Capturar GPS".
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocalização não suportada neste dispositivo')
      return
    }

    const handleSuccess = (position: GeolocationPosition) => {
      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      })
      setLocationError(null)
    }

    const handleError = (err: GeolocationPositionError) => {
      let msg = 'Erro ao obter localização'
      switch (err.code) {
        case err.PERMISSION_DENIED:
          msg = 'Permissão negada para acessar localização. Verifique as configurações do navegador.'
          break
        case err.POSITION_UNAVAILABLE:
          msg = 'Informação de localização não disponível. Tente em um local aberto.'
          break
        case err.TIMEOUT:
          msg = 'Tempo limite excedido ao obter localização'
          break
      }
      setLocationError(msg)
    }

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    })

    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000,
    })

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  useEffect(() => {
    const handlePushFailed = (event: Event) => {
      const detail = (event as CustomEvent<{ error?: string }>).detail
      setPushError(detail?.error || 'Não foi possível enviar alterações ao servidor.')
    }
    const handlePushSuccess = () => setPushError(null)
    const handlePullFailed = (event: Event) => {
      const detail = (event as CustomEvent<{ error?: string }>).detail
      setPullError(detail?.error || 'Não foi possível buscar os dados do servidor.')
    }
    const handlePullSuccess = () => setPullError(null)

    window.addEventListener('backend-sync-failed', handlePushFailed)
    window.addEventListener('backend-sync-success', handlePushSuccess)
    window.addEventListener('backend-pull-failed', handlePullFailed)
    window.addEventListener('backend-pull-success', handlePullSuccess)
    return () => {
      window.removeEventListener('backend-sync-failed', handlePushFailed)
      window.removeEventListener('backend-sync-success', handlePushSuccess)
      window.removeEventListener('backend-pull-failed', handlePullFailed)
      window.removeEventListener('backend-pull-success', handlePullSuccess)
    }
  }, [])

  // Monitor online/offline
  useEffect(() => {
    // A sincronização em si (drenar mutações pendentes + buscar o que há de
    // novo) é disparada pelo próprio motor em src/sync/engine.ts, que já
    // escuta o evento 'online' diretamente — não depende da Background Sync
    // API do navegador (sem suporte no Safari/iOS, comum em tablets de campo).
    const handleOnline = () => {
      setIsOnline(true)
      offlineStorage.setOfflineState(true).catch(console.error)
    }

    const handleOffline = () => {
      setIsOnline(false)
      offlineStorage.setOfflineState(false).catch(console.error)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Conta as mutações realmente pendentes no outbox do motor de
  // sincronização (src/sync/engine.ts) — é a fila que de fato existe hoje;
  // a antiga store 'pending-requests' nunca chegava a ser escrita por
  // nenhum fluxo real, então o indicador sempre mostrava zero.
  useEffect(() => {
    const checkPending = async () => {
      try {
        const pending = await offlineStorage.getOutbox()
        setPendingCount(pending.length)
      } catch (error) {
        console.error('Error checking pending mutations:', error)
      }
    }

    checkPending()
    const interval = setInterval(checkPending, 5000)

    return () => clearInterval(interval)
  }, [])

  // Clean old cache
  useEffect(() => {
    offlineStorage.clearOldCache().catch(console.error)
    const interval = setInterval(() => {
      offlineStorage.clearOldCache().catch(console.error)
    }, 60 * 60 * 1000) // Every hour

    return () => clearInterval(interval)
  }, [])

  const value: OfflineContextType = {
    isOnline,
    pendingCount,
    hasPendingRequests: pendingCount > 0,
    pushError,
    pullError,
    location,
    locationError
  }

  return (
    <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>
  )
}

export function useOnlineStatus() {
  const context = useContext(OfflineContext)
  if (context === undefined) {
    throw new Error('useOnlineStatus must be used within OfflineProvider')
  }
  return context
}
