// Gera resources/modelo-vendas-repasse.xlsx a partir de uma planilha real
// "Vendas Repasse <MÊS> <ANO>.xlsx": mantém o pacote inteiro (estilos,
// larguras, aba "Comunicado de Venda ", desenhos) e tira só as linhas de
// venda e os textos delas. A exportação do app preenche este modelo.
// Uso: node scripts/gerar-modelo-planilha.mjs "C:\caminho\Vendas Repasse OUTUBRO 2026.xlsx"
import { readFileSync, writeFileSync } from 'node:fs'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

const origem = process.argv[2]
if (!origem) {
  console.error('Informe o caminho da planilha original.')
  process.exit(1)
}

const arquivos = unzipSync(readFileSync(origem))
const ler = (nome) => strFromU8(arquivos[nome])
const gravar = (nome, texto) => (arquivos[nome] = strToU8(texto))

// Textos: fica só o que o cabeçalho (aba 1, linha 1) e a aba 2 usam, renumerado.
const textos = [...ler('xl/sharedStrings.xml').matchAll(/<si>[\s\S]*?<\/si>/g)].map((m) => m[0])
const usados = new Map()
function renumerar(xml) {
  return xml.replace(/(<c [^>]*t="s"[^>]*><v>)(\d+)(<\/v>)/g, (_, a, i, b) => {
    if (!usados.has(i)) usados.set(i, usados.size)
    return a + usados.get(i) + b
  })
}

let aba1 = ler('xl/worksheets/sheet1.xml')
const inicio = aba1.indexOf('<sheetData>') + '<sheetData>'.length
const fim = aba1.indexOf('</sheetData>')
const linhas = [...aba1.slice(inicio, fim).matchAll(/<row r="(\d+)"[\s\S]*?<\/row>/g)]
const cabecalho = renumerar(linhas.find((l) => l[1] === '1')[0])
// Linhas vazias do fim da folha (r=1048571…) fazem parte do arquivo original.
const finais = linhas
  .filter((l) => Number(l[1]) > 1_000_000)
  .map((l) => l[0])
  .join('')
aba1 = aba1.slice(0, inicio) + cabecalho + finais + aba1.slice(fim)
aba1 = aba1
  .replace(/topLeftCell="[A-Z]+\d+"/, 'topLeftCell="A1"')
  .replace(/(activeCell|sqref)="[A-Z]+\d+"/g, '$1="A2"')
gravar('xl/worksheets/sheet1.xml', aba1)

gravar('xl/worksheets/sheet2.xml', renumerar(ler('xl/worksheets/sheet2.xml')))

const ordem = [...usados.entries()].sort((a, b) => a[1] - b[1]).map(([i]) => textos[Number(i)])
const refs =
  (aba1.match(/t="s"/g) ?? []).length +
  (ler('xl/worksheets/sheet2.xml').match(/t="s"/g) ?? []).length
gravar(
  'xl/sharedStrings.xml',
  ler('xl/sharedStrings.xml').replace(
    /<sst ([^>]*?)count="\d+" uniqueCount="\d+">[\s\S]*<\/sst>/,
    `<sst $1count="${refs}" uniqueCount="${ordem.length}">${ordem.join('')}</sst>`
  )
)

writeFileSync('resources/modelo-vendas-repasse.xlsx', zipSync(arquivos, { level: 9 }))
console.log(`Modelo gerado: ${ordem.length} textos, ${refs} referências.`)
