import { describe, expect, it } from 'vitest'
import {
  chaveSessaoSchema,
  configParcialSchema,
  notificacaoSchema,
  PayloadInvalidoError,
  urlExternaSchema,
  validarPayload
} from './ipc'

const rejeita = (fn: () => unknown): void => {
  expect(fn).toThrow(PayloadInvalidoError)
}

describe('validarPayload', () => {
  it('aceita payload válido', () => {
    expect(
      validarPayload(notificacaoSchema, { titulo: 'Nova demanda', corpo: 'REP-000001', rota: '/fila/abc-1' }, 'x')
    ).toEqual({ titulo: 'Nova demanda', corpo: 'REP-000001', rota: '/fila/abc-1' })
  })

  it('rejeita tipos errados, campos faltando e rotas suspeitas', () => {
    rejeita(() => validarPayload(notificacaoSchema, { titulo: 42, corpo: '' }, 'x'))
    rejeita(() => validarPayload(notificacaoSchema, { corpo: 'sem título' }, 'x'))
    rejeita(() => validarPayload(notificacaoSchema, { titulo: 't', corpo: '', rota: 'javascript:alert(1)' }, 'x'))
    rejeita(() => validarPayload(notificacaoSchema, null, 'x'))
  })

  it('rejeita chave de sessão com caminho ou vazia', () => {
    rejeita(() => validarPayload(chaveSessaoSchema, '../segredo', 'x'))
    rejeita(() => validarPayload(chaveSessaoSchema, '', 'x'))
    expect(validarPayload(chaveSessaoSchema, 'sb-abc-auth-token', 'x')).toBe('sb-abc-auth-token')
  })

  it('só abre links https', () => {
    rejeita(() => validarPayload(urlExternaSchema, 'file:///C:/Windows/system32/calc.exe', 'x'))
    rejeita(() => validarPayload(urlExternaSchema, 'http://exemplo.com', 'x'))
    expect(validarPayload(urlExternaSchema, 'https://brasilapi.com.br', 'x')).toBe('https://brasilapi.com.br')
  })

  it('config parcial rejeita tipo errado', () => {
    rejeita(() => validarPayload(configParcialSchema, { notificacoes: 'sim' }, 'x'))
    expect(validarPayload(configParcialSchema, { notificacoes: false }, 'x')).toEqual({ notificacoes: false })
  })
})
