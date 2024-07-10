import { dev } from "$app/environment";
import { log_message } from "$lib/server/log";
import {
  db_get_stripe_customer,
  db_get_user_info_by_uuid,
  db_create_stripe_customer,
} from "$lib/server/database";

const place = "/dashboard/billing/subscription_helpers";
const app_env = dev ? "development" : "production";

/* 
  1. fetch stripe customer from db if it exists
  2. if it does not exist, create a new stripe customer and insert it into db
*/
export async function get_or_create_stripe_customer(platform, uuid, stripe) {
  const res_stripe_customer = await db_get_stripe_customer(platform, uuid);
  if (res_stripe_customer.error) {
    return {
      error: true,
      message: "db_get_stripe_customer: " + res_stripe_customer.message,
    };
  }
  if (res_stripe_customer.is_existed) {
    log_message(platform, app_env, place, "info", "the stripe customer exists in db.");
    return {
      success: true,
      new_customer: false, // indicates that the stripe customer already existed in db
      stripe_customer_id: res_stripe_customer.stripe_customer_id,
      current_product_id: res_stripe_customer.current_product_id,
      current_period_end_at: res_stripe_customer.current_period_end_at,
      had_subscription_before: res_stripe_customer.had_subscription_before,
    };
  }
  log_message(platform, app_env, place, "info", "the stripe customer does not exist in db, soon creating a new one.");
  // actually, user info can be read from the locals, but we fetch it from db for safety and consistency
  const res_user_info = await db_get_user_info_by_uuid(platform, uuid); 
  if (res_user_info.error) {
    return {
      error: true,
      message: "db_get_user_info_by_uuid: " + res_user_info.message,
    };
  }
  log_message(platform, app_env, place, "info", "the user info was fetched from db successfully, ready to create customer...");

  // create a new stripe customer
  let stripe_customer;
  try {
    stripe_customer = await stripe.customers.create({
      email: res_user_info.email,
      name: res_user_info.nickname,
      metadata: {
        uuid: uuid,
        organization: res_user_info.organization,
        is_production: !dev ? "1" : "0",   //1 for production, 0 for development testing
      },
    });
  } catch (err) {
    return {
      error: true,
      message: "stripe.customers.create: " + err.message,
    };
  }

  if (!stripe_customer.id) {
    return {
      error: true,
      message: "unknown stripe user creation error occurred (stripe.customers.create).",
    };
  }

  log_message(platform, app_env, place, "info", "new stripe customer created in stripe successfully.");

  // insert stripe customer into db
  const customer_info = {
    uuid: uuid,
    email: res_user_info.email,
    stripe_customer_id: stripe_customer.id,
  };
  const res_create_stripe_customer = await db_create_stripe_customer(platform, customer_info);

  if (res_create_stripe_customer.error) {
    return {
      error: true,
      message: "db_create_stripe_customer: " + res_create_stripe_customer.message,
    };
  }
  log_message(platform, app_env, place, "info", "the stripe customer info was inserted into db successfully.");

  return {
    success: true,
    new_customer: true,
    stripe_customer_id: stripe_customer.id,
  };
}
