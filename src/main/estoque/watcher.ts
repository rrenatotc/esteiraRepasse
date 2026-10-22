// Observa a pasta rel do Bravos. awaitWriteFinish evita ler o arquivo
// enquanto o Bravos ainda está escrevendo.
import { watch, type FSWatcher } from 'chokidar'
import { ehPlanilha } from './leitor'

export interface Observador {
  parar: () => Promise<void>
}

export function observarPasta(
  pasta: string,
  aoDetectar: (caminho: string) => void,
  estabilidadeMs = 2000
): Promise<Observador> {
  const observador: FSWatcher = watch(pasta, {
    depth: 0,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: estabilidadeMs, pollInterval: 100 }
  })
  const tratar = (caminho: string): void => {
    if (ehPlanilha(caminho)) aoDetectar(caminho)
  }
  observador.on('add', tratar).on('change', tratar)
  return new Promise((resolve, reject) => {
    observador.once('ready', () => resolve({ parar: () => observador.close() }))
    observador.once('error', reject)
  })
}
