import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/utils'

export const botao = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 cursor-default select-none',
  {
    variants: {
      variante: {
        primario: 'bg-azul-placa text-white hover:bg-azul-placa-hover',
        secundario: 'border border-linha bg-superficie text-tinta hover:bg-papel',
        fantasma: 'text-tinta hover:bg-papel',
        perigo: 'border border-linha bg-superficie text-erro hover:bg-erro-fundo'
      },
      tamanho: {
        md: 'h-9 px-4',
        sm: 'h-8 px-3 text-[13px]',
        lg: 'h-11 px-5 text-[15px]',
        icone: 'h-8 w-8'
      }
    },
    defaultVariants: { variante: 'primario', tamanho: 'md' }
  }
)

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof botao>

export function Button({ className, variante, tamanho, type = 'button', ...props }: ButtonProps): React.JSX.Element {
  return <button type={type} className={cn(botao({ variante, tamanho }), className)} {...props} />
}
