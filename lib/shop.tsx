'use client';
import { createContext, useContext } from 'react';
import { shopBySlug } from './supabase';

type ShopCtx = { slug: string; currency: string; hasVat: boolean; name: string; partnerShare: number };
const Ctx = createContext<ShopCtx>({ slug: 'rower', currency: 'zł', hasVat: true, name: 'Rower Express', partnerShare: 0 });

export function ShopProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const s = shopBySlug(slug);
  return <Ctx.Provider value={{ slug: s.slug, currency: s.currency, hasVat: s.hasVat, name: s.name, partnerShare: (s as any).partnerShare || 0 }}>{children}</Ctx.Provider>;
}

export const useShop = () => useContext(Ctx);
