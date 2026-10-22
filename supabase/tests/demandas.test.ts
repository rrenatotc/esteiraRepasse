// Transições de status (RN05/RN06/RN07), placa aberta única (RN02) e edição
// do vendedor (RN09).
import type { PGlite, Transaction } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { como, criarBanco, criarLojista, criarUsuario, criarVeiculo, idLoja } from './banco'

let db: PGlite
let repasse: string
let vendedorA: string
let vendedorB: string
let gestor: string
let lojista: string
let loja42: number

beforeAll(async () => {
  db = await criarBanco()
  repasse = await criarUsuario(db, { email: 'renato@x.com', papel: 'repasse' })
  vendedorA = await criarUsuario(db, { email: 'ana@x.com', papel: 'vendedor', loja: '2.1' })
  vendedorB = await criarUsuario(db, { email: 'rui@x.com', papel: 'vendedor', loja: '4.2' })
  gestor = await criarUsuario(db, { email: 'gestor@x.com', papel: 'gestor' })
  lojista = await criarLojista(db)
  loja42 = await idLoja(db, '4.2')
})

interface Demanda {
  id: string
  codigo: number
  status: string
  placa: string
  placa_busca: string
  veiculo_snapshot: { marca: string; modelo: string }
  responsavel_id: string | null
}

async function registrarVenda(vendedor: string, placa: string): Promise<Demanda> {
  const veiculo = await criarVeiculo(db, placa)
  return como(db, { uid: vendedor }, async (tx) => {
    const { rows } = await tx.query<Demanda>(
      `insert into public.demandas (veiculo_id, lojista_id, loja_proposta_id, valor_venda)
       values ($1, $2, $3, '68500.00') returning *`,
      [veiculo, lojista, loja42]
    )
    return rows[0]
  })
}

function avancar(
  tx: Transaction,
  id: string,
  para: string,
  dados: Record<string, string> = {},
  comentario: string | null = null
): Promise<{ rows: Demanda[] }> {
  return tx.query<Demanda>(`select * from public.avancar_status($1, $2::public.status_demanda, $3::jsonb, $4)`, [
    id,
    para,
    JSON.stringify(dados),
    comentario
  ])
}

async function eventos(id: string): Promise<{ de_status: string | null; para_status: string; comentario: string | null }[]> {
  const { rows } = await db.query<{ de_status: string | null; para_status: string; comentario: string | null }>(
    `select de_status, para_status, comentario from public.demanda_eventos where demanda_id = $1 order by id`,
    [id]
  )
  return rows
}

describe('registro de venda', () => {
  it('cria com status nova, snapshot do veículo e evento inicial', async () => {
    const d = await registrarVenda(vendedorA, 'abc-1234')
    expect(d.status).toBe('nova')
    expect(d.placa).toBe('ABC1234')
    expect(d.placa_busca).toBe('ABC1C34')
    expect(d.veiculo_snapshot.modelo).toBe('Polo Highline')
    expect(await eventos(d.id)).toEqual([{ de_status: null, para_status: 'nova', comentario: null }])
  })

  it('snapshot não muda quando o cadastro do veículo muda (RN08)', async () => {
    const d = await registrarVenda(vendedorA, 'SNP1A11')
    await db.query(`update public.veiculos set modelo = 'Outro' where placa = 'SNP1A11'`)
    const { rows } = await db.query<Demanda>(`select * from public.demandas where id = $1`, [d.id])
    expect(rows[0].veiculo_snapshot.modelo).toBe('Polo Highline')
  })

  it('vendedor não consegue definir status nem responsável no insert', async () => {
    const veiculo = await criarVeiculo(db, 'STS1A11')
    await expect(
      como(db, { uid: vendedorA }, (tx) =>
        tx.query(
          `insert into public.demandas (veiculo_id, lojista_id, loja_proposta_id, valor_venda, status)
           values ($1, $2, $3, 100, 'faturada')`,
          [veiculo, lojista, loja42]
        )
      )
    ).rejects.toThrow(/permission denied/)
  })

  it('vendedor não registra venda em nome de outro', async () => {
    const veiculo = await criarVeiculo(db, 'OUT1A11')
    await expect(
      como(db, { uid: vendedorA }, (tx) =>
        tx.query(
          `insert into public.demandas (veiculo_id, lojista_id, loja_proposta_id, valor_venda, vendedor_id)
           values ($1, $2, $3, 100, $4)`,
          [veiculo, lojista, loja42, vendedorB]
        )
      )
    ).rejects.toThrow(/permission denied/)
  })

  it('valor precisa ser maior que zero (RN04)', async () => {
    const veiculo = await criarVeiculo(db, 'VAL1A11')
    await expect(
      como(db, { uid: vendedorA }, (tx) =>
        tx.query(
          `insert into public.demandas (veiculo_id, lojista_id, loja_proposta_id, valor_venda) values ($1, $2, $3, 0)`,
          [veiculo, lojista, loja42]
        )
      )
    ).rejects.toThrow(/valor_venda/)
  })
})

describe('placa aberta única (RN02)', () => {
  it('bloqueia segunda venda aberta, mesmo de outro vendedor e no outro formato de placa', async () => {
    const d = await registrarVenda(vendedorA, 'DUP1234')
    const veiculoMercosul = await db.query<{ id: string }>(`select id from public.veiculos where placa = 'DUP1234'`)
    await expect(
      como(db, { uid: vendedorB }, (tx) =>
        tx.query(
          `insert into public.demandas (veiculo_id, lojista_id, loja_proposta_id, valor_venda) values ($1, $2, $3, 100)`,
          [veiculoMercosul.rows[0].id, lojista, loja42]
        )
      )
    ).rejects.toThrow(`Já existe uma venda aberta para a placa DUP1234 (REP-${String(d.codigo).padStart(6, '0')}, nova).`)
  })

  it('índice único garante a regra mesmo sem o trigger', async () => {
    const d = await registrarVenda(vendedorA, 'IDX1A11')
    await db.exec('alter table public.demandas disable trigger trg_demandas_20_checar_placa_aberta')
    try {
      await expect(
        db.query(
          `insert into public.demandas (veiculo_id, lojista_id, loja_proposta_id, valor_venda, vendedor_id)
           select veiculo_id, lojista_id, loja_proposta_id, 1, vendedor_id from public.demandas where id = $1`,
          [d.id]
        )
      ).rejects.toThrow(/uq_demanda_aberta_por_placa/)
    } finally {
      await db.exec('alter table public.demandas enable trigger trg_demandas_20_checar_placa_aberta')
    }
  })

  it('libera nova venda depois de cancelada', async () => {
    const d = await registrarVenda(vendedorA, 'CAN1A11')
    await como(db, { uid: repasse }, (tx) => avancar(tx, d.id, 'cancelada', {}, 'Cliente desistiu'))
    const veiculo = await db.query<{ id: string }>(`select id from public.veiculos where placa = 'CAN1A11'`)
    await como(db, { uid: vendedorA }, (tx) =>
      tx.query(
        `insert into public.demandas (veiculo_id, lojista_id, loja_proposta_id, valor_venda) values ($1, $2, $3, 100)`,
        [veiculo.rows[0].id, lojista, loja42]
      )
    )
  })

  it('verificar_placa_aberta mostra a venda de outro vendedor só com código e status', async () => {
    const d = await registrarVenda(vendedorA, 'VER1A11')
    const r = await como(db, { uid: vendedorB }, (tx) =>
      tx.query<Record<string, unknown>>(`select * from public.verificar_placa_aberta('ver-1a11')`)
    )
    expect(r.rows).toEqual([
      { codigo: `REP-${String(d.codigo).padStart(6, '0')}`, status: 'nova', status_rotulo: 'Nova' }
    ])
  })
})

