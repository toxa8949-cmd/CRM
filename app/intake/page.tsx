'use client';
import { useState, useEffect } from 'react';
import { supabase, money, brutto, net, type Category } from '../../lib/supabase';

type Row = {
  code: string; name: string; qty: number;
  purchase: number; extra_cost: number; vat: number;
  priceBrutto: string;     // продажна ціна БРУТТО (вводить користувач)
  category_id: string;     // обрана категорія ('' = без категорії)
  matchId?: number | null; // знайдений товар на складі
  matchName?: string;
};

export default function IntakePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    supabase.from('categories').select('*').order('name').then(({ data }) => setCats(data || []));
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(''); setOk(''); setBusy(true); setFileName(file.name);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/parse-invoice', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Помилка');

      // зведення зі складом за кодом (sku) або назвою
      const { data: products } = await supabase.from('products').select('id,name,sku,category_id');
      const parsed: Row[] = data.items.map((i: any) => {
        const match = (products || []).find(p =>
          (i.code && p.sku && p.sku.toLowerCase() === i.code.toLowerCase()) ||
          p.name.toLowerCase() === i.name.toLowerCase()
        );
        return {
          ...i, priceBrutto: '',
          category_id: match?.category_id ? String(match.category_id) : '',
          matchId: match?.id ?? null,
          matchName: match?.name,
        };
      });
      setRows(parsed);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  function upd(i: number, patch: Partial<Row>) {
    setRows(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }
  function remove(i: number) {
    setRows(rows.filter((_, idx) => idx !== i));
  }

  function setMargin(pct: number) {
    setRows(rows.map(r => ({
      ...r,
      // собівартість нетто × націнка → переводимо в брутто
      priceBrutto: (brutto((r.purchase + r.extra_cost) * (1 + pct / 100))).toFixed(2),
    })));
  }

  async function commit() {
    setErr(''); setOk('');
    const bad = rows.find(r => !r.priceBrutto || Number(r.priceBrutto) <= 0);
    if (bad) return setErr(`Вкажіть продажну ціну для: ${bad.name}`);

    setBusy(true);
    try {
      for (const r of rows) {
        const priceNet = Math.round(net(Number(r.priceBrutto)) * 100) / 100; // у базі зберігаємо нетто
        const catId = r.category_id ? Number(r.category_id) : null;
        if (r.matchId) {
          // оновити існуючий: додати кількість, оновити закупку/ціни/категорію
          const { data: p } = await supabase.from('products').select('stock').eq('id', r.matchId).single();
          await supabase.from('products').update({
            stock: (p?.stock || 0) + r.qty,
            purchase: r.purchase,
            extra_cost: r.extra_cost,
            price: priceNet,
            category_id: catId,
          }).eq('id', r.matchId);
          await supabase.from('stock_moves').insert({ product_id: r.matchId, delta: r.qty, reason: 'Прихід (фактура)' });
        } else {
          // створити новий товар
          const { data: created } = await supabase.from('products').insert({
            name: r.name, sku: r.code || null, stock: r.qty,
            purchase: r.purchase, extra_cost: r.extra_cost, price: priceNet,
            kind: 'Товар', category_id: catId,
          }).select('id').single();
          if (created) {
            await supabase.from('stock_moves').insert({ product_id: created.id, delta: r.qty, reason: 'Прихід (фактура)' });
          }
        }
      }
      setOk(`Оприбутковано ${rows.length} позиц.`);
      setRows([]); setFileName('');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2>Прихід товару</h2>
      <p className="muted">Завантаж PDF-фактуру — товари витягнуться автоматично. Доставка розкидається на позиції.</p>
      {err && <div className="err">{err}</div>}
      {ok && <div className="ok-msg">{ok}</div>}

      <div className="form" style={{ gridTemplateColumns: '1fr' }}>
        <label className="btn" style={{ textAlign: 'center', cursor: 'pointer' }}>
          {busy ? 'Обробка…' : '📄 Вибрати PDF-фактуру'}
          <input type="file" accept="application/pdf" onChange={onFile} disabled={busy} style={{ display: 'none' }} />
        </label>
        {fileName && <div className="muted">Файл: {fileName}</div>}
      </div>

      {rows.length > 0 && (
        <>
          <div className="row">
            <span className="muted">Швидка націнка:</span>
            <button className="ghost" onClick={() => setMargin(30)}>+30%</button>
            <button className="ghost" onClick={() => setMargin(40)}>+40%</button>
            <button className="ghost" onClick={() => setMargin(50)}>+50%</button>
            <button className="ghost" onClick={() => setMargin(100)}>+100%</button>
            <span className="muted" style={{ marginLeft: 12 }}>Категорія всім:</span>
            <select onChange={e => { const v = e.target.value; setRows(rows.map(r => ({ ...r, category_id: v }))); }} defaultValue="">
              <option value="">— обрати —</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <table>
            <thead>
              <tr>
                <th>Код</th><th>Назва</th><th>Категорія</th><th>К-сть</th><th>Закупка нетто</th><th>Доставка/од.</th>
                <th>Продаж брутто</th><th>Продаж нетто</th><th>Чистий/од.</th><th>Склад</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const priceNet = Number(r.priceBrutto) ? net(Number(r.priceBrutto)) : 0;
                const profit = priceNet ? priceNet - r.purchase - r.extra_cost - priceNet * 3 / 100 : 0;
                return (
                <tr key={i}>
                  <td><input className="input" style={{ width: 110 }} value={r.code} onChange={e => upd(i, { code: e.target.value })} /></td>
                  <td><input className="input" value={r.name} onChange={e => upd(i, { name: e.target.value })} /></td>
                  <td>
                    <select value={r.category_id} onChange={e => upd(i, { category_id: e.target.value })}>
                      <option value="">— без категорії</option>
                      {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td><input className="input" type="number" style={{ width: 60 }} value={r.qty} onChange={e => upd(i, { qty: Number(e.target.value) })} /></td>
                  <td>{money(r.purchase)}</td>
                  <td>{r.extra_cost ? money(r.extra_cost) : '—'}</td>
                  <td><input className="input" type="number" style={{ width: 110 }} placeholder="ціна з ПДВ" value={r.priceBrutto} onChange={e => upd(i, { priceBrutto: e.target.value })} /></td>
                  <td className="muted">{r.priceBrutto ? money(priceNet) : '—'}</td>
                  <td style={{ fontWeight: 600, color: profit > 0 ? '#16a34a' : profit < 0 ? '#dc2626' : '#9ca3af' }}>
                    {r.priceBrutto ? money(profit) : '—'}
                  </td>
                  <td>{r.matchId
                    ? <span className="badge ok" title={r.matchName}>+ до наявного</span>
                    : <span className="badge low">новий</span>}</td>
                  <td><button className="danger" onClick={() => remove(i)}>🗑</button></td>
                </tr>
                );
              })}
            </tbody>
          </table>

          <div className="row" style={{ marginTop: 16 }}>
            <button className="green" disabled={busy} onClick={commit}>
              {busy ? 'Оприбуткування…' : `Оприбуткувати ${rows.length} поз.`}
            </button>
            <button className="ghost" onClick={() => { setRows([]); setFileName(''); }}>Скасувати</button>
          </div>
        </>
      )}
    </>
  );
}
