import { useWorkflows } from "../-hooks/useWorkflows";
import { useDashboardContext } from "../-providers/DashboardProvider";
import { Spinner } from "../../../components/Spinner";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { WorkflowRunRow } from "./WorkflowRunRow";

export const List = () => {

  const { data: selectedRepositories } = useSelectedRepositories();

  const request = selectedRepositories.reduce((acc, repo) => {
    const key = repo.owner;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(repo.name);
    return acc;
  }, {} as Record<string, string[]>);

  const { data: repositories, isLoading, isError, error } = useWorkflows();

  const list = repositories?.flatMap(repo => repo.workflows?.flatMap(workflow => workflow.runs?.flatMap(run => ({
    repo: repo,
    workflow: workflow,
    run: run,
  })))) ?? [];

  list?.sort((a, b) => {
    return a!.run.updatedAt! > b!.run.updatedAt! ? -1 : 1;
  });

  return (
    <table className="workflow-run-table">
      <thead>
        <tr>
          <th>Status</th>
          <th>Workflow</th>
          <th>Branch</th>
          <th>Run</th>
          <th>Owner</th>
          <th>Repository</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {isLoading && <Spinner />}
        {isError && <tr><td colSpan={6}>Error loading build info: {error.message}</td></tr>}
        {(!isLoading && (!repositories || repositories.length === 0)) && <tr><td colSpan={6}>No workflows found.</td></tr>}
        {list.map((item) => (
          <WorkflowRunRow
            key={item!.run.id}
            repository={item!.repo}
            workflow={item!.workflow}
            run={item!.run}
          />
        ))}
      </tbody>
    </table>
  )


}
