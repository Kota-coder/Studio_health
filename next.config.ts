/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['canvas'],
  images: {
    domains: [],
  },
  env: {
    GOOGLE_GENAI_API_KEY: process.env.GOOGLE_GENAI_API_KEY,
  },
  output: 'standalone',
}

module.exports = nextConfig;