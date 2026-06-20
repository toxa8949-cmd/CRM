'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, money, todayISO, brutto, taxRate } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useShop } from '../lib/shop';

export default function Dashboard() {
  const { role, ready } = useAuth();
  const { slug: shop, currency, hasVat, partnerShare } = useShop();
  const mm = (v: number) => money(v, currency);
  const owner = role === 'owner';
  const [loading, setLoading] = useState(true);
  const [stat, setStat] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [lowItems, setLowItems] = useState<any[]>([]);
  const [daily, setDaily] = useState<{ d: string; v: number }[]>([]);

  useEffect(() => { if (ready) load(); }, [ready, shop]);

  async function load() {
    setLoading(true);
    const today = todayISO();
    const monthStart = today.slice(0, 8) + '01';

    const [{ data: sales }, { data: products }] = await Promise.all([
      owner
        ? supabase.from('sales').select('total,net,turnover_tax,profit,paid,pay_status,status,created_at,id,payment').eq('shop', shop).order('created_at', { ascending: false })
        : supabase.from('sales_safe').select('total,paid,pay_status,status,created_at,id,payment').eq('shop', shop).order('created_at', { ascending: false }),
      owner
        ? supabase.from('products').select('id,name,stock,purchase,price,low_stock,extra_cost,kind').eq('shop', shop)
        : supabase.from('products_safe').select('id,name,stock,price,low_stock').eq('shop', shop),
    ]);

    const s = ((sales || []) as any[]).filter(x => x.status !== 'Повернення');
    const todayS = s.filter(x => x.created_at?.slice(0, 10) === today);
    const monthS = s.filter(x => x.created_at?.slice(0, 10) >= monthStart);
    const p = (products || []) as any[];

    // борги (усі чеки, не лише місяць)
    const debtList = ((sales || []) as any[]).filter(x => x.status !== 'Повернення' && (x.total - x.paid) > 0.01);
    const debtTotal = debtList.reduce((a, x) => a + (x.total - x.paid), 0);

    // продажі по днях місяця (для міні-графіка)
    const dMap: Record<string, number> = {};
    monthS.forEach(x => { const d = x.created_at.slice(0, 10); dMap[d] = (dMap[d] || 0) + Number(x.total); });
    const dailyArr = Object.entries(dMap).map(([d, v]) => ({ d, v })).sort((a, b) => a.d.localeCompare(b.d));

    const low = p.filter(x => x.stock <= x.low_stock).sort((a, b) => a.stock - b.stock);

    setStat({
      todayRevenue: todayS.reduce((a, x) => a + Number(x.total), 0),
      todayProfit: todayS.reduce((a, x) => a + Number(x.profit), 0),
      todayCount: todayS.length,
      monthRevenue: monthS.reduce((a, x) => a + Number(x.total), 0),
      monthProfit: monthS.reduce((a, x) => a + Number(x.profit), 0),
      monthTax: monthS.reduce((a, x) => a + Number(x.turnover_tax || 0), 0),
      monthCount: monthS.length,
      stockValue: p.reduce((a, x) => a + x.stock * Number(x.purchase), 0),
      stockRetail: p.reduce((a, x) => a + x.stock * brutto(Number(x.price)), 0),
      stockProfit: p.reduce((a, x) => {
        const priceNet = Number(x.price);
        const unitProfit = priceNet - Number(x.purchase) - Number(x.extra_cost || 0) - priceNet * taxRate(x.kind) / 100;
        return a + x.stock * unitProfit;
      }, 0),
      lowStock: low.length,
      noPrice: p.filter(x => Number(x.price) <= 0).length,
      products: p.length,
      debtTotal, debtCount: debtList.length,
    });
    setLowItems(low.slice(0, 6));
    setDaily(dailyArr);
    setRecent(s.slice(0, 6));
    setLoading(false);
  }

  if (loading || !stat) return <div className="loading">Завантаження…</div>;

  const maxDaily = Math.max(1, ...daily.map(x => x.v));

  return (
    <>
      <h2>Панель керування</h2>
      <p className="muted">{new Date().toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })}</p>

      {/* Швидкі дії */}
      <div className="row" style={{ marginBottom: 20 }}>
        <Link href="/pos" className="btn green">🛒 Нова продажа</Link>
        {owner && <Link href="/intake" className="btn">📥 Прихід товару</Link>}
        {owner && <Link href="/expenses" className="btn ghost">💸 Додати витрату</Link>}
      </div>

      {/* СЬОГОДНІ — головний блок */}
      <div className="dash-hero">
        <div className="hero-main">
          <div className="hero-label">Виручка сьогодні</div>
          <div className="hero-value">{mm(stat.todayRevenue)}</div>
          <div className="hero-sub">{stat.todayCount} продаж(ів) сьогодні</div>
        </div>
        <div className="hero-side">
          {owner && <div className="hero-mini">
            <span>Прибуток за день</span>
            <b style={{ color: '#16a34a' }}>{mm(stat.todayProfit)}</b>
          </div>}
          <div className="hero-mini">
            <span>Дохід за місяць</span>
            <b>{mm(stat.monthRevenue)}</b>
          </div>
          {owner && <div className="hero-mini">
            <span>Прибуток за місяць</span>
            <b style={{ color: '#16a34a' }}>{mm(stat.monthProfit)}</b>
          </div>}
          {owner && partnerShare > 0 && <div className="hero-mini">
            <span>Моя частка ({100 - partnerShare}%)</span>
            <b style={{ color: '#16a34a' }}>{mm(stat.monthProfit * (100 - partnerShare) / 100)}</b>
          </div>}
          {owner && partnerShare > 0 && <div className="hero-mini">
            <span>Частка магазину ({partnerShare}%)</span>
            <b style={{ color: '#d97706' }}>{mm(stat.monthProfit * partnerShare / 100)}</b>
          </div>}
          {owner && hasVat && <div className="hero-mini">
            <span>Податок з обороту (міс.)</span>
            <b>{mm(stat.monthTax)}</b>
          </div>}
          {!owner && <div className="hero-mini">
            <span>Продажів за місяць</span>
            <b>{stat.monthCount}</b>
          </div>}
        </div>
      </div>

      {/* Сигнали — тільки якщо є на що звернути увагу */}
      {(stat.debtCount > 0 || stat.lowStock > 0 || stat.noPrice > 0) && (
        <div className="grid" style={{ marginBottom: 8 }}>
          {stat.debtCount > 0 && (
            <Link href="/sales" className="card alert red-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <h3>💰 Борги клієнтів</h3>
              <div className="value red">{mm(stat.debtTotal)}</div>
              <span className="muted">{stat.debtCount} неоплачен. чек(ів)</span>
            </Link>
          )}
          {stat.lowStock > 0 && (
            <Link href="/products" className="card alert orange-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <h3>📦 Закінчується</h3>
              <div className="value" style={{ color: '#d97706' }}>{stat.lowStock} поз.</div>
              <span className="muted">{lowItems.map(i => i.name).slice(0, 2).join(', ')}{stat.lowStock > 2 ? '…' : ''}</span>
            </Link>
          )}
          {owner && stat.noPrice > 0 && (
            <Link href="/products" className="card alert" style={{ textDecoration: 'none', color: 'inherit' }}>
              <h3>⚠️ Без ціни продажу</h3>
              <div className="value" style={{ color: '#d97706' }}>{stat.noPrice} поз.</div>
              <span className="muted">потребують ціни</span>
            </Link>
          )}
        </div>
      )}

      {/* Графік продажів по днях + склад */}
      <div className="dash-cols">
        <div className="card">
          <h3>Продажі по днях (місяць)</h3>
          {daily.length === 0 && <p className="muted">Ще немає продажів цього місяця</p>}
          <div className="bars">
            {daily.map(d => (
              <div key={d.d} className="bar-wrap" title={`${d.d}: ${mm(d.v)}`}>
                <div className="bar" style={{ height: `${Math.max(4, (d.v / maxDaily) * 100)}%` }} />
                <span className="bar-day">{d.d.slice(8)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>Склад</h3>
          {owner && <div className="stock-row"><span>Закупівельна вартість</span><b>{mm(stat.stockValue)}</b></div>}
          <div className="stock-row"><span>Роздрібна вартість (брутто)</span><b>{mm(stat.stockRetail)}</b></div>
          {owner && <div className="stock-row"><span>Потенційний прибуток</span><b style={{ color: '#16a34a' }}>{mm(stat.stockProfit)}</b></div>}
          <div className="stock-row"><span>Позицій у каталозі</span><b>{stat.products}</b></div>
        </div>
      </div>

      {/* Останні продажі */}
      <h3 style={{ marginTop: 8 }}>Останні продажі</h3>
      <table>
        <thead><tr><th>Дата</th><th>Оплата</th><th>Сума</th>{owner && <th>Прибуток</th>}</tr></thead>
        <tbody>
          {recent.length === 0 && <tr><td colSpan={owner ? 4 : 3} className="muted">Ще немає продажів</td></tr>}
          {recent.map(r => (
            <tr key={r.id}>
              <td data-label="Дата">{new Date(r.created_at).toLocaleString('uk-UA')}</td>
              <td data-label="Оплата">{r.payment}</td>
              <td data-label="Сума">{mm(r.total)}</td>
              {owner && <td data-label="Прибуток" style={{ color: '#16a34a' }}>{mm(r.profit)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
