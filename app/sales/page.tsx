'use client';
import { useEffect, useState, Fragment } from 'react';
import { supabase, money, exportCSV, type Sale } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useShop } from '../../lib/shop';

const PAYMENTS = ['Готівка', 'Картка', 'Переказ', 'Накладений платіж'];

export default function SalesPage() {
  const { role } = useAuth();
  const { slug: shop, currency, hasVat } = useShop();
  const mm = (v: number) => money(v, currency);
  const owner = role === 'owner';
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<number | null>(null);
  const [edit, setEdit] = useState<Sale | null>(null);
  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState('');   // фільтр статусу оплати
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const [showManual, setShowManual] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [man, setMan] = useState({ name: '', purchase: '', brutto: '', qty: '1', date: today, payment: 'Готівка' });
  const [manErr, setManErr] = useState('');
  const [manBusy, setManBusy] = useState(false);

  useEffect(() => { load(); }, [shop]);

  async function load() {
    setLoading(true);
    if (owner) {
      const { data } = await supabase
        .from('sales')
        .select('*,customers(name),sale_items(*)')
        .eq('shop', shop)
        .order('created_at', { ascending: false })
        .limit(500);
      setSales(data || []);
    } else {
      // продавець: безпечні VIEW без прибутку/собівартості
      const [{ data: s }, { data: items }, { data: custs }] = await Promise.all([
        supabase.from('sales_safe').select('*').eq('shop', shop).order('created_at', { ascending: false }).limit(500),
        supabase.from('sale_items_safe').select('*').eq('shop', shop),
        supabase.from('customers').select('id,name').eq('shop', shop),
      ]);
      const custMap = new Map((custs || []).map((c: any) => [c.id, c.name]));
      const itemsBySale = new Map<number, any[]>();
      (items || []).forEach((it: any) => {
        if (!itemsBySale.has(it.sale_id)) itemsBySale.set(it.sale_id, []);
        itemsBySale.get(it.sale_id)!.push(it);
      });
      const merged = (s || []).map((x: any) => ({
        ...x,
        customers: x.customer_id ? { name: custMap.get(x.customer_id) } : null,
        sale_items: itemsBySale.get(x.id) || [],
      }));
      setSales(merged as any);
    }
    setLoading(false);
  }

  async function refund(s: Sale) {
    if (s.status === 'Повернення') return;
    if (!confirm(`Оформити повернення чеку #${s.id}? Товар повернеться на склад.`)) return;
    const { error } = await supabase.rpc('refund_sale', { p_sale_id: s.id });
    if (error) { alert(error.message); return; }
    load();
  }

  async function del(s: Sale) {
    if (!confirm(`Видалити чек #${s.id} назавжди?\nТовар повернеться на склад, бонуси знімуться.\nЦю дію не можна скасувати.`)) return;
    const { error } = await supabase.rpc('delete_sale', { p_sale_id: s.id });
    if (error) { alert(error.message); return; }
    load();
  }

  async function addManual() {
    setManErr('');
    if (!man.name.trim()) return setManErr('Вкажіть назву товару');
    if (!man.brutto || Number(man.brutto) <= 0) return setManErr('Вкажіть ціну продажу');
    const qty = Number(man.qty) || 1;
    const pDate = man.date && man.date !== today ? `${man.date}T12:00:00` : null;
    setManBusy(true);
    const { error } = await supabase.rpc('manual_sale', {
      p_name: man.name.trim(),
      p_purchase: Number(man.purchase) || 0,
      p_brutto: Number(man.brutto),
      p_qty: qty,
      p_date: pDate,
      p_payment: man.payment,
      p_shop: shop,
    });
    setManBusy(false);
    if (error) { setManErr(error.message); return; }
    setMan({ name: '', purchase: '', brutto: '', qty: '1', date: today, payment: 'Готівка' });
    setShowManual(false);
    load();
  }

  async function pay(s: Sale) {
    const debt = s.total - s.paid;
    const amt = Number(prompt(`Довнести по чеку #${s.id}. Борг ${debt.toFixed(2)} ${currency}. Сума:`, debt.toFixed(2)));
    if (!amt || amt <= 0) return;
    await supabase.rpc('add_payment', { p_sale_id: s.id, p_amount: amt });
    load();
  }

  // Редагування мʼяких полів (склад/суми не чіпаємо)
  async function saveEdit() {
    if (!edit) return;
    await supabase.from('sales').update({
      customer_id: edit.customer_id,
      payment: edit.payment,
      pay_status: edit.pay_status,
      paid: edit.pay_status === 'Оплачено' ? edit.total : edit.paid,
      note: edit.note,
    }).eq('id', edit.id);
    setEdit(null); load();
  }

  function printReceipt(s: Sale) {
    const items = (s.sale_items || []).map((it: any) => {
      const sum = it.item_kind === 'Сервіс' ? it.price * (hasVat?1.23:1) : it.qty * it.price * (hasVat?1.23:1);
      const name = (it.item_kind === 'Сервіс' ? 'Сервіс: ' : '') + it.product_name;
      const q = it.item_kind === 'Сервіс' ? '1' : it.qty;
      return `<tr><td>${name}</td><td style="text-align:center">${q}</td><td style="text-align:right">${sum.toFixed(2)} ${currency}</td></tr>`;
    }).join('');
    const w = window.open('', '_blank', 'width=380,height=600');
    if (!w) return;
    w.document.write(`
      <html><head><title>Чек #${s.id}</title>
      <style>
        body{font-family:monospace;padding:16px;font-size:13px;color:#000}
        h2{text-align:center;margin:0 0 4px} .muted{color:#555;text-align:center;font-size:12px}
        table{width:100%;border-collapse:collapse;margin:14px 0}
        td{padding:3px 0;border-bottom:1px dashed #ccc}
        .tot{display:flex;justify-content:space-between;margin:3px 0}
        .big{font-size:16px;font-weight:bold;border-top:2px solid #000;padding-top:6px;margin-top:6px}
      </style></head><body>
      <h2>Rower CRM</h2>
      <div class="muted">Чек #${s.id} · ${new Date(s.created_at).toLocaleString('uk-UA')}</div>
      ${s.customers?.name ? `<div class="muted">Клієнт: ${s.customers.name}</div>` : ''}
      <table>${items}</table>
      ${s.discount > 0 ? `<div class="tot"><span>Знижка</span><span>-${Number(s.discount).toFixed(2)} ${currency}</span></div>` : ''}
      <div class="tot big"><span>До сплати</span><span>${Number(s.total).toFixed(2)} ${currency}</span></div>
      <div class="tot"><span>Сплачено</span><span>${Number(s.paid).toFixed(2)} ${currency}</span></div>
      ${(s.total - s.paid) > 0 ? `<div class="tot"><span>Борг</span><span>${(s.total - s.paid).toFixed(2)} ${currency}</span></div>` : ''}
      <div class="tot"><span>Оплата</span><span>${s.payment}</span></div>
      <div class="muted" style="margin-top:16px">Дякуємо за покупку!</div>
      <script>window.print()</script>
      </body></html>`);
    w.document.close();
  }

  function exportSales() {
    const rows = filtered.map(s => {
      const base: any = {
        '№': s.id,
        'Дата': new Date(s.created_at).toLocaleString('uk-UA'),
        'Клієнт': s.customers?.name || '',
        'Статус': s.status,
        'Оплата': s.pay_status,
        'Спосіб': s.payment,
        'Сума': Number(s.total).toFixed(2),
        'Знижка': Number(s.discount).toFixed(2),
        'Сплачено': Number(s.paid).toFixed(2),
        'Борг': Math.max(0, s.total - s.paid).toFixed(2),
      };
      if (owner) {
        if (hasVat) {
          base['Нетто'] = Number(s.net).toFixed(2);
          base['Податок з обороту'] = Number(s.turnover_tax).toFixed(2);
        }
        base['Прибуток'] = Number(s.profit).toFixed(2);
      }
      return base;
    });
    exportCSV(`prodazhi_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  function payBadge(s: Sale) {
    if (s.pay_status === 'Оплачено') return <span className="badge ok">Оплачено</span>;
    if (s.pay_status === 'Борг') return <span className="badge out">Борг</span>;
    return <span className="badge low">Частково</span>;
  }

  const filtered = sales.filter(s => {
    if (fStatus && s.pay_status !== fStatus) return false;
    const d = s.created_at.slice(0, 10);
    if (fFrom && d < fFrom) return false;
    if (fTo && d > fTo) return false;
    if (search) {
      const q = search.toLowerCase();
      const inItems = (s.sale_items || []).some((it: any) => it.product_name.toLowerCase().includes(q));
      const inCustomer = (s.customers?.name || '').toLowerCase().includes(q);
      const inId = String(s.id) === search.trim();
      if (!inItems && !inCustomer && !inId) return false;
    }
    return true;
  });

  if (loading) return <div className="loading">Завантаження…</div>;

  return (
    <>
      <h2>Продажі</h2>
      <p className="muted">Історія чеків. Нові продажі оформлюйте в розділі «Каса».</p>

      <div className="row">
        <input className="input" style={{ maxWidth: 240 }} placeholder="Пошук: товар, клієнт, № чека" value={search} onChange={e => setSearch(e.target.value)} />
        <select value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="">Усі оплати</option>
          <option>Оплачено</option><option>Частково</option><option>Борг</option>
        </select>
        <input className="input" type="date" style={{ maxWidth: 150 }} value={fFrom} onChange={e => setFFrom(e.target.value)} />
        <span>—</span>
        <input className="input" type="date" style={{ maxWidth: 150 }} value={fTo} onChange={e => setFTo(e.target.value)} />
        <button className="ghost" onClick={() => { setSearch(''); setFStatus(''); setFFrom(''); setFTo(''); }}>Скинути</button>
        <button onClick={exportSales}>Експорт CSV</button>
        <span className="muted">{filtered.length} чек(ів)</span>
        {owner && <button className="green" style={{ marginLeft: 'auto' }} onClick={() => setShowManual(!showManual)}>
          {showManual ? '✕ Сховати' : '+ Додати продажу'}
        </button>}
      </div>

      {/* Форма ручної продажі (минулі продажі, без списання складу) */}
      {owner && showManual && (
        <div className="form" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
          {manErr && <div className="err" style={{ gridColumn: '1/-1' }}>{manErr}</div>}
          <input className="input" placeholder="Назва товару" value={man.name} onChange={e => setMan({ ...man, name: e.target.value })} style={{ gridColumn: '1/-1' }} />
          <input className="input" type="number" placeholder="Закупка нетто" value={man.purchase} onChange={e => setMan({ ...man, purchase: e.target.value })} />
          <input className="input" type="number" placeholder="Продаж брутто" value={man.brutto} onChange={e => setMan({ ...man, brutto: e.target.value })} />
          <input className="input" type="number" placeholder="К-сть" value={man.qty} onChange={e => setMan({ ...man, qty: e.target.value })} />
          <input className="input" type="date" max={today} value={man.date} onChange={e => setMan({ ...man, date: e.target.value })} />
          <select value={man.payment} onChange={e => setMan({ ...man, payment: e.target.value })}>
            <option>Готівка</option><option>Картка</option><option>Переказ</option><option>Накладений платіж</option>
          </select>
          <button className="green" disabled={manBusy} onClick={addManual}>{manBusy ? '…' : 'Зберегти'}</button>
          {man.brutto && Number(man.brutto) > 0 && (
            <div className="muted" style={{ gridColumn: '1/-1', fontSize: 13 }}>
              Нетто: {mm(Number(man.brutto) / (hasVat?1.23:1) * (Number(man.qty) || 1))} ·
              Прибуток: <b style={{ color: '#16a34a' }}>{mm((Number(man.brutto) / (hasVat?1.23:1) - (Number(man.purchase) || 0)) * (Number(man.qty) || 1) - (hasVat ? (Number(man.brutto) / 1.23 * (Number(man.qty) || 1)) * 0.03 : 0))}</b>
              <span style={{ marginLeft: 8 }}>· склад не змінюється</span>
            </div>
          )}
        </div>
      )}

      <table>
        <thead><tr><th>#</th><th>Дата</th><th>Клієнт</th><th>Статус</th><th>Оплата</th><th>Сума</th><th>Борг</th>{owner && <th>Прибуток</th>}<th></th></tr></thead>
        <tbody>
          {filtered.length === 0 && <tr><td colSpan={owner ? 9 : 8} className="muted">Нічого не знайдено</td></tr>}
          {filtered.map(s => (
            <Fragment key={s.id}>
              <tr>
                <td data-label="№">{s.id}</td>
                <td data-label="Дата">{new Date(s.created_at).toLocaleString('uk-UA')}</td>
                <td data-label="Клієнт">{s.customers?.name || '—'}</td>
                <td data-label="Статус">{s.status === 'Повернення'
                  ? <span className="badge out">Повернення</span>
                  : <span className="badge ok">Завершено</span>}</td>
                <td data-label="Оплата">{s.status === 'Повернення' ? '—' : payBadge(s)}</td>
                <td data-label="Сума">{mm(s.total)}{s.discount > 0 && <div className="muted" style={{ fontSize: 12 }}>знижка −{mm(s.discount)}</div>}</td>
                <td data-label="Борг" style={{ color: (s.total - s.paid) > 0 ? '#dc2626' : '#9ca3af' }}>
                  {mm(Math.max(0, s.total - s.paid))}
                </td>
                {owner && <td data-label="Прибуток" style={{ color: '#16a34a' }}>{mm(s.profit)}</td>}
                <td className="actions" data-label="Дії">
                  <div className="cell-actions">
                  <button className="ghost" onClick={() => setOpen(open === s.id ? null : s.id)}>
                    {open === s.id ? 'Сховати' : 'Деталі'}
                  </button>
                  <button className="ghost" onClick={() => printReceipt(s)}>🖨</button>
                  {owner && s.status !== 'Повернення' && <button className="ghost" onClick={() => setEdit(s)}>✎</button>}
                  {owner && s.status !== 'Повернення' && s.pay_status !== 'Оплачено' &&
                    <button className="green" onClick={() => pay(s)}>Довнести</button>}
                  {owner && s.status !== 'Повернення' && <button className="danger" onClick={() => refund(s)}>Повернення</button>}
                  <button className="danger" onClick={() => del(s)}>🗑 Видалити</button>
                  </div>
                </td>
              </tr>

              {edit?.id === s.id && (
                <tr>
                  <td colSpan={owner ? 9 : 8} style={{ background: '#eef2ff' }}>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', padding: '6px 0' }}>
                      <select value={edit!.payment} onChange={e => setEdit({ ...edit!, payment: e.target.value })}>
                        {PAYMENTS.map(p => <option key={p}>{p}</option>)}
                      </select>
                      <select value={edit!.pay_status} onChange={e => setEdit({ ...edit!, pay_status: e.target.value })}>
                        <option>Оплачено</option><option>Частково</option><option>Борг</option>
                      </select>
                      <input className="input" style={{ maxWidth: 320 }} placeholder="Примітка" value={edit!.note ?? ''} onChange={e => setEdit({ ...edit!, note: e.target.value })} />
                      <button className="green" onClick={saveEdit}>Зберегти</button>
                      <button className="ghost" onClick={() => setEdit(null)}>Скасувати</button>
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>Суми та товари в чеку не редагуються — для зміни зробіть повернення і новий продаж.</div>
                  </td>
                </tr>
              )}

              {open === s.id && (
                <tr>
                  <td colSpan={owner ? 9 : 8} style={{ background: '#f9fafb' }}>
                    {(s.sale_items || []).map((it: any) => (
                      <div key={it.id} style={{ padding: '4px 0' }}>
                        {it.item_kind === 'Сервіс' ? '🔧 ' : ''}{it.product_name}
                        {it.item_kind === 'Сервіс'
                          ? <> (сервіс) — <b>{mm(it.price * (hasVat?1.23:1))}</b> <span className="muted">{hasVat?"брутто":""}</span></>
                          : <> — {it.qty} × {mm(it.price)} нетто = <b>{mm(it.qty * it.price)}</b></>}
                      </div>
                    ))}
                    {s.note && <div className="muted">Примітка: {s.note}</div>}
                    <div className="muted" style={{ marginTop: 6 }}>
                      Оплата: {s.payment} · Сплачено {mm(s.paid)} з {mm(s.total)}
                      {(s.total - s.paid) > 0 && <> · <span style={{ color: '#dc2626' }}>борг {mm(s.total - s.paid)}</span></>}
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
