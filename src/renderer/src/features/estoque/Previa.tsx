// Pré-visualização de uma exportação do Bravos antes de aplicar (RF19).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { LeituraEstoque } from '@shared/estoque'
import { Placa } from '@renderer/components/Placa'
import { Button } from '@renderer/components/ui/button'
import { useOnline } from '@renderer/hooks/useOnline'
import { mensagemErro } from '@renderer/lib/erros'
import { leituraJaAplicada, leituraMaisAntiga, previaEstoque, sincronizarEstoque, ultimaImportacao } from './api'
import { CHAVES } from './useEstoqueRepasse'

const dataHora = (iso: string): string => format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

function Numero({ valor, rotulo, destaque }: { valor: number; rotulo: string; destaque?: boolean }): React.JSX.Element {
  return (
    <div className="flex flex-col">
      <span className={`numeros text-[22px] font-semibold leading-7 ${destaque ? 'text-alerta-parado' : ''}`}>{valor}</span>
      <span className="text-[13px] text-grafite">{rotulo}</span>
    </div>
  )
}

function Lista({ titulo, children }: { titulo: string; children: ReactNode }): React.JSX.Element {
  return (
    <details className="border-t border-linha py-2">
      <summary className="cursor-default py-1 text-[13px] font-medium">{titulo}</summary>
      <div className="max-h-56 overflow-auto pt-1">{children}</div>
    </details>
  )
}

