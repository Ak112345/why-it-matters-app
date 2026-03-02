import type { Metadata } from 'next';
import './styles/globals.css';
import AuthProvider from './providers/AuthProvider';

export const metadata: Metadata = {
  title: 'Why It Matters',
  description: 'Web app for generating and auto-posting Quiet Hours content',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
