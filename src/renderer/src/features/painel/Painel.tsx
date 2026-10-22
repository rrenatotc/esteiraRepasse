// RF17: painel do gestor. Números do período, faturado por loja da proposta,
// o que está em andamento agora e os últimos 12 meses. RF18: exportação.
// Gráficos de uma série só: uma cor (azul-placa), sem legenda, valores em
// texto ao lado ou no tooltip, e uma visão em tabela.
import { useQuery } from '@tanstack/react-query'
import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subDays, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertTriangle } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { centavosDeDecimal, formatarCentavos } from '@shared/moeda'
import type { StatusDemanda } from '@shared/tipos'
import { BotoesExportar } from '@renderer/components/Exportar'
import { Pagina } from '@renderer/components/Pagina'
import { COR_TRILHO, ROTULO_STATUS } from '@renderer/components/Status'
import { COLUNAS_DEMANDAS } from '@renderer/features/fila/colunas'
import { listarPeriodo } from '@renderer/features/fila/api'
import { mensagemErro } from '@renderer/lib/erros'
import { supabase } from '@renderer/lib/supabase'
import { cn } from '@renderer/lib/utils'

type Numero = number | string
interface Indicadores {
  registradas: number
  canceladas: number
  faturadas: number
  valor_faturado: Numero
  ticket_medio: Numero | null
  horas_ate_faturar: Numero | null
  horas_uteis_ate_faturar: Numero | null
  pendencias_abertas: number
  abertas_por_status: Record<'nova' | 'em_proposta' | 'proposta_emitida' | 'faturada' | 'pendente', number>
  por_loja: { codigo: string; nome: string; registradas: number; faturadas: number; valor_faturado: Numero }[]
  por_mes: { mes: string; faturadas: number; valor_faturado: Numero }[]
}

type ChavePeriodo = 'mes' | 'mes-passado' | '90' | 'ano'
const PERIODOS: { chave: ChavePeriodo; rotulo: string; datas: (hoje: Date) => [Date, Date] }[] = [
  { chave: 'mes', rotulo: 'Este mês', datas: (h) => [startOfMonth(h), h] },
  { chave: 'mes-passado', rotulo: 'Mês passado', datas: (h) => [startOfMonth(subMonths(h, 1)), endOfMonth(subMonths(h, 1))] },
  { chave: '90', rotulo: 'Últimos 90 dias', datas: (h) => [subDays(h, 89), h] },
  { chave: 'ano', rotulo: 'Este ano', datas: (h) => [startOfYear(h), endOfYear(h) > h ? h : endOfYear(h)] }
]

const centavos = (v: Numero | null): number => (v === null ? 0 : centavosDeDecimal(v))
const reais = (v: Numero | null): string => formatarCentavos(centavos(v))
const iso = (d: Date): string => format(d, 'yyyy-MM-dd')
const nomeMes = (mes: string, longo = false): string =>
  format(new Date(`${mes}-01T12:00:00`), longo ? 'MMMM yyyy' : 'MMM', { locale: ptBR }).replace('.', '')

async function buscarIndicadores(inicio: Date, fim: Date): Promise<Indicadores> {
  const { data, error } = await supabase.rpc('indicadores_painel', { p_inicio: iso(inicio), p_fim: iso(fim) })
  if (error) throw error
  return data as unknown as Indicadores
}

function Numeral({ rotulo, valor, detalhe, alerta }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode; alerta?: boolean }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[13px] text-grafite">{rotulo}</span>
      <span className={cn('numeros flex items-center gap-1.5 text-[24px] leading-8 font-semibold', alerta && 'text-alerta-parado')}>
        {alerta && <AlertTriangle className="size-4" aria-hidden />}
        {valor}
      </span>
      {detalhe && <span className="text-[13px] text-grafite">{detalhe}</span>}
    </div>
  )
}

function Secao({ titulo, acao, children }: { titulo: string; acao?: ReactNode; children: ReactNode }): React.JSX.Element {
  return (
    <section className="border border-linha bg-superficie p-5">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold">{titulo}</h2>
        {acao}
      </header>
      {children}
    </section>
  )
}

