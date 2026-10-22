import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { placaValida } from '@shared/placa'
import { useAuth } from '@renderer/app/auth'
import { AvisoSemRede } from '@renderer/app/Layout'
import { PlacaInput } from '@renderer/components/Placa'
import { ROTULO_STATUS, Status, COR_TRILHO } from '@renderer/components/Status'
import { Button, botao } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { consultarPlaca, type ResultadoConsulta } from './api'

const data = (iso: string | null): string => (iso ? format(parseISO(iso), 'dd/MM/yyyy') : '—')
const dataHora = (iso: string): string => format(parseISO(iso), "dd/MM 'às' HH:mm", { locale: ptBR })

function Resultado({ r }: { r: ResultadoConsulta }): React.JSX.Element {
  return (
    <section aria-live="polite" className="animate-surgir w-full border border-linha bg-superficie">
      <div className="flex items-start justify-between gap-4 border-b border-linha px-6 py-4">
        <div>
          <p className="text-[15px] font-semibold">
            {r.marca} {r.modelo}
          </p>
          <p className="text-grafite">
            Loja da proposta: {r.loja.codigo} {r.loja.nome}
          </p>
        </div>
        <Status status={r.status} className="text-[15px]" />
      </div>
      <dl className="grid grid-cols-2 gap-x-6 border-b border-linha px-6 py-4">
        <div>
          <dt className="text-[13px] text-grafite">Proposta</dt>
          <dd className="numeros">
            {r.numero_proposta ?? '—'} · {data(r.data_emissao_proposta)}
          </dd>
        </div>
        <div>
          <dt className="text-[13px] text-grafite">Nota fiscal</dt>
          <dd className="numeros">
            {r.numero_nf ?? '—'} · {data(r.data_emissao_nf)}
          </dd>
        </div>
      </dl>
      <ol className="px-6 py-4" aria-label="Linha do tempo">
        {[...r.linha_do_tempo].reverse().map((etapa, i, todas) => (
          <li key={`${etapa.status}-${etapa.em}`} className="relative flex gap-3 pb-4 last:pb-0">
            {i < todas.length - 1 && <span aria-hidden className="absolute left-[4px] top-3 h-full w-px bg-linha" />}
            <span aria-hidden className={cn('relative mt-1.5 size-[9px] shrink-0 rounded-full', COR_TRILHO[etapa.status])} />
            <span className="flex flex-1 justify-between gap-4">
              <span className={cn(i === 0 && 'font-medium')}>{ROTULO_STATUS[etapa.status]}</span>
              <span className="numeros text-grafite">{dataHora(etapa.em)}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** RF01: tela inicial sem login. Também acessível pelo menu depois do login. */
export function ConsultaPublica({ embutida = false }: { embutida?: boolean }): React.JSX.Element {
  const { sessao } = useAuth()
  const [placa, setPlaca] = useState('')
  const consulta = useMutation({ mutationFn: consultarPlaca })
  const valida = placaValida(placa)

  function enviar(e: FormEvent): void {
    e.preventDefault()
    if (valida) consulta.mutate(placa)
  }

  const resposta = consulta.data
  return (
    <div className="flex min-h-full flex-col">
      {!embutida && (
        <>
          <header className="flex items-center justify-between border-b border-linha bg-superficie px-6 py-3">
            <span className="font-semibold">Esteira do Repasse</span>
            <Link to={sessao ? '/app' : '/entrar'} className={botao({ variante: 'secundario', tamanho: 'sm' })}>
              {sessao ? 'Ir para o sistema' : 'Entrar'}
            </Link>
          </header>
          <AvisoSemRede />
        </>
      )}
      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col items-center px-6 pt-[12vh] pb-12">
        <h1 className="mb-2 text-[22px] font-semibold">Consulte o andamento da venda</h1>
        <p className="mb-8 text-grafite">Digite a placa do veículo, no padrão antigo ou Mercosul.</p>
        <form onSubmit={enviar} className="mb-10 flex items-center gap-3">
          <PlacaInput value={placa} onValueChange={setPlaca} aria-label="Placa do veículo" autoFocus />
          <Button type="submit" tamanho="lg" disabled={!valida || consulta.isPending}>
            {consulta.isPending ? 'Consultando…' : 'Consultar'}
          </Button>
        </form>

        {resposta?.tipo === 'encontrada' && <Resultado r={resposta.resultado} />}
        {resposta?.tipo === 'nao-encontrada' && (
          <p className="text-grafite" aria-live="polite">
            Nenhuma venda encontrada para esta placa.
          </p>
        )}
        {resposta?.tipo === 'limite' && (
          <p className="text-alerta-parado" aria-live="polite">
            Muitas consultas seguidas. Aguarde um minuto e tente de novo.
          </p>
        )}
        {resposta?.tipo === 'erro' && (
          <p className="text-erro" aria-live="polite">
            {resposta.mensagem}
          </p>
        )}
      </div>
    </div>
  )
}
