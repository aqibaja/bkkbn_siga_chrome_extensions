(async () => {
  // Helper: Wait beberapa ms
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Fitur lama: Tunggu elemen muncul di DOM
  async function tungguElemen(selector, index = 0, maxTries = 30, delay = 100) {
    let tries = 0;
    while (tries < maxTries) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > index) return elements[index];
      await wait(delay);
      tries++;
    }
    return null;
  }

  // Fitur lama: Pilih dropdown dengan keyboard
  async function bukaDanPilihDenganKeyboard(indexDropdown, targetTextRaw) {
    const control = await tungguElemen('.css-yk16xz-control', indexDropdown);
    if (!control) return console.error(`❌ Dropdown ke-${indexDropdown} tidak ditemukan`);
    const targetText = targetTextRaw.trim().replace(/\u2013|\u2014/g, '-').toLowerCase();
    control.scrollIntoView();
    control.focus();
    control.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown", code: "ArrowDown" }));
    const maxTries = 30;
    let tries = 0;
    while (tries < maxTries) {
      const opsi = [...document.querySelectorAll('.css-yt9ioa-option, .css-1n7v3ny-option, .css-9gakcf-option')].find(el => {
        const teks = el.textContent.trim().replace(/\u2013|\u2014/g, '-').toLowerCase();
        return teks === targetText;
      });
      if (opsi) {
        opsi.click();
        console.log(`✅ Berhasil pilih "${targetTextRaw}" di dropdown ke-${indexDropdown}`);
        return;
      }
      await wait(100);
      tries++;
    }
    console.error(`❌ Gagal menemukan opsi "${targetTextRaw}"`);
  }

  // Fitur lama: Handle popup Rekap/Detail
  async function handlePopup(reportType) {
    let tries = 0;
    const maxTries = 5;
    while (tries < maxTries) {
      const popUp = document.querySelector('.swal2-title');
      if (popUp) {
        const rekapButton = [...document.querySelectorAll("button")].find(btn => btn.textContent.includes("Rekap"));
        const detailButton = [...document.querySelectorAll("button")].find(btn => btn.textContent.includes("Detail"));
        if (reportType === "Rekap" && rekapButton) {
          rekapButton.click();
          console.log("✅ Klik tombol Rekap");
        } else if (reportType === "Detail" && detailButton) {
          detailButton.click();
          console.log("✅ Klik tombol Detail");
        } else {
          console.error("❌ Tombol Rekap atau Detail tidak ditemukan");
        }
        return;
      }
      await wait(500);
      tries++;
    }
    console.warn("⚠️ Popup tidak muncul setelah menunggu");
  }

  // Automation: Ambil data dari storage untuk tab ini
  const tab = await chrome.runtime.sendMessage({ action: "getTabId" });
  const key = `auto_${tab.id}`;
  const storage = await new Promise((resolve) =>
    chrome.storage.local.get([key], (res) => resolve(res[key]))
  );

  console.log('Storage auto_{tab.id}:', storage);


  if (!storage) {
    console.log("⛔ Tidak ada data automation untuk tab ini");
    return;
  }

  const { downloadQueue, currentIndex = 0, periode, selectedCities, kecamatan, faskes, jenisLaporan, reportType, tahun } = storage;

  if (!downloadQueue || currentIndex >= downloadQueue.length) {
    console.log("✅ Semua download selesai untuk tab ini");
    return;
  }

  // Proses utama automation per queue
  const { kota, url } = downloadQueue[currentIndex];
  console.log(`🚀 Memproses: ${kota} - ${url}`);

  // Pilih dropdown sesuai input
  await wait(3000);

  // Cek mode berdasarkan field "periode" atau url atau data lain
  const isTahunan = storage.periode && /^\d{4}$/.test(storage.periode);
  // mode tahunan jika periode hanya angka (tahun, misal "2024"), mode bulanan jika "Mei", "Juni", dst.

  const periodeIndex = 0;
  const kotaIndex = isTahunan ? 1 : 2;

  console.log(
    `Mode: ${isTahunan ? "Tahunan" : "Bulanan"}, periodeIndex=${periodeIndex}, kotaIndex=${kotaIndex}`
  );
  await bukaDanPilihDenganKeyboard(periodeIndex, periode);
  if (tahun) {
    await wait(3000);
    await bukaDanPilihDenganKeyboard(1, tahun);    // Tahun
  }       // Periode (tahun/bulan)
  if (kota) {
    await wait(3000);
    await bukaDanPilihDenganKeyboard(kotaIndex, kota);         // Kota
  } else {
    console.warn("⚠️ Kota tidak dipilih, dilewati.");
  }
  if (kecamatan) {
    await wait(3000);
    await bukaDanPilihDenganKeyboard(3, kecamatan);    // Kecamatan
  }
  if (faskes) {
    await wait(3000);
    await bukaDanPilihDenganKeyboard(4, faskes);       // Faskes (bulanan)
  }

  // Klik tombol cetak excel
  await wait(3000);
  const button = [...document.querySelectorAll("button")].find(btn =>
    btn.textContent.includes("Cetak") &&
    btn.querySelector("i.icon-file-excel")
  );
  if (button) {
    button.click();
    console.log("✅ Klik tombol Cetak Excel");
    await wait(3000);
    await handlePopup(jenisLaporan || reportType);
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
