import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from '@renderer/app/auth'
import { AvisoSemRede } from '@renderer/app/Layout'
import { Button } from '@renderer/components/ui/button'
import { Campo, Input } from '@renderer/components/ui/campo'
import { mensagemErro } from '@renderer/lib/erros'
import { supabase, supabaseConfigurado } from '@renderer/lib/supabase'
import { useOnline } from '@renderer/hooks/useOnline'

const schema = z.object({
  email: z.string().trim().email('Digite um e-mail válido.'),
  senha: z.string().min(1, 'Digite sua senha.')
})
type Dados = z.infer<typeof schema>

export function Entrar(): React.JSX.Element {
  const { sessao } = useAuth()
  const navegar = useNavigate()
  const local = useLocation()
  const online = useOnline()
  const [erro, setErro] = useState<string | null>(null)
  const form = useForm<Dados>({ resolver: zodResolver(schema), defaultValues: { email: '', senha: '' } })

  const destino = (local.state as { de?: string } | null)?.de ?? '/app'
  if (sessao) return <Navigate to={destino} replace />

  const entrar = form.handleSubmit(async ({ email, senha }) => {
    setErro(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) setErro(mensagemErro(error))
    else navegar(destino, { replace: true })
  })

  return (
    <div className="flex min-h-full flex-col">
      <AvisoSemRede />
      <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center px-6 pb-[10vh]">
        <h1 className="mb-1 text-[22px] font-semibold">Entrar na Esteira do Repasse</h1>
        <p className="mb-8 text-grafite">Acesso da equipe. Sua sessão fica lembrada neste computador.</p>

        {!supabaseConfigurado && (
          <p role="alert" className="mb-6 border-l-2 border-erro bg-erro-fundo px-3 py-2 text-[13px] text-erro">
            O app ainda não está ligado ao servidor. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env e
            gere o app de novo.
          </p>
        )}

        <form onSubmit={(e) => void entrar(e)} className="flex flex-col gap-4" noValidate>
          <Campo rotulo="E-mail" erro={form.formState.errors.email?.message}>
            {(p) => <Input {...p} type="email" autoComplete="username" autoFocus {...form.register('email')} />}
          </Campo>
          <Campo rotulo="Senha" erro={form.formState.errors.senha?.message}>
            {(p) => <Input {...p} type="password" autoComplete="current-password" {...form.register('senha')} />}
          </Campo>
          {erro && (
            <p role="alert" className="text-[13px] text-erro">
              {erro}
            </p>
          )}
          <Button type="submit" disabled={form.formState.isSubmitting || !online || !supabaseConfigurado}>
            {form.formState.isSubmitting ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
        <p className="mt-6 text-[13px] text-grafite">
          Esqueceu a senha? Peça ao repasse para reenviar o convite.{' '}
          <Link to="/" className="text-azul-placa underline-offset-2 hover:underline">
            Voltar para a consulta
          </Link>
        </p>
      </div>
    </div>
  )
}
