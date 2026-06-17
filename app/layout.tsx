import './styles.css';
import type { ReactNode } from 'react';
import Shell from './Shell';

export const metadata = {
  title: 'Rower CRM',
  description: 'CRM для магазину: продажі, склад, статистика',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
