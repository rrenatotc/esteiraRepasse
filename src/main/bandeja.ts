import { app, Menu, nativeImage, Tray } from 'electron'
import type { Contador } from '../shared/ipc'
import icon from '../../resources/icon.png?asset'
import { janelaPrincipal, marcarSaindo, mostrarJanela } from './janela'

let bandeja: Tray | null = null

export function criarBandeja(): void {
  bandeja = new Tray(nativeImage.createFromPath(icon).resize({ width: 16, height: 16 }))
  bandeja.setToolTip('Esteira do Repasse')
  bandeja.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir Esteira do Repasse', click: mostrarJanela },
      { type: 'separator' },
      {
        label: 'Sair',
        click: () => {
          marcarSaindo()
          app.quit()
        }
      }
    ])
  )
  bandeja.on('click', mostrarJanela)
}

/** Contador de demandas novas: dica da bandeja, selo na barra de tarefas e piscar. */
export function atualizarContador({ total, icone }: Contador): void {
  bandeja?.setToolTip(
    total > 0
      ? `Esteira do Repasse — ${total} ${total === 1 ? 'demanda nova' : 'demandas novas'}`
      : 'Esteira do Repasse'
  )
  const janela = janelaPrincipal()
  if (!janela) return
  janela.setOverlayIcon(
    total > 0 && icone ? nativeImage.createFromDataURL(icone) : null,
    total > 0 ? `${total} demandas novas` : ''
  )
  if (total > 0 && !janela.isFocused()) janela.flashFrame(true)
}
