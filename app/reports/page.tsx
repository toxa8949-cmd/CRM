'use client';
import { useEffect, useState } from 'react';
import { supabase, money, todayISO } from '../../lib/supabase';
import { useShop } from '../../lib/shop';

export default function ReportsPage() {
  const { slug: shop, currency, hasVat, partnerShare } = useShop();
  const m = (v: number) => money(v, currency);
  const [from, setFrom] = useState(todayISO().slice(0, 8) + '01');
  const [to, setTo] = useState(todayISO());
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => { load(); }, [shop]);

  async function load() {
    setLoading(true);
    const toEnd = to + 'T23:59:59';
    const [{ data: sales }, { data: items }, { data: expenses }] = await Promise.all([
      supabase.from('sales').select('total,net,turnover_tax,profit,created_at,status').eq('shop', shop).gte('created_at', from).lte('created_at', toEnd),
      supabase.from('sale_items').select('product_name,qty,price,purchase,extra_cost,tax_rate,sale_id,sales!inner(created_at,status)')
        .eq('shop', shop).gte('sales.created_at', from).lte('sales.created_at', toEnd),
      supabase.from('expenses').select('category,amount,spent_at,is_goods').eq('shop', shop).gte('spent_at', from).lte('spent_at', to),
    ]);

    const valid = (sales || []).filter(s => s.status !== 'Повернення');
    const revenue = valid.reduce((a, s) => a + Number(s.total), 0);      // брутто
    const revenueNet = valid.reduce((a, s) => a + Number(s.net), 0);     // нетто
    const grossProfit = valid.reduce((a, s) => a + Number(s.profit), 0); // вже з вирах. податком з обороту
    // тільки НЕ-товарні витрати віднімаються від прибутку
    // (закупівля товару вже врахована в прибутку → is_goods виключаємо)
    const realExpenses = (expenses || []).filter((e: any) => !e.is_goods);
    const expenseTotal = realExpenses.reduce((a, e) => a + Number(e.amount), 0);
    const tax = valid.reduce((a, s) => a + Number(s.turnover_tax), 0);   // реальний податок з обороту
    const net = grossProfit - expenseTotal;                             // чистий результат

    // топ товарів
    const map: Record<string, { qty: number; sum: number; profit: number }> = {};
    (items || []).filter((i: any) => i.sales?.status !== 'Повернення').forEach((i: any) => {
      const m = map[i.product_name] || { qty: 0, sum: 0, profit: 0 };
      m.qty += i.qty; m.sum += i.qty * Number(i.price);
      m.profit += i.qty * (Number(i.price) - Number(i.purchase) - Number(i.extra_cost) - Number(i.price) * Number(i.tax_rate) / 100);
      map[i.product_name] = m;
    });
    const top = Object.entries(map).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.sum - a.sum).slice(0, 10);

    // витрати по категоріях
    const eMap: Record<string, number> = {};
    realExpenses.forEach(e => { eMap[e.category] = (eMap[e.category] || 0) + Number(e.amount); });
    const byCat = Object.entries(eMap).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);

    // по днях
    const dMap: Record<string, number> = {};
    valid.forEach(s => { const d = s.created_at.slice(0, 10); dMap[d] = (dMap[d] || 0) + Number(s.total); });
    const daily = Object.entries(dMap).map(([d, v]) => ({ d, v })).sort((a, b) => a.d.localeCompare(b.d));
    const maxDaily = Math.max(1, ...daily.map(x => x.v));

    setData({ revenue, revenueNet, grossProfit, expenseTotal, tax, net, count: valid.length, top, byCat, daily, maxDaily });
    setLoading(false);
  }

  function preset(type: string) {
    const now = new Date();
    if (type === 'today') { setFrom(todayISO()); setTo(todayISO()); }
    if (type === 'month') { setFrom(todayISO().slice(0, 8) + '01'); setTo(todayISO()); }
    if (type === 'year') { setFrom(now.getFullYear() + '-01-01'); setTo(todayISO()); }
  }

  return (
    <>
      <h2>Звіти</h2>
      <p className="muted">Аналітика за період</p>

      <div className="row">
        <input className="input" type="date" style={{ maxWidth: 170 }} value={from} onChange={e => setFrom(e.target.value)} />
        <span>—</span>
        <input className="input" type="date" style={{ maxWidth: 170 }} value={to} onChange={e => setTo(e.target.value)} />
        <button onClick={load}>Показати</button>
        <button className="ghost" onClick={() => preset('today')}>Сьогодні</button>
        <button className="ghost" onClick={() => preset('month')}>Місяць</button>
        <button className="ghost" onClick={() => preset('year')}>Рік</button>
      </div>

      {loading || !data ? <div className="loading">Завантаження…</div> : (
        <>
          <div className="grid">
            <div className="card"><h3>Дохід брутто</h3><div className="value blue">{m(data.revenue)}</div><span className="muted">{data.count} чек(ів)</span></div>
            {hasVat && <div className="card"><h3>Дохід нетто</h3><div className="value">{m(data.revenueNet)}</div></div>}
            <div className="card"><h3>Чистий прибуток</h3><div className="value green">{m(data.grossProfit)}</div><span className="muted">{hasVat ? 'після податку з обороту' : 'після комісій'}</span></div>
            <div className="card"><h3>Витрати</h3><div className="value red">{m(data.expenseTotal)}</div></div>
            {hasVat && <div className="card"><h3>Податок з обороту</h3><div className="value">{m(data.tax)}</div><span className="muted">3% товар / 8% послуга</span></div>}
            <div className="card"><h3>Результат (− витрати)</h3><div className={'value ' + (data.net >= 0 ? 'green' : 'red')}>{m(data.net)}</div></div>
          </div>

          {partnerShare > 0 && (
            <div className="grid" style={{ marginTop: 4 }}>
              <div className="card" style={{ borderLeft: '4px solid #16a34a' }}>
                <h3>Моя частка ({100 - partnerShare}%)</h3>
                <div className="value green">{m(data.grossProfit * (100 - partnerShare) / 100)}</div>
                <span className="muted">з повного прибутку {m(data.grossProfit)}</span>
              </div>
              <div className="card" style={{ borderLeft: '4px solid #d97706' }}>
                <h3>Частка магазину ({partnerShare}%)</h3>
                <div className="value" style={{ color: '#d97706' }}>{m(data.grossProfit * partnerShare / 100)}</div>
                <span className="muted">комісія магазину</span>
              </div>
            </div>
          )}

          <h3>Продажі по днях</h3>
          <div className="card" style={{ marginBottom: 24 }}>
            {data.daily.length === 0 && <span className="muted">Немає даних</span>}
            {data.daily.map((d: any) => (
              <div key={d.d} style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '6px 0' }}>
                <span style={{ width: 90, fontSize: 13, color: '#6b7280' }}>{d.d}</span>
                <div style={{ flex: 1, background: '#eef2ff', borderRadius: 6, height: 22 }}>
                  <div style={{ width: `${(d.v / data.maxDaily) * 100}%`, background: '#2563eb', height: 22, borderRadius: 6 }} />
                </div>
                <span style={{ width: 110, textAlign: 'right', fontWeight: 600 }}>{m(d.v)}</span>
              </div>
            ))}
          </div>

          <div className="dash-cols">
            <div>
              <h3>Топ товарів</h3>
              <table>
                <thead><tr><th>Товар</th><th>К-сть</th><th>Сума</th><th>Прибуток</th></tr></thead>
                <tbody>
                  {data.top.length === 0 && <tr><td colSpan={4} className="muted">Немає даних</td></tr>}
                  {data.top.map((t: any) => (
                    <tr key={t.name}><td data-label="Товар">{t.name}</td><td data-label="К-сть">{t.qty}</td><td data-label="Сума">{m(t.sum)}</td><td data-label="Прибуток" style={{ color: '#16a34a' }}>{m(t.profit)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3>Витрати за категоріями</h3>
              <table>
                <thead><tr><th>Категорія</th><th>Сума</th></tr></thead>
                <tbody>
                  {data.byCat.length === 0 && <tr><td colSpan={2} className="muted">Немає даних</td></tr>}
                  {data.byCat.map((c: any) => (
                    <tr key={c.category}><td data-label="Категорія"><span className="tag">{c.category}</span></td><td data-label="Сума" style={{ color: '#dc2626' }}>{m(c.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
