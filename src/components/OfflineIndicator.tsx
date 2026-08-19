import React, { useEffect, useState } from 'react'
import { useOnlineStatus } from '../context/OfflineContext'
import { Wifi, WifiOff } from 'lucide-react'

/**
 * Indicador discreto de status online/offline
 * Fica em canto fixo (muito discreto)
 */
export function OfflineIndicator() {
  const { isOnline, pendingCount } = useOnlineStatus()
  const [showPending, setShowPending] = useState(false)

  useEffect(() => {
    if (pendingCount > 0) {
      setShowPending(true)
      const timer = setTimeout(() => setShowPending(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [pendingCount])

  if (isOnline && !showPending) {
    return null
  }

  return (
    <div
      className="fixed bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg shadow-sm border text-xs z-40"
      style={{
        backgroundColor: isOnline ? '#ecfdf5' : '#fef2f2',
        borderColor: isOnline ? '#d1fae5' : '#fee2e2',
        color: isOnline ? '#065f46' : '#991b1b'
      }}
    >
      {isOnline ? (
        <>
          <Wifi size={14} />
          <span>Online</span>
        </>
      ) : (
        <>
          <WifiOff size={14} />
          <span>Offline</span>
        </>
      )}

      {pendingCount > 0 && (
        <span
          className="ml-2 px-2 py-0.5 rounded text-xs font-medium"
          style={{
            backgroundColor: isOnline ? '#a7f3d0' : '#fecaca',
            color: isOnline ? '#065f46' : '#7f1d1d'
          }}
        >
          {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}
