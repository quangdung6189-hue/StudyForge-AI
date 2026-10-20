import type { NextConfig } from 'next';
import { config } from 'dotenv';
import path from 'node:path';

const root = path.resolve(process.cwd(), '../..');
config({ path: path.join(root, '.env'), quiet: true });
process.env.STUDYFORGE_ROOT ??= root;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'pdf-parse', 'mammoth', 'nodemailer'],
  transpilePackages: ['@studyforge/contracts', '@studyforge/core', '@studyforge/db', '@studyforge/ai', '@studyforge/storage'],
  outputFileTracingRoot: root,
  experimental: { serverActions: { bodySizeLimit: '1mb' } },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'same-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
    ] }];
  },
};
export default nextConfig;
