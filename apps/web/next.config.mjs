/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_STANDALONE === "true" ? "standalone" : undefined,
  // All pages use client-side hooks (useSearchParams, etc).
  // Disable static prerendering entirely — this is a logged-in CRM, not a public site.
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  transpilePackages: ["@solaroo/ui", "@solaroo/types"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "**.s3.amazonaws.com",
      },
    ],
  },
  // Proxy /api/* requests to the NestJS API so that auth cookies are set on
  // the same domain as the frontend (required for httpOnly cookie auth).
  async rewrites() {
    const apiUrl = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
