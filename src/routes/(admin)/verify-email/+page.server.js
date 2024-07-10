import { error } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { LOGIN_TOKEN_TTL } from "$config";
import jwt from "@tsndr/cloudflare-worker-jwt";
import { redirect } from "@sveltejs/kit";
import { log_message } from "$lib/server/log";
import {
  db_set_uuid_verified,
  db_get_user_info_by_uuid,
} from "$lib/server/database";
import { is_jwt_format_valid } from "$lib/tools/jwt";
import {
  record_failure_attempt,
  check_failure_attempt,
} from "$lib/server/rate_limit";
import { write_login_session } from "$lib/server/session";

/*
  After user sign up, an email will be sent to user's email with a verify email link.
  When user click the verify email link in email, user will be redirected to this page.
  The url looks like：https://domain.com/verify-email?token=zzzzzzzzzzzzzzzzz.zzzzzzzzzz.zzzzzz
  The token is a jwt token with payload like: {uuid: "xxxx", exp: 1234567890}, signed with secret.
  it's generated when user sign up; the token is NOT stored in db.
  Main steps:
    1. check if token is vaild in format, expiration, and signature.
    2. check if the user uuid existed in db and is_email_verified status.
    3. if user uuid is existed and email is not verified, update the user's `is_email_verified` status in db.
    4. if verify email success, then start normal sign in process.
*/

const place = "verify-email";
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
  const email_verify_token = incoming_url.searchParams.get("token");

  // check if token is valid in basic jwt format, to have more specific error message
  if (!is_jwt_format_valid(email_verify_token)) {
    await log_message(platform, app_env, place, "error", "token format is invalid.", email_verify_token);
    await record_failure_attempt(platform, place, ip_address, "na");
    error(
      406,
      "Invalid or expired verification link. Please check your email for the correct link or try to sign in."
    );
  }

  const { payload } = jwt.decode(email_verify_token); // payload: {uuid: "xxxx", exp: 1234567890}
  const current_epoch_time = Math.floor(Date.now() / 1000);

  // check if token is expired, to have more specific error message
  if (!payload.exp || payload.exp < current_epoch_time) { // token not exist or expired
    log_message(platform, app_env, place, "info", "token is expired."); // not log this as error
    await record_failure_attempt(platform, place, ip_address, "na");
    error(
      406,
      "Invalid or expired verification link. Please check your email for the correct link or try to sign in."
    );
  }

  // check the token signature
  const is_jwt_sign_valid = await jwt.verify(email_verify_token, platform.env.VERIFY_EMAIL_JWT_SECRET);
  if (!is_jwt_sign_valid) {
    await log_message(platform, app_env, place, "error", "token signature is not valid.", payload.uuid);
    await record_failure_attempt(platform, place, ip_address, "na");
    error(
      406,
      "Invalid or expired verification link. Please check your email for the correct link or try to sign in."
    );
  }

  log_message(platform, app_env, place, "info", "token signature is valid.");

  // check if the user uuid existed in db and is_email_verified status, and get other user info
  let res_user_info = await db_get_user_info_by_uuid(platform, payload.uuid);
  if (res_user_info.error) {
    await log_message(platform, app_env, place, "error", "db_get_user_info_by_uuid: " + res_user_info.message, payload.uuid);
    await record_failure_attempt(platform, place, ip_address, "na");
    error(
      500,
      "Internal server error. Please try again later or contact support."
    );
  }

  if (!res_user_info.is_registered) {
    await log_message(platform, app_env, place, "error", "db_get_user_info_by_uuid: the uuid is not registered.", payload.uuid);
    await record_failure_attempt(platform, place, ip_address, "na");
    error(
      406,
      "Invalid or expired verification link. Please check your email for the correct link or try to sign in."
    );
  }

  if (res_user_info.is_email_verified) {
    log_message(platform, app_env, place, "info", "db_get_user_info_by_uuid: the uuid is already verified.");
    await record_failure_attempt(platform, place, ip_address, "na");
    error(406, "Your email is already verified. Please try to sign in.");
  } 

  log_message(platform, app_env, place, "info", "the user uuid is existed and email is not verified.");

  let res_update_uuid = await db_set_uuid_verified(platform, payload.uuid);
  if (res_update_uuid.error) {
    await log_message(platform, app_env, place, "error", "db_set_uuid_verified: " + res_update_uuid.message, payload.uuid);
    await record_failure_attempt(platform, place, ip_address, "na");
    error(
      500,
      "Internal server error. Please try again later or contact support."
    );
  }

  log_message(platform, app_env, place, "info", "db_set_uuid_verified success, email verification is done.");

  // done verify email, continue to sign in
  const login_jwt = await jwt.sign(
    {
      uuid: payload.uuid,
      exp: Math.floor(Date.now() / 1000) + LOGIN_TOKEN_TTL,
    },
    platform.env.LOGIN_JWT_SECRET
  );

  const session_info = {
    uuid: payload.uuid,
    nickname: res_user_info.nickname,
    email: res_user_info.email,
    organization: res_user_info.organization,
    stripe_customer_id: null,  // new user has no stripe_customer_id
    current_product_id: null,
    current_period_end_at: null,
    had_subscription_before: 0,
    created_at: Date.now(),
    expire_at: Date.now() + LOGIN_TOKEN_TTL * 1000,
  };

  // insert login record & login_session to db && write login_session to KV
  let res_write_login = await write_login_session(platform, request.headers, session_info, login_jwt, LOGIN_TOKEN_TTL);
  if (res_write_login.error) {
    await log_message(platform, app_env, place, "error", "write_login_session: " + res_write_login.message, payload.uuid);
    error(
      500,
      "You email is verified successfully, but failed to redirect to dashboard. Please sign in yourself."
    );
  }

  cookies.set("login_auth_token", login_jwt, {
    httpOnly: true,
    path: "/",
    secure: !dev,
    sameSite: "lax",
    maxAge: LOGIN_TOKEN_TTL,
  });

  log_message(platform, app_env, place, "info", "login process done, now redirect to dashboard.");

  redirect(303, "/dashboard/create-profile");
}
