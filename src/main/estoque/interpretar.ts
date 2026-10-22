// Transforma as linhas cruas da planilha em itens para sincronizar_estoque.
// Puro (sem Electron nem fs) para ser testado direto.
import type { ErroLinha, ItemEstoque, LeituraEstoque } from '../../shared/estoque'
import { normalizarPlaca, placaParaMercosul } from '../../shared/placa'
import {
  anos,
  COLUNAS,
  COLUNAS_AUDITORIA,
  dataIso,
  inteiro,
  MARCA_NAO_INFORMADA,
  marcaEModelo,
  normalizarCabecalho,
  OBRIGATORIAS,
  SITUACOES_REPASSE,
  texto,
  type Campo
} from './mapeamento'

type Celula = string | number | boolean | Date | null | undefined
type Interpretada = Omit<LeituraEstoque, 'arquivo' | 'caminho' | 'modificadoEm'>

function localizarCabecalho(linhas: Celula[][]): number {
  const placa = normalizarCabecalho(COLUNAS.placa[0])
  const modelo = normalizarCabecalho(COLUNAS.modelo[0])
  return linhas.slice(0, 20).findIndex((l) => {
    const nomes = l.map((c) => normalizarCabecalho(texto(c)))
    return nomes.includes(placa) && nomes.includes(modelo)
  })
}

export function interpretarPlanilha(linhas: Celula[][]): Interpretada {
  const vazio: Interpretada = {
    cabecalhos: [],
    colunasFaltando: [],
    itens: [],
    erros: [],
    avisos: [],
    ignoradas: { semPlaca: 0, outrasSituacoes: {} },
    totalLinhas: 0
  }

  const iCabecalho = localizarCabecalho(linhas)
  if (iCabecalho < 0) {
    return { ...vazio, colunasFaltando: OBRIGATORIAS.map((c) => COLUNAS[c][0]) }
  }
  const cabecalhos = linhas[iCabecalho].map((c) => texto(c))
  const normalizados = cabecalhos.map(normalizarCabecalho)
  const indice = {} as Record<Campo, number>
  for (const campo of Object.keys(COLUNAS) as Campo[]) {
    indice[campo] = normalizados.findIndex((n) => COLUNAS[campo].some((nome) => normalizarCabecalho(nome) === n))
  }
  const colunasFaltando = OBRIGATORIAS.filter((c) => indice[c] < 0).map((c) => COLUNAS[c][0])
  if (colunasFaltando.length) return { ...vazio, cabecalhos, colunasFaltando }

  const auditoria = new Set(COLUNAS_AUDITORIA.map(normalizarCabecalho))
  const valor = (linha: Celula[], campo: Campo): Celula => (indice[campo] >= 0 ? linha[indice[campo]] : null)

  const erros: ErroLinha[] = []
  const avisos: string[] = []
  const ignoradas = { semPlaca: 0, outrasSituacoes: {} as Record<string, number> }
  const porPlaca = new Map<string, { item: ItemEstoque; linha: number; entrada: string | null }>()
  let totalLinhas = 0
  let semMarca = 0

  linhas.slice(iCabecalho + 1).forEach((linha, i) => {
    const numero = iCabecalho + i + 2 // linha como aparece no Excel
    const modeloBravos = texto(valor(linha, 'modelo'))
    const placaBruta = texto(valor(linha, 'placa'))
    if (!modeloBravos && !placaBruta) return // linha de total ou vazia
    totalLinhas++

    const situacao = texto(valor(linha, 'situacao')).toUpperCase()
    if (!SITUACOES_REPASSE.includes(situacao)) {
      const chave = situacao || '(vazia)'
      ignoradas.outrasSituacoes[chave] = (ignoradas.outrasSituacoes[chave] ?? 0) + 1
      return
    }
    if (!placaBruta) {
      ignoradas.semPlaca++
      return
    }
    const placaBusca = placaParaMercosul(placaBruta)
    if (!placaBusca) {
      erros.push({ linha: numero, motivo: `Placa inválida: "${placaBruta}"` })
      return
    }
    const { marca, modelo } = marcaEModelo(modeloBravos, valor(linha, 'marca'))
    if (!modelo) {
      erros.push({ linha: numero, motivo: `Modelo vazio para a placa ${normalizarPlaca(placaBruta)}` })
      return
    }
    if (!marca) semMarca++

    const [anoFabricacao, anoModelo] = anos(valor(linha, 'anoFabricacao'), valor(linha, 'anoModelo'))
    const empresa = texto(valor(linha, 'empresa'))
    const revenda = texto(valor(linha, 'revenda'))
    const entrada = dataIso(valor(linha, 'entrada'))

    const dados: ItemEstoque['dados_bravos'] = {}
    cabecalhos.forEach((nome, c) => {
      if (!nome || !auditoria.has(normalizados[c])) return
      const v = linha[c]
      dados[nome] = c === indice.entrada ? entrada : v instanceof Date ? v.toISOString() : typeof v === 'number' ? v : texto(v) || null
    })

    const item: ItemEstoque = {
      placa: normalizarPlaca(placaBruta),
      marca: marca ?? MARCA_NAO_INFORMADA,
      modelo,
      codigo_bravos: texto(valor(linha, 'codigo')) || null,
      dias_em_estoque: inteiro(valor(linha, 'dias')),
      ano_fabricacao: anoFabricacao,
      ano_modelo: anoModelo,
      cor: texto(valor(linha, 'cor')) || null,
      km: inteiro(valor(linha, 'km')),
      filial_estoque: empresa && revenda ? `${empresa}.${revenda}` : null,
      dados_bravos: dados
    }

    // Placa repetida: fica a linha com entrada mais recente (ou a última).
    const anterior = porPlaca.get(placaBusca)
    if (anterior) {
      const manterNova = (entrada ?? '') >= (anterior.entrada ?? '')
      const mantida = manterNova ? numero : anterior.linha
      avisos.push(`Placa ${item.placa} repetida nas linhas ${anterior.linha} e ${numero}; mantida a linha ${mantida}.`)
      if (!manterNova) return
    }
    porPlaca.set(placaBusca, { item, linha: numero, entrada })
  })

  if (semMarca) {
    avisos.push(
      `${semMarca} ${semMarca === 1 ? 'veículo ficou' : 'veículos ficaram'} com marca "${MARCA_NAO_INFORMADA}". Inclua a coluna Marca na exportação do Bravos.`
    )
  }

  return {
    cabecalhos,
    colunasFaltando: [],
    itens: [...porPlaca.values()].map((v) => v.item),
    erros,
    avisos,
    ignoradas,
    totalLinhas
  }
}
