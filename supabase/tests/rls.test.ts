// RLS por papel (seção 5.2), incluindo anon sem acesso a nenhuma tabela.
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { como, criarBanco, criarLojista, criarUsuario, criarVeiculo, idLoja, type Quem } from './banco'

const TABELAS = [
  'lojas',
  'perfis',
  'lojistas',
  'veiculos',
  'importacoes_estoque',
  'demandas',
  'demanda_eventos'
]

let db: PGlite
let repasse: string
let gestor: string
let vendedorA: string
let vendedorB: string
let inativo: string
let demandaA: string

beforeAll(async () => {
  db = await criarBanco()
  repasse = await criarUsuario(db, { email: 'renato@x.com', papel: 'repasse' })
  gestor = await criarUsuario(db, { email: 'gestor@x.com', papel: 'gestor' })
  vendedorA = await criarUsuario(db, { email: 'ana@x.com', papel: 'vendedor', loja: '2.1' })
  vendedorB = await criarUsuario(db, { email: 'rui@x.com', papel: 'vendedor', loja: '4.2' })
  inativo = await criarUsuario(db, { email: 'saiu@x.com', papel: 'vendedor', ativo: false })

  const veiculo = await criarVeiculo(db, 'RLS1A11')
  const lojista = await criarLojista(db)
  const loja = await idLoja(db, '2.1')
  demandaA = await como(db, { uid: vendedorA }, async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      `insert into public.demandas (veiculo_id, lojista_id, loja_proposta_id, valor_venda) values ($1, $2, $3, 100) returning id`,
      [veiculo, lojista, loja]
    )
    return rows[0].id
  })
  await db.query(
    `insert into public.importacoes_estoque (arquivo, autor_id) values ('estoque.xls', $1)`,
    [repasse]
  )
})

async function contar(quem: Quem, tabela: string): Promise<number> {
  return como(db, quem, async (tx) => {
    const { rows } = await tx.query<{ n: number }>(`select count(*)::int n from public.${tabela}`)
    return rows[0].n
  })
}

describe('anon', () => {
  it.each(TABELAS)('não lê %s', async (tabela) => {
    await expect(contar('anon', tabela)).rejects.toThrow(/permission denied/)
  })

  it('não executa RPCs nem helpers', async () => {
    await expect(
      como(db, 'anon', (tx) => tx.query(`select public.avancar_status($1, 'em_proposta')`, [demandaA]))
    ).rejects.toThrow(/permission denied/)
    await expect(
      como(db, 'anon', (tx) => tx.query(`select * from public.verificar_placa_aberta('RLS1A11')`))
    ).rejects.toThrow(/permission denied/)
    await expect(como(db, 'anon', (tx) => tx.query(`select public.papel_atual()`))).rejects.toThrow(
      /permission denied/
    )
  })
})

describe('usuário novo / inativo', () => {
  it('cadastro novo nasce vendedor inativo', async () => {
    const id = await criarUsuario(db, { email: 'novo@x.com' })
    const { rows } = await db.query<{ papel: string; ativo: boolean; nome: string }>(
      `select papel, ativo, nome from public.perfis where id = $1`,
      [id]
    )
    expect(rows[0]).toEqual({ papel: 'vendedor', ativo: false, nome: 'novo' })
  })

  it.each(TABELAS.filter((t) => t !== 'perfis'))('inativo não vê %s', async (tabela) => {
    expect(await contar({ uid: inativo }, tabela)).toBe(0)
  })

  it('inativo não registra venda', async () => {
    const veiculo = await criarVeiculo(db, 'INA1A11')
    const lojista = (await db.query<{ id: string }>(`select id from public.lojistas limit 1`)).rows[0].id
    await expect(
      como(db, { uid: inativo }, (tx) =>
        tx.query(
          `insert into public.demandas (veiculo_id, lojista_id, loja_proposta_id, valor_venda) values ($1, $2, 1, 100)`,
          [veiculo, lojista]
        )
      )
    ).rejects.toThrow(/row-level security/)
  })
})

