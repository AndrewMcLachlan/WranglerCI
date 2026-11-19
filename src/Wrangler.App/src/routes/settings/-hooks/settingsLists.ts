import { isAttentionOptedIn, type SelectedRepository } from "./repositoryFeatures";

type WorkflowId = number | string;

export const matchesSearch = (name: string, search: string): boolean => {
  const term = search.trim().toLowerCase();
  return term === "" || name.toLowerCase().includes(term);
};

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

export const groupRepositories = <T extends { owner: string; name: string }>(
  repositories: T[],
  selected: SelectedRepository[],
  search: string,
): { inUse: T[]; others: T[] } => {
  const inUse: T[] = [];
  const others: T[] = [];

  for (const repo of repositories.filter((r) => matchesSearch(r.name, search))) {
    const entry = selected.find((s) => s.owner === repo.owner && s.name === repo.name);
    (entry && isAttentionOptedIn(entry) ? inUse : others).push(repo);
  }

  return { inUse: inUse.sort(byName), others: others.sort(byName) };
};

export const defaultRepository = <T extends { owner: string; name: string }>(
  repositories: T[],
  selected: SelectedRepository[],
): T | undefined => {
  const { inUse, others } = groupRepositories(repositories, selected, "");
  return inUse[0] ?? others[0];
};

export const visibleWorkflows = <T extends { name: string }>(workflows: T[], filter: string): T[] =>
  workflows.filter((w) => matchesSearch(w.name, filter));

export const selectedCount = (workflows: { id?: WorkflowId }[], selectedIds: WorkflowId[]): number =>
  workflows.filter((w) => w.id !== undefined && selectedIds.includes(w.id)).length;

export const setWorkflows = (selectedIds: WorkflowId[], shown: { id?: WorkflowId }[], on: boolean): WorkflowId[] => {
  const shownIds = shown.flatMap((w) => (w.id === undefined ? [] : [w.id]));
  if (!on) return selectedIds.filter((id) => !shownIds.includes(id));
  return [...selectedIds, ...shownIds.filter((id, i) => !selectedIds.includes(id) && shownIds.indexOf(id) === i)];
};
