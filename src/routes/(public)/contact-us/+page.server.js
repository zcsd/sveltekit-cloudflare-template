import { fail } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { z } from "zod";
import { validate_turnstile_token } from "$lib/server/turnstile";
import { db_insert_contact_request } from "$lib/server/database";
import { log_message } from "$lib/server/log";

const place = "contact-us";
const app_env = dev ? "development" : "production";

const contact_schema = z.object({
  contact_name: z
    .string()
    .min(1, { message: "required" })
    .max(64, { message: "too long" })
    .trim(),
  email: z
    .string()
    .max(64, { message: "too long" })
    .email({ message: "invalid email" }),
  phone: z.string().max(64, { message: "too long" }).trim(),
  company: z.string().max(128, { message: "too long" }).trim(),
  message: z
    .string()
    .max(2000, { message: "max 2000 allowed characters" })
    .trim(),
});

/** @type {import('./$types').Actions} */
export const actions = {
  default: async ({ request, platform }) => {
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
        error_message: "Please complete the CAPTCHA human verification.",
      });
    }

    try {
      contact_schema.parse(form_data);
    } catch (err) {
      const { fieldErrors: errors } = err.flatten();
      log_message(platform, app_env, place, "info", "schema error: " + JSON.stringify(errors));
      return fail(400, {
        error: true,
        errors: errors, // example: { email: 'Email is too long', contact_name: 'Name is required', ...}
        error_message: "Please resolve issues and submit again.",
      });
    }

    const contact_info = {
      contact_name: form_data.contact_name.trim(),
      email: form_data.email.trim(),
      phone: form_data.phone.trim(),
      company: form_data.company.trim(),
      message: form_data.message.trim(),
    };

    // insert contact message into db
    const res_insert = await db_insert_contact_request(platform, request.headers, contact_info);

    if (res_insert.error) {
      await log_message(platform, app_env, place, "error", "db_insert_contact_request: " + res_insert.message, contact_info.email);
      return fail(500, {
        error: true,
        error_message: "Internal server error. Please try again later.",
      });
    }
    log_message(platform, app_env, place, "info", "db_insert_contact_request success.");

    // send contact request to lark group chat for notification to team
    await send_contact_request_to_lark(platform, contact_info);

    return {
      success: true,
      message: "Your message has been sent successfully. We will get back to you soon.",
    };
  },
};

async function send_contact_request_to_lark(platform, contact_info) {
  const time_readable = new Date().toISOString() + " UTC";

  const content =
    "\nName: " +
    contact_info.contact_name +
    "\nEmail: " +
    contact_info.email +
    "\nPhone: " +
    contact_info.phone +
    "\nCompany: " +
    contact_info.company +
    "\n\nMessage: " +
    contact_info.message +
    "\n\n" +
    time_readable;

  const message = {
    msg_type: "post",
    content: {
      post: {
        en_us: {
          title: "New Contact Request",
          content: [
            [
              {
                tag: "text",
                text: content,
              },
            ],
          ],
        },
      },
    },
  };

  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  };

  const response = await fetch(platform.env.LARK_BOT_URL, options);
  if (response.status === 200) {
    log_message(platform, app_env, place, "info", "send_contact_request_to_lark success.");
    return { success: true };
  } else {
    await log_message(platform, app_env, place, "error", "send_contact_request_to_lark failed: status " + response.statusText);
    return { error: true };
  }
}
