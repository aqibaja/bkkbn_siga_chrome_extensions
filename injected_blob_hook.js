(function () {
    const original = URL.createObjectURL;
    URL.createObjectURL = function (blob) {
        const url = original.call(this, blob);
        window.postMessage({ type: 'SIGA_EXCEL_DOWNLOADER_BLOB', blobUrl: url }, '*');
        return url;
    };
})();