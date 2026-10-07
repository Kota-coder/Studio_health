/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['canvas'],
  images: {
    domains: [],
  },
  output: 'standalone',
}

module.exports = nextConfig;