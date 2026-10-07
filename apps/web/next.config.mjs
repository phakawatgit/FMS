/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${process.env.API_PROXY_TARGET || "http://localhost:4000"}/api/:path*` },
      { source: "/legacy-storage.js", destination: "/legacy/legacy-storage.js" },
      // Keep the real Front-end files available without exposing the mount folder name.
      { source: "/:path((?!legacy|_next|api).*)", destination: "/legacy/:path" },
    ];
  },
};

export default nextConfig;
