// Cloudflare D1 Database operations
// check the db schema in /db_schema/schema.sql
import parser from "ua-parser-js";

export async function db_get_user_info_by_email(platform, email) {
  const query =
    "SELECT uuid, nickname, organization, is_email_verified, password_hash FROM user_account WHERE email = ?1;";

  try {
    let { results } = await platform.env.DB.prepare(query).bind(email).all();
    // results: [{},{},...]
    if (results.length > 0) {
      // the email is registered
      const user_info = {
        uuid: results[0]["uuid"],
        nickname: results[0]["nickname"],
        organization: results[0]["organization"],
        is_email_verified: results[0]["is_email_verified"] == 1 ? true : false, // true or false
        password_hash: results[0]["password_hash"],
      };

      return {
        success: true,
        is_registered: true,
        user_info: user_info,
      };
    } else {
      // the email is not registered
      return {
        success: true,
        is_registered: false,
        user_info: null,
      };
    }
  } catch (err) {
    return {
      error: true,
      message: err.message,
    };
  }
}

export async function db_get_user_info_by_uuid(platform, uuid) {
  const query =
    "SELECT email, is_email_verified, nickname, organization FROM user_account WHERE uuid = ?1";

  try {
    let { results } = await platform.env.DB.prepare(query).bind(uuid).all();
    // results: [{},{},...]
    if (results.length > 0) {
      // the uuid is registered
      return {
        success: true,
        is_registered: true,
        is_email_verified: results[0]["is_email_verified"] == 1 ? true : false, // true or false
        email: results[0]["email"],
        nickname: results[0]["nickname"],
        organization: results[0]["organization"],
      };
    } else {
      // the uuid is not registered
      return {
        success: true,
        is_registered: false,
        is_email_verified: false,
      };
    }
  } catch (err) {
    return {
      error: true,
      message: err.message,
    };
  }
}

export async function db_get_info_for_login(platform, email) {
  // get user info and stripe customer info for login, join two tables
  const query ="\
    SELECT ua.uuid, ua.nickname, ua.organization, ua.is_email_verified, ua.password_hash, \
    sc.stripe_customer_id, sc.current_product_id, sc.current_period_end_at, sc.had_subscription_before \
    FROM user_account ua LEFT JOIN stripe_customers sc \
    ON ua.email=sc.email \
    WHERE ua.email = ?1;";

  try {
    let { results } = await platform.env.DB.prepare(query).bind(email).all();

    if (results.length > 0) {
      // the email is registered
      const user_info = {
        uuid: results[0]["uuid"],
        nickname: results[0]["nickname"],
        organization: results[0]["organization"],
        is_email_verified: results[0]["is_email_verified"] == 1 ? true : false,
        password_hash: results[0]["password_hash"],
        stripe_customer_id: results[0]["stripe_customer_id"],
        current_product_id: results[0]["current_product_id"],
        current_period_end_at: results[0]["current_period_end_at"],
        had_subscription_before: results[0]["had_subscription_before"],
      };

      return {
        success: true,
        is_registered: true,
        user_info: user_info,
      };
    } else {
      // the email is not registered
      return {
        success: true,
        is_registered: false,
        user_info: null,
      };
    }
  } catch (err) {
    return {
      error: true,
      message: err.message,
    };
  }
}

