'use client';
import { useEffect, useState } from 'react';
import { supabase, money, todayISO, type Expense } from '../../lib/supabase';

const CATS = ['Реклама', 'Оренда', 'Зарплата', 'Бухгалтер', 'Закупівля', 'Доставка', 'Податки', 'Інше'];

export default function ExpensesPage() {
  const [list, setList] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ category: 'Реклама', amount: '', description: '', spent_at: todayISO() });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('expenses').select('*').order('spent_at', { ascending: false }).limit(300);
    setList(data || []); setLoading(false);
  }

  async function add() {
    setErr('');
    if (!form.amount) return setErr('Вкажіть суму');
    const { error } = await supabase.from('expenses').insert({
      category: form.category, amount: Number(form.amount),
      description: form.description || null, spent_at: form.spent_at,
    });
    if (error) return setErr(error.message);
    setForm({ category: 'Реклама', amount: '', description: '', spent_at: todayISO() }); load();
  }

  async function del(e: Expense) {
    if (!confirm('Видалити витрату?')) return;
    await supabase.from('expenses').delete().eq('id', e.id); load();
  }

  const total = list.reduce((a, e) => a + Number(e.amount), 0);

  if (loading) return <div className="loading">Завантаження…</div>;

  return (
    <>
      <h2>Витрати</h2>
      <p className="muted">Усього у списку: {money(total)}</p>
      {err && <div className="err">{err}</div>}

      <div className="form">
        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
          {CATS.map(c => <option key={c}>{c}</option>)}
        </select>
        <input className="input" type="number" placeholder="Сума" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
        <input className="input" type="date" value={form.spent_at} onChange={e => setForm({ ...form, spent_at: e.target.value })} />
        <input className="input" placeholder="Опис" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        <button onClick={add}>Додати витрату</button>
      </div>

      <table>
        <thead><tr><th>Дата</th><th>Категорія</th><th>Сума</th><th>Опис</th><th></th></tr></thead>
        <tbody>
          {list.length === 0 && <tr><td colSpan={5} className="muted">Немає витрат</td></tr>}
          {list.map(e => (
            <tr key={e.id}>
              <td>{e.spent_at}</td>
              <td><span className="tag">{e.category}</span></td>
              <td style={{ color: '#dc2626' }}>{money(e.amount)}</td>
              <td>{e.description || '—'}</td>
              <td><button className="danger" onClick={() => del(e)}>🗑</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
