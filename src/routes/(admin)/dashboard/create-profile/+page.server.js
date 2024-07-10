import { dev } from "$app/environment";
import { redirect } from "@sveltejs/kit";
import { log_message } from "$lib/server/log";

const place = "/dashboard/create-profile";
const app_env = dev ? "development" : "production";

export async function load({ request, platform, locals }) {
  log_message(platform, app_env, place, "info", "page load start.");
  if (locals.user) {
    if (locals.user.organization) {
      log_message(platform, app_env, place, "info", "locals.user.organization found, redirect to dashboard.");
      redirect(303, "/dashboard");
    }
    log_message(platform, app_env, place, "info", "locals.user found, but no organization, continue to create profile.");
    return {
      user: locals.user,
    };
  } else {
    log_message(platform, app_env, place, "info", "locals.user is null, redirect to sign-in.");
    redirect(303, "/sign-in");
  }
}
