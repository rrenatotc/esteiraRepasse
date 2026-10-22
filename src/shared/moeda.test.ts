import { describe, expect, it } from 'vitest'
import {
  centavosDeDecimal,
  centavosDeTexto,
  decimalDeCentavos,
  formatarBRL,
  formatarCentavos
} from './moeda'

// Intl usa espaço não separável entre "R$" e o número.
const semNbsp = (s: string): string => s.replace(/ /g, ' ')

describe('centavosDeTexto', () => {
  it('aceita formatos digitados', () => {
    expect(centavosDeTexto('68.500,00')).toBe(6_850_000)
    expect(centavosDeTexto('68500')).toBe(6_850_000)
    expect(centavosDeTexto('R$ 1.234,5')).toBe(123_450)
    expect(centavosDeTexto('0,99')).toBe(99)
  })

  it('rejeita lixo e valores acima de numeric(12,2)', () => {
    expect(centavosDeTexto('')).toBeNull()
    expect(centavosDeTexto('12,345')).toBeNull()
    expect(centavosDeTexto('1.23,00')).toBeNull()
    expect(centavosDeTexto('abc')).toBeNull()
    expect(centavosDeTexto('10000000000,00')).toBeNull()
  })
})

describe('decimal <-> centavos', () => {
  it('não perde precisão', () => {
    expect(decimalDeCentavos(6_850_000)).toBe('68500.00')
    expect(decimalDeCentavos(5)).toBe('0.05')
    expect(centavosDeDecimal('68500.00')).toBe(6_850_000)
    expect(centavosDeDecimal(0.1 + 0.2)).toBe(30)
    expect(centavosDeDecimal('12.5')).toBe(1250)
  })
})

describe('formatação BRL', () => {
  it('formata em pt-BR', () => {
    expect(semNbsp(formatarBRL('68500.00'))).toBe('R$ 68.500,00')
    expect(semNbsp(formatarCentavos(123_450))).toBe('R$ 1.234,50')
  })
})
