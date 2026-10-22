import { FunctionsHttpError } from '@supabase/supabase-js'
import { normalizarDocumento } from '@shared/documento'
import { placaParaMercosul } from '@shared/placa'
import type { Demanda, Loja, Tabela, TipoDocumento } from '@shared/tipos'
import { supabase } from '@renderer/lib/supabase'

export type Veiculo = Tabela<'veiculos'>
export type Lojista = Tabela<'lojistas'>

export interface VendaAberta {
  codigo: string
  status_rotulo: string
}

export interface ResultadoPlaca {
  aberta: VendaAberta | null
  veiculo: Veiculo | null
  estoqueAtualizadoEm: string | null
}

export async function buscarPlaca(placa: string): Promise<ResultadoPlaca> {
  const busca = placaParaMercosul(placa)
  if (!busca) throw new Error('Placa inválida. Use o padrão ABC1234 ou ABC1D23.')
  const [aberta, veiculo, atualizado] = await Promise.all([
    supabase.rpc('verificar_placa_aberta', { p_placa: placa }),
    supabase.from('veiculos').select('*').eq('placa_busca', busca).maybeSingle(),
    supabase.rpc('estoque_atualizado_em')
  ])
  if (aberta.error) throw aberta.error
  if (veiculo.error) throw veiculo.error
  return {
    aberta: aberta.data[0] ?? null,
    veiculo: veiculo.data,
    estoqueAtualizadoEm: atualizado.data ?? null
  }
}

export async function buscarLojista(documento: string): Promise<Lojista | null> {
  const { data, error } = await supabase
    .from('lojistas')
    .select('*')
    .eq('documento', normalizarDocumento(documento))
    .maybeSingle()
  if (error) throw error
  return data
}

export type LojistaNovo = {
  tipo: TipoDocumento
  documento: string
  razao_social: string
  nome_fantasia: string | null
  telefone: string | null
  email: string | null
  cidade: string | null
  uf: string | null
  situacao_cadastral: string | null
  origem: 'brasilapi' | 'opencnpj' | 'manual'
}

export type RespostaCnpj = { ok: true; dados: Omit<LojistaNovo, 'tipo'> } | { ok: false; mensagem: string }

export async function consultarCnpj(cnpj: string): Promise<RespostaCnpj> {
  const { data, error } = await supabase.functions.invoke<Omit<LojistaNovo, 'tipo'>>(
    `consultar-cnpj?cnpj=${encodeURIComponent(normalizarDocumento(cnpj))}`,
    { method: 'GET' }
  )
  if (!error && data) return { ok: true, dados: data }
  if (error instanceof FunctionsHttpError) {
    const corpo = (await error.context.json().catch(() => null)) as { erro?: string } | null
    if (corpo?.erro) return { ok: false, mensagem: corpo.erro }
  }
  return { ok: false, mensagem: 'Não foi possível consultar o CNPJ agora. Preencha os dados à mão.' }
}

export async function listarLojas(): Promise<Loja[]> {
  const { data, error } = await supabase.from('lojas').select('*').eq('ativa', true).order('codigo')
  if (error) throw error
  return data
}

export type VeiculoManual = {
  marca: string
  modelo: string
  ano_fabricacao: number | null
  ano_modelo: number | null
  cor: string | null
}

export interface NovaVenda {
  placa: string
  lojaPropostaId: number
  /** string decimal, ex.: "68500.00" */
  valor: string
  observacao: string
  veiculoManual: VeiculoManual | null
  lojistaId: string | null
  lojistaNovo: LojistaNovo | null
}

export async function registrarVenda(v: NovaVenda): Promise<Demanda> {
  const { data, error } = await supabase.rpc('registrar_venda', {
    p_placa: v.placa,
    p_loja_proposta_id: v.lojaPropostaId,
    // RN04: vai como string decimal ("68500.00"); o PostgREST converte direto
    // para numeric, sem passar por float. O tipo gerado diz number.
    p_valor_venda: v.valor as unknown as number,
    p_observacao: v.observacao || undefined,
    p_veiculo_manual: v.veiculoManual ?? undefined,
    p_lojista_id: v.lojistaId ?? undefined,
    p_lojista_novo: v.lojistaNovo ?? undefined
  })
  if (error) throw error
  return data
}
