import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";

function vercelDevRedirect(request: NextRequest) {
  const routerHost = process.env.VERCEL_URL;
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (process.env.__VERCEL_DEV_RUNNING === "1" && routerHost && forwardedHost !== routerHost) {
    const target = request.nextUrl.clone();
    target.protocol = "http:";
    target.host = routerHost;
    return NextResponse.redirect(target);
  }
  return undefined;
}

// Clerk keeps the `__session` cookie fresh; Captain's server code and every bot verify it.
const withClerk = clerkMiddleware();

export function proxy(request: NextRequest, event: NextFetchEvent) {
  const redirect = vercelDevRedirect(request);
  if (redirect) return redirect;
  if (process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return withClerk(request, event);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|eve/|a/|.*\\.(?:css|js|png|jpg|svg|ico|woff2?)$).*)", "/api/(.*)"],
};
