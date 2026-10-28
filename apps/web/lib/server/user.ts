import "server-only";
import { type CaptainUser, resolveUser } from "@captain/core/auth";
import { UsageLimitError } from "@captain/core/usage";
import { headers } from "next/headers";

export async function currentUser(request?: Request): Promise<CaptainUser | null> {
  if (request) return resolveUser(request);
  return resolveUser(new Request("http://captain.local", { headers: await headers() }));
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireUser(request?: Request): Promise<CaptainUser> {
  const user = await currentUser(request);
  if (!user) throw new HttpError(401, "Sign in to Bambii");
  return user;
}

/** Wrap a route handler so `HttpError`s and usage limits become JSON responses. */
export function route<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
      if (error instanceof UsageLimitError) {
        const headers = error.retryAfter === undefined ? undefined : { "retry-after": String(error.retryAfter) };
        return Response.json({ error: error.message }, { status: 429, headers });
      }
      console.error(error);
      return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}
