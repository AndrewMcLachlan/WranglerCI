import { useSyncExternalStore } from "react";

/**
 * The viewport width below which the app renders its narrow layout. Kept in
 * step with `--narrow` in css/variables.css: CSS handles the styling, this
 * handles the cases where narrow means rendering something else entirely.
 */
export const NARROW_BREAKPOINT = 768;

const query = `(max-width: ${NARROW_BREAKPOINT - 1}px)`;

const subscribe = (onChange: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
};

/** True while the viewport is narrower than the breakpoint. Re-renders on resize and rotation. */
export const useIsNarrow = (): boolean =>
    useSyncExternalStore(
        subscribe,
        () => window.matchMedia(query).matches,
        // Server snapshot: there is no viewport to measure during SSR or a
        // prerender, and assuming wide keeps the desktop markup as the default.
        () => false,
    );
