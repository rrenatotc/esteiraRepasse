// RF04: corrigir uma venda devolvida (ou ainda não assumida) e reenviar.
// Placa não muda aqui: venda com placa errada é cancelada pelo repasse e
// registrada de novo.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatarDocumento } from '@shared/documento'
import { centavosDeDecimal, decimalDeCentavos, formatarCentavos } from '@shared/moeda'
import { CODIGO_DEMANDA } from '@shared/tipos'
import { Pagina } from '@renderer/components/Pagina'
import { Placa } from '@renderer/components/Placa'
import { Button, botao } from '@renderer/components/ui/button'
import { snapshot } from '@renderer/features/fila/api'
import { useOnline } from '@renderer/hooks/useOnline'
import { mensagemErro } from '@renderer/lib/erros'
import { buscarMinhaVenda, corrigirVenda, listarLojas } from './api'
import { Mensagem, Rodape } from './componentes'
import { PassoLojista, type DadosLojista } from './PassoLojista'
import { PassoValor, type DadosValor } from './PassoValor'

export function CorrigirVenda(): React.JSX.Element {
  const { id } = useParams()
  const venda = useQuery({ queryKey: ['vendas', 'uma', id], queryFn: () => buscarMinhaVenda(id!), enabled: !!id })

  if (venda.isPending) return <Pagina titulo="Corrigir venda" estreita>Carregando…</Pagina>
  if (venda.isError || !venda.data) {
    return (
      <Pagina titulo="Corrigir venda" estreita>
        <Mensagem tom="erro">{venda.isError ? mensagemErro(venda.error) : 'Venda não encontrada.'}</Mensagem>
      </Pagina>
    )
  }
  const d = venda.data
  if (d.status !== 'pendente' && !(d.status === 'nova' && d.responsavel_id === null)) {
    return (
      <Pagina titulo="Corrigir venda" estreita>
        <Mensagem tom="info">
          {CODIGO_DEMANDA(d.codigo)} já está com o repasse e não pode mais ser alterada por aqui. Fale com o repasse se precisar mudar algo.
        </Mensagem>
        <Link to="/app/vendas" className={`${botao({ variante: 'secundario' })} mt-4`}>
          Voltar para minhas vendas
        </Link>
      </Pagina>
    )
  }
  return <Formulario venda={d} />
}

function Formulario({ venda }: { venda: NonNullable<Awaited<ReturnType<typeof buscarMinhaVenda>>> }): React.JSX.Element {
  const navegar = useNavigate()
  const queryClient = useQueryClient()
  const online = useOnline()
  const lojas = useQuery({ queryKey: ['lojas', 'ativas'], queryFn: listarLojas, staleTime: Infinity })
  const [passo, setPasso] = useState(0)
  const [lojista, setLojista] = useState<DadosLojista>({
    documento: venda.lojista?.documento ?? '',
    lojista: venda.lojista,
    novo: null
  })
  const [valor, setValor] = useState<DadosValor>({
    centavos: centavosDeDecimal(venda.valor_venda),
    lojaId: venda.loja_proposta_id,
    observacao: venda.observacao ?? ''
  })
  const pendente = venda.status === 'pendente'
  const salvar = useMutation({
    mutationFn: () =>
      corrigirVenda({
        demanda: venda.id,
        lojaPropostaId: valor.lojaId!,
        valor: decimalDeCentavos(valor.centavos!),
        observacao: valor.observacao,
        lojistaId: lojista.lojista?.id ?? null,
        lojistaNovo: lojista.lojista ? null : lojista.novo
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendas'] })
      navegar('/app/vendas')
    }
  })
  const v = snapshot(venda)
  const loja = lojas.data?.find((l) => l.id === valor.lojaId)

  return (
    <Pagina titulo={`${pendente ? 'Corrigir' : 'Editar'} ${CODIGO_DEMANDA(venda.codigo)}`} estreita>
      {pendente && venda.motivo_ultimo && (
        <div className="mb-6">
          <Mensagem tom="alerta">O repasse devolveu esta venda: {venda.motivo_ultimo}</Mensagem>
        </div>
      )}
      <div className="mb-6 flex items-center gap-3 border border-linha bg-superficie px-4 py-3">
        <Placa placa={venda.placa} />
        <span>
          {v.marca} {v.modelo}
        </span>
        <span className="ml-auto text-[13px] text-grafite">Placa errada? Peça ao repasse para cancelar e registre de novo.</span>
      </div>

      {passo === 0 && (
        <PassoLojista
          inicial={lojista}
          onVoltar={() => navegar('/app/vendas')}
          onAvancar={(l) => {
            setLojista(l)
            setPasso(1)
          }}
        />
      )}
      {passo === 1 && (
        <PassoValor
          inicial={valor}
          onVoltar={() => setPasso(0)}
          onAvancar={(dados) => {
            setValor(dados)
            setPasso(2)
          }}
        />
      )}
      {passo === 2 && (
        <div>
          <h2 className="mb-4 text-[17px] font-semibold">Confira a correção</h2>
          <dl className="grid grid-cols-[160px_1fr] gap-y-3 border border-linha bg-superficie px-5 py-4">
            <dt className="text-grafite">Lojista</dt>
            <dd>
              {lojista.lojista?.razao_social ?? lojista.novo?.razao_social}{' '}
              <span className="numeros text-grafite">{formatarDocumento(lojista.documento)}</span>
            </dd>
            <dt className="text-grafite">Valor de venda</dt>
            <dd className="numeros font-semibold">{formatarCentavos(valor.centavos!)}</dd>
            <dt className="text-grafite">Loja da proposta</dt>
            <dd>{loja ? `${loja.codigo} ${loja.nome}` : '—'}</dd>
            {valor.observacao && (
              <>
                <dt className="text-grafite">Observação</dt>
                <dd>{valor.observacao}</dd>
              </>
            )}
          </dl>
          {salvar.isError && (
            <div className="mt-4">
              <Mensagem tom="erro">{mensagemErro(salvar.error)}</Mensagem>
            </div>
          )}
          <Rodape>
            <Button variante="secundario" onClick={() => setPasso(1)} disabled={salvar.isPending}>
              Voltar
            </Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || !online}>
              {salvar.isPending ? 'Enviando…' : pendente ? 'Reenviar ao repasse' : 'Salvar alterações'}
            </Button>
          </Rodape>
        </div>
      )}
    </Pagina>
  )
}
