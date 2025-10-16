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
  });
}

// Inisialisasi city checkbox
renderCheckboxes('cities-tahunan', 'tahunan');
renderCheckboxes('cities-bulanan', 'bulanan');

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
setupSelectAll('select-all-tahunan', 'tahunan');
setupSelectAll('select-all-bulanan', 'bulanan');

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
    const urls = document.getElementById(`urls-${tabName}`).value.split('\n').map(u => u.trim()).filter(u => u);
    const periode = document.getElementById(`periode-${tabName}`).value;
    const kecamatan = document.getElementById(`kecamatan-${tabName}`).value;
    const jenisLaporan = document.getElementById(`jenis-laporan-${tabName}`).value;

    const checkboxes = document.querySelectorAll(`#cities-${tabName} input[type="checkbox"]:checked`);
    const selectedCities = Array.from(checkboxes).map(cb => cb.value);

    // Dapatkan nama kota dari mapping cities
    const cityNameMap = {};
    cities.forEach(city => { cityNameMap[city.id] = city.name; });

    // Buat queue: tiap baris URL + nama kota
    const queue = [];
    if (selectedCities.length === 0) {
      // Jika tidak ada kota dipilih
      if (tabName === 'tahunan') {
        // Untuk tahunan, hanya berdasarkan periode
        urls.forEach(url => {
          queue.push({ kota: '', url, periode });
        });
      } else {
        // Untuk bulanan, berdasarkan periode dan tahun (pastikan tahun diambil jika fieldnya ada)
        const tahunEl = document.getElementById('tahun');
        const tahun = tahunEl ? tahunEl.value : '';
        urls.forEach(url => {
          queue.push({ kota: '', url, periode, tahun });
        });
      }
    } else {
      // Jika ada kota, proses seperti biasa
      selectedCities.forEach(cityId => {
        urls.forEach(url => {
          queue.push({ kota: cityNameMap[cityId], url });
        });
      });
    }

    const data = {
      tab: tabName,
      periode,
      kecamatan,
      jenisLaporan,
      selectedCities,
      downloadQueue: queue // pass langsung queue!
    };
    if (tabName === 'bulanan') {
      data.faskes = document.getElementById('faskes-bulanan').value;
      const tahun = document.getElementById('tahun').value;
      data.tahun = tahun;
    } else {
      data.desa = document.getElementById('desa-tahunan').value;
      data.rw = document.getElementById('rw-tahunan').value;
      data.sasaran = document.getElementById('sasaran-tahunan').value;
    }

    console.log('Data to be sent:', data);
    chrome.runtime.sendMessage({ action: 'processData', data },
      (response) => {
        if (response && response.success) {
          alert('Proses otomatis berhasil!');
        } else {
          alert('Proses gagal atau tidak ada response.');
        }
      });
  });
}
setupFormSubmit('tahunan-form', 'tahunan');
setupFormSubmit('bulanan-form', 'bulanan');
