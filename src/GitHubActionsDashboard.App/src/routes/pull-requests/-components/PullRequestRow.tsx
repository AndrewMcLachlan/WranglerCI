import { DateTime } from "luxon";
import { CheckStatusBadge } from "./CheckStatusBadge";
import { Badge } from "../../dashboard/-components/Badge";
import type { PullRequestModel } from "../../../api";

export const canApprove = (pr: PullRequestModel) => pr.checkStatus === "Success" && pr.mergeable !== false;

export const PullRequestRow: React.FC<PullRequestRowProps> = ({ pr, selected, onToggle }) => {

    const formatter = new Intl.RelativeTimeFormat(navigator.language, { style: "long" });

    const updatedAt = DateTime.fromISO(pr.updatedAt!);
    const timeAgo = updatedAt.toRelative({ style: "long" }) || formatter.format(0, "seconds");

    return (
        <tr>
            <td>
                <input type="checkbox" checked={selected} onChange={() => onToggle(pr)} disabled={!canApprove(pr)} />
            </td>
            <td>{pr.repositoryOwner}/{pr.repositoryName}</td>
            <td><a href={pr.htmlUrl!} target="_blank" rel="noopener noreferrer">{pr.title}</a></td>
            <td>{pr.author}</td>
            <td>
                <CheckStatusBadge status={pr.checkStatus} />
                {pr.mergeable === false && <Badge className="red">Conflict</Badge>}
            </td>
            <td title={DateTime.fromISO(pr.updatedAt!).toFormat("yyyy-MM-dd HH:mm:ss")}>{timeAgo}</td>
        </tr>
    );
};

export interface PullRequestRowProps {
    pr: PullRequestModel;
    selected: boolean;
    onToggle: (pr: PullRequestModel) => void;
}
