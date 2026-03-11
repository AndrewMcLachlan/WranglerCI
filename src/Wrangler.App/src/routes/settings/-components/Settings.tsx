import { useGroupedRepositories } from "../../../hooks/useGroupedRepositories";
import { Tabs, Tab } from "@andrewmclachlan/moo-ds";
import { RepoSelector } from "./RepoSelector";

export const Settings = () => {

  const accounts = useGroupedRepositories();

  return (
    <article>
      <h2>Repositories</h2>
      {accounts.isLoading ? (
        <p>Loading repositories...</p>
      ) : accounts.isError ? (
        <p>Error loading repositories: {accounts.error.message}</p>
      ) : (
        <Tabs defaultActiveKey={accounts.data?.[0]?.login}>
          {accounts.data?.map(account => (
            <Tab className="repo-selector" key={account.login} eventKey={account.login} title={account.login}>
              <RepoSelector account={account} />
            </Tab>
          ))}
        </Tabs>
      )
      }
    </article>
  );
}
