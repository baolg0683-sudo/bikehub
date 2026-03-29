import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    turbopack: false,
  },
  reactCompiler: true,

};

export default nextConfig;
