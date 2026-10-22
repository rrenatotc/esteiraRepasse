// Edge Function consulta-publica (RF01, RN10): sem login. Valida a placa,
// aplica o rate limit (20/min por instalação, 200/min por IP) e devolve só os
// campos públicos. GET ?placa=ABC1D23, cabeçalho opcional x-install-id.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { placaParaMercosul } from '../_shared/placa.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-install-id',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
}

function responder(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  })
}

const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, SERVICE_ROLE, { auth: { persistSession: false } })

/** Hash com sal secreto (a própria chave do servidor): IP puro nunca é gravado. */
async function hash(...partes: string[]): Promise<string> {
  const dados = new TextEncoder().encode([SERVICE_ROLE, ...partes].join('|'))
  const digest = await crypto.subtle.digest('SHA-256', dados)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'GET') return responder(405, { erro: 'Use GET.' })

  const placa = placaParaMercosul(new URL(req.url).searchParams.get('placa') ?? '')
  if (!placa) return responder(400, { erro: 'Placa inválida. Use o padrão ABC1234 ou ABC1D23.' })

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconhecido'
  const instalacao = /^[0-9a-f-]{36}$/i.test(req.headers.get('x-install-id') ?? '') ? req.headers.get('x-install-id')! : ''
  const [chaveHash, ipHash] = await Promise.all([hash(ip, instalacao), hash(ip)])

  const { data, error } = await supabase.rpc('consulta_publica', { p_chave_hash: chaveHash, p_ip_hash: ipHash, p_placa: placa })
  if (error || !data) return responder(500, { erro: 'Não foi possível consultar agora.' })
  const { permitido, resultado } = data as { permitido: boolean; resultado: unknown }
  if (!permitido) return responder(429, { erro: 'Muitas consultas seguidas. Aguarde um minuto.' })
  if (!resultado) return responder(404, { erro: 'Nenhuma venda encontrada.' })
  return responder(200, resultado)
})
