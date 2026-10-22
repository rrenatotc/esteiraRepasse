// Gera o ícone do app (placa Mercosul estilizada com "ER") em PNG, usando o
// próprio Electron para renderizar o SVG. Uso: npm run icone
// Saídas: build/icon.png (512), build/icon.ico (16–256, PNGs dentro do ICO)
// e resources/icon.png (256, bandeja e janela).
import { _electron as electron } from 'playwright'

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect x="24" y="96" width="464" height="320" rx="40" fill="#ffffff" stroke="#14213D" stroke-width="20"/>
  <path d="M34 136a30 30 0 0 1 30-30h384a30 30 0 0 1 30 30v42H34z" fill="#003399"/>
  <text x="256" y="356" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800"
        font-size="200" letter-spacing="8" fill="#14213D">ER</text>
</svg>`

const app = await electron.launch({ args: ['.', '--user-data-dir=' + process.env.TEMP + '\\esteira-icone'] })
await app.firstWindow()
await app.evaluate(async ({ BrowserWindow }, svg) => {
  const fs = process.getBuiltinModule('node:fs')
  const path = process.getBuiltinModule('node:path')
  const icoTamanhos = [16, 24, 32, 48, 64, 128, 256]
  const pngsIco = []
  for (const [tamanho, destino] of [
    [512, 'build/icon.png'],
    [256, 'resources/icon.png'],
    ...icoTamanhos.map((t) => [t, null])
  ]) {
    const janela = new BrowserWindow({ show: false, width: tamanho, height: tamanho, transparent: true, frame: false, useContentSize: true })
    const html = `<html><body style="margin:0;background:transparent"><div style="width:${tamanho}px;height:${tamanho}px">${svg.replace('<svg ', `<svg width="${tamanho}" height="${tamanho}" `)}</div></body></html>`
    await janela.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    await new Promise((r) => setTimeout(r, 300))
    const imagem = await janela.webContents.capturePage({ x: 0, y: 0, width: tamanho, height: tamanho })
    const png = imagem.resize({ width: tamanho, height: tamanho, quality: 'best' }).toPNG()
    if (destino) fs.writeFileSync(path.resolve(destino), png)
    else pngsIco.push([tamanho, png])
    janela.destroy()
  }
  // ICO: cabeçalho + diretório + PNGs (formato aceito desde o Windows Vista).
  const cabecalho = Buffer.alloc(6)
  cabecalho.writeUInt16LE(0, 0)
  cabecalho.writeUInt16LE(1, 2)
  cabecalho.writeUInt16LE(pngsIco.length, 4)
  let deslocamento = 6 + 16 * pngsIco.length
  const entradas = pngsIco.map(([t, png]) => {
    const e = Buffer.alloc(16)
    e.writeUInt8(t >= 256 ? 0 : t, 0)
    e.writeUInt8(t >= 256 ? 0 : t, 1)
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(png.length, 8)
    e.writeUInt32LE(deslocamento, 12)
    deslocamento += png.length
    return e
  })
  fs.writeFileSync(path.resolve('build/icon.ico'), Buffer.concat([cabecalho, ...entradas, ...pngsIco.map(([, png]) => png)]))
}, SVG)
await app.close()
console.log('Ícones gerados: build/icon.png, build/icon.ico e resources/icon.png')
