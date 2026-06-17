import './styles.css';
import type { ReactNode } from 'react';
import Shell from './Shell';

export const metadata = {
  title: 'Rower CRM',
  description: 'CRM для магазину: продажі, склад, статистика',
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
