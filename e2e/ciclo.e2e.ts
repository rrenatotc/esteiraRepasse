// E2E da seção 10: vendedor registra → repasse assume → registra proposta →
// fatura → visitante sem login consulta a placa e vê "Faturada" com a NF e
// sem valor.
//
// Roda contra o Supabase configurado no .env e DEIXA uma demanda faturada no
// banco. Use um projeto de desenvolvimento, não o de produção.
//
//   npx electron-vite build
//   $env:E2E_VENDEDOR_EMAIL="..." ; $env:E2E_VENDEDOR_SENHA="..."
//   $env:E2E_REPASSE_EMAIL="..."  ; $env:E2E_REPASSE_SENHA="..."
//   $env:E2E_PLACA="ABC1D23"   # placa do estoque sem venda aberta
//   npm run e2e
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const env = {
  vendedorEmail: process.env.E2E_VENDEDOR_EMAIL,
  vendedorSenha: process.env.E2E_VENDEDOR_SENHA,
  repasseEmail: process.env.E2E_REPASSE_EMAIL,
  repasseSenha: process.env.E2E_REPASSE_SENHA,
  placa: process.env.E2E_PLACA
}
const configurado = Object.values(env).every(Boolean)

/** Cada papel numa instância isolada (perfil próprio, sessão própria). */
async function abrir(): Promise<{ app: ElectronApplication; janela: Page }> {
  const perfil = mkdtempSync(join(tmpdir(), 'esteira-e2e-'))
  const app = await electron.launch({ args: ['.', `--user-data-dir=${perfil}`] })
  const janela = await app.firstWindow()
  await janela.waitForLoadState('domcontentloaded')
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 900))
  return { app, janela }
}

async function entrar(janela: Page, email: string, senha: string): Promise<void> {
  await janela.evaluate(() => (location.hash = '#/entrar'))
  await janela.getByLabel('E-mail').fill(email)
  await janela.getByLabel('Senha').fill(senha)
  await janela.getByRole('button', { name: 'Entrar' }).click()
  await expect(janela.getByRole('navigation', { name: 'Principal' })).toBeVisible({ timeout: 20_000 })
}

test.skip(!configurado, 'Defina E2E_VENDEDOR_EMAIL/SENHA, E2E_REPASSE_EMAIL/SENHA e E2E_PLACA')
test.setTimeout(180_000)

test('ciclo completo até a consulta pública', async () => {
  const numeroNf = `E2E-${Date.now()}`

  // 1. Vendedor registra a venda.
  const vendedor = await abrir()
  await entrar(vendedor.janela, env.vendedorEmail!, env.vendedorSenha!)
  const v = vendedor.janela
  await v.evaluate(() => (location.hash = '#/app/vendas/nova'))
  await v.getByLabel('Placa do veículo').fill(env.placa!)
  await expect(v.getByRole('button', { name: 'Continuar' })).toBeEnabled({ timeout: 15_000 })
  await v.getByRole('button', { name: 'Continuar' }).click()
  await v.getByLabel('CPF ou CNPJ').fill('52998224725')
  const nome = v.getByLabel('Nome completo', { exact: true })
  if (await nome.isVisible({ timeout: 5_000 }).catch(() => false)) await nome.fill('Comprador E2E')
  await v.getByRole('button', { name: 'Continuar' }).click()
  await v.getByLabel('Valor de venda').fill('68500')
  await v.getByLabel('Loja da proposta').selectOption({ index: 1 })
  await v.getByRole('button', { name: 'Revisar' }).click()
  await v.getByRole('button', { name: 'Registrar venda' }).click()
  const titulo = v.getByRole('heading', { name: /Venda registrada: REP-\d+/ })
  await expect(titulo).toBeVisible({ timeout: 20_000 })
  const codigo = (await titulo.innerText()).match(/REP-\d+/)![0]
  await vendedor.app.close()

  // 2. Repasse assume, registra proposta e fatura pela fila (com atalhos).
  const repasse = await abrir()
  await entrar(repasse.janela, env.repasseEmail!, env.repasseSenha!)
  const r = repasse.janela
  await r.evaluate(() => (location.hash = '#/app/fila'))
  await r.locator('[data-id]', { hasText: codigo }).click()
  const detalhe = r.getByRole('complementary', { name: 'Detalhe da demanda' })
  await r.keyboard.press('a')
  await expect(detalhe.locator('header')).toContainText('Em proposta', { timeout: 15_000 })
  await r.keyboard.press('p')
  await r.getByLabel('Número da proposta').fill('E2E-PROPOSTA')
  await detalhe.getByRole('button', { name: 'Registrar proposta' }).click()
  await expect(detalhe.locator('header')).toContainText('Proposta emitida', { timeout: 15_000 })
  await r.keyboard.press('f')
  await r.getByLabel('Número da NF').fill(numeroNf)
  await detalhe.getByRole('button', { name: 'Faturar' }).click()
  await expect(detalhe.locator('header')).toContainText('Faturada', { timeout: 15_000 })
  await repasse.app.close()

  // 3. Visitante sem login consulta a placa.
  const visitante = await abrir()
  const p = visitante.janela
  await p.getByLabel('Placa do veículo').fill(env.placa!)
  await p.getByRole('button', { name: 'Consultar' }).click()
  const resultado = p.locator('section[aria-live]')
  await expect(resultado).toContainText('Faturada', { timeout: 15_000 })
  await expect(resultado).toContainText(numeroNf)
  await expect(resultado).not.toContainText('R$')
  await expect(resultado).not.toContainText('Comprador E2E')
  await visitante.app.close()
})
