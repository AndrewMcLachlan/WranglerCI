import { useEffect, useRef, useState } from "react";
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
      <button type="button" className="user-menu-toggle" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={`Signed in as ${user.login}`}>
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="user-menu-avatar" />
        ) : (
          <span className="user-menu-avatar user-menu-avatar-fallback" aria-hidden="true">{user.login.charAt(0).toUpperCase()}</span>
        )}
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
