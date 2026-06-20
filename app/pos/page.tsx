'use client';
import { useEffect, useState } from 'react';
import { supabase, money, brutto, taxRate, type Product, type Customer } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useShop } from '../../lib/shop';

type CartItem = { product: Product; qty: number };
type ServiceItem = { description: string; brutto: number };

export default function PosPage() {
  const { role } = useAuth();
  const { slug: shop, currency, hasVat } = useShop();
  const mm = (v: number) => money(v, currency);
  const tB = (n: number) => hasVat ? brutto(n) : n;
  const tR = (kind: string) => hasVat ? taxRate(kind) : 0;
  const owner = role === 'owner';
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [svcDesc, setSvcDesc] = useState('');
  const [svcPrice, setSvcPrice] = useState('');
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState('');
  const [payment, setPayment] = useState('Готівка');
  const [note, setNote] = useState('');
  const [discount, setDiscount] = useState('');
  const [paid, setPaid] = useState('');
  const [partial, setPartial] = useState(false);
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [accounts, setAccounts] = useState<any[]>([]);
  const [account, setAccount] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [shop]);

  async function load() {
    const [{ data: p }, { data: c }, { data: accs }] = await Promise.all([
      supabase.from(owner ? 'products' : 'products_safe').select('*,categories(name)').eq('shop', shop).order('name'),
      supabase.from('customers').select('*').eq('shop', shop).order('name'),
      supabase.from('accounts').select('id,name,currency').eq('shop', shop).eq('archived', false).order('created_at'),
    ]);
    setProducts(p || []); setCustomers(c || []);
    setAccounts(accs || []);
    if ((accs || []).length && !account) setAccount(String(accs![0].id));
    setLoading(false);
  }

  function addToCart(p: Product) {
    setErr(''); setOk('');
    const ex = cart.find(c => c.product.id === p.id);
    if (ex) {
      if (ex.qty >= p.stock) return setErr(`Більше немає на складі: ${p.name}`);
      setCart(cart.map(c => c.product.id === p.id ? { ...c, qty: c.qty + 1 } : c));
    } else {
      if (p.stock <= 0) return setErr(`Немає на складі: ${p.name}`);
      setCart([...cart, { product: p, qty: 1 }]);
    }
  }

  function setQty(id: number, qty: number) {
    const p = products.find(x => x.id === id)!;
    if (qty <= 0) return setCart(cart.filter(c => c.product.id !== id));
    if (qty > p.stock) { setErr(`Максимум ${p.stock} шт: ${p.name}`); qty = p.stock; }
    setCart(cart.map(c => c.product.id === id ? { ...c, qty } : c));
  }

  function addService() {
    setErr(''); setOk('');
    const price = Number(svcPrice);
    if (!price || price <= 0) return setErr('Вкажіть вартість сервісу');
    setServices([...services, { description: svcDesc.trim() || 'Сервіс', brutto: price }]);
    setSvcDesc(''); setSvcPrice('');
  }

  function removeService(i: number) {
    setServices(services.filter((_, idx) => idx !== i));
  }

  // товари (ціни нетто)
  const netGoods = cart.reduce((a, c) => a + Number(c.product.price) * c.qty, 0);
  const bruttoGoods = cart.reduce((a, c) => a + tB(Number(c.product.price)) * c.qty, 0);
  const taxGoods = cart.reduce((a, c) => a + Number(c.product.price) * c.qty * tR(c.product.kind) / 100, 0);
  const profitGoods = cart.reduce((a, c) =>
    a + (Number(c.product.price) - Number(c.product.purchase) - Number(c.product.extra_cost)
         - Number(c.product.price) * tR(c.product.kind) / 100) * c.qty, 0);

  // сервіси (ціни брутто)
  const bruttoSvc = services.reduce((a, s) => a + s.brutto, 0);
  const netSvc = services.reduce((a, s) => a + (hasVat ? s.brutto / 1.23 : s.brutto), 0);
  const taxSvc = netSvc * (hasVat ? 0.08 : 0);
  const profitSvc = netSvc - taxSvc; // собівартість 0

  const netGross = netGoods + netSvc;
  const grossTotal = bruttoGoods + bruttoSvc;       // брутто до знижки
  const taxGross = taxGoods + taxSvc;
  // комісія каналу (укр): зменшує прибуток
  const feeRate = !hasVat && payment === 'Термінал' ? 0.012 : (!hasVat && payment === 'Сайт' ? 0.02 : 0);
  const profitGross = profitGoods + profitSvc - (netGoods + netSvc) * feeRate;

  // знижка (брутто), коефіцієнт зменшення
  const disc = Math.min(Number(discount) || 0, grossTotal);
  const factor = grossTotal > 0 ? (grossTotal - disc) / grossTotal : 1;

  const total = grossTotal - disc;                  // до сплати
  const net = netGross * factor;
  const turnoverTax = taxGross * factor;
  const profit = profitGross * factor;

  const paidNum = partial ? (Number(paid) || 0) : total;
  const debt = Math.max(0, total - paidNum);

  async function checkout() {
    if (cart.length === 0 && services.length === 0) return;
    setBusy(true); setErr(''); setOk('');
    const today = new Date().toISOString().slice(0, 10);
    const pDate = saleDate && saleDate !== today ? `${saleDate}T12:00:00` : null;
    // канал оплати для комісії: Термінал→terminal, Сайт→online, інше→cash
    const channel = payment === 'Термінал' ? 'terminal' : (payment === 'Сайт' ? 'online' : 'cash');
    const { error } = await supabase.rpc('create_sale', {
      p_items: cart.map(c => ({ product_id: c.product.id, qty: c.qty })),
      p_services: services.map(s => ({ description: s.description, brutto: s.brutto })),
      p_customer_id: customer ? Number(customer) : null,
      p_payment: payment,
      p_note: note || null,
      p_discount: disc,
      p_paid: partial ? paidNum : null,
      p_date: pDate,
      p_shop: shop,
      p_pay_channel: channel,
      p_account_id: account ? Number(account) : null,
    });
    setBusy(false);
    if (error) return setErr(error.message);
    setOk(`Продаж оформлено на ${mm(total)}${debt > 0 ? ` · борг ${mm(debt)}` : ''}`);
    setCart([]); setServices([]); setNote(''); setCustomer('');
    setDiscount(''); setPaid(''); setPartial(false);
    setSaleDate(new Date().toISOString().slice(0, 10));
    load();
  }

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="loading">Завантаження…</div>;

  return (
    <>
      <h2>Каса</h2>
      <p className="muted">Оформлення продажу зі списанням складу</p>
      {err && <div className="err">{err}</div>}
      {ok && <div className="ok-msg">{ok}</div>}

      <div className="pos">
        <div>
          <input className="input" style={{ marginBottom: 12 }} placeholder="Пошук товару…" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="list">
            {filtered.map(p => (
              <div key={p.id} className="pitem" onClick={() => addToCart(p)}>
                <div>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{p.categories?.name || '—'} · залишок {p.stock} · {p.kind === 'Послуга' ? '8%' : '3%'}</div>
                </div>
                <div style={{ fontWeight: 700 }}>{mm(tB(p.price))}</div>
              </div>
            ))}
            {filtered.length === 0 && <div className="loading">Нічого не знайдено</div>}
          </div>

          <div className="cart" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Додати сервіс</h3>
            <input className="input" placeholder="Що зроблено (від руки)" value={svcDesc} onChange={e => setSvcDesc(e.target.value)} style={{ marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <input className="input" type="number" placeholder="Вартість брутто" value={svcPrice} onChange={e => setSvcPrice(e.target.value)} onKeyDown={e => e.key === 'Enter' && addService()} />
              <button className="ghost" onClick={addService}>Додати</button>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Ціна з ПДВ. Податок з обороту 8%, собівартість 0.</div>
          </div>
        </div>

        <div className="cart">
          <h3 style={{ marginTop: 0 }}>Чек</h3>
          {cart.length === 0 && services.length === 0 && <p className="muted">Додайте товари або сервіс зліва</p>}
          {cart.map(c => (
            <div key={c.product.id} className="ci">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{c.product.name}</div>
                <div className="muted" style={{ fontSize: 13 }}>{mm(tB(c.product.price))} × {c.qty}</div>
              </div>
              <button className="qbtn" onClick={() => setQty(c.product.id, c.qty - 1)}>−</button>
              <span style={{ minWidth: 22, textAlign: 'center' }}>{c.qty}</span>
              <button className="qbtn" onClick={() => setQty(c.product.id, c.qty + 1)}>+</button>
              <div style={{ minWidth: 80, textAlign: 'right', fontWeight: 700 }}>{mm(tB(c.product.price) * c.qty)}</div>
            </div>
          ))}
          {services.map((s, i) => (
            <div key={'svc' + i} className="ci">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>🔧 {s.description}</div>
                <div className="muted" style={{ fontSize: 13 }}>Сервіс · 8%</div>
              </div>
              <button className="qbtn danger" onClick={() => removeService(i)} title="Прибрати">×</button>
              <div style={{ minWidth: 80, textAlign: 'right', fontWeight: 700 }}>{mm(s.brutto)}</div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
            <span style={{ fontSize: 14 }}>Знижка, {currency}:</span>
            <input className="input" type="number" placeholder="0" value={discount} onChange={e => setDiscount(e.target.value)} style={{ maxWidth: 110 }} />
          </div>

          <div className="total">До сплати: {mm(total)}</div>
          <div className="muted" style={{ marginTop: -10, marginBottom: 6, fontSize: 13, lineHeight: 1.7 }}>
            {disc > 0 && <>Сума без знижки: {mm(grossTotal)}<br />Знижка: −{mm(disc)}<br /></>}
            {hasVat && <>Нетто: {mm(net)}<br />ПДВ 23%: {mm(total - net)}<br />Податок з обороту: {mm(turnoverTax)}<br /></>}
            {!hasVat && (payment === 'Термінал' || payment === 'Сайт') &&
              <>Комісія {payment === 'Термінал' ? '1.2%' : '2%'}: {mm(net * (payment === 'Термінал' ? 0.012 : 0.02))}<br /></>}
            {owner && <span style={{ color: '#16a34a', fontWeight: 600 }}>Чистий прибуток: {mm(profit)}</span>}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 10px', fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={partial} onChange={e => setPartial(e.target.checked)} />
            Часткова оплата (резерв / пошта)
          </label>
          {partial && (
            <div style={{ marginBottom: 10 }}>
              <input className="input" type="number" placeholder={`Сплачено зараз, ${currency}`} value={paid} onChange={e => setPaid(e.target.value)} style={{ marginBottom: 6 }} />
              <div className="muted" style={{ fontSize: 13 }}>
                Сплачено: {mm(paidNum)} · <span style={{ color: debt > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>Борг: {mm(debt)}</span>
              </div>
            </div>
          )}

          <select value={customer} onChange={e => setCustomer(e.target.value)} style={{ marginBottom: 10 }}>
            <option value="">Без клієнта</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="muted" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Дата продажу</label>
          <input className="input" type="date" value={saleDate} max={new Date().toISOString().slice(0, 10)}
            onChange={e => setSaleDate(e.target.value)} style={{ marginBottom: 10 }} />
          <select value={payment} onChange={e => setPayment(e.target.value)} style={{ marginBottom: 10 }}>
            <option>Готівка</option><option>Картка</option><option>Переказ</option><option>Накладений платіж</option>
            {!hasVat && <><option>Термінал</option><option>Сайт</option></>}
          </select>
          {accounts.length > 0 && (
            <>
              <label className="muted" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Гроші на рахунок</label>
              <select value={account} onChange={e => setAccount(e.target.value)} style={{ marginBottom: 10 }}>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
              </select>
            </>
          )}
          <input className="input" placeholder="Примітка" value={note} onChange={e => setNote(e.target.value)} style={{ marginBottom: 12 }} />

          <button className="green" style={{ width: '100%' }} disabled={(cart.length === 0 && services.length === 0) || busy} onClick={checkout}>
            {busy ? 'Оформлення…' : `Оформити продаж · ${mm(total)}`}
          </button>
        </div>
      </div>
    </>
  );
}
