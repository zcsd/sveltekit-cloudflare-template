import { error } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { LOGIN_TOKEN_TTL } from "$config";
import jwt from "@tsndr/cloudflare-worker-jwt";
import { redirect } from "@sveltejs/kit";
import { log_message } from "$lib/server/log";
import {
  db_get_magic_link_token_and_info_for_login,
  db_delete_magic_link_token,
} from "$lib/server/database";
import { is_jwt_format_valid } from "$lib/tools/jwt";
import {
  record_failure_attempt,
  check_failure_attempt,
} from "$lib/server/rate_limit";
import { write_login_session } from "$lib/server/session";

/* 
  This page is for the magic link login.
  The user will receive an email with a magic link when the user requests magic link login.
  When the user clicks the magic link, the user will be redirected to this page.
  The link looks like: https://domain.com/magic-link?token=zzzzzzzzzzzzzzzzz.zzzzzzzzzz.zzzzzz
  The token is a jwt token with payload like: {uuid: "xxxx", exp: 1234567890}, signed with secret.
  it's generated when user request magic link login; the token is stored in db.
  If the token signature is valid and exists in db, the user will be logged in.
*/

const place = "magic-link";
const app_env = dev ? "development" : "production";

/** @type {import('./$types').PageLoad} */
export async function load({ cookies, request, platform }) {
  log_message(platform, app_env, place, "info", "page load start.");

  const ip_address = request.headers.get("cf-connecting-ip_address");
  const is_rate_limit_ok = await check_failure_attempt(platform, place, ip_address, "na");
  if (!is_rate_limit_ok) {
    error(
      406,
      "Too many requests from your IP. Please try again later or contact support."
    );
  }

  let incoming_url = new URL(request.url);
  const magic_link_token = incoming_url.searchParams.get("token");

  // check if token is valid in basic format, to have more specific error message
  if (!is_jwt_format_valid(magic_link_token)) {
    await log_message(platform, app_env, place, "error", "token format is invalid.", magic_link_token);
    await record_failure_attempt(platform, place, ip_address, "na");
    error(
      406,
      "Invalid or expired magic link. Please check your email for the correct link or request a new one."
    );
  }

  const { payload } = jwt.decode(magic_link_token);
  const current_epoch_time = Math.floor(Date.now() / 1000);

  // check if token is expired, to have more specific error message
  if (!payload.exp || payload.exp < current_epoch_time) {
    log_message(platform, app_env, place, "info", "token is expired.");
    await record_failure_attempt(platform, place, ip_address, "na");
    error(
      406,
      "Invalid or expired magic link. Please check your email for the correct link or request a new one."
    );
  }

  // check the token signature
  const is_jwt_sign_valid = await jwt.verify(magic_link_token, platform.env.MAGIC_LINK_JWT_SECRET);
  if (!is_jwt_sign_valid) {
    await log_message(platform, app_env, place, "error", "token signature is invalid.", payload.uuid);
    await record_failure_attempt(platform, place, ip_address, "na");
    error(
      406,
      "Invalid or expired magic link. Please check your email for the correct link or request a new one."
    );
  }

  log_message(platform, app_env, place, "info", "token signature is valid.");

  // check magic_link_token existed in db and get user info by uuid
  let res_user_info = await db_get_magic_link_token_and_info_for_login(platform, magic_link_token);
  if (res_user_info.error) {
    await log_message(platform, app_env, place, "error", "db_get_magic_link_token_and_info_for_login: " + res_user_info.message, payload.uuid);
    await record_failure_attempt(platform, place, ip_address, "na");
    error(
      500,
      "Internal server error. Please try again later or contact support."
    );
  }

  if (res_user_info.success && !res_user_info.existed) {
    // the magic link token is not existed in db
    await log_message(platform, app_env, place, "error", "db_get_magic_link_token_and_info_for_login: token not existed.", payload.uuid);
    await record_failure_attempt(platform, place, ip_address, "na");
    error(
      406,
      "Invalid or expired magic link. Please check your email for the correct link or request a new one."
    );
  }

  log_message(platform, app_env, place, "info", "db_get_magic_link_token_and_info_for_login: token found in db.");

  const user_info = res_user_info.info;

  // check if the email is verified
  if (!user_info.is_email_verified) {
    // the email is not verified. it should not happen in practice, but just in case
    await log_message(platform, app_env, place, "error", "the email is not verified, but the magic link is valid, should not happen.");
    await record_failure_attempt(platform, place, ip_address, user_info.email);
    error(
      406,
      "Invalid or expired magic link. Please check your email for the correct link or request a new one."
    );
  }

  log_message(platform, app_env, place, "info", "token is valid and found in db, continue to login.");

  const login_jwt = await jwt.sign(
    {
      uuid: payload.uuid,
      exp: Math.floor(Date.now() / 1000) + LOGIN_TOKEN_TTL,
    },
    platform.env.LOGIN_JWT_SECRET
  );

  const session_info = {
    uuid: payload.uuid,
    nickname: user_info.nickname,
    email: user_info.email,
    organization: user_info.organization,
    stripe_customer_id: user_info.stripe_customer_id,
    current_product_id: user_info.current_product_id,
    current_period_end_at: user_info.current_period_end_at,
    had_subscription_before: user_info.had_subscription_before,
    created_at: Date.now(),
    expire_at: Date.now() + LOGIN_TOKEN_TTL * 1000,
  };

  // insert login record & login_session to db && write login_session to KV
  let res_write_login = await write_login_session(platform, request.headers, session_info, login_jwt, LOGIN_TOKEN_TTL);
  if (res_write_login.error) {
    await log_message(platform, app_env, place, "error", "write_login_session: " + res_write_login.message, payload.uuid);
    error(
      500,
      "Internal server error. Please try again later or contact support."
    );
  }

  log_message(platform, app_env, place, "info", "write login session sucess.");

  // delete magic link token from db
  let res_delete = await db_delete_magic_link_token(platform, magic_link_token);
  if (res_delete.error) {
    await log_message(platform, app_env, place, "error", "db_delete_magic_link_token: " + res_delete.message, payload.uuid);
    // not critical error, just log it
  } else {
    log_message(platform, app_env, place, "info", "db_delete_magic_link_token success.");
  }

  log_message(platform, app_env, place, "info", "login success, ready to redirect to /dashboard.");

  cookies.set("login_auth_token", login_jwt, {
    httpOnly: true,
    path: "/",
    secure: !dev,
    sameSite: "lax",
    maxAge: LOGIN_TOKEN_TTL,
  });

  redirect(303, "/dashboard");
}
