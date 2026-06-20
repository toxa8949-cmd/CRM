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

  // прапор "це рахунок-борг" при створенні
  const [accDebt, setAccDebt] = useState(false);

  // переказ між рахунками
  const [trFrom, setTrFrom] = useState('');
  const [trTo, setTrTo] = useState('');
  const [trAmount, setTrAmount] = useState('');
  const [trNote, setTrNote] = useState('');

  // UI: вкладка операції + згортання форми рахунку
  const [opTab, setOpTab] = useState<'move' | 'transfer'>('move');
  const [showNewAcc, setShowNewAcc] = useState(false);

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
      shop, name: accName.trim(), currency: accCur.trim() || '₴', is_debt: accDebt,
    });
    if (error) return setErr(error.message);
    setAccName(''); setAccCur('₴'); setAccDebt(false); load();
  }

  async function doTransfer() {
    setErr('');
    if (!trFrom || !trTo) return setErr('Оберіть обидва рахунки');
    if (trFrom === trTo) return setErr('Рахунки мають бути різні');
    const amt = Number(trAmount);
    if (!amt || amt <= 0) return setErr('Вкажіть суму');
    const { error } = await supabase.rpc('transfer_funds', {
      p_from: Number(trFrom), p_to: Number(trTo), p_amount: amt,
      p_shop: shop, p_note: trNote.trim() || null,
    });
    if (error) return setErr(error.message);
    setTrAmount(''); setTrNote(''); load();
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
    const defNote = mvAccIsDebt
      ? (mvType === 'in' ? 'Збільшення боргу' : 'Погашення боргу')
      : (mvType === 'in' ? 'Надходження' : 'Витрата');
    const { error } = await supabase.from('account_moves').insert({
      shop, account_id: Number(mvAcc), amount: signed, kind: 'manual',
      note: mvNote.trim() || defNote,
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
  const mvAccIsDebt = !!accounts.find(a => String(a.id) === mvAcc)?.is_debt;

  if (loading) return <div className="loading">Завантаження…</div>;

  return (
    <>
      <h2>Баланс</h2>
      {err && <div className="err">{err}</div>}

      {/* Картки рахунків — компактні */}
      <div className="bal-cards">
        {accounts.length === 0 && <div className="card"><h3>Немає рахунків</h3><div className="muted">Створіть рахунок нижче</div></div>}
        {accounts.map(a => (
          <div key={a.id} className="bal-card" style={{ borderLeft: a.is_debt ? '4px solid #d97706' : '4px solid #2563eb' }}>
            <div className="bal-card-top">
              <span className="bal-card-name">{a.name}{a.is_debt && ' (борг)'}</span>
              <button className="bal-arch" onClick={() => archiveAccount(a)}>архів</button>
            </div>
            <div className="bal-card-sum" style={{ color: a.is_debt ? (a.balance > 0 ? '#d97706' : '#16a34a') : (a.balance >= 0 ? '#16a34a' : '#dc2626') }}>
              {money(a.balance, a.currency)}
            </div>
            {a.is_debt && <span className="muted" style={{ fontSize: 11 }}>{a.balance > 0 ? 'треба віддати' : 'розраховано'}</span>}
          </div>
        ))}
      </div>

      {/* Операції: вкладки Рух / Переказ в одному блоці */}
      {accounts.length > 0 && (
        <div className="bal-ops">
          <div className="bal-tabs">
            <button className={opTab === 'move' ? 'on' : ''} onClick={() => setOpTab('move')}>Рух коштів</button>
            {accounts.length > 1 && <button className={opTab === 'transfer' ? 'on' : ''} onClick={() => setOpTab('transfer')}>Переказ</button>}
          </div>

          {opTab === 'move' && (
            <div className="bal-op-form">
              <select value={mvAcc} onChange={e => setMvAcc(e.target.value)}>
                <option value="">— рахунок —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
              </select>
              <select value={mvType} onChange={e => setMvType(e.target.value as any)}>
                {mvAccIsDebt
                  ? <>{<option value="in">↑ Збільшити борг</option>}<option value="out">↓ Погасити борг</option></>
                  : <>{<option value="in">↑ Надходження</option>}<option value="out">↓ Витрата</option></>}
              </select>
              <input className="input" type="number" placeholder="Сума" value={mvAmount} onChange={e => setMvAmount(e.target.value)} />
              <input className="input" placeholder="Опис" value={mvNote} onChange={e => setMvNote(e.target.value)} />
              <button className={mvType === 'in' ? 'green' : 'danger'} onClick={addMove}>Додати</button>
            </div>
          )}

          {opTab === 'transfer' && (
            <>
              <div className="bal-op-form">
                <select value={trFrom} onChange={e => setTrFrom(e.target.value)}>
                  <option value="">— звідки —</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                </select>
                <select value={trTo} onChange={e => setTrTo(e.target.value)}>
                  <option value="">— куди —</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                </select>
                <input className="input" type="number" placeholder="Сума" value={trAmount} onChange={e => setTrAmount(e.target.value)} />
                <input className="input" placeholder="Опис (напр. віддав Сергію)" value={trNote} onChange={e => setTrNote(e.target.value)} />
                <button onClick={doTransfer}>Переказати</button>
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Погасити борг: з «Готівка» → на «Борг Сергію». З першого виходить, на другий заходить.</p>
            </>
          )}
        </div>
      )}

      {/* Історія рухів */}
      <h3 style={{ marginTop: 20 }}>Останні рухи</h3>
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
                  : (m.kind === 'transfer_in' || m.kind === 'transfer_out') ? <span className="tag">Переказ</span>
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

      {/* Новий рахунок — згорнуто внизу (рідкісна дія) */}
      <div style={{ marginTop: 24 }}>
        <button className="ghost" onClick={() => setShowNewAcc(!showNewAcc)}>
          {showNewAcc ? '× Сховати' : '+ Новий рахунок'}
        </button>
        {showNewAcc && (
          <div className="bal-op-form" style={{ marginTop: 10 }}>
            <input className="input" placeholder="Назва (Готівка, Долари, ПриватБанк…)" value={accName} onChange={e => setAccName(e.target.value)} />
            <select value={accCur} onChange={e => setAccCur(e.target.value)}>
              <option value="₴">₴ гривня</option>
              <option value="$">$ долар</option>
              <option value="€">€ євро</option>
              <option value="zł">zł злотий</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={accDebt} onChange={e => setAccDebt(e.target.checked)} style={{ width: 'auto' }} />
              Рахунок-борг
            </label>
            <button onClick={addAccount}>Додати</button>
          </div>
        )}
      </div>
    </>
  );
}
