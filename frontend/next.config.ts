import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
      {
        source: '/((?!api|_next|favicon.ico).*)',
        destination: '/',
      },
    ];
  },
};

export default nextConfig;
