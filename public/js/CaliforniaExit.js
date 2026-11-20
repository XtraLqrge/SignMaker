/* Corner plaques remain exit-tab models while sharing the panel's face. */
window.CaliforniaExit = (() => {
  const records = new WeakMap(), watching = new Set();
  const view = tab => {
    if (!tab || tab._californiaRender) return tab;
    ExitTab.normalizeCalifornia(tab);
    return tab.variant === "California" ? { ...tab, variant: "Default", caStyle: true,
      _californiaRender: true, showLeft: false, bilingual: false, topOffset: false,
      fullBorder: true, width: "Narrow", dragOffsetRem: 0 } : tab;
  };
  const syncEditor = variant => {
    const active = variant === "California";
    for (const id of ["exitTabWidth", "showLeft", "fullBorder", "exitTabBilingual", "topOffset"]) {
      const input = document.getElementById(id);
      if (!input) continue;
      input.disabled = active;
      if (active && input.type === "checkbox") input.checked = id === "fullBorder";
    }
    const positions = document.getElementById("exitTabPosition");
    if (positions) {
      for (const option of positions.options) {
        if (option.value !== "Center") continue;
        option.disabled = active; option.hidden = active;
      }
      if (active && positions.value === "Center") positions.value = "Right";
      const buttons = positions._alignmentButtonsApi;
      buttons?.sync();
      buttons?.wrapper.querySelectorAll("button").forEach(button => {
        button.hidden = active && /center/i.test(button.getAttribute("aria-label") || button.title || "");
      });
    }
  };
  const overlaps = (a, b, gap = 0) => a.left < b.right + gap && a.right > b.left - gap &&
    a.top < b.bottom + gap && a.bottom > b.top - gap;
  const clearance = (rect, obstacles, gap = 0) => obstacles.reduce((amount, obstacle) =>
    overlaps(rect, obstacle, gap) ? Math.max(amount, obstacle.bottom + gap - rect.top) : amount, 0);
  const write = (element, property, value) => {
    if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value, "important");
  };
  const layout = record => {
    const { panel, sign, entries } = record;
    if (!panel.isConnected || !sign.offsetWidth) return;
    for (const [node, properties] of record.shifted) {
      for (const [property, value, priority] of properties) {
        if (value) node.style.setProperty(property, value, priority); else node.style.removeProperty(property);
      }
    }
    record.shifted.clear();
    for (const [property, value] of record.originalSize) {
      if (value) sign.style.setProperty(property, value); else sign.style.removeProperty(property);
    }
    const scale = sign.getBoundingClientRect().width / sign.offsetWidth || 1;
    const style = getComputedStyle(sign), rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const border = { top: parseFloat(style.borderTopWidth) || 0, left: parseFloat(style.borderLeftWidth) || 0, right: parseFloat(style.borderRightWidth) || 0 };
    const heights = { Left: 0, Right: 0 }, widths = { Left: 0, Right: 0 };
    for (const { exitTabCont: container, exitTabIndex, nestedExitTabIndex = -1 } of entries) {
      const parent = record.model.exitTabs[exitTabIndex];
      const model = nestedExitTabIndex >= 0 ? parent?.nestedExitTabs?.[nestedExitTabIndex] : parent;
      if (!model) continue;
      ExitTab.normalizeCalifornia(model);
      container.hidden = !String(model.number || "").trim();
      if (container.hidden) continue;
      const side = model.position === "Left" ? "Left" : "Right", edge = side.toLowerCase();
      container.dataset.californiaSide = edge;
      write(container, "top", `${heights[side] - border.top}px`);
      write(container, edge, `${-border[edge]}px`);
      write(container, side === "Left" ? "right" : "left", "auto");
      const rect = container.getBoundingClientRect();
      widths[side] = Math.max(widths[side], rect.width / scale);
      if (!heights[side]) {
        const tab = container.querySelector(".exitTab");
        if (tab) {
          const radius = getComputedStyle(tab)[`borderTop${side}Radius`];
          write(sign, `border-top-${edge}-radius`, radius);
        }
      }
      heights[side] += rect.height / scale;
    }
    const requiredWidth = widths.Left + widths.Right + (widths.Left && widths.Right ? rem * .3 : 0);
    if (requiredWidth > sign.offsetWidth) write(sign, "min-width", `${requiredWidth}px`);
    const requiredHeight = Math.max(heights.Left, heights.Right) + border.top;
    if (requiredHeight > sign.offsetHeight) write(sign, "min-height", `${requiredHeight}px`);
    // Preserve each block's horizontal place and original vertical position.
    // A shield can remain beside the plaque while text in the same alignment
    // group moves below it. Only the intersecting blocks receive clearance.
    const obstacles = () => entries.filter(entry => !entry.exitTabCont.hidden)
      .map(entry => entry.exitTabCont.getBoundingClientRect());
    const remember = node => {
      if (!record.shifted.has(node)) record.shifted.set(node, ["margin-top", "align-self", "align-items"].map(property =>
        [property, node.style.getPropertyValue(property), node.style.getPropertyPriority?.(property) || ""]));
    };
    for (const arrow of sign.querySelectorAll(".standardSideGuideArrow")) {
      const shift = clearance(arrow.getBoundingClientRect(), obstacles(), .15 * rem * scale);
      if (shift > .25) write(sign, "min-height", `${sign.offsetHeight + 2 * shift / scale}px`);
    }
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (const row of sign.querySelectorAll(".blockElementRow")) {
        if (row.closest(".californiaExitTab")) continue;
        const groups = Array.from(row.children).filter(group => group.dataset.blockAlignment && group.children.length);
        const boxes = groups.map(group => ({ group, rect: group.getBoundingClientRect(),
          blocks: Array.from(group.children).map(block => ({ block, rect: block.getBoundingClientRect() }))
            .filter(({ rect }) => rect.width > 0 && rect.height > 0) }));
        if (!boxes.some(({ blocks }) => blocks.some(({ rect }) => clearance(rect, obstacles(), .15 * rem * scale) > .25))) continue;
        const rowRect = row.getBoundingClientRect(), rowStyle = getComputedStyle(row);
        const rowTop = rowRect.top + ((parseFloat(rowStyle.paddingTop) || 0) + (parseFloat(rowStyle.borderTopWidth) || 0)) * scale;
        for (const { group, rect, blocks } of boxes) {
          remember(group);
          write(group, "align-self", "flex-start");
          write(group, "align-items", "flex-start");
          write(group, "margin-top", `${(rect.top - rowTop) / scale}px`);
          const groupStyle = getComputedStyle(group);
          const groupTop = rect.top + ((parseFloat(groupStyle.paddingTop) || 0) + (parseFloat(groupStyle.borderTopWidth) || 0)) * scale;
          for (const { block, rect: blockRect } of blocks) {
            remember(block);
            const shift = clearance(blockRect, obstacles(), .15 * rem * scale);
            write(block, "align-self", "flex-start");
            write(block, "margin-top", `${(blockRect.top - groupTop + shift) / scale}px`);
            changed ||= shift > .25;
          }
        }
      }
      if (!changed) break;
    }
  };
  const mount = (panel, model, entries = []) => {
    let record = records.get(panel);
    if (record && watching.has(record)) return;
    if (!entries.length && record) entries = record.entries;
    if (!entries.length) return;
    const sign = panel.querySelector(":scope > .signContainer > .sign");
    if (!sign) return;
    if (!record || record.sign !== sign) record = { panel, model, sign, entries, shifted: new Map(), observer: null, frame: null,
      originalSize: new Map(["min-width", "min-height"].map(property => [property, sign.style.getPropertyValue(property)])) };
    record.model = model;
    records.set(panel, record); watching.add(record);
    sign.classList.add("hasCaliforniaExit");
    for (const { exitTabCont: container } of entries) {
      container.classList.add("californiaExitTab");
      const oldParent = container.parentElement;
      sign.appendChild(container);
      if (oldParent?.classList.contains("exitTabContainer") && !oldParent.children.length) oldParent.remove();
    }
    layout(record);
    if (typeof ResizeObserver === "function") {
      record.observer = new ResizeObserver(() => {
        if (record.frame !== null) return;
        record.frame = requestAnimationFrame(() => { record.frame = null; layout(record); });
      });
      record.observer.observe(sign);
      entries.forEach(({ exitTabCont }) => record.observer.observe(exitTabCont));
    }
  };
  const refresh = root => {
    for (const record of watching) if (root === record.panel || root.contains(record.panel)) layout(record);
  };
  const disconnect = () => {
    for (const record of watching) {
      record.observer?.disconnect(); if (record.frame !== null) cancelAnimationFrame(record.frame);
    }
    watching.clear();
  };
  return { view, syncEditor, mount, refresh, disconnect, clearance };
})();