/** Tabela com barra embutida: cada linha é uma loja, a barra é o faturado. */
function PorLoja({ lojas }: { lojas: Indicadores['por_loja'] }): React.JSX.Element {
  const max = Math.max(1, ...lojas.map((l) => centavos(l.valor_faturado)))
  const ordenadas = [...lojas].sort((a, b) => centavos(b.valor_faturado) - centavos(a.valor_faturado) || a.codigo.localeCompare(b.codigo))
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-left text-[12px] text-grafite">
          <th className="pb-2 font-medium">Loja da proposta</th>
          <th className="pb-2 font-medium" aria-label="Faturado (barra)" />
          <th className="pb-2 text-right font-medium">Faturado</th>
          <th className="pb-2 text-right font-medium">NFs</th>
          <th className="pb-2 text-right font-medium">Registradas</th>
        </tr>
      </thead>
      <tbody className="numeros">
        {ordenadas.map((l) => {
          const largura = (centavos(l.valor_faturado) / max) * 100
          return (
            <tr key={l.codigo} className="h-8">
              <td className="pr-3 whitespace-nowrap">
                <span className="text-grafite">{l.codigo}</span> {l.nome}
              </td>
              <td className="w-[40%] pr-3">
                {largura > 0 && (
                  <div className="h-3 rounded-r-[4px] bg-azul-placa" style={{ width: `${Math.max(largura, 1)}%` }} title={`${l.codigo} ${l.nome}: ${reais(l.valor_faturado)}`} />
                )}
              </td>
              <td className="pr-3 text-right whitespace-nowrap">{centavos(l.valor_faturado) > 0 ? reais(l.valor_faturado) : <span className="text-grafite">—</span>}</td>
              <td className="pr-3 text-right">{l.faturadas || <span className="text-grafite">—</span>}</td>
              <td className="text-right text-grafite">{l.registradas || '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function EmAndamento({ abertas }: { abertas: Indicadores['abertas_por_status'] }): React.JSX.Element {
  const ordem: StatusDemanda[] = ['nova', 'em_proposta', 'proposta_emitida', 'faturada', 'pendente']
  const max = Math.max(1, ...ordem.map((s) => abertas[s as keyof typeof abertas]))
  return (
    <ul className="flex flex-col gap-2.5 text-[13px]">
      {ordem.map((s) => {
        const n = abertas[s as keyof typeof abertas]
        return (
          <li key={s} className="grid grid-cols-[120px_1fr_32px] items-center gap-3">
            <span>{ROTULO_STATUS[s]}</span>
            <span className="h-3">
              {n > 0 && <span className={cn('block h-3 rounded-r-[4px]', COR_TRILHO[s])} style={{ width: `${(n / max) * 100}%` }} />}
            </span>
            <span className="numeros text-right font-medium">{n}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** Barras verticais dos 12 meses, com tooltip por barra e rótulo só no mês atual e no maior. */
function PorMes({ meses }: { meses: Indicadores['por_mes'] }): React.JSX.Element {
  const [foco, setFoco] = useState<number | null>(null)
  const valores = meses.map((m) => centavos(m.valor_faturado))
  const max = Math.max(1, ...valores)
  const iMax = valores.indexOf(Math.max(...valores))
  const ALTURA = 160
  return (
    <div className="relative">
      <div className="flex h-[200px] items-end gap-2 border-b border-linha pt-6" onMouseLeave={() => setFoco(null)}>
        {meses.map((m, i) => {
          const h = (valores[i] / max) * ALTURA
          const rotulado = (i === meses.length - 1 || i === iMax) && valores[i] > 0
          return (
            <div
              key={m.mes}
              className="relative flex h-full flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setFoco(i)}
              tabIndex={0}
              onFocus={() => setFoco(i)}
              onBlur={() => setFoco(null)}
              aria-label={`${nomeMes(m.mes, true)}: ${reais(m.valor_faturado)}, ${m.faturadas} NFs`}
            >
              {rotulado && foco === null && (
                <span className="numeros absolute text-[11px] whitespace-nowrap text-grafite" style={{ bottom: h + 4 }}>
                  {formatarCentavos(valores[i]).replace(/,\d{2}$/, '')}
                </span>
              )}
              <div
                className={cn('w-full max-w-9 rounded-t-[4px] bg-azul-placa transition-opacity', foco !== null && foco !== i && 'opacity-40')}
                style={{ height: valores[i] > 0 ? Math.max(h, 2) : 0 }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-2 text-[11px] text-grafite">
        {meses.map((m) => (
          <span key={m.mes} className="flex-1 text-center">
            {nomeMes(m.mes)}
          </span>
        ))}
      </div>
      {foco !== null && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-0 z-10 rounded-sm border border-linha bg-superficie px-3 py-2 text-[13px]"
          style={{ left: `clamp(0px, calc(${((foco + 0.5) / meses.length) * 100}% - 80px), calc(100% - 160px))`, width: 160 }}
        >
          <p className="font-medium capitalize">{nomeMes(meses[foco].mes, true)}</p>
          <p className="numeros">{reais(meses[foco].valor_faturado)}</p>
          <p className="numeros text-grafite">{meses[foco].faturadas} NFs</p>
        </div>
      )}
    </div>
  )
}

function TabelaMeses({ meses }: { meses: Indicadores['por_mes'] }): React.JSX.Element {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-left text-[12px] text-grafite">
          <th className="pb-2 font-medium">Mês</th>
          <th className="pb-2 text-right font-medium">Faturado</th>
          <th className="pb-2 text-right font-medium">NFs</th>
        </tr>
      </thead>
      <tbody className="numeros">
        {meses.map((m) => (
          <tr key={m.mes} className="h-7 border-t border-linha">
            <td className="capitalize">{nomeMes(m.mes, true)}</td>
            <td className="text-right">{reais(m.valor_faturado)}</td>
            <td className="text-right">{m.faturadas}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function Painel(): React.JSX.Element {
  const [chave, setChave] = useState<ChavePeriodo>('mes')
  const [tabela, setTabela] = useState(false)
  const [inicio, fim] = PERIODOS.find((p) => p.chave === chave)!.datas(new Date())
  const indicadores = useQuery({ queryKey: ['painel', iso(inicio), iso(fim)], queryFn: () => buscarIndicadores(inicio, fim) })
  const demandas = useQuery({ queryKey: ['painel', 'demandas', iso(inicio), iso(fim)], queryFn: () => listarPeriodo(inicio, fim) })
  const r = indicadores.data

  return (
    <Pagina
      titulo="Painel"
      acoes={<BotoesExportar base={`vendas_${iso(inicio)}_a_${iso(fim)}`} colunas={COLUNAS_DEMANDAS} linhas={demandas.data ?? []} />}
    >
      <div className="mb-6 flex items-center gap-4">
        <div role="tablist" aria-label="Período" className="flex gap-1">
          {PERIODOS.map((p) => (
            <button
              key={p.chave}
              role="tab"
              aria-selected={chave === p.chave}
              onClick={() => setChave(p.chave)}
              className={cn(
                'h-8 rounded-sm px-3 text-[13px] text-grafite hover:bg-superficie hover:text-tinta',
                chave === p.chave && 'bg-superficie font-medium text-tinta ring-1 ring-linha'
              )}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
        <span className="numeros text-[13px] text-grafite">
          {format(inicio, 'dd/MM/yyyy')} a {format(fim, 'dd/MM/yyyy')}
        </span>
      </div>

      {indicadores.isError && <p className="text-erro">{mensagemErro(indicadores.error)}</p>}
      {r && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-3 gap-x-8 gap-y-5 border border-linha bg-superficie p-5 xl:grid-cols-6">
            <Numeral rotulo="Faturado" valor={reais(r.valor_faturado)} detalhe="pela data da NF" />
            <Numeral rotulo="NFs emitidas" valor={r.faturadas} />
            <Numeral rotulo="Ticket médio" valor={r.ticket_medio === null ? '—' : reais(r.ticket_medio)} />
            <Numeral
              rotulo="Tempo até faturar"
              valor={r.horas_uteis_ate_faturar === null ? '—' : `${Number(r.horas_uteis_ate_faturar).toLocaleString('pt-BR')} h`}
              detalhe={r.horas_ate_faturar === null ? 'úteis, da venda à NF' : `úteis (${Number(r.horas_ate_faturar).toLocaleString('pt-BR')} h corridas)`}
            />
            <Numeral rotulo="Vendas registradas" valor={r.registradas} detalhe={r.canceladas ? `${r.canceladas} canceladas` : undefined} />
            <Numeral rotulo="Pendências abertas" valor={r.pendencias_abertas} alerta={r.pendencias_abertas > 0} detalhe="com o vendedor agora" />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Secao titulo="Faturado por loja da proposta">
              <PorLoja lojas={r.por_loja} />
            </Secao>
            <Secao titulo="Em andamento agora">
              <EmAndamento abertas={r.abertas_por_status} />
            </Secao>
          </div>

          <Secao
            titulo="Faturado nos últimos 12 meses"
            acao={
              <button onClick={() => setTabela((t) => !t)} className="text-[13px] text-azul-placa hover:underline">
                {tabela ? 'Ver gráfico' : 'Ver como tabela'}
              </button>
            }
          >
            {tabela ? <TabelaMeses meses={r.por_mes} /> : <PorMes meses={r.por_mes} />}
          </Secao>
        </div>
      )}
    </Pagina>
  )
}
