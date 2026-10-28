// Planilha "Vendas Repasse <MÊS> <ANO>": as vendas do mês de todas as lojas,
// nas mesmas colunas da planilha do time. Cada venda registrada já entra
// aqui; o vendedor da venda (e o repasse/gestão) edita ou exclui a linha, e
// qualquer um exporta o .xlsx idêntico ao original.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Download, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { centavosDeDecimal, formatarCentavos } from '@shared/moeda'
import { nomeAbaPlanilha } from '@shared/planilha'
import { useAuth } from '@renderer/app/auth'
import { Pagina } from '@renderer/components/Pagina'
import { Button } from '@renderer/components/ui/button'
import { Campo, Input } from '@renderer/components/ui/campo'
import { AreaTexto, Mensagem, Selecao } from '@renderer/features/vendas/componentes'
import { mensagemErro } from '@renderer/lib/erros'
import { supabase } from '@renderer/lib/supabase'
import { cn } from '@renderer/lib/utils'
import {
  editarLinha,
  excluirLinha,
  listarAnunciantes,
  listarPlanilha,
  paraExportar,
  type LinhaVenda
} from './api'
import { CamposPlanilha } from './campos'
import {
  decimalDeTexto,
  errosPlanilha,
  jsonPlanilha,
  textoDeDecimal,
  type DadosPlanilha
} from './dados'

const reais = (v: number | string | null): string =>
  v === null ? '' : formatarCentavos(centavosDeDecimal(v))
const valor = (v: number | string | null): number => (v === null ? 0 : centavosDeDecimal(v))
const dataBr = (d: string): string => d.split('-').reverse().join('/')

const COLUNAS = [
  'Anunciante',
  'Placa',
  'Veículos',
  'Ano Fab./Modelo',
  'FIPE',
  'Valor Compra',
  'Valor Vendido',
  'Dias estoque',
  'Classificação',
  'Lucro R$',
  'Lucro %',
  'TRANF. MARGEM ENTRE DPTO',
  'Tipo Venda',
  'Lojista',
  'Data da Venda',
  'Faturado?',
  'REPASSADOR'
]

/** Atualiza a tela quando alguém registra, edita ou exclui uma venda. */
function useAoVivo(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const canal = supabase
      .channel('planilha-vendas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planilha_vendas' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['planilha'] })
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(canal)
    }
  }, [queryClient])
}

function Exportar({ mes, linhas }: { mes: string; linhas: LinhaVenda[] }): React.JSX.Element {
  const acao = useMutation({
    mutationFn: () => window.esteira.planilha.exportar({ mes, linhas: linhas.map(paraExportar) })
  })
  return (
    <span className="flex items-center gap-2 text-[13px]">
      {acao.isSuccess && acao.data && <span className="text-status-faturada">Salvo.</span>}
      {acao.isError && <span className="text-erro">{mensagemErro(acao.error)}</span>}
      <Button tamanho="sm" onClick={() => acao.mutate()} disabled={acao.isPending}>
        <Download className="size-3.5" aria-hidden />
        {acao.isPending ? 'Gerando…' : 'Exportar planilha'}
      </Button>
    </span>
  )
}

