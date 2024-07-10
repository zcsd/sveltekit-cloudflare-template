import { dev } from "$app/environment";
import { redirect } from "@sveltejs/kit";
import { log_message } from "$lib/server/log";

const place = "dashboard-layout";
const app_env = dev ? "development" : "production";

/** @type {import('./$types').PageLoad} */
export async function load({ cookies, locals, platform }) {
  log_message(platform, app_env, place, "info", "layout load start.");
  if (locals.user) {
    if (!locals.user.organization) {
      log_message(platform, app_env, place, "info", "locals.user.organization not found, redirect to create-profile.");
      redirect(303, "/dashboard/create-profile");
    }
    log_message(platform, app_env, place, "info", "locals.user found, organization found, continue to dashboard.");
    return {
      user: locals.user,
    };
  } else {
    log_message(platform, app_env, place, "info", "locals.user is null, redirect to sign-in.");
    redirect(303, "/sign-in");
  }
}
