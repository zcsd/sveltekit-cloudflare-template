// manage login sessions in KV and db
import { dev } from "$app/environment";
import { log_message } from "$lib/server/log";
import {
  db_insert_login_record_session,
  db_get_current_login_session,
  db_delete_login_session,
  db_update_login_sessions,
  db_get_all_login_sessions
} from "$lib/server/database";
import { get_uuid_from_jwt } from "$lib/tools/jwt";

const place = "session";
const app_env = dev ? "development" : "production";

/* update all live (not expired) login_sessions for the user */
export async function update_login_sessions(platform, uuid, update_info) {
  // get all live login_sessions by uuid from db
  const res_all_login_sessions = await db_get_all_login_sessions(platform, uuid);

  if (res_all_login_sessions.error) {
    return {
      error: true,
      message: "db_get_all_login_sessions: " + res_all_login_sessions.message,
    };
  }
  if (!res_all_login_sessions.existed) { 
    return {
      error: true,
      message: "no login session found in db.",
    };
  }

  const sessions_info = res_all_login_sessions.sessions_info;

  const session_info = sessions_info[0]; // get the first session info, all same except session_id
  let sessions_ids = [];

  for (let i = 0; i < sessions_info.length; i++) {
    sessions_ids.push(sessions_info[i].session_id);
  }

  // update_info = {nickname: "x", email: "x", organization: "x", stripe_customer_id: "x", current_product_id: "x", current_period_end_at: "x", had_subscription_before: "x"} maybe one or more
  // session_info = {session_id: "x", uuid: "x", nickname: "x", email: "x", organization: "x", stripe_customer_id: "x", current_product_id: "x", current_period_end_at: "x", had_subscription_before: "x", created_at: "x", expire_at: "x"}
  // update login_session in db
  const res_update_db = await db_update_login_sessions(platform, sessions_ids, update_info);
  if (res_update_db.error) {
    return {
      error: true,
      message: "db_update_login_sessions: " + res_update_db.message,
    };
  } else {
    log_message(platform, app_env, place, "info", `db_update_login_sessions success, ${sessions_ids.length} sessions updated.`);
  }

  // update login_session in KV
  const new_session_info = { ...session_info, ...update_info }; // update session_info
  const remaining_ttl = Math.floor((session_info.expire_at - Date.now()) / 1000);
  try {
    for (let i = 0; i < sessions_ids.length; i++) {
      // update KV one by one
      // Cloudflare does not support KV bulk writes from within a Worker.
      await platform.env.LOGIN_SESSION_CACHE.put(
        sessions_ids[i],
        JSON.stringify(new_session_info),
        { expirationTtl: remaining_ttl }
      );
    }
    log_message(platform, app_env, place, "info", `kv update LOGIN_SESSION_CACHE success, ${sessions_ids.length} sessions updated.`);
  } catch (err) {
    await log_message(platform, app_env, place, "error", "kv update LOGIN_SESSION_CACHE error: " + err.message, session_info.email);
    // not critical error, not return error, just log it and continue
  }

  return {
    success: true,
    message: "ok",
  };
}

export async function write_login_session(platform, headers, session_info, session_id, ttl) {
  // insert login_record and login_session to db in one transaction
  const res_insert_login = await db_insert_login_record_session(platform, headers, session_info, session_id);
  if (res_insert_login.error) {
    return {
      error: true,
      message: "db_insert_login_record_session: " + res_insert_login.message,
    };
  }
  log_message(platform, app_env, place, "info", "db_insert_login_record_session (record & session) success.");

  // write login_session to KV
  try {
    await platform.env.LOGIN_SESSION_CACHE.put(
      session_id,
      JSON.stringify(session_info),
      { expirationTtl: ttl }
    );
    log_message(platform, app_env, place, "info", "kv write LOGIN_SESSION_CACHE success.");
  } catch (err) {
    await log_message(platform, app_env, place, "error", "kv write LOGIN_SESSION_CACHE error: " + err.message, session_info.email);
    // not critical error, not return error, just log it and continue
  }

  return {
    success: true,
    message: "ok",
  };
}

export async function delete_login_session(platform, session_id) {
  let db_success = false;
  let kv_success = false;
  const uuid = get_uuid_from_jwt(session_id);
  // delete from db first
  try {
    const db_res = await db_delete_login_session(platform, session_id);
    if (db_res.success) {
      log_message(platform, app_env, place, "info", "db_delete_login_session success.");
      db_success = true;
    } else {
      await log_message(platform, app_env, place, "error", "db_delete_login_session: " + db_res.message, uuid);
    }
  } catch (err) {
    await log_message(platform, app_env, place, "error", "db_delete_login_session: " + err.message, uuid);
  }
  // delete from KV
  try {
    await platform.env.LOGIN_SESSION_CACHE.delete(session_id);
    log_message(platform, app_env, place, "info", "kv LOGIN_SESSION_CACHE delete success.");
    kv_success = true;
  } catch (err) {
    await log_message(platform, app_env, place, "error", "kv LOGIN_SESSION_CACHE delete error: " + err.message, uuid);
  }

  return {
    ...(db_success && kv_success ? { success: true } : { error: true }),
  };
}

export async function get_login_session(platform, session_id) {
  // cache from KV first
  try {
    const kv_res = await platform.env.LOGIN_SESSION_CACHE.get(
      session_id,
      { type: "json" },
      { cacheTtl: 3600 }
    ); // cache 1 hour
    // kv_res = {uuid: "x", nickname: "x", email: "x", organization: "x", stripe_customer_id: "x", current_product_id: "x", current_period_end_at: "x", had_subscription_before: "x", created_at: "x", expire_at: "x"}
    if (kv_res !== null) {
      log_message(platform, app_env, place, "info", "kv get LOGIN_SESSION_CACHE success.");
      return {
        existed: true,
        info: kv_res,
      };
    } else {
      log_message(platform, app_env, place, "info", "kv get LOGIN_SESSION_CACHE null, continue to check db.");
    }
  } catch (e) {
    const uuid = get_uuid_from_jwt(session_id);
    await log_message(platform, app_env, place, "error", "kv get LOGIN_SESSION_CACHE error: " + e.message, uuid);
  }
  // if no cache on kv, then get from db
  try {
    const db_res = await db_get_current_login_session(platform, session_id);
    // db_res.info = {uuid: "xxxx", nickname: "xxxx", email: "xxxx", created_at: "xxxx", expire_at: "xxxx"}
    if (db_res.success && db_res.existed) {
      log_message(platform, app_env, place, "info", "db_get_current_login_session success.");
      return {
        existed: true,
        info: db_res.info,
      };
    } else {
      log_message(platform, app_env, place, "info", "db_get_current_login_session found null or error happened.");
    }
  } catch (err) {
    const uuid = get_uuid_from_jwt(session_id);
    await log_message(platform, app_env, place, "error", "db_get_current_login_session: " + err.message, uuid);
  }

  return {
    existed: false,
    info: null,
  };
}
