// RF16: consulta e edição de lojistas, com reconsulta do CNPJ.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { useEffect, useState, type FormEvent } from 'react'
import { formatarDocumento, normalizarDocumento } from '@shared/documento'
import type { Tabela } from '@shared/tipos'
import { Pagina } from '@renderer/components/Pagina'
import { Button } from '@renderer/components/ui/button'
import { Campo, Input } from '@renderer/components/ui/campo'
import { consultarCnpj } from '@renderer/features/vendas/api'
import { Mensagem } from '@renderer/features/vendas/componentes'
import { useOnline } from '@renderer/hooks/useOnline'
import { mensagemErro } from '@renderer/lib/erros'
import { supabase } from '@renderer/lib/supabase'
import { cn } from '@renderer/lib/utils'

type Lojista = Tabela<'lojistas'>
type Edicao = Pick<Lojista, 'razao_social' | 'nome_fantasia' | 'telefone' | 'email' | 'cidade' | 'uf' | 'situacao_cadastral' | 'origem'>

const ORIGEM: Record<string, string> = { brasilapi: 'BrasilAPI', opencnpj: 'OpenCNPJ', manual: 'Manual' }

async function listar(busca: string): Promise<Lojista[]> {
  let q = supabase.from('lojistas').select('*').order('razao_social').limit(500)
  const termo = busca.trim().replace(/[%,()]/g, '')
  if (termo) {
    const doc = normalizarDocumento(termo)
    q = q.or(`razao_social.ilike.%${termo}%,nome_fantasia.ilike.%${termo}%${doc ? `,documento.ilike.%${doc}%` : ''}`)
  }
  const { data, error } = await q
  if (error) throw error
  return data
}

