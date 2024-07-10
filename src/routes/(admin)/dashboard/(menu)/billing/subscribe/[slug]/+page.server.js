import { redirect, error } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { v4 as uuidv4 } from "uuid";
import Stripe from "stripe";
import { update_login_sessions } from "$lib/server/session";
import { get_or_create_stripe_customer } from "../../subscription_helpers.server";
import { log_message } from "$lib/server/log";

const place = "/dashboard/subscribe/[slug]";
const app_env = dev ? "development" : "production";

export const load = async ({ platform, params, url, locals, cookies }) => {
  log_message(platform, app_env, place, "info", "page load start.");
  log_message(platform, app_env, place, "info", `full url: ${url}`);
  if (!locals.user|| !locals.session) {
    cookies.delete("login_auth_token", { path: "/" });
    redirect(303, "/sign-in");
  }

  if (params.slug === "free_plan") {
    // plan with no stripe_price_id, redirect to dashboard billing
    redirect(303, "/dashboard/billing");
  }

  const stripe = new Stripe(platform.env.PRIVATE_STRIPE_API_KEY, {apiVersion: "2024-04-10"});

  let stripe_customer_id = locals.user.stripe_customer_id;
  // null stripe_customer_id in locals, then get or create stripe customer from db
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
    } else {
      log_message(platform, app_env, place, "info", "existing stripe customer found in db.");
      if (res.current_period_end_at && res.current_period_end_at > Date.now()) {
        log_message(platform, app_env, place, "info", "user has an active subscription, redirecting to /dashboard/billing.");
        redirect(303, "/dashboard/billing");
      }
    }
  } else {
    log_message(platform, app_env, place, "info", "stripe_customer_id not null in locals, reading stripe customer from locals.");
  }

  log_message(platform, app_env, place, "info", "going to create checkout session.");

  let checkout_url = null;
  try {
    //CSRF token setup
    const csrf_token = uuidv4().replace(/-/g, ""); // remove - from generated uuid
    cookies.delete("csrf_token", { path: "/" });
    cookies.set("csrf_token", csrf_token, {
      httpOnly: true,
      path: "/",
      secure: !dev,
      sameSite: "lax",
      maxAge: 60 * 31, // 30 minutes + 1 minute
    });

    const stripe_session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: params.slug,
          quantity: 1,
        },
      ],
      customer: stripe_customer_id,
      mode: "subscription",
      success_url: `${url.origin}/dashboard/billing?payment_status=paid&session_id={CHECKOUT_SESSION_ID}&csrf_token=${csrf_token}`,
      cancel_url: `${url.origin}/dashboard/billing?payment_status=unpaid&csrf_token=${csrf_token}`,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 30, // 30 minutes
    });
    checkout_url = stripe_session.url;
  } catch (err) {
    await log_message(platform, app_env, place, "error", "stripe.checkout.sessions.create: " + err.message, locals.user.email);
    error(500, "Unknown Error (SSE): If issue persists please contact us.");
  }

  if (checkout_url) {
    log_message(platform, app_env, place, "info", `checkoutUrl created, redirecting to ${checkout_url}`);
  }
  
  redirect(303, checkout_url ?? "/dashboard/billing");
};
