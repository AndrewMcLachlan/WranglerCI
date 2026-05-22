import { useEffect, useRef, useState } from "react";
import { Icon } from "@andrewmclachlan/moo-ds";
import { User } from "@andrewmclachlan/moo-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "../hooks/useCurrentUser";

export const UserMenu = () => {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!user) return null;

  const handleLogout = async () => {
    try {
      await fetch("/logout", { method: "POST", credentials: "include" });
    } finally {
      // Drop all cached data tied to the previous session, then send the
      // user back to the marketing/home page.
      queryClient.clear();
      window.location.href = "/";
    }
  };

  return (
    <div className="user-menu" ref={containerRef}>
      <button type="button" className="user-menu-toggle" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <Icon icon={User} />
        <span className="user-menu-login">{user.login}</span>
      </button>
      {open && (
        <ul className="user-menu-dropdown" role="menu">
          <li role="none">
            <button type="button" role="menuitem" onClick={handleLogout}>Log out</button>
          </li>
        </ul>
      )}
    </div>
  );
};
