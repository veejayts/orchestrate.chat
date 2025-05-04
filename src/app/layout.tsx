import type { Metadata } from 'next';
import '@/styles/globals.css';
import { ThemeProvider } from '../components/ThemeContext';

export const metadata: Metadata = {
  title: 'Orchestrate Chat',
  description: 'A chat application powered by OpenRouter and Supabase',
  icons: {
    icon: '/favicon.ico',
    // You can also specify different sizes if needed
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}