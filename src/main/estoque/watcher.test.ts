import { appendFileSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { observarPasta } from './watcher'

const esperar = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

describe('observarPasta', () => {
  it('só avisa depois que o arquivo para de crescer, e ignora o que não é planilha', async () => {
    const pasta = mkdtempSync(join(tmpdir(), 'esteira-watch-'))
    const detectados: string[] = []
    const obs = await observarPasta(pasta, (c) => detectados.push(c), 400)
    try {
      const arquivo = join(pasta, 'ArquivoExportacao.xls')
      writeFileSync(arquivo, 'parte 1')
      writeFileSync(join(pasta, 'log.txt'), 'x')
      // Simula o Bravos escrevendo aos poucos.
      for (let i = 0; i < 4; i++) {
        await esperar(150)
        appendFileSync(arquivo, ` parte ${i + 2}`)
        expect(detectados).toEqual([])
      }
      await esperar(1200)
      expect(detectados).toEqual([arquivo])
    } finally {
      await obs.parar()
    }
  })
})
