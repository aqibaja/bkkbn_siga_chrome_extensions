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