function Aviso({ tom, children }: { tom: 'alerta' | 'erro'; children: ReactNode }): React.JSX.Element {
  return (
    <p
      role="alert"
      className={`flex items-start gap-2 border-l-2 px-3 py-2 text-[13px] ${tom === 'erro' ? 'border-erro bg-erro-fundo text-erro' : 'border-alerta-parado bg-[#fdf3ee] text-alerta-parado'}`}
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

export function Previa({ leitura, onDescartar }: { leitura: LeituraEstoque; onDescartar: () => void }): React.JSX.Element {
  const queryClient = useQueryClient()
  const online = useOnline()
  const [forcarConfirmado, setForcarConfirmado] = useState(false)
  const ultima = useQuery({ queryKey: CHAVES.ultima, queryFn: ultimaImportacao })
  const previa = useQuery({
    queryKey: ['estoque', 'previa', leitura.caminho, leitura.modificadoEm],
    queryFn: () => previaEstoque(leitura.itens),
    enabled: leitura.colunasFaltando.length === 0
  })
  const aplicar = useMutation({
    mutationFn: (forcar: boolean) => sincronizarEstoque(leitura, forcar),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['estoque'] })
  })

  const jaAplicada = leituraJaAplicada(leitura, ultima.data ?? null)
  const maisAntiga = leituraMaisAntiga(leitura, ultima.data ?? null)
  const outras = Object.entries(leitura.ignoradas.outrasSituacoes).sort((a, b) => b[1] - a[1])
  const p = previa.data

  return (
    <section aria-label="Pré-visualização da exportação" className="animate-surgir mb-6 border border-linha bg-superficie">
      <header className="flex items-start justify-between gap-4 border-b border-linha px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold">{leitura.arquivo}</h2>
          <p className="text-[13px] text-grafite">Arquivo gerado em {dataHora(leitura.modificadoEm)}</p>
        </div>
        {!aplicar.isSuccess && !jaAplicada && (
          <div className="flex gap-2">
            <Button variante="secundario" onClick={onDescartar}>
              Descartar
            </Button>
            {!p?.bloqueado && (
              <Button onClick={() => aplicar.mutate(false)} disabled={!p || aplicar.isPending || !online}>
                {aplicar.isPending ? 'Aplicando…' : 'Aplicar atualização'}
              </Button>
            )}
          </div>
        )}
      </header>

      <div className="flex flex-col gap-3 px-5 py-4">
        {aplicar.isSuccess && (
          <p role="status" className="flex items-center gap-2 text-status-faturada">
            <CheckCircle2 className="size-4" aria-hidden />
            Estoque atualizado: {aplicar.data.novos} novos, {aplicar.data.atualizados} atualizados, {aplicar.data.sairam} saíram do
            estoque.
          </p>
        )}
        {jaAplicada && !aplicar.isSuccess && (
          <p role="status" className="text-grafite">
            Esta exportação já foi aplicada. Nada a fazer.
          </p>
        )}
        {leitura.colunasFaltando.length > 0 && (
          <Aviso tom="erro">
            Faltam colunas obrigatórias: {leitura.colunasFaltando.join(', ')}. Confira se exportou o relatório de estoque do Bravos.
          </Aviso>
        )}
        {maisAntiga && !jaAplicada && (
          <Aviso tom="alerta">
            Este arquivo é mais antigo que a última atualização aplicada ({dataHora(ultima.data!.arquivo_modificado_em!)}).
            Aplicar vai voltar o estoque para aquela data.
          </Aviso>
        )}
        {previa.isError && <Aviso tom="erro">{mensagemErro(previa.error)}</Aviso>}
        {aplicar.isError && <Aviso tom="erro">{mensagemErro(aplicar.error)}</Aviso>}
        {previa.isPending && leitura.colunasFaltando.length === 0 && <p className="text-grafite">Comparando com o cadastro…</p>}

        {p && (
          <>
            <div className="flex flex-wrap gap-x-10 gap-y-3">
              <Numero valor={p.novos} rotulo="novos" />
              <Numero valor={p.atualizados} rotulo="atualizados" />
              <Numero valor={p.sairam} rotulo="saem do estoque" destaque={p.sairam > 0} />
              <Numero valor={p.mantidos} rotulo="mantidos" />
              <Numero valor={leitura.erros.length} rotulo="linhas com erro" destaque={leitura.erros.length > 0} />
            </div>
            <p className="text-[13px] text-grafite">
              {p.total} veículos de repasse na planilha (hoje há {p.em_estoque_atual} em estoque).
              {p.voltaram > 0 && ` ${p.voltaram} voltam ao estoque.`}
              {p.mesclados > 0 && ` ${p.mesclados} cadastrados à mão passam a vir do Bravos.`} Ignoradas:{' '}
              {leitura.ignoradas.semPlaca} sem placa
              {outras.map(([sit, n]) => `, ${n} em ${sit}`).join('')}.
            </p>

            {p.bloqueado && !aplicar.isSuccess && (
              <div className="flex flex-col gap-3 border-l-2 border-erro bg-erro-fundo px-3 py-3">
                <p role="alert" className="text-[13px] text-erro">
                  <strong className="font-semibold">Atualização bloqueada.</strong> {p.motivo_bloqueio}
                </p>
                {p.total > 0 && (
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-[13px]">
                      <input
                        type="checkbox"
                        className="size-4 accent-erro"
                        checked={forcarConfirmado}
                        onChange={(e) => setForcarConfirmado(e.target.checked)}
                      />
                      Conferi o arquivo e quero aplicar mesmo assim ({p.sairam} veículos sairão do estoque)
                    </label>
                    <Button
                      variante="perigo"
                      tamanho="sm"
                      disabled={!forcarConfirmado || aplicar.isPending || !online}
                      onClick={() => aplicar.mutate(true)}
                    >
                      Aplicar mesmo assim
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {leitura.avisos.length > 0 && (
          <ul className="list-disc pl-5 text-[13px] text-grafite">
            {leitura.avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
      </div>

      {(leitura.erros.length > 0 || (p && (p.placas_novas.length > 0 || p.placas_sairam.length > 0))) && (
        <div className="px-5 pb-2">
          {leitura.erros.length > 0 && (
            <Lista titulo={`Linhas com erro (${leitura.erros.length})`}>
              <ul className="text-[13px]">
                {leitura.erros.map((e) => (
                  <li key={e.linha} className="numeros py-0.5">
                    Linha {e.linha}: {e.motivo}
                  </li>
                ))}
              </ul>
            </Lista>
          )}
          {p && p.placas_novas.length > 0 && (
            <Lista titulo={`Veículos novos (${p.placas_novas.length})`}>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-x-6 gap-y-1">
                {p.placas_novas.map((v) => (
                  <li key={v.placa} className="flex items-center gap-2 text-[13px]">
                    <Placa placa={v.placa} /> {v.modelo}
                  </li>
                ))}
              </ul>
            </Lista>
          )}
          {p && p.placas_sairam.length > 0 && (
            <Lista titulo={`Saem do estoque (${p.placas_sairam.length})`}>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-x-6 gap-y-1">
                {p.placas_sairam.map((v) => (
                  <li key={v.placa} className="flex items-center gap-2 text-[13px]">
                    <Placa placa={v.placa} /> {v.modelo}
                  </li>
                ))}
              </ul>
            </Lista>
          )}
        </div>
      )}
    </section>
  )
}
