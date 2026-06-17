-- =========================================================
-- CRM схема для магазину (Supabase / PostgreSQL)
-- Запускати в Supabase SQL Editor одним блоком.
-- =========================================================

-- ---------- КАТЕГОРІЇ ----------
create table if not exists categories (
  id bigint generated always as identity primary key,
  name text not null,
  created_at timestamptz default now()
);

-- ---------- ТОВАРИ ----------
create table if not exists products (
  id bigint generated always as identity primary key,
  name text not null,
  category_id bigint references categories(id) on delete set null,
  sku text,
  stock integer not null default 0,        -- залишок на складі
  purchase numeric(12,2) not null default 0, -- закупівельна ціна
  price numeric(12,2) not null default 0,    -- ціна продажу
  low_stock integer not null default 2,      -- поріг "мало на складі"
  created_at timestamptz default now()
);
create index if not exists idx_products_category on products(category_id);

-- ---------- КЛІЄНТИ ----------
create table if not exists customers (
  id bigint generated always as identity primary key,
  name text not null,
  phone text,
  email text,
  note text,
  created_at timestamptz default now()
);

-- ---------- ПРОДАЖІ (чек / замовлення) ----------
create table if not exists sales (
  id bigint generated always as identity primary key,
  customer_id bigint references customers(id) on delete set null,
  total numeric(12,2) not null default 0,   -- сума чеку
  profit numeric(12,2) not null default 0,  -- маржа чеку
  payment text default 'Готівка',           -- спосіб оплати
  status text default 'Завершено',          -- Завершено / Повернення / Резерв
  note text,
  created_at timestamptz default now()
);
create index if not exists idx_sales_created on sales(created_at);

-- ---------- ПОЗИЦІЇ ПРОДАЖУ ----------
create table if not exists sale_items (
  id bigint generated always as identity primary key,
  sale_id bigint references sales(id) on delete cascade,
  product_id bigint references products(id) on delete set null,
  product_name text not null,    -- знімок назви на момент продажу
  qty integer not null default 1,
  price numeric(12,2) not null default 0,    -- ціна продажу за од.
  purchase numeric(12,2) not null default 0  -- закупка за од. (для маржі)
);
create index if not exists idx_sale_items_sale on sale_items(sale_id);

-- ---------- ВИТРАТИ ----------
create table if not exists expenses (
  id bigint generated always as identity primary key,
  category text not null,
  amount numeric(12,2) not null default 0,
  description text,
  spent_at date not null default current_date,
  created_at timestamptz default now()
);
create index if not exists idx_expenses_date on expenses(spent_at);

-- ---------- РУХ СКЛАДУ (історія) ----------
create table if not exists stock_moves (
  id bigint generated always as identity primary key,
  product_id bigint references products(id) on delete cascade,
  delta integer not null,        -- + надходження, - списання/продаж
  reason text,                   -- 'Продаж', 'Надходження', 'Корекція'
  created_at timestamptz default now()
);

-- =========================================================
-- ФУНКЦІЯ: оформити продаж атомарно
--  - створює sale + sale_items
--  - списує склад
--  - рахує total та profit
--  Викликається з фронта через supabase.rpc('create_sale', {...})
-- =========================================================
create or replace function create_sale(
  p_items jsonb,            -- [{product_id, qty}]
  p_customer_id bigint default null,
  p_payment text default 'Готівка',
  p_note text default null
) returns bigint
language plpgsql
as $$
declare
  v_sale_id bigint;
  v_item jsonb;
  v_product products%rowtype;
  v_qty integer;
  v_total numeric(12,2) := 0;
  v_profit numeric(12,2) := 0;
begin
  insert into sales(customer_id, payment, note, total, profit)
  values (p_customer_id, p_payment, p_note, 0, 0)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from products
      where id = (v_item->>'product_id')::bigint;
    if not found then
      raise exception 'Товар % не знайдено', v_item->>'product_id';
    end if;

    v_qty := (v_item->>'qty')::integer;
    if v_qty <= 0 then
      raise exception 'Некоректна кількість для %', v_product.name;
    end if;
    if v_product.stock < v_qty then
      raise exception 'Недостатньо на складі: % (є %, треба %)',
        v_product.name, v_product.stock, v_qty;
    end if;

    insert into sale_items(sale_id, product_id, product_name, qty, price, purchase)
    values (v_sale_id, v_product.id, v_product.name, v_qty, v_product.price, v_product.purchase);

    update products set stock = stock - v_qty where id = v_product.id;
    insert into stock_moves(product_id, delta, reason)
    values (v_product.id, -v_qty, 'Продаж');

    v_total  := v_total  + v_product.price * v_qty;
    v_profit := v_profit + (v_product.price - v_product.purchase) * v_qty;
  end loop;

  update sales set total = v_total, profit = v_profit where id = v_sale_id;
  return v_sale_id;
end;
$$;

-- =========================================================
-- RLS: вмикаємо, але дозволяємо все (CRM з одним власником).
-- Якщо захочеш авторизацію — звузимо політики пізніше.
-- =========================================================
alter table categories  enable row level security;
alter table products    enable row level security;
alter table customers   enable row level security;
alter table sales       enable row level security;
alter table sale_items  enable row level security;
alter table expenses    enable row level security;
alter table stock_moves enable row level security;

do $$
declare t text;
begin
  foreach t in array array['categories','products','customers','sales','sale_items','expenses','stock_moves']
  loop
    execute format('drop policy if exists "all_%s" on %I;', t, t);
    execute format('create policy "all_%s" on %I for all using (true) with check (true);', t, t);
  end loop;
end $$;

-- =========================================================
-- ДЕМО-ДАНІ (необов'язково, можна видалити)
-- =========================================================
insert into categories(name) values ('Електросамокати'),('Велосипеди'),('Запчастини')
on conflict do nothing;

insert into products(name, category_id, stock, purchase, price)
select 'Kugoo Kirin GT2', (select id from categories where name='Електросамокати'), 4, 2800, 3999
where not exists (select 1 from products where name='Kugoo Kirin GT2');
insert into products(name, category_id, stock, purchase, price)
select 'Rower MTB 29', (select id from categories where name='Велосипеди'), 7, 1200, 1999
where not exists (select 1 from products where name='Rower MTB 29');
insert into products(name, category_id, stock, purchase, price)
select 'Покришка 29x2.25', (select id from categories where name='Запчастини'), 18, 45, 89
where not exists (select 1 from products where name='Покришка 29x2.25');
