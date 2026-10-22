// Liga a observação da pasta do Bravos enquanto o repasse está logado e,
// se configurado, aplica sozinho as exportações que passam na trava.
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { LeituraEstoque } from '@shared/estoque'
import { mensagemErro } from '@renderer/lib/erros'
import { leituraJaAplicada, leituraMaisAntiga, previaEstoque, sincronizarEstoque, ultimaImportacao } from './api'

export const CHAVES = {
  leitura: ['estoque', 'leitura'] as const,
  ultima: ['estoque', 'ultima-importacao'] as const,
  historico: ['estoque', 'historico'] as const,
  veiculos: ['estoque', 'veiculos'] as const,
  status: ['estoque', 'status'] as const
}

async function aplicarAutomatico(leitura: LeituraEstoque): Promise<'aplicada' | 'revisar' | 'ignorar'> {
  const ultima = await ultimaImportacao()
  if (leituraJaAplicada(leitura, ultima)) return 'ignorar'
  if (leituraMaisAntiga(leitura, ultima) || leitura.erros.length > 0) return 'revisar'
  const previa = await previaEstoque(leitura.itens)
  if (previa.bloqueado) return 'revisar'
  const r = await sincronizarEstoque(leitura, false)
  void window.esteira.app.notificar({
    titulo: 'Estoque atualizado',
    corpo: `${r.novos} novos, ${r.atualizados} atualizados, ${r.sairam} saíram do estoque.`,
    rota: '/estoque'
  })
  return 'aplicada'
}

export function useEstoqueRepasse(ativo: boolean): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!ativo) return
    void window.esteira.estoque.observar(true).then((s) => queryClient.setQueryData(CHAVES.status, s))

    const desligar = window.esteira.estoque.onNovoArquivo(async (leitura) => {
      queryClient.setQueryData(CHAVES.leitura, leitura)
      const config = await window.esteira.config.ler()
      if (!config.aplicarEstoqueAutomatico) return
      try {
        const resultado = await aplicarAutomatico(leitura)
        if (resultado === 'revisar') {
          void window.esteira.app.notificar({
            titulo: 'Nova exportação do Bravos precisa de revisão',
            corpo: `${leitura.arquivo} não passou nas verificações automáticas. Clique para revisar.`,
            rota: '/estoque'
          })
        }
      } catch (erro) {
        void window.esteira.app.notificar({ titulo: 'Falha ao atualizar o estoque', corpo: mensagemErro(erro), rota: '/estoque' })
      } finally {
        void queryClient.invalidateQueries({ queryKey: ['estoque'] })
        queryClient.setQueryData(CHAVES.leitura, leitura)
      }
    })

    return () => {
      desligar()
      void window.esteira.estoque.observar(false)
    }
  }, [ativo, queryClient])
}
