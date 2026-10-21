import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Meneruskan /api/* ke API Fastify (pengembangan lokal / tanpa Nginx). Di produksi Nginx dapat melayani /api langsung.
  async rewrites() {
    const api = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001";
    return [
      { source: "/api/:path*", destination: `${api}/api/:path*` },
      { source: "/sanctum/:path*", destination: `${api}/sanctum/:path*` },
    ];
  },
  async redirects() {
    return [
      // URL situs Wisuda ke-69 yang lama (ADR-0002): jaga tautan lama tetap hidup.
      { source: "/galeri69.html", destination: "/arsip/69", permanent: true },
    ];
  },
};

export default nextConfig;
