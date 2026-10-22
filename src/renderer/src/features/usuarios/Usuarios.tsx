// RF16: usuários. O acesso (e-mail e senha) é criado pelo Renato no painel do
// Supabase; aqui ele ativa, define papel e loja.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { PapelUsuario, Perfil } from '@shared/tipos'
import { useAuth } from '@renderer/app/auth'
import { Pagina } from '@renderer/components/Pagina'
import { Button } from '@renderer/components/ui/button'
import { Campo, Input } from '@renderer/components/ui/campo'
import { listarLojas } from '@renderer/features/vendas/api'
import { Mensagem, Selecao } from '@renderer/features/vendas/componentes'
import { useOnline } from '@renderer/hooks/useOnline'
import { mensagemErro } from '@renderer/lib/erros'
import { supabase } from '@renderer/lib/supabase'
import { cn } from '@renderer/lib/utils'

const PAPEIS: Record<PapelUsuario, string> = { vendedor: 'Vendedor', repasse: 'Repasse', gestor: 'Gestor' }

async function listarPerfis(): Promise<Perfil[]> {
  const { data, error } = await supabase.from('perfis').select('*').order('ativo').order('nome')
  if (error) throw error
  return data
}

function Edicao({ perfil, ehVoce, onSalvo }: { perfil: Perfil; ehVoce: boolean; onSalvo: () => void }): React.JSX.Element {
  const online = useOnline()
  const lojas = useQuery({ queryKey: ['lojas', 'ativas'], queryFn: listarLojas, staleTime: Infinity })
  const [form, setForm] = useState({ nome: perfil.nome, papel: perfil.papel, loja_id: perfil.loja_id, ativo: perfil.ativo })
  useEffect(() => setForm({ nome: perfil.nome, papel: perfil.papel, loja_id: perfil.loja_id, ativo: perfil.ativo }), [perfil])
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('perfis')
        .update({ nome: form.nome.trim(), papel: form.papel, loja_id: form.loja_id, ativo: form.ativo })
        .eq('id', perfil.id)
      if (error) throw error
    },
    onSuccess: onSalvo
  })
  const alterado =
    form.nome !== perfil.nome || form.papel !== perfil.papel || form.loja_id !== perfil.loja_id || form.ativo !== perfil.ativo
  const semLoja = form.papel === 'vendedor' && form.loja_id === null

  return (
    <form
      className="animate-surgir flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (form.nome.trim()) salvar.mutate()
      }}
    >
      <div>
        <h2 className="text-[17px] font-semibold">{perfil.nome}</h2>
        <p className="text-[13px] text-grafite">{perfil.email}</p>
      </div>
      {!perfil.ativo && (
        <Mensagem tom="info">Acesso criado e ainda não liberado. Defina papel e loja e marque como ativo.</Mensagem>
      )}
      <Campo rotulo="Nome">{(p) => <Input {...p} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />}</Campo>
      <Campo rotulo="Papel" ajuda={ehVoce ? 'Você não pode mudar o próprio papel.' : undefined}>
        {(p) => (
          <Selecao {...p} disabled={ehVoce} value={form.papel} onChange={(e) => setForm({ ...form, papel: e.target.value as PapelUsuario })}>
            {Object.entries(PAPEIS).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      <Campo rotulo="Loja onde está lotado" erro={semLoja ? 'Vendedor precisa de uma loja (vira a loja padrão da proposta).' : undefined}>
        {(p) => (
          <Selecao {...p} value={form.loja_id ?? ''} onChange={(e) => setForm({ ...form, loja_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Sem loja</option>
            {lojas.data?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.codigo} {l.nome}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      <label className={cn('flex items-center gap-2', ehVoce && 'opacity-60')}>
        <input
          type="checkbox"
          className="size-4 accent-azul-placa"
          disabled={ehVoce}
          checked={form.ativo}
          onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
        />
        Acesso ativo
      </label>
      {salvar.isError && <Mensagem tom="erro">{mensagemErro(salvar.error)}</Mensagem>}
      <div className="flex justify-end border-t border-linha pt-4">
        <Button type="submit" disabled={!alterado || semLoja || !form.nome.trim() || salvar.isPending || !online}>
          {salvar.isPending ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </div>
    </form>
  )
}

export function Usuarios(): React.JSX.Element {
  const { perfil: eu } = useAuth()
  const queryClient = useQueryClient()
  const perfis = useQuery({ queryKey: ['usuarios'], queryFn: listarPerfis })
  const lojas = useQuery({ queryKey: ['lojas', 'ativas'], queryFn: listarLojas, staleTime: Infinity })
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const atual = perfis.data?.find((p) => p.id === selecionado) ?? null
  const loja = (id: number | null): string => {
    const l = lojas.data?.find((x) => x.id === id)
    return l ? `${l.codigo} ${l.nome}` : '—'
  }

  return (
    <Pagina titulo="Usuários">
      <p className="mb-4 max-w-2xl text-grafite">
        Para dar acesso a alguém, crie o usuário no painel do Supabase (Authentication → Users → Add user, com e-mail e senha). Ele
        aparece aqui como inativo; defina papel e loja e ative. A pessoa pode trocar a senha em Ajustes.
      </p>
      <div className="grid grid-cols-[1fr_380px] gap-6">
        <div className="min-w-0">
          {perfis.isError && <p className="text-erro">{mensagemErro(perfis.error)}</p>}
          <ul className="border border-linha bg-superficie" aria-label="Usuários">
            {perfis.data?.map((p) => (
              <li key={p.id} className="border-b border-linha last:border-0">
                <button
                  onClick={() => setSelecionado(p.id)}
                  aria-current={p.id === selecionado}
                  className={cn(
                    'grid h-12 w-full grid-cols-[minmax(0,1fr)_100px_minmax(0,0.8fr)_90px] items-center gap-3 px-4 text-left hover:bg-papel',
                    p.id === selecionado && 'bg-superficie-selecionada hover:bg-superficie-selecionada'
                  )}
                >
                  <span className="min-w-0 truncate">
                    {p.nome}
                    {p.id === eu?.id && <span className="text-grafite"> (você)</span>}
                    <span className="block truncate text-[12px] text-grafite">{p.email}</span>
                  </span>
                  <span className="text-[13px]">{PAPEIS[p.papel]}</span>
                  <span className="truncate text-[13px] text-grafite">{loja(p.loja_id)}</span>
                  <span className={cn('text-[13px]', p.ativo ? 'text-status-faturada' : 'font-medium text-alerta-parado')}>
                    {p.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <aside className="self-start border border-linha bg-superficie p-5">
          {atual ? (
            <Edicao perfil={atual} ehVoce={atual.id === eu?.id} onSalvo={() => void queryClient.invalidateQueries({ queryKey: ['usuarios'] })} />
          ) : (
            <p className="text-grafite">Escolha um usuário para editar.</p>
          )}
        </aside>
      </div>
    </Pagina>
  )
}
