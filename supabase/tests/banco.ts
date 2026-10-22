// Monta um Postgres em memória (PGlite) com as migrations do projeto para
// testar regras de banco e RLS sem Docker e sem tocar na nuvem.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite, type Transaction } from '@electric-sql/pglite'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, '..')

export async function criarBanco(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(readFileSync(join(AQUI, 'supabase-stub.sql'), 'utf8'))
  const pasta = join(RAIZ, 'migrations')
  for (const arquivo of readdirSync(pasta).filter((f) => f.endsWith('.sql')).sort()) {
    try {
      await db.exec(readFileSync(join(pasta, arquivo), 'utf8'))
    } catch (erro) {
      throw new Error(`Falha na migration ${arquivo}: ${(erro as Error).message}`)
    }
  }
  await db.exec(readFileSync(join(RAIZ, 'seed.sql'), 'utf8'))
  return db
}

export type Quem = { uid: string } | 'anon' | 'service_role'

/** Roda fn numa transação como anon ou como o usuário autenticado `uid`. */
export async function como<T>(db: PGlite, quem: Quem, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    if (quem === 'anon' || quem === 'service_role') {
      await tx.exec(`set local role ${quem}`)
    } else {
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [quem.uid])
      await tx.exec('set local role authenticated')
    }
    return fn(tx)
  })
}

export async function criarUsuario(
  db: PGlite,
  dados: { email: string; papel?: 'vendedor' | 'repasse' | 'gestor'; ativo?: boolean; loja?: string }
): Promise<string> {
  const {
    rows: [{ id }]
  } = await db.query<{ id: string }>(
    `insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id`,
    [dados.email]
  )
  if (dados.papel || dados.ativo !== undefined) {
    await db.query(
      `update public.perfis
         set papel = coalesce($2::public.papel_usuario, papel),
             ativo = coalesce($3, true),
             loja_id = (select id from public.lojas where codigo = $4)
       where id = $1`,
      [id, dados.papel ?? null, dados.ativo ?? null, dados.loja ?? null]
    )
  }
  return id
}

export async function criarVeiculo(db: PGlite, placa: string): Promise<string> {
  const {
    rows: [{ id }]
  } = await db.query<{ id: string }>(
    `insert into public.veiculos (placa, marca, modelo, ano_fabricacao, ano_modelo, cor, km, origem, em_estoque)
     values ($1, 'Volkswagen', 'Polo Highline', 2021, 2021, 'Prata', 31200, 'bravos', true)
     returning id`,
    [placa]
  )
  return id
}

export async function criarLojista(db: PGlite, documento = '11222333000181'): Promise<string> {
  const {
    rows: [{ id }]
  } = await db.query<{ id: string }>(
    `insert into public.lojistas (tipo, documento, razao_social)
     values (case when length($1) = 11 then 'cpf' else 'cnpj' end::public.tipo_documento, $1, 'Auto JK Ltda')
     returning id`,
    [documento]
  )
  return id
}

export async function idLoja(db: PGlite, codigo: string): Promise<number> {
  const { rows } = await db.query<{ id: number }>(`select id from public.lojas where codigo = $1`, [codigo])
  return rows[0].id
}
