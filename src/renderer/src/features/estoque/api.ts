import type { Json } from '@shared/database.types'
import type { ItemEstoque, LeituraEstoque } from '@shared/estoque'
import type { Tabela } from '@shared/tipos'
import { supabase } from '@renderer/lib/supabase'

export interface PreviaEstoque {
  total: number
  em_estoque_atual: number
  novos: number
  atualizados: number
  mantidos: number
  mesclados: number
  voltaram: number
  sairam: number
  placas_novas: { placa: string; modelo: string }[]
  placas_sairam: { placa: string; modelo: string }[]
  bloqueado: boolean
  motivo_bloqueio: string | null
}

export type ResultadoSincronizacao = PreviaEstoque & { importacao_id: number; forcado: boolean }

export type Importacao = Tabela<'importacoes_estoque'> & { autor: { nome: string } | null }

const comoJson = (itens: ItemEstoque[]): Json => itens as unknown as Json

export async function previaEstoque(itens: ItemEstoque[]): Promise<PreviaEstoque> {
  const { data, error } = await supabase.rpc('previa_estoque', { p_itens: comoJson(itens) })
  if (error) throw error
  return data as unknown as PreviaEstoque
}

export async function sincronizarEstoque(leitura: LeituraEstoque, forcar: boolean): Promise<ResultadoSincronizacao> {
  const { data, error } = await supabase.rpc('sincronizar_estoque', {
    p_arquivo: leitura.arquivo,
    p_arquivo_modificado_em: leitura.modificadoEm,
    p_itens: comoJson(leitura.itens),
    p_forcar: forcar,
    p_erros: leitura.erros.length,
    p_total_linhas: leitura.totalLinhas
  })
  if (error) throw error
  return data as unknown as ResultadoSincronizacao
}

export async function ultimaImportacao(): Promise<Importacao | null> {
  const { data, error } = await supabase
    .from('importacoes_estoque')
    .select('*, autor:perfis(nome)')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function historicoImportacoes(): Promise<Importacao[]> {
  const { data, error } = await supabase
    .from('importacoes_estoque')
    .select('*, autor:perfis(nome)')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data
}

export type FiltroVeiculos = 'em_estoque' | 'fora' | 'manuais' | 'todos'

export async function listarVeiculos(filtro: FiltroVeiculos, busca: string): Promise<Tabela<'veiculos'>[]> {
  let q = supabase.from('veiculos').select('*').order('placa').limit(1000)
  if (filtro === 'em_estoque') q = q.eq('em_estoque', true)
  if (filtro === 'fora') q = q.eq('em_estoque', false).eq('origem', 'bravos')
  if (filtro === 'manuais') q = q.eq('origem', 'manual')
  const termo = busca.trim().replace(/[%,()]/g, '')
  if (termo) q = q.or(`placa.ilike.%${termo.replace(/[^A-Za-z0-9]/g, '')}%,modelo.ilike.%${termo}%,marca.ilike.%${termo}%`)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function lojasPorCodigo(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('lojas').select('codigo, nome')
  if (error) throw error
  return new Map(data.map((l) => [l.codigo, l.nome]))
}

/** Já foi aplicada? Mesmo arquivo e mesma data de modificação da última importação. */
export function leituraJaAplicada(leitura: LeituraEstoque, ultima: Importacao | null): boolean {
  return (
    !!ultima &&
    ultima.arquivo === leitura.arquivo &&
    !!ultima.arquivo_modificado_em &&
    new Date(ultima.arquivo_modificado_em).getTime() === new Date(leitura.modificadoEm).getTime()
  )
}

export function leituraMaisAntiga(leitura: LeituraEstoque, ultima: Importacao | null): boolean {
  return (
    !!ultima?.arquivo_modificado_em &&
    new Date(leitura.modificadoEm).getTime() < new Date(ultima.arquivo_modificado_em).getTime()
  )
}
