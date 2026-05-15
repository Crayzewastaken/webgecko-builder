import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Client-facing pages: block framing except on our own domains
        source: "/((?!admin).*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://webgecko.au https://www.webgecko.au",
          },
        ],
      },
      {
        // Admin pages: allow framing from any origin (Cowork, local dev, etc.)
        source: "/admin/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
