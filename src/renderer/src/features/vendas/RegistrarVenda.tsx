// RF02: registrar venda em 3 passos + revisão.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatarDocumento } from '@shared/documento'
import { decimalDeCentavos, formatarCentavos } from '@shared/moeda'
import { CODIGO_DEMANDA, type Demanda } from '@shared/tipos'
import { useAuth } from '@renderer/app/auth'
import { Pagina } from '@renderer/components/Pagina'
import { Placa } from '@renderer/components/Placa'
import { Button, botao } from '@renderer/components/ui/button'
import { useOnline } from '@renderer/hooks/useOnline'
import { mensagemErro } from '@renderer/lib/erros'
import { listarLojas, registrarVenda } from './api'
import { Etapas, Mensagem, Rodape } from './componentes'
import { PassoLojista, type DadosLojista } from './PassoLojista'
import { descricaoVeiculo, PassoPlaca, type DadosPlaca } from './PassoPlaca'
import { PassoValor, type DadosValor } from './PassoValor'

interface Rascunho {
  placa: DadosPlaca
  lojista: DadosLojista
  valor: DadosValor
}

function novoRascunho(lojaId: number | null): Rascunho {
  return {
    placa: { placa: '', veiculo: null, manual: null },
    lojista: { documento: '', lojista: null, novo: null },
    valor: { centavos: null, lojaId, observacao: '' }
  }
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-4 border-b border-linha py-3 last:border-0">
      <dt className="text-grafite">{rotulo}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

function Revisao({
  rascunho,
  onEditar,
  onVoltar,
  onRegistrada
}: {
  rascunho: Rascunho
  onEditar: (passo: number) => void
  onVoltar: () => void
  onRegistrada: (d: Demanda) => void
}): React.JSX.Element {
  const online = useOnline()
  const queryClient = useQueryClient()
  const lojas = useQuery({ queryKey: ['lojas', 'ativas'], queryFn: listarLojas, staleTime: Infinity })
  const { placa, lojista, valor } = rascunho
  const veiculo = placa.veiculo ?? placa.manual
  const loja = lojas.data?.find((l) => l.id === valor.lojaId)
  const nomeLojista = lojista.lojista?.razao_social ?? lojista.novo?.razao_social

  const registrar = useMutation({
    mutationFn: () =>
      registrarVenda({
        placa: placa.placa,
        lojaPropostaId: valor.lojaId!,
        valor: decimalDeCentavos(valor.centavos!),
        observacao: valor.observacao,
        veiculoManual: placa.veiculo ? null : placa.manual,
        lojistaId: lojista.lojista?.id ?? null,
        lojistaNovo: lojista.lojista ? null : lojista.novo
      }),
    onSuccess: (d) => {
      void queryClient.invalidateQueries({ queryKey: ['vendas'] })
      onRegistrada(d)
    }
  })

  const editar = (passo: number): React.JSX.Element => (
    <button type="button" onClick={() => onEditar(passo)} className="ml-3 text-[13px] text-azul-placa hover:underline">
      Alterar
    </button>
  )

  return (
    <div>
      <h2 className="mb-1 text-[17px] font-semibold">Confira antes de enviar</h2>
      <p className="mb-6 text-grafite">Depois de enviada, a venda vai para a fila do repasse.</p>
      <dl className="border border-linha bg-superficie px-5">
        <Linha rotulo="Veículo">
          <span className="flex items-center gap-3">
            <Placa placa={placa.placa} />
            <span className="truncate">{veiculo && descricaoVeiculo(veiculo)}</span>
            {editar(0)}
          </span>
          {placa.manual && <span className="mt-1 block text-[13px] text-alerta-parado">Cadastro manual, o repasse vai revisar.</span>}
        </Linha>
        <Linha rotulo="Lojista">
          {nomeLojista}
          {editar(1)}
          <span className="numeros block text-[13px] text-grafite">{formatarDocumento(lojista.documento)}</span>
        </Linha>
        <Linha rotulo="Valor de venda">
          <span className="numeros text-[17px] font-semibold">{formatarCentavos(valor.centavos!)}</span>
          {editar(2)}
        </Linha>
        <Linha rotulo="Loja da proposta">{loja ? `${loja.codigo} ${loja.nome}` : '—'}</Linha>
        {valor.observacao && <Linha rotulo="Observação">{valor.observacao}</Linha>}
      </dl>

      <div className="mt-4 flex flex-col gap-2">
        {!online && <Mensagem tom="alerta">Sem internet. A venda não será enviada até a conexão voltar.</Mensagem>}
        {registrar.isError && <Mensagem tom="erro">{mensagemErro(registrar.error)}</Mensagem>}
      </div>

      <Rodape>
        <Button variante="secundario" onClick={onVoltar} disabled={registrar.isPending}>
          Voltar
        </Button>
        <Button onClick={() => registrar.mutate()} disabled={!online || registrar.isPending}>
          {registrar.isPending ? 'Enviando…' : 'Registrar venda'}
        </Button>
      </Rodape>
    </div>
  )
}

export function RegistrarVenda(): React.JSX.Element {
  const { perfil } = useAuth()
  const [passo, setPasso] = useState(0)
  const [rascunho, setRascunho] = useState<Rascunho>(() => novoRascunho(perfil?.loja_id ?? null))
  const [registrada, setRegistrada] = useState<Demanda | null>(null)

  function recomecar(): void {
    setRascunho(novoRascunho(perfil?.loja_id ?? null))
    setRegistrada(null)
    setPasso(0)
  }

  if (registrada) {
    return (
      <Pagina titulo="Registrar venda" estreita>
        <div className="animate-surgir flex flex-col items-start gap-4 border border-linha bg-superficie px-6 py-6">
          <CheckCircle2 className="size-6 text-status-faturada" aria-hidden />
          <div>
            <h2 className="text-[17px] font-semibold">Venda registrada: {CODIGO_DEMANDA(registrada.codigo)}</h2>
            <p className="text-grafite">
              Placa {registrada.placa} enviada para a fila do repasse. Você recebe um aviso quando o status mudar.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={recomecar}>Registrar outra venda</Button>
            <Link to="/app/vendas" className={botao({ variante: 'secundario' })}>
              Ver minhas vendas
            </Link>
          </div>
        </div>
      </Pagina>
    )
  }

  return (
    <Pagina titulo="Registrar venda" estreita>
      <Etapas atual={passo} />
      {passo === 0 && (
        <PassoPlaca
          inicial={rascunho.placa}
          onAvancar={(placa) => {
            setRascunho({ ...rascunho, placa })
            setPasso(1)
          }}
        />
      )}
      {passo === 1 && (
        <PassoLojista
          inicial={rascunho.lojista}
          onVoltar={() => setPasso(0)}
          onAvancar={(lojista) => {
            setRascunho({ ...rascunho, lojista })
            setPasso(2)
          }}
        />
      )}
      {passo === 2 && (
        <PassoValor
          inicial={rascunho.valor}
          onVoltar={() => setPasso(1)}
          onAvancar={(valor) => {
            setRascunho({ ...rascunho, valor })
            setPasso(3)
          }}
        />
      )}
      {passo === 3 && (
        <Revisao rascunho={rascunho} onEditar={setPasso} onVoltar={() => setPasso(2)} onRegistrada={setRegistrada} />
      )}
    </Pagina>
  )
}
