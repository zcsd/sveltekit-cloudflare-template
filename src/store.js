import { writable } from "svelte/store";

/* user's all login_sessions and past activities, to show in /dashboard/sessions page */
export const sessions_and_activities = writable({
  login_sessions: [],
  activities: [],
  fetched_at: null,
});
