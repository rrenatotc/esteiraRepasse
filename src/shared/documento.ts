// CPF e CNPJ (RN03), incluindo o CNPJ alfanumérico da Receita:
// 12 caracteres [0-9A-Z] + 2 DVs numéricos; cada caractere vale ASCII − 48.
// Mantenha em sincronia com validar_cpf()/validar_cnpj() no banco.

export type TipoDocumento = 'cpf' | 'cnpj'

/** Maiúsculas, sem pontuação nem espaço. */
export function normalizarDocumento(entrada: string): string {
  return entrada.toUpperCase().replace(/[^0-9A-Z]/g, '')
}

export function cpfValido(entrada: string): boolean {
  const cpf = normalizarDocumento(entrada)
  if (!/^[0-9]{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false
  const digitos = [...cpf].map(Number)
  for (const tamanho of [9, 10]) {
    let soma = 0
    for (let i = 0; i < tamanho; i++) soma += digitos[i] * (tamanho + 1 - i)
    const resto = (soma * 10) % 11
    if ((resto === 10 ? 0 : resto) !== digitos[tamanho]) return false
  }
  return true
}

const PESOS_CNPJ = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

function dvCnpj(valores: number[]): number {
  const pesos = PESOS_CNPJ.slice(PESOS_CNPJ.length - valores.length)
  const soma = valores.reduce((acc, v, i) => acc + v * pesos[i], 0)
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

export function cnpjValido(entrada: string): boolean {
  const cnpj = normalizarDocumento(entrada)
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) return false
  const valores = [...cnpj].map((c) => c.charCodeAt(0) - 48)
  const dv1 = dvCnpj(valores.slice(0, 12))
  const dv2 = dvCnpj([...valores.slice(0, 12), dv1])
  return dv1 === valores[12] && dv2 === valores[13]
}

/** Deduz o tipo pelo tamanho; não valida os dígitos. */
export function tipoDocumento(entrada: string): TipoDocumento | null {
  const doc = normalizarDocumento(entrada)
  if (/^[0-9]{11}$/.test(doc)) return 'cpf'
  if (/^[0-9A-Z]{14}$/.test(doc)) return 'cnpj'
  return null
}

export function documentoValido(entrada: string): boolean {
  const tipo = tipoDocumento(entrada)
  if (tipo === 'cpf') return cpfValido(entrada)
  if (tipo === 'cnpj') return cnpjValido(entrada)
  return false
}

export function formatarDocumento(entrada: string): string {
  const doc = normalizarDocumento(entrada)
  const tipo = tipoDocumento(doc)
  if (tipo === 'cpf') return doc.replace(/^(.{3})(.{3})(.{3})(.{2})$/, '$1.$2.$3-$4')
  if (tipo === 'cnpj') return doc.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5')
  return entrada
}
