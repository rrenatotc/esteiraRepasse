// registrar_venda: veículo do estoque ou manual, lojista existente ou novo,
// tudo numa transação e respeitando a RLS de quem chama.
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { como, criarBanco, criarLojista, criarUsuario, criarVeiculo, idLoja } from './banco'

let db: PGlite
let vendedor: string
let inativo: string
let loja: number
let lojista: string

beforeAll(async () => {
  db = await criarBanco()
  vendedor = await criarUsuario(db, { email: 'ana@x.com', papel: 'vendedor', loja: '2.1' })
  inativo = await criarUsuario(db, { email: 'saiu@x.com', papel: 'vendedor', ativo: false })
  loja = await idLoja(db, '4.2')
  lojista = await criarLojista(db)
})

interface Args {
  placa: string
  valor?: string
  manual?: Record<string, unknown> | null
  lojistaId?: string | null
  lojistaNovo?: Record<string, unknown> | null
  uid?: string
}

function registrar(a: Args): Promise<{ id: string; codigo: number; status: string; veiculo_id: string; lojista_id: string; valor_venda: string }> {
  return como(db, { uid: a.uid ?? vendedor }, async (tx) => {
    const { rows } = await tx.query<{ id: string; codigo: number; status: string; veiculo_id: string; lojista_id: string; valor_venda: string }>(
      `select id, codigo, status, veiculo_id, lojista_id, valor_venda::text
       from public.registrar_venda($1, $2::smallint, $3::numeric, 'obs', $4::jsonb, $5::uuid, $6::jsonb)`,
      [
        a.placa,
        loja,
        a.valor ?? '68500.00',
        a.manual ? JSON.stringify(a.manual) : null,
        a.lojistaId === undefined ? lojista : a.lojistaId,
        a.lojistaNovo ? JSON.stringify(a.lojistaNovo) : null
      ]
    )
    return rows[0]
  })
}

const contar = async (tabela: string): Promise<number> =>
  (await db.query<{ n: number }>(`select count(*)::int n from public.${tabela}`)).rows[0].n

describe('registrar_venda', () => {
  it('usa o veículo do estoque, casando placa antiga com Mercosul', async () => {
    const veiculo = await criarVeiculo(db, 'EST1234')
    const d = await registrar({ placa: 'est-1c34' })
    expect(d).toMatchObject({ status: 'nova', veiculo_id: veiculo, lojista_id: lojista, valor_venda: '68500.00' })
  })

  it('cadastra veículo manual quando a placa não está no estoque', async () => {
    const d = await registrar({ placa: 'MAN1A11', manual: { marca: 'Fiat', modelo: 'Uno', ano_fabricacao: '2015', ano_modelo: '2016', cor: 'Branco' } })
    const { rows } = await db.query<{ origem: string; em_estoque: boolean; created_by: string; ano_modelo: number }>(
      `select origem, em_estoque, created_by, ano_modelo from public.veiculos where id = $1`,
      [d.veiculo_id]
    )
    expect(rows[0]).toEqual({ origem: 'manual', em_estoque: false, created_by: vendedor, ano_modelo: 2016 })
  })

  it('pede os dados do veículo quando a placa não existe e não veio cadastro manual', async () => {
    await expect(registrar({ placa: 'NAO1A11' })).rejects.toThrow('Placa não encontrada no estoque. Preencha marca e modelo do veículo.')
  })

  it('cadastra lojista novo e reaproveita se já existir pelo documento', async () => {
    await criarVeiculo(db, 'LOJ1A11')
    await criarVeiculo(db, 'LOJ2A22')
    const novo = { tipo: 'cnpj', documento: '12.ABC.345/01DE-35', razao_social: 'Nova Era Veículos', uf: 'rs', origem: 'brasilapi' }
    const d1 = await registrar({ placa: 'LOJ1A11', lojistaId: null, lojistaNovo: novo })
    const d2 = await registrar({ placa: 'LOJ2A22', lojistaId: null, lojistaNovo: novo })
    expect(d2.lojista_id).toBe(d1.lojista_id)
    const { rows } = await db.query<{ documento: string; uf: string; origem: string }>(
      `select documento, uf, origem from public.lojistas where id = $1`,
      [d1.lojista_id]
    )
    expect(rows[0]).toEqual({ documento: '12ABC34501DE35', uf: 'RS', origem: 'brasilapi' })
  })

  it('placa com venda aberta desfaz tudo: nem veículo manual nem lojista ficam gravados', async () => {
    await registrar({ placa: 'DUP1A11', manual: { marca: 'Fiat', modelo: 'Uno' } })
    const veiculosAntes = await contar('veiculos')
    const lojistasAntes = await contar('lojistas')
    await expect(
      registrar({
        placa: 'DUP1A11',
        lojistaId: null,
        lojistaNovo: { tipo: 'cpf', documento: '529.982.247-25', razao_social: 'Fulano de Tal' }
      })
    ).rejects.toThrow(/Já existe uma venda aberta para a placa DUP1A11/)
    expect(await contar('veiculos')).toBe(veiculosAntes)
    expect(await contar('lojistas')).toBe(lojistasAntes)
  })

  it('valida valor, placa e documento', async () => {
    await criarVeiculo(db, 'VAL1A11')
    await expect(registrar({ placa: 'VAL1A11', valor: '0' })).rejects.toThrow('O valor de venda precisa ser maior que zero.')
    await expect(registrar({ placa: 'XYZ' })).rejects.toThrow('Placa inválida. Use o padrão ABC1234 ou ABC1D23.')
    await expect(
      registrar({ placa: 'VAL1A11', lojistaId: null, lojistaNovo: { tipo: 'cpf', documento: '52998224724', razao_social: 'X' } })
    ).rejects.toThrow(/ck_lojistas_documento_valido/)
  })

  it('usuário inativo não registra', async () => {
    await criarVeiculo(db, 'INA1A11')
    await expect(registrar({ placa: 'INA1A11', uid: inativo })).rejects.toThrow('Sessão expirada ou usuário inativo. Entre novamente.')
  })

  it('anon não executa', async () => {
    await expect(
      como(db, 'anon', (tx) => tx.query(`select public.registrar_venda('ABC1D23', 1::smallint, 10)`))
    ).rejects.toThrow(/permission denied/)
  })
})
