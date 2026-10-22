import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { Config } from '@shared/ipc'
import { useAuth } from '@renderer/app/auth'
import { Pagina } from '@renderer/components/Pagina'
import { Button } from '@renderer/components/ui/button'

const ROTULO_PAPEL = { vendedor: 'Vendedor', repasse: 'Repasse', gestor: 'Gestor' } as const

function Secao({ titulo, children }: { titulo: string; children: ReactNode }): React.JSX.Element {
  return (
    <section className="border-t border-linha py-5">
      <h2 className="mb-3 text-[15px] font-semibold">{titulo}</h2>
      {children}
    </section>
  )
}

function Alternar({
  rotulo,
  descricao,
  marcado,
  onChange
}: {
  rotulo: string
  descricao: string
  marcado: boolean
  onChange: (v: boolean) => void
}): React.JSX.Element {
  return (
    <label className="flex items-start gap-3 py-2">
      <input
        type="checkbox"
        checked={marcado}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 accent-azul-placa"
      />
      <span>
        <span className="block">{rotulo}</span>
        <span className="block text-[13px] text-grafite">{descricao}</span>
      </span>
    </label>
  )
}

export function Configuracoes(): React.JSX.Element {
  const { perfil, sessao, sair } = useAuth()
  const queryClient = useQueryClient()
  const config = useQuery({ queryKey: ['config'], queryFn: () => window.esteira.config.ler() })
  const info = useQuery({ queryKey: ['app-info'], queryFn: () => window.esteira.app.info() })
  const salvar = useMutation({
    mutationFn: (parcial: Partial<Config>) => window.esteira.config.salvar(parcial),
    onSuccess: (nova) => queryClient.setQueryData(['config'], nova)
  })

  return (
    <Pagina titulo="Ajustes" estreita>
      <Secao titulo="Conta">
        <dl className="grid grid-cols-[140px_1fr] gap-y-2">
          <dt className="text-grafite">Nome</dt>
          <dd>{perfil?.nome}</dd>
          <dt className="text-grafite">E-mail</dt>
          <dd>{sessao?.user.email}</dd>
          <dt className="text-grafite">Papel</dt>
          <dd>{perfil ? ROTULO_PAPEL[perfil.papel] : '—'}</dd>
          <dt className="text-grafite">Loja</dt>
          <dd>{perfil?.loja ? `${perfil.loja.codigo} ${perfil.loja.nome}` : '—'}</dd>
        </dl>
        <Button variante="secundario" className="mt-4" onClick={() => void sair()}>
          Sair da conta
        </Button>
      </Secao>

      {config.data && (
        <Secao titulo="Este computador">
          <Alternar
            rotulo="Iniciar com o Windows"
            descricao="Abre minimizado na bandeja para as notificações chegarem desde o início do dia."
            marcado={config.data.iniciarComWindows}
            onChange={(v) => salvar.mutate({ iniciarComWindows: v })}
          />
          <Alternar
            rotulo="Notificações do Windows"
            descricao="Avisa quando chega uma demanda nova ou quando uma venda sua muda de status."
            marcado={config.data.notificacoes}
            onChange={(v) => salvar.mutate({ notificacoes: v })}
          />
        </Secao>
      )}

      <Secao titulo="Sobre">
        <p className="numeros text-grafite">Versão {info.data?.versao ?? '—'}</p>
      </Secao>
    </Pagina>
  )
}
