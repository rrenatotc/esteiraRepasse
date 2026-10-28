// Changelog curto mostrado no app depois de uma atualização (seção 9.1).
// Ao publicar uma versão nova, acrescente a entrada no topo.

export interface Novidade {
  versao: string
  data: string
  itens: string[]
}

export const NOVIDADES: Novidade[] = [
  {
    versao: '1.1.0',
    data: '2026-10-28',
    itens: [
      'Nova aba Planilha: as vendas do mês entram sozinhas na planilha, com as mesmas colunas e totais.',
      'Ao registrar a venda, preencha FIPE, valor de compra, classificação, tipo de venda e repassador.',
      'Na Planilha dá para editar ou excluir as suas vendas e exportar o arquivo do mês para o Excel.'
    ]
  },
  {
    versao: '1.0.1',
    data: '2026-10-22',
    itens: ['Vendedores agora também veem o Painel, o Estoque e as Lojas (só para consulta).']
  },
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
