// Cópia da validação de CNPJ de src/shared/documento.ts para as Edge
// Functions (Deno não enxerga src/). Um teste garante que as duas batem.

export function normalizarCnpj(entrada: string): string {
  return entrada.toUpperCase().replace(/[^0-9A-Z]/g, '')
}

const PESOS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

function dv(valores: number[]): number {
  const pesos = PESOS.slice(PESOS.length - valores.length)
  const soma = valores.reduce((acc, v, i) => acc + v * pesos[i], 0)
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

export function cnpjValido(entrada: string): boolean {
  const cnpj = normalizarCnpj(entrada)
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) return false
  const valores = [...cnpj].map((c) => c.charCodeAt(0) - 48)
  const dv1 = dv(valores.slice(0, 12))
  const dv2 = dv([...valores.slice(0, 12), dv1])
  return dv1 === valores[12] && dv2 === valores[13]
}
