import { Icon } from "@andrewmclachlan/moo-ds";
import { Cog, Dashboard, PullRequest } from "@andrewmclachlan/moo-icons";
import { Link } from "@tanstack/react-router";
import type { PropsWithChildren } from "react";

export const Layout: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <div className="layout">
      <header>
        <h1>
          <Link to="/dashboard">
            <picture>
              <source srcSet="/logo-white.svg" media="(prefers-color-scheme: dark)" />
              <img src="/logo.svg" className="logo" />
            </picture>
            Wrangler CI
          </Link>
        </h1>
        <nav className="top-nav">
          <ul>
            <li><Link to="/dashboard/overview"><Icon icon={Dashboard} /></Link></li>
            <li><Link to="/pull-requests"><Icon icon={PullRequest} className="pr-icon" /></Link></li>
            <li><Link to="/settings"><Icon icon={Cog} /></Link></li>
          </ul>
        </nav>
      </header>
      <main>
        {children}
      </main>
    </div >
  );
}
