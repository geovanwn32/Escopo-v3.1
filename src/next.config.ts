
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
  webpack: (config, { isServer }) => {
    // This is to make pdf-parse work, which is not fully compatible with webpack5
    // It will be used on the client-side for parsing PDFs.
    if (!isServer) {
        config.resolve.fallback = {
            "fs": false,
            "path": false,
            "os": false,
            "crypto": false,
            "stream": require.resolve("stream-browserify"),
            "buffer": require.resolve("buffer/"),
        }
    }
    
    // This is a workaround for the 'Critical dependency: the request of a dependency is an expression' warning
    config.module.exprContextCritical = false;

    return config;
  },
};

export default nextConfig;
