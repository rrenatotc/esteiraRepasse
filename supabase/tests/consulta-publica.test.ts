// RN10: consulta pública só pelo service_role, campos enxutos, rate limit.
// RF04: corrigir_venda.
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { como, criarBanco, criarLojista, criarUsuario, criarVeiculo, idLoja } from './banco'

let db: PGlite
let repasse: string
let vendedor: string
let outro: string
let loja: number
let lojista: string

beforeAll(async () => {
  db = await criarBanco()
  repasse = await criarUsuario(db, { email: 'renato@x.com', papel: 'repasse' })
  vendedor = await criarUsuario(db, { email: 'ana@x.com', papel: 'vendedor', loja: '2.1' })
  outro = await criarUsuario(db, { email: 'rui@x.com', papel: 'vendedor', loja: '2.2' })
  loja = await idLoja(db, '4.2')
  lojista = await criarLojista(db)
})

async function venda(placa: string): Promise<string> {
  const veiculo = await criarVeiculo(db, placa)
  return como(db, { uid: vendedor }, async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      `insert into public.demandas (veiculo_id, lojista_id, loja_proposta_id, valor_venda, observacao)
       values ($1, $2, $3, 68500, 'segredo interno') returning id`,
      [veiculo, lojista, loja]
    )
    return rows[0].id
  })
}

const avancar = (id: string, para: string, dados: object = {}, comentario: string | null = null): Promise<unknown> =>
  como(db, { uid: repasse }, (tx) =>
    tx.query(`select public.avancar_status($1, $2::public.status_demanda, $3::jsonb, $4)`, [id, para, JSON.stringify(dados), comentario])
  )

const consultar = (placa: string): Promise<Record<string, unknown> | null> =>
  como(db, 'service_role', async (tx) => (await tx.query<{ r: Record<string, unknown> | null }>(`select public.consultar_placa_publica($1) r`, [placa])).rows[0].r)

describe('consultar_placa_publica', () => {
  it('devolve só os campos da RN10, sem valor, lojista, vendedor nem comentários', async () => {
    const id = await venda('PUB1234')
    await avancar(id, 'em_proposta')
    await avancar(id, 'proposta_emitida', { numero_proposta: '48213', data_emissao_proposta: '2026-10-18' })
    await avancar(id, 'faturada', { numero_nf: '10442', data_emissao_nf: '2026-10-21' })

    const r = await consultar('pub-1c34') // formato Mercosul da placa antiga
    expect(Object.keys(r!).sort()).toEqual(
      ['data_emissao_nf', 'data_emissao_proposta', 'linha_do_tempo', 'loja', 'marca', 'modelo', 'numero_nf', 'numero_proposta', 'placa', 'status'].sort()
    )
    expect(r).toMatchObject({
      placa: 'PUB1234',
      status: 'faturada',
      numero_nf: '10442',
      data_emissao_nf: '2026-10-21',
      loja: { codigo: '4.2', nome: 'Premiere Canoas' }
    })
    const texto = JSON.stringify(r)
    for (const proibido of ['68500', 'segredo', 'Auto JK', '11222333000181', 'ana@', 'renato', vendedor, repasse]) {
      expect(texto).not.toContain(proibido)
    }
    const linha = r!.linha_do_tempo as { status: string; em: string }[]
    expect(linha.map((e) => e.status)).toEqual(['nova', 'em_proposta', 'proposta_emitida', 'faturada'])
    expect(Object.keys(linha[0]).sort()).toEqual(['em', 'status'])
  })

  it('busca exata: placa parcial ou inexistente não acha nada', async () => {
    expect(await consultar('PUB')).toBeNull()
    expect(await consultar('ZZZ9Z99')).toBeNull()
  })

  it('mostra a demanda mais recente da placa', async () => {
    const primeira = await venda('REC1A11')
    await avancar(primeira, 'cancelada', {}, 'desistiu')
    const veiculo = (await db.query<{ id: string }>(`select id from public.veiculos where placa = 'REC1A11'`)).rows[0].id
    await como(db, { uid: vendedor }, (tx) =>
      tx.query(`insert into public.demandas (veiculo_id, lojista_id, loja_proposta_id, valor_venda) values ($1, $2, $3, 1)`, [veiculo, lojista, loja])
    )
    expect((await consultar('REC1A11'))!.status).toBe('nova')
  })

  it('anon e autenticados não executam nem leem o log', async () => {
    await expect(como(db, 'anon', (tx) => tx.query(`select public.consultar_placa_publica('PUB1234')`))).rejects.toThrow(/permission denied/)
    await expect(como(db, { uid: repasse }, (tx) => tx.query(`select public.consultar_placa_publica('PUB1234')`))).rejects.toThrow(
      /permission denied/
    )
    await expect(como(db, { uid: repasse }, (tx) => tx.query(`select * from public.consulta_publica_log`))).rejects.toThrow(/permission denied/)
  })
})

