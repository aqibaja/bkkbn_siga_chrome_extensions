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
// Panggil loadWilayahData saat popup dibuka
loadWilayahData();

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

    // Event listener untuk update dropdown kecamatan
    checkbox.addEventListener('change', () => {
      updateKecamatanDropdown(tabName);
      handleDisableInputs(tabName);
      // Re-apply semua kecamatan state if still checked
      const allKecEl = document.getElementById(`all-kecamatan-${tabName}`);
      if (allKecEl && allKecEl.checked) {
        setKecamatanInputVisibility(tabName, false);
        setDesaFaskesDisabled(tabName, true);
        renderKecamatanList(tabName);
      }
    });
  });

  // Tambahkan handler disable saat render awal
  setTimeout(() => handleDisableInputs(tabName), 0);
  // Fungsi untuk men-disable input selain jenis laporan jika lebih dari 1 kab/kota dipilih
  function handleDisableInputs(tabName) {
    const checked = document.querySelectorAll(`#cities-${tabName} input[type="checkbox"]:checked`);
    const disable = checked.length > 1;
    // Daftar id input yang harus di-disable
    const idsToDisable = tabName === 'tahunan'
      ? ['kecamatan-tahunan', 'desa-tahunan', 'all-desa-tahunan', 'all-kecamatan-tahunan', 'rw-tahunan', 'sasaran-tahunan']
      : ['kecamatan-bulanan', 'faskes-bulanan', 'all-faskes-bulanan', 'all-kecamatan-bulanan', 'tahun'];
    idsToDisable.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = disable;
    });
    // Jenis laporan tetap enabled
    const jenisLaporanId = tabName === 'tahunan' ? 'jenis-laporan-tahunan' : 'jenis-laporan-bulanan';
    const jenisLaporanEl = document.getElementById(jenisLaporanId);
    if (jenisLaporanEl) jenisLaporanEl.disabled = false;
  }
}

// Fungsi untuk update dropdown kecamatan berdasarkan kabupaten yang dipilih
function updateKecamatanDropdown(tabName) {
  const checkboxes = document.querySelectorAll(`#cities-${tabName} input[type="checkbox"]:checked`);
  const selectedCities = Array.from(checkboxes).map(cb => cb.value);

  const kecamatanInput = document.getElementById(`kecamatan-${tabName}`);
  const kecamatanContainer = kecamatanInput.parentElement;

  // Hapus dropdown lama jika ada
  const existingSelect = kecamatanContainer.querySelector('select');
  if (existingSelect) existingSelect.remove();
  // Hapus juga dropdown desa/faskes lama jika ada supaya input manual muncul kembali
  removeDesaDropdown(kecamatanContainer);

  // Jika hanya 1 kabupaten dipilih, tampilkan dropdown
  if (selectedCities.length === 1) {
    const cityId = selectedCities[0];
    const kecamatanList = kecamatanData[cityId] || [];

    if (kecamatanList.length > 0) {
      // Sembunyikan input text
      kecamatanInput.style.display = 'none';

      // Buat dropdown select
      const select = document.createElement('select');
      select.id = `kecamatan-select-${tabName}`;
      select.style.width = '100%';

      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Pilih Kecamatan';
      defaultOption.selected = true;
      select.appendChild(defaultOption);

      console.log('[kec] create select for city', cityId, 'items', kecamatanList.length);
      kecamatanList.forEach(kec => {
        const option = document.createElement('option');
        option.value = kec;
        option.textContent = kec;
        select.appendChild(option);
      });

      // Jika input kecamatan sudah berisi nilai (mis. restored), pilihkan di select
      if (kecamatanInput.value) {
        const match = Array.from(select.options).find(o => o.value === kecamatanInput.value);
        if (match) {
          select.value = kecamatanInput.value;
          // render desa sesuai nilai yang sudah ada
          renderDesaDropdown(tabName, cityId, select.value);
        }
      }

      // Event listener untuk sync value ke input text and render dropdown desa
      select.addEventListener('change', (e) => {
        kecamatanInput.value = e.target.value;
        // Reset previous desa/faskes input value when kecamatan berubah
        const desaInputEl = document.getElementById('desa-tahunan');
        const faskesInputEl = document.getElementById('faskes-bulanan');
        if (desaInputEl) desaInputEl.value = '';
        if (faskesInputEl) faskesInputEl.value = '';
        // Render desa/faskes dropdown otomatis
        renderDesaDropdown(tabName, cityId, e.target.value);
      });

      kecamatanContainer.appendChild(select);

      // Jika "semua kecamatan" sudah dicentang, sembunyikan select yang baru dibuat
      const allKecEl = document.getElementById(`all-kecamatan-${tabName}`);
      if (allKecEl && allKecEl.checked) select.style.display = 'none';
    } else {
      // Tampilkan input text hanya jika "semua kecamatan" tidak dicentang
      const allKecElInner = document.getElementById(`all-kecamatan-${tabName}`);
      if (!allKecElInner || !allKecElInner.checked) kecamatanInput.style.display = 'block';
      // pastikan dropdown desa/faskes sudah dihapus saat kembali ke input manual
      removeDesaDropdown(kecamatanContainer);
    }
  } else {
    // Jika tidak ada atau lebih dari 1 kabupaten dipilih, tampilkan input text dan kosongkan nilai
    kecamatanInput.value = '';
    const allKecElOuter = document.getElementById(`all-kecamatan-${tabName}`);
    if (!allKecElOuter || !allKecElOuter.checked) kecamatanInput.style.display = 'block';
    removeDesaDropdown(kecamatanContainer);
  }
}

