/**
 * Pure storage access for the PR author filter. No React, so it is unit-testable
 * in a node environment.
 */

import type { StorageLike } from "../../settings/-hooks/repositoryFeatures";

export const PR_AUTHORS_KEY = "prAuthors";

export const DEFAULT_PR_AUTHORS = ["dependabot[bot]", "renovate[bot]"];

/**
 * Reads the stored author filter, falling back to the defaults only when nothing
 * valid is stored. An explicitly emptied list is preserved — that is a real user
 * choice, not an absent value.
 */
export const readPrAuthors = (storage: StorageLike): string[] => {
  const stored = storage.getItem(PR_AUTHORS_KEY);
  if (stored === null) return DEFAULT_PR_AUTHORS;

  try {
    const value: unknown = JSON.parse(stored);
    return Array.isArray(value) ? (value as string[]) : DEFAULT_PR_AUTHORS;
  } catch {
    return DEFAULT_PR_AUTHORS;
  }
};

/**
 * Query options for the stored author filter.
 *
 * As with selectedRepositoriesQueryOptions, initialData must be the stored value
 * rather than a placeholder: react-query stamps initialData with
 * dataUpdatedAt = now, so under a non-zero staleTime the queryFn never runs to
 * replace it and the placeholder is served as if it were the user's setting.
 */
export const prAuthorsQueryOptions = (storage: StorageLike) => {
  const data = readPrAuthors(storage);

  return {
    queryKey: [PR_AUTHORS_KEY, data] as const,
    queryFn: () => data,
    initialData: data,
  };
};
