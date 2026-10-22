import { app, BrowserWindow } from 'electron'
import log from 'electron-log/main'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { criarBandeja } from './bandeja'
import { registrarIpc } from './ipc'
import { criarJanela, marcarSaindo, mostrarJanela } from './janela'

log.initialize()
log.transports.file.maxSize = 5 * 1024 * 1024 // electron-log rotaciona em main.old.log
log.errorHandler.startCatching()

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', mostrarJanela)

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('br.com.carburgo.esteira-repasse')
    app.on('browser-window-created', (_, janela) => optimizer.watchWindowShortcuts(janela))

    registrarIpc()
    const janela = criarJanela()
    criarBandeja()

    // Iniciado com o Windows: fica só na bandeja.
    if (process.argv.includes('--oculto')) janela.once('ready-to-show', () => janela.hide())

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) criarJanela()
    })
    log.info(`Esteira do Repasse ${app.getVersion()} iniciada`)
  })

  // Sair pela bandeja, desligamento do Windows ou instalação de update.
  app.on('before-quit', marcarSaindo)

  // A janela fechada vai para a bandeja; o app só sai pelo menu "Sair".
  app.on('window-all-closed', () => {
    /* mantém vivo na bandeja */
  })
}
