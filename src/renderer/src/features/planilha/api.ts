import type { LinhaPlanilha } from '@shared/planilha'
import type { Tabela } from '@shared/tipos'
import { supabase } from '@renderer/lib/supabase'

export type LinhaVenda = Tabela<'planilha_vendas'>

/** "2026-10" → primeiro dia do mês e do mês seguinte. */
function limitesMes(mes: string): [string, string] {
  const [a, m] = mes.split('-').map(Number)
  const prox = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`
  return [`${mes}-01`, `${prox}-01`]
}

/** Vendas do mês (todas as lojas e vendedores), sem as excluídas. */
export async function listarPlanilha(mes: string): Promise<LinhaVenda[]> {
  const [ini, fim] = limitesMes(mes)
  const { data, error } = await supabase
    .from('planilha_vendas')
    .select('*')
    .is('excluida_em', null)
    .gte('data_venda', ini)
    .lt('data_venda', fim)
    .order('data_venda')
    .order('created_at')
    .limit(5000)
  if (error) throw error
  return data
}

/** Anunciantes já usados, para sugerir no campo. */
export async function listarAnunciantes(): Promise<string[]> {
  const { data, error } = await supabase
    .from('planilha_vendas')
    .select('anunciante')
    .not('anunciante', 'is', null)
    .limit(5000)
  if (error) throw error
  return [...new Set(data.map((l) => l.anunciante!))].sort()
}

export async function editarLinha(
  demanda: string,
  dados: Record<string, string | number | null>
): Promise<LinhaVenda> {
  const { data, error } = await supabase.rpc('editar_linha_planilha', {
    p_demanda: demanda,
    p_dados: dados
  })
  if (error) throw error
  return data
}

export async function excluirLinha(demanda: string, motivo: string): Promise<LinhaVenda> {
  const { data, error } = await supabase.rpc('excluir_linha_planilha', {
    p_demanda: demanda,
    p_motivo: motivo
  })
  if (error) throw error
  return data
}

const num = (v: number | string | null): number | null => (v === null ? null : Number(v))

/** Linha do banco no formato do gerador de .xlsx. */
export function paraExportar(l: LinhaVenda): LinhaPlanilha {
  return {
    anunciante: l.anunciante,
    placa: l.placa,
    veiculo: l.veiculo,
    ano: l.ano,
    fipe: num(l.fipe),
    valor_compra: num(l.valor_compra),
    valor_vendido: num(l.valor_vendido),
    dias_estoque: l.dias_estoque,
    classificacao: l.classificacao,
    transf_margem: num(l.transf_margem),
    tipo_venda: l.tipo_venda,
    lojista: l.lojista,
    data_venda: l.data_venda,
    faturado: l.faturado,
    repassador: l.repassador
  }
}
