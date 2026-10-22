// Mapeamento da planilha de estoque exportada pelo Bravos (seção 6.1).
// Aprovado com o Renato em 22/10/2026 a partir das exportações reais de
// C:\BravosClient\rel. Mudou o layout no Bravos? Ajuste só este arquivo.

/** Só estas situações (coluna "Sit.") são estoque do repasse. */
export const SITUACOES_REPASSE = ['RP']

/** Cabeçalhos aceitos para cada campo, comparados sem acento, espaço, ponto ou caixa. */
export const COLUNAS = {
  placa: ['Placa'],
  modelo: ['Modelo'],
  situacao: ['Sit.', 'Situação'],
  marca: ['Marca'],
  codigo: ['Cód.Veículo', 'Cód. Veículo', 'Código Veículo'],
  dias: ['Dias'],
  anoFabricacao: ['Fab.'],
  anoModelo: ['Mod.'],
  cor: ['Cor'],
  km: ['Km'],
  empresa: ['Emp'],
  revenda: ['Rev'],
  entrada: ['Dta Entrada']
} as const

export type Campo = keyof typeof COLUNAS

/** Sem estas a planilha é recusada (provável relatório errado). */
export const OBRIGATORIAS: Campo[] = ['placa', 'modelo', 'situacao']

/**
 * Colunas copiadas para dados_bravos. Lista fechada de propósito: custo,
 * preços, cliente e vendedor nunca entram no banco (todo usuário lê veiculos).
 */
export const COLUNAS_AUDITORIA = [
  'Modelo', 'Placa', 'Marca', 'Cód.Veículo', 'Sit.', 'Dias', 'Dias Es', 'Fab.', 'Mod.', 'Cor', 'Km',
  'Emp', 'Rev', 'Rev. Compra', 'Emp Origem', 'Rev Origem', 'Dta Entrada', 'Ed', 'Trân', 'Res', 'Neg',
  'Prop', 'Disp', 'Ven', 'Comb.', 'Portas', 'Localização', 'Depto', 'Versão (Cad. Modelo)'
]

/** Siglas e grafias do Bravos → marca exibida. */
export const MARCAS: Record<string, string> = {
  VW: 'Volkswagen',
  VOLKSWAGEN: 'Volkswagen',
  CHEV: 'Chevrolet',
  CHEVROLET: 'Chevrolet',
  GM: 'Chevrolet',
  FIAT: 'Fiat',
  FORD: 'Ford',
  HONDA: 'Honda',
  HYUNDAI: 'Hyundai',
  HYUNDA: 'Hyundai',
  TOYOTA: 'Toyota',
  RENAULT: 'Renault',
  NISSAN: 'Nissan',
  JEEP: 'Jeep',
  RAM: 'Ram',
  CITROEN: 'Citroën',
  PEUGEOT: 'Peugeot',
  PEUGEOUT: 'Peugeot',
  KIA: 'Kia',
  MMC: 'Mitsubishi',
  MITSUBISHI: 'Mitsubishi',
  'M.BENZ': 'Mercedes-Benz',
  'MERCEDES-BENZ': 'Mercedes-Benz',
  MERCEDES: 'Mercedes-Benz',
  BMW: 'BMW',
  AUDI: 'Audi',
  VOLVO: 'Volvo',
  CHERY: 'Chery',
  'CAOA CHERY': 'Caoa Chery',
  BYD: 'BYD',
  GWM: 'GWM',
  OMODA: 'Omoda',
  JAECOO: 'Jaecoo',
  SUZUKI: 'Suzuki',
  SUBARU: 'Subaru',
  'LAND ROVER': 'Land Rover',
  LR: 'Land Rover',
  JAC: 'JAC',
  YAMAHA: 'Yamaha'
}

/** Usada quando nem a coluna Marca nem o prefixo do Modelo identificam a marca. */
export const MARCA_NAO_INFORMADA = 'Não informada'

// ---------------------------------------------------------------------------
// Funções de limpeza

export function normalizarCabecalho(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s.]/g, '')
    .toLowerCase()
}

export function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  return String(valor).replace(/\s+/g, ' ').trim()
}

/** Inteiro de número ou texto com separador de milhar ("16.900", "16,900"). */
export function inteiro(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? Math.trunc(valor) : null
  const limpo = texto(valor).replace(/[.,\s](?=\d{3}(\D|$))/g, '').replace(/[,.]\d*$/, '')
  return /^-?\d+$/.test(limpo) ? Number(limpo) : null
}

/** Ano de 4 dígitos; aceita "2019/2020" (devolve [fab, mod]). */
export function anos(fab: unknown, mod: unknown): [number | null, number | null] {
  const combinado = /^(\d{4})\s*\/\s*(\d{2,4})$/.exec(texto(fab))
  if (combinado) {
    const modelo = combinado[2].length === 2 ? Number(combinado[1].slice(0, 2) + combinado[2]) : Number(combinado[2])
    return [Number(combinado[1]), modelo]
  }
  const ano = (v: unknown): number | null => {
    const n = inteiro(v)
    return n !== null && n >= 1950 && n <= 2101 ? n : null
  }
  return [ano(fab), ano(mod)]
}

/** Data do Excel (número serial) ou "dd/mm/aaaa" → "aaaa-mm-dd". */
export function dataIso(valor: unknown): string | null {
  if (typeof valor === 'number' && valor > 0) {
    const ms = Math.round((valor - 25569) * 86400_000) // 25569 = 01/01/1970 no serial do Excel
    return new Date(ms).toISOString().slice(0, 10)
  }
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto(valor))
  return br ? `${br[3]}-${br[2]}-${br[1]}` : null
}

function marcaDeSigla(sigla: string): string | null {
  const chave = texto(sigla).toUpperCase()
  return MARCAS[chave] ?? null
}

/**
 * Separa marca e modelo. Usa a coluna Marca quando existir; senão o prefixo
 * do Modelo ("VW/NIVUS", "I/VW TAOS", "CHEV ONIX"). Remove o prefixo do modelo.
 */
export function marcaEModelo(modeloBravos: unknown, marcaBravos: unknown): { marca: string | null; modelo: string } {
  let modelo = texto(modeloBravos).replace(/^I\s*\//, '') // "I/" = importado
  let marca: string | null = null

  const comBarra = /^([A-Z0-9 .-]{1,20}?)\s*\/\s*(.+)$/.exec(modelo)
  if (comBarra && marcaDeSigla(comBarra[1])) {
    marca = marcaDeSigla(comBarra[1])
    modelo = comBarra[2]
  } else {
    const palavras = modelo.split(' ')
    for (const n of [2, 1]) {
      const candidata = marcaDeSigla(palavras.slice(0, n).join(' '))
      if (candidata && palavras.length > n) {
        marca = candidata
        modelo = palavras.slice(n).join(' ')
        break
      }
    }
  }

  const coluna = texto(marcaBravos)
  if (coluna) marca = marcaDeSigla(coluna) ?? coluna
  return { marca, modelo: modelo.trim() }
}
