/**
 * Pure logic for the unified per-repo feature model stored in the
 * "repositories" localStorage key. No React and no direct localStorage access
 * (ensureMigrated writes only to the storage it is handed) so everything here
 * is unit-testable in a node environment.
 */

export interface SelectedRepository {
  owner: string;
  name: string;
  workflows?: (number | string)[]; // dashboard + gates
  pullRequests?: boolean;          // repo appears on the Pull Requests page
  securityAlerts?: boolean;        // security alerts shown in the Attention feed
}

export const REPOSITORIES_KEY = "repositories";
export const PR_REPOSITORIES_KEY = "prRepositories";
export const SCHEMA_VERSION_KEY = "repositoriesSchemaVersion";
export const SCHEMA_VERSION = "2";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** A repo is on the Dashboard (and therefore Gates) iff it has selected workflows. */
export const hasDashboardWorkflows = (repo: SelectedRepository): boolean =>
  (repo.workflows?.length ?? 0) > 0;

const repoKey = (owner: string, name: string) => `${owner}/${name}`;

const parseArray = <T>(json: string | null): T[] => {
  if (json === null) return [];
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
};

/**
 * One-time v2 migration (pure core). Every existing entry gets
 * securityAlerts: true — the old Attention feed sent every entry, so this
 * preserves behavior exactly. The old PR scope seeds pullRequests: a null
 * prRepositoriesJson means the key was absent, where the old PR page fell back
 * to the whole "repositories" list; an existing (possibly empty) key was an
 * explicit, independent scope.
 */
export const migrateRepositories = (
  repositoriesJson: string | null,
  prRepositoriesJson: string | null,
): SelectedRepository[] => {
  const repositories = parseArray<SelectedRepository>(repositoriesJson);
  const migrated = repositories.map((r) => ({ ...r, securityAlerts: true }));

  if (prRepositoriesJson === null) {
    return migrated.map((r) => ({ ...r, pullRequests: true }));
  }

  const prScope = parseArray<{ owner: string; name: string }>(prRepositoriesJson);
  const prKeys = new Set(prScope.map((r) => repoKey(r.owner, r.name)));
  const existingKeys = new Set(migrated.map((r) => repoKey(r.owner, r.name)));

  const flagged = migrated.map((r) =>
    prKeys.has(repoKey(r.owner, r.name)) ? { ...r, pullRequests: true } : r);

  // Repos that were PR-scoped but never selected in settings become PR-only entries.
  const added = prScope
    .filter((r) => !existingKeys.has(repoKey(r.owner, r.name)))
    .map((r): SelectedRepository => ({
      owner: r.owner,
      name: r.name,
      workflows: [],
      pullRequests: true,
      securityAlerts: false,
    }));

  return [...flagged, ...added];
};

/** Runs the migration at most once, guarded by the schema version stamp. */
export const ensureMigrated = (storage: StorageLike): void => {
  if (storage.getItem(SCHEMA_VERSION_KEY) === SCHEMA_VERSION) return;
  const migrated = migrateRepositories(
    storage.getItem(REPOSITORIES_KEY),
    storage.getItem(PR_REPOSITORIES_KEY),
  );
  storage.setItem(REPOSITORIES_KEY, JSON.stringify(migrated));
  storage.setItem(SCHEMA_VERSION_KEY, SCHEMA_VERSION);
  storage.removeItem(PR_REPOSITORIES_KEY);
};

/**
 * Returns a new list with the (owner, name) entry patched, creating it with
 * empty workflows if absent. New entries are appended; existing entries are
 * patched in place so list order (and therefore downstream query-key/card
 * ordering) is preserved. Always builds fresh objects — entries may be
 * references into the react-query cache, and mutating them in place corrupts
 * the cache and defeats referential-equality change detection.
 */
export const upsertRepository = (
  repositories: SelectedRepository[],
  owner: string,
  name: string,
  patch: Partial<Omit<SelectedRepository, "owner" | "name">>,
): SelectedRepository[] => {
  const exists = repositories.some((r) => r.owner === owner && r.name === name);
  if (!exists) return [...repositories, { owner, name, workflows: [], ...patch }];
  return repositories.map((r) =>
    r.owner === owner && r.name === name ? { ...r, ...patch } : r);
};

/** A repo participates in the Attention feed if it is opted into anything. */
export const isAttentionOptedIn = (repo: SelectedRepository): boolean =>
  hasDashboardWorkflows(repo) || repo.pullRequests === true || repo.securityAlerts === true;

/**
 * Structural stand-in for the generated AttentionItem API type, so this pure
 * module never imports from src/api.
 */
export interface AttentionItemLike {
  type: string;
  repositoryOwner: string;
  repositoryName: string;
}

/**
 * The backend returns every item type for every repo in the request; each
 * item is shown only if its repo opted into that item's feature.
 */
export const isAttentionItemVisible = (
  item: AttentionItemLike,
  repositories: SelectedRepository[],
): boolean => {
  const repo = repositories.find((r) => r.owner === item.repositoryOwner && r.name === item.repositoryName);
  if (!repo) return false;
  switch (item.type) {
    case "WorkflowFailure": return hasDashboardWorkflows(repo);
    case "PullRequestReview": return repo.pullRequests === true;
    case "SecurityAlert": return repo.securityAlerts === true;
    default: return false;
  }
};
