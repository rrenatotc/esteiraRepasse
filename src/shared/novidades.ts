// Changelog curto mostrado no app depois de uma atualização (seção 9.1).
// Ao publicar uma versão nova, acrescente a entrada no topo.

export interface Novidade {
  versao: string
  data: string
  itens: string[]
}

export const NOVIDADES: Novidade[] = [
  {
    versao: '1.0.0',
    data: '2026-10-22',
    itens: [
      'Primeira versão: registro de venda, fila do repasse, estoque do Bravos, consulta por placa e painel.',
      'Atualização automática: novas versões chegam sozinhas, basta reiniciar quando o app avisar.'
    ]
  }
]

function partes(v: string): number[] {
  return v.split('.').map((n) => Number.parseInt(n, 10) || 0)
}

export function compararVersoes(a: string, b: string): number {
  const [pa, pb] = [partes(a), partes(b)]
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  return 0
}

/** Entradas posteriores a `anterior` até `atual` (inclusive), da mais nova para a mais antiga. */
export function novidadesDesde(anterior: string, atual: string, lista: Novidade[] = NOVIDADES): Novidade[] {
  return lista.filter((n) => compararVersoes(n.versao, anterior) > 0 && compararVersoes(n.versao, atual) <= 0)
}
