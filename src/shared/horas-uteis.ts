// Horas úteis: segunda a sábado, 08h–18h, America/Sao_Paulo (RN11, RF13).
// Desde 2019 o Brasil não tem horário de verão, então o fuso é UTC−3 fixo.
// Mantenha em sincronia com horas_uteis_entre() no banco.

const OFFSET_MS = -3 * 3600_000
const HORA_MS = 3600_000
const DIA_MS = 24 * HORA_MS
const INICIO_EXPEDIENTE = 8
const FIM_EXPEDIENTE = 18

export const LIMITE_PARADO_HORAS = 24

export function horasUteisEntre(inicio: Date, fim: Date): number {
  const a = inicio.getTime() + OFFSET_MS
  const b = fim.getTime() + OFFSET_MS
  if (!(b > a)) return 0
  let total = 0
  for (let dia = Math.floor(a / DIA_MS) * DIA_MS; dia < b; dia += DIA_MS) {
    if (new Date(dia).getUTCDay() === 0) continue // domingo
    const abre = dia + INICIO_EXPEDIENTE * HORA_MS
    const fecha = dia + FIM_EXPEDIENTE * HORA_MS
    total += Math.max(0, Math.min(fecha, b) - Math.max(abre, a))
  }
  return total / HORA_MS
}

export function paradoDemais(desde: Date, agora: Date = new Date()): boolean {
  return horasUteisEntre(desde, agora) > LIMITE_PARADO_HORAS
}
