import { useState } from "react";
import { Alert, CloseBadge } from "@andrewmclachlan/moo-ds";
import { toast } from "react-toastify";
import { usePullRequests } from "../-hooks/usePullRequests";
import { usePrAuthors, useUpdatePrAuthors } from "../-hooks/usePrAuthors";
import { useApprovePullRequests } from "../-hooks/useApprovePullRequests";
import { PullRequestRow, canApprove } from "./PullRequestRow";
import { Spinner } from "../../../components/Spinner";
import type { ApprovalResult, PullRequestModel } from "../../../api";

export const PullRequests = () => {

    const { data: authors } = usePrAuthors();
    const { mutate: updateAuthors } = useUpdatePrAuthors();
    const { data: pullRequests, isLoading, isError, error } = usePullRequests();
    const [alerts, setAlerts] = useState<ApprovalResult[]>([]);
    const { mutate: approvePullRequests, isPending: isApproving } = useApprovePullRequests({
        onResults: (results) => {
            const failures: ApprovalResult[] = [];
            for (const result of results) {
                if (result.merged) {
                    toast.success(`${result.repositoryOwner}/${result.repositoryName} #${result.pullRequestNumber}: Merged`);
                } else {
                    failures.push(result);
                }
            }
            setAlerts(failures);
        },
    });

    const [selected, setSelected] = useState<Set<number | string>>(new Set());

    const approvable = pullRequests?.filter(canApprove) ?? [];

    const toggleSelection = (pr: PullRequestModel) => {
        if (!canApprove(pr)) return;
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(pr.number)) {
                next.delete(pr.number);
            } else {
                next.add(pr.number);
            }
            return next;
        });
    };

    const allSelected = approvable.length > 0 && approvable.every(pr => selected.has(pr.number));

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelected(new Set());
        } else {
            setSelected(new Set(approvable.map(pr => pr.number)));
        }
    };

    const handleApprove = () => {
        if (!pullRequests) return;
        const toApprove = pullRequests
            .filter(pr => selected.has(pr.number))
            .map(pr => ({ owner: pr.repositoryOwner, repo: pr.repositoryName, number: pr.number }));
        approvePullRequests(toApprove);
        setSelected(new Set());
    };

    const checkInput = (e: React.FocusEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => {
        if (e.type === "keyup") {
            const keyEvent = e as React.KeyboardEvent<HTMLInputElement>;
            if (keyEvent.key !== "Enter" && keyEvent.key !== " " && keyEvent.key !== "," && keyEvent.key !== ";") {
                return;
            }
        }
        e.preventDefault();
        const value = e.currentTarget.value.trim();
        if (value !== "" && !authors.includes(value)) {
            updateAuthors([...authors, value]);
            e.currentTarget.value = "";
        }
    };

    const removeAuthor = (author: string) => {
        updateAuthors(authors.filter(a => a !== author));
    };

    return (
        <article className="pull-requests">
            <h2>Pull Requests</h2>

            <div className="controls">
                <div className="author-filter">
                    <input type="text" className="form-control" placeholder="Add author filter..." onKeyUp={checkInput} onBlur={checkInput} />
                    <div className="author-badges">
                        {authors.map(author => (
                            <CloseBadge key={author} onClose={() => removeAuthor(author)}>{author}</CloseBadge>
                        ))}
                    </div>
                </div>
                <div className="actions">
                    <button className="btn btn-primary" onClick={handleApprove} disabled={selected.size === 0 || isApproving}>
                        {isApproving ? "Approving..." : "Approve & Merge Selected"}
                    </button>
                </div>
            </div>

            {alerts.map(result => (
                <Alert
                    key={`${result.repositoryOwner}/${result.repositoryName}#${result.pullRequestNumber}`}
                    variant={result.approved ? "warning" : "danger"}
                    dismissible
                    onClose={() => setAlerts(prev => prev.filter(a => a !== result))}
                >
                    {result.repositoryOwner}/{result.repositoryName} #{result.pullRequestNumber}:
                    {result.approved ? " Approved (merge failed)" : " Failed"}
                    {result.error && <span> - {result.error}</span>}
                </Alert>
            ))}

            <table className="pull-request-table">
                <thead>
                    <tr>
                        <th><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} disabled={approvable.length === 0} /></th>
                        <th>Repository</th>
                        <th>Title</th>
                        <th>Author</th>
                        <th>Status</th>
                        <th>Updated</th>
                    </tr>
                </thead>
                <tbody>
                    {isLoading && <tr><td colSpan={6}><Spinner /></td></tr>}
                    {isError && <tr><td colSpan={6}>Error loading pull requests: {error.message}</td></tr>}
                    {(!isLoading && (!pullRequests || pullRequests.length === 0)) && <tr><td colSpan={6}>No open pull requests found.</td></tr>}
                    {pullRequests?.map(pr => (
                        <PullRequestRow
                            key={`${pr.repositoryOwner}/${pr.repositoryName}#${pr.number}`}
                            pr={pr}
                            selected={selected.has(pr.number)}
                            onToggle={toggleSelection}
                        />
                    ))}
                </tbody>
            </table>
        </article>
    );
};
