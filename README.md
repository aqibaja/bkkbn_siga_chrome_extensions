# 🚀 SIGA Smart Downloader

Chrome Extension untuk otomatisasi download massal data SIGA BKKBN dengan efisiensi hingga 98%.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Tests](https://img.shields.io/badge/tests-27%20passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-51.62%25-yellow)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 📋 Daftar Isi

- [Fitur Utama](#fitur-utama)
- [Instalasi](#instalasi)
- [Penggunaan](#penggunaan)
- [Testing](#testing)
- [Dokumentasi](#dokumentasi)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## ✨ Fitur Utama

### 🎯 Dual Mode Operation
- **Metode 1**: Multi URL + Single Kabupaten (untuk laptop powerful RAM ≥8GB)
- **Metode 2**: Single URL + Multi Kabupaten (untuk laptop standar)

### 📊 Real-time Progress Tracking
- Monitor status download per URL
- Progress bar dengan persentase akurat
- Informasi file terakhir yang didownload
- Status: Queue → In Progress → Success/Failed

### ⚡ Performa Tinggi
- Efisiensi waktu 98% (vs manual download)
- Akurasi data 95%
- Support Unicode-safe URL hashing
- Persistent state dengan chrome.storage.local

### 🔧 Fitur Tambahan
- Auto-populate dropdown kecamatan based on kabupaten
- Validasi URL otomatis (http/https only)
- Select All / Reset checkboxes
- Download tab dengan live updates

---

## 💾 Instalasi

### Prerequisites
- Google Chrome atau Microsoft Edge (versi terbaru)
- RAM minimal 4GB (8GB recommended untuk Metode 1)
- Koneksi internet stabil

### Langkah Instalasi

1. **Download Ekstensi**
   ```bash
   # Clone repository
   git clone https://github.com/aqibaja/bkkbn_siga_chrome_extensions.git
   cd bkkbn_siga_chrome_extensions
   ```

2. **Install ke Browser**
   - Buka `chrome://extensions/` di address bar
   - Aktifkan **Developer Mode** (toggle di kanan atas)
   - Klik **Load unpacked**
   - Pilih folder ekstensi yang sudah di-download

3. **Verifikasi Instalasi**
   - Icon ekstensi muncul di toolbar browser
   - Klik icon untuk buka popup
   - Pastikan semua tab (TAHUNAN, BULANAN, DOWNLOAD) berfungsi

---

## 🎓 Penggunaan

### Metode 1: Multi URL - Single Kabupaten

**Cocok untuk**: Laptop RAM ≥8GB, download berbagai jenis laporan untuk 1 kabupaten

**Langkah**:
1. Buka tab **TAHUNAN** atau **BULANAN**
2. Copy paste **SEMUA URL** laporan (pisahkan dengan enter)
3. Pilih **HANYA 1 KABUPATEN**
4. Set filter tambahan (periode, tahun, dll)
5. Klik **Submit**
6. Buka tab **DOWNLOAD** untuk monitor progress

**Contoh**:
```
https://siga.bkkbn.go.id/tabel1
https://siga.bkkbn.go.id/tabel2
https://siga.bkkbn.go.id/tabel3
```
☑️ Pilih: ACEH BESAR  
📅 Periode: Januari 2025  
✅ Hasil: 3 tab terbuka → 3 file Excel

---

### Metode 2: Single URL - Multi Kabupaten

**Cocok untuk**: Laptop standar, download 1 jenis laporan untuk banyak kabupaten

**Langkah**:
1. Buka tab **TAHUNAN** atau **BULANAN**
2. Copy paste **HANYA 1 URL** laporan
3. Pilih **BANYAK KABUPATEN** (bisa gunakan "Pilih Semua")
4. Set filter tambahan
5. Klik **Submit**
6. Ekstensi akan proses satu per satu (reuse 1 tab)

**Contoh**:
```
https://siga.bkkbn.go.id/lap_catin_bul
```
☑️ Pilih: SEMUA 23 Kabupaten  
📅 Periode: Februari 2025  
✅ Hasil: 1 tab digunakan berulang → 23 file Excel

---

## 🧪 Testing

Ekstensi ini dilengkapi dengan comprehensive unit tests untuk memastikan kualitas kode.

### Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Watch mode (auto-rerun on file change)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Statistics

- ✅ **27 test cases** - All passing
- ✅ **51.62% statement coverage**
- ✅ **41.33% branch coverage**
- ✅ **45.45% function coverage**

### Test Coverage

| Function | Coverage | Status |
|----------|----------|--------|
| safeUrlHash | 100% | ✅ |
| renderCheckboxes | 100% | ✅ |
| updateKecamatanDropdown | 100% | ✅ |
| renderDownloadTab | 100% | ✅ |
| resetDownloadProgress | 100% | ✅ |
| switchToDownloadTab | 100% | ✅ |
| initializeDownloadProgress | 100% | ✅ |

**Dokumentasi Lengkap**: Lihat [TESTING.md](./TESTING.md) dan [TEST_RESULTS.md](./TEST_RESULTS.md)

---

## 📚 Dokumentasi

### File Struktur
```
siga_excel_downloader/
├── manifest.json           # Chrome extension manifest
├── popup.html             # UI popup ekstensi
├── popup.js               # Logic popup & form handling
├── popup.css              # Styling popup
├── background.js          # Service worker untuk proses background
├── content.js             # Content script untuk inject ke halaman SIGA
├── icons/                 # Icon ekstensi (16x16, 48x48, 128x128)
│
├── tutorial/
│   └── index.html         # Halaman tutorial interaktif dengan survey
│
├── package.json           # NPM dependencies & scripts
├── jest.config.js         # Jest testing configuration
├── jest.setup.js          # Jest global setup
├── popup.test.js          # Unit tests (27 test cases)
│
├── README.md              # Dokumentasi utama (file ini)
├── TESTING.md             # Dokumentasi testing lengkap
└── TEST_RESULTS.md        # Hasil test terbaru
```

### Tutorial Interaktif

Akses halaman tutorial di `tutorial/index.html` untuk:
- 📖 **Panduan instalasi** step-by-step
- 🎯 **Tutorial penggunaan** kedua metode
- 📊 **Tips & best practices**
- ❓ **FAQ** dan troubleshooting
- 📝 **Survey kepuasan** dengan integrasi Google Sheets

---

## 🔧 Troubleshooting

### Problem: Download stuck / tidak jalan
**Solusi**:
- Refresh halaman SIGA
- Pastikan sudah login ke SIGA
- Restart browser
- Cek koneksi internet

### Problem: Browser freeze / hang
**Solusi**:
- Terlalu banyak tab terbuka (Metode 1)
- Gunakan Metode 2 atau kurangi jumlah URL
- Tutup aplikasi lain yang membebani RAM

### Problem: Banyak status "Failed"
**Solusi**:
- Cek URL valid (http/https)
- Pastikan data tersedia di SIGA
- Cek periode dan tahun sesuai
- Cek koneksi internet stabil

### Problem: File tidak muncul di Downloads
**Solusi**:
- Izinkan pop-up & download otomatis di browser settings
- Cek folder Downloads tidak penuh
- Restart browser

**Dokumentasi Lengkap**: Lihat slide 15 di `tutorial/index.html`

---

## 🤝 Contributing

Contributions, issues, dan feature requests sangat diterima!

### How to Contribute

1. Fork repository ini
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

### Development Guidelines

1. **Code Style**: Follow existing code patterns
2. **Testing**: Tambahkan test untuk fitur baru
3. **Documentation**: Update README dan TESTING.md
4. **Commit Messages**: Clear dan descriptive

---

## 📞 Support & Contact

**Tim Data dan Informasi (Datin)**  
**BKKBN Provinsi Aceh**

- 📧 **Email**: datin.aceh@bkkbn.go.id
- 📱 **WhatsApp**: +62 852 6015 6125
- 🕐 **Layanan**: Senin - Jumat, 08.00 - 16.00 WIB
- 📍 **Alamat**: Jl. T. Nyak Arif No.219, Banda Aceh

---

## 📄 License

MIT License - bebas digunakan untuk keperluan internal BKKBN.

Copyright © 2025 BKKBN Provinsi Aceh

---

## 🙏 Acknowledgments

- **BKKBN Provinsi Aceh** - Dukungan penuh untuk development
- **Tim Datin** - Feedback dan testing
- **Pengguna SIGA** - Bug reports dan feature requests

---

## 📈 Version History

### v1.0.0 (Oktober 2025)
- ✅ Initial release
- ✅ Dual mode operation (Multi URL vs Multi Kabupaten)
- ✅ Real-time progress tracking
- ✅ Unicode-safe URL hashing
- ✅ Comprehensive unit tests (27 test cases)
- ✅ Interactive tutorial page dengan survey integration
- ✅ Auto kecamatan dropdown based on kabupaten selection

---

**Developed with ❤️ by Tim Datin BKKBN Provinsi Aceh**

[![GitHub](https://img.shields.io/badge/GitHub-aqibaja-black?logo=github)](https://github.com/aqibaja/bkkbn_siga_chrome_extensions)

