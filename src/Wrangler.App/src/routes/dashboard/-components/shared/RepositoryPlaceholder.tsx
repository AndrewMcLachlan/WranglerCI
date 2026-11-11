/** Stands in for a repository whose workflows are still loading. */
export const RepositoryPlaceholder: React.FC<{ name: string }> = ({ name }) => (
  <div className="repository-placeholder" aria-busy="true" aria-label={`Loading ${name}`}>
    <div className="repository-placeholder-header">
      <span className="repository-placeholder-dot" />
      <h3>{name}</h3>
    </div>
    <div className="repository-placeholder-body">
      <span className="repository-placeholder-bar" />
      <span className="repository-placeholder-bar" />
    </div>
  </div>
);
