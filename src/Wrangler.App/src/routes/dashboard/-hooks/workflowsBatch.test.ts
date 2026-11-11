import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RepositoryModel } from "../../../api";
import { fetchRepositoryWorkflows } from "./workflowsBatch";

type Post = (options: { body?: { repositories?: unknown[] } }) => Promise<{ data?: RepositoryModel[] }>;

const api = vi.hoisted(() => ({ post: undefined as unknown as Post, calls: [] as Parameters<Post>[0][] }));

vi.mock("../../../api", () => ({
  postWorkflows: (options: Parameters<Post>[0]) => {
    api.calls.push(options);
    return api.post(options);
  },
}));

const repository = (owner: string, name: string): RepositoryModel => ({
  owner,
  name,
  ownerName: owner,
  nodeId: `${owner}/${name}`,
  htmlUrl: `https://github.com/${owner}/${name}`,
  workflows: [],
});

const respond = (data: RepositoryModel[]) => { api.post = async () => ({ data }); };

describe("fetchRepositoryWorkflows", () => {
  beforeEach(() => { api.calls.length = 0; });

  it("asks for every repository requested in the same tick in one request", async () => {
    respond([repository("Acme", "widget"), repository("acme", "gadget")]);

    const [widget, gadget] = await Promise.all([
      fetchRepositoryWorkflows({ owner: "acme", name: "widget", workflows: [1] }, []),
      fetchRepositoryWorkflows({ owner: "acme", name: "gadget", workflows: [2] }, []),
    ]);

    expect(api.calls).toHaveLength(1);
    expect(api.calls[0].body?.repositories).toHaveLength(2);
    expect(widget.map((r) => r.name)).toEqual(["widget"]);
    expect(gadget.map((r) => r.name)).toEqual(["gadget"]);
  });

  it("resolves empty for a repository the response leaves out", async () => {
    respond([]);

    expect(await fetchRepositoryWorkflows({ owner: "acme", name: "widget", workflows: [1] }, [])).toEqual([]);
  });

  it("sends each branch filter separately", async () => {
    respond([]);

    await Promise.all([
      fetchRepositoryWorkflows({ owner: "acme", name: "widget", workflows: [1] }, []),
      fetchRepositoryWorkflows({ owner: "acme", name: "gadget", workflows: [2] }, ["release/*"]),
    ]);

    expect(api.calls).toHaveLength(2);
  });

  it("rejects every repository in a failed request", async () => {
    api.post = async () => { throw new Error("boom"); };

    const results = await Promise.allSettled([
      fetchRepositoryWorkflows({ owner: "acme", name: "widget", workflows: [1] }, []),
      fetchRepositoryWorkflows({ owner: "acme", name: "gadget", workflows: [2] }, []),
    ]);

    expect(results.map((r) => r.status)).toEqual(["rejected", "rejected"]);
  });
});
