// check if jwt token is valid in basic format
import jwt from "@tsndr/cloudflare-worker-jwt";

export function is_jwt_format_valid(token) {
  if (!token || token == "") {
    return false;
  }
  // simple check if token is in format of "header.payload.signature"
  const jwt_parts = token.split(".");
  if (jwt_parts.length != 3) {
    return false;
  }
  // min total length is 36
  if (token.length < 36) {
    return false;
  }

  const base64_regex = /^[A-Za-z0-9_-]+$/;
  if (
    !base64_regex.test(jwt_parts[0]) ||
    !base64_regex.test(jwt_parts[1]) ||
    !base64_regex.test(jwt_parts[2])
  ) {
    return false;
  }

  return true;
}

export function get_uuid_from_jwt(token) {
  if (!is_jwt_format_valid(token)) {
    return "na";
  }

  const { payload } = jwt.decode(token);
  if (!payload || !payload.uuid) {
    return "na";
  }
  return payload.uuid;
}
