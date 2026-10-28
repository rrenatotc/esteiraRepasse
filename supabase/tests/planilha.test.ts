// Planilha de vendas: linha nasce com a venda, todos veem, só o dono (ou
// repasse/gestão) edita, e excluir cancela a venda.
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { como, criarBanco, criarLojista, criarUsuario, criarVeiculo, idLoja } from './banco'

let db: PGlite
let repasse: string
let vendedorA: string
let vendedorB: string
let lojista: string
let loja: number

beforeAll(async () => {
  db = await criarBanco()
  repasse = await criarUsuario(db, { email: 'renato@x.com', papel: 'repasse' })
  vendedorA = await criarUsuario(db, { email: 'ana@x.com', papel: 'vendedor', loja: '2.1' })
  vendedorB = await criarUsuario(db, { email: 'rui@x.com', papel: 'vendedor', loja: '4.2' })
  lojista = await criarLojista(db)
  loja = await idLoja(db, '4.2')
})

interface Linha {
  demanda_id: string
  anunciante: string | null
  placa: string
  veiculo: string | null
  ano: string | null
  fipe: string | null
  valor_compra: string | null
  valor_vendido: string | null
  classificacao: string | null
  tipo_venda: string | null
  lojista: string | null
  faturado: string | null
  repassador: string | null
  excluida_em: string | null
  motivo_exclusao: string | null
}

async function registrar(
  uid: string,
  placa: string,
  planilha: Record<string, unknown> | null = null
): Promise<string> {
  await criarVeiculo(db, placa)
  return como(db, { uid }, async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      `select id from public.registrar_venda($1, $2::smallint, '68500.00', null, null, $3::uuid, null, $4::jsonb)`,
      [placa, loja, lojista, planilha ? JSON.stringify(planilha) : null]
    )
    return rows[0].id
  })
}

const linha = async (uid: string, id: string): Promise<Linha | undefined> =>
  como(db, { uid }, async (tx) => {
    const { rows } = await tx.query<Linha>(
      `select *, fipe::text, valor_compra::text, valor_vendido::text from public.planilha_vendas where demanda_id = $1`,
      [id]
    )
    return rows[0]
  })

const editar = (uid: string, id: string, dados: Record<string, unknown>): Promise<unknown> =>
  como(db, { uid }, (tx) =>
    tx.query(`select public.editar_linha_planilha($1, $2::jsonb)`, [id, JSON.stringify(dados)])
  )

const excluir = (uid: string, id: string, motivo: string | null): Promise<unknown> =>
  como(db, { uid }, (tx) => tx.query(`select public.excluir_linha_planilha($1, $2)`, [id, motivo]))

const status = async (id: string): Promise<string> =>
  (await db.query<{ status: string }>(`select status from public.demandas where id = $1`, [id]))
    .rows[0].status

