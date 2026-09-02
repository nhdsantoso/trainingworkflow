# CATATIN 🧾

**Catat keuangan dalam 10 detik.** Aplikasi pencatatan keuangan pribadi mobile-first
untuk Indonesia: foto struk atau bukti transfer, AI membaca datanya, Anda tinggal
memeriksa dan menekan Simpan.

Dibangun dengan Next.js 15 (App Router), TypeScript, Tailwind CSS, dan Supabase.
Model AI vision membaca gambar bukti transaksi dan mengembalikan JSON terstruktur,
lalu **selalu** ditampilkan di halaman konfirmasi sebelum tersimpan.

---

## Daftar isi

1. [Fitur](#fitur)
2. [Tangkapan alur utama](#tangkapan-alur-utama)
3. [Cara install](#cara-install)
4. [Cara menjalankan](#cara-menjalankan)
5. [Mode demo vs mode Supabase](#mode-demo-vs-mode-supabase)
6. [Konfigurasi Supabase](#konfigurasi-supabase)
7. [Konfigurasi OCR](#konfigurasi-ocr)
8. [Konfigurasi AI API](#konfigurasi-ai-api)
9. [Data demo & seed](#data-demo--seed)
10. [Share Target (bagikan screenshot ke CATATIN)](#share-target-bagikan-screenshot-ke-catatin)
11. [Deployment](#deployment)
12. [Struktur proyek](#struktur-proyek)
13. [Keamanan](#keamanan)
14. [Catatan desain](#catatan-desain)
15. [Troubleshooting](#troubleshooting)

---

## Fitur

| Area | Yang sudah berfungsi |
|---|---|
| **Dashboard** | Saldo total, pemasukan/pengeluaran/tabungan bulan ini, grafik arus kas 6 bulan, kategori pengeluaran terbesar, ringkasan budget, saldo per dompet, transaksi terbaru |
| **Insight AI** | Proyeksi pengeluaran akhir bulan, kategori yang naik tajam, rasio tabungan, peringatan budget, pengingat jatuh tempo. Dihitung dari data Anda; diperkaya LLM bila API key diisi |
| **Quick Add** | Tombol `+` mengambang di tengah bottom nav → Scan Struk (utama), Upload Bukti, Input Manual, Bicara/Ketik |
| **OCR + AI** | Pipeline: preprocessing gambar di browser → OCR → AI transaction parser → JSON terstruktur → **konfirmasi user** → database |
| **Konfirmasi** | Menampilkan merchant, tanggal, waktu, nominal, kategori, metode bayar, nomor referensi, item, dan skor keyakinan. Peringatan otomatis kalau confidence < 80% |
| **Transaksi** | CRUD penuh + duplikat + lampirkan struk, feed berkelompok per hari, pencarian, filter (jenis, kategori, dompet, rentang tanggal, rentang nominal) |
| **Kategori** | 15 kategori bawaan + kategori kustom (ikon & warna). Kategori kustom ikut dipakai AI saat memindai struk |
| **Dompet** | Cash, BCA, Mandiri, BRI, BNI, Kartu Kredit, GoPay, OVO, DANA, ShopeePay, Investasi + dompet buatan sendiri. Saldo dihitung otomatis. Transfer antar dompet **tidak** dihitung sebagai pemasukan/pengeluaran |
| **Laporan** | Per bulan: total pemasukan, pengeluaran, net cash flow, grafik pemasukan vs pengeluaran, pengeluaran harian, tren arus kas bersih, top 5 pengeluaran, semua kategori, sumber pemasukan |
| **Budget** | Budget per kategori per bulan, progress bar, peringatan pada 80% dan 100% |
| **Target** | Target tabungan dengan progress dan hitungan setoran per bulan yang dibutuhkan |
| **Hutang & Piutang** | Nominal, tanggal, jatuh tempo, status, pembayaran sebagian, pengingat |
| **Transaksi rutin** | Bulanan/mingguan/tahunan. Bisa dibuat otomatis saat jatuh tempo, atau hanya jadi pengingat |
| **AI Keuangan** | Tanya jawab berbasis data user (bukan jawaban generik) |
| **Ekspor** | Excel (.xlsx asli), CSV, PDF. Filter harian / mingguan / bulanan / rentang khusus |
| **Notifikasi** | Ringkasan pengeluaran harian, pemakaian budget, jatuh tempo hutang & tagihan rutin |
| **Autentikasi** | Google, email magic link/OTP, nomor HP OTP (Supabase Auth) |
| **Lainnya** | PWA + Web Share Target, mode gelap, format Rupiah `Rp 1.250.000`, seluruh antarmuka Bahasa Indonesia |

Tidak ada tombol hiasan — setiap tombol utama terhubung ke aksi nyata.

---

## Tangkapan alur utama

```
Buka app  →  Tap +  →  Scan Struk  →  AI membaca  →  Review  →  Simpan
                                                       ▲
                                          maksimal 2–3 tap setelah foto
```

Pipeline teknis di balik "AI membaca":

```
IMAGE (kamera / galeri / share)
  ↓  preprocessing di browser (resize 1600px, orientasi EXIF, peregangan kontras)
  ↓  OCR                      (OCR.space / Google Vision / langsung model vision)
  ↓  AI transaction parser    (LLM → JSON)
  ↓  normalisasi & validasi   (tanggal, nominal, kategori dipetakan ke kategori user)
  ↓  HALAMAN KONFIRMASI       ← tidak pernah dilewati
  ↓  Database
```

Contoh keluaran parser:

```json
{
  "date": "2026-04-24",
  "time": "12:30",
  "merchant": "RM Padang Sederhana",
  "amount": 75000,
  "currency": "IDR",
  "category": "Makanan & Minuman",
  "payment_method": "QRIS",
  "transaction_type": "expense",
  "reference_number": "TRX20260424123045",
  "items": [{ "name": "Nasi Rames", "qty": 2, "price": 50000 }],
  "confidence": 0.94
}
```

Kalau `confidence < 0.8`, halaman konfirmasi menampilkan peringatan:
> ⚠️ Data transaksi kurang jelas. Mohon periksa kembali.

---

## Cara install

Prasyarat: **Node.js 18.18+** (disarankan 20 atau 22) dan npm.

```bash
git clone <url-repo-anda>
cd catatin
npm install
cp .env.example .env.local
```

Semua variabel di `.env.local` boleh dibiarkan kosong untuk percobaan pertama —
aplikasi akan berjalan dalam **mode demo**.

---

## Cara menjalankan

```bash
# Mode pengembangan (hot reload)
npm run dev          # http://localhost:3000

# Build produksi + jalankan
npm run build
npm run start

# Pemeriksaan tipe
npm run typecheck
```

Buka `http://localhost:3000`. Untuk merasakan pengalaman aslinya, gunakan tampilan
perangkat mobile di DevTools (misal iPhone 14 / Pixel 7) — aplikasi dirancang
mobile-first dengan lebar maksimum 448px.

---

## Mode demo vs mode Supabase

CATATIN mendeteksi konfigurasi secara otomatis:

| | Mode demo | Mode Supabase |
|---|---|---|
| Aktif ketika | `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` kosong | keduanya diisi |
| Penyimpanan data | `localStorage` browser | PostgreSQL Supabase (RLS) |
| Login | tidak perlu | Google / email / OTP HP |
| Foto struk | data URL di browser | Supabase Storage (bucket privat + signed URL) |
| Fitur | **semuanya jalan** | semuanya jalan + sinkronisasi antar perangkat |

Mode demo bukan mockup: semua CRUD, grafik, budget, ekspor, dan parser benar-benar
berfungsi — hanya penyimpanannya lokal.

---

## Konfigurasi Supabase

**1. Buat project** di <https://supabase.com/dashboard> (region Singapore paling dekat untuk Indonesia).

**2. Jalankan skema database.** Buka *SQL Editor → New query*, tempel seluruh isi
[`supabase/schema.sql`](supabase/schema.sql), lalu Run. Skrip ini membuat:

- tabel `wallets`, `categories`, `transactions`, `budgets`, `goals`, `debts`, `recurring_transactions`
- indeks untuk query per user/tanggal/kategori
- **Row Level Security aktif di semua tabel** dengan policy `auth.uid() = user_id`
- bucket Storage privat `receipts` beserta policy per-folder user
- trigger `updated_at` otomatis untuk `transactions`

Aman dijalankan berulang kali.

**3. Salin kredensial.** *Project Settings → API*:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> `anon key` memang dirancang untuk dipakai di browser dan aman selama RLS aktif.
> **`service_role` key tidak dibutuhkan aplikasi ini** dan tidak boleh dipasang di frontend.

**4. Aktifkan metode login.** *Authentication → Providers*:

- **Email** — aktif secara bawaan (magic link + OTP).
- **Google** — aktifkan, isi Client ID & Secret dari Google Cloud Console.
  Di Google Cloud, tambahkan *Authorized redirect URI*:
  `https://<project-ref>.supabase.co/auth/v1/callback`
- **Phone** — aktifkan dan hubungkan penyedia SMS (Twilio / MessageBird / Vonage).

**5. Atur URL redirect.** *Authentication → URL Configuration*:

- Site URL: `http://localhost:3000` (dev) atau domain produksi Anda
- Redirect URLs: tambahkan `http://localhost:3000/auth/callback` dan
  `https://domain-anda.com/auth/callback`

**6. Restart** `npm run dev`. Halaman `/masuk` kini menampilkan pilihan login, dan
kategori serta dompet bawaan dibuat otomatis saat pertama kali login.

---

## Konfigurasi OCR

Ada tiga pilihan, diatur lewat `OCR_PROVIDER`:

### a. `llm` (default, paling sederhana)

```bash
OCR_PROVIDER=llm
ANTHROPIC_API_KEY=sk-ant-...
```

Gambar dikirim langsung ke model vision yang membaca teks **dan** menyusun JSON
dalam satu langkah. Paling akurat untuk struk termal Indonesia dan screenshot
m-banking, karena model memahami konteks (mana "Total Bayar", mana "Kembalian").

### b. `ocrspace` — OCR.space

```bash
OCR_PROVIDER=ocrspace
OCR_SPACE_API_KEY=K1234567890
OCR_SPACE_LANGUAGE=eng
```

Dapatkan API key gratis di <https://ocr.space/ocrapi>. Teks hasil OCR dikirim ke
AI parser bersama gambarnya. Berguna untuk menekan biaya token.

### c. `google` — Google Cloud Vision

```bash
OCR_PROVIDER=google
GOOGLE_VISION_API_KEY=AIza...
```

Aktifkan *Cloud Vision API* di Google Cloud Console, buat API key, dan batasi key
tersebut ke Vision API. Menggunakan `DOCUMENT_TEXT_DETECTION` dengan language hint
`id` + `en` — akurasi tertinggi untuk struk yang pudar.

**Tanpa AI key tetapi ada OCR key:** aplikasi memakai parser heuristik bawaan
(`src/lib/parser.ts`) yang memahami format struk Indonesia — kata kunci
`TOTAL BAYAR`/`GRAND TOTAL`, tanggal `24/04/2026` maupun `24 April 2026`, metode
QRIS/GoPay/OVO/transfer, serta baris item `2 x Nasi Rames 50.000`. Hasilnya diberi
confidence maksimal 0.79 sehingga peringatan "periksa kembali" selalu muncul.

---

## Konfigurasi AI API

```bash
ANTHROPIC_API_KEY=sk-ant-...
AI_MODEL=claude-sonnet-5
```

Ambil kunci di <https://console.anthropic.com/settings/keys>.

Satu kunci ini menyalakan empat hal:

| Endpoint | Fungsi |
|---|---|
| `POST /api/parse-receipt` | Membaca gambar struk/bukti transfer → JSON transaksi |
| `POST /api/parse-text` | Mengubah kalimat bebas ("makan siang 75 ribu pakai qris") → JSON transaksi |
| `POST /api/insights` | Insight naratif untuk dashboard |
| `POST /api/assistant` | AI Keuangan (tanya jawab berbasis data user) |

Semua pemanggilan terjadi **di server** (Route Handler). Variabelnya sengaja tanpa
prefix `NEXT_PUBLIC_` sehingga tidak pernah ikut ke bundle browser.

Prompt sistem memaksa keluaran JSON dan melarang model mengarang data yang tidak
terlihat pada gambar. Setiap hasil dinormalisasi ulang di server
(`src/lib/server/normalize.ts`): tanggal divalidasi, nominal dibulatkan, dan
kategori dipetakan ke daftar kategori milik user — termasuk kategori kustom.

**Tanpa `ANTHROPIC_API_KEY`:** dashboard, laporan, insight deterministik, dan
parser teks tetap berjalan. Halaman AI Keuangan menampilkan pesan jelas bahwa
API key belum diisi, bukan tombol mati.

---

## Data demo & seed

Saat pertama kali dibuka, CATATIN mengisi dirinya dengan data demo realistis
supaya dashboard tidak kosong:

- Gaji Rp 30.000.000/bulan, riwayat 6 bulan
- Puluhan transaksi harian (makan, transportasi, belanja, tagihan, rumah, kesehatan, hiburan)
- Budget 5 kategori, 2 target keuangan, 2 catatan hutang/piutang, 5 aturan rutin
- Saldo awal untuk 11 dompet

Semuanya bisa dimuat ulang atau dihapus lewat **Profil → Data**.

Untuk mengisi data demo langsung di database Supabase, gunakan
[`supabase/seed.sql`](supabase/seed.sql) (ubah dulu variabel `demo_email` di
dalamnya menjadi email akun Anda, dan pastikan Anda sudah login minimal sekali).

---

## Share Target (bagikan screenshot ke CATATIN)

Agar bisa membagikan screenshot bukti transfer dari WhatsApp / m-banking / galeri
langsung ke CATATIN:

1. Buka aplikasi di **Chrome Android** melalui **HTTPS** (atau `localhost`).
2. Menu ⋮ → **Add to Home screen / Install app**.
3. Setelah terpasang, "CATATIN" muncul di lembar **Bagikan** Android.

```
Screenshot WhatsApp → Bagikan → CATATIN → OCR + AI → Konfirmasi → Tersimpan
```

Cara kerjanya: `src/app/manifest.ts` mendeklarasikan `share_target` yang mengirim
POST multipart ke `/share`. Service worker (`public/sw.js`) menangkap POST tersebut,
menyimpan berkasnya sementara di Cache Storage, lalu mengarahkan ke `/share` yang
meneruskannya ke alur konfirmasi.

> Share Target adalah fitur Android/Chromium. Di iOS, alur `+ → Upload Bukti`
> memberikan hasil yang sama dalam dua tap.

---

## Deployment

### Vercel (paling mudah)

1. Push repo ke GitHub, lalu *Import Project* di Vercel.
2. **Root Directory**: `catatin` (kalau repo berisi beberapa proyek).
3. Isi Environment Variables — persis seperti `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`, `AI_MODEL`
   - `OCR_PROVIDER` (+ key OCR bila dipakai)
4. Deploy. Framework preset Next.js terdeteksi otomatis.
5. Kembali ke Supabase → *Authentication → URL Configuration*, tambahkan domain
   produksi dan `https://domain-anda.com/auth/callback`.

Route `/api/parse-receipt` diberi `maxDuration = 60` detik karena memproses gambar.

### Docker / VPS

```bash
npm ci
npm run build
NODE_ENV=production npx next start -p 3000
```

Letakkan di belakang reverse proxy (Nginx/Caddy) dengan TLS — HTTPS wajib agar
kamera, service worker, dan Share Target berfungsi.

### Netlify / Cloudflare

Perlu adapter Next.js resmi masing-masing platform. Vercel adalah jalur paling
mulus karena App Router + Route Handler didukung tanpa penyesuaian.

---

## Struktur proyek

```
catatin/
├── src/
│   ├── app/
│   │   ├── page.tsx                 # Dashboard "Keuangan Saya"
│   │   ├── layout.tsx               # Shell, tema, provider
│   │   ├── manifest.ts              # PWA + Web Share Target
│   │   ├── tambah/                  # Quick add: scan / upload / manual / voice + konfirmasi + edit
│   │   ├── transaksi/               # Feed, pencarian, filter
│   │   │   └── [id]/                # Detail, edit, duplikat, hapus, lihat struk
│   │   ├── laporan/                 # Laporan bulanan + ekspor
│   │   ├── ai/                      # AI Keuangan
│   │   ├── anggaran/ target/ hutang/ rutin/
│   │   ├── dompet/ kategori/ profil/ notifikasi/
│   │   ├── masuk/                   # Login Google / email / OTP
│   │   ├── share/                   # Penerima Web Share Target
│   │   ├── auth/callback/           # Pertukaran kode OAuth → sesi
│   │   └── api/
│   │       ├── parse-receipt/       # OCR + AI → JSON transaksi
│   │       ├── parse-text/          # Teks/suara → JSON transaksi
│   │       ├── insights/            # Insight naratif
│   │       └── assistant/           # AI Keuangan
│   ├── components/                  # UI kit gaya shadcn + komponen aplikasi
│   ├── lib/
│   │   ├── types.ts defaults.ts format.ts utils.ts
│   │   ├── analytics.ts             # Saldo, ringkasan, tren, budget, insight
│   │   ├── parser.ts                # Parser heuristik struk & kalimat Indonesia
│   │   ├── image.ts                 # Preprocessing gambar di browser
│   │   ├── export.ts                # Excel / CSV / PDF
│   │   ├── store.tsx                # State global + CRUD
│   │   ├── repo.ts                  # Adapter localStorage / Supabase
│   │   ├── demo-data.ts             # Seed demo
│   │   ├── server/                  # ai.ts, ocr.ts, normalize.ts (server-only)
│   │   └── supabase/                # client, server, config
│   └── middleware.ts                # Penyegaran sesi Supabase
├── supabase/
│   ├── schema.sql                   # Tabel + RLS + Storage
│   └── seed.sql                     # Data demo untuk satu akun
├── public/sw.js                     # Service worker (Share Target)
└── .env.example
```

---

## Keamanan

- **Row Level Security** aktif di seluruh tabel; policy `auth.uid() = user_id`
  membuat data satu pengguna tidak mungkin terbaca pengguna lain.
- Setiap transaksi **wajib** punya `user_id`; klien juga menyaring ulang dengan
  `.eq('user_id', ...)` pada setiap update/delete.
- **Foto struk** disimpan di bucket privat `receipts`, dengan path `<user_id>/…`.
  Policy Storage mencocokkan folder pertama dengan `auth.uid()`, dan gambar hanya
  dibuka lewat *signed URL* berumur 1 jam.
- **API key tidak pernah sampai ke browser.** `ANTHROPIC_API_KEY`,
  `OCR_SPACE_API_KEY`, dan `GOOGLE_VISION_API_KEY` hanya dibaca di Route Handler.
  Hanya variabel `NEXT_PUBLIC_*` yang di-bundle ke klien.
- `.env.local` sudah masuk `.gitignore`.
- Middleware menyegarkan sesi Supabase pada setiap request agar cookie auth tidak
  kedaluwarsa di tengah pemakaian.

---

## Catatan desain

- **Mobile-first**, lebar maksimum 448px, bottom navigation lima slot dengan
  tombol `+` mengambang di tengah sebagai elemen paling menonjol.
- **Bahasa Indonesia** di seluruh antarmuka, mata uang IDR, format `Rp 1.250.000`,
  angka memakai *tabular numerals* agar kolom nominal rata.
- **Warna grafik** memakai pasangan diverging biru (uang masuk) ↔ merah (uang
  keluar) yang sudah divalidasi keterbacaannya untuk buta warna (protan ΔE 21.6 di
  mode terang, 19.2 di mode gelap) dan sengaja menghindari kombinasi merah-hijau.
- **Rincian kategori memakai bar peringkat, bukan pie/donut.** Kategori bisa
  belasan; identitasnya dibawa label + emoji + nominal, sehingga tetap terbaca di
  layar ponsel tanpa legenda belasan warna.
- Mode gelap punya palet tersendiri (bukan pembalikan otomatis) dan diterapkan
  sebelum halaman dilukis agar tidak berkedip.

---

## Troubleshooting

| Gejala | Penyebab & solusi |
|---|---|
| "Belum ada OCR/AI yang dikonfigurasi" saat scan | Isi `ANTHROPIC_API_KEY` (atau salah satu key OCR) di `.env.local`, lalu restart server |
| AI Keuangan menjawab 503 | `ANTHROPIC_API_KEY` kosong. Insight deterministik di Dashboard & Laporan tetap berjalan |
| Login Google gagal redirect | Tambahkan `<origin>/auth/callback` ke *Redirect URLs* Supabase dan ke *Authorized redirect URI* Google Cloud |
| Data tidak tersinkron antar perangkat | Aplikasi masih mode demo. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Struk gagal diunggah | Jalankan `supabase/schema.sql` (membuat bucket `receipts` + policy), pastikan ukuran file < 10 MB |
| CATATIN tidak muncul di menu Bagikan Android | Buka lewat HTTPS lalu pasang ke layar utama; Share Target hanya aktif untuk PWA terpasang |
| Kamera tidak terbuka | Butuh HTTPS atau `localhost`, dan izin kamera browser |
| Font terlihat berbeda | Plus Jakarta Sans dimuat dari Google Fonts; kalau offline, otomatis jatuh ke system font stack |

---

Dibuat untuk Indonesia 🇮🇩
