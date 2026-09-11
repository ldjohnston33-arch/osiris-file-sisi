import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://osiris-file-sisi.vercel.app';
const TITLE = 'Osiris File: Sisi | L4 Global';
const DESCRIPTION =
  'A living, continuously updated profile of Egyptian President Abdel Fattah el-Sisi: public movements, inbound diplomacy, and the Libya, Gaza, Sudan and Red Sea context around Egyptian statecraft. Every item carries a sourcing tag. From L4 Global.';

export const viewport: Viewport = {
  themeColor: '#080c14',
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s | Osiris File' },
  description: DESCRIPTION,
  applicationName: 'Osiris File',
  authors: [{ name: 'Lewis "DJ" Johnston IV, MBA', url: 'https://l4global.com' }],
  publisher: 'L4 Global',
  keywords: ['Sisi', 'Egypt', 'Egyptian president', 'Egypt diplomacy', 'Libya', 'Gaza', 'Sudan', 'Red Sea', 'Suez Canal', 'MENA', 'OSINT', 'L4 Global', 'leadership profile'],
  openGraph: {
    type: 'website',
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'L4 Global',
    url: SITE_URL,
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
  icons: { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="backdrop" aria-hidden />
        {children}
      </body>
    </html>
  );
}
