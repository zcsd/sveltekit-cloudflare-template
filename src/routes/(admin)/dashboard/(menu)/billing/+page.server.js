import { redirect, error } from "@sveltejs/kit";
import { dev } from "$app/environment";
import Stripe from "stripe";
import { SUBSCRIPTION_PERIOD_LEEWAY } from "$config";
import { get_or_create_stripe_customer } from "./subscription_helpers.server";
import { pricing_plans } from "../../../../(public)/pricing/pricing_plans";
import { db_update_stripe_customer } from "$lib/server/database";
import { update_login_sessions } from "$lib/server/session";
import { log_message } from "$lib/server/log";

const place = "/dashboard/billing";
const app_env = dev ? "development" : "production";

export const load = async ({ platform, locals, url, fetch, cookies }) => {
  log_message(platform, app_env, place, "info", "page load start.");
  log_message(platform, app_env, place, "info", `full url: ${url}`);
  if (!locals.user || !locals.session) {
    cookies.delete("login_auth_token", { path: "/" });
    redirect(303, "/sign-in");
  }

  const stripe = new Stripe(platform.env.PRIVATE_STRIPE_API_KEY, {apiVersion: "2024-04-10"});

  // checkout success: /dashboard/billing?payment_status=paid&session_id={CHECKOUT_SESSION_ID}&csrf_token={CSRF_TOKEN}
  // checkout cancel: /dashboard/billing?payment_status=unpaid&csrf_token={CSRF_TOKEN}
  // portal return: /dashboard/billing?from_portal=true&csrf_token={CSRF_TOKEN}
  const checkout_session_id = url.searchParams.get("session_id");
  const csrf_token_url = url.searchParams.get("csrf_token");
  const payment_status = url.searchParams.get("payment_status");
  const from_portal = url.searchParams.get("from_portal");

  // CSRF check
  if (payment_status || from_portal || checkout_session_id) {
    const csrf_token_cookie = cookies.get("csrf_token");
    if (
      !csrf_token_url ||
      !csrf_token_cookie ||
      csrf_token_cookie !== csrf_token_url
    ) {
      await log_message(platform, app_env, place, "error", "Failed to vailidate CSRF token.", locals.user.email);
      cookies.delete("login_auth_token", { path: "/" });
      cookies.delete("csrf_token", { path: "/" });
      // TODO: consider to add rate limit
      error(400, "Unknown error: If issue persists, please contact us.");
    }
  }

  if (checkout_session_id && payment_status === "paid") {
    log_message(platform, app_env, place, "info", "found checkout_session_id & paid payment_status in url.");
    // update stripe customers db for new subscriptions, and update login session db&kv
    // renewals and upgrades are handled in stripe webhooks
    // subscription success email is also handled in stripe webhooks
    const res = await update_stripe_customer(platform, stripe, checkout_session_id, locals);
    if (res.error) {
      await log_message(platform, app_env, place, "error", "update_stripe_customer: " + res.message, locals.user.email);
      error(500, "Unknown error. If issue persists, please contact us.");
    }
    redirect(303, "/dashboard/billing"); // redirect to /dashboard/billing to avoid refresh resubmission
  }

  if (payment_status === "unpaid") {
    log_message(platform, app_env, place, "info", "found unpaid payment_status in url.");
    redirect(303, "/dashboard/billing");
  }

  if (from_portal === "true") {
    log_message(platform, app_env, place, "info", "found true from_portal in url.");
    redirect(303, "/dashboard/billing");
  }

  log_message(platform, app_env, place, "info", "no params in url, loading page as normal."); 

  let is_active_subscription = false;
  let current_plan_id = "free"; // free, pro, enterprise. different from stripe_product_id or current_product_id
  const { stripe_customer_id, current_product_id, current_period_end_at, had_subscription_before } = locals.user;

  // null stripe_customer_id in locals, then get or create stripe customer from db
  if (!stripe_customer_id) { 
    log_message(platform, app_env, place, "info", "stripe_customer_id is null in locals, getting or creating stripe customer...");
    const res = await get_or_create_stripe_customer(platform, locals.user.uuid, stripe);
    if (res.error) {
      await log_message(platform, app_env, place, "error", "get_or_create_stripe_customer: " + res.message, locals.user.email);
      error(500,  "Unknown error. If issue persists, please contact us.");
    }
    log_message(platform, app_env, place, "info", "get_or_create_stripe_customer success.");

    if (res.new_customer) {
      log_message(platform, app_env, place, "info", "new customer created, updating login session.");

      const update_info = {
        // only update stripe_customer_id, others are null
        stripe_customer_id: res.stripe_customer_id,
      } 
  
      const res_update_login_session = await update_login_sessions(platform, locals.user.uuid, update_info);
      if (res_update_login_session.error) {
        await log_message(platform, app_env, place, "error", "update_login_sessions: " + res_update_login_session.message, locals.user.email);
      }
      log_message(platform, app_env, place, "info", "update_login_sessions successfully.");

      return {
        is_active_subscription: false, // new customer has no active subscription
        had_subscription_before: false, // new customer has no subscription before
        current_plan_id: current_plan_id,
      }
    }

    log_message(platform, app_env, place, "info", "existing stripe customer info found in db.");

    if (res.current_period_end_at && res.current_period_end_at > Date.now()) {
      is_active_subscription = true;
    }
    if (res.current_product_id) {
      // prod_Q78TtLk34bY2Zo (current_product_id) => pro (current_plan_id)
      current_plan_id = pricing_plans.find(
        (x) => x.stripe_product_id === res.current_product_id
      )?.id;
    }

    return {
      is_active_subscription: is_active_subscription,
      had_subscription_before: res.had_subscription_before === 1 ? true : false,
      current_plan_id: current_plan_id,
    };
  }

  log_message(platform, app_env, place, "info", "stripe_customer_id not null in locals, reading stripe customer from locals.");

  if (current_period_end_at && current_period_end_at > Date.now()) {
    is_active_subscription = true;
  }

  if (current_product_id) {
    current_plan_id = pricing_plans.find(
      (x) => x.stripe_product_id === current_product_id
    )?.id;
  }

  return {
    is_active_subscription: is_active_subscription,
    had_subscription_before: had_subscription_before === 1 ? true : false,
    current_plan_id: current_plan_id,
  };
};

