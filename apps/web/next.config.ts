import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  transpilePackages: ["@captain/core"],
  serverExternalPackages: ["@libsql/client"],
  // Built-app previews at /a/<id>/ need the trailing slash so relative asset URLs resolve.
  skipTrailingSlashRedirect: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Every page except built-app previews (/a/…), which set their own policy. No other site may frame
        // Bambii (clickjacking), and frames on Bambii's pages may only show Bambii itself, so a built app's
        // preview frame can't navigate to another site. Cloudflare's frame is Clerk's bot check; vercel.live
        // is the toolbar on preview deployments.
        source: "/:path((?!a/).*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-src 'self' https://challenges.cloudflare.com https://vercel.live; frame-ancestors 'self'",
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

// Mounts every bot under agents/ at /eve/<name>/v1/*.
export default withEve(nextConfig);
