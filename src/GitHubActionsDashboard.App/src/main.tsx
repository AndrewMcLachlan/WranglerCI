import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { createRouter, Link, RouterProvider } from "@tanstack/react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { configureInterceptors } from "./utils/axiosInterceptors.ts"


import { library } from "@fortawesome/fontawesome-svg-core";
import { faArrowUpRightFromSquare, faBarsStaggered, faChevronRight, faListUl, faTimesCircle } from "@fortawesome/free-solid-svg-icons";

import { routeTree } from './routeTree.gen'
import { Spinner } from "./components/Spinner"
import { LinkProvider, ThemeProvider } from "@andrewmclachlan/moo-ds"
import { NavLnk } from "./components/NavLink"
import { client } from "./api/client.gen.ts"

library.add(faArrowUpRightFromSquare, faBarsStaggered, faChevronRight, faListUl, faTimesCircle);

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

const queryClient = new QueryClient();

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
  </StrictMode>,
)
