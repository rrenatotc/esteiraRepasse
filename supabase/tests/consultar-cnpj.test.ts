import { describe, expect, it } from 'vitest'
import { cnpjValido as cnpjApp } from '../../src/shared/documento'
import { cnpjValido as cnpjFuncao } from '../functions/_shared/cnpj'
import { deBrasilApi, deOpenCnpj } from '../functions/consultar-cnpj/mapear'

describe('CNPJ na Edge Function', () => {
  it.each(['11.222.333/0001-81', '11.222.333/0001-82', '12.ABC.345/01DE-35', '12ABC34501DE36', '00000000000000', 'lixo'])(
    'mesma validação do app: %s',
    (doc) => {
      expect(cnpjFuncao(doc)).toBe(cnpjApp(doc))
    }
  )
})

describe('mapeamento das bases públicas', () => {
  it('BrasilAPI', () => {
    expect(
      deBrasilApi('11222333000181', {
        razao_social: 'AUTO JK COMERCIO DE VEICULOS LTDA',
        nome_fantasia: 'AUTO JK',
        ddd_telefone_1: '5135551234',
        email: 'CONTATO@AUTOJK.COM.BR',
        municipio: 'NOVO HAMBURGO',
        uf: 'rs',
        descricao_situacao_cadastral: 'ATIVA'
      })
    ).toEqual({
      documento: '11222333000181',
      razao_social: 'AUTO JK COMERCIO DE VEICULOS LTDA',
      nome_fantasia: 'AUTO JK',
      telefone: '(51) 35551234',
      email: 'contato@autojk.com.br',
      cidade: 'NOVO HAMBURGO',
      uf: 'RS',
      situacao_cadastral: 'ATIVA',
      origem: 'brasilapi'
    })
  })

  it('OpenCNPJ', () => {
    expect(
      deOpenCnpj('11222333000181', {
        razao_social: 'AUTO JK LTDA',
        nome_fantasia: '',
        telefones: [{ ddd: '51', numero: '3555-1234' }],
        municipio: 'CANOAS',
        uf: 'RS',
        situacao_cadastral: 'Ativa'
      })
    ).toMatchObject({ razao_social: 'AUTO JK LTDA', nome_fantasia: null, telefone: '(51) 35551234', cidade: 'CANOAS', origem: 'opencnpj' })
  })

  it('resposta sem razão social é descartada', () => {
    expect(deBrasilApi('11222333000181', { message: 'CNPJ não encontrado' })).toBeNull()
    expect(deOpenCnpj('11222333000181', {})).toBeNull()
  })
})
