'use client';
import { useEffect } from 'react';

export default function VelokraiEntry() {
  useEffect(() => {
    try { localStorage.setItem('activeShop', 'velokrai'); } catch {}
    window.location.href = '/';
  }, []);
  return <div className="loading">Відкриваємо Велокрай…</div>;
}
