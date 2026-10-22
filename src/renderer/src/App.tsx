import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { createHashRouter, Outlet, RouterProvider, useNavigate } from 'react-router-dom'
import { AvisoAtualizacao, Novidades } from './app/Atualizacao'
import { AuthProvider } from './app/auth'
import { Layout } from './app/Layout'
import { IrParaInicio, Protegida } from './app/Protegida'
import { Entrar } from './features/auth/Entrar'
import { Configuracoes } from './features/configuracoes/Configuracoes'
import { ConsultaPublica } from './features/consulta/ConsultaPublica'
import { Estoque } from './features/estoque/Estoque'
import { Fila } from './features/fila/Fila'
import { Lojas } from './features/lojas/Lojas'
import { Painel } from './features/painel/Painel'
import { Lojistas } from './features/lojistas/Lojistas'
import { Usuarios } from './features/usuarios/Usuarios'
import { CorrigirVenda } from './features/vendas/CorrigirVenda'
import { MinhasVendas } from './features/vendas/MinhasVendas'
import { RegistrarVenda } from './features/vendas/RegistrarVenda'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } }
})

/** Clique numa notificação do Windows abre a rota indicada pelo main. */
function Raiz(): React.JSX.Element {
  const navegar = useNavigate()
  useEffect(() => window.esteira.app.onNavegar((rota) => navegar(`/app${rota}`)), [navegar])
  return (
    <div className="flex h-full flex-col">
      <AvisoAtualizacao />
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
      <Novidades />
    </div>
  )
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
                <MinhasVendas />
              </Protegida>
            )
          },
          {
            path: 'vendas/:id/corrigir',
            element: (
              <Protegida papeis={['vendedor', 'repasse']}>
                <CorrigirVenda />
              </Protegida>
            )
          },
          {
            path: 'fila/:id?',
            element: (
              <Protegida papeis={['repasse', 'gestor']}>
                <Fila />
              </Protegida>
            )
          },
          {
            path: 'estoque',
            element: (
              <Protegida papeis={['repasse', 'gestor', 'vendedor']}>
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
                <Usuarios />
              </Protegida>
            )
          },
          {
            path: 'lojas',
            element: (
              <Protegida papeis={['repasse', 'gestor', 'vendedor']}>
                <Lojas />
              </Protegida>
            )
          },
          {
            path: 'painel',
            element: (
              <Protegida papeis={['repasse', 'gestor', 'vendedor']}>
                <Painel />
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
