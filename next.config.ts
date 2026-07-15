import withBundleAnalyzer from "@next/bundle-analyzer"
import withSerwistInit from "@serwist/next"
import type { NextConfig } from "next"

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
})

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
})

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  serverExternalPackages: [
    "shiki",
    "@ai-sdk/baseten",
    "@basetenlabs/performance-client",
    "@basetenlabs/performance-client-linux-x64-gnu",
    "@basetenlabs/performance-client-linux-x64-musl",
  ],
  images: {
    remotePatterns: [],
  },
}

export default withSerwist(withAnalyzer(nextConfig))