describe('avancar_status', () => {
  it('ciclo completo nova → concluída com eventos', async () => {
    const d = await registrarVenda(vendedorA, 'CIC1A11')
    await como(db, { uid: repasse }, async (tx) => {
      const assumida = (await avancar(tx, d.id, 'em_proposta')).rows[0]
      expect(assumida.responsavel_id).toBe(repasse)
      await avancar(tx, d.id, 'proposta_emitida', { numero_proposta: '48213', data_emissao_proposta: '2026-10-18' })
      await avancar(tx, d.id, 'faturada', { numero_nf: '10442', data_emissao_nf: '2026-10-21' })
      const fim = (await avancar(tx, d.id, 'concluida')).rows[0]
      expect(fim.status).toBe('concluida')
    })
    expect((await eventos(d.id)).map((e) => `${e.de_status}→${e.para_status}`)).toEqual([
      'null→nova',
      'nova→em_proposta',
      'em_proposta→proposta_emitida',
      'proposta_emitida→faturada',
      'faturada→concluida'
    ])
  })

  it.each([
    ['nova', 'faturada', 'RJA1A11'],
    ['nova', 'concluida', 'RJB1A11'],
    ['nova', 'proposta_emitida', 'RJC1A11']
  ])('rejeita %s → %s', async (_de, para, placa) => {
    const d = await registrarVenda(vendedorA, placa)
    await expect(
      como(db, { uid: repasse }, (tx) =>
        avancar(tx, d.id, para, { numero_proposta: '1', data_emissao_proposta: '2026-10-01', numero_nf: '1', data_emissao_nf: '2026-10-01' })
      )
    ).rejects.toThrow(/Não é possível mudar a demanda/)
  })

  it('estados finais não mudam; faturada não cancela na v1', async () => {
    const d = await registrarVenda(vendedorA, 'FIN1A11')
    await como(db, { uid: repasse }, async (tx) => {
      await avancar(tx, d.id, 'em_proposta')
      await avancar(tx, d.id, 'proposta_emitida', { numero_proposta: '1', data_emissao_proposta: '2026-10-18' })
      await avancar(tx, d.id, 'faturada', { numero_nf: '2', data_emissao_nf: '2026-10-21' })
    })
    await expect(como(db, { uid: repasse }, (tx) => avancar(tx, d.id, 'cancelada', {}, 'x'))).rejects.toThrow(
      /de "Faturada" para "Cancelada"/
    )
    await como(db, { uid: repasse }, (tx) => avancar(tx, d.id, 'concluida'))
    await expect(como(db, { uid: repasse }, (tx) => avancar(tx, d.id, 'pendente', {}, 'x'))).rejects.toThrow(
      /de "Concluída"/
    )
  })

  it('exige número e data da proposta e da NF (RN06)', async () => {
    const d = await registrarVenda(vendedorA, 'OBR1A11')
    await como(db, { uid: repasse }, (tx) => avancar(tx, d.id, 'em_proposta'))
    await expect(como(db, { uid: repasse }, (tx) => avancar(tx, d.id, 'proposta_emitida', { numero_proposta: ' ' }))).rejects.toThrow(
      'Informe o número da proposta.'
    )
    await expect(
      como(db, { uid: repasse }, (tx) => avancar(tx, d.id, 'proposta_emitida', { numero_proposta: '1' }))
    ).rejects.toThrow('Informe a data de emissão da proposta.')
    await expect(
      como(db, { uid: repasse }, (tx) =>
        avancar(tx, d.id, 'proposta_emitida', { numero_proposta: '1', data_emissao_proposta: '31/02/2026' })
      )
    ).rejects.toThrow('Data de emissão da proposta inválida.')
    await como(db, { uid: repasse }, (tx) =>
      avancar(tx, d.id, 'proposta_emitida', { numero_proposta: '1', data_emissao_proposta: '2026-10-18' })
    )
    await expect(como(db, { uid: repasse }, (tx) => avancar(tx, d.id, 'faturada', {}))).rejects.toThrow(
      'Informe o número da NF.'
    )
  })

  it('pendente e cancelada exigem motivo', async () => {
    const d = await registrarVenda(vendedorA, 'MOT1A11')
    await expect(como(db, { uid: repasse }, (tx) => avancar(tx, d.id, 'pendente', {}, '  '))).rejects.toThrow(
      'Informe o motivo para devolver ao vendedor.'
    )
    await expect(como(db, { uid: repasse }, (tx) => avancar(tx, d.id, 'cancelada'))).rejects.toThrow(
      'Informe o motivo para cancelar.'
    )
  })

  it('só o repasse avança; vendedor e gestor não', async () => {
    const d = await registrarVenda(vendedorA, 'PAP1A11')
    await expect(como(db, { uid: vendedorA }, (tx) => avancar(tx, d.id, 'em_proposta'))).rejects.toThrow(
      /Apenas o repasse/
    )
    await expect(como(db, { uid: gestor }, (tx) => avancar(tx, d.id, 'em_proposta'))).rejects.toThrow(
      /Apenas o repasse/
    )
  })

  it('pendência: devolve com motivo, vendedor corrige e reenvia; outro vendedor não', async () => {
    const d = await registrarVenda(vendedorA, 'PEN1A11')
    await como(db, { uid: repasse }, async (tx) => {
      await avancar(tx, d.id, 'em_proposta')
      await avancar(tx, d.id, 'pendente', {}, 'CNPJ do lojista errado')
    })
    await expect(como(db, { uid: vendedorB }, (tx) => avancar(tx, d.id, 'nova'))).rejects.toThrow(
      /Demanda não encontrada|Só o vendedor/
    )
    await expect(como(db, { uid: repasse }, (tx) => avancar(tx, d.id, 'nova'))).rejects.toThrow(/Só o vendedor/)
    await como(db, { uid: vendedorA }, async (tx) => {
      const upd = await tx.query(`update public.demandas set valor_venda = 70000 where id = $1 returning id`, [d.id])
      expect(upd.rows).toHaveLength(1)
      const r = (await avancar(tx, d.id, 'nova')).rows[0]
      expect(r.status).toBe('nova')
    })
    const ev = await eventos(d.id)
    expect(ev.at(-2)).toEqual({ de_status: 'em_proposta', para_status: 'pendente', comentario: 'CNPJ do lojista errado' })
    expect(ev.at(-1)?.para_status).toBe('nova')
  })

  it('demanda inexistente', async () => {
    await expect(
      como(db, { uid: repasse }, (tx) => avancar(tx, '00000000-0000-0000-0000-000000000000', 'em_proposta'))
    ).rejects.toThrow('Demanda não encontrada.')
  })
})

