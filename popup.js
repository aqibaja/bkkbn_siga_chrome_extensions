// ──────────────────────────────────────────────────────────
// DATA URL TABEL PER MENU — dimuat dari JSON
// ──────────────────────────────────────────────────────────

// Akan diisi setelah JSON dimuat
let urlTableData = { bulanan: {}, tahunan: {} };

/**
 * Parse flat JSON array (format: id hanya diisi pada baris pertama per grup)
 * menjadi objek { [menuId]: [{ url, nama }] }.
 * Grup dengan 1 URL otomatis diberi autoFill: true.
 */
function parseUrlJson(rawArray) {
  const result = {};
  let currentId = null;
  rawArray.forEach(entry => {
    if (!entry.url || !entry.url.trim()) return; // skip baris kosong
    if (entry.id && entry.id.trim()) currentId = entry.id.trim();
    if (!currentId) return;
    if (!result[currentId]) result[currentId] = [];
    // Toleran untuk "nama" atau "Nama" (perbedaan huruf kapital antar file)
    const nama = entry.nama || entry.Nama || entry.url;
    result[currentId].push({ url: entry.url.trim(), nama: nama.trim() });
  });
  // Grup yang hanya punya 1 URL → autoFill (langsung isi textarea, tanpa checklist)
  Object.keys(result).forEach(id => {
    if (result[id].length === 1) result[id][0].autoFill = true;
  });
  return result;
}

function detectSasaranFromUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const normalized = url.toLowerCase();
  if (normalized.includes('/#/catindetail') || normalized.includes('/#/catin-') || normalized.includes('/#/catin')) return 'catin';
  if (normalized.includes('/#/badutadetail') || normalized.includes('/#/baduta-') || normalized.includes('/#/baduta')) return 'baduta';
  if (normalized.includes('/#/bumil') || normalized.includes('/#/ibuhamil') || normalized.includes('/#/ibu-hamil')) return 'bumil';
  if (normalized.includes('/#/pascapersalinan') || normalized.includes('/#/pascasalin')) return 'pascapersalin';
  return '';
}

async function loadUrlData() {
  try {
    const [resBulanan, resTahunan] = await Promise.all([
      fetch('url-bulanan.json'),
      fetch('url-tahunan.json')
    ]);
    const [rawBulanan, rawTahunan] = await Promise.all([
      resBulanan.json(),
      resTahunan.json()
    ]);
    urlTableData.bulanan = parseUrlJson(rawBulanan);
    urlTableData.tahunan = parseUrlJson(rawTahunan);
    console.log('[urlTableData] loaded — bulanan keys:', Object.keys(urlTableData.bulanan), '| tahunan keys:', Object.keys(urlTableData.tahunan));
  } catch (e) {
    console.error('Gagal load url data:', e);
  }
}

// Helper function untuk encode URL yang aman dengan Unicode
function safeUrlHash(url) {
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

// Load data wilayah dari JSON (tanpa import, gunakan fetch)
let wilayahData = {};

async function loadWilayahData() {
  try {
    const response = await fetch('KODE WILAYAH.json');
    wilayahData = await response.json();
    console.log('[wilayah] loaded, top-level keys:', Object.keys(wilayahData).length);
  } catch (e) {
    console.error('Gagal load data wilayah:', e);
  }
}
// Panggil saat popup dibuka
loadWilayahData();
loadUrlData().then(() => restoreUserPrefs());

// Data kota
const cities = [
  { id: '01', name: '01 - ACEH SELATAN' },
  { id: '02', name: '02 - ACEH TENGGARA' },
  { id: '03', name: '03 - ACEH TIMUR' },
  { id: '04', name: '04 - ACEH TENGAH' },
  { id: '05', name: '05 - ACEH BARAT' },
  { id: '06', name: '06 - ACEH BESAR' },
  { id: '07', name: '07 - PIDIE' },
  { id: '08', name: '08 - ACEH UTARA' },
  { id: '09', name: '09 - SIMEULUE' },
  { id: '10', name: '10 - ACEH SINGKIL' },
  { id: '11', name: '11 - BIREUEN' },
  { id: '12', name: '12 - ACEH BARAT DAYA' },
  { id: '13', name: '13 - GAYO LUES' },
  { id: '14', name: '14 - ACEH JAYA' },
  { id: '15', name: '15 - NAGAN RAYA' },
  { id: '16', name: '16 - ACEH TAMIANG' },
  { id: '17', name: '17 - BENER MERIAH' },
  { id: '18', name: '18 - PIDIE JAYA' },
  { id: '71', name: '71 - KOTA BANDA ACEH' },
  { id: '72', name: '72 - KOTA SABANG' },
  { id: '73', name: '73 - KOTA LHOKSEUMAWE' },
  { id: '74', name: '74 - KOTA LANGSA' },
  { id: '75', name: '75 - KOTA SUBULUSSALAM' },
];

// Data kecamatan per kabupaten/kota
const kecamatanData = {
  '01': ['01 - BAKONGAN', '02 - KLUET UTARA', '03 - KLUET SELATAN', '04 - LABUHANHAJI', '05 - MEUKEK', '06 - SAMADUA', '07 - SAWANG', '08 - TAPAKTUAN', '09 - TRUMON', '10 - PASI RAJA', '11 - LABUHAN HAJI TIMUR', '12 - LABUHAN HAJI BARAT', '13 - KLUET TENGAH', '14 - KLUET TIMUR', '15 - BAKONGAN TIMUR', '16 - TRUMON TIMUR', '17 - KOTA BAHAGIA', '18 - TRUMON TENGAH'],
  '02': ['01 - LAWE ALAS', '02 - LAWE SIGALA-GALA', '03 - BAMBEL', '04 - BABUSSALAM', '05 - BADAR', '06 - BABUL MAKMUR', '07 - DARUL HASANAH', '08 - LAWE BULAN', '09 - BUKIT TUSAM', '10 - SEMADAM', '11 - BABUL RAHMAH', '12 - KETAMBE', '13 - DELENG POKHKISEN', '14 - LAWE SUMUR', '15 - TANOH ALAS', '16 - LEUSER'],
  '03': ['01 - DARUL AMAN', '02 - JULOK', '03 - IDI RAYEUK', '04 - BIREM BAYEUN', '05 - SERBAJADI', '06 - NURUSSALAM', '07 - PEUREULAK', '08 - RANTAU SELAMAT', '09 - SIMPANG ULIM', '10 - RANTAU PEUREULAK', '11 - PANTE BIDARI', '12 - MADAT', '13 - INDRA MAKMU', '14 - IDI TUNONG', '15 - BANDA ALAM', '16 - PEUDAWA', '17 - PEUREULAK TIMUR', '18 - PEUREULAK BARAT', '19 - SUNGAI RAYA', '20 - SIMPANG JERNIH', '21 - DARUL IHSAN', '22 - DARUL FALAH', '23 - IDI TIMUR', '24 - PEUNARON'],
  '04': ['01 - LINGE', '02 - SILIH NARA', '03 - BEBESEN', '07 - PEGASING', '08 - BINTANG', '10 - KETOL', '11 - KEBAYAKAN', '12 - KUTE PANANG', '13 - CELALA', '17 - LAUT TAWAR', '18 - ATU LINTANG', '19 - JAGONG JEGET', '20 - BIES', '21 - RUSIP ANTARA'],
  '05': ['01 - JOHAN PAHWALAN', '02 - KAWAY XVI', '03 - SUNGAI MAS', '04 - WOYLA', '05 - SAMATIGA', '06 - BUBON', '07 - ARONGAN LAMBALEK', '08 - PANTE CEUREUMEN', '09 - MEUREUBO', '10 - WOYLA BARAT', '11 - WOYLA TIMUR', '12 - PANTON REU'],
  '06': ['01 - LHOONG', '02 - LHOKNGA', '03 - INDRAPURI', '04 - SEULIMEUM', '05 - MONTASIK', '06 - SUKAMAKMUR', '07 - DARUL IMARAH', '08 - PEUKAN BADA', '09 - MESJID RAYA', '10 - INGIN JAYA', '11 - KUTA BARO', '12 - DARUSSALAM', '13 - PULO ACEH', '14 - LEMBAH SEULAWAH', '15 - KOTA JANTHO', '16 - KUTA COT GLIE', '17 - KUTA MALAKA', '18 - SIMPANG TIGA', '19 - DARUL KAMAL', '20 - BAITUSSALAM', '21 - KRUENG BARONA JAYA', '22 - LEUPUNG', '23 - BLANG BINTANG'],
  '07': ['03 - BATEE', '04 - DELIMA', '05 - GEUMPANG', '06 - GLUMPANG TIGA', '07 - INDRAJAYA', '08 - KEMBANG TANJONG', '09 - KOTA SIGLI', '11 - MILA', '12 - MUARA TIGA', '13 - MUTIARA', '14 - PADANG TIJI', '15 - PEUKAN BARO', '16 - PIDIE', '17 - SAKTI', '18 - SIMPANG TIGA', '19 - TANGSE', '21 - TIRO/TRUSEB', '22 - KEUMALA', '24 - MUTIARA TIMUR', '25 - GRONG-GRONG', '27 - MANE', '29 - GLUMPANG BARO', '31 - TITEUE'],
  '08': ['01 - BAKTIYA', '02 - DEWANTARA', '03 - KUTA MAKMUR', '04 - LHOKSUKON', '05 - MATANGKULI', '06 - MUARA BATU', '07 - MEURAH MULIA', '08 - SAMUDERA', '09 - SEUNUDDON', '10 - SYAMTALIRA ARON', '11 - SYAMTALIRA BAYU', '12 - TANAH LUAS', '13 - TANAH PASIR', '14 - T. JAMBO AYE', '15 - SAWANG', '16 - NISAM', '17 - COT GIREK', '18 - LANGKAHAN', '19 - BAKTIYA BARAT', '20 - PAYA BAKONG', '21 - NIBONG', '22 - SIMPANG KRAMAT', '23 - LAPANG', '24 - PIRAK TIMUR', '25 - GEUREDONG PASE', '26 - BANDA BARO', '27 - NISAM ANTARA'],
  '09': ['01 - SIMEULUE TENGAH', '02 - SALANG', '03 - TEUPAH BARAT', '04 - SIMEULUE TIMUR', '05 - TELUK DALAM', '06 - SIMEULUE BARAT', '07 - TEUPAH SELATAN', '08 - ALAPAN', '09 - TEUPAH TENGAH', '10 - SIMEULUE CUT'],
  '10': ['01 - PULAU BANYAK', '02 - SIMPANG KANAN', '04 - SINGKIL', '06 - GUNUNG MERIAH', '09 - KOTA BAHARU', '10 - SINGKIL UTARA', '11 - DANAU PARIS', '12 - SURO MAKMUR', '13 - SINGKOHOR', '14 - KUALA BARU', '16 - PULAU BANYAK BARAT'],
  '11': ['01 - SAMALANGA', '02 - JEUNIEB', '03 - PEUDADA', '04 - JEUMPA', '05 - PEUSANGAN', '06 - MAKMUR', '07 - GANDAPURA', '08 - PANDRAH', '09 - JULI', '10 - JANGKA', '11 - SIMPANG MAMPLAM', '12 - PEULIMBANG', '13 - KOTA JUANG', '14 - KUALA', '15 - PEUSANGAN SIBLAH KRUENG', '16 - PEUSANGAN SELATAN', '17 - KUTA BLANG'],
  '12': ['01 - BLANG PIDIE', '02 - TANGAN-TANGAN', '03 - MANGGENG', '04 - SUSOH', '05 - KUALA BATEE', '06 - BABAH ROT', '07 - SETIA', '08 - JEUMPA', '09 - LEMBAH SABIL'],
  '13': ['01 - BLANGKEJEREN', '02 - KUTAPANJANG', '03 - RIKIT GAIB', '04 - TERANGUN', '05 - PINING', '06 - BLANGPEGAYON', '07 - PUTERI BETUNG', '08 - DABUN GELANG', '09 - BLANGJERANGO', '10 - TERIPE JAYA', '11 - PANTAN CUACA'],
  '14': ['01 - TEUNOM', '02 - KRUENG SABEE', '03 - SETIA BHAKTI', '04 - SAMPOINIET', '05 - JAYA', '06 - PANGA', '07 - INDRA JAYA', '08 - DARUL HIKMAH', '09 - PASIE RAYA'],
  '15': ['01 - KUALA', '02 - SEUNAGAN', '03 - SEUNAGAN TIMUR', '04 - BEUTONG', '05 - DARUL MAKMUR', '06 - SUKA MAKMUE', '07 - KUALA PESISIR', '08 - TADU RAYA', '09 - TRIPA MAKMUR', '10 - BEUTONG ATEUH BANGGALANG'],
  '16': ['01 - MANYAK PAYED', '02 - BENDAHARA', '03 - KARANG BARU', '04 - SERUWAY', '05 - KOTA KUALASINPANG', '06 - KEJURUAN MUDA', '07 - TAMIANG HULU', '08 - RANTAU', '09 - BANDA MULIA', '10 - BANDAR PUSAKA', '11 - TENGGULUN', '12 - SEKERAK'],
  '17': ['01 - PINTU RIME GAYO', '02 - PERMATA', '03 - SYIAH UTAMA', '04 - BANDAR', '05 - BUKIT', '06 - WIH PESAM', '07 - TIMANG GAJAH', '08 - BENER KELIPAH', '09 - MESIDAH', '10 - GAJAH PUTIH'],
  '18': ['01 - MEUREUDU', '02 - ULIM', '03 - JANGKA BUAYA', '04 - BANDAR DUA', '05 - MEURAH DUA', '06 - BANDAR BARU', '07 - PANTERAJA', '08 - TRIENGGADENG'],
  '71': ['01 - BAITURRAHMAN', '02 - KUTA ALAM', '03 - MEURAXA', '04 - SYIAH KUALA', '05 - LUENG BATA', '06 - KUTA RAJA', '07 - BANDA RAYA', '08 - JAYA BARU', '09 - ULEE KARENG'],
  '72': ['01 - SUKAKARYA', '02 - SUKAJAYA', '03 - SUKAMAKMUE'],
  '73': ['01 - MUARA DUA', '02 - BANDA SAKTI', '03 - BLANG MANGAT', '04 - MUARA SATU'],
  '74': ['01 - LANGSA TIMUR', '02 - LANGSA BARAT', '03 - LANGSA KOTA', '04 - LANGSA LAMA', '05 - LANGSA BARO'],
  '75': ['01 - SIMPANG KIRI', '02 - PENANGGALAN', '03 - RUNDENG', '04 - SULTAN DAULAT', '05 - LONGKIB']
};

// Render checkboxes untuk setiap tab
function renderCheckboxes(containerId, tabName) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  cities.forEach(city => {
    const checkboxItem = document.createElement('div');
    checkboxItem.className = 'checkbox-item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `${tabName}-${city.id}`;
    checkbox.value = city.id;
    const label = document.createElement('label');
    label.htmlFor = `${tabName}-${city.id}`;
    label.textContent = city.name;
    checkboxItem.appendChild(checkbox);
    checkboxItem.appendChild(label);
    container.appendChild(checkboxItem);

    // Event listener untuk update checkbox kecamatan
    checkbox.addEventListener('change', () => {
      updateKecamatanDropdown(tabName);
      handleDisableInputs(tabName);
      saveUserPrefs();
    });
  });

  // Tambahkan handler disable saat render awal
  setTimeout(() => handleDisableInputs(tabName), 0);
}

