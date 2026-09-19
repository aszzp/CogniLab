import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import AppNav from '@/components/AppNav';
import KunProvider from '@/components/kun/KunProvider';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CogniLab · 数字人训练师备赛',
  description: 'AI 原生的人工智能数字人训练师赛项备赛训练系统',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'CogniLab' },
};

export const viewport: Viewport = {
  themeColor: '#07070c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <KunProvider>
          <AppNav />
          <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4 md:pb-12 md:pt-20">
            {children}
          </main>
        </KunProvider>
      </body>
    </html>
  );
}
