'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { supabase, SHOPS } from '../lib/supabase';
import { AuthProvider, useAuth } from '../lib/auth';
import { ShopProvider } from '../lib/shop';

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
const OWNER_ONLY = ['/intake', '/expenses', '/reports', '/settings'];

function Inner({ children }: { children: ReactNode }) {
  const { role, email, ready, shopAccess } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/login';
  const [menuOpen, setMenuOpen] = useState(false);
  const [shop, setShop] = useState<string | null>(null);

  const myShops = shopAccess === 'all' ? SHOPS : SHOPS.filter(s => s.slug === shopAccess);

  useEffect(() => {
    if (!ready || !role) return;
    let saved = '';
    try { saved = localStorage.getItem('activeShop') || ''; } catch {}
    const allowed = myShops.map(s => s.slug);
    const initial = allowed.includes(saved) ? saved : (allowed[0] || 'rower');
    setShop(initial);
  }, [ready, role, shopAccess]);

  function switchShop(slug: string) {
    try { localStorage.setItem('activeShop', slug); } catch {}
    setMenuOpen(false);
    // повне перезавантаження, щоб усі сторінки гарантовано підхопили новий магазин
    window.location.href = '/';
  }

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (!ready) return;
    if (!role && !isLogin) { router.replace('/login'); return; }
    if (role === 'seller' && OWNER_ONLY.includes(pathname)) { router.replace('/'); }
  }, [ready, role, pathname, isLogin, router]);

  if (isLogin) return <main className="content" style={{ marginLeft: 0, width: '100%' }}>{children}</main>;
  if (!ready) return <main className="content" style={{ marginLeft: 0, width: '100%' }}><div className="loading">Завантаження…</div></main>;
  if (!role) return <main className="content" style={{ marginLeft: 0, width: '100%' }}><div className="loading">Перенаправлення…</div></main>;
  // ключове: поки активний магазин не визначено з localStorage — не рендеримо сторінки
  // (інакше вони встигають зробити запити зі стартовим магазином → плутанина даних)
  if (!shop) return <main className="content" style={{ marginLeft: 0, width: '100%' }}><div className="loading">Завантаження…</div></main>;

  const items = NAV.filter(n => role === 'owner' || n.seller);
  const shopName = SHOPS.find(s => s.slug === shop)?.name || 'Rower Express';

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <ShopProvider slug={shop}>
      <div key={shop} style={{ display: 'contents' }}>
      <header className="topbar">
        <button className="burger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Меню">
          {menuOpen ? '✕' : '☰'}
        </button>
        <span className="topbar-title">{shopName}</span>
        <button className="ghost topbar-exit" onClick={logout}>Вийти</button>
      </header>

      {menuOpen && <div className="menu-overlay" onClick={() => setMenuOpen(false)} />}

      <aside className={'sidebar' + (menuOpen ? ' open' : '')}>
        <h1>{shopName}</h1>

        {myShops.length > 1 && (
          <select className="shop-switch" value={shop} onChange={e => switchShop(e.target.value)}>
            {myShops.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}
          </select>
        )}

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
      </div>
    </ShopProvider>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  return <AuthProvider><Inner>{children}</Inner></AuthProvider>;
}
