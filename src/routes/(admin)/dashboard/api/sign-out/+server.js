import { dev } from "$app/environment";
import { log_message } from "$lib/server/log";
import { delete_login_session } from "$lib/server/session";
import { db_insert_activity_record } from "$lib/server/database";

const place = "/dashboard/api/sign-out";

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, platform, cookies, locals }) {
  let app_env = dev ? "development" : "production";
  log_message(platform, app_env, place, "info", "sign out start.");
  const login_auth_token = cookies.get("login_auth_token");
  if (login_auth_token) {
    await db_insert_activity_record(platform, request.headers, "Sign out", locals.user.uuid);
    cookies.delete("login_auth_token", { path: "/" });
    await delete_login_session(platform, login_auth_token);
    log_message(platform, app_env, place, "info", "login_auth_token deleted.");
  }
  log_message(platform, app_env, place, "info", "sign out success.");
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