// Fungsi untuk men-disable input selain jenis laporan jika lebih dari 1 kab/kota dipilih
function handleDisableInputs(tabName) {
  const checked = document.querySelectorAll(`#cities-${tabName} input[type="checkbox"]:checked`);
  const disable = checked.length > 1;
  const isDownloadAllDesa = document.getElementById(`download-all-desa-${tabName}`)?.checked;
  const isDownloadAllKec = document.getElementById(`download-all-kec-${tabName}`)?.checked;
  const hideKecDesa = disable || isDownloadAllDesa || isDownloadAllKec;

  // Sembunyikan group kecamatan jika lebih dari 1 kab dipilih atau opsi semua dicentang
  const kecGroup = document.getElementById(`kecamatan-group-${tabName}`);
  if (kecGroup) kecGroup.style.display = hideKecDesa ? 'none' : '';
  // Sembunyikan desa selector jika lebih dari 1 kab dipilih atau opsi semua dicentang
  const desaSelector = document.getElementById(`desa-selector-${tabName}`);
  if (desaSelector) desaSelector.style.display = hideKecDesa ? 'none' : '';
  // Tampilkan opsi download semua desa jika minimal 1 kab dipilih
  const downloadAllGroup = document.getElementById(`download-all-group-${tabName}`);
  if (downloadAllGroup) downloadAllGroup.style.display = checked.length >= 1 ? 'flex' : 'none';

  updateDownloadAllDesaCount(tabName);
  updateDownloadAllKecCount(tabName);

  // Disable RW dan Sasaran
  const idsToDisable = tabName === 'tahunan'
    ? ['rw-tahunan', 'sasaran-tahunan']
    : ['tahun'];
  idsToDisable.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = disable;
  });
  // Jenis laporan tetap enabled
  const jenisLaporanId = tabName === 'tahunan' ? 'jenis-laporan-tahunan' : 'jenis-laporan-bulanan';
  const jenisLaporanEl = document.getElementById(jenisLaporanId);
  if (jenisLaporanEl) jenisLaporanEl.disabled = false;
}

function updateDownloadAllDesaCount(tabName) {
  const countEl = document.getElementById(`download-all-desa-count-${tabName}`);
  const checkbox = document.getElementById(`download-all-desa-${tabName}`);
  const groupEl = document.getElementById(`download-all-group-${tabName}`);
  if (!countEl || !checkbox || !groupEl) return;

  if (groupEl.style.display === 'none' || !checkbox.checked) {
    countEl.style.display = 'none';
    return;
  }

  const selectedCities = Array.from(document.querySelectorAll(`#cities-${tabName} input[type="checkbox"]:checked`)).map(cb => cb.value);

  let totalDesa = 0;
  selectedCities.forEach(cityId => {
    const kabNum = Number(cityId);
    const allKecForCity = kecamatanData[cityId] || [];
    allKecForCity.forEach(kec => {
      const kecName = (kec.split(' - ')[1] || '').trim();
      if (Array.isArray(wilayahData)) {
        wilayahData.forEach(entry => {
          const kodeKabObj = entry['KODE KABUPATEN'];
          const kodeKab = kodeKabObj && typeof kodeKabObj === 'object' ? Object.values(kodeKabObj)[0] : kodeKabObj;
          const namaKec = (entry['NAMA KECAMATAN'] || '').toString().trim();
          if (Number(kodeKab) === kabNum && namaKec.toLowerCase() === kecName.toLowerCase()) {
            totalDesa++;
          }
        });
      }
    });
  });

  countEl.textContent = `(Estimasi: ${totalDesa} desa/faskes akan didownload)`;
  countEl.style.display = 'block';
}

function updateDownloadAllKecCount(tabName) {
  const countEl = document.getElementById(`download-all-kec-count-${tabName}`);
  const checkbox = document.getElementById(`download-all-kec-${tabName}`);
  const groupEl = document.getElementById(`download-all-group-${tabName}`);
  if (!countEl || !checkbox || !groupEl) return;

  if (groupEl.style.display === 'none' || !checkbox.checked) {
    countEl.style.display = 'none';
    return;
  }

  const selectedCities = Array.from(document.querySelectorAll(`#cities-${tabName} input[type="checkbox"]:checked`)).map(cb => cb.value);

  let totalKec = 0;
  selectedCities.forEach(cityId => {
    const allKecForCity = kecamatanData[cityId] || [];
    totalKec += allKecForCity.length;
  });

  countEl.textContent = `(Estimasi: ${totalKec} kecamatan akan didownload)`;
  countEl.style.display = 'block';
}

// Inisialisasi event listener untuk checkbox download-all-desa dan download-all-kec
['tahunan', 'bulanan'].forEach(tabName => {
  const cbDesa = document.getElementById(`download-all-desa-${tabName}`);
  const cbKec = document.getElementById(`download-all-kec-${tabName}`);

  if (cbDesa && cbKec) {
    cbDesa.addEventListener('change', () => {
      if (cbDesa.checked) cbKec.checked = false; // Mutually exclusive
      handleDisableInputs(tabName);
    });

    cbKec.addEventListener('change', () => {
      if (cbKec.checked) cbDesa.checked = false; // Mutually exclusive
      handleDisableInputs(tabName);
    });
  }
});

// Tampilkan/sembunyikan group kecamatan berdasarkan kab/kota yang dipilih
function updateKecamatanDropdown(tabName) {
  const checkboxes = document.querySelectorAll(`#cities-${tabName} input[type="checkbox"]:checked`);
  const selectedCities = Array.from(checkboxes).map(cb => cb.value);

  const kecGroup = document.getElementById(`kecamatan-group-${tabName}`);
  const kecCheckboxContainer = document.getElementById(`kecamatan-checkboxes-${tabName}`);
  const kecInput = document.getElementById(`kecamatan-${tabName}`);

  if (selectedCities.length === 1) {
    // Tampilkan group kecamatan dan render checkboxes
    if (kecGroup) kecGroup.style.display = '';
    renderKecamatanCheckboxes(tabName, selectedCities[0]);
  } else {
    // Sembunyikan group kecamatan, reset semua state
    if (kecGroup) kecGroup.style.display = 'none';
    if (kecCheckboxContainer) kecCheckboxContainer.innerHTML = '';
    if (kecInput) kecInput.value = '';
    // Reset desa/faskes selector
    const desaSelector = document.getElementById(`desa-selector-${tabName}`);
    if (desaSelector) { desaSelector.style.display = 'none'; }
    const checkboxesDiv = document.getElementById(`desa-checkboxes-${tabName}`);
    if (checkboxesDiv) checkboxesDiv.innerHTML = '';
  }
}

// Render checkboxes kecamatan untuk kab tertentu
function renderKecamatanCheckboxes(tabName, kabId) {
  const container = document.getElementById(`kecamatan-checkboxes-${tabName}`);
  if (!container) return;
  // Simpan pilihan sebelumnya
  const prevSelected = new Set(getSelectedKecamatan(tabName));
  container.innerHTML = '';
  const kecList = kecamatanData[kabId] || [];
  kecList.forEach((kec, idx) => {
    const item = document.createElement('div');
    item.className = 'checkbox-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = `kec-${tabName}-${idx}`;
    cb.value = kec;
    if (prevSelected.has(kec)) cb.checked = true;
    const lbl = document.createElement('label');
    lbl.htmlFor = `kec-${tabName}-${idx}`;
    lbl.textContent = kec;
    item.appendChild(cb);
    item.appendChild(lbl);
    container.appendChild(item);
    cb.addEventListener('change', () => { onKecamatanSelectionChange(tabName, kabId); saveUserPrefs(); });
  });
  // Pasang tombol Pilih Semua / Reset kecamatan
  const selectAllBtn = document.getElementById(`select-all-kecamatan-${tabName}`);
  const resetBtn = document.getElementById(`reset-kecamatan-${tabName}`);
  if (selectAllBtn) {
    selectAllBtn.onclick = () => {
      container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
      onKecamatanSelectionChange(tabName, kabId);
    };
  }
  if (resetBtn) {
    resetBtn.onclick = () => {
      container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
      onKecamatanSelectionChange(tabName, kabId);
    };
  }
  // Terapkan state berdasarkan pilihan saat ini
  onKecamatanSelectionChange(tabName, kabId);
}

// Kembalikan array kecamatan yang dipilih
function getSelectedKecamatan(tabName) {
  const checkboxes = document.querySelectorAll(`#kecamatan-checkboxes-${tabName} input[type="checkbox"]:checked`);
  return Array.from(checkboxes).map(cb => cb.value);
}

// Tangani perubahan pilihan kecamatan: update hidden input + visibilitas desa
function onKecamatanSelectionChange(tabName, kabId) {
  const selected = getSelectedKecamatan(tabName);
  const kecInput = document.getElementById(`kecamatan-${tabName}`);
  if (kecInput) kecInput.value = selected.length >= 1 ? selected[0] : '';

  if (selected.length === 0) {
    const selectorDiv = document.getElementById(`desa-selector-${tabName}`);
    if (selectorDiv) selectorDiv.style.display = 'none';
  } else {
    renderListDesaFaskes(tabName);
  }
}

// Inisialisasi city checkbox
renderCheckboxes('cities-tahunan', 'tahunan');
renderCheckboxes('cities-bulanan', 'bulanan');

// Helper: render daftar desa/faskes checkbox — mendukung multi-kecamatan
function renderListDesaFaskes(tabName) {
  const selectorDiv = document.getElementById(`desa-selector-${tabName}`);
  const checkboxesDiv = document.getElementById(`desa-checkboxes-${tabName}`);
  const countEl = document.getElementById(tabName === 'tahunan' ? 'desa-count-tahunan' : 'faskes-count-bulanan');
  const searchInput = document.getElementById(`desa-search-${tabName}`);

  checkboxesDiv.innerHTML = '';
  if (searchInput) searchInput.value = '';

  const checked = document.querySelectorAll(`#cities-${tabName} input[type="checkbox"]:checked`);
  if (checked.length !== 1) { selectorDiv.style.display = 'none'; return; }
  const kabId = checked[0].value;

  let selectedKec = getSelectedKecamatan(tabName);
  if (selectedKec.length === 0) {
    const kecVal = document.getElementById(`kecamatan-${tabName}`).value;
    if (!kecVal) { selectorDiv.style.display = 'none'; return; }
    selectedKec = [kecVal];
  }

  let list = [];
  if (Array.isArray(wilayahData)) {
    const kabNum = Number(kabId);
    selectedKec.forEach(kec => {
      const kecName = (kec.split(' - ')[1] || '').trim();
      wilayahData
        .filter(entry => {
          const kodeKabObj = entry['KODE KABUPATEN'];
          const kodeKab = kodeKabObj && typeof kodeKabObj === 'object' ? Object.values(kodeKabObj)[0] : kodeKabObj;
          const namaKec = (entry['NAMA KECAMATAN'] || '').toString().trim();
          return Number(kodeKab) === kabNum && namaKec.toLowerCase() === kecName.toLowerCase();
        })
        .forEach(entry => list.push({ kec, desa: `${entry['KODE DESA']} - ${entry['NAMA DESA']}` }));
    });
  }

  if (list.length > 0) {
    selectorDiv.style.display = 'block';
    list.forEach(({ kec, desa }, idx) => {
      const item = document.createElement('div');
      item.className = 'checkbox-item';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = `desa-${tabName}-${idx}`;
      cb.value = desa;
      cb.dataset.kec = kec;
      cb.dataset.desa = desa.toLowerCase();
      cb.addEventListener('change', () => syncDesaToUrl(tabName));

      const lbl = document.createElement('label');
      lbl.htmlFor = `desa-${tabName}-${idx}`;
      lbl.textContent = desa;
      lbl.title = `${desa} (${kec})`;

      item.appendChild(cb);
      item.appendChild(lbl);
      checkboxesDiv.appendChild(item);
    });

    if (countEl) {
      countEl.textContent = `0 dari ${list.length} dipilih`;
      countEl.style.display = 'block';
    }

    const selectAllBtn = document.getElementById(`select-all-desa-${tabName}`);
    const resetBtn = document.getElementById(`reset-desa-${tabName}`);
    if (selectAllBtn) {
      selectAllBtn.onclick = () => {
        checkboxesDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        syncDesaToUrl(tabName);
      };
    }
    if (resetBtn) {
      resetBtn.onclick = () => {
        checkboxesDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        syncDesaToUrl(tabName);
      };
    }

    setupDesaSearch(tabName, checkboxesDiv, list.length);
    setupDragSelectDesa(checkboxesDiv, tabName);
  } else {
    selectorDiv.style.display = 'none';
    if (countEl) countEl.style.display = 'none';
  }
}

function setupDesaSearch(tabName, checkboxesDiv, totalCount) {
  const searchInput = document.getElementById(`desa-search-${tabName}`);
  if (!searchInput) return;
  searchInput.oninput = () => {
    const query = searchInput.value.toLowerCase().trim();
    const items = checkboxesDiv.querySelectorAll('.checkbox-item');
    let visibleCount = 0;
    items.forEach(item => {
      const cb = item.querySelector('input[type="checkbox"]');
      const desaName = cb ? cb.dataset.desa || '' : '';
      const match = !query || desaName.includes(query);
      if (match) {
        item.classList.remove('desa-filtered');
        visibleCount++;
      } else {
        item.classList.add('desa-filtered');
      }
    });
  };
}

function setupDragSelectDesa(container, tabName) {
  let isDragging = false;
  let wasDragging = false;
  let dragCheckState = null;
  let startCb = null;

  container.addEventListener('mousedown', e => {
    const item = e.target.closest('.checkbox-item');
    if (!item) return;
    const cb = item.querySelector('input[type="checkbox"]');
    if (!cb) return;
    startCb = cb;
    isDragging = false;
    wasDragging = false;
    dragCheckState = !cb.checked;
  });

  container.addEventListener('mousemove', e => {
    if (!startCb || !(e.buttons & 1)) { startCb = null; return; }
    const item = e.target.closest('.checkbox-item');
    if (!item) return;
    const cb = item.querySelector('input[type="checkbox"]');
    if (!cb) return;

    if (!isDragging) {
      isDragging = true;
      wasDragging = true;
      if (startCb.checked !== dragCheckState) {
        startCb.checked = dragCheckState;
        syncDesaToUrl(tabName);
      }
    }

    if (cb !== startCb && cb.checked !== dragCheckState) {
      cb.checked = dragCheckState;
      syncDesaToUrl(tabName);
    }
    e.preventDefault();
  });

  container.addEventListener('click', e => {
    if (wasDragging) {
      e.preventDefault();
      e.stopPropagation();
    }
    isDragging = false;
    wasDragging = false;
    startCb = null;
    dragCheckState = null;
  }, true);

  document.addEventListener('mouseup', () => {
    isDragging = false;
    startCb = null;
  });
}

function syncDesaToUrl(tabName) {
  const checkboxesDiv = document.getElementById(`desa-checkboxes-${tabName}`);
  const countEl = document.getElementById(tabName === 'tahunan' ? 'desa-count-tahunan' : 'faskes-count-bulanan');
  const checked = checkboxesDiv.querySelectorAll('input[type="checkbox"]:checked');
  const total = checkboxesDiv.querySelectorAll('input[type="checkbox"]').length;
  if (countEl) {
    countEl.textContent = `${checked.length} dari ${total} dipilih`;
    countEl.style.color = checked.length === 0 ? '#a00' : '#555';
  }
  saveUserPrefs();
}

function preventScrollPropagation(el) {
  if (!el) return;
  el.addEventListener('wheel', (e) => {
    const { scrollTop, scrollHeight, clientHeight } = el;
    const atTop = scrollTop === 0;
    const atBottom = scrollTop + clientHeight >= scrollHeight;
    if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) {
      e.preventDefault();
    }
  }, { passive: false });
}

['tahunan', 'bulanan'].forEach(tab => {
  preventScrollPropagation(document.getElementById(`desa-checkboxes-${tab}`));
  preventScrollPropagation(document.getElementById(`kecamatan-checkboxes-${tab}`));
  preventScrollPropagation(document.getElementById(`tabel-checkboxes-${tab}`));
});

function getSelectedDesaFaskes(tabName) {
  const checkboxesDiv = document.getElementById(`desa-checkboxes-${tabName}`);
  const checkboxes = checkboxesDiv.querySelectorAll('input[type="checkbox"]:checked');
  return Array.from(checkboxes).map(cb => ({ desa: cb.value, kec: cb.dataset.kec || '' }));
}



// Render daftar kecamatan dari kecamatanData berdasarkan kab/kota terpilih
function renderKecamatanList(tabName) {
  const listContainer = document.getElementById(`list-kecamatan-${tabName}`);
  if (!listContainer) return;
  const checked = document.querySelectorAll(`#cities-${tabName} input[type="checkbox"]:checked`);
  if (checked.length !== 1) {
    listContainer.innerHTML = '<div style="color:#a00;">Pilih tepat satu kab/kota terlebih dahulu.</div>';
    listContainer.style.display = 'block';
    return;
  }
  const kabId = checked[0].value;
  const kecList = kecamatanData[kabId] || [];
  if (kecList.length > 0) {
    listContainer.innerHTML = kecList.map(item => `<div>${item}</div>`).join('');
    listContainer.style.display = 'block';
  } else {
    listContainer.innerHTML = '<div style="color:#a00;">Data kecamatan tidak tersedia.</div>';
    listContainer.style.display = 'block';
  }
}

