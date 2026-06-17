'use client';
import { useEffect, useState, Fragment } from 'react';
import { supabase, money, type Sale } from '../../lib/supabase';

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('sales')
      .select('*,customers(name),sale_items(*)')
      .order('created_at', { ascending: false })
      .limit(300);
    setSales(data || []); setLoading(false);
  }

  // Повернення: повертає товар на склад і помічає чек
  async function refund(s: Sale) {
    if (s.status === 'Повернення') return;
    if (!confirm(`Оформити повернення чеку #${s.id}? Товар повернеться на склад.`)) return;
    for (const it of s.sale_items || []) {
      if (!it.product_id) continue;
      const { data: p } = await supabase.from('products').select('stock').eq('id', it.product_id).single();
      if (p) {
        await supabase.from('products').update({ stock: p.stock + it.qty }).eq('id', it.product_id);
        await supabase.from('stock_moves').insert({ product_id: it.product_id, delta: it.qty, reason: 'Повернення' });
      }
    }
    await supabase.from('sales').update({ status: 'Повернення', total: 0, profit: 0 }).eq('id', s.id);
    load();
  }

  async function pay(s: Sale) {
    const debt = s.total - s.paid;
    const amt = Number(prompt(`Довнести по чеку #${s.id}. Борг ${debt.toFixed(2)} zł. Сума:`, debt.toFixed(2)));
    if (!amt || amt <= 0) return;
    await supabase.rpc('add_payment', { p_sale_id: s.id, p_amount: amt });
    load();
  }

  function payBadge(s: Sale) {
    if (s.pay_status === 'Оплачено') return <span className="badge ok">Оплачено</span>;
    if (s.pay_status === 'Борг') return <span className="badge out">Борг</span>;
    return <span className="badge low">Частково</span>;
  }

  if (loading) return <div className="loading">Завантаження…</div>;

  return (
    <>
      <h2>Продажі</h2>
      <p className="muted">Історія чеків. Нові продажі оформлюйте в розділі «Каса».</p>
      <table>
        <thead><tr><th>#</th><th>Дата</th><th>Клієнт</th><th>Статус</th><th>Оплата</th><th>Сума</th><th>Борг</th><th>Прибуток</th><th></th></tr></thead>
        <tbody>
          {sales.length === 0 && <tr><td colSpan={9} className="muted">Ще немає продажів</td></tr>}
          {sales.map(s => (
            <Fragment key={s.id}>
              <tr>
                <td>{s.id}</td>
                <td>{new Date(s.created_at).toLocaleString('uk-UA')}</td>
                <td>{s.customers?.name || '—'}</td>
                <td>{s.status === 'Повернення'
                  ? <span className="badge out">Повернення</span>
                  : <span className="badge ok">Завершено</span>}</td>
                <td>{s.status === 'Повернення' ? '—' : payBadge(s)}</td>
                <td>{money(s.total)}{s.discount > 0 && <div className="muted" style={{ fontSize: 12 }}>знижка −{money(s.discount)}</div>}</td>
                <td style={{ color: (s.total - s.paid) > 0 ? '#dc2626' : '#9ca3af' }}>
                  {money(Math.max(0, s.total - s.paid))}
                </td>
                <td style={{ color: '#16a34a' }}>{money(s.profit)}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="ghost" onClick={() => setOpen(open === s.id ? null : s.id)}>
                    {open === s.id ? 'Сховати' : 'Деталі'}
                  </button>
                  {s.status !== 'Повернення' && s.pay_status !== 'Оплачено' &&
                    <button className="green" onClick={() => pay(s)}>Довнести</button>}
                  {s.status !== 'Повернення' && <button className="danger" onClick={() => refund(s)}>Повернення</button>}
                </td>
              </tr>
              {open === s.id && (
                <tr>
                  <td colSpan={9} style={{ background: '#f9fafb' }}>
                    {(s.sale_items || []).map((it: any) => (
                      <div key={it.id} style={{ padding: '4px 0' }}>
                        {it.item_kind === 'Сервіс' ? '🔧 ' : ''}{it.product_name}
                        {it.item_kind === 'Сервіс'
                          ? <> (сервіс) — <b>{money(it.price * 1.23)}</b> <span className="muted">брутто</span></>
                          : <> — {it.qty} × {money(it.price)} нетто = <b>{money(it.qty * it.price)}</b></>}
                      </div>
                    ))}
                    {s.note && <div className="muted">Примітка: {s.note}</div>}
                    <div className="muted" style={{ marginTop: 6 }}>
                      Оплата: {s.payment} · Сплачено {money(s.paid)} з {money(s.total)}
                      {(s.total - s.paid) > 0 && <> · <span style={{ color: '#dc2626' }}>борг {money(s.total - s.paid)}</span></>}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </>
  );
}
