import { postWorkflows } from "../../../api";
import type { RepositoryModel } from "../../../api";
import type { SelectedRepository } from "../../settings/-hooks/repositoryFeatures";

interface Waiter {
  repository: SelectedRepository;
  resolve: (repositories: RepositoryModel[]) => void;
  reject: (error: unknown) => void;
}

interface Batch {
  branchFilter: string[];
  waiters: Waiter[];
}

const batches = new Map<string, Batch>();

const sameRepository = (a: { owner: string; name: string }, b: { owner: string; name: string }) =>
  a.owner.toLowerCase() === b.owner.toLowerCase() && a.name.toLowerCase() === b.name.toLowerCase();

const send = async ({ branchFilter, waiters }: Batch) => {
  try {
    const result = await postWorkflows({
      body: {
        repositories: waiters.map((w) => w.repository),
        branchFilters: branchFilter.length ? branchFilter : undefined,
      },
    });
    const data = result.data ?? [];
    for (const waiter of waiters) waiter.resolve(data.filter((r) => sameRepository(r, waiter.repository)));
  } catch (error) {
    for (const waiter of waiters) waiter.reject(error);
  }
};

/**
 * One repository's dashboard workflows. Every repository asked for in the same tick with the
 * same branch filter shares one request, so a page of per-repository queries still loads in a
 * single round trip. Resolves empty when the repository has nothing to show.
 */
export const fetchRepositoryWorkflows = (repository: SelectedRepository, branchFilter: string[]): Promise<RepositoryModel[]> =>
  new Promise((resolve, reject) => {
    const key = JSON.stringify(branchFilter);
    let batch = batches.get(key);
    if (!batch) {
      const created: Batch = { branchFilter, waiters: [] };
      batches.set(key, created);
      setTimeout(() => {
        batches.delete(key);
        void send(created);
      }, 0);
      batch = created;
    }
    batch.waiters.push({ repository, resolve, reject });
  });
