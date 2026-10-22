// RF06: fila do repasse em tela dividida. Lista densa à esquerda, detalhe à
// direita. Atalhos (RF15): / busca, j/k navega, a assume, p proposta,
// f faturar, d devolver, ? ajuda.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { filtrarDemandas, ORDEM_STATUS } from '@shared/fila'
import { formatarBRL } from '@shared/moeda'
import { CODIGO_DEMANDA, type StatusDemanda } from '@shared/tipos'
import { useAuth } from '@renderer/app/auth'
import { BotoesExportar } from '@renderer/components/Exportar'
import { Placa } from '@renderer/components/Placa'
import { COR_TRILHO, ROTULO_STATUS } from '@renderer/components/Status'
import { Input } from '@renderer/components/ui/campo'
import { Selecao } from '@renderer/features/vendas/componentes'
import { listarLojas } from '@renderer/features/vendas/api'
import { mensagemErro } from '@renderer/lib/erros'
import { cn } from '@renderer/lib/utils'
import { avancarStatus, FILTROS_PADRAO, listarFila, listarVendedores, snapshot, type DemandaFila, type Filtros } from './api'
import { COLUNAS_DEMANDAS } from './colunas'
import { Detalhe, type Acao, type PedidoAvanco } from './Detalhe'
import { estaParado, tempoParado, useAgora } from './tempo'

const ATALHOS: [string, string][] = [
  ['/', 'Buscar'],
  ['j / k', 'Próxima / anterior'],
  ['a', 'Assumir'],
  ['p', 'Registrar proposta'],
  ['f', 'Faturar'],
  ['d', 'Devolver ao vendedor'],
  ['Esc', 'Fechar formulário'],
  ['?', 'Mostrar atalhos']
]

function Linha({ d, selecionada, agora, onClick }: { d: DemandaFila; selecionada: boolean; agora: Date; onClick: () => void }): React.JSX.Element {
  const v = snapshot(d)
  const parado = estaParado(d.status_desde, agora)
  return (
    <button
      data-id={d.id}
      onClick={onClick}
      aria-current={selecionada}
      className={cn(
        'relative grid h-12 w-full grid-cols-[88px_92px_minmax(0,1fr)_36px_104px_80px] items-center gap-3 border-b border-linha pr-4 pl-5 text-left text-[13px] hover:bg-papel xl:grid-cols-[88px_92px_minmax(0,1.3fr)_minmax(0,1fr)_36px_minmax(0,0.6fr)_104px_80px]',
        selecionada && 'bg-superficie-selecionada hover:bg-superficie-selecionada'
      )}
    >
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-[3px]', COR_TRILHO[d.status])} />
      <span className="numeros font-medium">{CODIGO_DEMANDA(d.codigo)}</span>
      <Placa placa={d.placa} />
      <span className="truncate">
        {v.marca} {v.modelo}
      </span>
      <span className="hidden truncate text-grafite xl:block">{d.lojista?.razao_social}</span>
      <span className="numeros text-grafite" title={d.loja ? `${d.loja.codigo} ${d.loja.nome}` : undefined}>
        {d.loja?.codigo}
      </span>
      <span className="hidden truncate text-grafite xl:block">{d.vendedor?.nome.split(' ')[0]}</span>
      <span className="numeros text-right">{formatarBRL(d.valor_venda)}</span>
      <span className={cn('numeros flex items-center justify-end gap-1', parado ? 'font-medium text-alerta-parado' : 'text-grafite')}>
        {parado && <Clock className="size-3" aria-label="Parada acima de 24 h úteis" />}
        {tempoParado(d.status_desde, agora)}
      </span>
    </button>
  )
}

