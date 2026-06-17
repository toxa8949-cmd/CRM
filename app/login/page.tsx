'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function login() {
    setErr(''); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setErr('Невірний логін або пароль'); return; }
    window.location.href = '/';
  }

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 360, maxWidth: '90%' }}>
        <h2 style={{ marginTop: 0 }}>Вхід · Rower CRM</h2>
        <p className="muted">Увійдіть, щоб продовжити</p>
        {err && <div className="err">{err}</div>}
        <input className="input" placeholder="Логін (email)" value={email}
          onChange={e => setEmail(e.target.value)} style={{ marginBottom: 10 }}
          onKeyDown={e => e.key === 'Enter' && login()} />
        <input className="input" type="password" placeholder="Пароль" value={password}
          onChange={e => setPassword(e.target.value)} style={{ marginBottom: 16 }}
          onKeyDown={e => e.key === 'Enter' && login()} />
        <button className="green" style={{ width: '100%' }} disabled={busy} onClick={login}>
          {busy ? 'Вхід…' : 'Увійти'}
        </button>
      </div>
    </div>
  );
}
