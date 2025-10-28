# 🧪 Unit Testing - SIGA Smart Downloader

## 📋 Daftar Isi
- [Instalasi](#instalasi)
- [Menjalankan Test](#menjalankan-test)
- [Coverage Report](#coverage-report)
- [Test Cases](#test-cases)
- [Struktur File](#struktur-file)

---

## 🚀 Instalasi

### 1. Install Dependencies
```bash
npm install
```

Atau jika menggunakan yarn:
```bash
yarn install
```

### 2. Verifikasi Instalasi
Pastikan package berikut terinstall:
- `jest`: Framework testing
- `jest-environment-jsdom`: DOM environment untuk testing browser code
- `@types/jest`: Type definitions untuk better IDE support

---

## ▶️ Menjalankan Test

### Run All Tests
```bash
npm test
```

### Watch Mode (auto-rerun saat file berubah)
```bash
npm run test:watch
```

### Generate Coverage Report
```bash
npm run test:coverage
```

### Run Specific Test File
```bash
npx jest popup.test.js
```

### Run Test dengan Verbose Output
```bash
npx jest --verbose
```

---

## 📊 Coverage Report

Setelah menjalankan `npm run test:coverage`, report akan tersimpan di folder `coverage/`:

- **HTML Report**: Buka `coverage/lcov-report/index.html` di browser
- **Terminal Report**: Langsung tampil di terminal
- **LCOV Format**: `coverage/lcov.info` (untuk CI/CD integration)

### Target Coverage
- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

---

## ✅ Test Cases

### 1. **safeUrlHash** (7 tests)
- ✓ Menghasilkan string hash dari URL valid
- ✓ Hash konsisten untuk URL yang sama
- ✓ Hash berbeda untuk URL berbeda
- ✓ Handle URL dengan karakter Unicode
- ✓ Fallback hash jika btoa gagal

### 2. **renderCheckboxes** (4 tests)
- ✓ Render checkboxes untuk tab tahunan
- ✓ Render checkboxes untuk tab bulanan
- ✓ Setiap checkbox memiliki label yang sesuai
- ✓ Checkbox ID sesuai format `tab-cityId`

### 3. **updateKecamatanDropdown** (4 tests)
- ✓ Tampilkan dropdown jika 1 kabupaten dipilih
- ✓ Sembunyikan input text saat dropdown muncul
- ✓ Tampilkan input text jika >1 kabupaten dipilih
- ✓ Kosongkan nilai input jika tidak ada kabupaten dipilih

### 4. **renderDownloadTab** (4 tests)
- ✓ Render progress list dari chrome storage
- ✓ Tampilkan pesan jika tidak ada download
- ✓ Tampilkan progress bar dengan persentase benar
- ✓ Tampilkan status yang sesuai (Berhasil/GAGAL/Progress)

### 5. **resetDownloadProgress** (3 tests)
- ✓ Hapus semua entry `tabdownload_*` dari storage
- ✓ Kosongkan UI progress list
- ✓ Panggil callback setelah reset selesai

### 6. **switchToDownloadTab** (3 tests)
- ✓ Aktifkan tab Download
- ✓ Nonaktifkan tab lain
- ✓ Tampilkan download content

### 7. **initializeDownloadProgress** (3 tests)
- ✓ Inisialisasi progress untuk setiap unique URL
- ✓ Hitung totalFiles dengan benar per URL
- ✓ Set status awal sebagai "progress"

### 8. **Integration Tests** (1 test)
- ✓ Workflow lengkap: reset → initialize → render

**Total: 29 Test Cases**

---

## 📁 Struktur File

```
siga_excel_downloader/
├── popup.js                 # Source code utama
├── popup.test.js           # File unit test
├── jest.config.js          # Konfigurasi Jest
├── jest.setup.js           # Setup global untuk testing
├── package.json            # Dependencies & scripts
├── TESTING.md              # Dokumentasi testing (file ini)
└── coverage/               # Coverage report (auto-generated)
    ├── lcov-report/
    │   └── index.html
    └── lcov.info
```

---

## 🔧 Troubleshooting

### Error: Cannot find module 'jest'
**Solusi**: Install dependencies
```bash
npm install
```

### Error: Test environment not found
**Solusi**: Pastikan `jest-environment-jsdom` terinstall
```bash
npm install --save-dev jest-environment-jsdom
```

### Error: chrome is not defined
**Solusi**: Mock chrome API sudah di-setup di `popup.test.js`, pastikan file tidak diubah.

### Test Timeout
**Solusi**: Tambah timeout di test yang async
```javascript
test('nama test', (done) => {
  // test code
  done();
}, 10000); // 10 detik timeout
```

---

## 📝 Best Practices

1. **Selalu jalankan test sebelum commit**
   ```bash
   npm test
   ```

2. **Tulis test untuk setiap fungsi baru**
   - Function baru? → Tambahkan test case
   - Bug fix? → Tambahkan regression test

3. **Maintain coverage > 80%**
   ```bash
   npm run test:coverage
   ```

4. **Gunakan descriptive test names**
   ```javascript
   // ❌ Bad
   test('test 1', () => { ... });
   
   // ✅ Good
   test('harus menghasilkan hash yang konsisten untuk URL yang sama', () => { ... });
   ```

5. **Test async operations dengan done callback**
   ```javascript
   test('async test', (done) => {
     someAsyncFunction(() => {
       expect(result).toBe(expected);
       done();
     });
   });
   ```

---

## 🎯 Next Steps

- [ ] Tambahkan test untuk `background.js`
- [ ] Tambahkan test untuk `content.js`
- [ ] Setup CI/CD untuk auto-run tests
- [ ] Integrate dengan GitHub Actions
- [ ] Add E2E testing dengan Puppeteer

---

## 📞 Support

**Tim Datin BKKBN Provinsi Aceh**
- 📧 Email: datin.aceh@bkkbn.go.id
- 📱 WhatsApp: +62 852 6015 6125

---

© 2025 BKKBN Provinsi Aceh
