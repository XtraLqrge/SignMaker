/* Organize the picker without changing the shield codes used on signs. */
window.SignMakerShieldPickerSettings = (() => {
  const root = "";
  const emptySettings = () => ({ folders: [], hidden: [], moves: {}, orders: {} });

  const readSettings = (serialized) => {
    try {
      const saved = JSON.parse(serialized);
      if (!saved || typeof saved !== "object") return null;
      return {
        folders: Array.isArray(saved.folders) ? saved.folders : [],
        hidden: Array.isArray(saved.hidden) ? saved.hidden : [],
        moves: saved.moves && typeof saved.moves === "object" ? saved.moves : {},
        orders: saved.orders && typeof saved.orders === "object" ? saved.orders : {},
      };
    } catch {
      return null;
    }
  };

  function canMoveTo({ entries, children }, entry, destination) {
    if (!children.has(destination)) return false;
    if (!entry.folder) return true;

    const visited = new Set([entry.key]);
    for (let parent = destination; parent !== root; parent = entries.get(parent).parent) {
      if (visited.has(parent)) return false;
      visited.add(parent);
    }
    return true;
  }

  function buildLayout(catalog, settings) {
    const entries = new Map();
    const children = new Map([[root, []]]);
    const hidden = new Set(settings.hidden);

    const add = (key, node, parent, folder) => {
      if (entries.has(key)) return;
      entries.set(key, { key, node, parent, folder });
      if (folder) children.set(key, []);
    };
    const walk = (nodes, parent) => {
      for (const node of nodes) {
        if (node.customShieldMaker) continue;
        const folder = Array.isArray(node.children);
        // Some built-in shields occur under two different catalogue folders.
        // The original folder distinguishes those entries even after a move.
        const key = folder ? `folder:${node.id}` : `shield:${parent}:${node.value}`;
        add(key, node, parent, folder);
        if (folder) walk(node.children, key);
      }
    };
    walk(catalog, root);

    for (const folder of settings.folders) {
      if (!folder || typeof folder.id !== "string" || typeof folder.label !== "string") continue;
      add(`folder:${folder.id}`, { id: folder.id, label: folder.label }, folder.parent, true);
    }

    for (const entry of entries.values()) {
      const destination = settings.moves[entry.key];
      if (children.has(destination)) entry.parent = destination;
      else if (!children.has(entry.parent)) entry.parent = root;
    }
    for (const entry of entries.values()) {
      if (!canMoveTo({ entries, children }, entry, entry.parent)) entry.parent = root;
      children.get(entry.parent).push(entry);
    }

    for (const [parent, list] of children) {
      const order = settings.orders[parent];
      if (!Array.isArray(order)) continue;
      const ranks = new Map(order.map((key, index) => [key, index]));
      list.sort((a, b) => (ranks.get(a.key) ?? order.length) - (ranks.get(b.key) ?? order.length));
    }

    const branches = (parent) => children.get(parent).flatMap(entry => {
      if (hidden.has(entry.key)) return [];
      if (!entry.folder) return [entry.node];
      const nested = branches(entry.key);
      return [{ ...entry.node, children: nested, disabled: entry.node.disabled || !nested.length }];
    });

    return {
      entries,
      children,
      hidden,
      pickerTree: () => [...catalog.filter(node => node.customShieldMaker), ...branches(root)],
    };
  }

  function placeItem(view, settings, key, { destination, anchor, after }) {
    const entry = view.entries.get(key);
    if (!entry || !canMoveTo(view, entry, destination)) return false;

    const siblings = view.children.get(destination);
    const order = siblings.filter(row => row !== entry).map(row => row.key);
    let index = order.length;
    if (anchor) {
      const anchorIndex = order.indexOf(anchor);
      if (anchorIndex < 0) return false;
      index = anchorIndex + (after ? 1 : 0);
    }
    const sameFolder = destination === entry.parent;
    if (sameFolder && siblings[index] === entry) return false;

    order.splice(index, 0, key);
    settings.orders[destination] = order;
    if (!sameFolder) {
      settings.moves[key] = destination;
      settings.orders[entry.parent] = view.children.get(entry.parent)
        .filter(row => row !== entry).map(row => row.key);
    }
    return true;
  }

  let catalog, save, refreshPickers, settings, layout, pickerTree;
  let pane, ui, folder = root, selection = null;
  const getLayout = () => layout ??= buildLayout(catalog, settings || emptySettings());
  const getPickerTree = () => {
    if (!settings) return catalog;
    return pickerTree ??= getLayout().pickerTree();
  };

  const refresh = () => {
    layout = null;
    pickerTree = null;
    if (pane && !pane.classList.contains("tabHidden")) render();
  };

  const commit = (message) => {
    refresh();
    refreshPickers();
    ui.status.textContent = save(JSON.stringify(settings))
      ? message
      : "Layout changed for this session. It could not be saved on this device.";
  };

  function moveItem(key, placement, follow = false) {
    const view = getLayout();
    const updated = settings || emptySettings();
    if (!placeItem(view, updated, key, placement)) return;
    settings = updated;

    const entry = view.entries.get(key);
    const { destination } = placement;
    if (follow) folder = destination;
    selection = folder === destination ? key : null;
    const label = view.entries.get(destination)?.node.label || "the top level";
    const message = entry.parent === destination
      ? `Reordered ${entry.node.label}.`
      : `Moved ${entry.node.label} to ${label}.`;
    commit(message);
  }

  function folderOptions(view) {
    const options = [new Option("Top level", root)];
    const append = (parent, prefix) => {
      for (const entry of view.children.get(parent)) {
        if (!entry.folder) continue;
        const path = prefix ? `${prefix} / ${entry.node.label}` : entry.node.label;
        const label = view.hidden.has(entry.key) ? `${path} (hidden)` : path;
        options.push(new Option(label, entry.key));
        append(entry.key, path);
      }
    };
    append(root, "");
    return options;
  }

  function render() {
    if (!pane) return;
    if (!ui) bind();
    const view = getLayout();
    if (!view.children.has(folder)) folder = root;
    const rows = view.children.get(folder);
    const selectedIndex = rows.findIndex(entry => entry.key === selection);
    const selected = rows[selectedIndex];
    const target = ui.destination.value;

    ui.folder.replaceChildren(...folderOptions(view));
    ui.folder.value = folder;
    window.getNativeSelectPicker?.(ui.folder)?.sync();
    ui.parent.disabled = folder === root;
    ui.empty.hidden = rows.length > 0;
    ui.actions.hidden = !selected;
    const scrollTop = ui.list.scrollTop;
    ui.list.replaceChildren(...rows.map(entry => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.catalogItem = entry.key;
      button.setAttribute("aria-pressed", String(entry.key === selection));

      const icon = document.createElement("span");
      icon.className = "material-symbols-outlined";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = entry.folder ? "folder" : entry.node.customSavedShield ? "edit" : "image";
      const label = document.createElement("span");
      label.className = "shieldCatalogItemLabel";
      label.textContent = entry.node.label;
      const grip = document.createElement("span");
      grip.className = "material-symbols-outlined shieldCatalogGrip";
      grip.setAttribute("aria-hidden", "true");
      grip.title = "Drag to reorder. Drop on a folder or the up button to move there.";
      grip.textContent = "drag_indicator";
      button.append(grip, icon, label);
      if (view.hidden.has(entry.key)) {
        const status = document.createElement("small");
        status.textContent = "Hidden";
        button.append(status);
      }
      return button;
    }));
    ui.list.scrollTop = scrollTop;
    if (!selected) return;

    ui.up.disabled = selectedIndex === 0;
    ui.down.disabled = selectedIndex === rows.length - 1;
    ui.open.hidden = !selected.folder;
    ui.visibility.hidden = !selected.folder;
    ui.visibility.textContent = view.hidden.has(selection) ? "Show folder" : "Hide folder";
    const options = folderOptions(view)
      .filter(option => option.value !== folder && canMoveTo(view, selected, option.value));
    ui.destination.replaceChildren(...options);
    if (options.some(option => option.value === target)) ui.destination.value = target;
    ui.move.disabled = !ui.destination.options.length;
    ui.destination.disabled = ui.move.disabled;
    window.getNativeSelectPicker?.(ui.destination)?.sync();
  }

  function bindDrag() {
    let drag = null;
    let scrollFrame = 0;

    const findTarget = (x, y) => {
      const view = getLayout();
      const entry = view.entries.get(drag.key);
      const hit = document.elementFromPoint(x, y);
      if (folder !== root && ui.parent.contains(hit)) {
        return { element: ui.parent, position: "into", destination: view.entries.get(folder).parent };
      }
      if (!entry || !ui.list.contains(hit)) return null;
      const row = hit.closest("[data-catalog-item]") ||
        Array.from(ui.list.children).find(item => y < item.getBoundingClientRect().bottom) ||
        ui.list.lastElementChild;
      if (!row || row === drag.source) return null;

      const anchor = row.dataset.catalogItem;
      const bounds = row.getBoundingClientRect();
      const fraction = (y - bounds.top) / bounds.height;
      const isFolder = view.entries.get(anchor)?.folder;
      if (isFolder && fraction >= 0.25 && fraction <= 0.75 && canMoveTo(view, entry, anchor)) {
        return { element: row, position: "into", destination: anchor };
      }
      const after = fraction >= 0.5;
      return { element: row, position: after ? "after" : "before", destination: folder, anchor, after };
    };

    const updateTarget = (x, y) => {
      const target = findTarget(x, y);
      if (drag.target?.element === target?.element && drag.target?.position === target?.position) return;
      drag.target?.element.removeAttribute("data-drop");
      if (target) target.element.dataset.drop = target.position;
      drag.target = target;
    };

    const finish = (place = false) => {
      const { key, source, target } = drag;
      source.removeAttribute("data-dragging");
      target?.element.removeAttribute("data-drop");
      drag = null;
      window.cancelAnimationFrame(scrollFrame);
      if (place && target) moveItem(key, target);
    };

    const scrollList = () => {
      if (!drag || !drag.source.isConnected || !ui.list.getClientRects().length) {
        if (drag) finish();
        return;
      }
      const { x, y } = drag;
      const bounds = ui.list.getBoundingClientRect();
      const edge = Math.min(28, bounds.height / 4);
      if (x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom) {
        const top = Math.max(0, bounds.top + edge - y);
        const bottom = Math.max(0, y - bounds.bottom + edge);
        const previous = ui.list.scrollTop;
        ui.list.scrollTop += Math.round((bottom - top) / 3);
        if (ui.list.scrollTop !== previous) updateTarget(x, y);
      }
      scrollFrame = window.requestAnimationFrame(scrollList);
    };

    ui.list.addEventListener("pointerdown", event => {
      if (drag || !event.isPrimary || event.button !== 0) return;
      const source = event.target.closest("[data-catalog-item]");
      if (!source || (event.pointerType !== "mouse" && !event.target.closest(".shieldCatalogGrip"))) return;
      drag = {
        key: source.dataset.catalogItem, source, pointerId: event.pointerId,
        x: event.clientX, y: event.clientY, active: false, target: null,
      };
    });
    window.addEventListener("pointermove", event => {
      if (drag?.pointerId !== event.pointerId) return;
      const { clientX: x, clientY: y } = event;
      if (!drag.active) {
        if (Math.hypot(drag.x - x, drag.y - y) < 5) return;
        drag.active = true;
        drag.source.dataset.dragging = "";
        ui.list.setPointerCapture(event.pointerId);
        scrollFrame = window.requestAnimationFrame(scrollList);
      }
      drag.x = x;
      drag.y = y;
      event.preventDefault();
      updateTarget(x, y);
    }, { capture: true, passive: false });
    window.addEventListener("pointerup", event => {
      if (drag?.pointerId !== event.pointerId) return;
      if (drag.active) updateTarget(event.clientX, event.clientY);
      finish(drag.active);
    }, true);
    window.addEventListener("pointercancel", event => {
      if (drag?.pointerId === event.pointerId) finish();
    }, true);
    ui.list.addEventListener("lostpointercapture", event => {
      if (event.target === ui.list && drag?.pointerId === event.pointerId) finish();
    });
  }

  function bind() {
    const field = (name) => pane.querySelector(`[data-shield-catalog="${name}"]`);
    ui = Object.fromEntries([
      "folder", "parent", "folderName", "add", "list", "empty", "actions", "up", "down",
      "open", "visibility", "destination", "move", "status",
    ].map(name => [name, field(name)]));

    const browse = (destination) => {
      folder = destination;
      selection = null;
      ui.status.textContent = "";
      render();
      ui.list.scrollTop = 0;
    };
    ui.folder.addEventListener("change", () => browse(ui.folder.value));
    ui.parent.addEventListener("click", () => browse(getLayout().entries.get(folder).parent));
    ui.list.addEventListener("click", event => {
      const button = event.target.closest("[data-catalog-item]");
      if (!button) return;
      selection = button.dataset.catalogItem;
      ui.status.textContent = "";
      render();
      Array.from(ui.list.children).find(row => row.dataset.catalogItem === selection)?.focus();
    });
    bindDrag();

    const addFolder = () => {
      const label = ui.folderName.value.trim();
      if (!label) {
        ui.folderName.focus();
        return;
      }
      if (getLayout().children.get(folder).some(entry => entry.folder &&
          entry.node.label.toLowerCase() === label.toLowerCase())) {
        ui.status.textContent = "A folder with that name already exists here.";
        ui.folderName.focus();
        return;
      }
      settings ??= emptySettings();
      const id = `user-shields-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      settings.folders.push({ id, label, parent: folder });
      selection = `folder:${id}`;
      ui.folderName.value = "";
      commit(`Added ${label}.`);
    };
    ui.add.addEventListener("click", addFolder);
    ui.folderName.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        addFolder();
      }
    });
    ui.open.addEventListener("click", () => browse(selection));
    ui.visibility.addEventListener("click", () => {
      const view = getLayout();
      const entry = view.entries.get(selection);
      const wasHidden = view.hidden.delete(selection);
      if (!wasHidden) view.hidden.add(selection);
      settings ??= emptySettings();
      settings.hidden = [...view.hidden];
      commit(`${entry.node.label} folder ${wasHidden ? "shown" : "hidden"}.`);
    });

    const reorder = (direction) => {
      const siblings = getLayout().children.get(folder);
      const index = siblings.findIndex(entry => entry.key === selection);
      const neighbor = siblings[index + direction];
      if (index < 0 || !neighbor) return;
      moveItem(selection, { destination: folder, anchor: neighbor.key, after: direction > 0 });
    };
    ui.up.addEventListener("click", () => reorder(-1));
    ui.down.addEventListener("click", () => reorder(1));
    ui.move.addEventListener("click", () => {
      moveItem(selection, { destination: ui.destination.value }, true);
    });
  }

  const init = (configuration) => {
    catalog = configuration.catalog;
    save = configuration.save;
    refreshPickers = configuration.refreshPickers;
    settings = readSettings(configuration.load());
    pane = document.getElementById("sMShieldPickerSettings");
  };

  return { buildLayout, placeItem, getPickerTree, init, refresh, render };
})();
