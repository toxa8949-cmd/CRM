'use client';
import { useEffect, useState } from 'react';
import { supabase, money, todayISO } from '../lib/supabase';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stat, setStat] = useState({
    todayRevenue: 0, todayProfit: 0, todayCount: 0,
    monthRevenue: 0, monthProfit: 0,
    stockValue: 0, stockRetail: 0, lowStock: 0, products: 0,
  });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const today = todayISO();
    const monthStart = today.slice(0, 8) + '01';

    const [{ data: sales }, { data: products }] = await Promise.all([
      supabase.from('sales').select('total,profit,created_at,id,payment').order('created_at', { ascending: false }),
      supabase.from('products').select('stock,purchase,price,low_stock'),
    ]);

    const s = sales || [];
    const todayS = s.filter(x => x.created_at?.slice(0, 10) === today);
    const monthS = s.filter(x => x.created_at?.slice(0, 10) >= monthStart);
    const p = products || [];

    setStat({
      todayRevenue: todayS.reduce((a, x) => a + Number(x.total), 0),
      todayProfit: todayS.reduce((a, x) => a + Number(x.profit), 0),
      todayCount: todayS.length,
      monthRevenue: monthS.reduce((a, x) => a + Number(x.total), 0),
      monthProfit: monthS.reduce((a, x) => a + Number(x.profit), 0),
      stockValue: p.reduce((a, x) => a + x.stock * Number(x.purchase), 0),
      stockRetail: p.reduce((a, x) => a + x.stock * Number(x.price), 0),
      lowStock: p.filter(x => x.stock <= x.low_stock).length,
      products: p.length,
    });
    setRecent(s.slice(0, 8));
    setLoading(false);
  }

  if (loading) return <div className="loading">Завантаження…</div>;

  return (
    <>
      <h2>Панель керування</h2>
      <p className="muted">Огляд за сьогодні та поточний місяць</p>

      <div className="grid">
        <div className="card"><h3>Продажі сьогодні</h3><div className="value blue">{money(stat.todayRevenue)}</div><span className="muted">{stat.todayCount} чек(ів)</span></div>
        <div className="card"><h3>Прибуток сьогодні</h3><div className="value green">{money(stat.todayProfit)}</div></div>
        <div className="card"><h3>Дохід за місяць</h3><div className="value">{money(stat.monthRevenue)}</div></div>
        <div className="card"><h3>Прибуток за місяць</h3><div className="value green">{money(stat.monthProfit)}</div></div>
      </div>

      <div className="grid">
        <div className="card"><h3>Склад (закупка)</h3><div className="value">{money(stat.stockValue)}</div></div>
        <div className="card"><h3>Склад (роздріб)</h3><div className="value">{money(stat.stockRetail)}</div></div>
        <div className="card"><h3>Позицій у каталозі</h3><div className="value">{stat.products}</div></div>
        <div className="card"><h3>Мало на складі</h3><div className={'value ' + (stat.lowStock ? 'red' : 'green')}>{stat.lowStock}</div></div>
      </div>

      <h3 style={{ marginTop: 8 }}>Останні продажі</h3>
      <table>
        <thead><tr><th>Дата</th><th>Оплата</th><th>Сума</th><th>Прибуток</th></tr></thead>
        <tbody>
          {recent.length === 0 && <tr><td colSpan={4} className="muted">Ще немає продажів</td></tr>}
          {recent.map(r => (
            <tr key={r.id}>
              <td>{new Date(r.created_at).toLocaleString('uk-UA')}</td>
              <td>{r.payment}</td>
              <td>{money(r.total)}</td>
              <td style={{ color: '#16a34a' }}>{money(r.profit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
