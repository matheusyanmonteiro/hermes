import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  transpilePackages: ["@hermes/contracts", "@hermes/permissions"],
  poweredByHeader: false,
};

export default nextConfig;
