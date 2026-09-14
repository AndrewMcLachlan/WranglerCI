import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { createRouter, Link, RouterProvider } from "@tanstack/react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { configureInterceptors } from "./utils/axiosInterceptors.ts"


import { library } from "@fortawesome/fontawesome-svg-core";
import { faArrowUpRightFromSquare, faBarsStaggered, faChevronRight, faCodePullRequest, faFilter, faGauge, faListUl, faLongArrowDown, faLongArrowUp, faShieldHalved, faTimesCircle, faXmark } from "@fortawesome/free-solid-svg-icons";

import { routeTree } from './routeTree.gen'
import { Spinner } from "./components/Spinner"
import { LinkProvider, ThemeProvider } from "@andrewmclachlan/moo-ds"
import { NavLnk } from "./components/NavLink"
import { client } from "./api/client.gen.ts"
import { QUERY_DEFAULTS } from "./queryDefaults.ts"
import { restoreQueryCache, startPersistingQueryCache } from "./queryCachePersistence.ts"
import { registerServiceWorker } from "./pwa/registerServiceWorker"

// An icon missing from the library renders as nothing at all.
library.add(faArrowUpRightFromSquare, faBarsStaggered, faChevronRight, faCodePullRequest, faFilter, faGauge, faListUl, faLongArrowDown, faLongArrowUp, faShieldHalved, faTimesCircle, faXmark);

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

// Defaults live in queryDefaults.ts, where they are asserted. Hooks override
// where their freshness contract differs.
const queryClient = new QueryClient({ defaultOptions: { queries: QUERY_DEFAULTS } });

// Must stay ahead of the render below — a restore after it cannot spare the
// first paint its spinner.
restoreQueryCache(queryClient, localStorage);
startPersistingQueryCache(queryClient, localStorage);

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
