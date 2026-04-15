import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://webgecko.au https://www.webgecko.au",
          },
        ],
      },
    ];
  },
};

export default nextConfig;