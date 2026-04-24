export async function readErrorResponseMessage(response) {
  const rawBody = await response.text();

  if (!rawBody) {
    return "";
  }

  try {
    const payload = JSON.parse(rawBody);
    return payload?.detail || payload?.message || rawBody;
  } catch {
    return rawBody;
  }
}
