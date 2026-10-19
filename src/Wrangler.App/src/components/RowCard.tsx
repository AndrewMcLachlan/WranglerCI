import classNames from "classnames";
import type { MouseEvent, ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export interface RowCardDetail {
  label: string;
  value: ReactNode;
}

export interface RowCardProps {
  /** Omit to render a card that cannot be selected — no checkbox appears. */
  onSelect?: () => void;
  selected?: boolean;
  selectDisabled?: boolean;
  selectLabel?: string;
  title: ReactNode;
  /** Status badges and the like, shown under the title. */
  meta?: ReactNode;
  details?: RowCardDetail[];
  /** Opened in a new tab from the card's top-right corner. */
  href?: string;
  hrefLabel?: string;
}

/**
 * One record as a card, for the narrow layout. Every value carries its own
 * label, because a card has no column header to inherit meaning from.
 * Tapping anywhere on a selectable card toggles it.
 */
export const RowCard: React.FC<RowCardProps> = ({
  onSelect, selected = false, selectDisabled = false, selectLabel,
  title, meta, details, href, hrefLabel,
}) => {
  const selectable = !!onSelect && !selectDisabled;

  const onCardClick = (e: MouseEvent<HTMLElement>) => {
    // Must skip the checkbox: its own change already toggles, so a second toggle undoes it.
    if (!selectable || (e.target as Element).closest("a, button, input")) return;
    onSelect();
  };

  return (
    <article className={classNames("row-card", selectable && "selectable", selected && "selected")} onClick={onCardClick}>
      <div className="row-card-head">
        {onSelect && (
          <input
            type="checkbox"
            className="row-card-select"
            checked={selected}
            onChange={onSelect}
            disabled={selectDisabled}
            aria-label={selectLabel}
          />
        )}
        <div className="row-card-title">{title}</div>
        {href && (
          <a className="row-card-open" href={href} target="_blank" rel="noopener noreferrer" aria-label={hrefLabel} title={hrefLabel}>
            <FontAwesomeIcon icon="arrow-up-right-from-square" />
          </a>
        )}
      </div>
      {meta && <div className="row-card-meta">{meta}</div>}
      {details && details.length > 0 && (
        <dl className="row-card-details">
          {details.map(({ label, value }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
};
