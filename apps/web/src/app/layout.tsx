import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import 'katex/dist/katex.min.css';
import './globals.css';
import './ux-system.css';
import { cookies } from 'next/headers';
import AnimateUIWrapper from '@/components/animate-ui/AnimateUIWrapper';
import { UXEffects } from '@/components/layout/UXEffects';
import { FeedbackProvider } from '@/components/ui/Feedback';

// Self-hosted at build time (no render-blocking request to Google, no layout shift on swap).
const sans = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = { title: 'StudyForge AI', description: 'Private study and assessment workspace' };
export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8FAFC' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1120' },
  ],
};
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const value = (await cookies()).get('sf-theme')?.value;
  const theme = value === 'dark' || value === 'light' ? value : undefined;
  return (
    <html lang="vi" data-theme={theme} className={sans.variable} suppressHydrationWarning>
      <body>
        <UXEffects />
        <AnimateUIWrapper>
          <FeedbackProvider>{children}</FeedbackProvider>
        </AnimateUIWrapper>
      </body>
    </html>
  );
}
