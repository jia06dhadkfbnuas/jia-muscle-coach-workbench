import type { NextConfig } from 'next';

const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';
const repositoryBasePath = '/jia-muscle-coach-workbench';

const nextConfig: NextConfig = isGitHubPages
  ? {
      output: 'export',
      trailingSlash: true,
      basePath: repositoryBasePath,
      assetPrefix: repositoryBasePath,
      images: { unoptimized: true },
    }
  : {};

export default nextConfig;
