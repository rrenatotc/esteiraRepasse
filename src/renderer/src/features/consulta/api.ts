import type { StatusDemanda } from '@shared/tipos'
import { supabase } from '@renderer/lib/supabase'

/** Resposta enxuta da Edge Function consulta-publica (RN10). */
export interface ResultadoConsulta {
  placa: string
  marca: string
  modelo: string
  status: StatusDemanda
  loja: { codigo: string; nome: string }
  numero_proposta: string | null
  data_emissao_proposta: string | null
  numero_nf: string | null
  data_emissao_nf: string | null
  linha_do_tempo: { status: StatusDemanda; em: string }[]
}

export type RespostaConsulta =
  | { tipo: 'encontrada'; resultado: ResultadoConsulta }
  | { tipo: 'nao-encontrada' }
  | { tipo: 'limite' }
  | { tipo: 'erro'; mensagem: string }

let installId: string | null = null

export async function consultarPlaca(placa: string): Promise<RespostaConsulta> {
  installId ??= (await window.esteira.app.info()).installId
  const { data, error, response } = await supabase.functions.invoke<ResultadoConsulta>(
    `consulta-publica?placa=${encodeURIComponent(placa)}`,
    { method: 'GET', headers: { 'x-install-id': installId } }
  )
  if (!error && data) return { tipo: 'encontrada', resultado: data }
  const status = response?.status
  if (status === 404) return { tipo: 'nao-encontrada' }
  if (status === 429) return { tipo: 'limite' }
  return {
    tipo: 'erro',
    mensagem: navigator.onLine
      ? 'Não foi possível consultar agora. Tente de novo em instantes.'
      : 'Sem conexão com a internet. Verifique a rede e tente de novo.'
  }
}
