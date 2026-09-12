/**
 * How long a list page's fetch is trusted before arriving at that page
 * refetches. Short enough that landing always shows current data, long enough
 * that swapping between views of the same data is not a new fetch.
 */
export const PAGE_STALE_TIME = 30 * 1000;
