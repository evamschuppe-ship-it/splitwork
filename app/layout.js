import './globals.css';
import Header from '@/components/Header';

export const metadata = {
  title: 'SplitWork — fair task splits for university group projects',
  description:
    'SplitWork helps university project teams automatically divide deliverable sections and milestones into balanced timelines, so no single student does all the project management.',
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
