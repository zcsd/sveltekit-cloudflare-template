import { WEBSITE_NAME, APP_DOMAIN } from "$config";
import { dev } from "$app/environment";
import jwt from "@tsndr/cloudflare-worker-jwt";
import { is_jwt_format_valid } from "$lib/tools/jwt";
import { log_message } from "$lib/server/log";

const place = "/send-email";
const app_env = dev ? "development" : "production";

function error_response(message) {
  return new Response(JSON.stringify({ error: true, message: message }), {
    status: 400,
  });
}

/* 
  /send-email endpoint is used to send emails to users.
  not authenticated by cookies or sessions.
  how to authenticate the request: 
  1. jwt token in the body, signed with the secret key
  2. the request must come from the allowed origin
  body: {task: "xxxx", info: {nickname, uuid, email, api_token, ...}}
*/

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, platform }) {
  const ip_address = request.headers.get("cf-connecting-ip") || "undefined-ip";
  const origin = request.headers.get("origin") || "";
  const allowed_origin = dev
    ? "http://localhost:5173"  // change this to your local dev server
    : "https://" + APP_DOMAIN;
  // check if the request is from the allowed origin
  if (!origin.startsWith(allowed_origin)) {
    await log_message(platform, app_env, place, "error", `E101: unauthorized request from origin ${origin} and ip ${ip_address}.`, "na");
    return error_response("Invalid request.");
  }

  const body = await request.json();
  const { task, info } = body;
  // info: {nickname, uuid, email, api_token, ...}

  if (!info || !task) {
    await log_message(platform, app_env, place, "error", `E102: invalid request (no info/task in body) from ip ${ip_address}.`, "na");
    return error_response("Invalid request.");
  }

  const { uuid, email, api_token } = info;
  // api_token is used to auth the request(/send-email), it is signed with the secret key
  if (!api_token || !is_jwt_format_valid(api_token)) {
    await log_message( platform, app_env, place, "error", `E103: ${task}, invalid api_token (wrong format).`, uuid);
    return error_response("Invalid request");
  }

  const is_api_token_valid = await jwt.verify(api_token, platform.env.ONSITE_API_JWT_SECRET);
  if (!is_api_token_valid) {
    await log_message(platform, app_env, place, "error", `E104: ${task}, invalid api_token (wrong secret).`, uuid);
    return error_response("Invalid request.");
  }

  log_message(platform, app_env, place, "info", `${task} task start, api_token ok.`);
  let res;

  switch (task) {
    case "verify_email":
      res = await send_verify_email(platform, info);
      if (res.error) {
        await log_message(platform, app_env, place, "error", `${task}, failed to send email: ${res.message}`, uuid);
        return error_response(res.message);
      }
      break;
    case "magic_link_sign_in":
      res = await send_magic_link(platform, info);
      if (res.error) {
        await log_message(platform, app_env, place, "error", `${task}, failed to send email: ${res.message}`, uuid);
        return error_response(res.message);
      }
      break;
    case "reset_pwd_email":
      res = await send_reset_pwd_email(platform, info);
      if (res.error) {
        await log_message(platform, app_env, place, "error", `${task}, failed to send email: ${res.message}`, uuid);
        return error_response(res.message);
      }
      break;
    case "reset_pwd_success_notification":
      res = await send_reset_pwd_success_notification(platform, info);
      if (res.error) {
        await log_message(platform, app_env, place, "error", `${task}, failed to send email: ${res.message}`, uuid);
        return error_response(res.message);
      }
      break;
    case "subscription_success_notification":
      res = await send_subscription_success_notification(platform, info);
      if (res.error) {
        await log_message(platform, app_env, place, "error", `${task}, failed to send email: ${res.message}`, uuid);
        return error_response(res.message);
      }
      break;
    case "account_deleted_notification":
      res = await send_account_deleted_notification(platform, info);
      if (res.error) {
        await log_message(platform, app_env, place, "error", `${task}, failed to send email: ${res.message}`, uuid);
        return error_response(res.message);
      }
      break;
    default:
      await log_message(platform, app_env, place, "error", "E105: invalid request (invalid task name)", uuid);
      return error_response("Invalid request.");
  }

  log_message( platform, app_env, place, "info", `${task}, email sent successfully.`);
  return new Response(JSON.stringify({ success: true, message: "ok" }), {
    status: 200,
  });
}

async function send_email_by_resend(platform, data) {
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + platform.env.RESEND_API_KEY,
    },
    body: JSON.stringify(data),
  };

  try {
    const response = await fetch("https://api.resend.com/emails", options);
    if (response.status == 200) {
      return {
        success: true,
        message: "ok",
      };
    } else {
      return {
        error: true,
        message: "E106: unknown error, check the resend logs.",
      };
    }
  } catch (err) {
    return {
      error: true,
      message: "E107: " + err.message,
    };
  }
}