// Event handler untuk checkbox Semua Kecamatan
function setKecamatanInputVisibility(tabName, visible) {
  const input = document.getElementById(`kecamatan-${tabName}`);
  const select = document.getElementById(`kecamatan-select-${tabName}`);
  if (!visible) {
    if (input) input.style.display = 'none';
    if (select) select.style.display = 'none';
  } else {
    // Restore: show select if it exists (1 kab selected), otherwise show text input
    if (select) {
      select.style.display = 'block';
      if (input) input.style.display = 'none';
    } else {
      if (input) input.style.display = 'block';
    }
  }
}



// Tab switching
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const tabName = button.getAttribute('data-tab');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    button.classList.add('active');
    document.getElementById(`${tabName}-content`).classList.add('active');
  });
});

// Select All functionality
function setupSelectAll(buttonId, tabName) {
  document.getElementById(buttonId).addEventListener('click', () => {
    const checkboxes = document.querySelectorAll(`#cities-${tabName} input[type="checkbox"]`);
    checkboxes.forEach(checkbox => {
      checkbox.checked = true;
      // Trigger change event to update UI
      checkbox.dispatchEvent(new Event('change'));
    });
  });
}

// Hitung jumlah URL valid per textarea dan tampilkan
function updateUrlCount(tabName) {
  const textarea = document.getElementById(`urls-${tabName}`);
  const counterEl = document.getElementById(`url-count-${tabName}`);
  if (!textarea || !counterEl) return;

  const raw = textarea.value;
  const urls = raw
    .split(/[\n\s]+/)
    .map(u => u.trim())
    .filter(u => u && (u.startsWith('http://') || u.startsWith('https://')));

  counterEl.textContent = `${urls.length} URL valid`;
  counterEl.style.color = urls.length === 0 ? '#a00' : '#555';
}

function bindUrlCountListeners(tabName) {
  const textarea = document.getElementById(`urls-${tabName}`);
  if (!textarea) return;
  ['input', 'change', 'keyup', 'paste'].forEach(evt => {
    textarea.addEventListener(evt, () => updateUrlCount(tabName));
  });
}

// Fungsi untuk render Download Tab
function renderDownloadTab() {

  chrome.storage.local.get(null, function (data) {
    console.log("Rendering entries:", Object.keys(data)
      .filter(k => k.startsWith('tabdownload_')));
    const entries = Object.keys(data)
      .filter(k => k.startsWith('tabdownload_'))
      .map(k => data[k])
      .sort((a, b) => (a.urlIndex || 0) - (b.urlIndex || 0));

    let blocks = entries.map((item, i) => {
      let statClass = "downloading", statText = "Progress";
      if (item.status === "success") { statClass = "success"; statText = "Berhasil"; }
      if (item.status === "fail") { statClass = "fail"; statText = "GAGAL"; }
      if (item.status === "progress") { statClass = "downloading"; statText = "Progress"; }

      let progress = item.totalFiles > 0 ? Math.round((item.filesCompleted / item.totalFiles) * 100) : 0;
      let fileTerakhir = item.fileAkhir ? `File terakhir : ${item.fileAkhir}` : '';
      let placeLabel = '';
      if (item.kecamatan) placeLabel += `Kecamatan: ${item.kecamatan}`;
      if (item.desa) placeLabel += (placeLabel ? ' | ' : '') + `Desa: ${item.desa}`;
      else if (item.faskes) placeLabel += (placeLabel ? ' | ' : '') + `Desa/Faskes: ${item.faskes}`;

      // Progress bar dengan warna dinamis
      let progressColor = statClass === "success" ? "#18af34" : statClass === "fail" ? "#e12121" : "#484dde";

      // Tombol aksi berdasarkan status
      let actionButtons = '';
      if (statClass === "fail") {
        actionButtons = `
          <button class="retry-btn" data-url="${item.url}" style="background:#ff9800; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px;">
            🔄 Retry Failed
          </button>
        `;
      } else if (statClass === "downloading") {
        actionButtons = `
          <button class="retry-progress-btn" data-url="${item.url}" style="background:#ff9800; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px; margin-right:6px;">
            🔄 Retry
          </button>
          <button class="cancel-btn" data-url="${item.url}" style="background:#e12121; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px;">
            ✖ Cancel & Close Tab
          </button>
        `;
      }

      return `
        <div class="download-section">
          <div class="progress-url">URL ${i + 1}: ${item.url || "-"}</div>
          
          <!-- Progress Bar -->
          <div style="background:#eee; border-radius:8px; height:20px; margin:8px 0; position:relative; overflow:hidden;">
            <div style="background:${progressColor}; height:100%; width:${progress}%; transition: width 0.3s;"></div>
            <div style="position:absolute; top:0; left:0; right:0; bottom:0; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:bold; color:#000;">${progress}%</div>
          </div>
          
          <div class="progress-status ${statClass}">Status: ${statText}</div>
          <div class="progress-file">${fileTerakhir}</div>
          <div class="progress-place">${placeLabel}</div>
          <div style="margin-top:10px;">${actionButtons}</div>
        </div>
      `;
    });
    document.getElementById("download-progress-list").innerHTML = blocks.length > 0 ? blocks.join("\n") : "<p>Tidak ada proses download.</p>";

    // Attach event listeners untuk tombol Retry (fail) dan Retry (progress) dan Cancel
    document.querySelectorAll('.retry-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const url = this.getAttribute('data-url');
        handleRetryFailedItems(url);
      });
    });

    document.querySelectorAll('.retry-progress-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const url = this.getAttribute('data-url');
        handleRetryProgressItem(url);
      });
    });

    document.querySelectorAll('.cancel-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const url = this.getAttribute('data-url');
        handleCancelAndCloseTab(url);
      });
    });
  });
}

// Handler untuk retry item yang gagal
function handleRetryFailedItems(url) {
  if (!confirm(`Retry semua item yang gagal untuk URL:\n${url}?`)) return;

  chrome.storage.local.get(null, function (data) {
    // Cari semua auto_* keys untuk URL ini
    const autoKeys = Object.keys(data).filter(k => k.startsWith('auto_'));

    for (const key of autoKeys) {
      const autoData = data[key];
      if (autoData && autoData.downloadQueue) {
        const firstItem = autoData.downloadQueue[0];
        if (firstItem && firstItem.url === url) {
          // Cari index item pertama yang gagal
          const failedItems = autoData.downloadQueue
            .map((item, idx) => ({ item, idx }))
            .filter(({ item, idx }) => {
              // Cek di storage apakah item ini gagal (cari semua tabdownload_ yang cocok)
              const itemHash = safeUrlHash(item.url);
              const progressKeys = Object.keys(data).filter(k => k.startsWith(`tabdownload_${itemHash}`));
              return progressKeys.some(pk => data[pk] && data[pk].status === 'fail');
            });

          if (failedItems.length > 0) {
            // Set currentIndex ke item gagal pertama dan reset retry
            const firstFailedIdx = failedItems[0].idx;
            chrome.storage.local.set({
              [key]: {
                ...autoData,
                currentIndex: firstFailedIdx,
                retryCount: 0
              }
            }, () => {
              // Reset status fail items ke progress (untuk semua matching keys)
              failedItems.forEach(({ item }) => {
                const itemHash = safeUrlHash(item.url);
                const progressKeys = Object.keys(data).filter(k => k.startsWith(`tabdownload_${itemHash}`));
                progressKeys.forEach(pk => {
                  if (data[pk]) {
                    chrome.storage.local.set({
                      [pk]: {
                        ...data[pk],
                        status: 'progress',
                        fileAkhir: item.kota || 'Retry...'
                      }
                    });
                  }
                });
              });

              // Kirim pesan ke background untuk reload tab
              chrome.runtime.sendMessage({
                action: 'retryFailedUrl',
                url: url,
                targetKey: key
              });

              alert(`♻️ Retry dimulai untuk ${failedItems.length} item yang gagal.`);
              setTimeout(() => renderDownloadTab(), 500);
            });
            break;
          } else {
            alert('Tidak ada item yang gagal untuk URL ini.');
          }
          break;
        }
      }
    }
  });
}

// Handler untuk cancel dan close tab
function handleCancelAndCloseTab(url) {
  if (!confirm(`Cancel proses dan tutup tab untuk URL:\n${url}?`)) return;
  const urlHash = safeUrlHash(url);
  // Update all matching tabdownload_* keys to fail, then request background to cancel tabs
  chrome.storage.local.get(null, result => {
    const matching = Object.keys(result).filter(k => k.startsWith(`tabdownload_${urlHash}`));
    if (matching.length > 0) {
      matching.forEach(k => {
        const val = result[k];
        chrome.storage.local.set({ [k]: { ...val, status: 'fail', fileAkhir: 'Cancelled by user' } });
      });
      // Minta background lakukan cancel & tutup tab
      chrome.runtime.sendMessage({ action: 'cancelUrl', url }, resp => {
        alert('✅ Proses dibatalkan. Menutup tab...');
        setTimeout(() => renderDownloadTab(), 800);
      });
    } else {
      // Tetap kirim cancel agar tab ditutup walau progress entry belum ada
      chrome.runtime.sendMessage({ action: 'cancelUrl', url }, resp => {
        alert('✅ Proses dibatalkan.');
        setTimeout(() => renderDownloadTab(), 800);
      });
    }
  });
}

// Handler untuk retry item yang masih berstatus PROGRESS (stuck/macet)
function handleRetryProgressItem(url) {
  if (!confirm(`Retry proses yang sedang berjalan (PROGRESS) untuk URL:\n${url}?\n\nIni akan mereload tab yang sedang berjalan dari posisi saat ini.`)) return;

  chrome.storage.local.get(null, function (data) {
    const autoKeys = Object.keys(data).filter(k => k.startsWith('auto_'));
    let found = false;

    for (const key of autoKeys) {
      const autoData = data[key];
      if (!autoData || !autoData.downloadQueue) continue;

      // Cek apakah auto_ ini milik URL yang di-retry
      const firstItem = autoData.downloadQueue[0];
      if (!firstItem || firstItem.url !== url) continue;

      found = true;
      // Reset retryCount dan cancelled agar dapat berjalan kembali
      chrome.storage.local.set({
        [key]: {
          ...autoData,
          cancelled: false,
          retryCount: 0
        }
      }, () => {
        // Kirim pesan ke background untuk reload tab
        chrome.runtime.sendMessage({
          action: 'retryFailedUrl',
          url: url,
          targetKey: key
        }, resp => {
          if (resp && resp.success) {
            alert('🔄 Tab sedang di-reload. Proses akan dilanjutkan dari posisi terakhir.');
          } else {
            alert('⚠️ Tidak bisa me-reload tab. Tab mungkin sudah tertutup. Coba Cancel lalu jalankan ulang.');
          }
          setTimeout(() => renderDownloadTab(), 800);
        });
      });
      break;
    }

    if (!found) {
      // Cari dataSingle dari tabdownload_ untuk membuka tab baru jika tab sudah ditutup
      const urlHash = safeUrlHash(url);
      const tabKey = Object.keys(data).find(k => k.startsWith(`tabdownload_${urlHash}`));

      if (tabKey && data[tabKey] && data[tabKey].dataSingle) {
        chrome.runtime.sendMessage({ action: 'processData', data: data[tabKey].dataSingle });
        chrome.storage.local.set({ [tabKey]: { ...data[tabKey], status: 'progress', fileAkhir: 'Retry (Tab Baru)...' } });
        alert('🔄 Membuka tab baru untuk melanjutkan proses yang tertutup.');
        setTimeout(() => renderDownloadTab(), 500);
      } else {
        alert('Tab untuk URL ini tidak ditemukan dan data state lama tidak lengkap.\nSilakan Cancel lalu jalankan ulang dari form awal.');
      }
    }
  });
}

// Helper untuk menyimpan dataSingle ke tabdownload_ agar bisa di-retry meski tab sudah ditutup
function saveRetryState(key, dataSingle) {
  if (!key || !dataSingle) return;
  chrome.storage.local.get([key], res => {
    if (res[key]) {
      chrome.storage.local.set({ [key]: { ...res[key], dataSingle } });
    }
  });
}

// Handler untuk retry semua item gagal dan/atau masih progress
function handleRetryAll() {
  chrome.storage.local.get(null, function (data) {
    // Retry item yang GAGAL (fail) atau yang masih BERJALAN (progress) karena mungkin stuck
    const failedKeys = new Set(
      Object.keys(data)
        .filter(k => k.startsWith('tabdownload_') && (data[k].status === 'fail' || data[k].status === 'progress'))
    );

    if (failedKeys.size === 0) {
      alert('Tidak ada item yang gagal (error) atau stuck untuk di-retry.');
      return;
    }

    if (!confirm(`Retry ${failedKeys.size} item yang GAGAL atau masih PROGRESS?\n\nSemua item dengan status error atau masih berjalan akan di-restart.`)) return;

    let retryCount = 0;
    const handledFailedKeys = new Set();
    const batchQueue = [];

    // 1. Retry yang masih ada auto_ state (tab masih aktif)
    const autoKeys = Object.keys(data).filter(k => k.startsWith('auto_'));
    autoKeys.forEach(autoKey => {
      const autoData = data[autoKey];
      if (!autoData || !autoData.downloadQueue || autoData.downloadQueue.length === 0) return;

      const queue = autoData.downloadQueue;
      const progressKey = autoData.progressKey;

      // Cek apakah auto_ ini punya progress yang fail/progress
      const isFailedByProgressKey = progressKey && failedKeys.has(progressKey);
      const isFailedByHashSearch = !isFailedByProgressKey && queue.some(item => {
        const itemHash = safeUrlHash(item.url);
        return [...failedKeys].some(k => k.startsWith(`tabdownload_${itemHash}`));
      });

      if (!isFailedByProgressKey && !isFailedByHashSearch) return;

      const pk = isFailedByProgressKey ? progressKey
        : [...failedKeys].find(k => k.startsWith(`tabdownload_${safeUrlHash(queue[0]?.url || '')}`));

      if (pk) handledFailedKeys.add(pk);

      const currentRetryCount = (autoData.retryCount || 0);
      if (currentRetryCount >= 5) {
        console.warn(`[retry] Lewati ${autoKey} — sudah di-retry ${currentRetryCount}x`);
        return;
      }

      // Ambil dataSingle dari pk, atau reconstruct dari autoData
      let dataSingle = pk && data[pk] ? data[pk].dataSingle : null;
      if (!dataSingle) {
        dataSingle = {
          downloadQueue: queue,
          periode: autoData.periode,
          selectedCities: autoData.selectedCities,
          kecamatan: autoData.kecamatan,
          jenisLaporan: autoData.jenisLaporan,
          faskes: autoData.faskes,
          tahun: autoData.tahun,
          desa: autoData.desa,
          rw: autoData.rw,
          sasaran: autoData.sasaran,
          menu: autoData.menu,
          submenu: autoData.submenu,
          progressKey: pk,
          openDelay: autoData.openDelay
        };
      }

      if (dataSingle) {
        batchQueue.push(dataSingle);
        retryCount++;
        if (pk && data[pk]) {
          chrome.storage.local.set({ [pk]: { ...data[pk], status: 'progress', fileAkhir: 'Retry (Batch)...' } });
        }
      }

      // Hapus auto_ key and close tab so they don't become zombies
      chrome.storage.local.remove(autoKey);
      const tabId = parseInt(autoKey.replace('auto_', ''), 10);
      if (tabId) chrome.tabs.remove(tabId).catch(() => { });
    });

    // 2. Retry yang tab-nya sudah ditutup (menggunakan dataSingle yang disimpan)
    failedKeys.forEach(pk => {
      if (!handledFailedKeys.has(pk)) {
        const item = data[pk];
        if (item && item.dataSingle) {
          batchQueue.push(item.dataSingle);
          retryCount++;
          chrome.storage.local.set({ [pk]: { ...item, status: 'progress', fileAkhir: 'Retry (Batch)...' } });
        }
      }
    });

    if (batchQueue.length > 0) {
      // Ambil batch size dari input di UI jika ada, atau default ke 5
      const batchSizeInput = document.getElementById('batch-size');
      const batchSize = batchSizeInput ? parseInt(batchSizeInput.value, 10) || 5 : 5;

      chrome.runtime.sendMessage({
        action: 'startBatchDownload',
        batchQueue: batchQueue,
        batchSize: batchSize
      });
      alert(`♻️ Retry batch dimulai untuk ${batchQueue.length} item.`);
    } else {
      alert('Tidak ada item yang dapat di-retry (kemungkinan tab sudah tertutup dan ini adalah sesi lama).');
    }
    setTimeout(() => renderDownloadTab(), 500);
  });
}

