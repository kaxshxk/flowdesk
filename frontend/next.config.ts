import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables a self-contained server.js for Docker deployments
  output: "standalone",
};

export default nextConfig;
