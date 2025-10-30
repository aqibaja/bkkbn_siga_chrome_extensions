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
        // Cek apakah tab sudah dibatalkan
        const autoKey = `auto_${sender.tab.id}`;
        chrome.storage.local.get([autoKey], res => {
            const autoData = res[autoKey];
            if (!autoData || autoData.cancelled) {
                console.log('⛔ Navigasi dibatalkan (automation cancelled).');
                return;
            }
            chrome.tabs.update(sender.tab.id, { url: message.url }, (tab) => {
                setTimeout(() => {
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: () => location.reload()
                    });
                }, 1000);
            });
        });
    }

    if (message.action === 'closeTab') {
        if (sender && sender.tab && sender.tab.id) {
            console.log('🗂 Menutup tab automation selesai:', sender.tab.id);
            chrome.tabs.remove(sender.tab.id, () => {
                if (chrome.runtime.lastError) {
                    console.warn('Gagal menutup tab:', chrome.runtime.lastError.message);
                }
            });
        } else {
            console.warn('closeTab: sender.tab.id tidak tersedia');
        }
    }

    // Handler untuk retry failed items
    if (message.action === 'retryFailedUrl') {
        const { url, targetKey } = message;
        console.log('🔄 Retrying failed items for URL:', url);

        // Ekstrak tab ID dari key
        const tabId = parseInt(targetKey.replace('auto_', ''));

        // Reload tab tersebut
        chrome.tabs.reload(tabId, {}, () => {
            if (chrome.runtime.lastError) {
                console.warn('Tab tidak ditemukan, mungkin sudah tertutup');
                // Jika tab sudah tertutup, buka tab baru
                chrome.tabs.create({ url: url, active: false }, newTab => {
                    // Pindahkan data automation ke tab baru
                    chrome.storage.local.get([targetKey], result => {
                        if (result[targetKey]) {
                            chrome.storage.local.remove([targetKey], () => {
                                chrome.storage.local.set({
                                    [`auto_${newTab.id}`]: result[targetKey]
                                });
                            });
                        }
                    });
                });
            } else {
                console.log('✅ Tab reloaded untuk retry');
            }
        });

        sendResponse({ success: true });
    }

    // Handler pembatalan berdasarkan URL
    if (message.action === 'cancelUrl') {
        const { url } = message;
        chrome.storage.local.get(null, data => {
            const autoKeys = Object.keys(data).filter(k => k.startsWith('auto_'));
            autoKeys.forEach(key => {
                const autoData = data[key];
                if (autoData && autoData.downloadQueue && autoData.downloadQueue[0] && autoData.downloadQueue[0].url === url) {
                    // Tandai cancelled agar content script berhenti
                    chrome.storage.local.set({ [key]: { ...autoData, cancelled: true } });
                    const tabId = parseInt(key.replace('auto_', ''));
                    console.log('🛑 Membatalkan automation untuk URL:', url, 'tab:', tabId);
                    // Tutup tab
                    chrome.tabs.remove(tabId, () => {
                        if (chrome.runtime.lastError) {
                            console.warn('Gagal menutup tab saat cancel:', chrome.runtime.lastError.message);
                        }
                    });
                }
            });
        });
        sendResponse({ success: true });
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
