// Valores em BRL (RN04). Internamente o app trabalha com centavos inteiros;
// o banco recebe a string decimal ("68500.00") para numeric(12,2), sem float.

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Maior valor aceito por numeric(12,2), em centavos. */
export const CENTAVOS_MAXIMO = 999_999_999_999

/**
 * Converte o que o usuário digitou ("68.500,00", "68500", "R$ 1.234,5") em
 * centavos. Retorna null se não for um valor monetário válido.
 */
export function centavosDeTexto(texto: string): number | null {
  const limpo = texto.replace(/R\$|\s/g, '')
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(limpo)) return null
  const [inteiro, fracao = ''] = limpo.replace(/\./g, '').split(',')
  const centavos = Number(inteiro) * 100 + Number(fracao.padEnd(2, '0'))
  return Number.isSafeInteger(centavos) && centavos <= CENTAVOS_MAXIMO ? centavos : null
}

/** Valor vindo do banco (string ou number do PostgREST) para centavos. */
export function centavosDeDecimal(valor: string | number): number {
  const texto = typeof valor === 'number' ? valor.toFixed(2) : valor.trim()
  const match = /^(-?)(\d+)(?:\.(\d{1,2})\d*)?$/.exec(texto)
  if (!match) throw new Error(`Valor decimal inválido: ${texto}`)
  const [, sinal, inteiro, fracao = ''] = match
  const centavos = Number(inteiro) * 100 + Number(fracao.padEnd(2, '0'))
  return sinal ? -centavos : centavos
}

/** Centavos para a string decimal que o banco espera. */
export function decimalDeCentavos(centavos: number): string {
  const sinal = centavos < 0 ? '-' : ''
  const abs = Math.abs(centavos)
  return `${sinal}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

export function formatarBRL(valor: string | number): string {
  return BRL.format(centavosDeDecimal(valor) / 100)
}

export function formatarCentavos(centavos: number): string {
  return BRL.format(centavos / 100)
}
