'use client';
import { createContext, useContext } from 'react';
import { shopBySlug } from './supabase';

type ShopCtx = { slug: string; currency: string; hasVat: boolean; name: string };
const Ctx = createContext<ShopCtx>({ slug: 'rower', currency: 'zł', hasVat: true, name: 'Rower Express' });

export function ShopProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const s = shopBySlug(slug);
  return <Ctx.Provider value={{ slug: s.slug, currency: s.currency, hasVat: s.hasVat, name: s.name }}>{children}</Ctx.Provider>;
}

export const useShop = () => useContext(Ctx);
