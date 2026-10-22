// Edge Function consultar-cnpj (seção 6.2): valida o DV, consulta a
// BrasilAPI e, se falhar, a OpenCNPJ. Timeout de 5 s por fonte.
// Exige usuário logado e ativo. GET ?cnpj=12345678000190
import { createClient } from 'npm:@supabase/supabase-js@2'
import { cnpjValido, normalizarCnpj } from '../_shared/cnpj.ts'
import { deBrasilApi, deOpenCnpj, type DadosCnpj } from './mapear.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
}

function responder(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } })
}

async function buscar(url: string): Promise<{ status: number; json: Record<string, unknown> | null }> {
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) })
    const json = r.ok ? ((await r.json()) as Record<string, unknown>) : null
    return { status: r.status, json }
  } catch {
    return { status: 0, json: null } // timeout ou rede
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'GET') return responder(405, { erro: 'Use GET.' })

  const cnpj = normalizarCnpj(new URL(req.url).searchParams.get('cnpj') ?? '')
  if (!cnpjValido(cnpj)) return responder(400, { erro: 'CNPJ inválido. Confira os dígitos.' })

  // Usuário logado e ativo (papel_atual() é null para inativo).
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
  })
  const { data: papel } = await supabase.rpc('papel_atual')
  if (!papel) return responder(401, { erro: 'Sessão expirada ou usuário inativo. Entre novamente.' })

  let dados: DadosCnpj | null = null
  let algumaRespondeu = false

  const brasil = await buscar(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
  if (brasil.status > 0 && brasil.status < 500) algumaRespondeu = true
  if (brasil.json) dados = deBrasilApi(cnpj, brasil.json)

  if (!dados) {
    const open = await buscar(`https://api.opencnpj.org/${cnpj}`)
    if (open.status > 0 && open.status < 500) algumaRespondeu = true
    if (open.json) dados = deOpenCnpj(cnpj, open.json)
  }

  if (dados) return responder(200, dados)
  const alfanumerico = /[A-Z]/.test(cnpj)
  return algumaRespondeu
    ? responder(404, {
        erro: alfanumerico
          ? 'As bases públicas ainda não reconhecem este CNPJ alfanumérico. Preencha os dados à mão.'
          : 'CNPJ não encontrado nas bases públicas. Preencha os dados à mão.'
      })
    : responder(502, { erro: 'As bases de CNPJ não responderam. Preencha os dados à mão ou tente de novo.' })
})
