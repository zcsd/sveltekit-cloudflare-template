import { redirect } from "@sveltejs/kit";
import { dev } from "$app/environment";
import jwt from "@tsndr/cloudflare-worker-jwt";
import { log_message } from "$lib/server/log";
import { delete_login_session } from "$lib/server/session";
import { get_login_session } from "$lib/server/session";

const app_env = dev ? "development" : "production";
const place = "hooks";
const protected_routes = ["/dashboard"];

/*
  login_auth_token is a signed JWT (with payload: uuid), which is stored in cookie and used as session_id (key in KV and db).
  The token OR session_id is used to authenticate user and maintain user session.
  The token is generated when user sign-in or verify email (after sign up).
  how to authenticate user (in short: verify JWT + check the session in KV or db):
    1. get token (=session_id) from cookie
    2. verify (expiration + signature) the jwt using secret,
       if not valid, then user is not authenticated.
    3. grab login session info from KV or db using session_id (kv first, if not found, then db), 
       if not found, then user is not authenticated.
    4. write necessary user info to event.locals (event.locals.user, event.locals.session)
  You may think it's redundant to verify JWT and maintain session in KV or db,
  some people like to use stateless JWT only, some like to maintain session in server-side, no matter what,
  you can choose either one, or both, or neither, the code is highly customizable and you can modify it to fit your needs.
*/

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  log_message(event.platform, app_env, place, "info", "hook start, to page: " + event.url.pathname);

  const login_auth_token = event.cookies.get("login_auth_token");
  const is_protected_route = event.url.pathname.includes(protected_routes);
  // /dashboard, /dashboard/*, /dashboard/anything => protected

  if (is_protected_route && !login_auth_token) {
    // no token, but trying to access protected route => redirect to login page
    log_message(event.platform, app_env, place, "info", "no token, access protected page, redirect to sign-in.");
    redirect(303, "/sign-in");
  }

  if (!is_protected_route && event.url.pathname !== "/sign-in") {
    // not trying to access protected route or login page => ok to proceed, no need to check token and session
    log_message(event.platform, app_env, place, "info", "access unprotected or non sign-in, no need to check, ok to continue.");
    return await resolve(event);
  }

  if (login_auth_token) {
    const { payload } = jwt.decode(login_auth_token);
    if (!payload.uuid || payload.uuid.length !== 36) {
      // payload.uuid: uuidv4, 36 characters including hyphens
      // if (uuid not existed or length not 36) => invalid token
      event.cookies.delete("login_auth_token", { path: "/" });
      event.locals.user = null;
      event.locals.session = null;
      if (is_protected_route) {
        // invalid token, but trying to access protected route => redirect to login page
        log_message(event.platform, app_env, place, "info", "invalid token, access protected page, redirect to sign-in.");
        redirect(303, "/sign-in");
      }
      // invalid token, trying to access unprotected route => ok to continue
      log_message(event.platform, app_env, place, "info", "invalid token, access unprotected page, ok to continue.");
      return await resolve(event);
    }

    const is_valid_token = await jwt.verify(login_auth_token, event.platform.env.LOGIN_JWT_SECRET);
    if (!is_valid_token) {
      // if can not pass the secret verification (including expiration) => invalid token
      event.cookies.delete("login_auth_token", { path: "/" });
      await delete_login_session(event.platform, login_auth_token);
      event.locals.user = null;
      event.locals.session = null;
      if (is_protected_route) {
        // invalid token, but trying to access protected route => redirect to login page
        log_message(event.platform, app_env, place, "info", "invalid token, access protected page, redirect to sign-in.");
        redirect(303, "/sign-in");
      }
      // invalid token, trying to access unprotected route => ok to continue
      log_message(event.platform, app_env, place, "info", "invalid token, access unprotected page, ok to continue.");
      return await resolve(event);
    } else {
      // valid token
      // still need to check if the session_id (login_auth_token) is in KV or db
      const res_login_info = await get_login_session(event.platform, login_auth_token); // mostly cached in KV, if not found, then check in db
      if (res_login_info.existed && res_login_info.info.uuid === payload.uuid) {
        event.locals.user = {
          uuid: res_login_info.info.uuid,
          nickname: res_login_info.info.nickname,
          email: res_login_info.info.email,
          organization: res_login_info.info.organization,
          stripe_customer_id: res_login_info.info.stripe_customer_id, // for subscription
          current_product_id: res_login_info.info.current_product_id, // for subscription
          current_period_end_at: res_login_info.info.current_period_end_at, // for subscription
          had_subscription_before: res_login_info.info.had_subscription_before, // for subscription
        };
        event.locals.session = { id: login_auth_token }; // session_id
        if (event.url.pathname === "/sign-in") {
          // valid token, trying to access login page => redirect to dashboard
          log_message(event.platform, app_env, place, "info", "valid token and uuid, access sign-in page, redirect to dashboard.");
          redirect(303, "/dashboard");
        }
        // valid token, trying to access protected route => ok to continue
        log_message(event.platform, app_env, place, "info", "valid token, access protected page, ok to continue.");
      } else {
        // valid token, but can not get session from kv or db => redirect to login page
        event.locals.user = null;
        event.locals.session = null;
        event.cookies.delete("login_auth_token", { path: "/" });
        log_message(event.platform, app_env, place, "info", "valid token, but NOT get session from kv or db, redirect to sign-in.");
        redirect(303, "/sign-in");
      }
    }
  }
  // otherwise, proceed as usual
  return await resolve(event);
}
