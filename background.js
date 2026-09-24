// background.js (MV3 service worker)

const ALLOWED_HOST = "newsiga-siga.kemendukbangga.go.id";

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
// CATATAN: Fungsi enqueue/dequeue global dihapus karena menyebabkan rename salah file.
// Rename sekarang HANYA terjadi jika: (1) ada blob-key spesifik, atau (2) tab punya auto_<tabId> aktif.

// Bersihkan sisa state rename global dari sesi sebelumnya (mencegah rename salah saat baru dibuka)
chrome.storage.local.remove(['renameEnabled', 'renameContext', 'renameQueue', 'pendingRenameList'], () => {
    console.log('[rename] Stale global rename state cleared on service worker start.');
});

// Mapping memori untuk pelacakan download
const blobTabMap = {};     // blobUrl -> tabId
const downloadTabMap = {}; // downloadId -> tabId


// =========================
// Message handler (satu saja)
// =========================
let isWakingUp = false;
let wakeUpQueue = [];

// =========================
// Batch Automation State
// =========================
let batchAutomationState = {
    active: false,
    queue: [],
    batchSize: 10,
    currentBatchTabs: {}, // tabId -> progressKey
};

function processNextBatch() {
    if (!batchAutomationState.active) return;

    const currentActiveCount = Object.keys(batchAutomationState.currentBatchTabs).length;

    if (batchAutomationState.queue.length === 0 && currentActiveCount === 0) {
        batchAutomationState.active = false;
        console.log('[batch] All batches completed!');
        return;
    }

    const availableSlots = batchAutomationState.batchSize - currentActiveCount;
    if (availableSlots <= 0) {
        return; // wait for them to finish
    }

    const nextBatch = batchAutomationState.queue.splice(0, availableSlots);
    if (nextBatch.length === 0) return;

    console.log(`[batch] Starting new batch of ${nextBatch.length} items. Active: ${currentActiveCount}/${batchAutomationState.batchSize}`);
    
    nextBatch.forEach((data, index) => {
        const item = data.downloadQueue[0];
        const url = item.url;
        
        const pendingId = `pending_${Date.now()}_${Math.random()}`;
        batchAutomationState.currentBatchTabs[pendingId] = data.progressKey;
        
        setTimeout(() => {
            chrome.tabs.create({ url, active: false }, (tabObj) => {
                delete batchAutomationState.currentBatchTabs[pendingId];
                if (tabObj && tabObj.id) {
                    batchAutomationState.currentBatchTabs[tabObj.id] = data.progressKey;
                    chrome.storage.local.set({
                        [`auto_${tabObj.id}`]: {
                            downloadQueue: data.downloadQueue,
                            currentIndex: 0,
                            periode: data.periode, 
                            selectedCities: data.selectedCities, 
                            kecamatan: data.kecamatan, 
                            jenisLaporan: data.jenisLaporan, 
                            faskes: data.faskes, 
                            tahun: data.tahun, 
                            desa: data.desa, 
                            rw: data.rw, 
                            sasaran: data.sasaran,
                            menu: data.menu || '',
                            submenu: data.submenu || '',
                            cancelled: false,
                            progressKey: data.progressKey,
                            openDelay: data.openDelay
                        },
                    });
                } else {
                    checkBatchCompletion();
                }
            });
        }, index * 1500);
    });
}

