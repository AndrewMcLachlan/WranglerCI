import type { StorageLike } from "../../settings/-hooks/repositoryFeatures";

/** Where DashboardProvider keeps the branch filter. */
export const BRANCH_FILTER_KEY = "branchFilter";

/**
 * The stored branch filter, as the dashboard's query key sees it.
 *
 * moo-ds's useLocalStorage JSON-encodes what it stores, so the raw entry is
 * e.g. `["main"]`. A cache warmed with a different value than the page asks
 * for is a wasted fetch and a spinner anyway, so this has to agree with the
 * provider exactly.
 */
export const readBranchFilter = (storage: StorageLike): string[] => {
    try {
        const raw = storage.getItem(BRANCH_FILTER_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
        return [];
    }
};
