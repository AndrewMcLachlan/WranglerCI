import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { createRouter, Link, RouterProvider } from "@tanstack/react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { configureInterceptors } from "./utils/axiosInterceptors.ts"


import { library } from "@fortawesome/fontawesome-svg-core";
import { faArrowUpRightFromSquare, faBarsStaggered, faChevronRight, faCodePullRequest, faGauge, faListUl, faLongArrowDown, faLongArrowUp, faShieldHalved, faTimesCircle } from "@fortawesome/free-solid-svg-icons";

import { routeTree } from './routeTree.gen'
import { Spinner } from "./components/Spinner"
import { LinkProvider, ThemeProvider } from "@andrewmclachlan/moo-ds"
import { NavLnk } from "./components/NavLink"
import { client } from "./api/client.gen.ts"
import { QUERY_DEFAULTS } from "./queryDefaults.ts"
import { registerServiceWorker } from "./pwa/registerServiceWorker"

library.add(faArrowUpRightFromSquare, faBarsStaggered, faChevronRight, faCodePullRequest, faGauge, faListUl, faLongArrowDown, faLongArrowUp, faShieldHalved, faTimesCircle);

registerServiceWorker();

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  defaultPendingComponent: Spinner,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

console.log("config", client.getConfig());

// Defaults live in queryDefaults.ts (and are asserted there) rather than
// per-hook, so a new query can't silently inherit react-query's aggressive
// defaults; hooks still override where their freshness contract differs.
const queryClient = new QueryClient({ defaultOptions: { queries: QUERY_DEFAULTS } });

configureInterceptors();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LinkProvider LinkComponent={Link} NavLinkComponent={NavLnk}>
          <RouterProvider router={router} />
        </LinkProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
)
