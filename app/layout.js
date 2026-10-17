import { Inter, Newsreader } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const serif = Newsreader({ subsets: ['latin'], variable: '--font-serif', display: 'swap', weight: ['400', '500'] });

const TITLE = 'SplitWork: fair task splits for group projects';
const DESCRIPTION =
  'For university students in group projects: add your teacher\'s brief and SplitWork gives each teammate a clear, balanced part with deadlines, so no one does all the organising.';

export const metadata = {
  metadataBase: new URL('https://splitwork.vercel.app'),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://splitwork.vercel.app',
    siteName: 'SplitWork',
    type: 'website',
  },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable}`}>
      <body>
        <Header />
        <main className="site-main">{children}</main>
      </body>
    </html>
  );
}
