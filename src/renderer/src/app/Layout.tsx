import { WifiOff } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useOnline } from '@renderer/hooks/useOnline'
import { cn } from '@renderer/lib/utils'
import { useAuth } from './auth'
import { NAVEGACAO } from './navegacao'

export function AvisoSemRede(): React.JSX.Element | null {
  const online = useOnline()
  if (online) return null
  return (
    <div role="status" className="flex items-center gap-2 border-b border-alerta-parado/30 bg-[#fdf3ee] px-4 py-2 text-[13px] text-alerta-parado">
      <WifiOff className="size-4" aria-hidden />
      Sem conexão com a internet. Nada será enviado até a rede voltar; o app reconecta sozinho.
    </div>
  )
}

/** Moldura das telas logadas: navegação lateral estreita por papel + conteúdo. */
export function Layout(): React.JSX.Element {
  const { perfil } = useAuth()
  const itens = perfil ? NAVEGACAO[perfil.papel] : []

  return (
    <div className="flex h-full">
      <nav aria-label="Principal" className="flex w-[76px] shrink-0 flex-col items-stretch border-r border-linha bg-superficie py-3">
        <div aria-hidden className="mx-auto mb-4 flex h-7 w-11 flex-col overflow-hidden rounded-[3px] border border-tinta">
          <span className="h-[5px] bg-azul-placa" />
          <span className="tipo-placa flex-1 text-center text-[11px] leading-[18px]">ER</span>
        </div>
        <ul className="flex flex-1 flex-col gap-0.5">
          {itens.map(({ rota, rotulo, icone: Icone }) => (
            <li key={rota}>
              <NavLink
                to={rota}
                end={rota === '/app/vendas'}
                className={({ isActive }) =>
                  cn(
                    'relative mx-1.5 flex flex-col items-center gap-1 rounded-sm px-1 py-2 text-[11px] leading-tight text-grafite hover:bg-papel hover:text-tinta',
                    isActive && 'bg-superficie-selecionada text-azul-placa hover:bg-superficie-selecionada hover:text-azul-placa'
                  )
                }
              >
                <Icone className="size-5" strokeWidth={1.75} aria-hidden />
                <span className="text-center">{rotulo}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <AvisoSemRede />
        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
