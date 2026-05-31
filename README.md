# 💰 Kas TRK Kelas B — Sistem Pengelolaan Keuangan Kelas

Aplikasi web untuk mengelola keuangan kelas secara digital. Dibuat untuk **Teknologi Rekayasa Komputer, Politeknik Pertanian Negeri Payakumbuh**.

---

## ✨ Fitur Utama

- **Dashboard** — KPI saldo, pemasukan, pengeluaran, grafik tren & kategori
- **Uang Kas Tracker** — Grid mingguan 16 pekan per anggota
- **Buku Kas (Ledger)** — Log audit seluruh transaksi dengan filter & pencarian
- **Daftar Kelas** — Manajemen anggota dan statistik iuran per siswa
- **Export CSV** — Unduh laporan transaksi dan data anggota
- **3 Mode Login** — Admin (pengurus), Siswa (NIM), Tamu (baca saja)
- **Responsive** — Desktop, tablet, dan mobile dengan bottom navigation

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Backend | Node.js + Express |
| Database | SQLite3 |
| Frontend | Vanilla JS + SVG Charts |
| Container | Docker + Docker Compose |
| Deploy | Railway / VPS |

---

## 🚀 Cara Menjalankan

### Menggunakan Docker (Direkomendasikan)

```bash
# Clone repo
git clone https://github.com/USERNAME/nama-repo.git
cd nama-repo

# Jalankan dengan Docker Compose
docker compose up --build
```

Akses di browser: `http://localhost:3000`

---

### Tanpa Docker (Manual)

**Prasyarat:** Node.js versi 18 ke atas

```bash
# Install dependencies
npm install

# Jalankan server
npm start
```

Akses di browser: `http://localhost:3000`

---

## ⚙️ Konfigurasi

### Password Admin

Password admin default ada di `server.js`:

```javascript
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ThoriqKomtingB';
```

**Cara mengubah password:**

**Option 1 — Environment variable (direkomendasikan):**
```bash
ADMIN_PASSWORD=passwordbaru npm start
```

**Option 2 — File `.env`:**
```
ADMIN_PASSWORD=passwordbaru
```

**Option 3 — Langsung di `server.js`:**
```javascript
const ADMIN_PASSWORD = 'passwordbaru';
```

---

### Jumlah Pekan Iuran

Default 16 pekan. Ubah di `app.js`:

```javascript
let state = {
  totalWeeks: 16,   // ← ganti angka ini
  ...
}
```

---

### Nominal Iuran per Pekan

Default Rp 5.000. Bisa diubah langsung dari UI (mode Admin) atau di `app.js`:

```javascript
let state = {
  defaultDuesAmount: 5000,   // ← ganti nominal (dalam rupiah)
  ...
}
```

---

### Nama Kelas & Judul Aplikasi

Ubah di `public/index.html`:

```html
<title>Kas TRK Kelas B — Dashboard Keuangan</title>  <!-- tab browser -->
```

```html
<h2>Kas TRK B</h2>          <!-- nama di sidebar -->
<span>Keuangan Kelas</span> <!-- subjudul sidebar -->
```

---

### Favicon / Logo

Simpan file gambar logo ke `public/logo.png`, lalu pastikan di `index.html` ada:

```html
<link rel="icon" type="image/png" href="logo.png">
```

---

## 🗄️ Struktur Project

```
project/
├── public/
│   ├── index.html      # Struktur halaman (HTML)
│   ├── styles.css      # Desain & layout (CSS)
│   ├── app.js          # Logika frontend (JavaScript)
│   └── logo.webp        # Logo/favicon
├── data/
│   └── keuangan.db     # Database SQLite (auto-dibuat, jangan di-push ke git)
├── server.js           # API backend (Express)
├── database.js         # Koneksi & query database
├── package.json        # Dependensi Node.js
├── Dockerfile          # Konfigurasi Docker image
├── docker-compose.yml  # Konfigurasi Docker Compose
└── .gitignore
```

---

## 🔌 API Endpoints

| Method | Endpoint | Deskripsi | Auth |
|--------|----------|-----------|------|
| GET | `/api/summary` | Statistik dashboard | — |
| GET | `/api/members` | Daftar anggota | — |
| POST | `/api/members` | Tambah anggota baru | Admin |
| DELETE | `/api/members/:id` | Hapus anggota | Admin |
| POST | `/api/members/:id/toggle-lock` | Kunci/buka anggota | Admin |
| GET | `/api/transactions` | Semua transaksi | — |
| POST | `/api/transactions` | Tambah transaksi | Admin |
| DELETE | `/api/transactions/:id` | Hapus transaksi | Admin |
| POST | `/api/dues/toggle` | Toggle status iuran | Admin |
| POST | `/api/login/student` | Login siswa via NIM | — |
| GET | `/api/admin/verify` | Verifikasi password admin | Admin |

> **Auth Admin:** Kirim header `x-admin-password: <password>` pada setiap request yang membutuhkan autentikasi admin.

---

## 🚢 Deploy ke Railway (Gratis)

1. Push repo ke GitHub
2. Buka [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
3. Pilih repo ini
4. Railway otomatis detect `Dockerfile` dan build

**Set environment variable di Railway:**
- Klik service → tab **Variables**
- Tambah: `ADMIN_PASSWORD` = password yang kamu inginkan

**Tambah Volume agar data tidak hilang saat redeploy:**
- Klik **+ Add** → **Volume**
- Mount path: `/app/data`

---

## 🔧 Cara Modifikasi Umum

### Mengganti warna tema

Semua warna ada di bagian `:root` di `public/styles.css`:

```css
:root {
  --green:  #63eb84;   /* warna aksen utama */
  --amber:  #f6a832;   /* warna admin/pengurus */
  --rose:   #f9647c;   /* warna pengeluaran/hapus */
  --cyan:   #29d4f5;   /* warna aksen sekunder */
  --bg-base: #080c12;  /* warna background utama */
}
```

### Menambah kategori transaksi

Di `public/index.html`, cari `<select id="tx-category">` dan tambahkan option baru:

```html
<option value="nama_kategori">Label Kategori</option>
```

### Menambah anggota secara massal

Login sebagai Admin → menu **Daftar Kelas** → form **Tambah Siswa Baru**.
Atau langsung insert ke database SQLite di `data/keuangan.db`.

---

## 📝 .gitignore yang Disarankan

```
node_modules/
data/
*.db
*.sqlite
.env
```

---

## 📄 Lisensi

Project ini dibuat untuk keperluan internal kelas TRK B.
Bebas dimodifikasi dan digunakan untuk kelas lain dengan menyesuaikan konfigurasi di atas.

---

> Dibuat dengan ❤️ untuk Kelas TRK B — Politeknik Pertanian Negeri Payakumbuh 2025
