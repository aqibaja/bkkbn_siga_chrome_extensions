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

// Helper: antrian rename context (untuk multi-download supaya tidak saling overwrite)
let enqueuePromise = Promise.resolve();

function enqueueRenameContext(payload) {
    const ctx = payload || {};
    enqueuePromise = enqueuePromise.then(() => {
        return new Promise((resolve) => {
            chrome.storage.local.get(['renameQueue', 'pendingRenameList'], (res) => {
                const queue = Array.isArray(res.renameQueue) ? res.renameQueue : [];
                const pending = Array.isArray(res.pendingRenameList) ? res.pendingRenameList : [];
                queue.push(ctx);
                pending.push(ctx);
                if (pending.length > 200) pending.splice(0, pending.length - 200);
                chrome.storage.local.set({
                    renameQueue: queue,
                    pendingRenameList: pending,
                    renameContext: ctx,
                    renameEnabled: true,
                }, () => {
                    resolve();
                });
            });
        });
    }).catch((err) => {
        console.error('[rename] enqueueRenameContext error', err);
    });
}
function dequeueRenameContext(callback) {
    chrome.storage.local.get(['renameQueue', 'renameContext'], (res) => {
        const queue = Array.isArray(res.renameQueue) ? res.renameQueue : [];
        if (queue.length === 0) {
            callback(res.renameContext || null, queue);
            return;
        }
        const nextCtx = queue.shift();
        chrome.storage.local.set({
            renameQueue: queue,
            renameContext: nextCtx,
            renameEnabled: queue.length > 0,
        }, () => callback(nextCtx, queue));
    });
}

function dequeuePendingRename(callback) {
    chrome.storage.local.get(['pendingRenameList'], (res) => {
        const pending = Array.isArray(res.pendingRenameList) ? res.pendingRenameList : [];
        if (pending.length === 0) {
            callback(null, pending);
            return;
        }
        const nextCtx = pending.shift();
        chrome.storage.local.set({ pendingRenameList: pending }, () => callback(nextCtx, pending));
    });
}

// =========================
// Message handler (satu saja)
// =========================
let isWakingUp = false;
let wakeUpQueue = [];

