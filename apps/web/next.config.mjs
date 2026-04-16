/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
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
};

export default nextConfig;
