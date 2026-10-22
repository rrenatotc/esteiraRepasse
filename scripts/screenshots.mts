// Abre o app buildado (out/) com Playwright e salva screenshots das telas
// em 1024 e 1600 px para revisão visual (seção 8).
// Uso: npx electron-vite build && node scripts/screenshots.mts [pasta-saida]
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { _electron as electron } from 'playwright'

const saida = process.argv[2] ?? 'screenshots'
mkdirSync(saida, { recursive: true })

const app = await electron.launch({
  args: ['.', `--user-data-dir=${join(tmpdir(), 'esteira-screenshots')}`]
})
const janela = await app.firstWindow()
await janela.waitForLoadState('domcontentloaded')
await janela.waitForTimeout(800)

const erros: string[] = []
janela.on('console', (m) => m.type() === 'error' && erros.push(m.text()))
janela.on('pageerror', (e) => erros.push(e.message))

const telas: [string, string, ((p: typeof janela) => Promise<void>)?][] = [
  ['consulta', '#/'],
  [
    'consulta-digitada',
    '#/',
    async (p) => {
      await p.getByLabel('Placa do veículo').fill('abc-1d23')
    }
  ],
  ['entrar', '#/entrar']
]

for (const largura of [1024, 1600]) {
  await app.evaluate(({ BrowserWindow }, w) => {
    BrowserWindow.getAllWindows()[0].setContentSize(w, w === 1024 ? 700 : 960)
  }, largura)
  for (const [nome, rota, acao] of telas) {
    await janela.evaluate((r) => (location.hash = r), rota)
    await janela.reload()
    await janela.waitForTimeout(500)
    if (acao) await acao(janela)
    await janela.waitForTimeout(200)
    await janela.screenshot({ path: join(saida, `${nome}-${largura}.png`) })
  }
}

console.log(erros.length ? `Erros no console:\n${erros.join('\n')}` : 'Sem erros no console.')
await app.close()
