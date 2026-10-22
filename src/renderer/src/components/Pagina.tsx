import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

/** Cabeçalho + corpo padrão das telas. `estreita` para telas de coluna central. */
export function Pagina({
  titulo,
  acoes,
  estreita = false,
  children
}: {
  titulo: string
  acoes?: ReactNode
  estreita?: boolean
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className={cn('px-8 py-6', estreita && 'mx-auto max-w-[720px]')}>
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">{titulo}</h1>
        {acoes}
      </header>
      {children}
    </div>
  )
}
