/**
 * How long a dashboard fetch is trusted before mounting one of its views
 * refetches. Short enough that arriving at the page always shows current data,
 * long enough that flipping between the three views is not a new fetch.
 */
export const DASHBOARD_STALE_TIME = 30 * 1000;
