// Painel de detalhe da demanda: dados com botão de copiar (RF12), ações do
// status atual (RF07–RF11) e histórico (RN07).
import { useQuery, type UseMutationResult } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { formatarDocumento } from '@shared/documento'
import { formatarBRL } from '@shared/moeda'
import { CODIGO_DEMANDA, type StatusDemanda } from '@shared/tipos'
import { Placa } from '@renderer/components/Placa'
import { ROTULO_STATUS, Status } from '@renderer/components/Status'
import { Button } from '@renderer/components/ui/button'
import { Campo, Input } from '@renderer/components/ui/campo'
import { AreaTexto, Mensagem } from '@renderer/features/vendas/componentes'
import { useOnline } from '@renderer/hooks/useOnline'
import { mensagemErro } from '@renderer/lib/erros'
import { cn } from '@renderer/lib/utils'
import { listarEventos, snapshot, type DemandaFila } from './api'
import { estaParado, tempoParado, useAgora } from './tempo'

export type Acao = 'proposta' | 'faturar' | 'devolver' | 'cancelar'

export interface PedidoAvanco {
  id: string
  para: StatusDemanda
  dados?: Record<string, string>
  comentario?: string
}

export type MutacaoAvanco = UseMutationResult<unknown, Error, PedidoAvanco>

const dataBr = (iso: string | null): string => (iso ? format(parseISO(iso), 'dd/MM/yyyy') : '—')
const hoje = (): string => format(new Date(), 'yyyy-MM-dd')

function Copiar({ valor, rotulo }: { valor: string; rotulo: string }): React.JSX.Element {
  const [copiado, setCopiado] = useState(false)
  useEffect(() => {
    if (!copiado) return
    const t = setTimeout(() => setCopiado(false), 1500)
    return () => clearTimeout(t)
  }, [copiado])
  return (
    <button
      type="button"
      aria-label={copiado ? `${rotulo} copiado` : `Copiar ${rotulo}`}
      title={copiado ? 'Copiado' : `Copiar ${rotulo}`}
      onClick={() => void navigator.clipboard.writeText(valor).then(() => setCopiado(true))}
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-sm text-grafite hover:bg-papel hover:text-tinta',
        copiado && 'text-status-faturada hover:text-status-faturada'
      )}
    >
      {copiado ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </button>
  )
}

function Dado({ rotulo, children, copiar }: { rotulo: string; children: ReactNode; copiar?: string }): React.JSX.Element {
  return (
    <div className="grid grid-cols-[110px_1fr_28px] items-center gap-2 py-1.5">
      <dt className="text-[13px] text-grafite">{rotulo}</dt>
      <dd className="min-w-0 truncate">{children}</dd>
      {copiar ? <Copiar valor={copiar} rotulo={rotulo.toLowerCase()} /> : <span />}
    </div>
  )
}