// Inisialisasi city checkbox
renderCheckboxes('cities-tahunan', 'tahunan');
renderCheckboxes('cities-bulanan', 'bulanan');

// Helper: render daftar desa/faskes
function renderListDesaFaskes(tabName) {
  const kecamatan = document.getElementById(`kecamatan-${tabName}`).value;
  const listContainer = document.getElementById(tabName === 'tahunan' ? 'list-desa-tahunan' : 'list-faskes-bulanan');
  listContainer.innerHTML = '';
  if (!kecamatan) {
    listContainer.style.display = 'none';
    return;
  }
  // Ambil kode kabupaten dari kota terpilih (hanya jika satu kabupaten)
  const checked = document.querySelectorAll(`#cities-${tabName} input[type="checkbox"]:checked`);
  if (checked.length !== 1) {
    listContainer.style.display = 'none';
    return;
  }
  const kabId = checked[0].value;
  // Ambil kode kecamatan (misal: '01 - BAKONGAN' -> '01')
  const kecName = (kecamatan.split('-')[1] || '').trim();
  // Ambil list desa dari wilayahData jika tersedia (JSON berupa array)
  let list = [];
  if (Array.isArray(wilayahData)) {
    const kabNum = Number(kabId);
    list = wilayahData
      .filter(entry => {
        // KODE KABUPATEN bisa berupa object seperti {"KOTA":1}
        const kodeKabObj = entry['KODE KABUPATEN'];
        const kodeKab = kodeKabObj && typeof kodeKabObj === 'object' ? Object.values(kodeKabObj)[0] : kodeKabObj;
        const namaKec = (entry['NAMA KECAMATAN'] || '').toString().trim();
        return Number(kodeKab) === kabNum && namaKec.toLowerCase() === kecName.toLowerCase();
      })
      .map(entry => `${entry['KODE DESA']} - ${entry['NAMA DESA']}`);
  }
  if (list.length > 0) {
    listContainer.style.display = 'block';
    listContainer.innerHTML = list.map(item => `<div>${item}</div>`).join('');
  } else {
    listContainer.style.display = 'none';
  }
}

