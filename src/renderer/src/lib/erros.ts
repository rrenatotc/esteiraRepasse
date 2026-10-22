// Mensagens de erro para o usuário: o que aconteceu e como resolver.
// As RPCs do banco já devolvem mensagens em português; aqui só traduzimos
// os erros de rede e de autenticação do supabase-js.

const CONHECIDOS: [RegExp, string][] = [
  [/invalid login credentials/i, 'E-mail ou senha incorretos. Confira e tente de novo.'],
  [/email not confirmed/i, 'Seu e-mail ainda não foi confirmado. Abra o convite que chegou por e-mail.'],
  [/failed to fetch|networkerror|network request failed|fetch failed/i, 'Sem conexão com o servidor. Verifique a internet e tente de novo.'],
  [/jwt expired|refresh token/i, 'Sua sessão expirou. Entre novamente.'],
  [/permission denied|row-level security/i, 'Você não tem permissão para fazer isso. Fale com o repasse se achar que deveria.'],
  [/too many requests|rate limit/i, 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.']
]

export function mensagemErro(erro: unknown): string {
  const texto =
    erro instanceof Error
      ? erro.message
      : typeof erro === 'object' && erro !== null && 'message' in erro && typeof erro.message === 'string'
        ? erro.message
        : String(erro)
  for (const [padrao, mensagem] of CONHECIDOS) if (padrao.test(texto)) return mensagem
  return texto || 'Algo deu errado. Tente de novo; se continuar, avise o repasse.'
}
