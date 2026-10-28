// Colunas da planilha que só o vendedor sabe (FIPE, compra, classificação...):
// estado do formulário e conversão para as RPCs.
import {
  centavosDeDecimal,
  centavosDeTexto,
  decimalDeCentavos,
  formatarCentavos
} from '@shared/moeda'

export interface DadosPlanilha {
  anunciante: string
  fipe: string
  valorCompra: string
  classificacao: string
  transfMargem: string
  tipoVenda: string
  repassador: string
}

export const PLANILHA_VAZIA: DadosPlanilha = {
  anunciante: '',
  fipe: '',
  valorCompra: '',
  classificacao: '',
  transfMargem: '',
  tipoVenda: '',
  repassador: ''
}

/** "68.500,00" → "68500.00"; "-1.000" → "-1000.00"; vazio → null; inválido → undefined. */
export function decimalDeTexto(texto: string): string | null | undefined {
  const t = texto.trim()
  if (!t) return null
  const negativo = t.startsWith('-')
  const centavos = centavosDeTexto(negativo ? t.slice(1) : t)
  if (centavos === null) return undefined
  return decimalDeCentavos(negativo ? -centavos : centavos)
}

/** Valor do banco para o campo de texto ("68.500,00"). */
export function textoDeDecimal(valor: string | number | null): string {
  if (valor === null) return ''
  const c = centavosDeDecimal(valor)
  return (c < 0 ? '-' : '') + formatarCentavos(Math.abs(c)).replace(/^R\$\s/, '')
}

export function errosPlanilha(
  d: DadosPlanilha
): Partial<Record<'fipe' | 'valorCompra' | 'transfMargem', string>> {
  const erros: Partial<Record<'fipe' | 'valorCompra' | 'transfMargem', string>> = {}
  if (decimalDeTexto(d.fipe) === undefined || d.fipe.trim().startsWith('-'))
    erros.fipe = 'Valor inválido.'
  if (decimalDeTexto(d.valorCompra) === undefined || d.valorCompra.trim().startsWith('-'))
    erros.valorCompra = 'Valor inválido.'
  if (decimalDeTexto(d.transfMargem) === undefined) erros.transfMargem = 'Valor inválido.'
  return erros
}

/** Corpo do p_planilha / p_dados das RPCs. */
export function jsonPlanilha(d: DadosPlanilha): Record<string, string | null> {
  return {
    anunciante: d.anunciante.trim() || null,
    fipe: decimalDeTexto(d.fipe) ?? null,
    valor_compra: decimalDeTexto(d.valorCompra) ?? null,
    classificacao: d.classificacao.trim() || null,
    transf_margem: decimalDeTexto(d.transfMargem) ?? null,
    tipo_venda: d.tipoVenda || null,
    repassador: d.repassador.trim() || null
  }
}
