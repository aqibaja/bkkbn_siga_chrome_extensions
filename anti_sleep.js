// anti_sleep.js
// Berjalan di document_start untuk memastikan override requestAnimationFrame 
// terjadi SEBELUM framework React / Vue / SPA lainnya dimuat.
try {
  const script = document.createElement('script');
  script.textContent = \`
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
    Object.defineProperty(document, 'hidden', { get: () => false });
    
    const originalRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = function(cb) {
      if (document.visibilityState === 'hidden' || true) {
         return setTimeout(() => cb(performance.now()), 16);
      }
      return originalRaf(cb);
    };
    
    const originalCaf = window.cancelAnimationFrame;
    window.cancelAnimationFrame = function(id) {
      clearTimeout(id);
      try { originalCaf(id); } catch(e){}
    };
    console.log("[Anti-Sleep] Berhasil disuntikkan sebelum React dimuat!");
  \`;
  document.documentElement.appendChild(script);
  script.remove();
} catch(e) {
  console.log("[Anti-Sleep] Gagal:", e);
}
