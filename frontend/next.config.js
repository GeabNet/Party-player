/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },

  // Environment variables for client-side
  env: {
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'https://party-player.onrender.com' // Render backend URL
        : 'http://localhost:3001')
  }
};

module.exports = nextConfig;