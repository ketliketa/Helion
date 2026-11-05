export async function api(
  path: string,
  body?: Record<string, unknown>,
  csrf?: string,
) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body
      ? {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "Kërkesa dështoi.");
  return value;
}