function Janela({
  titulo,
  onFechar,
  children
}: {
  titulo: string
  onFechar: () => void
  children: React.ReactNode
}): React.JSX.Element {
  useEffect(() => {
    function tecla(e: KeyboardEvent): void {
      if (e.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onFechar])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/30 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-janela"
    >
      <div className="animate-surgir flex max-h-full w-full max-w-[640px] flex-col overflow-auto border border-linha bg-superficie p-6">
        <h2 id="titulo-janela" className="mb-5 text-[17px] font-semibold">
          {titulo}
        </h2>
        {children}
      </div>
    </div>
  )
}

interface Formulario extends DadosPlanilha {
  placa: string
  veiculo: string
  ano: string
  valorVendido: string
  diasEstoque: string
  lojista: string
  dataVenda: string
  faturado: string
}

function formularioDe(l: LinhaVenda): Formulario {
  return {
    anunciante: l.anunciante ?? '',
    fipe: textoDeDecimal(l.fipe),
    valorCompra: textoDeDecimal(l.valor_compra),
    classificacao: l.classificacao ?? '',
    transfMargem: textoDeDecimal(l.transf_margem),
    tipoVenda: l.tipo_venda ?? '',
    repassador: l.repassador ?? '',
    placa: l.placa,
    veiculo: l.veiculo ?? '',
    ano: l.ano ?? '',
    valorVendido: textoDeDecimal(l.valor_vendido),
    diasEstoque: l.dias_estoque === null ? '' : String(l.dias_estoque),
    lojista: l.lojista ?? '',
    dataVenda: l.data_venda,
    faturado: l.faturado ?? ''
  }
}

function EditarLinha({
  linha,
  onFechar
}: {
  linha: LinhaVenda
  onFechar: () => void
}): React.JSX.Element {
  const queryClient = useQueryClient()
  const anunciantes = useQuery({
    queryKey: ['planilha', 'anunciantes'],
    queryFn: listarAnunciantes,
    staleTime: 5 * 60_000
  })
  const [f, setF] = useState<Formulario>(() => formularioDe(linha))
  const mudar = (parcial: Partial<Formulario>): void => setF({ ...f, ...parcial })
  const vendidoInvalido =
    decimalDeTexto(f.valorVendido) === undefined || f.valorVendido.trim().startsWith('-')
  const diasInvalido = f.diasEstoque.trim() !== '' && !/^\d{1,6}$/.test(f.diasEstoque.trim())
  const valido =
    !vendidoInvalido &&
    !diasInvalido &&
    f.placa.trim() !== '' &&
    !!f.dataVenda &&
    Object.keys(errosPlanilha(f)).length === 0

  const salvar = useMutation({
    mutationFn: () =>
      editarLinha(linha.demanda_id, {
        ...jsonPlanilha(f),
        placa: f.placa.trim(),
        veiculo: f.veiculo.trim() || null,
        ano: f.ano.trim() || null,
        valor_vendido: decimalDeTexto(f.valorVendido) ?? null,
        dias_estoque: f.diasEstoque.trim() || null,
        lojista: f.lojista.trim() || null,
        data_venda: f.dataVenda,
        faturado: f.faturado || null
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['planilha'] })
      onFechar()
    }
  })

  function enviar(e: FormEvent): void {
    e.preventDefault()
    if (valido) salvar.mutate()
  }

  const texto = (
    rotulo: string,
    chave: 'placa' | 'veiculo' | 'ano' | 'lojista',
    extra?: { erro?: string; maxLength?: number }
  ): React.JSX.Element => (
    <Campo rotulo={rotulo} erro={extra?.erro}>
      {(p) => (
        <Input
          {...p}
          value={f[chave]}
          maxLength={extra?.maxLength ?? 120}
          onChange={(e) => mudar({ [chave]: e.target.value.toUpperCase() })}
        />
      )}
    </Campo>
  )

  return (
    <Janela
      titulo={`Editar linha · ${linha.placa}`}
      onFechar={() => !salvar.isPending && onFechar()}
    >
      <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          {texto('Placa', 'placa', {
            maxLength: 10,
            erro: f.placa.trim() ? undefined : 'Informe a placa.'
          })}
          {texto('Veículo', 'veiculo')}
          {texto('Ano fab./modelo', 'ano', { maxLength: 20 })}
          {texto('Lojista', 'lojista')}
          <Campo rotulo="Valor vendido" erro={vendidoInvalido ? 'Valor inválido.' : undefined}>
            {(p) => (
              <Input
                {...p}
                inputMode="decimal"
                className="numeros"
                value={f.valorVendido}
                onChange={(e) => mudar({ valorVendido: e.target.value.replace(/[^\d.,]/g, '') })}
                onBlur={() => {
                  const d = decimalDeTexto(f.valorVendido)
                  if (d) mudar({ valorVendido: textoDeDecimal(d) })
                }}
              />
            )}
          </Campo>
          <Campo rotulo="Data da venda">
            {(p) => (
              <Input
                {...p}
                type="date"
                value={f.dataVenda}
                onChange={(e) => mudar({ dataVenda: e.target.value })}
              />
            )}
          </Campo>
          <Campo rotulo="Dias de estoque" erro={diasInvalido ? 'Use só números.' : undefined}>
            {(p) => (
              <Input
                {...p}
                inputMode="numeric"
                className="numeros"
                value={f.diasEstoque}
                onChange={(e) => mudar({ diasEstoque: e.target.value })}
              />
            )}
          </Campo>
          <Campo rotulo="Faturado?">
            {(p) => (
              <Selecao
                {...p}
                value={f.faturado}
                onChange={(e) => mudar({ faturado: e.target.value })}
              >
                <option value="">—</option>
                <option value="SIM">SIM</option>
                <option value="NÃO">NÃO</option>
              </Selecao>
            )}
          </Campo>
        </div>
        <CamposPlanilha
          valor={f}
          onChange={(d) => setF({ ...f, ...d })}
          anunciantes={anunciantes.data}
        />
        {salvar.isError && <Mensagem tom="erro">{mensagemErro(salvar.error)}</Mensagem>}
        <div className="flex justify-end gap-2 border-t border-linha pt-4">
          <Button variante="secundario" onClick={onFechar} disabled={salvar.isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!valido || salvar.isPending}>
            {salvar.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Janela>
  )
}

function ExcluirLinha({
  linha,
  onFechar
}: {
  linha: LinhaVenda
  onFechar: () => void
}): React.JSX.Element {
  const queryClient = useQueryClient()
  const [motivo, setMotivo] = useState('')
  const excluir = useMutation({
    mutationFn: () => excluirLinha(linha.demanda_id, motivo.trim()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['planilha'] })
      void queryClient.invalidateQueries({ queryKey: ['vendas'] })
      void queryClient.invalidateQueries({ queryKey: ['fila'] })
      onFechar()
    }
  })
  return (
    <Janela
      titulo={`Excluir venda · ${linha.placa}`}
      onFechar={() => !excluir.isPending && onFechar()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (motivo.trim()) excluir.mutate()
        }}
        noValidate
        className="flex flex-col gap-5"
      >
        <p className="text-grafite">
          A linha sai da planilha e a venda é <strong className="text-tinta">cancelada</strong> na
          esteira do repasse. Isso não pode ser desfeito por aqui.
        </p>
        <Campo rotulo="Motivo" ajuda="Por que a venda caiu? O repasse vê esse motivo no histórico.">
          {(p) => (
            <AreaTexto
              {...p}
              autoFocus
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={500}
            />
          )}
        </Campo>
        {excluir.isError && <Mensagem tom="erro">{mensagemErro(excluir.error)}</Mensagem>}
        <div className="flex justify-end gap-2 border-t border-linha pt-4">
          <Button variante="secundario" onClick={onFechar} disabled={excluir.isPending}>
            Voltar
          </Button>
          <Button type="submit" variante="perigo" disabled={!motivo.trim() || excluir.isPending}>
            {excluir.isPending ? 'Excluindo…' : 'Excluir venda'}
          </Button>
        </div>
      </form>
    </Janela>
  )
}

