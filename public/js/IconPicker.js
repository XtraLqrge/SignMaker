/* One shared picker, with the target set by the button that opens it. */
class IconPickerController {
  constructor({ icons, loadPreferences, savePreferences, uploadIcon, deleteIcon, prepareIcon = () => null, onLabelsChanged = () => {} }) {
    this.icons = icons;
    this.savePreferences = savePreferences;
    this.uploadIcon = uploadIcon;
    this.deleteIcon = deleteIcon;
    this.prepareIcon = prepareIcon;
    this.onLabelsChanged = onLabelsChanged;
    this.modal = document.getElementById("iconSelectorModal");
    this.grid = document.getElementById("iconGrid");
    this.search = document.getElementById("iconSearch");
    this.sort = document.getElementById("iconPickerSort");
    this.view = document.getElementById("iconPickerView");
    this.tabs = Array.from(this.modal.querySelectorAll("[data-icon-page]"));
    this.fileInput = document.getElementById("uploadCustomIconFile");
    this.targets = new WeakMap();
    this.activeTarget = null;
    this.openRequest = 0;
    this.selectionRequest = 0;
    this.labelFrame = 0;
    this.renameState = null;
    this.preferences = { sort: "recent", view: "grid", page: "uploaded", favorites: [], labels: {} };

    this.ready = Promise.resolve().then(loadPreferences).then((saved) => {
      const defaults = Object.values(this.icons).some((icon) => icon.customIconPicker)
        ? "uploaded" : "built-in";
      this.preferences = {
        sort: saved?.sort === "alphabetical" ? "alphabetical" : "recent",
        view: saved?.view === "list" ? "list" : "grid",
        page: ["uploaded", "built-in"].includes(saved?.page) ? saved.page : defaults,
        favorites: Array.isArray(saved?.favorites)
          ? [...new Set(saved.favorites.filter((key) => typeof key === "string"))] : [],
        labels: saved?.labels && typeof saved.labels === "object" && !Array.isArray(saved.labels)
          ? Object.fromEntries(Object.entries(saved.labels).filter(([, label]) =>
            typeof label === "string" && label.trim().length)) : {},
      };
      this.applyLabels();
    }).catch((error) => console.warn("Unable to load icon picker preferences", error));

    this.search.addEventListener("input", () => this.render());
    this.search.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        this.close();
      }
    });
    this.sort.addEventListener("change", () => {
      this.preferences.sort = this.sort.value === "alphabetical" ? "alphabetical" : "recent";
      this.persist();
      this.render();
    });
    this.view.addEventListener("change", () => {
      this.preferences.view = this.view.value === "list" ? "list" : "grid";
      this.persist();
      this.render();
    });
    this.tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => this.setPage(tab.dataset.iconPage));
      tab.addEventListener("keydown", (event) => {
        let next = index;
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") next = 1 - index;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = this.tabs.length - 1;
        else return;
        event.preventDefault();
        this.setPage(this.tabs[next].dataset.iconPage);
        this.tabs[next].focus();
      });
    });
    document.getElementById("closeIconSelector").addEventListener("click", () => this.close());
    document.getElementById("uploadCustomIconButton").addEventListener("click", () => this.fileInput.click());
    this.fileInput.addEventListener("change", (event) => this.readUpload(event));
    this.modal.addEventListener("click", (event) => {
      if (event.target === this.modal) this.close();
    });
    this.modal.addEventListener("close", () => {
      this.cancelRename();
      this.selectionRequest++;
      this.openRequest++;
      this.activeTarget = null;
    });
    window.addEventListener("resize", () => this.scheduleLabelFit());
    document.fonts?.ready?.then(() => this.scheduleLabelFit()).catch(() => {});
  }

  bindTarget(button, target) {
    if (!this.targets.has(button)) {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.open(this.targets.get(button));
      });
    }
    this.targets.set(button, target);
  }

  async open(target) {
    this.selectionRequest++;
    const request = ++this.openRequest;
    await this.ready;
    if (request !== this.openRequest) return;
    this.activeTarget = target;
    this.search.value = "";
    if (!this.modal.open) this.modal.showModal();
    this.render();
    this.search.focus();
  }

  close() {
    this.selectionRequest++;
    this.cancelRename();
    this.openRequest++;
    this.activeTarget = null;
    if (this.modal.open) this.modal.close();
  }

  persist() {
    this.savePreferences(this.preferences);
  }

  setPage(page) {
    this.preferences.page = page === "built-in" ? "built-in" : "uploaded";
    this.persist();
    this.render();
  }

  getLabel(key, definition = this.icons[key]) {
    return this.preferences.labels[key] || String(definition?.label || definition?.name || key);
  }

  applyLabels() {
    for (const [key, label] of Object.entries(this.preferences.labels)) {
      if (this.icons[key]) this.icons[key].label = label;
    }
    this.onLabelsChanged();
  }

  getEntries() {
    const normalizeSearch = (value) => String(value || "")
      .normalize("NFKC").toLocaleLowerCase().replace(/[\s_-]+/g, "");
    const filter = normalizeSearch(this.search.value);
    const uploaded = this.preferences.page === "uploaded";
    return Object.entries(this.icons).filter(([key, definition]) => {
      if (!!definition.customIconPicker !== uploaded) return false;
      const names = [this.getLabel(key, definition), definition.label, key,
        ...(Array.isArray(definition.searchTerms) ? definition.searchTerms : [])];
      return !filter || names.some((name) => normalizeSearch(name).includes(filter));
    }).sort((a, b) => {
      if (this.preferences.sort === "recent") {
        const addedA = Date.parse(a[1].dateCreated || "") || 0;
        const addedB = Date.parse(b[1].dateCreated || "") || 0;
        if (addedA !== addedB) return addedB - addedA;
        if (uploaded && a[1].customIconOrder !== b[1].customIconOrder) {
          return (b[1].customIconOrder || 0) - (a[1].customIconOrder || 0);
        }
      }
      return this.getLabel(a[0], a[1]).localeCompare(
        this.getLabel(b[0], b[1]), undefined,
        { sensitivity: "base", numeric: true }
      ) || a[0].localeCompare(b[0]);
    });
  }

  render({ preserveScroll = false } = {}) {
    if (!this.activeTarget) return;
    this.cancelRename();
    const scrollTop = preserveScroll ? this.grid.scrollTop : 0;
    this.grid.replaceChildren();
    this.grid.dataset.view = this.preferences.view;
    this.grid.dataset.page = this.preferences.page;
    this.sort.value = this.preferences.sort;
    this.view.value = this.preferences.view;
    this.tabs.forEach((tab) => {
      const selected = tab.dataset.iconPage === this.preferences.page;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected) this.grid.setAttribute("aria-labelledby", tab.id);
    });
    this.search.placeholder = this.preferences.page === "uploaded"
      ? "Search uploaded icons..." : "Search built-in icons...";

    const entries = this.getEntries();
    const favoriteKeys = new Set(this.preferences.favorites);
    const favorites = entries.filter(([key]) => favoriteKeys.has(key));
    const remaining = entries.filter(([key]) => !favoriteKeys.has(key));
    if (favorites.length) this.appendSection("Favorites", favorites, true);
    if (remaining.length) this.appendSection(favorites.length ? "Other icons" : "", remaining, false);
    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "assetGridEmpty";
      empty.textContent = this.search.value.trim()
        ? "No matching icons on this page."
        : this.preferences.page === "uploaded"
          ? "No uploaded icons yet. Use Upload Icon to add an SVG or PNG."
          : "No built-in icons available.";
      this.grid.appendChild(empty);
    }
    this.grid.scrollTop = scrollTop;
    this.scheduleLabelFit();
  }

  appendSection(title, entries, favorite) {
    const section = document.createElement("section");
    section.className = "iconPickerSection";
    section.dataset.favorites = String(favorite);
    section.setAttribute("aria-label", title || "Icons");
    if (title) {
      const heading = document.createElement("h4");
      heading.className = "iconPickerSectionHeading";
      heading.textContent = title;
      section.appendChild(heading);
    }
    const items = document.createElement("div");
    items.className = "iconPickerItems";
    entries.forEach(([key, definition]) => items.appendChild(this.createCard(key, definition, favorite)));
    section.appendChild(items);
    this.grid.appendChild(section);
  }

  createCard(key, definition, favorite) {
    const label = this.getLabel(key, definition);
    const current = key === this.activeTarget.getCurrentKey();
    const card = document.createElement("div");
    card.className = "assetGridCard iconGridCard iconPickerCard";
    card.dataset.assetKey = key;
    card.classList.toggle("selected", current);
    card.classList.toggle("customIconGridCard", !!definition.customIconPicker);

    // Action buttons are siblings of the choose button, never nested buttons.
    const choose = document.createElement("button");
    choose.type = "button";
    choose.className = "iconPickerChooseButton";
    choose.title = label;
    choose.setAttribute("aria-label", label);
    choose.setAttribute("aria-pressed", String(current));
    const preview = document.createElement("span");
    preview.className = "assetGridPreview";
    const image = document.createElement("img");
    image.className = "iconPickerPreviewImage";
    image.src = definition.src || definition.asset || definition.url || "";
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.draggable = false;
    let fallbackTried = false;
    image.addEventListener("error", async () => {
      if (!fallbackTried && typeof window.loadSignMakerIconFallback === "function") {
        fallbackTried = true;
        const fallback = await window.loadSignMakerIconFallback(definition.src || definition.asset || definition.url || "");
        if (fallback) { image.src = fallback; return; }
      }
      preview.textContent = "?";
      card.classList.add("assetPreviewMissing");
    });
    preview.appendChild(image);
    const caption = document.createElement("span");
    caption.className = "assetGridLabel";
    const text = document.createElement("span");
    text.className = "iconPickerLabelText";
    text.textContent = label;
    caption.appendChild(text);
    choose.appendChild(preview);
    const selectIcon = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const target = this.activeTarget;
      if (!target || !this.icons[key]) return;
      const request = ++this.selectionRequest;
      const commit = () => {
        if (request !== this.selectionRequest || target !== this.activeTarget || !this.modal.open || !this.icons[key]) return;
        target.onSelect(key);
        this.close();
      };
      const preparation = this.prepareIcon(key);
      if (preparation && typeof preparation.then === "function") {
        card.setAttribute("aria-busy", "true");
        Promise.resolve(preparation).then(commit, commit).finally(() => card.removeAttribute("aria-busy"));
      } else commit();
    };
    choose.addEventListener("click", selectIcon);
    const warmImage = () => {
      const preparation = this.prepareIcon(key);
      if (preparation?.catch) preparation.catch(() => {});
    };
    card.addEventListener("pointerenter", warmImage, { once: true });
    choose.addEventListener("focus", warmImage, { once: true });
    card.appendChild(choose);
    card.addEventListener("click", (event) => {
      if (event.target === card && !this.renameState) selectIcon(event);
    });

    // Keep the caption outside the choose button so the name field and pencil
    // are independent controls and cannot select a different icon by accident.
    const rename = this.createActionButton("iconPickerRenameButton", `Rename ${label}`);
    const pencil = document.createElement("span");
    pencil.className = "material-symbols-outlined";
    pencil.textContent = "edit";
    rename.appendChild(pencil);
    rename.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.startRename(key, caption, text, rename);
    });
    caption.addEventListener("click", (event) => {
      if (!this.renameState && (event.target === caption || event.target === text)) selectIcon(event);
    });
    caption.appendChild(rename);
    card.appendChild(caption);

    const actions = document.createElement("span");
    actions.className = "iconPickerActions";
    const star = this.createActionButton(
      "iconPickerFavoriteButton", `${favorite ? "Unfavorite" : "Favorite"} ${label}`
    );
    star.setAttribute("aria-pressed", String(favorite));
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "m12 3 2.78 5.63 6.22.91-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.93 1.06-6.2L3 9.54l6.22-.91Z");
    svg.appendChild(path);
    star.appendChild(svg);
    star.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const keys = new Set(this.preferences.favorites);
      if (keys.has(key)) keys.delete(key);
      else keys.add(key);
      this.preferences.favorites = [...keys];
      this.persist();
      this.render({ preserveScroll: true });
      if (event.detail === 0) {
        const updated = Array.from(this.grid.querySelectorAll("[data-asset-key]"))
          .find((element) => element.dataset.assetKey === key);
        updated?.querySelector(".iconPickerFavoriteButton")?.focus({ preventScroll: true });
      }
    });
    actions.appendChild(star);

    if (definition.customIconPicker) {
      const remove = this.createActionButton("customIconDeleteButton", `Delete ${label}`);
      const symbol = document.createElement("span");
      symbol.className = "material-symbols-outlined";
      symbol.textContent = "delete";
      remove.appendChild(symbol);
      remove.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!this.deleteIcon(definition, key)) return;
        this.preferences.favorites = this.preferences.favorites.filter((value) => value !== key);
        delete this.preferences.labels[key];
        this.persist();
        this.render({ preserveScroll: true });
      });
      actions.appendChild(remove);
    }
    card.appendChild(actions);
    return card;
  }

  createActionButton(className, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.title = label;
    button.setAttribute("aria-label", label);
    return button;
  }

  startRename(key, caption, text, button) {
    this.cancelRename();
    const input = document.createElement("input");
    input.type = "text";
    input.className = "iconPickerRenameInput";
    input.value = this.getLabel(key);
    input.setAttribute("aria-label", `Rename ${input.value}`);
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");
    input.dataset.editorBehaviorBound = "true";
    this.renameState = { key, caption, text, button, input };
    text.hidden = true;
    button.hidden = true;
    caption.classList.add("renaming");
    input.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.isComposing) return;
      if (event.key === "Enter" || event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.key === "Enter") this.saveRename();
        else this.cancelRename({ focus: true });
      }
    });
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("blur", () => this.cancelRename());
    caption.appendChild(input);
    input.focus();
    input.select();
  }

  cancelRename({ focus = false } = {}) {
    const state = this.renameState;
    if (!state) return;
    this.renameState = null;
    state.input.remove();
    state.text.hidden = false;
    state.button.hidden = false;
    state.caption.classList.toggle("renaming", false);
    if (focus) state.button.focus({ preventScroll: true });
  }

  saveRename() {
    const state = this.renameState;
    if (!state) return;
    const label = state.input.value.trim();
    const key = state.key;
    this.cancelRename();
    if (label && label !== this.getLabel(key)) {
      // Picker names live with picker preferences, separate from sign history.
      this.preferences.labels[key] = label;
      this.applyLabels();
      this.persist();
    }
    this.render({ preserveScroll: true });
  }

  readUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/svg+xml", "image/png"].includes(file.type) && !/\.(svg|png)$/i.test(file.name)) {
      this.fileInput.value = "";
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const record = this.uploadIcon({ label: file.name, src: reader.result || "" });
      this.fileInput.value = "";
      if (!record) return;
      this.search.value = "";
      this.setPage("uploaded");
    });
    reader.readAsDataURL(file);
  }

  scheduleLabelFit() {
    if (this.labelFrame || !this.modal.open) return;
    this.labelFrame = requestAnimationFrame(() => {
      this.labelFrame = 0;
      this.fitLabels();
    });
  }

  fitLabels() {
    if (!this.modal.open || this.preferences.view !== "grid") return;
    this.grid.querySelectorAll(".iconPickerLabelText").forEach((text) => {
      if (text.hidden) return;
      text.style.removeProperty("font-size");
      const style = window.getComputedStyle(text);
      const baseSize = parseFloat(style.fontSize) || 14;
      const baseLineHeight = parseFloat(style.lineHeight) || baseSize * 1.15;
      const height = Math.ceil(baseLineHeight * 3);
      if (text.scrollHeight <= height + 1) return;

      // Fit extra lines into the original three-line area, reducing the font
      // only when needed. The caption stays anchored inside the card's bottom.
      let low = Math.max(6, baseSize * 0.45);
      let high = baseSize;
      for (let step = 0; step < 8; step++) {
        const size = (low + high) / 2;
        text.style.fontSize = `${size}px`;
        if (text.scrollHeight <= height + 1) low = size;
        else high = size;
      }
      text.style.fontSize = `${Math.floor(low * 10) / 10}px`;
    });
  }
}