// Handler untuk memverifikasi apakah file yang sudah selesai benar-benar ada di komputer
async function handleVerifyDownloads() {
  const btn = document.getElementById('verify-downloads-btn');
  if (!confirm("Fitur ini akan mengecek apakah file yang berstatus 'Berhasil' masih benar-benar ada di folder laptop Anda (berdasarkan riwayat Chrome Downloads). File yang tidak ditemukan akan diubah menjadi 'GAGAL (Hilang)'. Lanjutkan?")) return;
  
  btn.textContent = "🔍 Sedang Verifikasi...";
  btn.disabled = true;

  try {
    const data = await new Promise(resolve => chrome.storage.local.get(null, resolve));
    const successKeys = Object.keys(data).filter(k => k.startsWith('tabdownload_') && data[k].status === 'success');
    
    if (successKeys.length === 0) {
      alert("Tidak ada antrean file dengan status 'Berhasil' untuk diverifikasi.");
      return;
    }

    const downloads = await new Promise(resolve => {
      chrome.downloads.search({ state: 'complete' }, resolve);
    });

    const downloadedFiles = downloads.map(d => {
      return String(d.filename || d.url).replace(/[:\\/\"?~<>*|]/g, "-").replace(/\s+/g, "_").trim().toLowerCase();
    });

    let verifiedCount = 0;
    let missingCount = 0;
    const updates = {};

    for (const key of successKeys) {
      const item = data[key];
      const rawPlace = item.desa || item.faskes || item.kecamatan || item.kota || item.fileAkhir || '';
      
      // Ambil semua kata alfanumerik dari nama tempat
      const words = String(rawPlace).toLowerCase().split(/[^a-z0-9]+/g).filter(w => w.length > 0);
      
      // Jika mode tabel, ambil nama tabel dari URL agar file dengan lokasi yang sama bisa dibedakan
      const urlParts = String(item.url).toLowerCase().split(/[^a-z0-9]+/g).filter(w => w.length > 0);
      const tabelWords = urlParts.filter(w => w.startsWith('tabel'));
      
      const matchWords = [...words, ...tabelWords];

      let found = false;
      if (matchWords.length > 0) {
        // Harus mengandung SEMUA kata kunci (lokasi + nama tabel jika ada)
        found = downloadedFiles.some(f => matchWords.every(w => f.includes(w)));
      } else {
        found = true; // Fallback
      }

      if (!found) {
        updates[key] = { ...item, status: 'fail', fileAkhir: item.fileAkhir + ' (Hilang/Belum Terdownload)' };
        missingCount++;
      } else {
        verifiedCount++;
      }
    }

    if (missingCount > 0) {
      await new Promise(resolve => chrome.storage.local.set(updates, resolve));
      alert(`⚠️ Verifikasi Selesai!\n- Ditemukan (Aman): ${verifiedCount} file\n- Hilang/Tidak Ada: ${missingCount} file\n\n[Info Debug: File di History Chrome: ${downloads.length}]\n\nSilakan klik tombol "Retry Semua Gagal" untuk mendownload ulang file yang hilang.`);
      renderDownloadTab();
    } else {
      alert(`✅ Verifikasi Selesai!\nSemua ${verifiedCount} file berhasil terdeteksi utuh di folder laptop Anda.\n[Info Debug: File di History Chrome: ${downloads.length}]`);
    }
  } catch (error) {
    console.error("Error verifying downloads:", error);
    alert("Terjadi kesalahan saat memverifikasi: " + error.message);
  } finally {
    btn.textContent = "🔍 Verifikasi File";
    btn.disabled = false;
  }
}

// Handler untuk membersihkan entry yang sudah selesai (success)
function handleClearDone() {
  chrome.storage.local.get(null, function (data) {
    const doneKeys = Object.keys(data)
      .filter(k => k.startsWith('tabdownload_') && data[k].status === 'success');
    if (doneKeys.length === 0) {
      alert('Tidak ada item yang sudah selesai untuk dibersihkan.');
      return;
    }
    chrome.storage.local.remove(doneKeys, () => renderDownloadTab());
  });
}

// Handler untuk stop semua download yang sedang berjalan
function handleStopAllDownloads() {
  if (!confirm('Apakah Anda yakin ingin membatalkan semua proses download yang sedang berjalan (termasuk antrean batch)?')) return;
  chrome.runtime.sendMessage({ action: 'cancelAllDownloads' }, (resp) => {
    alert('✅ Semua proses download telah dibatalkan.');
    setTimeout(() => renderDownloadTab(), 500);
  });
}

// Handler untuk reload semua tab SIGA yang terbuka
function handleReloadSigaTabs() {
  chrome.tabs.query({ url: "*://newsiga-siga.kemendukbangga.go.id/*" }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      alert('Tidak ada tab SIGA yang sedang terbuka.');
      return;
    }
    if (confirm(`Apakah Anda yakin ingin me-reload ${tabs.length} tab SIGA?`)) {
      tabs.forEach(tab => {
        chrome.tabs.reload(tab.id);
      });
      alert(`✅ ${tabs.length} tab SIGA berhasil di-reload.`);
    }
  });
}

function resetDownloadProgress(callback) {
  chrome.storage.local.get(null, function (data) {
    let keysToDelete = [];
    Object.keys(data).forEach(key => {
      if (key.startsWith('tabdownload_')) keysToDelete.push(key);
    });
    chrome.storage.local.remove(keysToDelete, () => {
      // Kosongkan UI
      document.getElementById('download-progress-list').innerHTML = "<p>Memulai proses download...</p>";
      if (callback) callback();
    });
  });
}

function switchToDownloadTab() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  // Set semua tab jadi inactive
  tabButtons.forEach(btn => btn.classList.remove('active'));
  tabContents.forEach(content => content.classList.remove('active'));

  // Aktifkan tab Download
  document.querySelector('[data-tab="download"]').classList.add('active');
  document.getElementById('download-content').classList.add('active');

  // Render progress awal
  renderDownloadTab();
}

function initializeDownloadProgress(downloadQueue) {
  return new Promise(resolve => {
    const toSet = {};
    // Satu entry progress per item di queue (1 tab per item — mode paralel)
    const keys = [];
    let idxCounter = 0;
    downloadQueue.forEach((item, i) => {
      const urlHash = safeUrlHash(item.url);
      const key = `tabdownload_${urlHash}_${i}_${Date.now()}`;
      keys.push(key);
      const firstFile = item.kota || item.desa || "Memulai...";
      toSet[key] = {
        url: item.url,
        status: "progress",
        totalFiles: 1,
        filesCompleted: 0,
        fileAkhir: firstFile,
        urlIndex: idxCounter++,
        kota: item.kota || '',
        kecamatan: item.kecamatan || '',
        desa: item.desa || '',
        faskes: item.faskes || ''
      };
    });
    chrome.storage.local.set(toSet, () => {
      if (chrome.runtime.lastError) {
        console.error("Storage error:", chrome.runtime.lastError);
        alert("Gagal menyimpan progress! " + chrome.runtime.lastError.message);
      }
      renderDownloadTab();
      resolve(keys);
    });
  });
}

// Tab switching untuk tab Download
tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const tabName = button.getAttribute('data-tab');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    button.classList.add('active');
    document.getElementById(`${tabName}-content`).classList.add('active');

    // Jika tab download diklik, render progress
    if (tabName === 'download') renderDownloadTab();
    saveUserPrefs();
  });
});

// Tombol Retry Semua & Bersihkan Selesai di tab Download
document.getElementById('retry-all-btn')?.addEventListener('click', handleRetryAll);
document.getElementById('verify-downloads-btn')?.addEventListener('click', handleVerifyDownloads);
document.getElementById('clear-done-btn')?.addEventListener('click', handleClearDone);
document.getElementById('stop-all-btn')?.addEventListener('click', handleStopAllDownloads);
document.getElementById('reload-siga-tabs-btn')?.addEventListener('click', handleReloadSigaTabs);

setupSelectAll('select-all-tahunan', 'tahunan');
setupSelectAll('select-all-bulanan', 'bulanan');

// Bind URL counter listeners
bindUrlCountListeners('tahunan');
bindUrlCountListeners('bulanan');
// Initial count display
updateUrlCount('tahunan');
updateUrlCount('bulanan');

// Reset functionality
function setupReset(buttonId, tabName) {
  document.getElementById(buttonId).addEventListener('click', () => {
    const checkboxes = document.querySelectorAll(`#cities-${tabName} input[type="checkbox"]`);
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change'));
    });
  });
}
setupReset('reset-tahunan', 'tahunan');
setupReset('reset-bulanan', 'bulanan');

// ──────────────────────────────────────────────────────────
// MONITORING K0 — Mode Kecamatan
// ──────────────────────────────────────────────────────────

/**
 * Build queue berisi semua kecamatan dari satu kabupaten.
 * Setiap entry: { id, name, kabId, kabName, isKecamatan: true }
 */
function buildKecamatanQueue(kabId) {
  const kabCity = cities.find(c => c.id === kabId);
  const kecList = kecamatanData[kabId] || [];
  return kecList.map((kecName, idx) => ({
    id: `${kabId}-${idx}`,
    name: kecName,       // contoh: "04 - SEULIMEUM"
    kabId,
    kabName: kabCity ? kabCity.name : kabId,
    isKecamatan: true
  }));
}

// BKB monitoring panel utilities
function setBkbMonitoringStatus(message) {
  const el = document.getElementById('monitoring-k0-status');
  if (el) el.textContent = `Status: ${message}`;
}

function generateBkbMonitoringOutput(results) {
  if (!results || results.length === 0) return '';

  const header = ['Kota/Kabupaten', 'Total', 'Update', 'Belum'];
  const lines = results.map(item => {
    const total = item.total != null ? item.total : '';
    const update = item.update != null ? item.update : '';
    const belum = item.belum != null ? item.belum : '';
    return `${item.kota}\t${total}\t${update}\t${belum}`;
  });

  return [header.join('\t'), ...lines].join('\n');
}

function renderBkbMonitoringResults(results) {
  const el = document.getElementById('monitoring-k0-results');
  const outEl = document.getElementById('monitoring-k0-output');
  if (!el) return;
  if (!results || results.length === 0) {
    el.textContent = 'Belum ada data.';
    if (outEl) outEl.value = '';
    return;
  }

  el.textContent = results.map(item => {
    return `${item.kota} -> Total: ${item.total} | Update: ${item.update} | Belum: ${item.belum}`;
  }).join('\n');

  if (outEl) outEl.value = generateBkbMonitoringOutput(results);
}