async function processWakeUpQueue() {
    if (isWakingUp || wakeUpQueue.length === 0) return;
    isWakingUp = true;
    
    const tabId = wakeUpQueue.shift();
    try {
        // Pindah tab agar tab yang freeze bisa merender (anti-sleep fallback)
        await chrome.tabs.update(tabId, { active: true });
        // Biarkan tab aktif selama 800ms agar React sempat menggambar dropdown
        await new Promise(r => setTimeout(r, 800));
    } catch(e) {}
    
    isWakingUp = false;
    if (wakeUpQueue.length > 0) {
        processWakeUpQueue();
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 1) Simpan context rename dari popup
    if (message.action === "setRenameContext") {
        console.log('[rename] setRenameContext payload:', message.payload);
        enqueueRenameContext(message.payload || {});
        sendResponse({ ok: true });
        return true;
    }

    // 1.5) Anti-Sleep / Auto Pindah Tab
    if (message.action === "wakeMeUp" && sender.tab) {
        if (!wakeUpQueue.includes(sender.tab.id)) {
            wakeUpQueue.push(sender.tab.id);
            processWakeUpQueue();
        }
        sendResponse({ ok: true });
        return;
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
                        menu: message.data.menu || '',
                        submenu: message.data.submenu || '',
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
            sendResponse({ success: true });
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

            sendResponse({ success: true });
        });

        return true;
    }

    // 8) Content.js bertanya: apakah ada download SIGA yang selesai sejak `since` timestamp?
    if (message.action === 'checkSigaDownload') {
        const { since } = message;
        // Cari semua download yang selesai dari domain SIGA
        chrome.downloads.search(
            { state: 'complete', limit: 10, orderBy: ['-startTime'] },
            (items) => {
                const found = items.find(item => {
                    const host = getHostSafe(item.url);
                    if (host !== ALLOWED_HOST) return false;
                    // endTime adalah saat selesai download
                    const endTs = item.endTime ? new Date(item.endTime).getTime() : 0;
                    return endTs >= (since || 0);
                });
                sendResponse({ found: !!found, state: found ? 'complete' : null });
            }
        );
        return true;
    }

    if (message.action === 'registerBlobRename') {
        const { blobUrl, payload } = message;
        if (!blobUrl || !payload) { sendResponse({ ok: false }); return; }
        const key = `rename_for_${blobUrl}`;
        chrome.storage.local.set({ [key]: payload }, () => {
            sendResponse({ ok: true });
        });
        return true;
    }

    // 9.5) Start Batch Automation: popup request buka banyak tab paralel staggered
    if (message.action === 'startBatchAutomation') {
      const { initialTabsCount } = message;
      // Berikan respons segera agar kanal pesan ditutup dengan bersih tanpa mengganggu eksekusi latar belakang
      sendResponse({ ok: true });

      chrome.storage.local.get(['bkbMonitoringBatch'], (res) => {
        const batchMeta = res.bkbMonitoringBatch;
        const plan = batchMeta.plan;
        // Gunakan Rantai Pembuatan Tab (Chained Tab Creation) agar stabil 100% tanpa terkena throttling browser atau suspend
        const createTabChained = (index) => {
          if (index >= initialTabsCount) return;
          
          const kab = plan[index];
          const url = `https://newsiga-siga.bkkbn.go.id/${batchMeta.targetRoute}`;
          
          chrome.tabs.create({ url, active: false }, (tab) => {
            if (tab && tab.id) {
              chrome.storage.local.set({
                [`bkbMonitoringKec_${tab.id}`]: {
                  mode: 'active',
                  kabId: kab.kabId,
                  kabName: kab.kabName,
                  targetRoute: batchMeta.targetRoute,
                  initialWaitMs: batchMeta.initialWaitMs,
                  loopWaitMs: batchMeta.loopWaitMs,
                  currentIndex: 0,
                  queue: kab.queue,
                  results: [],
                  planIndex: index,
                  lastUpdated: Date.now()
                }
              }, () => {
                // Lanjutkan rantai setelah data storage berhasil ditulis
                createTabChained(index + 1);
              });
            } else {
              // Jika terjadi error pada pembuatan tab, tetap lanjutkan antrean
              createTabChained(index + 1);
            }
          });
        };

        // Mulai rantai pembuatan dari indeks 0
        createTabChained(0);
      });
      return true;
    }

    // 9) Sequential Batch: content.js buka tab berikutnya lalu tutup dirinya
    if (message.action === 'openNextBatchTab') {
      const { nextKecState, nextStorageKey, closeTabId } = message;
      if (!nextKecState || !nextStorageKey) {
        if (closeTabId) chrome.tabs.remove(closeTabId).catch(() => {});
        sendResponse({ ok: true });
        return true;
      }
      const url = `https://newsiga-siga.bkkbn.go.id/${nextKecState.targetRoute || '#/kegiatan/kelompok_bkb'}`;
      chrome.tabs.create({ url, active: true }, (newTab) => {
        if (!newTab || !newTab.id) { sendResponse({ ok: false }); return; }
        chrome.storage.local.set({ [nextStorageKey.replace('NEWTABID', newTab.id)]: { ...nextKecState, mode: 'active' } }, () => {
          if (closeTabId) setTimeout(() => chrome.tabs.remove(closeTabId).catch(() => {}), 1500);
          sendResponse({ ok: true, newTabId: newTab.id });
        });
      });
      return true;
    }

    // default
    sendResponse({ ok: false, error: "unknown action" });
    return true;
});

// Cleanup auto data kalau tab automation ditutup
chrome.tabs.onRemoved.addListener((tabId) => {
    const autoKey = `auto_${tabId}`;
    chrome.storage.local.get([autoKey], (res) => {
        if (res[autoKey]) {
            chrome.storage.local.remove([autoKey], () => {
                chrome.storage.local.get(null, (data) => {
                    const autoKeys = Object.keys(data).filter((k) => k.startsWith("auto_"));
                    if (autoKeys.length === 0) {
                        chrome.storage.local.set({
                            renameEnabled: false,
                            renameContext: null,
                            renameQueue: [],
                            pendingRenameList: []
                        });
                    }
                });
            });
        }
    });
});