export async function db_get_magic_link_token_and_info_for_login(platform, login_token) {
  // get magic link token, user info, stripe customer info in one query, join three tables
  const query ="\
    SELECT ml.uuid, ua.email, ua.nickname, ua.organization, ua.is_email_verified, \
    sc.stripe_customer_id, sc.current_product_id, sc.current_period_end_at, sc.had_subscription_before \
    FROM magic_link_login ml \
    JOIN user_account ua \
    ON ml.uuid = ua.uuid \
    LEFT JOIN stripe_customers sc \
    ON ua.uuid = sc.uuid \
    WHERE ml.login_token = ?1;";
  // in some senerios (user never open /dashboard/billing page), stripe_customers table may not have the record for the user,
  // so we use LEFT JOIN for stripe_customers table

  try {
    let { results } = await platform.env.DB.prepare(query).bind(login_token).all();

    if (results.length > 0) {
      // the login_token is found in db
      const info = {
        uuid: results[0]["uuid"],
        email: results[0]["email"],
        nickname: results[0]["nickname"],
        organization: results[0]["organization"],
        is_email_verified: results[0]["is_email_verified"] == 1 ? true : false,
        stripe_customer_id: results[0]["stripe_customer_id"],
        current_product_id: results[0]["current_product_id"],
        current_period_end_at: results[0]["current_period_end_at"],
        had_subscription_before: results[0]["had_subscription_before"],
      };

      return {
        success: true,
        existed: true,
        info: info,
      };
    } else {
      // the login_token is not found in db
      return {
        success: true,
        existed: false,
      };
    }
  } catch (err) {
    return {
      error: true,
      message: err.message,
    };
  }
}

export async function db_insert_magic_link_token(platform, info) {
  // info = {login_token, uuid, email, requested_at, expire_at}
  // if already exists record for the uuid, replace it. uuid is unique
  const query =
    "REPLACE INTO magic_link_login (login_token, uuid, email, requested_at, expire_at) VALUES (?1, ?2, ?3, ?4, ?5);";

  try {
    let res = await platform.env.DB.prepare(query)
      .bind(info.login_token, info.uuid, info.email, info.requested_at, info.expire_at)
      .run();

    if (res.success) {
      return {
        success: true,
        message: "ok",
      };
    } else {
      return {
        error: true,
        message: "failed to db_insert_magic_link_token.",
      };
    }
  } catch (err) {
    return {
      error: true,
      message: err.message,
    };
  }
}

export async function db_delete_magic_link_token(platform, login_token) {
  const query = "DELETE FROM magic_link_login WHERE login_token = ?1;";
  try {
    let res = await platform.env.DB.prepare(query).bind(login_token).run();

    if (res.success) {
      return {
        success: true,
        message: "ok",
      };
    } else {
      return {
        error: true,
        message: "failed to db_delete_magic_link_token.",
      };
    }
  } catch (err) {
    return {
      error: true,
      message: err.message,
    };
  }
}

export async function db_update_profile(platform, user_info) {
  const current_time = Date.now();
  const query =
    "UPDATE user_account SET nickname = ?1, organization = ?2, updated_at = ?3 WHERE uuid = ?4;";

  try {
    let res = await platform.env.DB.prepare(query)
      .bind(
        user_info.nickname,
        user_info.organization,
        current_time,
        user_info.uuid
      )
      .run();

    if (res.success) {
      return {
        success: true,
        message: "ok",
      };
    } else {
      return {
        error: true,
        message: "failed to db_update_profile.",
      };
    }
  } catch (err) {
    return {
      error: true,
      message: err.message,
    };
  }
}

export async function db_update_login_sessions(platform, sessions_ids, update_info) {
  // update mutiple(>=1) login sessions db at once
  // sessions_ids = [session_id1, session_id2, ...] belong to same user, at least one
  // update_info = {nickname: "x", email: "x", organization: "x", stripe_customer_id: "x", current_product_id: "x", current_period_end_at: "x", had_subscription_before: "x"}, maybe one or more
  if (!Array.isArray(sessions_ids) || sessions_ids.length === 0) {
    return {
      error: true,
      message: "sessions_ids must be a non-empty array.",
    };
  }

  let query = "UPDATE login_session SET ";
  let bind_values = [];
  let bind_index = 1;

  for (const key in update_info) {
    query += key + " = ?" + bind_index + ", ";
    bind_values.push(update_info[key]);
    bind_index += 1;
  }

  query = query.slice(0, -2); // remove the last ', '
  query += " WHERE session_id IN (";

  sessions_ids.forEach((_, index) => {
    query += index === 0 ? "?" : ", ?";
    query += bind_index;
    bind_index += 1;
  });

  query += ");";
  bind_values = bind_values.concat(sessions_ids);

  try {
    let res = await platform.env.DB.prepare(query)
      .bind(...bind_values)
      .run();

    if (res.success) {
      return {
        success: true,
        message: "ok",
      };
    } else {
      return {
        error: true,
        message: "failed to db_update_login_sessions.",
      };
    }
  } catch (err) {
    return {
      error: true,
      message: err.message,
    };
  }
}

