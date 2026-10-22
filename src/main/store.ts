import { randomUUID } from 'node:crypto'
import Store from 'electron-store'
import type { Config } from '../shared/ipc'

interface Esquema extends Config {
  installId: string
  /** Sessão do Supabase por chave, cifrada com safeStorage (base64). */
  sessao: Record<string, string>
}

export const store = new Store<Esquema>({
  name: 'esteira',
  defaults: {
    installId: randomUUID(),
    sessao: {},
    iniciarComWindows: false,
    notificacoes: true,
    pastaBravos: null,
    aplicarEstoqueAutomatico: false
  }
})

export function lerConfig(): Config {
  return {
    iniciarComWindows: store.get('iniciarComWindows'),
    notificacoes: store.get('notificacoes'),
    pastaBravos: store.get('pastaBravos'),
    aplicarEstoqueAutomatico: store.get('aplicarEstoqueAutomatico')
  }
}
