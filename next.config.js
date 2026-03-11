const webpack = require("webpack");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^(@std\/testing|@gadicc\/fetch-mock-cache|https:\/\/deno\.land|@anthropic-ai\/sdk\/shims\/node|node:test)/,
      })
    );
    return config;
  },
};

module.exports = nextConfig;
