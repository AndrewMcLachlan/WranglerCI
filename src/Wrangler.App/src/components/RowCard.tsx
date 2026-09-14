import type { ReactNode } from "react";

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
  actions?: ReactNode;
}

/**
 * One record as a card, for the narrow layout. Every value carries its own
 * label, because a card has no column header to inherit meaning from.
 */
export const RowCard: React.FC<RowCardProps> = ({
  onSelect, selected = false, selectDisabled = false, selectLabel,
  title, meta, details, actions,
}) => (
  <article className="row-card">
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
    {actions && <div className="row-card-actions">{actions}</div>}
  </article>
);
