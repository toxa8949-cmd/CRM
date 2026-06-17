'use client';
import { useEffect, useState } from 'react';
import { supabase, money, brutto, taxRate, type Product, type Category } from '../../lib/supabase';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', category_id: '', sku: '', stock: '', purchase: '', price: '', low_stock: '2', kind: 'Товар', extra_cost: '' });
  const [edit, setEdit] = useState<Product | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from('products').select('*,categories(name)').order('name'),
      supabase.from('categories').select('*').order('name'),
    ]);
    setProducts(p || []); setCats(c || []); setLoading(false);
  }

  async function add() {
    setErr('');
    if (!form.name.trim()) return setErr('Вкажіть назву товару');
    const { error } = await supabase.from('products').insert({
      name: form.name.trim(),
      category_id: form.category_id ? Number(form.category_id) : null,
      sku: form.sku || null,
      stock: Number(form.stock) || 0,
      purchase: Number(form.purchase) || 0,
      price: Number(form.price) || 0,
      low_stock: Number(form.low_stock) || 2,
      kind: form.kind,
      extra_cost: Number(form.extra_cost) || 0,
    });
    if (error) return setErr(error.message);
    setForm({ name: '', category_id: '', sku: '', stock: '', purchase: '', price: '', low_stock: '2', kind: 'Товар', extra_cost: '' });
    load();
  }

  async function saveEdit() {
    if (!edit) return;
    const { error } = await supabase.from('products').update({
      name: edit.name, category_id: edit.category_id, sku: edit.sku,
      stock: edit.stock, purchase: edit.purchase, price: edit.price, low_stock: edit.low_stock,
      kind: edit.kind, extra_cost: edit.extra_cost,
    }).eq('id', edit.id);
    if (error) return setErr(error.message);
    setEdit(null); load();
  }

  async function receive(p: Product) {
    const qty = Number(prompt(`Надходження "${p.name}". Скільки додати на склад?`, '1'));
    if (!qty || qty <= 0) return;
    const pur = Number(prompt(`Закупка нетто за одиницю (партія FIFO):`, String(p.purchase)));
    if (pur < 0 || isNaN(pur)) return;
    await supabase.rpc('receive_stock', {
      p_product_id: p.id, p_qty: qty, p_purchase: pur, p_extra_cost: 0,
    });
    load();
  }

  async function del(p: Product) {
    if (!confirm(`Видалити "${p.name}"?`)) return;
    await supabase.from('products').delete().eq('id', p.id);
    load();
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku || '').toLowerCase().includes(search.toLowerCase())
  );

  function stockBadge(p: Product) {
    if (p.stock <= 0) return <span className="badge out">Немає</span>;
    if (p.stock <= p.low_stock) return <span className="badge low">Мало ({p.stock})</span>;
    return <span className="badge ok">{p.stock}</span>;
  }

  if (loading) return <div className="loading">Завантаження…</div>;

  return (
    <>
      <h2>Склад</h2>
      <p className="muted">Каталог товарів та залишки</p>
      {err && <div className="err">{err}</div>}

      <div className="form">
        <input className="input" placeholder="Назва товару" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
          <option value="">Без категорії</option>
          {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className="input" placeholder="Артикул (SKU)" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
        <input className="input" type="number" placeholder="Закупка нетто" value={form.purchase} onChange={e => setForm({ ...form, purchase: e.target.value })} />
        <input className="input" type="number" placeholder="Ціна продажу нетто" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
        <input className="input" type="number" placeholder="Розтрати на од." value={form.extra_cost} onChange={e => setForm({ ...form, extra_cost: e.target.value })} />
        <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>
          <option value="Товар">Товар (3%)</option>
          <option value="Послуга">Послуга (8%)</option>
        </select>
        <input className="input" type="number" placeholder="Кількість" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
        <button onClick={add}>Додати товар</button>
      </div>

      <div className="row">
        <input className="input" style={{ maxWidth: 320 }} placeholder="Пошук за назвою / SKU" value={search} onChange={e => setSearch(e.target.value)} />
        <span className="muted">{filtered.length} поз.</span>
      </div>

      <table>
        <thead><tr><th>Назва</th><th>Тип</th><th>Залишок</th><th>Закупка нетто</th><th>Продаж нетто</th><th>Брутто</th><th>Розтрати</th><th>Чистий/од.</th><th></th></tr></thead>
        <tbody>
          {filtered.map(p => (edit && edit.id === p.id) ? (
            <tr key={p.id}>
              <td><input className="input" value={edit!.name} onChange={e => setEdit({ ...edit!, name: e.target.value })} /></td>
              <td>
                <select value={edit!.kind} onChange={e => setEdit({ ...edit!, kind: e.target.value })}>
                  <option value="Товар">Товар (3%)</option>
                  <option value="Послуга">Послуга (8%)</option>
                </select>
              </td>
              <td><input className="input" type="number" style={{ width: 70 }} value={edit!.stock} onChange={e => setEdit({ ...edit!, stock: Number(e.target.value) })} /></td>
              <td><input className="input" type="number" style={{ width: 90 }} value={edit!.purchase} onChange={e => setEdit({ ...edit!, purchase: Number(e.target.value) })} /></td>
              <td><input className="input" type="number" style={{ width: 90 }} value={edit!.price} onChange={e => setEdit({ ...edit!, price: Number(e.target.value) })} /></td>
              <td>{money(brutto(edit!.price))}</td>
              <td><input className="input" type="number" style={{ width: 80 }} value={edit!.extra_cost} onChange={e => setEdit({ ...edit!, extra_cost: Number(e.target.value) })} /></td>
              <td>—</td>
              <td style={{ display: 'flex', gap: 6 }}>
                <button className="green" onClick={saveEdit}>✓</button>
                <button className="ghost" onClick={() => setEdit(null)}>✕</button>
              </td>
            </tr>
          ) : (
            <tr key={p.id}>
              <td>{p.name}{p.sku && <div className="muted" style={{ fontSize: 12 }}>{p.sku}</div>}</td>
              <td><span className="tag">{p.kind === 'Послуга' ? 'Послуга 8%' : 'Товар 3%'}</span></td>
              <td>{stockBadge(p)}</td>
              <td>{money(p.purchase)}</td>
              <td>{money(p.price)}</td>
              <td className="muted">{money(brutto(p.price))}</td>
              <td>{p.extra_cost ? money(p.extra_cost) : '—'}</td>
              <td style={{ color: '#16a34a', fontWeight: 600 }}>
                {money(p.price - p.purchase - p.extra_cost - p.price * taxRate(p.kind) / 100)}
              </td>
              <td style={{ display: 'flex', gap: 6 }}>
                <button className="ghost" onClick={() => receive(p)} title="Надходження">+склад</button>
                <button className="ghost" onClick={() => setEdit(p)}>✎</button>
                <button className="danger" onClick={() => del(p)}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