export async function db_get_activity_records_and_login_sessions(platform, uuid) {
  const current_time = Date.now();
  const query_activity_records = 
    "SELECT created_at, action_name, ip_address, country, ua_device, ua_os, ua_browser \
     FROM activity_record \
     WHERE uuid = ?1 \
     ORDER BY created_at DESC \
     LIMIT 10;"; // latest 10 records ordered by created time

  const query_login_sessions =
    "SELECT session_id, created_at, expire_at, ip_address, country, ua_device, ua_os, ua_browser \
     FROM login_session \
     WHERE uuid = ?1 AND expire_at > ?2 \
     ORDER BY created_at DESC;"; // latest record first

  try {
    let res = await platform.env.DB.batch([
      platform.env.DB.prepare(query_activity_records).bind(uuid),
      platform.env.DB.prepare(query_login_sessions).bind(uuid, current_time),
    ]);

    if (!res[0].success && !res[1].success) {
      return {
        error: true,
        message: "failed to db_get_activity_records_and_login_sessions.",
      };
    }

    const activities = [];
    const login_sessions = [];

    if (res[0].success) {
      for (let i = 0; i < res[0].results.length; i++) {
        const activity = {
          created_at: res[0].results[i]["created_at"],
          action_name: res[0].results[i]["action_name"],
          ip_address: res[0].results[i]["ip_address"],
          country: res[0].results[i]["country"],
          ua_device: res[0].results[i]["ua_device"],
          ua_os: res[0].results[i]["ua_os"],
          ua_browser: res[0].results[i]["ua_browser"],
        };
        activities.push(activity);
      }
    }

    if (res[1].success) {
      for (let i = 0; i < res[1].results.length; i++) {
        const session = {
          session_id: res[1].results[i]["session_id"],
          created_at: res[1].results[i]["created_at"],
          ip_address: res[1].results[i]["ip_address"],
          country: res[1].results[i]["country"],
          ua_device: res[1].results[i]["ua_device"],
          ua_os: res[1].results[i]["ua_os"],
          ua_browser: res[1].results[i]["ua_browser"],
        };
        login_sessions.push(session);
      }
    }

    return {
      success: true,
      activities: activities,
      login_sessions: login_sessions,
    };
  } catch (err) {
    return {
      error: true,
      message: err.message,
    };
  }
}

export async function db_insert_activity_record(platform, headers, action_name, uuid) {
  const ip_address = headers.get("cf-connecting-ip") || "undefined-ip";
  const ip_country = headers.get("cf-ipcountry") || "undefined-ipcountry";
  const ua_paser = parser(headers.get("user-agent"));
  const ua_device = ua_paser.device.vendor + "-" + ua_paser.device.model;
  const ua_os = ua_paser.os.name + "-" + ua_paser.os.version;
  const ua_browser = ua_paser.browser.name + "-" + ua_paser.browser.version;

  const current_time = Date.now();

  const query_insert_activity_record =
    "INSERT INTO activity_record (uuid, created_at, action_name, ip_address, country, ua_device, ua_os, ua_browser) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8);";

  try {
    let res = await platform.env.DB.prepare(query_insert_activity_record)
      .bind(
        uuid,
        current_time,
        action_name,
        ip_address,
        ip_country,
        ua_device,
        ua_os,
        ua_browser
      )
      .run();

    if (res.success) {
      return {
        success: true,
        message: "ok",
      };
    } else {
      return {
        error: true,
        message: "failed to db_insert_activity_record.",
      };
    }
  } catch (err) {
    return {
      error: true,
      message: err.message,
    };
  }
}

