import { createFileRoute } from "@tanstack/react-router";
import { Home } from "./-components/Home";

const isInstalledPwa = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true);

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (isInstalledPwa()) {
      // Installed-app users have already chosen us; skip the marketing
      // home and go straight to OAuth. Successful sign-in lands on
      // /dashboard via the existing callback flow.
      window.location.replace("/login/github");
    }
  },
  component: Home,
});
