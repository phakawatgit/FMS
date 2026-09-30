/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Keep the real Front-end files available without exposing the mount folder name.
      { source: "/:path((?!legacy|_next|api).*)", destination: "/legacy/:path" },
    ];
  },
};

export default nextConfig;
