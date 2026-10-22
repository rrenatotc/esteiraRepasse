import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { createHashRouter, Outlet, RouterProvider, useNavigate } from 'react-router-dom'
import { AuthProvider } from './app/auth'
import { Layout } from './app/Layout'
import { IrParaInicio, Protegida } from './app/Protegida'
import { EmConstrucao } from './components/Pagina'
import { Entrar } from './features/auth/Entrar'
import { Configuracoes } from './features/configuracoes/Configuracoes'
import { ConsultaPublica } from './features/consulta/ConsultaPublica'
import { Estoque } from './features/estoque/Estoque'
import { Lojistas } from './features/lojistas/Lojistas'
import { RegistrarVenda } from './features/vendas/RegistrarVenda'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } }
})

/** Clique numa notificação do Windows abre a rota indicada pelo main. */
function Raiz(): React.JSX.Element {
  const navegar = useNavigate()
  useEffect(() => window.esteira.app.onNavegar((rota) => navegar(`/app${rota}`)), [navegar])
  return <Outlet />
}

const router = createHashRouter([
  {
    element: <Raiz />,
    children: [
      { path: '/', element: <ConsultaPublica /> },
      { path: '/entrar', element: <Entrar /> },
      {
        path: '/app',
        element: (
          <Protegida>
            <Layout />
          </Protegida>
        ),
        children: [
          { index: true, element: <IrParaInicio /> },
          { path: 'consulta', element: <ConsultaPublica embutida /> },
          { path: 'configuracoes', element: <Configuracoes /> },
          {
            path: 'vendas/nova',
            element: (
              <Protegida papeis={['vendedor', 'repasse']}>
                <RegistrarVenda />
              </Protegida>
            )
          },
          {
            path: 'vendas',
            element: (
              <Protegida papeis={['vendedor', 'repasse']}>
                <EmConstrucao titulo="Minhas vendas" fase={5} descricao="Suas vendas com status, tempo e pendências no topo." />
              </Protegida>
            )
          },
          {
            path: 'fila/:id?',
            element: (
              <Protegida papeis={['repasse', 'gestor']}>
                <EmConstrucao titulo="Fila de demandas" fase={4} descricao="Lista densa com detalhe ao lado, ações por status, atalhos e notificações." />
              </Protegida>
            )
          },
          {
            path: 'estoque',
            element: (
              <Protegida papeis={['repasse']}>
                <Estoque />
              </Protegida>
            )
          },
          {
            path: 'lojistas',
            element: (
              <Protegida papeis={['repasse']}>
                <Lojistas />
              </Protegida>
            )
          },
          {
            path: 'usuarios',
            element: (
              <Protegida papeis={['repasse']}>
                <EmConstrucao titulo="Usuários" fase={4} descricao="Convite por e-mail, papel, loja e ativação." />
              </Protegida>
            )
          },
          {
            path: 'lojas',
            element: (
              <Protegida papeis={['repasse']}>
                <EmConstrucao titulo="Lojas" fase={4} descricao="As 11 lojas do grupo, com código do Bravos." />
              </Protegida>
            )
          },
          {
            path: 'painel',
            element: (
              <Protegida papeis={['gestor', 'repasse']}>
                <EmConstrucao titulo="Painel" fase={6} descricao="Vendas e faturamento por loja, funil por status, tempo médio e exportação." />
              </Protegida>
            )
          }
        ]
      }
    ]
  }
])

export default function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
