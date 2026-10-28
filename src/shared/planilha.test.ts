import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import {
  nomeArquivoPlanilha,
  ordenarLinhas,
  preencherModelo,
  serialData,
  type LinhaPlanilha
} from './planilha'

const modelo = unzipSync(
  readFileSync(join(__dirname, '../../resources/modelo-vendas-repasse.xlsx'))
)

const venda = (p: Partial<LinhaPlanilha> = {}): LinhaPlanilha => ({
  anunciante: 'PORTO ALEGRE',
  placa: 'IYE1206',
  veiculo: 'CRETA PULSE',
  ano: '2017/2018',
  fipe: 81954,
  valor_compra: 64000,
  valor_vendido: 66000,
  dias_estoque: 3,
  classificacao: 'D',
  transf_margem: null,
  tipo_venda: 'GRUPO',
  lojista: 'KLIPPEL',
  data_venda: '2026-10-02',
  faturado: 'SIM',
  repassador: null,
  ...p
})

describe('planilha de vendas', () => {
  it('nome do arquivo e datas no formato do Excel', () => {
    expect(nomeArquivoPlanilha('2026-10')).toBe('Vendas Repasse OUTUBRO 2026.xlsx')
    expect(nomeArquivoPlanilha('2026-03')).toBe('Vendas Repasse MARÇO 2026.xlsx')
    // Valores da planilha original: 46297 = 02/10/2026.
    expect(serialData('2026-10-02')).toBe(46297)
    expect(serialData('2026-10-22')).toBe(46317)
  })

  it('escreve linhas e totais com os estilos e fórmulas da planilha original', () => {
    const linhas = Array.from({ length: 12 }, (_, i) =>
      venda({ placa: `AAA${1000 + i}`, lojista: i % 2 ? 'A & B <LTDA>' : 'KLIPPEL' })
    )
    const saida = preencherModelo(modelo, '2026-10', linhas, new Date('2026-10-26T12:00:00Z'))
    const folha = strFromU8(saida['xl/worksheets/sheet1.xml'])

    // Linha 2 = primeira venda, com todas as 17 colunas e os estilos originais.
    expect(folha).toContain(
      '<row r="2" customFormat="false" ht="15" hidden="false" customHeight="true" outlineLevel="0" collapsed="false"><c r="A2" s="10" t="s">'
    )
    expect(folha).toContain(
      '<c r="E2" s="13" t="n"><v>81954</v></c><c r="F2" s="14" t="n"><v>64000</v></c><c r="G2" s="14" t="n"><v>66000</v></c>'
    )
    expect(folha).toContain(
      '<c r="J2" s="16" t="n"><f aca="false">SUM(G2,-F2)</f><v>2000</v></c><c r="K2" s="17"/><c r="L2" s="18"/>'
    )
    expect(folha).toContain('<c r="O2" s="24" t="n"><v>46297</v></c>')
    expect(folha).toContain('<c r="Q2" s="23"/></row>')

    // 12 vendas: linhas 2–13, totais na 14 (igual à original: 190 vendas → 192).
    expect(folha).toContain('<c r="C14" s="28" t="n"><v>13</v></c>')
    expect(folha).toContain('<f aca="false">SUM(F2:F13)</f><v>768000</v>')
    expect(folha).toContain('<f aca="false">SUM(G11:G13)</f><v>198000</v>')
    expect(folha).toContain('<f aca="false">SUM(J2:K13)</f><v>24000</v>')
    expect(folha).toContain('<c r="K14" s="33" t="n"><f aca="false">J14/G14*100</f>')
    expect(folha).toContain('<c r="J15" s="37" t="n"><f aca="false">J14/C14</f>')
    expect(folha).toContain('<autoFilter ref="A1:Q15"')
    // Linhas finais do modelo continuam lá.
    expect(folha).toContain('<row r="1048576"')

    const textos = strFromU8(saida['xl/sharedStrings.xml'])
    expect(textos).toContain('<t xml:space="preserve">A &amp; B &lt;LTDA&gt;</t>')
    expect(textos).toContain('<t xml:space="preserve">Veículos</t>')
    const n = (textos.match(/<si>/g) ?? []).length
    expect(textos).toContain(`uniqueCount="${n}"`)

    const livro = strFromU8(saida['xl/workbook.xml'])
    expect(livro).toContain('<sheet name="OUTUBRO 2026" sheetId="1"')
    expect(livro).toContain('&apos;OUTUBRO 2026&apos;!$A$1:$Q$15')
    expect(livro).toContain('&apos;OUTUBRO 2026&apos;!$AA$1:$AA$21')
    expect(livro).not.toContain('SETEMBRO')

    expect(strFromU8(saida['docProps/core.xml'])).toContain(
      '>2026-10-26T12:00:00Z</dcterms:modified>'
    )
  })

  it('mantém intactos estilos, aba 2 e desenhos', () => {
    const saida = preencherModelo(modelo, '2026-10', [venda()])
    for (const nome of [
      'xl/styles.xml',
      'xl/worksheets/sheet2.xml',
      'xl/drawings/drawing2.xml',
      '[Content_Types].xml'
    ]) {
      expect(saida[nome]).toBe(modelo[nome])
    }
  })

  it('sem vendas ainda gera um arquivo válido', () => {
    const folha = strFromU8(preencherModelo(modelo, '2026-11', [])['xl/worksheets/sheet1.xml'])
    expect(folha).toContain('<c r="C2" s="28" t="n"><v>1</v></c>')
    expect(folha).toContain('<c r="K2" s="33" t="e"><f aca="false">J2/G2*100</f><v>#DIV/0!</v></c>')
  })

  it('células vazias mantêm o estilo da coluna', () => {
    const folha = strFromU8(
      preencherModelo(modelo, '2026-10', [
        venda({ fipe: null, classificacao: null, faturado: null })
      ])['xl/worksheets/sheet1.xml']
    )
    expect(folha).toContain('<c r="E2" s="13"/>')
    expect(folha).toContain('<c r="I2" s="15"/>')
    expect(folha).toContain('<c r="P2" s="22"/>')
  })

  it('ordena por data da venda e ordem de registro', () => {
    const l = ordenarLinhas([
      { data_venda: '2026-10-02', created_at: '1' },
      { data_venda: '2026-10-01', created_at: '2' },
      { data_venda: '2026-10-01', created_at: '1' }
    ])
    expect(l.map((x) => x.data_venda + x.created_at)).toEqual([
      '2026-10-011',
      '2026-10-012',
      '2026-10-021'
    ])
  })
})
