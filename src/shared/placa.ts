// Placa: normalização e conversão para Mercosul (RN01).
// Mantenha em sincronia com normalizar_placa()/placa_para_mercosul() em
// supabase/migrations/*_funcoes_base.sql.

const RE_ANTIGA = /^[A-Z]{3}[0-9]{4}$/
const RE_MERCOSUL = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/
const LETRAS_MERCOSUL = 'ABCDEFGHIJ'

export type FormatoPlaca = 'antiga' | 'mercosul'

/** Maiúsculas, sem traço, ponto ou espaço. Não valida o formato. */
export function normalizarPlaca(entrada: string): string {
  return entrada.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function formatoPlaca(entrada: string): FormatoPlaca | null {
  const placa = normalizarPlaca(entrada)
  if (RE_ANTIGA.test(placa)) return 'antiga'
  if (RE_MERCOSUL.test(placa)) return 'mercosul'
  return null
}

export function placaValida(entrada: string): boolean {
  return formatoPlaca(entrada) !== null
}

/**
 * Chave de busca: placa no formato Mercosul. A antiga vira Mercosul trocando
 * o 5º caractere (dígito 0–9) pela letra A–J. Retorna null se inválida.
 */
export function placaParaMercosul(entrada: string): string | null {
  const placa = normalizarPlaca(entrada)
  const formato = formatoPlaca(placa)
  if (formato === null) return null
  if (formato === 'mercosul') return placa
  const digito = Number(placa[4])
  return placa.slice(0, 4) + LETRAS_MERCOSUL[digito] + placa.slice(5)
}
