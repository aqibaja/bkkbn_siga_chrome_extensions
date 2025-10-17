chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    /* if (message.action === "processData") {
        const { downloadQueue, periode, selectedCities, kecamatan, jenisLaporan, faskes, desa, rw, sasaran } = message.data;
        // Group queue berdasarkan URL
        console.log("DOWNLOAD QUEUE:", downloadQueue);
        const urlToQueueMap = {};
        downloadQueue.forEach(item => {
            if (!urlToQueueMap[item.url]) urlToQueueMap[item.url] = [];
            urlToQueueMap[item.url].push(item);
        });

        Object.keys(urlToQueueMap).forEach((url, urlIdx) => {
            const queue = urlToQueueMap[url];

            // Inisialisasi progress sekali per URL
            const key = `tabdownload_${urlIdx}`;
            chrome.storage.local.set({
                [key]: {
                    url,
                    status: "downloading",
                    totalFiles: queue.length,
                    filesCompleted: 0,
                    fileAkhir: "",
                    urlIndex: urlIdx
                }
            });

            // Buka tab untuk proses
            chrome.tabs.create({ url, active: false }, tabObj => {
                chrome.storage.local.set({
                    [`auto_${tabObj.id}`]: {
                        downloadQueue: queue,
                        currentIndex: 0,
                        periode,
                        selectedCities,
                        kecamatan,
                        jenisLaporan,
                        faskes,
                        desa,
                        rw,
                        sasaran,
                        urlIndex: urlIdx
                    }
                });
            });
        });

        sendResponse({ success: true });
        return true;
    } */

    // Automation via popup submit
    if (message.action === "processData") {
        // Ambil downloadQueue (array of {kota, url}) dari popup.js
        const { downloadQueue, periode, selectedCities, kecamatan, jenisLaporan, faskes, desa, rw, sasaran } = message.data;

        // Group queue berdasarkan URL
        const urlToQueueMap = {};
        downloadQueue.forEach(item => {
            if (!urlToQueueMap[item.url]) urlToQueueMap[item.url] = [];
            urlToQueueMap[item.url].push(item);
        });

        console.log("Grouped URL to Queue Map:", urlToQueueMap);


        // Untuk setiap url, buka satu tab dan simpan queue kota untuk url itu saja di tabnya
        Object.keys(urlToQueueMap).forEach(url => {
            chrome.tabs.create({ url: url, active: false }, tabObj => {
                chrome.storage.local.set({
                    [`auto_${tabObj.id}`]: {
                        downloadQueue: urlToQueueMap[url],
                        currentIndex: 0,
                        periode,
                        selectedCities,
                        kecamatan,
                        jenisLaporan,
                        faskes,
                        desa,
                        rw,
                        sasaran
                    }
                });
            });
        });

        sendResponse({ success: true });
        return true;
    }



    // Get tab id from content/popup
    if (message.action === "getTabId") {
        sendResponse({ id: sender.tab.id });
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "navigateAndReload") {
        console.log("🔁 Navigating and forcing reload to:", message.url);
        chrome.tabs.update(sender.tab.id, { url: message.url }, (tab) => {
            // Tunggu sebentar lalu paksa reload
            setTimeout(() => {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => location.reload()
                });
            }, 1000); // delay kecil agar URL sempat berubah
        });
    }
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    const key = `auto_${tabId}`;
    const storage = await chrome.storage.local.get(["downloadQueue", "currentIndex"]);

    // Jika tab yang ditutup adalah tab automation, hapus semua data
    if (storage.downloadQueue) {
        console.log(`🛑 Tab ${tabId} ditutup, menghentikan automation`);
        await chrome.storage.local.remove([
            "downloadQueue",
            "currentIndex",
            "periode",
            "tahun",
            "selectedCities",
            "kecamatan",
            "faskes",
            "desa",
            "rw",
            "sasaran",
            "jenisLaporan"
        ]);
        chrome.storage.local.remove([key]);
    }

    // Hapus juga data spesifik tab jika ada
    chrome.storage.local.remove([key]);
});

// Tambahkan handler custom/lanjutan sesuai case lanjut
