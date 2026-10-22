// indicadores_painel (RF17).
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { como, criarBanco, criarLojista, criarUsuario, criarVeiculo, idLoja } from './banco'

let db: PGlite
let repasse: string
let gestor: string
let vendedor: string

interface Indicadores {
  registradas: number
  canceladas: number
  faturadas: number
  valor_faturado: number
  ticket_medio: number | null
  horas_ate_faturar: number | null
  pendencias_abertas: number
  abertas_por_status: Record<string, number>
  por_loja: { codigo: string; faturadas: number; valor_faturado: number; registradas: number }[]
  por_mes: { mes: string; faturadas: number; valor_faturado: number }[]
}

beforeAll(async () => {
  db = await criarBanco()
  repasse = await criarUsuario(db, { email: 'renato@x.com', papel: 'repasse' })
  gestor = await criarUsuario(db, { email: 'g@x.com', papel: 'gestor' })
  vendedor = await criarUsuario(db, { email: 'ana@x.com', papel: 'vendedor', loja: '2.1' })
  const lojista = await criarLojista(db)
  const l42 = await idLoja(db, '4.2')
  const l21 = await idLoja(db, '2.1')

  async function venda(placa: string, loja: number, valor: string): Promise<string> {
    const veiculo = await criarVeiculo(db, placa)
    return como(db, { uid: vendedor }, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `insert into public.demandas (veiculo_id, lojista_id, loja_proposta_id, valor_venda) values ($1, $2, $3, $4) returning id`,
        [veiculo, lojista, loja, valor]
      )
      return rows[0].id
    })
  }
  const avancar = (id: string, para: string, dados: object = {}, comentario: string | null = null): Promise<unknown> =>
    como(db, { uid: repasse }, (tx) =>
      tx.query(`select public.avancar_status($1, $2::public.status_demanda, $3::jsonb, $4)`, [id, para, JSON.stringify(dados), comentario])
    )
  async function faturar(id: string, dataNf: string): Promise<void> {
    await avancar(id, 'em_proposta')
    await avancar(id, 'proposta_emitida', { numero_proposta: '1', data_emissao_proposta: dataNf })
    await avancar(id, 'faturada', { numero_nf: '9', data_emissao_nf: dataNf })
  }

  await faturar(await venda('PAA1A11', l42, '100000.00'), '2026-10-05')
  const concluida = await venda('PAB1A11', l42, '50000.50')
  await faturar(concluida, '2026-10-20')
  await avancar(concluida, 'concluida')
  await faturar(await venda('PAC1A11', l21, '30000.00'), '2026-09-10') // mês anterior
  await avancar(await venda('PAD1A11', l21, '1.00'), 'pendente', {}, 'falta CPF')
  await avancar(await venda('PAE1A11', l21, '1.00'), 'cancelada', {}, 'desistiu')
  await venda('PAF1A11', l21, '1.00') // nova
})

const painel = (uid: string, inicio = '2026-10-01', fim = '2026-10-31'): Promise<Indicadores> =>
  como(db, { uid }, async (tx) => (await tx.query<{ r: Indicadores }>(`select public.indicadores_painel($1, $2) r`, [inicio, fim])).rows[0].r)

describe('indicadores_painel', () => {
  it('faturamento pela data da NF, por loja e totais', async () => {
    const r = await painel(gestor)
    expect(r.faturadas).toBe(2)
    expect(Number(r.valor_faturado)).toBe(150000.5)
    expect(Number(r.ticket_medio)).toBe(75000.25)
    expect(r.pendencias_abertas).toBe(1)
    expect(r.abertas_por_status).toMatchObject({ nova: 1, pendente: 1, faturada: 2, em_proposta: 0 })
    const l42 = r.por_loja.find((l) => l.codigo === '4.2')!
    expect(l42).toMatchObject({ faturadas: 2, registradas: 2 })
    expect(Number(l42.valor_faturado)).toBe(150000.5)
    expect(r.por_loja).toHaveLength(11)
    expect(r.horas_ate_faturar).not.toBeNull()
  })

  it('12 meses até o fim do período', async () => {
    const r = await painel(repasse)
    expect(r.por_mes).toHaveLength(12)
    expect(r.por_mes.at(-1)).toMatchObject({ mes: '2026-10', faturadas: 2 })
    expect(r.por_mes.at(-2)).toMatchObject({ mes: '2026-09', faturadas: 1 })
    expect(r.por_mes[0].mes).toBe('2025-11')
  })

  it('período sem nada devolve zeros', async () => {
    const r = await painel(gestor, '2025-01-01', '2025-01-31')
    expect(r).toMatchObject({ faturadas: 0, registradas: 0, ticket_medio: null })
    expect(Number(r.valor_faturado)).toBe(0)
  })

  it('vendedor não vê o painel; período invertido é rejeitado', async () => {
    await expect(painel(vendedor)).rejects.toThrow('Apenas repasse e gestão veem o painel.')
    await expect(painel(gestor, '2026-10-31', '2026-10-01')).rejects.toThrow('Período inválido.')
  })
})
