// Large embedded resources are needed for export, not for opening the editor.
// Script tags also work when the app is opened directly from disk.
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
      await load("js/ExportAssetData.js");
      // Florida's current artwork overrides entries in the main bundle.
      await load("js/FloridaExportAssetData.js");
    },
  };
})();
