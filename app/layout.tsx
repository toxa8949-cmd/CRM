import './styles.css';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Rower CRM',
  description: 'CRM для магазину',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      <body>
        <aside className="sidebar">
          <h1>Rower CRM</h1>
          <nav>
            <Link href="/">Панель</Link>
            <Link href="/products">Товари</Link>
            <Link href="/sales">Продажі</Link>
            <Link href="/expenses">Витрати</Link>
            <Link href="/reports">Звіти</Link>
          </nav>
        </aside>
        <main className="content">{children}</main>
      </body>
    </html>
  );
}
