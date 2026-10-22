// Atualização automática (RNF09): verifica ao abrir e a cada 4 h, baixa em
// segundo plano e o app oferece "Reiniciar para atualizar".
import { app } from 'electron'
import log from 'electron-log/main'
import { autoUpdater } from 'electron-updater'
import { CANAIS } from '../shared/canais'
import type { EstadoAtualizacao } from '../shared/ipc'
import { janelaPrincipal, marcarSaindo } from './janela'

const QUATRO_HORAS = 4 * 3600_000
let estado: EstadoAtualizacao = { tipo: app.isPackaged ? 'atualizado' : 'desenvolvimento' }

/** 404 = repositório privado ou nenhuma versão publicada; o resto é rede. */
function mensagemDeErro(erro: unknown): string {
  const texto = erro instanceof Error ? erro.message : String(erro)
  return /404|No published versions|Unable to find latest version/i.test(texto)
    ? 'Nenhuma versão publicada no servidor de atualizações ainda.'
    : 'Não foi possível procurar atualização. Verifique a internet.'
}

function publicar(novo: EstadoAtualizacao): void {
  estado = novo
  janelaPrincipal()?.webContents.send(CANAIS.eventoAtualizacao, estado)
}

export function estadoAtualizacao(): EstadoAtualizacao {
  return estado
}

export async function procurarAtualizacao(): Promise<EstadoAtualizacao> {
  if (!app.isPackaged) return estado
  try {
    await autoUpdater.checkForUpdates()
  } catch (erro) {
    log.warn('Falha ao procurar atualização', erro)
    publicar({ tipo: 'erro', mensagem: mensagemDeErro(erro) })
  }
  return estado
}

export function reiniciarParaAtualizar(): void {
  if (estado.tipo !== 'pronta') return
  marcarSaindo()
  autoUpdater.quitAndInstall(true, true)
}

export function iniciarAtualizador(): void {
  if (!app.isPackaged) return
  autoUpdater.logger = log
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => publicar({ tipo: 'procurando' }))
  autoUpdater.on('update-not-available', () => publicar({ tipo: 'atualizado' }))
  autoUpdater.on('update-available', (info) => publicar({ tipo: 'baixando', versao: info.version, progresso: 0 }))
  autoUpdater.on('download-progress', (p) => {
    if (estado.tipo === 'baixando') publicar({ ...estado, progresso: Math.round(p.percent) })
  })
  autoUpdater.on('update-downloaded', (info) => {
    log.info(`Atualização ${info.version} baixada`)
    publicar({ tipo: 'pronta', versao: info.version })
  })
  autoUpdater.on('error', (erro) => {
    log.warn('Erro no atualizador', erro)
    // Sem rede não é problema: tenta de novo no próximo ciclo.
    if (estado.tipo !== 'pronta') publicar({ tipo: 'erro', mensagem: mensagemDeErro(erro) })
  })

  void procurarAtualizacao()
  setInterval(() => void procurarAtualizacao(), QUATRO_HORAS)
}
