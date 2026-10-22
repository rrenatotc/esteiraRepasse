// sincronizar_estoque / previa_estoque (RN12, RN13, RN14).
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { como, criarBanco, criarUsuario } from './banco'

let db: PGlite
let repasse: string
let vendedor: string
let gestor: string

beforeAll(async () => {
  db = await criarBanco()
  repasse = await criarUsuario(db, { email: 'renato@x.com', papel: 'repasse' })
  vendedor = await criarUsuario(db, { email: 'ana@x.com', papel: 'vendedor' })
  gestor = await criarUsuario(db, { email: 'gestor@x.com', papel: 'gestor' })
})

interface Item {
  placa: string
  marca: string
  modelo: string
  codigo_bravos?: string
  dias_em_estoque?: number
  filial_estoque?: string
  cor?: string
}

const item = (placa: string, extra: Partial<Item> = {}): Item => ({
  placa,
  marca: 'Volkswagen',
  modelo: 'Nivus',
  codigo_bravos: `C${placa}`,
  dias_em_estoque: 10,
  filial_estoque: '2.1',
  ...extra
})

interface Resultado {
  total: number
  novos: number
  atualizados: number
  mantidos: number
  sairam: number
  mesclados: number
  voltaram: number
  bloqueado: boolean
  motivo_bloqueio: string | null
  importacao_id?: number
  forcado?: boolean
}

function sincronizar(itens: Item[], forcar = false, uid = repasse): Promise<Resultado> {
  return como(db, { uid }, async (tx) => {
    const { rows } = await tx.query<{ r: Resultado }>(
      `select public.sincronizar_estoque('estoque.xls', now(), $1::jsonb, $2, 1) r`,
      [JSON.stringify(itens), forcar]
    )
    return rows[0].r
  })
}

function previa(itens: Item[], uid = repasse): Promise<Resultado> {
  return como(db, { uid }, async (tx) => {
    const { rows } = await tx.query<{ r: Resultado }>(`select public.previa_estoque($1::jsonb) r`, [JSON.stringify(itens)])
    return rows[0].r
  })
}

async function veiculo(placa: string): Promise<{ em_estoque: boolean; origem: string; saiu_do_estoque_em: string | null; modelo: string; dias_em_estoque: number | null } | undefined> {
  const { rows } = await db.query<{ em_estoque: boolean; origem: string; saiu_do_estoque_em: string | null; modelo: string; dias_em_estoque: number | null }>(
    `select em_estoque, origem, saiu_do_estoque_em, modelo, dias_em_estoque from public.veiculos where placa_busca = public.placa_para_mercosul($1)`,
    [placa]
  )
  return rows[0]
}

const contarVeiculos = async (): Promise<number> =>
  (await db.query<{ n: number }>(`select count(*)::int n from public.veiculos`)).rows[0].n