function setupBkbMonitoring() {
  const startBtn = document.getElementById('start-monitoring-k0');
  const resetBtn = document.getElementById('reset-monitoring-k0');
  const kabGroup = document.getElementById('monitoring-kab-group');
  const kabSelect = document.getElementById('monitoring-kab');
  const kecInfo = document.getElementById('monitoring-kec-info');
  const modeProvRadio = document.getElementById('monitoring-mode-prov');
  const modeKecRadio = document.getElementById('monitoring-mode-kec');
  const modeBatchRadio = document.getElementById('monitoring-mode-batch');
  const batchGroup = document.getElementById('monitoring-batch-group');
  const batchProgressEl = document.getElementById('monitoring-batch-progress');

  let lastActiveKabId = null;

  // ── Populate dropdown kabupaten dari array cities ──

  if (kabSelect) {
    kabSelect.innerHTML = '';
    cities.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      kabSelect.appendChild(opt);
    });
  }

  // ── Update info jumlah kecamatan saat kabupaten dipilih ──
  function updateKecInfo() {
    if (!kecInfo || !kabSelect) return;
    const kabId = kabSelect.value;
    const count = (kecamatanData[kabId] || []).length;
    kecInfo.textContent = count > 0
      ? `✔ ${count} kecamatan akan dimonitor`
      : '⚠ Data kecamatan tidak tersedia untuk kabupaten ini';
    kecInfo.style.color = count > 0 ? '#2a7a2a' : '#a00';
  }

  if (kabSelect) {
    kabSelect.addEventListener('change', () => { updateKecInfo(); saveUserPrefs(); });
    updateKecInfo();
  }

  // ── Toggle panel sesuai mode ──
  function onModeChange() {
    const isKec = modeKecRadio && modeKecRadio.checked;
    const isBatch = modeBatchRadio && modeBatchRadio.checked;
    if (kabGroup) kabGroup.style.display = isKec ? 'block' : 'none';
    if (batchGroup) batchGroup.style.display = isBatch ? 'block' : 'none';
    if (isKec) updateKecInfo();
    saveUserPrefs();
  }

  if (modeProvRadio) modeProvRadio.addEventListener('change', onModeChange);
  if (modeKecRadio) modeKecRadio.addEventListener('change', onModeChange);
  if (modeBatchRadio) modeBatchRadio.addEventListener('change', onModeChange);

  // ── Render progress batch per kabupaten (baca dari plan) ──
  function renderBatchProgress(batchData) {
    const listEl = document.getElementById('monitoring-batch-progress-list');
    if (!listEl || !batchData) return;

    const plan = batchData.plan || [];
    const rows = plan.map(p => {
      const total = (p.queue || []).length;
      const done = (p.results || []).length;
      const status = p.status || 'pending';
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      const statusIcon = status === 'done' ? '✅' : status === 'active' ? '⏳' : '⏸';
      const barFill = status === 'done' ? '#18af34' : status === 'active' ? '#484dde' : '#ccc';
      const activeAttr = status === 'active' ? 'id="batch-progress-active"' : '';
      return `
        <div ${activeAttr} style="margin-bottom:6px; padding: 2px 4px; border-radius: 4px; ${status === 'active' ? 'background: rgba(72, 77, 222, 0.08);' : ''}">
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;">
            <span>${statusIcon} <strong>${p.kabName}</strong></span>
            <span>${done}/${total} kec</span>
          </div>
          <div style="background:#e0e0e0;border-radius:4px;height:8px;overflow:hidden;">
            <div style="background:${barFill};height:100%;width:${pct}%;transition:width 0.3s;"></div>
          </div>
        </div>`;
    });

    listEl.innerHTML = rows.join('');
    if (batchProgressEl) batchProgressEl.style.display = 'block';

    // Auto scroll kabupaten yang aktif ke dalam view HANYA saat berganti kabupaten (agar tidak mengganggu scroll manual user)
    const activeItem = plan.find(p => p.status === 'active');
    if (activeItem && activeItem.kabId !== lastActiveKabId) {
      lastActiveKabId = activeItem.kabId;
      const activeEl = document.getElementById('batch-progress-active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }


  // ── refreshStatus: poll bkbMonitoring (single-tab) + bkbMonitoringBatch (sequential) ──
  const refreshStatus = async () => {
    chrome.storage.local.get(null, (all) => {
      const batch = all.bkbMonitoringBatch || null;
      if (batch && Array.isArray(batch.plan) && batch.plan.length > 0) {
        const plan = batch.plan;

        // Overlay data live dari SEMUA tab paralel (bkbMonitoringKec_<tabId>) secara bebas write-collision
        const activeKecKeys = Object.keys(all).filter(k => k.startsWith('bkbMonitoringKec_'));

        // Buat map kabId -> tabState paling baru
        const kabMap = {};
        activeKecKeys.forEach(k => {
          const tabState = all[k];
          if (tabState && tabState.kabId) {
            const existing = kabMap[tabState.kabId];
            if (!existing || (tabState.lastUpdated || 0) > (existing.lastUpdated || 0)) {
              kabMap[tabState.kabId] = tabState;
            }
          }
        });

        // Sinkronkan plan item secara dinamis dari map tabState
        plan.forEach(p => {
          const tabState = kabMap[p.kabId];
          if (tabState) {
            p.results = tabState.results || [];
            p.currentIndex = tabState.currentIndex || 0;
            p.status = tabState.mode === 'done' ? 'done' : 'active';
          } else {
            p.status = 'pending';
          }
        });

        renderBatchProgress(batch);

        const doneCount = plan.filter(p => p.status === 'done').length;
        const activeItems = plan.filter(p => p.status === 'active');
        const pendingItems = plan.filter(p => p.status === 'pending');

        let statusText = `Batch: ${doneCount}/${plan.length} selesai`;
        if (activeItems.length > 0) {
          statusText += ` (${activeItems.length} aktif)`;
        }
        if (pendingItems.length > 0) {
          statusText += ` [Menunggu: ${pendingItems.length}]`;
        }
        setBkbMonitoringStatus(statusText);
        if (startBtn) startBtn.disabled = doneCount < plan.length;

        // Update textarea dan preview secara REAL-TIME agar user tidak perlu menunggu semua selesai
        const tsvLines = ['Kabupaten\tKecamatan\tTotal\tUpdate\tBelum'];
        const previewLines = [];
        plan.forEach(p => {
          (p.results || []).forEach(r => {
            tsvLines.push(`${p.kabName}\t${r.kota}\t${r.total ?? ''}\t${r.update ?? ''}\t${r.belum ?? ''}`);
            previewLines.push(`${p.kabName} / ${r.kota} → Total: ${r.total} | Update: ${r.update} | Belum: ${r.belum}`);
          });
        });

        const outEl = document.getElementById('monitoring-k0-output');
        const resEl = document.getElementById('monitoring-k0-results');
        if (outEl && tsvLines.length > 1) {
          outEl.value = tsvLines.join('\n');
        } else if (outEl && tsvLines.length === 1) {
          outEl.value = ''; // Kosongkan jika belum ada data
        }

        if (resEl && previewLines.length > 0) {
          resEl.textContent = previewLines.join('\n').slice(0, 1000) + (previewLines.length > 40 ? '\n...' : '');
        } else if (resEl) {
          resEl.textContent = 'Belum ada data.';
        }
        return;
      }

      // Poll single-tab monitoring
      const st = all.bkbMonitoring || null;
      if (!st) {
        setBkbMonitoringStatus('Menunggu');
        renderBkbMonitoringResults([]);
        if (startBtn) startBtn.disabled = false;
        return;
      }
      const { mode, currentIndex, queue, results } = st;
      const isKecMode = queue && queue.length > 0 && queue[0].isKecamatan;
      const unitLabel = isKecMode ? 'kecamatan' : 'kabupaten';
      if (mode === 'active') {
        const kabLabel = isKecMode && queue[0].kabName ? ` (${queue[0].kabName})` : '';
        setBkbMonitoringStatus(`Berjalan: ${currentIndex || 0}/${(queue || []).length} ${unitLabel}${kabLabel}`);
        if (startBtn) startBtn.disabled = true;
      } else if (mode === 'done') {
        setBkbMonitoringStatus(`Selesai: ${results ? results.length : 0} ${unitLabel}`);
        if (startBtn) startBtn.disabled = false;
      } else {
        setBkbMonitoringStatus('Menunggu');
        if (startBtn) startBtn.disabled = false;
      }
      renderBkbMonitoringResults(results || []);
    });
  };

  // ── Fungsi batch: sequential (1 tab aktif, chain ke tab berikutnya) ──
  async function startBatchKecMonitoring(targetRoute, initialWaitMs, loopWaitMs) {
    setBkbMonitoringStatus('Menyiapkan batch parallel queue...');

    const plan = cities
      .filter(c => (kecamatanData[c.id] || []).length > 0)
      .map((kab, i) => ({
        planIndex: i,
        kabId: kab.id,
        kabName: kab.name,
        queue: buildKecamatanQueue(kab.id),
        status: 'pending',
        currentIndex: 0,
        results: []
      }));

    if (plan.length === 0) {
      setBkbMonitoringStatus('Tidak ada data kecamatan tersedia.');
      if (startBtn) startBtn.disabled = false;
      return;
    }

    // Langsung aktifkan semua kabupaten untuk dibuka secara bersamaan
    const initialTabsCount = plan.length;

    const batchMeta = {
      plan, targetRoute, initialWaitMs, loopWaitMs,
      startedAt: Date.now()
    };

    for (let i = 0; i < initialTabsCount; i++) {
      plan[i].status = 'active';
    }
    batchMeta.plan = plan;
    await new Promise(r => chrome.storage.local.set({ bkbMonitoringBatch: batchMeta }, r));

    // Kirim pesan ke background script untuk membuka SEMUA tab kabupaten secara staggered
    // agar browser tidak macet tetapi langsung memproses semuanya secara simultan.
    chrome.runtime.sendMessage({
      action: 'startBatchAutomation',
      initialTabsCount
    });

    setBkbMonitoringStatus(`Batch: Membuka ${plan.length} kabupaten sekaligus...`);
    if (startBtn) startBtn.disabled = true;
  }


  // ── Tombol Mulai ──
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      setBkbMonitoringStatus('Menyiapkan...');
      if (startBtn) startBtn.disabled = true;

      const targetRoute = document.getElementById('monitoring-target')?.value || '#/kegiatan/kelompok_bkb';
      const initialWaitSeconds = Number(document.getElementById('monitoring-initial-wait')?.value || 30);
      const loopWaitSeconds = Number(document.getElementById('monitoring-loop-wait')?.value || 8);
      const initialWaitMs = Math.max(1000, initialWaitSeconds * 1000);
      const loopWaitMs = Math.max(1000, loopWaitSeconds * 1000);

      const isBatchMode = modeBatchRadio && modeBatchRadio.checked;
      const isKecMode = modeKecRadio && modeKecRadio.checked;

      // ── Mode Paralel Batch ──
      if (isBatchMode) {
        await startBatchKecMonitoring(targetRoute, initialWaitMs, loopWaitMs);
        return;
      }

      // ── Mode single-tab (Provinsi / Per Kecamatan) ──
      let queue;
      if (isKecMode) {
        const kabId = kabSelect ? kabSelect.value : null;
        if (!kabId || (kecamatanData[kabId] || []).length === 0) {
          alert('⚠ Data kecamatan tidak tersedia untuk kabupaten yang dipilih.');
          if (startBtn) startBtn.disabled = false;
          setBkbMonitoringStatus('Menunggu');
          return;
        }
        queue = buildKecamatanQueue(kabId);
      } else {
        queue = cities.map(c => ({ id: c.id, name: c.name, isKecamatan: false }));
      }

      chrome.storage.local.set({
        bkbMonitoring: {
          mode: 'waiting',
          phase: 'init',
          monitorTabId: null,
          targetRoute,
          initialWaitMs,
          loopWaitMs,
          currentIndex: 0,
          queue,
          results: [],
          lastUpdated: Date.now()
        }
      }, () => {
        chrome.tabs.create({ url: `https://newsiga-siga.kemendukbangga.go.id/${targetRoute}`, active: true }, (tab) => {
          if (!tab || !tab.id) {
            alert('Gagal membuka tab monitoring; coba lagi.');
            setBkbMonitoringStatus('Error membuka tab.');
            if (startBtn) startBtn.disabled = false;
            return;
          }
          chrome.storage.local.get(['bkbMonitoring'], (existing) => {
            const targetRouteFromState = existing?.bkbMonitoring?.targetRoute || '#/kegiatan/kelompok_bkb';
            const initialWaitMsFromState = existing?.bkbMonitoring?.initialWaitMs || initialWaitMs;
            const loopWaitMsFromState = existing?.bkbMonitoring?.loopWaitMs || loopWaitMs;
            chrome.storage.local.set({
              bkbMonitoring: {
                mode: 'active',
                phase: 'init',
                monitorTabId: tab.id,
                targetRoute: targetRouteFromState,
                initialWaitMs: initialWaitMsFromState,
                loopWaitMs: loopWaitMsFromState,
                currentIndex: 0,
                queue,
                results: [],
                lastUpdated: Date.now()
              }
            }, () => {
              setBkbMonitoringStatus('Tab monitoring sudah dibuka. Menunggu data…');
            });
          });
        });
      });
    });
  }

  // ── Salin hasil single-tab ──
  const copyBtn = document.getElementById('copy-bkb-result');
  const copyNote = document.getElementById('copy-bkb-result-note');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const outEl = document.getElementById('monitoring-k0-output');
      if (!outEl || !outEl.value || outEl.value.trim() === '') {
        if (copyNote) copyNote.textContent = 'Tidak ada data untuk disalin.';
        return;
      }
      outEl.select();
      document.execCommand('copy');
      if (copyNote) copyNote.textContent = 'Tersalin! Tempel (paste) ke Excel/dokumen lain.';
      setTimeout(() => { if (copyNote) copyNote.textContent = ''; }, 2500);
    });
  }

  // ── Salin semua hasil batch ──
  const copyBatchBtn = document.getElementById('copy-batch-result');
  const copyBatchNote = document.getElementById('copy-batch-note');
  if (copyBatchBtn) {
    copyBatchBtn.addEventListener('click', () => {
      // Coba baca dari textarea yang sudah diisi refreshStatus (paling reliable)
      const outEl = document.getElementById('monitoring-k0-output');
      if (outEl && outEl.value && outEl.value.trim() !== '') {
        outEl.select();
        document.execCommand('copy');
        if (copyBatchNote) copyBatchNote.textContent = `Tersalin! (${outEl.value.split('\n').length - 1} baris data)`;
        setTimeout(() => { if (copyBatchNote) copyBatchNote.textContent = ''; }, 3000);
        return;
      }

      // Fallback: rebuild dari storage jika textarea belum terisi
      chrome.storage.local.get(null, (all) => {
        const batch = all.bkbMonitoringBatch;
        if (!batch || !batch.tabs || batch.tabs.length === 0) {
          if (copyBatchNote) copyBatchNote.textContent = '⚠ Belum ada data batch.';
          return;
        }
        const lines = ['Kabupaten\tKecamatan\tTotal\tUpdate\tBelum'];
        batch.tabs.forEach(t => {
          const st = all[`bkbMonitoringKec_${t.tabId}`];
          if (!st || !Array.isArray(st.results)) return;
          st.results.forEach(r => {
            lines.push(`${t.kabName}\t${r.kota}\t${r.total ?? ''}\t${r.update ?? ''}\t${r.belum ?? ''}`);
          });
        });
        if (lines.length <= 1) {
          if (copyBatchNote) copyBatchNote.textContent = '⚠ Hasil kosong, coba tunggu sebentar.';
          return;
        }
        const tsv = lines.join('\n');
        // Isi textarea dulu, lalu copy
        if (outEl) {
          outEl.value = tsv;
          outEl.select();
          document.execCommand('copy');
          if (copyBatchNote) copyBatchNote.textContent = `Tersalin! (${lines.length - 1} baris data)`;
          setTimeout(() => { if (copyBatchNote) copyBatchNote.textContent = ''; }, 3000);
        }
      });
    });
  }

  // ── Reset batch ──
  const resetBatchBtn = document.getElementById('reset-batch-btn');
  if (resetBatchBtn) {
    resetBatchBtn.addEventListener('click', () => {
      chrome.storage.local.get(null, (all) => {
        const keysToRemove = ['bkbMonitoringBatch'];
        Object.keys(all).forEach(k => {
          if (k.startsWith('bkbMonitoringKec_')) {
            keysToRemove.push(k);
          }
        });
        chrome.storage.local.remove(keysToRemove, () => {
          if (batchProgressEl) batchProgressEl.style.display = 'none';
          setBkbMonitoringStatus('Batch direset. Tekan Mulai.');
          if (startBtn) startBtn.disabled = false;
        });
      });
    });
  }

  // ── Reset single-tab monitoring ──
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      chrome.storage.local.remove('bkbMonitoring', () => {
        setBkbMonitoringStatus('Direset. Tekan Mulai.');
        renderBkbMonitoringResults([]);
        if (startBtn) startBtn.disabled = false;
        if (modeProvRadio) { modeProvRadio.checked = true; onModeChange(); }
      });
    });
  }

  // Simpan preferensi saat setting berubah
  ['monitoring-target', 'monitoring-initial-wait', 'monitoring-loop-wait'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', saveUserPrefs);
  });

  setInterval(refreshStatus, 1200);
  refreshStatus();
}

setupBkbMonitoring();

// Form submit handlers

function extractNumericCode(label) {
  if (!label) return '';
  const m = label.toString().trim().match(/^(\d+)/);
  return m ? m[1] : '';
}