async function update_stripe_customer(platform, stripe, checkout_session_id, locals) {
  // update stripe customer info in db and login session in db&kv
  try {
    // https://docs.stripe.com/api/checkout/sessions/object
    const checkout_session = await stripe.checkout.sessions.retrieve(checkout_session_id);

    if (
      checkout_session.payment_status === "paid" &&
      checkout_session.subscription &&
      checkout_session.customer_details.email === locals.user.email
    ) {
      // https://docs.stripe.com/api/subscriptions/object
      const subscription = await stripe.subscriptions.retrieve(checkout_session.subscription);
      const subscription_item = subscription.items.data[0];

      // need to set price description in stripe dashboard (Product catalog->Edit product->Price->Edit price->Price description)
      const product_name = subscription_item.plan.nickname; // nickname is the price description (Pro, Enterprise)
      log_message(platform, app_env, place, "info", `stripe checkout session retrieved, ${locals.user.email} successful subscribed to ${product_name} plan.`);
      
      const sub_info = {
        uuid: locals.user.uuid,
        stripe_customer_id: subscription.customer,
        current_product_id: subscription_item.plan.product,
        current_period_end_at: subscription.current_period_end * 1000 + SUBSCRIPTION_PERIOD_LEEWAY,
      };
      // update stripe customer info db
      const res_update_stripe_customer = await db_update_stripe_customer(platform, sub_info);
      if (res_update_stripe_customer.error) {
        return {
          error: true,
          message: "db_update_stripe_customer: " + res_update_stripe_customer.message,
        }
      }
      log_message(platform, app_env, place, "info", "db_update_stripe_customer success.");

      // update login session db&kv
      const update_info = {
        current_product_id: sub_info.current_product_id,
        current_period_end_at: sub_info.current_period_end_at,
        had_subscription_before: 1,
      }
      const res_update_login_session = await update_login_sessions(platform, locals.user.uuid, update_info);
      if (res_update_login_session.error) {
        return {
          error: true,
          message: "update_login_sessions: " + res_update_login_session.message,
        }
      }
      log_message(platform, app_env, place, "info", "update_login_sessions success.");

      return {
        success: true,
        message: "ok",
      }
    } else {
      return {
        error: true,
        message: "stripe checkout session is not vaild, retrieved fail.",
      }
    }
  } catch (err) {
    return {
      error: true,
      message: `stripe checkout session retrieval error: ${err.message}`,
    }
  }
}
