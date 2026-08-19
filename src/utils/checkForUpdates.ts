/**
 * Sistema de detecção de atualizações para PWA
 * Verifica periodicamente se há nova versão (NÃO faz reload automático)
 * O usuário é notificado e pode escolher quando recarregar
 */

const VERSION_CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutos
let updateAvailable = false;

export function initUpdateCheck() {
  // Verificar na primeira carga (após 2 segundos)
  setTimeout(() => {
    checkForUpdates()
  }, 2000)

  // Verificar periodicamente
  setInterval(() => {
    checkForUpdates()
  }, VERSION_CHECK_INTERVAL)

  // Verificar quando app volta para foreground
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      console.log('[UpdateCheck] App voltou para foreground, verificando atualizações...')
      checkForUpdates()
    }
  })
}

export function isUpdateAvailable(): boolean {
  return updateAvailable;
}

export function reloadForUpdate() {
  console.log('[UpdateCheck] Recarregando para atualizar...')
  
  // Limpar cache do service worker
  if ('caches' in window) {
    caches.keys().then(cacheNames => {
      Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)))
        .then(() => window.location.reload())
    })
  } else {
    window.location.reload()
  }
}

async function checkForUpdates() {
  try {
    console.log('[UpdateCheck] Verificando nova versão...')
    
    // Buscar version.json com cache bypass
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    })

    if (response.ok) {
      const versionData = await response.json() as any
      const newVersion = versionData.version || 'unknown'
      const currentVersion = localStorage.getItem('appVersion') || 'initial'
      
      console.log(`[UpdateCheck] Versão atual: ${currentVersion}, Nova: ${newVersion}`)
      
      if (currentVersion !== 'initial' && newVersion !== currentVersion) {
        console.log('[UpdateCheck] ✨ Nova versão disponível!')
        console.log(`  - Versão: ${newVersion}`)
        console.log(`  - Mudanças: ${versionData.lastUpdate || 'veja version.json'}`)
        updateAvailable = true
        localStorage.setItem('appVersion', newVersion)
        
        // Notificar (sem recarregar) - usuário verá um botão ou banner
        window.dispatchEvent(new CustomEvent('updateAvailable', { 
          detail: { newVersion, lastUpdate: versionData.lastUpdate } 
        }))
      } else if (currentVersion === 'initial') {
        localStorage.setItem('appVersion', newVersion)
        console.log(`[UpdateCheck] Versão inicial registrada: ${newVersion}`)
      }
    }
  } catch (error) {
    console.log('[UpdateCheck] Erro ao verificar atualizações:', error)
  }
}

/**
 * Força reload imediato (para uso em caso de erros críticos)
 */
export function forceReload() {
  console.log('[UpdateCheck] Forçando reload...')
  if ('caches' in window) {
    caches.keys().then(cacheNames => {
      Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)))
        .then(() => window.location.reload(true))
    })
  } else {
    window.location.reload(true)
  }
}

