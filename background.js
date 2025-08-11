chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
            "kecamatan",
            "faskes",
            "reportType"
        ]);
    }

    // Hapus juga data spesifik tab jika ada
    chrome.storage.local.remove([key]);
});