describe('vendedor', () => {
  it('vê só as próprias demandas e os próprios eventos', async () => {
    expect(await contar({ uid: vendedorA }, 'demandas')).toBe(1)
    expect(await contar({ uid: vendedorB }, 'demandas')).toBe(0)
    expect(await contar({ uid: vendedorA }, 'demanda_eventos')).toBe(1)
    expect(await contar({ uid: vendedorB }, 'demanda_eventos')).toBe(0)
  })

  it('vê só o próprio perfil e não muda o próprio papel', async () => {
    expect(await contar({ uid: vendedorA }, 'perfis')).toBe(1)
    await como(db, { uid: vendedorA }, async (tx) => {
      const r = await tx.query(`update public.perfis set papel = 'repasse' where id = $1 returning id`, [vendedorA])
      expect(r.rows).toHaveLength(0)
    })
  })

  it('lê lojas, veículos e lojistas; não lê importações', async () => {
    expect(await contar({ uid: vendedorA }, 'lojas')).toBe(11)
    expect(await contar({ uid: vendedorA }, 'veiculos')).toBeGreaterThan(0)
    expect(await contar({ uid: vendedorA }, 'lojistas')).toBe(1)
    expect(await contar({ uid: vendedorA }, 'importacoes_estoque')).toBe(0)
  })

  it('cadastra veículo manual fora do estoque, mas não como bravos', async () => {
    await como(db, { uid: vendedorA }, async (tx) => {
      const { rows } = await tx.query<{ origem: string; em_estoque: boolean; created_by: string }>(
        `insert into public.veiculos (placa, marca, modelo) values ('man-1a11', 'Fiat', 'Uno') returning origem, em_estoque, created_by`
      )
      expect(rows[0]).toEqual({ origem: 'manual', em_estoque: false, created_by: vendedorA })
    })
    await expect(
      como(db, { uid: vendedorA }, (tx) =>
        tx.query(`insert into public.veiculos (placa, marca, modelo, origem) values ('MAN2A22', 'Fiat', 'Uno', 'bravos')`)
      )
    ).rejects.toThrow(/permission denied/)
    await expect(
      como(db, { uid: vendedorA }, (tx) =>
        tx.query(`insert into public.veiculos (placa, marca, modelo, em_estoque) values ('MAN3A33', 'Fiat', 'Uno', true)`)
      )
    ).rejects.toThrow(/permission denied/)
  })

  it('placa inválida é rejeitada', async () => {
    await expect(
      como(db, { uid: vendedorA }, (tx) =>
        tx.query(`insert into public.veiculos (placa, marca, modelo) values ('XYZ', 'Fiat', 'Uno')`)
      )
    ).rejects.toThrow('Placa inválida: "XYZ". Use o padrão ABC1234 ou ABC1D23.')
  })

  it('cadastra lojista com documento válido; inválido é barrado', async () => {
    await como(db, { uid: vendedorA }, (tx) =>
      tx.query(`insert into public.lojistas (tipo, documento, razao_social) values ('cnpj', '12ABC34501DE35', 'Nova Era')`)
    )
    await expect(
      como(db, { uid: vendedorA }, (tx) =>
        tx.query(`insert into public.lojistas (tipo, documento, razao_social) values ('cpf', '52998224724', 'Fulano')`)
      )
    ).rejects.toThrow(/ck_lojistas_documento_valido/)
  })

  it('não edita veículo, lojista nem loja', async () => {
    await como(db, { uid: vendedorA }, async (tx) => {
      expect((await tx.query(`update public.veiculos set cor = 'Azul' returning id`)).rows).toHaveLength(0)
      expect((await tx.query(`update public.lojistas set cidade = 'X' returning id`)).rows).toHaveLength(0)
      expect((await tx.query(`update public.lojas set nome = 'X' returning id`)).rows).toHaveLength(0)
    })
  })
})

describe('gestor', () => {
  it('lê tudo', async () => {
    expect(await contar({ uid: gestor }, 'demandas')).toBe(1)
    expect(await contar({ uid: gestor }, 'perfis')).toBeGreaterThanOrEqual(5)
    expect(await contar({ uid: gestor }, 'importacoes_estoque')).toBe(1)
  })

  it('não escreve', async () => {
    await como(db, { uid: gestor }, async (tx) => {
      expect((await tx.query(`update public.perfis set nome = 'x' returning id`)).rows).toHaveLength(0)
      expect((await tx.query(`update public.veiculos set cor = 'x' returning id`)).rows).toHaveLength(0)
    })
    await expect(
      como(db, { uid: gestor }, (tx) => tx.query(`insert into public.lojas (codigo, nome) values ('9.9', 'Teste')`))
    ).rejects.toThrow(/row-level security/)
  })
})

describe('repasse', () => {
  it('lê tudo e gerencia perfis, lojas, veículos e lojistas', async () => {
    expect(await contar({ uid: repasse }, 'demandas')).toBe(1)
    expect(await contar({ uid: repasse }, 'demanda_eventos')).toBe(1)
    await como(db, { uid: repasse }, async (tx) => {
      expect((await tx.query(`update public.perfis set loja_id = 2 where id = $1 returning id`, [vendedorB])).rows).toHaveLength(1)
      expect((await tx.query(`update public.veiculos set cor = 'Branco' where placa = 'RLS1A11' returning id`)).rows).toHaveLength(1)
      expect((await tx.query(`update public.lojistas set cidade = 'Canoas' returning id`)).rows.length).toBeGreaterThan(0)
      await tx.query(`insert into public.lojas (codigo, nome) values ('9.9', 'Teste')`)
    })
  })

  it('não muda status direto, só pela RPC', async () => {
    await expect(
      como(db, { uid: repasse }, (tx) => tx.query(`update public.demandas set status = 'faturada' where id = $1`, [demandaA]))
    ).rejects.toThrow(/permission denied/)
  })

  it('não cria importação direto (só via RPC)', async () => {
    await expect(
      como(db, { uid: repasse }, (tx) =>
        tx.query(`insert into public.importacoes_estoque (arquivo, autor_id) values ('x.xls', $1)`, [repasse])
      )
    ).rejects.toThrow(/permission denied/)
  })

  it('não apaga demandas', async () => {
    await expect(
      como(db, { uid: repasse }, (tx) => tx.query(`delete from public.demandas where id = $1`, [demandaA]))
    ).rejects.toThrow(/permission denied/)
  })
})

describe('perfis: trava do último repasse', () => {
  it('não deixa desativar nem rebaixar o único repasse ativo', async () => {
    await expect(
      como(db, { uid: repasse }, (tx) => tx.query(`update public.perfis set ativo = false where id = $1`, [repasse]))
    ).rejects.toThrow('Precisa existir pelo menos um usuário do repasse ativo.')
    await expect(
      como(db, { uid: repasse }, (tx) => tx.query(`update public.perfis set papel = 'gestor' where id = $1`, [repasse]))
    ).rejects.toThrow('Precisa existir pelo menos um usuário do repasse ativo.')
  })

  it('com outro repasse ativo, pode', async () => {
    const outro = await criarUsuario(db, { email: 'outro-repasse@x.com', papel: 'repasse' })
    await como(db, { uid: repasse }, (tx) => tx.query(`update public.perfis set ativo = false where id = $1`, [outro]))
  })
})

