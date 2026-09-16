import { breakpoints, useIsAtLeast } from "@andrewmclachlan/moo-ds";

/** The width at and above which the wide layout applies. */
export const NARROW_BREAKPOINT = breakpoints.md;

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

/** True while the viewport is narrower than the breakpoint. */
export const useIsNarrow = (): boolean => !useIsAtLeast("md");
