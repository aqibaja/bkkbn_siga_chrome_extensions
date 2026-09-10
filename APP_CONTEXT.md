# SIGA Smart Downloader — Application Context Summary

> **Dokumen ini dibuat otomatis untuk membantu AI agent memahami konteks aplikasi secara lengkap.**  
> Dibuat: 2026-05-11 | Versi Ekstensi: 1.0

---

## 1. Overview Aplikasi

**SIGA Smart Downloader** adalah Chrome Extension (Manifest V3) yang mengotomasi proses download laporan Excel dari sistem SIGA (Sistem Informasi Keluarga) BKKBN — situs resmi: `https://newsiga-siga.kemendukbangga.go.id/`.

**Tujuan utama:**
- Mengotomasi pemilihan dropdown filter (Periode, Tahun, Kab/Kota, Kecamatan, Desa/Faskes, RW, Sasaran) di halaman web SIGA.
- Mengklik tombol "Cetak Excel" secara otomatis.
- Mengganti nama file hasil download agar informatif (mengandung kode wilayah, periode, menu, submenu, dll).
- Mengelola antrian download untuk banyak wilayah sekaligus.

**Target pengguna:** Staf BKKBN Aceh yang secara rutin mengunduh laporan multi-wilayah dari portal SIGA.

---

## 2. Struktur File

```
siga_excel_downloader/
├── manifest.json            ← Konfigurasi ekstensi (MV3)
├── background.js            ← Service worker: orkestrasi, rename file, manajemen tab
├── content.js               ← Content script: otomasi interaksi DOM di tab SIGA
├── popup.html               ← UI popup ekstensi
├── popup.js                 ← Logika UI: form, queue builder, monitoring
├── popup.css                ← Styling popup
├── injected_blob_hook.js    ← Script injected ke halaman: intercept URL.createObjectURL
├── KODE WILAYAH.json        ← Data referensi kode wilayah (Kab/Kec/Desa) Provinsi Aceh
├── url-bulanan.json         ← Daftar URL SIGA per menu untuk laporan BULANAN
├── url-tahunan.json         ← Daftar URL SIGA per menu untuk laporan TAHUNAN
└── assets/logo.png          ← Logo popup
```

---

## 3. Manifest & Permissions

```json
{
  "manifest_version": 3,
  "name": "SIGA Smart Downloader",
  "version": "1.0",
  "permissions": ["scripting", "tabs", "activeTab", "storage", "downloads"],
  "host_permissions": ["<all_urls>"],
  "content_scripts": [{ "matches": ["https://newsiga-siga.kemendukbangga.go.id/*"], "js": ["content.js"] }],
  "background": { "service_worker": "background.js" },
  "web_accessible_resources": [{ "resources": ["injected_blob_hook.js"], "matches": ["..."] }]
}
```

---

## 4. Arsitektur & Alur Kerja

### 4.1 Alur Utama (Download Otomatis)

```
[User isi form di Popup]
        ↓
[popup.js: bangun downloadQueue]
        ↓
[Kirim message `processData` ke background.js]
        ↓
[background.js: buat tab baru per URL, simpan state ke chrome.storage.local `auto_<tabId>`]
        ↓
[content.js: dibaca di tab baru, ambil state, otomasi dropdown + klik Cetak Excel]
        ↓
[injected_blob_hook.js: intercept createObjectURL → kirim blobUrl ke content.js]
        ↓
[content.js: kirim `registerBlobRename` ke background.js]
        ↓
[background.js: `onDeterminingFilename` → rename file berdasarkan context]
        ↓
[content.js: update progress, lanjut ke kota/desa berikutnya atau tutup tab]
```

### 4.2 Mode Eksekusi

| Mode | Deskripsi |
|------|-----------|
| **Sekuensial** | 1 tab per URL, desa/faskes diproses berurutan dalam 1 tab. Aman untuk banyak data. |
| **Paralel** | Setiap item queue = 1 tab baru. Lebih cepat tapi berat untuk banyak data. |

---

## 5. Komponen Utama

### 5.1 `popup.js` (2271 baris) — UI & Queue Builder

**Tanggung jawab:**
- Navigasi 3-screen: Menu → Submenu → Form
- Render checkbox Kab/Kota, Kecamatan, Desa/Faskes
- Drag-select pada daftar desa/faskes dan tabel checklist
- Build `downloadQueue` sesuai kombinasi wilayah yang dipilih
- Kirim queue ke `background.js` via `chrome.runtime.sendMessage`
- Monitoring K0 (scraping data total/update/belum per kabupaten)
- Simpan & restore preferensi user (`userPrefs` di `chrome.storage.local`)

