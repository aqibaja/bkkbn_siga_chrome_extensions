/**
 * Unit Test untuk SIGA Smart Downloader Extension
 * File: popup.test.js
 * Testing semua fungsi yang di-export dari popup.js
 */

// Mock storage untuk persistent data
let mockStorage = {};

// Mock DOM environment untuk testing
document.body.innerHTML = `
  <div id="cities-tahunan"></div>
  <div id="cities-bulanan"></div>
  <div id="download-progress-list"></div>
  <select id="kecamatan-select-tahunan"></select>
  <input id="kecamatan-tahunan" />
  <input id="kecamatan-bulanan" />
`;

// Mock chrome API
global.chrome = {
    storage: {
        local: {
            get: jest.fn((keys, callback) => {
                if (keys === null) {
                    // Return all data
                    callback(mockStorage);
                } else if (Array.isArray(keys)) {
                    // Return specific keys
                    const result = {};
                    keys.forEach(key => {
                        if (mockStorage[key]) result[key] = mockStorage[key];
                    });
                    callback(result);
                } else {
                    callback(mockStorage);
                }
            }),
            set: jest.fn((data, callback) => {
                // Merge data into mockStorage
                Object.assign(mockStorage, data);
                if (callback) callback();
            }),
            remove: jest.fn((keys, callback) => {
                const keysToRemove = Array.isArray(keys) ? keys : [keys];
                keysToRemove.forEach(key => {
                    delete mockStorage[key];
                });
                if (callback) callback();
            })
        }
    }
}; const {
    safeUrlHash,
    renderCheckboxes,
    updateKecamatanDropdown,
    renderDownloadTab,
    resetDownloadProgress,
    switchToDownloadTab,
    initializeDownloadProgress
} = require('./popup.js');

