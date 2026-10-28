// Planilha "Vendas Repasse <MÊS> <ANO>.xlsx" (aba Planilha). O arquivo sai do
// modelo em resources/modelo-vendas-repasse.xlsx (cópia da planilha original
// sem as vendas): só a aba 1, o workbook e os textos são reescritos; estilos,
// larguras, aba "Comunicado de Venda " e desenhos ficam byte a byte iguais.
// Sem dependências de Node/DOM: roda no main e nos testes.

export interface LinhaPlanilha {
  anunciante: string | null
  placa: string
  veiculo: string | null
  ano: string | null
  fipe: number | null
  valor_compra: number | null
  valor_vendido: number | null
  dias_estoque: number | null
  classificacao: string | null
  transf_margem: number | null
  tipo_venda: string | null
  lojista: string | null
  /** "AAAA-MM-DD" */
  data_venda: string
  faturado: string | null
  repassador: string | null
}

export const MESES = [
  'JANEIRO',
  'FEVEREIRO',
  'MARÇO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO'
] as const

/** "2026-10" → "OUTUBRO 2026" (nome da aba). */
export function nomeAbaPlanilha(mes: string): string {
  const [ano, m] = mes.split('-').map(Number)
  return `${MESES[m - 1]} ${ano}`
}

export function nomeArquivoPlanilha(mes: string): string {
  return `Vendas Repasse ${nomeAbaPlanilha(mes)}.xlsx`
}

/** "2026-10-23" → número de série de data do Excel (dias desde 30/12/1899). */
export function serialData(data: string): number {
  const [a, m, d] = data.split('-').map(Number)
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000)
}

/** Lucro R$ (coluna J), como a fórmula SUM(G,-F) calcula. */
export function lucroLinha(l: Pick<LinhaPlanilha, 'valor_vendido' | 'valor_compra'>): number {
  return (l.valor_vendido ?? 0) - (l.valor_compra ?? 0)
}

// Caracteres de controle não são válidos em XML (tab e quebras de linha são).
// eslint-disable-next-line no-control-regex -- é exatamente o que se quer remover
const CONTROLE = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]', 'g')

