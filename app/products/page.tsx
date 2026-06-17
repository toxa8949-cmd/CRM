'use client';
import { useEffect, useState } from 'react';
import { supabase, money, brutto, net, taxRate, type Product, type Category } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

export default function ProductsPage() {
  const { role } = useAuth();
  const owner = role === 'owner';
  const [products, setProducts] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [fCat, setFCat] = useState('');
  const [fStock, setFStock] = useState('');     // '', 'low', 'out', 'in'
  const [showForm, setShowForm] = useState(false);
  // ціна продажу в формі — брутто
  const [form, setForm] = useState({ name: '', category_id: '', sku: '', stock: '', purchase: '', priceBrutto: '', low_stock: '2', kind: 'Товар', extra_cost: '' });
  const [edit, setEdit] = useState<Product | null>(null);
  const [editBrutto, setEditBrutto] = useState(''); // ціна брутто в режимі редагування

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const tableP = owner ? 'products' : 'products_safe';
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from(tableP).select('*,categories(name)').order('name'),
      supabase.from('categories').select('*').order('name'),
    ]);
    setProducts(p || []); setCats(c || []); setLoading(false);
  }

  async function add() {
    setErr('');
    if (!form.name.trim()) return setErr('Вкажіть назву товару');
    const priceNet = form.priceBrutto ? Math.round(net(Number(form.priceBrutto)) * 100) / 100 : 0;
    const { error } = await supabase.from('products').insert({
      name: form.name.trim(),
      category_id: form.category_id ? Number(form.category_id) : null,
      sku: form.sku || null,
      stock: Number(form.stock) || 0,
      purchase: Number(form.purchase) || 0,
      price: priceNet,
      low_stock: Number(form.low_stock) || 2,
      kind: form.kind,
      extra_cost: Number(form.extra_cost) || 0,
    });
    if (error) return setErr(error.message);
    setForm({ name: '', category_id: '', sku: '', stock: '', purchase: '', priceBrutto: '', low_stock: '2', kind: 'Товар', extra_cost: '' });
    setShowForm(false);
    load();
  }

  function startEdit(p: Product) {
    setEdit(p);
    setEditBrutto(brutto(p.price).toFixed(2));
  }

  async function saveEdit() {
    if (!edit) return;
    const priceNet = editBrutto ? Math.round(net(Number(editBrutto)) * 100) / 100 : edit.price;
    const { error } = await supabase.from('products').update({
      name: edit.name, category_id: edit.category_id, sku: edit.sku,
      stock: edit.stock, purchase: edit.purchase, price: priceNet, low_stock: edit.low_stock,
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
    await supabase.rpc('receive_stock', { p_product_id: p.id, p_qty: qty, p_purchase: pur, p_extra_cost: 0 });
    load();
  }

  async function del(p: Product) {
    if (!confirm(`Видалити "${p.name}"?`)) return;
    await supabase.from('products').delete().eq('id', p.id);
    load();
  }

  const filtered = products.filter(p => {
    if (search && !(p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku || '').toLowerCase().includes(search.toLowerCase()))) return false;
    if (fCat && String(p.category_id || '') !== fCat) return false;
    if (fStock === 'low' && !(p.stock > 0 && p.stock <= p.low_stock)) return false;
    if (fStock === 'out' && p.stock > 0) return false;
    if (fStock === 'in' && p.stock <= 0) return false;
    return true;
  });

  // підсумки
  const totalPurchase = products.reduce((a, p) => a + p.stock * Number(p.purchase), 0);
  const totalRetail = products.reduce((a, p) => a + p.stock * Number(p.price), 0);
  const lowCount = products.filter(p => p.stock > 0 && p.stock <= p.low_stock).length;
  const outCount = products.filter(p => p.stock <= 0).length;

  function stockBadge(p: Product) {
    if (p.stock <= 0) return <span className="badge out">Немає</span>;
    if (p.stock <= p.low_stock) return <span className="badge low">Мало ({p.stock})</span>;
    return <span className="badge ok">{p.stock} шт</span>;
  }

  if (loading) return <div className="loading">Завантаження…</div>;

  return (
    <>
      <h2>Склад</h2>
      <p className="muted">Каталог товарів та залишки</p>
      {err && <div className="err">{err}</div>}

      {/* Підсумки */}
      <div className="grid">
        <div className="card"><h3>Позицій</h3><div className="value">{products.length}</div></div>
        {owner && <div className="card"><h3>Вартість (закупка)</h3><div className="value">{money(totalPurchase)}</div></div>}
        <div className="card"><h3>Вартість (роздріб)</h3><div className="value blue">{money(totalRetail)}</div></div>
        <div className="card"><h3>Закінчується / немає</h3>
          <div className="value"><span style={{ color: lowCount ? '#d97706' : '#9ca3af' }}>{lowCount}</span> <span className="muted">/</span> <span style={{ color: outCount ? '#dc2626' : '#9ca3af' }}>{outCount}</span></div>
        </div>
      </div>

      {/* Панель фільтрів + кнопка додавання */}
      <div className="row">
        <input className="input" style={{ maxWidth: 280 }} placeholder="Пошук за назвою / SKU" value={search} onChange={e => setSearch(e.target.value)} />
        <select value={fCat} onChange={e => setFCat(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="">Усі категорії</option>
          {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={fStock} onChange={e => setFStock(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="">Будь-який залишок</option>
          <option value="in">В наявності</option>
          <option value="low">Закінчується</option>
          <option value="out">Немає</option>
        </select>
        <span className="muted">{filtered.length} поз.</span>
        {owner && <button style={{ marginLeft: 'auto' }} onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Сховати' : '+ Додати товар'}
        </button>}
      </div>

      {/* Форма додавання — згорнута */}
      {showForm && (
        <div className="form" style={{ marginTop: 4 }}>
          <input className="input" placeholder="Назва товару" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
            <option value="">Без категорії</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="input" placeholder="Артикул (SKU)" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
          <input className="input" type="number" placeholder="Закупка нетто" value={form.purchase} onChange={e => setForm({ ...form, purchase: e.target.value })} />
          <input className="input" type="number" placeholder="Ціна продажу БРУТТО" value={form.priceBrutto} onChange={e => setForm({ ...form, priceBrutto: e.target.value })} />
          <input className="input" type="number" placeholder="Розтрати на од." value={form.extra_cost} onChange={e => setForm({ ...form, extra_cost: e.target.value })} />
          <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>
            <option value="Товар">Товар (3%)</option>
            <option value="Послуга">Послуга (8%)</option>
          </select>
          <input className="input" type="number" placeholder="Кількість" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
          <button className="green" onClick={add}>Додати</button>
        </div>
      )}

      <table style={{ marginTop: 16 }}>
        <thead><tr><th>Назва</th><th>Категорія</th><th>Залишок</th>{owner && <th>Закупка</th>}<th>Ціна продажу</th>{owner && <th>Чистий/од.</th>}{owner && <th></th>}</tr></thead>
        <tbody>
          {filtered.length === 0 && <tr><td colSpan={owner ? 7 : 4} className="muted">Нічого не знайдено</td></tr>}
          {filtered.map(p => (owner && edit && edit.id === p.id) ? (
            <tr key={p.id}>
              <td><input className="input" value={edit!.name} onChange={e => setEdit({ ...edit!, name: e.target.value })} /></td>
              <td>
                <select value={edit!.category_id ?? ''} onChange={e => setEdit({ ...edit!, category_id: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">—</option>
                  {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </td>
              <td><input className="input" type="number" style={{ width: 70 }} value={edit!.stock} onChange={e => setEdit({ ...edit!, stock: Number(e.target.value) })} /></td>
              <td><input className="input" type="number" style={{ width: 90 }} value={edit!.purchase} onChange={e => setEdit({ ...edit!, purchase: Number(e.target.value) })} /></td>
              <td>
                <input className="input" type="number" style={{ width: 100 }} placeholder="брутто" value={editBrutto} onChange={e => setEditBrutto(e.target.value)} />
                <div className="muted" style={{ fontSize: 11 }}>{editBrutto ? money(net(Number(editBrutto))) + ' нетто' : ''}</div>
              </td>
              <td>—</td>
              <td style={{ display: 'flex', gap: 6 }}>
                <button className="green" onClick={saveEdit}>✓</button>
                <button className="ghost" onClick={() => setEdit(null)}>✕</button>
              </td>
            </tr>
          ) : (
            <tr key={p.id}>
              <td>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {p.sku ? p.sku + ' · ' : ''}{p.kind === 'Послуга' ? 'Послуга 8%' : 'Товар 3%'}
                </div>
              </td>
              <td>{p.categories?.name || <span className="muted">—</span>}</td>
              <td>{stockBadge(p)}</td>
              {owner && <td>{money(p.purchase)}{p.extra_cost ? <div className="muted" style={{ fontSize: 11 }}>+{money(p.extra_cost)} дост.</div> : null}</td>}
              <td>
                <div style={{ fontWeight: 600 }}>{money(brutto(p.price))}</div>
                <div className="muted" style={{ fontSize: 11 }}>{money(p.price)} нетто</div>
              </td>
              {owner && <td style={{ color: '#16a34a', fontWeight: 600 }}>
                {money(p.price - p.purchase - (p.extra_cost || 0) - p.price * taxRate(p.kind) / 100)}
              </td>}
              {owner && <td style={{ display: 'flex', gap: 6 }}>
                <button className="ghost" onClick={() => receive(p)} title="Надходження">+склад</button>
                <button className="ghost" onClick={() => startEdit(p)}>✎</button>
                <button className="danger" onClick={() => del(p)}>🗑</button>
              </td>}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
