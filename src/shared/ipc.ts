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

export const contadorSchema = z.number().int().min(0).max(9999)

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