describe('planilha_vendas', () => {
  it('registrar venda cria a linha com dados do sistema e os campos do vendedor', async () => {
    const id = await registrar(vendedorA, 'PLA1A11', {
      fipe: '81954',
      valor_compra: '64000',
      classificacao: 'd',
      tipo_venda: 'grupo',
      anunciante: 'Porto Alegre',
      placa: 'XXX9999' // ignorado: placa vem do sistema
    })
    expect(await linha(vendedorA, id)).toMatchObject({
      placa: 'PLA1A11',
      anunciante: 'PORTO ALEGRE',
      veiculo: 'POLO HIGHLINE',
      ano: '2021/2021',
      fipe: '81954.00',
      valor_compra: '64000.00',
      valor_vendido: '68500.00',
      classificacao: 'D',
      tipo_venda: 'GRUPO',
      lojista: 'AUTO JK LTDA',
      faturado: null,
      excluida_em: null
    })
  })

  it('todo usuário ativo vê as linhas de outros vendedores', async () => {
    const id = await registrar(vendedorA, 'PLA2A22')
    expect(await linha(vendedorB, id)).toBeDefined()
  })

  it('só o dono, o repasse ou a gestão editam', async () => {
    const id = await registrar(vendedorA, 'PLA3A33')
    await expect(editar(vendedorB, id, { fipe: '1' })).rejects.toThrow(/Só o vendedor da venda/)
    await editar(vendedorA, id, {
      fipe: '50.000,00'.replace(/\./g, '').replace(',', '.'),
      repassador: 'joão'
    })
    await editar(repasse, id, { faturado: 'sim' })
    expect(await linha(vendedorA, id)).toMatchObject({
      fipe: '50000.00',
      repassador: 'JOÃO',
      faturado: 'SIM'
    })
    await expect(editar(vendedorA, id, { tipo_venda: 'outro' })).rejects.toThrow(
      'Tipo de venda deve ser GRUPO ou PACOTE.'
    )
    await expect(editar(vendedorA, id, { fipe: 'abc' })).rejects.toThrow(/Valor inválido em "fipe"/)
  })

  it('ninguém escreve direto na tabela', async () => {
    const id = await registrar(vendedorA, 'PLA4A44')
    await expect(
      como(db, { uid: vendedorA }, (tx) =>
        tx.query(`update public.planilha_vendas set fipe = 1 where demanda_id = $1`, [id])
      )
    ).rejects.toThrow(/permission denied/)
  })

  it('excluir cancela a venda e tira a linha da planilha', async () => {
    const id = await registrar(vendedorA, 'PLA5A55')
    await expect(excluir(vendedorA, id, '  ')).rejects.toThrow(
      'Informe o motivo para excluir a venda.'
    )
    await expect(excluir(vendedorB, id, 'caiu')).rejects.toThrow(/Só o vendedor da venda/)
    await excluir(vendedorA, id, 'Cliente desistiu')
    expect(await status(id)).toBe('cancelada')
    expect(await linha(vendedorA, id)).toMatchObject({ motivo_exclusao: 'Cliente desistiu' })
    expect((await linha(vendedorA, id))?.excluida_em).not.toBeNull()
    const { rows } = await db.query<{ para_status: string; autor_id: string }>(
      `select para_status, autor_id from public.demanda_eventos where demanda_id = $1 order by id desc limit 1`,
      [id]
    )
    expect(rows).toEqual([{ para_status: 'cancelada', autor_id: vendedorA }])
  })

  it('cancelamento pelo repasse e faturamento refletem na linha; faturada só o repasse exclui', async () => {
    const cancelada = await registrar(vendedorA, 'PLA6A66')
    await como(db, { uid: repasse }, (tx) =>
      tx.query(`select public.avancar_status($1, 'cancelada', '{}'::jsonb, 'Sem crédito')`, [
        cancelada
      ])
    )
    expect(await linha(vendedorA, cancelada)).toMatchObject({ motivo_exclusao: 'Sem crédito' })

    const faturada = await registrar(vendedorA, 'PLA7A77')
    await como(db, { uid: repasse }, async (tx) => {
      await tx.query(`select public.avancar_status($1, 'em_proposta')`, [faturada])
      await tx.query(
        `select public.avancar_status($1, 'proposta_emitida', '{"numero_proposta":"1","data_emissao_proposta":"2026-10-20"}'::jsonb)`,
        [faturada]
      )
      await tx.query(
        `select public.avancar_status($1, 'faturada', '{"numero_nf":"9","data_emissao_nf":"2026-10-21"}'::jsonb)`,
        [faturada]
      )
    })
    expect(await linha(vendedorA, faturada)).toMatchObject({ faturado: 'SIM' })
    await expect(excluir(vendedorA, faturada, 'caiu')).rejects.toThrow(/já foi faturada/)
    await excluir(repasse, faturada, 'Distrato')
    expect(await status(faturada)).toBe('faturada')
    expect((await linha(vendedorA, faturada))?.excluida_em).not.toBeNull()
  })

  it('correção do valor pelo vendedor atualiza a linha', async () => {
    const id = await registrar(vendedorA, 'PLA8A88')
    await como(db, { uid: vendedorA }, (tx) =>
      tx.query(`select public.corrigir_venda($1, $2::smallint, '70000', null, $3::uuid)`, [
        id,
        loja,
        lojista
      ])
    )
    expect(await linha(vendedorA, id)).toMatchObject({ valor_vendido: '70000.00' })
  })
})
