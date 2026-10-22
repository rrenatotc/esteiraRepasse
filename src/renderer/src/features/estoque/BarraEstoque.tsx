// Barra superior do repasse: atualizar estoque, última atualização e se a
// pasta do Bravos está sendo observada.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { differenceInHours, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertTriangle, FolderSearch, RefreshCw } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@renderer/components/ui/button'
import { mensagemErro } from '@renderer/lib/erros'
import { cn } from '@renderer/lib/utils'
import { ultimaImportacao } from './api'
import { CHAVES } from './useEstoqueRepasse'

export function textoAtualizacao(em: string, autor: string | null | undefined): string {
  const data = format(parseISO(em), "dd/MM 'às' HH:mm", { locale: ptBR })
  return `Estoque atualizado em ${data}${autor ? ` por ${autor.split(' ')[0]}` : ''}`
}

export function BarraEstoque(): React.JSX.Element {
  const navegar = useNavigate()
  const queryClient = useQueryClient()
  const ultima = useQuery({ queryKey: CHAVES.ultima, queryFn: ultimaImportacao, refetchInterval: 5 * 60_000 })
  const status = useQuery({ queryKey: CHAVES.status, queryFn: () => window.esteira.estoque.status() })
  const ler = useMutation({
    mutationFn: () => window.esteira.estoque.lerMaisRecente(),
    onSuccess: (leitura) => {
      queryClient.setQueryData(CHAVES.leitura, leitura)
      navegar('/app/estoque')
    }
  })

  const atrasado = ultima.data ? differenceInHours(new Date(), parseISO(ultima.data.created_at)) > 24 : false
  const semPasta = status.data && !status.data.pasta

  return (
    <div className="flex h-11 shrink-0 items-center gap-4 border-b border-linha bg-superficie px-4 text-[13px]">
      <Button tamanho="sm" onClick={() => ler.mutate()} disabled={ler.isPending || !!semPasta}>
        <RefreshCw className={cn('size-3.5', ler.isPending && 'animate-spin')} aria-hidden />
        {ler.isPending ? 'Lendo planilha…' : 'Atualizar estoque'}
      </Button>

      {ler.isError ? (
        <span role="alert" className="text-erro">
          {mensagemErro(ler.error)}
        </span>
      ) : ler.data === null ? (
        <span role="alert" className="text-alerta-parado">
          Nenhuma exportação de estoque encontrada na pasta do Bravos.
        </span>
      ) : ultima.data ? (
        <span className={cn('flex items-center gap-1.5', atrasado ? 'font-medium text-alerta-parado' : 'text-grafite')}>
          {atrasado && <AlertTriangle className="size-3.5" aria-hidden />}
          {textoAtualizacao(ultima.data.created_at, ultima.data.autor?.nome)}
          {atrasado && ' — há mais de 24 h'}
        </span>
      ) : (
        <span className="text-grafite">Estoque ainda não foi atualizado.</span>
      )}

      <span className="ml-auto flex items-center gap-1.5 text-grafite">
        {semPasta ? (
          <Link to="/app/configuracoes" className="flex items-center gap-1.5 text-azul-placa hover:underline">
            <FolderSearch className="size-3.5" aria-hidden />
            Escolher a pasta do Bravos
          </Link>
        ) : status.data?.observando ? (
          <>
            <span aria-hidden className="size-2 rounded-full bg-status-faturada" />
            Observando a pasta do Bravos
          </>
        ) : (
          <>
            <span aria-hidden className="size-2 rounded-full bg-status-cancelada" />
            Pasta do Bravos não está sendo observada
          </>
        )}
      </span>
    </div>
  )
}