// Fungsi untuk render dropdown desa/faskes (global)
function renderDesaDropdown(tabName, cityId, kecamatanValue) {
  const kecamatanContainer = document.getElementById(`kecamatan-${tabName}`).parentElement;
  // Hapus dropdown desa/faskes lama jika ada
  removeDesaDropdown(kecamatanContainer);
  if (!kecamatanValue) return;
  const kecName = (kecamatanValue.split('-')[1] || '').trim();
  let desaList = [];
  if (Array.isArray(wilayahData)) {
    const kabNum = Number(cityId);
    desaList = wilayahData
      .filter(entry => {
        const kodeKabObj = entry['KODE KABUPATEN'];
        const kodeKab = kodeKabObj && typeof kodeKabObj === 'object' ? Object.values(kodeKabObj)[0] : kodeKabObj;
        const namaKec = (entry['NAMA KECAMATAN'] || '').toString().trim();
        return Number(kodeKab) === kabNum && namaKec.toLowerCase() === kecName.toLowerCase();
      })
      .map(entry => `${entry['KODE DESA']} - ${entry['NAMA DESA']}`);
  }
  console.log('[desa] renderDesaDropdown', { tabName, cityId, kecName, found: desaList.length });
  if (desaList.length > 0) {
    const isBulanan = tabName === 'bulanan';
    // Show the manual input and rely on our custom listbox (no native datalist)
    const inputId = isBulanan ? 'faskes-bulanan' : 'desa-tahunan';
    const inputEl = document.getElementById(inputId);
    if (inputEl) {
      // ensure no native datalist is attached
      inputEl.removeAttribute('list');
      inputEl.style.display = 'block';
    }

    // Create a custom listbox under the input so options can be shown even if input already has value.
    const listboxId = `${isBulanan ? 'faskes' : 'desa'}-listbox-${tabName}`;
    // remove existing listbox if any
    const existingListbox = document.getElementById(listboxId);
    if (existingListbox) existingListbox.remove();
    const listbox = document.createElement('div');
    listbox.id = listboxId;
    listbox.className = 'datalist-listbox';
    listbox.style.position = 'absolute';
    listbox.style.zIndex = '9999';
    listbox.style.background = '#fff';
    listbox.style.border = '1px solid #ddd';
    listbox.style.maxHeight = '200px';
    listbox.style.overflow = 'auto';
    listbox.style.display = 'none';
    listbox.style.width = inputEl ? `${inputEl.offsetWidth}px` : '100%';
    // populate items
    desaList.forEach(desa => {
      const item = document.createElement('div');
      item.className = 'datalist-item';
      item.textContent = desa;
      item.style.padding = '6px 10px';
      item.style.cursor = 'pointer';
      item.addEventListener('mouseenter', () => item.style.background = '#f0f0f0');
      item.addEventListener('mouseleave', () => item.style.background = '');
      item.addEventListener('click', () => {
        if (inputEl) inputEl.value = desa;
        listbox.style.display = 'none';
      });
      listbox.appendChild(item);
    });
    // position listbox right after the input
    if (inputEl) {
      const rect = inputEl.getBoundingClientRect();
      // place relative to container: append to container and rely on flow; adjust later with CSS if needed
      inputEl.parentElement.style.position = 'relative';
      listbox.style.width = '100%';
      // place listbox below the input so it doesn't cover the form
      listbox.style.left = '0';
      listbox.style.top = `${inputEl.offsetHeight + 24}px`;
      listbox.style.boxSizing = 'border-box';
      listbox.style.borderRadius = '6px';
      inputEl.parentElement.appendChild(listbox);

      // show list on focus and when user clicks the input
      inputEl.addEventListener('focus', () => { listbox.style.display = 'block'; });
      inputEl.addEventListener('click', () => { listbox.style.display = 'block'; });
      // filter as user types
      inputEl.addEventListener('input', () => {
        const v = (inputEl.value || '').toLowerCase();
        Array.from(listbox.children).forEach(ch => {
          ch.style.display = ch.textContent.toLowerCase().includes(v) ? 'block' : 'none';
        });
      });
      // hide when clicking outside
      document.addEventListener('click', function onDocClick(ev) {
        if (!listbox.contains(ev.target) && ev.target !== inputEl) {
          listbox.style.display = 'none';
        }
      });
    } else {
      kecamatanContainer.appendChild(listbox);
    }
  }
}

// Toggle full list container for desa/faskes
function toggleFullList(tabName, cityId, kecName) {
  const listContainer = document.getElementById(tabName === 'tahunan' ? 'list-desa-tahunan' : 'list-faskes-bulanan');
  if (!listContainer) return;
  if (listContainer.style.display === 'block') {
    listContainer.style.display = 'none';
    return;
  }
  // build list same as renderDesaDropdown logic
  let list = [];
  if (Array.isArray(wilayahData)) {
    const kabNum = Number(cityId);
    list = wilayahData
      .filter(entry => {
        const kodeKabObj = entry['KODE KABUPATEN'];
        const kodeKab = kodeKabObj && typeof kodeKabObj === 'object' ? Object.values(kodeKabObj)[0] : kodeKabObj;
        const namaKec = (entry['NAMA KECAMATAN'] || '').toString().trim();
        return Number(kodeKab) === kabNum && namaKec.toLowerCase() === (kecName || '').toLowerCase();
      })
      .map(entry => `${entry['KODE DESA']} - ${entry['NAMA DESA']}`);
  }
  if (list.length > 0) {
    listContainer.innerHTML = list.map(item => `<div>${item}</div>`).join('');
    listContainer.style.display = 'block';
  } else {
    listContainer.innerHTML = '';
    listContainer.style.display = 'none';
  }
}

