import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en">
      <body className="min-h-screen bg-bg text-ink antialiased">
        {children}
      </body>
    </html>
  );
}

