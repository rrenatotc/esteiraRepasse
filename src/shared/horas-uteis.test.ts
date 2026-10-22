import { describe, expect, it } from 'vitest'
import { horasUteisEntre, paradoDemais } from './horas-uteis'

// Datas com offset explícito de São Paulo.
const sp = (iso: string): Date => new Date(`${iso}-03:00`)

describe('horasUteisEntre', () => {
  it('conta dentro do expediente', () => {
    expect(horasUteisEntre(sp('2026-10-22T09:00:00'), sp('2026-10-22T12:00:00'))).toBe(3)
  })

  it('corta antes das 8h e depois das 18h', () => {
    expect(horasUteisEntre(sp('2026-10-22T06:00:00'), sp('2026-10-22T20:00:00'))).toBe(10)
  })

  it('conta sábado e pula domingo', () => {
    // sexta 17h → segunda 9h = 1 (sex) + 10 (sáb) + 0 (dom) + 1 (seg)
    expect(horasUteisEntre(sp('2026-10-23T17:00:00'), sp('2026-10-26T09:00:00'))).toBe(12)
  })

  it('retorna 0 para intervalo invertido', () => {
    expect(horasUteisEntre(sp('2026-10-22T12:00:00'), sp('2026-10-22T09:00:00'))).toBe(0)
  })
})

describe('paradoDemais', () => {
  it('destaca acima de 24 h úteis', () => {
    const desde = sp('2026-10-19T08:00:00') // segunda
    expect(paradoDemais(desde, sp('2026-10-21T12:00:00'))).toBe(false) // 24 h
    expect(paradoDemais(desde, sp('2026-10-21T12:30:00'))).toBe(true)
  })
})
