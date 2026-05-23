import { useQuery } from "@tanstack/react-query";

export interface CurrentUser {
  login: string;
  avatarUrl?: string;
}

export const useCurrentUser = () =>
  useQuery<CurrentUser | null>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error(`Failed to fetch current user: ${res.status}`);
      return res.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
