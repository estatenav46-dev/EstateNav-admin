import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { NavProgress } from '@/components/ui/NavProgress';

// Geist (SIL OFL, app/fonts/LICENSE-Geist.txt), the same UI face as the public website.
const sans = localFont({ src: './fonts/Geist-Latin.woff2', variable: '--font-geist-sans', weight: '100 900', display: 'swap' });

export const metadata: Metadata = {
  title: 'EstateNav Admin | Property Intelligence Control Plane',
  description: 'Management console for EstateNav properties, developers, micro-markets, and inquiries.',
  icons: {
    icon: '/favicon.ico',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="min-h-screen bg-bg text-ink antialiased">
        <NavProgress />
        {children}
      </body>
    </html>
  );
}

