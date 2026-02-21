/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    config.plugins.push(
      new (require('webpack').IgnorePlugin)({
        resourceRegExp: /^@std\/testing|^@gadicc\/fetch-mock-cache/,
      })
    );
    return config;
  },
};

module.exports = nextConfig;