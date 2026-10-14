import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [
      // URL situs Wisuda ke-69 yang lama (ADR-0002): jaga tautan lama tetap hidup.
      { source: "/galeri69.html", destination: "/arsip/69", permanent: true },
    ];
  },
};

export default nextConfig;
