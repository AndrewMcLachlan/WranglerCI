import type { PropsWithChildren } from "react";
import { PullToRefresh } from "@andrewmclachlan/moo-ds";

interface ScrollRestoredListProps {
  /** Unique per page: the key the scroll position is remembered under. */
  id: string;
  onRefresh: () => Promise<unknown>;
  className?: string;
}

/**
 * A pull-to-refresh list whose scroll position survives navigating away.
 *
 * The router restores the window's scroll, and this list is its own scroll
 * container; `data-scroll-restoration-id` is what puts it back under the
 * router's care.
 */
export const ScrollRestoredList: React.FC<PropsWithChildren<ScrollRestoredListProps>> = ({
  id, onRefresh, className, children,
}) => (
  <PullToRefresh data-scroll-restoration-id={id} onRefresh={onRefresh} className={className}>
    {children}
  </PullToRefresh>
);
