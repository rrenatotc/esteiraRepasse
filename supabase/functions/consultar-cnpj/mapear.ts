// Converte as respostas da BrasilAPI e da OpenCNPJ para o formato do
// cadastro de lojistas. Puro, para ser testado no Vitest.

export interface DadosCnpj {
  documento: string
  razao_social: string
  nome_fantasia: string | null
  telefone: string | null
  email: string | null
  cidade: string | null
  uf: string | null
  situacao_cadastral: string | null
  origem: 'brasilapi' | 'opencnpj'
}

type Bruto = Record<string, unknown>

const texto = (v: unknown): string | null => {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const t = String(v).replace(/\s+/g, ' ').trim()
  return t === '' ? null : t
}

function telefone(ddd: unknown, numero: unknown): string | null {
  const n = texto(numero)?.replace(/\D/g, '')
  if (!n) return null
  const d = texto(ddd)?.replace(/\D/g, '') ?? ''
  return d ? `(${d}) ${n}` : n
}

export function deBrasilApi(documento: string, j: Bruto): DadosCnpj | null {
  const razao = texto(j.razao_social)
  if (!razao) return null
  const tel = texto(j.ddd_telefone_1)?.replace(/\D/g, '') ?? ''
  return {
    documento,
    razao_social: razao,
    nome_fantasia: texto(j.nome_fantasia),
    telefone: tel.length >= 10 ? `(${tel.slice(0, 2)}) ${tel.slice(2)}` : tel || null,
    email: texto(j.email)?.toLowerCase() ?? null,
    cidade: texto(j.municipio),
    uf: texto(j.uf)?.toUpperCase() ?? null,
    situacao_cadastral: texto(j.descricao_situacao_cadastral),
    origem: 'brasilapi'
  }
}

export function deOpenCnpj(documento: string, j: Bruto): DadosCnpj | null {
  const razao = texto(j.razao_social)
  if (!razao) return null
  const telefones = Array.isArray(j.telefones) ? (j.telefones as Bruto[]) : []
  return {
    documento,
    razao_social: razao,
    nome_fantasia: texto(j.nome_fantasia),
    telefone: telefones[0] ? telefone(telefones[0].ddd, telefones[0].numero) : null,
    email: texto(j.email)?.toLowerCase() ?? null,
    cidade: texto(j.municipio),
    uf: texto(j.uf)?.toUpperCase() ?? null,
    situacao_cadastral: texto(j.situacao_cadastral),
    origem: 'opencnpj'
  }
}
