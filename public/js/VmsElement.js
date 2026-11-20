/* The panel LED renderer, scoped to a single variable-message element. */
window.VmsElement = (() => {
  const selector = ".bE-realisticLED", models = new WeakMap(), states = new WeakMap(), modelImages = new WeakMap();
  const watching = new Set(), recent = new Map();
  let fontProvider = async () => "", captureProvider, queue = Promise.resolve(), previewFrame = null;
  const enabled = element => element.matches(selector) && !element.closest(".panel.vmsPanel");
  const configure = (element, model, panel) => {
    // Do not create any LED work for an element already on a pixelated panel.
    if (model.realisticLED !== true || panel?.isVms === true) {
      element.classList.remove("bE-realisticLED", "ledElementReady");
      element.querySelectorAll(".ledElementDisplay").forEach(node => node.remove());
      models.delete(element); return;
    }
    element.classList.add("bE-realisticLED");
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", String(model.textContent ?? "").replace(/\\n/g, "\n"));
    models.set(element, model);
  };
  const remember = (key, bitmap) => {
    recent.delete(key); recent.set(key, bitmap);
    while (recent.size > 12) recent.delete(recent.keys().next().value);
  };
  const drawPreview = state => {
    if (!state.active || !state.bitmap || !enabled(state.element)) return;
    const { bitmap, display } = state, rect = state.element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    const key = `${width}:${height}`;
    if (state.previewKey === key) return;
    const preview = document.createElement("canvas"); preview.className = "ledElementPreview";
    VmsPanel.renderPreview(preview, bitmap.samples, bitmap.columns, bitmap.rows, width, height, true);
    Object.assign(preview.style, { width: "100%", height: "100%" });
    if (state.preview) state.preview.replaceWith(preview); else display.appendChild(preview);
    state.preview = preview; state.previewKey = key;
  };
  const refreshPreviews = () => {
    if (!watching.size) return;
    if (previewFrame !== null) cancelAnimationFrame(previewFrame);
    previewFrame = requestAnimationFrame(() => { previewFrame = null; watching.forEach(drawPreview); });
  };
  const present = (state, bitmap) => {
    if (!state.active || !enabled(state.element)) return;
    const display = document.createElement("div"); display.className = "ledElementDisplay";
    display.setAttribute("aria-hidden", "true");
    const image = bitmap.image.cloneNode(false); image.className = "ledElementImage";
    image.alt = ""; image.draggable = false;
    Object.assign(image.style, { width: "100%", height: `${bitmap.width * bitmap.rows / bitmap.columns}px` });
    display.appendChild(image);
    state.display?.remove(); state.display = display; state.bitmap = bitmap;
    state.preview = null; state.previewKey = "";
    state.element.appendChild(display); state.element.classList.add("ledElementReady");
    drawPreview(state);
  };
  const isolate = (element, width, height) => {
    const host = document.createElement("div"), source = element.cloneNode(true);
    host.style.cssText = "position:fixed;left:calc(100vw + 100px);top:0;pointer-events:none;";
    source.querySelectorAll(".ledElementDisplay").forEach(node => node.remove());
    source.classList.remove("bE-realisticLED", "ledElementReady");
    // Resolve inherited font and sizing variables before detaching the source
    // from its panel. The editor node and its text never need to be modified.
    const style = getComputedStyle(element);
    for (const property of style) source.style.setProperty(property, style.getPropertyValue(property));
    Object.assign(source.style, { margin: "0", position: "relative", left: "0", top: "0", transform: "none",
      visibility: "visible", opacity: "1", width: `${width}px`, height: `${height}px`,
      minWidth: "0", maxWidth: "none", boxSizing: "border-box", transition: "none", animation: "none" });
    host.appendChild(source); document.body.appendChild(host);
    return { host, source };
  };
  const capture = state => {
    if (!state.active || !enabled(state.element)) return Promise.resolve();
    const element = state.element, model = models.get(element);
    if (!model) return Promise.resolve();
    const width = element.offsetWidth, height = element.offsetHeight;
    if (!width || !height) return Promise.resolve();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const density = Object.hasOwn(VmsPanel.resolutions, model.ledResolution)
      ? VmsPanel.resolutions[model.ledResolution] : VmsPanel.resolutions.medium;
    const columns = Math.max(1, Math.round(width * density / rem)), cell = width / columns;
    const rows = Math.max(1, Math.ceil(height / cell));
    const key = JSON.stringify([model, width, height, columns, rows, getComputedStyle(element).fontFamily]);
    if (state.bitmap?.key === key) { drawPreview(state); return Promise.resolve(); }
    if (state.pendingKey === key && state.pending) return state.pending;
    const request = ++state.request;
    const valid = () => state.active && state.request === request && enabled(element);
    if (recent.has(key)) { present(state, recent.get(key)); return Promise.resolve(); }
    if (!state.bitmap && modelImages.has(model)) present(state, modelImages.get(model));
    // This synchronous snapshot also works while mobile temporarily exposes
    // its full sign layout. All later asynchronous work uses this isolated box.
    const isolated = isolate(element, width, height);
    state.hosts.add(isolated.host); state.pendingKey = key;
    const work = async () => {
      await VmsPanel.waitForSource(isolated.source);
      if (!valid()) return;
      const fontEmbedCSS = await fontProvider(isolated.source);
      if (!valid()) return;
      const job = async () => {
        if (!valid()) return;
        const scale = Math.max(1, Math.min(2, Math.floor(8192 / Math.max(columns, rows))));
        const source = await captureProvider(isolated.source, { width, height: rows * cell,
          canvasWidth: columns * scale, canvasHeight: rows * scale, pixelRatio: 1,
          skipAutoScale: true, cacheBust: false, fontEmbedCSS });
        if (!valid()) { source.width = source.height = 1; return; }
        const samples = VmsPanel.samplePixels(source, columns, rows, true);
        const output = VmsPanel.renderPixels(samples), image = document.createElement("img");
        image.src = output.toDataURL("image/png");
        source.width = source.height = output.width = output.height = 1;
        await image.decode();
        if (!valid()) return;
        const bitmap = { key, samples, image, width, height, columns, rows };
        remember(key, bitmap); modelImages.set(model, bitmap); present(state, bitmap);
      };
      const pending = queue.then(job); queue = pending.catch(() => {}); await pending;
    };
    const pending = work().finally(() => {
      isolated.host.remove(); state.hosts.delete(isolated.host);
      if (state.pending === pending) { state.pending = null; state.pendingKey = ""; }
    });
    state.pending = pending; return pending;
  };
  const mount = (root, { strict = false } = {}) => {
    const elements = [...(root.matches?.(selector) ? [root] : []), ...root.querySelectorAll(selector)];
    return Promise.all(elements.filter(enabled).map(element => {
      let state = states.get(element);
      if (!state) {
        state = { element, active: false, request: 0, bitmap: null, pending: null,
          pendingKey: "", hosts: new Set(), observer: null, timer: null };
        states.set(element, state);
      }
      if (!state.active) {
        state.active = true; state.pending = null; state.pendingKey = ""; watching.add(state);
        if (typeof ResizeObserver === "function") {
          state.observer = new ResizeObserver(() => {
            if (!state.active) return;
            if (state.timer !== null) clearTimeout(state.timer);
            state.timer = setTimeout(() => { state.timer = null; capture(state).catch(report); }, 35);
            drawPreview(state);
          });
          state.observer.observe(element);
        }
      }
      return capture(state).catch(error => { report(error); if (strict) throw error; });
    }));
  };
  const report = error => console.warn("Unable to update the variable-message LED display; keeping its text", error);
  const disconnect = () => {
    for (const state of watching) {
      state.active = false; state.request++;
      state.observer?.disconnect(); if (state.timer !== null) clearTimeout(state.timer);
      for (const host of state.hosts) host.remove(); state.hosts.clear();
    }
    watching.clear();
    if (previewFrame !== null) cancelAnimationFrame(previewFrame); previewFrame = null;
  };
  window.addEventListener("resize", refreshPreviews);
  return { configure, mount, disconnect, refresh: root => mount(root, { strict: true }), refreshPreviews,
    setProviders: (fonts, capture) => { fontProvider = fonts; captureProvider = capture; } };
})();
