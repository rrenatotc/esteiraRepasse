// Exportação de listas (RF18). CSV no formato que o Excel em pt-BR abre
// direto: separador ";", vírgula decimal e BOM UTF-8.

export type Celula = string | number | null

export interface Coluna<T> {
  titulo: string
  valor: (linha: T) => Celula
}

function celulaCsv(v: Celula): string {
  if (v === null) return ''
  const texto = typeof v === 'number' ? String(v).replace('.', ',') : v
  return /[";\r\n]/.test(texto) || /^\s|\s$/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

export function gerarCsv<T>(colunas: Coluna<T>[], linhas: T[]): string {
  const cabecalho = colunas.map((c) => celulaCsv(c.titulo)).join(';')
  const corpo = linhas.map((l) => colunas.map((c) => celulaCsv(c.valor(l))).join(';'))
  return '﻿' + [cabecalho, ...corpo].join('\r\n') + '\r\n'
}

/** Matriz [cabeçalho, ...linhas] para o SheetJS montar o .xlsx. */
export function gerarMatriz<T>(colunas: Coluna<T>[], linhas: T[]): Celula[][] {
  return [colunas.map((c) => c.titulo), ...linhas.map((l) => colunas.map((c) => c.valor(l)))]
}

export function nomeArquivo(base: string, extensao: 'csv' | 'xlsx', agora = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  const carimbo = `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}_${p(agora.getHours())}${p(agora.getMinutes())}`
  return `${base}_${carimbo}.${extensao}`
}
