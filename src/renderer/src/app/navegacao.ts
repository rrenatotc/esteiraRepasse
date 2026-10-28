import {
  BarChart3,
  Building2,
  Car,
  ClipboardList,
  ListChecks,
  PlusCircle,
  Search,
  Settings,
  Sheet,
  Store,
  Users,
  type LucideIcon
} from 'lucide-react'
import type { PapelUsuario } from '@shared/tipos'

export interface ItemNav {
  rota: string
  rotulo: string
  icone: LucideIcon
}

const CONSULTAR: ItemNav = { rota: '/app/consulta', rotulo: 'Consultar', icone: Search }
const PLANILHA: ItemNav = { rota: '/app/planilha', rotulo: 'Planilha', icone: Sheet }
const CONFIGURACOES: ItemNav = { rota: '/app/configuracoes', rotulo: 'Ajustes', icone: Settings }

export const NAVEGACAO: Record<PapelUsuario, ItemNav[]> = {
  vendedor: [
    { rota: '/app/vendas/nova', rotulo: 'Registrar', icone: PlusCircle },
    { rota: '/app/vendas', rotulo: 'Minhas vendas', icone: ClipboardList },
    PLANILHA,
    { rota: '/app/estoque', rotulo: 'Estoque', icone: Car },
    { rota: '/app/lojas', rotulo: 'Lojas', icone: Store },
    { rota: '/app/painel', rotulo: 'Painel', icone: BarChart3 },
    CONSULTAR,
    CONFIGURACOES
  ],
  repasse: [
    { rota: '/app/fila', rotulo: 'Fila', icone: ListChecks },
    PLANILHA,
    { rota: '/app/estoque', rotulo: 'Estoque', icone: Car },
    { rota: '/app/lojistas', rotulo: 'Lojistas', icone: Building2 },
    { rota: '/app/usuarios', rotulo: 'Usuários', icone: Users },
    { rota: '/app/lojas', rotulo: 'Lojas', icone: Store },
    { rota: '/app/painel', rotulo: 'Painel', icone: BarChart3 },
    CONSULTAR,
    CONFIGURACOES
  ],
  gestor: [
    { rota: '/app/painel', rotulo: 'Painel', icone: BarChart3 },
    { rota: '/app/fila', rotulo: 'Demandas', icone: ListChecks },
    PLANILHA,
    { rota: '/app/estoque', rotulo: 'Estoque', icone: Car },
    { rota: '/app/lojas', rotulo: 'Lojas', icone: Store },
    CONSULTAR,
    CONFIGURACOES
  ]
}

export const INICIO: Record<PapelUsuario, string> = {
  vendedor: '/app/vendas/nova',
  repasse: '/app/fila',
  gestor: '/app/painel'
}
