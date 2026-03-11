import { useQuery } from "@tanstack/react-query";
import { getRepositoriesGroupedOptions } from "../api/@tanstack/react-query.gen";
import type { AccountModel } from "../api";

// TODO: Remove this fake data - temporary for testing issue #76
const includeFakeData = import.meta.env.DEV;

const fakeAccount: AccountModel = {
  login: "FakeOrg",
  avatarUrl: "",
  htmlUrl: "https://github.com/FakeOrg",
  repositories: [{
    fullName: "FakeOrg/big-repo",
    name: "big-repo",
    owner: "FakeOrg",
    nodeId: "fake-repo-node",
    htmlUrl: "https://github.com/FakeOrg/big-repo",
    workflows: Array.from({ length: 40 }, (_, i) => ({
      id: 90000 + i,
      nodeId: `fake-wf-${i}`,
      name: `Workflow ${i + 1}`,
      htmlUrl: `https://github.com/FakeOrg/big-repo/blob/main/.github/workflows/wf-${i}.yml`,
    })),
  }],
};

export const useGroupedRepositories = () => {
  const query = useQuery({
    ...getRepositoriesGroupedOptions(),
  });

  if (includeFakeData && query.data) {
    return { ...query, data: [...query.data, fakeAccount] };
  }

  return query;
}
