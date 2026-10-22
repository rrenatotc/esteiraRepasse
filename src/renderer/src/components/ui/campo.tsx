import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-sm border border-linha bg-superficie px-3 text-tinta placeholder:text-grafite/70',
        'focus-visible:border-azul-placa focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azul-placa/25',
        'aria-[invalid=true]:border-erro disabled:bg-papel',
        className
      )}
      {...props}
    />
  )
})

interface CampoProps {
  rotulo: string
  erro?: string
  ajuda?: ReactNode
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode
}

/** Rótulo + controle + mensagem de erro, com ids ligados para leitores de tela. */
export function Campo({ rotulo, erro, ajuda, children }: CampoProps): React.JSX.Element {
  const id = useId()
  const idDescricao = erro || ajuda ? `${id}-descricao` : undefined
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-tinta">
        {rotulo}
      </label>
      {children({ id, 'aria-invalid': !!erro, 'aria-describedby': idDescricao })}
      {(erro || ajuda) && (
        <p id={idDescricao} className={cn('text-[13px]', erro ? 'text-erro' : 'text-grafite')}>
          {erro ?? ajuda}
        </p>
      )}
    </div>
  )
}
