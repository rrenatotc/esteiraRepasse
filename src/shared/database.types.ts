// PROVISÓRIO: escrito à mão no formato do `supabase gen types typescript`,
// espelhando as migrations da fase 1. Será sobrescrito por `npm run db:types`
// assim que o projeto Supabase estiver ligado. Não edite apelidos aqui; use
// src/shared/tipos.ts.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      lojas: {
        Row: { id: number; codigo: string; nome: string; ativa: boolean; created_at: string }
        Insert: { codigo: string; nome: string; ativa?: boolean }
        Update: { codigo?: string; nome?: string; ativa?: boolean }
        Relationships: []
      }
      perfis: {
        Row: {
          id: string
          nome: string
          email: string | null
          papel: Database['public']['Enums']['papel_usuario']
          loja_id: number | null
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: never
        Update: {
          nome?: string
          papel?: Database['public']['Enums']['papel_usuario']
          loja_id?: number | null
          ativo?: boolean
        }
        Relationships: [
          { foreignKeyName: 'perfis_loja_id_fkey'; columns: ['loja_id']; isOneToOne: false; referencedRelation: 'lojas'; referencedColumns: ['id'] }
        ]
      }
      lojistas: {
        Row: {
          id: string
          tipo: Database['public']['Enums']['tipo_documento']
          documento: string
          razao_social: string
          nome_fantasia: string | null
          telefone: string | null
          email: string | null
          cidade: string | null
          uf: string | null
          situacao_cadastral: string | null
          origem: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          tipo: Database['public']['Enums']['tipo_documento']
          documento: string
          razao_social: string
          nome_fantasia?: string | null
          telefone?: string | null
          email?: string | null
          cidade?: string | null
          uf?: string | null
          situacao_cadastral?: string | null
          origem?: string
        }
        Update: {
          razao_social?: string
          nome_fantasia?: string | null
          telefone?: string | null
          email?: string | null
          cidade?: string | null
          uf?: string | null
          situacao_cadastral?: string | null
          origem?: string
        }
        Relationships: []
      }
      veiculos: {
        Row: {
          id: string
          placa: string
          placa_busca: string
          chassi: string | null
          marca: string
          modelo: string
          versao: string | null
          ano_fabricacao: number | null
          ano_modelo: number | null
          cor: string | null
          km: number | null
          filial_estoque: string | null
          dados_bravos: Json | null
          em_estoque: boolean
          saiu_do_estoque_em: string | null
          ultima_importacao_id: number | null
          origem: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          placa: string
          marca: string
          modelo: string
          chassi?: string | null
          versao?: string | null
          ano_fabricacao?: number | null
          ano_modelo?: number | null
          cor?: string | null
          km?: number | null
        }
        Update: {
          placa?: string
          chassi?: string | null
          marca?: string
          modelo?: string
          versao?: string | null
          ano_fabricacao?: number | null
          ano_modelo?: number | null
          cor?: string | null
          km?: number | null
          filial_estoque?: string | null
        }
        Relationships: []
      }
      importacoes_estoque: {
        Row: {
          id: number
          arquivo: string
          arquivo_modificado_em: string | null
          total_linhas: number
          novos: number
          atualizados: number
          mantidos: number
          sairam: number
          erros: number
          forcado: boolean
          autor_id: string
          created_at: string
        }
        Insert: never
        Update: never
        Relationships: [
          { foreignKeyName: 'importacoes_estoque_autor_id_fkey'; columns: ['autor_id']; isOneToOne: false; referencedRelation: 'perfis'; referencedColumns: ['id'] }
        ]
      }
      demandas: {
        Row: {
          id: string
          codigo: number
          veiculo_id: string
          placa: string
          placa_busca: string
          veiculo_snapshot: Json
          lojista_id: string
          loja_proposta_id: number
          vendedor_id: string
          responsavel_id: string | null
          valor_venda: number
          observacao: string | null
          numero_proposta: string | null
          data_emissao_proposta: string | null
          numero_nf: string | null
          data_emissao_nf: string | null
          status: Database['public']['Enums']['status_demanda']
          motivo_ultimo: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          veiculo_id: string
          lojista_id: string
          loja_proposta_id: number
          valor_venda: number | string
          observacao?: string | null
        }
        Update: {
          veiculo_id?: string
          lojista_id?: string
          loja_proposta_id?: number
          valor_venda?: number | string
          observacao?: string | null
        }
        Relationships: [
          { foreignKeyName: 'demandas_veiculo_id_fkey'; columns: ['veiculo_id']; isOneToOne: false; referencedRelation: 'veiculos'; referencedColumns: ['id'] },
          { foreignKeyName: 'demandas_lojista_id_fkey'; columns: ['lojista_id']; isOneToOne: false; referencedRelation: 'lojistas'; referencedColumns: ['id'] },
          { foreignKeyName: 'demandas_loja_proposta_id_fkey'; columns: ['loja_proposta_id']; isOneToOne: false; referencedRelation: 'lojas'; referencedColumns: ['id'] },
          { foreignKeyName: 'demandas_vendedor_id_fkey'; columns: ['vendedor_id']; isOneToOne: false; referencedRelation: 'perfis'; referencedColumns: ['id'] },
          { foreignKeyName: 'demandas_responsavel_id_fkey'; columns: ['responsavel_id']; isOneToOne: false; referencedRelation: 'perfis'; referencedColumns: ['id'] }
        ]
      }
      demanda_eventos: {
        Row: {
          id: number
          demanda_id: string
          de_status: Database['public']['Enums']['status_demanda'] | null
          para_status: Database['public']['Enums']['status_demanda']
          autor_id: string
          comentario: string | null
          created_at: string
        }
        Insert: never
        Update: never
        Relationships: [
          { foreignKeyName: 'demanda_eventos_demanda_id_fkey'; columns: ['demanda_id']; isOneToOne: false; referencedRelation: 'demandas'; referencedColumns: ['id'] },
          { foreignKeyName: 'demanda_eventos_autor_id_fkey'; columns: ['autor_id']; isOneToOne: false; referencedRelation: 'perfis'; referencedColumns: ['id'] }
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      avancar_status: {
        Args: {
          p_demanda: string
          p_para: Database['public']['Enums']['status_demanda']
          p_dados?: Json
          p_comentario?: string | null
        }
        Returns: Database['public']['Tables']['demandas']['Row']
      }
      verificar_placa_aberta: {
        Args: { p_placa: string }
        Returns: {
          codigo: string
          status: Database['public']['Enums']['status_demanda']
          status_rotulo: string
        }[]
      }
      papel_atual: { Args: Record<PropertyKey, never>; Returns: Database['public']['Enums']['papel_usuario'] | null }
    }
    Enums: {
      papel_usuario: 'vendedor' | 'repasse' | 'gestor'
      status_demanda: 'nova' | 'em_proposta' | 'proposta_emitida' | 'faturada' | 'concluida' | 'pendente' | 'cancelada'
      tipo_documento: 'cpf' | 'cnpj'
    }
    CompositeTypes: { [_ in never]: never }
  }
}
