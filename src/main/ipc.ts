// Handlers de IPC. Todo payload vindo do renderer é validado com Zod e só
// aceito se vier do frame principal da nossa janela.
import { app, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import log from 'electron-log/main'
import type { ZodType } from 'zod'
import {
  CANAIS,
  chaveSessaoSchema,
  configParcialSchema,
  booleanoSchema,
  contadorSchema,
  notificacaoSchema,
  salvarArquivoSchema,
  urlExternaSchema,
  valorSessaoSchema,
  validarPayload,
  PayloadInvalidoError,
  type AppInfo,
  type Config
} from '../shared/ipc'
import { atualizarContador } from './bandeja'
import * as estoque from './estoque'
import { novidadesDesde, type Novidade } from '../shared/novidades'
import { estadoAtualizacao, procurarAtualizacao, reiniciarParaAtualizar } from './updater'
import { janelaPrincipal } from './janela'
import { notificar } from './notificacoes'
import { lerSessao, removerSessao, salvarSessao } from './sessao'
import { lerConfig, store } from './store'

function validar<T>(schema: ZodType<T>, valor: unknown, canal: string): T {
  try {
    return validarPayload(schema, valor, canal)
  } catch (erro) {
    if (erro instanceof PayloadInvalidoError) log.warn(`IPC ${canal}: payload rejeitado`, erro.problemas)
    throw erro
  }
}

function origemConfiavel(evento: IpcMainInvokeEvent): boolean {
  const janela = janelaPrincipal()
  return !!janela && evento.sender === janela.webContents && evento.senderFrame === janela.webContents.mainFrame
}

function tratar(canal: string, fn: (...args: unknown[]) => unknown): void {
  ipcMain.handle(canal, (evento, ...args) => {
    if (!origemConfiavel(evento)) throw new Error('Origem de IPC não permitida')
    return fn(...args)
  })
}

export function registrarIpc(): void {
  tratar(CANAIS.sessaoLer, (chave) => lerSessao(validar(chaveSessaoSchema, chave, CANAIS.sessaoLer)))
  tratar(CANAIS.sessaoSalvar, (chave, valor) =>
    salvarSessao(
      validar(chaveSessaoSchema, chave, CANAIS.sessaoSalvar),
      validar(valorSessaoSchema, valor, CANAIS.sessaoSalvar)
    )
  )
  tratar(CANAIS.sessaoRemover, (chave) =>
    removerSessao(validar(chaveSessaoSchema, chave, CANAIS.sessaoRemover))
  )

  tratar(
    CANAIS.appInfo,
    (): AppInfo => ({
      versao: app.getVersion(),
      installId: store.get('installId'),
      plataforma: process.platform
    })
  )
  tratar(CANAIS.appNotificar, (n) => notificar(validar(notificacaoSchema, n, CANAIS.appNotificar)))
  tratar(CANAIS.appContador, (n) => atualizarContador(validar(contadorSchema, n, CANAIS.appContador)))
  tratar(CANAIS.appAbrirExterno, (url) =>
    shell.openExternal(validar(urlExternaSchema, url, CANAIS.appAbrirExterno))
  )

  tratar(CANAIS.estoqueStatus, () => estoque.status())
  tratar(CANAIS.estoqueObservar, (ativo) => estoque.observar(validar(booleanoSchema, ativo, CANAIS.estoqueObservar)))
  tratar(CANAIS.estoqueEscolherPasta, () => estoque.escolherPasta())
  tratar(CANAIS.estoqueLerMaisRecente, () => estoque.lerMaisRecente())
  tratar(CANAIS.estoqueUltimaLeitura, () => estoque.obterUltimaLeitura())

  tratar(CANAIS.arquivoSalvar, async (payload): Promise<string | null> => {
    const { nome, base64 } = validar(salvarArquivoSchema, payload, CANAIS.arquivoSalvar)
    const xlsx = nome.endsWith('.xlsx')
    const janela = janelaPrincipal()
    const opcoes: Electron.SaveDialogOptions = {
      title: 'Salvar exportação',
      defaultPath: join(app.getPath('downloads'), nome),
      filters: [xlsx ? { name: 'Planilha do Excel', extensions: ['xlsx'] } : { name: 'CSV', extensions: ['csv'] }]
    }
    const { canceled, filePath } = janela ? await dialog.showSaveDialog(janela, opcoes) : await dialog.showSaveDialog(opcoes)
    if (canceled || !filePath) return null
    await writeFile(filePath, Buffer.from(base64, 'base64'))
    log.info(`Exportação salva em ${filePath}`)
    return filePath
  })

  tratar(CANAIS.atualizacaoEstado, () => estadoAtualizacao())
  tratar(CANAIS.atualizacaoProcurar, () => procurarAtualizacao())
  tratar(CANAIS.atualizacaoReiniciar, () => reiniciarParaAtualizar())
  // Novidades desde a última versão vista; na 1ª instalação não mostra nada.
  tratar(CANAIS.appNovidades, (): Novidade[] => {
    const atual = app.getVersion()
    const vista = store.get('ultimaVersaoVista')
    store.set('ultimaVersaoVista', atual)
    return vista ? novidadesDesde(vista, atual) : []
  })

  tratar(CANAIS.configLer, (): Config => lerConfig())
  tratar(CANAIS.configSalvar, (parcial): Config => {
    const dados = validar(configParcialSchema, parcial, CANAIS.configSalvar)
    // A pasta do Bravos só é alterada pelo seletor nativo (fase 2), nunca por payload.
    const { pastaBravos: _ignorada, ...permitidos } = dados
    for (const [chave, valor] of Object.entries(permitidos)) {
      store.set(chave as keyof typeof permitidos, valor)
    }
    if (permitidos.iniciarComWindows !== undefined) {
      app.setLoginItemSettings({ openAtLogin: permitidos.iniciarComWindows, args: ['--oculto'] })
    }
    return lerConfig()
  })
}
