import { useOnlineStatus } from '../context/OfflineContext'
import { AlertTriangle, CloudUpload, WifiOff } from 'lucide-react'

/**
 * Indicador discreto de status online/offline
 * Fica em canto fixo (muito discreto)
 */
export function OfflineIndicator() {
  const { isOnline, pendingCount, pushError, pullError } = useOnlineStatus()
  const hasError = Boolean(pushError || pullError)

  if (isOnline && pendingCount === 0 && !hasError) {
    return null
  }

  const title = !isOnline
    ? 'Sem conexão com o servidor'
    : pushError
      ? 'Falha ao enviar alterações'
      : pullError
        ? 'Dados podem estar desatualizados'
        : 'Aguardando confirmação do servidor'
  const message = !isOnline
    ? 'As alterações ficam neste dispositivo até a conexão voltar.'
    : pushError
      ? pushError
      : pullError
        ? pullError
        : 'As alterações ainda não foram confirmadas no banco.'

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 left-3 right-3 z-40 flex items-start gap-3 rounded-xl border p-3.5 text-sm shadow-lg sm:bottom-4 sm:left-auto sm:right-4 sm:w-[360px]"
      style={{
        backgroundColor: !isOnline ? '#fef2f2' : '#fff8e8',
        borderColor: !isOnline ? '#fecaca' : '#ead8a6',
        color: !isOnline ? '#991b1b' : '#704f05'
      }}
    >
      {!isOnline || hasError ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> : <CloudUpload className="mt-0.5 h-5 w-5 shrink-0" />}
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 break-words text-xs opacity-90">{message}</p>
        {pendingCount > 0 && (
          <p className="mt-1.5 text-xs font-semibold">
            {pendingCount} {pendingCount === 1 ? 'alteração pendente' : 'alterações pendentes'}. Não limpe os dados deste navegador até confirmar a sincronização.
          </p>
        )}
      </div>
    </div>
  )
}
