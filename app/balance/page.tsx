'use client';
import { useEffect, useState } from 'react';
import { supabase, money } from '../../lib/supabase';
import { useShop } from '../../lib/shop';

export default function BalancePage() {
  const { slug: shop } = useShop();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [moves, setMoves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // форма нового рахунку
  const [accName, setAccName] = useState('');
  const [accCur, setAccCur] = useState('₴');

  // форма руху коштів
  const [mvAcc, setMvAcc] = useState('');
  const [mvType, setMvType] = useState<'in' | 'out'>('in');
  const [mvAmount, setMvAmount] = useState('');
  const [mvNote, setMvNote] = useState('');

  useEffect(() => { load(); }, [shop]);

  async function load() {
    setLoading(true);
    const [{ data: accs }, { data: mvs }] = await Promise.all([
      supabase.from('accounts').select('*').eq('shop', shop).eq('archived', false).order('created_at'),
      supabase.from('account_moves').select('*,accounts(name,currency)').eq('shop', shop).order('created_at', { ascending: false }).limit(200),
    ]);
    // баланс кожного рахунку
    const withBal = await Promise.all((accs || []).map(async (a) => {
      const { data } = await supabase.from('account_moves').select('amount').eq('account_id', a.id);
      const bal = (data || []).reduce((s, m) => s + Number(m.amount), 0);
      return { ...a, balance: bal };
    }));
    setAccounts(withBal);
    setMoves(mvs || []);
    setLoading(false);
  }

  async function addAccount() {
    setErr('');
    if (!accName.trim()) return setErr('Вкажіть назву рахунку');
    const { error } = await supabase.from('accounts').insert({
      shop, name: accName.trim(), currency: accCur.trim() || '₴',
    });
    if (error) return setErr(error.message);
    setAccName(''); setAccCur('₴'); load();
  }

  async function archiveAccount(a: any) {
    if (!confirm(`Архівувати рахунок "${a.name}"? Історія руху збережеться.`)) return;
    await supabase.from('accounts').update({ archived: true }).eq('id', a.id);
    load();
  }

  async function addMove() {
    setErr('');
    if (!mvAcc) return setErr('Оберіть рахунок');
    const amt = Number(mvAmount);
    if (!amt || amt <= 0) return setErr('Вкажіть суму');
    const signed = mvType === 'in' ? amt : -amt;
    const { error } = await supabase.from('account_moves').insert({
      shop, account_id: Number(mvAcc), amount: signed, kind: 'manual',
      note: mvNote.trim() || (mvType === 'in' ? 'Надходження' : 'Витрата'),
    });
    if (error) return setErr(error.message);
    setMvAmount(''); setMvNote(''); load();
  }

  async function delMove(id: number) {
    if (!confirm('Видалити цей рух коштів? Якщо це витрата — вона теж зникне.')) return;
    await supabase.rpc('delete_account_move', { p_move_id: id });
    load();
  }

  const curOf = (id: number) => accounts.find(a => a.id === id)?.currency || '₴';

  if (loading) return <div className="loading">Завантаження…</div>;

  return (
    <>
      <h2>Баланс</h2>
      <p className="muted">Рахунки та рух коштів. Кожен рахунок — своя валюта.</p>
      {err && <div className="err">{err}</div>}

      {/* Картки рахунків із балансами */}
      <div className="grid">
        {accounts.length === 0 && <div className="card"><h3>Немає рахунків</h3><div className="muted">Створіть перший рахунок нижче</div></div>}
        {accounts.map(a => (
          <div key={a.id} className="card" style={{ position: 'relative' }}>
            <h3>{a.name}</h3>
            <div className={'value ' + (a.balance >= 0 ? 'green' : 'red')}>{money(a.balance, a.currency)}</div>
            <button className="ghost" style={{ position: 'absolute', top: 12, right: 12, padding: '4px 8px', fontSize: 12 }}
              onClick={() => archiveAccount(a)}>архів</button>
          </div>
        ))}
      </div>

      {/* Додати рахунок */}
      <h3 style={{ marginTop: 24 }}>Новий рахунок</h3>
      <div className="form" style={{ gridTemplateColumns: '2fr 1fr auto' }}>
        <input className="input" placeholder="Назва (Готівка, Долари, ПриватБанк…)" value={accName} onChange={e => setAccName(e.target.value)} />
        <select value={accCur} onChange={e => setAccCur(e.target.value)}>
          <option value="₴">₴ гривня</option>
          <option value="$">$ долар</option>
          <option value="€">€ євро</option>
          <option value="zł">zł злотий</option>
        </select>
        <button onClick={addAccount}>Додати рахунок</button>
      </div>

      {/* Рух коштів вручну */}
      {accounts.length > 0 && (
        <>
          <h3 style={{ marginTop: 8 }}>Рух коштів</h3>
          <div className="form" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 2fr auto' }}>
            <select value={mvAcc} onChange={e => setMvAcc(e.target.value)}>
              <option value="">— рахунок —</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
            </select>
            <select value={mvType} onChange={e => setMvType(e.target.value as any)}>
              <option value="in">↑ Надходження</option>
              <option value="out">↓ Витрата</option>
            </select>
            <input className="input" type="number" placeholder="Сума" value={mvAmount} onChange={e => setMvAmount(e.target.value)} />
            <input className="input" placeholder="Опис (за що / звідки)" value={mvNote} onChange={e => setMvNote(e.target.value)} />
            <button className={mvType === 'in' ? 'green' : 'danger'} onClick={addMove}>Додати</button>
          </div>
        </>
      )}

      {/* Історія рухів */}
      <h3 style={{ marginTop: 8 }}>Останні рухи</h3>
      <table>
        <thead><tr><th>Дата</th><th>Рахунок</th><th>Сума</th><th>Тип</th><th>Опис</th><th></th></tr></thead>
        <tbody>
          {moves.length === 0 && <tr><td colSpan={6} className="muted">Рухів ще немає</td></tr>}
          {moves.map(m => (
            <tr key={m.id}>
              <td data-label="Дата">{new Date(m.created_at).toLocaleString('uk-UA')}</td>
              <td data-label="Рахунок">{m.accounts?.name || '—'}</td>
              <td data-label="Сума" style={{ color: Number(m.amount) >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                {Number(m.amount) >= 0 ? '+' : ''}{money(Number(m.amount), m.accounts?.currency || '₴')}
              </td>
              <td data-label="Тип">
                {m.kind === 'sale' ? <span className="badge ok">Продаж</span>
                  : m.kind === 'expense' ? <span className="badge out">Витрата</span>
                  : <span className="tag">Вручну</span>}
              </td>
              <td data-label="Опис">{m.note || '—'}</td>
              <td className="actions" data-label="Дії"><div className="cell-actions">
                {m.kind !== 'sale' && <button className="danger" onClick={() => delMove(m.id)}>🗑</button>}
              </div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
