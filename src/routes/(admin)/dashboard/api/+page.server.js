import { fail, redirect } from "@sveltejs/kit";
import { dev } from "$app/environment";
import jwt from "@tsndr/cloudflare-worker-jwt";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { log_message } from "$lib/server/log";
import {
  db_update_profile,
  db_get_user_info_by_email,
  db_update_password,
  db_delete_user,
} from "$lib/server/database";
import {
  update_login_sessions,
  delete_login_session,
} from "$lib/server/session";

const place = "/dashboard/api/";
const app_env = dev ? "development" : "production";

export const actions = {
  update_email: async ({ request, platform, locals }) => {
    log_message(platform, app_env, place, "info", "update_email action start.");
    if (!locals.user || !locals.session) {
      redirect(303, "/sign-in");
    }

    const form_data_raw = await request.formData();
    const form_data = Object.fromEntries([...form_data_raw]);

    if (!form_data.email.trim() || form_data.email.trim() === "") {
      log_message(platform, app_env, place, "info", "update_email missing email field.");
      return fail(400, {
        error_message: "An email address is required.",
        error_fields: ["email"],
        email: form_data.email.trim(),
      });
    }

    const email_schema = z.object({
      email: z
        .string({ required_error: "An email address is required." })
        .min(3, { message: "A valid email address is required." })
        .max(64, { message: "A valid email address is required." })
        .email({ message: "A valid email address is required." }),
    });

    try {
      email_schema.parse(form_data);
    } catch (err) {
      const { fieldErrors: errors } = err.flatten();
      const error_messages = Object.values(errors).flat();
      log_message(platform, app_env, place, "info", "update_email schema error: " + error_messages);

      return fail(400, {
        error_message: error_messages[0], // only return the first error message
        error_fields: ["email"],
        email: form_data.email.trim(),
      });
    }

    if (locals.user.email === form_data.email.trim()) {
      log_message(platform, app_env, place, "info", "update_email same email provided.");
      return fail(400, {
        error_message: "This is already your email address, no need to change it.",
        error_fields: ["email"],
        email: form_data.email.trim(),
      });
    }

    // check if the new email is already registered
    const res_check_email = await db_get_user_info_by_email(platform, form_data.email.trim());
    if (res_check_email.error) {
      await log_message(platform, app_env, place, "error", "db_get_user_info_by_email: " + res_check_email.message, locals.user.email);
      return fail(500, {
        error_message: "Internal server error. Please try again later.",
        error_fields: ["email"],
        email: form_data.email.trim(),
      });
    }

    if (res_check_email.is_registered) {
      log_message(platform, app_env, place, "info", "update_email email already registered.");
      return fail(400, {
        error_message: "This email address is already registered, please use a different one.",
        error_fields: ["email"],
        email: form_data.email.trim(),
      });
    }

    // TODO:
    // generate new email verification token
    // send new email verification link to new email
    // create a new `+page.serevr.js` file for new email verification and update email in db

    // currently, I don't implement this update email feature, leave it temporarily
    // will implement it if needed in the future

    return {
      email: form_data.email.trim(),
    };
  },

  update_password: async ({ request, platform, locals }) => {
    log_message( platform, app_env, place, "info", "update_password action start.");
    if (!locals.user || !locals.session) {
      redirect(303, "/sign-in");
    }

    const form_data_raw = await request.formData();
    const form_data = Object.fromEntries([...form_data_raw]);

    if (
      !form_data.password.trim() ||
      !form_data.confirm_password.trim() ||
      !form_data.current_password.trim()
    ) {
      log_message(platform, app_env, place, "info", "update_password missing required fields.");
      return fail(400, {
        error_message: "All fields are required to fill in.",
        error_fields: ["password", "confirm_password", "current_password"],
        password: form_data.password.trim(),
        confirm_password: form_data.confirm_password.trim(),
        current_password: form_data.current_password.trim(),
      });
    }

    const passwords_schema = z
      .object({
        password: z
          .string({ required_error: "You must type a new password." })
          .min(8, {
            message: "The new password must be at least 8 charaters long.",
          })
          .max(32, {
            message: "The new password can be at most 32 charaters long.",
          })
          .trim(),
        confirm_password: z
          .string({ required_error: "You must type the new password twice." })
          .min(8, {
            message: "The new password must be at least 8 charaters long.",
          })
          .max(32, {
            message: "The new password can be at most 32 charaters long.",
          })
          .trim(),
        current_password: z
          .string({ required_error: "You must include your current password." })
          .min(8, {
            message:
              "Invalid current password. Your current password should be at least 8 charaters long.",
          })
          .max(32, {
            message:
              "Invalid current password. Your current password should be at most 32 charaters long.",
          })
          .trim(),
      })
      .superRefine(({ confirm_password, password }, ctx) => {
        if (confirm_password !== password) {
          ctx.addIssue({
            code: "custom",
            message: "The new passwords don't match.",
            path: ["confirm_password"],
          });
        }
      });

    try {
      passwords_schema.parse(form_data);
    } catch (err) {
      const { fieldErrors: errors } = err.flatten();
      const error_fields = Object.keys(errors);
      const error_messages = Object.values(errors).flat();
      log_message(platform, app_env, place, "info", "update_password schema error: " + error_messages);

      return fail(400, {
        error_message: error_messages[0], // only return the first error message
        error_fields: [error_fields[0]], // only return the first error field
        password: form_data.password.trim(),
        confirm_password: form_data.confirm_password.trim(),
        current_password: form_data.current_password.trim(),
      });
    }

    let res_check_password = await db_get_user_info_by_email(platform, locals.user.email);
    if (res_check_password.error || !res_check_password.is_registered) {
      // server error or user not found
      await log_message(platform, app_env, place, "error", "db_get_user_info_by_email: " + res_check_password.message, locals.user.email);
      return fail(500, {
        error_message: "Internal server error. Please try again later.",
        error_fields: [],
        password: form_data.password.trim(),
        confirm_password: form_data.confirm_password.trim(),
        current_password: form_data.current_password.trim(),
      });
    }

    const is_current_password_valid = await bcrypt.compare(
      form_data.current_password.trim(),
      res_check_password.user_info.password_hash
    );

    if (!is_current_password_valid) {
      log_message(platform, app_env, place, "info", "Current password not matched.");
      return fail(400, {
        error_message: "Current password is incorrect. If you forgot it, sign out then use 'forgot password' on the sign in page to reset it.",
        error_fields: ["current_password"],
        password: form_data.password.trim(),
        confirm_password: form_data.confirm_password.trim(),
        current_password: form_data.current_password.trim(),
      });
    }

    const new_password_hash = await bcrypt.hash(form_data.password.trim(), 10);

    let res_update_password = await db_update_password(platform, request.headers, locals.user.uuid, new_password_hash);

    if (res_update_password.error) {
      await log_message(platform, app_env, place, "error", "db_update_password: " + res_update_password.message, locals.user.email);
      return fail(500, {
        error_message: "Internal server error. Please try again later.",
        error_fields: [],
        password: form_data.password.trim(),
        confirm_password: form_data.confirm_password.trim(),
        current_password: form_data.current_password.trim(),
      });
    }

    log_message(platform, app_env, place, "info", "db_update_password success.");
    return {
      success: true,
      message: "Your password has been updated successfully.",
      password: form_data.password.trim(),
      confirm_password: form_data.confirm_password.trim(),
      current_password: form_data.current_password.trim(),
    };
  },

  delete_account: async ({ request, platform, cookies, locals, fetch }) => {
    log_message(platform, app_env, place, "info", "delete_account action start.");
    if (!locals.user || !locals.session) {
      redirect(303, "/sign-in");
    }

    const form_data_raw = await request.formData();
    const form_data = Object.fromEntries([...form_data_raw]);

    const password = form_data.password.trim();

    if (!password) {
      return fail(400, {
        error_message: "You must provide your current password to delete your account. If you forgot it, sign out then use 'forgot password' on the sign in page.",
        error_fields: ["password"],
        password,
      });
    }

    let res_check_password = await db_get_user_info_by_email(platform, locals.user.email);
    if (res_check_password.error || !res_check_password.is_registered) {
      // server error or user not found
      await log_message(platform, app_env, place, "error", "db_get_user_info_by_email: " + res_check_password.message, locals.user.email);
      return fail(500, {
        error_message: "Internal server error. Please try again later.",
        error_fields: [],
        password,
      });
    }

    const is_current_password_valid = await bcrypt.compare(
      password,
      res_check_password.user_info.password_hash
    );

    if (!is_current_password_valid) {
      log_message(platform, app_env, place, "info", "Current password not matched.");
      return fail(400, {
        error_message: "Current password is incorrect. If you forgot it, sign out then use 'forgot password' on the sign in page to reset it.",
        error_fields: ["password"],
        password,
      });
    }

    // delete user account
    // this will also delete all the user's data, including login sessions in db
    let res_delete_user = await db_delete_user(platform, locals.user.uuid);
    if (res_delete_user.error) {
      await log_message(platform, app_env, place, "error", "db_delete_user: " + res_delete_user.message, locals.user.email);
      return fail(500, {
        error_message: "Internal server error. Please try again later.",
        error_fields: [],
        password,
      });
    }

    log_message(platform, app_env, place, "info", "db_delete_user success.");

    // send delete account notification email to user
    const api_token = await jwt.sign(
      {
        uuid: locals.user.uuid,
        exp: Math.floor(Date.now() / 1000) + 1 * 1 * (1 * 60),
      },
      platform.env.ONSITE_API_JWT_SECRET
    );

    await fetch("/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task: "account_deleted_notification",
        info: {
          nickname: locals.user.nickname,
          uuid: locals.user.uuid,
          email: locals.user.email,
          api_token: api_token,
        },
      }),
    });

    cookies.delete("login_auth_token", { path: "/" });
    // this deletes the session from KV (also from db, but we already deleted it above, actually we don't need to delete it again here)
    await delete_login_session(platform, locals.session.id);

    redirect(303, "/");
  },

  update_profile: async ({ request, platform, locals }) => {
    log_message(platform, app_env, place, "info", "update_profile action start.");
    if (!locals.user || !locals.session) {
      redirect(303, "/sign-in");
    }

    const form_data_raw = await request.formData();
    const form_data = Object.fromEntries([...form_data_raw]);

    let errors = {};
    if (form_data.nickname.trim().length == 0) {
      errors["nickname"] = "name is missing";
    }
    if (form_data.organization.trim().length == 0) {
      errors["organization"] = "organization is missing";
    }
    if (Object.keys(errors).length > 0) {
      log_message(platform, app_env, place, "info", "update_profile missing required fields.");
      return fail(400, {
        error: true,
        errors: errors,
        error_fields: Object.keys(errors),
        error_message: "Please fill in all fields.",
        nickname: form_data.nickname.trim(),
        organization: form_data.organization.trim(),
      });
    }

    const profile_schema = z.object({
      nickname: z
        .string()
        .max(30, { message: "name is too long" })
        .regex(/^[a-zA-Z0-9\s-\.]+$/, {
          message: "Only - and . symbols are allowed",
        })
        .trim(),
      organization: z
        .string()
        .max(30, { message: "organization name is too long" })
        .regex(/^[a-zA-Z0-9\s-\.]+$/, {
          message: "Only - and . symbols are allowed",
        })
        .trim(),
    });

    try {
      profile_schema.parse(form_data);
    } catch (err) {
      const { fieldErrors: errors } = err.flatten();
      log_message(platform, app_env, place, "info", "update_profile schema error: " + JSON.stringify(errors));
      return fail(400, {
        error: true,
        errors: errors,
        error_fields: Object.keys(errors),
        error_message: "Max length is 30 characters for each field and only - and . symbols are allowed.",
        nickname: form_data.nickname.trim(),
        organization: form_data.organization.trim(),
      });
    }

    const res_update_profile = await db_update_profile(platform, {
      uuid: locals.user.uuid,
      nickname: form_data.nickname.trim(),
      organization: form_data.organization.trim(),
    });

    if (res_update_profile.error) {
      await log_message(platform, app_env, place, "error", "db_update_profile: " + res_update_profile.message, locals.user.email);
      return fail(500, {
        error: true,
        error_message: "Internal server error. Please try again later.",
      });
    }
    log_message(platform, app_env, place, "info", "db_update_profile success.");

    let res = await update_login_sessions(platform, locals.user.uuid, {
      nickname: form_data.nickname.trim(),
      organization: form_data.organization.trim(),
    });

    if (res.error) {
      await log_message(platform, app_env, place, "error", "update_login_sessions: " + res.message, locals.user.email);
    }

    return {
      success: true,
      message: "Your profile has been updated successfully.",
    };
  },
};
