// A placa Mercosul é o elemento memorável do app (seção 8): fundo branco,
// faixa azul com "BRASIL", borda escura, tipografia condensada.
import { forwardRef, type InputHTMLAttributes } from 'react'
import { normalizarPlaca } from '@shared/placa'
import { cn } from '@renderer/lib/utils'

function Faixa({ grande }: { grande: boolean }): React.JSX.Element {
  return (
    <div
      aria-hidden
      className={cn(
        'flex items-center justify-center bg-azul-placa text-white font-semibold tracking-[0.18em]',
        grande ? 'h-6 text-[11px]' : 'h-[7px] text-[0px]'
      )}
    >
      {grande && 'BRASIL'}
    </div>
  )
}

/** Placa inline, para listas e detalhes. */
export function Placa({ placa, className }: { placa: string; className?: string }): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex w-[88px] flex-col overflow-hidden rounded-[4px] border border-tinta bg-white align-middle',
        className
      )}
    >
      <Faixa grande={false} />
      <span className="tipo-placa text-center text-[15px] leading-[20px] text-tinta">{placa}</span>
    </span>
  )
}

/** Campo de placa grande (consulta pública e passo 1 do wizard). */
export const PlacaInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
    value: string
    onValueChange: (placa: string) => void
  }
>(function PlacaInput({ value, onValueChange, className, ...props }, ref) {
  return (
    <div
      className={cn(
        'flex w-[340px] flex-col overflow-hidden rounded-placa border-[1.5px] border-tinta bg-white',
        'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-azul-placa',
        className
      )}
    >
      <Faixa grande />
      <input
        ref={ref}
        value={value}
        onChange={(e) => onValueChange(normalizarPlaca(e.target.value).slice(0, 7))}
        maxLength={8}
        autoComplete="off"
        spellCheck={false}
        placeholder="ABC1D23"
        className="tipo-placa h-[76px] w-full bg-transparent text-center text-[52px] leading-none text-tinta placeholder:text-linha focus:outline-none"
        {...props}
      />
    </div>
  )
})
