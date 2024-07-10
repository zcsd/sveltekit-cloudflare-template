// validate the token from the turnstile challenge.

export async function validate_turnstile_token(token, secret) {
  try {
    if (!token) {
      return {
        error: true,
        message: "Turnstile token is missing.",
      };
    }

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          response: token,
          secret: secret,
        }),
      }
    );

    const outcome = await response.json();
    return {
      ...(outcome.success
        ? { success: true, message: "ok" }
        : {
            error: true,
            message: outcome["error-codes"]?.[0] || "Unknown error",
          }),
      //message: outcome['error-codes']?.length ? outcome['error-codes'][0] : null,
    };
  } catch (err) {
    return {
      error: true,
      message: "Unknown or Cloudflare error.",
    };
  }
}
