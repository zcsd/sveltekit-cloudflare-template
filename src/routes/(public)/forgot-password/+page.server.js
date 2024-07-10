import { fail } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { z } from "zod";
import jwt from "@tsndr/cloudflare-worker-jwt";
import { RESET_PWD_TOKEN_TTL } from "$config";
import { validate_turnstile_token } from "$lib/server/turnstile";
import { log_message } from "$lib/server/log";
import {
  db_get_user_info_by_email,
  db_insert_pwd_reset_info,
} from "$lib/server/database";
import { check_rate_limit } from "$lib/server/rate_limit";

/*
  When user forgot password, user can request a password reset link to be sent to the email.
  The email contains a link with a jwt token, which is signed with secret.
  The token is stored in db, it's generated and sent to user's email when user request password reset.
*/

const place = "forgot-password";
const app_env = dev ? "development" : "production";

const form_schema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .min(3, { message: "Invalid email format" })
    .max(64, { message: "Invalid email format" })
    .email({ message: "Invalid email format" }),
});

/** @type {import('./$types').Actions} */
export const actions = {
  default: async ({ request, platform, cookies, fetch }) => {
    log_message(platform, app_env, place, "info", "form action start.");

    const form_data_raw = await request.formData();
    const form_data = Object.fromEntries([...form_data_raw]);

    // Validate the Cloudflare Turnstile token
    const turnstile_token = form_data_raw.get("cf-turnstile-response");
    const res_validate_tt = await validate_turnstile_token(turnstile_token, platform.env.TURNSTILE_SECRET_KEY);
    if (res_validate_tt.error) {
      log_message(platform, app_env, place, "info", "CAPTCHA fail: " + res_validate_tt.message);
      return fail(400, {
        error: true,
        error_message: "Please complete the CAPTCHA human verification before submitting.",
      });
    }

    try {
      form_schema.parse(form_data);
    } catch (err) {
      const { fieldErrors: errors } = err.flatten();
      log_message(platform, app_env, place, "info", "schema error: " + JSON.stringify(errors));
      return fail(401, {
        error: true,
        error_message: "You have entered an invalid format email, please re-enter and try again.",
      });
    }

    const user_email = form_data.email.trim().toLowerCase();
    log_message(platform, app_env, place, "info", "user_email: " + user_email);

    const ip_address = request.headers.get("cf-connecting-ip");
    const res_rate_limit = await check_rate_limit(platform, place, ip_address, user_email);
    if (!res_rate_limit) {
      log_message(platform, app_env, place, "info", "user rate limit exceeded.");
      return fail(429, {
        error: true,
        error_message: "Attempts reach limit, please retry after 24 hours.",
      });
    }
    // check if the email is registered
    const res_user_info = await db_get_user_info_by_email(platform, user_email);
    if (res_user_info.error) {
      await log_message(platform, app_env, place, "error", "db_get_user_info_by_email: " + res_user_info.message, user_email);
      return fail(500, {
        error: true,
        error_message: "Internal server error. Please try again later.",
      });
    }
    if (!res_user_info.is_registered) {
      log_message(platform, app_env, place, "info", "the email is not registered, return a fake success message.");
      // email not registered, but we don't want to leak this info to the user
      // add 1s waiting time and return a fake success message
      await new Promise((r) => setTimeout(r, 1000)); // wait 1s
      return {
        success: true,
        message: `If ${user_email} is registered, you will receive a password reset link at your email shortly.`,
      };
    }

    const user_info = res_user_info.user_info; // {uuid, nickname}

    const password_reset_token = await jwt.sign(
      {
        exp: Math.floor(Date.now() / 1000) + RESET_PWD_TOKEN_TTL,
      },
      platform.env.RESET_PWD_JWT_SECRET
    ); 

    const pwd_reset_info = {
      uuid: user_info.uuid,
      email: user_email,
      nickname: user_info.nickname,
      expire_at: Date.now() + RESET_PWD_TOKEN_TTL * 1000,
      token: password_reset_token,
    }

    const res_insert_pwd_reset = await db_insert_pwd_reset_info(platform, request.headers, pwd_reset_info);
    if (res_insert_pwd_reset.error) {
      await log_message(platform, app_env, place, "error", "db_insert_pwd_reset_info: " + res_insert_pwd_reset.message, user_email);
      return fail(500, {
        error: true,
        error_message: "Internal server error. Please try again later.",
      });
    }
    log_message(platform, app_env, place, "info", "db_insert_pwd_reset_info success.");

    const api_token = await jwt.sign(
      {
        uuid: user_info.uuid,
        exp: Math.floor(Date.now() / 1000) + 1 * 1 * (1 * 60),
      },
      platform.env.ONSITE_API_JWT_SECRET
    );

    const res_send_reset_email = await fetch("/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task: "reset_pwd_email",
        info: {
          nickname: user_info.nickname,
          uuid: user_info.uuid,
          email: user_email,
          api_token: api_token,
          password_reset_token: password_reset_token,
        },
      }),
    });

    if (res_send_reset_email.error) {
      log_message(platform, app_env, place, "info", "forgot password action failed.");
      return fail(500, {
        error: true,
        error_message: "Internal server error. Please try again later.",
      });
    }

    log_message(platform, app_env, place, "info", "forgot password action successfullly done.");

    return {
      success: true,
      email: user_email,
      message: `If ${user_email} is registered, you will receive a password reset link at your email shortly.`,
    };
  },
};
