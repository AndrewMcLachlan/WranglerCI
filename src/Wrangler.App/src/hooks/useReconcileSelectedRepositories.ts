import { useEffect } from "react";
import { useRepositories } from "./useRepositories";
import { useSelectedRepositories, useUpdateSelectedRepositories } from "../routes/settings/-hooks/useSelectedRepositories";
import { pruneSelectedRepositories, type AvailableRepository } from "../routes/settings/-hooks/repositoryFeatures";

// Removes selected repositories that GitHub no longer lists — a repo that was
// renamed (its old name still resolves via GitHub's redirect, so it would surface
// duplicate items across the dashboard, PRs, and Attention) or one the user lost
// access to. Runs once the live repo list has loaded *successfully*, so a
// transient fetch failure can never wrongly drop a still-valid selection.
export const useReconcileSelectedRepositories = () => {
  const { data: available, isSuccess } = useRepositories();
  const { data: selected } = useSelectedRepositories();
  const { mutate: updateSelected } = useUpdateSelectedRepositories();

  useEffect(() => {
    if (!isSuccess || !available || !selected) return;

    const availableRepos: AvailableRepository[] = available
      .filter((r): r is typeof r & { owner: { login: string }; name: string } =>
        !!r.owner?.login && !!r.name)
      .map((r) => ({ owner: r.owner.login, name: r.name }));

    const pruned = pruneSelectedRepositories(selected, availableRepos);
    // Same reference back means nothing was stale — skip the write (and the
    // dependent-query churn it would trigger). When something was pruned, writing
    // updates localStorage and re-keys the dashboard/PR/Attention queries, so the
    // stale repo's cached data drops out too.
    if (pruned !== selected) updateSelected(pruned);
  }, [isSuccess, available, selected, updateSelected]);
};