describe('registrar_consulta_publica (rate limit)', () => {
  const registrar = (chave: string, ip: string): Promise<boolean> =>
    como(db, 'service_role', async (tx) =>
      (await tx.query<{ ok: boolean }>(`select public.registrar_consulta_publica($1, $2, 'ABC1D23') ok`, [chave, ip])).rows[0].ok
    )

  it('20 por instalação por minuto, sem travar outro PC da mesma rede', async () => {
    for (let i = 0; i < 20; i++) expect(await registrar('pc-1', 'ip-1')).toBe(true)
    expect(await registrar('pc-1', 'ip-1')).toBe(false)
    expect(await registrar('pc-2', 'ip-1')).toBe(true)
  })

  it('200 por IP por minuto', async () => {
    await db.query(
      `insert into public.consulta_publica_log (chave_hash, ip_hash, placa_busca) select 'pc-' || g, 'ip-cheio', 'X' from generate_series(1, 200) g`
    )
    expect(await registrar('pc-novo', 'ip-cheio')).toBe(false)
  })

  it('consultas de mais de 1 minuto não contam', async () => {
    await db.query(`update public.consulta_publica_log set created_at = now() - interval '2 minutes' where chave_hash = 'pc-1'`)
    expect(await registrar('pc-1', 'ip-1')).toBe(true)
  })
})

describe('consulta_publica (uma chamada só)', () => {
  const chamar = (chave: string): Promise<{ permitido: boolean; resultado: { status: string } | null }> =>
    como(db, 'service_role', async (tx) =>
      (await tx.query<{ r: { permitido: boolean; resultado: { status: string } | null } }>(`select public.consulta_publica($1, 'ip-x', 'PUB-1234') r`, [chave])).rows[0].r
    )

  it('aplica o limite e devolve o resultado', async () => {
    expect((await chamar('pc-unica')).resultado?.status).toBe('faturada')
    for (let i = 0; i < 19; i++) await chamar('pc-unica')
    expect(await chamar('pc-unica')).toEqual({ permitido: false, resultado: null })
  })

  it('anon não executa', async () => {
    await expect(como(db, 'anon', (tx) => tx.query(`select public.consulta_publica('a', 'b', 'PUB1234')`))).rejects.toThrow(/permission denied/)
  })
})

describe('corrigir_venda', () => {
  type Linha = { status: string; valor_venda: string; lojista_id: string }
  const corrigir = (uid: string, id: string, valor: string, extra: { lojistaId?: string | null; novo?: object } = {}): Promise<Linha> =>
    como(db, { uid }, async (tx) => {
      const { rows } = await tx.query<Linha>(
        `select status, valor_venda::text, lojista_id from public.corrigir_venda($1, $2::smallint, $3::numeric, 'corrigido', $4::uuid, $5::jsonb)`,
        [id, loja, valor, extra.lojistaId === undefined ? lojista : extra.lojistaId, extra.novo ? JSON.stringify(extra.novo) : null]
      )
      return rows[0]
    })

  it('corrige pendência, troca lojista e reenvia ao repasse', async () => {
    const id = await venda('COR1A11')
    await avancar(id, 'em_proposta')
    await avancar(id, 'pendente', {}, 'CPF do lojista errado')
    const r = await corrigir(vendedor, id, '70000.50', {
      lojistaId: null,
      novo: { tipo: 'cpf', documento: '529.982.247-25', razao_social: 'Fulano' }
    })
    expect(r).toMatchObject({ status: 'nova', valor_venda: '70000.50' })
    expect(r.lojista_id).not.toBe(lojista)
    const { rows } = await db.query<{ para_status: string; comentario: string }>(
      `select para_status, comentario from public.demanda_eventos where demanda_id = $1 order by id desc limit 1`,
      [id]
    )
    expect(rows[0]).toEqual({ para_status: 'nova', comentario: 'Corrigida pelo vendedor' })
  })

  it('edita em nova sem mudar o status', async () => {
    const id = await venda('COR2A22')
    expect((await corrigir(vendedor, id, '1.00')).status).toBe('nova')
  })

  it('não corrige depois de assumida, nem venda de outro vendedor', async () => {
    const id = await venda('COR3A33')
    await expect(corrigir(outro, id, '1')).rejects.toThrow(/não pode mais ser alterada por você/)
    await avancar(id, 'em_proposta')
    await expect(corrigir(vendedor, id, '1')).rejects.toThrow(/não pode mais ser alterada por você/)
  })
})
