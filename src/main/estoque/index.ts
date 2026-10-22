// Orquestra a integração com a pasta do Bravos: escolher pasta, ler no
// utilityProcess, observar e avisar o renderer.
import { dialog, utilityProcess, type UtilityProcess } from 'electron'
import log from 'electron-log/main'
import { existsSync } from 'node:fs'
import workerPath from './worker?modulePath'
import { CANAIS } from '../../shared/canais'
import type { LeituraEstoque, StatusObservacao } from '../../shared/estoque'
import { janelaPrincipal } from '../janela'
import { notificar } from '../notificacoes'
import { store } from '../store'
import { planilhasDaPasta } from './leitor'
import { observarPasta, type Observador } from './watcher'
import type { PedidoSemId } from './worker'

const PASTA_PADRAO = 'C:\\BravosClient\\rel'

type Resposta = { id: number; ok: true; leitura: LeituraEstoque | null } | { id: number; ok: false; erro: string }

let worker: UtilityProcess | null = null
let proximoId = 1
const pendentes = new Map<number, { resolve: (l: LeituraEstoque | null) => void; reject: (e: Error) => void }>()

function obterWorker(): UtilityProcess {
  if (worker) return worker
  const novo = utilityProcess.fork(workerPath, [], { serviceName: 'Leitor de estoque' })
  novo.on('message', (r: Resposta) => {
    const pedido = pendentes.get(r.id)
    if (!pedido) return
    pendentes.delete(r.id)
    if (r.ok) pedido.resolve(r.leitura)
    else pedido.reject(new Error(r.erro))
  })
  novo.on('exit', (codigo) => {
    if (codigo !== 0) log.warn(`Leitor de estoque saiu com código ${codigo}`)
    for (const p of pendentes.values()) p.reject(new Error('O leitor da planilha parou inesperadamente. Tente de novo.'))
    pendentes.clear()
    worker = null
  })
  worker = novo
  return novo
}

function ler(pedido: PedidoSemId): Promise<LeituraEstoque | null> {
  const id = proximoId++
  return new Promise((resolve, reject) => {
    pendentes.set(id, { resolve, reject })
    obterWorker().postMessage({ ...pedido, id })
  })
}

// ---------------------------------------------------------------------------

let observador: Observador | null = null
let ultimaLeitura: LeituraEstoque | null = null

export function status(): StatusObservacao {
  return { pasta: store.get('pastaBravos'), observando: observador !== null }
}

export function obterUltimaLeitura(): LeituraEstoque | null {
  return ultimaLeitura
}

async function aoDetectar(caminho: string): Promise<void> {
  try {
    const leitura = await ler({ tipo: 'arquivo', caminho })
    // Outros relatórios do Bravos caem na mesma pasta: só interessa o de estoque.
    if (!leitura || leitura.colunasFaltando.length) return
    ultimaLeitura = leitura
    log.info(`Nova exportação do Bravos: ${leitura.arquivo} (${leitura.itens.length} veículos de repasse)`)
    janelaPrincipal()?.webContents.send(CANAIS.eventoEstoqueNovoArquivo, leitura)
    if (!store.get('aplicarEstoqueAutomatico')) {
      notificar({
        titulo: 'Nova exportação do Bravos',
        corpo: `${leitura.arquivo}: ${leitura.itens.length} veículos de repasse. Clique para revisar e aplicar.`,
        rota: '/estoque'
      })
    }
  } catch (erro) {
    log.error(`Falha ao ler ${caminho}`, erro)
  }
}

export async function observar(ativo: boolean): Promise<StatusObservacao> {
  await observador?.parar()
  observador = null
  const pasta = store.get('pastaBravos')
  if (ativo && pasta && existsSync(pasta)) {
    try {
      observador = await observarPasta(pasta, (c) => void aoDetectar(c))
      log.info(`Observando a pasta do Bravos: ${pasta}`)
    } catch (erro) {
      log.error(`Não foi possível observar ${pasta}`, erro)
    }
  }
  return status()
}

export async function escolherPasta(): Promise<{ pasta: string; planilhas: number } | { erro: string } | null> {
  const janela = janelaPrincipal()
  const atual = store.get('pastaBravos')
  const opcoes: Electron.OpenDialogOptions = {
    title: 'Pasta de relatórios do Bravos',
    defaultPath: atual ?? (existsSync(PASTA_PADRAO) ? PASTA_PADRAO : undefined),
    properties: ['openDirectory']
  }
  const { canceled, filePaths } = janela ? await dialog.showOpenDialog(janela, opcoes) : await dialog.showOpenDialog(opcoes)
  if (canceled || !filePaths[0]) return null
  const pasta = filePaths[0]
  const planilhas = (await planilhasDaPasta(pasta)).length
  if (planilhas === 0) {
    return { erro: 'Essa pasta não tem nenhum arquivo .xls. Escolha a pasta rel da instalação do Bravos.' }
  }
  store.set('pastaBravos', pasta)
  if (observador) await observar(true)
  return { pasta, planilhas }
}

export async function lerMaisRecente(): Promise<LeituraEstoque | null> {
  const pasta = store.get('pastaBravos')
  if (!pasta) throw new Error('Escolha a pasta de relatórios do Bravos em Ajustes.')
  if (!existsSync(pasta)) throw new Error(`A pasta ${pasta} não existe mais. Escolha outra em Ajustes.`)
  const leitura = await ler({ tipo: 'mais-recente', pasta })
  if (leitura) ultimaLeitura = leitura
  return leitura
}

export async function encerrar(): Promise<void> {
  await observador?.parar()
  worker?.kill()
}
