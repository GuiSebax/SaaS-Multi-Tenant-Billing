import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SaaS Platform',
  description: 'Multi-tenant project management platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
