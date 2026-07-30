# Solo Leveling Status Window — Habit Tracker

## Cara deploy via GitHub (auto-deploy tiap update)

1. Buat akun di https://github.com (gratis)
2. Buat repository baru (nama bebas, misal `solo-leveling-tracker`)
3. Upload semua isi folder project ini ke repo tersebut — bisa lewat
   drag-and-drop di halaman "uploading an existing file", atau lewat
   Git command line kalau familiar
4. Buka https://netlify.com → "Add new site" → "Import an existing project"
   → "Deploy with GitHub" → pilih repo yang barusan dibuat
5. Netlify otomatis mendeteksi ini project Vite. Pastikan setting berikut
   (biasanya sudah terisi otomatis):
   - Build command: `npm run build`
   - Publish directory: `dist`
6. Klik "Deploy" — tunggu prosesnya selesai, dapat link publik
7. Setiap kamu mengubah kode dan push ulang ke GitHub, Netlify akan
   otomatis build & deploy ulang tanpa perlu langkah manual lagi

## Cara build & deploy ke Netlify (drag-and-drop manual, alternatif)

### 1. Install Node.js (kalau belum ada)
Download dari https://nodejs.org (pilih versi LTS). Ini wajib karena project
ini perlu di-"build" dulu jadi file statis sebelum bisa di-upload.

### 2. Buka folder ini lewat terminal, lalu jalankan:
```
npm install
npm run build
```

Setelah selesai, akan muncul folder baru bernama `dist/` — folder inilah
yang berisi file statis (HTML/CSS/JS) siap upload.

### 3. Upload ke Netlify
1. Buka https://netlify.com → daftar gratis (tanpa kartu kredit)
2. Di dashboard, cari area "Drag and drop your site output folder here"
3. Drag folder `dist/` (bukan folder project ini) ke area tersebut
4. Netlify akan otomatis kasih URL publik, misalnya `nama-acak.netlify.app`

### 4. Share link itu ke siapa saja
Karena aplikasi ini pakai localStorage (bukan database server), setiap
orang yang membuka link akan otomatis punya "save slot" sendiri di
browser mereka masing-masing — progress tidak akan tercampur.

## Ikon PWA
File `public/icon-192.png` dan `public/icon-512.png` sudah disertakan
di project ini, jadi fitur "Add to Home Screen" akan menampilkan ikon
custom (bukan ikon default browser) begitu di-deploy dengan HTTPS.

## Struktur project
```
solo-tracker-app/
├── index.html          <- entry point HTML
├── package.json        <- daftar dependency (react, vite)
├── vite.config.js      <- konfigurasi build
├── .gitignore          <- agar node_modules/dist tidak ikut ter-upload ke GitHub
├── public/
│   ├── manifest.json   <- konfigurasi PWA
│   ├── service-worker.js <- caching offline sederhana
│   ├── icon-192.png    <- ikon PWA ukuran kecil
│   └── icon-512.png    <- ikon PWA ukuran besar
└── src/
    ├── main.jsx        <- entry point React
    └── SoloLevelingTracker.jsx <- komponen utama aplikasi
```