function FormularioAcao({
  acao,
  demanda,
  avancar,
  onFechar
}: {
  acao: Acao
  demanda: DemandaFila
  avancar: MutacaoAvanco
  onFechar: () => void
}): React.JSX.Element {
  const online = useOnline()
  const [numero, setNumero] = useState('')
  const [data, setData] = useState(hoje())
  const [motivo, setMotivo] = useState('')
  const primeiro = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  useEffect(() => primeiro.current?.focus(), [acao])

  const config = {
    proposta: { titulo: 'Registrar proposta', para: 'proposta_emitida', campo: 'proposta', botao: 'Registrar proposta' },
    faturar: { titulo: 'Faturar', para: 'faturada', campo: 'NF', botao: 'Faturar' },
    devolver: { titulo: 'Devolver ao vendedor', para: 'pendente', campo: null, botao: 'Devolver ao vendedor' },
    cancelar: { titulo: 'Cancelar venda', para: 'cancelada', campo: null, botao: 'Cancelar venda' }
  }[acao] as { titulo: string; para: StatusDemanda; campo: string | null; botao: string }

  const comNumero = acao === 'proposta' || acao === 'faturar'
  const valido = comNumero ? numero.trim() !== '' && data !== '' : motivo.trim() !== ''

  function enviar(e: FormEvent): void {
    e.preventDefault()
    if (!valido) return
    const dados: Record<string, string> =
      acao === 'proposta'
        ? { numero_proposta: numero.trim(), data_emissao_proposta: data }
        : acao === 'faturar'
          ? { numero_nf: numero.trim(), data_emissao_nf: data }
          : {}
    avancar.mutate({ id: demanda.id, para: config.para, dados, comentario: comNumero ? undefined : motivo.trim() }, { onSuccess: onFechar })
  }

  return (
    <form
      onSubmit={enviar}
      onKeyDown={(e) => e.key === 'Escape' && onFechar()}
      className="animate-surgir flex flex-col gap-3 border border-linha bg-papel p-3"
    >
      <p className="font-medium">{config.titulo}</p>
      {comNumero ? (
        <div className="grid grid-cols-[1fr_150px] gap-3">
          <Campo rotulo={`Número da ${config.campo}`}>
            {(p) => <Input {...p} ref={primeiro} className="numeros" value={numero} onChange={(e) => setNumero(e.target.value)} />}
          </Campo>
          <Campo rotulo="Data de emissão">
            {(p) => <Input {...p} type="date" max={hoje()} className="numeros" value={data} onChange={(e) => setData(e.target.value)} />}
          </Campo>
        </div>
      ) : (
        <Campo rotulo={acao === 'devolver' ? 'O que o vendedor precisa corrigir?' : 'Motivo do cancelamento'}>
          {(p) => <AreaTexto {...p} ref={primeiro} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={1000} />}
        </Campo>
      )}
      {avancar.isError && <Mensagem tom="erro">{mensagemErro(avancar.error)}</Mensagem>}
      <div className="flex justify-end gap-2">
        <Button variante="fantasma" tamanho="sm" onClick={onFechar}>
          Voltar
        </Button>
        <Button
          type="submit"
          tamanho="sm"
          variante={acao === 'cancelar' ? 'perigo' : 'primario'}
          disabled={!valido || avancar.isPending || !online}
        >
          {avancar.isPending ? 'Salvando…' : config.botao}
        </Button>
      </div>
    </form>
  )
}