export async function db_insert_login_record_session(platform, headers, info, session_id) {
  // insert login_record and login_session to db in one transaction
  // info = {uuid, nickname, email, organization, stripe_customer_id, current_product_id, current_period_end_at, had_subscription_before, created_at, expire_at}
  const ip_address = headers.get("cf-connecting-ip") || "undefined-ip";
  const ip_country = headers.get("cf-ipcountry") || "undefined-ipcountry";
  const ua_paser = parser(headers.get("user-agent"));
  const ua_device = ua_paser.device.vendor + "-" + ua_paser.device.model;
  const ua_os = ua_paser.os.name + "-" + ua_paser.os.version;
  const ua_browser = ua_paser.browser.name + "-" + ua_paser.browser.version;
  const action_name = "Sign in";

  const query_insert_activity_record ="\
    INSERT INTO activity_record (uuid, created_at, action_name, ip_address, country, ua_device, ua_os, ua_browser) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8);";
  const query_insert_login_session ="\
    INSERT INTO login_session (session_id, uuid, email, nickname, organization, stripe_customer_id, current_product_id, current_period_end_at, had_subscription_before, created_at, expire_at, ip_address, country, ua_device, ua_os, ua_browser) \
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16);";

  try {
    let res = await platform.env.DB.batch([
      platform.env.DB.prepare(query_insert_activity_record).bind(
        info.uuid,
        info.created_at,
        action_name,
        ip_address,
        ip_country,
        ua_device,
        ua_os,
        ua_browser
      ),
      platform.env.DB.prepare(query_insert_login_session).bind(
        session_id,
        info.uuid,
        info.email,
        info.nickname,
        info.organization,
        info.stripe_customer_id,
        info.current_product_id,
        info.current_period_end_at,
        info.had_subscription_before,
        info.created_at,
        info.expire_at,
        ip_address,
        ip_country,
        ua_device,
        ua_os,
        ua_browser
      ),
    ]);
    // res: [{success: true, meta:{}, results:[]}, {success: true, meta:{}, results:[]}]
    if (res[0].success && res[1].success) {
      return {
        success: true,
        message: "ok",
      };
    } else {
      return {
        error: true,
        message: "failed to db_insert_login_record_session.",
      };
    }
  } catch (err) {
    return {
      error: true,
      message: err.message,
    };
  }
}

export async function db_get_all_login_sessions(platform, uuid) {
  const query = "\
    SELECT session_id, email, nickname, organization, stripe_customer_id, current_product_id, current_period_end_at, had_subscription_before, created_at, expire_at \
    FROM login_session WHERE uuid = ?1;";
  const current_time = Date.now();

  try {
    let { results } = await platform.env.DB.prepare(query).bind(uuid).all();

    if (results.length > 0) {
      // the uuid has login sessions
      const sessions_info = [];
      for (let i = 0; i < results.length; i++) {
        const session_info = {
          session_id: results[i]["session_id"],
          uuid: uuid,
          email: results[i]["email"],
          nickname: results[i]["nickname"],
          organization: results[i]["organization"],
          stripe_customer_id: results[i]["stripe_customer_id"],
          current_product_id: results[i]["current_product_id"],
          current_period_end_at: results[i]["current_period_end_at"],
          had_subscription_before: results[i]["had_subscription_before"],
          created_at: results[i]["created_at"],
          expire_at: results[i]["expire_at"],
        };
        if (session_info.expire_at > current_time) {
          // only return the valid (not expired) login sessions
          sessions_info.push(session_info);
        }
      }

      return {
        success: true,
        sessions_info: sessions_info,
        existed: true,
      };
    } else {
      // the uuid has no login sessions
      return {
        success: true,
        sessions_info: [],
        existed: false,
      };
    }
  } catch (err) {
    return {
      error: true,
      message: err.message,
    };
  }
}

