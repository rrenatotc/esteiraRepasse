// Sessão do Supabase guardada cifrada (safeStorage → DPAPI no Windows).
import { safeStorage } from 'electron'
import log from 'electron-log/main'
import { store } from './store'

export function lerSessao(chave: string): string | null {
  const cifrado = store.get('sessao')[chave]
  if (!cifrado || !safeStorage.isEncryptionAvailable()) return null
  try {
    return safeStorage.decryptString(Buffer.from(cifrado, 'base64'))
  } catch (erro) {
    log.warn('Sessão salva não pôde ser lida; descartando', erro)
    removerSessao(chave)
    return null
  }
}

export function salvarSessao(chave: string, valor: string): void {
  // Sem cifra disponível, não guarda: o usuário entra de novo na próxima vez.
  if (!safeStorage.isEncryptionAvailable()) return
  const sessao = { ...store.get('sessao') }
  sessao[chave] = safeStorage.encryptString(valor).toString('base64')
  store.set('sessao', sessao)
}

export function removerSessao(chave: string): void {
  const sessao = { ...store.get('sessao') }
  delete sessao[chave]
  store.set('sessao', sessao)
}