function xml(texto: string): string {
  return texto
    .replace(CONTROLE, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Ids de estilo (xl/styles.xml) usados em cada coluna na planilha original.
const ESTILO_LINHA = {
  A: 10,
  B: 11,
  C: 11,
  D: 12,
  E: 13,
  F: 14,
  G: 14,
  H: 15,
  I: 15,
  J: 16,
  K: 17,
  L: 18,
  M: 19,
  N: 20,
  O: 24,
  P: 22,
  Q: 23
}
const ATRIBUTOS_LINHA =
  'customFormat="false" ht="15" hidden="false" customHeight="true" outlineLevel="0" collapsed="false"'

class Textos {
  readonly novos: string[] = []
  referencias = 0
  private readonly indice = new Map<string, number>()
  constructor(private readonly base: number) {}
  id(texto: string): number {
    this.referencias++
    let i = this.indice.get(texto)
    if (i === undefined) {
      i = this.base + this.novos.length
      this.novos.push(texto)
      this.indice.set(texto, i)
    }
    return i
  }
}

const vazia = (ref: string, s: number): string => `<c r="${ref}" s="${s}"/>`
const numero = (ref: string, s: number, v: number): string =>
  `<c r="${ref}" s="${s}" t="n"><v>${v}</v></c>`
const formula = (ref: string, s: number, f: string, v: number | null): string =>
  v === null || !Number.isFinite(v)
    ? `<c r="${ref}" s="${s}" t="e"><f aca="false">${f}</f><v>#DIV/0!</v></c>`
    : `<c r="${ref}" s="${s}" t="n"><f aca="false">${f}</f><v>${v}</v></c>`

function linhaVenda(l: LinhaPlanilha, r: number, textos: Textos): string {
  const c: string[] = []
  const texto = (col: keyof typeof ESTILO_LINHA, v: string | null): void => {
    const t = v?.trim() ? v : null
    c.push(
      t === null
        ? vazia(`${col}${r}`, ESTILO_LINHA[col])
        : `<c r="${col}${r}" s="${ESTILO_LINHA[col]}" t="s"><v>${textos.id(t)}</v></c>`
    )
  }
  const num = (col: keyof typeof ESTILO_LINHA, v: number | null): void => {
    c.push(
      v === null
        ? vazia(`${col}${r}`, ESTILO_LINHA[col])
        : numero(`${col}${r}`, ESTILO_LINHA[col], v)
    )
  }
  texto('A', l.anunciante)
  texto('B', l.placa)
  texto('C', l.veiculo)
  texto('D', l.ano)
  num('E', l.fipe)
  num('F', l.valor_compra)
  num('G', l.valor_vendido)
  num('H', l.dias_estoque)
  texto('I', l.classificacao)
  c.push(formula(`J${r}`, ESTILO_LINHA.J, `SUM(G${r},-F${r})`, lucroLinha(l)))
  c.push(vazia(`K${r}`, ESTILO_LINHA.K))
  num('L', l.transf_margem)
  texto('M', l.tipo_venda)
  texto('N', l.lojista)
  num('O', serialData(l.data_venda))
  texto('P', l.faturado)
  texto('Q', l.repassador)
  return `<row r="${r}" ${ATRIBUTOS_LINHA}>${c.join('')}</row>`
}

/**
 * Linhas de venda a partir da 2 e, logo abaixo, os totais exatamente como na
 * planilha original (inclusive o total de G começando em G11 e o C com o
 * número da última linha).
 */
function linhasAba(linhas: LinhaPlanilha[], textos: Textos): { xml: string; ultimaLinha: number } {
  const n = linhas.length
  const ultima = n + 1 // última linha de venda
  const t = n + 2 // linha de totais
  const partes = linhas.map((l, i) => linhaVenda(l, i + 2, textos))

  const soma = (de: number, col: (l: LinhaPlanilha) => number | null): number =>
    linhas.slice(Math.max(0, de - 2)).reduce((s, l) => s + (col(l) ?? 0), 0)
  const totalF = soma(2, (l) => l.valor_compra)
  const totalG = soma(11, (l) => l.valor_vendido)
  const totalJ = soma(2, lucroLinha)
  const pct = totalG === 0 ? null : (totalJ / totalG) * 100
  const media = ultima === 0 ? null : totalJ / ultima

  partes.push(
    `<row r="${t}" ${ATRIBUTOS_LINHA}>` +
      vazia(`A${t}`, 26) +
      vazia(`B${t}`, 27) +
      numero(`C${t}`, 28, ultima) +
      vazia(`D${t}`, 29) +
      vazia(`E${t}`, 29) +
      formula(`F${t}`, 30, `SUM(F2:F${ultima})`, totalF) +
      formula(`G${t}`, 31, `SUM(G11:G${ultima})`, totalG) +
      vazia(`H${t}`, 32) +
      vazia(`I${t}`, 32) +
      formula(`J${t}`, 30, `SUM(J2:K${ultima})`, totalJ) +
      formula(`K${t}`, 33, `J${t}/G${t}*100`, pct) +
      vazia(`L${t}`, 33) +
      vazia(`M${t}`, 34) +
      vazia(`N${t}`, 26) +
      vazia(`O${t}`, 26) +
      vazia(`P${t}`, 35) +
      vazia(`Q${t}`, 23) +
      '</row>',
    `<row r="${t + 1}" ${ATRIBUTOS_LINHA}>${vazia(`A${t + 1}`, 36)}${formula(`J${t + 1}`, 37, `J${t}/C${t}`, media)}${vazia(`Q${t + 1}`, 38)}</row>`,
    `<row r="${t + 2}" ${ATRIBUTOS_LINHA}>${vazia(`A${t + 2}`, 36)}${vazia(`J${t + 2}`, 37)}${vazia(`Q${t + 2}`, 38)}</row>`,
    `<row r="${t + 3}" ${ATRIBUTOS_LINHA}>${vazia(`A${t + 3}`, 36)}${vazia(`Q${t + 3}`, 39)}</row>`,
    `<row r="${t + 4}" ${ATRIBUTOS_LINHA}>${vazia(`A${t + 4}`, 36)}${vazia(`Q${t + 4}`, 38)}</row>`,
    ...[5, 6, 7].map((k) => `<row r="${t + k}" ${ATRIBUTOS_LINHA}></row>`)
  )
  return { xml: partes.join(''), ultimaLinha: t + 7 }
}

export type ArquivosZip = Record<string, Uint8Array>

/**
 * Preenche o modelo com as vendas do mês. Recebe e devolve o conteúdo do
 * .xlsx já descompactado (nome do arquivo → bytes).
 */
export function preencherModelo(
  modelo: ArquivosZip,
  mes: string,
  linhas: LinhaPlanilha[],
  agora = new Date()
): ArquivosZip {
  const dec = new TextDecoder()
  const enc = new TextEncoder()
  const ler = (nome: string): string => {
    const bytes = modelo[nome]
    if (!bytes) throw new Error(`Modelo da planilha sem ${nome}`)
    return dec.decode(bytes)
  }
  const saida: ArquivosZip = { ...modelo }
  const aba = nomeAbaPlanilha(mes)

  // Textos compartilhados: os do modelo continuam nos mesmos índices.
  const sst = ler('xl/sharedStrings.xml')
  const cab = /<sst ([^>]*?)count="(\d+)" uniqueCount="(\d+)">/.exec(sst)
  if (!cab) throw new Error('sharedStrings.xml do modelo inesperado')
  const textos = new Textos(Number(cab[3]))

  // Aba 1: cabeçalho do modelo + vendas + totais + linhas finais do modelo.
  let folha = ler('xl/worksheets/sheet1.xml')
  const fimCabecalho = folha.indexOf('</row>', folha.indexOf('<row r="1"')) + '</row>'.length
  const { xml: corpo, ultimaLinha } = linhasAba(linhas, textos)
  const filtro = linhas.length + 3
  folha = folha.slice(0, fimCabecalho) + corpo + folha.slice(fimCabecalho)
  folha = folha.replace(/<autoFilter ref="A1:Q\d+"/, `<autoFilter ref="A1:Q${filtro}"`)
  saida['xl/worksheets/sheet1.xml'] = enc.encode(folha)

  saida['xl/sharedStrings.xml'] = enc.encode(
    sst
      .replace(
        cab[0],
        `<sst ${cab[1]}count="${Number(cab[2]) + textos.referencias}" uniqueCount="${Number(cab[3]) + textos.novos.length}">`
      )
      .replace(
        '</sst>',
        textos.novos.map((t) => `<si><t xml:space="preserve">${xml(t)}</t></si>`).join('') +
          '</sst>'
      )
  )

  // Workbook: nome da aba do mês e intervalos do filtro e da área de impressão.
  let livro = ler('xl/workbook.xml')
  const antigo = /<sheet name="([^"]*)" sheetId="1"/.exec(livro)?.[1]
  if (!antigo) throw new Error('workbook.xml do modelo inesperado')
  livro = livro
    .replace(`<sheet name="${antigo}" sheetId="1"`, `<sheet name="${xml(aba)}" sheetId="1"`)
    .split(`&apos;${antigo}&apos;!`)
    .join(`&apos;${xml(aba)}&apos;!`)
    .replace(/\$A\$1:\$Q\$\d+/, `$A$1:$Q$${filtro}`)
    .replace(/\$AA\$1:\$AA\$\d+/, `$AA$1:$AA$${ultimaLinha}`)
  saida['xl/workbook.xml'] = enc.encode(livro)

  const core = modelo['docProps/core.xml']
  if (core) {
    const iso = agora.toISOString().replace(/\.\d{3}Z$/, 'Z')
    saida['docProps/core.xml'] = enc.encode(
      dec
        .decode(core)
        .replace(/(<dcterms:modified [^>]*>)[^<]*(<\/dcterms:modified>)/, `$1${iso}$2`)
    )
  }
  return saida
}

/** Ordem da planilha: data da venda e, no mesmo dia, ordem de registro. */
export function ordenarLinhas<T extends { data_venda: string; created_at: string }>(
  linhas: T[]
): T[] {
  return [...linhas].sort(
    (a, b) => a.data_venda.localeCompare(b.data_venda) || a.created_at.localeCompare(b.created_at)
  )
}
