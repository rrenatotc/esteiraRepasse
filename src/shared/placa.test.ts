import { describe, expect, it } from 'vitest'
import { formatoPlaca, normalizarPlaca, placaParaMercosul, placaValida } from './placa'

describe('normalizarPlaca', () => {
  it('remove traço, espaço e põe em maiúsculas', () => {
    expect(normalizarPlaca(' abc-1234 ')).toBe('ABC1234')
    expect(normalizarPlaca('abc 1d23')).toBe('ABC1D23')
  })
})

describe('formatoPlaca', () => {
  it('reconhece padrão antigo e Mercosul', () => {
    expect(formatoPlaca('ABC-1234')).toBe('antiga')
    expect(formatoPlaca('abc1d23')).toBe('mercosul')
  })

  it('rejeita lixo', () => {
    for (const lixo of ['', 'AB1234', 'ABCD123', 'ABC12345', '1BC1234', 'ABC1DD3', 'ÁBC1234']) {
      expect(formatoPlaca(lixo)).toBeNull()
      expect(placaValida(lixo)).toBe(false)
    }
  })
})

describe('placaParaMercosul', () => {
  it('converte o 5º dígito para A–J', () => {
    expect(placaParaMercosul('ABC1034')).toBe('ABC1A34')
    expect(placaParaMercosul('ABC1234')).toBe('ABC1C34')
    expect(placaParaMercosul('abc-1934')).toBe('ABC1J34')
  })

  it('mantém Mercosul como está', () => {
    expect(placaParaMercosul('ABC1D23')).toBe('ABC1D23')
  })

  it('antiga e Mercosul equivalentes caem na mesma chave', () => {
    expect(placaParaMercosul('QRS-2345')).toBe(placaParaMercosul('QRS2D45'))
  })

  it('retorna null para placa inválida', () => {
    expect(placaParaMercosul('XYZ')).toBeNull()
  })
})
