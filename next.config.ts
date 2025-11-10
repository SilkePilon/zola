import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
    nodeMiddleware: true,
  },
  serverExternalPackages: ["shiki", "vscode-oniguruma"],
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
        webpack: (config: any) => {
          const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer")
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
