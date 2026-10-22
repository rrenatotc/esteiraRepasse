import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import type { Config } from '@shared/ipc'
import { useAuth } from '@renderer/app/auth'
import { Pagina } from '@renderer/components/Pagina'
import { Button } from '@renderer/components/ui/button'
import { CHAVES } from '@renderer/features/estoque/useEstoqueRepasse'

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

function PastaBravos({ pasta }: { pasta: string | null }): React.JSX.Element {
  const queryClient = useQueryClient()
  const [mensagem, setMensagem] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)
  const escolher = useMutation({
    mutationFn: () => window.esteira.estoque.escolherPasta(),
    onSuccess: async (r) => {
      if (!r) return
      if ('erro' in r) return setMensagem({ tom: 'erro', texto: r.erro })
      setMensagem({ tom: 'ok', texto: `Pasta salva. ${r.planilhas} planilhas encontradas.` })
      await queryClient.invalidateQueries({ queryKey: ['config'] })
      queryClient.setQueryData(CHAVES.status, await window.esteira.estoque.observar(true))
    }
  })
  return (
    <div className="mb-3 flex flex-col gap-2">
      <span className="text-[13px] font-medium">Pasta de relatórios do Bravos</span>
      <div className="flex items-center gap-3">
        <code className="min-w-0 flex-1 truncate rounded-sm border border-linha bg-papel px-3 py-2 text-[13px]">
          {pasta ?? 'Nenhuma pasta escolhida'}
        </code>
        <Button variante="secundario" onClick={() => escolher.mutate()} disabled={escolher.isPending}>
          Escolher pasta
        </Button>
      </div>
      {mensagem && (
        <p role="status" className={mensagem.tom === 'erro' ? 'text-[13px] text-erro' : 'text-[13px] text-status-faturada'}>
          {mensagem.texto}
        </p>
      )}
    </div>
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

      {perfil?.papel === 'repasse' && config.data && (
        <Secao titulo="Estoque do Bravos">
          <PastaBravos pasta={config.data.pastaBravos} />
          <Alternar
            rotulo="Aplicar automaticamente quando passar na trava"
            descricao="Nova exportação na pasta é aplicada sem clique e você só recebe o resultado. Arquivos com erro, mais antigos ou bloqueados continuam pedindo revisão."
            marcado={config.data.aplicarEstoqueAutomatico}
            onChange={(v) => salvar.mutate({ aplicarEstoqueAutomatico: v })}
          />
        </Secao>
      )}

      <Secao titulo="Sobre">
        <p className="numeros text-grafite">Versão {info.data?.versao ?? '—'}</p>
      </Secao>
    </Pagina>
  )
}
