import { Notification } from 'electron'
import { CANAIS, type Notificacao } from '../shared/ipc'
import { janelaPrincipal, mostrarJanela } from './janela'
import { store } from './store'

export function notificar({ titulo, corpo, rota }: Notificacao): void {
  if (!store.get('notificacoes') || !Notification.isSupported()) return
  const notificacao = new Notification({ title: titulo, body: corpo })
  notificacao.on('click', () => {
    mostrarJanela()
    if (rota) janelaPrincipal()?.webContents.send(CANAIS.eventoNavegar, rota)
  })
  notificacao.show()
}
