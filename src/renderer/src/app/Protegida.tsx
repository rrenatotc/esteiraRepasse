import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { PapelUsuario } from '@shared/tipos'
import { Button } from '@renderer/components/ui/button'
import { useAuth } from './auth'
import { INICIO } from './navegacao'

export function Carregando(): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center text-grafite" role="status">
      Carregando…
    </div>
  )
}

/** Exige login e perfil ativo; opcionalmente restringe por papel. */
export function Protegida({ papeis, children }: { papeis?: PapelUsuario[]; children: ReactNode }): React.JSX.Element {
  const { carregando, sessao, perfil, sair } = useAuth()
  const local = useLocation()

  if (carregando) return <Carregando />
  if (!sessao) return <Navigate to="/entrar" replace state={{ de: local.pathname }} />
  if (!perfil || !perfil.ativo) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-4 px-6">
        <h1 className="text-xl font-semibold">Seu acesso não está ativo</h1>
        <p className="text-grafite">
          Sua conta existe, mas ainda não foi liberada ou foi desativada. Peça ao repasse para ativar seu usuário.
        </p>
        <div>
          <Button variante="secundario" onClick={() => void sair()}>
            Sair
          </Button>
        </div>
      </div>
    )
  }
  if (papeis && !papeis.includes(perfil.papel)) return <Navigate to={INICIO[perfil.papel]} replace />
  return <>{children}</>
}

export function IrParaInicio(): React.JSX.Element {
  const { carregando, perfil } = useAuth()
  if (carregando) return <Carregando />
  return <Navigate to={perfil ? INICIO[perfil.papel] : '/entrar'} replace />
}
