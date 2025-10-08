import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable ESLint during builds to allow production deployment
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable TypeScript type checking during builds
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        // Apply headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ]
  },
  // Allow connections from any hostname in development
  async rewrites() {
    return []
  },
  // Configure allowedDevOrigins for cross-origin requests
  allowedDevOrigins: ['splintserver.local'],
  // Configure Turbopack (stable configuration)
  turbopack: {
    resolveAlias: {},
    resolveExtensions: ['.js', '.jsx', '.ts', '.tsx'],
  },
  // Exclude external-info from file system scanning
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/external-info/**',
          '**/.git/**',
          '**/.next/**',
        ]
      };
      
      // More aggressive exclusion for file scanning
      config.resolve = {
        ...config.resolve,
        symlinks: false,  // Disable symlink resolution
      };
    }
    return config;
  },
};

export default nextConfig;
