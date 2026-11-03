import type { Instrumentation } from "next";

/**
 * Errors Next.js catches itself (pages that fail to render, route handlers that throw past `route()`)
 * alert the operator. Errors `route()` turns into JSON alert from `errorResponse` instead.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { alert } = await import("@captain/core/alerts");
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;
  await alert("request-error", "Next.js caught an unhandled server error", {
    path: request.path.split("?")[0],
    route: context.routePath,
    kind: context.routeType,
    error: error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 300) : String(error).slice(0, 300),
    digest,
  });
};
