import { error } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { z } from "zod";
import { fail } from "@sveltejs/kit";
import bcrypt from "bcryptjs";
import jwt from "@tsndr/cloudflare-worker-jwt";
import { log_message } from "$lib/server/log";
import { is_jwt_format_valid } from "$lib/tools/jwt";
import {
  db_get_pwd_reset_info,
  db_update_password,
  db_delete_pwd_reset_info,
} from "$lib/server/database";
import {
  record_failure_attempt,
  check_failure_attempt,
} from "$lib/server/rate_limit";

/*
  This page is for users to create their new password if they forgot it.
  The user receive an email with a reset link, and the link contains a JWT token signed with secret.
  The user can click the link and redirect to this page, and then create the new password.
  The link looks like: https://domain.com/new-password?token=zzzzzzzzzzzzzzzzz.zzzzzzzzzz.zzzzzz
  token payload: {uuid, exp}; the token is stored in db.
  If the token signature is valid and exists in db, the user can create the new password.
*/

const place = "new-password";
let app_env = dev ? "development" : "production";

function hide_email(email) {
  // example@domain.com -> ex*****@domain.com
  const [username, domain] = email.split("@");
  //const domain_firstpart = domain.split('.')[0];
  const hidden_username =
    username.substring(0, 2) + "*".repeat(username.length - 2);
  //const hidden_domain = domain_firstpart.substring(0, 1) + '*'.repeat(domain_firstpart.length - 1) + domain.substring(domain_firstpart.length);

  return `${hidden_username}@${domain}`;
}

/** @type {import('./$types').PageLoad} */
export async function load({ request, platform }) {
  log_message(platform, app_env, place, "info", "page load start.");

  const ip_address = request.headers.get("cf-connecting-ip") || "undefined-ip";
  const is_rate_limit_ok = await check_failure_attempt(platform, place, ip_address, "na");
  if (!is_rate_limit_ok) {
    error(
      406,
      "Too many requests from your IP. Please try again later or contact support."
    );
  }

  let incoming_url = new URL(request.url);
  const new_password_token = incoming_url.searchParams.get("token");

  // check if token is valid in basic jwt format, to have more specific error message
  if (!is_jwt_format_valid(new_password_token)) {
    await log_message(platform, app_env, place, "error", "token format is invalid in page load.", new_password_token);
    await record_failure_attempt(platform, place, ip_address, "na");
    error(
      406,
      "Invalid or expired password reset link. Please check your email for the correct link or request a new one."
    );
  }

  const { payload } = jwt.decode(new_password_token); // payload: {uuid: "xxxx", exp: 1234567890}
  const current_epoch_time = Math.floor(Date.now() / 1000);

  // check if token is expired, to have more specific error message
  if (!payload.exp || payload.exp < current_epoch_time) { // token not exist or expired
    log_message(platform, app_env, place, "info", "token is expired in page load."); // not log this as error
    await record_failure_attempt(platform, place, ip_address, "na");
    error(
      406,
      "Invalid or expired password reset link. Please check your email for the correct link or request a new one."
    );
  }

  // check the token signature
  const is_jwt_sign_valid = await jwt.verify(new_password_token, platform.env.RESET_PWD_JWT_SECRET);
  if (!is_jwt_sign_valid) {
    await log_message(platform, app_env, place, "error", "token signauture is invalid in page load.", new_password_token);
    await record_failure_attempt(platform, place, ip_address, "na");
    error(
      406,
      "Invalid or expired password reset link. Please check your email for the correct link or request a new one."
    );
  }

  log_message(platform, app_env, place, "info", "token signature is valid in page load.");

  // check if the token exists in db and get user info
  const res_get_pwd_reset = await db_get_pwd_reset_info(platform, new_password_token);
  if (res_get_pwd_reset.error) {
    await log_message(platform, app_env, place, "error", "db_get_pwd_reset_info in page load: " + res_get_pwd_reset.message, new_password_token);
    await record_failure_attempt(platform, place, ip_address, "na");
    error(
      500,
      "Internal server error. Please try again later or contact support."
    );
  }

  if (!res_get_pwd_reset.existed) {
    await log_message(platform, app_env, place, "error", "db_get_pwd_reset_info in page load: token not existed.", new_password_token);
    await record_failure_attempt(platform, place, ip_address, "na");
    error(
      406,
      "Invalid or expired password reset link. Please check your email for the correct link or request a new one."
    );
  }

  const { email } = res_get_pwd_reset.user_info; // user_info: {email, nickname, uuid}

  log_message(platform, app_env, place, "info", "token is valid and existed in db in page load, rendering form now.");

  return {
    success: true,
    hidden_email: hide_email(email),
  };
}

