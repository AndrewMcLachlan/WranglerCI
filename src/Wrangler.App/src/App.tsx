import { Outlet, useRouterState } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Notifications } from '@andrewmclachlan/moo-ds'
import { Layout } from './layout/Layout'
import { useGitHubEventStream } from './hooks/useGitHubEventStream'
import { useReconcileSelectedRepositories } from './hooks/useReconcileSelectedRepositories'
import { useWarmCaches } from './hooks/useWarmCaches'

function App() {

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isStandalone = pathname === "/" || pathname === "/privacy";

  useGitHubEventStream(!isStandalone);
  // Drop selected repos GitHub no longer lists (renamed/removed) so they stop
  // producing stale, duplicate items everywhere.
  useReconcileSelectedRepositories();
  // Every page's data, fetched while you read the one you asked for.
  useWarmCaches(!isStandalone);

  if (isStandalone) {
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
