import { redirect } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { log_message } from "$lib/server/log";
import { db_get_activity_records_and_login_sessions } from "$lib/server/database";
import countries from 'i18n-iso-countries';
import { country_locale } from "./country_locale";

countries.registerLocale(country_locale);
const place = "/dashboard/sessions/+server.js";
const app_env = dev ? "development" : "production";

function format_ip(ip_address) {
  if (dev) {
    return "127.0.0.1";
  }

  if (ip_address == "undefined-ip") {
    return "Unknown IP";
  }

  // 2401:7400:401c:517b:75e4:84a:ca9a:1375	=> 2401:▒▒▒▒▒▒:1375
  if (ip_address.includes(":")) {
    const ip_parts = ip_address.split(":");
    return ip_parts[0] + ":▒▒▒▒▒▒:" + ip_parts[ip_parts.length - 1];
  }

  return ip_address;
}

function format_country(country) {
  if (dev) {
    return "Local country";
  }

  if (country == "undefined-ipcountry") {
    return "Unknown country";
  }

  return countries.getName(country, 'en', { select: 'alias' }) || 'Unknown country';
}

function format_browser(ua_browser) {
 // ua_browser: 'Chrome-126.0.0.0' => 'Chrome Browser'
 // ua_browser: 'undefined-undefined' => 'Unknown Device'
  if (ua_browser == "undefined-undefined") {
    return "Unknown Device";
  }

  return ua_browser.split("-")[0] + " Browser";
}

function format_device(ua_os, ua_browser) {
  // ua_os: 'Windows-10' ua_browser: 'Chrome-126.0.0.0' => 'Chrome - Windows'
  // ua_os: 'undefined-undefined' ua_browser: 'undefined-undefined' => 'Unknown Device'
  // ua_os: 'undefined-undefined' ua_browser: 'Chrome-126.0.0.0" => 'Chrome Browser'
  // ua_os: 'Windows-10' ua_browser: 'undefined-undefined' => 'Windows OS'
  if (ua_os == "undefined-undefined" && ua_browser == "undefined-undefined") {
    return "Unknown Device";
  }
  if (ua_os == "undefined-undefined") {
    return format_browser(ua_browser);
  }
  if (ua_browser == "undefined-undefined") {
    return ua_os.split("-")[0] + " OS";
  }

  return ua_browser.split("-")[0] + " - " + ua_os.split("-")[0];
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ platform, locals, url }) {
  await log_message(platform, app_env, place, "info", "GET task start.");
  if (!locals.user || !locals.session) {
    redirect(303, "/sign-in");
  }

  const res = await db_get_activity_records_and_login_sessions(platform, locals.user.uuid);

  if (res.error) {
    await log_message(platform, app_env, place, "error", "db_get_activity_records_and_login_sessions: " + res.message, locals.user.email);
    return new Response(JSON.stringify({ 
      error: true, 
      error_message: "Internal server error. Please try again later.", 
    }), { status: 500 });
  }
  log_message(platform, app_env, place, "info", "db_get_activity_records_and_login_sessions success.");

  let { login_sessions, activities } = res;
  
  login_sessions = login_sessions.map((session) => {
    return {
      is_current_session: session.session_id == locals.session.id ? true : false,
      created_at: session.created_at,
      ua_device: format_device(session.ua_os, session.ua_browser),
      ip_address: format_ip(session.ip_address),
      country: format_country(session.country),
    };
  });

  activities = activities.map((activity) => {
    return {
      action_name: activity.action_name,
      created_at: activity.created_at,
      ua_device: format_device(activity.ua_os, activity.ua_browser),
      ip_address: format_ip(activity.ip_address),
      country: format_country(activity.country),
    };
  });

  return new Response(
    JSON.stringify({ 
      login_sessions: login_sessions,
      activities: activities, 
    }), { status: 200 });
};