const change_password_schema = z
  .object({
    password: z
      .string({ required_error: "required" })
      .min(8, { message: "too short" })
      .max(32, { message: "too long" })
      .trim(),
    confirm_password: z
      .string({ required_error: "required" })
      .min(8, { message: "too short" })
      .max(32, { message: "too long" })
      .trim(),
  })
  .superRefine(({ confirm_password, password }, ctx) => {
    if (confirm_password !== password) {
      ctx.addIssue({
        code: "custom",
        message: "not matching",
        path: ["password"],
      });
      ctx.addIssue({
        code: "custom",
        message: "not matching",
        path: ["confirm_password"],
      });
    }
  });

/** @type {import('./$types').Actions} */
export const actions = {
  default: async ({ request, platform, cookies, fetch }) => {
    log_message(platform, app_env, place, "info", "form action start.");
    const ip_address = request.headers.get("cf-connecting-ip") || "undefined-ip";

    const form_data_raw = await request.formData();
    const form_data = Object.fromEntries([...form_data_raw]);

    try {
      change_password_schema.parse(form_data);
    } catch (err) {
      const { fieldErrors: errors } = err.flatten();
      log_message(platform, app_env, place, "info", "schema error: " + JSON.stringify(errors));
      return fail(400, {
        error: true,
        error_message: "Password must be at least 8 characters and match the confirm password, please try again.",
      });
    }

    let incoming_url = new URL(request.url);
    const new_password_token = incoming_url.searchParams.get("token");
    // to secure, check the token signature again
    const is_jwt_sign_valid = await jwt.verify(new_password_token, platform.env.RESET_PWD_JWT_SECRET); // expiration check is included
    if (!is_jwt_sign_valid) {
      await log_message(platform, app_env, place, "error", "token signature is invalid in form action.", new_password_token);
      await record_failure_attempt(platform, place, ip_address, "na");
      error(
        406,
        "Invalid or expired password reset link. Please check your email for the correct link or request a new one."
      );
    }
    // to secure, check the token exists in db again, and get user info
    const res_get_pwd_reset = await db_get_pwd_reset_info(platform, new_password_token);
    if (res_get_pwd_reset.error) {
      await log_message(platform, app_env, place, "error", "db_get_pwd_reset_info in form action: " + res_get_pwd_reset.message, new_password_token);
      await record_failure_attempt(platform, place, ip_address, "na");
      error(
        500,
        "Internal server error. Please try again later or contact support."
      );
    }

    if (!res_get_pwd_reset.existed) {
      await log_message(platform, app_env, place, "error", "db_get_pwd_reset_info in form action: token not existed.", new_password_token);
      await record_failure_attempt(platform, place, ip_address, "na");
      error(
        406,
        "Invalid or expired password reset link. Please check your email for the correct link or request a new one."
      );
    }

    log_message(platform, app_env, place, "info", "token is valid and existed in db in form action.");

    const { nickname, email, uuid } = res_get_pwd_reset.user_info; // user_info: {nickname, email, uuid}

    const password_hash = await bcrypt.hash(form_data.password, 10);
    const res_update_password = await db_update_password(platform, request.headers, uuid, password_hash);
    if (res_update_password.error) {
      await log_message(platform, app_env, place, "error", "db_update_password: " + res_update_password.message, email);
      error(500, "Internal server error. Please try again later.");
    }

    log_message(platform, app_env, place, "info", "db_update_password success.");

    // send pwd reset success notification email
    const api_token = await jwt.sign(
      { uuid: uuid, exp: Math.floor(Date.now() / 1000) + 1 * 1 * (1 * 60) },
      platform.env.ONSITE_API_JWT_SECRET
    ); 

    await fetch("/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task: "reset_pwd_success_notification",
        info: {
          nickname: nickname,
          uuid: uuid,
          email: email,
          api_token: api_token,
        },
      }),
    });

    // delete the token from db
    const res_delete_pwd_reset = await db_delete_pwd_reset_info(platform, email);
    if (res_delete_pwd_reset.error) {
      await log_message(platform, app_env, place, "error", "db_delete_pwd_reset_info: " + res_delete_pwd_reset.message, email);
      // ok to continue, not a critical error
    } else {
      log_message(platform, app_env, place, "info", "db_delete_pwd_reset_info success.");
    }

    log_message(platform, app_env, place, "info", "user password reset successfully.");

    return {
      success: true,
      message: "Password reset successfully, you can <a href='/sign-in' style='text-decoration: underline;'>sign in</a> with the new password now.",
    };
  },
};
