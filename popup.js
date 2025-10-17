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

// Fungsi untuk render Download Tab
function renderDownloadTab() {

  chrome.storage.local.get(null, function (data) {
    console.log("Rendering entries:", Object.keys(data)
      .filter(k => k.startsWith('tabdownload_')));
    const entries = Object.keys(data)
      .filter(k => k.startsWith('tabdownload_'))
      .map(k => data[k])
      .sort((a, b) => a.urlIndex - b.urlIndex);

    let blocks = entries.map((item, i) => {
      let statClass = "downloading", statText = "Progress";
      if (item.status === "success") { statClass = "success"; statText = "Berhasil"; }
      if (item.status === "fail") { statClass = "fail"; statText = "GAGAL"; }
      if (item.status === "progress") { statClass = "downloading"; statText = "Progress"; }

      let progress = item.totalFiles > 0 ? Math.round((item.filesCompleted / item.totalFiles) * 100) : 0;
      let fileTerakhir = item.fileAkhir ? `file terakhir : ${item.fileAkhir}` : '';

      // Progress bar dengan warna dinamis
      let progressColor = statClass === "success" ? "#18af34" : statClass === "fail" ? "#e12121" : "#484dde";

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
        </div>
      `;
    });
    document.getElementById("download-progress-list").innerHTML = blocks.length > 0 ? blocks.join("\n") : "<p>Tidak ada proses download.</p>";
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
  // Group queue berdasarkan URL untuk mendapatkan unique URLs
  const urlToQueueMap = {};
  downloadQueue.forEach(item => {
    if (!urlToQueueMap[item.url]) urlToQueueMap[item.url] = [];
    urlToQueueMap[item.url].push(item);
  });

  // Untuk setiap URL, buat initial progress state
  Object.keys(urlToQueueMap).forEach(url => {
    const queue = urlToQueueMap[url];
    const urlHash = btoa(url); // Hash untuk key unik
    const firstFile = queue[0].kota || "Memulai...";

    chrome.storage.local.set({
      [`tabdownload_${urlHash}`]: {
        url: url,
        status: "progress", // Status awal
        totalFiles: queue.length,
        filesCompleted: 0,
        fileAkhir: firstFile
      }
    }, () => {
      // Refresh UI setelah inisialisasi
      renderDownloadTab();
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
      downloadQueue: queue, // pass langsung queue!
      urls
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
    // Reset progress lama dan pindah ke tab Download
    resetDownloadProgress(() => {
      switchToDownloadTab();

      // Inisialisasi progress awal per URL dengan 0% dan file pertama
      initializeDownloadProgress(queue);

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
  });
}
setupFormSubmit('tahunan-form', 'tahunan');
setupFormSubmit('bulanan-form', 'bulanan');


// Listener untuk auto-refresh download tab
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "refresh_download_status") renderDownloadTab();
});