/** HTTP for the Slack and Gmail clients: timeouts, retries, and errors that say which service failed. */

/** The sign-in for a connector expired or was revoked; the user has to connect it again. */
export class ConnectorAuthError extends Error {
  constructor(readonly connector: string) {
    super(`${connector} authorization expired or was revoked`);
  }
}

/**
 * A Slack or Google API failed or couldn't be reached. `status` is the HTTP status to answer with: 503
 * when trying again later may work (rate limits, outages), 504 for timeouts, 502 otherwise.
 */
export class UpstreamError extends Error {
  constructor(
    readonly service: string,
    readonly status: 502 | 503 | 504,
    message: string,
    /** Seconds the service asked us to wait, when it said. */
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 15_000;
const RETRIES = 2;
const MAX_WAIT_S = 5;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * fetch that gives up after 15 s, and retries rate limits, server errors and dropped connections twice,
 * waiting as long as the service's Retry-After asks (up to 5 s). The last response is returned as is.
 */
export async function fetchApi(service: string, url: string, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      if (!timedOut && attempt < RETRIES) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      throw new UpstreamError(service, timedOut ? 504 : 503, timedOut ? `${service} didn't answer in time.` : `Couldn't reach ${service}.`);
    }
    if ((response.status === 429 || response.status >= 500) && attempt < RETRIES) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await response.body?.cancel();
      await sleep(Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 2 ** attempt, MAX_WAIT_S) * 1000);
      continue;
    }
    return response;
  }
}

/** The UpstreamError for a response that failed after retries. */
export function upstreamError(service: string, response: Response, what: string, detail?: string): UpstreamError {
  const retryAfter = Number(response.headers.get("retry-after")) || undefined;
  const status = response.status === 429 || response.status >= 500 ? 503 : 502;
  const reason = response.status === 429 ? "is rate-limiting requests" : `returned HTTP ${response.status}`;
  return new UpstreamError(service, status, `${service} ${what} failed: ${detail ?? reason}.`, retryAfter);
}
