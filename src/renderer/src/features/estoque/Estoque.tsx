// RF16 (veículos) + RF19 (pré-visualização) + RF20 (histórico).
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { useState } from 'react'
import { Pagina } from '@renderer/components/Pagina'
import { Placa } from '@renderer/components/Placa'
import { Input } from '@renderer/components/ui/campo'
import { mensagemErro } from '@renderer/lib/erros'
import { cn } from '@renderer/lib/utils'
import { historicoImportacoes, listarVeiculos, lojasPorCodigo, type FiltroVeiculos } from './api'
import { Previa } from './Previa'
import { CHAVES } from './useEstoqueRepasse'

const FILTROS: { valor: FiltroVeiculos; rotulo: string }[] = [
  { valor: 'em_estoque', rotulo: 'Em estoque' },
  { valor: 'fora', rotulo: 'Fora do estoque' },
  { valor: 'manuais', rotulo: 'Cadastrados à mão' },
  { valor: 'todos', rotulo: 'Todos' }
]

const data = (iso: string | null): string => (iso ? format(parseISO(iso), 'dd/MM/yyyy') : '—')
const dataHora = (iso: string | null): string => (iso ? format(parseISO(iso), 'dd/MM/yyyy HH:mm') : '—')

function Abas<T extends string>({
  valor,
  opcoes,
  onChange,
  rotulo
}: {
  valor: T
  opcoes: { valor: T; rotulo: string }[]
  onChange: (v: T) => void
  rotulo: string
}): React.JSX.Element {
  return (
    <div role="tablist" aria-label={rotulo} className="flex gap-1">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          role="tab"
          aria-selected={valor === o.valor}
          onClick={() => onChange(o.valor)}
          className={cn(
            'h-8 rounded-sm px-3 text-[13px] text-grafite hover:bg-superficie hover:text-tinta',
            valor === o.valor && 'bg-superficie font-medium text-tinta ring-1 ring-linha'
          )}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}

const TH = 'h-9 px-3 text-left text-[12px] font-medium text-grafite whitespace-nowrap'
const TD = 'h-11 px-3 whitespace-nowrap'

function Veiculos(): React.JSX.Element {
  const [filtro, setFiltro] = useState<FiltroVeiculos>('em_estoque')
  const [busca, setBusca] = useState('')
  const lojas = useQuery({ queryKey: ['lojas', 'por-codigo'], queryFn: lojasPorCodigo, staleTime: Infinity })
  const veiculos = useQuery({
    queryKey: [...CHAVES.veiculos, filtro, busca],
    queryFn: () => listarVeiculos(filtro, busca),
    placeholderData: keepPreviousData
  })

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-4">
        <Abas rotulo="Filtro de veículos" valor={filtro} opcoes={FILTROS} onChange={setFiltro} />
        <Input
          type="search"
          placeholder="Buscar placa, marca ou modelo"
          aria-label="Buscar veículos"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-72"
        />
      </div>
      {veiculos.isError && <p className="text-erro">{mensagemErro(veiculos.error)}</p>}
      <div className="overflow-auto border border-linha bg-superficie">
        <table className="w-full border-collapse">
          <thead className="border-b border-linha">
            <tr>
              <th className={TH}>Placa</th>
              <th className={TH}>Veículo</th>
              <th className={TH}>Ano</th>
              <th className={TH}>Cor</th>
              <th className={TH}>Filial</th>
              <th className={cn(TH, 'text-right')}>Dias</th>
              <th className={TH}>Situação</th>
              <th className={TH}>Cód. Bravos</th>
            </tr>
          </thead>
          <tbody>
            {veiculos.data?.map((v) => (
              <tr key={v.id} className="border-b border-linha last:border-0">
                <td className={TD}>
                  <Placa placa={v.placa} />
                </td>
                <td className={cn(TD, 'max-w-[320px] truncate')}>
                  <span className="text-grafite">{v.marca}</span> {v.modelo}
                </td>
                <td className={cn(TD, 'numeros')}>
                  {v.ano_fabricacao ?? '—'}/{v.ano_modelo ?? '—'}
                </td>
                <td className={cn(TD, 'max-w-[160px] truncate')}>{v.cor ?? '—'}</td>
                <td className={TD}>
                  {v.filial_estoque ? `${v.filial_estoque} ${lojas.data?.get(v.filial_estoque) ?? ''}` : '—'}
                </td>
                <td className={cn(TD, 'numeros text-right')}>{v.dias_em_estoque ?? '—'}</td>
                <td className={TD}>
                  {v.origem === 'manual' ? (
                    <span className="text-alerta-parado">Cadastro manual</span>
                  ) : v.em_estoque ? (
                    'Em estoque'
                  ) : (
                    <span className="text-grafite">Saiu em {data(v.saiu_do_estoque_em)}</span>
                  )}
                </td>
                <td className={cn(TD, 'numeros text-grafite')}>{v.codigo_bravos ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {veiculos.data?.length === 0 && <p className="px-3 py-6 text-center text-grafite">Nenhum veículo encontrado.</p>}
      </div>
      {veiculos.data && <p className="mt-2 text-[13px] text-grafite numeros">{veiculos.data.length} veículos</p>}
    </>
  )
}

function Historico(): React.JSX.Element {
  const historico = useQuery({ queryKey: CHAVES.historico, queryFn: historicoImportacoes })
  return (
    <div className="overflow-auto border border-linha bg-superficie">
      <table className="w-full border-collapse">
        <thead className="border-b border-linha">
          <tr>
            <th className={TH}>Aplicada em</th>
            <th className={TH}>Arquivo</th>
            <th className={TH}>Gerado em</th>
            <th className={TH}>Por</th>
            <th className={cn(TH, 'text-right')}>Novos</th>
            <th className={cn(TH, 'text-right')}>Atualizados</th>
            <th className={cn(TH, 'text-right')}>Saíram</th>
            <th className={cn(TH, 'text-right')}>Mantidos</th>
            <th className={cn(TH, 'text-right')}>Erros</th>
          </tr>
        </thead>
        <tbody className="numeros">
          {historico.data?.map((h) => (
            <tr key={h.id} className="border-b border-linha last:border-0">
              <td className={TD}>{dataHora(h.created_at)}</td>
              <td className={cn(TD, 'max-w-[280px] truncate')}>
                {h.arquivo}
                {h.forcado && <span className="ml-2 text-[12px] font-medium text-alerta-parado">forçada</span>}
              </td>
              <td className={TD}>{dataHora(h.arquivo_modificado_em)}</td>
              <td className={TD}>{h.autor?.nome ?? '—'}</td>
              <td className={cn(TD, 'text-right')}>{h.novos}</td>
              <td className={cn(TD, 'text-right')}>{h.atualizados}</td>
              <td className={cn(TD, 'text-right')}>{h.sairam}</td>
              <td className={cn(TD, 'text-right')}>{h.mantidos}</td>
              <td className={cn(TD, 'text-right')}>{h.erros}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {historico.data?.length === 0 && (
        <p className="px-3 py-6 text-center text-grafite">Nenhuma atualização aplicada ainda.</p>
      )}
    </div>
  )
}

export function Estoque(): React.JSX.Element {
  const queryClient = useQueryClient()
  const [aba, setAba] = useState<'veiculos' | 'historico'>('veiculos')
  const leitura = useQuery({
    queryKey: CHAVES.leitura,
    queryFn: () => window.esteira.estoque.ultimaLeitura(),
    staleTime: Infinity
  })

  return (
    <Pagina titulo="Estoque e veículos">
      {leitura.data && (
        <Previa
          key={`${leitura.data.caminho}-${leitura.data.modificadoEm}`}
          leitura={leitura.data}
          onDescartar={() => queryClient.setQueryData(CHAVES.leitura, null)}
        />
      )}
      <div role="tablist" aria-label="Seção" className="mb-4 flex gap-6 border-b border-linha">
        {(
          [
            ['veiculos', 'Veículos'],
            ['historico', 'Histórico de atualizações']
          ] as const
        ).map(([valor, rotulo]) => (
          <button
            key={valor}
            role="tab"
            aria-selected={aba === valor}
            onClick={() => setAba(valor)}
            className={cn(
              '-mb-px border-b-2 border-transparent pb-2 text-[14px] text-grafite hover:text-tinta',
              aba === valor && 'border-azul-placa font-medium text-tinta'
            )}
          >
            {rotulo}
          </button>
        ))}
      </div>
      {aba === 'veiculos' ? <Veiculos /> : <Historico />}
    </Pagina>
  )
}
