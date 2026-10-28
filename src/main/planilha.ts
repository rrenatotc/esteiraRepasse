// Exporta a planilha "Vendas Repasse <MÊS> <ANO>.xlsx" a partir do modelo
// (cópia da planilha original), para sair idêntica à que o time usa.
import { app, dialog } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import log from 'electron-log/main'
import { unzipSync, zipSync } from 'fflate'
import modelo from '../../resources/modelo-vendas-repasse.xlsx?asset'
import type { ExportarPlanilha } from '../shared/ipc'
import { nomeArquivoPlanilha, preencherModelo } from '../shared/planilha'
import { janelaPrincipal } from './janela'

/** Devolve o caminho salvo, ou null se o usuário cancelou. */
export async function exportarPlanilha({ mes, linhas }: ExportarPlanilha): Promise<string | null> {
  const arquivos = preencherModelo(unzipSync(await readFile(modelo)), mes, linhas)
  const janela = janelaPrincipal()
  const opcoes: Electron.SaveDialogOptions = {
    title: 'Salvar planilha de vendas',
    defaultPath: join(app.getPath('downloads'), nomeArquivoPlanilha(mes)),
    filters: [{ name: 'Planilha do Excel', extensions: ['xlsx'] }]
  }
  const { canceled, filePath } = janela
    ? await dialog.showSaveDialog(janela, opcoes)
    : await dialog.showSaveDialog(opcoes)
  if (canceled || !filePath) return null
  await writeFile(filePath, zipSync(arquivos, { level: 6 }))
  log.info(`Planilha de vendas ${mes} salva em ${filePath} (${linhas.length} vendas)`)
  return filePath
}
