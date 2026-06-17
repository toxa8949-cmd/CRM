'use client';
import { useEffect, useState } from 'react';
import { supabase, money, exportCSV, type Customer } from '../../lib/supabase';

export default function CustomersPage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', email: '', note: '' });
  const [edit, setEdit] = useState<Customer | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('customers').select('*,sales(total)').order('name');
    setList((data || []).map((c: any) => ({
      ...c,
      orders: c.sales?.length || 0,
      spent: (c.sales || []).reduce((a: number, s: any) => a + Number(s.total), 0),
    })));
    setLoading(false);
  }

  async function add() {
    setErr('');
    if (!form.name.trim()) return setErr('Вкажіть ім’я');
    const { error } = await supabase.from('customers').insert({
      name: form.name.trim(), phone: form.phone || null, email: form.email || null, note: form.note || null,
    });
    if (error) return setErr(error.message);
    setForm({ name: '', phone: '', email: '', note: '' }); load();
  }

  async function saveEdit() {
    if (!edit) return;
    await supabase.from('customers').update({
      name: edit.name, phone: edit.phone, email: edit.email, note: edit.note,
    }).eq('id', edit.id);
    setEdit(null); load();
  }

  async function del(c: Customer) {
    if (!confirm(`Видалити клієнта "${c.name}"?`)) return;
    await supabase.from('customers').delete().eq('id', c.id); load();
  }

  function exportCustomers() {
    exportCSV(`kliienty_${new Date().toISOString().slice(0, 10)}.csv`, list.map(c => ({
      'Ім\u2019я': c.name, 'Телефон': c.phone || '', 'Email': c.email || '',
      'Замовлень': c.orders, 'Витрачено': Number(c.spent).toFixed(2), 'Примітка': c.note || '',
    })));
  }

  if (loading) return <div className="loading">Завантаження…</div>;

  return (
    <>
      <h2>Клієнти</h2>
      <p className="muted">База клієнтів з історією покупок</p>
      {err && <div className="err">{err}</div>}

      <div className="form">
        <input className="input" placeholder="Ім’я" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <input className="input" placeholder="Телефон" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <input className="input" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <input className="input" placeholder="Примітка" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
        <button onClick={add}>Додати клієнта</button>
      </div>

      <div className="row">
        <button className="ghost" onClick={exportCustomers}>Експорт CSV</button>
      </div>

      <table>
        <thead><tr><th>Ім’я</th><th>Телефон</th><th>Email</th><th>Замовлень</th><th>Витрачено</th><th></th></tr></thead>
        <tbody>
          {list.map(c => (edit && edit.id === c.id) ? (
            <tr key={c.id}>
              <td><input className="input" value={edit!.name} onChange={e => setEdit({ ...edit!, name: e.target.value })} /></td>
              <td><input className="input" value={edit!.phone ?? ''} onChange={e => setEdit({ ...edit!, phone: e.target.value })} /></td>
              <td><input className="input" value={edit!.email ?? ''} onChange={e => setEdit({ ...edit!, email: e.target.value })} /></td>
              <td colSpan={2}><input className="input" value={edit!.note ?? ''} onChange={e => setEdit({ ...edit!, note: e.target.value })} placeholder="Примітка" /></td>
              <td style={{ display: 'flex', gap: 6 }}>
                <button className="green" onClick={saveEdit}>✓</button>
                <button className="ghost" onClick={() => setEdit(null)}>✕</button>
              </td>
            </tr>
          ) : (
            <tr key={c.id}>
              <td>{c.name}{c.note && <div className="muted" style={{ fontSize: 12 }}>{c.note}</div>}</td>
              <td>{c.phone || '—'}</td>
              <td>{c.email || '—'}</td>
              <td>{c.orders}</td>
              <td>{money(c.spent)}</td>
              <td style={{ display: 'flex', gap: 6 }}>
                <button className="ghost" onClick={() => setEdit(c)}>✎</button>
                <button className="danger" onClick={() => del(c)}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
