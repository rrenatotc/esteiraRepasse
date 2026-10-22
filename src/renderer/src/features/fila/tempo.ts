import { useEffect, useState } from 'react'
import { paradoDemais } from '@shared/horas-uteis'

export { tempoParado } from '@shared/fila'

export function estaParado(desde: string, agora: Date): boolean {
  return paradoDemais(new Date(desde), agora)
}

/** Relógio que atualiza a cada minuto, para os tempos parados andarem sozinhos. */
export function useAgora(): Date {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  return agora
}
