// Tipos da leitura da planilha do Bravos, trocados entre main e renderer.

/** Veículo pronto para a RPC sincronizar_estoque. */
export interface ItemEstoque {
  placa: string
  marca: string
  modelo: string
  codigo_bravos: string | null
  dias_em_estoque: number | null
  ano_fabricacao: number | null
  ano_modelo: number | null
  cor: string | null
  km: number | null
  filial_estoque: string | null
  /** Linha original, só com colunas não financeiras (auditoria). */
  dados_bravos: Record<string, string | number | null>
}

export interface ErroLinha {
  linha: number
  motivo: string
}

export interface LeituraEstoque {
  arquivo: string
  caminho: string
  /** ISO 8601 */
  modificadoEm: string
  cabecalhos: string[]
  colunasFaltando: string[]
  itens: ItemEstoque[]
  erros: ErroLinha[]
  avisos: string[]
  ignoradas: {
    semPlaca: number
    /** Situação → quantidade, para linhas fora das situações de repasse. */
    outrasSituacoes: Record<string, number>
  }
  /** Linhas de dados (sem cabeçalho nem linha de total). */
  totalLinhas: number
}

export type ResultadoLeitura = { ok: true; leitura: LeituraEstoque } | { ok: false; erro: string }

export interface StatusObservacao {
  pasta: string | null
  observando: boolean
}