// =========================
// RENAME DOWNLOAD (HANYA SIGA)
// =========================
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
    console.log("[rename] onDeterminingFilename fired:", {
        id: downloadItem.id,
        filename: downloadItem.filename,
        url: downloadItem.url,
        tabId: downloadItem.tabId,
        danger: downloadItem.danger,
    });
    // Filter domain supaya website lain tidak ikut kena
    const host = getHostSafe(downloadItem.url);
    console.log("[rename] download host =", host);
    if (host !== ALLOWED_HOST) {
        suggest({ filename: downloadItem.filename, conflictAction: "uniquify" });
        return;
    }

    // Prefer a per-blob rename payload if registered, else fallback to tab-specific queue or global context
    const blobKey = `rename_for_${downloadItem.url}`;

    const getNumericCode = (label) => {
        if (!label) return '';
        const m = label.toString().trim().match(/^(\d+)/);
        return m ? m[1] : '';
    };

    const buildLocationCode = (context) => {
        if (!context) return '';
        const kab = context.kabCode || getNumericCode(context.kab || '');
        const kec = context.kecCode || getNumericCode(context.kec || '');
        let desa = context.desaCode || getNumericCode(context.desa || '');
        // if desa string contains 8-digit but then name, use first 8 digits
        if (!desa && context.desa) {
            const d = context.desa.toString().trim().match(/^(\d{8})/);
            desa = d ? d[1] : '';
        }
        return `${kab || ''}${kec || ''}${desa || ''}`;
    };

    const buildFileName = (context) => {
        if (!context) {
            suggest({ filename: downloadItem.filename, conflictAction: 'uniquify' });
            return;
        }
        // Ambil nama asli server: "Tabel1.xlsx" -> "Tabel1"
        const original = downloadItem.filename || '';
        const originalBase = original.split(/[\\\/]/).pop().replace(/\.[^.]+$/, '');
        const originalExt = original.includes('.') ? original.split('.').pop() : 'xlsx';

        const stripCode = (s) => (s || '').toString().replace(/^\s*\d+\s*[-_.]*\s*/, '').trim();
        const kecClean = context.kec ? sanitize(stripCode(context.kec)) : '';
        const placeRaw = context.desa ? context.desa : (context.faskes ? context.faskes : '');

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
        const locationCode = buildLocationCode(context);
        if (locationCode) { parts.push(sanitize(locationCode)); }
        if (context.periode) parts.push(sanitize(context.periode));
        if (context.tahun) parts.push(sanitize(context.tahun));
        if (context.kab) parts.push(sanitize(context.kab));
        const submenuLabel = (() => {
            if (context.menu === 'pendaftaran-elsimil' && context.submenu) {
                return context.submenu;
            }
            if (context.menu === 'laporan' && context.submenu === 'elsimil' && context.sasaran) {
                // Untuk laporan elsimil, gunakan sasaran (baduta/catin/bumil/pascapersalinan) bila tersedia.
                return context.sasaran;
            }
            return context.submenu;
        })();

        if (submenuLabel) parts.push(sanitize(submenuLabel));

        // Tambahkan jenis laporan (rekap/detail) setelah submenu/sasaran
        if (context.jenisLaporan) parts.push(sanitize(context.jenisLaporan));

        // Jika masih ada sasaran dan belum dijadikan submenuLabel, tambahkan sebagai fallback
        if (context.sasaran && !(context.menu === 'laporan' && context.submenu === 'elsimil')) {
            parts.push(sanitize(context.sasaran));
        }

        if (kecClean) parts.push(kecClean);
        if (placePartClean) parts.push(placePartClean);

        const prefix = parts.join('-');
        const newName = `${prefix ? prefix + '-' : ''}${sanitize(originalBase)}.${sanitize(originalExt)}`;
        console.log('[rename] buildFileName ->', { context, newName });
        suggest({ filename: newName, conflictAction: 'uniquify' });
    };

    const fallbackRename = (res) => {
        const processNonAutoTab = () => {
            if (!res.renameEnabled) {
                console.warn('[rename] renameEnabled is false, skipping fallback rename', { downloadItem });
                suggest({ filename: downloadItem.filename, conflictAction: 'uniquify' });
                return;
            }

            dequeuePendingRename((pendingCtx, pendingQueue) => {
                if (pendingCtx) {
                    console.log('[rename] pending list context used', { pendingCtx, pendingRemaining: pendingQueue.length });
                    buildFileName(pendingCtx);
                    return;
                }

                if (Array.isArray(res.renameQueue) && res.renameQueue.length > 0) {
                    const nextCtx = res.renameQueue.shift();
                    console.log('[rename] fallback queue context', nextCtx);
                    chrome.storage.local.set({
                        renameQueue: res.renameQueue,
                        renameContext: nextCtx,
                        renameEnabled: res.renameQueue.length > 0,
                    }, () => buildFileName(nextCtx));
                    return;
                }

                console.log('[rename] fallback global context', res.renameContext);
                if (res.renameContext) {
                    buildFileName(res.renameContext);
                } else {
                    suggest({ filename: downloadItem.filename, conflictAction: 'uniquify' });
                }
            });
        };

        if (typeof downloadItem.tabId === 'number' && downloadItem.tabId >= 0) {
            const tabKey = `auto_${downloadItem.tabId}`;
            console.log('[rename] checking tab auto context', { tabKey });
            chrome.storage.local.get([tabKey], (tabRes) => {
                const autoData = tabRes[tabKey];
                if (autoData) {
                    const queueItem = Array.isArray(autoData.downloadQueue) ? autoData.downloadQueue[autoData.currentIndex] : null;
                    const context = (queueItem && queueItem.renameContext) ? queueItem.renameContext : {
                        periode: autoData.periode,
                        tahun: autoData.tahun,
                        kab: queueItem?.kota || autoData.kab || '',
                        kec: autoData.kecamatan || autoData.kec || '',
                        faskes: queueItem?.faskes || autoData.faskes || '',
                        desa: queueItem?.desa || autoData.desa || '',
                        kabCode: queueItem?.kabCode || autoData.kabCode || '',
                        kecCode: queueItem?.kecCode || autoData.kecCode || '',
                        desaCode: queueItem?.desaCode || autoData.desaCode || '',
                        menu: autoData.menu || '',
                        submenu: autoData.submenu || '',
                        sasaran: autoData.sasaran || ''
                    };
                    console.log('[rename] tab context applied', { tabKey, context });
                    buildFileName(context);
                    return;
                }
                
                processNonAutoTab();
            });
        } else {
            processNonAutoTab();
        }
    };

    const tryBlobContext = (attempts) => {
        if (attempts <= 0) {
            console.warn('[rename] blob-context timeout, fallback to queue/global', { blobKey });
            chrome.storage.local.get(["renameContext", "renameQueue", "pendingRenameList", "renameEnabled"], fallbackRename);
            return;
        }
        chrome.storage.local.get([blobKey], (res2) => {
            if (res2[blobKey]) {
                const payload = res2[blobKey];
                console.log('[rename] blob-context used', { blobKey, payload });
                chrome.storage.local.remove([blobKey]);
                buildFileName(payload);
            } else {
                setTimeout(() => tryBlobContext(attempts - 1), 150);
            }
        });
    };

    tryBlobContext(10);

    return true;
});

