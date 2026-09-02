-- ============================================================================
-- CATATIN — Skema database PostgreSQL untuk Supabase
-- ----------------------------------------------------------------------------
-- Jalankan seluruh file ini di Supabase Dashboard > SQL Editor > New query.
-- Aman dijalankan ulang (idempotent).
--
-- Prinsip keamanan:
--   * Setiap tabel WAJIB punya kolom user_id yang mengacu ke auth.users.
--   * Row Level Security (RLS) aktif di semua tabel.
--   * Policy hanya mengizinkan baris milik auth.uid() — pengguna tidak akan
--     pernah bisa membaca atau mengubah data pengguna lain.
--   * Bucket struk bersifat privat; file hanya bisa diakses lewat signed URL.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. WALLETS (dompet / akun)
--    Primary key gabungan (user_id, id) supaya id ramah dibaca ("bca", "gopay")
--    dan tetap unik antar pengguna.
-- ---------------------------------------------------------------------------
create table if not exists public.wallets (
  id              text        not null,
  user_id         uuid        not null references auth.users (id) on delete cascade,
  name            text        not null,
  kind            text        not null default 'bank'
                  check (kind in ('cash', 'bank', 'ewallet', 'credit', 'investment')),
  emoji           text        not null default '🏦',
  initial_balance bigint      not null default 0,
  archived        boolean     not null default false,
  created_at      timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------------------------------------------------------------------------
-- 2. CATEGORIES
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id          text        not null,
  user_id     uuid        not null references auth.users (id) on delete cascade,
  name        text        not null,
  emoji       text        not null default '📦',
  type        text        not null default 'expense'
              check (type in ('income', 'expense', 'both')),
  color       text        not null default '#64748B',
  is_default  boolean     not null default false,
  created_at  timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, name)
);

-- ---------------------------------------------------------------------------
-- 3. TRANSACTIONS
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users (id) on delete cascade,
  type             text        not null check (type in ('income', 'expense', 'transfer')),
  date             date        not null,
  time             text,
  merchant         text        not null default '',
  category         text        not null default 'Lainnya',
  subcategory      text,
  amount           bigint      not null check (amount >= 0),
  payment_method   text,
  wallet           text        not null,
  to_wallet        text,
  notes            text,
  receipt_image    text,
  reference_number text,
  items            jsonb       not null default '[]'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Transfer wajib punya dompet tujuan yang berbeda dari dompet asal.
  constraint transfer_needs_target check (
    type <> 'transfer' or (to_wallet is not null and to_wallet <> wallet)
  )
);

create index if not exists transactions_user_date_idx on public.transactions (user_id, date desc);
create index if not exists transactions_user_category_idx on public.transactions (user_id, category);
create index if not exists transactions_user_wallet_idx on public.transactions (user_id, wallet);
create index if not exists transactions_user_type_idx on public.transactions (user_id, type);

-- ---------------------------------------------------------------------------
-- 4. BUDGETS
-- ---------------------------------------------------------------------------
create table if not exists public.budgets (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  category   text        not null,
  amount     bigint      not null check (amount > 0),
  period     text        not null,          -- format YYYY-MM
  created_at timestamptz not null default now(),
  unique (user_id, category, period)
);

-- ---------------------------------------------------------------------------
-- 5. GOALS (target keuangan)
-- ---------------------------------------------------------------------------
create table if not exists public.goals (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users (id) on delete cascade,
  name           text        not null,
  emoji          text        not null default '🎯',
  target_amount  bigint      not null check (target_amount > 0),
  current_amount bigint      not null default 0,
  target_date    date        not null,
  notes          text,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. DEBTS (hutang & piutang)
-- ---------------------------------------------------------------------------
create table if not exists public.debts (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  kind        text        not null check (kind in ('debt', 'receivable')),
  person      text        not null,
  amount      bigint      not null check (amount > 0),
  paid_amount bigint      not null default 0,
  date        date        not null,
  due_date    date        not null,
  status      text        not null default 'open' check (status in ('open', 'paid')),
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists debts_user_due_idx on public.debts (user_id, due_date);

-- ---------------------------------------------------------------------------
-- 7. RECURRING TRANSACTIONS
-- ---------------------------------------------------------------------------
create table if not exists public.recurring_transactions (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users (id) on delete cascade,
  name           text        not null,
  type           text        not null check (type in ('income', 'expense')),
  amount         bigint      not null check (amount > 0),
  category       text        not null default 'Lainnya',
  wallet         text        not null,
  frequency      text        not null default 'monthly'
                 check (frequency in ('monthly', 'weekly', 'yearly')),
  day_of_month   int         not null default 1 check (day_of_month between 1 and 31),
  day_of_week    int         not null default 1 check (day_of_week between 0 and 6),
  month_of_year  int         not null default 1 check (month_of_year between 1 and 12),
  payment_method text,
  auto_create    boolean     not null default false,
  active         boolean     not null default true,
  last_run       date,
  notes          text,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 8. updated_at otomatis untuk transactions
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists transactions_touch_updated_at on public.transactions;
create trigger transactions_touch_updated_at
  before update on public.transactions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY
--    Satu policy per tabel: pengguna hanya boleh menyentuh barisnya sendiri.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'wallets', 'categories', 'transactions', 'budgets', 'goals', 'debts', 'recurring_transactions'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_owner_all" on public.%I', t, t);
    execute format(
      'create policy "%s_owner_all" on public.%I
         for all
         to authenticated
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id)', t, t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 10. STORAGE: bucket privat untuk foto struk
--     Path file selalu diawali "<user_id>/", dipakai sebagai kunci RLS.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "receipts_owner_select" on storage.objects;
create policy "receipts_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "receipts_owner_insert" on storage.objects;
create policy "receipts_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "receipts_owner_update" on storage.objects;
create policy "receipts_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "receipts_owner_delete" on storage.objects;
create policy "receipts_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
