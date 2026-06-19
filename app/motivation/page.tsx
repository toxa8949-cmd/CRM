'use client';
import { useEffect, useState } from 'react';
import { supabase, money } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useShop } from '../../lib/shop';

export default function MotivationPage() {
  const { slug: shop, currency } = useShop();
  const mm = (v: number) => money(v, currency);
  const { role, email } = useAuth();
  const owner = role === 'owner';
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  // форма ручного промокод-бонусу (для продавця — собі; для власника — будь-кому)
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [forEmail, setForEmail] = useState('');

  // фільтр місяця
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => { if (role) load(); }, [role, month]);

  async function load() {
    setLoading(true);
    const from = month + '-01';
    // перший день наступного місяця — надійна верхня межа для будь-якого місяця
    const [y, m] = month.split('-').map(Number);
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const { data, error } = await supabase.from('bonuses').select('*').eq('shop', shop)
      .gte('created_at', from).lt('created_at', next)
      .order('created_at', { ascending: false });
    if (error) setErr(error.message);
    setRows(data || []);
    setLoading(false);
  }

  async function addPromo() {
    setErr('');
    const amt = Number(amount);
    if (!amt || amt <= 0) return setErr('Вкажіть суму бонусу');

    // визначаємо, кому нараховуємо
    let sellerId: string | null = null;
    let sellerEmail = email;
    const { data: { user } } = await supabase.auth.getUser();
    sellerId = user?.id ?? null;

    if (owner) {
      // власник нараховує конкретному продавцю за email — шукаємо його бонуси,
      // але простіше: власник вписує email вручну, seller_id лишаємо null + email
      if (!forEmail.trim()) return setErr('Вкажіть email продавця');
      sellerEmail = forEmail.trim();
      sellerId = null; // власник нараховує за email (RLS owner дозволяє)
    }

    const { error } = await supabase.from('bonuses').insert({
      shop,
      seller_id: sellerId,
      seller_email: sellerEmail,
      kind: 'promo',
      amount: amt,
      note: note.trim() || 'Промокод',
    });
    if (error) return setErr(error.message);
    setAmount(''); setNote(''); setForEmail('');
    load();
  }

  async function del(id: number) {
    if (!confirm('Видалити бонус?')) return;
    await supabase.from('bonuses').delete().eq('id', id);
    load();
  }

  // підсумки
  const total = rows.reduce((a, r) => a + Number(r.amount), 0);
  const accTotal = rows.filter(r => r.kind === 'accessory').reduce((a, r) => a + Number(r.amount), 0);
  const promoTotal = rows.filter(r => r.kind === 'promo').reduce((a, r) => a + Number(r.amount), 0);

  // для власника — групування по продавцях
  const bySeller: Record<string, number> = {};
  rows.forEach(r => { const k = r.seller_email || '—'; bySeller[k] = (bySeller[k] || 0) + Number(r.amount); });

  if (loading) return <div className="loading">Завантаження…</div>;

  return (
    <>
      <h2>Мотивація</h2>
      <p className="muted">Бонуси за продажі: 5% за аксесуари (авто) + ручні бонуси по промокоду</p>
      {err && <div className="err">{err}</div>}

      <div className="row">
        <label className="muted">Місяць:</label>
        <input className="input" type="month" style={{ maxWidth: 180 }} value={month} onChange={e => setMonth(e.target.value)} />
      </div>

      {/* Підсумки */}
      <div className="grid">
        <div className="card"><h3>Всього за місяць</h3><div className="value green">{mm(total)}</div></div>
        <div className="card"><h3>Аксесуари (5%)</h3><div className="value">{mm(accTotal)}</div></div>
        <div className="card"><h3>Промокоди</h3><div className="value">{mm(promoTotal)}</div></div>
      </div>

      {/* Власник: розбивка по продавцях */}
      {owner && Object.keys(bySeller).length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3>За продавцями</h3>
          {Object.entries(bySeller).map(([em, sum]) => (
            <div key={em} className="stock-row"><span>{em}</span><b style={{ color: '#16a34a' }}>{mm(sum)}</b></div>
          ))}
        </div>
      )}

      {/* Додати ручний промокод-бонус */}
      <div className="form" style={{ gridTemplateColumns: owner ? '1fr 1fr 1fr auto' : '1fr 1fr auto' }}>
        {owner && <input className="input" placeholder="Email продавця" value={forEmail} onChange={e => setForEmail(e.target.value)} />}
        <input className="input" type="number" placeholder="Сума бонусу (zł)" value={amount} onChange={e => setAmount(e.target.value)} />
        <input className="input" placeholder="Коментар (товар / промокод)" value={note} onChange={e => setNote(e.target.value)} />
        <button className="green" onClick={addPromo}>+ Бонус</button>
      </div>

      <table>
        <thead><tr><th>Дата</th>{owner && <th>Продавець</th>}<th>Тип</th><th>Сума</th><th>Коментар</th>{owner && <th></th>}</tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={owner ? 6 : 4} className="muted">Немає бонусів за цей місяць</td></tr>}
          {rows.map(r => (
            <tr key={r.id}>
              <td data-label="Дата">{new Date(r.created_at).toLocaleString('uk-UA')}</td>
              {owner && <td data-label="Продавець">{r.seller_email || '—'}</td>}
              <td data-label="Тип">{r.kind === 'accessory'
                ? <span className="badge ok">Аксесуар 5%</span>
                : <span className="tag">Промокод</span>}</td>
              <td data-label="Сума" style={{ color: '#16a34a', fontWeight: 600 }}>{mm(r.amount)}</td>
              <td data-label="Коментар">{r.note || '—'}</td>
              {owner && <td className="actions" data-label="Дії"><button className="danger" onClick={() => del(r.id)}>🗑</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
