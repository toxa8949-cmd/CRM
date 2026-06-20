'use client';
import { useEffect, useState } from 'react';
import { supabase, type Category } from '../../lib/supabase';
import { useShop } from '../../lib/shop';

export default function SettingsPage() {
  const { slug: shop, hasVat } = useShop();
  const [cats, setCats] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [shop]);

  async function load() {
    setLoading(true);
    const [{ data }, { data: accs }] = await Promise.all([
      supabase.from('categories').select('*,products(id)').eq('shop', shop).order('name'),
      supabase.from('accounts').select('id,name,currency').eq('shop', shop).eq('archived', false).order('created_at'),
    ]);
    setCats((data || []).map((c: any) => ({ ...c, count: c.products?.length || 0 })));
    setAccounts(accs || []);
    setLoading(false);
  }

  async function setConsignment(c: any, accId: string) {
    await supabase.from('categories').update({ consignment_account_id: accId ? Number(accId) : null }).eq('id', c.id);
    load();
  }

  async function add() {
    setErr('');
    if (!name.trim()) return;
    const { error } = await supabase.from('categories').insert({
      shop,
      name: name.trim(),
      parent_id: parentId ? Number(parentId) : null,
    });
    if (error) return setErr(error.message);
    setName(''); setParentId(''); load();
  }

  async function del(c: any) {
    if (c.count) return setErr(`Не можна видалити "${c.name}": є товари (${c.count}). Спершу перенесіть їх.`);
    const kids = cats.filter(x => x.parent_id === c.id);
    if (kids.length) return setErr(`Не можна видалити "${c.name}": є підкатегорії (${kids.length}). Спершу видаліть їх.`);
    if (!confirm(`Видалити категорію "${c.name}"?`)) return;
    await supabase.from('categories').delete().eq('id', c.id); load();
  }

  async function toggleAccessory(c: any) {
    await supabase.from('categories').update({ is_accessory: !c.is_accessory }).eq('id', c.id);
    load();
  }

  // тільки батьківські категорії (для вибору батька)
  const parents = cats.filter(c => !c.parent_id);
  // впорядкований список: батько, потім його підкатегорії
  const ordered: any[] = [];
  parents.forEach(p => {
    ordered.push({ ...p, level: 0 });
    cats.filter(c => c.parent_id === p.id).forEach(c => ordered.push({ ...c, level: 1 }));
  });

  if (loading) return <div className="loading">Завантаження…</div>;

  return (
    <>
      <h2>Категорії</h2>
      <p className="muted">Категорії та підкатегорії товарів. Позначка «аксесуар» вмикає бонус 5% продавцю (діє і на підкатегорії).</p>
      {err && <div className="err">{err}</div>}

      <div className="form" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
        <input className="input" placeholder="Назва категорії" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
        <select value={parentId} onChange={e => setParentId(e.target.value)}>
          <option value="">— головна категорія —</option>
          {parents.map(p => <option key={p.id} value={p.id}>Підкатегорія в: {p.name}</option>)}
        </select>
        <button onClick={add}>Додати</button>
      </div>

      <table>
        <thead><tr><th>Категорія</th><th>Товарів</th><th>Аксесуар (бонус 5%)</th>{!hasVat && accounts.length > 0 && <th>Товар партнера</th>}<th></th></tr></thead>
        <tbody>
          {ordered.length === 0 && <tr><td colSpan={4} className="muted">Немає категорій</td></tr>}
          {ordered.map(c => (
            <tr key={c.id}>
              <td data-label="Категорія">
                <span style={{ paddingLeft: c.level ? 24 : 0, color: c.level ? '#6b7280' : 'inherit' }}>
                  {c.level ? '↳ ' : ''}{c.name}
                </span>
              </td>
              <td data-label="Товарів">{c.count}</td>
              <td data-label="Аксесуар">
                <button className={c.is_accessory ? 'green' : 'ghost'} onClick={() => toggleAccessory(c)}>
                  {c.is_accessory ? '✓ Так' : 'Ні'}
                </button>
              </td>
              {!hasVat && accounts.length > 0 && (
                <td data-label="Товар партнера">
                  <select value={c.consignment_account_id || ''} onChange={e => setConsignment(c, e.target.value)} style={{ minWidth: 150 }}>
                    <option value="">— ні —</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>Собівартість → {a.name}</option>)}
                  </select>
                </td>
              )}
              <td className="actions" data-label="Дії"><div className="cell-actions"><button className="danger" onClick={() => del(c)}>🗑</button></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