export async function db_get_current_login_session(platform, session_id) {
  const query ="\
    SELECT uuid, email, nickname, organization, stripe_customer_id, current_product_id, current_period_end_at, had_subscription_before, created_at, expire_at \
    FROM login_session \
    WHERE session_id = ?1;";

  try {
    let { results } = await platform.env.DB.prepare(query).bind(session_id).all();

    if (results.length > 0) {
      // the session_id is found in db
      const info = {
        uuid: results[0]["uuid"],
        email: results[0]["email"],
        nickname: results[0]["nickname"],
        organization: results[0]["organization"],
        stripe_customer_id: results[0]["stripe_customer_id"],
        current_product: results[0]["current_product_id"],
        current_period_end_at: results[0]["current_period_end_at"],
        had_subscription_before: results[0]["had_subscription_before"],
        created_at: results[0]["created_at"],
        expire_at: results[0]["expire_at"],
      };

      return {
        success: true,
        existed: true,
        info: info,
      };
    } else {
      // the session_id is not found in db, not error
      return {
        success: true,
        existed: false,
      };
    }
  } catch (err) {
    return {
      error: true,
      message: err.message,
    };
  }
}

export async function db_delete_login_session(platform, session_id) {
  const query = "DELETE FROM login_session WHERE session_id = ?1;";

  try {
    let res = await platform.env.DB.prepare(query).bind(session_id).run();

    if (res.success) {
      return {
        success: true,
        message: "ok",
      };
    } else {
      return {
        error: true,
        message: "failed to db_delete_login_session.",
      };
    }
  } catch (err) {
    return {
      error: true,
      message: err.message,
    };
  }
}

export async function db_register_new_user(platform, headers, register_info) {
  const ip_address = headers.get("cf-connecting-ip") || "undefined-ip";
  const ip_country = headers.get("cf-ipcountry") || "undefined-ipcountry";
  const ua_paser = parser(headers.get("user-agent"));
  const ua_device = ua_paser.device.vendor + "-" + ua_paser.device.model;
  const ua_os = ua_paser.os.name + "-" + ua_paser.os.version;
  const ua_browser = ua_paser.browser.name + "-" + ua_paser.browser.version;

  const current_time = Date.now();

  const query_user_account =
    "INSERT INTO user_account (uuid, nickname, email, is_email_verified, password_hash, registered_at, updated_at) VALUES (?1, ?2, ?3, 0, ?4, ?5, ?6);";
  const query_register_record =
    "INSERT INTO register_record (uuid, email, registered_at, ip_address, country, ua_device, ua_os, ua_browser, referral_code) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9);";

  try {
    let res = await platform.env.DB.batch([
      platform.env.DB.prepare(query_user_account).bind(
        register_info.uuid,
        register_info.nickname,
        register_info.email,
        register_info.password_hash,
        current_time,
        current_time
      ),
      platform.env.DB.prepare(query_register_record).bind(
        register_info.uuid,
        register_info.email,
        current_time,
        ip_address,
        ip_country,
        ua_device,
        ua_os,
        ua_browser,
        register_info.referral_code
      ),
    ]);
    // res: [{success: true, meta:{}, results:[]}, {success: true, meta:{}, results:[]}]
    if (res[0].success && res[1].success) {
      // successfully insert new user to DB
      return {
        success: true,
        is_email_taken: false,
        message: "ok",
      };
    } else {
      return {
        error: true,
        is_email_taken: false,
        message: "failed to db_register_new_user.",
      };
    }
  } catch (err) {
    if (err.message.includes("UNIQUE constraint failed: user_account.email")) {
      // email is already registered
      return {
        error: true,
        is_email_taken: true,
        message: "email is already registered.",
      };
    }
    // other error
    return {
      error: true,
      is_email_taken: false,
      message: err.message,
    };
  }
}

export async function db_delete_user(platform, uuid) {
  const query = "DELETE FROM user_account WHERE uuid = ?1;";

  try {
    let res = await platform.env.DB.prepare(query).bind(uuid).run();
    
    if (res.success) {
      return {
        success: true,
        message: "ok",
      };
    } else {
      return {
        error: true,
        message: "failed to db_delete_user.",
      };
    }
  } catch (err) {
    return {
      error: true,
      message: err.message,
    };
  }
}

