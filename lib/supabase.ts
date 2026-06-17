import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const money = (v: number) =>
  `${Number(v || 0).toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} zł`;

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const VAT = 0.23;                         // ПДВ 23%
export const brutto = (net: number) => net * (1 + VAT); // нетто → брутто
export const taxRate = (kind: string) => (kind === 'Послуга' ? 8 : 3); // податок з обороту, %

export type Category = { id: number; name: string };
export type Product = {
  id: number; name: string; category_id: number | null; sku: string | null;
  stock: number; purchase: number; price: number; low_stock: number;
  kind: string; extra_cost: number;
  categories?: { name: string } | null;
};
export type Customer = { id: number; name: string; phone: string | null; email: string | null; note: string | null };
export type Sale = {
  id: number; customer_id: number | null; total: number; net: number;
  turnover_tax: number; profit: number;
  payment: string; status: string; note: string | null; created_at: string;
  customers?: { name: string } | null;
  sale_items?: SaleItem[];
};
export type SaleItem = {
  id: number; product_id: number | null; product_name: string;
  qty: number; price: number; purchase: number; extra_cost: number; tax_rate: number;
};
export type Expense = { id: number; category: string; amount: number; description: string | null; spent_at: string };
