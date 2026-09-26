// next.config.js
console.log('=== next.config.js loading ===')
console.log('CWD:', process.cwd())
console.log('AGNES_API_KEY present:', !!process.env.AGNES_API_KEY)
console.log('AGNES_API_KEY prefix:', process.env.AGNES_API_KEY?.substring(0, 8))
console.log('==============================')

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    proxyClientMaxBodySize: '150mb',
  },

  serverExternalPackages: ['vargai'],
  async rewrites() {
    return [
      {
        source: '/api/generate/imgTovideo',
        destination: '/api/generate/imgtovideo',
      },
      {
        source: '/studio/imgTovideo',
        destination: '/studio/imgtovideo',
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'vargai.com' },
      { protocol: 'https', hostname: 'api.vargai.com' },
    ],
  },
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credenialless' },
        ],
      },
    ]
  },
}

export default nextConfig