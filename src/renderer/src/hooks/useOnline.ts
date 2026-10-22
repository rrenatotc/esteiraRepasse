import { useSyncExternalStore } from 'react'

function assinar(cb: () => void): () => void {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

/** RNF10: estado da rede, para avisar e bloquear envios. */
export function useOnline(): boolean {
  return useSyncExternalStore(assinar, () => navigator.onLine)
}
