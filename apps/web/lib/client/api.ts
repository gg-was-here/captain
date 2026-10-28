/** Shown when a request never got an answer: offline, or the connection dropped. */
export const OFFLINE_MESSAGE = "Couldn't reach Bambii. Check your connection and try again.";

/**
 * What a failed request means for the user. `failure` says what didn't happen ("Couldn't save this
 * chat."). The server's own message wins when it sent one (API routes always do); unexpected failures
 * carry a reference so support can find the log line.
 */
export function describeFailure(status: number, serverMessage: string | undefined, reference: string | undefined, failure: string): string {
  if (status === 401) return "You've been signed out. Reload the page to sign in again.";
  if (status === 413) return `${failure} It's too large to send.`;
  const message =
    serverMessage?.trim() ||
    (status === 429 ? "Too many requests in a short time. Wait a minute and try again." : `${failure} Please try again.`);
  return status >= 500 && reference ? `${message} (Reference: ${reference})` : message;
}

/** A failed call to Bambii's API, with a message that can be shown as is. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** fetch() for Bambii's API: resolves on a 2xx response, otherwise throws an `ApiError` (see `describeFailure`). */
export async function api(input: string, init: RequestInit | undefined, failure: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(OFFLINE_MESSAGE);
  }
  if (response.ok) return response;
  const body = (await response.json().catch(() => undefined)) as { error?: unknown; reference?: unknown } | undefined;
  const reference = typeof body?.reference === "string" ? body.reference : (response.headers.get("x-vercel-id") ?? undefined);
  throw new ApiError(
    describeFailure(response.status, typeof body?.error === "string" ? body.error : undefined, reference, failure),
    response.status,
  );
}

/** The message for an error caught around `api()`. */
export function errorText(error: unknown, failure: string): string {
  return error instanceof ApiError ? error.message : failure;
}
