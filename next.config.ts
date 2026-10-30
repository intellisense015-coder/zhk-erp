import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async redirects() {
    return [{ source: "/", destination: "/splash", permanent: false }];
  },
  experimental: {
    agentFeedback: true,
    agentUpgrade: "security",
    // ERP routes hydrate auth, workspace access, and data in the browser.
    // Keep Next's instant-navigation validator opt-in until those routes
    // provide a real static shell/Suspense boundary for the async work.
    instantInsights: {
      validationLevel: "manual-warning",
    },
  },
  // The indicator is useful while developing Next routes, but it is not part
  // of the Solexa UI and can obscure the lower-left controls during testing.
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "app/globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
