// Roda num utilityProcess: ler .xls pode levar alguns segundos e não pode
// travar a janela.
import { lerMaisRecente, lerPlanilha } from './leitor'

export type PedidoSemId = { tipo: 'arquivo'; caminho: string } | { tipo: 'mais-recente'; pasta: string }
export type PedidoLeitura = { id: number } & PedidoSemId

process.parentPort.on('message', async ({ data }: { data: PedidoLeitura }) => {
  try {
    const leitura = data.tipo === 'arquivo' ? await lerPlanilha(data.caminho) : await lerMaisRecente(data.pasta)
    process.parentPort.postMessage({ id: data.id, ok: true, leitura })
  } catch (erro) {
    process.parentPort.postMessage({ id: data.id, ok: false, erro: erro instanceof Error ? erro.message : String(erro) })
  }
})
