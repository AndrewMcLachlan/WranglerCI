import { useSyncExternalStore } from "react";

/** The viewport width below which the narrow layout applies. Matches `--narrow` in css/variables.css. */
export const NARROW_BREAKPOINT = 768;

const query = `(max-width: ${NARROW_BREAKPOINT - 1}px)`;

/**
 * The narrow test for code outside React, such as route guards.
 *
 * Must stay matchMedia: innerWidth counts the scrollbar and the media query
 * does not, so two guards testing it differently can redirect to each other
 * forever around the breakpoint.
 */
export const isNarrowViewport = (): boolean =>
    typeof window !== "undefined" && window.matchMedia(query).matches;

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
        // No viewport to measure during a prerender; wide is the default.
        () => false,
    );
