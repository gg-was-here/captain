import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  transpilePackages: ["@captain/core"],
  serverExternalPackages: ["@libsql/client"],
  // Built-app previews at /a/<id>/ need the trailing slash so relative asset URLs resolve.
  skipTrailingSlashRedirect: true,
  poweredByHeader: false,
};

// Mounts every bot under agents/ at /eve/<name>/v1/*.
export default withEve(nextConfig);
