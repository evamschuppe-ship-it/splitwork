import './globals.css';
import Header from '@/components/Header';

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
    <html lang="en">
      <body>
        <Header />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
