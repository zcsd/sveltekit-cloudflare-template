// log function for debugging
import { APP_DOMAIN, ENABLE_ERROR_LOGGING } from "$config";

export async function log_message(platform, app_env, place, type, message, user = "na") {
  if (app_env === "development") {
    // in local development mode, all logs will be printed to the console
    if (type === "info") {
      console.info(`[${place}] ${message}`);
    } else if (type === "error") {
      console.error(`[${place}] ${message}`);
    }
  } else if (app_env === "production" && ENABLE_ERROR_LOGGING) {
    // in production mode, only error logs will be sent to Lark group chat and stored in R2
    // if you want to off the error logging, set `ENABLE_ERROR_LOGGING` to `false` in `src/config.js`
    if (type === "error") {
      const log = {
        domain: APP_DOMAIN,
        place: place,
        error: message,
        user: user,
        timestamp: Date.now(),
      };
      
      // to send notification to Lark group chat, you need to set `LARK_BOT_URL` environment variable in Cloudflare dashboard
      await send_error_to_lark(platform, log);
      // to store the error logs in R2, you need to deploy a Cloudflare Worker for queues consumer,
      // and bind the queue in Cloudflare dashboard
      await platform.env.ERROR_QUEUE.send(log);
    }
  }
}

async function send_error_to_lark(platform, log) {
  // check https://open.larksuite.com/document/client-docs/bot-v3/add-custom-bot for more details
  const date = new Date(log.timestamp);
  const time_readable = date.toISOString() + " UTC";

  const content =
    log.domain +
    "/" +
    log.place +
    "\n" +
    log.user +
    "\n\n" +
    log.error +
    "\n\n" +
    time_readable +
    "\n\n";

  const message = {
    msg_type: "post",
    content: {
      post: {
        en_us: {
          title: "Error Alert",
          content: [
            [
              {
                tag: "text",
                text: content,
              },
              {
                tag: "a",
                text: "Go to Cloudflare now.",
                href: "https://dash.cloudflare.com/",
              },
            ],
          ],
        },
      },
    },
  };

  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  };

  const response = await fetch(platform.env.LARK_BOT_URL, options);
  if (response.status === 200) {
    return { success: true };
  } else {
    return { error: true };
  }
}
