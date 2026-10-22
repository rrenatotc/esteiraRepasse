import { describe, expect, it } from 'vitest'
import { compararVersoes, novidadesDesde, type Novidade } from './novidades'

const lista: Novidade[] = [
  { versao: '1.1.0', data: '', itens: ['c'] },
  { versao: '1.0.10', data: '', itens: ['b'] },
  { versao: '1.0.2', data: '', itens: ['a'] }
]

describe('novidades', () => {
  it('compara SemVer numericamente', () => {
    expect(compararVersoes('1.0.10', '1.0.2')).toBeGreaterThan(0)
    expect(compararVersoes('1.0.0', '1.0.0')).toBe(0)
    expect(compararVersoes('0.9.9', '1.0.0')).toBeLessThan(0)
  })

  it('pega só o que veio depois da versão anterior', () => {
    expect(novidadesDesde('1.0.2', '1.1.0', lista).map((n) => n.versao)).toEqual(['1.1.0', '1.0.10'])
    expect(novidadesDesde('1.1.0', '1.1.0', lista)).toEqual([])
    expect(novidadesDesde('1.0.2', '1.0.10', lista).map((n) => n.versao)).toEqual(['1.0.10'])
  })
})
