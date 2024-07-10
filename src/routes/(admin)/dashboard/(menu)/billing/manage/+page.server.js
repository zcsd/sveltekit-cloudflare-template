import { redirect, error } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { v4 as uuidv4 } from "uuid";
import Stripe from "stripe";
import { get_or_create_stripe_customer } from "../subscription_helpers.server";
import { update_login_sessions } from "$lib/server/session";
import { log_message } from "$lib/server/log";

const place = "/dashboard/billing/manage";
const app_env = dev ? "development" : "production";

export const load = async ({ platform, url, locals, cookies }) => {
  log_message(platform, app_env, place, "info", "page load start.");
  log_message(platform, app_env, place, "info", `full url: ${url}`);
  if (!locals.user || !locals.session) {
    cookies.delete("login_auth_token", { path: "/" });
    redirect(303, "/sign-in");
  }

  const stripe = new Stripe(platform.env.PRIVATE_STRIPE_API_KEY, {apiVersion: "2024-04-10"});

  let stripe_customer_id = locals.user.stripe_customer_id;
  // if null stripe_customer_id in locals, then get or create stripe customer from db
  if (!stripe_customer_id) {
    log_message(platform, app_env, place, "info", "stripe_customer_id is null in locals, getting or creating stripe customer...");
    const res = await get_or_create_stripe_customer(platform, locals.user.uuid, stripe);
    if (res.error) {
      await log_message(platform, app_env, place, "error", "get_or_create_stripe_customer: " + res.message, locals.user.email);
      error(500, "Unknown error. If issue persists, please contact us.");
    }
    log_message(platform, app_env, place, "info", "get_or_create_stripe_customer success.");
    stripe_customer_id = res.stripe_customer_id;

    if (res.new_customer) {
      log_message(platform, app_env, place, "info", "new customer created, updating login session.");

      const update_info = {
        stripe_customer_id: res.stripe_customer_id,
      }
  
      const res_update_login_session = await update_login_sessions(platform, locals.user.uuid, update_info);
      if (res_update_login_session.error) {
        await log_message(platform, app_env, place, "error", "update_login_sessions: " + res_update_login_session.message, locals.user.email);
      } else {
        log_message(platform, app_env, place, "info", "update_login_sessions success.");
      }

      redirect(303, "/dashboard/billing"); // new customer can not access manage page
    } else {
      log_message(platform, app_env, place, "info", "existing stripe customer found in db.");
      if (res.had_subscription_before == 0) {
        // only user with subscription (now or past) can access manage page
        log_message(platform, app_env, place, "info", "user has no subscription before, redirecting to /dashboard/billing.");
        redirect(303, "/dashboard/billing");
      }
      log_message(platform, app_env, place, "info", "user has subscription before or now, continue to create stripe portal session.");
    }
  } else {
    log_message(platform, app_env, place, "info", "stripe_customer_id not null in locals, reading stripe customer from locals.");
    if (locals.user.had_subscription_before == 0) {
      // only user with subscription (now or past) can access manage page
      log_message(platform, app_env, place, "info", "user has no subscription before, redirecting to /dashboard/billing.");
      redirect(303, "/dashboard/billing");
    }
    log_message(platform, app_env, place, "info", "user has subscription before or now, continue to create stripe portal session.");
  }

  let portal_link = null;
  try {
    //CSRF token setup
    const csrf_token = uuidv4().replace(/-/g, ""); // remove - from generated uuid
    cookies.delete("csrf_token", { path: "/" });
    cookies.set("csrf_token", csrf_token, {
      httpOnly: true,
      path: "/",
      secure: !dev,
      sameSite: "lax",
      maxAge: 60 * 60, // 60 minutes
    });

    const portal_session = await stripe.billingPortal.sessions.create({
      customer: stripe_customer_id,
      return_url: `${url.origin}/dashboard/billing?from_portal=true&csrf_token=${csrf_token}`,
    });
    portal_link = portal_session?.url;
  } catch (err) {
    await log_message(platform, app_env, place, "error", "stripe.billingPortal.sessions.create: " + err.message, locals.user.email);
    error(500, "Unknown error (PSE). If issue persists, please contact us.");
  }

  if (portal_link) {
    log_message(platform, app_env, place, "info", `stripe portal session created successfully, redirecting to portal: ${portal_link}`);
  } 

  redirect(303, portal_link ?? "/dashboard/billing");
};
