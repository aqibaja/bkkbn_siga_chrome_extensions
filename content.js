(async () => {
  // Helper: Wait beberapa ms
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


  // Fungsi: Cari dropdown berdasarkan label di parent/teks sekita

  function findDropdownHybrid(labelText, fallbackIndex = 0) {
    // Cari field by label (mirip patch sebelumnya)
    const formGroups = document.querySelectorAll('.form-group');
    for (const group of formGroups) {
      const label = group.querySelector('label');
      if (label && label.textContent.trim().toLowerCase().includes(labelText.toLowerCase())) {
        return group.querySelector('.css-yk16xz-control');
      }
    }
    // Fallback by index array
    return document.querySelectorAll('.css-yk16xz-control')[fallbackIndex] || null;
  }

  // Tunggu hingga dropdown control muncul (untuk kasus SPA yang render async)
  async function waitForDropdown(labelText, fallbackIndex = 0, timeout = 12000, interval = 300) {
    const start = Date.now();
    let control;
    while (Date.now() - start < timeout) {
      control = findDropdownHybrid(labelText, fallbackIndex);
      if (control) return control;
      await wait(interval);
    }
    return null; // biarkan caller yang handle fail
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
    selectorOpt = '.css-yt9ioa-option, .css-1n7v3ny-option, .css-9gakcf-option',
    timeout = 12000
  ) {
    return new Promise((resolve, reject) => {
      let found = false;
      const observer = new MutationObserver(() => {
        const options = document.querySelectorAll(selectorOpt);
        if (options.length > 0) {
          found = true;
          observer.disconnect();
          resolve(options);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        if (!found) {
          observer.disconnect();
          reject(new Error('❌ Dropdown options tidak muncul dalam waktu cukup.'));
        }
      }, timeout);
    });
  }

  async function pollingDropdownOptions(
    selectorOpt = '.css-yt9ioa-option, .css-1n7v3ny-option, .css-9gakcf-option',
    timeout = 12000,
    interval = 200
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

    // Poll opsi dengan fuzzy match
    const maxTries = 30;
    let opsi = null;
    for (let tries = 0; tries < maxTries; tries++) {
      opsi = [...document.querySelectorAll('.css-yt9ioa-option, .css-1n7v3ny-option, .css-9gakcf-option')].find(el => {
        const textOption = el.textContent.trim().replace(/\u2013|\u2014/g, '-').toLowerCase();
        return (
          textOption === userValue ||
          textOption.includes(userValue) ||
          userValue.split(' ').every(token => textOption.includes(token))
        );
      });
      if (opsi) break;
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



  // === HANDLE POPUP, STORAGE, DLL (kode lama tetap) ===

  // Fitur lama: Handle popup Rekap/Detail
  async function handlePopup(reportType, url, kota, downloadQueue, currentIndex) {
    let tries = 0;
    const maxTries = 5;
    while (tries < maxTries) {
      const popUp = document.querySelector('.swal2-title');
      if (popUp) {
        console.log("✅ Popup check attempt:", tries + 1);
        const rekapButton = [...document.querySelectorAll("button")].find(btn => btn.textContent.includes("Rekap"));
        const detailButton = [...document.querySelectorAll("button")].find(btn => btn.textContent.includes("Detail"));
        console.log("🔍 Found buttons:", {
          rekap: !!rekapButton,
          detail: !!detailButton
        });
        console.log("🔍 Report type requested:", reportType);
        console.log(reportType.toLowerCase() === "rekap" && rekapButton);
        const hash = getUrlHash(url);
        if (reportType.toLowerCase() === "rekap" && rekapButton) {
          rekapButton.click();
          console.log("✅ Klik tombol Rekap");
          // Simpan status download untuk tab Download Progress
          (async () => {
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
          })();
        } else if (reportType.toLowerCase() === "detail" && detailButton) {
          detailButton.click();
          console.log("✅ Klik tombol Detail");
          // Simpan status download untuk tab Download Progress
          (async () => {
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
          })();
        } else {
          alert("❌ Jenis laporan tidak valid atau tombol Rekap/Detail tidak ditemukan. Proses dibatalkan.");
          console.error("❌ Tombol Rekap atau Detail tidak ditemukan");
          // Simpan status download untuk tab Download Progress
          (async () => {
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
            existing.status = "fail"; // immediate fail
            chrome.storage.local.set({ [key]: existing }, () => {
              chrome.runtime.sendMessage({ action: "refresh_download_status" });
            });
          })();
        }
        return;
      }
      await wait(500);
      tries++;
    }
    if (tries >= maxTries) {
      alert("⚠️ Popup tidak muncul setelah menunggu. Proses dibatalkan.");
      console.warn("⚠️ Popup tidak muncul setelah menunggu");
      await markFail(getUrlHash(url), url, kota, downloadQueue, currentIndex, 'Popup tidak muncul');
    }
  }

  // Automation: Ambil data dari storage untuk tab ini
  const tab = await chrome.runtime.sendMessage({ action: "getTabId" });
  const key = `auto_${tab.id}`;
  const storage = await new Promise((resolve) =>
    chrome.storage.local.get([key], (res) => resolve(res[key]))
  );


  if (!storage) {
    console.log("⛔ Tidak ada data automation untuk tab ini");
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
  const { kota, url } = downloadQueue[currentIndex];
  console.log(`🚀 Memproses kota ${currentIndex + 1}/${downloadQueue.length}: ${kota} - ${url}`);

  // Jika retry, log info
  if (retryCount > 0) {
    console.log(`♻️ Retry ke-${retryCount} untuk kota: ${kota}`);
  }

  await wait(2000);

  const isTahunan = storage.periode && /^\d{4}$/.test(storage.periode);

  // Pilih Periode
  const periodeDropdown = await waitForDropdown("Periode", 0);
  if (periodeDropdown && periode) {
    await bukaDanPilihPadaDropdown(periodeDropdown, periode, url, kota, currentIndex, downloadQueue);
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

  // Pilih Tahun (jika ada, misal di mode bulanan)
  await wait(1000);
  if (tahun) {
    const tahunDropdown = await waitForDropdown("Tahun", 1);
    if (tahunDropdown) await bukaDanPilihPadaDropdown(tahunDropdown, tahun, url, kota, currentIndex, downloadQueue);
    else console.error('❌ Dropdown Tahun tidak ditemukan (timeout)');
  }

  // Pilih Kota/Kab
  await wait(1000);
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
    await wait(1200);
  } else {
    console.warn("⚠️ Kota tidak dipilih, dilewati.");
  }

  // Pilih Kecamatan
  await wait(1000);
  if (kecamatan) {
    const kecDropdown = await waitForDropdown("Kecamatan", isTahunan ? 2 : 3);
    const result = await bukaDanPilihPadaDropdown(kecDropdown, kecamatan, url, kota, currentIndex, downloadQueue);
    if (result === false) return; // Jangan lanjut
    await wait(1200);
  }

  // Pilih Desa (tahunan, jika ada)
  // Barulah eksekusi desa
  // if (desa) {
  //   const desaDropdown = findDropdownByLabel("Desa/Kel");
  //   const result = await bukaDanPilihPadaDropdown(desaDropdown, desa);
  //   if (result === false) return; // Jangan lanjut
  //   await wait(1200);
  // }
  await wait(1000);
  if (desa) {
    const desaDropdown = await waitForDropdown("Desa/Kel", isTahunan ? 3 : 4);
    if (desaDropdown) {
      desaDropdown.scrollIntoView();
      // PATCH PENTING: klik hingga benar-benar membuka opsi Desa
      desaDropdown.click();
      await wait(400);
      // Debug sebelum select opsi, ambil snapshot DOM setelah klik
      console.log('DEBUG - OPSI DESA READY:',
        [...document.querySelectorAll('.css-yt9ioa-option, .css-1n7v3ny-option, .css-9gakcf-option')]
          .map(el => el.textContent.trim())
      );
      // Baru lakukan pemilihan dengan fuzzy
      const result = await bukaDanPilihPadaDropdown(desaDropdown, desa, url, kota, currentIndex, downloadQueue);
      if (result === false) return;
    } else {
      alert("❌ Dropdown Desa/Kel tidak ditemukan. Proses dibatalkan.");
      throw new Error("Dropdown DesaKel tidak ditemukan");
    }
  }
  // Pilih RW (tahunan, jika ada)
  await wait(1000);
  if (rw) {
    const rwDropdown = await waitForDropdown("RW", isTahunan ? 4 : 5);
    const result = await bukaDanPilihPadaDropdown(rwDropdown, rw, url, kota, currentIndex, downloadQueue);
    if (result === false) return; // Jangan lanjut
    await wait(1200);
  }
  // Pilih Sasaran (tahunan, jika ada)
  await wait(1000);
  if (sasaran) {
    const sasaranDropdown = await waitForDropdown("Kelompok Sasaran", isTahunan ? 5 : 6);
    const result = await bukaDanPilihPadaDropdown(sasaranDropdown, sasaran, url, kota, currentIndex, downloadQueue);
    if (result === false) return; // Jangan lanjut
    await wait(1200);
  }

  // Pilih Faskes (bulanan, jika ada)
  await wait(1000);
  if (faskes) {
    const faskesDropdown = await waitForDropdown("Faskes", 4);
    if (faskesDropdown) await bukaDanPilihPadaDropdown(faskesDropdown, faskes, url, kota, currentIndex, downloadQueue);
    else console.error('❌ Dropdown Faskes tidak ditemukan');
    await wait(1200);
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

    // Try to detect blob URL created by the page and register rename payload per-blob
    (async function tryRegisterBlob() {
      const payload = {
        periode: storage.periode,
        tahun: storage.tahun,
        kab: (kota || '').toString().replace(/^\d+\s*-\s*/, '').trim(),
        kec: storage.kecamatan || '',
        faskes: storage.faskes || '',
        desa: (downloadQueue[currentIndex] && downloadQueue[currentIndex].desa) || storage.desa || '',
        rw: storage.rw || ''
      };

      const timeout = 3000;
      const interval = 200;
      const start = Date.now();
      while (Date.now() - start < timeout) {
        // look for anchors or iframe/source with blob: href/src
        const blobs = [...document.querySelectorAll('a[href^="blob:"], iframe[src^="blob:"], source[src^="blob:"]')]
          .map(el => el.href || el.src)
          .filter(Boolean);
        if (blobs.length > 0) {
          const blobUrl = blobs[blobs.length - 1];
          try {
            chrome.runtime.sendMessage({ action: 'registerBlobRename', blobUrl, payload }, (resp) => {
              console.log('registerBlobRename resp', resp);
            });
          } catch (e) {
            console.warn('Failed to register blob rename', e);
          }
          break;
        }
        await wait(interval);
      }
    })();

    await wait(500);
    if (jenisLaporan) {
      await handlePopup(jenisLaporan, url, kota, downloadQueue, currentIndex);
    } else {
      // Simpan status download untuk tab Download Progress
      (async () => {
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
      })();

    }
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
      console.log("⏳ Menunggu sebelum lanjut ke kota berikutnya...");
      setTimeout(() => {
        chrome.runtime.sendMessage({ action: "navigateAndReload", url: next.url });
      }, 1000);
    } else {
      // Cek status akhir di storage sebelum memutuskan menutup tab
      const finalHash = getUrlHash(url);
      console.log("⏳ Menunggu download selesai sebelum menutup tab...");

      // Tunggu lebih lama untuk memastikan file benar-benar terdownload (15 detik)
      setTimeout(async () => {
        const { key, existing: finalData } = await getKeyAndExisting(finalHash, downloadQueue, storage?.progressKey);
        if (finalData && finalData.status === 'success') {
          console.log("🎉 Semua proses selesai (SUCCESS) - menutup tab otomatis dalam 3 detik...");
          setTimeout(() => chrome.runtime.sendMessage({ action: 'closeTab' }), 3000);
        } else {
          console.log("🚫 Proses selesai namun status bukan success (", finalData ? finalData.status : 'unknown', ") - tab dibiarkan terbuka untuk inspeksi.");
        }
      }, 10000); // Tunggu 10 detik untuk memastikan download selesai
    }
  } catch (e) {
    await markFail(getUrlHash(url), url, kota, downloadQueue, currentIndex, `Error akhir: ${e.message}`);
    console.error('❌ Error mengatur queue berikutnya:', e);
  }
})();