function removeDesaDropdown(container) {
  // remove possible datalists
  const desaDlist = container.querySelector('datalist[id^="desa-datalist-"]');
  const faskesDlist = container.querySelector('datalist[id^="faskes-datalist-"]');
  if (desaDlist) desaDlist.remove();
  if (faskesDlist) faskesDlist.remove();
  // remove custom listbox if present
  const listbox = container.querySelector('.datalist-listbox');
  if (listbox) listbox.remove();
  // clear list attribute from inputs
  const desaInput = container.querySelector('#desa-tahunan');
  const faskesInput = container.querySelector('#faskes-bulanan');
  if (desaInput) {
    desaInput.removeAttribute('list');
    desaInput.style.display = 'block';
  }
  if (faskesInput) {
    faskesInput.removeAttribute('list');
    faskesInput.style.display = 'block';
  }
}

// Event handler untuk checkbox Semua Desa/Faskes
function setupAllDesaFaskes(tabName) {
  const allCheckbox = document.getElementById(tabName === 'tahunan' ? 'all-desa-tahunan' : 'all-faskes-bulanan');
  const inputField = document.getElementById(tabName === 'tahunan' ? 'desa-tahunan' : 'faskes-bulanan');
  const listContainer = document.getElementById(tabName === 'tahunan' ? 'list-desa-tahunan' : 'list-faskes-bulanan');
  if (!allCheckbox || !inputField || !listContainer) return;
  allCheckbox.addEventListener('change', function () {
    if (this.checked) {
      // Hide manual input and render list (if kecamatan selected)
      inputField.style.display = 'none';
      renderListDesaFaskes(tabName);
    } else {
      // Show manual input and hide list
      inputField.style.display = 'block';
      listContainer.style.display = 'none';
    }
  });
}

setupAllDesaFaskes('tahunan');
setupAllDesaFaskes('bulanan');

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

function setDesaFaskesDisabled(tabName, disabled) {
  const desaInput = document.getElementById(tabName === 'tahunan' ? 'desa-tahunan' : 'faskes-bulanan');
  const allDesaEl = document.getElementById(tabName === 'tahunan' ? 'all-desa-tahunan' : 'all-faskes-bulanan');
  if (desaInput) {
    desaInput.disabled = disabled;
    desaInput.style.opacity = disabled ? '0.4' : '';
  }
  if (allDesaEl) {
    allDesaEl.disabled = disabled;
    if (allDesaEl.parentElement) allDesaEl.parentElement.style.opacity = disabled ? '0.4' : '';
  }
}

function setupAllKecamatan(tabName) {
  const allCheckbox = document.getElementById(`all-kecamatan-${tabName}`);
  const listContainer = document.getElementById(`list-kecamatan-${tabName}`);
  if (!allCheckbox || !listContainer) return;
  allCheckbox.addEventListener('change', function () {
    if (this.checked) {
      setKecamatanInputVisibility(tabName, false);
      setDesaFaskesDisabled(tabName, true);
      renderKecamatanList(tabName);
    } else {
      setKecamatanInputVisibility(tabName, true);
      setDesaFaskesDisabled(tabName, false);
      listContainer.innerHTML = '';
      listContainer.style.display = 'none';
    }
  });
}

