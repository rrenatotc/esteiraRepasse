export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      consulta_publica_log: {
        Row: {
          chave_hash: string
          created_at: string
          id: number
          ip_hash: string
          placa_busca: string
        }
        Insert: {
          chave_hash: string
          created_at?: string
          id?: never
          ip_hash: string
          placa_busca: string
        }
        Update: {
          chave_hash?: string
          created_at?: string
          id?: never
          ip_hash?: string
          placa_busca?: string
        }
        Relationships: []
      }
      demanda_eventos: {
        Row: {
          autor_id: string
          comentario: string | null
          created_at: string
          de_status: Database["public"]["Enums"]["status_demanda"] | null
          demanda_id: string
          id: number
          para_status: Database["public"]["Enums"]["status_demanda"]
        }
        Insert: {
          autor_id: string
          comentario?: string | null
          created_at?: string
          de_status?: Database["public"]["Enums"]["status_demanda"] | null
          demanda_id: string
          id?: never
          para_status: Database["public"]["Enums"]["status_demanda"]
        }
        Update: {
          autor_id?: string
          comentario?: string | null
          created_at?: string
          de_status?: Database["public"]["Enums"]["status_demanda"] | null
          demanda_id?: string
          id?: never
          para_status?: Database["public"]["Enums"]["status_demanda"]
        }
        Relationships: [
          {
            foreignKeyName: "demanda_eventos_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_eventos_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      demandas: {
        Row: {
          codigo: number
          created_at: string
          data_emissao_nf: string | null
          data_emissao_proposta: string | null
          id: string
          loja_proposta_id: number
          lojista_id: string
          motivo_ultimo: string | null
          numero_nf: string | null
          numero_proposta: string | null
          observacao: string | null
          placa: string
          placa_busca: string
          responsavel_id: string | null
          status: Database["public"]["Enums"]["status_demanda"]
          status_desde: string
          updated_at: string
          valor_venda: number
          veiculo_id: string
          veiculo_snapshot: Json
          vendedor_id: string
        }
        Insert: {
          codigo?: never
          created_at?: string
          data_emissao_nf?: string | null
          data_emissao_proposta?: string | null
          id?: string
          loja_proposta_id: number
          lojista_id: string
          motivo_ultimo?: string | null
          numero_nf?: string | null
          numero_proposta?: string | null
          observacao?: string | null
          placa: string
          placa_busca: string
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_demanda"]
          status_desde?: string
          updated_at?: string
          valor_venda: number
          veiculo_id: string
          veiculo_snapshot: Json
          vendedor_id?: string
        }
        Update: {
          codigo?: never
          created_at?: string
          data_emissao_nf?: string | null
          data_emissao_proposta?: string | null
          id?: string
          loja_proposta_id?: number
          lojista_id?: string
          motivo_ultimo?: string | null
          numero_nf?: string | null
          numero_proposta?: string | null
          observacao?: string | null
          placa?: string
          placa_busca?: string
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_demanda"]
          status_desde?: string
          updated_at?: string
          valor_venda?: number
          veiculo_id?: string
          veiculo_snapshot?: Json
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demandas_loja_proposta_id_fkey"
            columns: ["loja_proposta_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_lojista_id_fkey"
            columns: ["lojista_id"]
            isOneToOne: false
            referencedRelation: "lojistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      importacoes_estoque: {
        Row: {
          arquivo: string
          arquivo_modificado_em: string | null
          atualizados: number
          autor_id: string
          created_at: string
          erros: number
          forcado: boolean
          id: number
          mantidos: number
          novos: number
          sairam: number
          total_linhas: number
        }
        Insert: {
          arquivo: string
          arquivo_modificado_em?: string | null
          atualizados?: number
          autor_id: string
          created_at?: string
          erros?: number
          forcado?: boolean
          id?: never
          mantidos?: number
          novos?: number
          sairam?: number
          total_linhas?: number
        }
        Update: {
          arquivo?: string
          arquivo_modificado_em?: string | null
          atualizados?: number
          autor_id?: string
          created_at?: string
          erros?: number
          forcado?: boolean
          id?: never
          mantidos?: number
          novos?: number
          sairam?: number
          total_linhas?: number
        }
        Relationships: [
          {
            foreignKeyName: "importacoes_estoque_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      lojas: {
        Row: {
          ativa: boolean
          codigo: string
          created_at: string
          id: number
          nome: string
        }
        Insert: {
          ativa?: boolean
          codigo: string
          created_at?: string
          id?: never
          nome: string
        }
        Update: {
          ativa?: boolean
          codigo?: string
          created_at?: string
          id?: never
          nome?: string
        }
        Relationships: []
      }
      lojistas: {
        Row: {
          cidade: string | null
          created_at: string
          created_by: string | null
          documento: string
          email: string | null
          id: string
          nome_fantasia: string | null
          origem: string
          razao_social: string
          situacao_cadastral: string | null
          telefone: string | null
          tipo: Database["public"]["Enums"]["tipo_documento"]
          uf: string | null
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          documento: string
          email?: string | null
          id?: string
          nome_fantasia?: string | null
          origem?: string
          razao_social: string
          situacao_cadastral?: string | null
          telefone?: string | null
          tipo: Database["public"]["Enums"]["tipo_documento"]
          uf?: string | null
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          documento?: string
          email?: string | null
          id?: string
          nome_fantasia?: string | null
          origem?: string
          razao_social?: string
          situacao_cadastral?: string | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_documento"]
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lojistas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          ativo: boolean
          created_at: string
          email: string | null
          id: string
          loja_id: number | null
          nome: string
          papel: Database["public"]["Enums"]["papel_usuario"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id: string
          loja_id?: number | null
          nome: string
          papel?: Database["public"]["Enums"]["papel_usuario"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          loja_id?: number | null
          nome?: string
          papel?: Database["public"]["Enums"]["papel_usuario"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfis_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      veiculos: {
        Row: {
          ano_fabricacao: number | null
          ano_modelo: number | null
          chassi: string | null
          codigo_bravos: string | null
          cor: string | null
          created_at: string
          created_by: string | null
          dados_bravos: Json | null
          dias_em_estoque: number | null
          em_estoque: boolean
          filial_estoque: string | null
          id: string
          km: number | null
          marca: string
          modelo: string
          origem: string
          placa: string
          placa_busca: string
          saiu_do_estoque_em: string | null
          ultima_importacao_id: number | null
          updated_at: string
          versao: string | null
        }
        Insert: {
          ano_fabricacao?: number | null
          ano_modelo?: number | null
          chassi?: string | null
          codigo_bravos?: string | null
          cor?: string | null
          created_at?: string
          created_by?: string | null
          dados_bravos?: Json | null
          dias_em_estoque?: number | null
          em_estoque?: boolean
          filial_estoque?: string | null
          id?: string
          km?: number | null
          marca: string
          modelo: string
          origem?: string
          placa: string
          placa_busca: string
          saiu_do_estoque_em?: string | null
          ultima_importacao_id?: number | null
          updated_at?: string
          versao?: string | null
        }
        Update: {
          ano_fabricacao?: number | null
          ano_modelo?: number | null
          chassi?: string | null
          codigo_bravos?: string | null
          cor?: string | null
          created_at?: string
          created_by?: string | null
          dados_bravos?: Json | null
          dias_em_estoque?: number | null
          em_estoque?: boolean
          filial_estoque?: string | null
          id?: string
          km?: number | null
          marca?: string
          modelo?: string
          origem?: string
          placa?: string
          placa_busca?: string
          saiu_do_estoque_em?: string | null
          ultima_importacao_id?: number | null
          updated_at?: string
          versao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "veiculos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculos_ultima_importacao_id_fkey"
            columns: ["ultima_importacao_id"]
            isOneToOne: false
            referencedRelation: "importacoes_estoque"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      avancar_status: {
        Args: {
          p_comentario?: string
          p_dados?: Json
          p_demanda: string
          p_para: Database["public"]["Enums"]["status_demanda"]
        }
        Returns: {
          codigo: number
          created_at: string
          data_emissao_nf: string | null
          data_emissao_proposta: string | null
          id: string
          loja_proposta_id: number
          lojista_id: string
          motivo_ultimo: string | null
          numero_nf: string | null
          numero_proposta: string | null
          observacao: string | null
          placa: string
          placa_busca: string
          responsavel_id: string | null
          status: Database["public"]["Enums"]["status_demanda"]
          status_desde: string
          updated_at: string
          valor_venda: number
          veiculo_id: string
          veiculo_snapshot: Json
          vendedor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "demandas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      codigo_demanda: { Args: { p_codigo: number }; Returns: string }
      consulta_publica: {
        Args: { p_chave_hash: string; p_ip_hash: string; p_placa: string }
        Returns: Json
      }
      consultar_placa_publica: { Args: { p_placa: string }; Returns: Json }
      corrigir_venda: {
        Args: {
          p_demanda: string
          p_loja_proposta_id: number
          p_lojista_id?: string
          p_lojista_novo?: Json
          p_observacao?: string
          p_valor_venda: number
        }
        Returns: {
          codigo: number
          created_at: string
          data_emissao_nf: string | null
          data_emissao_proposta: string | null
          id: string
          loja_proposta_id: number
          lojista_id: string
          motivo_ultimo: string | null
          numero_nf: string | null
          numero_proposta: string | null
          observacao: string | null
          placa: string
          placa_busca: string
          responsavel_id: string | null
          status: Database["public"]["Enums"]["status_demanda"]
          status_desde: string
          updated_at: string
          valor_venda: number
          veiculo_id: string
          veiculo_snapshot: Json
          vendedor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "demandas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      estoque_atualizado_em: { Args: never; Returns: string }
      horas_uteis_entre: {
        Args: { p_fim: string; p_inicio: string }
        Returns: number
      }
      indicadores_painel: {
        Args: { p_fim: string; p_inicio: string }
        Returns: Json
      }
      normalizar_documento: { Args: { p: string }; Returns: string }
      normalizar_placa: { Args: { p: string }; Returns: string }
      papel_atual: {
        Args: never
        Returns: Database["public"]["Enums"]["papel_usuario"]
      }
      placa_para_mercosul: { Args: { p: string }; Returns: string }
      pode_ver_painel: { Args: never; Returns: boolean }
      previa_estoque: { Args: { p_itens: Json }; Returns: Json }
      registrar_consulta_publica: {
        Args: { p_chave_hash: string; p_ip_hash: string; p_placa_busca: string }
        Returns: boolean
      }
      registrar_venda: {
        Args: {
          p_loja_proposta_id: number
          p_lojista_id?: string
          p_lojista_novo?: Json
          p_observacao?: string
          p_placa: string
          p_valor_venda: number
          p_veiculo_manual?: Json
        }
        Returns: {
          codigo: number
          created_at: string
          data_emissao_nf: string | null
          data_emissao_proposta: string | null
          id: string
          loja_proposta_id: number
          lojista_id: string
          motivo_ultimo: string | null
          numero_nf: string | null
          numero_proposta: string | null
          observacao: string | null
          placa: string
          placa_busca: string
          responsavel_id: string | null
          status: Database["public"]["Enums"]["status_demanda"]
          status_desde: string
          updated_at: string
          valor_venda: number
          veiculo_id: string
          veiculo_snapshot: Json
          vendedor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "demandas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rotulo_status: {
        Args: { p: Database["public"]["Enums"]["status_demanda"] }
        Returns: string
      }
      sincronizar_estoque: {
        Args: {
          p_arquivo: string
          p_arquivo_modificado_em: string
          p_erros?: number
          p_forcar?: boolean
          p_itens: Json
          p_total_linhas?: number
        }
        Returns: Json
      }
      validar_cnpj: { Args: { p: string }; Returns: boolean }
      validar_cpf: { Args: { p: string }; Returns: boolean }
      verificar_placa_aberta: {
        Args: { p_placa: string }
        Returns: {
          codigo: string
          status: Database["public"]["Enums"]["status_demanda"]
          status_rotulo: string
        }[]
      }
    }
    Enums: {
      papel_usuario: "vendedor" | "repasse" | "gestor"
      status_demanda:
        | "nova"
        | "em_proposta"
        | "proposta_emitida"
        | "faturada"
        | "concluida"
        | "pendente"
        | "cancelada"
      tipo_documento: "cpf" | "cnpj"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      papel_usuario: ["vendedor", "repasse", "gestor"],
      status_demanda: [
        "nova",
        "em_proposta",
        "proposta_emitida",
        "faturada",
        "concluida",
        "pendente",
        "cancelada",
      ],
      tipo_documento: ["cpf", "cnpj"],
    },
  },
} as const
