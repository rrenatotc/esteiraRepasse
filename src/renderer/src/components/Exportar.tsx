import { useMutation } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import type { Coluna } from '@shared/exportar'
import { Button } from '@renderer/components/ui/button'
import { mensagemErro } from '@renderer/lib/erros'
import { exportar } from '@renderer/lib/exportar'

/** Botões "CSV" e "XLSX" que exportam exatamente a lista mostrada. */
export function BotoesExportar<T>({ base, colunas, linhas }: { base: string; colunas: Coluna<T>[]; linhas: T[] }): React.JSX.Element {
  const acao = useMutation({ mutationFn: (formato: 'csv' | 'xlsx') => exportar(base, formato, colunas, linhas) })
  return (
    <span className="flex items-center gap-1.5 text-[13px]">
      <Download className="size-3.5 text-grafite" aria-hidden />
      <span className="text-grafite">Exportar</span>
      {(['csv', 'xlsx'] as const).map((f) => (
        <Button key={f} tamanho="sm" variante="secundario" className="h-7 px-2" disabled={acao.isPending || linhas.length === 0} onClick={() => acao.mutate(f)}>
          {f.toUpperCase()}
        </Button>
      ))}
      {acao.isSuccess && acao.data && <span className="text-status-faturada">Salvo.</span>}
      {acao.isError && <span className="text-erro">{mensagemErro(acao.error)}</span>}
    </span>
  )
}