describe('edição do vendedor (RN09)', () => {
  it('edita em nova; não edita depois de assumida; nunca mexe no status direto', async () => {
    const d = await registrarVenda(vendedorA, 'EDT1A11')
    await como(db, { uid: vendedorA }, async (tx) => {
      const r = await tx.query(`update public.demandas set observacao = 'ok' where id = $1 returning id`, [d.id])
      expect(r.rows).toHaveLength(1)
    })
    await expect(
      como(db, { uid: vendedorA }, (tx) => tx.query(`update public.demandas set status = 'faturada' where id = $1`, [d.id]))
    ).rejects.toThrow(/permission denied/)
    await como(db, { uid: repasse }, (tx) => avancar(tx, d.id, 'em_proposta'))
    await como(db, { uid: vendedorA }, async (tx) => {
      const r = await tx.query(`update public.demandas set observacao = 'tarde' where id = $1 returning id`, [d.id])
      expect(r.rows).toHaveLength(0)
    })
  })

  it('vendedor não edita venda de outro', async () => {
    const d = await registrarVenda(vendedorA, 'EDO1A11')
    await como(db, { uid: vendedorB }, async (tx) => {
      const r = await tx.query(`update public.demandas set observacao = 'x' where id = $1 returning id`, [d.id])
      expect(r.rows).toHaveLength(0)
    })
  })
})

describe('histórico imutável (RN07)', () => {
  it('nem o dono do banco altera ou apaga eventos', async () => {
    const d = await registrarVenda(vendedorA, 'IMU1A11')
    await expect(db.query(`update public.demanda_eventos set comentario = 'x' where demanda_id = $1`, [d.id])).rejects.toThrow(
      /não pode ser alterado/
    )
    await expect(db.query(`delete from public.demanda_eventos where demanda_id = $1`, [d.id])).rejects.toThrow(
      /não pode ser alterado/
    )
  })
})

describe('status_desde (RF13)', () => {
  it('muda só quando o status muda', async () => {
    const d = await registrarVenda(vendedorA, 'SDE1A11')
    const desde = async (): Promise<string> =>
      (await db.query<{ s: string }>(`select status_desde::text s from public.demandas where id = $1`, [d.id])).rows[0].s
    await db.query(`update public.demandas set status_desde = now() - interval '2 days' where id = $1`, [d.id])
    const antigo = await desde()
    await db.query(`update public.demandas set observacao = 'x' where id = $1`, [d.id])
    expect(await desde()).toBe(antigo)
    await como(db, { uid: repasse }, (tx) => avancar(tx, d.id, 'em_proposta'))
    expect(await desde()).not.toBe(antigo)
  })

  it('demandas está na publicação do realtime', async () => {
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int n from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'demandas'`
    )
    expect(rows[0].n).toBe(1)
  })
})

