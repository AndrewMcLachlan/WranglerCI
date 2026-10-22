import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { createRouter, Link, RouterProvider } from "@tanstack/react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { configureInterceptors } from "./utils/axiosInterceptors.ts"


import { library } from "@fortawesome/fontawesome-svg-core";
import { faArrowUpRightFromSquare, faBarsStaggered, faChevronRight, faCircleCheck, faCodePullRequest, faComment, faFilter, faGauge, faListUl, faLongArrowDown, faLongArrowUp, faShieldHalved, faTimesCircle, faXmark } from "@fortawesome/free-solid-svg-icons";

import { routeTree } from './routeTree.gen'
import { Spinner } from "./components/Spinner"
import { LinkProvider, ThemeProvider, type Theme } from "@andrewmclachlan/moo-ds"
import { NavLnk } from "./components/NavLink"
import { client } from "./api/client.gen.ts"
import { QUERY_DEFAULTS } from "./queryDefaults.ts"
import { restoreQueryCache, startPersistingQueryCache } from "./queryCachePersistence.ts"
import { registerServiceWorker } from "./pwa/registerServiceWorker"

// An icon missing from the library renders as nothing at all.
library.add(faArrowUpRightFromSquare, faBarsStaggered, faChevronRight, faCircleCheck, faCodePullRequest, faComment, faFilter, faGauge, faListUl, faLongArrowDown, faLongArrowUp, faShieldHalved, faTimesCircle, faXmark);

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
  interface StaticDataRouteOption {
    /** Shown in the header bar on a phone, in place of the page's own heading. */
    title?: string
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

// The app's only theme. Its colour must equal the header's background: iOS fills
// the status bar with it and ramps any difference down over the header.
const wranglerTheme: Theme = { name: "Wrangler", theme: "dark", colour: "#08080D" };

// Must run before the render: ThemeProvider prefers a stored theme, and one left
// by moo-ds's defaults carries a colour the header doesn't have.
localStorage.setItem("theme", JSON.stringify(wranglerTheme));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider themes={[wranglerTheme]} defaultTheme={wranglerTheme}>
        <LinkProvider LinkComponent={Link} NavLinkComponent={NavLnk}>
          <RouterProvider router={router} />
        </LinkProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
)
