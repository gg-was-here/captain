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

/** The marketing host: its root shows the landing page at /home; any other path belongs to the app on bambii.ai. */
const HOME_HOSTS = new Set(["home.bambii.ai", "home.localhost"]);

function homeHostRoute(request: NextRequest) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(":")[0];
  if (!HOME_HOSTS.has(host)) return undefined;
  const { pathname, search } = request.nextUrl;
  if (pathname === "/") return NextResponse.rewrite(new URL("/home", request.url));
  if (pathname === "/home") return NextResponse.next();
  return NextResponse.redirect(new URL(`${pathname}${search}`, "https://bambii.ai"));
}

// Clerk keeps the `__session` cookie fresh; Captain's server code and every bot verify it.
const withClerk = clerkMiddleware();

export function proxy(request: NextRequest, event: NextFetchEvent) {
  const redirect = vercelDevRedirect(request);
  if (redirect) return redirect;
  const home = homeHostRoute(request);
  if (home) return home;
  if (process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return withClerk(request, event);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|eve/|a/|.*\\.(?:css|js|png|jpg|gif|svg|ico|woff2?)$).*)", "/api/(.*)"],
};
