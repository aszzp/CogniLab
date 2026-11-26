import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 生产部署使用独立产物（server.js + 最小 node_modules），避免在低配服务器上重新构建。
  output: 'standalone',
};

export default nextConfig;
