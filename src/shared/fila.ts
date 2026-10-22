// Regras puras da fila do repasse (ordenação, busca, tempo parado).
import { normalizarDocumento } from './documento'
import { normalizarPlaca, placaParaMercosul } from './placa'
import type { StatusDemanda } from './tipos'

/** Ordem dos grupos na fila: o que precisa de ação primeiro. */
export const ORDEM_STATUS: StatusDemanda[] = [
  'nova',
  'em_proposta',
  'proposta_emitida',
  'faturada',
  'pendente',
  'concluida',
  'cancelada'
]

/** "há 12 min", "há 3 h", "há 2 d". */
export function tempoParado(desde: string, agora: Date): string {
  const min = Math.max(0, Math.floor((agora.getTime() - new Date(desde).getTime()) / 60_000))
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  return `há ${Math.floor(h / 24)} d`
}

interface Buscavel {
  codigo: number
  placa: string
  placa_busca: string
  lojista: { documento: string; razao_social: string } | null
}

/**
 * Busca por placa (qualquer formato), documento (com ou sem máscara),
 * código ("REP-000412", "412") ou parte da razão social.
 */
export function filtrarDemandas<T extends Buscavel>(lista: T[], termo: string): T[] {
  const t = termo.trim()
  if (!t) return lista
  const codigo = /^(rep-?)?0*(\d+)$/i.exec(t)?.[2]
  const placa = placaParaMercosul(t)
  const parcialPlaca = normalizarPlaca(t)
  const doc = normalizarDocumento(t)
  const texto = t.toLowerCase()
  return lista.filter(
    (d) =>
      (codigo !== undefined && String(d.codigo) === codigo) ||
      (placa !== null && d.placa_busca === placa) ||
      (parcialPlaca.length >= 3 && d.placa.includes(parcialPlaca)) ||
      (doc.length >= 4 && !!d.lojista?.documento.includes(doc)) ||
      (texto.length >= 3 && !!d.lojista?.razao_social.toLowerCase().includes(texto))
  )
}
