'use client';
import { useEffect, useState } from 'react';
import { supabase, money, todayISO, exportCSV, type Expense } from '../../lib/supabase';
import { useShop } from '../../lib/shop';

const CATS = ['Реклама', 'Оренда', 'Зарплата', 'Бухгалтер', 'Закупівля', 'Доставка', 'Податки', 'Інше'];

export default function ExpensesPage() {
  const { slug: shop, currency } = useShop();
  const mm = (v: number) => money(v, currency);
  const [list, setList] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ category: 'Реклама', amount: '', description: '', spent_at: todayISO() });
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accId, setAccId] = useState('');
  const [edit, setEdit] = useState<Expense | null>(null);

  useEffect(() => { load(); }, [shop]);

  async function load() {
    setLoading(true);
    const [{ data }, { data: accs }] = await Promise.all([
      supabase.from('expenses').select('*').eq('shop', shop).order('spent_at', { ascending: false }).limit(300),
      supabase.from('accounts').select('id,name,currency').eq('shop', shop).eq('archived', false).order('created_at'),
    ]);
    setList(data || []); setAccounts(accs || []);
    if ((accs || []).length && !accId) setAccId(String(accs![0].id));
    setLoading(false);
  }

  async function add() {
    setErr('');
    if (!form.amount) return setErr('Вкажіть суму');
    const { data: exp, error } = await supabase.from('expenses').insert({
      shop,
      category: form.category, amount: Number(form.amount),
      description: form.description || null, spent_at: form.spent_at,
      account_id: accId ? Number(accId) : null,
    }).select('id').single();
    if (error) return setErr(error.message);
    // рух коштів: витрата з обраного рахунку
    if (accId && exp) {
      await supabase.from('account_moves').insert({
        shop, account_id: Number(accId), amount: -Number(form.amount), kind: 'expense',
        note: `${form.category}${form.description ? ' — ' + form.description : ''}`,
        ref_expense_id: exp.id, created_at: form.spent_at,
      });
    }
    setForm({ category: 'Реклама', amount: '', description: '', spent_at: todayISO() }); load();
  }

  async function del(e: Expense) {
    if (!confirm('Видалити витрату?')) return;
    await supabase.from('expenses').delete().eq('id', e.id); load();
  }

  async function saveEdit() {
    if (!edit) return;
    await supabase.from('expenses').update({
      category: edit.category, amount: Number(edit.amount),
      description: edit.description, spent_at: edit.spent_at,
    }).eq('id', edit.id);
    setEdit(null); load();
  }

  function exportExpenses() {
    exportCSV(`vytraty_${todayISO()}.csv`, list.map(e => ({
      'Дата': e.spent_at, 'Категорія': e.category,
      'Сума': Number(e.amount).toFixed(2), 'Опис': e.description || '',
    })));
  }

  const total = list.reduce((a, e) => a + Number(e.amount), 0);

  if (loading) return <div className="loading">Завантаження…</div>;

  return (
    <>
      <h2>Витрати</h2>
      <p className="muted">Усього у списку: {mm(total)}</p>
      {err && <div className="err">{err}</div>}

      <div className="form">
        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
          {CATS.map(c => <option key={c}>{c}</option>)}
        </select>
        <input className="input" type="number" placeholder="Сума" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
        <input className="input" type="date" value={form.spent_at} onChange={e => setForm({ ...form, spent_at: e.target.value })} />
        <input className="input" placeholder="Опис" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        {accounts.length > 0 && (
          <select value={accId} onChange={e => setAccId(e.target.value)}>
            <option value="">— без рахунку —</option>
            {accounts.map(a => <option key={a.id} value={a.id}>З: {a.name} ({a.currency})</option>)}
          </select>
        )}
        <button onClick={add}>Додати витрату</button>
      </div>

      <div className="row">
        <button className="ghost" onClick={exportExpenses}>Експорт CSV</button>
      </div>

      <table>
        <thead><tr><th>Дата</th><th>Категорія</th><th>Сума</th><th>Опис</th><th></th></tr></thead>
        <tbody>
          {list.length === 0 && <tr><td colSpan={5} className="muted">Немає витрат</td></tr>}
          {list.map(e => (edit && edit.id === e.id) ? (
            <tr key={e.id}>
              <td><input className="input" type="date" value={edit!.spent_at} onChange={ev => setEdit({ ...edit!, spent_at: ev.target.value })} /></td>
              <td>
                <select value={edit!.category} onChange={ev => setEdit({ ...edit!, category: ev.target.value })}>
                  {CATS.map(c => <option key={c}>{c}</option>)}
                </select>
              </td>
              <td><input className="input" type="number" style={{ width: 100 }} value={edit!.amount} onChange={ev => setEdit({ ...edit!, amount: Number(ev.target.value) })} /></td>
              <td><input className="input" value={edit!.description ?? ''} onChange={ev => setEdit({ ...edit!, description: ev.target.value })} /></td>
              <td className="actions"><div className="cell-actions">
                <button className="green" onClick={saveEdit}>✓</button>
                <button className="ghost" onClick={() => setEdit(null)}>✕</button>
              </div></td>
            </tr>
          ) : (
            <tr key={e.id}>
              <td data-label="Дата">{e.spent_at}</td>
              <td data-label="Категорія"><span className="tag">{e.category}</span></td>
              <td data-label="Сума" style={{ color: '#dc2626' }}>{mm(e.amount)}</td>
              <td data-label="Опис">{e.description || '—'}</td>
              <td className="actions" data-label="Дії"><div className="cell-actions">
                <button className="ghost" onClick={() => setEdit(e)}>✎</button>
                <button className="danger" onClick={() => del(e)}>🗑</button>
              </div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
