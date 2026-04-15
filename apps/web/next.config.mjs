/** @type {import('next').NextConfig} */
const nextConfig = {
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