export function Planilha(): React.JSX.Element {
  useAoVivo()
  const { perfil } = useAuth()
  const [mes, setMes] = useState(() => format(new Date(), 'yyyy-MM'))
  const [editando, setEditando] = useState<LinhaVenda | null>(null)
  const [excluindo, setExcluindo] = useState<LinhaVenda | null>(null)
  const linhas = useQuery({
    queryKey: ['planilha', 'mes', mes],
    queryFn: () => listarPlanilha(mes),
    placeholderData: keepPreviousData
  })
  const dados = linhas.data ?? []

  const podeEditar = (l: LinhaVenda): boolean =>
    perfil?.papel === 'repasse' || perfil?.papel === 'gestor' || l.vendedor_id === perfil?.id

  const totalCompra = dados.reduce((s, l) => s + valor(l.valor_compra), 0)
  const totalVendido = dados.reduce((s, l) => s + valor(l.valor_vendido), 0)
  const totalLucro = dados.reduce((s, l) => s + valor(l.valor_vendido) - valor(l.valor_compra), 0)

  return (
    <Pagina
      titulo={`Vendas Repasse ${nomeAbaPlanilha(mes)}`}
      acoes={
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-[13px] text-grafite">
            Mês
            <Input
              type="month"
              className="h-8 w-[150px]"
              value={mes}
              onChange={(e) => e.target.value && setMes(e.target.value)}
            />
          </label>
          <Exportar mes={mes} linhas={dados} />
        </div>
      }
    >
      {linhas.isError && <Mensagem tom="erro">{mensagemErro(linhas.error)}</Mensagem>}
      <p className="mb-3 text-[13px] text-grafite">
        {dados.length} {dados.length === 1 ? 'venda' : 'vendas'} · compra{' '}
        {formatarCentavos(totalCompra)} · vendido {formatarCentavos(totalVendido)} · lucro{' '}
        <span className={cn(totalLucro < 0 && 'text-erro')}>{formatarCentavos(totalLucro)}</span>
        {totalVendido > 0 &&
          ` (${((totalLucro / totalVendido) * 100).toFixed(2).replace('.', ',')}%)`}
      </p>
      <div className="overflow-auto border border-linha bg-superficie">
        <table className="w-max min-w-full border-collapse text-[12px]">
          <thead className="sticky top-0 bg-papel">
            <tr>
              <th className="w-[64px] border-b border-linha" aria-label="Ações" />
              {COLUNAS.map((c) => (
                <th
                  key={c}
                  className="border-b border-l border-linha px-2 py-2 text-center font-semibold whitespace-nowrap"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="numeros">
            {dados.map((l) => {
              const lucro = valor(l.valor_vendido) - valor(l.valor_compra)
              return (
                <tr key={l.demanda_id} className="h-8 hover:bg-papel">
                  <td className="border-b border-linha px-1 whitespace-nowrap">
                    {podeEditar(l) && (
                      <>
                        <Button
                          variante="fantasma"
                          tamanho="icone"
                          className="size-7"
                          title="Editar linha"
                          aria-label={`Editar ${l.placa}`}
                          onClick={() => setEditando(l)}
                        >
                          <Pencil className="size-3.5" aria-hidden />
                        </Button>
                        <Button
                          variante="fantasma"
                          tamanho="icone"
                          className="size-7 text-erro"
                          title="Excluir (venda caiu)"
                          aria-label={`Excluir ${l.placa}`}
                          onClick={() => setExcluindo(l)}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      </>
                    )}
                  </td>
                  <td className="border-b border-l border-linha px-2 whitespace-nowrap">
                    {l.anunciante}
                  </td>
                  <td className="border-b border-l border-linha px-2 text-center whitespace-nowrap">
                    {l.placa}
                  </td>
                  <td className="border-b border-l border-linha px-2 whitespace-nowrap">
                    {l.veiculo}
                  </td>
                  <td className="border-b border-l border-linha px-2 text-center">{l.ano}</td>
                  <td className="border-b border-l border-linha px-2 text-right whitespace-nowrap">
                    {reais(l.fipe)}
                  </td>
                  <td className="border-b border-l border-linha px-2 text-right whitespace-nowrap">
                    {reais(l.valor_compra)}
                  </td>
                  <td className="border-b border-l border-linha px-2 text-right whitespace-nowrap">
                    {reais(l.valor_vendido)}
                  </td>
                  <td className="border-b border-l border-linha px-2 text-center">
                    {l.dias_estoque}
                  </td>
                  <td className="border-b border-l border-linha px-2 text-center">
                    {l.classificacao}
                  </td>
                  <td
                    className={cn(
                      'border-b border-l border-linha px-2 text-right whitespace-nowrap',
                      lucro < 0 && 'text-erro'
                    )}
                  >
                    {formatarCentavos(lucro)}
                  </td>
                  <td className="border-b border-l border-linha px-2" />
                  <td className="border-b border-l border-linha px-2 text-right whitespace-nowrap">
                    {reais(l.transf_margem)}
                  </td>
                  <td className="border-b border-l border-linha px-2 text-center">
                    {l.tipo_venda}
                  </td>
                  <td className="border-b border-l border-linha px-2 whitespace-nowrap">
                    {l.lojista}
                  </td>
                  <td className="border-b border-l border-linha px-2 text-center">
                    {dataBr(l.data_venda)}
                  </td>
                  <td className="border-b border-l border-linha px-2 text-center">{l.faturado}</td>
                  <td className="border-b border-l border-linha px-2 whitespace-nowrap">
                    {l.repassador}
                  </td>
                </tr>
              )
            })}
            {dados.length === 0 && !linhas.isLoading && (
              <tr>
                <td colSpan={COLUNAS.length + 1} className="px-4 py-8 text-center text-grafite">
                  Nenhuma venda neste mês ainda. Cada venda registrada entra aqui automaticamente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editando && <EditarLinha linha={editando} onFechar={() => setEditando(null)} />}
      {excluindo && <ExcluirLinha linha={excluindo} onFechar={() => setExcluindo(null)} />}
    </Pagina>
  )
}
