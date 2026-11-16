/* Keep the editable sign underneath a cached, scale-aware VMS display. */
const VmsPanel = (() => {
  // Pixels per rem keep the LED pitch consistent when a panel gets wider.
  const resolutions = { "extra-low": 8, low: 12, medium: 16, high: 24, "extra-high": 32 };
  const resolutionNames = { 192: "extra-low", 256: "low", 384: "medium", 512: "high", 768: "extra-high" };
  const previousNames = { "extra-low": "extra-low", low: "extra-low", medium: "extra-low", high: "low", "extra-high": "medium" };
  const resolutionVersion = 5, gapRatio = 0.14;
  const oldResolutions = { 96: 192, 160: 384, 240: 512, 320: 768, 384: 192, 512: 256, 768: 384, 1024: 512, 1536: 768 };
  const states = new WeakMap(), models = new WeakMap(), modelImages = new WeakMap(), previewFrames = new WeakMap();
  const recent = new Map(), cacheReads = new Map(), watching = new Set();
  let fontProvider = async () => "";
  let captureProvider = (screen, options) => htmlToImage.toCanvas(screen, options);
  let captureQueue = Promise.resolve(), databasePromise = null, previewFrame = null;

  const settings = (panel = {}) => {
    const requested = Number(panel.vmsResolution);
    const previous = Object.hasOwn(previousNames, panel.vmsResolution) ? panel.vmsResolution
      : resolutionNames[panel.vmsResolutionVersion === 3 ? requested : oldResolutions[requested]];
    const resolution = panel.vmsResolutionVersion === resolutionVersion && Object.hasOwn(resolutions, panel.vmsResolution)
      ? panel.vmsResolution : previousNames[previous];
    return {
      vmsResolution: resolution || "medium",
      vmsResolutionVersion: resolutionVersion,
      vmsAntialias: panel.vmsAntialias !== false,
      vmsFrameColor: String(panel.vmsFrameColor || "#3c3e42"),
    };
  };
  const setEnabled = (panel, enabled) => Object.assign(panel, settings(panel), { isVms: enabled === true });
  const configure = (element, panel) => {
    const options = settings(panel), enabled = panel.isVms === true;
    models.set(element, panel);
    element.classList.toggle("vmsPanel", enabled);
    element.classList.remove("vmsFixedWidth");
    element.style.removeProperty("--vmsPanelWidth");
    element.style.setProperty("--vmsFrameColor", lib.colors[options.vmsFrameColor] || options.vmsFrameColor);
    element.style.setProperty("--vmsPendingColor", lib.colors[panel.color] || panel.color || "#17191b");
    element.dataset.vmsResolution = String(options.vmsResolution);
    element.dataset.vmsAntialias = String(options.vmsAntialias);
  };

  const contentKey = (model) => "vms-display-8:" + JSON.stringify(model, (key, value) => {
    if (["vmsFrameColor", "vmsFixedWidth", "vmsWidth", "__undoType", "_elementType"].includes(key)) return undefined;
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map((name) => [name, value[name]]));
  });
  const remember = (bitmap) => {
    if (!bitmap.key) return;
    recent.delete(bitmap.key); recent.set(bitmap.key, bitmap);
    while (recent.size > 12) recent.delete(recent.keys().next().value);
  };
  const database = () => {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve) => {
      if (typeof indexedDB === "undefined") return resolve(null);
      try {
        const request = indexedDB.open("SignMakerVmsDisplayCache", 1);
        request.onupgradeneeded = () => {
          const store = request.result.createObjectStore("bitmaps", { keyPath: "key" });
          store.createIndex("time", "time");
        };
        request.onerror = request.onblocked = () => resolve(null);
        request.onsuccess = () => resolve(request.result);
      } catch (error) { resolve(null); }
    });
    return databasePromise;
  };
  const readBitmap = (key) => {
    if (recent.has(key)) return Promise.resolve(recent.get(key));
    if (cacheReads.has(key)) return cacheReads.get(key);
    const read = database().then((db) => new Promise((resolve) => {
      if (!db) return resolve(null);
      try {
        const request = db.transaction("bitmaps", "readonly").objectStore("bitmaps").get(key);
        request.onsuccess = () => {
          const bitmap = request.result;
          if (bitmap?.src && bitmap.sampleSrc) { remember(bitmap); resolve(bitmap); }
          else resolve(null);
        };
        request.onerror = () => resolve(null);
      } catch (error) { resolve(null); }
    })).finally(() => cacheReads.delete(key));
    cacheReads.set(key, read);
    return read;
  };
  const saveBitmap = async (bitmap) => {
    if (!bitmap.key) return;
    const db = await database();
    if (!db) return;
    try {
      const store = db.transaction("bitmaps", "readwrite").objectStore("bitmaps");
      const { key, src, sampleSrc, width, height, columns, rows, antialias } = bitmap;
      store.put({ key, src, sampleSrc, width, height, columns, rows, antialias, time: Date.now() });
      const count = store.count();
      count.onsuccess = () => {
        let extra = count.result - 16;
        if (extra <= 0) return;
        const oldest = store.index("time").openCursor();
        oldest.onsuccess = () => {
          const cursor = oldest.result;
          if (!cursor || extra-- <= 0) return;
          cursor.delete(); cursor.continue();
        };
      };
    } catch (error) { /* A full or unavailable cache must not block editing. */ }
  };
  const prepareBitmap = (bitmap) => {
    if (bitmap.ready) return bitmap.ready;
    bitmap.ready = Promise.all([bitmap.src, bitmap.sampleSrc].map(async (src) => {
      const image = document.createElement("img"); image.src = src;
      await image.decode(); return image;
    })).then(([image, samples]) => { Object.assign(bitmap, { image, samples }); return bitmap; });
    return bitmap.ready;
  };

  const createState = (panelElement) => {
    const screen = panelElement.querySelector(":scope > .signContainer");
    if (!screen) return null;
    screen.style.removeProperty("filter");
    const child = (className) => {
      let element = panelElement.querySelector(`:scope > .${className}`);
      if (!element) { element = document.createElement("div"); element.className = className; element.setAttribute("aria-hidden", "true"); panelElement.appendChild(element); }
      return element;
    };
    const state = {
      panelElement, screen, frame: child("vmsPanelFrame"), display: child("vmsPanelDisplay"),
      request: 0, pending: null, pendingKey: "", active: true, timer: null,
      observer: null, mutations: null, bitmap: null, preview: null, previewKey: "",
      width: 0, height: 0, columns: 0, rows: 0, cell: 0, exporting: false,
    };
    states.set(panelElement, state); return state;
  };
  const positionDisplay = (state) => {
    const { screen, frame, display } = state;
    // The visible image and housing share one committed size. The hidden
    // editable layout may resize independently while its next frame renders.
    const width = state.bitmap?.width || state.width, height = state.bitmap?.height || state.height;
    const border = parseFloat(getComputedStyle(frame).borderLeftWidth) || 0;
    Object.assign(frame.style, { left: `${screen.offsetLeft - border}px`, top: `${screen.offsetTop - border}px`, width: `${width + border * 2}px`, height: `${height + border * 2}px` });
    Object.assign(display.style, { left: `${screen.offsetLeft}px`, top: `${screen.offsetTop}px`, width: `${width}px`, height: `${height}px` });
  };
  const measure = (state) => {
    const { screen, panelElement } = state;
    const width = screen.offsetWidth, height = screen.offsetHeight;
    if (!width || !height) return false;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const density = resolutions[panelElement.dataset.vmsResolution] || resolutions.medium;
    const columns = Math.max(1, Math.round(width * density / rem)), cell = width / columns;
    const antialias = panelElement.dataset.vmsAntialias !== "false";
    Object.assign(state, { width, height, columns, rows: Math.max(1, Math.ceil(height / cell)), cell, antialias });
    positionDisplay(state);
    return true;
  };

  const samplePixels = (source, columns, rows, antialias = true) => {
    const samples = document.createElement("canvas"); samples.width = columns; samples.height = rows;
    const context = samples.getContext("2d");
    context.imageSmoothingEnabled = antialias; context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, columns, rows);
    return samples;
  };
  const renderPixels = (samples) => {
    const pitch = Math.max(1, Math.min(8, Math.floor(12000 / Math.max(samples.width, samples.height)),
      Math.floor(Math.sqrt(8000000 / (samples.width * samples.height)))));
    const output = document.createElement("canvas"); output.width = samples.width * pitch; output.height = samples.height * pitch;
    const context = output.getContext("2d");
    if (!context) throw new Error("Unable to create the VMS pixel canvas.");
    context.imageSmoothingEnabled = false; context.drawImage(samples, 0, 0, output.width, output.height);
    const gap = pitch * gapRatio; context.fillStyle = "#000000";
    for (let x = 0; x < output.width; x += pitch) context.fillRect(x, 0, gap, output.height);
    for (let y = 0; y < output.height; y += pitch) context.fillRect(0, y, output.width, gap);
    return output;
  };
  // Draw the clean samples at the viewport's physical resolution. Repeatedly
  // resizing a pre-baked fine grid is what produced the editor's moire bands.
  const renderPreview = (canvas, samples, columns, rows, physicalWidth, physicalHeight, antialias = true) => {
    const limit = Math.min(1, 4096 / physicalWidth, 4096 / physicalHeight, Math.sqrt(8000000 / (physicalWidth * physicalHeight)));
    canvas.width = Math.max(1, Math.round(physicalWidth * limit)); canvas.height = Math.max(1, Math.round(physicalHeight * limit));
    const context = canvas.getContext("2d"), cell = canvas.width / columns;
    context.imageSmoothingEnabled = antialias && cell < 2; context.imageSmoothingQuality = "high";
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(samples, 0, 0, canvas.width, rows * cell);
    if (cell >= 2) {
      // Snap the gaps to physical pixels so they stay black and don't form
      // blurred interference bands as the fitted editor view changes size.
      const gap = Math.max(1, Math.round(cell * gapRatio)); context.fillStyle = "#000000";
      for (let column = 0; column < columns; column++) context.fillRect(Math.round(column * cell), 0, gap, canvas.height);
      for (let row = 0; row < rows; row++) context.fillRect(0, Math.round(row * cell), canvas.width, gap);
    } else {
      // Unresolvable gaps contribute their average darkness instead of a
      // false low-frequency pattern when the whole sign is zoomed far out.
      context.fillStyle = `rgba(0,0,0,${1 - (1 - gapRatio) ** 2})`;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    return canvas;
  };
  const drawPreview = (state) => {
    if (!state.bitmap?.samples || state.exporting || !state.active) return;
    const bitmap = state.bitmap;
    const resizing = bitmap.width !== state.width || bitmap.height !== state.height || bitmap.columns !== state.columns;
    // Keep the rendered grid intact while the sign's layout catches up. Sampling
    // the old content at new dimensions can temporarily erase its pixel gaps.
    if (resizing && state.preview && state.previewBitmap === bitmap) return;
    const rect = state.display.getBoundingClientRect();
    const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round((rect.width || bitmap.width) * dpr));
    const height = Math.max(1, Math.round((rect.height || bitmap.height) * dpr));
    const key = `${width}:${height}`;
    if (key === state.previewKey && state.previewBitmap === bitmap) return;
    // Paint offscreen, then swap. The visible canvas is never cleared in place.
    const preview = document.createElement("canvas"); preview.className = "vmsEditorPreview";
    renderPreview(preview, bitmap.samples, bitmap.columns, bitmap.rows, width, height, bitmap.antialias !== false);
    Object.assign(preview.style, { width: `${bitmap.width}px`, height: `${bitmap.height}px` });
    if (state.preview?.parentElement === state.display) state.preview.replaceWith(preview);
    else state.display.appendChild(preview);
    state.preview = preview; state.previewKey = key; state.previewBitmap = bitmap;
    previewFrames.set(bitmap, { canvas: preview, key });
  };
  const refreshPreviews = () => {
    if (previewFrame !== null) cancelAnimationFrame(previewFrame);
    previewFrame = requestAnimationFrame(() => { previewFrame = null; watching.forEach(drawPreview); });
  };
  const present = (state, bitmap) => {
    if (!bitmap.image || !bitmap.samples) return;
    if (!state.exporting && state.bitmap === bitmap && state.preview) return;
    state.bitmap = bitmap; state.previewKey = "";
    positionDisplay(state);
    const image = bitmap.image.cloneNode(false); image.className = "vmsPanelImage"; image.alt = ""; image.draggable = false;
    image.style.width = `${bitmap.width}px`; image.style.height = `${bitmap.width * bitmap.rows / bitmap.columns}px`;
    state.preview = null; state.previewBitmap = null;
    const retained = !state.exporting && previewFrames.get(bitmap);
    if (retained) {
      const preview = document.createElement("canvas"); preview.className = "vmsEditorPreview";
      preview.width = retained.canvas.width; preview.height = retained.canvas.height;
      preview.getContext("2d").drawImage(retained.canvas, 0, 0);
      Object.assign(preview.style, { width: `${bitmap.width}px`, height: `${bitmap.height}px` });
      state.preview = preview; state.previewBitmap = bitmap; state.previewKey = retained.key;
    }
    drawPreview(state);
    state.display.replaceChildren(image, ...(state.preview ? [state.preview] : []));
    if (state.preview) previewFrames.set(bitmap, { canvas: state.preview, key: state.previewKey });
    state.display.dataset.vmsExport = String(state.exporting); state.display.hidden = false;
    state.panelElement.classList.add("vmsReady"); drawPreview(state);
  };
  const reportError = (state, error) => {
    if (state.active) console.warn("Unable to update the VMS display; keeping the previous frame", error);
  };
  const waitForSource = async (screen) => {
    const fonts = new Set();
    if (document.fonts?.load) {
      for (const element of [screen, ...screen.querySelectorAll("*")]) {
        if (!element.textContent?.trim()) continue;
        const style = getComputedStyle(element);
        if (style.fontFamily && style.fontSize) fonts.add(`${style.fontStyle || "normal"} ${style.fontWeight || "400"} ${style.fontSize} ${style.fontFamily}`);
      }
    }
    await Promise.all([
      ...Array.from(fonts, (font) => document.fonts.load(font).catch(() => {})),
      ...Array.from(screen.querySelectorAll("img"), (image) => image.decode?.().catch(() => {})),
    ]);
  };

  const capture = (state, force = false) => {
    if (!measure(state)) return Promise.resolve();
    const model = models.get(state.panelElement), key = model ? contentKey(model) : null;
    const geometryKey = `${key}:${state.width}:${state.height}:${state.columns}:${state.antialias}`;
    if (!force && state.pendingKey === geometryKey && state.pending) return state.pending;
    const request = ++state.request;
    const valid = () => request === state.request && state.active;
    const matches = (bitmap) => bitmap?.key === key && bitmap.width === state.width && bitmap.height === state.height && bitmap.columns === state.columns && bitmap.antialias === state.antialias;
    const held = (key && recent.get(key)) || (model && modelImages.get(model)) || state.bitmap;
    // This happens synchronously during redraw, before the browser can paint a
    // replacement DOM tree. Edits and resolution changes retain the last frame.
    if (held?.image) present(state, held);
    if (!force && held && matches(held)) return Promise.resolve();
    state.pendingKey = geometryKey;
    const work = async () => {
      let stored = held;
      if (!force && key && stored?.key !== key) stored = await readBitmap(key) || stored;
      if (stored && valid()) {
        try {
          await prepareBitmap(stored);
          if (valid()) { present(state, stored); if (model) modelImages.set(model, stored); }
        } catch (error) { if (key) recent.delete(key); stored = null; }
      }
      if (!valid()) return;
      if (!force && matches(stored)) return;
      await waitForSource(state.screen);
      if (!valid() || !measure(state)) return;
      if (!force && matches(stored)) return;
      const fontEmbedCSS = await fontProvider(state.screen);
      if (!valid()) return;
      const job = async () => {
        if (!valid()) return;
        const { width, height, columns, rows, cell, antialias } = state;
        const dimensionsMatch = () => state.screen.offsetWidth === width && state.screen.offsetHeight === height;
        // A shared oversampled source lets the checkbox choose area averaging
        // or nearest-neighbor sampling without changing the LED grid itself.
        const scale = Math.max(1, Math.min(2, Math.floor(8192 / Math.max(columns, rows))));
        const source = await captureProvider(state.screen, {
          width, height: rows * cell, canvasWidth: columns * scale, canvasHeight: rows * scale, pixelRatio: 1, skipAutoScale: true, cacheBust: false, fontEmbedCSS,
          style: { margin: "0", transform: "none", filter: "none", opacity: "1", width: `${width}px`, height: `${height}px`, minWidth: "0", maxWidth: "none", boxSizing: "border-box", position: "relative", left: "0", top: "0", animation: "none", transition: "none" },
        });
        if (!valid() || !dimensionsMatch()) { source.width = source.height = 1; return; }
        const samples = samplePixels(source, columns, rows, antialias);
        const sampleSrc = samples.toDataURL("image/png"), output = renderPixels(samples);
        const bitmap = { key, sampleSrc, src: output.toDataURL("image/png"), width, height, columns, rows, antialias };
        source.width = source.height = samples.width = samples.height = output.width = output.height = 1;
        await prepareBitmap(bitmap);
        if (!valid() || !dimensionsMatch()) return;
        present(state, bitmap); remember(bitmap);
        if (model) modelImages.set(model, bitmap);
        void saveBitmap(bitmap);
      };
      const render = captureQueue.then(job); captureQueue = render.catch(() => {}); await render;
    };
    const pending = work(); state.pending = pending;
    pending.finally(() => { if (state.pending === pending) state.pending = null; }).catch(() => {});
    return pending;
  };
  const mount = (panelElement, { observe = true, force = false, strict = false, exporting = false } = {}) => {
    if (!panelElement.classList.contains("vmsPanel")) return Promise.resolve();
    const state = states.get(panelElement) || createState(panelElement); if (!state) return Promise.resolve();
    state.active = true; state.exporting = exporting; state.display.dataset.vmsExport = String(state.exporting);
    if (observe && !watching.has(state)) {
      const schedule = (forceRender = false) => {
        if (state.timer !== null) clearTimeout(state.timer);
        state.timer = setTimeout(() => { state.timer = null; if (state.active && panelElement.isConnected) capture(state, forceRender).catch((error) => reportError(state, error)); }, 35);
      };
      if (typeof ResizeObserver === "function") {
        state.observer = new ResizeObserver(() => {
          const changed = state.screen.offsetWidth !== state.width || state.screen.offsetHeight !== state.height;
          if (changed) { state.request++; state.pendingKey = ""; }
          measure(state); drawPreview(state); if (changed) schedule();
        });
        state.observer.observe(state.screen); state.observer.observe(panelElement);
      }
      if (typeof MutationObserver === "function") {
        state.mutations = new MutationObserver(() => { state.request++; state.pendingKey = ""; schedule(true); });
        state.mutations.observe(state.screen, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["src"] });
      }
      watching.add(state);
    }
    const pending = capture(state, force);
    return pending.catch((error) => { reportError(state, error); if (strict) throw error; });
  };
  const disconnect = () => {
    watching.forEach((state) => {
      state.active = false; state.request++; state.pending = null;
      state.observer?.disconnect(); state.mutations?.disconnect();
      if (state.timer !== null) clearTimeout(state.timer); state.timer = null;
    });
    watching.clear();
  };
  const refresh = async (root, { force = false, exporting = false } = {}) => {
    if (!root) return;
    const panels = root.classList?.contains("vmsPanel") ? [root] : Array.from(root.querySelectorAll(".panel.vmsPanel"));
    for (const panel of panels) { const state = states.get(panel); if (state?.timer != null) { clearTimeout(state.timer); state.timer = null; force = true; } }
    await Promise.all(panels.map((panel) => mount(panel, { observe: false, force, strict: true, exporting })));
    if (exporting) panels.forEach((panel) => { const state = states.get(panel); state.preview?.remove(); state.preview = null; });
  };
  if (typeof window !== "undefined") {
    window.addEventListener("resize", refreshPreviews);
    document.addEventListener("transitionend", (event) => { if (event.target?.id === "postContainer") refreshPreviews(); });
  }
  return { settings, setEnabled, configure, mount, disconnect, refresh, refreshPreviews, samplePixels, renderPixels, renderPreview,
    setFontProvider: (provider) => { fontProvider = provider; }, setCaptureProvider: (provider) => { captureProvider = provider; } };
})();
