/* Stored typography upgrades preserve text content and explicit later choices. */
window.SignMakerMigrations = (() => {
  const key = "signMaker.migrations.typographyAndBanners.v1";
  const legacyFont = value => typeof value === "string" && /^Series\s+EEM$/i.test(value.trim());
  const bannerKeys = new Set(["bannerType", "bannerType2", "bannerCustomText", "bannerCustomText2"]);
  const fontKey = name => /font(?:family)?\d*$/i.test(name);
  const controlFontKey = name => /controltext.*font/i.test(name);
  const migrate = (root, inheritedControl = false, visited = new WeakSet()) => {
    if (!root || typeof root !== "object" || visited.has(root)) return false;
    visited.add(root);
    let changed = false;
    const type = root._elementType || root.__undoType || root.blockElemType ||
      (root.constructor?.name !== "Object" && !Array.isArray(root) ? root.constructor?.name : "");
    const control = type ? type === "ControlTextElement" || type === "sdCtrlText"
      : root.textContent !== undefined && root.spacing !== undefined && root.glow === undefined && root.horizPadding === undefined
        ? true : inheritedControl;
    for (const [name, value] of Object.entries(root)) {
      if (legacyFont(value) && fontKey(name)) {
        root[name] = name === "variantFont" ? ""
          : controlFontKey(name) || control && /^fontFamily$/i.test(name) ? "Series EM" : "Series E";
        changed = true;
      } else if (bannerKeys.has(name) && typeof value === "string" && /^none$/i.test(value.trim())) {
        root[name] = "";
        changed = true;
      } else if (["data", "workspaceData"].includes(name) && typeof value === "string") {
        const converted = serialized(value);
        if (converted !== value) { root[name] = converted; changed = true; }
      } else if (value && typeof value === "object") {
        changed = (typeof value.data === "string" && Array.isArray(value.variants)
          ? template(value) : migrate(value, control, visited)) || changed;
      }
    }
    return changed;
  };
  const serialized = value => {
    if (typeof value !== "string") return value;
    try {
      const parsed = JSON.parse(value);
      return migrate(parsed) ? JSON.stringify(parsed) : value;
    } catch { return value; }
  };
  const template = record => {
    let changed = false;
    for (const variant of Array.isArray(record.variants) ? record.variants : []) {
      if (!variant || !legacyFont(variant.fontFamily)) continue;
      // Bake the old uniform override into its document before converting each
      // element, so control text receives EM and other text receives E.
      const data = JSON.parse(variant.data || record.data);
      const override = value => {
        if (!value || typeof value !== "object") return;
        for (const name of Object.keys(value)) {
          if (name === "fontFamily") value[name] = "Series EEM";
          else override(value[name]);
        }
      };
      override(data); migrate(data);
      variant.data = JSON.stringify(data);
      variant.fontFamily = "";
      changed = true;
    }
    return migrate(record) || changed;
  };
  const preference = (name, value) => {
    if (legacyFont(value)) return controlFontKey(name) ? "Series EM" : "Series E";
    return serialized(value);
  };
  const runOnce = async ({storage = window.localStorage, hasIndexedDB = !!window.indexedDB, readSnapshot, readPersistent, writePersistent, migratePreferences, getTemplates, snapshotKey}) => {
    try { if (storage.getItem(key) === "1") return null; } catch {}
    try { if (await readPersistent(key) === "1") return null; } catch {}
    let snapshot = null;
    try {
      snapshot = serialized(await readSnapshot());
      if (snapshot) {
        let savedPersistently = false;
        try { await writePersistent(snapshotKey, snapshot); savedPersistently = true; }
        catch (error) { if (hasIndexedDB) throw error; }
        try { storage.setItem(snapshotKey, snapshot); }
        catch (error) {
          if (!savedPersistently) throw error;
          // An older local copy must not shadow the upgraded backup.
          try { storage.removeItem(snapshotKey); storage.setItem(`${snapshotKey}.backend`, "indexedDB"); } catch {}
        }
      }
      await migratePreferences();
      const db = await getTemplates();
      await db.migrateTemplates(template);
      // Only completed writes earn the marker; failed transactions retry.
      await writePersistent(key, "1");
      try { storage.setItem(key, "1"); } catch {}
    } catch (error) {
      console.warn("Unable to finish the saved typography upgrade; it will retry next load.", error);
    }
    return snapshot;
  };
  return { key, migrate, serialized, template, preference, runOnce };
})();