setupAllKecamatan('tahunan');
setupAllKecamatan('bulanan');

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
    checkboxes.forEach(checkbox => { checkbox.checked = true; });
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

    // Attach event listeners untuk tombol Retry dan Cancel
    document.querySelectorAll('.retry-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const url = this.getAttribute('data-url');
        handleRetryFailedItems(url);
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
  // Buat entry progress per item di queue (agar banyak tab/entry per URL didukung)
  const toSet = {};
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
      // keep kota/kecamatan/desa/faskes for display in progress UI
      kota: item.kota || '',
      kecamatan: item.kecamatan || '',
      desa: item.desa || '',
      faskes: item.faskes || ''
    };
  });
  return new Promise(resolve => {
    chrome.storage.local.set(toSet, () => {
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
  });
});

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
    checkboxes.forEach(checkbox => { checkbox.checked = false; });
  });
}
setupReset('reset-tahunan', 'tahunan');
setupReset('reset-bulanan', 'bulanan');

// Form submit handlers
function setupFormSubmit(formId, tabName) {
  document.getElementById(formId).addEventListener('submit', (e) => {
    e.preventDefault();

    try {
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

      const periode = document.getElementById(`periode-${tabName}`).value;
      const kecamatan = document.getElementById(`kecamatan-${tabName}`).value;
      const jenisLaporan = document.getElementById(`jenis-laporan-${tabName}`).value;

      const checkboxes = document.querySelectorAll(`#cities-${tabName} input[type="checkbox"]:checked`);
      const selectedCities = Array.from(checkboxes).map(cb => cb.value);

      // Dapatkan nama kota dari mapping cities
      const cityNameMap = {};
      cities.forEach(city => { cityNameMap[city.id] = city.name; });

      // Buat queue: tiap baris URL + nama kota + desa/faskes jika semua desa/faskes dicentang
      let queue = [];
      const allDesaChecked = document.getElementById('all-desa-tahunan')?.checked;
      const allFaskesChecked = document.getElementById('all-faskes-bulanan')?.checked;
      const allKecamatanChecked = tabName === 'tahunan'
        ? document.getElementById('all-kecamatan-tahunan')?.checked
        : document.getElementById('all-kecamatan-bulanan')?.checked;

      // Jika user pilih banyak kab/kota, setiap kab/kota dibuka di tab terpisah (mirip banyak url)
      if (selectedCities.length > 1) {
        // Banyak kab/kota: setiap kab/kota x url = tab terpisah
        selectedCities.forEach(cityId => {
          urls.forEach(url => {
            queue.push({ kota: cityNameMap[cityId], url });
          });
        });
      } else if (selectedCities.length === 1 && allKecamatanChecked) {
        // Satu kab/kota, semua kecamatan: setiap kecamatan = tab terpisah
        const kabId = selectedCities[0];
        let kecList = Array.from(document.querySelectorAll(`#list-kecamatan-${tabName} div`)).map(div => div.textContent.trim());
        // Fallback ke kecamatanData jika list belum di-render
        if (kecList.length === 0) kecList = kecamatanData[kabId] || [];
        kecList = [...new Set(kecList)].filter(k => !k.startsWith('Pilih'));
        if (kecList.length === 0) {
          alert('⚠️ Daftar kecamatan kosong. Pilih satu kabupaten/kota yang benar.');
          return;
        }
        urls.forEach(url => {
          kecList.forEach(kec => {
            queue.push({ kota: cityNameMap[kabId], url, kecamatan: kec });
          });
        });
      } else if (selectedCities.length === 1 && ((tabName === 'tahunan' && allDesaChecked) || (tabName === 'bulanan' && allFaskesChecked))) {
        // Satu kab/kota, banyak desa/faskes: setiap desa/faskes = tab terpisah
        if (tabName === 'tahunan' && allDesaChecked) {
          let desaList = Array.from(document.querySelectorAll('#list-desa-tahunan div')).map(div => div.textContent.trim());
          // Hilangkan duplikat desa
          desaList = [...new Set(desaList)];
          if (desaList.length === 0) {
            alert('⚠️ Daftar desa kosong. Pilih kecamatan dan kabupaten yang benar, atau isi manual.');
            return;
          }
          urls.forEach(url => {
            desaList.forEach(desa => {
              queue.push({ kota: cityNameMap[selectedCities[0]], url, kecamatan, desa });
            });
          });
        } else if (tabName === 'bulanan' && allFaskesChecked) {
          let faskesList = Array.from(document.querySelectorAll('#list-faskes-bulanan div')).map(div => div.textContent.trim());
          // Hilangkan duplikat faskes
          faskesList = [...new Set(faskesList)];
          if (faskesList.length === 0) {
            alert('⚠️ Daftar faskes kosong. Pilih kecamatan dan kabupaten yang benar, atau isi manual.');
            return;
          }
          urls.forEach(url => {
            faskesList.forEach(faskes => {
              queue.push({ kota: cityNameMap[selectedCities[0]], url, kecamatan, faskes });
            });
          });
        }
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

      // Jika mode banyak desa/faskes, kirim ke background satu per tab (bukan satu queue besar)
      // DEBUG LOG: tampilkan queue sebelum dikirim ke background
      console.log('[DEBUG][popup] Queue to background:', queue);
      if ((selectedCities.length === 1 && (allKecamatanChecked || (tabName === 'tahunan' && allDesaChecked) || (tabName === 'bulanan' && allFaskesChecked))) || selectedCities.length > 1) {
        // Setiap item queue = 1 tab
        resetDownloadProgress(() => {
          switchToDownloadTab();
          // initialize progress entries for the per-item queue so renderDownloadTab can show them
          initializeDownloadProgress(queue).then(keys => {
            queue.forEach((item, idx) => {
              // Data untuk 1 tab
              const singleQueue = [item];
              const itemKecamatan = item.kecamatan || kecamatan;
              const dataSingle = {
                tab: tabName,
                periode,
                kecamatan: itemKecamatan,
                jenisLaporan,
                selectedCities,
                downloadQueue: singleQueue,
                urls
              };
              let payload = {
                periode,
                kab: (item.kota || '').toString().replace(/^\d+\s*-\s*/, '').trim(),
                kec: itemKecamatan
              };
              if (tabName === 'bulanan') {
                dataSingle.faskes = item.faskes || '';
                dataSingle.tahun = document.getElementById('tahun').value;
                payload.tahun = dataSingle.tahun;
                payload.faskes = item.faskes || '';
              } else {
                dataSingle.desa = item.desa || '';
                dataSingle.rw = document.getElementById('rw-tahunan').value;
                dataSingle.sasaran = document.getElementById('sasaran-tahunan').value;
                payload.desa = item.desa || '';
                payload.rw = dataSingle.rw;
              }
              // attach the generated progress key so the content script can update the correct entry
              dataSingle.progressKey = keys[idx];
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

      const data = {
        tab: tabName,
        periode,
        kecamatan,
        jenisLaporan,
        selectedCities,
        downloadQueue: queue, // pass langsung queue!
        urls
      };
      if (tabName === 'bulanan') {
        const allFaskesChecked = document.getElementById('all-faskes-bulanan')?.checked;
        if (allFaskesChecked) {
          data.faskes = '';
        } else {
          data.faskes = document.getElementById('faskes-bulanan').value;
        }
        const tahun = document.getElementById('tahun').value;
        data.tahun = tahun;
      } else {
        const allDesaChecked = document.getElementById('all-desa-tahunan')?.checked;
        if (allDesaChecked) {
          data.desa = '';
        } else {
          data.desa = document.getElementById('desa-tahunan').value;
        }
        data.rw = document.getElementById('rw-tahunan').value;
        data.sasaran = document.getElementById('sasaran-tahunan').value;
      }

      console.log('Data to be sent:', data);
      // If user requested "download semua", show a confirmation preview listing
      const checked = document.querySelectorAll(`#cities-${tabName} input[type="checkbox"]:checked`);
      const selectedCitiesPreview = Array.from(checked).map(cb => cb.value);
      if (tabName === 'tahunan') {
        const allDesaChecked = document.getElementById('all-desa-tahunan')?.checked;
        if (allDesaChecked) {
          if (selectedCitiesPreview.length !== 1) {
            alert('Fitur "Download semua desa" hanya tersedia saat satu kabupaten dipilih.');
            return;
          }
          // collect desa list from rendered container
          let desaList = Array.from(document.querySelectorAll('#list-desa-tahunan div')).map(d => d.textContent.trim());
          if (desaList.length === 0 && Array.isArray(wilayahData)) {
            // fallback: build from wilayahData
            const kabNum = Number(selectedCitiesPreview[0]);
            const kecName = (document.getElementById(`kecamatan-${tabName}`).value || '').split('-')[1] || '';
            desaList = wilayahData.filter(entry => {
              const kodeKabObj = entry['KODE KABUPATEN'];
              const kodeKab = kodeKabObj && typeof kodeKabObj === 'object' ? Object.values(kodeKabObj)[0] : kodeKabObj;
              const namaKec = (entry['NAMA KECAMATAN'] || '').toString().trim();
              return Number(kodeKab) === kabNum && namaKec.toLowerCase() === kecName.toLowerCase();
            }).map(e => `${e['KODE DESA']} - ${e['NAMA DESA']}`);
          }
          if (desaList.length === 0) { alert('Daftar desa kosong - tidak dapat melanjutkan.'); return; }
          const preview = desaList.slice(0, 10).join('\n');
          const ok = confirm(`Anda akan mendownload ${desaList.length} desa. Contoh:\n\n${preview}${desaList.length > 10 ? '\n...' : ''}\n\nLanjutkan?`);
          if (!ok) return;
        }
      } else {
        const allFaskesChecked = document.getElementById('all-faskes-bulanan')?.checked;
        if (allFaskesChecked) {
          if (selectedCitiesPreview.length !== 1) {
            alert('Fitur "Download semua faskes/desa" hanya tersedia saat satu kabupaten dipilih.');
            return;
          }
          let faskesList = Array.from(document.querySelectorAll('#list-faskes-bulanan div')).map(d => d.textContent.trim());
          if (faskesList.length === 0 && Array.isArray(wilayahData)) {
            const kabNum = Number(selectedCitiesPreview[0]);
            const kecName = (document.getElementById(`kecamatan-${tabName}`).value || '').split('-')[1] || '';
            faskesList = wilayahData.filter(entry => {
              const kodeKabObj = entry['KODE KABUPATEN'];
              const kodeKab = kodeKabObj && typeof kodeKabObj === 'object' ? Object.values(kodeKabObj)[0] : kodeKabObj;
              const namaKec = (entry['NAMA KECAMATAN'] || '').toString().trim();
              return Number(kodeKab) === kabNum && namaKec.toLowerCase() === kecName.toLowerCase();
            }).map(e => `${e['KODE DESA']} - ${e['NAMA DESA']}`);
          }
          if (faskesList.length === 0) { alert('Daftar faskes/desa kosong - tidak dapat melanjutkan.'); return; }
          const preview = faskesList.slice(0, 10).join('\n');
          const ok = confirm(`Anda akan mendownload ${faskesList.length} faskes/desa. Contoh:\n\n${preview}${faskesList.length > 10 ? '\n...' : ''}\n\nLanjutkan?`);
          if (!ok) return;
        }
      }
      // Reset progress lama dan pindah ke tab Download
      resetDownloadProgress(() => {
        switchToDownloadTab();

        // Inisialisasi progress awal per URL dengan 0% dan file pertama
        initializeDownloadProgress(queue);


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

        const payload = {
          periode: document.getElementById(`periode-${tabName}`).value,
          kab: kab,
          kec: document.getElementById(`kecamatan-${tabName}`).value
        };

        if (tabName === "bulanan") {
          payload.tahun = document.getElementById("tahun")?.value; // ambil input tahun bulanan
          payload.faskes = data.faskes;
        } else {
          payload.desa = data.desa;
          payload.rw = data.rw;
        }

        chrome.runtime.sendMessage({ action: "setRenameContext", payload });

        // Kirim pesan ke background untuk mulai proses
        chrome.runtime.sendMessage({ action: 'processData', data },
          (response) => {
            if (response && response.success) {
              console.log('Proses download dimulai...');
            } else {
              alert('Proses gagal atau tidak ada response.');
            }
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
  }
  // additional sub-menu configs will be added here as each report type is built out
};

// All hideable field IDs across both tabs (used for reset)
const hideableTahunan = ['rw-tahunan', 'sasaran-tahunan', 'jenis-laporan-tahunan'];
const hideableBulanan = ['jenis-laporan-bulanan'];

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
      });
      submenuList.appendChild(subBtn);
    });

    showScreen(submenuScreen);
  });
});

// Back: submenu → menu
document.getElementById('back-to-menu').addEventListener('click', () => {
  activeMenuId = null;
  showScreen(menuScreen);
});

// Back: form → submenu
document.getElementById('back-to-submenu').addEventListener('click', () => {
  activeSubmenuId = null;
  showScreen(submenuScreen);
});

// On load: show menu screen
showScreen(menuScreen);