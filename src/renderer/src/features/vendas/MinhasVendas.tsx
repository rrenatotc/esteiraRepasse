// RF03: minhas vendas, com as pendências no topo e o motivo visível (RF04).
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ORDEM_STATUS, tempoParado } from '@shared/fila'
import { formatarBRL } from '@shared/moeda'
import { CODIGO_DEMANDA, type StatusDemanda } from '@shared/tipos'
import { Pagina } from '@renderer/components/Pagina'
import { Placa } from '@renderer/components/Placa'
import { COR_TRILHO, ROTULO_STATUS, Status } from '@renderer/components/Status'
import { botao } from '@renderer/components/ui/button'
import { snapshot } from '@renderer/features/fila/api'
import { useAgora } from '@renderer/features/fila/tempo'
import { mensagemErro } from '@renderer/lib/erros'
import { cn } from '@renderer/lib/utils'
import { minhasVendas } from './api'
import { Selecao } from './componentes'

type FiltroStatus = 'todas' | 'abertas' | StatusDemanda

export function MinhasVendas(): React.JSX.Element {
  const agora = useAgora()
  const [status, setStatus] = useState<FiltroStatus>('todas')
  const [dias, setDias] = useState<number | null>(30)
  const vendas = useQuery({
    queryKey: ['vendas', 'minhas', status, dias],
    queryFn: () => minhasVendas(status, dias),
    placeholderData: keepPreviousData
  })
  // Pendências sempre aparecem, independente do filtro.
  const pendentes = useQuery({ queryKey: ['vendas', 'pendentes'], queryFn: () => minhasVendas('pendente', null) })

  return (
    <Pagina
      titulo="Minhas vendas"
      acoes={
        <Link to="/app/vendas/nova" className={botao()}>
          Registrar venda
        </Link>
      }
    >
      {pendentes.data && pendentes.data.length > 0 && (
        <section aria-label="Pendências" className="mb-6 flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-alerta-parado">
            <AlertTriangle className="size-4" aria-hidden />
            {pendentes.data.length === 1 ? '1 venda voltou para você corrigir' : `${pendentes.data.length} vendas voltaram para você corrigir`}
          </h2>
          {pendentes.data.map((d) => (
            <div key={d.id} className="animate-surgir flex items-center gap-4 border border-l-[3px] border-linha border-l-status-pendente bg-superficie px-4 py-3">
              <Placa placa={d.placa} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  <span className="numeros">{CODIGO_DEMANDA(d.codigo)}</span> · {snapshot(d).marca} {snapshot(d).modelo}
                </p>
                <p className="text-alerta-parado">Motivo: {d.motivo_ultimo}</p>
              </div>
              <Link to={`/app/vendas/${d.id}/corrigir`} className={botao()}>
                Corrigir e reenviar
              </Link>
            </div>
          ))}
        </section>
      )}

      <div className="mb-3 flex gap-2">
        <Selecao aria-label="Status" className="w-48" value={status} onChange={(e) => setStatus(e.target.value as FiltroStatus)}>
          <option value="todas">Todos os status</option>
          <option value="abertas">Em andamento</option>
          {ORDEM_STATUS.map((s) => (
            <option key={s} value={s}>
              {ROTULO_STATUS[s]}
            </option>
          ))}
        </Selecao>
        <Selecao aria-label="Período" className="w-44" value={dias ?? ''} onChange={(e) => setDias(e.target.value ? Number(e.target.value) : null)}>
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
          <option value="">Qualquer data</option>
        </Selecao>
      </div>

      {vendas.isError && <p className="text-erro">{mensagemErro(vendas.error)}</p>}
      <div className="border border-linha bg-superficie">
        {vendas.data?.map((d) => (
          <div
            key={d.id}
            className="relative grid h-12 grid-cols-[96px_92px_minmax(0,1.2fr)_minmax(0,1fr)_104px_40px_140px_80px] items-center gap-3 border-b border-linha pr-4 pl-5 text-[13px] last:border-0"
          >
            <span aria-hidden className={cn('absolute inset-y-0 left-0 w-[3px]', COR_TRILHO[d.status])} />
            <span className="numeros font-medium">{CODIGO_DEMANDA(d.codigo)}</span>
            <Placa placa={d.placa} />
            <span className="truncate">
              {snapshot(d).marca} {snapshot(d).modelo}
            </span>
            <span className="truncate text-grafite">{d.lojista?.razao_social}</span>
            <span className="numeros text-right">{formatarBRL(d.valor_venda)}</span>
            <span className="numeros text-grafite" title={d.loja ? `${d.loja.codigo} ${d.loja.nome}` : undefined}>
              {d.loja?.codigo}
            </span>
            <span className="flex items-center gap-2">
              <Status status={d.status} />
              {d.status === 'nova' && d.responsavel_id === null && (
                <Link to={`/app/vendas/${d.id}/corrigir`} className="text-azul-placa hover:underline">
                  Editar
                </Link>
              )}
            </span>
            <span className="numeros text-right text-grafite" title={`Registrada em ${format(parseISO(d.created_at), 'dd/MM/yyyy HH:mm')}`}>
              {tempoParado(d.status_desde, agora)}
            </span>
          </div>
        ))}
        {vendas.data?.length === 0 && (
          <p className="px-4 py-8 text-center text-grafite">
            Nenhuma venda nesse filtro.{' '}
            <Link to="/app/vendas/nova" className="text-azul-placa hover:underline">
              Registrar venda
            </Link>
          </p>
        )}
      </div>
    </Pagina>
  )
}
