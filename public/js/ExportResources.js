// Embedded resources are loaded when exporting, including when opened from disk.
window.SignMakerExportResources = (() => {
  const requests = new Map();
  const load = (file) => {
    if (!requests.has(file)) {
      const request = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = new URL(file, document.baseURI).href;
        script.onload = () => resolve();
        script.onerror = () => {
          script.remove();
          requests.delete(file);
          reject(new Error("Unable to load export resource: " + file));
        };
        document.head.append(script);
      });
      requests.set(file, request);
    }
    return requests.get(file);
  };
  return {
    fonts: () => load("js/ExportFontData.js"),
    assets: async () => {
      await Promise.all([
        load("js/ExportAssetData.js"),
        load("js/ExportAssetData-2.js"),
        load("js/ExportAssetData-3.js"),
      ]);
      // Florida's current artwork overrides entries after all base images load.
      await load("js/FloridaExportAssetData.js");
    },
  };
})();
