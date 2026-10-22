import { describe, expect, it } from 'vitest'
import { filtrarDemandas, tempoParado } from './fila'

const agora = new Date('2026-10-22T15:00:00-03:00')

describe('tempoParado', () => {
  it('min, h e d', () => {
    expect(tempoParado('2026-10-22T14:48:00-03:00', agora)).toBe('há 12 min')
    expect(tempoParado('2026-10-22T12:00:00-03:00', agora)).toBe('há 3 h')
    expect(tempoParado('2026-10-20T12:00:00-03:00', agora)).toBe('há 2 d')
    expect(tempoParado('2026-10-22T16:00:00-03:00', agora)).toBe('há 0 min')
  })
})

describe('filtrarDemandas', () => {
  const lista = [
    { codigo: 412, placa: 'ABC1234', placa_busca: 'ABC1C34', lojista: { documento: '11222333000181', razao_social: 'Auto JK Ltda' } },
    { codigo: 7, placa: 'QRS2E45', placa_busca: 'QRS2E45', lojista: { documento: '52998224725', razao_social: 'Fulano de Tal' } }
  ]
  const codigos = (t: string): number[] => filtrarDemandas(lista, t).map((d) => d.codigo)

  it('vazio devolve tudo', () => expect(codigos('  ')).toEqual([412, 7]))
  it('código com ou sem prefixo', () => {
    expect(codigos('REP-000412')).toEqual([412])
    expect(codigos('7')).toEqual([7])
  })
  it('placa em qualquer formato e parcial', () => {
    expect(codigos('abc-1c34')).toEqual([412])
    expect(codigos('ABC1234')).toEqual([412])
    expect(codigos('qrs')).toEqual([7])
  })
  it('documento com máscara e razão social', () => {
    expect(codigos('11.222.333')).toEqual([412])
    expect(codigos('529.982')).toEqual([7])
    expect(codigos('auto jk')).toEqual([412])
  })
})
