import { dev } from "$app/environment";
import Stripe from "stripe";
import jwt from "@tsndr/cloudflare-worker-jwt";
import { SUBSCRIPTION_PERIOD_LEEWAY } from "$config";
import { log_message } from "$lib/server/log";
import { db_update_stripe_customer } from "$lib/server/database";
import { update_login_sessions } from "$lib/server/session";

const place = "/api/stripe-webhooks";
let app_env = dev ? "development" : "production";

/* The POST method is used to receive and process the webhook events from Stripe.
   invoice.paid event is used to handle the subscription payment success.
   For new subscriptions: send a subscription success email to the user, and NOT update db (update db action done in /dashboard/billing). (work for both dev and prod)
   For renewals/upgrades: NOT send email notification, but update db. (work for only prod mode)
*/

async function send_email(platform, customer_info, invoice_paid, fetch) {
  const api_token = await jwt.sign( // token for /send-email authorization
    {
      exp: Math.floor(Date.now() / 1000) + 1 * 1 * (1 * 60),
    },
    platform.env.ONSITE_API_JWT_SECRET
  );

  // ok to fail to send email, so no response check
  await fetch("/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      task: "subscription_success_notification",
      info: {
        uuid: customer_info.metadata.uuid,
        email: customer_info.email,
        nickname: customer_info.name,
        api_token: api_token,
        product_name: invoice_paid.lines.data[0].plan.nickname,
        invoice_url: invoice_paid.hosted_invoice_url,
      },
    }),
  });
}

async function update_stripe_customer(platform, customer_info, invoice_paid) {
  const sub_info = {
    uuid: customer_info.metadata.uuid,
    stripe_customer_id: invoice_paid.customer,
    current_product_id: invoice_paid.lines.data[0].plan.product,
    current_period_end_at: invoice_paid.lines.data[0].period.end * 1000 + SUBSCRIPTION_PERIOD_LEEWAY,
  };

  const res = await db_update_stripe_customer(platform, sub_info);
  if (res.error) {
    return { 
      error: true, 
      message: "db_update_stripe_customer: " + res.message 
    };
  } else {
    return { success: true }
  }
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, platform, fetch }) {
  const signature = request.headers.get("stripe-signature");
  const stripe = new Stripe(platform.env.PRIVATE_STRIPE_API_KEY, { apiVersion: "2024-04-10" });
  let event;

  try {
    const body = await request.text();
    event = await stripe.webhooks.constructEventAsync(body, signature, platform.env.STRIPE_WH_SECRET);
  } catch (err) {
    await log_message(platform, app_env, place, "error", `Webhook signature verification failed: ${err.message}`, "na");
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  switch (event.type) {
    case "invoice.paid":
      const invoice_paid = event.data.object; // https://docs.stripe.com/api/invoices/object
      try {
        const customer_info = await stripe.customers.retrieve(invoice_paid.customer);

        if (invoice_paid.billing_reason === "subscription_create") { 
          // send subscription success email to user, only for new subscription
          // not send for other billing_reasons: subscription_cycle, subscription_update etc.
          await send_email(platform, customer_info, invoice_paid, fetch); // work for both dev and prod customers
        }
  
        if (customer_info.metadata.is_production === "0") {  // metadata is set in create stripe customer in /dashboard/billing/subscriptions_helpers
          // if the customer is in dev mode, do not update live db, return success directly
          // customer data in dev mode is not saved in the live db
          return new Response(JSON.stringify({ success: true, message: "customer is in dev mode." }), { status: 200 });
        }
  
        if (invoice_paid.billing_reason != "subscription_create") {
          // if new subscription, do not update the db, the db update action was done in /dashboard/billing with checkout_session_id
          const res = await update_stripe_customer(platform, customer_info, invoice_paid);
          if (res.error) {
            await log_message(platform, app_env, place, "error", `update_stripe_customer: ${res.message}`, customer_info.metadata.uuid);
            return new Response(JSON.stringify({ error: true, message: res.message }), { status: 500 });
          }
        }

        // update all live login_sessions for the user, mainly current_product_id and current_period_end_at
        const update_info = {
          current_product_id: invoice_paid.lines.data[0].plan.product,
          current_period_end_at: invoice_paid.lines.data[0].period.end * 1000 + SUBSCRIPTION_PERIOD_LEEWAY,
          had_subscription_before: 1,
        };

        const res_update = await update_login_sessions(platform, customer_info.metadata.uuid, update_info);
        if (res_update.error) {
          await log_message(platform, app_env, place, "error", `update_login_sessions: ${res_update.message}`, customer_info.metadata.uuid);
        }


      } catch (err) {
        await log_message(platform, app_env, place, "error", `stripe customer info retrieved error: ${err.message}`, "na");
        return new Response(JSON.stringify({ error: true, message: `stripe customer info retrieved error: ${err.message}` }), { status: 500 });
      }
      break;
    default:
      await log_message(platform, app_env, place, "error", `Unhandled webhook event type: ${event.type}`, "na");
      return new Response(`Unhandled webhook event type: ${event.type}`, { status: 400 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
