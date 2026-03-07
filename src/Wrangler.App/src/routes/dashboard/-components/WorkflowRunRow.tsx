import { DateTime } from "luxon";
import type { RepositoryModel, WorkflowModel, WorkflowRunModel } from "../../../api";
import { Badge } from "./Badge";

export const WorkflowRunRow: React.FC<WorkflowRunRowProps> = ({ repository, workflow, run }) => {

    const formatter = new Intl.RelativeTimeFormat(navigator.language, { style: 'long' });

    const updatedAt = DateTime.fromISO(run.updatedAt!);
    const timeAgo = updatedAt.toRelative({ style: 'long' }) || formatter.format(0, 'seconds');

    return (
        <tr key={`${repository.owner}|${repository.name}`}>
            <td><Badge className={run.workflowStatus?.toLowerCase()}>{run.conclusion || run.status}</Badge></td>
            <td>{workflow.name}</td>
            <td><Badge>{run.headBranch}</Badge></td>
            <td title={DateTime.fromISO(run.updatedAt!).toFormat('yyyy-MM-dd HH:mm:ss')}>{timeAgo}</td>
            <td>{repository.owner}</td>
            <td><a href={repository.htmlUrl!} target="_blank" rel="noopener noreferrer">{repository.name}</a></td>
            <td><a href={run.htmlUrl} target="_blank" rel="noopener noreferrer">View Run</a></td>
        </tr>
    );
};

export interface WorkflowRunRowProps {
    repository: RepositoryModel;
    workflow: WorkflowModel;
    run: WorkflowRunModel;
}
