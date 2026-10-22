// Colunas da exportação de demandas (RF18). Valor sai como número para a
// planilha somar; datas em dd/mm/aaaa.
import { format, parseISO } from 'date-fns'
import { formatarDocumento } from '@shared/documento'
import type { Coluna } from '@shared/exportar'
import { centavosDeDecimal } from '@shared/moeda'
import { CODIGO_DEMANDA } from '@shared/tipos'
import { ROTULO_STATUS } from '@renderer/components/Status'
import { snapshot, type DemandaFila } from './api'

const data = (iso: string | null): string | null => (iso ? format(parseISO(iso), 'dd/MM/yyyy') : null)
const dataHora = (iso: string): string => format(parseISO(iso), 'dd/MM/yyyy HH:mm')

export const COLUNAS_DEMANDAS: Coluna<DemandaFila>[] = [
  { titulo: 'Código', valor: (d) => CODIGO_DEMANDA(d.codigo) },
  { titulo: 'Registrada em', valor: (d) => dataHora(d.created_at) },
  { titulo: 'Status', valor: (d) => ROTULO_STATUS[d.status] },
  { titulo: 'No status desde', valor: (d) => dataHora(d.status_desde) },
  { titulo: 'Placa', valor: (d) => d.placa },
  { titulo: 'Marca', valor: (d) => snapshot(d).marca ?? null },
  { titulo: 'Modelo', valor: (d) => snapshot(d).modelo ?? null },
  { titulo: 'Lojista', valor: (d) => d.lojista?.razao_social ?? null },
  { titulo: 'CPF/CNPJ', valor: (d) => (d.lojista ? formatarDocumento(d.lojista.documento) : null) },
  { titulo: 'Loja da proposta', valor: (d) => (d.loja ? `${d.loja.codigo} ${d.loja.nome}` : null) },
  { titulo: 'Vendedor', valor: (d) => d.vendedor?.nome ?? null },
  { titulo: 'Responsável', valor: (d) => d.responsavel?.nome ?? null },
  { titulo: 'Valor de venda', valor: (d) => centavosDeDecimal(d.valor_venda) / 100 },
  { titulo: 'Nº proposta', valor: (d) => d.numero_proposta },
  { titulo: 'Data proposta', valor: (d) => data(d.data_emissao_proposta) },
  { titulo: 'Nº NF', valor: (d) => d.numero_nf },
  { titulo: 'Data NF', valor: (d) => data(d.data_emissao_nf) },
  { titulo: 'Último motivo', valor: (d) => d.motivo_ultimo },
  { titulo: 'Observação', valor: (d) => d.observacao }
]
