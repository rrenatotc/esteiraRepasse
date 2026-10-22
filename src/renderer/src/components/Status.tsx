import type { StatusDemanda } from '@shared/tipos'
import { cn } from '@renderer/lib/utils'

export const ROTULO_STATUS: Record<StatusDemanda, string> = {
  nova: 'Nova',
  em_proposta: 'Em proposta',
  proposta_emitida: 'Proposta emitida',
  faturada: 'Faturada',
  concluida: 'Concluída',
  pendente: 'Pendente',
  cancelada: 'Cancelada'
}

// Classes completas para o Tailwind encontrar no build.
const COR_TEXTO: Record<StatusDemanda, string> = {
  nova: 'text-status-nova',
  em_proposta: 'text-status-em-proposta',
  proposta_emitida: 'text-status-proposta-emitida',
  faturada: 'text-status-faturada',
  concluida: 'text-status-concluida',
  pendente: 'text-status-pendente',
  cancelada: 'text-grafite' // #8B93A1 não passa AA como texto
}

export const COR_TRILHO: Record<StatusDemanda, string> = {
  nova: 'bg-status-nova',
  em_proposta: 'bg-status-em-proposta',
  proposta_emitida: 'bg-status-proposta-emitida',
  faturada: 'bg-status-faturada',
  concluida: 'bg-status-concluida',
  pendente: 'bg-status-pendente',
  cancelada: 'bg-status-cancelada'
}

/** Rótulo de status: ponto colorido + texto. Nunca só cor. */
export function Status({ status, className }: { status: StatusDemanda; className?: string }): React.JSX.Element {
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-medium', COR_TEXTO[status], className)}>
      <span aria-hidden className={cn('size-2 rounded-full', COR_TRILHO[status])} />
      {ROTULO_STATUS[status]}
    </span>
  )
}
