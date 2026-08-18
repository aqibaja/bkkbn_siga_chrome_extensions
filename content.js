(async () => {
  // Anti-sleep sekarang dihandle oleh anti_sleep.js di document_start

  // Helper: Wait beberapa ms
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Fungsi: Tunggu konfirmasi download selesai dari background.js
  // 4 channel: (1) direct message, (2) storage tab-specific, (3) storage universal, (4) active poll ke background
  function waitForDownloadComplete(tabId, timeoutMs = 90000) {
    const storageKeyTab = `downloadResult_${tabId}`;
    const storageKeyLast = 'siga_last_download';
    const startTs = Date.now();

    return new Promise((resolve) => {
      let settled = false;
      let timeoutId;
      let pollId;
      let bgPollId;

      const finish = (success, source) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        clearInterval(pollId);
        clearInterval(bgPollId);
        chrome.runtime.onMessage.removeListener(msgListener);
        chrome.storage.local.remove([storageKeyTab, storageKeyLast]);
        console.log(`[download-wait] Selesai via ${source}: ${success ? 'SUCCESS' : 'FAIL/TIMEOUT'}`);
        resolve(success);
      };

      // Channel 1: direct message dari background
      const msgListener = (msg) => {
        if (msg.action === 'downloadComplete') finish(true, 'message');
        else if (msg.action === 'downloadInterrupted') finish(false, 'message');
      };
      chrome.runtime.onMessage.addListener(msgListener);

      // Channel 2 & 3: poll storage setiap 500ms
      pollId = setInterval(() => {
        chrome.storage.local.get([storageKeyTab, storageKeyLast], (res) => {
          const tabResult = res[storageKeyTab];
          if (tabResult && tabResult.ts >= startTs) {
            finish(tabResult.state === 'complete', 'storage-tab');
            return;
          }
          const lastResult = res[storageKeyLast];
          if (lastResult && lastResult.ts >= startTs) {
            finish(lastResult.state === 'complete', 'storage-last');
          }
        });
      }, 500);

      // Channel 4: aktif tanya background setiap 1 detik (paling reliable)
      // Background langsung query chrome.downloads.search — tidak bergantung pada onChanged
      bgPollId = setInterval(() => {
        chrome.runtime.sendMessage(
          { action: 'checkSigaDownload', since: startTs },
          (resp) => {
            if (chrome.runtime.lastError) return; // background sedang sleep, coba lagi nanti
            if (resp && resp.found) finish(true, 'bg-poll');
          }
        );
      }, 1000);

      timeoutId = setTimeout(() => {
        console.warn(`⏳ [download-wait] Timeout ${timeoutMs / 1000}s. Melanjutkan...`);
        finish(false, 'timeout');
      }, timeoutMs);
    });
  }


  function findDropdownControl(labelText, fallbackIndex = 0) {
    const lowerLabel = (labelText || '').toString().trim().toLowerCase();

    if (lowerLabel) {
      // Smart fuzzy matching untuk label dengan penanganan variasi Kab/Kota
      const labelEls = [...document.querySelectorAll('label')].filter(l => {
        if (!l.textContent) return false;
        const txt = l.textContent.trim().toLowerCase();
        if (txt.includes(lowerLabel)) return true;

        if (lowerLabel.includes('kab') && lowerLabel.includes('kota')) {
          return (txt.includes('kab') && txt.includes('kota')) || txt.includes('kabupaten') || txt.includes('kota');
        }

        // Pencocokan token kata demi kata
        const tokens = lowerLabel.split(/[\s/_-]+/);
        return tokens.every(token => token.length > 1 && txt.includes(token));
      });

      for (const label of labelEls) {
        const container = label.closest('.form-group, .ant-form-item, .ant-form-item-control, .css-1bq5ukv, .row, .col');
        if (container) {
          const candidate = container.querySelector(
            'div[role="combobox"], div[role="button"], input[role="combobox"], .css-yk16xz-control, .ant-select-selector, .react-select__control, .select-container'
          );
          if (candidate) return candidate;
        }
        // jika direct sibling
        const sibling = label.parentElement && label.parentElement.querySelector(
          'div[role="combobox"], .css-yk16xz-control, .ant-select-selector, .react-select__control'
        );
        if (sibling) return sibling;
      }

      // Coba cari dari atribut (placeholder, aria-label, dsb)
      const candidateByAttr = [...document.querySelectorAll('input, div[role="combobox"], div[role="button"], .ant-select-selector, .react-select__control')].find(el => {
        const candidateText = (
          (el.placeholder || '') + ' ' +
          (el.getAttribute('aria-label') || '') + ' ' +
          (el.getAttribute('title') || '') + ' ' +
          (el.getAttribute('data-testid') || '')
        ).toString().toLowerCase();
        return candidateText.includes(lowerLabel);
      });
      if (candidateByAttr) return candidateByAttr;

      // KUNCI: Jangan kembalikan fallback selector jika labelText ditentukan agar pembacaan antarmuka dinamis
      // bisa menunggu (polling) hingga dropdown yang sebenarnya muncul di layar.
      return null;
    }

    // Hanya gunakan fallback selector jika tidak ada labelText (pembacaan berdasarkan index murni)
    const fallbackSelectors = [
      'div[role="combobox"]',
      'div[role="button"]',
      'input[role="combobox"]',
      '.css-yk16xz-control',
      '.ant-select-selector',
      '.react-select__control',
      '.select-container'
    ];

    for (const sel of fallbackSelectors) {
      const nodes = document.querySelectorAll(sel);
      if (nodes.length > 0) {
        if (fallbackIndex < nodes.length) return nodes[fallbackIndex];
        return nodes[0];
      }
    }

    const nodes = document.querySelectorAll('.css-yk16xz-control');
    return nodes[fallbackIndex] || nodes[0] || null;
  }

  async function waitForDropdown(labelText, fallbackIndex = 0, timeout = 20000, interval = 200) {
    const start = Date.now();
    let control;
    while (Date.now() - start < timeout) {
      control = findDropdownControl(labelText, fallbackIndex);
      if (control) return control;
      // KUNCI: Jika elemen dropdown sebenarnya sudah ter-render di DOM, 
      // jangan tunggu lama-lama, langsung gunakan fallback index.
      const nodes = document.querySelectorAll('.css-yk16xz-control, div[role="combobox"], .ant-select-selector');
      if (nodes.length > fallbackIndex) {
        // Hanya cetak log sekali di awal jika mau
        if (Date.now() - start < interval) {
          console.log(`⏩ Label '${labelText}' tidak ada, langsung ambil kotak ke-${fallbackIndex + 1}.`);
        }
        return nodes[fallbackIndex];
      }

      await wait(interval);
    }
    return null; // biarkan caller yang handle fail
  }

  // Tunggu dropdown spesifik berdasarkan urutan (index) di DOM, lebih aman dari salah label
  async function waitForDropdownByIndex(index, timeout = 20000, interval = 200) {
    const start = Date.now();
    let tries = 0;
    while (Date.now() - start < timeout) {
      const nodes = document.querySelectorAll('.css-yk16xz-control, div[role="combobox"], .ant-select-selector');
      if (nodes.length > index) {
        return nodes[index];
      }
      if (tries++ % 5 === 0) {
        chrome.runtime.sendMessage({ action: "wakeMeUp" }).catch(() => { });
      }
      await wait(interval);
    }
    return null;
  }

  // Buat hash unik dari URL (bisa pakai base64 atau hanya ambil bagian unik URL)
  function getUrlHash(url) {
    try {
      // Encode URL ke base64 yang aman untuk Unicode
      return btoa(encodeURIComponent(url).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode('0x' + p1);
      }));
    } catch (e) {
      console.error('Error encoding URL:', e);
      // Fallback: gunakan hash sederhana dari URL
      return url.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0).toString();
    }
  }

  // Helper delay

  // Fungsi untuk klik robust di dropdown
  function klikDropdown(control) {
    try {
      control.scrollIntoView({ behavior: "smooth" });
      control.focus();
      control.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      control.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      control.click();
    } catch (e) {
      console.error("Gagal klik dropdown:", e);
    }
  }

  // Cari key progress (`tabdownload_...`) yang cocok untuk hash
  async function findProgressKey(hash, downloadQueue) {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, function (all) {
        const keys = Object.keys(all).filter(k => k.startsWith(`tabdownload_${hash}`));
        if (keys.length === 0) {
          const fallbackKey = `tabdownload_${hash}`;
          resolve({ key: fallbackKey, existing: all[fallbackKey] || null });
          return;
        }
        // Prefer entry that is still in progress (not success and filesCompleted < totalFiles)
        for (const k of keys) {
          const obj = all[k];
          if (!obj) continue;
          if (obj.status !== 'success' && (typeof obj.filesCompleted !== 'number' || obj.filesCompleted < (obj.totalFiles || 1))) {
            resolve({ key: k, existing: obj });
            return;
          }
        }
        // Otherwise return the first
        resolve({ key: keys[0], existing: all[keys[0]] });
      });
    });
  }

  // Prefer progressKey from auto_<tabId> storage if present, else fallback to findProgressKey
  async function getKeyAndExisting(hash, downloadQueue, progressKeyFromAuto = null) {
    if (progressKeyFromAuto) {
      return new Promise((resolve) => {
        chrome.storage.local.get([progressKeyFromAuto], function (res) {
          resolve({ key: progressKeyFromAuto, existing: res[progressKeyFromAuto] || null });
        });
      });
    }
    return await findProgressKey(hash, downloadQueue);
  }

  // Fungsi observer + fallback polling untuk opsi dropdown
  async function waitForDropdownOptions(
    selectorOpt = '.css-yt9ioa-option, .css-1n7v3ny-option, .css-9gakcf-option, .ant-select-item, .ant-select-dropdown-menu-item, .react-select__option, [role="option"]',
    timeout = 4000
  ) {
    return new Promise((resolve) => {
      let found = false;
      const observer = new MutationObserver(() => {
        const options = document.querySelectorAll(selectorOpt);
        if (options.length > 0) {
          found = true;
          observer.disconnect();
          clearInterval(wakeTimer);
          resolve(options);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      const wakeTimer = setInterval(() => {
        chrome.runtime.sendMessage({ action: "wakeMeUp" }).catch(() => { });
      }, 800);

      setTimeout(() => {
        observer.disconnect();
        clearInterval(wakeTimer);
        // fallback: resolve empty options agar caller tidak exception
        resolve(document.querySelectorAll(selectorOpt));
      }, timeout);
    });
  }

  async function pollingDropdownOptions(
    selectorOpt = '.css-yt9ioa-option, .css-1n7v3ny-option, .css-9gakcf-option, .ant-select-item, .ant-select-dropdown-menu-item, .react-select__option, [role="option"]',
    timeout = 4000,
    interval = 100
  ) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      let opts = document.querySelectorAll(selectorOpt);
      if (opts.length > 0) return opts;
      await wait(interval);
    }
    return document.querySelectorAll(selectorOpt); // return kosong, jangan throw
  }

  // Konsolidasi fungsi pemilihan dropdown + status failure immediate
  async function bukaDanPilihPadaDropdown(control, targetTextRaw, url = null, kota = '', currentIndex = 0, downloadQueue = null) {
    const hash = url ? getUrlHash(url) : null;
    if (!control) {
      if (!url || !downloadQueue) { // pemanggilan lama tanpa context
        console.error(`Dropdown '${targetTextRaw}' tidak ditemukan (context tidak lengkap).`);
        return false;
      }
      await markFail(hash, url, kota, downloadQueue, currentIndex, `Dropdown '${targetTextRaw}' tidak ditemukan`);
      console.error(`❌ Dropdown untuk "${targetTextRaw}" tidak ditemukan. Proses dibatalkan.`);
      return false;
    }

    const userValue = (targetTextRaw || '').trim().replace(/\u2013|\u2014/g, '-').toLowerCase();
    control.scrollIntoView({ behavior: 'smooth' });
    control.click();
    await wait(250);
    control.focus();
    control.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown', code: 'ArrowDown' }));

    await waitForDropdownOptions();

    // Poll opsi dengan fuzzy match (tingkatkan maxTries menjadi 150 untuk antisipasi server SIGA yang lambat)
    const maxTries = 150;
    let opsi = null;
    for (let tries = 0; tries < maxTries; tries++) {
      if (tries % 5 === 0) {
        chrome.runtime.sendMessage({ action: "wakeMeUp" }).catch(() => { });
      }
      const allOptions = [...document.querySelectorAll('.css-yt9ioa-option, .css-1n7v3ny-option, .css-9gakcf-option, .ant-select-item, .ant-select-dropdown-menu-item, .react-select__option, [role="option"]')];
      opsi = allOptions.find(el => {
        const textOption = el.textContent.trim().replace(/\u2013|\u2014/g, '-').toLowerCase();
        return (
          textOption === userValue ||
          textOption.includes(userValue) ||
          userValue.split(' ').every(token => textOption.includes(token))
        );
      });
      if (opsi) break;

      // fallback numeric code matches: 01 - ACEH SELATAN => 01, ACEH SELATAN
      const userCode = (targetTextRaw || '').toString().trim().split(' ')[0];
      if (userCode && /^\d+/.test(userCode)) {
        opsi = allOptions.find(el => {
          const text = el.textContent.trim().replace(/\u2013|\u2014/g, '-').toLowerCase();
          return text.includes(userCode.toLowerCase());
        });
        if (opsi) break;
      }

      await wait(100);
    }

    if (!opsi) {
      if (!url || !downloadQueue) { // pemanggilan lama tanpa context
        console.error(`Opsi '${targetTextRaw}' tidak ditemukan (context tidak lengkap).`);
        return false;
      }
      await markFail(hash, url, kota, downloadQueue, currentIndex, `Opsi '${targetTextRaw}' tidak ditemukan`);
      console.error(`❌ Opsi "${targetTextRaw}" tidak ditemukan. Proses dihentikan.`);
      return false;
    }

    opsi.click();
    console.log(`✅ Berhasil pilih (fuzzy) '${targetTextRaw}' => '${opsi.textContent.trim()}'`);
    await wait(200);
    return true;
  }

  async function markFail(hash, url, kota, downloadQueue, currentIndex, reason) {
    const { key, existing: fromStorage } = await findProgressKey(hash, downloadQueue);
    const existing = fromStorage || {
      url,
      status: 'downloading',
      totalFiles: (downloadQueue && Array.isArray(downloadQueue)) ? downloadQueue.length : 1,
      filesCompleted: currentIndex,
      fileAkhir: kota || 'Provinsi'
    };
    existing.status = 'fail';
    existing.fileAkhir = `${existing.fileAkhir} (FAIL: ${reason})`;
    return new Promise(resolve => {
      chrome.storage.local.set({ [key]: existing }, () => {
        chrome.runtime.sendMessage({ action: 'refresh_download_status' });
        resolve();
      });
    });
  }

  function parseCount(text) {
    if (!text) return null;
    const m = text.toString().replace(/[\.]/g, '').match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }

  async function waitForButtonByText(label, timeout = 12000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent && b.textContent.trim().toLowerCase().includes(label.toLowerCase()));
      if (btn) return btn;
      await wait(300);
    }
    return null;
  }

  async function extractTotalUpdateBelum() {
    const text = (document.body && document.body.innerText) ? document.body.innerText : '';
    const getValue = (key) => {
      const regex = new RegExp(key + '\\s*[:\\-]?\\s*([\\d\\.,]+)', 'i');
      const m = text.match(regex);
      return m ? parseCount(m[1]) : 'N/A';
    };
    return {
      total: getValue('Total'),
      update: getValue('Update'),
      belum: getValue('Belum')
    };
  }

  // Deteksi & dismiss modal SweetAlert jika data kosong
  function getSweetAlertModalText() {
    const swal = document.querySelector('.swal2-container, .swal2-popup, .swal-modal, .sweet-alert, .swal-overlay');
    return swal ? (swal.innerText || '') : '';
  }

  function dismissSweetAlertModal() {
    const swal = document.querySelector('.swal2-container, .swal2-popup, .swal-modal, .sweet-alert, .swal-overlay');
    if (swal) {
      const okBtn = swal.querySelector('button.swal2-confirm, button.swal-button--confirm')
        || [...swal.querySelectorAll('button')].find(btn => /ok|tutup|close|confirm/i.test(btn.textContent || ''));
      if (okBtn) {
        okBtn.click();
        console.log('[BKB] SweetAlert Data Tidak Ditemukan ditutup otomatis.');
        return true;
      }
    }
    return false;
  }

  async function waitForKecamatanDataReady(timeout = 20000) {
    const start = Date.now();
    // Beri jeda kecil agar modal SweetAlert atau spinner loading sempat terpicu muncul di DOM
    await wait(400);

    while (Date.now() - start < timeout) {
      // 1) Cek modal "Data tidak ditemukan"
      const swalText = getSweetAlertModalText();
      if (/tidak ditemukan|tidak\s*ada|kosong/i.test(swalText)) {
        console.log('[BKB] Terdeteksi SweetAlert: Data tidak ditemukan.');
        dismissSweetAlertModal();
        await wait(500); // Tunggu animasi penutupan modal selesai
        return { success: false, reason: 'nodata' };
      }

      // 2) Cek spinner loading
      const loading = document.querySelector('.ant-spin, .spinner, [role="progressbar"], .loading, .loader');

      if (!loading) {
        // Cek baris tabel atau data angka
        const bodyText = document.body ? document.body.innerText : '';
        const hasRows = document.querySelectorAll('table tbody tr').length > 0;
        const hasNumeric = /total\s*[:\-]?\s*[\d\.,]+/i.test(bodyText);
        if (hasRows || hasNumeric) {
          return { success: true };
        }
      }
      await wait(250);
    }

    // Jika timeout tapi tidak ada modal nodata, anggap success dan coba baca tabel
    return { success: true };
  }

  async function waitForBkbDataReady(timeout = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const bodyText = (document.body && document.body.innerText) ? document.body.innerText : '';
      const loadingElement = document.querySelector('.ant-spin, .spinner, [role="progressbar"], .loading, .loader');
      const hasRows = document.querySelectorAll('table tbody tr').length > 0;
      const hasNumeric = /total\s*[:\-]?\s*[\d\.,]+/i.test(bodyText);
      if (!loadingElement && (hasRows || hasNumeric)) {
        return true;
      }
      await wait(300);
    }
    return false;
  }

  async function handleBkbMonitoringLoop(monitorState) {
    if (!monitorState || !Array.isArray(monitorState.queue)) return;
    let currentIndex = monitorState.currentIndex || 0;
    let results = Array.isArray(monitorState.results) ? monitorState.results : [];

    const initialWaitMs = (monitorState && typeof monitorState.initialWaitMs === 'number') ? monitorState.initialWaitMs : 30000;
    const loopWaitMs = (monitorState && typeof monitorState.loopWaitMs === 'number') ? monitorState.loopWaitMs : 8000;

    // Deteksi apakah ini mode kecamatan
    const isKecMode = monitorState.queue.length > 0 && monitorState.queue[0].isKecamatan === true;

    // Initial load: tunggu sampai datanya siap
    await waitForBkbDataReady(initialWaitMs);
    const acehValues = await extractTotalUpdateBelum();
    if (!isKecMode && !results.some(r => r.kota === 'PROVINSI')) {
      results.push({ kota: 'PROVINSI', ...acehValues });
      await chrome.storage.local.set({
        bkbMonitoring: {
          ...monitorState,
          mode: 'active',
          currentIndex,
          results,
          lastUpdated: Date.now()
        }
      });
    }

    const cariButton = await waitForButtonByText('Cari', 10000);

    // ── MODE KECAMATAN: pilih Kab/Kota 1x, lalu loop dropdown Kecamatan ──
    if (isKecMode) {
      // Pilih kabupaten hanya sekali di awal (atau jika belum dipilih)
      const firstEntry = monitorState.queue[0];
      if (firstEntry && firstEntry.kabName) {
        console.log(`[BKB-Kec] Memilih Kab/Kota: ${firstEntry.kabName}`);
        const kotaDropdown = await waitForDropdown('Kab/Kota', 2);
        if (kotaDropdown) {
          await bukaDanPilihPadaDropdown(kotaDropdown, firstEntry.kabName);
          await wait(400);
          if (cariButton) cariButton.click();
          await waitForBkbDataReady(loopWaitMs);
          await wait(300);
        } else {
          console.warn('[BKB-Kec] Dropdown Kab/Kota tidak ditemukan!');
        }
      }

      for (; currentIndex < monitorState.queue.length; currentIndex++) {
        const kecEntry = monitorState.queue[currentIndex];
        if (!kecEntry || !kecEntry.name) continue;

        console.log(`[BKB-Kec] Processing kecamatan ${currentIndex + 1}/${monitorState.queue.length}: ${kecEntry.name}`);

        // Pilih dropdown Kecamatan
        const kecDropdown = await waitForDropdown('Kecamatan', 3);
        if (!kecDropdown) {
          console.warn(`[BKB-Kec] Dropdown Kecamatan tidak ditemukan untuk ${kecEntry.name}`);
          results.push({ kota: kecEntry.name, total: 'N/A', update: 'N/A', belum: 'N/A' });
        } else {
          const selected = await bukaDanPilihPadaDropdown(kecDropdown, kecEntry.name);
          if (!selected) {
            console.warn(`[BKB-Kec] Gagal memilih kecamatan ${kecEntry.name}, lanjut ke berikutnya.`);
            results.push({ kota: kecEntry.name, total: 'N/A', update: 'N/A', belum: 'N/A' });
          } else {
            await wait(250);
            if (cariButton) cariButton.click();
            const readyState = await waitForKecamatanDataReady(loopWaitMs);
            await wait(200);
            if (readyState && readyState.success === false && readyState.reason === 'nodata') {
              console.log(`[BKB-Kec] Kecamatan ${kecEntry.name} terdeteksi kosong (tidak ada data).`);
              results.push({ kota: kecEntry.name, total: 0, update: 0, belum: 0 });
            } else {
              const values = await extractTotalUpdateBelum();
              results.push({ kota: kecEntry.name, ...values });
            }
          }
        }

        await chrome.storage.local.set({
          bkbMonitoring: {
            ...monitorState,
            mode: 'active',
            currentIndex: currentIndex + 1,
            results,
            lastUpdated: Date.now()
          }
        });
        await wait(600);
      }

    } else {
      // ── MODE LAMA: loop per Kab/Kota (provinsi) ──
      for (; currentIndex < monitorState.queue.length; currentIndex++) {
        const kotaEntry = monitorState.queue[currentIndex];
        if (!kotaEntry || !kotaEntry.name) continue;

        const kotaDropdown = await waitForDropdown('Kab/Kota', 2);
        if (!kotaDropdown) {
          console.warn(`[BKB] Dropdown Kab/Kota tidak ditemukan untuk ${kotaEntry.name}`);
          continue;
        }

        const selected = await bukaDanPilihPadaDropdown(kotaDropdown, kotaEntry.name);
        if (!selected) {
          console.warn(`[BKB] Gagal memilih ${kotaEntry.name}, lanjut ke berikutnya.`);
          continue;
        }

        await wait(250);
        if (cariButton) {
          cariButton.click();
        }

        const readyState = await waitForKecamatanDataReady(loopWaitMs);
        await wait(200);

        if (readyState && readyState.success === false && readyState.reason === 'nodata') {
          console.log(`[BKB] Kab/Kota ${kotaEntry.name} terdeteksi kosong (tidak ada data).`);
          results.push({ kota: kotaEntry.name, total: 0, update: 0, belum: 0 });
        } else {
          const values = await extractTotalUpdateBelum();
          results.push({ kota: kotaEntry.name, ...values });
        }

        await chrome.storage.local.set({
          bkbMonitoring: {
            ...monitorState,
            mode: 'active',
            currentIndex: currentIndex + 1,
            results,
            lastUpdated: Date.now()
          }
        });
        await wait(600);
      }
    }

    await chrome.storage.local.set({
      bkbMonitoring: {
        ...monitorState,
        mode: 'done',
        currentIndex,
        results,
        lastUpdated: Date.now()
      }
    });
    console.log('[BKB] Monitoring selesai', results);
  }

  /**
   * Mode Paralel Batch: jalankan monitoring kecamatan untuk 1 kabupaten.
   * Baca/tulis ke storageKey = `bkbMonitoringKec_<tabId>` (bukan bkbMonitoring global).
   */
  async function handleBkbKecMonitoringLoop(kecState, storageKey) {
    if (!kecState || !Array.isArray(kecState.queue)) return;
    let currentIndex = kecState.currentIndex || 0;
    let results = Array.isArray(kecState.results) ? kecState.results : [];

    const initialWaitMs = typeof kecState.initialWaitMs === 'number' ? kecState.initialWaitMs : 30000;
    const loopWaitMs = typeof kecState.loopWaitMs === 'number' ? kecState.loopWaitMs : 8000;

    console.log(`[BKB-Batch] Mulai ${kecState.kabName}: ${kecState.queue.length} kecamatan, initialWait=${initialWaitMs}ms`);

    // Tunggu halaman load
    const pageReady = await waitForBkbDataReady(initialWaitMs);
    console.log(`[BKB-Batch] Page ready: ${pageReady}, URL: ${location.hash}`);

    // Debug: lihat berapa banyak dropdown di halaman
    const allDropdowns = document.querySelectorAll('div[role="combobox"], .css-yk16xz-control, .ant-select-selector, .react-select__control');
    console.log(`[BKB-Batch] Dropdown count di halaman: ${allDropdowns.length}`);
    allDropdowns.forEach((d, i) => {
      const label = d.closest('.form-group, .ant-form-item, .row')?.querySelector('label');
      console.log(`  [${i}] label="${label?.textContent?.trim()}" class="${d.className.slice(0, 40)}"`);
    });

    const cariButton = await waitForButtonByText('Cari', 10000);
    console.log(`[BKB-Batch] Tombol Cari: ${!!cariButton}`);

    // Pilih Kab/Kota 1x di awal
    if (kecState.kabName) {
      const kotaDropdown = await waitForDropdown('Kab/Kota', 2);
      console.log(`[BKB-Batch] Dropdown Kab/Kota: ${!!kotaDropdown}`);
      if (kotaDropdown) {
        const selectedKab = await bukaDanPilihPadaDropdown(kotaDropdown, kecState.kabName);
        console.log(`[BKB-Batch] Pilih Kab/Kota '${kecState.kabName}': ${selectedKab}`);
        await wait(400);
        if (cariButton) cariButton.click();
        await waitForBkbDataReady(loopWaitMs);
        await wait(300);

        // Setelah pilih kab, cek apakah dropdown Kecamatan muncul
        const allDropdownsAfter = document.querySelectorAll('div[role="combobox"], .css-yk16xz-control, .ant-select-selector, .react-select__control');
        console.log(`[BKB-Batch] Dropdown count setelah pilih Kab/Kota: ${allDropdownsAfter.length}`);
      } else {
        console.warn(`[BKB-Batch] Dropdown Kab/Kota tidak ditemukan untuk ${kecState.kabName}`);
      }
    }

    // Cek apakah dropdown Kecamatan ada di halaman ini (Beri toleransi waktu lebih lama karena 23 tab berjalan paralel)
    const kecDropdownTest = await waitForDropdown('Kecamatan', 3, 20000);
    console.log(`[BKB-Batch] Test dropdown Kecamatan: ${!!kecDropdownTest}`);

    if (!kecDropdownTest) {
      console.warn(`[BKB-Batch] Halaman ini tidak punya dropdown Kecamatan! Ambil data level Kab/Kota saja.`);
      // Ambil data yang sudah ada (level Kab/Kota) sebagai satu baris
      const swalText = getSweetAlertModalText();
      let values;
      if (/tidak ditemukan|tidak\s*ada|kosong/i.test(swalText)) {
        console.log('[BKB-Batch] Terdeteksi SweetAlert pada level Kab/Kota: Data tidak ditemukan.');
        dismissSweetAlertModal();
        values = { total: 0, update: 0, belum: 0 };
      } else {
        values = await extractTotalUpdateBelum();
      }
      console.log(`[BKB-Batch] Data Kab/Kota:`, values);
      results.push({ kota: kecState.kabName + ' (Level Kab)', ...values });
      await chrome.storage.local.set({
        [storageKey]: { ...kecState, mode: 'done', currentIndex: kecState.queue.length, results, lastUpdated: Date.now() }
      });
      console.log(`[BKB-Batch] Selesai (tanpa kecamatan) ${kecState.kabName}`);
      return;
    }

    // Loop setiap kecamatan
    for (; currentIndex < kecState.queue.length; currentIndex++) {
      const kecEntry = kecState.queue[currentIndex];
      if (!kecEntry || !kecEntry.name) continue;

      console.log(`[BKB-Batch] ${kecState.kabName} → kec ${currentIndex + 1}/${kecState.queue.length}: ${kecEntry.name}`);

      const kecDropdown = await waitForDropdown('Kecamatan', 3);
      if (!kecDropdown) {
        console.warn(`[BKB-Batch] Dropdown Kecamatan tidak ditemukan: ${kecEntry.name}`);
        results.push({ kota: kecEntry.name, total: 'N/A', update: 'N/A', belum: 'N/A' });
      } else {
        const selected = await bukaDanPilihPadaDropdown(kecDropdown, kecEntry.name);
        if (!selected) {
          console.warn(`[BKB-Batch] Gagal pilih ${kecEntry.name}`);
          results.push({ kota: kecEntry.name, total: 'N/A', update: 'N/A', belum: 'N/A' });
        } else {
          await wait(250);
          if (cariButton) cariButton.click();
          const readyState = await waitForKecamatanDataReady(loopWaitMs);
          await wait(200);
          if (readyState && readyState.success === false && readyState.reason === 'nodata') {
            console.log(`[BKB-Batch] Kecamatan ${kecEntry.name} terdeteksi kosong (tidak ada data).`);
            results.push({ kota: kecEntry.name, total: 0, update: 0, belum: 0 });
          } else {
            const values = await extractTotalUpdateBelum();
            console.log(`[BKB-Batch] Data ${kecEntry.name}:`, values);
            results.push({ kota: kecEntry.name, ...values });
          }
        }
      }

      // Tulis progress ke storage key per-tab
      await chrome.storage.local.set({
        [storageKey]: {
          ...kecState,
          mode: 'active',
          currentIndex: currentIndex + 1,
          results,
          lastUpdated: Date.now()
        }
      });
      await wait(500);
    }

    // Selesai — set mode done di key per-tab
    await chrome.storage.local.set({
      [storageKey]: {
        ...kecState,
        mode: 'done',
        currentIndex,
        results,
        lastUpdated: Date.now()
      }
    });
    console.log(`[BKB-Batch] Selesai ${kecState.kabName}:`, results.length, 'kecamatan');

    // Update juga ke bkbMonitoringBatch untuk persistensi jangka panjang
    const batchData = await new Promise(r =>
      chrome.storage.local.get(['bkbMonitoringBatch'], res => r(res.bkbMonitoringBatch || null))
    );
    if (batchData && Array.isArray(batchData.plan)) {
      const myPlanIndex = typeof kecState.planIndex === 'number' ? kecState.planIndex : -1;
      if (myPlanIndex >= 0 && batchData.plan[myPlanIndex]) {
        batchData.plan[myPlanIndex].status = 'done';
        batchData.plan[myPlanIndex].results = results;
        batchData.plan[myPlanIndex].currentIndex = currentIndex;
      }
      await chrome.storage.local.set({ bkbMonitoringBatch: batchData });
    }

    // Kirim pesan untuk menutup tab ini saja tanpa membuka tab baru (karena semua tab sudah dibuka sekaligus di awal)
    chrome.runtime.sendMessage({
      action: 'openNextBatchTab',
      nextKecState: null,
      nextStorageKey: null,
      closeTabId: tab.id
    });
  }




  // === HANDLE POPUP, STORAGE, DLL (kode lama tetap) ===


  // Fitur lama: Handle popup Rekap/Detail
  async function handlePopup(reportType, url, kota, downloadQueue, currentIndex, state = { blobDetected: false }) {
    let tries = 0;
    const maxTries = 30;
    const reportTypeNorm = (reportType || '').toString().trim().toLowerCase();

    while (tries < maxTries) {
      if (state.blobDetected) {
        console.log("✅ File terdeteksi, membatalkan pencarian popup.");
        return;
      }

      const popUp = document.querySelector('.swal2-title') || document.querySelector('.modal-title') || document.querySelector('h2, h3, h4');
      const rekapButton = [...document.querySelectorAll("button")].find(btn => /rekap/i.test(btn.textContent));
      const detailButton = [...document.querySelectorAll("button")].find(btn => /detail/i.test(btn.textContent));

      console.log("✅ Popup check attempt:", tries + 1, { popUpExists: !!popUp, reportType: reportTypeNorm, rekap: !!rekapButton, detail: !!detailButton });

      if ((reportTypeNorm === 'rekap' && rekapButton) || (reportTypeNorm === 'detail' && detailButton)) {
        const target = reportTypeNorm === 'rekap' ? rekapButton : detailButton;
        target.click();
        console.log(`✅ Klik tombol ${reportTypeNorm} (direct)`);

        const hash = getUrlHash(url);
        const chosen = reportTypeNorm === 'rekap' ? 'rekap' : 'detail';
        await updateProgressOnSelection(hash, url, kota, downloadQueue, currentIndex, chosen);
        return;
      }

      if (!popUp && tries < 5) {
        await wait(400);
        tries++;
        continue;
      }

      if (popUp && (rekapButton || detailButton)) {
        const chosen = reportTypeNorm === 'rekap' ? rekapButton : detailButton;
        if (chosen) {
          chosen.click();
          console.log(`✅ Klik tombol ${reportTypeNorm} (pop-up mode)`);
          const hash = getUrlHash(url);
          await updateProgressOnSelection(hash, url, kota, downloadQueue, currentIndex, reportTypeNorm);
          return;
        }
      }

      await wait(500);
      tries++;
    }

    if (state.blobDetected) return;

    console.error("⚠️ Popup atau tombol Rekap/Detail tidak muncul setelah menunggu. Proses dibatalkan.");
    await markFail(getUrlHash(url), url, kota, downloadQueue, currentIndex, 'Popup tidak muncul atau tombol rekap/detail tidak bisa diklik');
    await biarkanTabTerbukaUntukRetry();
    return;
  }

  async function updateProgressOnSelection(hash, url, kota, downloadQueue, currentIndex, reportType) {
    const { key, existing: fromStorage } = await getKeyAndExisting(hash, downloadQueue, storage?.progressKey);
    const existing = fromStorage || {
      url: url,
      status: "downloading",
      totalFiles: downloadQueue.length,
      filesCompleted: 0,
      fileAkhir: ""
    };
    existing.filesCompleted = currentIndex + 1;
    existing.fileAkhir = kota || "Provinsi";
    if (currentIndex >= downloadQueue.length - 1) existing.status = "success";
    chrome.storage.local.set({ [key]: existing }, () => {
      chrome.runtime.sendMessage({ action: "refresh_download_status" });
    });
  }

  // Automation: Ambil data dari storage untuk tab ini
  const tab = await chrome.runtime.sendMessage({ action: "getTabId" });
  const key = `auto_${tab.id}`;

  console.log('[content] started in tab', tab, 'url', window.location.href, 'hash', window.location.hash);

  let storage = await new Promise((resolve) =>
    chrome.storage.local.get([key], (res) => resolve(res[key]))
  );

  if (!storage) {
    const startPoll = Date.now();
    while (Date.now() - startPoll < 5000) {
      await wait(300);
      storage = await new Promise((resolve) =>
        chrome.storage.local.get([key], (res) => resolve(res[key]))
      );
      if (storage) break;
    }
  }

  const isAutoTab = !!storage;

  async function waitForMonitorState(timeout = 3000, interval = 200) {
    if (isAutoTab) return null; // Skip waiting if this is an auto tab
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const monitorState = await new Promise((resolve) =>
        chrome.storage.local.get(['bkbMonitoring'], (res) => resolve(res.bkbMonitoring || null))
      );
      if (monitorState && (monitorState.mode === 'active' || monitorState.mode === 'waiting')) {
        return monitorState;
      }
      await wait(interval);
    }
    return null;
  }

  // ── CEK BATCH DULU: bkbMonitoringKec_<tabId> (mode sequential batch) ──
  // Harus dicek sebelum bkbMonitoring agar state lama tidak mengganggu
  const kecBatchKey = `bkbMonitoringKec_${tab.id}`;
  let kecBatchState = null;

  if (!isAutoTab) {
    // Debug: print semua keys di storage untuk mencari tahu mismatch
    const allStorage = await new Promise(r => chrome.storage.local.get(null, r));
    console.log(`[BKB-Batch-Debug] tab.id=${tab.id}, kecBatchKey=${kecBatchKey}`);
    console.log(`[BKB-Batch-Debug] Storage keys:`, Object.keys(allStorage));
    if (allStorage[kecBatchKey]) {
      console.log(`[BKB-Batch-Debug] Found direct key in storage! Mode:`, allStorage[kecBatchKey].mode);
    }

    const pollStart = Date.now();
    while (Date.now() - pollStart < 10000) {
      const found = await new Promise(r =>
        chrome.storage.local.get([kecBatchKey], res => r(res[kecBatchKey] || null))
      );
      if (found && found.mode === 'active') { kecBatchState = found; break; }
      await wait(300);
    }
  }

  if (!kecBatchState && !isAutoTab) {
    // FALLBACK: Cek global bkbMonitoringBatch jika key tab-specific tidak ketemu (e.g. karena tab ID mismatch)
    const batchData = await new Promise(r =>
      chrome.storage.local.get(['bkbMonitoringBatch'], res => r(res.bkbMonitoringBatch || null))
    );
    if (batchData && batchData.plan) {
      const activeItem = batchData.plan.find(p => p.status === 'active') || batchData.plan[batchData.currentKabIndex];
      if (activeItem && activeItem.status !== 'done') {
        console.log(`[BKB-Batch-Fallback] Menggunakan data dari bkbMonitoringBatch untuk kab: ${activeItem.kabName}`);
        kecBatchState = {
          mode: 'active',
          kabId: activeItem.kabId,
          kabName: activeItem.kabName,
          targetRoute: batchData.targetRoute,
          initialWaitMs: batchData.initialWaitMs,
          loopWaitMs: batchData.loopWaitMs,
          currentIndex: activeItem.currentIndex || 0,
          queue: activeItem.queue,
          results: activeItem.results || [],
          planIndex: activeItem.planIndex,
          lastUpdated: Date.now()
        };
        // Tulis key tab-specific agar tersinkronisasi
        await chrome.storage.local.set({ [kecBatchKey]: kecBatchState });
      }
    }
  }


  if (kecBatchState) {
    console.log(`[content] found kecBatchState for tab ${tab.id}:`, kecBatchState.kabName);
    const targetHash = kecBatchState.targetRoute || '/kegiatan/kelompok_bkb';

    // Tunggu URL sampai sesuai target (max 20s)
    if (!location.hash.includes(targetHash)) {
      const start = Date.now();
      while (Date.now() - start < 20000 && !location.hash.includes(targetHash)) {
        await wait(300);
      }
    }

    if (location.hash.includes(targetHash)) {
      console.log(`🟢 Batch Kec Monitoring aktif di tab ${tab.id}: ${kecBatchState.kabName}`);
      try {
        await handleBkbKecMonitoringLoop(kecBatchState, kecBatchKey);
      } catch (e) {
        console.error(`[BKB-Batch] Error di tab ${tab.id} (${kecBatchState.kabName}):`, e);
        await chrome.storage.local.set({
          [kecBatchKey]: { ...kecBatchState, mode: 'done', lastUpdated: Date.now() }
        });
        // Tetap chain ke next
        chrome.runtime.sendMessage({
          action: 'openNextBatchTab',
          nextKecState: null,
          nextStorageKey: null,
          closeTabId: tab.id
        }).catch(() => { });
      }
    } else {
      console.warn(`[content] Batch kec: URL target ${targetHash} belum tercapai. Menunggu navigasi.`);
    }
    return;
  }

  // ── Single-tab monitoring: bkbMonitoring ──
  const monitorState = await waitForMonitorState(3000);
  if (monitorState) {
    const targetHash = monitorState.targetRoute || '/kegiatan/kelompok_bkb';
    if (!location.hash.includes(targetHash)) {
      const start = Date.now();
      while (Date.now() - start < 15000 && !location.hash.includes(targetHash)) {
        await wait(300);
      }
    }
    if (location.hash.includes(targetHash)) {
      console.log(`🟢 Monitoring SIGA single-tab trigger (${targetHash})`);
      await handleBkbMonitoringLoop(monitorState);
      return;
    }
    console.log(`🟡 Single-tab monitoring aktif tapi URL belum match.`);
    return;
  }

  // Monitoring tidak ditemukan untuk tab ini, lanjut ke logika old auto_
  let bkbMonitoringRunning = false;

  const handlePotentialMonitorState = async (monitorState) => {
    if (bkbMonitoringRunning) return;
    if (!monitorState || monitorState.mode !== 'active') return;

    const targetHash = monitorState.targetRoute || '/kegiatan/kelompok_bkb';
    if (!location.hash.includes(targetHash)) return;

    bkbMonitoringRunning = true;
    console.log('[content] bkbMonitoring aktif, menjalankan loop dari onChanged/initial');
    await handleBkbMonitoringLoop(monitorState);
  };

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes.bkbMonitoring && !isAutoTab) {
      handlePotentialMonitorState(changes.bkbMonitoring.newValue);
    }
  });

  if (!storage) {
    console.log('[content] tidak ada state auto_ maupun bkbMonitoring untuk tab ini, tidak ada tindakan.');
    return;
  }

  // Jika dibatalkan, segera berhenti
  if (storage.cancelled) {
    console.log('🛑 Automation dibatalkan untuk tab ini, menghentikan eksekusi.');
    return;
  }

  const { downloadQueue, currentIndex = 0, periode, selectedCities, kecamatan, faskes, jenisLaporan, tahun, desa, rw, sasaran, retryCount = 0 } = storage;

  if (!downloadQueue || currentIndex >= downloadQueue.length) {
    console.log("✅ Semua download selesai untuk tab ini");
    return;
  }

  // Proses utama automation per queue
  const { kota, url, renameContext } = downloadQueue[currentIndex];
  console.log(`🚀 Memproses kota ${currentIndex + 1}/${downloadQueue.length}: ${kota} - ${url}`);

  // Set context rename untuk file yang akan didownload ini
  if (renameContext) {
    chrome.runtime.sendMessage({ action: "setRenameContext", payload: renameContext });
  }

  // Override variabel global dengan variabel dari item spesifik saat ini
  const itemKecamatan = downloadQueue[currentIndex].kecamatan || kecamatan;
  const itemDesa = downloadQueue[currentIndex].desa || desa;
  const itemRw = downloadQueue[currentIndex].rw || rw;
  const itemSasaran = downloadQueue[currentIndex].sasaran || sasaran;
  const itemFaskes = downloadQueue[currentIndex].faskes || faskes;

  // Jika retry, log info
  if (retryCount > 0) {
    console.log(`♻️ Retry ke-${retryCount} untuk kota: ${kota}`);
  }

  // Dapatkan durasi waktu tunggu awal saat tab dibuka (openDelay) dari storage
  let openDelaySec = typeof storage.openDelay === 'number' ? storage.openDelay : undefined;
  if (openDelaySec === undefined) {
    const globalOpenDelay = await new Promise(r => chrome.storage.local.get('openDelay', res => r(res.openDelay)));
    openDelaySec = typeof globalOpenDelay === 'number' ? globalOpenDelay : 5;
  }

  // Helper tunggu document.readyState complete, spinner hilang, dan durasi delay awal
  if (document.readyState !== 'complete') {
    await new Promise(resolve => {
      window.addEventListener('load', resolve, { once: true });
      setTimeout(resolve, 5000);
    });
  }

  // Tunggu loading spinner SIGA jika ada (max 10s)
  const startSpinnerWait = Date.now();
  while (Date.now() - startSpinnerWait < 10000) {
    const spinner = document.querySelector('.ant-spin-spinning, .loading, .spinner, .css-10n2b5k');
    if (!spinner) break;
    await wait(300);
  }

  if (openDelaySec > 0) {
    console.log(`⏳ [content] Menunggu ${openDelaySec} detik waktu tunggu pertama tab dibuka agar data SIGA termuat sepenuhnya...`);
    await wait(openDelaySec * 1000);
  }

  const isTahunan = storage.periode && /^\d{4}$/.test(storage.periode);

  // Untuk mode BULANAN: pilih TAHUN terlebih dahulu sebelum memilih BULAN/PERIODE.
  // Alasan: pada beberapa halaman SIGA, memilih Tahun menyebabkan dropdown Bulan direset ke
  // bulan saat ini (default). Dengan memilih Tahun lebih dulu, pemilihan Bulan di bawah tidak
  // terpengaruh reset tersebut.
  if (!isTahunan && tahun) {
    const tahunDropdownFirst = await waitForDropdown("Tahun", 1);
    if (tahunDropdownFirst) {
      const r = await bukaDanPilihPadaDropdown(tahunDropdownFirst, tahun, url, kota, currentIndex, downloadQueue);
      if (r === false) { await biarkanTabTerbukaUntukRetry(); return; }
    } else {
      console.error('❌ Dropdown Tahun tidak ditemukan (timeout)');
    }
    await wait(300);
  }

  // Pilih Periode (tahun untuk tahunan, bulan untuk bulanan)
  const periodeDropdown = await waitForDropdown("Periode", 0);
  if (periodeDropdown && periode) {
    const rPeriode = await bukaDanPilihPadaDropdown(periodeDropdown, periode, url, kota, currentIndex, downloadQueue);
    if (rPeriode === false) { await biarkanTabTerbukaUntukRetry(); return; }
  } else if (periode) {
    console.error('❌ Dropdown Periode tidak ditemukan (timeout)');
    // Retry sekali dengan refresh jika ini percobaan pertama untuk kota ini
    if (retryCount === 0) {
      console.log(`🔄 Retry kota ${currentIndex + 1} (${kota}): refresh halaman...`);
      await chrome.storage.local.set({
        [key]: { ...storage, retryCount: 1 } // Tetap di currentIndex yang sama
      });
      setTimeout(() => location.reload(), 1000);
      return;
    } else {
      console.error(`❌ Gagal menemukan dropdown setelah retry untuk kota: ${kota}`);
      await markFail(getUrlHash(url), url, kota, downloadQueue, currentIndex, 'Dropdown Periode tidak ditemukan setelah retry');
      await biarkanTabTerbukaUntukRetry();
      return;
    }
  }

  // Pilih Tahun (hanya untuk tahunan — mode bulanan sudah dipilih sebelum Periode di atas)
  await wait(300);
  if (isTahunan && tahun) {
    const tahunDropdown = await waitForDropdown("Tahun", 1);
    if (tahunDropdown) {
      const r = await bukaDanPilihPadaDropdown(tahunDropdown, tahun, url, kota, currentIndex, downloadQueue);
      if (r === false) { await biarkanTabTerbukaUntukRetry(); return; }
    } else {
      console.error('❌ Dropdown Tahun tidak ditemukan (timeout)');
    }
  }

  // Pilih Kota/Kab
  await wait(300);
  if (kota) {
    const kotaDropdown = await waitForDropdown("Kab/Kota", isTahunan ? 1 : 2);
    if (!kotaDropdown) {
      console.error('❌ Dropdown Kab/Kota tidak ditemukan');
      if (retryCount === 0) {
        console.log(`🔄 Retry kota ${currentIndex + 1} (${kota}): refresh halaman...`);
        await chrome.storage.local.set({
          [key]: { ...storage, retryCount: 1 } // Tetap di currentIndex yang sama
        });
        setTimeout(() => location.reload(), 1000);
        return;
      } else {
        console.error(`❌ Gagal menemukan dropdown Kab/Kota setelah retry untuk: ${kota}`);
        await markFail(getUrlHash(url), url, kota, downloadQueue, currentIndex, 'Dropdown Kab/Kota tidak ditemukan setelah retry');
        await biarkanTabTerbukaUntukRetry();
        return;
      }
    }
    const result = await bukaDanPilihPadaDropdown(kotaDropdown, kota, url, kota, currentIndex, downloadQueue);
    if (result === false) { await biarkanTabTerbukaUntukRetry(); return; }
    await wait(400);
  } else {
    console.warn("⚠️ Kota tidak dipilih, dilewati.");
  }

  // Pilih Kecamatan
  await wait(300);
  if (itemKecamatan) {
    const kecDropdown = await waitForDropdown("Kecamatan", isTahunan ? 2 : 3);
    const result = await bukaDanPilihPadaDropdown(kecDropdown, itemKecamatan, url, kota, currentIndex, downloadQueue);
    if (result === false) { await biarkanTabTerbukaUntukRetry(); return; }
    await wait(400);
  }

  // Pilih Desa / Faskes (gabungan untuk mengatasi inkonsistensi label di SIGA)
  await wait(300);
  const itemDesaOrFaskes = downloadQueue[currentIndex].desa || downloadQueue[currentIndex].faskes || desa || faskes;
  console.log(`[DEBUG] currentIndex = ${currentIndex}, itemDesaOrFaskes =`, itemDesaOrFaskes, 'queue item =', downloadQueue[currentIndex]);

  if (itemDesaOrFaskes) {
    // SIGA sering salah pasang label "Kecamatan / Desa" sehingga pencarian by Text meleset ke Kecamatan lagi.
    // Solusi pasti: gunakan index pasti (4 untuk Bulanan, 3 untuk Tahunan jika tanpa faskes).
    const dropdownIndex = isTahunan ? 3 : 4;
    let targetDropdown = await waitForDropdownByIndex(dropdownIndex, 10000); // tunggu hingga 10 detik untuk load desa

    if (targetDropdown) {
      console.log(`[DEBUG] Dropdown target ditemukan pada index ${dropdownIndex}!`, targetDropdown);
      const result = await bukaDanPilihPadaDropdown(targetDropdown, itemDesaOrFaskes, url, kota, currentIndex, downloadQueue);
      if (result === false) {
        console.error(`[DEBUG] bukaDanPilihPadaDropdown mengembalikan false untuk '${itemDesaOrFaskes}'`);
        return;
      }
    } else {
      console.error(`[FATAL] Dropdown Desa/Kel, Faskes, atau Desa tidak ditemukan di DOM. Lanjut tanpa memilih desa.`);
    }
    await wait(400);
  } else {
    console.log(`[DEBUG] itemDesaOrFaskes KOSONG, jadi ekstensi tidak mencoba memilih desa.`);
  }

  // Pilih RW (tahunan, jika ada)
  await wait(300);
  if (itemRw) {
    const rwDropdown = await waitForDropdown("RW", isTahunan ? 4 : 5);
    if (rwDropdown) {
      const result = await bukaDanPilihPadaDropdown(rwDropdown, itemRw, url, kota, currentIndex, downloadQueue);
      if (result === false) { await biarkanTabTerbukaUntukRetry(); return; }
    }
    await wait(400);
  }

  // Pilih Sasaran (tahunan, jika ada)
  await wait(300);
  if (itemSasaran) {
    const sasaranDropdown = await waitForDropdown("Kelompok Sasaran", isTahunan ? 5 : 6);
    if (sasaranDropdown) {
      const result = await bukaDanPilihPadaDropdown(sasaranDropdown, itemSasaran, url, kota, currentIndex, downloadQueue);
      if (result === false) { await biarkanTabTerbukaUntukRetry(); return; }
    }
    await wait(400);
  }

  // Klik tombol cetak excel
  await wait(300);
  const button = [...document.querySelectorAll("button")].find(btn =>
    btn.textContent.includes("Cetak") &&
    btn.querySelector("i.icon-file-excel")
  );

  // Kumpulkan blob yang sudah ada di DOM sebelum klik, agar tidak dihitung sebagai download baru
  const blobSelectors = ['a[href^="blob:"]', 'a[download][href^="blob:"]', 'iframe[src^="blob:"]', 'source[src^="blob:"]', 'a[href*="blob:"]'];
  const existingBlobs = new Set(
    [...document.querySelectorAll(blobSelectors.join(','))].map(el => el.href || el.src).filter(Boolean)
  );

  let downloadOk = false;

  if (button) {
    button.click();
    console.log("✅ Klik tombol Cetak Excel");
    await wait(400);

    // Helper for numeric code extraction
    const extractNumericCode = (value) => {
      if (!value) return '';
      const m = value.toString().trim().match(/^(\d+)/);
      return m ? m[1] : '';
    };

    // Function to wait for blob URL creation by the page
    const waitForBlob = () => {
      return new Promise((resolve) => {
        let payload = {};
        if (downloadQueue[currentIndex] && downloadQueue[currentIndex].renameContext) {
          payload = downloadQueue[currentIndex].renameContext;
        } else {
          const kab = (kota || '').toString().replace(/^\d+\s*-\s*/, '').trim();
          const kec = storage.kecamatan || '';
          const desa = (downloadQueue[currentIndex] && downloadQueue[currentIndex].desa) || storage.desa || '';
          const faskes = (downloadQueue[currentIndex] && downloadQueue[currentIndex].faskes) || storage.faskes || '';

          payload = {
            periode: storage.periode,
            tahun: storage.tahun,
            kab,
            kabCode: storage.kabCode || extractNumericCode(kota),
            jenisLaporan: storage.jenisLaporan || '',
            kec,
            kecCode: storage.kecCode || extractNumericCode(kec),
            faskes: faskes,
            desa: desa,
            desaCode: storage.desaCode || extractNumericCode(desa),
            rw: storage.rw || '',
            menu: storage.menu || '',
            submenu: storage.submenu || '',
            sasaran: storage.sasaran || (downloadQueue[currentIndex] && downloadQueue[currentIndex].sasaran) || ''
          };
        }

        let timeoutId;

        const registerBlobUrl = (blobUrl) => {
          if (!blobUrl || typeof blobUrl !== 'string' || !blobUrl.startsWith('blob:')) return;
          try {
            chrome.runtime.sendMessage({ action: 'registerBlobRename', blobUrl, payload }, (resp) => {
              console.log('registerBlobRename resp', resp, 'for', blobUrl, payload.desa);
            });
            clearTimeout(timeoutId);
            resolve(true);
          } catch (e) {
            console.warn('Failed to register blob rename', e);
            clearTimeout(timeoutId);
            resolve(false);
          }
        };

        const onMessage = (event) => {
          if (event.source !== window || !event.data || event.data.type !== 'SIGA_EXCEL_DOWNLOADER_BLOB') return;
          registerBlobUrl(event.data.blobUrl);
          clearTimeout(timeoutId);
          resolve(true);
        };

        window.addEventListener('message', onMessage);

        const selectors = ['a[href^="blob:"]', 'a[download][href^="blob:"]', 'iframe[src^="blob:"]', 'source[src^="blob:"]', 'a[href*="blob:"]'];
        const timeoutMs = 30000; // Wait up to 30 seconds for the download to start

        const scanAndRegister = () => {
          const nodes = document.querySelectorAll(blobSelectors.join(','));
          const blobs = [...nodes].map(el => el.href || el.src).filter(b => b && !existingBlobs.has(b));
          if (blobs.length > 0) {
            const blobUrl = blobs[blobs.length - 1];
            registerBlobUrl(blobUrl);
            return true;
          }
          return false;
        };

        const injectBlobHook = () => {
          try {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('injected_blob_hook.js');
            script.onload = () => script.remove();
            script.onerror = () => {
              console.warn('Failed to inject blob hook script (CSP)');
              script.remove();
            };
            (document.head || document.documentElement).appendChild(script);
          } catch (e) {
            console.warn('Failed to inject blob hook (exception)', e);
          }
        };

        injectBlobHook();

        if (scanAndRegister()) {
          window.removeEventListener('message', onMessage);
          return;
        }

        // Otherwise observe DOM mutations for dynamically injected blob links
        const observer = new MutationObserver(() => {
          try {
            if (scanAndRegister()) {
              observer.disconnect();
              window.removeEventListener('message', onMessage);
            }
          } catch (e) {
            observer.disconnect();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Stop observing after timeout and resolve anyway to prevent getting stuck
        timeoutId = setTimeout(() => {
          try { observer.disconnect(); } catch (e) { }
          window.removeEventListener('message', onMessage);
          console.warn("⏳ Timeout menunggu file download. Lanjut ke proses berikutnya...");
          resolve(false);
        }, timeoutMs);
      });
    };

    // Mulai dengerin sinyal downloadComplete SEBELUM blobPromise dibuat
    // agar tidak ada kemungkinan miss event (race condition)
    const downloadWatcher = waitForDownloadComplete(tab.id, 90000);
    const blobPromise = waitForBlob();
    const state = { blobDetected: false };

    blobPromise.then((res) => {
      if (res) state.blobDetected = true;
    });

    if (jenisLaporan) {
      // Race the popup vs blob detection
      const popupPromise = handlePopup(jenisLaporan, url, kota, downloadQueue, currentIndex, state);

      const raceResult = await Promise.race([
        popupPromise.then(() => 'popup_handled'),
        blobPromise.then((res) => res ? 'blob_detected' : 'blob_timeout')
      ]);

      if (raceResult === 'blob_detected' || state.blobDetected) {
        console.log("✅ File terdeteksi sebelum popup, update progress secara langsung.");
        const hash = getUrlHash(url);
        const { key, existing: fromStorage } = await getKeyAndExisting(hash, downloadQueue, storage?.progressKey);
        const existing = fromStorage || {
          url: url,
          status: "downloading",
          totalFiles: downloadQueue.length,
          filesCompleted: 0,
          fileAkhir: ""
        };
        existing.filesCompleted = currentIndex + 1;
        existing.fileAkhir = kota || "Provinsi";
        existing.status = "downloading"; // Tetap 'downloading' sampai dikonfirmasi
        chrome.storage.local.set({ [key]: existing }, () => {
          chrome.runtime.sendMessage({ action: "refresh_download_status" });
        });
      }
    } else {
      const hash = getUrlHash(url);
      const { key, existing: fromStorage } = await getKeyAndExisting(hash, downloadQueue, storage?.progressKey);
      const existing = fromStorage || {
        url: url,
        status: "downloading",
        totalFiles: downloadQueue.length,
        filesCompleted: 0,
        fileAkhir: ""
      };

      existing.filesCompleted = currentIndex + 1;
      existing.fileAkhir = kota || "Provinsi";
      existing.status = "downloading"; // Tetap 'downloading' sampai dikonfirmasi

      chrome.storage.local.set({ [key]: existing }, () => {
        chrome.runtime.sendMessage({ action: "refresh_download_status" });
      });
    }

    console.log("⏳ Menunggu blob URL dan konfirmasi download ke disk...");
    await blobPromise;
    console.log("✅ Blob terdeteksi — menunggu konfirmasi file selesai didownload ke disk...");

    // Tunggu sinyal nyata dari background bahwa file sudah selesai ditulis ke disk
    downloadOk = await downloadWatcher;

    // Update status final setelah download dikonfirmasi
    {
      const hash = getUrlHash(url);
      const { key, existing: fromStorage } = await getKeyAndExisting(hash, downloadQueue, storage?.progressKey);
      // Fallback: jika fromStorage null (belum ada di storage), buat objek baru agar status tetap tersimpan
      const finalData = fromStorage || {
        url,
        status: 'downloading',
        totalFiles: downloadQueue.length,
        filesCompleted: currentIndex + 1,
        fileAkhir: kota || 'Provinsi'
      };
      finalData.status = downloadOk ? "success" : "fail";
      if (downloadOk) {
        console.log('✅ File dikonfirmasi selesai didownload ke disk.');
      } else {
        console.warn('⚠️ Download timeout/interrupted — tandai fail.');
      }
      chrome.storage.local.set({ [key]: finalData }, () => {
        chrome.runtime.sendMessage({ action: "refresh_download_status" });
      });
    }

  } else {
    console.error("❌ Tombol Cetak Excel tidak ditemukan");
    await biarkanTabTerbukaUntukRetry();
    return;
  }

  // Helper function: jika error, biarkan tab terbuka agar bisa di-reload user
  async function biarkanTabTerbukaUntukRetry() {
    console.warn("🛑 Proses terhenti karena error. Tab dibiarkan terbuka.");
    console.warn("💡 Silakan reload (F5) tab ini jika Anda ingin mengulang item antrian yang gagal ini.");
    // Status sudah di-set 'fail' oleh markFail(), sehingga checkBatchCompletion() di background.js 
    // akan menganggap tab ini selesai dan melanjutkan batch automation.
  }

  // Helper function to continue to next queue or close tab
  async function lanjutKeAntrianAtauTutupTab() {
    try {
      const nextIndex = currentIndex + 1;
      // Reset retry count saat pindah ke item berikutnya
      await chrome.storage.local.set({ [key]: { ...storage, currentIndex: nextIndex, retryCount: 0 } });
      const next = downloadQueue[nextIndex];
      if (next) {
        console.log("⏳ Lanjut ke desa/kota berikutnya...");
        setTimeout(() => {
          if (location.href === next.url) {
            location.reload();
          } else {
            location.href = next.url;
            setTimeout(() => location.reload(), 500);
          }
        }, 500);
      } else {
        console.log("⏳ Menunggu download selesai sebelum menutup tab...");

        chrome.storage.local.get('closeDelay', (res) => {
          const waitMs = ((res.closeDelay || 10) * 1000);
          console.log(`⏳ Menunggu ${res.closeDelay || 10} detik sebelum menutup tab...`);
          // Force close tab regardless of success or failure so batch can continue
          setTimeout(() => chrome.runtime.sendMessage({ action: 'closeTab' }), waitMs + 3000);
        });
      }
    } catch (e) {
      await markFail(getUrlHash(url), url, kota, downloadQueue, currentIndex, `Error akhir mengatur antrian: ${e.message}`);
      console.error('❌ Error mengatur queue berikutnya:', e);
      chrome.runtime.sendMessage({ action: 'closeTab' });
    }
  }

  // Panggil helper di akhir eksekusi sukses
  await lanjutKeAntrianAtauTutupTab();
})();
