import { describe, expect, it } from 'vitest'
import {
  chaveSessaoSchema,
  contadorSchema,
  configParcialSchema,
  notificacaoSchema,
  salvarArquivoSchema,
  exportarPlanilhaSchema,
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

  it('contador aceita só PNG em data URL', () => {
    expect(validarPayload(contadorSchema, { total: 3, icone: 'data:image/png;base64,iVBORw0KGgo=' }, 'x').total).toBe(3)
    expect(validarPayload(contadorSchema, { total: 0, icone: null }, 'x').total).toBe(0)
    rejeita(() => validarPayload(contadorSchema, { total: 1, icone: 'file:///C:/x.png' }, 'x'))
    rejeita(() => validarPayload(contadorSchema, { total: -1, icone: null }, 'x'))
  })

  it('salvar arquivo: só nome simples .csv/.xlsx, nada de caminho', () => {
    expect(validarPayload(salvarArquivoSchema, { nome: 'demandas_2026-10-22_0905.xlsx', base64: 'UEsDBA==' }, 'x').nome).toBe(
      'demandas_2026-10-22_0905.xlsx'
    )
    rejeita(() => validarPayload(salvarArquivoSchema, { nome: String.raw`..\..\Windows\x.csv`, base64: '' }, 'x'))
    rejeita(() => validarPayload(salvarArquivoSchema, { nome: 'C:/x.csv', base64: '' }, 'x'))
    rejeita(() => validarPayload(salvarArquivoSchema, { nome: 'virus.exe', base64: '' }, 'x'))
    rejeita(() => validarPayload(salvarArquivoSchema, { nome: 'a.csv', base64: 'não é base64' }, 'x'))
  })

  it('exportar planilha: mês AAAA-MM e linhas no formato do gerador', () => {
    const linha = {
      anunciante: 'PORTO ALEGRE', placa: 'IYE1206', veiculo: 'CRETA', ano: '2017/2018', fipe: 81954, valor_compra: 64000,
      valor_vendido: 66000, dias_estoque: 3, classificacao: 'D', transf_margem: null, tipo_venda: 'GRUPO', lojista: 'KLIPPEL',
      data_venda: '2026-10-02', faturado: 'SIM', repassador: null
    }
    expect(validarPayload(exportarPlanilhaSchema, { mes: '2026-10', linhas: [linha] }, 'x').linhas).toHaveLength(1)
    rejeita(() => validarPayload(exportarPlanilhaSchema, { mes: '2026-13', linhas: [] }, 'x'))
    rejeita(() => validarPayload(exportarPlanilhaSchema, { mes: '2026-10', linhas: [{ ...linha, fipe: 'abc' }] }, 'x'))
    rejeita(() => validarPayload(exportarPlanilhaSchema, { mes: '2026-10', linhas: [{ ...linha, data_venda: '02/10/2026' }] }, 'x'))
  })
})
