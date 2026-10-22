import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useState, type FormEvent } from 'react'
import { placaValida } from '@shared/placa'
import { Placa, PlacaInput } from '@renderer/components/Placa'
import { Button } from '@renderer/components/ui/button'
import { Campo, Input } from '@renderer/components/ui/campo'
import { mensagemErro } from '@renderer/lib/erros'
import { buscarPlaca, type Veiculo, type VeiculoManual } from './api'
import { Confirmacao, Mensagem, Rodape } from './componentes'

export interface DadosPlaca {
  placa: string
  veiculo: Veiculo | null
  manual: VeiculoManual | null
}

const dataHora = (iso: string): string => format(parseISO(iso), "dd/MM 'às' HH:mm", { locale: ptBR })

function ano(texto: string): number | null {
  const n = Number(texto)
  return /^\d{4}$/.test(texto) && n >= 1950 && n <= 2101 ? n : null
}

export function descricaoVeiculo(v: { marca: string; modelo: string; ano_fabricacao: number | null; ano_modelo: number | null; cor: string | null }): string {
  const anos = v.ano_fabricacao || v.ano_modelo ? `${v.ano_fabricacao ?? '—'}/${v.ano_modelo ?? '—'}` : null
  return [`${v.marca} ${v.modelo}`, anos, v.cor].filter(Boolean).join(' · ')
}

export function PassoPlaca({ inicial, onAvancar }: { inicial: DadosPlaca; onAvancar: (d: DadosPlaca) => void }): React.JSX.Element {
  const [placa, setPlaca] = useState(inicial.placa)
  const [manual, setManual] = useState({
    marca: inicial.manual?.marca ?? '',
    modelo: inicial.manual?.modelo ?? '',
    fab: inicial.manual?.ano_fabricacao?.toString() ?? '',
    mod: inicial.manual?.ano_modelo?.toString() ?? '',
    cor: inicial.manual?.cor ?? ''
  })
  const valida = placaValida(placa)
  const busca = useQuery({ queryKey: ['venda', 'placa', placa], queryFn: () => buscarPlaca(placa), enabled: valida, staleTime: 0 })
  const r = valida ? busca.data : undefined

  const anosInvalidos = (manual.fab !== '' && ano(manual.fab) === null) || (manual.mod !== '' && ano(manual.mod) === null)
  const manualOk = manual.marca.trim() !== '' && manual.modelo.trim() !== '' && !anosInvalidos
  const podeAvancar = !!r && !r.aberta && (!!r.veiculo || manualOk)

  function avancar(e: FormEvent): void {
    e.preventDefault()
    if (!podeAvancar || !r) return
    onAvancar({
      placa,
      veiculo: r.veiculo,
      manual: r.veiculo
        ? null
        : {
            marca: manual.marca.trim(),
            modelo: manual.modelo.trim(),
            ano_fabricacao: ano(manual.fab),
            ano_modelo: ano(manual.mod),
            cor: manual.cor.trim() || null
          }
    })
  }

  return (
    <form onSubmit={avancar} noValidate>
      <h2 className="mb-1 text-[17px] font-semibold">Qual a placa do veículo?</h2>
      <p className="mb-6 text-grafite">Padrão antigo ou Mercosul. O sistema procura no estoque do Bravos.</p>
      <PlacaInput value={placa} onValueChange={setPlaca} aria-label="Placa do veículo" autoFocus />

      <div className="mt-6 flex flex-col gap-4">
        {valida && busca.isPending && <p className="text-grafite">Procurando no estoque…</p>}
        {busca.isError && <Mensagem tom="erro">{mensagemErro(busca.error)}</Mensagem>}

        {r?.aberta && (
          <Mensagem tom="erro">
            Já existe uma venda aberta para a placa {placa} ({r.aberta.codigo}, {r.aberta.status_rotulo.toLowerCase()}). Fale com o
            repasse se precisar mudar algo nela.
          </Mensagem>
        )}

        {r && !r.aberta && r.veiculo && (
          <>
            <Confirmacao titulo={descricaoVeiculo(r.veiculo)} acao={<Placa placa={r.veiculo.placa} />}>
              {r.veiculo.km !== null && `${r.veiculo.km.toLocaleString('pt-BR')} km · `}
              {r.veiculo.filial_estoque ? `Filial ${r.veiculo.filial_estoque}` : 'Filial não informada'}
              {r.veiculo.dias_em_estoque !== null && ` · ${r.veiculo.dias_em_estoque} dias em estoque`}
            </Confirmacao>
            {!r.veiculo.em_estoque && r.veiculo.origem === 'bravos' && (
              <Mensagem tom="alerta">
                Este veículo saiu do estoque
                {r.veiculo.saiu_do_estoque_em ? ` em ${format(parseISO(r.veiculo.saiu_do_estoque_em), 'dd/MM/yyyy')}` : ''}. Confira com o
                repasse se a venda ainda vale.
              </Mensagem>
            )}
            {r.veiculo.origem === 'manual' && (
              <Mensagem tom="info">Veículo cadastrado à mão anteriormente; o repasse ainda vai conferir os dados.</Mensagem>
            )}
          </>
        )}

        {r && !r.aberta && !r.veiculo && (
          <div className="animate-surgir flex flex-col gap-4">
            <Mensagem tom="alerta">
              Placa não encontrada no estoque
              {r.estoqueAtualizadoEm ? ` atualizado em ${dataHora(r.estoqueAtualizadoEm)}` : ' (o estoque ainda não foi atualizado)'}.
              Preencha os dados abaixo; o repasse vai revisar o cadastro.
            </Mensagem>
            <div className="grid grid-cols-2 gap-4">
              <Campo rotulo="Marca">
                {(p) => <Input {...p} value={manual.marca} onChange={(e) => setManual({ ...manual, marca: e.target.value })} placeholder="Ex.: Volkswagen" />}
              </Campo>
              <Campo rotulo="Modelo">
                {(p) => <Input {...p} value={manual.modelo} onChange={(e) => setManual({ ...manual, modelo: e.target.value })} placeholder="Ex.: Polo Highline" />}
              </Campo>
              <div className="grid grid-cols-2 gap-4">
                <Campo rotulo="Ano de fabricação" erro={manual.fab !== '' && ano(manual.fab) === null ? 'Ano com 4 dígitos' : undefined}>
                  {(p) => (
                    <Input {...p} inputMode="numeric" maxLength={4} className="numeros" value={manual.fab} onChange={(e) => setManual({ ...manual, fab: e.target.value.replace(/\D/g, '') })} />
                  )}
                </Campo>
                <Campo rotulo="Ano do modelo" erro={manual.mod !== '' && ano(manual.mod) === null ? 'Ano com 4 dígitos' : undefined}>
                  {(p) => (
                    <Input {...p} inputMode="numeric" maxLength={4} className="numeros" value={manual.mod} onChange={(e) => setManual({ ...manual, mod: e.target.value.replace(/\D/g, '') })} />
                  )}
                </Campo>
              </div>
              <Campo rotulo="Cor">
                {(p) => <Input {...p} value={manual.cor} onChange={(e) => setManual({ ...manual, cor: e.target.value })} />}
              </Campo>
            </div>
          </div>
        )}
      </div>

      <Rodape>
        <Button type="submit" disabled={!podeAvancar}>
          Continuar
        </Button>
      </Rodape>
    </form>
  )
}
