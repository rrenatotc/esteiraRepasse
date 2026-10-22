import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

// Em dev o HMR do Vite precisa de ws://localhost na CSP; no build sai.
function cspPorAmbiente(): Plugin {
  return {
    name: 'esteira-csp',
    transformIndexHtml(html, ctx) {
      return html.replace('__CSP_DEV__', ctx.server ? 'ws://localhost:* http://localhost:*' : '')
    }
  }
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react(), tailwindcss(), cspPorAmbiente()]
  }
})
