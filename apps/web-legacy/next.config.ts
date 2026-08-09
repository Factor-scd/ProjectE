import type { NextConfig } from 'next';

// Parse allowed hosts from environment variable
const allowedHosts = (process.env.ALLOWED_HOSTS || 'localhost')
  .split(',')
  .map(host => host.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  transpilePackages: ['@project-e/shared', '@project-e/db'],
  output: 'standalone',

  // Allow requests from configured hosts (for Nginx Proxy Manager)
  allowedDevOrigins: allowedHosts,

  // Trust proxy headers from Nginx Proxy Manager
  // This ensures the app knows the real client IP and protocol
  experimental: {
    // Optimize package imports to reduce bundle size
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'date-fns',
      'recharts',
      'react-big-calendar',
    ],
  },

  // Webpack optimizations
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Split vendor chunks for better caching
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          chunks: 'all',
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            // Core React framework
            framework: {
              test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
              name: 'framework',
              chunks: 'all',
              priority: 40,
            },
            // Heavy visualization libraries (lazy loaded)
            recharts: {
              test: /[\\/]node_modules[\\/](recharts|d3-.*|victory-.*|@reach[\\/])/,
              name: 'vendor-recharts',
              chunks: 'all',
              priority: 30,
            },
            // TipTap editor
            tiptap: {
              test: /[\\/]node_modules[\\/]@tiptap[\\/]/,
              name: 'vendor-tiptap',
              chunks: 'all',
              priority: 30,
            },
            // Grid layout
            gridlayout: {
              test: /[\\/]node_modules[\\/](react-grid-layout|react-resizable|react-draggable)/,
              name: 'vendor-gridlayout',
              chunks: 'all',
              priority: 30,
            },
            // Force graph
            forcegraph: {
              test: /[\\/]node_modules[\\/](react-force-graph-2d|force-graph|three)/,
              name: 'vendor-forcegraph',
              chunks: 'all',
              priority: 30,
            },
            // Calendar
            calendar: {
              test: /[\\/]node_modules[\\/]react-big-calendar[\\/]/,
              name: 'vendor-calendar',
              chunks: 'all',
              priority: 30,
            },
            // Calendar heatmap
            heatmap: {
              test: /[\\/]node_modules[\\/]react-calendar-heatmap[\\/]/,
              name: 'vendor-heatmap',
              chunks: 'all',
              priority: 30,
            },
            // Radix UI (shared)
            radix: {
              test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
              name: 'vendor-radix',
              chunks: 'all',
              priority: 25,
            },
            // Other vendors
            vendors: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
            },
          },
        },
      };
    }

    return config;
  },
};

export default nextConfig;
