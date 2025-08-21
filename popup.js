document.getElementById("selectAll").addEventListener("click", () => {
  document.querySelectorAll("#kotaCheckboxes input[type='checkbox']").forEach(cb => cb.checked = true);
});

document.getElementById("resetAll").addEventListener("click", () => {
  document.querySelectorAll("#kotaCheckboxes input[type='checkbox']").forEach(cb => cb.checked = false);
});

document.getElementById("run").addEventListener("click", async () => {
  const rawUrls = document.getElementById("urls").value;
  const urls = rawUrls.split(/\r?\n|\u2028/).map(s => s.trim()).filter(Boolean);
  const periode = document.getElementById("periode").value;

  const kotaCheckboxes = document.querySelectorAll("#kotaCheckboxes input[type='checkbox']");
  const kotaList = [...kotaCheckboxes].filter(cb => cb.checked).map(cb => cb.value);
  const finalKotaList = kotaList.length > 0 ? kotaList : [null];

  const faskes = document.getElementById("faskes").value;
  const kecamatan = document.getElementById("kecamatan").value;
  const reportType = document.getElementById("reportType").value;

  for (const url of urls) {
    const tab = await chrome.tabs.create({ url, active: false });

    const queue = finalKotaList.map(kota => ({ url, kota }));

    await chrome.storage.local.set({
      [`auto_${tab.id}`]: {
        downloadQueue: queue,
        periode,
        kecamatan,
        faskes,
        reportType,
        currentIndex: 0
      }
    });

    await chrome.tabs.reload(tab.id);
  }
});