export function Detalhe({
  demanda,
  somenteLeitura,
  acao,
  setAcao,
  avancar
}: {
  demanda: DemandaFila
  somenteLeitura: boolean
  acao: Acao | null
  setAcao: (a: Acao | null) => void
  avancar: MutacaoAvanco
}): React.JSX.Element {
  const agora = useAgora()
  const online = useOnline()
  const eventos = useQuery({ queryKey: ['fila', 'eventos', demanda.id, demanda.status], queryFn: () => listarEventos(demanda.id) })
  const v = snapshot(demanda)
  const veiculo = [v.marca, v.modelo].filter(Boolean).join(' ')
  const anos = v.ano_fabricacao || v.ano_modelo ? `${v.ano_fabricacao ?? '—'}/${v.ano_modelo ?? '—'}` : null
  const valor = formatarBRL(demanda.valor_venda)
  const loja = demanda.loja ? `${demanda.loja.codigo} ${demanda.loja.nome}` : '—'
  const parado = estaParado(demanda.status_desde, agora)
  const s = demanda.status
  const imediato = (para: StatusDemanda): void => avancar.mutate({ id: demanda.id, para })

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-linha px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="numeros font-semibold">{CODIGO_DEMANDA(demanda.codigo)}</span>
          <Status key={s} status={s} className="animate-surgir" />
        </div>
        <p className={cn('mt-1 text-[13px]', parado ? 'font-medium text-alerta-parado' : 'text-grafite')}>
          {ROTULO_STATUS[s]} {tempoParado(demanda.status_desde, agora)}
          {parado && ' · acima de 24 h úteis'}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
        <div className="mb-3 flex items-center gap-3">
          <Placa placa={demanda.placa} className="w-[104px] [&>span:last-child]:text-[18px] [&>span:last-child]:leading-6" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{veiculo}</p>
            <p className="truncate text-[13px] text-grafite">{[anos, v.cor, v.km != null ? `${v.km.toLocaleString('pt-BR')} km` : null].filter(Boolean).join(' · ')}</p>
          </div>
          <Copiar valor={demanda.placa} rotulo="placa" />
        </div>
        {v.origem === 'manual' && (
          <div className="mb-3">
            <Mensagem tom="alerta">Veículo cadastrado à mão pelo vendedor. Confira os dados no Bravos.</Mensagem>
          </div>
        )}

        <dl className="border-y border-linha py-1">
          <Dado rotulo="Razão social" copiar={demanda.lojista?.razao_social}>
            {demanda.lojista?.razao_social ?? '—'}
          </Dado>
          <Dado rotulo={demanda.lojista?.tipo === 'cpf' ? 'CPF' : 'CNPJ'} copiar={demanda.lojista?.documento}>
            <span className="numeros">{demanda.lojista ? formatarDocumento(demanda.lojista.documento) : '—'}</span>
          </Dado>
          <Dado rotulo="Valor" copiar={valor.replace(/^R\$\s/, '')}>
            <span className="numeros font-semibold">{valor}</span>
          </Dado>
          <Dado rotulo="Loja" copiar={demanda.loja?.codigo}>
            {loja}
          </Dado>
          <Dado rotulo="Vendedor">{demanda.vendedor?.nome ?? '—'}</Dado>
          <Dado rotulo="Responsável">{demanda.responsavel?.nome ?? '—'}</Dado>
          {demanda.numero_proposta && (
            <Dado rotulo="Proposta" copiar={demanda.numero_proposta}>
              <span className="numeros">
                {demanda.numero_proposta} · {dataBr(demanda.data_emissao_proposta)}
              </span>
            </Dado>
          )}
          {demanda.numero_nf && (
            <Dado rotulo="NF" copiar={demanda.numero_nf}>
              <span className="numeros">
                {demanda.numero_nf} · {dataBr(demanda.data_emissao_nf)}
              </span>
            </Dado>
          )}
        </dl>

        {demanda.observacao && (
          <div className="mt-3">
            <p className="text-[13px] text-grafite">Observação do vendedor</p>
            <p className="whitespace-pre-wrap">{demanda.observacao}</p>
          </div>
        )}
        {s === 'pendente' && demanda.motivo_ultimo && (
          <div className="mt-3">
            <Mensagem tom="alerta">Aguardando o vendedor corrigir: {demanda.motivo_ultimo}</Mensagem>
          </div>
        )}
        {s === 'cancelada' && demanda.motivo_ultimo && (
          <p className="mt-3 text-[13px] text-grafite">Motivo do cancelamento: {demanda.motivo_ultimo}</p>
        )}

        {!somenteLeitura && !['concluida', 'cancelada'].includes(s) && (
          <section aria-label="Ações" className="mt-4 flex flex-col gap-3">
            {acao ? (
              <FormularioAcao key={acao} acao={acao} demanda={demanda} avancar={avancar} onFechar={() => setAcao(null)} />
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {s === 'nova' && (
                    <Button onClick={() => imediato('em_proposta')} disabled={avancar.isPending || !online}>
                      Assumir
                    </Button>
                  )}
                  {s === 'em_proposta' && <Button onClick={() => setAcao('proposta')}>Registrar proposta</Button>}
                  {s === 'proposta_emitida' && <Button onClick={() => setAcao('faturar')}>Faturar</Button>}
                  {s === 'faturada' && (
                    <Button onClick={() => imediato('concluida')} disabled={avancar.isPending || !online}>
                      Concluir
                    </Button>
                  )}
                  {['nova', 'em_proposta', 'proposta_emitida'].includes(s) && (
                    <Button variante="secundario" onClick={() => setAcao('devolver')}>
                      Devolver ao vendedor
                    </Button>
                  )}
                  {s !== 'faturada' && (
                    <Button variante="perigo" onClick={() => setAcao('cancelar')}>
                      Cancelar
                    </Button>
                  )}
                </div>
                {avancar.isError && <Mensagem tom="erro">{mensagemErro(avancar.error)}</Mensagem>}
              </>
            )}
          </section>
        )}

        <section aria-label="Histórico" className="mt-6">
          <h3 className="mb-2 text-[13px] font-medium text-grafite">Histórico</h3>
          <ol className="flex flex-col gap-2.5">
            {eventos.data?.map((e) => (
              <li key={e.id} className="text-[13px]">
                <div className="flex justify-between gap-3">
                  <span>
                    {e.de_status ? `${ROTULO_STATUS[e.de_status]} → ` : ''}
                    <span className="font-medium">{ROTULO_STATUS[e.para_status]}</span>
                  </span>
                  <span className="numeros shrink-0 text-grafite">
                    {format(parseISO(e.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <span className="text-grafite">{e.autor?.nome ?? '—'}</span>
                {e.comentario && <p className="mt-0.5 whitespace-pre-wrap text-tinta">“{e.comentario}”</p>}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}