function checkBatchCompletion() {
    if (!batchAutomationState.active) return;
    
    const remainingTabIds = Object.keys(batchAutomationState.currentBatchTabs);
    const realTabIds = remainingTabIds.filter(id => !id.startsWith('pending_'));
    const keysToCheck = realTabIds.map(id => batchAutomationState.currentBatchTabs[id]);
    
    if (keysToCheck.length === 0) {
        processNextBatch();
        return;
    }
    
    chrome.storage.local.get(keysToCheck, (res) => {
        let clearedSome = false;
        realTabIds.forEach(tabId => {
            const pk = batchAutomationState.currentBatchTabs[tabId];
            const item = res[pk];
            if (item && (item.status === 'success' || item.status === 'fail' || item.status === 'cancelled')) {
                delete batchAutomationState.currentBatchTabs[tabId];
                clearedSome = true;
            }
        });
        
        processNextBatch();
    });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && batchAutomationState.active) {
        // If any of the changes involve our batch progress keys, check completion
        const remainingTabIds = Object.keys(batchAutomationState.currentBatchTabs);
        const activeKeys = remainingTabIds.map(id => batchAutomationState.currentBatchTabs[id]);
        
        const hasRelevantChange = Object.keys(changes).some(k => activeKeys.includes(k));
        if (hasRelevantChange) {
            checkBatchCompletion();
        }
    }
});

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
    // 1) setRenameContext — context sudah disimpan langsung di auto_<tabId>.downloadQueue[0].renameContext
    // Global enqueue dihapus untuk mencegah rename salah file (cross-contamination antar tab)
    if (message.action === "setRenameContext") {
        console.log('[rename] setRenameContext acknowledged (no-op, context disimpan via auto_<tabId>)');
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

        Object.keys(urlToQueueMap).forEach((url, index) => {
            setTimeout(() => {
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
                            progressKey,
                            openDelay: message.data.openDelay
                        },
                    });
                });
            }, index * 1500);
        });

        sendResponse({ success: true });
        return true;
    }

    // 2.5) Start Batch Automation (Chunking)
    if (message.action === "startBatchDownload") {
        const { batchQueue, batchSize } = message;
        
        batchAutomationState.active = true;
        batchAutomationState.queue = batchQueue || [];
        batchAutomationState.batchSize = batchSize || 20;
        batchAutomationState.currentBatchTabs = {};

        console.log(`[batch] Starting batch mode. Total: ${batchAutomationState.queue.length}, Batch Size: ${batchAutomationState.batchSize}`);
        processNextBatch();

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

    // 7.5) Cancel Semua (dipakai popup.js)
    if (message.action === "cancelAllDownloads") {
        // Matikan batch automation jika aktif
        batchAutomationState.active = false;
        batchAutomationState.queue = [];
        const batchTabIdsToClose = Object.keys(batchAutomationState.currentBatchTabs).map(id => parseInt(id, 10));
        batchAutomationState.currentBatchTabs = {};

        chrome.storage.local.get(null, (data) => {
            const autoKeys = Object.keys(data).filter((k) => k.startsWith("auto_"));

            // Hapus/batalkan tab automation
            autoKeys.forEach((key) => {
                const autoData = data[key];
                chrome.storage.local.set({ [key]: { ...autoData, cancelled: true } });

                const tabId = parseInt(key.replace("auto_", ""), 10);
                if (tabId) chrome.tabs.remove(tabId).catch(() => {});
            });

            // Tutup tab regular batch yang sedang aktif
            batchTabIdsToClose.forEach((tabId) => {
                if (tabId) chrome.tabs.remove(tabId).catch(() => {});
            });

            // Hapus antrean BKB Monitoring dan tutup tab-nya
            const bkbKeys = Object.keys(data).filter(k => k.startsWith('bkbMonitoring'));
            bkbKeys.forEach(k => {
                if (k.startsWith('bkbMonitoringKec_')) {
                    const tabId = parseInt(k.replace('bkbMonitoringKec_', ''), 10);
                    if (tabId) chrome.tabs.remove(tabId).catch(() => {});
                }
            });
            if (bkbKeys.length > 0) {
                chrome.storage.local.remove(bkbKeys);
            }
            
            // Set status semua progress UI jadi fail
            const updates = {};
            Object.keys(data).forEach(k => {
                if (k.startsWith('tabdownload_') && data[k].status === 'progress') {
                    updates[k] = { ...data[k], status: 'fail', fileAkhir: 'Dibatalkan oleh user' };
                }
            });
            if (Object.keys(updates).length > 0) {
                chrome.storage.local.set(updates);
            }

            sendResponse({ success: true });
        });

        return true;
    }

    // 8) Content.js bertanya: apakah ada download SIGA yang selesai sejak `since` timestamp?
    // Filter berdasarkan tabId, nama file (kota / tabel), atau toleransi waktu
    if (message.action === 'checkSigaDownload') {
        const { since, tabId: requestTabId, kota, tableName, filenameHint } = message;
        const senderTabId = sender?.tab?.id;
        const targetTabId = (typeof requestTabId === 'number' && requestTabId >= 0) ? requestTabId : senderTabId;

        chrome.downloads.search(
            { state: 'complete', limit: 30, orderBy: ['-startTime'] },
            (items) => {
                const found = items.find(item => {
                    const host = getHostSafe(item.url);
                    if (host !== ALLOWED_HOST) return false;

                    const endTs = item.endTime ? new Date(item.endTime).getTime() : 0;
                    if (endTs < (since || 0) - 2000) return false;

                    const itemTabId = (typeof item.tabId === 'number' && item.tabId >= 0)
                        ? item.tabId
                        : (downloadTabMap[item.id] || null);

                    // Cocok 1: tabId cocok
                    if (typeof targetTabId === 'number' && targetTabId >= 0 && itemTabId === targetTabId) {
                        return true;
                    }

                    // Cocok 2: nama file mengandung kota atau tabel
                    const fname = (item.filename || '').toUpperCase();
                    if (kota && fname.includes(kota.toUpperCase().replace(/\s+/g, '_'))) return true;
                    if (tableName && fname.includes(tableName.toUpperCase())) return true;
                    if (filenameHint && fname.includes(filenameHint.toUpperCase())) return true;

                    // Cocok 3: jika itemTabId tidak diketahui (-1) dan waktu download cocok
                    if (!itemTabId && endTs >= (since || 0) - 2000) {
                        return true;
                    }

                    return false;
                });
                sendResponse({ found: !!found, state: found ? 'complete' : null, item: found || null });
            }
        );
        return true;
    }

    // 8b) Verifikasi berdasarkan downloadId spesifik — cara paling akurat, tanpa ambiguitas
    if (message.action === 'checkSigaDownloadById') {
        const { downloadId } = message;
        if (!downloadId) { sendResponse({ state: null }); return true; }
        chrome.downloads.search({ id: downloadId }, (items) => {
            if (!items || items.length === 0) { sendResponse({ state: null }); return; }
            const item = items[0];
            const host = getHostSafe(item.url);
            if (host !== ALLOWED_HOST) { sendResponse({ state: null }); return; }
            // state: 'in_progress', 'complete', 'interrupted'
            sendResponse({ state: item.state, filename: item.filename, exists: item.exists });
        });
        return true;
    }

    if (message.action === 'registerBlobRename') {
        const { blobUrl, payload, tabId: reqTabId } = message;
        if (!blobUrl || !payload) { sendResponse({ ok: false }); return; }
        const tabId = (typeof reqTabId === 'number' && reqTabId >= 0) ? reqTabId : (sender?.tab?.id || null);
        if (tabId) {
            payload.tabId = tabId;
            blobTabMap[blobUrl] = tabId;
        }
        const key = `rename_for_${blobUrl}`;
        const toSet = { [key]: payload };
        if (tabId) toSet[`blob_tab_${blobUrl}`] = tabId;
        chrome.storage.local.set(toSet, () => {
            console.log('[rename] registered blob rename for', blobUrl, 'tabId =', tabId);
            sendResponse({ ok: true, tabId });
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
          const url = `https://newsiga-siga.kemendukbangga.go.id/${batchMeta.targetRoute}`;
          
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
                // Lanjutkan rantai setelah data storage berhasil ditulis dengan jeda 1.5 detik
                setTimeout(() => createTabChained(index + 1), 1500);
              });
            } else {
              // Jika terjadi error pada pembuatan tab, tetap lanjutkan antrean
              setTimeout(() => createTabChained(index + 1), 1500);
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
      const url = `https://newsiga-siga.kemendukbangga.go.id/${nextKecState.targetRoute || '#/kegiatan/kelompok_bkb'}`;
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
    // Check if it's part of the current batch
    if (batchAutomationState.active && batchAutomationState.currentBatchTabs[tabId]) {
        delete batchAutomationState.currentBatchTabs[tabId];
        checkBatchCompletion();
    }

    const autoKey = `auto_${tabId}`;
    chrome.storage.local.get([autoKey], (res) => {
        if (res[autoKey]) {
            chrome.storage.local.remove([autoKey]);
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

    // Tentukan tabId: gunakan downloadItem.tabId jika valid, atau lookup dari blobTabMap
    let realTabId = (typeof downloadItem.tabId === 'number' && downloadItem.tabId >= 0)
        ? downloadItem.tabId
        : (blobTabMap[downloadItem.url] || null);

    const recordDownloadTab = (tabIdToRecord) => {
        if (typeof tabIdToRecord === 'number' && tabIdToRecord >= 0) {
            downloadTabMap[downloadItem.id] = tabIdToRecord;
            const tabDownloadKey = `downloadId_for_tab_${tabIdToRecord}`;
            chrome.storage.local.set({
                [tabDownloadKey]: downloadItem.id,
                [`download_tab_${downloadItem.id}`]: tabIdToRecord
            }, () => {
                console.log(`[download-track] Tab ${tabIdToRecord} -> downloadId ${downloadItem.id} disimpan`);
            });
        }
    };

    if (realTabId) {
        recordDownloadTab(realTabId);
    }

    // Kunci rename: HANYA via (1) blob-key spesifik, atau (2) tab punya auto_<tabId> aktif.
    // TIDAK ADA fallback ke global renameContext/renameEnabled — itu sumber bug salah rename.
    const blobKey = `rename_for_${downloadItem.url}`;

    const getNumericCode = (label) => {
        if (!label) return '';
        const m = label.toString().trim().match(/^(\d+)/);
        return m ? m[1] : '';
    };

    const buildLocationCode = (context) => {
        if (!context) return '';
        const kab = context.kabCode || getNumericCode(context.kab || '');
        let kec = context.kecCode || getNumericCode(context.kec || '');
        // Cegah duplikasi kode kab jika kec sudah diawali dengan kode kab (misal kab: '03' dan kec: '0318' -> cukup '0318')
        if (kab && kec && kec.startsWith(kab)) {
            kec = kec.slice(kab.length);
        }
        let desa = context.desaCode || getNumericCode(context.desa || '');
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
        const original = downloadItem.filename || '';
        const originalBase = original.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
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
                return context.sasaran;
            }
            return context.submenu;
        })();

        if (submenuLabel) parts.push(sanitize(submenuLabel));
        if (context.jenisLaporan) parts.push(sanitize(context.jenisLaporan));
        if (context.sasaran && !(context.menu === 'laporan' && context.submenu === 'elsimil')) {
            parts.push(sanitize(context.sasaran));
        }

        if (kecClean) parts.push(kecClean);
        if (placePartClean) parts.push(placePartClean);

        const prefix = parts.join('-');
        
        let folderPath = '';
        if (context.folderMode === 'tabel' && context.tabelName) {
            folderPath = sanitize(context.tabelName) + '/';
        } else if (context.folderMode === 'none') {
            folderPath = '';
        } else if ((context.folderMode === 'kab' || !context.folderMode) && context.isBatchKabupaten && context.kotaAsli) {
            let formattedKota = context.kotaAsli.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
            folderPath = sanitize(formattedKota) + '/';
        }
        
        const newName = `${folderPath}${prefix ? prefix + '-' : ''}${sanitize(originalBase)}.${sanitize(originalExt)}`;
        console.log('[rename] buildFileName ->', { context, newName });
        suggest({ filename: newName, conflictAction: 'uniquify' });
    };

    // Langkah 1: Cek blob-key spesifik (paling prioritas)
    const tryBlobContext = (attempts) => {
        if (attempts <= 0) {
            // Langkah 2: Cek auto_<tabId> dari tab yang menginisiasi download
            if (typeof downloadItem.tabId === 'number' && downloadItem.tabId >= 0) {
                const tabKey = `auto_${downloadItem.tabId}`;
                chrome.storage.local.get([tabKey], (tabRes) => {
                    const autoData = tabRes[tabKey];
                    if (autoData && !autoData.cancelled) {
                        // Tab ini memang sedang menjalankan auto-download
                        const queueItem = Array.isArray(autoData.downloadQueue)
                            ? autoData.downloadQueue[autoData.currentIndex]
                            : null;
                        const context = (queueItem && queueItem.renameContext)
                            ? queueItem.renameContext
                            : {
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
                                sasaran: autoData.sasaran || '',
                                jenisLaporan: autoData.jenisLaporan || '',
                                folderMode: autoData.folderMode || '',
                                tabelName: autoData.tabelName || '',
                                isBatchKabupaten: autoData.isBatchKabupaten || false,
                                kotaAsli: autoData.kotaAsli || '',
                            };
                        console.log('[rename] auto tab context applied', { tabKey, context });
                        buildFileName(context);
                        return;
                    }
                    // Tab tidak punya auto_ aktif = download manual atau sesi lama
                    // → TIDAK rename, gunakan nama asli
                    console.warn('[rename] tab tidak punya auto_ aktif, download manual → nama asli', { tabKey });
                    suggest({ filename: downloadItem.filename, conflictAction: 'uniquify' });
                });
            } else {
                // Tidak ada tabId valid → download manual, tidak rename
                console.warn('[rename] tidak ada tabId valid → nama asli dipertahankan');
                suggest({ filename: downloadItem.filename, conflictAction: 'uniquify' });
            }
            return;
        }
        chrome.storage.local.get([blobKey, `blob_tab_${downloadItem.url}`], (res2) => {
            if (res2[blobKey]) {
                const payload = res2[blobKey];
                const foundTabId = payload.tabId || res2[`blob_tab_${downloadItem.url}`] || realTabId;
                if (foundTabId) {
                    recordDownloadTab(foundTabId);
                }
                console.log('[rename] blob-context used', { blobKey, payload, tabId: foundTabId });
                chrome.storage.local.remove([blobKey, `blob_tab_${downloadItem.url}`]);
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
// Menggunakan downloadId dan multi-channel tracking untuk akurasi maksimal
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

        let tabId = (typeof item.tabId === 'number' && item.tabId >= 0) ? item.tabId : downloadTabMap[delta.id];

        const finishHandling = (resolvedTabId) => {
            const result = { state, downloadId: delta.id, tabId: resolvedTabId || null, filename: item.filename, ts: Date.now() };
            console.log(`[download-track] SIGA download ${delta.id} ${state} resolvedTabId=${resolvedTabId} filename=${item.filename}`);

            const toSet = {
                [`downloadResult_id_${delta.id}`]: result,
                lastSigaDownloadResult: result
            };
            if (typeof resolvedTabId === 'number' && resolvedTabId >= 0) {
                toSet[`downloadResult_${resolvedTabId}`] = result;
            }
            chrome.storage.local.set(toSet);

            // 1. Direct message ke tab spesifik jika diketahui
            if (typeof resolvedTabId === 'number' && resolvedTabId >= 0) {
                const action = state === 'complete' ? 'downloadComplete' : 'downloadInterrupted';
                chrome.tabs.sendMessage(resolvedTabId, { action, downloadId: delta.id, tabId: resolvedTabId, filename: item.filename }).catch(() => {});
            }

            // 2. Broadcast ke seluruh tab SIGA agar tidak ada tab yang missed
            chrome.tabs.query({ url: "*://newsiga-siga.kemendukbangga.go.id/*" }, (tabs) => {
                tabs.forEach(t => {
                    if (resolvedTabId && t.id === resolvedTabId) return; // sudah dikirim direct
                    const action = state === 'complete' ? 'downloadComplete' : 'downloadInterrupted';
                    chrome.tabs.sendMessage(t.id, {
                        action,
                        downloadId: delta.id,
                        tabId: resolvedTabId || null,
                        filename: item.filename,
                        broadcast: true
                    }).catch(() => {});
                });
            });
        };

        if (tabId) {
            finishHandling(tabId);
        } else {
            chrome.storage.local.get([`download_tab_${delta.id}`], (sRes) => {
                const storedTabId = sRes[`download_tab_${delta.id}`];
                finishHandling(storedTabId || null);
            });
        }
    });
});
