import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
  transpilePackages: ["@hermes/contracts", "@hermes/permissions"],
  poweredByHeader: false,
};

export default nextConfig;