**Data kota hardcoded:** 23 Kab/Kota di Aceh (ID 01–18, 71–75).

**Data kecamatan:** Hardcoded per kabupaten di konstanta `kecamatanData`.

**Data desa/faskes:** Dimuat dari `KODE WILAYAH.json` (lookup berdasarkan kode kab + nama kecamatan).

**URL tabel:** Dimuat dari `url-bulanan.json` dan `url-tahunan.json`, diparsing via `parseUrlJson()`.

**Fungsi kunci:**
| Fungsi | Keterangan |
|--------|-----------|
| `loadUrlData()` | Fetch & parse JSON URL tabel per menu |
| `loadWilayahData()` | Fetch `KODE WILAYAH.json` |
| `renderCheckboxes()` | Render checkbox kab/kota |
| `renderKecamatanCheckboxes()` | Render checkbox kecamatan per kab |
| `renderListDesaFaskes()` | Render checkbox desa/faskes dari `wilayahData` |
| `setupDragSelectDesa()` | Drag-select untuk desa |
| `setupDragSelect()` | Drag-select untuk tabel checklist |
| `syncDesaToUrl()` | Update counter saat checkbox desa berubah |
| `syncTabelToUrl()` | Sinkron URL ke textarea dari tabel yang dicentang |
| `renderTabelSelector()` | Render checklist tabel per submenu |
| `setupFormSubmit()` | Handler submit form, bangun queue, kirim ke background |
| `initializeDownloadProgress()` | Inisialisasi entry progress di storage |
| `renderDownloadTab()` | Render progress UI di tab Download |
| `handleRetryFailedItems()` | Retry item gagal |
| `handleCancelAndCloseTab()` | Cancel dan tutup tab automation |
| `handleRetryAll()` | Retry semua item gagal/progress |
| `handleClearDone()` | Hapus entry success dari progress list |
| `setupBkbMonitoring()` | Setup monitoring K0 |
| `saveUserPrefs()` / `restoreUserPrefs()` | Simpan/restore state form |
| `applyFieldVisibility()` | Show/hide field form sesuai submenu |
| `detectSasaranFromUrl()` | Deteksi sasaran (catin/baduta/bumil/dll) dari URL |

**Menu & Submenu yang didukung:**
```
LAPORAN → yan-kb | dallap | kbs | elsimil
REKAPITULASI → rekap-keluarga
VERVAL KRS → krs-keluarga | monitoring-krs
Pendaftaran ELSIMIL → catin | ibu-hamil | pascapersalinan | baduta
Monitoring K0 → (special panel, tanpa form Tahunan/Bulanan)
```

---

### 5.2 `background.js` (494 baris) — Service Worker

**Tanggung jawab:**
- Terima message dari popup/content, koordinasi tab
- Kelola antrian rename context (`renameQueue`, `pendingRenameList`, `renameContext`)
- Hook `chrome.downloads.onDeterminingFilename` untuk rename file
- Tutup tab automation bila selesai

**Message actions yang ditangani:**

| Action | Pengirim | Fungsi |
|--------|----------|--------|
| `setRenameContext` | popup.js | Antri context rename file |
| `wakeMeUp` | content.js | Anti-sleep: aktifkan tab (800ms) |
| `processData` | popup.js | Buat tab baru + simpan state `auto_<tabId>` |
| `getTabId` | content.js | Kembalikan tab ID ke content script |
| `navigateAndReload` | content.js | Update URL tab + reload |
| `closeTab` | content.js | Tutup tab automation |
| `retryFailedUrl` | popup.js | Reload tab atau buat tab baru untuk retry |
| `cancelUrl` | popup.js | Set `cancelled=true`, tutup tab |
| `registerBlobRename` | content.js | Daftarkan blob URL + payload rename |

**Logika Rename File (`onDeterminingFilename`):**
1. Filter: hanya proses download dari `newsiga-siga.kemendukbangga.go.id`
2. Cari blob-specific context dulu (`rename_for_<blobUrl>`) — polling 10x setiap 150ms
3. Fallback: cek tab-specific context (`auto_<tabId>`)
4. Fallback: cek `pendingRenameList` → `renameQueue` → `renameContext` global

**Format nama file yang dihasilkan:**
```
<locationCode>-<periode>-<tahun>-<kab>-<submenu>-<jenisLaporan>-<sasaran>-<kec>-<desa>-<originalBase>.<ext>
```
- Contoh: `0601-April-2026-ACEH_BESAR-elsimil-detail-catin-SEULIMEUM-1234_DESA_A-Tabel1.xlsx`

