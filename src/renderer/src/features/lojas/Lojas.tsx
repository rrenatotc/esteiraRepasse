// RF16: lojas do grupo. O código é o do Bravos; exibir sempre "código + nome".
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { Loja } from '@shared/tipos'
import { useAuth } from '@renderer/app/auth'
import { Pagina } from '@renderer/components/Pagina'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/campo'
import { Mensagem } from '@renderer/features/vendas/componentes'
import { useOnline } from '@renderer/hooks/useOnline'
import { mensagemErro } from '@renderer/lib/erros'
import { supabase } from '@renderer/lib/supabase'

async function todas(): Promise<Loja[]> {
  const { data, error } = await supabase.from('lojas').select('*').order('codigo')
  if (error) throw error
  return data
}

function LinhaLoja({ loja }: { loja: Loja }): React.JSX.Element {
  const queryClient = useQueryClient()
  const online = useOnline()
  const [nome, setNome] = useState(loja.nome)
  const salvar = useMutation({
    mutationFn: async (dados: Partial<Pick<Loja, 'nome' | 'ativa'>>) => {
      const { error } = await supabase.from('lojas').update(dados).eq('id', loja.id)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['lojas'] })
  })
  return (
    <tr className="border-b border-linha last:border-0">
      <td className="numeros h-12 px-4 font-medium">{loja.codigo}</td>
      <td className="px-4">
        <Input
          aria-label={`Nome da loja ${loja.codigo}`}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="h-8"
        />
        {salvar.isError && (
          <p className="mt-1 text-[12px] text-erro">{mensagemErro(salvar.error)}</p>
        )}
      </td>
      <td className="px-4">
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            className="size-4 accent-azul-placa"
            checked={loja.ativa}
            disabled={salvar.isPending || !online}
            onChange={(e) => salvar.mutate({ ativa: e.target.checked })}
          />
          {loja.ativa ? 'Ativa' : 'Inativa'}
        </label>
      </td>
      <td className="px-4 text-right">
        <Button
          tamanho="sm"
          variante="secundario"
          disabled={nome.trim() === loja.nome || !nome.trim() || salvar.isPending || !online}
          onClick={() => salvar.mutate({ nome: nome.trim() })}
        >
          Salvar
        </Button>
      </td>
    </tr>
  )
}

function LinhaSomenteLeitura({ loja }: { loja: Loja }): React.JSX.Element {
  return (
    <tr className="h-11 border-b border-linha last:border-0">
      <td className="numeros px-4 font-medium">{loja.codigo}</td>
      <td className="px-4">{loja.nome}</td>
      <td className="px-4 text-[13px]">
        {loja.ativa ? 'Ativa' : <span className="text-grafite">Inativa</span>}
      </td>
      <td />
    </tr>
  )
}

export function Lojas(): React.JSX.Element {
  const { perfil } = useAuth()
  const editavel = perfil?.papel === 'repasse'
  const queryClient = useQueryClient()
  const online = useOnline()
  const lojas = useQuery({ queryKey: ['lojas', 'todas'], queryFn: todas })
  const [nova, setNova] = useState({ codigo: '', nome: '' })
  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('lojas')
        .insert({ codigo: nova.codigo.trim(), nome: nova.nome.trim() })
      if (error) throw error
    },
    onSuccess: () => {
      setNova({ codigo: '', nome: '' })
      void queryClient.invalidateQueries({ queryKey: ['lojas'] })
    }
  })
  const codigoValido = /^\d+\.\d+$/.test(nova.codigo.trim())

  return (
    <Pagina titulo="Lojas" estreita>
      <p className="mb-4 text-grafite">
        O código é o mesmo do Bravos (empresa.revenda). Loja inativa some do seletor de loja da
        proposta, mas continua nas vendas antigas.
      </p>
      <table className="w-full border border-linha bg-superficie">
        <thead className="border-b border-linha">
          <tr className="text-left text-[12px] font-medium text-grafite">
            <th className="h-9 w-24 px-4">Código</th>
            <th className="px-4">Nome</th>
            <th className="w-28 px-4">Situação</th>
            <th className="w-24 px-4" />
          </tr>
        </thead>
        <tbody>
          {lojas.data?.map((l) =>
            editavel ? (
              <LinhaLoja key={`${l.id}-${l.nome}`} loja={l} />
            ) : (
              <LinhaSomenteLeitura key={l.id} loja={l} />
            )
          )}
        </tbody>
      </table>

      {editavel && (
        <form
          className="mt-6 flex items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (codigoValido && nova.nome.trim()) criar.mutate()
          }}
        >
          <label className="flex w-28 flex-col gap-1.5 text-[13px] font-medium">
            Código
            <Input
              className="numeros"
              placeholder="7.1"
              value={nova.codigo}
              onChange={(e) => setNova({ ...nova, codigo: e.target.value })}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-[13px] font-medium">
            Nome
            <Input value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} />
          </label>
          <Button
            type="submit"
            disabled={!codigoValido || !nova.nome.trim() || criar.isPending || !online}
          >
            Adicionar loja
          </Button>
        </form>
      )}
      {criar.isError && (
        <div className="mt-3">
          <Mensagem tom="erro">
            {/duplicate|unique/i.test(mensagemErro(criar.error))
              ? `Já existe uma loja com o código ${nova.codigo}.`
              : mensagemErro(criar.error)}
          </Mensagem>
        </div>
      )}
    </Pagina>
  )
}
