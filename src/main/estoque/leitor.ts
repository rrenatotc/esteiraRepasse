// Lê um .xls/.xlsx do disco (o Bravos exporta BIFF antigo) e interpreta.
import { readFile, readdir, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import * as XLSX from 'xlsx'
import type { LeituraEstoque } from '../../shared/estoque'
import { interpretarPlanilha } from './interpretar'

export const EXTENSOES = ['.xls', '.xlsx']

export function ehPlanilha(caminho: string): boolean {
  return EXTENSOES.includes(extname(caminho).toLowerCase())
}

export async function lerPlanilha(caminho: string): Promise<LeituraEstoque> {
  const [conteudo, info] = await Promise.all([readFile(caminho), stat(caminho)])
  const pasta = XLSX.read(conteudo, { type: 'buffer', cellDates: false, dense: true })
  const aba = pasta.Sheets[pasta.SheetNames[0]]
  const linhas = aba
    ? XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(aba, { header: 1, raw: true, defval: null })
    : []
  return {
    arquivo: basename(caminho),
    caminho,
    modificadoEm: info.mtime.toISOString(),
    ...interpretarPlanilha(linhas)
  }
}

/** Planilhas da pasta, da mais nova para a mais antiga. */
export async function planilhasDaPasta(pasta: string): Promise<{ caminho: string; mtime: number }[]> {
  const nomes = await readdir(pasta)
  const arquivos = await Promise.all(
    nomes.filter(ehPlanilha).map(async (nome) => {
      const caminho = join(pasta, nome)
      return { caminho, mtime: (await stat(caminho)).mtimeMs }
    })
  )
  return arquivos.sort((a, b) => b.mtime - a.mtime)
}

/**
 * A exportação de estoque mais recente da pasta. A pasta rel do Bravos tem
 * outros relatórios, então pula os que não têm as colunas de estoque.
 */
export async function lerMaisRecente(pasta: string, limite = 15): Promise<LeituraEstoque | null> {
  for (const { caminho } of (await planilhasDaPasta(pasta)).slice(0, limite)) {
    const leitura = await lerPlanilha(caminho)
    if (leitura.colunasFaltando.length === 0) return leitura
  }
  return null
}
