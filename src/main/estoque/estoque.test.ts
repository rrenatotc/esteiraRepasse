import { existsSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { interpretarPlanilha } from './interpretar'
import { lerMaisRecente, lerPlanilha } from './leitor'
import { anos, dataIso, inteiro, marcaEModelo } from './mapeamento'

// Layout real do .xls exportado pelo Bravos (24 colunas).
const CABECALHO = [
  'Modelo', 'Placa', 'Fab.', 'Mod.', 'Sit.', 'Dias', 'Dias Es', 'Ed', 'Trân', 'Res', 'Neg', 'Prop', 'Disp', 'Ven',
  'Cor', 'Custo Contábil (265)', 'Preço Revenda (266)', 'Emp', 'Rev', 'Rev. Compra', 'Emp Origem', 'Rev Origem',
  'Km', 'Dta Entrada'
]

type Linha = (string | number | null)[]
const linha = (modelo: string, placa: string, sit: string, extra: { km?: number | string; entrada?: number | string; emp?: string; rev?: string; dias?: string } = {}): Linha => [
  modelo, placa, '2025', '2026', sit, extra.dias ?? '30', '28', '0', 'Não', 'Não', 'Não', 'Não', 'Sim', 'Não',
  'PRATA', '106,361.80', '129,900.00', extra.emp ?? '2', extra.rev ?? '3', '3', '2', '3', extra.km ?? 0, extra.entrada ?? 46297
]
const TOTAL: Linha = ['', '', '', '', '', '1165', '1153', '', '0', '0', '0', '0', '3', '0', '', '310,294.51', '390,790.00', '', '', '', '', '', '', '']

describe('funções de limpeza', () => {
  it('inteiro aceita separador de milhar e número', () => {
    expect(inteiro('16,900')).toBe(16900)
    expect(inteiro('16.900')).toBe(16900)
    expect(inteiro(22823)).toBe(22823)
    expect(inteiro('106,361.80')).toBe(106361)
    expect(inteiro('')).toBeNull()
    expect(inteiro('abc')).toBeNull()
  })

  it('anos separados ou "2019/2020"', () => {
    expect(anos('2025', '2026')).toEqual([2025, 2026])
    expect(anos('2019/2020', null)).toEqual([2019, 2020])
    expect(anos('2019/20', null)).toEqual([2019, 2020])
    expect(anos('', '')).toEqual([null, null])
  })

  it('data serial do Excel e dd/mm/aaaa', () => {
    expect(dataIso(46297)).toBe('2026-10-02')
    expect(dataIso('30/05/2025')).toBe('2025-05-30')
    expect(dataIso('')).toBeNull()
  })

  it('marca pelo prefixo do modelo, coluna Marca tem prioridade', () => {
    expect(marcaEModelo('VW/TERA HIGH TSI', null)).toEqual({ marca: 'Volkswagen', modelo: 'TERA HIGH TSI' })
    expect(marcaEModelo('I/VW AMAROK V6 HIGH', null)).toEqual({ marca: 'Volkswagen', modelo: 'AMAROK V6 HIGH' })
    expect(marcaEModelo('HONDA/HR-V EXL CVT', null)).toEqual({ marca: 'Honda', modelo: 'HR-V EXL CVT' })
    expect(marcaEModelo('CHEV ONIX 10MT LT2', null)).toEqual({ marca: 'Chevrolet', modelo: 'ONIX 10MT LT2' })
    expect(marcaEModelo('I/PEUGEOUT 208 GT T200', null)).toEqual({ marca: 'Peugeot', modelo: '208 GT T200' })
    expect(marcaEModelo('JUMPY FURGAO PACK 1.6 DIESEL HDI 20/20', null)).toEqual({
      marca: null,
      modelo: 'JUMPY FURGAO PACK 1.6 DIESEL HDI 20/20'
    })
    expect(marcaEModelo('KICKS SL CVT', 'NISSAN')).toEqual({ marca: 'Nissan', modelo: 'KICKS SL CVT' })
    expect(marcaEModelo('VW/NIVUS', 'VOLKSWAGEN')).toEqual({ marca: 'Volkswagen', modelo: 'NIVUS' })
  })
})

describe('interpretarPlanilha', () => {
  it('fica só com RP, ignora sem placa e outras situações, descarta o total', () => {
    const r = interpretarPlanilha([
      CABECALHO,
      linha('VW/NIVUS GTS', 'JDN9C54', 'RP', { km: '16,900', dias: '521' }),
      linha('C3 LIVE GO 1.0 MT', '', 'RP'),
      linha('VW/TERA HIGH TSI', 'TQP0H27', 'ES'),
      linha('VW/TERA HIGH TSI', 'TQP0H28', 'ES'),
      linha('HONDA/HR-V EXL CVT', 'jaz-4j85', 'rp'),
      TOTAL
    ])
    expect(r.colunasFaltando).toEqual([])
    expect(r.totalLinhas).toBe(5)
    expect(r.ignoradas).toEqual({ semPlaca: 1, outrasSituacoes: { ES: 2 } })
    expect(r.itens.map((i) => i.placa)).toEqual(['JDN9C54', 'JAZ4J85'])
    expect(r.itens[0]).toMatchObject({
      marca: 'Volkswagen',
      modelo: 'NIVUS GTS',
      km: 16900,
      dias_em_estoque: 521,
      ano_fabricacao: 2025,
      ano_modelo: 2026,
      filial_estoque: '2.3',
      cor: 'PRATA'
    })
  })

  it('nunca guarda custo nem preço em dados_bravos', () => {
    const r = interpretarPlanilha([CABECALHO, linha('VW/NIVUS', 'JDN9C54', 'RP')])
    const dados = r.itens[0].dados_bravos
    expect(Object.keys(dados)).not.toContain('Custo Contábil (265)')
    expect(Object.keys(dados)).not.toContain('Preço Revenda (266)')
    expect(dados['Sit.']).toBe('RP')
    expect(dados['Dta Entrada']).toBe('2026-10-02')
  })

  it('aponta placa inválida com número da linha do Excel', () => {
    const r = interpretarPlanilha([CABECALHO, linha('VW/NIVUS', 'JDN9C54', 'RP'), linha('I/VW TAOS HL TSI', '089913', 'RP')])
    expect(r.erros).toEqual([{ linha: 3, motivo: 'Placa inválida: "089913"' }])
    expect(r.itens).toHaveLength(1)
  })

  it('placa repetida: mantém a entrada mais recente e avisa', () => {
    const r = interpretarPlanilha([
      CABECALHO,
      linha('I/VW AMAROK V6 HIGH', 'JCJ6E56', 'RP', { emp: '6', rev: '1', entrada: '01/10/2026' }),
      linha('I/VW AMAROK V6 HIGH', 'JCJ6E56', 'RP', { emp: '2', rev: '1', entrada: '28/09/2026' })
    ])
    expect(r.itens).toHaveLength(1)
    expect(r.itens[0].filial_estoque).toBe('6.1')
    expect(r.avisos[0]).toBe('Placa JCJ6E56 repetida nas linhas 2 e 3; mantida a linha 2.')
  })

  it('avisa veículos sem marca identificada', () => {
    const r = interpretarPlanilha([CABECALHO, linha('KICKS SL CVT', 'KIC1A11', 'RP')])
    expect(r.itens[0].marca).toBe('Não informada')
    expect(r.avisos).toContain('1 veículo ficou com marca "Não informada". Inclua a coluna Marca na exportação do Bravos.')
  })

  it('recusa planilha sem as colunas obrigatórias', () => {
    expect(interpretarPlanilha([['Produto', 'Qtde'], ['X', 1]]).colunasFaltando).toEqual(['Placa', 'Modelo', 'Sit.'])
    expect(interpretarPlanilha([['Modelo', 'Placa'], ['VW/NIVUS', 'JDN9C54']]).colunasFaltando).toEqual(['Sit.'])
  })

  it('aceita as colunas extras Marca e Cód.Veículo', () => {
    const r = interpretarPlanilha([
      ['Cód.Veículo', 'Marca', 'Modelo', 'Placa', 'Sit.', 'Dias'],
      ['123456', 'NISSAN', 'KICKS SL CVT', 'KIC1A11', 'RP', '45']
    ])
    expect(r.itens[0]).toMatchObject({ codigo_bravos: '123456', marca: 'Nissan', modelo: 'KICKS SL CVT', dias_em_estoque: 45 })
  })
})

describe('leitor de arquivo', () => {
  function salvarXls(pasta: string, nome: string, linhas: Linha[], mtime: Date): string {
    const livro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(livro, XLSX.utils.aoa_to_sheet(linhas), 'Estoque')
    const caminho = join(pasta, nome)
    writeFileSync(caminho, XLSX.write(livro, { type: 'buffer', bookType: 'biff8' }))
    utimesSync(caminho, mtime, mtime)
    return caminho
  }

  it('lê .xls BIFF e pega a exportação de estoque mais recente, pulando outros relatórios', async () => {
    const pasta = mkdtempSync(join(tmpdir(), 'esteira-rel-'))
    salvarXls(pasta, 'antigo.xls', [CABECALHO, linha('VW/NIVUS', 'AAA1A11', 'RP')], new Date('2026-10-01T10:00:00Z'))
    salvarXls(pasta, 'estoque.xls', [CABECALHO, linha('VW/NIVUS', 'BBB1B11', 'RP'), TOTAL], new Date('2026-10-02T10:00:00Z'))
    salvarXls(pasta, 'MovimentacaoItens.xls', [['Produto', 'Qtde'], ['Filtro', 3]], new Date('2026-10-03T10:00:00Z'))
    writeFileSync(join(pasta, 'log.txt'), 'x')

    const leitura = await lerMaisRecente(pasta)
    expect(leitura?.arquivo).toBe('estoque.xls')
    expect(leitura?.itens.map((i) => i.placa)).toEqual(['BBB1B11'])
    expect(leitura?.modificadoEm).toBe('2026-10-02T10:00:00.000Z')
  })

  const REAL = 'C:/BravosClient/rel/ArquivoExportação_261002145133639.xls'
  it.skipIf(!existsSync(REAL))('planilha real do Bravos: colunas reconhecidas, sem RP nesta exportação', async () => {
    const leitura = await lerPlanilha(REAL)
    expect(leitura.colunasFaltando).toEqual([])
    expect(leitura.totalLinhas).toBe(497)
    expect(leitura.itens).toHaveLength(0)
    expect(leitura.ignoradas.outrasSituacoes.ES).toBe(442)
  })
})
