import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Genkit and its template engine are server-only; bundling them produces
  // webpack warnings and slows the build, so load them from node_modules instead.
  serverExternalPackages: ['genkit', '@genkit-ai/googleai', '@genkit-ai/core', 'dotprompt', 'handlebars'],
  experimental: {
    // ID-card images are sent to the server for extraction. They are resized in the
    // browser first, but allow some headroom over the 1 MB default.
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
