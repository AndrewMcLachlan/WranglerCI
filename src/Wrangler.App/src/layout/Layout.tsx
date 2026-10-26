import { Icon } from "@andrewmclachlan/moo-ds";
import { Bell, Dashboard, PullRequest, UserShield } from "@andrewmclachlan/moo-icons";
import { Link, useMatches } from "@tanstack/react-router";
import type { PropsWithChildren } from "react";
import { UserMenu } from "./UserMenu";
import { useAttention } from "../routes/attention/-hooks/useAttention";

export const Layout: React.FC<PropsWithChildren> = ({ children }) => {
  const { data: attentionItems } = useAttention();
  const attentionCount = attentionItems?.length ?? 0;
  const title = useMatches({ select: (matches) => matches.map((m) => m.staticData.title).filter(Boolean).at(-1) });

  return (
    <div className="layout">
      <header>
        <h1>
          <Link to="/dashboard">
            <picture>
              <source srcSet="/logo-white.svg" media="(prefers-color-scheme: dark)" />
              <img src="/logo.svg" className="logo" alt="Wrangler CI" />
            </picture>
          </Link>
        </h1>
        <span className="header-title">{title}</span>
        <div className="header-end">
          <nav className="top-nav">
            <ul>
              <li><Link to="/dashboard" title="Dashboard"><Icon icon={Dashboard} /></Link></li>
              <li><Link to="/pull-requests" title="Pull requests"><Icon icon={PullRequest} className="pr-icon" /></Link></li>
              <li><Link to="/gates" title="Deployment gates"><Icon icon={UserShield} /></Link></li>
            </ul>
            <span className="top-nav-divider" />
            <ul>
              <li>
                <Link to="/attention" title="Needs your attention" className="attention-link">
                  <Icon icon={Bell} />
                  {attentionCount > 0 && <span className="attention-dot" />}
                </Link>
              </li>
            </ul>
          </nav>
          <UserMenu />
        </div>
      </header>
      <main>
        {children}
      </main>
    </div >
  );
}
