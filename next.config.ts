import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const isDevelopment = process.env.NODE_ENV === "development";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    let supabaseOrigin = "";
    let supabaseWebsocketOrigin = "";
    try {
      const parsedSupabaseUrl = supabaseUrl ? new URL(supabaseUrl) : null;
      supabaseOrigin = parsedSupabaseUrl?.origin ?? "";
      supabaseWebsocketOrigin = parsedSupabaseUrl ? parsedSupabaseUrl.origin.replace(/^http/, "ws") : "";
    } catch {
      // Invalid configuration is handled by the Supabase client; do not widen
      // the policy to accommodate it.
    }
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}${supabaseWebsocketOrigin ? ` ${supabaseWebsocketOrigin}` : ""}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
    ].join("; ");

    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: csp },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-DNS-Prefetch-Control", value: "on" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ...(!isDevelopment ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
      ],
    }];
  },
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
