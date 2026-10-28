// Contrato de IPC entre main e renderer. Os schemas Zod são a fonte da
// verdade: o main valida todo payload recebido com eles.
import { z, type ZodType } from 'zod'

export { CANAIS } from './canais'

export const chaveSessaoSchema = z.string().regex(/^[\w.-]{1,128}$/)
export const valorSessaoSchema = z.string().max(64_000)

export const notificacaoSchema = z.object({
  titulo: z.string().min(1).max(120),
  corpo: z.string().max(400),
  /** Rota do hash router aberta ao clicar, ex.: "/fila/<uuid>". */
  rota: z
    .string()
    .regex(/^\/[\w/-]*$/)
    .max(200)
    .optional()
})
export type Notificacao = z.infer<typeof notificacaoSchema>

export const booleanoSchema = z.boolean()

/** Exportação: o renderer gera o conteúdo, o main pergunta onde salvar. */
export const salvarArquivoSchema = z.object({
  nome: z.string().regex(/^[\w .()-]{1,120}\.(csv|xlsx)$/),
  base64: z.string().max(40_000_000).regex(/^[A-Za-z0-9+/=]*$/)
})
export type SalvarArquivo = z.infer<typeof salvarArquivoSchema>

/** Planilha de vendas do mês: o main preenche o modelo e pergunta onde salvar. */
const textoPlanilha = z.string().max(300).nullable()
const valorPlanilha = z.number().finite().min(-1e10).max(1e10).nullable()
export const exportarPlanilhaSchema = z.object({
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  linhas: z
    .array(
      z.object({
        anunciante: textoPlanilha,
        placa: z.string().min(1).max(20),
        veiculo: textoPlanilha,
        ano: textoPlanilha,
        fipe: valorPlanilha,
        valor_compra: valorPlanilha,
        valor_vendido: valorPlanilha,
        dias_estoque: z.number().int().min(0).max(100_000).nullable(),
        classificacao: textoPlanilha,
        transf_margem: valorPlanilha,
        tipo_venda: textoPlanilha,
        lojista: textoPlanilha,
        data_venda: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        faturado: textoPlanilha,
        repassador: textoPlanilha
      })
    )
    .max(20_000)
})
export type ExportarPlanilha = z.infer<typeof exportarPlanilhaSchema>

export const contadorSchema = z.object({
  total: z.number().int().min(0).max(9999),
  /** Selo para a barra de tarefas, desenhado no renderer (PNG em data URL). */
  icone: z
    .string()
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/)
    .max(50_000)
    .nullable()
})
export type Contador = z.infer<typeof contadorSchema>

export const urlExternaSchema = z
  .string()
  .url()
  .refine((u) => u.startsWith('https://'), 'Somente links https')

export const configSchema = z.object({
  iniciarComWindows: z.boolean(),
  notificacoes: z.boolean(),
  pastaBravos: z.string().max(1024).nullable(),
  aplicarEstoqueAutomatico: z.boolean()
})
export type Config = z.infer<typeof configSchema>
export const configParcialSchema = configSchema.partial()

export type EstadoAtualizacao =
  | { tipo: 'desenvolvimento' }
  | { tipo: 'procurando' }
  | { tipo: 'atualizado' }
  | { tipo: 'baixando'; versao: string; progresso: number }
  | { tipo: 'pronta'; versao: string }
  | { tipo: 'erro'; mensagem: string }

export interface AppInfo {
  versao: string
  installId: string
  plataforma: string
}

export class PayloadInvalidoError extends Error {
  constructor(
    readonly canal: string,
    readonly problemas: string[]
  ) {
    super(`Payload inválido em ${canal}`)
  }
}

/** Valida um payload de IPC; lança PayloadInvalidoError se não bater com o schema. */
export function validarPayload<T>(schema: ZodType<T>, valor: unknown, canal: string): T {
  const resultado = schema.safeParse(valor)
  if (!resultado.success) {
    throw new PayloadInvalidoError(
      canal,
      resultado.error.issues.map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`)
    )
  }
  return resultado.data
}
