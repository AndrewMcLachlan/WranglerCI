import { Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Notifications } from '@andrewmclachlan/moo-ds'
import { Layout } from './layout/Layout'

function App() {

  return (
    <Layout>
      <Outlet />
      <Notifications />
      <TanStackRouterDevtools />
    </Layout>
  )
}

export default App
