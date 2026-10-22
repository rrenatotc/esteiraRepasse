import { describe, expect, it } from 'vitest'
import { gerarCsv, gerarMatriz, nomeArquivo, type Coluna } from './exportar'

interface Linha {
  codigo: string
  nome: string
  valor: number | null
}

const colunas: Coluna<Linha>[] = [
  { titulo: 'Código', valor: (l) => l.codigo },
  { titulo: 'Lojista', valor: (l) => l.nome },
  { titulo: 'Valor', valor: (l) => l.valor }
]

describe('gerarCsv', () => {
  it('BOM, separador ; e vírgula decimal', () => {
    const csv = gerarCsv(colunas, [{ codigo: 'REP-000001', nome: 'Auto JK', valor: 68500.5 }])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.slice(1)).toBe('Código;Lojista;Valor\r\nREP-000001;Auto JK;68500,5\r\n')
  })

  it('escapa ; aspas e quebra de linha; null vira vazio', () => {
    const csv = gerarCsv(colunas, [{ codigo: 'A', nome: 'Silva; "ME"\nfilial', valor: null }])
    expect(csv.split('\r\n')[1]).toBe('A;"Silva; ""ME""\nfilial";')
  })
})

describe('gerarMatriz e nomeArquivo', () => {
  it('matriz com cabeçalho', () => {
    expect(gerarMatriz(colunas, [{ codigo: 'A', nome: 'B', valor: 1 }])).toEqual([
      ['Código', 'Lojista', 'Valor'],
      ['A', 'B', 1]
    ])
  })

  it('nome com data e hora', () => {
    expect(nomeArquivo('demandas', 'xlsx', new Date(2026, 9, 22, 9, 5))).toBe('demandas_2026-10-22_0905.xlsx')
  })
})