**Storage keys yang digunakan:**
| Key | Isi |
|-----|-----|
| `auto_<tabId>` | State automation per tab: `downloadQueue`, `currentIndex`, `periode`, dll |
| `renameContext` | Context rename global (fallback) |
| `renameQueue` | Array context rename untuk multi-download |
| `pendingRenameList` | Mirror renameQueue (max 200 entry) |
| `renameEnabled` | Boolean apakah rename aktif |
| `rename_for_<blobUrl>` | Context rename per blob URL spesifik |
| `tabdownload_<hash>` | Progress per URL/item untuk ditampilkan di popup |
| `bkbMonitoring` | State monitoring K0 |
| `userPrefs` | Preferensi user tersimpan |
| `closeDelay` | Delay (detik) sebelum tutup tab (default: 10) |

---

### 5.3 `content.js` (1004 baris) — Automation Script

**Di-inject ke semua halaman `https://newsiga-siga.kemendukbangga.go.id/*` setelah document_idle.**

**Alur eksekusi:**
1. Cek `bkbMonitoring` state → jika aktif, jalankan `handleBkbMonitoringLoop()`
2. Cek `auto_<tabId>` state → jika tidak ada, keluar
3. Jika `cancelled=true`, keluar
4. Proses item saat ini dari `downloadQueue[currentIndex]`
5. Set rename context → kirim `setRenameContext` ke background
6. Pilih dropdown secara berurutan:
   - **Bulanan:** Tahun dulu → Periode (Bulan) → Kab/Kota → Kecamatan → Desa/Faskes → RW → Sasaran
   - **Tahunan:** Periode (Tahun) → Tahun → Kab/Kota → Kecamatan → Desa/Faskes → RW → Sasaran
7. Klik tombol "Cetak Excel" (cari `button` yang mengandung teks "Cetak" dan ikon `icon-file-excel`)
8. Inject `injected_blob_hook.js` → tunggu blob URL → daftarkan ke background
9. Jika `jenisLaporan` ada → `handlePopup()` untuk klik tombol Rekap/Detail
10. Update progress ke storage → kirim `refresh_download_status`
11. Lanjut ke item berikutnya atau tutup tab

**Fungsi kunci:**
| Fungsi | Keterangan |
|--------|-----------|
| `findDropdownControl(labelText)` | Cari elemen dropdown berdasarkan label text |
| `waitForDropdown(labelText, fallbackIndex)` | Wait + cari dropdown by label (timeout 5s) |
| `waitForDropdownByIndex(index)` | Wait + cari dropdown by DOM index (lebih reliable) |
| `bukaDanPilihPadaDropdown(control, targetText)` | Klik dropdown + cari + klik opsi (fuzzy match) |
| `waitForDropdownOptions()` | Observer + polling opsi dropdown |
| `handlePopup()` | Klik tombol Rekap/Detail di dialog |
| `handleBkbMonitoringLoop()` | Loop scraping data monitoring K0 |
| `markFail()` | Update status ke 'fail' di storage |
| `findProgressKey()` | Cari key progress yang sesuai |
| `getUrlHash(url)` | Base64 hash dari URL untuk storage key |

**Dropdown index (urutan di DOM SIGA):**

| Dropdown | Index Tahunan | Index Bulanan |
|----------|--------------|---------------|
| Periode | 0 | 0 |
| Tahun | 1 | 1 (diisi sebelum Periode) |
| Kab/Kota | 1 (tahunan) | 2 (bulanan) |
| Kecamatan | 2 (tahunan) | 3 (bulanan) |
| Desa/Kel/Faskes | 3 (tahunan) | 4 (bulanan) |
| RW | 4 (tahunan) | 5 (bulanan) |
| Kelompok Sasaran | 5 (tahunan) | 6 (bulanan) |

**Fuzzy matching opsi:** Exact → includes → split token → numeric code prefix

**Retry logic:** Jika dropdown tidak ditemukan dan `retryCount === 0`, reload halaman dan set `retryCount: 1`. Jika masih gagal setelah retry → `markFail` → lanjut ke item berikutnya.

---

### 5.4 `injected_blob_hook.js` (8 baris) — Blob Interceptor

Diinjeksikan ke halaman oleh `content.js` (via `<script src="chrome-extension://...">`) untuk memonitor pembuatan Blob URL oleh SIGA:

```javascript
// Intercept URL.createObjectURL dan broadcast blobUrl
URL.createObjectURL = function(blob) {
    const url = original.call(this, blob);
    window.postMessage({ type: 'SIGA_EXCEL_DOWNLOADER_BLOB', blobUrl: url }, '*');
    return url;
};
```

