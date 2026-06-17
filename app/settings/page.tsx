'use client';
import { useEffect, useState } from 'react';
import { supabase, type Category } from '../../lib/supabase';

export default function SettingsPage() {
  const [cats, setCats] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('categories').select('*,products(id)').order('name');
    setCats((data || []).map((c: any) => ({ ...c, count: c.products?.length || 0 })));
    setLoading(false);
  }

  async function add() {
    setErr('');
    if (!name.trim()) return;
    const { error } = await supabase.from('categories').insert({ name: name.trim() });
    if (error) return setErr(error.message);
    setName(''); load();
  }

  async function del(c: Category & { count?: number }) {
    if (c.count) return setErr(`Не можна видалити "${c.name}": є товари (${c.count}). Спершу перенесіть їх.`);
    if (!confirm(`Видалити категорію "${c.name}"?`)) return;
    await supabase.from('categories').delete().eq('id', c.id); load();
  }

  if (loading) return <div className="loading">Завантаження…</div>;

  return (
    <>
      <h2>Категорії</h2>
      <p className="muted">Категорії товарів для складу</p>
      {err && <div className="err">{err}</div>}

      <div className="form" style={{ gridTemplateColumns: '1fr auto' }}>
        <input className="input" placeholder="Назва категорії" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
        <button onClick={add}>Додати</button>
      </div>

      <table>
        <thead><tr><th>Категорія</th><th>Товарів</th><th></th></tr></thead>
        <tbody>
          {cats.length === 0 && <tr><td colSpan={3} className="muted">Немає категорій</td></tr>}
          {cats.map(c => (
            <tr key={c.id}>
              <td data-label="Категорія">{c.name}</td>
              <td data-label="Товарів">{c.count}</td>
              <td className="actions" data-label="Дії"><button className="danger" onClick={() => del(c)}>🗑</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
