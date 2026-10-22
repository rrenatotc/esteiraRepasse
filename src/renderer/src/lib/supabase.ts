import { createClient, type SupportedStorage } from '@supabase/supabase-js'
import type { Database } from '@shared/database.types'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const chaveAnon = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const supabaseConfigurado = url.startsWith('https://') && !url.includes('SEU_PROJECT_REF') && chaveAnon !== ''

// A sessão (inclui o refresh token) fica no main, cifrada com safeStorage.
const armazenamentoSeguro: SupportedStorage = {
  getItem: (chave) => window.esteira.sessao.ler(chave),
  setItem: (chave, valor) => window.esteira.sessao.salvar(chave, valor),
  removeItem: (chave) => window.esteira.sessao.remover(chave)
}

export const supabase = createClient<Database>(
  supabaseConfigurado ? url : 'https://nao-configurado.supabase.co',
  supabaseConfigurado ? chaveAnon : 'nao-configurado',
  {
    auth: {
      storage: armazenamentoSeguro,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  }
)
