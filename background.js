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
                // If caller provided a progressKey for each item, preserve it into auto_<tabId>
                const dataForThisUrl = message.data;
                const progressKey = dataForThisUrl && dataForThisUrl.progressKey ? dataForThisUrl.progressKey : null;
                chrome.storage.local.set({
                    [`auto_${tabObj.id}`]: {
                        downloadQueue: urlToQueueMap[url],
                        currentIndex: 0,
                        periode, selectedCities, kecamatan, jenisLaporan, faskes, tahun, desa, rw, sasaran,
                        cancelled: false,
                        progressKey
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

// Allow popup/content to register a rename payload specific to a blob URL
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'registerBlobRename') {
        const { blobUrl, payload } = message;
        if (!blobUrl || !payload) { sendResponse({ ok: false }); return; }
        const key = `rename_for_${blobUrl}`;
        chrome.storage.local.set({ [key]: payload }, () => {
            sendResponse({ ok: true });
        });
        return true;
    }
    return false;
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

    // Prefer a per-blob rename payload if registered, else fallback to global renameContext
    const blobKey = `rename_for_${downloadItem.url}`;
    chrome.storage.local.get([blobKey, "renameContext", "renameEnabled"], (res) => {
        if (!res.renameEnabled && !res[blobKey]) {
            suggest({ filename: downloadItem.filename, conflictAction: "uniquify" });
            return;
        }

        const ctx = res[blobKey] || res.renameContext;
        if (!ctx) {
            suggest({ filename: downloadItem.filename, conflictAction: "uniquify" });
            return;
        }

        // If we used a blob-specific mapping, remove it so it doesn't affect later downloads
        if (res[blobKey]) {
            chrome.storage.local.remove([blobKey]);
        }

        // Ambil nama asli server: "Tabel1.xlsx" -> "Tabel1"
        const original = downloadItem.filename || "";
        const originalBase = original.split(/[\\\/]/).pop().replace(/\.[^.]+$/, "");
        const originalExt = original.includes(".") ? original.split(".").pop() : "xlsx";
        const tahunPart = ctx.tahun ? `-${sanitize(ctx.tahun)}` : "";

        // Build filename from non-empty parts to avoid leading/trailing dashes
        const stripCode = (s) => (s || "").toString().replace(/^\s*\d+\s*[-_.]*\s*/, '').trim();
        const kecClean = ctx.kec ? sanitize(stripCode(ctx.kec)) : '';
        const placeRaw = ctx.desa ? ctx.desa : (ctx.faskes ? ctx.faskes : '');

        // If placeRaw includes a leading numeric code like "2017 - GAMPONG BARO", extract both
        let placePartClean = '';
        if (placeRaw) {
            const m = placeRaw.toString().trim().match(/^(\d+)\s*[-_.]*\s*(.+)$/);
            if (m) {
                const code = sanitize(m[1]);
                const name = sanitize(m[2]);
                placePartClean = `${code}_${name}`;
            } else {
                placePartClean = sanitize(placeRaw);
            }
        }

        const parts = [];
        if (ctx.periode) parts.push(sanitize(ctx.periode));
        if (ctx.tahun) parts.push(sanitize(ctx.tahun));
        if (ctx.kab) parts.push(sanitize(ctx.kab));
        if (kecClean) parts.push(kecClean);
        if (placePartClean) parts.push(placePartClean);

        const prefix = parts.join('-');
        const newName = `${prefix ? prefix + '-' : ''}${sanitize(originalBase)}.${sanitize(originalExt)}`;

        suggest({ filename: newName, conflictAction: "uniquify" });
    });

    return true; // async (karena pakai storage)
});
