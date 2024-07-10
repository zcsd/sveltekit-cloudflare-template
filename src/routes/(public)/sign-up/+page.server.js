import { fail } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import jwt from "@tsndr/cloudflare-worker-jwt";
import { EMAIL_VERIFY_TOKEN_TTL } from "$config";
import { validate_turnstile_token } from "$lib/server/turnstile";
import { log_message } from "$lib/server/log";
import { db_register_new_user } from "$lib/server/database";
import { check_rate_limit } from "$lib/server/rate_limit";

const place = "sign-up";
const app_env = dev ? "development" : "production";

const register_schema = z
  .object({
    referral_code: z
      .string()
      //.min(4, { message: 'invalid code' })
      .max(10, { message: "invalid code" })
      .trim(),
    email: z
      .string()
      .max(64, { message: "too long" })
      .email({ message: "invalid email" }),
    password: z
      .string()
      .min(8, { message: "too short" })
      .max(64, { message: "too long" })
      .trim(),
    confirm_password: z
      .string()
      .min(8, { message: "too short" })
      .max(64, { message: "too long" })
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

    const form_data_raw = await request.formData();
    const form_data = Object.fromEntries([...form_data_raw]);

    // validate the Cloudflare Turnstile token
    const turnstile_token = form_data_raw.get("cf-turnstile-response");
    const res_validate_tt = await validate_turnstile_token(
      turnstile_token,
      platform.env.TURNSTILE_SECRET_KEY
    );
    if (res_validate_tt.error) {
      log_message(platform, app_env, place, "info", "CAPTCHA fail: " + res_validate_tt.message);
      return fail(400, {
        error: true,
        error_message: "Please complete the CAPTCHA human verification.",
      });
    }

    // validate form form data schema
    const { email, password, confirm_password, ...rest } = form_data;
    try {
      register_schema.parse(form_data);
    } catch (err) {
      const { fieldErrors: errors } = err.flatten();
      log_message(platform, app_env, place, "info", "schema error: " + JSON.stringify(errors));
      return fail(400, {
        error: true,
        errors: errors, // example: { email: 'Invalid email format', password: 'Too short', ...}
        error_message: "Please resolve issues and submit again.",
      });
    }

    // check if referral code format is valid, allowe 6 characters, a-z, A-Z, 0-9
    let final_referral_code = "";
    if (!/^[a-zA-Z0-9]{6}$/.test(form_data.referral_code)) {
      log_message(platform, app_env, place, "info", "invalid referral code format or empty: " + form_data.referral_code);
    } else {
      // currently, referral code is not used in the system, just store it
      final_referral_code = form_data.referral_code.trim();
      log_message(platform, app_env, place, "info", "valid referral code format: " + final_referral_code);
    }

    const user_email = form_data.email.trim().toLowerCase();
    const password_hash = await bcrypt.hash(form_data.password, 10);
    const uuid = uuidv4(); // '109156be-c4fb-41ea-b1b4-efe1671c5836'
    const nickname = user_email.split("@")[0]; // example@domain.com -> example, temporary use email as nickname
    const user_register_info = {
      uuid: uuid,
      email: user_email,
      nickname: nickname,
      password_hash: password_hash,
      referral_code: final_referral_code,
    };

    const ip_address = request.headers.get("cf-connecting-ip"); // the domain must be proxied by Cloudflare
    const is_rate_limit_ok = await check_rate_limit(platform, place, ip_address, user_email);// check ip + email
    if (!is_rate_limit_ok) {
      await log_message(platform, app_env, place, "info", `deny the request due to rate limit, too frequent sign-up. ip:${ip_address}`, user_email);
      return fail(429, {
        error: true,
        error_message: "Too many registration from your IP, please retry after 24 hours.",
      });
    }

    let res_register = await db_register_new_user(platform, request.headers, user_register_info);
    if (res_register.error) {
      if (res_register.is_email_taken) {
        // error, email is already registered
        log_message(platform, app_env, place, "info","db_register_new_user error: " + user_email + " is already registered.");
        return fail(400, {
          error: true,
          errors: { email: " " },
          error_message: "Email is invalid or has already been taken, please try another one.",
        });
      } else {
        // other error, internal server error
        await log_message(platform, app_env, place, "error", "db_register_new_user error: " + res_register.message, user_email);
        return fail(500, {
          error: true,
          error_message: "Internal server error. Please try again later.",
        });
      }
    }

    log_message(platform, app_env,place, "info", "db_register_new_user success: " + user_email);

    //send verification email
    const api_token = await jwt.sign({ uuid: uuid, exp: Math.floor(Date.now() / 1000) + 1 * 1 * (1 * 60) }, platform.env.ONSITE_API_JWT_SECRET); // 1 min
    const email_verify_token = await jwt.sign({ uuid: uuid, exp: Math.floor(Date.now() / 1000) + EMAIL_VERIFY_TOKEN_TTL }, platform.env.VERIFY_EMAIL_JWT_SECRET);

    // temporary ignore failed email sending
    const res_send_verify_email = await fetch("/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task: "verify_email",
        info: {
          nickname: nickname,
          uuid: uuid,
          email: user_email,
          api_token: api_token,
          email_verify_token: email_verify_token,
        },
      }),
    });

    return {
      success: true,
      email: user_email,
      message: "sign up successfully.",
    };
  },
};
