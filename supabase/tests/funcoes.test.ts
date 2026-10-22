// As funções SQL precisam dar o mesmo resultado das versões TypeScript.
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { cnpjValido, cpfValido, normalizarDocumento } from '../../src/shared/documento'
import { horasUteisEntre } from '../../src/shared/horas-uteis'
import { normalizarPlaca, placaParaMercosul } from '../../src/shared/placa'
import { criarBanco } from './banco'

let db: PGlite
beforeAll(async () => {
  db = await criarBanco()
})

async function sql<T>(consulta: string, params: unknown[]): Promise<T> {
  const { rows } = await db.query<{ r: T }>(consulta, params)
  return rows[0].r
}

const PLACAS = ['abc-1234', 'ABC1D23', ' qrs 2345 ', 'ABC1034', 'abc1934', 'XYZ', '', 'ABCD123', 'ÁBC1234', 'ABC12345']
const DOCUMENTOS = [
  '529.982.247-25',
  '529.982.247-24',
  '111.111.111-11',
  '11.222.333/0001-81',
  '11.222.333/0001-82',
  '12.ABC.345/01DE-35',
  '12abc34501de35',
  '12.ABC.345/01DE-36',
  '12ABC34501DE3A',
  '00000000000000',
  'lixo'
]

describe('paridade SQL × TypeScript', () => {
  it.each(PLACAS)('placa %j', async (placa) => {
    expect(await sql('select public.normalizar_placa($1) r', [placa])).toBe(normalizarPlaca(placa))
    expect(await sql('select public.placa_para_mercosul($1) r', [placa])).toBe(placaParaMercosul(placa))
  })

  it.each(DOCUMENTOS)('documento %j', async (doc) => {
    expect(await sql('select public.normalizar_documento($1) r', [doc])).toBe(normalizarDocumento(doc))
    expect(await sql('select public.validar_cpf($1) r', [doc])).toBe(cpfValido(doc))
    expect(await sql('select public.validar_cnpj($1) r', [doc])).toBe(cnpjValido(doc))
  })

  it.each([
    ['2026-10-22T09:00:00-03:00', '2026-10-22T12:00:00-03:00'],
    ['2026-10-22T06:00:00-03:00', '2026-10-22T20:00:00-03:00'],
    ['2026-10-23T17:00:00-03:00', '2026-10-26T09:00:00-03:00'],
    ['2026-10-19T08:00:00-03:00', '2026-10-21T12:30:00-03:00'],
    ['2026-10-22T12:00:00-03:00', '2026-10-22T09:00:00-03:00']
  ])('horas úteis %s → %s', async (inicio, fim) => {
    const r = await sql<string>('select public.horas_uteis_entre($1, $2)::text r', [inicio, fim])
    expect(Number(r)).toBeCloseTo(horasUteisEntre(new Date(inicio), new Date(fim)), 2)
  })
})

describe('utilitários', () => {
  it('formata código e rótulo', async () => {
    expect(await sql('select public.codigo_demanda(123) r', [])).toBe('REP-000123')
    expect(await sql(`select public.rotulo_status('proposta_emitida') r`, [])).toBe('Proposta emitida')
  })

  it('seed tem as 11 lojas', async () => {
    expect(await sql<number>('select count(*)::int r from public.lojas', [])).toBe(11)
  })
})
