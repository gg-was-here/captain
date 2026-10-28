import "server-only";
import { type CaptainUser, resolveUser } from "@captain/core/auth";
import { UpstreamError } from "@captain/core/connectors";
import { UsageLimitError } from "@captain/core/usage";
import { APICallError, RetryError } from "ai";
import { headers } from "next/headers";
import { ZodError } from "zod";

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

/** The request's JSON body. A body that isn't JSON is the caller's mistake (400), not a server error. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "The request body isn't valid JSON.");
  }
}

/** Wrap a route handler so every failure becomes a JSON error a person (or an app) can act on. */
export function route<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (error) {
      return errorResponse(error, args[0] instanceof Request ? args[0] : undefined);
    }
  };
}

export function errorResponse(error: unknown, request?: Request): Response {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof UsageLimitError) {
    const headers = error.retryAfter === undefined ? undefined : { "retry-after": String(error.retryAfter) };
    return Response.json({ error: error.message }, { status: 429, headers });
  }
  if (error instanceof ZodError) {
    const problems = error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`);
    return Response.json({ error: `The request isn't valid. ${problems.join("; ")}`, problems }, { status: 400 });
  }
  if (error instanceof UpstreamError) {
    const headers = error.retryAfter === undefined ? undefined : { "retry-after": String(error.retryAfter) };
    return Response.json({ error: error.message }, { status: error.status, headers });
  }
  const model = modelFailure(error);
  if (model) return Response.json({ error: model.message }, { status: model.status });
  // Unexpected: log it with an id the user can quote, and say nothing about internals.
  const reference = request?.headers.get("x-vercel-id") ?? crypto.randomUUID();
  console.error(`[${reference}]`, error);
  return Response.json({ error: "Something went wrong. Please try again.", reference }, { status: 500 });
}

/** A model call that failed in a way worth telling the user about. */
function modelFailure(error: unknown): { status: number; message: string } | undefined {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return { status: 504, message: "The AI took too long to answer. Try again, or ask for something shorter." };
  }
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  if (!APICallError.isInstance(cause)) return undefined;
  if (cause.statusCode === 400 || cause.statusCode === 413) {
    return { status: 400, message: "The AI model couldn't take this request. It may be too long." };
  }
  return { status: 503, message: "The AI service is busy right now. Try again in a minute." };
}
