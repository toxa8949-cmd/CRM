import './styles.css';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Rower CRM',
  description: 'CRM для магазину: продажі, склад, статистика',
};

const nav = [
  { href: '/', label: 'Панель', icon: '📊' },
  { href: '/sales', label: 'Продажі', icon: '🧾' },
  { href: '/pos', label: 'Каса', icon: '🛒' },
  { href: '/products', label: 'Склад', icon: '📦' },
  { href: '/customers', label: 'Клієнти', icon: '👥' },
  { href: '/expenses', label: 'Витрати', icon: '💸' },
  { href: '/reports', label: 'Звіти', icon: '📈' },
  { href: '/settings', label: 'Категорії', icon: '⚙️' },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      <body>
        <aside className="sidebar">
          <h1>Rower CRM</h1>
          <nav>
            {nav.map(n => (
              <Link key={n.href} href={n.href}><span className="ico">{n.icon}</span>{n.label}</Link>
            ))}
          </nav>
        </aside>
        <main className="content">{children}</main>
      </body>
    </html>
  );
}
