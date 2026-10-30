import type { NextConfig } from 'next';
import { config } from 'dotenv';
import path from 'node:path';

const root = path.resolve(process.cwd(), '../..');
config({ path: path.join(root, '.env'), quiet: true });
process.env.STUDYFORGE_ROOT ??= root;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: { position: 'bottom-left' },
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-neon', '@neondatabase/serverless', 'ws', 'bcryptjs', 'pdf-parse', 'mammoth', 'nodemailer'],
  transpilePackages: ['@studyforge/contracts', '@studyforge/core', '@studyforge/db', '@studyforge/ai', '@studyforge/storage'],
  outputFileTracingRoot: root,
  outputFileTracingIncludes: {
    '/*': ['../../packages/db/.generated/postgres/**/*', '../../packages/db/.generated/sqlite/**/*'],
  },
  experimental: { serverActions: { bodySizeLimit: '1mb' } },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'same-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
    ] }, { source: '/api/documents/:id/file', headers: [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    ] }];
  },
};
export default nextConfig;
