import type { NextConfig } from "next"
import type { Configuration } from "webpack"

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
    nodeMiddleware: true,
  },
  serverExternalPackages: [
    "shiki",
    "vscode-oniguruma",
    "@ai-sdk/baseten",
    "@basetenlabs/performance-client",
    "@basetenlabs/performance-client-linux-x64-gnu",
    "@basetenlabs/performance-client-linux-x64-musl",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  eslint: {
    // @todo: remove before going live
    ignoreDuringBuilds: true,
  },
  // Bundle analyzer for Webpack (only used in production builds)
  ...(process.env.ANALYZE === "true" &&
  process.env.NODE_ENV !== "development"
    ? {
        webpack: (config: Configuration) => {
          const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer")
          if (!config.plugins) {
            config.plugins = []
          }
          config.plugins.push(
            new BundleAnalyzerPlugin({
              analyzerMode: "static",
              openAnalyzer: false,
            })
          )
          return config
        },
      }
    : {}),
}

export default nextConfig
