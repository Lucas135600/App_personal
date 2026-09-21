import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg e PGlite são nativos/WASM: precisam ficar fora do bundle do servidor.
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
  experimental: {
    serverActions: { bodySizeLimit: "16mb" },
  },
};

export default nextConfig;
