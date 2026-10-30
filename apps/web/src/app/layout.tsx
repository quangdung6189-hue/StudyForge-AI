import type { Metadata } from 'next';
import './globals.css';
import { cookies } from 'next/headers';
import AnimateUIWrapper from '@/components/animate-ui/AnimateUIWrapper';

export const metadata: Metadata = { title: 'StudyForge AI', description: 'Private study and assessment workspace' };
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const value = (await cookies()).get('sf-theme')?.value;
  const theme = value === 'dark' || value === 'light' ? value : undefined;
  return <html lang="vi" data-theme={theme}><body><AnimateUIWrapper>{children}</AnimateUIWrapper></body></html>;
}
