import { describe, expect, it } from 'vitest'
import {
  cnpjValido,
  cpfValido,
  documentoValido,
  formatarDocumento,
  normalizarDocumento,
  tipoDocumento
} from './documento'

describe('CPF', () => {
  it('aceita CPF válido com ou sem máscara', () => {
    expect(cpfValido('529.982.247-25')).toBe(true)
    expect(cpfValido('52998224725')).toBe(true)
  })

  it('rejeita DV errado, repetidos e tamanho errado', () => {
    expect(cpfValido('529.982.247-24')).toBe(false)
    expect(cpfValido('111.111.111-11')).toBe(false)
    expect(cpfValido('5299822472')).toBe(false)
  })
})

describe('CNPJ numérico', () => {
  it('aceita válido', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true)
  })

  it('rejeita DV errado e repetidos', () => {
    expect(cnpjValido('11.222.333/0001-82')).toBe(false)
    expect(cnpjValido('00.000.000/0000-00')).toBe(false)
  })
})

describe('CNPJ alfanumérico', () => {
  it('aceita o exemplo da Receita', () => {
    expect(cnpjValido('12.ABC.345/01DE-35')).toBe(true)
    expect(cnpjValido('12abc34501de35')).toBe(true)
  })

  it('rejeita DV errado e DV com letra', () => {
    expect(cnpjValido('12.ABC.345/01DE-36')).toBe(false)
    expect(cnpjValido('12ABC34501DE3A')).toBe(false)
  })
})

describe('tipo, normalização e máscara', () => {
  it('deduz o tipo pelo tamanho', () => {
    expect(tipoDocumento('529.982.247-25')).toBe('cpf')
    expect(tipoDocumento('12.ABC.345/01DE-35')).toBe('cnpj')
    expect(tipoDocumento('123')).toBeNull()
  })

  it('normaliza e formata', () => {
    expect(normalizarDocumento('12.abc.345/01de-35')).toBe('12ABC34501DE35')
    expect(formatarDocumento('52998224725')).toBe('529.982.247-25')
    expect(formatarDocumento('12ABC34501DE35')).toBe('12.ABC.345/01DE-35')
  })

  it('documentoValido despacha pelo tipo', () => {
    expect(documentoValido('529.982.247-25')).toBe(true)
    expect(documentoValido('11.222.333/0001-81')).toBe(true)
    expect(documentoValido('abc')).toBe(false)
  })
})
