// Realtime das demandas (RF05, RF14): atualiza listas na hora, avisa com
// notificação do Windows e mantém o contador de novas na bandeja.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { formatarBRL } from '@shared/moeda'
import { CODIGO_DEMANDA, type Demanda, type StatusDemanda } from '@shared/tipos'
import { ROTULO_STATUS } from '@renderer/components/Status'
import { contarNovas } from '@renderer/features/fila/api'
import { supabase } from '@renderer/lib/supabase'
import type { PerfilComLoja } from './auth'

/** Selo da barra de tarefas: círculo azul-placa com o número. */
function desenharSelo(total: number): string | null {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 32
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#003399'
  ctx.beginPath()
  ctx.arc(16, 16, 15, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = `600 ${total > 9 ? 15 : 19}px "Archivo Variable", "Segoe UI", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(total > 9 ? '9+' : String(total), 16, 17)
  return canvas.toDataURL('image/png')
}

export function useContadorNovas(ativo: boolean): number {
  const novas = useQuery({ queryKey: ['fila', 'contador'], queryFn: contarNovas, enabled: ativo, refetchInterval: 5 * 60_000 })
  const total = ativo ? (novas.data ?? 0) : 0
  useEffect(() => {
    if (!ativo) return
    void window.esteira.app.contador({ total, icone: total > 0 ? desenharSelo(total) : null })
  }, [ativo, total])
  return total
}

export function useRealtime(perfil: PerfilComLoja | null): void {
  const queryClient = useQueryClient()
  const id = perfil?.id
  const papel = perfil?.papel

  useEffect(() => {
    if (!id || !papel) return
    // Último status conhecido de cada demanda: o realtime com RLS não manda o
    // registro antigo, então é assim que se sabe se o status mudou.
    const conhecidos = new Map<string, StatusDemanda>()
    void supabase
      .from('demandas')
      .select('id, status')
      .then(({ data }) => data?.forEach((d) => conhecidos.set(d.id, d.status)))

    const atualizarListas = (): void => {
      void queryClient.invalidateQueries({ queryKey: ['fila'] })
      void queryClient.invalidateQueries({ queryKey: ['vendas'] })
    }

    const canal = supabase
      .channel(`demandas-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'demandas' }, (evento) => {
        atualizarListas()
        if (evento.eventType === 'DELETE') return
        const d = evento.new as Demanda
        const antes = conhecidos.get(d.id)
        conhecidos.set(d.id, d.status)
        const codigo = CODIGO_DEMANDA(d.codigo)

        if (papel === 'repasse') {
          if (evento.eventType === 'INSERT' && d.vendedor_id !== id) {
            void window.esteira.app.notificar({
              titulo: `Nova demanda ${codigo}`,
              corpo: `Placa ${d.placa} · ${formatarBRL(d.valor_venda)}`,
              rota: `/fila/${d.id}`
            })
          } else if (evento.eventType === 'UPDATE' && antes === 'pendente' && d.status === 'nova') {
            void window.esteira.app.notificar({
              titulo: `Venda corrigida ${codigo}`,
              corpo: `O vendedor reenviou a placa ${d.placa}.`,
              rota: `/fila/${d.id}`
            })
          }
        }

        if (papel === 'vendedor' && evento.eventType === 'UPDATE' && d.vendedor_id === id && antes && antes !== d.status) {
          void window.esteira.app.notificar({
            titulo: d.status === 'pendente' ? `Venda ${codigo} voltou com pendência` : `Venda ${codigo}: ${ROTULO_STATUS[d.status].toLowerCase()}`,
            corpo: d.status === 'pendente' ? (d.motivo_ultimo ?? 'Abra para ver o que corrigir.') : `Placa ${d.placa}`,
            rota: '/vendas'
          })
        }
      })
      .subscribe()

    // RNF10: ao voltar a rede o canal reconecta sozinho; recarrega o que pode ter passado.
    window.addEventListener('online', atualizarListas)
    return () => {
      window.removeEventListener('online', atualizarListas)
      void supabase.removeChannel(canal)
    }
  }, [id, papel, queryClient])
}
