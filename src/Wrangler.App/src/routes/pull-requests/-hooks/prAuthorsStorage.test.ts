import { describe, it, expect } from "vitest";
import { DEFAULT_PR_AUTHORS, PR_AUTHORS_KEY, readPrAuthors, prAuthorsQueryOptions } from "./prAuthorsStorage";
import type { StorageLike } from "../../settings/-hooks/repositoryFeatures";

const makeStorage = (initial: Record<string, string> = {}): StorageLike => {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
  };
};

describe("readPrAuthors", () => {
  it("returns the stored authors", () => {
    const storage = makeStorage({ [PR_AUTHORS_KEY]: JSON.stringify(["octocat"]) });
    expect(readPrAuthors(storage)).toEqual(["octocat"]);
  });

  it("falls back to the defaults when nothing is stored", () => {
    expect(readPrAuthors(makeStorage())).toEqual(DEFAULT_PR_AUTHORS);
  });

  it("preserves a deliberately emptied author list", () => {
    const storage = makeStorage({ [PR_AUTHORS_KEY]: JSON.stringify([]) });
    expect(readPrAuthors(storage)).toEqual([]);
  });

  it("falls back to the defaults rather than throwing on corrupt JSON", () => {
    expect(readPrAuthors(makeStorage({ [PR_AUTHORS_KEY]: "not json" }))).toEqual(DEFAULT_PR_AUTHORS);
  });
});

describe("prAuthorsQueryOptions", () => {
  // Same defect as selectedRepositoriesQueryOptions: a placeholder initialData is
  // served permanently under a non-zero staleTime, silently resetting the user's
  // author filter to the defaults.
  it("uses the stored authors as initialData, not the defaults", () => {
    const storage = makeStorage({ [PR_AUTHORS_KEY]: JSON.stringify(["octocat"]) });
    expect(prAuthorsQueryOptions(storage).initialData).toEqual(["octocat"]);
  });

  it("keeps initialData consistent with the data the query key is built from", () => {
    const storage = makeStorage({ [PR_AUTHORS_KEY]: JSON.stringify(["octocat"]) });
    const options = prAuthorsQueryOptions(storage);
    expect(options.initialData).toEqual(options.queryKey[1]);
  });

  it("does not resurrect the defaults for a deliberately emptied list", () => {
    const storage = makeStorage({ [PR_AUTHORS_KEY]: JSON.stringify([]) });
    expect(prAuthorsQueryOptions(storage).initialData).toEqual([]);
  });
});
