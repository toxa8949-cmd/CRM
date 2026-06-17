'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { AuthProvider, useAuth } from '../lib/auth';

// owner: усі пункти; seller: лише дозволені
const NAV = [
  { href: '/', label: 'Панель', icon: '📊', seller: true },
  { href: '/sales', label: 'Продажі', icon: '🧾', seller: true },
  { href: '/pos', label: 'Каса', icon: '🛒', seller: true },
  { href: '/products', label: 'Склад', icon: '📦', seller: true },
  { href: '/intake', label: 'Прихід', icon: '📥', seller: false },
  { href: '/customers', label: 'Клієнти', icon: '👥', seller: true },
  { href: '/motivation', label: 'Мотивація', icon: '🎯', seller: true },
  { href: '/expenses', label: 'Витрати', icon: '💸', seller: false },
  { href: '/reports', label: 'Звіти', icon: '📈', seller: false },
  { href: '/settings', label: 'Категорії', icon: '⚙️', seller: false },
];
// сторінки, заборонені продавцю (захист від ручного вводу URL)
const OWNER_ONLY = ['/intake', '/expenses', '/reports', '/settings'];

function Inner({ children }: { children: ReactNode }) {
  const { role, email, ready } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/login';
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (!ready) return;
    if (!role && !isLogin) { router.replace('/login'); return; }
    if (role === 'seller' && OWNER_ONLY.includes(pathname)) { router.replace('/'); }
  }, [ready, role, pathname, isLogin, router]);

  // сторінка входу — без сайдбару
  if (isLogin) return <main className="content" style={{ marginLeft: 0, width: '100%' }}>{children}</main>;

  if (!ready) return <main className="content" style={{ marginLeft: 0, width: '100%' }}><div className="loading">Завантаження…</div></main>;
  if (!role) return <main className="content" style={{ marginLeft: 0, width: '100%' }}><div className="loading">Перенаправлення…</div></main>;

  const items = NAV.filter(n => role === 'owner' || n.seller);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <>
      {/* Мобільний топбар (видно тільки на телефоні через CSS) */}
      <header className="topbar">
        <button className="burger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Меню">
          {menuOpen ? '✕' : '☰'}
        </button>
        <span className="topbar-title">Rower CRM</span>
        <button className="ghost topbar-exit" onClick={logout}>Вийти</button>
      </header>

      {/* Затемнення під меню */}
      {menuOpen && <div className="menu-overlay" onClick={() => setMenuOpen(false)} />}

      <aside className={'sidebar' + (menuOpen ? ' open' : '')}>
        <h1>Rower CRM</h1>
        <nav>
          {items.map(n => (
            <Link key={n.href} href={n.href}><span className="ico">{n.icon}</span>{n.label}</Link>
          ))}
        </nav>
        <div className="side-user">
          <div className="muted" style={{ fontSize: 12 }}>{role === 'owner' ? 'Власник' : 'Продавець'}</div>
          <div style={{ fontSize: 12, opacity: .7, wordBreak: 'break-all' }}>{email}</div>
          <button className="ghost" style={{ marginTop: 8, width: '100%' }} onClick={logout}>Вийти</button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  return <AuthProvider><Inner>{children}</Inner></AuthProvider>;
}
