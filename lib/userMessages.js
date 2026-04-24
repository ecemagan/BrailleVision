function normalizeMessage(error) {
  return (error?.message || error?.detail || "").toLowerCase();
}

export function isInvalidRefreshTokenError(error) {
  const message = normalizeMessage(error);

  return message.includes("invalid refresh token") || message.includes("refresh token not found");
}

export function getFriendlyAuthMessage(error, fallback = "Authentication failed.") {
  const message = normalizeMessage(error);

  if (!message) {
    return fallback;
  }

  if (message.includes("invalid login credentials")) {
    return "We could not match that email and password. Double-check both and try again.";
  }

  if (message.includes("email not confirmed")) {
    return "Your account still needs email confirmation. Open the confirmation email, then try logging in again.";
  }

  if (message.includes("user already registered")) {
    return "That email is already registered. Try logging in instead.";
  }

  if (message.includes("password should be at least")) {
    return "Use a password with at least 6 characters.";
  }

  if (message.includes("unable to validate email address")) {
    return "Enter a valid email address before continuing.";
  }

  if (message.includes("rate limit")) {
    return "Too many attempts were made in a short time. Wait a moment, then try again.";
  }

  if (isInvalidRefreshTokenError(error)) {
    return "Your saved session expired or was revoked. Sign in again to continue.";
  }

  return fallback;
}

export function getFriendlyDocumentMessage(error, fallback = "The document action could not be completed.") {
  const message = normalizeMessage(error);

  if (!message) {
    return fallback;
  }

  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "Your session can see the page, but Supabase is not allowing this document action yet. Re-run the SQL policies and try again.";
  }

  if (message.includes("failed to fetch") || message.includes("network")) {
    return "The request could not reach the local BrailleVision backend. Make sure the web app and backend are both running, then try again.";
  }

  if (message.includes("selectable text")) {
    return "This PDF looks like scanned pages instead of selectable text. Upload a text-based PDF or use the camera/image OCR option.";
  }

  if (message.includes("no readable text")) {
    return "No readable text was detected in that image. Try a sharper photo with higher contrast.";
  }

  if (message.includes("clipboard")) {
    return "Clipboard access is blocked in this browser tab. Try again after focusing the page.";
  }

  return fallback;
}