function setupFormSubmit(formId, tabName) {
  document.getElementById(formId).addEventListener('submit', (e) => {
    e.preventDefault();

    try {
      // Reset rename context queue before run
      chrome.storage.local.set({
        renameQueue: [],
        pendingRenameList: [],
        renameContext: null,
        renameEnabled: false
      });

      // Parse URLs - pisahkan dengan newline atau space, lalu filter yang valid
      const urlsRaw = document.getElementById(`urls-${tabName}`).value;
      const urls = urlsRaw
        .split(/[\n\s]+/) // Split by newline atau space (satu atau lebih)
        .map(u => u.trim())
        .filter(u => u && (u.startsWith('http://') || u.startsWith('https://'))); // Filter hanya URL valid

      if (urls.length === 0) {
        alert('⚠️ Tidak ada URL yang valid. Pastikan URL dimulai dengan http:// atau https://');
        return;
      }

      const openDelaySec = (() => {
        const enableId = `enable-open-delay-${tabName}`;
        const delayId = `open-delay-${tabName}`;
        const enabled = document.getElementById(enableId)?.checked;
        if (enabled === false) return 0;
        const el = document.getElementById(delayId);
        return el ? (parseInt(el.value, 10) || 5) : 5;
      })();

      const periode = document.getElementById(`periode-${tabName}`).value;

      // Validasi: bulan wajib dipilih untuk tab bulanan
      if (tabName === 'bulanan' && !periode) {
        alert('⚠️ Pilih bulan terlebih dahulu sebelum menjalankan download!');
        document.getElementById('periode-bulanan').focus();
        return;
      }
      const kecamatan = document.getElementById(`kecamatan-${tabName}`).value;
      const jenisLaporanField = document.getElementById(`jenis-laporan-${tabName}`);
      let jenisLaporan = jenisLaporanField ? jenisLaporanField.value : '';

      if (jenisLaporanField) {
        const jenisLaporanGroup = jenisLaporanField.closest('.form-group');
        if (jenisLaporanGroup && jenisLaporanGroup.style.display === 'none') {
          jenisLaporan = '';
        }
      }

      const checkboxes = document.querySelectorAll(`#cities-${tabName} input[type="checkbox"]:checked`);
      const selectedCities = Array.from(checkboxes).map(cb => cb.value);

      // Dapatkan nama kota dari mapping cities
      const cityNameMap = {};
      cities.forEach(city => { cityNameMap[city.id] = city.name; });

      // Buat queue: tiap baris URL + nama kota + desa/faskes jika dipilih dari checkbox
      let queue = [];
      const selectedKecamatan = getSelectedKecamatan(tabName);
      let selectedDesaFaskes = getSelectedDesaFaskes(tabName);
      let hasDesaSelected = selectedDesaFaskes.length > 0;

      const isDownloadAllDesa = document.getElementById(`download-all-desa-${tabName}`)?.checked;
      const isDownloadAllKecamatan = document.getElementById(`download-all-kec-${tabName}`)?.checked;

      if (isDownloadAllKecamatan && selectedCities.length >= 1) {
        selectedCities.forEach(cityId => {
          const allKecForCity = kecamatanData[cityId] || [];
          allKecForCity.forEach(kec => {
            urls.forEach(url => {
              queue.push({ kota: cityNameMap[cityId], url, kecamatan: kec, kabCode: cityId });
            });
          });
        });
      } else if (isDownloadAllDesa && selectedCities.length >= 1) {
        selectedCities.forEach(cityId => {
          const kabNum = Number(cityId);
          const allKecForCity = kecamatanData[cityId] || [];
          allKecForCity.forEach(kec => {
            const kecName = (kec.split(' - ')[1] || '').trim();
            const desaForKec = [];
            if (Array.isArray(wilayahData)) {
              wilayahData.forEach(entry => {
                const kodeKabObj = entry['KODE KABUPATEN'];
                const kodeKab = kodeKabObj && typeof kodeKabObj === 'object' ? Object.values(kodeKabObj)[0] : kodeKabObj;
                const namaKec = (entry['NAMA KECAMATAN'] || '').toString().trim();
                if (Number(kodeKab) === kabNum && namaKec.toLowerCase() === kecName.toLowerCase()) {
                  desaForKec.push(`${entry['KODE DESA']} - ${entry['NAMA DESA']}`);
                }
              });
            }
            if (desaForKec.length > 0) {
              urls.forEach(url => {
                desaForKec.forEach(desaStr => {
                  if (tabName === 'tahunan') {
                    queue.push({ kota: cityNameMap[cityId], url, kecamatan: kec, desa: desaStr, kabCode: cityId });
                  } else {
                    queue.push({ kota: cityNameMap[cityId], url, kecamatan: kec, faskes: desaStr, kabCode: cityId });
                  }
                });
              });
            }
          });
        });
      } else if (selectedCities.length > 1) {
        // Banyak kab/kota: setiap kab/kota x url = tab terpisah
        selectedCities.forEach(cityId => {
          urls.forEach(url => {
            queue.push({ kota: cityNameMap[cityId], url, kabCode: cityId });
          });
        });
      } else if (selectedCities.length === 1 && selectedKecamatan.length > 1 && hasDesaSelected) {
        // Satu kab/kota, banyak kecamatan + pilih desa → tab per desa per kecamatan
        const kabId = selectedCities[0];
        if (tabName === 'tahunan') {
          const uniqueDesa = selectedDesaFaskes.filter((item, idx, arr) =>
            arr.findIndex(d => d.desa === item.desa && d.kec === item.kec) === idx);
          if (uniqueDesa.length === 0) {
            alert('⚠️ Daftar desa kosong. Pilih kecamatan dan kabupaten yang benar.');
            return;
          }
          urls.forEach(url => {
            uniqueDesa.forEach(({ desa, kec }) => {
              queue.push({ kota: cityNameMap[kabId], url, kecamatan: kec, desa, kabCode: kabId });
            });
          });
        } else {
          const uniqueFaskes = selectedDesaFaskes.filter((item, idx, arr) =>
            arr.findIndex(f => f.desa === item.desa && f.kec === item.kec) === idx);
          if (uniqueFaskes.length === 0) {
            alert('⚠️ Daftar faskes kosong. Pilih kecamatan dan kabupaten yang benar.');
            return;
          }
          urls.forEach(url => {
            uniqueFaskes.forEach(({ desa: faskes, kec }) => {
              queue.push({ kota: cityNameMap[kabId], url, kecamatan: kec, faskes });
            });
          });
        }
      } else if (selectedCities.length === 1 && selectedKecamatan.length > 1) {
        // Satu kab/kota, banyak kecamatan, tanpa pilih desa → tab per kecamatan
        const kabId = selectedCities[0];
        urls.forEach(url => {
          selectedKecamatan.forEach(kec => {
            queue.push({ kota: cityNameMap[kabId], url, kecamatan: kec, kabCode: kabId });
          });
        });
      } else if (selectedCities.length === 1 && hasDesaSelected) {
        // Satu kab/kota, pilih desa/faskes: setiap desa/faskes = tab terpisah
        const uniqueItems = selectedDesaFaskes.filter((item, idx, arr) =>
          arr.findIndex(d => d.desa === item.desa && d.kec === item.kec) === idx);
        if (uniqueItems.length === 0) {
          alert('⚠️ Daftar desa/faskes kosong. Pilih kecamatan dan kabupaten yang benar.');
          return;
        }
        urls.forEach(url => {
          uniqueItems.forEach(({ desa, kec }) => {
            if (tabName === 'tahunan') {
              queue.push({ kota: cityNameMap[selectedCities[0]], url, kecamatan: kec, desa, kabCode: selectedCities[0] });
            } else {
              queue.push({ kota: cityNameMap[selectedCities[0]], url, kecamatan: kec, faskes: desa, kabCode: selectedCities[0] });
            }
          });
        });
      } else {
        // Default: satu input manual saja
        if (selectedCities.length === 0) {
          if (tabName === 'tahunan') {
            urls.forEach(url => {
              queue.push({ kota: '', url, periode });
            });
          } else {
            const tahunEl = document.getElementById('tahun');
            const tahun = tahunEl ? tahunEl.value : '';
            urls.forEach(url => {
              queue.push({ kota: '', url, periode, tahun });
            });
          }
        } else {
          selectedCities.forEach(cityId => {
            urls.forEach(url => {
              queue.push({ kota: cityNameMap[cityId], url });
            });
          });
        }
      }

      // Tambahkan sasaran/catin/baduta/bumil/pascapersalin dan renameContext untuk setiap item
      queue = queue.map(item => {
        const sasaran = item.sasaran || detectSasaranFromUrl(item.url);
        const itemKabCode = item.kabCode || extractNumericCode(item.kota || '') || (selectedCities.length === 1 ? selectedCities[0] : '');
        const itemKecamatan = item.kecamatan || kecamatan;
        const kecCode = extractNumericCode(itemKecamatan);
        const desaCode = extractNumericCode(item.desa || '');

        let payload = {
          menu: activeMenuId,
          submenu: activeSubmenuId,
          periode,
          kab: (item.kota || '').toString().replace(/^\d+\s*-\s*/, '').trim(),
          kotaAsli: item.kota || '',
          kabCode: itemKabCode,
          kec: itemKecamatan,
          kecCode,
          jenisLaporan,
          desaCode,
          sasaran: sasaran,
          folderMode: document.querySelector(`input[name="folder-mode-${tabName}"]:checked`)?.value || 'kab',
          tabelName: (urlTableData[tabName] && urlTableData[tabName][activeSubmenuId] && urlTableData[tabName][activeSubmenuId].find(e => e.url === item.url)) ? urlTableData[tabName][activeSubmenuId].find(e => e.url === item.url).nama : '',
          isBatchKabupaten: queue.length > 1 && (document.querySelector(`input[name="folder-mode-${tabName}"]:checked`)?.value === 'kab' || document.querySelector(`input[name="folder-mode-${tabName}"]:checked`)?.value === undefined)
        };

        if (tabName === 'bulanan') {
          payload.tahun = document.getElementById('tahun').value;
          payload.faskes = item.faskes || '';
        } else {
          payload.desa = item.desa || '';
          payload.rw = document.getElementById('rw-tahunan').value;
        }

        return {
          ...item,
          sasaran,
          renameContext: payload
        };
      });

      // Jika mode banyak desa/faskes, kirim ke background satu per tab (bukan satu queue besar)
      // DEBUG LOG: tampilkan queue sebelum dikirim ke background
      console.log('[DEBUG][popup] Queue to background:', queue);

      if ((selectedCities.length === 1 && (selectedKecamatan.length > 1 || hasDesaSelected || isDownloadAllKecamatan || isDownloadAllDesa)) || selectedCities.length > 1) {
        // Cek mode eksekusi
        const modeEksekusi = document.getElementById(`mode-eksekusi-${tabName}`)?.value || 'batch';
        const batchSize = parseInt(document.getElementById(`batch-size-${tabName}`)?.value || '10', 10);

        if (modeEksekusi === 'batch') {
          console.log('[DEBUG][popup] Menggunakan mode Batch dengan ukuran:', batchSize);
          resetDownloadProgress(() => {
            switchToDownloadTab();
            initializeDownloadProgress(queue).then(keys => {
              const fullBatchQueue = [];
              queue.forEach((item, idx) => {
                const itemKabCode = item.kabCode || extractNumericCode(item.kota || '') || (selectedCities.length === 1 ? selectedCities[0] : '');
                const itemKecamatan = item.kecamatan || kecamatan;
                const kecCode = extractNumericCode(itemKecamatan);
                const desaCode = extractNumericCode(item.desa || '');

                const dataSingle = {
                  tab: tabName,
                  submenu: activeSubmenuId,
                  periode,
                  kecamatan: itemKecamatan,
                  jenisLaporan,
                  selectedCities,
                  downloadQueue: [item],
                  urls,
                  progressKey: keys[idx],
                  openDelay: openDelaySec
                };

                let payload = {
                  menu: activeMenuId,
                  submenu: activeSubmenuId,
                  periode,
                  kab: (item.kota || '').toString().replace(/^\d+\s*-\s*/, '').trim(),
                  kotaAsli: item.kota || '',
                  kabCode: itemKabCode,
                  kec: itemKecamatan,
                  kecCode,
                  jenisLaporan,
                  desaCode,
                  sasaran: item.sasaran || detectSasaranFromUrl(item.url),
                  folderMode: document.querySelector(`input[name="folder-mode-${tabName}"]:checked`)?.value || 'kab',
                  tabelName: (urlTableData[tabName] && urlTableData[tabName][activeSubmenuId] && urlTableData[tabName][activeSubmenuId].find(e => e.url === item.url)) ? urlTableData[tabName][activeSubmenuId].find(e => e.url === item.url).nama : '',
                  isBatchKabupaten: queue.length > 1 && (document.querySelector(`input[name="folder-mode-${tabName}"]:checked`)?.value === 'kab' || document.querySelector(`input[name="folder-mode-${tabName}"]:checked`)?.value === undefined)
                };

                if (tabName === 'bulanan') {
                  dataSingle.faskes = item.faskes || '';
                  dataSingle.tahun = document.getElementById('tahun').value;
                  payload.tahun = dataSingle.tahun;
                  payload.faskes = item.faskes || '';
                  payload.sasaran = item.sasaran || detectSasaranFromUrl(item.url) || '';
                } else {
                  dataSingle.desa = item.desa || '';
                  dataSingle.rw = document.getElementById('rw-tahunan').value;
                  dataSingle.sasaran = document.getElementById('sasaran-tahunan').value;
                  payload.desa = item.desa || '';
                  payload.rw = dataSingle.rw;
                  payload.sasaran = dataSingle.sasaran || item.sasaran || detectSasaranFromUrl(item.url) || '';
                }

                // Pass the renameContext directly inside the downloadQueue item
                dataSingle.downloadQueue[0].renameContext = payload;
                saveRetryState(keys[idx], dataSingle);
                fullBatchQueue.push(dataSingle);
              });

              chrome.runtime.sendMessage({
                action: 'startBatchDownload',
                batchQueue: fullBatchQueue,
                batchSize: batchSize
              }, (response) => {
                if (response && response.success) {
                  console.log('Proses download batch dimulai...');
                } else {
                  alert('Proses gagal atau tidak ada response.');
                }
              });
            }).catch(err => {
              console.error('Gagal inisialisasi progress keys:', err);
            });
          });
          return;
        }

        // Mode Paralel (Lama)
        // Setiap item queue = 1 tab
        resetDownloadProgress(() => {
          switchToDownloadTab();
          // initialize progress entries for the per-item queue so renderDownloadTab can show them
          initializeDownloadProgress(queue).then(keys => {
            // In multi-item mode, kabCode should derive from item.kota agar 01 menjadi 7401 dalam location prefix
            queue.forEach((item, idx) => {
              const itemKabCode = item.kabCode || extractNumericCode(item.kota || '') || (selectedCities.length === 1 ? selectedCities[0] : '');
              // Data untuk 1 tab
              const singleQueue = [item];
              const itemKecamatan = item.kecamatan || kecamatan;
              const kecCode = extractNumericCode(itemKecamatan);
              const desaCode = extractNumericCode(item.desa || '');
              const dataSingle = {
                tab: tabName,
                submenu: activeSubmenuId,
                periode,
                kecamatan: itemKecamatan,
                jenisLaporan,
                selectedCities,
                downloadQueue: singleQueue,
                urls,
                openDelay: openDelaySec
              };
              let payload = {
                menu: activeMenuId,
                submenu: activeSubmenuId,
                periode,
                kab: (item.kota || '').toString().replace(/^\d+\s*-\s*/, '').trim(),
                kotaAsli: item.kota || '',
                kabCode: itemKabCode,
                kec: itemKecamatan,
                kecCode,
                jenisLaporan,
                desaCode,
                sasaran: item.sasaran || detectSasaranFromUrl(item.url),
                folderMode: document.querySelector(`input[name="folder-mode-${tabName}"]:checked`)?.value || 'kab',
                tabelName: (urlTableData[tabName] && urlTableData[tabName][activeSubmenuId] && urlTableData[tabName][activeSubmenuId].find(e => e.url === item.url)) ? urlTableData[tabName][activeSubmenuId].find(e => e.url === item.url).nama : '',
                isBatchKabupaten: queue.length > 1 && (document.querySelector(`input[name="folder-mode-${tabName}"]:checked`)?.value === 'kab' || document.querySelector(`input[name="folder-mode-${tabName}"]:checked`)?.value === undefined)
              };
              if (tabName === 'bulanan') {
                dataSingle.faskes = item.faskes || '';
                dataSingle.tahun = document.getElementById('tahun').value;
                payload.tahun = dataSingle.tahun;
                payload.faskes = item.faskes || '';
                payload.sasaran = item.sasaran || detectSasaranFromUrl(item.url) || '';
              } else {
                dataSingle.desa = item.desa || '';
                dataSingle.rw = document.getElementById('rw-tahunan').value;
                dataSingle.sasaran = document.getElementById('sasaran-tahunan').value;
                payload.desa = item.desa || '';
                payload.rw = dataSingle.rw;
                payload.sasaran = dataSingle.sasaran || item.sasaran || detectSasaranFromUrl(item.url) || '';
              }
              // attach the generated progress key so the content script can update the correct entry
              dataSingle.progressKey = keys[idx];
              dataSingle.downloadQueue[0].renameContext = payload;
              saveRetryState(keys[idx], dataSingle);
              chrome.runtime.sendMessage({ action: "setRenameContext", payload });
              chrome.runtime.sendMessage({ action: 'processData', data: dataSingle }, (response) => {
                if (response && response.success) {
                  console.log('Proses download dimulai...');
                } else {
                  alert('Proses gagal atau tidak ada response.');
                }
              });
            });
          }).catch(err => {
            console.error('Gagal inisialisasi progress keys:', err);
          });
        });
        return;
      }

      selectedDesaFaskes = getSelectedDesaFaskes(tabName);
      hasDesaSelected = selectedDesaFaskes.length > 0;

      const data = {
        tab: tabName,
        submenu: activeSubmenuId,
        periode,
        kecamatan,
        jenisLaporan,
        selectedCities,
        downloadQueue: queue,
        urls,
        openDelay: openDelaySec
      };
      if (tabName === 'bulanan') {
        data.faskes = hasDesaSelected ? '' : document.getElementById('faskes-bulanan')?.value || '';
        data.tahun = document.getElementById('tahun').value;
      } else {
        data.desa = hasDesaSelected ? '' : document.getElementById('desa-tahunan')?.value || '';
        data.rw = document.getElementById('rw-tahunan').value;
        data.sasaran = document.getElementById('sasaran-tahunan').value;
      }

      console.log('Data to be sent:', data);
      const checked = document.querySelectorAll(`#cities-${tabName} input[type="checkbox"]:checked`);
      const selectedCitiesPreview = Array.from(checked).map(cb => cb.value);

      if (hasDesaSelected && selectedCitiesPreview.length === 1) {
        const itemList = selectedDesaFaskes.map(d => d.desa);
        const preview = itemList.slice(0, 10).join('\n');
        const ok = confirm(`Anda akan mendownload ${itemList.length} item. Contoh:\n\n${preview}${itemList.length > 10 ? '\n...' : ''}\n\nLanjutkan?`);
        if (!ok) return;
      }
      // Mode eksekusi
      const modeEksekusi = document.getElementById(`mode-eksekusi-${tabName}`)?.value || 'batch';
      const batchSize = parseInt(document.getElementById(`batch-size-${tabName}`)?.value || '10', 10);

      // Reset progress lama dan pindah ke tab Download
      resetDownloadProgress(() => {
        switchToDownloadTab();

        // Inisialisasi progress awal per URL dengan 0% dan file pertama
        initializeDownloadProgress(queue).then(keys => {
          // mapping id -> nama kab
          const cityNameMap = {};
          cities.forEach(city => { cityNameMap[city.id] = city.name; });

          // ambil kab terpilih (kalau 1 saja)
          const checked = document.querySelectorAll(`#cities-${tabName} input[type="checkbox"]:checked`);
          const selectedCityIds = Array.from(checked).map(cb => cb.value);

          let kab = '';
          if (selectedCityIds.length === 1) {
            kab = cityNameMap[selectedCityIds[0]];
            // Remove code prefix
            kab = kab.replace(/^\d+\s*-\s*/, '').trim();
          } else if (selectedCityIds.length > 1) {
            // Gabungkan semua nama kabupaten, tanpa kode
            kab = selectedCityIds.map(id => cityNameMap[id].replace(/^\d+\s*-\s*/, '').trim()).join(', ');
          } else {
            kab = 'PROVINSI';
          }

          const kabCode = selectedCityIds.length === 1 ? selectedCityIds[0] : '';
          const kecValue = document.getElementById(`kecamatan-${tabName}`).value;
          const kecCode = extractNumericCode(kecValue);
          const desaValue = data.desa || '';
          const desaCode = extractNumericCode(desaValue);

          const defaultSasaran = data.sasaran || (queue[0] && queue[0].sasaran) || detectSasaranFromUrl((queue[0] && queue[0].url) || '') || '';

          const payload = {
            menu: activeMenuId,
            submenu: activeSubmenuId,
            periode: document.getElementById(`periode-${tabName}`).value,
            kab: kab,
            kabCode: kabCode,
            kec: kecValue,
            kecCode,
            jenisLaporan,
            desa: data.desa,
            desaCode,
            sasaran: defaultSasaran
          };

          data.sasaran = defaultSasaran;

          if (tabName === "bulanan") {
            payload.tahun = document.getElementById("tahun")?.value; // ambil input tahun bulanan
            payload.faskes = data.faskes;
          } else {
            payload.desa = data.desa;
            payload.rw = data.rw;
          }

          if (modeEksekusi === 'batch') {
            console.log('[DEBUG][popup] Menggunakan mode Batch dengan ukuran:', batchSize, 'untuk tabel');
            const fullBatchQueue = [];
            queue.forEach((item, idx) => {
              const dataSingle = { ...data, downloadQueue: [item], progressKey: keys[idx] };
              dataSingle.downloadQueue[0].renameContext = payload;
              saveRetryState(keys[idx], dataSingle);
              fullBatchQueue.push(dataSingle);
            });

            chrome.runtime.sendMessage({
              action: 'startBatchDownload',
              batchQueue: fullBatchQueue,
              batchSize: batchSize
            }, (response) => {
              if (response && response.success) {
                console.log('Proses download batch dimulai...');
              } else {
                alert('Proses gagal atau tidak ada response.');
              }
            });
          } else {
            // Mode Paralel (Lama)
            queue.forEach((item, idx) => {
              const dataSingle = { ...data, downloadQueue: [item], progressKey: keys[idx] };
              dataSingle.downloadQueue[0].renameContext = payload;
              saveRetryState(keys[idx], dataSingle);
            });
            chrome.runtime.sendMessage({ action: "setRenameContext", payload });
            chrome.runtime.sendMessage({ action: 'processData', data }, (response) => {
              if (response && response.success) {
                console.log('Proses download dimulai...');
              } else {
                alert('Proses gagal atau tidak ada response.');
              }
            });
          }
        }).catch(err => {
          console.error('Gagal inisialisasi progress keys:', err);
        });
      });
    } catch (error) {
      console.error('Error saat memproses form:', error);
      alert(`❌ Terjadi kesalahan: ${error.message}\n\nSilakan cek console untuk detail lebih lanjut.`);
    }
  });
}
setupFormSubmit('tahunan-form', 'tahunan');
setupFormSubmit('bulanan-form', 'bulanan');


