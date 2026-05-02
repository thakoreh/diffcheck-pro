/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/diffcheck-pro',
  assetPrefix: '/diffcheck-pro/',
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
