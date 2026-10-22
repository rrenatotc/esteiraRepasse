import { subDays } from 'date-fns'
import type { Json } from '@shared/database.types'
import type { Demanda, StatusDemanda, Tabela } from '@shared/tipos'
import { supabase } from '@renderer/lib/supabase'

export const SELECT_FILA = `
  *,
  lojista:lojistas(razao_social, nome_fantasia, documento, tipo),
  loja:lojas(codigo, nome),
  vendedor:perfis!demandas_vendedor_id_fkey(nome),
  responsavel:perfis!demandas_responsavel_id_fkey(nome)
`

export type DemandaFila = Demanda & {
  lojista: Pick<Tabela<'lojistas'>, 'razao_social' | 'nome_fantasia' | 'documento' | 'tipo'> | null
  loja: Pick<Tabela<'lojas'>, 'codigo' | 'nome'> | null
  vendedor: { nome: string } | null
  responsavel: { nome: string } | null
}

export interface Snapshot {
  marca?: string
  modelo?: string
  ano_fabricacao?: number | null
  ano_modelo?: number | null
  cor?: string | null
  km?: number | null
  origem?: string
}

export const snapshot = (d: Demanda): Snapshot => (d.veiculo_snapshot ?? {}) as Snapshot

export type FiltroStatus = 'abertas' | 'todas' | StatusDemanda
export type Periodo = '7' | '30' | '90' | 'tudo'

export interface Filtros {
  status: FiltroStatus
  lojaId: number | null
  vendedorId: string | null
  periodo: Periodo
}

export const FILTROS_PADRAO: Filtros = { status: 'abertas', lojaId: null, vendedorId: null, periodo: 'tudo' }

export async function listarFila(f: Filtros): Promise<DemandaFila[]> {
  let q = supabase.from('demandas').select(SELECT_FILA).order('status_desde', { ascending: true }).limit(1000)
  if (f.status === 'abertas') q = q.not('status', 'in', '(concluida,cancelada)')
  else if (f.status !== 'todas') q = q.eq('status', f.status)
  if (f.lojaId) q = q.eq('loja_proposta_id', f.lojaId)
  if (f.vendedorId) q = q.eq('vendedor_id', f.vendedorId)
  if (f.periodo !== 'tudo') q = q.gte('created_at', subDays(new Date(), Number(f.periodo)).toISOString())
  const { data, error } = await q
  if (error) throw error
  return data as unknown as DemandaFila[]
}

export type Evento = Tabela<'demanda_eventos'> & { autor: { nome: string } | null }

export async function listarEventos(demandaId: string): Promise<Evento[]> {
  const { data, error } = await supabase
    .from('demanda_eventos')
    .select('*, autor:perfis(nome)')
    .eq('demanda_id', demandaId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as Evento[]
}

export async function listarVendedores(): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await supabase.from('perfis').select('id, nome').in('papel', ['vendedor', 'repasse']).order('nome')
  if (error) throw error
  return data
}

export async function avancarStatus(
  demanda: string,
  para: StatusDemanda,
  dados: Record<string, string> = {},
  comentario?: string
): Promise<Demanda> {
  const { data, error } = await supabase.rpc('avancar_status', {
    p_demanda: demanda,
    p_para: para,
    p_dados: dados as Json,
    p_comentario: comentario
  })
  if (error) throw error
  return data
}

export async function contarNovas(): Promise<number> {
  const { count, error } = await supabase.from('demandas').select('id', { count: 'exact', head: true }).eq('status', 'nova')
  if (error) throw error
  return count ?? 0
}

/** Demandas registradas no período (datas locais, inclusive), para exportação do painel. */
export async function listarPeriodo(inicio: Date, fim: Date): Promise<DemandaFila[]> {
  const ate = new Date(fim)
  ate.setDate(ate.getDate() + 1)
  const { data, error } = await supabase
    .from('demandas')
    .select(SELECT_FILA)
    .gte('created_at', inicio.toISOString())
    .lt('created_at', ate.toISOString())
    .order('created_at')
    .limit(5000)
  if (error) throw error
  return data as unknown as DemandaFila[]
}
