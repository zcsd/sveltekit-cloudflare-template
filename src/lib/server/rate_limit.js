// rate limiting
// Cloudflare KV is used for rate limiting, it's not consistent for all edge servers (within 60s).
// We can accept the inconsistency for the rate limiting, roughly consistent is enough.
import { dev } from "$app/environment";
import { log_message } from "$lib/server/log";

const app_env = dev ? "development" : "production";

function get_config(place, ip, user) {
  switch (place) {
    case "sign-up":
      return {
        ip: { key: `${place}:ip:${ip}`, max: 10, ttl: 24 * 60 * 60 }, // 24 hour, max 10 sign-up requests for each ip
      };
    case "sign-in":
      return {
        ip: { key: `${place}:ip:${ip}`, max: 10, ttl: 1 * 60 * 60 }, // 1 hour, max 10 login attempts(failure) for each ip
        user: { key: `${place}:user:${user}`, max: 5, ttl: 24 * 60 * 60 }, // 1 day, max 5 login attempts(failure) for each user
      };
    case "magic-link":
      return {
        ip: { key: `${place}:ip:${ip}`, max: 10, ttl: 1 * 60 * 60 }, // 1 hour, max 10 requests for each ip
      };
    case "verify-email":
      return {
        ip: { key: `${place}:ip:${ip}`, max: 10, ttl: 1 * 60 * 60 }, // 1 hour, max 10 requests for each ip
      };
    case "forgot-password":
      return {
        ip: { key: `${place}:ip:${ip}`, max: 10, ttl: 1 * 60 * 60 }, // 1 hour, max 10 requests for each ip
        user: { key: `${place}:user:${user}`, max: 5, ttl: 24 * 60 * 60 }, // 1 day, max 5 requests for each user
      };
    case "new-password":
      return {
        ip: { key: `${place}:ip:${ip}`, max: 10, ttl: 1 * 60 * 60 }, // 1 hour, max 10 requests for each ip
      };
    default:
      return {};
  }
}

// for sign-up, forgot-password
async function update_rate_limit(platform, place, limit_type, ip, user, res, count, key, ttl) {
  const value = {
    count: count + 1,
    expire: res ? res.expire : Math.floor(Date.now() / 1000) + ttl,
  };
  const remaining_ttl = res
    ? value.expire - Math.floor(Date.now() / 1000)
    : ttl;

  if (remaining_ttl > 10) {
    // Skip update if remaining TTL is too short
    await platform.env.RATE_LIMIT.put(key, JSON.stringify(value), {expirationTtl: remaining_ttl});
    log_message(platform, app_env, place, "info", `KV rate limit updated by ${limit_type}: ${ip}, ${user}, count: ${value.count}`);
  }
}

// for sign-up, forgot-password
export async function check_rate_limit(platform, place, ip, user) {
  const config = get_config(place, ip, user);

  try {
    for (let limit_type in config) {
      // limit_type: ip, user
      const { key, max, ttl } = config[limit_type];
      const res = await platform.env.RATE_LIMIT.get(key, { type: "json" });
      const count = res ? res.count : 0;

      if (count >= max) {
        await log_message(platform, app_env, place, "error", `rate limit exceeded by ${limit_type}: ${ip}, ${user}`, user);
        return false;
      }

      await update_rate_limit(platform, place, limit_type, ip, user, res, count, key, ttl);
    }
  } catch (err) {
    await log_message(platform, app_env, place, "error", `check_rate_limit error: ${err}, ${ip}, ${user}`, user);
    return true; // allow the request in case of error
  }
  return true;
}

// for sign-in, verify-email, new-password
export async function record_failure_attempt(platform, place, ip, user) {
  const config = get_config(place, ip, user);

  try {
    for (let limit_type in config) {
      const { key, max, ttl } = config[limit_type];
      if (key.includes("na")) {
        continue;
      }

      const res = await platform.env.RATE_LIMIT.get(key, { type: "json" });
      const count = res === null ? 0 : res.count;

      if (count === 0) {
        const value = { count: 1, expire: Math.floor(Date.now() / 1000) + ttl };
        await platform.env.RATE_LIMIT.put(key, JSON.stringify(value), {expirationTtl: ttl});
        log_message(platform, app_env, place, "info", `first KV put rate limit by ${limit_type}: ${ip}, ${user}`);
      } else {
        const remaining_ttl = res.expire - Math.floor(Date.now() / 1000);
        if (remaining_ttl > 10) {
          const value = { count: count + 1, expire: res.expire };
          await platform.env.RATE_LIMIT.put(key, JSON.stringify(value), {expirationTtl: remaining_ttl});
          log_message(platform, app_env, place, "info", `update KV put rate limit by ${limit_type}: ${ip}, ${user}`);
        }
      }
    }
  } catch (err) {
    await log_message(platform, app_env, place, "error", `record_failure_attempt error: ${err}, ${ip}, ${user}`, user);
  }
}

// for sign-in, verify-email, new-password
export async function check_failure_attempt(platform, place, ip, user) {
  const config = get_config(place, ip, user);

  try {
    for (let limit_type in config) {
      const { key, max, ttl } = config[limit_type];
      if (key.includes("na")) {
        continue;
      }

      const res = await platform.env.RATE_LIMIT.get(key, { type: "json" });
      const count = res === null ? 0 : res.count;

      if (count >= max) {
        await log_message(platform, app_env, place, "error", `rate limit exceeded by ${limit_type}: ${ip}, ${user}`, user);
        return false;
      }
    }
  } catch (err) {
    await log_message(platform, app_env, place, "error", `check_failure_attempt error: ${err}, ${ip}, ${user}`, user);
    return true; // allow the request in case of error
  }

  return true;
}
