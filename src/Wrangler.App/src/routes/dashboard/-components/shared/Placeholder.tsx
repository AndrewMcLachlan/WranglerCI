/** Stands in for a repository or workflow card whose runs are still loading. */
export const PlaceholderCard: React.FC<{ title?: string; label: string }> = ({ title, label }) => (
  <div className="placeholder-card" aria-busy="true" aria-label={label}>
    <div className="placeholder-card-header">
      <span className="placeholder-dot" />
      {title ? <h3>{title}</h3> : <span className="placeholder-bar" />}
    </div>
    <div className="placeholder-card-body">
      <span className="placeholder-bar" />
      <span className="placeholder-bar" />
    </div>
  </div>
);

/** Stands in for a workflow row whose runs are still loading. */
export const PlaceholderRow: React.FC<{ name?: string }> = ({ name }) => (
  <div className="placeholder-row" aria-busy="true" aria-label={`Loading ${name ?? "workflow"}`}>
    <span className="placeholder-dot" />
    {name ? <span className="placeholder-name">{name}</span> : <span className="placeholder-bar" />}
  </div>
);