// Listener untuk auto-refresh download tab
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "refresh_download_status") renderDownloadTab();
});

// ──────────────────────────────────────────────────────────
// MENU NAVIGATION
// ──────────────────────────────────────────────────────────

const menuConfig = {
  'laporan': {
    label: 'LAPORAN',
    submenus: [
      { id: 'yan-kb', label: 'YAN KB' },
      { id: 'dallap', label: 'DALLAP' },
      { id: 'kbs', label: 'KELUARGA BERESIKO STUNTING' },
      { id: 'elsimil', label: 'ELSIMIL' },
    ]
  },
  'rekapitulasi': {
    label: 'REKAPITULASI',
    submenus: [
      { id: 'rekap-keluarga', label: 'Rekapitulasi Data Keluarga' }
    ]
  },
  'verval-krs': {
    label: 'VERVAL KRS',
    submenus: [
      { id: 'krs-keluarga', label: 'Keluarga Risiko Stunting' },
      { id: 'monitoring-krs', label: 'Monitoring Verval KRS' }
    ]
  },
  'pendaftaran-elsimil': {
    label: 'Pendaftaran ELSIMIL',
    submenus: [
      { id: 'catin', label: 'Catin' },
      { id: 'ibu-hamil', label: 'Ibu Hamil' },
      { id: 'pascapersalinan', label: 'Pascapersalinan' },
      { id: 'baduta', label: 'Baduta' }
    ]
  },
  'monitoring-k0': {
    label: 'Monitoring K0',
    submenus: [
      { id: 'monitoring-k0', label: 'Monitoring K0' }
    ]
  }
};

// Field visibility per sub-menu id
// 'hide' = array of input/select IDs whose parent .form-group gets hidden
const fieldVisibilityConfig = {
  'yan-kb': {
    tahunan: { hide: ['rw-tahunan', 'sasaran-tahunan', 'jenis-laporan-tahunan'] },
    bulanan: { hide: ['jenis-laporan-bulanan'] }
  },
  'dallap': {
    tahunan: { hide: ['rw-tahunan', 'sasaran-tahunan', 'jenis-laporan-tahunan'] },
    bulanan: { hide: ['jenis-laporan-bulanan'] }
  },
  'kbs': {
    hideTabs: ['bulanan'],
    tahunan: { hide: ['jenis-laporan-tahunan'] }
  },
  'elsimil': {
    tahunan: { hide: ['rw-tahunan', 'sasaran-tahunan'] }
  },
  'rekap-keluarga': {
    hideTabs: ['tahunan'],
    bulanan: { hide: ['jenis-laporan-bulanan'] }
  },
  'krs-keluarga': {
    hideTabs: ['tahunan'],
    bulanan: { hide: ['jenis-laporan-bulanan'] }
  },
  'monitoring-krs': {
    hideTabs: ['tahunan'],
    bulanan: { hide: ['jenis-laporan-bulanan'] }
  },
  'catin': {
    hideTabs: ['tahunan'],
    bulanan: { hide: ['jenis-laporan-bulanan'] }
  },
  'ibu-hamil': {
    hideTabs: ['tahunan'],
    bulanan: { hide: ['jenis-laporan-bulanan'] }
  },
  'pascapersalinan': {
    hideTabs: ['tahunan'],
    bulanan: { hide: ['jenis-laporan-bulanan'] }
  },
  'baduta': {
    hideTabs: ['tahunan'],
    bulanan: { hide: ['jenis-laporan-bulanan'] }
  },
  'monitoring-k0': {
    hideTabs: ['tahunan', 'bulanan', 'download']
  }
  // additional sub-menu configs will be added here as each report type is built out
};

// All hideable field IDs across both tabs (used for reset)
const hideableTahunan = ['rw-tahunan', 'sasaran-tahunan', 'jenis-laporan-tahunan'];
const hideableBulanan = ['jenis-laporan-bulanan'];

// ──────────────────────────────────────────────────────────
// TABEL SELECTOR (checklist tabel per menu)
// ──────────────────────────────────────────────────────────

/**
 * Sinkronkan URL dari tabel yang dicentang ke textarea URL.
 */
function syncTabelToUrl(tabName) {
  const checkboxes = document.querySelectorAll(`#tabel-checkboxes-${tabName} input[type="checkbox"]:checked`);
  const urls = Array.from(checkboxes).map(cb => cb.value);
  const textarea = document.getElementById(`urls-${tabName}`);
  if (textarea) {
    textarea.value = urls.join('\n');
    updateUrlCount(tabName);
  }
  // Update counter label
  const counter = document.getElementById(`tabel-count-${tabName}`);
  if (counter) {
    const total = document.querySelectorAll(`#tabel-checkboxes-${tabName} input[type="checkbox"]`).length;
    counter.textContent = `${urls.length} dari ${total} tabel dipilih`;
    counter.style.color = urls.length === 0 ? '#a00' : '#555';
  }
  saveUserPrefs();
}

/**
 * Render checklist tabel berdasarkan submenu yang aktif.
 * Jika menu hanya 1 URL dan autoFill=true, langsung isi textarea tanpa checklist.
 */
function renderTabelSelector(tabName, submenuId) {
  const selectorDiv = document.getElementById(`tabel-selector-${tabName}`);
  const checkboxesDiv = document.getElementById(`tabel-checkboxes-${tabName}`);
  const textarea = document.getElementById(`urls-${tabName}`);
  if (!selectorDiv || !checkboxesDiv || !textarea) return;

  const entries = urlTableData[tabName] && urlTableData[tabName][submenuId];

  if (!entries || entries.length === 0) {
    selectorDiv.style.display = 'none';
    return;
  }

  // Jika semua entri adalah autoFill (single-URL), isi textarea langsung
  if (entries.every(e => e.autoFill)) {
    selectorDiv.style.display = 'none';
    textarea.value = entries.map(e => e.url).join('\n');
    updateUrlCount(tabName);
    return;
  }

  // Tampilkan checklist
  selectorDiv.style.display = 'block';
  checkboxesDiv.innerHTML = '';

  entries.forEach((entry, idx) => {
    const item = document.createElement('div');
    item.className = 'checkbox-item';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = `tabel-${tabName}-${idx}`;
    cb.value = entry.url;
    cb.addEventListener('change', () => syncTabelToUrl(tabName));

    const lbl = document.createElement('label');
    lbl.htmlFor = `tabel-${tabName}-${idx}`;
    lbl.textContent = entry.nama;
    lbl.title = entry.url;

    item.appendChild(cb);
    item.appendChild(lbl);
    checkboxesDiv.appendChild(item);
  });

  // Update counter
  const counter = document.getElementById(`tabel-count-${tabName}`);
  if (counter) counter.textContent = `0 dari ${entries.length} tabel dipilih`;

  // Pasang tombol Pilih Semua & Reset
  const selectAllBtn = document.getElementById(`select-all-tabel-${tabName}`);
  const resetBtn = document.getElementById(`reset-tabel-${tabName}`);
  if (selectAllBtn) {
    selectAllBtn.onclick = () => {
      checkboxesDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
      syncTabelToUrl(tabName);
    };
  }
  if (resetBtn) {
    resetBtn.onclick = () => {
      checkboxesDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
      syncTabelToUrl(tabName);
    };
  }

  // Aktifkan drag-to-select
  setupDragSelect(checkboxesDiv, tabName);

  // Kosongkan textarea saat checklist pertama kali muncul (agar user mulai dari kosong)
  textarea.value = '';
  updateUrlCount(tabName);
}

/**
 * Drag-to-select: tahan klik dan geser untuk select/deselect banyak checkbox sekaligus.
 * Klik biasa tetap bekerja normal.
 */
function setupDragSelect(container, tabName) {
  let isDragging = false;
  let wasDragging = false;
  let dragCheckState = null;
  let startCb = null;

  container.addEventListener('mousedown', e => {
    const item = e.target.closest('.checkbox-item');
    if (!item) return;
    const cb = item.querySelector('input[type="checkbox"]');
    if (!cb) return;
    startCb = cb;
    isDragging = false;
    wasDragging = false;
    dragCheckState = !cb.checked;
  });

  container.addEventListener('mousemove', e => {
    if (!startCb || !(e.buttons & 1)) { startCb = null; return; }
    const item = e.target.closest('.checkbox-item');
    if (!item) return;
    const cb = item.querySelector('input[type="checkbox"]');
    if (!cb) return;

    if (!isDragging) {
      isDragging = true;
      wasDragging = true;
      if (startCb.checked !== dragCheckState) {
        startCb.checked = dragCheckState;
        syncTabelToUrl(tabName);
      }
    }

    if (cb !== startCb && cb.checked !== dragCheckState) {
      cb.checked = dragCheckState;
      syncTabelToUrl(tabName);
    }
    e.preventDefault();
  });

  container.addEventListener('click', e => {
    if (wasDragging) {
      e.preventDefault();
      e.stopPropagation();
    }
    isDragging = false;
    wasDragging = false;
    startCb = null;
    dragCheckState = null;
  }, true);

  document.addEventListener('mouseup', () => {
    isDragging = false;
    startCb = null;
  });
}

function applyFieldVisibility(reportId) {
  // First restore all fields
  [...hideableTahunan, ...hideableBulanan].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const fg = el.closest('.form-group');
      if (fg) fg.style.display = '';
    }
  });

  // Restore all tabs
  ['tahunan', 'bulanan'].forEach(tab => {
    const btn = document.querySelector(`.tab-button[data-tab="${tab}"]`);
    if (btn) btn.style.display = '';
  });

  const config = fieldVisibilityConfig[reportId];

  // Hide tabs if specified
  if (config && config.hideTabs) {
    config.hideTabs.forEach(tab => {
      const btn = document.querySelector(`.tab-button[data-tab="${tab}"]`);
      if (btn) {
        btn.style.display = 'none';
        // If this hidden tab is currently active, switch to the first visible tab
        if (btn.classList.contains('active')) {
          btn.classList.remove('active');
          document.getElementById(`${tab}-content`).classList.remove('active');
        }
      }
    });

    // After hiding tabs, if no tab is active, activate the first visible one
    const anyActive = document.querySelector('.tab-button.active');
    if (!anyActive) {
      const firstVisible = document.querySelector('.tab-button:not([style*="display: none"]):not([style*="display:none"])');
      if (firstVisible) {
        firstVisible.classList.add('active');
        const firstVisibleTab = firstVisible.getAttribute('data-tab');
        const firstVisibleContent = document.getElementById(`${firstVisibleTab}-content`);
        if (firstVisibleContent) firstVisibleContent.classList.add('active');
      }
    }
  }

  // Recalculate grid columns based on visible tab buttons
  const tabsBar = document.getElementById('tabs-bar');
  if (tabsBar) {
    const visibleCount = tabsBar.querySelectorAll('.tab-button:not([style*="display: none"]):not([style*="display:none"])').length;
    tabsBar.style.gridTemplateColumns = `repeat(${visibleCount}, 1fr)`;
  }

  // Render tabel selector untuk setiap tab (sebelum early-return agar selalu diproses)
  ['tahunan', 'bulanan'].forEach(tab => {
    const tabHidden = config && config.hideTabs && config.hideTabs.includes(tab);
    if (!tabHidden) {
      renderTabelSelector(tab, reportId);
    } else {
      const selectorDiv = document.getElementById(`tabel-selector-${tab}`);
      if (selectorDiv) selectorDiv.style.display = 'none';
    }
  });

  const monitorPanel = document.getElementById('monitoring-k0-panel');
  if (monitorPanel) {
    monitorPanel.style.display = reportId === 'monitoring-k0' ? 'block' : 'none';
  }

  if (reportId === 'monitoring-k0') {
    // hide all existing tab contents while monitoring
    document.querySelectorAll('.tab-content').forEach(el => { el.style.display = 'none'; });
    if (tabsBar) tabsBar.style.display = 'none';
    return;
  }

  if (!config) return;

  if (config.tahunan && config.tahunan.hide) {
    config.tahunan.hide.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const fg = el.closest('.form-group');
        if (fg) fg.style.display = 'none';
      }
    });
  }
  if (config.bulanan && config.bulanan.hide) {
    config.bulanan.hide.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const fg = el.closest('.form-group');
        if (fg) fg.style.display = 'none';
      }
    });
  }

  // Handle 'show' property — tampilkan field tertentu
  ['tahunan', 'bulanan'].forEach(tab => {
    const tabConfig = config && config[tab];
    if (tabConfig && tabConfig.show) {
      tabConfig.show.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          const fg = el.closest('.form-group');
          if (fg) fg.style.display = '';
        }
      });
    }
  });
}

// Screen references
const menuScreen = document.getElementById('menu-screen');
const submenuScreen = document.getElementById('submenu-screen');
const formScreen = document.getElementById('form-screen');

let activeMenuId = null;
let activeSubmenuId = null;

function showScreen(screen) {
  [menuScreen, submenuScreen, formScreen].forEach(s => {
    if (s) s.style.display = 'none';
  });
  if (screen) screen.style.display = 'block';
}

