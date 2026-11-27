/* Load the editor after the current sign has its first paint opportunity. */
window.SignMakerBoot = (() => {
  const script = document.currentScript;
  const sources = JSON.parse(script?.dataset.editorScripts || "[]");
  const stylesheet = script?.dataset.editorCss;
  let loading;
  const loadEditor = () => {
    if (loading) return loading;
    const styles = !stylesheet ? Promise.resolve() : new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = stylesheet;
      link.onload = resolve;
      link.onerror = () => reject(new Error("Unable to load editor styles."));
      document.head.appendChild(link);
    });
    const scripts = sources.map(source => new Promise((resolve, reject) => {
      const element = document.createElement("script");
      element.async = false;
      element.src = source;
      element.onload = resolve;
      element.onerror = () => reject(new Error("Unable to load editor code."));
      document.head.appendChild(element);
    }));
    loading = Promise.all([styles, ...scripts]);
    return loading;
  };
  // Returning visitors may need saved custom assets and post preferences.
  // Fetch their editor immediately, in parallel with the rendering scripts.
  try {
    const storage = window.localStorage;
    const hasSnapshot = storage.getItem("signMaker.restoreOnRefresh") !== "never" && storage.getItem("signMaker.autosave.v1");
    const hasPostPreferences = ["signMaker.postPosition", "signMaker.showPost", "signMaker.postColor", "signMaker.postThickness"]
      .some(key => storage.getItem(key) !== null);
    if (hasSnapshot || hasPostPreferences) loadEditor().catch(() => {});
  } catch (_) {}
  return { loadEditor };
})();
