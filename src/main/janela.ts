import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

let janela: BrowserWindow | null = null
let saindo = false

export function marcarSaindo(): void {
  saindo = true
}

export function janelaPrincipal(): BrowserWindow | null {
  return janela
}

export function mostrarJanela(): void {
  if (!janela) return
  if (janela.isMinimized()) janela.restore()
  janela.show()
  janela.focus()
}

export function criarJanela(): BrowserWindow {
  janela = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#F6F7F9',
    title: 'Esteira do Repasse',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  })

  janela.on('ready-to-show', () => janela?.show())

  // Fechar esconde na bandeja; sair de verdade só pelo menu da bandeja.
  janela.on('close', (evento) => {
    if (!saindo) {
      evento.preventDefault()
      janela?.hide()
    }
  })
  janela.on('closed', () => {
    janela = null
  })

  // Links externos abrem no navegador padrão; navegação interna fica bloqueada.
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  janela.webContents.on('will-navigate', (evento, url) => {
    const permitido = is.dev && url.startsWith(process.env['ELECTRON_RENDERER_URL'] ?? '\0')
    if (!permitido) evento.preventDefault()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void janela.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void janela.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return janela
}