export async function db_set_uuid_verified(platform, uuid) {
  const current_time = Date.now();
  const query =
    "UPDATE user_account SET is_email_verified = 1, updated_at = ?1 WHERE uuid = ?2";

  try {
    let res = await platform.env.DB.prepare(query)
      .bind(current_time, uuid)
      .run();

    if (res.success) {
      // successfully update DB
      return {
        success: true,
        message: "ok",
      };
    } else {
      return {
        error: true,
        message: "failed to db_set_uuid_verified.",
      };
    }
  } catch (err) {
    return {
      error: true,
      message: err.message,
    };
  }
}

export async function db_insert_pwd_reset_info(platform, headers, pwd_reset_info) {
  // pwd_reset_info = {uuid, email, nickname, token, expire_at}
  const ip_address = headers.get("cf-connecting-ip") || "undefined-ip";
  const current_time = Date.now();

  const query =
    "INSERT INTO password_reset_token (uuid, token, email, nickname, requested_at, expire_at, ip_address) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT (uuid) DO UPDATE SET email = excluded.email, token = excluded.token, nickname = excluded.nickname, requested_at = excluded.requested_at, expire_at = excluded.expire_at, ip_address = excluded.ip_address;";

  try {
    let res = await platform.env.DB.prepare(query)
      .bind(
        pwd_reset_info.uuid,
        pwd_reset_info.token,
        pwd_reset_info.email,
        pwd_reset_info.nickname,
        current_time,
        pwd_reset_info.expire_at,
        ip_address
      )
      .run();

    if (res.success) {
      return {
        success: true,
        message: "ok",
      };
    } else {
      return {
        error: true,
        message: "failed to db_insert_pwd_reset_info.",
      };
    }
  } catch (err) {
    return {
      error: true,
      message: err.message,
    };
  }
}

export async function db_get_pwd_reset_info(platform, token) {
  const query =
    "SELECT email, uuid, nickname FROM password_reset_token WHERE token = ?1;";

  try {
    let { results } = await platform.env.DB.prepare(query).bind(token).all();

    if (results.length > 0) {
      // the reset token is found in db
      const user_info = {
        email: results[0]["email"],
        uuid: results[0]["uuid"],
        nickname: results[0]["nickname"],
      };

      return {
        success: true,
        existed: true,
        user_info: user_info,
      };
    } else {
      // the reset token is not found in db
      return {
        success: true,
        existed: false,
      };
    }
  } catch (err) {
    return {
      error: true,
      message: err.message,
    };
  }
}

export async function db_delete_pwd_reset_info(platform, email) {
  const query = "DELETE FROM password_reset_token WHERE email = ?1;";

  try {
    let res = await platform.env.DB.prepare(query).bind(email).run();
    if (res.success) {
      return {
        success: true,
        message: "ok",
      };
    } else {
      return {
        error: true,
        message: "failed to db_delete_pwd_reset_info.",
      };
    }
  } catch (err) {
    return {
      error: true,
      message: err.message,
    };
  }
}

export async function db_update_password(platform, headers, uuid, password_hash) {
  const ip_address = headers.get("cf-connecting-ip") || "undefined-ip";
  const ip_country = headers.get("cf-ipcountry") || "undefined-ipcountry";
  const ua_paser = parser(headers.get("user-agent"));
  const ua_device = ua_paser.device.vendor + "-" + ua_paser.device.model;
  const ua_os = ua_paser.os.name + "-" + ua_paser.os.version;
  const ua_browser = ua_paser.browser.name + "-" + ua_paser.browser.version;
  const current_time = Date.now();

  const query_update_password =
    "UPDATE user_account SET password_hash = ?1, updated_at = ?2 WHERE uuid = ?3;";
  const query_insert_activity_record =
    "INSERT INTO activity_record (uuid, created_at, action_name, ip_address, country, ua_device, ua_os, ua_browser) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8);";

  try {
    let res = await platform.env.DB.batch([
      platform.env.DB.prepare(query_update_password)
        .bind(password_hash, current_time, uuid),
      platform.env.DB.prepare(query_insert_activity_record)
        .bind(uuid, current_time, "Change password", ip_address, ip_country, ua_device, ua_os, ua_browser),
    ]);

    if (res[0].success) { // only care the first result (update password)
      return {
        success: true,
        message: "ok",
      };
    } else {
      return {
        error: true,
        message: "failed to db_update_password.",
      };
    }
  } catch (err) {
    return {
      error: true,
      message: err.message,
    };
  }
}

