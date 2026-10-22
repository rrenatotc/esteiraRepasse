// Aviso de versão nova baixada e novidades depois de atualizar (RNF09, 9.1).
import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { EstadoAtualizacao } from '@shared/ipc'
import type { Novidade } from '@shared/novidades'
import { Button } from '@renderer/components/ui/button'

export function useEstadoAtualizacao(): EstadoAtualizacao | null {
  const [estado, setEstado] = useState<EstadoAtualizacao | null>(null)
  useEffect(() => {
    void window.esteira.atualizacao.estado().then(setEstado)
    return window.esteira.atualizacao.onEstado(setEstado)
  }, [])
  return estado
}

export function AvisoAtualizacao(): React.JSX.Element | null {
  const estado = useEstadoAtualizacao()
  if (estado?.tipo !== 'pronta') return null
  return (
    <div role="status" className="flex items-center gap-3 border-b border-azul-placa/20 bg-superficie-selecionada px-4 py-2 text-[13px]">
      <Sparkles className="size-4 text-azul-placa" aria-hidden />
      <span>
        A versão <span className="numeros font-medium">{estado.versao}</span> já foi baixada. Reinicie quando puder; leva poucos segundos.
      </span>
      <Button tamanho="sm" className="ml-auto" onClick={() => void window.esteira.atualizacao.reiniciar()}>
        Reiniciar para atualizar
      </Button>
    </div>
  )
}

export function Novidades(): React.JSX.Element | null {
  const [novidades, setNovidades] = useState<Novidade[]>([])
  useEffect(() => {
    void window.esteira.atualizacao.novidades().then(setNovidades)
  }, [])
  if (novidades.length === 0) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/30 p-6" role="dialog" aria-modal="true" aria-labelledby="titulo-novidades">
      <div className="animate-surgir w-full max-w-md border border-linha bg-superficie p-6">
        <h2 id="titulo-novidades" className="mb-4 text-[17px] font-semibold">
          O app foi atualizado
        </h2>
        <div className="flex max-h-80 flex-col gap-4 overflow-auto">
          {novidades.map((n) => (
            <section key={n.versao}>
              <h3 className="numeros mb-1 text-[13px] font-medium text-grafite">Versão {n.versao}</h3>
              <ul className="list-disc pl-5">
                {n.itens.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <Button autoFocus onClick={() => setNovidades([])}>
            Entendi
          </Button>
        </div>
      </div>
    </div>
  )
}