`content.js` mendengarkan event `message` ini untuk mendapatkan blob URL sebelum didaftarkan ke background untuk rename.

---

## 6. Data File Pendukung

### `KODE WILAYAH.json`
Array JSON berisi data wilayah Aceh: `KODE KABUPATEN`, `NAMA KECAMATAN`, `KODE DESA`, `NAMA DESA`. Digunakan untuk:
- Menampilkan daftar desa/faskes per kecamatan di popup
- Mengekstrak kode wilayah untuk nama file

### `url-bulanan.json` & `url-tahunan.json`
Array flat dengan kolom `id`, `url`, `nama`. Format ID mengikuti menu/submenu SIGA:
- `id`: identifier menu (contoh: `yan-kb`, `elsimil`, `krs-keluarga`, dll.)
- `url`: URL halaman SIGA untuk menu tersebut
- `nama`: Label yang ditampilkan di checklist tabel

Parsing dilakukan oleh `parseUrlJson()`. Grup dengan 1 URL → auto-fill textarea (tidak tampil checklist).

---

## 7. Chrome Storage Schema

```javascript
// State per tab automation
chrome.storage.local = {
  "auto_<tabId>": {
    downloadQueue: [{ kota, url, kecamatan, desa, faskes, rw, sasaran, renameContext, kabCode, kecCode, desaCode }],
    currentIndex: 0,           // index item aktif di downloadQueue
    periode: "April",         // bulan (bulanan) atau tahun (tahunan)
    tahun: "2026",
    jenisLaporan: "rekap"|"detail"|"",
    menu: "laporan",
    submenu: "elsimil",
    faskes: "",
    desa: "",
    kecamatan: "",
    rw: "",
    sasaran: "",
    cancelled: false,
    progressKey: "tabdownload_...",
    retryCount: 0
  },

  // Progress display di popup
  "tabdownload_<hash>": {
    url: "https://...",
    status: "progress"|"success"|"fail",
    totalFiles: 5,
    filesCompleted: 2,
    fileAkhir: "ACEH BESAR",
    urlIndex: 0,
    kota, kecamatan, desa, faskes
  },

  // Rename context
  "renameContext": { menu, submenu, periode, tahun, kab, kabCode, kec, kecCode, jenisLaporan, desa, desaCode, faskes, rw, sasaran },
  "renameQueue": [...],
  "pendingRenameList": [...],
  "renameEnabled": true,
  "rename_for_blob:https://...uuid": { ...renameContext },

  // Monitoring K0
  "bkbMonitoring": {
    mode: "waiting"|"active"|"done",
    targetRoute: "#/kegiatan/kelompok_bkb",
    initialWaitMs: 30000,
    loopWaitMs: 8000,
    currentIndex: 3,
    queue: [{ id, name }],   // semua kab/kota Aceh
    results: [{ kota, total, update, belum }],
    lastUpdated: 1234567890
  },

  // User preferences
  "userPrefs": {
    activeMenuId, activeSubmenuId, activeScreen, activeTab,
    cities_tahunan: ["01","06"],
    kecamatan_tahunan: ["06 - SUKAMAKMUR"],
    tabel_tahunan: ["https://..."],
    desa_tahunan: ["12345678 - DESA CONTOH"],
    "periode-tahunan", "tahun", "jenis-laporan-tahunan", ...
  },

  "closeDelay": 10  // detik, dibaca oleh content.js sebelum tutup tab
}
```

---

## 8. Fitur Monitoring K0

Fitur khusus untuk scraping data "Monitoring K0" dari portal SIGA secara berurutan per kabupaten:

1. Popup buka tab baru ke `https://newsiga-siga.kemendukbangga.go.id/<targetRoute>`
2. Set `bkbMonitoring.mode = 'active'` di storage
3. `content.js` mendeteksi state ini → jalankan `handleBkbMonitoringLoop()`
4. Loop: pilih Kab/Kota → klik "Cari" → wait → ekstrak data (Total, Update, Belum) → simpan ke results
5. Setelah semua kabupaten selesai, set `mode = 'done'`
6. Popup poll status setiap 1.2 detik → tampilkan hasil

Data hasil monitoring dapat disalin ke clipboard dalam format TSV (untuk paste ke Excel).

---

## 9. UI Popup — 3 Screen Navigation