describe('sincronizar_estoque', () => {
  it('primeira importação cadastra todos e registra o histórico', async () => {
    const r = await sincronizar([item('AAA1A11'), item('BBB1B11'), item('CCC1C11'), item('DDD1D11')])
    expect(r).toMatchObject({ total: 4, novos: 4, atualizados: 0, sairam: 0, bloqueado: false, forcado: false })
    const { rows } = await db.query<{ novos: number; erros: number; total_linhas: number; autor_id: string }>(
      `select novos, erros, total_linhas, autor_id from public.importacoes_estoque where id = $1`,
      [r.importacao_id]
    )
    expect(rows[0]).toEqual({ novos: 4, erros: 1, total_linhas: 5, autor_id: repasse })
  })

  it('segunda importação: novo, atualizado, mantido e saída — sem apagar nada', async () => {
    const antes = await contarVeiculos()
    const r = await sincronizar([
      item('AAA1A11'), // mantido (só dias mudou)
      item('BBB1B11', { modelo: 'Nivus GTS', dias_em_estoque: 11 }), // atualizado
      item('CCC1C11', { dias_em_estoque: 99 }), // mantido
      item('EEE1E11') // novo
    ])
    expect(r).toMatchObject({ total: 4, novos: 1, atualizados: 1, mantidos: 2, sairam: 1 })
    expect(await veiculo('DDD1D11')).toMatchObject({ em_estoque: false })
    expect((await veiculo('DDD1D11'))?.saiu_do_estoque_em).not.toBeNull()
    expect(await veiculo('BBB1B11')).toMatchObject({ modelo: 'Nivus GTS' })
    expect(await veiculo('CCC1C11')).toMatchObject({ dias_em_estoque: 99 })
    expect(await contarVeiculos()).toBe(antes + 1)
  })

  it('veículo que saiu e volta numa planilha futura volta ao estoque', async () => {
    const r = await sincronizar([item('AAA1A11'), item('BBB1B11', { modelo: 'Nivus GTS' }), item('CCC1C11'), item('EEE1E11'), item('DDD1D11')])
    expect(r).toMatchObject({ voltaram: 1, atualizados: 1, sairam: 0 })
    expect(await veiculo('DDD1D11')).toMatchObject({ em_estoque: true, saiu_do_estoque_em: null })
  })

  it('cadastro manual é mesclado pela placa e vira bravos (RN14), inclusive em outro formato', async () => {
    await como(db, { uid: vendedor }, (tx) =>
      tx.query(`insert into public.veiculos (placa, marca, modelo) values ('MAN-1234', 'Fiat', 'Uno')`)
    )
    expect(await veiculo('MAN1234')).toMatchObject({ origem: 'manual', em_estoque: false })
    const base = ['AAA1A11', 'BBB1B11', 'CCC1C11', 'EEE1E11', 'DDD1D11'].map((p) => item(p))
    const r = await sincronizar([...base, item('MAN1C34', { marca: 'Fiat', modelo: 'Uno Way' })])
    expect(r).toMatchObject({ mesclados: 1, novos: 0 })
    expect(await veiculo('MAN1234')).toMatchObject({ origem: 'bravos', em_estoque: true, modelo: 'Uno Way' })
  })

  it('trava dos 50% bloqueia; forçar aplica e marca como forçado (RN13)', async () => {
    const p = await previa([item('AAA1A11')])
    expect(p.bloqueado).toBe(true)
    expect(p.motivo_bloqueio).toMatch(/menos da metade dos 6 em estoque/)
    await expect(sincronizar([item('AAA1A11')])).rejects.toThrow(/menos da metade/)
    expect(await veiculo('BBB1B11')).toMatchObject({ em_estoque: true })

    const r = await sincronizar([item('AAA1A11'), item('BBB1B11')], true)
    expect(r).toMatchObject({ forcado: true, sairam: 4 })
    const { rows } = await db.query<{ forcado: boolean }>(`select forcado from public.importacoes_estoque where id = $1`, [r.importacao_id])
    expect(rows[0].forcado).toBe(true)
  })

  it('planilha sem nenhum veículo de repasse é bloqueada', async () => {
    const p = await previa([])
    expect(p).toMatchObject({ bloqueado: true, total: 0 })
    expect(p.motivo_bloqueio).toMatch(/nenhum veículo de repasse/)
  })

  it('rejeita placa repetida, placa inválida e marca vazia', async () => {
    await expect(previa([item('AAA1A11'), item('AAA-1011')])).rejects.toThrow('A placa AAA1A11 aparece mais de uma vez na planilha.')
    await expect(previa([item('XYZ')])).rejects.toThrow(/Veículo inválido na planilha \(placa "XYZ"\)/)
    await expect(previa([item('AAA1A11', { marca: ' ' })])).rejects.toThrow(/Veículo inválido/)
  })

  it('só o repasse sincroniza ou vê a prévia', async () => {
    await expect(previa([item('AAA1A11')], vendedor)).rejects.toThrow('Apenas o repasse pode atualizar o estoque.')
    await expect(sincronizar([item('AAA1A11')], false, gestor)).rejects.toThrow('Apenas o repasse pode atualizar o estoque.')
    await expect(
      como(db, 'anon', (tx) => tx.query(`select public.previa_estoque('[]'::jsonb)`))
    ).rejects.toThrow(/permission denied/)
  })

  it('qualquer usuário ativo vê a data da última atualização', async () => {
    const { rows } = await como(db, { uid: vendedor }, (tx) =>
      tx.query<{ em: string | null }>(`select public.estoque_atualizado_em() em`)
    )
    expect(rows[0].em).not.toBeNull()
  })
})
