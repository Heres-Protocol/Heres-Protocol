/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  webpack: (config, { isServer, webpack }) => {
    // Ignore server-only modules in client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@react-native-async-storage/async-storage': false,
        'pino-pretty': false,
        fs: false,
        net: false,
        tls: false,
      }
    }
    
    // Ignore pino-pretty module (used by Anchor but not needed in browser)
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^pino-pretty$/,
      })
    )
    
    return config
  },
}

module.exports = nextConfig