export function Fila(): React.JSX.Element {
  const { perfil } = useAuth()
  const somenteLeitura = perfil?.papel !== 'repasse'
  const { id: selecionadaId } = useParams()
  const navegar = useNavigate()
  const queryClient = useQueryClient()
  const agora = useAgora()
  const busca = useRef<HTMLInputElement>(null)
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_PADRAO)
  const [termo, setTermo] = useState('')
  const [acao, setAcao] = useState<Acao | null>(null)
  const [ajuda, setAjuda] = useState(false)

  const fila = useQuery({ queryKey: ['fila', 'lista', filtros], queryFn: () => listarFila(filtros), placeholderData: keepPreviousData })
  const lojas = useQuery({ queryKey: ['lojas', 'ativas'], queryFn: listarLojas, staleTime: Infinity })
  const vendedores = useQuery({ queryKey: ['fila', 'vendedores'], queryFn: listarVendedores, staleTime: 5 * 60_000 })

  const avancar = useMutation({
    mutationFn: (p: PedidoAvanco) => avancarStatus(p.id, p.para, p.dados, p.comentario),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['fila'] })
  })

  const visiveis = useMemo(() => filtrarDemandas(fila.data ?? [], termo), [fila.data, termo])
  const grupos = useMemo(
    () =>
      ORDEM_STATUS.map((status) => ({ status, itens: visiveis.filter((d) => d.status === status) })).filter((g) => g.itens.length > 0),
    [visiveis]
  )
  const ordenadas = useMemo(() => grupos.flatMap((g) => g.itens), [grupos])
  const selecionada = ordenadas.find((d) => d.id === selecionadaId) ?? fila.data?.find((d) => d.id === selecionadaId) ?? null

  const selecionar = (id: string): void => {
    setAcao(null)
    avancar.reset()
    navegar(`/app/fila/${id}`, { replace: true })
  }

  // Mantém a linha selecionada visível ao navegar pelo teclado.
  useEffect(() => {
    if (selecionadaId) document.querySelector(`[data-id="${selecionadaId}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [selecionadaId])

  useEffect(() => {
    function tecla(e: KeyboardEvent): void {
      const alvo = e.target as HTMLElement
      const digitando = ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)
      if (e.key === 'Escape') {
        setAjuda(false)
        if (digitando) alvo.blur()
        return
      }
      if (digitando || e.ctrlKey || e.metaKey || e.altKey) return
      const i = ordenadas.findIndex((d) => d.id === selecionadaId)
      const s: StatusDemanda | undefined = selecionada?.status
      const tratar: Record<string, () => void> = {
        '/': () => busca.current?.focus(),
        '?': () => setAjuda((a) => !a),
        j: () => ordenadas[Math.min(i + 1, ordenadas.length - 1)] && selecionar(ordenadas[Math.min(i + 1, ordenadas.length - 1)].id),
        k: () => ordenadas[Math.max(i - 1, 0)] && selecionar(ordenadas[Math.max(i - 1, 0)].id),
        a: () => !somenteLeitura && selecionada && s === 'nova' && avancar.mutate({ id: selecionada.id, para: 'em_proposta' }),
        p: () => !somenteLeitura && s === 'em_proposta' && setAcao('proposta'),
        f: () => !somenteLeitura && s === 'proposta_emitida' && setAcao('faturar'),
        d: () => !somenteLeitura && s && ['nova', 'em_proposta', 'proposta_emitida'].includes(s) && setAcao('devolver')
      }
      const fn = tratar[e.key]
      if (fn) {
        e.preventDefault()
        fn()
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]): void => setFiltros({ ...filtros, [k]: v })

  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex min-h-0 flex-col border-r border-linha">
        <div className="flex flex-col gap-2 border-b border-linha bg-superficie px-5 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-[17px] font-semibold">{somenteLeitura ? 'Demandas' : 'Fila'}</h1>
            <Input
              ref={busca}
              type="search"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Buscar placa, documento ou código  ( / )"
              aria-label="Buscar demandas"
              className="h-8 max-w-sm flex-1"
            />
            <span className="numeros text-[13px] text-grafite">
              {visiveis.length} {visiveis.length === 1 ? 'demanda' : 'demandas'}
            </span>
            <span className="ml-auto">
              <BotoesExportar base="demandas" colunas={COLUNAS_DEMANDAS} linhas={ordenadas} />
            </span>
            <button onClick={() => setAjuda((a) => !a)} className="text-[13px] text-grafite hover:text-tinta" aria-expanded={ajuda}>
              Atalhos ( ? )
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Selecao aria-label="Status" className="h-8" value={filtros.status} onChange={(e) => set('status', e.target.value as Filtros['status'])}>
              <option value="abertas">Abertas</option>
              <option value="todas">Todas</option>
              {ORDEM_STATUS.map((s) => (
                <option key={s} value={s}>
                  {ROTULO_STATUS[s]}
                </option>
              ))}
            </Selecao>
            <Selecao aria-label="Loja da proposta" className="h-8" value={filtros.lojaId ?? ''} onChange={(e) => set('lojaId', e.target.value ? Number(e.target.value) : null)}>
              <option value="">Todas as lojas</option>
              {lojas.data?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.codigo} {l.nome}
                </option>
              ))}
            </Selecao>
            <Selecao aria-label="Vendedor" className="h-8" value={filtros.vendedorId ?? ''} onChange={(e) => set('vendedorId', e.target.value || null)}>
              <option value="">Todos os vendedores</option>
              {vendedores.data?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome}
                </option>
              ))}
            </Selecao>
            <Selecao aria-label="Período" className="h-8" value={filtros.periodo} onChange={(e) => set('periodo', e.target.value as Filtros['periodo'])}>
              <option value="tudo">Qualquer data</option>
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
            </Selecao>
          </div>
        </div>

        {ajuda && (
          <div className="animate-surgir grid grid-cols-4 gap-x-6 gap-y-1 border-b border-linha bg-papel px-5 py-3 text-[13px]">
            {ATALHOS.map(([k, t]) => (
              <span key={k}>
                <kbd className="numeros mr-2 rounded-sm border border-linha bg-superficie px-1.5 py-0.5 text-[12px]">{k}</kbd>
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto bg-superficie" role="list" aria-label="Demandas">
          {fila.isError && <p className="p-5 text-erro">{mensagemErro(fila.error)}</p>}
          {grupos.map((g) => (
            <Fragment key={g.status}>
              <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-linha bg-papel px-5 py-1.5 text-[12px] font-medium text-grafite">
                <span aria-hidden className={cn('size-2 rounded-full', COR_TRILHO[g.status])} />
                {ROTULO_STATUS[g.status]} · <span className="numeros">{g.itens.length}</span>
              </div>
              {g.itens.map((d) => (
                <Linha key={d.id} d={d} agora={agora} selecionada={d.id === selecionadaId} onClick={() => selecionar(d.id)} />
              ))}
            </Fragment>
          ))}
          {fila.data && visiveis.length === 0 && (
            <p className="p-8 text-center text-grafite">
              {termo ? 'Nenhuma demanda encontrada para essa busca.' : 'Nenhuma demanda com esses filtros. Novas vendas aparecem aqui na hora.'}
            </p>
          )}
        </div>
      </div>

      <aside className="min-h-0 bg-superficie" aria-label="Detalhe da demanda">
        {selecionada ? (
          <Detalhe key={selecionada.id} demanda={selecionada} somenteLeitura={somenteLeitura} acao={acao} setAcao={setAcao} avancar={avancar} />
        ) : (
          <div className="flex h-full items-center justify-center px-8 text-center text-grafite">
            Escolha uma demanda na lista ou use j / k para navegar.
          </div>
        )}
      </aside>
    </div>
  )
}
