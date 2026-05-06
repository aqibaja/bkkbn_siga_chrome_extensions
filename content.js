(async () => {
  // Anti-sleep sekarang dihandle oleh anti_sleep.js di document_start

  // Helper: Wait beberapa ms
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


  // Fungsi: Cari dropdown berdasarkan label di parent/teks sekita

  function findDropdownControl(labelText, fallbackIndex = 0) {
    const lowerLabel = (labelText || '').toString().trim().toLowerCase();

    const labelEls = [...document.querySelectorAll('label')].filter(l =>
      l.textContent && l.textContent.trim().toLowerCase().includes(lowerLabel)
    );
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

    {
      const candidateByAttr = [...document.querySelectorAll('input, div[role="combobox"], div[role="button"], .ant-select-selector, .react-select__control')].find(el => {
        const candidateText = (
          (el.placeholder || '') + ' ' +
          (el.getAttribute('aria-label') || '') + ' ' +
          (el.getAttribute('title') || '') + ' ' +
          (el.getAttribute('data-testid') || '')
        ).toString().toLowerCase();
        return lowerLabel && candidateText.includes(lowerLabel);
      });
      if (candidateByAttr) return candidateByAttr;
    }

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

  async function waitForDropdown(labelText, fallbackIndex = 0, timeout = 5000, interval = 200) {
    const start = Date.now();
    let control;
    while (Date.now() - start < timeout) {
      control = findDropdownControl(labelText, fallbackIndex);
      if (control) return control;
      await wait(interval);
    }
    return null; // biarkan caller yang handle fail
  }

  // Tunggu dropdown spesifik berdasarkan urutan (index) di DOM, lebih aman dari salah label
  async function waitForDropdownByIndex(index, timeout = 5000, interval = 200) {
    const start = Date.now();
    let tries = 0;
    while (Date.now() - start < timeout) {
      const nodes = document.querySelectorAll('.css-yk16xz-control, div[role="combobox"], .ant-select-selector');
      if (nodes.length > index) {
        return nodes[index];
      }
      if (tries++ % 5 === 0) {
         chrome.runtime.sendMessage({ action: "wakeMeUp" }).catch(() => {});
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
         chrome.runtime.sendMessage({ action: "wakeMeUp" }).catch(() => {});
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
    throw new Error("❌ Dropdown option tidak muncul dalam waktu cukup.");
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
      alert(`❌ Dropdown untuk "${targetTextRaw}" tidak ditemukan. Proses dibatalkan.`);
      throw new Error(`Dropdown '${targetTextRaw}' tidak ditemukan.`);
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
         chrome.runtime.sendMessage({ action: "wakeMeUp" }).catch(() => {});
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
      alert(`❌ Opsi "${targetTextRaw}" tidak ditemukan. Proses dihentikan.`);
      throw new Error(`Opsi '${targetTextRaw}' tidak ditemukan.`);
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

    // Initial load: tunggu sampai datanya siap (bisa lebih lama pada awal tab dibuka)
    const initialWaitMs = (monitorState && typeof monitorState.initialWaitMs === 'number') ? monitorState.initialWaitMs : 30000;
    const loopWaitMs = (monitorState && typeof monitorState.loopWaitMs === 'number') ? monitorState.loopWaitMs : 8000;
    await waitForBkbDataReady(initialWaitMs);
    const acehValues = await extractTotalUpdateBelum();
    if (!results.some(r => r.kota === 'PROVINSI')) {
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

      // Per-kab: gunakan timeout berdasarkan setting loopWaitMs
      await waitForBkbDataReady(loopWaitMs);
      await wait(200);

      const values = await extractTotalUpdateBelum();
      results.push({ kota: kotaEntry.name, ...values });

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



  // === HANDLE POPUP, STORAGE, DLL (kode lama tetap) ===

  // Fitur lama: Handle popup Rekap/Detail
  async function handlePopup(reportType, url, kota, downloadQueue, currentIndex) {
    let tries = 0;
    const maxTries = 30;
    const reportTypeNorm = (reportType || '').toString().trim().toLowerCase();

    while (tries < maxTries) {
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

      // Jika tombol eksisting lain (race), selesaikan dengan fallback paling dekat
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

    alert("⚠️ Popup atau tombol Rekap/Detail tidak muncul setelah menunggu. Proses dibatalkan.");
    console.warn("⚠️ Popup tidak muncul setelah menunggu");
    await markFail(getUrlHash(url), url, kota, downloadQueue, currentIndex, 'Popup tidak muncul atau tombol rekap/detail tidak bisa diklik');
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

  async function waitForMonitorState(timeout = 3000, interval = 200) {
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

  const monitorState = await waitForMonitorState();

  if (monitorState) {
    console.log('[content] found monitorState', monitorState);

    const targetHash = monitorState.targetRoute || '/kegiatan/kelompok_bkb';
    if (!location.hash.includes(targetHash)) {
      console.log('[content] URL hash belum target, menunggu sampai 15s..', location.hash);
      const start = Date.now();
      while (Date.now() - start < 15000 && !location.hash.includes(targetHash)) {
        await wait(300);
      }
    }

    if (location.hash.includes(targetHash)) {
      console.log(`🟢 Monitoring SIGA trigger (target ${targetHash})`);
      await handleBkbMonitoringLoop(monitorState);
      return;
    }

    console.log(`🟡 Monitoring SIGA aktif tapi URL target ${targetHash} belum, tidak lanjut sekarang.`);
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
    if (changes.bkbMonitoring) {
      handlePotentialMonitorState(changes.bkbMonitoring.newValue);
    }
  });

  const storage = await new Promise((resolve) =>
    chrome.storage.local.get([key], (res) => resolve(res[key]))
  );

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

  await wait(500);

  const isTahunan = storage.periode && /^\d{4}$/.test(storage.periode);

  // Untuk mode BULANAN: pilih TAHUN terlebih dahulu sebelum memilih BULAN/PERIODE.
  // Alasan: pada beberapa halaman SIGA, memilih Tahun menyebabkan dropdown Bulan direset ke
  // bulan saat ini (default). Dengan memilih Tahun lebih dulu, pemilihan Bulan di bawah tidak
  // terpengaruh reset tersebut.
  if (!isTahunan && tahun) {
    const tahunDropdownFirst = await waitForDropdown("Tahun", 1);
    if (tahunDropdownFirst) {
      const r = await bukaDanPilihPadaDropdown(tahunDropdownFirst, tahun, url, kota, currentIndex, downloadQueue);
      if (r === false) return;
    } else {
      console.error('❌ Dropdown Tahun tidak ditemukan (timeout)');
    }
    await wait(300);
  }

  // Pilih Periode (tahun untuk tahunan, bulan untuk bulanan)
  const periodeDropdown = await waitForDropdown("Periode", 0);
  if (periodeDropdown && periode) {
    const rPeriode = await bukaDanPilihPadaDropdown(periodeDropdown, periode, url, kota, currentIndex, downloadQueue);
    if (rPeriode === false) return;
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
      // Lanjut ke kota berikutnya
      const nextIndex = currentIndex + 1;
      await chrome.storage.local.set({ [key]: { ...storage, currentIndex: nextIndex, retryCount: 0 } });
      const next = downloadQueue[nextIndex];
      if (next) {
        setTimeout(() => {
          chrome.runtime.sendMessage({ action: "navigateAndReload", url: next.url });
        }, 1000);
      }
      return;
    }
  }

  // Pilih Tahun (hanya untuk tahunan — mode bulanan sudah dipilih sebelum Periode di atas)
  await wait(300);
  if (isTahunan && tahun) {
    const tahunDropdown = await waitForDropdown("Tahun", 1);
    if (tahunDropdown) {
      const r = await bukaDanPilihPadaDropdown(tahunDropdown, tahun, url, kota, currentIndex, downloadQueue);
      if (r === false) return;
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
        // Lanjut ke kota berikutnya
        const nextIndex = currentIndex + 1;
        await chrome.storage.local.set({ [key]: { ...storage, currentIndex: nextIndex, retryCount: 0 } });
        const next = downloadQueue[nextIndex];
        if (next) {
          setTimeout(() => {
            chrome.runtime.sendMessage({ action: "navigateAndReload", url: next.url });
          }, 1000);
        }
        return;
      }
    }
    const result = await bukaDanPilihPadaDropdown(kotaDropdown, kota, url, kota, currentIndex, downloadQueue);
    if (result === false) return; // Jangan lanjut
    await wait(400);
  } else {
    console.warn("⚠️ Kota tidak dipilih, dilewati.");
  }

  // Pilih Kecamatan
  await wait(300);
  if (itemKecamatan) {
    const kecDropdown = await waitForDropdown("Kecamatan", isTahunan ? 2 : 3);
    const result = await bukaDanPilihPadaDropdown(kecDropdown, itemKecamatan, url, kota, currentIndex, downloadQueue);
    if (result === false) return; // Jangan lanjut
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
      alert(`Peringatan: Dropdown untuk memilih Desa/Faskes tidak ditemukan. Ekstensi terpaksa melewatinya. Periksa konsol untuk detail.`);
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
      if (result === false) return;
    }
    await wait(400);
  }

  // Pilih Sasaran (tahunan, jika ada)
  await wait(300);
  if (itemSasaran) {
    const sasaranDropdown = await waitForDropdown("Kelompok Sasaran", isTahunan ? 5 : 6);
    if (sasaranDropdown) {
      const result = await bukaDanPilihPadaDropdown(sasaranDropdown, itemSasaran, url, kota, currentIndex, downloadQueue);
      if (result === false) return;
    }
    await wait(400);
  }

  // Klik tombol cetak excel
  await wait(300);
  const button = [...document.querySelectorAll("button")].find(btn =>
    btn.textContent.includes("Cetak") &&
    btn.querySelector("i.icon-file-excel")
  );
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
          payload = {
            periode: storage.periode,
            tahun: storage.tahun,
            kab,
            kabCode: storage.kabCode || extractNumericCode(kota),
            jenisLaporan: storage.jenisLaporan || '',
            kec,
            kecCode: storage.kecCode || extractNumericCode(kec),
            faskes: storage.faskes || '',
            desa,
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
          const nodes = document.querySelectorAll(selectors.join(','));
          const blobs = [...nodes].map(el => el.href || el.src).filter(Boolean);
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
          if (scanAndRegister()) {
            observer.disconnect();
            window.removeEventListener('message', onMessage);
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

    // Start waiting for the blob immediately after clicking Cetak Excel
    const blobPromise = waitForBlob();

    if (jenisLaporan) {
      await handlePopup(jenisLaporan, url, kota, downloadQueue, currentIndex);
    } else {
      const hash = getUrlHash(url);
      const { key, existing: fromStorage } = await getKeyAndExisting(hash, downloadQueue, storage?.progressKey);
      const existing = fromStorage || {
        url: url,
        status: "downloading",
        totalFiles: downloadQueue.length, // total kota/file untuk URL ini
        filesCompleted: 0,
        fileAkhir: ""
      };

      // Update progress
      existing.filesCompleted = currentIndex + 1;
      existing.fileAkhir = kota || "Provinsi";
      if (currentIndex >= downloadQueue.length - 1) existing.status = "success";

      chrome.storage.local.set({ [key]: existing }, () => {
        chrome.runtime.sendMessage({ action: "refresh_download_status" });
      });
    }

    console.log("⏳ Menunggu proses pembuatan Excel oleh web...");
    await blobPromise;
    console.log("✅ File terdeteksi, bersiap untuk lanjut...");
    
    // Safety buffer to allow Chrome's download manager to capture and save the blob completely
    await wait(3000);

  } else {
    console.error("❌ Tombol Cetak Excel tidak ditemukan");
  }

  // Next queue automation
    try {
      const nextIndex = currentIndex + 1;
    // Reset retry count saat pindah ke item berikutnya
    await chrome.storage.local.set({ [key]: { ...storage, currentIndex: nextIndex, retryCount: 0 } });
    const next = downloadQueue[nextIndex];
    if (next) {
      console.log("⏳ Lanjut ke desa/kota berikutnya...");
      setTimeout(() => {
        chrome.runtime.sendMessage({ action: "navigateAndReload", url: next.url });
      }, 500);
    } else {
      // Cek status akhir di storage sebelum memutuskan menutup tab
      const finalHash = getUrlHash(url);
      console.log("⏳ Menunggu download selesai sebelum menutup tab...");

      // Tunggu sesuai setting closeDelay (default 10 detik) sebelum menutup tab
      chrome.storage.local.get('closeDelay', (res) => {
        const waitMs = ((res.closeDelay || 10) * 1000);
        console.log(`⏳ Menunggu ${res.closeDelay || 10} detik sebelum menutup tab...`);
        setTimeout(async () => {
          const { key, existing: finalData } = await getKeyAndExisting(finalHash, downloadQueue, storage?.progressKey);
          if (finalData && finalData.status === 'success') {
            console.log("🎉 Semua proses selesai (SUCCESS) - menutup tab otomatis dalam 3 detik...");
            setTimeout(() => chrome.runtime.sendMessage({ action: 'closeTab' }), 3000);
          } else {
            console.log("🚫 Proses selesai namun status bukan success (", finalData ? finalData.status : 'unknown', ") - tab dibiarkan terbuka untuk inspeksi.");
          }
        }, waitMs);
      });
    }
  } catch (e) {
    await markFail(getUrlHash(url), url, kota, downloadQueue, currentIndex, `Error akhir: ${e.message}`);
    console.error('❌ Error mengatur queue berikutnya:', e);
  }
})();