// =========================
// DOWNLOAD COMPLETION DETECTION
// Pakai chrome.downloads.search() agar tabId selalu tersedia
// tanpa perlu simpan state di memory (MV3 service worker bisa restart kapan saja)
// =========================
chrome.downloads.onChanged.addListener((delta) => {
    if (!delta.state) return;
    const state = delta.state.current;
    if (state !== 'complete' && state !== 'interrupted') return;

    chrome.downloads.search({ id: delta.id }, (items) => {
        if (!items || items.length === 0) return;
        const item = items[0];

        const host = getHostSafe(item.url);
        if (host !== ALLOWED_HOST) return;

        const tabId = item.tabId;
        const result = { state, downloadId: delta.id, tabId, ts: Date.now() };
        console.log(`[download-track] SIGA download ${delta.id} ${state} tabId=${tabId}`);

        // Selalu tulis ke storage untuk setiap SIGA download
        // 'siga_last_download' = fallback universal (tabId berapapun, bahkan -1)
        const toSet = { siga_last_download: result };
        if (typeof tabId === 'number' && tabId >= 0) {
            toSet[`downloadResult_${tabId}`] = result;
        }
        chrome.storage.local.set(toSet);

        // Direct message ke tab (path cepat, opsional)
        if (typeof tabId === 'number' && tabId >= 0) {
            const action = state === 'complete' ? 'downloadComplete' : 'downloadInterrupted';
            chrome.tabs.sendMessage(tabId, { action, downloadId: delta.id }).catch(() => {});
        }
    });
});
