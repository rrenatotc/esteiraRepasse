// Nomes dos canais de IPC. Arquivo sem dependências: o preload roda em
// sandbox e não pode carregar módulos externos (como o zod).
export const CANAIS = {
  sessaoLer: 'sessao:ler',
  sessaoSalvar: 'sessao:salvar',
  sessaoRemover: 'sessao:remover',
  appInfo: 'app:info',
  appNotificar: 'app:notificar',
  appContador: 'app:contador',
  appAbrirExterno: 'app:abrir-externo',
  configLer: 'config:ler',
  configSalvar: 'config:salvar',
  eventoNavegar: 'evento:navegar',
  estoqueStatus: 'estoque:status',
  estoqueObservar: 'estoque:observar',
  estoqueEscolherPasta: 'estoque:escolher-pasta',
  estoqueLerMaisRecente: 'estoque:ler-mais-recente',
  estoqueUltimaLeitura: 'estoque:ultima-leitura',
  eventoEstoqueNovoArquivo: 'evento:estoque-novo-arquivo',
  arquivoSalvar: 'arquivo:salvar'
} as const
