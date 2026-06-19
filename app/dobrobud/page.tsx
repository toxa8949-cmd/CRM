'use client';
import { useEffect } from 'react';

export default function DobrobudEntry() {
  useEffect(() => {
    try { localStorage.setItem('activeShop', 'dobrobud'); } catch {}
    window.location.href = '/';
  }, []);
  return <div className="loading">Відкриваємо Добробуд…</div>;
}
