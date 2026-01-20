// background.js (MV3 service worker)

const ALLOWED_HOST = "newsiga-siga.bkkbn.go.id";

function getHostSafe(url) {
    try {
        // handle blob:https://domain/uuid
        if (typeof url === "string" && url.startsWith("blob:")) {
            return new URL(url.slice(5)).hostname; // buang "blob:"
        }
        return new URL(url).hostname;
    } catch (e) {
        return "";
    }
}

function sanitize(s) {
    return String(s || "")
        .replace(/[:\\/\"?~<>*|]/g, "-")
        .replace(/\s+/g, "_")
        .trim();
}

// =========================
// Message handler (satu saja)
// =========================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 1) Simpan context rename dari popup
    if (message.action === "setRenameContext") {
        chrome.storage.local.set(
            {
                renameContext: message.payload || null,
                renameEnabled: true,
            },
            () => sendResponse({ ok: true })
        );
        return true;
    }

    // 2) Start automation
    if (message.action === "processData") {
        const { downloadQueue, periode, selectedCities, kecamatan, jenisLaporan, faskes, tahun, desa, rw, sasaran } = message.data;

        const urlToQueueMap = {};
        (downloadQueue || []).forEach((item) => {
            if (!item || !item.url) return;
            if (!urlToQueueMap[item.url]) urlToQueueMap[item.url] = [];
            urlToQueueMap[item.url].push(item);
        });

        Object.keys(urlToQueueMap).forEach((url) => {
            chrome.tabs.create({ url, active: false }, (tabObj) => {
                chrome.storage.local.set({
                    [`auto_${tabObj.id}`]: {
                        downloadQueue: urlToQueueMap[url],
                        currentIndex: 0,
                        periode, selectedCities, kecamatan, jenisLaporan, faskes, tahun, desa, rw, sasaran,
                        cancelled: false
                    },
                });
            });
        });

        sendResponse({ success: true });
        return true;
    }

    // 3) Get tab id (dipakai content.js)
    if (message.action === "getTabId") {
        sendResponse({ id: sender?.tab?.id });
        return true;
    }

    // 4) Navigasi & reload (dipakai content.js)
    if (message.action === "navigateAndReload") {
        const tabId = sender?.tab?.id;
        const url = message.url;

        if (!tabId || !url) {
            sendResponse({ success: false, error: "tabId/url missing" });
            return true;
        }

        const autoKey = `auto_${tabId}`;
        chrome.storage.local.get([autoKey], (res) => {
            const autoData = res[autoKey];
            if (!autoData || autoData.cancelled) return;

            chrome.tabs.update(tabId, { url }, (tab) => {
                setTimeout(() => {
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: () => location.reload(),
                    });
                }, 1000);
            });
        });

        sendResponse({ success: true });
        return true;
    }

    // 5) Close tab (dipakai content.js)
    if (message.action === "closeTab") {
        const tabId = sender?.tab?.id;

        if (!tabId) {
            sendResponse({ success: false, error: "sender.tab.id missing" });
            return true;
        }

        chrome.tabs.remove(tabId, () => {
            // Matikan mode rename setelah proses selesai
            chrome.storage.local.set({ renameEnabled: false }, () => {
                sendResponse({ success: true });
            });
        });

        return true;
    }

    // 6) Retry (dipakai popup.js)
    if (message.action === "retryFailedUrl") {
        const { url, targetKey } = message;
        const tabId = parseInt(String(targetKey || "").replace("auto_", ""), 10);

        if (!tabId) {
            sendResponse({ success: false, error: "invalid tabId" });
            return true;
        }

        chrome.tabs.reload(tabId, {}, () => {
            if (chrome.runtime.lastError) {
                chrome.tabs.create({ url, active: false }, (newTab) => {
                    chrome.storage.local.get([targetKey], (result) => {
                        if (!result[targetKey]) {
                            sendResponse({ success: false, error: "targetKey not found" });
                            return;
                        }
                        chrome.storage.local.remove([targetKey], () => {
                            chrome.storage.local.set(
                                { [`auto_${newTab.id}`]: result[targetKey] },
                                () => sendResponse({ success: true, recreated: true })
                            );
                        });
                    });
                });
            } else {
                sendResponse({ success: true, reloaded: true });
            }
        });

        return true;
    }

    // 7) Cancel (dipakai popup.js)
    if (message.action === "cancelUrl") {
        const { url } = message;

        chrome.storage.local.get(null, (data) => {
            const autoKeys = Object.keys(data).filter((k) => k.startsWith("auto_"));

            autoKeys.forEach((key) => {
                const autoData = data[key];
                const first = autoData?.downloadQueue?.[0];
                if (!first || first.url !== url) return;

                chrome.storage.local.set({ [key]: { ...autoData, cancelled: true } });

                const tabId = parseInt(key.replace("auto_", ""), 10);
                if (tabId) chrome.tabs.remove(tabId);
            });

            chrome.storage.local.set({ renameEnabled: false }, () =>
                sendResponse({ success: true })
            );
        });

        return true;
    }

    // default
    sendResponse({ ok: false, error: "unknown action" });
    return true;
});

// Cleanup auto data kalau tab automation ditutup
chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.local.remove([`auto_${tabId}`]);
});

// =========================
// RENAME DOWNLOAD (HANYA SIGA)
// =========================
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
    console.log("onDeterminingFilename fired:", {
        filename: downloadItem.filename,
        url: downloadItem.url
    });
    // Filter domain supaya website lain tidak ikut kena
    const host = getHostSafe(downloadItem.url);
    console.log("download host =", host);
    if (host !== ALLOWED_HOST) {
        suggest({ filename: downloadItem.filename, conflictAction: "uniquify" });
        return;
    }

    chrome.storage.local.get(["renameContext", "renameEnabled"], (res) => {
        if (!res.renameEnabled) {
            suggest({ filename: downloadItem.filename, conflictAction: "uniquify" });
            return;
        }

        const ctx = res.renameContext;
        if (!ctx) {
            suggest({ filename: downloadItem.filename, conflictAction: "uniquify" });
            return;
        }

        // Ambil nama asli server: "Tabel1.xlsx" -> "Tabel1"
        const original = downloadItem.filename || "";
        const originalBase = original.split(/[\\/]/).pop().replace(/\.[^.]+$/, "");
        const originalExt = original.includes(".") ? original.split(".").pop() : "xlsx";
        const tahunPart = ctx.tahun ? `-${sanitize(ctx.tahun)}` : "";

        const newName =
            `${sanitize(ctx.periode)}${tahunPart}-${sanitize(ctx.kab)}-${sanitize(ctx.kec)}-${sanitize(originalBase)}.${sanitize(originalExt)}`;

        suggest({ filename: newName, conflictAction: "uniquify" });
    });

    return true; // async (karena pakai storage)
});