function Detalhe({ lojista, onSalvo }: { lojista: Lojista; onSalvo: () => void }): React.JSX.Element {
  const online = useOnline()
  const [form, setForm] = useState<Edicao>(lojista)
  const [aviso, setAviso] = useState<{ tom: 'info' | 'alerta'; texto: string } | null>(null)
  useEffect(() => {
    setForm(lojista)
    setAviso(null)
  }, [lojista])

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('lojistas')
        .update({
          razao_social: form.razao_social.trim(),
          nome_fantasia: form.nome_fantasia?.trim() || null,
          telefone: form.telefone?.trim() || null,
          email: form.email?.trim() || null,
          cidade: form.cidade?.trim() || null,
          uf: form.uf?.trim().toUpperCase() || null,
          situacao_cadastral: form.situacao_cadastral,
          origem: form.origem
        })
        .eq('id', lojista.id)
      if (error) throw error
    },
    onSuccess: onSalvo
  })
  const reconsultar = useMutation({
    mutationFn: () => consultarCnpj(lojista.documento),
    onSuccess: (r) => {
      if (!r.ok) return setAviso({ tom: 'alerta', texto: r.mensagem })
      const { documento: _d, ...dados } = r.dados
      setForm(dados)
      setAviso({ tom: 'info', texto: 'Dados atualizados com a Receita. Confira e salve.' })
    }
  })

  const set = (k: keyof Edicao, v: string): void => setForm({ ...form, [k]: v })
  const alterado = JSON.stringify(form) !== JSON.stringify(Object.fromEntries(Object.keys(form).map((k) => [k, lojista[k as keyof Edicao]])))

  function enviar(e: FormEvent): void {
    e.preventDefault()
    if (form.razao_social.trim()) salvar.mutate()
  }

  return (
    <form onSubmit={enviar} className="animate-surgir flex flex-col gap-4">
      <div>
        <p className="numeros text-[13px] text-grafite">
          {lojista.tipo.toUpperCase()} {formatarDocumento(lojista.documento)}
        </p>
        <h2 className="text-[17px] font-semibold">{lojista.razao_social}</h2>
        <p className="text-[13px] text-grafite">
          Origem: {ORIGEM[lojista.origem] ?? lojista.origem} · cadastrado em {format(parseISO(lojista.created_at), 'dd/MM/yyyy')}
        </p>
      </div>
      {aviso && <Mensagem tom={aviso.tom}>{aviso.texto}</Mensagem>}
      <Campo rotulo={lojista.tipo === 'cpf' ? 'Nome completo' : 'Razão social'} erro={form.razao_social.trim() ? undefined : 'Obrigatório'}>
        {(p) => <Input {...p} value={form.razao_social} onChange={(e) => set('razao_social', e.target.value)} />}
      </Campo>
      {lojista.tipo === 'cnpj' && (
        <Campo rotulo="Nome fantasia">
          {(p) => <Input {...p} value={form.nome_fantasia ?? ''} onChange={(e) => set('nome_fantasia', e.target.value)} />}
        </Campo>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Campo rotulo="Telefone">{(p) => <Input {...p} value={form.telefone ?? ''} onChange={(e) => set('telefone', e.target.value)} />}</Campo>
        <Campo rotulo="E-mail">{(p) => <Input {...p} type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />}</Campo>
      </div>
      <div className="grid grid-cols-[1fr_72px] gap-4">
        <Campo rotulo="Cidade">{(p) => <Input {...p} value={form.cidade ?? ''} onChange={(e) => set('cidade', e.target.value)} />}</Campo>
        <Campo rotulo="UF">{(p) => <Input {...p} maxLength={2} value={form.uf ?? ''} onChange={(e) => set('uf', e.target.value.toUpperCase())} />}</Campo>
      </div>
      {form.situacao_cadastral && (
        <p className={cn('text-[13px]', form.situacao_cadastral.toUpperCase() === 'ATIVA' ? 'text-grafite' : 'text-alerta-parado')}>
          Situação na Receita: {form.situacao_cadastral}
        </p>
      )}
      {salvar.isError && <Mensagem tom="alerta">{mensagemErro(salvar.error)}</Mensagem>}
      <div className="flex gap-2 border-t border-linha pt-4">
        {lojista.tipo === 'cnpj' && (
          <Button variante="secundario" onClick={() => reconsultar.mutate()} disabled={reconsultar.isPending || !online}>
            {reconsultar.isPending ? 'Consultando…' : 'Reconsultar CNPJ'}
          </Button>
        )}
        <Button type="submit" className="ml-auto" disabled={!alterado || salvar.isPending || !online || !form.razao_social.trim()}>
          {salvar.isPending ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </div>
    </form>
  )
}

export function Lojistas(): React.JSX.Element {
  const queryClient = useQueryClient()
  const [busca, setBusca] = useState('')
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const lista = useQuery({ queryKey: ['lojistas', busca], queryFn: () => listar(busca), placeholderData: keepPreviousData })
  const atual = lista.data?.find((l) => l.id === selecionado) ?? null

  return (
    <Pagina titulo="Lojistas">
      <div className="grid grid-cols-[1fr_400px] gap-6">
        <div className="min-w-0">
          <Input
            type="search"
            placeholder="Buscar razão social, nome fantasia ou documento"
            aria-label="Buscar lojistas"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="mb-3 max-w-md"
          />
          {lista.isError && <p className="text-erro">{mensagemErro(lista.error)}</p>}
          <ul className="border border-linha bg-superficie" aria-label="Lojistas">
            {lista.data?.map((l) => (
              <li key={l.id} className="border-b border-linha last:border-0">
                <button
                  onClick={() => setSelecionado(l.id)}
                  aria-current={l.id === selecionado}
                  className={cn(
                    'grid h-12 w-full grid-cols-[minmax(0,1fr)_170px_150px] items-center gap-3 px-4 text-left hover:bg-papel',
                    l.id === selecionado && 'bg-superficie-selecionada hover:bg-superficie-selecionada'
                  )}
                >
                  <span className="min-w-0 truncate">
                    {l.razao_social}
                    {l.nome_fantasia && <span className="text-grafite"> · {l.nome_fantasia}</span>}
                  </span>
                  <span className="numeros text-[13px] text-grafite">{formatarDocumento(l.documento)}</span>
                  <span className="truncate text-[13px] text-grafite">{l.cidade ? `${l.cidade}${l.uf ? `/${l.uf}` : ''}` : '—'}</span>
                </button>
              </li>
            ))}
          </ul>
          {lista.data?.length === 0 && (
            <p className="py-6 text-center text-grafite">
              {busca ? 'Nenhum lojista encontrado.' : 'Nenhum lojista cadastrado ainda. Eles entram pelo registro de venda.'}
            </p>
          )}
        </div>
        <aside className="border border-linha bg-superficie p-5 self-start">
          {atual ? (
            <Detalhe lojista={atual} onSalvo={() => void queryClient.invalidateQueries({ queryKey: ['lojistas'] })} />
          ) : (
            <p className="text-grafite">Escolha um lojista na lista para ver e editar os dados.</p>
          )}
        </aside>
      </div>
    </Pagina>
  )
}