// Category buttons
document.querySelectorAll('.menu-item[data-menu]').forEach(btn => {
  btn.addEventListener('click', () => {
    const menuId = btn.getAttribute('data-menu');
    const menu = menuConfig[menuId];
    if (!menu) return;

    activeMenuId = menuId;

    // Jika menu monitoring K0 (langsung tanpa submenu)
    if (menuId === 'monitoring-k0') {
      activeSubmenuId = 'monitoring-k0';
      const breadcrumb = document.getElementById('breadcrumb-label');
      if (breadcrumb) breadcrumb.textContent = `${menu.label}  ›  Monitoring K0`;

      applyFieldVisibility(activeSubmenuId);
      showScreen(formScreen);
      saveUserPrefs();
      return;
    }

    // Populate sub-menu
    const submenuTitle = document.getElementById('submenu-title');
    const submenuList = document.getElementById('submenu-list');
    submenuTitle.textContent = menu.label;
    submenuList.innerHTML = '';

    menu.submenus.forEach(sub => {
      const subBtn = document.createElement('button');
      subBtn.className = 'menu-item';
      subBtn.innerHTML = `
        <span class="menu-item-label">${sub.label}</span>
        <span class="menu-item-chevron">›</span>
      `;
      subBtn.addEventListener('click', () => {
        activeSubmenuId = sub.id;

        // Update breadcrumb
        const breadcrumb = document.getElementById('breadcrumb-label');
        if (breadcrumb) breadcrumb.textContent = `${menu.label}  ›  ${sub.label}`;

        // Apply field visibility rules for this report type
        applyFieldVisibility(sub.id);

        showScreen(formScreen);
        saveUserPrefs();
      });
      submenuList.appendChild(subBtn);
    });

    showScreen(submenuScreen);
    saveUserPrefs();
  });
});

// Back: submenu → menu
document.getElementById('back-to-menu').addEventListener('click', () => {
  activeMenuId = null;
  showScreen(menuScreen);
  saveUserPrefs();
});

// Back: form → submenu
document.getElementById('back-to-submenu').addEventListener('click', () => {
  activeSubmenuId = null;
  showScreen(submenuScreen);
  saveUserPrefs();
});

// Listener untuk simpan perubahan input/select pada form
['tahunan', 'bulanan'].forEach(tab => {
  ['input', 'change'].forEach(evt => {
    document.getElementById(`${tab}-form`)?.addEventListener(evt, saveUserPrefs);
  });
});

// Toggle close-delay & open-delay panels
['tahunan', 'bulanan'].forEach(tab => {
  ['close-delay', 'open-delay'].forEach(prefix => {
    const toggle = document.getElementById(`enable-${prefix}-${tab}`);
    const panel = document.getElementById(`${prefix}-panel-${tab}`);
    if (toggle && panel) {
      toggle.addEventListener('change', () => {
        panel.style.display = toggle.checked ? 'block' : 'none';
        saveUserPrefs();
      });
    }
  });
});

// ──────────────────────────────────────────────────────────
// USER PREFERENCES — Simpan & Restore pilihan user
// ──────────────────────────────────────────────────────────

const PREFS_KEY = 'userPrefs';

function saveUserPrefs() {
  const prefs = {
    activeMenuId,
    activeSubmenuId,
    activeScreen: formScreen.style.display !== 'none' ? 'form'
      : submenuScreen.style.display !== 'none' ? 'submenu' : 'menu',
    activeTab: document.querySelector('.tab-button.active')?.getAttribute('data-tab') || 'tahunan',
    monitoringTarget: document.getElementById('monitoring-target')?.value || '#/kegiatan/kelompok_bkb',
    monitoringInitialWait: document.getElementById('monitoring-initial-wait')?.value || '30',
    monitoringLoopWait: document.getElementById('monitoring-loop-wait')?.value || '8',
    monitoringParallelLimit: document.getElementById('monitoring-parallel-limit')?.value || '3',
    monitoringMode: document.querySelector('input[name="monitoring-mode"]:checked')?.value || 'provinsi',
    monitoringKab: document.getElementById('monitoring-kab')?.value || ''
  };
  ['tahunan', 'bulanan'].forEach(tab => {
    prefs[`cities_${tab}`] = Array.from(
      document.querySelectorAll(`#cities-${tab} input[type="checkbox"]:checked`)
    ).map(cb => cb.value);
    prefs[`kecamatan_${tab}`] = Array.from(
      document.querySelectorAll(`#kecamatan-checkboxes-${tab} input[type="checkbox"]:checked`)
    ).map(cb => cb.value);
    prefs[`tabel_${tab}`] = Array.from(
      document.querySelectorAll(`#tabel-checkboxes-${tab} input[type="checkbox"]:checked`)
    ).map(cb => cb.value);
    prefs[`desa_${tab}`] = Array.from(
      document.querySelectorAll(`#desa-checkboxes-${tab} input[type="checkbox"]:checked`)
    ).map(cb => cb.value);
    const fieldIds = tab === 'tahunan'
      ? ['periode-tahunan', 'rw-tahunan', 'sasaran-tahunan', 'jenis-laporan-tahunan', 'close-delay-tahunan', 'open-delay-tahunan']
      : ['tahun', 'jenis-laporan-bulanan', 'close-delay-bulanan', 'open-delay-bulanan'];
    fieldIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) prefs[id] = el.value;
    });
    const cbOptionIds = tab === 'tahunan'
      ? ['enable-close-delay-tahunan', 'enable-open-delay-tahunan', 'download-all-kec-tahunan', 'download-all-desa-tahunan']
      : ['enable-close-delay-bulanan', 'enable-open-delay-bulanan', 'download-all-kec-bulanan', 'download-all-desa-bulanan'];
    cbOptionIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) prefs[id] = el.checked;
    });
    prefs[`folder_mode_${tab}`] = document.querySelector(`input[name="folder-mode-${tab}"]:checked`)?.value || 'kab';
  });
  // Simpan closeDelay & openDelay sebagai key terpisah agar bisa dibaca content.js
  const activeCloseDelay = (() => {
    const activeTab = prefs.activeTab || 'tahunan';
    const enableId = activeTab === 'bulanan' ? 'enable-close-delay-bulanan' : 'enable-close-delay-tahunan';
    const delayId = activeTab === 'bulanan' ? 'close-delay-bulanan' : 'close-delay-tahunan';
    const enabled = document.getElementById(enableId)?.checked;
    if (!enabled) return 10;
    const el = document.getElementById(delayId);
    return el ? parseInt(el.value, 10) || 10 : 10;
  })();
  const activeOpenDelay = (() => {
    const activeTab = prefs.activeTab || 'tahunan';
    const enableId = activeTab === 'bulanan' ? 'enable-open-delay-bulanan' : 'enable-open-delay-tahunan';
    const delayId = activeTab === 'bulanan' ? 'open-delay-bulanan' : 'open-delay-tahunan';
    const enabled = document.getElementById(enableId)?.checked;
    if (enabled === false) return 0;
    const el = document.getElementById(delayId);
    return el ? parseInt(el.value, 10) || 5 : 5;
  })();
  chrome.storage.local.set({ [PREFS_KEY]: prefs, closeDelay: activeCloseDelay, openDelay: activeOpenDelay });
}

function restoreUserPrefs() {
  chrome.storage.local.get(PREFS_KEY, data => {
    const prefs = data[PREFS_KEY];
    if (!prefs) return;

    // Restore monitoring settings (target dan wait values)
    const monitoringTargetEl = document.getElementById('monitoring-target');
    const monitoringInitialEl = document.getElementById('monitoring-initial-wait');
    const monitoringLoopEl = document.getElementById('monitoring-loop-wait');
    const monitoringParallelEl = document.getElementById('monitoring-parallel-limit');
    if (monitoringTargetEl && prefs.monitoringTarget) monitoringTargetEl.value = prefs.monitoringTarget;
    if (monitoringInitialEl && prefs.monitoringInitialWait) monitoringInitialEl.value = prefs.monitoringInitialWait;
    if (monitoringLoopEl && prefs.monitoringLoopWait) monitoringLoopEl.value = prefs.monitoringLoopWait;
    if (monitoringParallelEl && prefs.monitoringParallelLimit) monitoringParallelEl.value = prefs.monitoringParallelLimit;


    // Restore mode monitoring (provinsi / kecamatan)
    if (prefs.monitoringMode) {
      const modeRadio = document.querySelector(`input[name="monitoring-mode"][value="${prefs.monitoringMode}"]`);
      if (modeRadio) {
        modeRadio.checked = true;
        // trigger visibility toggle
        const kabGroup = document.getElementById('monitoring-kab-group');
        if (kabGroup) kabGroup.style.display = prefs.monitoringMode === 'kecamatan' ? 'block' : 'none';
      }
    }
    // Restore kabupaten terpilih
    const kabSelectEl = document.getElementById('monitoring-kab');
    if (kabSelectEl && prefs.monitoringKab) {
      kabSelectEl.value = prefs.monitoringKab;
      // update info kec count
      const kecInfoEl = document.getElementById('monitoring-kec-info');
      if (kecInfoEl) {
        const count = (kecamatanData[prefs.monitoringKab] || []).length;
        kecInfoEl.textContent = count > 0
          ? `✔ ${count} kecamatan akan dimonitor`
          : '⚠ Data kecamatan tidak tersedia';
        kecInfoEl.style.color = count > 0 ? '#2a7a2a' : '#a00';
      }
    }

    // Restore simple fields & checkboxes untuk kedua tab
    ['tahunan', 'bulanan'].forEach(tab => {
      const fieldIds = tab === 'tahunan'
        ? ['periode-tahunan', 'rw-tahunan', 'sasaran-tahunan', 'jenis-laporan-tahunan', 'close-delay-tahunan', 'open-delay-tahunan']
        : ['tahun', 'jenis-laporan-bulanan', 'close-delay-bulanan', 'open-delay-bulanan'];
      fieldIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && prefs[id] !== undefined) el.value = prefs[id];
      });
      const cbOptionIds = tab === 'tahunan'
        ? ['enable-close-delay-tahunan', 'enable-open-delay-tahunan', 'download-all-kec-tahunan', 'download-all-desa-tahunan']
        : ['enable-close-delay-bulanan', 'enable-open-delay-bulanan', 'download-all-kec-bulanan', 'download-all-desa-bulanan'];
      cbOptionIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && prefs[id] !== undefined) {
          el.checked = prefs[id];
          if (id.startsWith('enable-close-delay-') || id.startsWith('enable-open-delay-')) {
            const isClose = id.startsWith('enable-close-delay-');
            const prefix = isClose ? 'close-delay' : 'open-delay';
            const t = id.replace(`enable-${prefix}-`, '');
            const panel = document.getElementById(`${prefix}-panel-${t}`);
            if (panel) panel.style.display = prefs[id] ? 'block' : 'none';
          }
        }
      });
      if (prefs[`folder_mode_${tab}`]) {
        const rb = document.querySelector(`input[name="folder-mode-${tab}"][value="${prefs[`folder_mode_${tab}`]}"]`);
        if (rb) rb.checked = true;
      }
      // Restore kab/kota
      if (prefs[`cities_${tab}`]?.length) {
        prefs[`cities_${tab}`].forEach(val => {
          const cb = document.querySelector(`#cities-${tab} input[value="${val}"]`);
          if (cb) cb.checked = true;
        });
        updateKecamatanDropdown(tab);
        handleDisableInputs(tab);
      }
    });

    // Navigasi
    if (!prefs.activeMenuId || prefs.activeScreen === 'menu') return;

    const menu = menuConfig[prefs.activeMenuId];
    if (!menu) return;

    activeMenuId = prefs.activeMenuId;

    // Rebuild submenu HTML (supaya tombol kembali berfungsi)
    const submenuTitle = document.getElementById('submenu-title');
    const submenuList = document.getElementById('submenu-list');
    if (submenuTitle) submenuTitle.textContent = menu.label;
    if (submenuList) {
      submenuList.innerHTML = '';
      menu.submenus.forEach(sub => {
        const subBtn = document.createElement('button');
        subBtn.className = 'menu-item';
        subBtn.innerHTML = `<span class="menu-item-label">${sub.label}</span><span class="menu-item-chevron">›</span>`;
        subBtn.addEventListener('click', () => {
          activeSubmenuId = sub.id;
          const breadcrumb = document.getElementById('breadcrumb-label');
          if (breadcrumb) breadcrumb.textContent = `${menu.label}  ›  ${sub.label}`;
          applyFieldVisibility(sub.id);
          showScreen(formScreen);
          saveUserPrefs();
        });
        submenuList.appendChild(subBtn);
      });
    }

    if (prefs.activeScreen === 'submenu') {
      showScreen(submenuScreen);
      return;
    }

    if (prefs.activeScreen !== 'form' || !prefs.activeSubmenuId) return;

    activeSubmenuId = prefs.activeSubmenuId;
    const sub = menu.submenus.find(s => s.id === activeSubmenuId);
    if (!sub) return;

    const breadcrumb = document.getElementById('breadcrumb-label');
    if (breadcrumb) breadcrumb.textContent = `${menu.label}  ›  ${sub.label}`;
    applyFieldVisibility(activeSubmenuId);
    showScreen(formScreen);

    // Restore active tab
    if (prefs.activeTab) {
      const allTabBtns = document.querySelectorAll('.tab-button');
      const allTabContents = document.querySelectorAll('.tab-content');
      allTabBtns.forEach(b => b.classList.remove('active'));
      allTabContents.forEach(c => c.classList.remove('active'));
      const targetBtn = document.querySelector(`.tab-button[data-tab="${prefs.activeTab}"]`);
      const targetContent = document.getElementById(`${prefs.activeTab}-content`);
      if (targetBtn) targetBtn.classList.add('active');
      if (targetContent) targetContent.classList.add('active');
      // Render progress jika tab Download yang di-restore
      if (prefs.activeTab === 'download') renderDownloadTab();
    }

    // Restore kecamatan & tabel (perlu delay karena dirender async)
    setTimeout(() => {
      ['tahunan', 'bulanan'].forEach(tab => {
        // Step 1: Restore kecamatan checkboxes
        if (prefs[`kecamatan_${tab}`]?.length) {
          document.querySelectorAll(`#kecamatan-checkboxes-${tab} input[type="checkbox"]`).forEach(cb => {
            if (prefs[`kecamatan_${tab}`].includes(cb.value)) cb.checked = true;
          });
          const kecInput = document.getElementById(`kecamatan-${tab}`);
          if (kecInput) kecInput.value = prefs[`kecamatan_${tab}`][0] || '';

          // Step 2: Render desa/faskes list berdasarkan kecamatan yang baru di-restore
          // (wajib dilakukan sebelum bisa restore pilihan desa)
          renderListDesaFaskes(tab);
        }

        // Restore tabel checkboxes
        if (prefs[`tabel_${tab}`]?.length) {
          document.querySelectorAll(`#tabel-checkboxes-${tab} input[type="checkbox"]`).forEach(cb => {
            if (prefs[`tabel_${tab}`].includes(cb.value)) cb.checked = true;
          });
          syncTabelToUrl(tab);
        }
      });

      // Step 3: Restore pilihan desa/faskes SETELAH renderListDesaFaskes selesai render DOM
      setTimeout(() => {
        ['tahunan', 'bulanan'].forEach(tab => {
          if (prefs[`desa_${tab}`]?.length) {
            let restoredCount = 0;
            document.querySelectorAll(`#desa-checkboxes-${tab} input[type="checkbox"]`).forEach(cb => {
              if (prefs[`desa_${tab}`].includes(cb.value)) {
                cb.checked = true;
                restoredCount++;
              }
            });
            if (restoredCount > 0) syncDesaToUrl(tab);
          }
        });
      }, 50);
    }, 100);
  });
}

// Event listener untuk mode eksekusi Batch/Paralel
['tahunan', 'bulanan'].forEach(tab => {
  const modeSelect = document.getElementById(`mode-eksekusi-${tab}`);
  const batchPanel = document.getElementById(`batch-size-panel-${tab}`);
  if (modeSelect && batchPanel) {
    modeSelect.addEventListener('change', (e) => {
      if (e.target.value === 'batch') {
        batchPanel.style.display = 'block';
      } else {
        batchPanel.style.display = 'none';
      }
    });
    // Trigger on load
    modeSelect.dispatchEvent(new Event('change'));
  }
});

// On load: show menu screen
showScreen(menuScreen);