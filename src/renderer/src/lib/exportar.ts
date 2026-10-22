// Gera CSV/XLSX no renderer e pede ao main para salvar (janela "Salvar como").
import * as XLSX from 'xlsx'
import { gerarCsv, gerarMatriz, nomeArquivo, type Coluna } from '@shared/exportar'

function base64DeTexto(texto: string): string {
  const bytes = new TextEncoder().encode(texto)
  let binario = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binario)
}

/** Devolve o caminho salvo, ou null se o usuário cancelou. */
export async function exportar<T>(base: string, formato: 'csv' | 'xlsx', colunas: Coluna<T>[], linhas: T[]): Promise<string | null> {
  const nome = nomeArquivo(base, formato)
  if (formato === 'csv') return window.esteira.arquivo.salvar({ nome, base64: base64DeTexto(gerarCsv(colunas, linhas)) })

  const aba = XLSX.utils.aoa_to_sheet(gerarMatriz(colunas, linhas))
  aba['!cols'] = colunas.map((c) => ({ wch: Math.max(10, c.titulo.length + 2) }))
  const livro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(livro, aba, 'Demandas')
  const base64 = XLSX.write(livro, { type: 'base64', bookType: 'xlsx' }) as string
  return window.esteira.arquivo.salvar({ nome, base64 })
}
