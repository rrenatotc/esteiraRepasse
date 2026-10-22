// Única ponte entre renderer e main: window.esteira, mínima e tipada.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { CANAIS } from '../shared/canais'
import type { AppInfo, Config, Notificacao } from '../shared/ipc'

const api = {
  sessao: {
    ler: (chave: string): Promise<string | null> => ipcRenderer.invoke(CANAIS.sessaoLer, chave),
    salvar: (chave: string, valor: string): Promise<void> =>
      ipcRenderer.invoke(CANAIS.sessaoSalvar, chave, valor),
    remover: (chave: string): Promise<void> => ipcRenderer.invoke(CANAIS.sessaoRemover, chave)
  },
  app: {
    info: (): Promise<AppInfo> => ipcRenderer.invoke(CANAIS.appInfo),
    notificar: (n: Notificacao): Promise<void> => ipcRenderer.invoke(CANAIS.appNotificar, n),
    contador: (total: number): Promise<void> => ipcRenderer.invoke(CANAIS.appContador, total),
    abrirExterno: (url: string): Promise<void> => ipcRenderer.invoke(CANAIS.appAbrirExterno, url),
    onNavegar: (cb: (rota: string) => void): (() => void) => {
      const ouvinte = (_: IpcRendererEvent, rota: string): void => cb(rota)
      ipcRenderer.on(CANAIS.eventoNavegar, ouvinte)
      return () => ipcRenderer.off(CANAIS.eventoNavegar, ouvinte)
    }
  },
  config: {
    ler: (): Promise<Config> => ipcRenderer.invoke(CANAIS.configLer),
    salvar: (parcial: Partial<Config>): Promise<Config> =>
      ipcRenderer.invoke(CANAIS.configSalvar, parcial)
  }
}

export type EsteiraApi = typeof api

contextBridge.exposeInMainWorld('esteira', api)
