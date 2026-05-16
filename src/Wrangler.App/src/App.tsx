import { Outlet, useRouterState } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Notifications } from '@andrewmclachlan/moo-ds'
import { Layout } from './layout/Layout'
import { useGitHubEventStream } from './hooks/useGitHubEventStream'

function App() {

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/";

  useGitHubEventStream(!isHome);

  if (isHome) {
    return (
      <>
        <Outlet />
        <Notifications />
        <TanStackRouterDevtools />
      </>
    );
  }

  return (
    <Layout>
      <Outlet />
      <Notifications />
      <TanStackRouterDevtools />
    </Layout>
  )
}

export default App