async function send_magic_link(platform, info) {
  // info: {nickname, uuid, email, api_token, magic_link_token}
  const magic_link = "https://" + APP_DOMAIN + "/magic-link?token=" + info["magic_link_token"];
  const email_content =
    "<p>Hi " +
    info["nickname"] +
    ",<br><br>Please click the magic link below to sign in to your account.<br><br><b><a href='" +
    magic_link +
    "'>Sign In</a></b> (This link will expire in 30 minutes)<br><br>Thank you,<br>" +
    '<a href="https://' +
    APP_DOMAIN +
    '">' +
    WEBSITE_NAME +
    "</a></p>";

  const data = {
    to: info["email"],
    from: `${WEBSITE_NAME} <noreply@mail.${APP_DOMAIN}>`,
    subject: "Magic Link Sign In",
    html: email_content,
  };

  return await send_email_by_resend(platform, data);
}

async function send_subscription_success_notification(platform, info) {
  // info: {uuid, email, nickname, api_token, product_name, invoice_url}
  const email_content =
    "<p>Hi " +
    info["nickname"] +
    `,<br><br>Your purchase to ${WEBSITE_NAME} - <b>` +
    info["product_name"] +
    "</b> was successful.<br><br>If you encounter any issues,  please contact support@" +
    APP_DOMAIN +
    `.<br><br><a href="${info["invoice_url"]}">Click here to view the invoice.</a><br><br>Thank you,<br>` +
    '<a href="https://' +
    APP_DOMAIN +
    '">' +
    WEBSITE_NAME +
    "</a></p>";
  const data = {
    to: info["email"],
    from: `${WEBSITE_NAME} <noreply@mail.${APP_DOMAIN}>`,
    subject: "Subscription Success",
    html: email_content,
  };

  return await send_email_by_resend(platform, data);
}

async function send_reset_pwd_success_notification(platform, info) {
  //info: {nickname, uuid, email, api_token}
  const email_content =
    "<p>Hi " +
    info["nickname"] +
    ",<br><br>Your password has been reset successfully.<br><br>If the action was not done by you, please contact support@" +
    APP_DOMAIN +
    " immediately.<br><br>Thank you,<br>" +
    '<a href="https://' +
    APP_DOMAIN +
    '">' +
    WEBSITE_NAME +
    "</a></p>";
  const data = {
    to: info["email"],
    from: `${WEBSITE_NAME} <noreply@mail.${APP_DOMAIN}>`, // noreply@mail.domain.com
    subject: "Password Reset Success",
    html: email_content,
  };

  return await send_email_by_resend(platform, data);
}

async function send_reset_pwd_email(platform, info) {
  // info: {nickname, uuid, email, api_token, password_reset_token}
  const reset_url =
    "https://" +
    APP_DOMAIN +
    "/new-password?token=" +
    info["password_reset_token"];
  const email_content =
    "<p>Hi " +
    info["nickname"] +
    ',<br><br>We received a request to reset your password. If you want to continue, click the link below to set your new password.<br><br><b><a href="' +
    reset_url +
    '">Reset Password</a></b> (This link will expire in 1 hour)<br><br>Thank you,<br>' +
    '<a href="https://' +
    APP_DOMAIN +
    '">' +
    WEBSITE_NAME +
    "</a></p>";
  const data = {
    to: info["email"],
    from: `${WEBSITE_NAME} <noreply@mail.${APP_DOMAIN}>`,
    subject: "Password Reset Request",
    html: email_content,
  };

  return await send_email_by_resend(platform, data);
}

async function send_verify_email(platform, info) {
  // info: {nickname, uuid, email, api_token, email_verify_token}
  const verify_url =
    "https://" +
    APP_DOMAIN +
    "/verify-email?token=" +
    info["email_verify_token"];
  const email_content =
    "<p>Hello," +
    "<br><br>Welcome to <b>" +
    WEBSITE_NAME +
    '</b>. <br><br>Please click the link below to verify your email.<br><br><b><a href="' +
    verify_url +
    '">Verify Email</a></b> (This link will expire in 24 hours)<br><br>Thank you,<br>' +
    '<a href="https://' +
    APP_DOMAIN +
    '">' +
    WEBSITE_NAME +
    "</a></p>";
  const data = {
    to: info["email"],
    from: `${WEBSITE_NAME} <noreply@mail.${APP_DOMAIN}>`,
    subject: "Register Verification",
    html: email_content,
  };

  return await send_email_by_resend(platform, data);
}

async function send_account_deleted_notification(platform, info) {
  // info: {nickname, uuid, email, api_token}
  const email_content =
    "<p>Hi " +
    info["nickname"] +
    ",<br><br>Your account has been deleted successfully, we are sad to see you leave.<br><br>If the action was not done by you, please contact support@" +
    APP_DOMAIN +
    " immediately.<br><br>Thank you,<br>" +
    '<a href="https://' +
    APP_DOMAIN +
    '">' +
    WEBSITE_NAME +
    "</a></p>";
  const data = {
    to: info["email"],
    from: `${WEBSITE_NAME} <noreply@mail.${APP_DOMAIN}>`,
    subject: "Account Deleted",
    html: email_content,
  };

  return await send_email_by_resend(platform, data);
}
