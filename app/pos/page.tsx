'use client';
import { useEffect, useState } from 'react';
import { supabase, money, type Product, type Customer } from '../../lib/supabase';

type CartItem = { product: Product; qty: number };

export default function PosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState('');
  const [payment, setPayment] = useState('Готівка');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from('products').select('*,categories(name)').order('name'),
      supabase.from('customers').select('*').order('name'),
    ]);
    setProducts(p || []); setCustomers(c || []); setLoading(false);
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

  const total = cart.reduce((a, c) => a + Number(c.product.price) * c.qty, 0);
  const profit = cart.reduce((a, c) => a + (Number(c.product.price) - Number(c.product.purchase)) * c.qty, 0);

  async function checkout() {
    if (cart.length === 0) return;
    setBusy(true); setErr(''); setOk('');
    const { error } = await supabase.rpc('create_sale', {
      p_items: cart.map(c => ({ product_id: c.product.id, qty: c.qty })),
      p_customer_id: customer ? Number(customer) : null,
      p_payment: payment,
      p_note: note || null,
    });
    setBusy(false);
    if (error) return setErr(error.message);
    setOk(`Продаж оформлено на ${money(total)}`);
    setCart([]); setNote(''); setCustomer('');
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
                  <div className="muted" style={{ fontSize: 13 }}>{p.categories?.name || '—'} · залишок {p.stock}</div>
                </div>
                <div style={{ fontWeight: 700 }}>{money(p.price)}</div>
              </div>
            ))}
            {filtered.length === 0 && <div className="loading">Нічого не знайдено</div>}
          </div>
        </div>

        <div className="cart">
          <h3 style={{ marginTop: 0 }}>Чек</h3>
          {cart.length === 0 && <p className="muted">Додайте товари зліва</p>}
          {cart.map(c => (
            <div key={c.product.id} className="ci">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{c.product.name}</div>
                <div className="muted" style={{ fontSize: 13 }}>{money(c.product.price)} × {c.qty}</div>
              </div>
              <button className="qbtn" onClick={() => setQty(c.product.id, c.qty - 1)}>−</button>
              <span style={{ minWidth: 22, textAlign: 'center' }}>{c.qty}</span>
              <button className="qbtn" onClick={() => setQty(c.product.id, c.qty + 1)}>+</button>
              <div style={{ minWidth: 80, textAlign: 'right', fontWeight: 700 }}>{money(c.product.price * c.qty)}</div>
            </div>
          ))}

          <div className="total">Разом: {money(total)}</div>
          <div className="muted" style={{ marginTop: -10, marginBottom: 12 }}>Прибуток: {money(profit)}</div>

          <select value={customer} onChange={e => setCustomer(e.target.value)} style={{ marginBottom: 10 }}>
            <option value="">Без клієнта</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={payment} onChange={e => setPayment(e.target.value)} style={{ marginBottom: 10 }}>
            <option>Готівка</option><option>Картка</option><option>Переказ</option><option>Накладений платіж</option>
          </select>
          <input className="input" placeholder="Примітка" value={note} onChange={e => setNote(e.target.value)} style={{ marginBottom: 12 }} />

          <button className="green" style={{ width: '100%' }} disabled={cart.length === 0 || busy} onClick={checkout}>
            {busy ? 'Оформлення…' : `Оформити продаж · ${money(total)}`}
          </button>
        </div>
      </div>
    </>
  );
}