describe('SIGA Smart Downloader - Unit Tests', () => {

    // Reset mockStorage sebelum setiap test
    beforeEach(() => {
        mockStorage = {
            'tabdownload_abc123': {
                url: 'https://siga.bkkbn.go.id/test',
                status: 'progress',
                totalFiles: 10,
                filesCompleted: 5,
                fileAkhir: '01 - ACEH SELATAN',
                urlIndex: 0
            },
            'tabdownload_def456': {
                url: 'https://siga.bkkbn.go.id/test2',
                status: 'success',
                totalFiles: 5,
                filesCompleted: 5,
                fileAkhir: '02 - ACEH TENGGARA',
                urlIndex: 1
            }
        };
    });

    // ============================================
    // Test Suite 1: safeUrlHash
    // ============================================
    describe('safeUrlHash', () => {
        test('harus menghasilkan string hash dari URL yang valid', () => {
            const url = 'https://google.com';
            const hash = safeUrlHash(url);
            expect(typeof hash).toBe('string');
            expect(hash.length).toBeGreaterThan(5);
        });

        test('harus menghasilkan hash yang konsisten untuk URL yang sama', () => {
            const url = 'https://siga.bkkbn.go.id/test';
            const hash1 = safeUrlHash(url);
            const hash2 = safeUrlHash(url);
            expect(hash1).toBe(hash2);
        });

        test('harus menghasilkan hash yang berbeda untuk URL yang berbeda', () => {
            const url1 = 'https://siga.bkkbn.go.id/test1';
            const url2 = 'https://siga.bkkbn.go.id/test2';
            const hash1 = safeUrlHash(url1);
            const hash2 = safeUrlHash(url2);
            expect(hash1).not.toBe(hash2);
        });

        test('harus handle URL dengan karakter Unicode', () => {
            const url = 'https://siga.bkkbn.go.id/laporan?nama=Aceh%20Besar';
            const hash = safeUrlHash(url);
            expect(typeof hash).toBe('string');
            expect(hash.length).toBeGreaterThan(0);
        });

        test('harus menggunakan fallback hash jika btoa gagal', () => {
            // Simulasi error dengan URL yang sangat panjang atau invalid
            const invalidUrl = 'https://test.com/' + '🎯'.repeat(10000);
            const hash = safeUrlHash(invalidUrl);
            expect(typeof hash).toBe('string');
            expect(hash.length).toBeGreaterThan(0);
        });
    });

    // ============================================
    // Test Suite 2: renderCheckboxes
    // ============================================
    describe('renderCheckboxes', () => {
        beforeEach(() => {
            document.getElementById('cities-tahunan').innerHTML = '';
            document.getElementById('cities-bulanan').innerHTML = '';
        });

        test('harus render checkboxes untuk tab tahunan', () => {
            renderCheckboxes('cities-tahunan', 'tahunan');
            const container = document.getElementById('cities-tahunan');
            const checkboxes = container.querySelectorAll('input[type="checkbox"]');
            expect(checkboxes.length).toBeGreaterThan(0);
            expect(checkboxes.length).toBe(23); // Total 23 kabupaten/kota
        });

        test('harus render checkboxes untuk tab bulanan', () => {
            renderCheckboxes('cities-bulanan', 'bulanan');
            const container = document.getElementById('cities-bulanan');
            const checkboxes = container.querySelectorAll('input[type="checkbox"]');
            expect(checkboxes.length).toBe(23);
        });

        test('setiap checkbox harus memiliki label yang sesuai', () => {
            renderCheckboxes('cities-tahunan', 'tahunan');
            const container = document.getElementById('cities-tahunan');
            const labels = container.querySelectorAll('label');
            expect(labels.length).toBe(23);
            expect(labels[0].textContent).toContain('ACEH SELATAN');
        });

        test('checkbox ID harus sesuai format tab-cityId', () => {
            renderCheckboxes('cities-tahunan', 'tahunan');
            const container = document.getElementById('cities-tahunan');
            const firstCheckbox = container.querySelector('input[type="checkbox"]');
            expect(firstCheckbox.id).toMatch(/^tahunan-\d+$/);
        });
    });

    // ============================================
    // Test Suite 3: updateKecamatanDropdown
    // ============================================
    describe('updateKecamatanDropdown', () => {
        beforeEach(() => {
            // Setup mock DOM untuk testing dropdown
            const kecamatanInput = document.getElementById('kecamatan-tahunan');
            kecamatanInput.value = '';
            kecamatanInput.style.display = 'block';

            // Hapus select yang mungkin ada
            const existingSelect = kecamatanInput.parentElement.querySelector('select');
            if (existingSelect) existingSelect.remove();

            renderCheckboxes('cities-tahunan', 'tahunan');
        });

        test('harus menampilkan dropdown kecamatan jika hanya 1 kabupaten dipilih', () => {
            // Pilih Aceh Selatan (id: 01)
            const checkbox = document.getElementById('tahunan-01');
            checkbox.checked = true;

            updateKecamatanDropdown('tahunan');

            const select = document.querySelector('#kecamatan-select-tahunan');
            expect(select).toBeTruthy();
            expect(select.options.length).toBeGreaterThan(1);
        });

        test('harus menyembunyikan input text ketika dropdown muncul', () => {
            const checkbox = document.getElementById('tahunan-01');
            checkbox.checked = true;

            updateKecamatanDropdown('tahunan');

            const input = document.getElementById('kecamatan-tahunan');
            expect(input.style.display).toBe('none');
        });

        test('harus menampilkan input text jika lebih dari 1 kabupaten dipilih', () => {
            const checkbox1 = document.getElementById('tahunan-01');
            const checkbox2 = document.getElementById('tahunan-02');
            checkbox1.checked = true;
            checkbox2.checked = true;

            updateKecamatanDropdown('tahunan');

            const input = document.getElementById('kecamatan-tahunan');
            expect(input.style.display).toBe('block');
        });

        test('harus mengosongkan nilai input jika tidak ada kabupaten dipilih', () => {
            const input = document.getElementById('kecamatan-tahunan');
            input.value = 'Test Value';

            updateKecamatanDropdown('tahunan');

            expect(input.value).toBe('');
        });
    });

    // ============================================
    // Test Suite 4: renderDownloadTab
    // ============================================
    describe('renderDownloadTab', () => {
        test('harus render progress list dari chrome storage', (done) => {
            renderDownloadTab();

            // Tunggu async operation selesai
            setTimeout(() => {
                const progressList = document.getElementById('download-progress-list');
                expect(progressList.innerHTML).toContain('URL 1:');
                expect(progressList.innerHTML).toContain('https://siga.bkkbn.go.id/test');
                done();
            }, 150);
        });

        test('harus menampilkan pesan jika tidak ada download', (done) => {
            // Kosongkan storage
            mockStorage = {};

            renderDownloadTab();

            setTimeout(() => {
                const progressList = document.getElementById('download-progress-list');
                expect(progressList.innerHTML).toContain('Tidak ada proses download');
                done();
            }, 150);
        });

        test('harus menampilkan progress bar dengan persentase yang benar', (done) => {
            renderDownloadTab();

            setTimeout(() => {
                const progressList = document.getElementById('download-progress-list');
                expect(progressList.innerHTML).toContain('50%'); // 5/10 = 50%
                expect(progressList.innerHTML).toContain('100%'); // 5/5 = 100%
                done();
            }, 150);
        });

        test('harus menampilkan status yang sesuai (Berhasil/GAGAL/Progress)', (done) => {
            renderDownloadTab();

            setTimeout(() => {
                const progressList = document.getElementById('download-progress-list');
                expect(progressList.innerHTML).toContain('Progress');
                expect(progressList.innerHTML).toContain('Berhasil');
                done();
            }, 150);
        });
    });    // ============================================
    // Test Suite 5: resetDownloadProgress
    // ============================================
    describe('resetDownloadProgress', () => {
        test('harus menghapus semua entry tabdownload_ dari storage', (done) => {
            resetDownloadProgress(() => {
                expect(chrome.storage.local.remove).toHaveBeenCalled();
                done();
            });
        });

        test('harus mengosongkan UI progress list', (done) => {
            resetDownloadProgress(() => {
                const progressList = document.getElementById('download-progress-list');
                expect(progressList.innerHTML).toContain('Memulai proses download');
                done();
            });
        });

        test('harus memanggil callback setelah reset selesai', (done) => {
            const mockCallback = jest.fn();
            resetDownloadProgress(mockCallback);

            setTimeout(() => {
                expect(mockCallback).toHaveBeenCalled();
                done();
            }, 100);
        });
    });

    // ============================================
    // Test Suite 6: switchToDownloadTab
    // ============================================
    describe('switchToDownloadTab', () => {
        beforeEach(() => {
            // Setup tab buttons dan content
            document.body.innerHTML += `
        <button class="tab-button active" data-tab="tahunan">Tahunan</button>
        <button class="tab-button" data-tab="bulanan">Bulanan</button>
        <button class="tab-button" data-tab="download">Download</button>
        <div id="tahunan-content" class="tab-content active"></div>
        <div id="bulanan-content" class="tab-content"></div>
        <div id="download-content" class="tab-content"></div>
        <div id="download-progress-list"></div>
      `;
        });

        test('harus mengaktifkan tab Download', () => {
            switchToDownloadTab();

            const downloadTab = document.querySelector('[data-tab="download"]');
            expect(downloadTab.classList.contains('active')).toBe(true);
        });

        test('harus menonaktifkan tab lain', () => {
            switchToDownloadTab();

            const tahunanTab = document.querySelector('[data-tab="tahunan"]');
            expect(tahunanTab.classList.contains('active')).toBe(false);
        });

        test('harus menampilkan download content', () => {
            switchToDownloadTab();

            const downloadContent = document.getElementById('download-content');
            expect(downloadContent.classList.contains('active')).toBe(true);
        });
    });

    // ============================================
    // Test Suite 7: initializeDownloadProgress
    // ============================================
    describe('initializeDownloadProgress', () => {
        beforeEach(() => {
            // Reset storage untuk test ini
            mockStorage = {};
        });

        test('harus inisialisasi progress untuk setiap unique URL', (done) => {
            const downloadQueue = [
                { url: 'https://siga.bkkbn.go.id/test1', kota: '01 - ACEH SELATAN' },
                { url: 'https://siga.bkkbn.go.id/test1', kota: '02 - ACEH TENGGARA' },
                { url: 'https://siga.bkkbn.go.id/test2', kota: '01 - ACEH SELATAN' }
            ];

            initializeDownloadProgress(downloadQueue);

            setTimeout(() => {
                // Harusnya ada 2 unique URLs
                const keys = Object.keys(mockStorage).filter(k => k.startsWith('tabdownload_'));
                expect(keys.length).toBeGreaterThanOrEqual(2);
                done();
            }, 150);
        });

        test('harus menghitung totalFiles dengan benar per URL', (done) => {
            const downloadQueue = [
                { url: 'https://test.com/url1', kota: 'Kota A' },
                { url: 'https://test.com/url1', kota: 'Kota B' },
                { url: 'https://test.com/url1', kota: 'Kota C' }
            ];

            initializeDownloadProgress(downloadQueue);

            setTimeout(() => {
                // Cek apakah totalFiles = 3
                const keys = Object.keys(mockStorage).filter(k => k.startsWith('tabdownload_'));
                expect(keys.length).toBeGreaterThan(0);
                const data = mockStorage[keys[0]];
                expect(data.totalFiles).toBe(3);
                done();
            }, 150);
        });

        test('harus set status awal sebagai "progress"', (done) => {
            const downloadQueue = [
                { url: 'https://test.com/url1', kota: 'Kota A' }
            ];

            initializeDownloadProgress(downloadQueue);

            setTimeout(() => {
                const keys = Object.keys(mockStorage).filter(k => k.startsWith('tabdownload_'));
                const data = mockStorage[keys[0]];
                expect(data.status).toBe('progress');
                expect(data.filesCompleted).toBe(0);
                done();
            }, 150);
        });
    });    // ============================================
    // Test Suite 8: Integration Tests
    // ============================================
    describe('Integration Tests', () => {
        test('workflow lengkap: reset -> initialize -> render', (done) => {
            const downloadQueue = [
                { url: 'https://test.com/url1', kota: 'Kota A' },
                { url: 'https://test.com/url1', kota: 'Kota B' }
            ];

            // Step 1: Reset
            resetDownloadProgress(() => {
                // Step 2: Initialize
                initializeDownloadProgress(downloadQueue);

                setTimeout(() => {
                    // Step 3: Render
                    renderDownloadTab();

                    setTimeout(() => {
                        const progressList = document.getElementById('download-progress-list');
                        expect(progressList.innerHTML.length).toBeGreaterThan(0);
                        done();
                    }, 100);
                }, 100);
            });
        });
    });

});


