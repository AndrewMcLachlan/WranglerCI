import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useSelectedRepositories } from "../routes/settings/-hooks/useSelectedRepositories";
import { usePrAuthors } from "../routes/pull-requests/-hooks/usePrAuthors";
import { hasDashboardWorkflows, isAttentionOptedIn } from "../routes/settings/-hooks/repositoryFeatures";
import { workflowsQueryOptions } from "../routes/dashboard/-hooks/useWorkflows";
import { pullRequestsQueryOptions } from "../routes/pull-requests/-hooks/usePullRequests";
import { gatesQueryOptions } from "../routes/gates/-hooks/useGates";
import { attentionQueryOptions } from "../routes/attention/-hooks/useAttention";
import { readBranchFilter } from "../routes/dashboard/-providers/branchFilterStorage";

const PAGES = ["/dashboard", "/pull-requests", "/gates", "/attention"] as const;

const whenIdle = (work: () => void): (() => void) => {
    if (typeof window.requestIdleCallback !== "function") {
        const timer = setTimeout(work, 1000);
        return () => clearTimeout(timer);
    }
    const handle = window.requestIdleCallback(work, { timeout: 5000 });
    return () => window.cancelIdleCallback(handle);
};

/**
 * Fetches the pages you are not looking at, so arriving at one shows data
 * rather than a spinner.
 *
 * Waits for the browser to be idle: the page you asked for gets the network
 * first. Each prefetch respects its query's staleTime, so this is free once a
 * page is warm.
 */
export const useWarmCaches = (enabled: boolean = true) => {
    const queryClient = useQueryClient();
    const router = useRouter();
    const { data: selectedRepositories } = useSelectedRepositories();
    const { data: authors } = usePrAuthors();

    useEffect(() => {
        if (!enabled) return;
        if (selectedRepositories.length === 0) return;

        return whenIdle(() => {
            const dashboardRepos = selectedRepositories.filter(hasDashboardWorkflows);
            const gateRepos = dashboardRepos.map((r) => ({ owner: r.owner, name: r.name }));
            const prRepos = selectedRepositories
                .filter((r) => r.pullRequests === true)
                .map((r) => ({ owner: r.owner, name: r.name }));
            const attentionRepos = selectedRepositories
                .filter(isAttentionOptedIn)
                .map((r) => ({ owner: r.owner, name: r.name }));

            if (dashboardRepos.length > 0) {
                queryClient.prefetchQuery(workflowsQueryOptions(selectedRepositories, readBranchFilter(localStorage)));
                queryClient.prefetchQuery(gatesQueryOptions(gateRepos));
            }
            if (prRepos.length > 0 && authors.length > 0) {
                queryClient.prefetchQuery(pullRequestsQueryOptions(prRepos, authors));
            }
            if (attentionRepos.length > 0) {
                queryClient.prefetchQuery(attentionQueryOptions(attentionRepos));
            }

            // The data is no use if the route's own chunk still has to be
            // fetched when you click: that is its own spinner.
            for (const to of PAGES) router.preloadRoute({ to });
        });
    }, [enabled, queryClient, router, selectedRepositories, authors]);
};
