// Peças visuais compartilhadas pelos passos do registro de venda.
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/utils'

const PASSOS = ['Placa', 'Lojista', 'Valor e loja', 'Revisão']

export function Etapas({ atual }: { atual: number }): React.JSX.Element {
  return (
    <ol aria-label="Etapas" className="mb-8 flex items-center gap-2 text-[13px]">
      {PASSOS.map((nome, i) => (
        <li key={nome} className="flex items-center gap-2" aria-current={i === atual ? 'step' : undefined}>
          {i > 0 && <span aria-hidden className={cn('h-px w-8', i <= atual ? 'bg-azul-placa' : 'bg-linha')} />}
          <span
            className={cn(
              'flex size-6 items-center justify-center rounded-full border text-[12px] numeros',
              i < atual && 'border-azul-placa bg-azul-placa text-white',
              i === atual && 'border-azul-placa text-azul-placa',
              i > atual && 'border-linha text-grafite'
            )}
          >
            {i + 1}
          </span>
          <span className={cn(i === atual ? 'font-medium text-tinta' : 'text-grafite')}>{nome}</span>
        </li>
      ))}
    </ol>
  )
}

export function Confirmacao({ titulo, children, acao }: { titulo: ReactNode; children?: ReactNode; acao?: ReactNode }): React.JSX.Element {
  return (
    <div className="animate-surgir flex items-start gap-3 border border-linha bg-superficie px-4 py-3">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-status-faturada" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{titulo}</div>
        {children && <div className="text-[13px] text-grafite">{children}</div>}
      </div>
      {acao}
    </div>
  )
}

export function Mensagem({ tom, children }: { tom: 'erro' | 'alerta' | 'info'; children: ReactNode }): React.JSX.Element {
  const Icone = tom === 'info' ? Info : AlertTriangle
  return (
    <p
      role={tom === 'info' ? 'status' : 'alert'}
      className={cn(
        'flex items-start gap-2 border-l-2 px-3 py-2 text-[13px]',
        tom === 'erro' && 'border-erro bg-erro-fundo text-erro',
        tom === 'alerta' && 'border-alerta-parado bg-[#fdf3ee] text-alerta-parado',
        tom === 'info' && 'border-linha bg-superficie text-grafite'
      )}
    >
      <Icone className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

export function Selecao({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>): React.JSX.Element {
  return (
    <select
      className={cn(
        'h-9 w-full rounded-sm border border-linha bg-superficie px-2 text-tinta focus-visible:border-azul-placa focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azul-placa/25',
        className
      )}
      {...props}
    />
  )
}

export function AreaTexto({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>): React.JSX.Element {
  return (
    <textarea
      className={cn(
        'min-h-20 w-full rounded-sm border border-linha bg-superficie px-3 py-2 text-tinta placeholder:text-grafite/70 focus-visible:border-azul-placa focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azul-placa/25',
        className
      )}
      {...props}
    />
  )
}

export function Rodape({ children }: { children: ReactNode }): React.JSX.Element {
  return <div className="mt-8 flex justify-end gap-2 border-t border-linha pt-4">{children}</div>
}
