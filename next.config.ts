import type { NextConfig } from "next";

/** Baseline hardening for an internal tool (no embedding, no sniffing, no referrer leaks). */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // In development Next prints every Server Function call with its arguments. Ours carry
  // passwords (src/lib/server/accounts.ts): they stay out of the terminal.
  logging: { serverFunctions: false },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The library that seals push messages is Node code (crypto, buffers): left as it is, not bundled.
  serverExternalPackages: ["web-push"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // The service worker (push notifications): always the latest one, and it may load nothing from elsewhere.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
