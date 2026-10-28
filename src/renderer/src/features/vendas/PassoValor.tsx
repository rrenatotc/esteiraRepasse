import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { centavosDeTexto, formatarCentavos } from '@shared/moeda'
import { Button } from '@renderer/components/ui/button'
import { Campo, Input } from '@renderer/components/ui/campo'
import { listarAnunciantes } from '@renderer/features/planilha/api'
import { CamposPlanilha } from '@renderer/features/planilha/campos'
import { errosPlanilha, type DadosPlanilha } from '@renderer/features/planilha/dados'
import { listarLojas } from './api'
import { AreaTexto, Rodape, Selecao } from './componentes'

export interface DadosValor {
  centavos: number | null
  lojaId: number | null
  observacao: string
  /** Só no registro; a correção da venda não mexe na planilha. */
  planilha?: DadosPlanilha
}

export function PassoValor({
  inicial,
  onVoltar,
  onAvancar
}: {
  inicial: DadosValor
  onVoltar: () => void
  onAvancar: (d: DadosValor & { centavos: number; lojaId: number }) => void
}): React.JSX.Element {
  const lojas = useQuery({ queryKey: ['lojas', 'ativas'], queryFn: listarLojas, staleTime: Infinity })
  const [valor, setValor] = useState(inicial.centavos ? formatarCentavos(inicial.centavos) : '')
  const [lojaId, setLojaId] = useState<number | null>(inicial.lojaId)
  const [observacao, setObservacao] = useState(inicial.observacao)
  const [planilha, setPlanilha] = useState(inicial.planilha)
  const anunciantes = useQuery({ queryKey: ['planilha', 'anunciantes'], queryFn: listarAnunciantes, staleTime: 5 * 60_000, enabled: !!planilha })
  const loja = lojas.data?.find((l) => l.id === lojaId)
  const [tocado, setTocado] = useState(false)

  const centavos = centavosDeTexto(valor)
  const erroValor =
    tocado && valor.trim() !== '' && (centavos === null || centavos <= 0)
      ? 'Digite um valor maior que zero, por exemplo 68.500,00.'
      : undefined
  const podeAvancar =
    centavos !== null && centavos > 0 && lojaId !== null && (!planilha || Object.keys(errosPlanilha(planilha)).length === 0)

  function avancar(e: FormEvent): void {
    e.preventDefault()
    if (podeAvancar) onAvancar({ centavos, lojaId, observacao: observacao.trim(), planilha })
  }

  return (
    <form onSubmit={avancar} noValidate>
      <h2 className="mb-1 text-[17px] font-semibold">Valor e loja da proposta</h2>
      <p className="mb-6 text-grafite">A loja é onde o repasse vai fazer a proposta no Bravos.</p>
      <div className="grid max-w-[480px] gap-5">
        <Campo rotulo="Valor de venda" erro={erroValor}>
          {(p) => (
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-grafite">
                R$
              </span>
              <Input
                {...p}
                autoFocus
                inputMode="decimal"
                className="numeros h-11 pl-10 text-[17px]"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value.replace(/[^\d.,]/g, ''))}
                onBlur={() => {
                  setTocado(true)
                  if (centavos !== null) setValor(formatarCentavos(centavos).replace(/^R\$\s/, ''))
                }}
              />
            </div>
          )}
        </Campo>
        <Campo rotulo="Loja da proposta">
          {(p) => (
            <Selecao {...p} value={lojaId ?? ''} onChange={(e) => setLojaId(e.target.value ? Number(e.target.value) : null)}>
              <option value="" disabled>
                Escolha a loja
              </option>
              {lojas.data?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.codigo} {l.nome}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
        <Campo rotulo="Observação (opcional)" ajuda="Algo que o repasse precisa saber para montar a proposta.">
          {(p) => <AreaTexto {...p} value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={1000} />}
        </Campo>
      </div>
      {planilha && (
        <>
          <h3 className="mt-8 mb-1 text-[15px] font-semibold">Planilha de vendas</h3>
          <p className="mb-5 text-[13px] text-grafite">
            Vai direto para a planilha do mês. O que não souber agora dá para completar depois na aba Planilha.
          </p>
          <div className="max-w-[560px]">
            <CamposPlanilha
              valor={planilha}
              onChange={setPlanilha}
              anunciantes={anunciantes.data}
              placeholderAnunciante={loja ? loja.nome.toUpperCase() : undefined}
            />
          </div>
        </>
      )}
      <Rodape>
        <Button variante="secundario" onClick={onVoltar}>
          Voltar
        </Button>
        <Button type="submit" disabled={!podeAvancar}>
          Revisar
        </Button>
      </Rodape>
    </form>
  )
}
