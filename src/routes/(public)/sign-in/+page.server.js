import { fail, redirect } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "@tsndr/cloudflare-worker-jwt";
import { LOGIN_TOKEN_TTL, EMAIL_VERIFY_TOKEN_TTL } from "$config";
import { validate_turnstile_token } from "$lib/server/turnstile";
import { log_message } from "$lib/server/log";
import { db_get_info_for_login } from "$lib/server/database";
import {
  check_failure_attempt,
  record_failure_attempt,
} from "$lib/server/rate_limit";
import { write_login_session } from "$lib/server/session";

/*
  user need to sign in with email and password.
*/

const place = "sign-in";
const app_env = dev ? "development" : "production";

const login_schema = z.object({
  email: z
    .string({ required_error: "Email is missing" })
    .min(3, { message: "Invalid email or password" })
    .max(64, { message: "Invalid email or password" })
    .email({ message: "Invalid email or password" }),
  password: z
    .string({ required_error: "Password is missing" })
    .min(8, { message: "Invalid email or password" })
    .max(32, { message: "Invalid email or password" })
    .trim(),
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
        error_message: "Invalid email or password, please re-enter and try again.",
      });
    }

    const user_email = form_data.email.trim().toLowerCase();
    log_message(platform, app_env, place, "info", "user email: " + user_email);
    // check rate limit for login failure
    const ip_address = request.headers.get("cf-connecting-ip");
    const is_rate_limit_ok = await check_failure_attempt(platform, "sign-in", ip_address, user_email); // check ip + email
    if (!is_rate_limit_ok) {
      log_message(platform, app_env, place, "info", "deny the request due to rate limit, too frequent login failure.");
      return fail(429, {
        error: true,
        error_message: "Login attempts reach limit, please retry after 2 hours.",
      });
    }

    const res_user_info = await db_get_info_for_login(platform, user_email);
    if (res_user_info.error) {
      await log_message(platform, app_env, place, "error", "db_get_info_for_login:" + res_user_info.message, user_email);
      return fail(500, {
        error: true,
        error_message: "Internal server error. Please try again later.",
      });
    }
    if (!res_user_info.is_registered) {
      await record_failure_attempt(platform, "sign-in", ip_address, "na"); // record ip only for rate limit
      log_message(platform, app_env, place, "info", "db_get_info_for_login: the email is not registered.");
      return fail(401, {
        error: true,
        error_message: "Invalid email or password, please re-enter and try again.", //you have 5 attempts per 24 hours.
      });
    }

    const user_info = res_user_info.user_info;
    const is_password_valid = await bcrypt.compare(form_data.password, user_info.password_hash);

    if (!is_password_valid) {
      await record_failure_attempt(platform, "sign-in", ip_address, user_email); // record ip + email for rate limit
      log_message(platform, app_env, place, "info", "passwords not matched.");
      return fail(401, {
        error: true,
        error_message: "Invalid email or password, please re-enter and try again.", //you have 5 attempts per 24 hours.
      });
    }

    log_message(platform, app_env, place, "info", "passwords matched, ok to continue.");

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

      return fail(401, {
        error: true,
        error_message: "Your account has not been activated, please check your email inbox for the verification link to activate your account.",
      });
    }

    const login_jwt = await jwt.sign(  // token for login session
      {
        uuid: user_info.uuid,
        exp: Math.floor(Date.now() / 1000) + LOGIN_TOKEN_TTL,
      },
      platform.env.LOGIN_JWT_SECRET
    );

    const session_info = {
      uuid: user_info.uuid,
      nickname: user_info.nickname,
      email: user_email,
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
      await log_message(platform, app_env, place, "error", "write_login_session: " + res_write_login.message, user_email);
      return fail(500, {
        error: true,
        error_message: "Internal server error. Please try again later.", // res_write_login.message
      });
    }

    cookies.set("login_auth_token", login_jwt, {
      httpOnly: true,
      path: "/",
      secure: !dev, // true for production, false for development
      sameSite: "lax", // if lax, better to add CSRF check
      maxAge: LOGIN_TOKEN_TTL,
    });

    redirect(303, "/dashboard");
  },
};
