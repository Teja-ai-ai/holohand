/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // This tells Netlify to ignore code style errors and just build!
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig