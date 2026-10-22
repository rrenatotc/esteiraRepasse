import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Loja, Perfil } from '@shared/tipos'
import { supabase, supabaseConfigurado } from '@renderer/lib/supabase'

export type PerfilComLoja = Perfil & { loja: Pick<Loja, 'id' | 'codigo' | 'nome'> | null }

interface Auth {
  carregando: boolean
  sessao: Session | null
  perfil: PerfilComLoja | null
  sair: () => Promise<void>
}

const AuthContext = createContext<Auth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [iniciando, setIniciando] = useState(supabaseConfigurado)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!supabaseConfigurado) return
    void supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session)
      setIniciando(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, nova) => setSessao(nova))
    return () => data.subscription.unsubscribe()
  }, [])

  const uid = sessao?.user.id
  const perfil = useQuery({
    queryKey: ['perfil', uid],
    enabled: !!uid,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PerfilComLoja | null> => {
      const { data, error } = await supabase
        .from('perfis')
        .select('*, loja:lojas(id, codigo, nome)')
        .eq('id', uid!)
        .maybeSingle()
      if (error) throw error
      return data
    }
  })

  const valor: Auth = {
    carregando: iniciando || (!!uid && perfil.isPending),
    sessao,
    perfil: perfil.data ?? null,
    sair: async () => {
      await supabase.auth.signOut()
      queryClient.clear()
    }
  }
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth(): Auth {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}
