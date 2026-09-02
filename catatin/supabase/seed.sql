-- ============================================================================
-- CATATIN — Seed data demo untuk satu pengguna Supabase
-- ----------------------------------------------------------------------------
-- Cara pakai:
--   1. Login dulu ke aplikasi minimal satu kali agar akun terbuat di auth.users.
--   2. Ganti nilai variabel demo_email di bawah dengan email akun Anda.
--   3. Jalankan file ini di Supabase Dashboard > SQL Editor.
--
-- Catatan: aplikasi juga menyediakan tombol "Muat ulang data demo" di halaman
-- Profil, yang melakukan hal yang sama lewat aplikasi. File ini berguna kalau
-- Anda ingin menyiapkan data langsung dari database.
-- ============================================================================

do $$
declare
  demo_email  text := 'ganti@email-anda.com';   -- <<< UBAH INI
  uid         uuid;
  bulan_ini   date := date_trunc('month', current_date)::date;
  bulan_lalu  date := (date_trunc('month', current_date) - interval '1 month')::date;
begin
  select id into uid from auth.users where email = demo_email limit 1;
  if uid is null then
    raise exception 'Pengguna dengan email % belum ada. Login ke aplikasi dulu.', demo_email;
  end if;

  -- Bersihkan data lama milik pengguna ini
  delete from public.transactions where user_id = uid;
  delete from public.budgets where user_id = uid;
  delete from public.goals where user_id = uid;
  delete from public.debts where user_id = uid;
  delete from public.recurring_transactions where user_id = uid;
  delete from public.categories where user_id = uid;
  delete from public.wallets where user_id = uid;

  -- Dompet
  insert into public.wallets (id, user_id, name, kind, emoji, initial_balance) values
    ('cash',        uid, 'Cash',          'cash',       '💵',  1500000),
    ('bca',         uid, 'BCA',           'bank',       '🏦', 45000000),
    ('mandiri',     uid, 'Mandiri',       'bank',       '🏦',  8000000),
    ('bri',         uid, 'BRI',           'bank',       '🏦',  3000000),
    ('bni',         uid, 'BNI',           'bank',       '🏦',        0),
    ('credit-card', uid, 'Kartu Kredit',  'credit',     '💳',        0),
    ('gopay',       uid, 'GoPay',         'ewallet',    '🟢',   750000),
    ('ovo',         uid, 'OVO',           'ewallet',    '🟣',   400000),
    ('dana',        uid, 'DANA',          'ewallet',    '🔵',   350000),
    ('shopeepay',   uid, 'ShopeePay',     'ewallet',    '🟠',   250000),
    ('investasi',   uid, 'Investasi',     'investment', '📈', 55000000);

  -- Kategori default
  insert into public.categories (id, user_id, name, emoji, type, color, is_default) values
    ('cat-0',  uid, 'Makanan & Minuman',   '🍜',      'expense', '#F97316', true),
    ('cat-1',  uid, 'Transportasi',        '🚗',      'expense', '#0EA5E9', true),
    ('cat-2',  uid, 'Belanja',             '🛍',      'expense', '#EC4899', true),
    ('cat-3',  uid, 'Tagihan',             '💳',      'expense', '#8B5CF6', true),
    ('cat-4',  uid, 'Rumah',               '🏠',      'expense', '#14B8A6', true),
    ('cat-5',  uid, 'Kesehatan',           '💊',      'expense', '#EF4444', true),
    ('cat-6',  uid, 'Pendidikan',          '📚',      'expense', '#3B82F6', true),
    ('cat-7',  uid, 'Hiburan',             '🎮',      'expense', '#A855F7', true),
    ('cat-8',  uid, 'Travel',              '✈️',      'expense', '#06B6D4', true),
    ('cat-9',  uid, 'Keluarga',            '👨‍👩‍👧', 'expense', '#F59E0B', true),
    ('cat-10', uid, 'Keagamaan & Sosial',  '🕌',      'expense', '#10B981', true),
    ('cat-11', uid, 'Investasi',           '📈',      'both',    '#22C55E', true),
    ('cat-12', uid, 'Gaji',                '💼',      'income',  '#16A34A', true),
    ('cat-13', uid, 'Bisnis',              '🏪',      'income',  '#0D9488', true),
    ('cat-14', uid, 'Lainnya',             '📦',      'both',    '#64748B', true);

  -- Transaksi bulan ini
  insert into public.transactions (user_id, type, date, time, merchant, category, amount, payment_method, wallet, to_wallet, notes) values
    (uid, 'income',   bulan_ini,                       '09:00', 'PT Telkomsel Indonesia',  'Gaji',              30000000, 'Transfer Bank',    'bca',         null,        'Gaji bulanan'),
    (uid, 'expense',  bulan_ini + 1,                   '08:00', 'Sewa Apartemen Kalibata', 'Rumah',              4500000, 'Transfer Bank',    'bca',         null,        'Sewa bulanan'),
    (uid, 'expense',  bulan_ini + 1,                   '12:30', 'RM Padang Sederhana',     'Makanan & Minuman',    75000, 'QRIS',             'gopay',       null,        'Makan siang'),
    (uid, 'expense',  bulan_ini + 1,                   '07:30', 'Grab',                    'Transportasi',         32000, 'E-Wallet',         'gopay',       null,        'Ke kantor'),
    (uid, 'expense',  bulan_ini + 2,                   '16:40', 'Superindo Kemang',        'Belanja',             425000, 'Debit',            'bca',         null,        'Belanja mingguan'),
    (uid, 'expense',  bulan_ini + 4,                   '10:00', 'PLN Prabayar',            'Tagihan',             500000, 'Virtual Account',  'bca',         null,        'Token listrik'),
    (uid, 'expense',  bulan_ini + 4,                   '10:05', 'IndiHome',                'Tagihan',             465000, 'Virtual Account',  'bca',         null,        'Internet rumah'),
    (uid, 'expense',  bulan_ini + 5,                   '13:05', 'Warung Tegal Bahari',     'Makanan & Minuman',    35000, 'Cash',             'cash',        null,        null),
    (uid, 'expense',  bulan_ini + 6,                   '09:10', 'SPBU Pertamina 31.129',   'Transportasi',        300000, 'Kartu Kredit',     'credit-card', null,        'Isi bensin'),
    (uid, 'expense',  bulan_ini + 7,                   '20:10', 'Pizza Hut Kuningan',      'Makanan & Minuman',   245000, 'Kartu Kredit',     'credit-card', null,        'Makan keluarga'),
    (uid, 'expense',  bulan_ini + 9,                   '17:00', 'Kitabisa - Donasi',       'Keagamaan & Sosial',  500000, 'Transfer Bank',    'bca',         null,        'Sedekah bulanan'),
    (uid, 'expense',  bulan_ini + 10,                  '16:00', 'Apotek Kimia Farma',      'Kesehatan',           185000, 'QRIS',             'dana',        null,        'Obat & vitamin'),
    (uid, 'expense',  bulan_ini + 13,                  '20:00', 'Gramedia Matraman',       'Pendidikan',          195000, 'QRIS',             'shopeepay',   null,        'Buku'),
    (uid, 'expense',  bulan_ini + 14,                  '09:00', 'Netflix',                 'Tagihan',             186000, 'Kartu Kredit',     'credit-card', null,        'Langganan bulanan'),
    (uid, 'expense',  bulan_ini + 15,                  '21:30', 'CGV Grand Indonesia',     'Hiburan',             130000, 'E-Wallet',         'ovo',         null,        'Nonton'),
    (uid, 'expense',  bulan_ini + 3,                   '09:00', 'Uang Bulanan Orang Tua',  'Keluarga',           2000000, 'Transfer Bank',    'bca',         null,        'Kirim ke orang tua'),
    (uid, 'transfer', bulan_ini + 1,                   '09:30', 'Bibit - Reksadana',       'Investasi',          3000000, 'Transfer Bank',    'bca',         'investasi', 'Autodebet investasi'),
    -- Bulan lalu (pembanding tren)
    (uid, 'income',   bulan_lalu,                      '09:00', 'PT Telkomsel Indonesia',  'Gaji',              30000000, 'Transfer Bank',    'bca',         null,        'Gaji bulanan'),
    (uid, 'expense',  bulan_lalu + 1,                  '08:00', 'Sewa Apartemen Kalibata', 'Rumah',              4500000, 'Transfer Bank',    'bca',         null,        'Sewa bulanan'),
    (uid, 'expense',  bulan_lalu + 2,                  '12:00', 'RM Padang Sederhana',     'Makanan & Minuman',    68000, 'QRIS',             'gopay',       null,        null),
    (uid, 'expense',  bulan_lalu + 8,                  '19:00', 'Sate Khas Senayan',       'Makanan & Minuman',   165000, 'Debit',            'bca',         null,        null),
    (uid, 'expense',  bulan_lalu + 3,                  '16:00', 'Superindo Kemang',        'Belanja',             512000, 'Debit',            'bca',         null,        null),
    (uid, 'expense',  bulan_lalu + 4,                  '10:00', 'PLN Prabayar',            'Tagihan',             450000, 'Virtual Account',  'bca',         null,        null),
    (uid, 'expense',  bulan_lalu + 4,                  '10:05', 'IndiHome',                'Tagihan',             465000, 'Virtual Account',  'bca',         null,        null),
    (uid, 'expense',  bulan_lalu + 7,                  '09:00', 'SPBU Pertamina 31.129',   'Transportasi',        300000, 'Kartu Kredit',     'credit-card', null,        null),
    (uid, 'transfer', bulan_lalu + 1,                  '09:30', 'Bibit - Reksadana',       'Investasi',          3000000, 'Transfer Bank',    'bca',         'investasi', 'Autodebet investasi');

  -- Budget bulan berjalan
  insert into public.budgets (user_id, category, amount, period) values
    (uid, 'Makanan & Minuman', 3000000, to_char(current_date, 'YYYY-MM')),
    (uid, 'Transportasi',      2000000, to_char(current_date, 'YYYY-MM')),
    (uid, 'Hiburan',           1000000, to_char(current_date, 'YYYY-MM')),
    (uid, 'Belanja',           2500000, to_char(current_date, 'YYYY-MM')),
    (uid, 'Tagihan',           2500000, to_char(current_date, 'YYYY-MM'));

  -- Target keuangan
  insert into public.goals (user_id, name, emoji, target_amount, current_amount, target_date, notes) values
    (uid, 'Liburan Jepang', '🗾', 30000000, 12500000, (date_trunc('year', current_date) + interval '11 months 30 days')::date, 'Tokyo - Osaka, 10 hari'),
    (uid, 'Dana Darurat',   '🛟', 90000000, 42000000, (current_date + interval '10 months')::date, '6x pengeluaran bulanan');

  -- Hutang & piutang
  insert into public.debts (user_id, kind, person, amount, paid_amount, date, due_date, status, notes) values
    (uid, 'receivable', 'Rizky (tim media)',            1500000, 0, current_date - 20, current_date + 10, 'open', 'Talangin tiket event'),
    (uid, 'debt',       'Cicilan Laptop - Home Credit', 2500000, 0, current_date - 40, current_date + 3,  'open', 'Cicilan ke-4 dari 12');

  -- Transaksi rutin
  insert into public.recurring_transactions (user_id, name, type, amount, category, wallet, frequency, day_of_month, payment_method, auto_create, notes) values
    (uid, 'Gaji Telkomsel',      'income',   30000000, 'Gaji',       'bca',         'monthly',  1, 'Transfer Bank',   true,  'Gaji bulanan'),
    (uid, 'Netflix',             'expense',    186000, 'Tagihan',    'credit-card', 'monthly', 15, 'Kartu Kredit',    false, 'Langganan streaming'),
    (uid, 'IndiHome',            'expense',    465000, 'Tagihan',    'bca',         'monthly',  5, 'Virtual Account', false, 'Internet rumah'),
    (uid, 'Sewa Apartemen',      'expense',   4500000, 'Rumah',      'bca',         'monthly',  2, 'Transfer Bank',   false, 'Sewa bulanan'),
    (uid, 'Autodebet Investasi', 'expense',   3000000, 'Investasi',  'bca',         'monthly',  2, 'Transfer Bank',   false, 'Reksadana Bibit');

  raise notice 'Seed CATATIN selesai untuk %', demo_email;
end
$$;
