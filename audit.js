// ═══════════════════════════════════════════════════════════
// SIGA Smart Downloader — Audit & File Verification Engine
// ═══════════════════════════════════════════════════════════

(function () {
  'use strict';

  // Global State
  let masterKecamatan = []; // Dari KODE WILAYAH.json jika ada
  let masterByCode = new Map(); // Index kode (misal '0318') -> objek master
  let masterByName = new Map(); // Index nama (KAB_KEC) -> objek master
  let bulananUrls = [];     // Dari url-bulanan.json
  let tahunanUrls = [];     // Dari url-tahunan.json
  let detectedPeriode = ''; // Periode bulan dari file yang dipindai
  let detectedTahun = '';   // Tahun dari file yang dipindai
  let detectedTipe = '';    // Tipe submenu (dallap, yankb, dll)
  let parsedFiles = [];     // Semua file yang valid
  let detectedTables = [];  // List tabel yang ditemukan (sorted alami)
  let entityMap = {};       // Map entitas (kecamatan) -> detail & status tabel
  let tableSummary = {};    // Ringkasan per tabel
  let totalMissingFiles = 0;
  let folderName = '';

  // UI Filter State
  let activeTabFilter = 'missing'; // 'missing' | 'all' | 'complete'
  let searchQuery = '';
  let selectedKab = '';
  let selectedTable = '';

  // Modal Elements
  const modalQueueRetry = document.getElementById('modal-queue-retry');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  const btnConfirmQueueFail = document.getElementById('btn-confirm-queue-fail');
  const checkCleanOldQueue = document.getElementById('check-clean-old-queue');
  const modalTotalMissingFiles = document.getElementById('modal-total-missing-files');
  const modalTotalMissingKecs = document.getElementById('modal-total-missing-kecs');
  const modalMissingKecsText = document.getElementById('modal-missing-kecs-text');
  const modalMissingTablesText = document.getElementById('modal-missing-tables-text');

  // DOM Elements
  const dropzone = document.getElementById('dropzone');
  const folderInput = document.getElementById('folder-input');
  const btnChooseFolder = document.getElementById('btn-choose-folder');
  const btnReselectFolder = document.getElementById('btn-reselect-folder');

  const dropzoneSection = document.getElementById('dropzone-section');
  const loadingSection = document.getElementById('loading-section');
  const dashboardSection = document.getElementById('dashboard-section');

  const loadingTitle = document.getElementById('loading-title');
  const loadingDetail = document.getElementById('loading-detail');
  const loadingFill = document.getElementById('loading-progress-fill');

  // Stats
  const statTotalFiles = document.getElementById('stat-total-files');
  const statFolderName = document.getElementById('stat-folder-name');
  const statTotalTables = document.getElementById('stat-total-tables');
  const statTablesList = document.getElementById('stat-tables-list');
  const statTotalItems = document.getElementById('stat-total-items');
  const statMasterInfo = document.getElementById('stat-master-info');
  const statMissingCount = document.getElementById('stat-missing-count');
  const statMissingFilesTotal = document.getElementById('stat-missing-files-total');
  const statCompletenessPct = document.getElementById('stat-completeness-pct');
  const statCompletenessBar = document.getElementById('stat-completeness-bar');

  // Banners & Sections
  const alertBanner = document.getElementById('alert-banner');
  const alertTitle = document.getElementById('alert-title');
  const alertDesc = document.getElementById('alert-desc');
  const sectionTopMissing = document.getElementById('section-top-missing');
  const topMissingBadge = document.getElementById('top-missing-badge');
  const topMissingGrid = document.getElementById('top-missing-grid');
  const tableSummaryGrid = document.getElementById('table-summary-grid');

  // Matrix & Filter
  const matrixThead = document.getElementById('matrix-thead');
  const matrixTbody = document.getElementById('matrix-tbody');
  const inputSearch = document.getElementById('input-search');
  const btnClearSearch = document.getElementById('btn-clear-search');
  const selectFilterKab = document.getElementById('select-filter-kab');
  const selectFilterTable = document.getElementById('select-filter-table');
  const tableInfo = document.getElementById('table-info');

  const tabCountMissing = document.getElementById('tab-count-missing');
  const tabCountAll = document.getElementById('tab-count-all');
  const tabCountComplete = document.getElementById('tab-count-complete');

  // Actions
  const btnCopySummary = document.getElementById('btn-copy-summary');
  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnCopyMissingOnly = document.getElementById('btn-copy-missing-only');
  const btnQueueRetry = document.getElementById('btn-queue-retry');

  // Toast
  const toast = document.getElementById('toast');
  let toastTimer = null;

  function showToast(message, type = 'info') {
    if (toastTimer) clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    toastTimer = setTimeout(() => {
      toast.className = 'toast';
    }, 3500);
  }

  // ── 1. Init & Load Master Wilayah (KODE WILAYAH.json) ──
  async function loadMasterWilayah() {
    try {
      const resp = await fetch('KODE WILAYAH.json');
      if (!resp.ok) return;
      const data = await resp.json();
      
      const kecMap = new Map();
      masterByCode.clear();
      masterByName.clear();
      for (const item of data) {
        if (item['KODE PROVINSI'] === 11) { // Aceh default master
          const rawCode = String(item['KODE KECAMATAN'] || '');
          const shortCode = rawCode.length === 6 ? rawCode.slice(2) : rawCode;
          const kabObj = item['NAMA KABUPATEN'];
          const kabName = typeof kabObj === 'object' ? (kabObj.KOTA || '') : String(kabObj || '');
          const kecName = item['NAMA KECAMATAN'] || '';
          if (shortCode && !kecMap.has(shortCode)) {
            const ent = {
              code: shortCode,
              kab: kabName.trim(),
              kec: kecName.trim()
            };
            kecMap.set(shortCode, ent);
            masterByCode.set(shortCode, ent);
            const nameKey = `${ent.kab}_${ent.kec}`.toUpperCase().replace(/[^A-Z0-9]/g, '');
            masterByName.set(nameKey, ent);
          }
        }
      }
      masterKecamatan = Array.from(kecMap.values());
      console.log(`[Audit] Master wilayah dimuat: ${masterKecamatan.length} kecamatan Aceh.`);
    } catch (e) {
      console.warn('[Audit] Gagal memuat KODE WILAYAH.json:', e);
    }
  }

  loadMasterWilayah();

  // Load Database URL SIGA
  async function loadUrlDatabases() {
    try {
      const [bRes, tRes] = await Promise.all([
        fetch('url-bulanan.json'),
        fetch('url-tahunan.json')
      ]);
      if (bRes.ok) bulananUrls = await bRes.json();
      if (tRes.ok) tahunanUrls = await tRes.json();
      console.log(`[Audit] Database URL dimuat: ${bulananUrls.length} bulanan, ${tahunanUrls.length} tahunan.`);
    } catch (err) {
      console.warn('[Audit] Gagal memuat database URL:', err);
    }
  }

  loadUrlDatabases();

  // Helper encode hash URL aman
  function safeUrlHash(url) {
    try {
      return btoa(encodeURIComponent(url || '').replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode('0x' + p1);
      }));
    } catch (e) {
      return (url || '').split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0).toString();
    }
  }

  // Helper pencari URL SIGA yang cocok dengan Nama Tabel dan Tipe Submenu
  function findTableUrl(tableName, tipe = '', isTahunan = false) {
    const db = isTahunan ? tahunanUrls : bulananUrls;
    const cleanTable = (tableName || '').trim().toLowerCase();
    const cleanTipe = (tipe || '').trim().toLowerCase();

    // 1. Coba cari match persis Nama dan tipe (misal dallap)
    if (cleanTipe && Array.isArray(db)) {
      const matchWithTipe = db.find(item => {
        const nameMatch = (item.Nama || '').toLowerCase() === cleanTable;
        const urlMatch = (item.url || '').toLowerCase().includes(cleanTipe);
        return nameMatch && urlMatch;
      });
      if (matchWithTipe && matchWithTipe.url) return matchWithTipe.url;
    }

    // 2. Coba cari match persis Nama di db
    if (Array.isArray(db)) {
      const matchName = db.find(item => (item.Nama || '').toLowerCase() === cleanTable);
      if (matchName && matchName.url) return matchName.url;
    }

    // 3. Fallback di db seberang
    const otherDb = isTahunan ? bulananUrls : tahunanUrls;
    if (Array.isArray(otherDb)) {
      const matchOther = otherDb.find(item => {
        const nameMatch = (item.Nama || '').toLowerCase() === cleanTable;
        if (cleanTipe) return nameMatch && (item.url || '').toLowerCase().includes(cleanTipe);
        return nameMatch;
      });
      if (matchOther && matchOther.url) return matchOther.url;
    }

    // 4. Default fallback SIGA URL
    return `https://newsiga-siga.kemendukbangga.go.id/#/dallapDetail/Dallap-Bulanan/${tableName}`;
  }

  // ── 2. Event Listeners: File Picker & Drag-and-Drop ────
  btnChooseFolder.addEventListener('click', () => {
    folderInput.click();
  });

  btnReselectFolder.addEventListener('click', () => {
    folderInput.click();
  });

  folderInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    await processFiles(files);
  });

  // Drag and Drop
  ['dragenter', 'dragover'].forEach(name => {
    dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-over');
    });
  });

  dropzone.addEventListener('drop', async (e) => {
    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    showLoadingState('Membaca folder...', 'Menelusuri direktori...');
    try {
      const files = await getFilesFromDataTransfer(items);
      if (files.length === 0) {
        showToast('Tidak ada file Excel (.xlsx) yang ditemukan di folder ini.', 'info');
        showDropzoneState();
        return;
      }
      await processFiles(files);
    } catch (err) {
      console.error('Error membaca drop folder:', err);
      showToast('Gagal membaca folder: ' + err.message, 'danger');
      showDropzoneState();
    }
  });

  // Recursive Reader untuk Drag & Drop direktori
  async function getFilesFromDataTransfer(items) {
    const files = [];
    async function traverseEntry(entry, path = '') {
      if (entry.isFile) {
        const file = await new Promise(resolve => entry.file(resolve));
        file.customRelativePath = path + file.name;
        files.push(file);
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const readBatch = () => new Promise(resolve => dirReader.readEntries(resolve));
        let entries;
        do {
          entries = await readBatch();
          for (const child of entries) {
            await traverseEntry(child, path + entry.name + '/');
          }
        } while (entries && entries.length > 0);
      }
    }

    const promises = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
      if (entry) {
        promises.push(traverseEntry(entry));
      }
    }
    await Promise.all(promises);
    return files;
  }

  // ── 3. File Processing & Parsing Engine ────────────────
  function showLoadingState(title, detail) {
    dropzoneSection.style.display = 'none';
    dashboardSection.style.display = 'none';
    loadingSection.style.display = 'flex';
    loadingTitle.textContent = title;
    loadingDetail.textContent = detail;
    loadingFill.style.width = '30%';
  }

  function showDropzoneState() {
    loadingSection.style.display = 'none';
    dashboardSection.style.display = 'none';
    dropzoneSection.style.display = 'flex';
    btnReselectFolder.style.display = 'none';
    btnCopySummary.style.display = 'none';
    btnExportCsv.style.display = 'none';
  }

  function showDashboardState() {
    loadingSection.style.display = 'none';
    dropzoneSection.style.display = 'none';
    dashboardSection.style.display = 'block';
    btnReselectFolder.style.display = 'inline-flex';
    btnCopySummary.style.display = 'inline-flex';
    btnExportCsv.style.display = 'inline-flex';
  }

  // Natural Sort untuk Tabel: Tabel4A < Tabel4B < Tabel5A < Tabel11 < Tabel16
  function naturalSortTables(a, b) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  }

  // Helper Sanitasi Tampilan
  function formatTitle(str) {
    if (!str) return '';
    return str.replace(/_/g, ' ')
              .toLowerCase()
              .replace(/\b[a-z]/g, c => c.toUpperCase());
  }

  async function processFiles(files) {
    showLoadingState('Sedang memindai file...', `Memeriksa ${files.length} file...`);
    await new Promise(r => setTimeout(r, 60)); // Yield to paint

    // Filter spreadsheet
    const validSpreadsheetFiles = files.filter(f => {
      const name = f.name || '';
      return !name.startsWith('.') &&
             !name.startsWith('~$') &&
             /\.(xlsx|xls|csv)$/i.test(name);
    });

    if (validSpreadsheetFiles.length === 0) {
      showToast('Tidak ada file Excel (.xlsx / .xls) yang valid.', 'info');
      showDropzoneState();
      return;
    }

    loadingFill.style.width = '60%';
    loadingDetail.textContent = `Mengurai ${validSpreadsheetFiles.length} file tabel...`;
    await new Promise(r => setTimeout(r, 60));

    // Reset Data
    parsedFiles = [];
    entityMap = {};
    tableSummary = {};
    totalMissingFiles = 0;

    // Deteksi nama folder root
    const samplePath = validSpreadsheetFiles[0].customRelativePath || validSpreadsheetFiles[0].webkitRelativePath || '';
    if (samplePath.includes('/')) {
      folderName = samplePath.split('/')[0];
    } else {
      folderName = 'Folder Pilihan';
    }

    const tableSet = new Set();

    // Regex pengurai SIGA standar:
    // Format: 0105-Februari-2026-ACEH_SELATAN-dallap-MEUKEK-Tabel7C.xlsx
    // atau:   0105-Februari-2026-ACEH_SELATAN-dallap-MEUKEK (dalam folder Tabel7C/)
    const fullRegex = /^([0-9]{3,6})-([^-]+)-([0-9]{4})-([^-]+)-([^-]+)-(.*?)-(Tabel[0-9A-Za-z_]+)\.xlsx?$/i;
    const tableSuffixRegex = /-(Tabel[0-9A-Za-z_]+)\.xlsx?$/i;

    for (const file of validSpreadsheetFiles) {
      const fileName = file.name;
      const fullPath = file.customRelativePath || file.webkitRelativePath || fileName;
      
      // Deteksi nama tabel
      let tableName = '';
      let m = fileName.match(fullRegex);

      if (m) {
        tableName = m[7];
      } else {
        const mSuffix = fileName.match(tableSuffixRegex);
        if (mSuffix) {
          tableName = mSuffix[1];
        } else {
          // Cek nama folder orang tua (misal folder Tabel11/)
          const parts = fullPath.split(/[/\\]/);
          if (parts.length >= 2) {
            const parentDir = parts[parts.length - 2];
            if (/^Tabel/i.test(parentDir)) {
              tableName = parentDir;
            }
          }
        }
      }

      if (!tableName) {
        tableName = 'Lainnya';
      }

      tableSet.add(tableName);

      // Ekstraksi Entity / Kecamatan
      let code = '';
      let kab = '';
      let kec = '';
      let periode = '';
      let tahun = '';
      let tipe = '';

      if (m) {
        code = m[1];
        periode = m[2];
        tahun = m[3];
        kab = m[4];
        tipe = m[5] || 'dallap';
        kec = m[6];

        if (!detectedPeriode && periode) detectedPeriode = periode;
        if (!detectedTahun && tahun) detectedTahun = tahun;
        if (!detectedTipe && tipe) detectedTipe = tipe;
      } else {
        // Fallback: hapus suffix tabel dan ekstensi
        const cleanName = fileName.replace(tableSuffixRegex, '').replace(/\.[^.]+$/, '');
        const codeMatch = cleanName.match(/^([0-9]{3,6})[-_ ]/);
        code = codeMatch ? codeMatch[1] : '';
        kec = cleanName;
        kab = 'Wilayah Terdeteksi';
        tipe = 'dallap';
      }

      // Normalisasi kode kecamatan (misal 030318 -> 0318 jika 6 digit)
      let normCode = code;
      if (normCode.length === 6 && masterByCode.has(normCode.slice(2))) {
        normCode = normCode.slice(2);
      } else if (normCode.length === 6 && normCode.slice(0, 2) === normCode.slice(2, 4)) {
        normCode = normCode.slice(2);
      }

      // Normalisasi nama kecamatan: buang prefix rekap-/detail-
      const normKec = kec.replace(/^(rekap|detail)[-_ ]+/i, '').replace(/_/g, ' ').trim();
      const normKab = kab.replace(/_/g, ' ').trim();

      // Cocokkan dengan master kecamatan untuk standardisasi canonical key
      let matchedMaster = masterByCode.get(normCode);
      if (!matchedMaster && normKab) {
        const nameKey = `${normKab}_${normKec}`.toUpperCase().replace(/[^A-Z0-9]/g, '');
        matchedMaster = masterByName.get(nameKey);
      }

      let entityKey = '';
      if (matchedMaster) {
        entityKey = `${matchedMaster.code}-${matchedMaster.kab}-${matchedMaster.kec}`.toUpperCase();
        code = matchedMaster.code;
        kab = formatTitle(matchedMaster.kab);
        kec = formatTitle(matchedMaster.kec);
      } else {
        entityKey = `${normCode}-${normKab}-${normKec}`.toUpperCase();
        code = normCode;
        kab = formatTitle(normKab);
        kec = formatTitle(normKec);
      }

      if (!entityMap[entityKey]) {
        entityMap[entityKey] = {
          key: entityKey,
          code: code,
          kab: kab,
          kec: kec,
          periode: periode || detectedPeriode,
          tahun: tahun || detectedTahun,
          tipe: tipe || detectedTipe || 'dallap',
          tables: {},
          missingTables: [],
          isComplete: false
        };
      }

      entityMap[entityKey].tables[tableName] = {
        name: fileName,
        path: fullPath,
        size: file.size,
        lastModified: file.lastModified
      };

      parsedFiles.push({
        file,
        tableName,
        entityKey
      });
    }

    // Urutkan daftar tabel yang ditemukan
    detectedTables = Array.from(tableSet).sort(naturalSortTables);

    // Hitung Kelengkapan per Entitas & per Tabel
    loadingFill.style.width = '85%';
    loadingDetail.textContent = 'Membandingkan matriks kelengkapan...';
    await new Promise(r => setTimeout(r, 60));

    // Inisialisasi tableSummary
    for (const t of detectedTables) {
      tableSummary[t] = {
        name: t,
        foundCount: 0,
        missingCount: 0,
        missingEntities: []
      };
    }

    // Jika master kecamatan ada dan data ini adalah Aceh, cross-check dengan master
    const detectedCodes = new Set(Object.values(entityMap).map(e => e.code).filter(Boolean));
    const isAcehDataset = detectedCodes.size > 50 && Array.from(detectedCodes).some(c => c.startsWith('01') || c.startsWith('02'));

    if (isAcehDataset && masterKecamatan.length > 0) {
      // Masukkan kecamatan dari master yang mungkin 0 file sama sekali di semua tabel
      for (const mk of masterKecamatan) {
        const canonicalKey = `${mk.code}-${mk.kab}-${mk.kec}`.toUpperCase();
        if (!entityMap[canonicalKey]) {
          entityMap[canonicalKey] = {
            key: canonicalKey,
            code: mk.code,
            kab: formatTitle(mk.kab),
            kec: formatTitle(mk.kec),
            periode: detectedPeriode || 'Februari',
            tahun: detectedTahun || '2026',
            tipe: detectedTipe || 'dallap',
            tables: {},
            missingTables: [],
            isComplete: false
          };
        }
      }
    }

    // Evaluasi kelengkapan tiap entitas
    const allEntities = Object.values(entityMap);
    let incompleteEntityCount = 0;

    for (const ent of allEntities) {
      ent.missingTables = [];
      for (const t of detectedTables) {
        if (ent.tables[t]) {
          tableSummary[t].foundCount++;
        } else {
          ent.missingTables.push(t);
          tableSummary[t].missingCount++;
          tableSummary[t].missingEntities.push(ent);
          totalMissingFiles++;
        }
      }
      ent.isComplete = (ent.missingTables.length === 0);
      if (!ent.isComplete) {
        incompleteEntityCount++;
      }
    }

    // Urutkan entitas di entityMap: yang paling banyak missing di atas, lalu abjad kode
    allEntities.sort((a, b) => {
      if (b.missingTables.length !== a.missingTables.length) {
        return b.missingTables.length - a.missingTables.length;
      }
      return (a.code || '').localeCompare(b.code || '');
    });

    loadingFill.style.width = '100%';
    await new Promise(r => setTimeout(r, 60));

    // Render Dashboard
    renderDashboard();
    showDashboardState();
    showToast(`Berhasil memindai ${parsedFiles.length} file di ${detectedTables.length} tabel.`, 'success');
  }

  // ── 4. Render Dashboard & KPI Metrics ─────────────────
  function renderDashboard() {
    const allEntities = Object.values(entityMap);
    const totalEntities = allEntities.length;
    const missingEntities = allEntities.filter(e => !e.isComplete);
    const completeEntities = allEntities.filter(e => e.isComplete);

    const totalPossibleFiles = totalEntities * detectedTables.length;
    const totalActualFiles = parsedFiles.length;
    const completenessPct = totalPossibleFiles > 0 
      ? ((totalActualFiles / totalPossibleFiles) * 100).toFixed(1)
      : 100;

    // KPI Values
    statTotalFiles.textContent = parsedFiles.length.toLocaleString('id-ID');
    statFolderName.textContent = folderName;
    statTotalTables.textContent = detectedTables.length;
    statTablesList.textContent = detectedTables.join(', ');
    statTotalItems.textContent = totalEntities;
    statMasterInfo.textContent = masterKecamatan.length > 0 ? `Target Master: ${masterKecamatan.length} kec.` : 'Entitas terdeteksi';
    
    statMissingCount.textContent = missingEntities.length;
    statMissingFilesTotal.textContent = `${totalMissingFiles} file belum terunduh`;
    statCompletenessPct.textContent = `${completenessPct}%`;
    statCompletenessBar.style.width = `${completenessPct}%`;

    // Alert Banner Styling
    if (missingEntities.length > 0) {
      alertBanner.className = 'alert-banner';
      alertTitle.textContent = `Ditemukan ${missingEntities.length} kecamatan dengan file kurang (${totalMissingFiles} file)!`;
      alertDesc.textContent = `Beberapa tabel belum memiliki data lengkap untuk kecamatan di bawah. Anda dapat menyalin daftarnya atau menyiapkannya untuk di-download ulang.`;
      btnCopyMissingOnly.style.display = 'inline-flex';
      btnQueueRetry.style.display = 'inline-flex';
      sectionTopMissing.style.display = 'block';
    } else {
      alertBanner.className = 'alert-banner all-complete';
      alertTitle.textContent = `🎉 Sempurna! Semua file unduhan telah lengkap 100%!`;
      alertDesc.textContent = `Seluruh ${totalEntities} kecamatan memiliki file lengkap di seluruh ${detectedTables.length} tabel. Tidak ada file yang terlewat.`;
      btnCopyMissingOnly.style.display = 'none';
      btnQueueRetry.style.display = 'none';
      sectionTopMissing.style.display = 'none';
    }

    // Counts in Tabs
    tabCountMissing.textContent = missingEntities.length;
    tabCountAll.textContent = totalEntities;
    tabCountComplete.textContent = completeEntities.length;

    // Render Section 1: Top Missing Kecamatan
    renderTopMissingGrid(missingEntities);

    // Render Section 2: Table Summary Grid
    renderTableSummaryGrid();

    // Populate Filters
    populateFilterDropdowns(allEntities);

    // Default Filter Tab: jika ada missing, tampilkan tab missing dulu
    activeTabFilter = missingEntities.length > 0 ? 'missing' : 'all';
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-filter') === activeTabFilter);
    });

    // Render Matrix Table
    renderMatrixTable();
  }

  // ── 5. Render Top Missing Grid ─────────────────────────
  function renderTopMissingGrid(missingEntities) {
    topMissingBadge.textContent = `${missingEntities.length} Kecamatan`;
    topMissingGrid.innerHTML = '';

    if (missingEntities.length === 0) return;

    missingEntities.forEach(ent => {
      const card = document.createElement('div');
      card.className = 'missing-card';
      
      const chipsHtml = ent.missingTables.map(t => 
        `<span class="table-chip-missing">✕ ${t}</span>`
      ).join('');

      card.innerHTML = `
        <div class="missing-card-header">
          <div>
            <span class="missing-card-code">${ent.code || '-'}</span>
            <span class="missing-card-title">${ent.kec || ent.key}</span>
          </div>
          <span class="missing-badge-count">Kurang ${ent.missingTables.length} Tabel</span>
        </div>
        <div class="missing-card-kab">📍 ${ent.kab || 'Kabupaten'}</div>
        <div class="missing-table-chips">
          ${chipsHtml}
        </div>
      `;
      topMissingGrid.appendChild(card);
    });
  }

  // ── 6. Render Table Summary Grid ──────────────────────
  function renderTableSummaryGrid() {
    tableSummaryGrid.innerHTML = '';
    const totalEntities = Object.keys(entityMap).length;

    for (const t of detectedTables) {
      const s = tableSummary[t];
      const isComplete = (s.missingCount === 0);
      const pct = totalEntities > 0 ? ((s.foundCount / totalEntities) * 100).toFixed(0) : 100;

      const card = document.createElement('div');
      card.className = `table-summary-card ${isComplete ? 'complete' : 'incomplete'}`;
      card.innerHTML = `
        <div class="table-card-top">
          <span class="table-card-name">${t}</span>
          <span class="table-card-badge ${isComplete ? 'badge-complete' : 'badge-missing'}">
            ${isComplete ? '✅ Lengkap' : `❌ Kurang ${s.missingCount}`}
          </span>
        </div>
        <div class="table-card-count">
          ${s.foundCount} / ${totalEntities} file (${pct}%)
        </div>
        <div class="table-card-bar">
          <div class="table-card-fill ${isComplete ? '' : 'incomplete'}" style="width: ${pct}%;"></div>
        </div>
      `;
      tableSummaryGrid.appendChild(card);
    }
  }

  // ── 7. Filter & Search Handlers ───────────────────────
  function populateFilterDropdowns(allEntities) {
    // Populate Kabupaten
    const kabSet = new Set(allEntities.map(e => e.kab).filter(Boolean));
    const sortedKab = Array.from(kabSet).sort((a, b) => a.localeCompare(b));
    selectFilterKab.innerHTML = '<option value="">Semua Kabupaten</option>' +
      sortedKab.map(k => `<option value="${k}">${k}</option>`).join('');

    // Populate Tables
    selectFilterTable.innerHTML = '<option value="">Semua Tabel</option>' +
      detectedTables.map(t => `<option value="${t}">${t}</option>`).join('');
  }

  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTabFilter = tab.getAttribute('data-filter');
      renderMatrixTable();
    });
  });

  inputSearch.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    btnClearSearch.style.display = searchQuery ? 'block' : 'none';
    renderMatrixTable();
  });

  btnClearSearch.addEventListener('click', () => {
    inputSearch.value = '';
    searchQuery = '';
    btnClearSearch.style.display = 'none';
    renderMatrixTable();
  });

  selectFilterKab.addEventListener('change', (e) => {
    selectedKab = e.target.value;
    renderMatrixTable();
  });

  selectFilterTable.addEventListener('change', (e) => {
    selectedTable = e.target.value;
    renderMatrixTable();
  });

  // ── 8. Render Matrix Table ────────────────────────────
  function renderMatrixTable() {
    // Table Header
    let theadHtml = `
      <tr>
        <th class="sticky-col-1" style="width: 36px; text-align: center;">#</th>
        <th class="sticky-col-2" style="width: 54px;">Kode</th>
        <th class="sticky-col-3" style="width: 140px;">Kabupaten</th>
        <th style="min-width: 160px;">Kecamatan</th>
        <th style="text-align: center; width: 110px;">Status</th>
    `;

    for (const t of detectedTables) {
      if (selectedTable && selectedTable !== t) continue;
      theadHtml += `<th style="text-align: center; min-width: 75px;" title="${t}">${t}</th>`;
    }

    theadHtml += `</tr>`;
    matrixThead.innerHTML = theadHtml;

    // Filter data
    const allEntities = Object.values(entityMap);
    const filtered = allEntities.filter(ent => {
      // Tab filter
      if (activeTabFilter === 'missing' && ent.isComplete) return false;
      if (activeTabFilter === 'complete' && !ent.isComplete) return false;

      // Kabupaten filter
      if (selectedKab && ent.kab !== selectedKab) return false;

      // Table specific missing filter
      if (selectedTable && !ent.missingTables.includes(selectedTable) && activeTabFilter === 'missing') return false;

      // Search query
      if (searchQuery) {
        const text = `${ent.code} ${ent.kab} ${ent.kec} ${ent.key}`.toLowerCase();
        if (!text.includes(searchQuery)) return false;
      }

      return true;
    });

    tableInfo.textContent = `Menampilkan ${filtered.length} dari ${allEntities.length} kecamatan`;

    // Table Body
    let tbodyHtml = '';
    filtered.forEach((ent, idx) => {
      const isMissing = !ent.isComplete;
      tbodyHtml += `<tr class="${isMissing ? 'row-incomplete' : ''}">
        <td class="sticky-col-1 cell-center" style="color: var(--text-muted); font-size: 11px;">${idx + 1}</td>
        <td class="sticky-col-2 cell-code">${ent.code || '-'}</td>
        <td class="sticky-col-3 cell-kab" title="${ent.kab}">${ent.kab || '-'}</td>
        <td class="cell-kec" title="${ent.kec}"><strong>${ent.kec || ent.key}</strong></td>
        <td class="cell-center">
          ${isMissing 
            ? `<span class="missing-badge-count" style="font-size: 10px; padding: 2px 6px;">Kurang ${ent.missingTables.length}</span>` 
            : `<span style="color: var(--success); font-weight: 700; font-size: 11px;">✅ Lengkap</span>`}
        </td>
      `;

      for (const t of detectedTables) {
        if (selectedTable && selectedTable !== t) continue;
        const fileObj = ent.tables[t];
        if (fileObj) {
          tbodyHtml += `<td class="cell-center">
            <span class="status-ok" title="Ada: ${fileObj.name} (${fileObj.path})">✅</span>
          </td>`;
        } else {
          tbodyHtml += `<td class="cell-center">
            <span class="status-miss" title="Kurang: File ${t} belum ada untuk kecamatan ini">❌</span>
          </td>`;
        }
      }

      tbodyHtml += `</tr>`;
    });

    if (filtered.length === 0) {
      const colSpan = 5 + (selectedTable ? 1 : detectedTables.length);
      tbodyHtml = `<tr><td colspan="${colSpan}" style="text-align: center; padding: 36px; color: var(--text-muted);">
        Tidak ada data yang cocok dengan filter / pencarian ini.
      </td></tr>`;
    }

    matrixTbody.innerHTML = tbodyHtml;
  }

  // ── 9. Actions: Salin Laporan, Export CSV, Queue Retry ─

  // Salin Ringkasan Komprehensif (Format Markdown / WhatsApp)
  btnCopySummary.addEventListener('click', () => {
    const allEntities = Object.values(entityMap);
    const missingEntities = allEntities.filter(e => !e.isComplete);
    const totalEntities = allEntities.length;

    let report = `📊 LAPORAN AUDIT HASIL UNDUHAN TABEL SIGA\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `📁 Folder             : ${folderName}\n`;
    report += `📄 Total File Fisik   : ${parsedFiles.length.toLocaleString('id-ID')} file\n`;
    report += `📊 Total Tabel        : ${detectedTables.length} (${detectedTables.join(', ')})\n`;
    report += `🗺️ Total Kecamatan    : ${totalEntities}\n`;
    report += `✅ Kecamatan Lengkap  : ${totalEntities - missingEntities.length}\n`;
    report += `❌ Kecamatan Kurang   : ${missingEntities.length} (${totalMissingFiles} file belum unduh)\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (missingEntities.length > 0) {
      report += `🚨 DAFTAR KECAMATAN YANG BELUM LENGKAP:\n`;
      missingEntities.forEach((ent, i) => {
        report += `${i + 1}. [${ent.code || '----'}] ${ent.kab} — ${ent.kec}\n`;
        report += `   Kurang di ${ent.missingTables.length} Tabel: ${ent.missingTables.join(', ')}\n`;
      });
      report += `\n`;
    }

    report += `📋 RINGKASAN JUMLAH FILE PER TABEL:\n`;
    for (const t of detectedTables) {
      const s = tableSummary[t];
      report += `• ${t.padEnd(10)}: ${s.foundCount}/${totalEntities} file ${s.missingCount > 0 ? `(Kurang ${s.missingCount})` : '✅ Lengkap'}\n`;
    }

    report += `\nDiperiksa otomatis menggunakan SIGA Smart Downloader v2.0.`;

    navigator.clipboard.writeText(report).then(() => {
      showToast('Laporan audit berhasil disalin ke clipboard!', 'success');
    }).catch(err => {
      showToast('Gagal menyalin: ' + err.message, 'danger');
    });
  });

  // Salin Kecamatan Kurang Saja (List Singkat)
  btnCopyMissingOnly.addEventListener('click', () => {
    const missingEntities = Object.values(entityMap).filter(e => !e.isComplete);
    if (missingEntities.length === 0) {
      showToast('Semua kecamatan sudah lengkap!', 'info');
      return;
    }

    const lines = missingEntities.map((ent, i) => 
      `${i + 1}. ${ent.code ? `[${ent.code}] ` : ''}${ent.kab} - ${ent.kec} (Kurang: ${ent.missingTables.join(', ')})`
    );

    const text = `Daftar ${missingEntities.length} Kecamatan Kurang Unduh:\n` + lines.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      showToast(`${missingEntities.length} kecamatan kurang berhasil disalin!`, 'success');
    });
  });

  // Export CSV Matriks
  btnExportCsv.addEventListener('click', () => {
    const allEntities = Object.values(entityMap);
    const headers = ['No', 'Kode', 'Kabupaten', 'Kecamatan', 'Status', 'Jumlah_Kurang', 'Tabel_Kurang', ...detectedTables];
    const rows = [headers];

    allEntities.forEach((ent, i) => {
      const row = [
        i + 1,
        ent.code || '',
        `"${(ent.kab || '').replace(/"/g, '""')}"`,
        `"${(ent.kec || '').replace(/"/g, '""')}"`,
        ent.isComplete ? 'LENGKAP' : 'KURANG',
        ent.missingTables.length,
        `"${ent.missingTables.join('; ')}"`
      ];

      for (const t of detectedTables) {
        row.push(ent.tables[t] ? 'ADA' : 'TIDAK_ADA');
      }

      rows.push(row);
    });

    const csvContent = '\uFEFF' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Audit_SIGA_${folderName || 'Hasil'}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('File CSV berhasil diunduh.', 'success');
  });

  // ── 10. Masukkan File Kurang ke Antrean Download (Status Gagal) ──
  btnQueueRetry.addEventListener('click', () => {
    const missingItems = [];
    const missingKecSet = new Set();
    const missingTableSet = new Set();
    const missingKabSet = new Set();

    for (const ent of Object.values(entityMap)) {
      if (ent.isComplete) continue;
      for (const t of ent.missingTables) {
        missingItems.push({ ent, tableName: t });
        missingKecSet.add(ent.kec || ent.key);
        missingTableSet.add(t);
        if (ent.kab) missingKabSet.add(ent.kab);
      }
    }

    if (missingItems.length === 0) {
      showToast('Semua file unduhan sudah lengkap 100%! Tidak ada yang perlu di-retry.', 'success');
      return;
    }

    // Isi ringkasan di modal
    if (modalTotalMissingFiles) modalTotalMissingFiles.textContent = missingItems.length;
    if (modalTotalMissingKecs) modalTotalMissingKecs.textContent = missingKecSet.size;
    if (modalMissingKecsText) modalMissingKecsText.textContent = `${Array.from(missingKabSet).join(', ')} (${missingKecSet.size} kecamatan)`;
    if (modalMissingTablesText) modalMissingTablesText.textContent = Array.from(missingTableSet).sort(naturalSortTables).join(', ');

    // Buka modal
    if (modalQueueRetry) modalQueueRetry.style.display = 'flex';
  });

  // Modal Close Handlers
  btnCloseModal?.addEventListener('click', () => {
    if (modalQueueRetry) modalQueueRetry.style.display = 'none';
  });

  btnCancelModal?.addEventListener('click', () => {
    if (modalQueueRetry) modalQueueRetry.style.display = 'none';
  });

  // Modal Confirm Handler
  btnConfirmQueueFail?.addEventListener('click', async () => {
    const missingItems = [];
    for (const ent of Object.values(entityMap)) {
      if (ent.isComplete) continue;
      for (const t of ent.missingTables) {
        missingItems.push({ ent, tableName: t });
      }
    }

    if (missingItems.length === 0) return;

    btnConfirmQueueFail.disabled = true;
    btnConfirmQueueFail.textContent = '⏳ Memproses antrean...';

    try {
      if (!window.chrome || !chrome.storage || !chrome.storage.local) {
        throw new Error('Akses storage Chrome tidak tersedia.');
      }

      // 1. Bersihkan antrean lama jika opsi dicentang
      const shouldClean = checkCleanOldQueue ? checkCleanOldQueue.checked : true;
      if (shouldClean) {
        const allData = await new Promise(r => chrome.storage.local.get(null, r));
        const keysToRemove = Object.keys(allData).filter(k => k.startsWith('tabdownload_') || k.startsWith('auto_'));
        if (keysToRemove.length > 0) {
          await new Promise(r => chrome.storage.local.remove(keysToRemove, r));
          console.log(`[Audit] Berhasil membersihkan ${keysToRemove.length} antrean lama.`);
        }
      }

      // 2. Siapkan entry tabdownload_* dengan status 'fail' untuk setiap file kurang
      const toSet = {};
      const isTahunan = detectedPeriode && /^\d{4}$/.test(detectedPeriode);

      missingItems.forEach((item, idx) => {
        const ent = item.ent;
        const tableName = item.tableName;
        const tipe = ent.tipe || detectedTipe || 'dallap';
        const targetUrl = findTableUrl(tableName, tipe, isTahunan);
        const urlHash = safeUrlHash(targetUrl);
        const progressKey = `tabdownload_${urlHash}_${idx}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

        const kabUpper = (ent.kab || '').toUpperCase();
        const kecUpper = (ent.kec || '').toUpperCase();
        const periodeVal = ent.periode || detectedPeriode || 'Februari';
        const tahunVal = ent.tahun || detectedTahun || '2026';
        const kabCode = ent.code ? ent.code.slice(0, 2) : '';
        const jenisLaporanVal = (tipe === 'pelayanan' || tipe === 'yankb') ? 'rekap' : '';

        const renameContext = {
          menu: 'laporan',
          submenu: tipe,
          periode: periodeVal,
          tahun: tahunVal,
          kab: kabUpper,
          kec: kecUpper,
          kabCode: kabCode,
          kecCode: ent.code || '',
          jenisLaporan: jenisLaporanVal,
          tabelName: tableName,
          folderMode: 'tabel'
        };

        const dataSingle = {
          downloadQueue: [
            {
              url: targetUrl,
              kota: kabUpper,
              kecamatan: kecUpper,
              sasaran: '',
              renameContext: renameContext
            }
          ],
          periode: periodeVal,
          tahun: tahunVal,
          selectedCities: kabUpper,
          kecamatan: kecUpper,
          jenisLaporan: jenisLaporanVal,
          faskes: '',
          desa: '',
          rw: '',
          sasaran: '',
          menu: 'laporan',
          submenu: tipe,
          progressKey: progressKey,
          openDelay: 5
        };

        toSet[progressKey] = {
          url: targetUrl,
          status: 'fail', // <-- GAGAL! Ini kunci agar muncul di tombol Retry Semua Gagal
          totalFiles: 1,
          filesCompleted: 0,
          fileAkhir: `Kurang di disk: ${tableName} (${kabUpper} — ${kecUpper})`,
          urlIndex: idx,
          kota: kabUpper,
          kecamatan: kecUpper,
          desa: '',
          faskes: '',
          dataSingle: dataSingle
        };
      });

      // 3. Simpan flag navigasi agar saat popup dibuka langsung ke tab download progress
      toSet['openDownloadTabOnLoad'] = true;
      toSet['auditRetryQueue'] = missingItems.map(m => ({
        code: m.ent.code,
        kab: m.ent.kab,
        kec: m.ent.kec,
        table: m.tableName
      }));

      await new Promise((resolve, reject) => {
        chrome.storage.local.set(toSet, () => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve();
        });
      });

      if (modalQueueRetry) modalQueueRetry.style.display = 'none';
      showToast(`🎉 Sukses! ${missingItems.length} file kurang dimasukkan ke antrean sebagai GAGAL. Buka popup ekstensi lalu klik 'Retry Semua Gagal'!`, 'success');

      // Update tampilan tombol di audit.html
      btnQueueRetry.innerHTML = `✅ ${missingItems.length} File di Antrean Ekstensi`;
      btnQueueRetry.style.background = '#059669';
    } catch (err) {
      console.error('Error menyimpan ke antrean:', err);
      showToast('Gagal menyimpan ke antrean: ' + err.message, 'danger');
    } finally {
      btnConfirmQueueFail.disabled = false;
      btnConfirmQueueFail.textContent = '📥 Masukkan ke Antrean Ekstensi (Status Gagal)';
    }
  });

})();