```
Screen 1: Menu (Pilih Kategori)
  ├── 📊 LAPORAN
  ├── 📋 REKAPITULASI
  ├── ✅ VERVAL KRS
  ├── 👶 Pendaftaran ELSIMIL
  └── 📡 Monitoring K0

Screen 2: Submenu (pilih sub-laporan)

Screen 3: Form
  ├── [Monitoring K0 Panel] (jika menu = monitoring-k0)
  ├── Tabs: [Tahunan] [Bulanan] [Download Progress]
  │
  ├── Tahunan Form:
  │     Tabel checklist → URL textarea → Periode (Tahun) → Kab/Kota checkbox
  │     → Kecamatan checkbox → Desa/Kel checkbox + search → RW → Sasaran
  │     → Jenis Laporan → Mode Eksekusi → Close Delay → [▶ Jalankan Download]
  │
  ├── Bulanan Form:
  │     Tabel checklist → URL textarea → Periode (Bulan) → Tahun → Kab/Kota checkbox
  │     → Kecamatan checkbox → Desa/Faskes checkbox + search
  │     → Jenis Laporan → Mode Eksekusi → Close Delay → [▶ Jalankan Download]
  │
  └── Download Tab:
        Progress bar per URL (%) | Status | File terakhir
        Tombol: [Retry] [Cancel] | [♻️ Retry Semua] [🗑️ Bersihkan Selesai]
```

---

## 10. Known Issues & Catatan Penting

### Masalah yang pernah ditangani:
1. **Dropdown salah pilih** — `waitForDropdownByIndex(index)` digunakan untuk Desa/Faskes (index pasti: 3 tahunan, 4 bulanan) karena label SIGA tidak konsisten.
2. **Tab background freeze** — Anti-sleep: `wakeMeUp` message → background aktifkan tab 800ms.
3. **Rename file salah** — Sistem antrian `renameQueue` + `pendingRenameList` + blob-specific context (`rename_for_<blobUrl>`) untuk menghindari overwrite context saat multi-download.
4. **Dropdown Bulan ter-reset saat pilih Tahun** — Mode Bulanan: pilih Tahun dulu sebelum Periode/Bulan.

### Catatan penting untuk pengembangan:
- SIGA menggunakan React + react-select (`.css-yk16xz-control`, `.css-yt9ioa-option`, dll.) → rentan perubahan class name.
- Blob hook (`injected_blob_hook.js`) punya fallback: DOM mutation observer + `window.postMessage`.
- Semua operasi storage bersifat async; gunakan callback atau Promise.
- `ALLOWED_HOST = "newsiga-siga.kemendukbangga.go.id"` — rename hanya untuk domain ini.
- `retryCount` direset ke 0 setiap pindah ke item berikutnya.
- Tab automation dibersihkan di `chrome.tabs.onRemoved`.

### TODO (belum selesai per TODO.md):
- Form submit queue logic untuk Desa/Faskes multi-select (partial done)
- Full prefs integration untuk desa checkboxes
- `restoreDesaFaskesCheckboxes()`
- Testing drag-select faskes list

---

## 11. Dependency Eksternal

- **Tidak ada npm package yang digunakan di runtime** (semua vanilla JS)
- `node_modules/` ada tapi hanya untuk development tooling
- Data wilayah: `KODE WILAYAH.json` (1.8 MB, lokal)
- SIGA portal: `https://newsiga-siga.kemendukbangga.go.id/` (React SPA)

---

## 12. Cara Kerja Penamaan File

**`buildFileName(context)` di `background.js`:**

```
context = {
  menu, submenu, periode, tahun,
  kab, kabCode,      ← nama & kode kabupaten
  kec, kecCode,      ← nama & kode kecamatan  
  desa, desaCode,    ← nama & kode desa (tahunan)
  faskes,            ← nama faskes (bulanan)
  jenisLaporan,      ← rekap|detail
  sasaran,           ← catin|baduta|bumil|pascapersalin
  rw                 ← RW (jika ada)
}
```

**Urutan parts dalam nama file:**
1. `locationCode` = `kabCode + kecCode + desaCode`
2. `periode` (bulan/tahun)
3. `tahun`
4. `kab` (nama kabupaten)
5. `submenu` (atau `sasaran` jika menu=laporan+submenu=elsimil)
6. `jenisLaporan`
7. `sasaran` (jika belum jadi submenu label)
8. `kec` (nama kecamatan, tanpa kode)
9. `desa/faskes` (format: `<kode>_<nama>`)
10. `<originalBase>.<ext>` (nama asli dari server)

Semua bagian di-`sanitize()`: karakter ilegal → `-`, spasi → `_`.

---

*Dokumen ini mencakup seluruh context teknis aplikasi SIGA Smart Downloader untuk memudahkan AI agent memahami struktur, alur kerja, dan keputusan desain yang sudah ada.*
