import { fail } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { MAGIC_LINK_TOKEN_TTL, EMAIL_VERIFY_TOKEN_TTL } from "$config";
import { z } from "zod";
import jwt from "@tsndr/cloudflare-worker-jwt";
import { validate_turnstile_token } from "$lib/server/turnstile";
import { log_message } from "$lib/server/log";
import { 
  db_get_info_for_login,
  db_insert_magic_link_token,
} from "$lib/server/database";
import {
  check_failure_attempt,
  record_failure_attempt,
} from "$lib/server/rate_limit";

/*
  user sign in with email without password, a magic link will be sent to the email.
  user need to click the magic link to sign in.
*/

const place = "passwordless-sign-in";
const app_env = dev ? "development" : "production";

const login_schema = z.object({
  email: z
    .string({ required_error: "email is missing" })
    .min(3, { message: "invalid email format" })
    .max(64, { message: "invalid email format" })
    .email({ message: "invalid email format" }),
});

/** @type {import('./$types').Actions} */
export const actions = {
  default: async ({ request, platform, cookies, fetch }) => {
    log_message(platform, app_env, place, "info", "form action start.");

    const form_data_raw = await request.formData();
    const form_data = Object.fromEntries([...form_data_raw]);

    // validate the Cloudflare Turnstile token
    const turnstile_token = form_data_raw.get("cf-turnstile-response");
    const res_validate_tt = await validate_turnstile_token(turnstile_token, platform.env.TURNSTILE_SECRET_KEY);
    if (res_validate_tt.error) {
      log_message(platform, app_env, place, "info", "CAPTCHA fail: " + res_validate_tt.message);
      return fail(400, {
        error: true,
        error_message: "Please complete the CAPTCHA human verification.",
      });
    }

    // validate form data
    try {
      login_schema.parse(form_data);
    } catch (err) {
      const { fieldErrors: errors } = err.flatten();
      log_message(platform, app_env, place, "info", "schema error: " + JSON.stringify(errors));
      return fail(401, {
        error: true,
        error_message: "Invalid email format, please re-enter and try again.",
      });
    }

    const user_email = form_data.email.trim().toLowerCase();
    log_message(platform, app_env, place, "info", "user email: " + user_email);
    // check rate limit for login failure
    const ip_address = request.headers.get("cf-connecting-ip");
    const is_rate_limit_ok = await check_failure_attempt(platform, "sign-in", ip_address, user_email);
    if (!is_rate_limit_ok) {
      log_message(platform, app_env, place, "info", "deny the request due to rate limit, too frequent login failure.");
      return fail(429, {
        error: true,
        error_message: "Login attempts reach limit, please retry after 2 hours, or you can try to click the magic link in the email if you have requested one recently.",
      });
    }

    const res_user_info = await db_get_info_for_login(platform, user_email);
    if (res_user_info.error) {
      await log_message(platform, app_env, place, "error", "db_get_info_for_login: " + res_user_info.message, user_email);
      return fail(500, {
        error: true,
        error_message: "Internal server error. Please try again later.",
      });
    }
    if (!res_user_info.is_registered) {
      await record_failure_attempt(platform, "sign-in", ip_address, "na"); // for rate limit
      log_message(platform, app_env, place, "info", "db_get_info_for_login: the email is not registere, will return a fake success message.");
      // email not registered, but we don't want to leak this info to the user
      // add 1s waiting time and return a fake success message
      await new Promise((r) => setTimeout(r, 1000)); // wait 1s
      return {
        success: true,
        message: `If ${user_email} is registered, you will receive a magic link at your email shortly.`,
      }
    }

    const user_info = res_user_info.user_info;

    if (!user_info.is_email_verified) {
      // send email verification link if the user has not verified the email
      log_message(platform, app_env, place, "info", "the email is not verified, will send verification email.");

      const api_token = await jwt.sign(   // token for /send-email authorization
        {
          exp: Math.floor(Date.now() / 1000) + 1 * 1 * (1 * 60), // 1 min expiration
        },
        platform.env.ONSITE_API_JWT_SECRET
      );

      const email_verify_token = await jwt.sign( // token for email verification link
        {
          uuid: user_info.uuid,
          exp: Math.floor(Date.now() / 1000) + EMAIL_VERIFY_TOKEN_TTL,
        },
        platform.env.VERIFY_EMAIL_JWT_SECRET
      );

      const res_send_verify_email = await fetch("/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task: "verify_email",
          info: {
            nickname: user_info.nickname,
            uuid: user_info.uuid,
            email: user_email,
            api_token: api_token,
            email_verify_token: email_verify_token,
          },
        }),
      });

      if (res_send_verify_email.error) {
        // failed to send verification email
        return fail(500, {
          error: true,
          error_message: "Internal server error. Please try again later.",
        });
      }
      // if verification email is sent successfully, return true success
      // click the verification link also leads to sign-in
      return {
        success: true,
        message: `Your account (${user_email}) has not been activated, please check your email inbox for the verification link to activate your account.`,
      }
    }

    // if the email is registered and verified, generate magic link token
    const magic_link_token = await jwt.sign(  // token for magic link sign-in
      {
        uuid: user_info.uuid,
        exp: Math.floor(Date.now() / 1000) + MAGIC_LINK_TOKEN_TTL,
      },
      platform.env.MAGIC_LINK_JWT_SECRET
    );

    // store magic link token to db
    const info = {
      uuid: user_info.uuid,
      email: user_email,
      login_token: magic_link_token,
      requested_at: Date.now(),
      expire_at: Date.now() + MAGIC_LINK_TOKEN_TTL * 1000,
    };

    const res_save_token = await db_insert_magic_link_token(platform, info);
    if (res_save_token.error) {
      await log_message(platform, app_env, place, "error", "db_insert_magic_link_token: " + res_save_token.message, user_email);
      return fail(500, {
        error: true,
        error_message: "Internal server error. Please try again later.",
      });
    }

    // send magic link email
    const api_token = await jwt.sign(   // token for /send-email authorization
      {
        exp: Math.floor(Date.now() / 1000) + 1 * 1 * (1 * 60),
      },
      platform.env.ONSITE_API_JWT_SECRET
    );

    const res_send_login_email = await fetch("/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task: "magic_link_sign_in",
        info: {
          uuid: user_info.uuid,
          nickname: user_info.nickname,
          email: user_email,
          api_token: api_token,
          magic_link_token: magic_link_token,
        },
      }),
    });

    if (res_send_login_email.error) {
      return fail(500, {
        error: true,
        error_message: "Internal server error. Please try again later.",
      });
    }

    // user can not keep trying to request magic link; passwordless sign-in share the same rate limit with password sign-in
    await record_failure_attempt(platform, "sign-in", ip_address, user_email); // actually, it's not a failure

    log_message(platform, app_env, place, "info", "passwordless sign-in first stage success. waiting for user to click.");

    return {
      success: true,
      message: `If ${user_email} is registered, you will receive a magic link at your email shortly.`,
    };
  },
};
