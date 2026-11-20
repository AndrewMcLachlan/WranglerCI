import { useLocalStorage } from "@andrewmclachlan/moo-ds";

/** The bot logins whose pull requests are hidden on the Bot PRs tab. */
export const usePrExcludeBots = () =>
  useLocalStorage<string[]>("prExcludeBots", []);
