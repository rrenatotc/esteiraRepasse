// Colunas da planilha que só o vendedor sabe (FIPE, compra, classificação...).
// Usadas no registro da venda e na edição da linha.
import { decimalDeTexto, errosPlanilha, textoDeDecimal, type DadosPlanilha } from './dados'
import { Campo, Input } from '@renderer/components/ui/campo'
import { Selecao } from '@renderer/features/vendas/componentes'

function CampoReais({
  rotulo,
  valor,
  erro,
  onChange,
  negativo = false
}: {
  rotulo: string
  valor: string
  erro?: string
  onChange: (v: string) => void
  negativo?: boolean
}): React.JSX.Element {
  return (
    <Campo rotulo={rotulo} erro={erro}>
      {(p) => (
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-grafite"
          >
            R$
          </span>
          <Input
            {...p}
            inputMode="decimal"
            className="numeros pl-10"
            placeholder="0,00"
            value={valor}
            onChange={(e) =>
              onChange(e.target.value.replace(negativo ? /[^\d.,-]/g : /[^\d.,]/g, ''))
            }
            onBlur={() => {
              const d = decimalDeTexto(valor)
              if (d) onChange(textoDeDecimal(d))
            }}
          />
        </div>
      )}
    </Campo>
  )
}

export function CamposPlanilha({
  valor,
  onChange,
  anunciantes = [],
  placeholderAnunciante
}: {
  valor: DadosPlanilha
  onChange: (d: DadosPlanilha) => void
  anunciantes?: string[]
  placeholderAnunciante?: string
}): React.JSX.Element {
  const erros = errosPlanilha(valor)
  const mudar = (parcial: Partial<DadosPlanilha>): void => onChange({ ...valor, ...parcial })
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-5">
      <Campo rotulo="Anunciante">
        {(p) => (
          <>
            <Input
              {...p}
              list="planilha-anunciantes"
              placeholder={placeholderAnunciante}
              value={valor.anunciante}
              onChange={(e) => mudar({ anunciante: e.target.value.toUpperCase() })}
              maxLength={80}
            />
            <datalist id="planilha-anunciantes">
              {anunciantes.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </>
        )}
      </Campo>
      <Campo rotulo="Tipo de venda">
        {(p) => (
          <Selecao
            {...p}
            value={valor.tipoVenda}
            onChange={(e) => mudar({ tipoVenda: e.target.value })}
          >
            <option value="">—</option>
            <option value="GRUPO">GRUPO</option>
            <option value="PACOTE">PACOTE</option>
          </Selecao>
        )}
      </Campo>
      <CampoReais
        rotulo="FIPE"
        valor={valor.fipe}
        erro={erros.fipe}
        onChange={(fipe) => mudar({ fipe })}
      />
      <CampoReais
        rotulo="Valor de compra"
        valor={valor.valorCompra}
        erro={erros.valorCompra}
        onChange={(valorCompra) => mudar({ valorCompra })}
      />
      <Campo rotulo="Classificação">
        {(p) => (
          <Selecao
            {...p}
            value={valor.classificacao}
            onChange={(e) => mudar({ classificacao: e.target.value })}
          >
            <option value="">—</option>
            {['A', 'B', 'C', 'D'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      <CampoReais
        rotulo="Transf. margem entre dpto (opcional)"
        valor={valor.transfMargem}
        erro={erros.transfMargem}
        onChange={(transfMargem) => mudar({ transfMargem })}
        negativo
      />
      <Campo rotulo="Repassador (opcional)">
        {(p) => (
          <Input
            {...p}
            value={valor.repassador}
            onChange={(e) => mudar({ repassador: e.target.value.toUpperCase() })}
            maxLength={80}
          />
        )}
      </Campo>
    </div>
  )
}
