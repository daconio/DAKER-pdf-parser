import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {
    resolveAlias: {
      canvas: "./lib/empty.js",
    },
  },
};

export default nextConfig;