export async function db_get_stripe_customer(platform, uuid) {
  const query =
    "SELECT stripe_customer_id, current_product_id, current_period_end_at, had_subscription_before FROM stripe_customers WHERE uuid = ?1";

  try {
    let { results } = await platform.env.DB.prepare(query).bind(uuid).all();
    // results: [{},{},...]
    if (results.length == 0) {
      // the uuid does not have stripe customer info
      return {
        success: true,
        is_existed: false,
      };
    } else {
      // the uuid has stripe customer info
      return {
        success: true,
        is_existed: true,
        stripe_customer_id: results[0]["stripe_customer_id"],
        current_product_id: results[0]["current_product_id"],
        current_period_end_at: results[0]["current_period_end_at"],
        had_subscription_before: results[0]["had_subscription_before"],
      };
    }
  } catch (err) {
    return {
      error: true,
      message: err.message,
    };
  }
}

export async function db_create_stripe_customer(platform, customer_info) {
  const { uuid, email, stripe_customer_id } = customer_info;
  const current_time = Date.now();

  const query =
    "INSERT INTO stripe_customers (uuid, email, stripe_customer_id, updated_at) VALUES (?1, ?2, ?3, ?4);";

  try {
    let res = await platform.env.DB.prepare(query)
      .bind(uuid, email, stripe_customer_id, current_time)
      .run();
    if (res.success) {
      return {
        success: true,
        message: "ok",
      };
    } else {
      return {
        error: true,
        message: "failed to db_create_stripe_customer.",
      };
    }
  } catch (err) {
    return {
      error: true,
      message: err.message,
    };
  }
}

export async function db_update_stripe_customer(platform, sub_info) {
  const { uuid, stripe_customer_id, current_product_id, current_period_end_at } = sub_info;
  const current_time = Date.now();

  const query =`\
    UPDATE stripe_customers \
    SET current_product_id = ?1, \
        current_period_end_at = ?2, \
        had_subscription_before = 1, \
        updated_at = ?3 \
    WHERE stripe_customer_id = ?4 AND uuid = ?5;`;
  
  try {
    let res = await platform.env.DB.prepare(query)
      .bind(current_product_id, current_period_end_at, current_time, stripe_customer_id, uuid)
      .run();

    if (res.success && res.meta && res.meta.changes > 0) {
      return {
        success: true,
        message: "ok",
      };
    } else if (res.success && res.meta && res.meta.changes === 0) {
      return {
        error: true,
        message: "no row updated, no matched customer found in db.",
      };
    } else {
      return {
        error: true,
        message: "failed to db_update_stripe_customer, unknown error.",
      };
    }
  } catch (err) {
    return {
      error: true,
      message: err.message,
    };
  }
}

export async function db_insert_contact_request(platform, headers, contact_info) {
  const { contact_name, email, phone, company, message } = contact_info;
  const ip_address = headers.get("cf-connecting-ip") || "undefined-ip";
  const ip_country = headers.get("cf-ipcountry") || "undefined-ipcountry";
  const current_time = Date.now();

  const query =
    "INSERT INTO contact_requests (contact_name, email, phone, company, contact_message, ip_address, country, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8);";

  try {
    let res = await platform.env.DB.prepare(query)
      .bind(
        contact_name,
        email,
        phone,
        company,
        message,
        ip_address,
        ip_country,
        current_time
      )
      .run();

    if (res.success) {
      return {
        success: true,
        message: "ok",
      };
    } else {
      return {
        error: true,
        message: "failed to db_insert_contact_request.",
      };
    }
  } catch (err) {
    return {
      error: true,
      message: err.message,
    };
  }
}
