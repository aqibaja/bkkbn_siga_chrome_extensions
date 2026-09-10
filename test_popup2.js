const downloads = [
  { filename: '/Users/aqib/Downloads/SIGA/01_Aceh_Selatan/Tabel1.xlsx' },
  { filename: '/Users/aqib/Downloads/SIGA/Provinsi/Tabel2.xlsx' }
];
const downloadedFiles = downloads.map(d => String(d.filename || d.url).replace(/[:\\/"?~<>*|]/g, "-").replace(/\s+/g, "_").trim().toLowerCase());
console.log(downloadedFiles);
