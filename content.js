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

  // Buat hash unik dari URL (bisa pakai base64 atau hanya ambil bagian unik URL)
  function getUrlHash(url) {
    return btoa(url); // hash sederhana
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

  // Fungsi utama end-to-end
  async function bukaDanPilihPadaDropdown(control, targetTextRaw) {
    if (!control) {
      alert("❌ Dropdown tidak ditemukan! Proses dibatalkan.");
      throw new Error("❌ Dropdown tidak ditemukan.");
    }

    klikDropdown(control);
    await wait(400); // waktu animasi dropdown jika ada

    // Coba MutationObserver dulu
    let options;
    try {
      options = await waitForDropdownOptions();
    } catch {
      try {
        // Fallback polling jika observer gagal
        options = await pollingDropdownOptions();
      } catch (e) {
        alert(e.message);
        throw e;
      }
    }

    // Cek dan klik opsi yang cocok (fuzzy search & log jika tidak ketemu)
    const userValue = targetTextRaw.trim().replace(/\u2013|\u2014/g, '-').toLowerCase();
    let found = false;
    for (const opt of options) {
      if (opt.textContent.trim().toLowerCase().includes(userValue)) {
        opt.scrollIntoView({ behavior: "smooth" });
        opt.click();
        found = true;
        break;
      }
    }

    if (!found) {
      // Debug log opsi untuk pemecahan masalah
      const opsiList = Array.from(options).map(o => o.textContent.trim());
      alert(`❌ Opsi "${targetTextRaw}" tidak ditemukan!\nDaftar opsi: ${opsiList.join(", ")}`);
      throw new Error(`❌ Opsi "${targetTextRaw}" tidak ditemukan.`);
    }
    await wait(200);
    // lanjut ke proses berikutnya
  }


  // Pilih dropdown tertentu dan select targetTextRaw
  async function bukaDanPilihPadaDropdown(control, targetTextRaw, url, kota, currentIndex, downloadQueue) {
    if (!control) {
      alert("❌ Dropdown tidak ditemukan! Proses dibatalkan.");
      throw new Error("❌ Dropdown tidak ditemukan");
    }

    const userValue = targetTextRaw.trim().replace(/\u2013|\u2014/g, '-').toLowerCase();
    control.scrollIntoView();
    control.click();
    await wait(250);
    control.focus();
    control.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown", code: "ArrowDown" }));

    // Poll & fuzzy match opsi dropdown
    const maxTries = 30;
    let tries = 0;
    let opsi = null;
    while (tries < maxTries) {
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
      tries++;
    }

    if (opsi) {
      opsi.click();
      console.log(`✅ Berhasil pilih (fuzzy match) "${targetTextRaw}" => "${opsi.textContent.trim()}"`);
      await wait(200); // waktu buffer
      return true;
    }

    // PATCH: Jika gagal, update status ke storage dan alert
    alert(`❌ Gagal menemukan opsi/fuzzy "${targetTextRaw}". Proses download otomatis dibatalkan.`);

    // Ambil & update status download progress ke chrome.storage.local
    chrome.storage.local.get([`tabdownload_${getUrlHash(url)}`], function (result) {
      let existing = result[`tabdownload_${getUrlHash(url)}`] || {
        url: url,
        status: "downloading",
        totalFiles: downloadQueue.length,
        filesCompleted: 0,
        fileAkhir: ""
      };

      // Update progress
      existing.filesCompleted = currentIndex + 1;
      existing.fileAkhir = kota || "Provinsi";
      if (currentIndex >= downloadQueue.length - 1) existing.status = "fail";

      chrome.storage.local.set({
        [`tabdownload_${getUrlHash(url)}`]: existing
      });
      chrome.runtime.sendMessage({ action: "refresh_download_status" });
    });

    throw new Error(`❌ Tidak ketemu opsi fuzzy untuk "${targetTextRaw}"`);
  }



  // === HANDLE POPUP, STORAGE, DLL (kode lama tetap) ===

  // Fitur lama: Handle popup Rekap/Detail
  async function handlePopup(reportType) {
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
        if (reportType.toLowerCase() === "rekap" && rekapButton) {
          rekapButton.click();
          console.log("✅ Klik tombol Rekap");
          // Simpan status download untuk tab Download Progress
          chrome.storage.local.get([`tabdownload_${getUrlHash(url)}`], function (result) {
            let existing = result[`tabdownload_${getUrlHash(url)}`] || {
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

            chrome.storage.local.set({
              [`tabdownload_${getUrlHash(url)}`]: existing
            });
            chrome.runtime.sendMessage({ action: "refresh_download_status" });
          });
        } else if (reportType.toLowerCase() === "detail" && detailButton) {
          detailButton.click();
          console.log("✅ Klik tombol Detail");
          // Simpan status download untuk tab Download Progress
          chrome.storage.local.get([`tabdownload_${getUrlHash(url)}`], function (result) {
            let existing = result[`tabdownload_${getUrlHash(url)}`] || {
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

            chrome.storage.local.set({
              [`tabdownload_${getUrlHash(url)}`]: existing
            });
            chrome.runtime.sendMessage({ action: "refresh_download_status" });
          });
        } else {
          alert("❌ Jenis laporan tidak valid atau tombol Rekap/Detail tidak ditemukan. Proses dibatalkan.");
          console.error("❌ Tombol Rekap atau Detail tidak ditemukan");
          // Simpan status download untuk tab Download Progress
          chrome.storage.local.get([`tabdownload_${getUrlHash(url)}`], function (result) {
            let existing = result[`tabdownload_${getUrlHash(url)}`] || {
              url: url,
              status: "downloading",
              totalFiles: downloadQueue.length, // total kota/file untuk URL ini
              filesCompleted: 0,
              fileAkhir: ""
            };

            // Update progress
            existing.filesCompleted = currentIndex + 1;
            existing.fileAkhir = kota || "Provinsi";
            if (currentIndex >= downloadQueue.length - 1) existing.status = "fail";

            chrome.storage.local.set({
              [`tabdownload_${getUrlHash(url)}`]: existing
            });
            chrome.runtime.sendMessage({ action: "refresh_download_status" });
          });
        }
        return;
      }
      await wait(500);
      tries++;
    }
    if (tries >= maxTries) {
      alert("⚠️ Popup tidak muncul setelah menunggu. Proses dibatalkan.");
      console.warn("⚠️ Popup tidak muncul setelah menunggu");
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

  const { downloadQueue, currentIndex = 0, periode, selectedCities, kecamatan, faskes, jenisLaporan, tahun, desa, rw, sasaran } = storage;

  if (!downloadQueue || currentIndex >= downloadQueue.length) {
    console.log("✅ Semua download selesai untuk tab ini");
    return;
  }

  // Proses utama automation per queue
  const { kota, url } = downloadQueue[currentIndex];
  console.log(`🚀 Memproses: ${kota} - ${url}`);
  await wait(2000);

  const isTahunan = storage.periode && /^\d{4}$/.test(storage.periode);

  // Pilih Periode
  const periodeDropdown = findDropdownHybrid("Periode", 0);
  if (periodeDropdown && periode) await bukaDanPilihPadaDropdown(periodeDropdown, periode);
  else console.error('❌ Dropdown Periode tidak ditemukan');

  // Pilih Tahun (jika ada, misal di mode bulanan)
  await wait(1000);
  if (tahun) {
    const tahunDropdown = findDropdownHybrid("Tahun", 1);
    if (tahunDropdown) await bukaDanPilihPadaDropdown(tahunDropdown, tahun);
    else console.error('❌ Dropdown Tahun tidak ditemukan');
  }

  // Pilih Kota/Kab
  await wait(1000);
  if (kota) {
    const kotaDropdown = findDropdownHybrid("Kab/Kota", isTahunan ? 1 : 2);
    const result = await bukaDanPilihPadaDropdown(kotaDropdown, kota);
    if (result === false) return; // Jangan lanjut
    await wait(1200);
  } else {
    console.warn("⚠️ Kota tidak dipilih, dilewati.");
  }

  // Pilih Kecamatan
  await wait(1000);
  if (kecamatan) {
    const kecDropdown = findDropdownHybrid("Kecamatan", isTahunan ? 2 : 3);
    const result = await bukaDanPilihPadaDropdown(kecDropdown, kecamatan);
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
    const desaDropdown = findDropdownHybrid("Desa/Kel", isTahunan ? 3 : 4);
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
      const result = await bukaDanPilihPadaDropdown(desaDropdown, desa);
      if (result === false) return;
    } else {
      alert("❌ Dropdown Desa/Kel tidak ditemukan. Proses dibatalkan.");
      throw new Error("Dropdown DesaKel tidak ditemukan");
    }
  }
  // Pilih RW (tahunan, jika ada)
  await wait(1000);
  if (rw) {
    const rwDropdown = findDropdownHybrid("RW", isTahunan ? 4 : 5);
    const result = await bukaDanPilihPadaDropdown(rwDropdown, rw);
    if (result === false) return; // Jangan lanjut
    await wait(1200);
  }
  // Pilih Sasaran (tahunan, jika ada)
  await wait(1000);
  if (sasaran) {
    const sasaranDropdown = findDropdownHybrid("Kelompok Sasaran", isTahunan ? 5 : 6);
    const result = await bukaDanPilihPadaDropdown(sasaranDropdown, sasaran);
    if (result === false) return; // Jangan lanjut
    await wait(1200);
  }

  // Pilih Faskes (bulanan, jika ada)
  await wait(1000);
  if (faskes) {
    const faskesDropdown = findDropdownHybrid("Faskes", 4);
    if (faskesDropdown) await bukaDanPilihPadaDropdown(faskesDropdown, faskes);
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
    await wait(900);
    if (jenisLaporan) {
      await handlePopup(jenisLaporan);
    } else {
      // Simpan status download untuk tab Download Progress
      chrome.storage.local.get([`tabdownload_${getUrlHash(url)}`], function (result) {
        let existing = result[`tabdownload_${getUrlHash(url)}`] || {
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

        chrome.storage.local.set({
          [`tabdownload_${getUrlHash(url)}`]: existing
        });
        chrome.runtime.sendMessage({ action: "refresh_download_status" });
      });

    }
  } else {
    console.error("❌ Tombol Cetak Excel tidak ditemukan");
  }

  // Next queue automation
  const nextIndex = currentIndex + 1;
  await chrome.storage.local.set({ [key]: { ...storage, currentIndex: nextIndex } });
  const next = downloadQueue[nextIndex];
  if (next) {
    console.log("⏳ Menunggu sebelum lanjut ke kota berikutnya...");
    setTimeout(() => {
      chrome.runtime.sendMessage({ action: "navigateAndReload", url: next.url });
    }, 1000);
  } else {
    console.log("🎉 Semua proses selesai untuk tab ini");
  }
})();
