// Apelidos sobre os tipos gerados do banco (database.types.ts é sobrescrito
// pelo `npm run db:types`; por isso os apelidos ficam aqui).
import type { Database } from './database.types'

type Public = Database['public']

export type Tabela<T extends keyof Public['Tables']> = Public['Tables'][T]['Row']
export type StatusDemanda = Public['Enums']['status_demanda']
export type PapelUsuario = Public['Enums']['papel_usuario']
export type TipoDocumento = Public['Enums']['tipo_documento']

export type Perfil = Tabela<'perfis'>
export type Loja = Tabela<'lojas'>
export type Demanda = Tabela<'demandas'>

export const CODIGO_DEMANDA = (codigo: number): string => `REP-${String(codigo).padStart(6, '0')}`
