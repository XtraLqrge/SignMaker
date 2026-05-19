const formHandler = (function () {
    let exposed;
    let post;
    let blockDragState = null;
    let panelDragState = null;
    let exitTabDragState = null;
    let rowDragState = null;
    let newRowDropTargetButton = null;
    let ensureSubpanelMenuOpenPublic = () => {};
    let ensureExitTabMenuOpenPublic = () => {};
    let ensureGuideArrowMenuOpenPublic = () => {};
    let exitTabFontCheckboxChangedByUser = false;

    const syncPostReference = () => {
      if (exposed && typeof exposed.getPost === "function") {
        post = exposed.getPost();
      }
    };
    const syncGlobalBlockControls = () => {
      const globalBlockControls = document.getElementById("globalBlockControls");

      if (globalBlockControls) {
        globalBlockControls.hidden = true;
      }
    };
    const STORAGE_KEYS = {
        postPosition: "signMaker.postPosition",
        postColor: "signMaker.postColor",
        showPost: "signMaker.showPost",
        postThickness: "signMaker.postThickness",
        controlTextFont: "signMaker.controlTextFont",
        bannerFontFamily: "signMaker.bannerFontFamily",
        exitTabFHWAFont: "signMaker.exitTabFHWAFont",
        exitTabFullBorder: "signMaker.exitTabFullBorder",
        exitTabSquareCorners: "signMaker.exitTabSquareCorners",
        exitTabTopOffset: "signMaker.exitTabTopOffset",
        restoreOnRefresh: "signMaker.restoreOnRefresh",
        shortcutOverrides: "signMaker.shortcutOverrides",
        configBarPosition: "signMaker.configBarPosition",
        interfaceUiScale: "signMaker.interfaceUiScale",
        interfaceThemeMode: "signMaker.interfaceThemeMode",
        shieldPickerScrollTop: "signMaker.shieldPickerScrollTop",
        customShieldMakerShields: "signMaker.customShieldMaker.shields.v1",
    };
    let localStorageAvailable;
    let localStorageWarningLogged = false;
    const LIMON_TRIGGER_VALUE = "limon";
    const LIMON_VIDEO_URL = "https://www.youtube.com/watch?v=qA7qUG6uEbY";
const getPostThicknessFallback = () =>
    typeof Post.prototype.defaultThickness === "number"
      ? Post.prototype.defaultThickness
      : 1;
  const normalizeStoredPostThickness = (value) => {
    const parsed =
      typeof value === "string" ? parseFloat(value) : Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
    return getPostThicknessFallback();
  };

  const logStorageWarning = (message, error) => {
    if (!localStorageWarningLogged) {
      console.warn(message, error);
      localStorageWarningLogged = true;
    }
  };

  const hasLocalStorage = () => {
    localStorageAvailable = true;
    return true;
  };

  const getStoredItem = (key) => {
    if (!hasLocalStorage()) {
      return null;
    }
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      logStorageWarning("Unable to read from localStorage", error);
      localStorageAvailable = false;
      return null;
    }
  };

  const setStoredItem = (key, value) => {
    if (!hasLocalStorage()) {
      return;
    }
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      logStorageWarning("Unable to write to localStorage", error);
      localStorageAvailable = false;
    }
  };


  const CUSTOM_SHIELD_MAKER_VALUE_PREFIX = "CUSTOMSHIELD-";
  let customShieldMakerRecords = [];

  const getCustomShieldMakerValue = (id) =>
    CUSTOM_SHIELD_MAKER_VALUE_PREFIX + String(id || "").replace(/[^a-zA-Z0-9_-]/g, "");

  const createCustomShieldMakerId = () =>
    "csm_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 8);

  const getCustomShieldMakerDisplayNumber = (value, fallback = 0) => {
    const parsed = parseFloat(String(value ?? "").trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const normalizeCustomShieldMakerRecord = (record = {}, index = 0) => {
    const id = String(record.id || createCustomShieldMakerId());
    const value = getCustomShieldMakerValue(id);
    const routeStyle = record.routeStyle || {};
    const anchor = record.anchor || routeStyle.anchor || {
      x: 50,
      y: 50,
      seedTop: getCustomShieldMakerDisplayNumber(routeStyle.topOffset, 0),
      seedHorizontal: getCustomShieldMakerDisplayNumber(routeStyle.horizontalOffset, 0),
    };

    return {
      id,
      value,
      name: String(record.name || `Custom Shield ${index + 1}`).trim() || `Custom Shield ${index + 1}`,
      imageData: String(record.imageData || ""),
      routeNumber: String(record.routeNumber ?? "").trim(),
      routeStyle: {
        color: routeStyle.color || "Black",
        fontFamily: routeStyle.fontFamily || "Series D",
        fontSize: getCustomShieldMakerDisplayNumber(routeStyle.fontSize, 220),
        fontWeight: getCustomShieldMakerDisplayNumber(routeStyle.fontWeight, 10),
        letterSpacing: getCustomShieldMakerDisplayNumber(routeStyle.letterSpacing, 0),
        topOffset: getCustomShieldMakerDisplayNumber(routeStyle.topOffset, 0),
        horizontalOffset: getCustomShieldMakerDisplayNumber(routeStyle.horizontalOffset, 0),
        alignment: ["left", "center", "right"].includes(String(routeStyle.alignment || "").toLowerCase())
          ? String(routeStyle.alignment).toLowerCase()
          : "center",
      },
      anchor: {
        x: getCustomShieldMakerDisplayNumber(anchor.x, 50),
        y: getCustomShieldMakerDisplayNumber(anchor.y, 50),
        seedTop: getCustomShieldMakerDisplayNumber(anchor.seedTop, getCustomShieldMakerDisplayNumber(routeStyle.topOffset, 0)),
        seedHorizontal: getCustomShieldMakerDisplayNumber(anchor.seedHorizontal, getCustomShieldMakerDisplayNumber(routeStyle.horizontalOffset, 0)),
      },
      dateCreated: record.dateCreated || new Date().toISOString(),
      dateModified: record.dateModified || record.dateCreated || new Date().toISOString(),
    };
  };

  const loadCustomShieldMakerRecords = () => {
    try {
      const raw = getStoredItem(STORAGE_KEYS.customShieldMakerShields);
      const parsed = raw ? JSON.parse(raw) : [];
      customShieldMakerRecords = Array.isArray(parsed)
        ? parsed.map(normalizeCustomShieldMakerRecord).filter((record) => record.imageData)
        : [];
    } catch (error) {
      console.warn("Unable to load custom shield maker records", error);
      customShieldMakerRecords = [];
    }

    return customShieldMakerRecords;
  };

  const saveCustomShieldMakerRecords = () => {
    setStoredItem(
      STORAGE_KEYS.customShieldMakerShields,
      JSON.stringify(customShieldMakerRecords)
    );
  };

  const getCustomShieldMakerRecordById = (id) =>
    customShieldMakerRecords.find((record) => record.id === id) || null;

  const getCustomShieldMakerRecordByValue = (value) =>
    customShieldMakerRecords.find((record) => record.value === value) || null;

  const buildCustomShieldMakerConfig = (record) => ({
    value: record.value,
    label: record.name,
    variants: ["Image"],
    assetPath: record.imageData,
    assetName: record.value,
    assetFolder: "",
    suppressRouteNumber: false,
    categories: ["Custom"],
    className: `CUSTOMSHIELD customShieldMakerSaved customShieldMaker-${record.id}`,
    customShieldMaker: true,
    customShieldMakerId: record.id,
    customRouteStyle: record.routeStyle,
    customAnchor: record.anchor,
  });

  const syncCustomShieldMakerConfigs = () => {
    if (
      typeof ShieldElement === "undefined" ||
      !Array.isArray(ShieldElement.prototype.blockShieldBases)
    ) {
      return;
    }

    ShieldElement.prototype.blockShieldBases = ShieldElement.prototype.blockShieldBases.filter(
      (shield) => !shield.customShieldMaker
    );

    ShieldElement.prototype.blockShieldBases.unshift(
      ...customShieldMakerRecords.map(buildCustomShieldMakerConfig)
    );
  };

  const buildCustomShieldMakerPickerNode = (record) => ({
    id: `custom-shield-${record.id}`,
    value: record.value,
    label: record.name,
    asset: record.imageData,
    customSavedShield: true,
    customShieldId: record.id,
  });

  const syncCustomShieldMakerPickerTree = () => {
    const makerIndex = SHIELD_PICKER_TREE.findIndex(
      (node) => node.value === SHIELD_PICKER_CUSTOM_MAKER_VALUE
    );
    const insertIndex = makerIndex >= 0 ? makerIndex + 1 : 0;

    for (let index = SHIELD_PICKER_TREE.length - 1; index >= 0; index--) {
      if (SHIELD_PICKER_TREE[index]?.customSavedShield) {
        SHIELD_PICKER_TREE.splice(index, 1);
      }
    }

    SHIELD_PICKER_TREE.splice(
      insertIndex,
      0,
      ...customShieldMakerRecords.map(buildCustomShieldMakerPickerNode)
    );
  };

  const refreshCustomShieldMakerRegistry = () => {
    syncCustomShieldMakerConfigs();
    syncCustomShieldMakerPickerTree();

    if (typeof refreshAllShieldPickers === "function") {
      refreshAllShieldPickers();
    }
  };

  const upsertCustomShieldMakerRecord = (record) => {
    const normalizedRecord = normalizeCustomShieldMakerRecord(record, customShieldMakerRecords.length);
    const existingIndex = customShieldMakerRecords.findIndex(
      (existing) => existing.id === normalizedRecord.id
    );

    if (existingIndex >= 0) {
      normalizedRecord.dateCreated = customShieldMakerRecords[existingIndex].dateCreated;
      customShieldMakerRecords[existingIndex] = normalizedRecord;
    } else {
      customShieldMakerRecords.push(normalizedRecord);
    }

    saveCustomShieldMakerRecords();
    refreshCustomShieldMakerRegistry();
    return normalizedRecord;
  };

  const deleteCustomShieldMakerRecord = (id) => {
    const record = getCustomShieldMakerRecordById(id);
    if (!record) {
      return null;
    }

    customShieldMakerRecords = customShieldMakerRecords.filter(
      (existing) => existing.id !== id
    );
    saveCustomShieldMakerRecords();
    refreshCustomShieldMakerRegistry();
    return record;
  };

  const isCustomShieldMakerValue = (value) =>
    typeof value === "string" && value.startsWith(CUSTOM_SHIELD_MAKER_VALUE_PREFIX);

  const traverseControlShieldElements = (control, callback) => {
    if (!control || !Array.isArray(control.rows)) {
      return;
    }

    for (const row of control.rows) {
      if (!Array.isArray(row)) {
        continue;
      }

      for (const blockElement of row) {
        if (
          blockElement &&
          (blockElement instanceof ShieldElement ||
            blockElement.shieldBase !== undefined ||
            blockElement.type !== undefined)
        ) {
          callback(blockElement);
        }
      }
    }
  };

  const revertCustomShieldMakerUsageToInterstate = (value) => {
    const targetValue = String(value || "");
    const currentPost = exposed && typeof exposed.getPost === "function"
      ? exposed.getPost()
      : post;

    if (!currentPost || !Array.isArray(currentPost.panels)) {
      return;
    }

    for (const panel of currentPost.panels) {
      const sign = panel?.sign;
      if (!sign) {
        continue;
      }

      [sign.blockElements, sign.globalTopBlockElements, sign.globalBottomBlockElements].forEach(
        (control) => traverseControlShieldElements(control, (shield) => {
          if (shield.shieldBase === targetValue || shield.type === targetValue) {
            shield.shieldBase = "I";
            shield.type = "I";
            shield.shieldType = shield.shieldType || "Auto";
          }
        })
      );

      if (Array.isArray(sign.subPanels)) {
        for (const subPanel of sign.subPanels) {
          traverseControlShieldElements(subPanel.blockElements, (shield) => {
            if (shield.shieldBase === targetValue || shield.type === targetValue) {
              shield.shieldBase = "I";
              shield.type = "I";
              shield.shieldType = shield.shieldType || "Auto";
            }
          });

          if (Array.isArray(subPanel.shields)) {
            for (const shield of subPanel.shields) {
              if (shield.shieldBase === targetValue || shield.type === targetValue) {
                shield.shieldBase = "I";
                shield.type = "I";
              }
            }
          }
        }
      }

      if (Array.isArray(sign.shields)) {
        for (const shield of sign.shields) {
          if (shield.shieldBase === targetValue || shield.type === targetValue) {
            shield.shieldBase = "I";
            shield.type = "I";
          }
        }
      }
    }
  };
    
    const normalizeConfigBarPosition = (value) => {
      if (value === "bottom" || value === "top") {
        return value;
      }

      return "right";
    };

    const updateConfigPositionButtons = (position) => {
      const normalized = normalizeConfigBarPosition(position);
      const buttons = document.querySelectorAll("[data-config-position]");

      buttons.forEach((button) => {
        const isActive =
          normalizeConfigBarPosition(button.dataset.configPosition) === normalized;
        button.classList.toggle("active", isActive);
      });
    };

    const applyConfigBarPosition = (position, { persist = false } = {}) => {
      const normalized = normalizeConfigBarPosition(position);
      const configBar = document.getElementById("sMConfigBar");

      if (configBar) {
        configBar.dataset.position = normalized;
      }

      document.documentElement.dataset.configPosition = normalized;
      updateConfigPositionButtons(normalized);

      if (persist) {
        setStoredItem(STORAGE_KEYS.configBarPosition, normalized);
      }
    };

    const getStoredConfigBarPosition = () =>
      normalizeConfigBarPosition(getStoredItem(STORAGE_KEYS.configBarPosition));

    const bindConfigPositionControls = (root = document) => {
      const buttons = root.querySelectorAll("[data-config-position]");

      buttons.forEach((button) => {
        if (button.dataset.configPositionBound === "true") {
          return;
        }

        button.dataset.configPositionBound = "true";

        button.addEventListener("click", () => {
          applyConfigBarPosition(button.dataset.configPosition, { persist: true });
        });
      });
    };
  
  
  const INTERFACE_UI_SCALE_MIN = 50;
  const INTERFACE_UI_SCALE_MAX = 150;
  const INTERFACE_UI_SCALE_STEP = 10;
  const INTERFACE_UI_SCALE_DEFAULT = 100;

  const normalizeInterfaceUIScale = (value) => {
    if (value === null || value === undefined || value === "") {
      return INTERFACE_UI_SCALE_DEFAULT;
    }

    const parsed = typeof value === "string" ? parseFloat(value) : Number(value);

    if (!Number.isFinite(parsed)) {
      return INTERFACE_UI_SCALE_DEFAULT;
    }

    const clamped = Math.max(
      INTERFACE_UI_SCALE_MIN,
      Math.min(INTERFACE_UI_SCALE_MAX, parsed)
    );

    return Math.round(clamped / INTERFACE_UI_SCALE_STEP) * INTERFACE_UI_SCALE_STEP;
  };

  const updateInterfaceUIScaleDisplay = (scaleValue) => {
    const slider = document.getElementById("settingsInterfaceUIScale");
    const valueLabel = document.getElementById("settingsInterfaceUIScaleValue");

    if (slider) {
      slider.min = String(INTERFACE_UI_SCALE_MIN);
      slider.max = String(INTERFACE_UI_SCALE_MAX);
      slider.step = String(INTERFACE_UI_SCALE_STEP);
      slider.value = String(scaleValue);
    }

    if (valueLabel) {
      valueLabel.textContent = `${scaleValue}%`;
    }
  };

  const getActualInterfaceUIScale = (displayScale) => {
    const normalized = normalizeInterfaceUIScale(displayScale);
    return normalized / 150;
  };

  const applyInterfaceUIScale = (value, { persist = false } = {}) => {
    const normalized = normalizeInterfaceUIScale(value);
    const cssScale = getActualInterfaceUIScale(normalized);

    document.documentElement.style.setProperty("--sm-app-zoom", String(cssScale));
    updateInterfaceUIScaleDisplay(normalized);

    if (persist) {
      setStoredItem(STORAGE_KEYS.interfaceUiScale, String(normalized));
    }

    return normalized;
  };
  
  const stepInterfaceUIScale = (direction) => {
    const currentScale = getStoredInterfaceUIScale();
    const nextScale = normalizeInterfaceUIScale(
      currentScale + direction * INTERFACE_UI_SCALE_STEP
    );

    applyInterfaceUIScale(nextScale, { persist: true });
    return nextScale;
  };

  const zoomInterfaceIn = () => {
    const nextScale = stepInterfaceUIScale(1);
    return nextScale;
  };

  const zoomInterfaceOut = () => {
    const nextScale = stepInterfaceUIScale(-1);
    return nextScale;
  };

  const getStoredInterfaceUIScale = () =>
    normalizeInterfaceUIScale(getStoredItem(STORAGE_KEYS.interfaceUiScale));

  const bindInterfaceUIScaleControl = (root = document) => {
    const slider = root.getElementById
      ? root.getElementById("settingsInterfaceUIScale")
      : document.getElementById("settingsInterfaceUIScale");

    if (!slider) {
      applyInterfaceUIScale(getStoredInterfaceUIScale());
      return;
    }

    applyInterfaceUIScale(getStoredInterfaceUIScale());

    if (slider.dataset.interfaceUiScaleBound === "true") {
      return;
    }

    slider.dataset.interfaceUiScaleBound = "true";

    slider.addEventListener("input", () => {
      const normalized = normalizeInterfaceUIScale(slider.value);
      updateInterfaceUIScaleDisplay(normalized);
    });

    slider.addEventListener("change", () => {
      applyInterfaceUIScale(slider.value, { persist: true });
    });
  };

  const formatPostKindLabel = (value) => {
    if (typeof value !== "string") {
      return "";
    }
    const spaced = value.replace(/([a-z])([A-Z])/g, "$1 $2");
    return spaced.replace(/[_-]+/g, " ").trim() || value;
  };

    const normalizeRestoreOnRefreshMode = (value) => {
      const normalized = String(value || "").toLowerCase();
      if (normalized === "always" || normalized === "prompt" || normalized === "never") {
        return normalized;
      }
      return "always";
    };
    
    const getStoredShortcutOverrides = () => {
      const raw = getStoredItem(STORAGE_KEYS.shortcutOverrides);
      if (!raw) {
        return {};
      }

      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch (error) {
        console.warn("Unable to parse saved shortcut overrides", error);
        return {};
      }
    };

    const saveStoredShortcutOverrides = (overrides) => {
      setStoredItem(STORAGE_KEYS.shortcutOverrides, JSON.stringify(overrides || {}));
    };

    const persistShortcutInputValue = (input) => {
      if (!input || !input.id) {
        return;
      }

      const overrides = getStoredShortcutOverrides();
      overrides[input.id] = input.dataset.shortcutInternalValue || "";
      saveStoredShortcutOverrides(overrides);
    };
    
    const normalizeShortcutToken = (value) =>
      String(value || "")
        .toUpperCase()
        .replace(/\s+/g, "")
        .replace(/⌘/g, "CTRL")
        .replace(/⌃/g, "CTRL")
        .replace(/⇧/g, "SHIFT")
        .replace(/⌥/g, "ALT")
        .replace(/CMD/g, "CTRL");
    
    const isMacOS =
      navigator.userAgentData?.platform === "macOS" ||
      /Mac|iPhone|iPad|iPod/.test(navigator.platform || "") ||
      /Mac|iPhone|iPad|iPod/.test(navigator.userAgent || "");

    const formatSingleShortcutForDisplay = (value) => {
      const normalized = normalizeShortcutToken(value);
      if (!normalized) {
        return "";
      }

      if (!isMacOS) {
        return normalized;
      }

      const parts = normalized.split("+").filter(Boolean);
      const modifierSymbols = [];

      const hasCtrl = parts.includes("CTRL");
      const hasShift = parts.includes("SHIFT");
      const hasAlt = parts.includes("ALT");

      if (hasCtrl) {
        modifierSymbols.push("⌘");
      }
      if (hasShift) {
        modifierSymbols.push("⇧");
      }
      if (hasAlt) {
        modifierSymbols.push("⌥");
      }

        const mainKeys = parts
          .filter((part) => part !== "CTRL" && part !== "SHIFT" && part !== "ALT")
          .map((part) => {
            if (part === "ESC") return "Escape";
            if (part === "BACKSPACE") return "Backspace";
            if (part === "LEFT") return "←";
            if (part === "RIGHT") return "→";
            return part;
          });

        return modifierSymbols.join("") + mainKeys.join("+");
    };

    const formatShortcutForDisplay = (value) =>
      String(value || "")
        .split("|")
        .map((part) => formatSingleShortcutForDisplay(part))
        .filter(Boolean)
        .join("|");
    
    const applyStoredShortcutOverrides = (root = document) => {
      const overrides = getStoredShortcutOverrides();
      const shortcutInputs = root.querySelectorAll('#settingsControls input[type="text"]');

      shortcutInputs.forEach((input) => {
        if (!input.id) {
          return;
        }

        if (Object.prototype.hasOwnProperty.call(overrides, input.id)) {
          const storedValue = overrides[input.id] || "";
          input.dataset.shortcutInternalValue = storedValue;
          input.value = formatShortcutForDisplay(storedValue);
        } else {
          input.dataset.shortcutInternalValue = input.defaultValue || "";
          input.value = formatShortcutForDisplay(input.defaultValue || "");
        }
      });
    };
    
  const applyStoredPreferences = () => {
    const storedPostPosition = getStoredItem(STORAGE_KEYS.postPosition);
    if (
      storedPostPosition &&
      Post.prototype.polePositions.includes(storedPostPosition)
    ) {
      post.polePosition = storedPostPosition;
    }

    const storedShowPost = getStoredItem(STORAGE_KEYS.showPost);
    if (storedShowPost !== null) {
      post.showPost = storedShowPost === "true";
    }

    const storedPostColor = getStoredItem(STORAGE_KEYS.postColor);
    if (
      storedPostColor &&
      Array.isArray(Post.prototype.colors) &&
      Post.prototype.colors.includes(storedPostColor)
    ) {
      post.color = storedPostColor;
    }

    const storedPostThickness = getStoredItem(STORAGE_KEYS.postThickness);
    if (storedPostThickness !== null && post) {
      const normalizedThickness =
        typeof post.normalizeThickness === "function"
          ? post.normalizeThickness(storedPostThickness)
          : normalizeStoredPostThickness(storedPostThickness);
      post.thickness = normalizedThickness;
    }

    const storedControlFont = getStoredItem(STORAGE_KEYS.controlTextFont);
    const availableFonts = TextElement.prototype.fontFamily;
    if (
      storedControlFont &&
      Array.isArray(availableFonts) &&
      availableFonts.includes(storedControlFont)
    ) {
      ControlTextElement.setDefaultFont(storedControlFont);
    }

    const storedBannerFont = getStoredItem(STORAGE_KEYS.bannerFontFamily);
    const bannerFonts = ShieldElement.prototype.getBannerFontOptions();
    if (
      storedBannerFont &&
      Array.isArray(bannerFonts) &&
      bannerFonts.includes(storedBannerFont)
    ) {
      ShieldElement.prototype.defaultBannerFontFamily = storedBannerFont;
    }

    const storedExitFHWA = getStoredItem(STORAGE_KEYS.exitTabFHWAFont);
    if (storedExitFHWA !== null) {
      ExitTab.prototype.defaultFHWAFont = storedExitFHWA === "true";
    }

    const storedExitFullBorder = getStoredItem(STORAGE_KEYS.exitTabFullBorder);
    if (storedExitFullBorder !== null) {
      ExitTab.prototype.defaultFullBorder = storedExitFullBorder === "true";
    }

    const storedExitSquareCorners = getStoredItem(STORAGE_KEYS.exitTabSquareCorners);
    if (storedExitSquareCorners !== null) {
      ExitTab.prototype.defaultSquareCorners = storedExitSquareCorners === "true";
    }

    const storedExitTopOffset = getStoredItem(STORAGE_KEYS.exitTabTopOffset);
    if (storedExitTopOffset !== null) {
      ExitTab.prototype.defaultTopOffset = storedExitTopOffset === "true";
    }
  };

  const toggleBlockWiggle = (isActive) => {
    const blocks = document.querySelectorAll(".textEditorBlock");
    for (const block of blocks) {
      block.classList.toggle("blockWiggle", isActive);
      if (isActive) {
        block.style.setProperty("--wiggle-delay", `${Math.random() * 0.12}s`);
      } else {
        block.style.removeProperty("--wiggle-delay");
      }
    }
  };

  const toggleExitTabWiggle = (isActive) => {
    const buttons = document.querySelectorAll(".exitTabButton");
    for (const button of buttons) {
      button.classList.toggle("blockWiggle", isActive);
      if (isActive) {
        button.style.setProperty("--wiggle-delay", `${Math.random() * 0.12}s`);
      } else {
        button.style.removeProperty("--wiggle-delay");
      }
    }
  };

  const togglePanelListWiggle = (isActive) => {
    const buttons = document.querySelectorAll(".panelListButton");
    for (const button of buttons) {
      button.classList.toggle("panelWiggle", isActive);
      if (isActive) {
        button.style.setProperty("--wiggle-delay", `${Math.random() * 0.12}s`);
      } else {
        button.style.removeProperty("--wiggle-delay");
      }
    }
  };

  const toggleExitTabVariantOptionsVisibility = (variantValue) => {
    const tollOptionsElmt = document.getElementById("exitTollLogoOptions");
    if (tollOptionsElmt) {
      tollOptionsElmt.classList.toggle("hidden", variantValue !== "Toll Logo");
    }
  };

  const clearExitTabDropIndicators = () => {
    document
      .querySelectorAll(".exitTabButton.dropBefore, .exitTabButton.dropAfter")
      .forEach((button) => button.classList.remove("dropBefore", "dropAfter"));
  };

  const endExitTabDrag = () => {
    toggleExitTabWiggle(false);
    clearExitTabDropIndicators();
    exitTabDragState = null;
    document
      .querySelectorAll(".exitTabButton.dragging")
      .forEach((button) => {
        button.classList.remove("dragging");
        delete button.dataset.dragging;
      });
  };

  const getExitTabDropPosition = (container, clientX) => {
    const buttons = Array.from(container.querySelectorAll(".exitTabButton"));
    if (!buttons.length) {
      return { dropIndex: 0, targetButton: null, placement: null };
    }

    let dropIndex = Number(
      buttons[buttons.length - 1].dataset.exitTabIndex || buttons.length - 1
    );
    let targetButton = null;
    let placement = "after";
    let foundPosition = false;

    for (const button of buttons) {
      const rect = button.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      if (clientX < midpoint) {
        dropIndex = Number(button.dataset.exitTabIndex || 0);
        placement = "before";
        foundPosition = true;
        targetButton = button.dataset.dragging === "true" ? null : button;
        break;
      }
    }

    if (!foundPosition) {
      const lastButton = buttons[buttons.length - 1];
      dropIndex = Number(lastButton.dataset.exitTabIndex || buttons.length - 1) + 1;
      if (lastButton.dataset.dragging !== "true") {
        targetButton = lastButton;
        placement = "after";
      } else {
        placement = null;
      }
    } else if (!targetButton) {
      placement = null;
    }

    return { dropIndex, targetButton, placement };
  };

  const handleExitTabDragStart = (event) => {
    const button = event.currentTarget;
    const fromIndex = Number(button.dataset.exitTabIndex);
    if (Number.isNaN(fromIndex)) {
      return;
    }
    exitTabDragState = { fromIndex, dropIndex: fromIndex };
    button.dataset.dragging = "true";
    button.classList.add("dragging");
    toggleExitTabWiggle(true);
    clearExitTabDropIndicators();

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.dropEffect = "move";
      event.dataTransfer.setData("text/plain", "");
    }
  };

  const handleExitTabDragOver = (event) => {
    if (!exitTabDragState) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    const container = event.currentTarget;
    const { dropIndex, targetButton, placement } = getExitTabDropPosition(
      container,
      event.clientX
    );
    exitTabDragState.dropIndex = dropIndex;

    clearExitTabDropIndicators();
    if (targetButton && placement) {
      targetButton.classList.add(
        placement === "before" ? "dropBefore" : "dropAfter"
      );
    }
  };

  const handleExitTabDrop = (event) => {
    if (!exitTabDragState) {
      return;
    }
    event.preventDefault();
    const fromIndex = exitTabDragState.fromIndex;
    const dropIndex =
      exitTabDragState.dropIndex !== undefined
        ? exitTabDragState.dropIndex
        : fromIndex;
    exposed.moveExitTab(fromIndex, dropIndex);
    endExitTabDrag();
  };

  const handleExitTabDragLeave = (event) => {
    if (!exitTabDragState) {
      return;
    }
    const container = event.currentTarget;
    const related = event.relatedTarget;
    if (related && container.contains(related)) {
      return;
    }
    clearExitTabDropIndicators();
  };

  const handleExitTabDragEnd = () => {
    if (exitTabDragState) {
      endExitTabDrag();
    }
  };

  const clearPanelDropIndicators = () => {
    document
      .querySelectorAll(
        ".panelListButton.dropBefore, .panelListButton.dropAfter"
      )
      .forEach((button) => button.classList.remove("dropBefore", "dropAfter"));
  };

  const endPanelDrag = () => {
    clearPanelDropIndicators();
    document
      .querySelectorAll(".panelListButton.dragging")
      .forEach((button) => {
        button.classList.remove("dragging");
        delete button.dataset.dragging;
      });
    panelDragState = null;
    togglePanelListWiggle(false);
  };

  const getPanelDropPosition = (container, clientY) => {
    const buttons = Array.from(container.querySelectorAll(".panelListButton"));
    if (!buttons.length) {
      return { dropIndex: 0, targetButton: null, placement: null };
    }

    let dropIndex = Number(
      buttons[buttons.length - 1].dataset.panelIndex || buttons.length - 1
    );
    dropIndex += 1;
    let targetButton = null;
    let placement = "after";
    let foundPosition = false;

    for (const button of buttons) {
      const rect = button.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (clientY < midpoint) {
        dropIndex = Number(button.dataset.panelIndex || 0);
        placement = "before";
        foundPosition = true;
        targetButton = button.dataset.dragging === "true" ? null : button;
        break;
      }
    }

    if (!foundPosition) {
      const lastButton = buttons[buttons.length - 1];
      if (lastButton.dataset.dragging !== "true") {
        targetButton = lastButton;
        placement = "after";
      } else {
        placement = null;
      }
    } else if (!targetButton) {
      placement = null;
    }

    return { dropIndex, targetButton, placement };
  };

  const handlePanelDragStart = (event) => {
    const button = event.currentTarget;
    const fromIndex = Number(button.dataset.panelIndex);
    if (Number.isNaN(fromIndex)) {
      return;
    }
    panelDragState = { fromIndex, dropIndex: fromIndex };
    button.dataset.dragging = "true";
    button.classList.add("dragging");
    togglePanelListWiggle(true);
    clearPanelDropIndicators();

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.dropEffect = "move";
      event.dataTransfer.setData("text/plain", "");
    }
  };

  const handlePanelDragOver = (event) => {
    if (!panelDragState) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    const container = event.currentTarget;
    const { dropIndex, targetButton, placement } = getPanelDropPosition(
      container,
      event.clientY
    );
    panelDragState.dropIndex = dropIndex;

    clearPanelDropIndicators();
    if (targetButton && placement) {
      targetButton.classList.add(
        placement === "before" ? "dropBefore" : "dropAfter"
      );
    }
  };

  const handlePanelDrop = (event) => {
    if (!panelDragState) {
      return;
    }
    event.preventDefault();
    const fromIndex = panelDragState.fromIndex;
    const dropIndex =
      panelDragState.dropIndex !== undefined
        ? panelDragState.dropIndex
        : fromIndex;
    if (typeof exposed.movePanel === "function") {
      exposed.movePanel(fromIndex, dropIndex);
    }
    endPanelDrag();
  };

  const handlePanelDragLeave = (event) => {
    if (!panelDragState) {
      return;
    }
    const container = event.currentTarget;
    const related = event.relatedTarget;
    if (related && container.contains(related)) {
      return;
    }
    clearPanelDropIndicators();
  };

  const handlePanelDragEnd = () => {
    if (panelDragState) {
      endPanelDrag();
    }
  };

  // --- Row Drag and Drop ---
  const toggleRowWiggle = (isActive) => {
    const rows = document.querySelectorAll(".sMControlRow");
    for (const row of rows) {
      row.classList.toggle("rowWiggle", isActive);
      if (isActive) {
        row.style.setProperty("--wiggle-delay", `${Math.random() * 0.12}s`);
      } else {
        row.style.removeProperty("--wiggle-delay");
      }
    }
  };

  const clearRowDropIndicators = () => {
    document
      .querySelectorAll(".sMControlRow.dropBefore, .sMControlRow.dropAfter")
      .forEach((el) => el.classList.remove("dropBefore", "dropAfter"));
  };

  const endRowDrag = () => {
    toggleRowWiggle(false);
    clearRowDropIndicators();
    rowDragState = null;
    document
      .querySelectorAll(".sMControlRow.dragging")
      .forEach((el) => {
        el.classList.remove("dragging");
        delete el.dataset.dragging;
      });
  };

  const getRowDropPosition = (container, clientY) => {
    const rows = Array.from(container.querySelectorAll(".sMControlRow"));
    if (!rows.length) {
      return { dropIndex: 0, targetRow: null, placement: null };
    }

    let dropIndex = rows.length;
    let targetRow = null;
    let placement = "after";
    let foundPosition = false;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rect = row.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (clientY < midpoint) {
        dropIndex = Number(row.dataset.dataRow || i);
        placement = "before";
        foundPosition = true;
        targetRow = row.dataset.dragging === "true" ? null : row;
        break;
      }
    }

    if (!foundPosition) {
      const lastRow = rows[rows.length - 1];
      dropIndex = Number(lastRow.dataset.dataRow || rows.length - 1) + 1;
      if (lastRow.dataset.dragging !== "true") {
        targetRow = lastRow;
        placement = "after";
      } else {
        placement = null;
      }
    } else if (!targetRow) {
      placement = null;
    }

    return { dropIndex, targetRow, placement };
  };

  const handleRowDragStart = (event) => {
    const row = event.currentTarget;
    const fromIndex = Number(row.dataset.dataRow);
    if (Number.isNaN(fromIndex)) {
      return;
    }
    rowDragState = { fromIndex, dropIndex: fromIndex };
    row.dataset.dragging = "true";
    row.classList.add("dragging");
    toggleRowWiggle(true);
    clearRowDropIndicators();

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.dropEffect = "move";
      event.dataTransfer.setData("text/plain", "");
    }
  };

  const handleRowListDragOver = (event) => {
    if (!rowDragState) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    const container = event.currentTarget;
    const { dropIndex, targetRow, placement } = getRowDropPosition(
      container,
      event.clientY
    );
    rowDragState.dropIndex = dropIndex;

    clearRowDropIndicators();
    if (targetRow && placement) {
      targetRow.classList.add(
        placement === "before" ? "dropBefore" : "dropAfter"
      );
    }
  };

  const handleRowListDrop = (event) => {
    if (!rowDragState) {
      return;
    }
    event.preventDefault();
    const fromIndex = rowDragState.fromIndex;
    const dropIndex =
      rowDragState.dropIndex !== undefined
        ? rowDragState.dropIndex
        : fromIndex;
    if (typeof exposed.moveRow === "function") {
      exposed.moveRow(fromIndex, dropIndex);
    }
    endRowDrag();
  };

  const handleRowListDragLeave = (event) => {
    if (!rowDragState) {
      return;
    }
    const container = event.currentTarget;
    const related = event.relatedTarget;
    if (related && container.contains(related)) {
      return;
    }
    clearRowDropIndicators();
  };

  const handleRowDragEnd = () => {
    if (rowDragState) {
      endRowDrag();
    }
  };

  const isTextInputElement = (element) => {
    if (!element || element.disabled || element.readOnly) {
      return false;
    }
    const tagName = element.tagName;
    if (tagName === "TEXTAREA") {
      return true;
    }
    if (tagName === "INPUT") {
      const type = (element.type || "").toLowerCase();
      return (
        type === "text" ||
        type === "search" ||
        type === "email" ||
        type === "url" ||
        type === "tel" ||
        type === "password"
      );
    }
    return false;
  };

  const checkForLimonEasterEgg = (event) => {
    const target = event.target;
    if (!isTextInputElement(target)) {
      return;
    }
    const trimmedValue = (target.value || "").trim().toLowerCase();
    if (trimmedValue === LIMON_TRIGGER_VALUE) {
      if (target.dataset.limonTriggered === "true") {
        return;
      }
      target.dataset.limonTriggered = "true";
      const newWindow = window.open(LIMON_VIDEO_URL, "_blank");
      if (newWindow) {
        newWindow.opener = null;
      }
    } else if (target.dataset.limonTriggered === "true") {
      delete target.dataset.limonTriggered;
    }
  };

  const clearBlockDragIndicators = () => {
    document
      .querySelectorAll(
        ".textEditorBlock.dropBefore, .textEditorBlock.dropAfter"
      )
      .forEach((el) => el.classList.remove("dropBefore", "dropAfter"));
    document
      .querySelectorAll(".sMControlRow.dropActive")
      .forEach((el) => el.classList.remove("dropActive"));
  };

  const setNewRowDropState = (isActive) => {
    if (!newRowDropTargetButton) {
      return;
    }
    if (isActive) {
      newRowDropTargetButton.classList.add("dropActive");
    } else {
      newRowDropTargetButton.classList.remove("dropActive");
    }
  };

  const handleNewRowDragEnter = (event) => {
    if (!blockDragState || !newRowDropTargetButton) {
      return;
    }
    event.preventDefault();
    setNewRowDropState(true);
  };

  const handleNewRowDragOver = (event) => {
    if (!blockDragState || !newRowDropTargetButton) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    setNewRowDropState(true);
  };

  const handleNewRowDragLeave = (event) => {
    if (!blockDragState || !newRowDropTargetButton) {
      return;
    }
    const related = event.relatedTarget;
    if (related && newRowDropTargetButton.contains(related)) {
      return;
    }
    setNewRowDropState(false);
  };

  const handleNewRowDrop = (event) => {
    if (!blockDragState || !newRowDropTargetButton) {
      return;
    }
    event.preventDefault();
    setNewRowDropState(false);
    if (typeof exposed?.duplicateBlockIntoNewRow === "function") {
      exposed.duplicateBlockIntoNewRow(
        blockDragState.rowIndex,
        blockDragState.blockIndex
      );
    }
    endBlockDrag();
  };

  const endBlockDrag = () => {
    toggleBlockWiggle(false);
    clearBlockDragIndicators();
    setNewRowDropState(false);
    blockDragState = null;
    document
      .querySelectorAll(".textEditorBlock.dragging")
      .forEach((el) => el.classList.remove("dragging"));
    document
      .querySelectorAll(".textEditorBlock")
      .forEach((el) => delete el.dataset.dragging);
  };

  const getDropIndexForRow = (rowEl, clientX) => {
    const blocks = Array.from(rowEl.querySelectorAll(".textEditorBlock"));
    if (!blocks.length) {
      return 0;
    }

    let dropIndex = blocks.length;
    let indicatorTarget = null;
    let before = false;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const rect = block.getBoundingClientRect();
      if (clientX < rect.left + rect.width / 2) {
        dropIndex = i;
        indicatorTarget = block;
        before = true;
        break;
      }
    }

    if (!indicatorTarget) {
      indicatorTarget = blocks[blocks.length - 1];
      before = false;
    }

    blocks.forEach((block) => {
      block.classList.remove("dropBefore", "dropAfter");
    });

    indicatorTarget.classList.add(before ? "dropBefore" : "dropAfter");
    return dropIndex;
  };

  const handleBlockDragStart = (event) => {
    event.stopPropagation();
    const target = event.currentTarget;
    const rowIndex = Number(target.dataset.row);
    const blockIndex = Number(target.dataset.block);
    blockDragState = { rowIndex, blockIndex };
    target.dataset.dragging = "true";
    target.classList.add("dragging");
    toggleBlockWiggle(true);
    clearBlockDragIndicators();
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.dropEffect = "move";
      event.dataTransfer.setData("text/plain", "");
    }
  };

  const handleBlockDragEnd = () => {
    if (blockDragState) {
      endBlockDrag();
    }
  };

  const handleRowDragEnter = (event) => {
    if (!blockDragState) {
      return;
    }
    clearBlockDragIndicators();
    const rowEl = event.currentTarget;
    rowEl.classList.add("dropActive");
  };

  const handleRowDragOver = (event) => {
    if (!blockDragState) {
      return;
    }
    const rowEl = event.currentTarget;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    rowEl.classList.add("dropActive");
    getDropIndexForRow(rowEl, event.clientX);
  };

  const handleRowDrop = (event) => {
    if (!blockDragState) {
      return;
    }
    const rowEl = event.currentTarget;
    const rowIndex = Number(rowEl.dataset.dataRow);
    event.preventDefault();
    const dropIndex = getDropIndexForRow(rowEl, event.clientX);
    exposed.moveControlElem(
      blockDragState.rowIndex,
      blockDragState.blockIndex,
      rowIndex,
      dropIndex
    );
    endBlockDrag();
  };

  const handleRowDragLeave = (event) => {
    if (!blockDragState) {
      return;
    }
    const rowEl = event.currentTarget;
    const related = event.relatedTarget;
    if (related && rowEl.contains(related)) {
      return;
    }
    rowEl.classList.remove("dropActive");
    rowEl
      .querySelectorAll(
        ".textEditorBlock.dropBefore, .textEditorBlock.dropAfter"
      )
      .forEach((el) => el.classList.remove("dropBefore", "dropAfter"));
  };
    const bindUndoControls = () => {
      if (document.documentElement.dataset.undoBound === "true") {
        return;
      }
      document.documentElement.dataset.undoBound = "true";

      const tryUndo = () => {
        if (typeof app !== "undefined" && typeof app.undo === "function") {
          app.undo();
        } else if (exposed && typeof exposed.undo === "function") {
          exposed.undo();
        }
      };

      const tryRedo = () => {
        if (typeof app !== "undefined" && typeof app.redo === "function") {
          app.redo();
        } else if (exposed && typeof exposed.redo === "function") {
          exposed.redo();
        }
      };

      const undoSelectors = [
        "#undo",
        "#undoButton",
        "#undoBtn",
        "[data-action='undo']",
        "[aria-label='Undo']",
        "[title='Undo']",
      ];

      for (const selector of undoSelectors) {
        const button = document.querySelector(selector);
        if (!button) {
          continue;
        }

        button.addEventListener("click", (event) => {
          event.preventDefault();
          tryUndo();
        });
        break;
      }

      const redoSelectors = [
        "#redoButton",
        "#redoBtn",
        "[data-action='redo']",
        "[aria-label='Redo']",
        "[title='Redo']",
      ];

      for (const selector of redoSelectors) {
        const button = document.querySelector(selector);
        if (!button) {
          continue;
        }

        button.addEventListener("click", (event) => {
          event.preventDefault();
          tryRedo();
        });
        break;
      }
    };

  const initCustomShieldMaker = () => {
    const dialog = document.getElementById("customShieldMaker");

    if (!dialog || dialog.dataset.customShieldMakerBound === "true") {
      return;
    }

    dialog.dataset.customShieldMakerBound = "true";

    const holder = document.getElementById("modalHolder");
    const openButton = document.getElementById("openCustomShieldMaker");
    const closeButton = document.getElementById("customShieldMakerClose");
    const uploadButton = document.getElementById("customShieldMakerUploadButton");
    const fileInput = document.getElementById("customShieldMakerFile");
    const previewImg = document.getElementById("customShieldMakerPreviewImg");
    const emptyPreview = document.getElementById("customShieldMakerEmptyPreview");
    const routeNumber = document.getElementById("customShieldMakerRouteNumber");
    const routeInput = document.getElementById("customShieldMakerRouteInput");
    const colorSelect = document.getElementById("customShieldMakerRouteColor");
    const fontSelect = document.getElementById("customShieldMakerRouteFont");
    const fontSizeInput = document.getElementById("customShieldMakerRouteFontSize");
    const fontWeightInput = document.getElementById("customShieldMakerRouteFontWeight");
    const letterSpacingInput = document.getElementById("customShieldMakerRouteLetterSpacing");
    const topOffsetInput = document.getElementById("customShieldMakerRouteTopOffset");
    const horizontalOffsetInput = document.getElementById("customShieldMakerRouteHorizontalOffset");
    const alignmentSelect = document.getElementById("customShieldMakerRouteAlignment");
    const nameInput = document.getElementById("customShieldMakerNameInput");
    const saveButton = document.getElementById("customShieldMakerSaveButton");
    const deleteButton = document.getElementById("customShieldMakerDeleteButton");

    const appendSelectOption = (select, value, selected = false) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      option.selected = selected;
      select.appendChild(option);
    };

    const normalizeNumericInput = (value, fallback = 0) => {
      const rawValue = String(value ?? "").trim().replace(/em$/i, "");
      const parsed = parseFloat(rawValue);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    const formatCustomShieldNumber = (value, fallback = "0") => {
      const parsed = Number(value);

      if (!Number.isFinite(parsed)) {
        return fallback;
      }

      return String(Number(parsed.toFixed(4)));
    };

    const previewEmFromDisplayValue = (value, fallback = 0) => {
      const parsed = normalizeNumericInput(value, fallback);
      const adjusted = parsed / 100;
      return `${formatCustomShieldNumber(adjusted, fallback / 100)}em`;
    };

    const displayValueFromActualEm = (value, fallback = "0") => {
      const parsed = normalizeNumericInput(value, Number(fallback) / 100);
      return formatCustomShieldNumber(parsed * 100, fallback);
    };
    
    const displayDeltaToEm = (displayDelta) => {
      return `${formatCustomShieldNumber(displayDelta / 100, "0")}em`;
    };

    const getDisplayInputValue = (input, fallback = 0) => {
      return normalizeNumericInput(input?.value, fallback);
    };

    const setCustomShieldMakerAnchor = ({
      x = 50,
      y = 50,
      seedTop,
      seedHorizontal,
    } = {}) => {
      dialog._customShieldMakerAnchor = {
        x,
        y,
        seedTop:
          seedTop !== undefined
            ? seedTop
            : getDisplayInputValue(topOffsetInput, 0),
        seedHorizontal:
          seedHorizontal !== undefined
            ? seedHorizontal
            : getDisplayInputValue(horizontalOffsetInput, 0),
      };
    };

    const parseCssEmValue = (value, fallback = null) => {
      const rawValue = String(value || "").trim();

      if (!rawValue || rawValue === "auto") {
        return fallback;
      }

      const emMatch = rawValue.match(/^(-?\d*\.?\d+)em$/i);

      if (emMatch) {
        return parseFloat(emMatch[1]);
      }

      return fallback;
    };

    const getMatchedRouteNumberCss = (routeElement) => {
      const matchedStyles = {};
      const matchedPriorities = {};
      const properties = [
        "color",
        "font-family",
        "font-size",
        "font-weight",
        "letter-spacing",
        "top",
        "left",
        "right",
      ];

      const applyStyleRule = (rule) => {
        if (!rule.selectorText || !rule.selectorText.includes(".routeNumber")) {
          return;
        }

        try {
          if (!routeElement.matches(rule.selectorText)) {
            return;
          }
        } catch (error) {
          return;
        }

        for (const property of properties) {
          const value = rule.style.getPropertyValue(property);
          if (!value) {
            continue;
          }

          const priority = rule.style.getPropertyPriority(property);
          const existingPriority = matchedPriorities[property];

          if (existingPriority === "important" && priority !== "important") {
            continue;
          }

          matchedStyles[property] = value.trim();
          matchedPriorities[property] = priority;
        }
      };

      const walkRules = (rules) => {
        for (const rule of Array.from(rules || [])) {
          if (rule.type === CSSRule.STYLE_RULE) {
            applyStyleRule(rule);
          } else if (rule.cssRules) {
            walkRules(rule.cssRules);
          }
        }
      };

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          walkRules(sheet.cssRules);
        } catch (error) {
          continue;
        }
      }

      return matchedStyles;
    };

    const getPreviewFontWeight = () => {
      const displayedWeight = normalizeNumericInput(fontWeightInput?.value, 0);
      const requestedWeight = displayedWeight / 10;

      return {
        requestedWeight,
        cssWeight: Math.min(1000, Math.max(1, requestedWeight)),
      };
    };
    
    const renderCustomShieldMakerRouteText = (routeText) => {
      if (!routeNumber) {
        return;
      }

      routeNumber.replaceChildren();

      for (const character of Array.from(routeText)) {
        const characterSpan = document.createElement("span");
        characterSpan.className = "customShieldMakerRouteChar";
        characterSpan.textContent = character === " " ? "\u00A0" : character;
        routeNumber.appendChild(characterSpan);
      }
    };

    const getResolvedCssColor = (value) => {
      const probe = document.createElement("span");
      probe.style.color = value;
      probe.style.position = "absolute";
      probe.style.left = "-9999px";
      document.body.appendChild(probe);
      const resolved = window.getComputedStyle(probe).color;
      probe.remove();
      return resolved;
    };

    const findNamedColorFromComputedColor = (computedColor) => {
      const resolvedColor = getResolvedCssColor(computedColor);

      if (typeof lib !== "undefined" && lib.colors) {
        for (const [colorName, colorValue] of Object.entries(lib.colors)) {
          if (getResolvedCssColor(colorValue) === resolvedColor) {
            return colorName;
          }
        }
      }

      if (resolvedColor === "rgb(0, 0, 0)") {
        return "Black";
      }

      if (resolvedColor === "rgb(255, 255, 255)") {
        return "White";
      }

      return null;
    };

    const getFontOptionFromComputedFamily = (computedFamily) => {
      const firstFamily = String(computedFamily || "")
        .split(",")[0]
        .replace(/["']/g, "")
        .trim()
        .toLowerCase();

      const fontOptions =
        typeof TextElement !== "undefined" &&
        TextElement.prototype &&
        Array.isArray(TextElement.prototype.fontFamily)
          ? TextElement.prototype.fontFamily
          : [];

      return (
        fontOptions.find((fontName) => {
          const normalizedFont = String(fontName).toLowerCase();
          return (
            normalizedFont === firstFamily ||
            normalizedFont.includes(firstFamily) ||
            firstFamily.includes(normalizedFont)
          );
        }) || null
      );
    };

    const setSelectValueSafely = (select, value, fallbackValue) => {
      if (!select) {
        return;
      }

      const normalizedValue = value || fallbackValue;

      if (
        normalizedValue &&
        !Array.from(select.options || []).some(
          (option) => option.value === normalizedValue
        )
      ) {
        appendSelectOption(select, normalizedValue);
      }

      select.value = normalizedValue || "";
    };

    const populateCustomShieldMakerSelects = () => {
      if (colorSelect && colorSelect.options.length <= 1) {
        const colorNames =
          typeof lib !== "undefined" && lib.colors
            ? Object.keys(lib.colors)
            : ["Black", "White", "Yellow"];

        colorSelect.innerHTML = "";

        for (const colorName of colorNames) {
          appendSelectOption(colorSelect, colorName, colorName === "Black");
        }
      }

      if (fontSelect && fontSelect.options.length <= 1) {
        const fontNames =
          typeof TextElement !== "undefined" &&
          TextElement.prototype &&
          Array.isArray(TextElement.prototype.fontFamily)
            ? TextElement.prototype.fontFamily
            : ["Series D", "Series C", "Arial"];

        fontSelect.innerHTML = "";

        for (const fontName of fontNames) {
          appendSelectOption(fontSelect, fontName, fontName === "Series D");
        }
      }

      if (alignmentSelect && alignmentSelect.options.length === 0) {
        appendSelectOption(alignmentSelect, "left");
        appendSelectOption(alignmentSelect, "center", true);
        appendSelectOption(alignmentSelect, "right");
      }
    };

    const getCurrentShieldMakerSource = () => {
      const currentBlockElem =
        exposed && typeof exposed.getCurrentBlockElem === "function"
          ? exposed.getCurrentBlockElem()
          : null;

      const pendingSource = dialog._customShieldMakerSource || {};
      const sdShieldBase = document.getElementById("sdShield_shieldBase");
      const sdShieldType = document.getElementById("sdShield_shieldType");
      const sdRouteInput = document.getElementById("sdShield_routeNumber");
      const sdAlignment = document.getElementById("sdShield_alignment");

      const shieldBase =
        pendingSource.shieldBase ||
        sdShieldBase?.dataset?.pickerValue ||
        sdShieldBase?.value ||
        currentBlockElem?.shieldBase ||
        currentBlockElem?.type ||
        ShieldElement?.prototype?.defaultShieldBase ||
        "I";

      const shieldType =
        pendingSource.shieldType ||
        sdShieldType?.value ||
        currentBlockElem?.shieldType ||
        ShieldElement?.prototype?.defaultVariant ||
        "Auto";

      const routeValue =
        pendingSource.routeNumber ||
        sdRouteInput?.value ||
        currentBlockElem?.routeNumber ||
        "123";

      const alignment =
        pendingSource.alignment ||
        sdAlignment?.value ||
        currentBlockElem?.alignment ||
        "Center";

      return {
        ...currentBlockElem,
        ...pendingSource,
        shieldBase,
        shieldType,
        routeNumber: routeValue,
        alignment,
      };
    };

    const seedCustomShieldMakerFromCurrentShield = () => {
      if (
        typeof ShieldElement === "undefined" ||
        typeof ShieldElement.prototype?.getBlockShieldConfig !== "function"
      ) {
        return;
      }

      const source = getCurrentShieldMakerSource();
      const sampleShield = new ShieldElement(source);
      sampleShield.shieldBase = source.shieldBase;
      sampleShield.type = source.shieldBase;
      sampleShield.shieldType = source.shieldType;
      sampleShield.routeNumber = String(source.routeNumber ?? "").trim() || "123";
      sampleShield.alignment = source.alignment || "Center";

      const sampleRoot = document.createElement("div");
      sampleRoot.style.position = "absolute";
      sampleRoot.style.left = "-9999px";
      sampleRoot.style.top = "-9999px";
      sampleRoot.style.visibility = "hidden";
      sampleRoot.style.pointerEvents = "none";

      const sampleElement = sampleShield.createElement();
      sampleRoot.appendChild(sampleElement);
      document.body.appendChild(sampleRoot);

      const sampleImg = sampleElement.querySelector(".shieldImg");
      const sampleRoute = sampleElement.querySelector(".routeNumber");

      if (sampleImg && previewImg) {
        previewImg.src = sampleImg.currentSrc || sampleImg.src;
        previewImg.hidden = false;
      }

      if (emptyPreview) {
        emptyPreview.hidden = true;
      }

      if (routeInput) {
        routeInput.value = sampleShield.routeNumber;
      }

      if (alignmentSelect) {
        const nextAlignment = String(sampleShield.alignment || "Center").toLowerCase();
        alignmentSelect.value =
          nextAlignment === "left" || nextAlignment === "right"
            ? nextAlignment
            : "center";
      }

      if (sampleRoute) {
        const computedRoute = window.getComputedStyle(sampleRoute);
        const computedFontSizePx = parseFloat(computedRoute.fontSize) || 16;
        const parentFontSizePx =
          parseFloat(window.getComputedStyle(sampleRoute.parentElement).fontSize) ||
          computedFontSizePx;

        const matchedRouteCss = getMatchedRouteNumberCss(sampleRoute);

        const fallbackFontSizeEm = computedFontSizePx / parentFontSizePx;
        const routeFontSizeEm = parseCssEmValue(
          matchedRouteCss["font-size"],
          fallbackFontSizeEm
        );

        const fallbackTopEm =
          Number.isFinite(parseFloat(computedRoute.top)) && computedFontSizePx
            ? parseFloat(computedRoute.top) / computedFontSizePx
            : 0;

        const routeTopEm = parseCssEmValue(matchedRouteCss.top, fallbackTopEm);

        const leftEm = parseCssEmValue(matchedRouteCss.left, null);
        const rightEm = parseCssEmValue(matchedRouteCss.right, null);

        let routeHorizontalEm = 0;

        if (leftEm !== null && Math.abs(leftEm) > 0) {
          routeHorizontalEm = leftEm;
        } else if (rightEm !== null && Math.abs(rightEm) > 0) {
          routeHorizontalEm = -rightEm;
        } else if (leftEm !== null) {
          routeHorizontalEm = leftEm;
        } else if (rightEm !== null) {
          routeHorizontalEm = -rightEm;
        }

        const letterSpacingPx = parseFloat(computedRoute.letterSpacing);
        const routeLetterSpacingEm =
          Number.isFinite(letterSpacingPx) && computedFontSizePx
            ? letterSpacingPx / computedFontSizePx
            : 0;

        const routeFontWeight = parseFloat(computedRoute.fontWeight);
        const colorName = findNamedColorFromComputedColor(computedRoute.color);
        const fontName = getFontOptionFromComputedFamily(computedRoute.fontFamily);

        setSelectValueSafely(colorSelect, colorName, "Black");
        setSelectValueSafely(fontSelect, fontName, "Series D");

        if (fontSizeInput) {
          fontSizeInput.value = displayValueFromActualEm(routeFontSizeEm, "220");
        }

        if (fontWeightInput) {
          fontWeightInput.value = Number.isFinite(routeFontWeight)
            ? formatCustomShieldNumber(routeFontWeight * 10, "0")
            : "0";
        }

        if (letterSpacingInput) {
          letterSpacingInput.value = displayValueFromActualEm(
            routeLetterSpacingEm,
            "0"
          );
        }

        if (topOffsetInput) {
          topOffsetInput.value = displayValueFromActualEm(routeTopEm, "0");
        }

        if (horizontalOffsetInput) {
          horizontalOffsetInput.value = displayValueFromActualEm(
            routeHorizontalEm,
            "0"
          );
        }
        
        const sampleImgRect = sampleImg?.getBoundingClientRect();
        const sampleRouteRect = sampleRoute.getBoundingClientRect();

        if (
          sampleImgRect &&
          sampleRouteRect &&
          sampleImgRect.width > 0 &&
          sampleImgRect.height > 0
        ) {
          const routeCenterX =
            ((sampleRouteRect.left +
              sampleRouteRect.width / 2 -
              sampleImgRect.left) /
              sampleImgRect.width) *
            100;

          const routeCenterY =
            ((sampleRouteRect.top +
              sampleRouteRect.height / 2 -
              sampleImgRect.top) /
              sampleImgRect.height) *
            100;

          setCustomShieldMakerAnchor({
            x: routeCenterX,
            y: routeCenterY,
            seedTop: getDisplayInputValue(topOffsetInput, 0),
            seedHorizontal: getDisplayInputValue(horizontalOffsetInput, 0),
          });
        } else {
          setCustomShieldMakerAnchor();
        }
      }

      if (!sampleRoute) {
        setCustomShieldMakerAnchor();
      }
      
      sampleRoot.remove();
    };

    const updateCustomShieldMakerPreview = () => {
      if (!routeNumber) {
        return;
      }

      const routeText = String(routeInput?.value || "").trim();
      const selectedColor = colorSelect?.value || "Black";
      const selectedFont = fontSelect?.value || "Series D";
      const selectedAlignment = alignmentSelect?.value || "center";
      const cssColor =
        typeof lib !== "undefined" && lib.colors && lib.colors[selectedColor]
          ? lib.colors[selectedColor]
          : selectedColor;

      const anchor = dialog._customShieldMakerAnchor || {
        x: 50,
        y: 50,
        seedTop: 0,
        seedHorizontal: 0,
      };

      const anchorX =
        selectedAlignment === "left"
          ? 0
          : selectedAlignment === "right"
            ? 100
            : anchor.x;

      const translateX =
        selectedAlignment === "left"
          ? "0%"
          : selectedAlignment === "right"
            ? "-100%"
            : "-50%";

      const { requestedWeight, cssWeight } = getPreviewFontWeight();

      const letterSpacingValue = previewEmFromDisplayValue(
        letterSpacingInput?.value,
        0
      );

      renderCustomShieldMakerRouteText(routeText);

      routeNumber.hidden = routeText.length === 0;
      routeNumber.dataset.alignment = selectedAlignment;
      routeNumber.style.color = String(cssColor).toLowerCase();
      routeNumber.style.fontFamily = `"${selectedFont}", sans-serif`;
      routeNumber.style.fontSize = previewEmFromDisplayValue(
        fontSizeInput?.value,
        220
      );
      routeNumber.style.fontWeight = String(cssWeight);
      routeNumber.style.fontVariationSettings = `"wght" ${requestedWeight}`;
      routeNumber.style.letterSpacing = "0";
      routeNumber.style.gap = letterSpacingValue;
      const topDeltaValue = displayDeltaToEm(
        getDisplayInputValue(topOffsetInput, 0) - anchor.seedTop
      );

      const horizontalDeltaValue = displayDeltaToEm(
        getDisplayInputValue(horizontalOffsetInput, 0) - anchor.seedHorizontal
      );

      routeNumber.style.top = `calc(${anchor.y}% + ${topDeltaValue})`;
      routeNumber.style.left = `calc(${anchorX}% + ${horizontalDeltaValue})`;
      routeNumber.style.right = "auto";
      routeNumber.style.transform = `translate(${translateX}, -50%)`;
      routeNumber.style.margin = "0";
      routeNumber.style.alignItems = "center";
      routeNumber.style.textAlign = selectedAlignment;
      routeNumber.style.justifyContent =
        selectedAlignment === "left"
          ? "flex-start"
          : selectedAlignment === "right"
            ? "flex-end"
            : "center";
    };

    const getDefaultCustomShieldMakerName = () =>
      `Custom Shield ${customShieldMakerRecords.length + 1}`;

    const setCustomShieldMakerDeleteVisibility = () => {
      if (deleteButton) {
        deleteButton.hidden = !dialog._editingCustomShieldId;
      }
    };

    const showCustomShieldMakerDialog = () => {
      updateCustomShieldMakerPreview();
      setCustomShieldMakerDeleteVisibility();

      if (holder) {
        holder.style.display = "flex";
      }

      dialog.style.display = "flex";

      if (!dialog.open) {
        dialog.showModal();
      }
    };

    const applyCustomShieldMakerRecordToEditor = (record) => {
      if (!record) {
        return;
      }

      populateCustomShieldMakerSelects();
      dialog._editingCustomShieldId = record.id;
      dialog.dataset.customShieldMakerUserUploaded = "true";
      dialog._customShieldMakerSource = {
        shieldBase: record.value,
        type: record.value,
        routeNumber: record.routeNumber || routeInput?.value || "123",
        alignment: record.routeStyle?.alignment || "center",
      };

      if (nameInput) {
        nameInput.value = record.name || getDefaultCustomShieldMakerName();
      }

      if (previewImg) {
        previewImg.src = record.imageData;
        previewImg.hidden = false;
      }

      if (emptyPreview) {
        emptyPreview.hidden = true;
      }

      if (routeInput) {
        routeInput.value = record.routeNumber || routeInput.value || "";
      }

      const style = record.routeStyle || {};
      setSelectValueSafely(colorSelect, style.color || "Black", "Black");
      setSelectValueSafely(fontSelect, style.fontFamily || "Series D", "Series D");

      if (fontSizeInput) {
        fontSizeInput.value = formatCustomShieldNumber(style.fontSize, "220");
      }
      if (fontWeightInput) {
        fontWeightInput.value = formatCustomShieldNumber(style.fontWeight, "10");
      }
      if (letterSpacingInput) {
        letterSpacingInput.value = formatCustomShieldNumber(style.letterSpacing, "0");
      }
      if (topOffsetInput) {
        topOffsetInput.value = formatCustomShieldNumber(style.topOffset, "0");
      }
      if (horizontalOffsetInput) {
        horizontalOffsetInput.value = formatCustomShieldNumber(style.horizontalOffset, "0");
      }
      if (alignmentSelect) {
        alignmentSelect.value = style.alignment || "center";
      }

      setCustomShieldMakerAnchor(record.anchor || style.anchor || {
        x: 50,
        y: 50,
        seedTop: getDisplayInputValue(topOffsetInput, 0),
        seedHorizontal: getDisplayInputValue(horizontalOffsetInput, 0),
      });
    };

    const collectCustomShieldMakerRecordFromEditor = () => {
      const existingRecord = dialog._editingCustomShieldId
        ? getCustomShieldMakerRecordById(dialog._editingCustomShieldId)
        : null;

      const imageData = previewImg && !previewImg.hidden ? previewImg.src : "";
      if (!imageData) {
        window.alert("Upload or select a shield image before saving.");
        return null;
      }

      const id = existingRecord?.id || createCustomShieldMakerId();
      const now = new Date().toISOString();
      const fallbackName = existingRecord?.name || getDefaultCustomShieldMakerName();
      const name = String(nameInput?.value || fallbackName).trim() || fallbackName;
      const anchor = dialog._customShieldMakerAnchor || {
        x: 50,
        y: 50,
        seedTop: getDisplayInputValue(topOffsetInput, 0),
        seedHorizontal: getDisplayInputValue(horizontalOffsetInput, 0),
      };

      return {
        id,
        value: getCustomShieldMakerValue(id),
        name,
        imageData,
        routeNumber: String(routeInput?.value || "").trim(),
        routeStyle: {
          color: colorSelect?.value || "Black",
          fontFamily: fontSelect?.value || "Series D",
          fontSize: getDisplayInputValue(fontSizeInput, 220),
          fontWeight: getDisplayInputValue(fontWeightInput, existingRecord?.routeStyle?.fontWeight || 10),
          letterSpacing: getDisplayInputValue(letterSpacingInput, 0),
          topOffset: getDisplayInputValue(topOffsetInput, 0),
          horizontalOffset: getDisplayInputValue(horizontalOffsetInput, 0),
          alignment: alignmentSelect?.value || "center",
        },
        anchor,
        dateCreated: existingRecord?.dateCreated || now,
        dateModified: now,
      };
    };

    const refreshAfterCustomShieldMutation = () => {
      refreshCustomShieldMakerRegistry();
      if (typeof updateShieldCountyVisibility === "function") {
        updateShieldCountyVisibility();
      }
      if (typeof updateForm === "function") {
        updateForm();
      }
      if (exposed && typeof exposed.redraw === "function") {
        exposed.redraw();
      }
    };

    const saveCustomShieldMakerRecordFromEditor = () => {
      const nextRecord = collectCustomShieldMakerRecordFromEditor();
      if (!nextRecord) {
        return;
      }

      if (exposed && typeof exposed.beginUndoableChange === "function") {
        exposed.beginUndoableChange();
      }

      try {
        const savedRecord = upsertCustomShieldMakerRecord(nextRecord);
        dialog._editingCustomShieldId = savedRecord.id;
        setCustomShieldMakerDeleteVisibility();

        const currentBlockElem =
          exposed && typeof exposed.getCurrentBlockElem === "function"
            ? exposed.getCurrentBlockElem()
            : null;

        if (currentBlockElem) {
          currentBlockElem.shieldBase = savedRecord.value;
          currentBlockElem.type = savedRecord.value;
          if (routeInput && "routeNumber" in currentBlockElem) {
            currentBlockElem.routeNumber = routeInput.value;
          }
        }

        if (typeof syncShieldBasePickerValue === "function") {
          syncShieldBasePickerValue(savedRecord.value, { updateBlock: true });
        }

        applyCustomShieldMakerRecordToEditor(savedRecord);
        refreshAfterCustomShieldMutation();
      } finally {
        if (exposed && typeof exposed.endUndoableChange === "function") {
          exposed.endUndoableChange();
        }
      }
    };

    const deleteCurrentCustomShieldMakerRecord = () => {
      const editingId = dialog._editingCustomShieldId;
      if (!editingId) {
        return;
      }

      const record = getCustomShieldMakerRecordById(editingId);
      if (!record) {
        dialog._editingCustomShieldId = null;
        setCustomShieldMakerDeleteVisibility();
        return;
      }

      if (exposed && typeof exposed.beginUndoableChange === "function") {
        exposed.beginUndoableChange();
      }

      try {
        const currentBlockElem =
          exposed && typeof exposed.getCurrentBlockElem === "function"
            ? exposed.getCurrentBlockElem()
            : null;
        const currentBlockUsedDeletedShield = !!(
          currentBlockElem &&
          (currentBlockElem.shieldBase === record.value || currentBlockElem.type === record.value)
        );

        deleteCustomShieldMakerRecord(editingId);
        revertCustomShieldMakerUsageToInterstate(record.value);
        dialog._editingCustomShieldId = null;
        setCustomShieldMakerDeleteVisibility();

        if (currentBlockUsedDeletedShield && typeof syncShieldBasePickerValue === "function") {
          syncShieldBasePickerValue("I", { updateBlock: true });
        }

        refreshAfterCustomShieldMutation();
        closeCustomShieldMaker();
      } finally {
        if (exposed && typeof exposed.endUndoableChange === "function") {
          exposed.endUndoableChange();
        }
      }
    };

    dialog._openSavedCustomShield = (id) => {
      const record = getCustomShieldMakerRecordById(id);
      if (!record) {
        return;
      }

      applyCustomShieldMakerRecordToEditor(record);
      showCustomShieldMakerDialog();
    };

    const openCustomShieldMaker = () => {
      populateCustomShieldMakerSelects();

      if (!dialog._editingCustomShieldId) {
        if (nameInput && !nameInput.value.trim()) {
          nameInput.value = getDefaultCustomShieldMakerName();
        }

        if (dialog.dataset.customShieldMakerUserUploaded !== "true") {
          seedCustomShieldMakerFromCurrentShield();
        }
      }

      showCustomShieldMakerDialog();
    };

    const closeCustomShieldMaker = () => {
      if (dialog.open) {
        dialog.close();
      } else {
        dialog.style.display = "none";
      }
    };

    const hideCustomShieldMaker = () => {
      dialog.style.display = "none";

      if (holder) {
        const hasOtherOpenDialog = Array.from(holder.querySelectorAll("dialog")).some(
          (otherDialog) => otherDialog !== dialog && otherDialog.open
        );

        if (!hasOtherOpenDialog) {
          holder.style.display = "none";
        }
      }
    };

    openButton?.addEventListener("click", () => {
      dialog._editingCustomShieldId = null;
      delete dialog.dataset.customShieldMakerUserUploaded;
      if (nameInput) {
        nameInput.value = getDefaultCustomShieldMakerName();
      }
      openCustomShieldMaker();
    });
    saveButton?.addEventListener("click", saveCustomShieldMakerRecordFromEditor);
    deleteButton?.addEventListener("click", deleteCurrentCustomShieldMakerRecord);
    closeButton?.addEventListener("click", closeCustomShieldMaker);
    dialog.addEventListener("close", hideCustomShieldMaker);

    uploadButton?.addEventListener("click", () => {
      fileInput?.click();
    });

    fileInput?.addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];

      if (!file) {
        return;
      }

      const isValidFile =
        file.type === "image/svg+xml" ||
        file.type === "image/png" ||
        /\.(svg|png)$/i.test(file.name);

      if (!isValidFile) {
        event.target.value = "";
        return;
      }

      const reader = new FileReader();

      reader.onload = (readerEvent) => {
        if (previewImg) {
          previewImg.src = readerEvent.target.result;
          previewImg.hidden = false;
        }

        if (emptyPreview) {
          emptyPreview.hidden = true;
        }

        dialog.dataset.customShieldMakerUserUploaded = "true";
        
        setCustomShieldMakerAnchor({
          x: 50,
          y: 50,
          seedTop: getDisplayInputValue(topOffsetInput, 0),
          seedHorizontal: getDisplayInputValue(horizontalOffsetInput, 0),
        });
      };

      reader.readAsDataURL(file);
    });

    [
      routeInput,
      colorSelect,
      fontSelect,
      fontSizeInput,
      fontWeightInput,
      letterSpacingInput,
      topOffsetInput,
      horizontalOffsetInput,
      alignmentSelect,
    ].forEach((input) => {
      input?.addEventListener("input", updateCustomShieldMakerPreview);
      input?.addEventListener("change", updateCustomShieldMakerPreview);
    });

    populateCustomShieldMakerSelects();
    updateCustomShieldMakerPreview();
  };
  
  const initialize = async (appExposed) => {
    exposed = appExposed;
    post = exposed.getPost();
    applyStoredPreferences();
    await initUI();
    initCustomShieldMaker();
    bindConfigPositionControls();
    applyConfigBarPosition(getStoredConfigBarPosition());
    bindUndoControls();
    applyInterfaceUIScale(getStoredInterfaceUIScale());
    bindInterfaceUIScaleControl(document);

    try {
      //console.log(promptShield(null));
    } catch (e) {
      console.error(e);
    }
  };
    
    const applyEditorInputBehavior = (root = document) => {
      const editorInputs = root.querySelectorAll(
        'input[type="text"], input[type="number"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input[type="password"], textarea'
      );

      for (const input of editorInputs) {
        if (input.dataset.editorBehaviorBound === "true") {
          continue;
        }
        input.dataset.editorBehaviorBound = "true";

        input.setAttribute("autocomplete", "off");
        input.setAttribute("autocorrect", "off");
        input.setAttribute("autocapitalize", "off");
        input.setAttribute("spellcheck", "false");

        input.addEventListener("keydown", (event) => {
          if (event.key !== "Enter") {
            return;
          }

          if (input.tagName === "TEXTAREA" && event.shiftKey) {
            return;
          }

            event.preventDefault();
            event.stopPropagation();

            if (
              typeof formHandler !== "undefined" &&
              typeof formHandler.readForm === "function"
            ) {
              formHandler.readForm();
            }

            input.blur();

          input.blur();
        });
      }
    };
    
    const syncSettingsDefaultsFamilyPreviewSelect = (selectEl) => {
      if (!selectEl) {
        return;
      }

      if (selectEl.value === "Clearview") {
        selectEl.style.fontFamily = '"Clearview 5WR", sans-serif';
        selectEl.style.fontSize = "1rem";
      } else if (selectEl.value === "Highway Gothic") {
        selectEl.style.fontFamily = '"Series EM", sans-serif';
        selectEl.style.fontSize = "1.2rem";
      } else if (selectEl.value === "Arial") {
        selectEl.style.fontFamily = 'Arial, sans-serif';
        selectEl.style.fontSize = "1rem";
      } else if (selectEl.value === "Transport") {
        selectEl.style.fontFamily = '"Transport", sans-serif';
        selectEl.style.fontSize = "1rem";
      } else if (selectEl.value === "DIN 1451") {
        selectEl.style.fontFamily = '"DIN 1451", sans-serif';
        selectEl.style.fontSize = "1rem";
      } else if (selectEl.value === "Rawlinson") {
        selectEl.style.fontFamily = '"Rawlinson Regular", serif';
        selectEl.style.fontSize = "1rem";
      } else if (selectEl.value === "Helvetica Neue") {
        selectEl.style.fontFamily = '"Helvetica Neue Roman", sans-serif';
        selectEl.style.fontSize = "1rem";
      } else {
        selectEl.style.fontFamily = 'Inter, sans-serif';
        selectEl.style.fontSize = "1rem";
      }
    };

    const syncFontPreviewSelect = (selectEl) => {
      if (!selectEl) {
        return;
      }

      selectEl.classList.add("fontPreviewSelect");

      const id = selectEl.id || "";

      if (
        id === "settingsDefaultsControlTextFontFamily" ||
        id === "settingsDefaultsAdvisoryFontFamily" ||
        id === "settingsDefaultsActionFontFamily"
      ) {
        if (selectEl.value === "Clearview") {
          selectEl.style.fontFamily = '"Clearview 5WR", sans-serif';
          selectEl.style.fontSize = "1rem";
        } else if (selectEl.value === "Highway Gothic") {
          selectEl.style.fontFamily = '"Series EM", sans-serif';
          selectEl.style.fontSize = "1.1rem";
        } else if (selectEl.value === "Arial") {
          selectEl.style.fontFamily = 'Arial, sans-serif';
          selectEl.style.fontSize = "1rem";
        } else if (selectEl.value === "Transport") {
          selectEl.style.fontFamily = '"Transport", sans-serif';
          selectEl.style.fontSize = "1rem";
        } else {
          selectEl.style.fontFamily = 'Inter, sans-serif';
          selectEl.style.fontSize = "1rem";
        }
        return;
      }

        const selectedFont = selectEl.value || "Inter";
        selectEl.style.fontFamily = `"${selectedFont}", sans-serif`;
    };
    
    const bindAllFontPreviewSelects = (root = document) => {
      const fontSelects = Array.from(root.querySelectorAll("select")).filter(
        (selectEl) =>
          /font/i.test(selectEl.id || "") ||
          /font/i.test(selectEl.name || "") ||
          /font/i.test(selectEl.className || "")
      );

      for (const selectEl of fontSelects) {
        syncFontPreviewSelect(selectEl);

        if (selectEl.dataset.fontPreviewBound === "true") {
          continue;
        }

        selectEl.dataset.fontPreviewBound = "true";
        selectEl.addEventListener("change", () => {
          syncFontPreviewSelect(selectEl);
        });
      }
    };
    
    const FONT_PICKER_SINGLE_FONT_FAMILIES = new Set(["Transport", "DIN 1451"]);

    const getFontPickerFamilies = () => {
      const allFonts = Array.isArray(TextElement.prototype.fontFamily)
        ? TextElement.prototype.fontFamily
        : [];

      const familyDefs = [
        {
          family: "Clearview",
          previewFont: "Clearview 5WR",
          fonts: allFonts.filter((font) => /^Clearview/i.test(font)),
        },
        {
          family: "Highway Gothic",
          previewFont: "Series EM",
          fonts: allFonts.filter((font) => /^Series/i.test(font)),
        },
        {
          family: "Arial",
          previewFont: "Arial",
          fonts: allFonts.filter(
            (font) => font === "Arial" || font === "Arial Bold"
          ),
        },
        {
          family: "Transport",
          previewFont: "Transport",
          fonts: allFonts.filter((font) => font === "Transport"),
        },
        {
          family: "DIN 1451",
          previewFont: "DIN 1451",
          fonts: allFonts.filter((font) => font === "DIN 1451"),
        },
        {
          family: "ITC Stone Sans",
          previewFont: "ITC Stone Sans Regular",
          fonts: allFonts.filter((font) => /^ITC Stone Sans/i.test(font)),
        },
        {
          family: "Rawlinson",
          previewFont: "Rawlinson Regular",
          fonts: allFonts.filter((font) => /^Rawlinson/i.test(font)),
        },
        {
          family: "Helvetica Neue",
          previewFont: "Helvetica Neue Roman",
          fonts: allFonts.filter((font) => /^Helvetica Neue/i.test(font)),
        },
      ];

      return familyDefs.filter((def) => def.fonts.length > 0);
    };

    const getFontsForPickerFamily = (family) => {
      const match = getFontPickerFamilies().find((def) => def.family === family);
      return match ? match.fonts : [];
    };

    const getFontPickerFamilyForFont = (font) => {
      const families = getFontPickerFamilies();
      const match = families.find((def) => def.fonts.includes(font));
      return match ? match.family : "";
    };

    const getFontPickerPreviewFontForFamily = (family) => {
      const match = getFontPickerFamilies().find((def) => def.family === family);
      if (!match) {
        return "Inter";
      }

      return match.fonts.includes(match.previewFont)
        ? match.previewFont
        : match.fonts[0];
    };

    const isHighwayGothicFontValue = (value) =>
      /^Series/i.test(String(value || "")) || value === "Highway Gothic";

    const getFontPickerDisplaySize = (value) =>
      isHighwayGothicFontValue(value) ? "120%" : "100%";

    const closeAllFontPickers = (except = null) => {
      document.querySelectorAll(".fontPicker.open").forEach((picker) => {
        if (picker !== except) {
          picker.classList.remove("open");
        }
      });
    };

    const setNativeFontSelectValue = (selectEl, value, { dispatch = true } = {}) => {
      if (!selectEl || !value) {
        return;
      }

      const hasOption = Array.from(selectEl.options).some(
        (option) => option.value === value
      );

      if (!hasOption) {
        lib.appendOption(selectEl, value);
      }

      selectEl.value = value;

      if (dispatch) {
        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };

    const createFontPicker = ({ selectEl, mode, linkedFamilySelect = null }) => {
      if (!selectEl) {
        return null;
      }

      if (selectEl._fontPickerApi) {
        selectEl._fontPickerApi.mode = mode;
        selectEl._fontPickerApi.linkedFamilySelect = linkedFamilySelect;
        selectEl._fontPickerApi.sync();
        return selectEl._fontPickerApi;
      }

      const wrapper = document.createElement("div");
      wrapper.className = `fontPicker fontPicker-${mode}`;

      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "fontPickerTrigger";

      const triggerLabel = document.createElement("span");
      triggerLabel.className = "fontPickerTriggerLabel";

      const triggerCaret = document.createElement("span");
      triggerCaret.className = "fontPickerTriggerCaret";
      triggerCaret.textContent = "arrow_drop_down";

      const menu = document.createElement("div");
      menu.className = "fontPickerMenu";

      trigger.appendChild(triggerLabel);
      trigger.appendChild(triggerCaret);
      wrapper.appendChild(trigger);
      wrapper.appendChild(menu);

      selectEl.classList.add("fontPickerNativeSelect");
      selectEl.insertAdjacentElement("afterend", wrapper);

      const updateTrigger = () => {
        const value = selectEl.value || "";
        const display =
          mode === "family"
            ? value
            : value || linkedFamilySelect?.value || "";

        triggerLabel.textContent = display || "Font";

        const previewFont =
          mode === "family"
            ? getFontPickerPreviewFontForFamily(value)
            : value;

        trigger.style.fontFamily = `"${previewFont || "Inter"}", sans-serif`;
        trigger.style.fontSize = getFontPickerDisplaySize(previewFont);
      };

      const makeFontButton = (fontValue) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "fontPickerItem fontPickerFontItem";
        button.dataset.fontValue = fontValue;
        button.textContent = fontValue;
        button.style.fontFamily = `"${fontValue}", sans-serif`;
        button.style.fontSize = getFontPickerDisplaySize(fontValue);

        if (selectEl.value === fontValue) {
          button.classList.add("selected");
        }

        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          setNativeFontSelectValue(selectEl, fontValue);
          wrapper.classList.remove("open");
          syncAllFontPickers();
        });

        return button;
      };

      const makeFamilyButton = (family) => {
        const previewFont = getFontPickerPreviewFontForFamily(family);

        const button = document.createElement("button");
        button.type = "button";
        button.className = "fontPickerItem fontPickerFamilyItem";
        button.dataset.familyValue = family;
        button.textContent = family;
        button.style.fontFamily = `"${previewFont}", sans-serif`;
        button.style.fontSize = getFontPickerDisplaySize(previewFont);

        if (selectEl.value === family) {
          button.classList.add("selected");
        }

        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          setNativeFontSelectValue(selectEl, family);
          wrapper.classList.remove("open");
          syncAllFontPickers();
        });

        return button;
      };

      const render = () => {
        menu.innerHTML = "";

        const families = getFontPickerFamilies();

        if (mode === "allFontsGrouped") {
          for (const familyDef of families) {
            const familyBlock = document.createElement("div");
            familyBlock.className = "fontPickerFamilyBlock expanded";

            const familyHeader = document.createElement("div");
            familyHeader.className = "fontPickerFamilyHeader";
            familyHeader.textContent = familyDef.family;
            familyHeader.style.fontFamily = `"${getFontPickerPreviewFontForFamily(
              familyDef.family
            )}", sans-serif`;
            familyHeader.style.fontSize = getFontPickerDisplaySize(
              familyDef.previewFont
            );

            const children = document.createElement("div");
            children.className = "fontPickerFamilyChildren";

            for (const font of familyDef.fonts) {
              children.appendChild(makeFontButton(font));
            }

            familyBlock.appendChild(familyHeader);
            familyBlock.appendChild(children);
            menu.appendChild(familyBlock);
          }
        } else if (mode === "family") {
          for (const familyDef of families) {
            menu.appendChild(makeFamilyButton(familyDef.family));
          }
        } else if (mode === "familyFont") {
          const family = linkedFamilySelect?.value || "";
          const fonts = getFontsForPickerFamily(family);

          for (const font of fonts) {
            menu.appendChild(makeFontButton(font));
          }
        }

        updateTrigger();
      };

      const sync = () => {
        const shouldHide =
          mode === "familyFont" &&
          FONT_PICKER_SINGLE_FONT_FAMILIES.has(linkedFamilySelect?.value || "");

        wrapper.classList.toggle("hidden", shouldHide);

        const label = document.querySelector(`label[for="${selectEl.id}"]`);
        if (label) {
          label.classList.toggle("hidden", shouldHide);
        }

        render();
      };

      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        const willOpen = !wrapper.classList.contains("open");
        closeAllFontPickers(wrapper);

        if (willOpen) {
          render();
          wrapper.classList.add("open");
        } else {
          wrapper.classList.remove("open");
        }
      });
      
      document.addEventListener("click", (event) => {
        if (!wrapper.contains(event.target)) {
          wrapper.classList.remove("open");
        }
      });

      selectEl.addEventListener("change", () => {
        sync();
      });

      const api = {
        mode,
        linkedFamilySelect,
        wrapper,
        sync,
      };

      selectEl._fontPickerApi = api;
      sync();

      return api;
    };

    const syncAllFontPickers = () => {
      document.querySelectorAll("select.fontPickerNativeSelect").forEach((selectEl) => {
        if (selectEl._fontPickerApi) {
          selectEl._fontPickerApi.sync();
        }
      });
    };

    const initializeFontPickers = () => {
      [
        "sdCtrlText_fontFamily",
        "sdAdvisory_fontFamily",
        "sdActionMessage_fontFamily",
      ].forEach((id) => {
        createFontPicker({
          selectEl: document.getElementById(id),
          mode: "allFontsGrouped",
        });
      });

      const defaultsPairs = [
        ["settingsDefaultsControlTextFontFamily", "settingsDefaultsControlTextFont"],
        ["settingsDefaultsAdvisoryFontFamily", "settingsDefaultsAdvisoryFont"],
        ["settingsDefaultsActionFontFamily", "settingsDefaultsActionFont"],
      ];

      defaultsPairs.forEach(([familyId, fontId]) => {
        const familySelect = document.getElementById(familyId);
        const fontSelect = document.getElementById(fontId);

        createFontPicker({
          selectEl: familySelect,
          mode: "family",
        });

        if (fontSelect) {
          fontSelect.classList.add("settingsDefaultsFontNativeSelect", "hidden");
          fontSelect.hidden = true;
        }

        if (familySelect && fontSelect && familySelect.dataset.fontPickerPairBound !== "true") {
          familySelect.dataset.fontPickerPairBound = "true";

          familySelect.addEventListener("change", () => {
            const family = familySelect.value;
            const fonts = getFontsForPickerFamily(family);
            const storedFont = fontSelect.value;

            const nextFont = fonts.includes(storedFont)
              ? storedFont
              : fonts[0] || "";

            if (nextFont) {
              setNativeFontSelectValue(fontSelect, nextFont, { dispatch: true });
            }

            refreshSettingsDefaultsFontButtons(fontId, family, fonts);
            syncAllFontPickers();
          });
        }
      });

      syncAllFontPickers();
    };
    

    const SHIELD_DROPDOWN_PLACEHOLDER_ICON =
      "data:image/svg+xml;utf8," +
      encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
          <rect x="4" y="4" width="40" height="40" rx="4" fill="#111" stroke="#666" stroke-width="2"/>
          <path d="M12 32 L32 12 M24 12 H32 V20" stroke="#888" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `);
    
    const SHIELD_PICKER_MANUAL_ORDER = {
      
      "us-georgia": [
        "GA",
        "GAALT",
        "GABYP",
        "GACONN",
        "GALOOP",
        "GASPUR",
      ],
      
      "us-massachusetts": [
        "MA",
        "MATP",
        "MA-PIKE",
      ],
        
      "us-newjersey": [
        "NJ",
        "NJTP",
        "GSP",
        "PIP",
      ],
        
      "us-oklahoma": [
        "OK",
        "OKCH",
        "OKCR",
        "OKHB",
        "OKIN",
        "OKKC",
        "OKKL",
        "OKMS",
        "OKTU",
        "OKWR",
      ],

      "us-pennsylvania": [
        "PA",
        "PATPLOGO",
        "PATP",
      ],

      "us-texas": [
        "TX",
        "TXFM",
        "TXRM",
        "TXBELT",
        "TXLOOP",
        "TXPARK",
        "TXSPUR",
        "TXEXPRESS",
        "TXTOLL",
        "TXTOLLCTRMA",
        "TXTOLLNTTA",
        "TXTOLLFBTR",
        "HTR",
        "SHT",
        "WPT",
      ],
      
      "canada": [
        "TCHLeaf",
        "TCH",
      ],
    };

    const applyManualShieldPickerOrder = (node) => {
      if (!node || !Array.isArray(node.children)) {
        return node;
      }

      node.children.forEach(applyManualShieldPickerOrder);

      const manualOrder = SHIELD_PICKER_MANUAL_ORDER[node.id];

      if (!manualOrder) {
        return node;
      }

      const orderMap = new Map(
        manualOrder.map((value, index) => [value, index])
      );

      node.children.sort((a, b) => {
        const aIndex = orderMap.has(a.value) ? orderMap.get(a.value) : 9999;
        const bIndex = orderMap.has(b.value) ? orderMap.get(b.value) : 9999;

        if (aIndex !== bIndex) {
          return aIndex - bIndex;
        }

        return (a.label || a.value || "").localeCompare(b.label || b.value || "");
      });

      return node;
    };

    const SHIELD_PICKER_CUSTOM_MAKER_VALUE = "__customShieldMaker";
    const activeShieldPickerApis = new Set();

    const refreshAllShieldPickers = () => {
      activeShieldPickerApis.forEach((pickerApi) => {
        if (pickerApi && typeof pickerApi.refresh === "function") {
          pickerApi.refresh();
        }
      });
    };

    const SHIELD_PICKER_TREE = [
      {
        id: "custom-shield-maker",
        value: SHIELD_PICKER_CUSTOM_MAKER_VALUE,
        label: "Custom Shield",
        asset: "img/other-symbols/icon.png",
        customShieldMaker: true,
      },
      {
        id: "us",
        label: "United States",
        children: [
          {
            id: "us-interstate",
            label: "Interstate",
            children: [
              { value: "I", label: "Interstate", asset: "img/shields/United States/I-2Digit.svg" },
              { value: "I-BUS", label: "Interstate Business", asset: "img/shields/United States/I-BUS-2Digit.svg" },
              { value: "I-BUS-LOOP", label: "Interstate Business Loop", disabled: true },
              { value: "I-BUS-SPUR", label: "Interstate Business Spur", disabled: true },
              { value: "FUTURE-I", label: "Future Interstate", disabled: true },
            ],
          },
          {
            id: "us-usroute",
            label: "U.S. Route",
            children: [
              { value: "US", label: "U.S. Route", asset: "img/shields/United States/US-2Digit.svg" },
              { value: "US-OLD", label: "U.S. Route (old style)", disabled: true },
              { value: "US-CA", label: "U.S. Route (CA style)", disabled: true },
            ],
          },

          { value: "AL", label: "Alabama", asset: "img/shields/United States/AL-2Digit.svg" },
          { value: "AK", label: "Alaska", asset: "img/shields/United States/AK-2Digit.svg" },
          { value: "AZ", label: "Arizona", asset: "img/shields/United States/AZ/AZ-2Digit.svg" },
          { value: "AR", label: "Arkansas", asset: "img/shields/United States/AR-2Digit.svg" },
          { value: "CA", label: "California", asset: "img/shields/United States/CA-2Digit.svg" },
          { value: "CO", label: "Colorado", asset: "img/shields/United States/CO-2Digit.svg" },
          { value: "CT", label: "Connecticut", asset: "img/shields/United States/CT-2Digit.svg" },
          { value: "DE", label: "Delaware", asset: "img/shields/United States/DE-2Digit.svg" },
          { value: "DC", label: "District of Columbia", asset: "img/shields/United States/DC-2Digit.svg" },

          {
            id: "us-florida",
            label: "Florida",
            children: [
              { value: "FL", label: "Florida", asset: "img/shields/United States/FL/FL-2Digit.svg" },
              { value: "FLToll", label: "Florida Toll", asset: "img/shields/United States/FL/FLToll-Current.svg" },
              { value: "FLTURNPIKE", label: "Florida’s Turnpike", asset: "img/shields/United States/FL/FLTURNPIKE.svg" },
            ],
          },

          {
            id: "us-georgia",
            label: "Georgia",
            children: [
              { value: "GA", label: "Georgia", asset: "img/shields/United States/GA/GA-2Digit.svg" },
              { value: "GAALT", label: "GA Alternate", disabled: true },
              { value: "GABYP", label: "GA Bypass", disabled: true },
              { value: "GACONN", label: "GA Connector", disabled: true },
              { value: "GALOOP", label: "GA Loop", disabled: true },
              { value: "GASPUR", label: "GA Spur", disabled: true },
            ],
          },

          { value: "HI", label: "Hawaii", asset: "img/shields/United States/HI-2Digit.svg" },
          { value: "ID", label: "Idaho", asset: "img/shields/United States/ID-2Digit.svg" },
          { value: "IL", label: "Illinois", asset: "img/shields/United States/IL-2Digit.svg" },

          {
            id: "us-indiana",
            label: "Indiana",
            children: [
              { value: "IN", label: "Indiana", asset: "img/shields/United States/IN/IN-2Digit.svg" },
              { value: "IN-TOLL", label: "IN Toll Road", disabled: true },
            ],
          },

          { value: "IA", label: "Iowa", asset: "img/shields/United States/IA-2Digit.svg" },

          {
            id: "us-kansas",
            label: "Kansas",
            children: [
              { value: "KS", label: "Kansas", asset: "img/shields/United States/KS/KS-2Digit.svg" },
              { value: "KS-TURNPIKE", label: "KS Turnpike", disabled: true },
            ],
          },

          {
            id: "us-kentucky",
            label: "Kentucky",
            children: [
              { value: "KY", label: "Kentucky", asset: "img/shields/United States/KY/KY-2Digit.svg" },
              {
                id: "us-kentucky-parkways",
                label: "KY Parkways",
                children: [
                  { value: "KY-AA", label: "AA Highway", disabled: true },
                  { value: "KY-AUDUBON", label: "Audubon Parkway", disabled: true },
                  { value: "KY-BLUEGRASS", label: "Bluegrass Parkway", disabled: true },
                  { value: "KY-HALROGERS", label: "Hal Rogers Parkway", disabled: true },
                  { value: "KY-MOUNTAIN", label: "Mountain Parkway", disabled: true },
                  { value: "KY-NATCHER", label: "Natcher Parkway", disabled: true },
                  { value: "KY-PENNYRILE", label: "Pennyrile Parkway", disabled: true },
                  { value: "KY-PURCHASE", label: "Purchase Parkway", disabled: true },
                  { value: "KY-WESTERN", label: "Western KY Parkway", disabled: true },
                ],
              },
            ],
          },

          { value: "LA", label: "Louisiana", asset: "img/shields/United States/LA-2Digit.svg" },
          { value: "ME", label: "Maine", asset: "img/shields/United States/ME/ME-2Digit.svg" },
          { value: "MD", label: "Maryland", asset: "img/shields/United States/MD-2Digit.svg" },

          {
            id: "us-massachusetts",
            label: "Massachusetts",
            children: [
              { value: "MA", label: "Massachusetts", asset: "img/shields/United States/MA/MA-2Digit.svg" },
              { value: "MA-PIKE", label: "Mass Pike", disabled: true },
            ],
          },

          { value: "MI", label: "Michigan", asset: "img/shields/United States/MI-2Digit.svg" },
          { value: "MN", label: "Minnesota", asset: "img/shields/United States/MN/MN-2Digit.svg" },
          { value: "MS", label: "Mississippi", asset: "img/shields/United States/MS-2Digit.svg" },
          { value: "MO", label: "Missouri", asset: "img/shields/United States/MO-2Digit.svg" },

          {
            id: "us-montana",
            label: "Montana",
            children: [
              { value: "MT", label: "Montana", asset: "img/shields/United States/MT-2Digit.svg" },
              { value: "MT2", label: "Montana (secondary)", asset: "img/shields/United States/MT2-2Digit.svg" },
            ],
          },

          {
            id: "us-nebraska",
            label: "Nebraska",
            children: [
              { value: "NE", label: "Nebraska", asset: "img/shields/United States/NE/NE-2Digit.svg" },
              { value: "NELINK", label: "NE Link", disabled: true },
              { value: "NESPUR", label: "NE Spur", disabled: true },
            ],
          },

          { value: "NV", label: "Nevada", asset: "img/shields/United States/NV-2Digit.svg" },
          { value: "NH", label: "New Hampshire", asset: "img/shields/United States/NH-2Digit.svg" },

          
              {
                id: "us-newjersey",
                label: "New Jersey",
                children: [
                  { value: "NJ", label: "New Jersey", asset: "img/shields/United States/NJ/NJ-2Digit.svg" },
                  { value: "GSP", label: "Garden State Parkway", asset: "img/shields/United States/NJ/GSP.png" },
                  { value: "NJTP", label: "NJ Turnpike", asset: "img/shields/United States/NJ/NJTP.png" },
                  { value: "PIP", label: "Palisades Interstate Parkway", asset: "img/shields/United States/NJ/PIP.png" },
                ],
              },

          { value: "NM", label: "New Mexico", asset: "img/shields/United States/NM-2Digit.svg" },

              {
                id: "us-newyork",
                label: "New York",
                children: [
                  { value: "NY", label: "New York", asset: "img/shields/United States/NY/NY-2Digit.svg" },
                  { value: "NYST", label: "NY State Thruway", asset: "img/shields/United States/NY/NYST.png" },
                  {
                    id: "us-newyork-parkways",
                    label: "NY Parkways",
                    children: [
                      { value: "B", label: "Bethpage Parkway", asset: "img/shields/United States/NY/B.png" },
                      { value: "BMP", label: "Bear Mountain Parkway", asset: "img/shields/United States/NY/BMP.png" },
                      { value: "BP", label: "Belt Parkway", asset: "img/shields/United States/NY/BP.png" },
                      { value: "BR", label: "Bronx River Parkway", asset: "img/shields/United States/NY/BR.png" },
                      { value: "BRP", label: "Bronx River Parkway", asset: "img/shields/United States/NY/BRP.png" },
                      { value: "CCP", label: "Cross County Parkway", asset: "img/shields/United States/NY/CCP.png" },
                      { value: "CI", label: "Cross Island Parkway", asset: "img/shields/United States/NY/CI.png" },
                      { value: "FDR", label: "FDR Drive", asset: "img/shields/United States/NY/FDR.png" },
                      { value: "GCP", label: "Grand Central Parkway", asset: "img/shields/United States/NY/GCP.png" },
                      { value: "H", label: "Heckscher Parkway", asset: "img/shields/United States/NY/H.png" },
                      { value: "HH", label: "Henry Hudson Parkway", asset: "img/shields/United States/NY/HH.png" },
                      { value: "HR", label: "Hutchinson River Parkway", asset: "img/shields/United States/NY/HR.png" },
                      { value: "HRD", label: "Harlem River Drive", asset: "img/shields/United States/NY/HRD.png" },
                      { value: "HRP", label: "Hutchinson River Parkway", asset: "img/shields/United States/NY/HRP.png" },
                      { value: "JR", label: "Jackie Robinson Parkway", asset: "img/shields/United States/NY/JR.png" },
                      { value: "KWV", label: "Korean War Veterans Parkway", asset: "img/shields/United States/NY/KWV.png" },
                      { value: "LOSP", label: "Lake Ontario State Parkway", asset: "img/shields/United States/NY/LOSP.png" },
                      { value: "M", label: "Meadowbrook Parkway", asset: "img/shields/United States/NY/M.png" },
                      { value: "MP", label: "Mosholu Parkway", asset: "img/shields/United States/NY/MP.png" },
                      { value: "N", label: "Northern State Parkway", asset: "img/shields/United States/NY/N.png" },
                      { value: "NSP", label: "Niagara Scenic Parkway", asset: "img/shields/United States/NY/NSP.png" },
                      { value: "O", label: "Ocean Parkway", asset: "img/shields/United States/NY/O.png" },
                      { value: "Pe", label: "Pelham Parkway", asset: "img/shields/United States/NY/Pe.png" },
                      { value: "PIP", label: "Palisades Interstate Parkway", asset: "img/shields/United States/NY/PIP.png" },
                      { value: "RM", label: "Robert Moses Causeway", asset: "img/shields/United States/NY/RM.png" },
                      { value: "SA", label: "Sagtikos Parkway", asset: "img/shields/United States/NY/SA.png" },
                      { value: "SBP", label: "Sprain Brook Parkway", asset: "img/shields/United States/NY/SBP.png" },
                      { value: "SM", label: "Sunken Meadow Parkway", asset: "img/shields/United States/NY/SM.png" },
                      { value: "SMP", label: "Saw Mill Parkway", asset: "img/shields/United States/NY/SMP.png" },
                      { value: "SO", label: "Southern State Parkway", asset: "img/shields/United States/NY/SO.png" },
                      { value: "TSP", label: "Taconic State Parkway", asset: "img/shields/United States/NY/TSP.png" },
                      { value: "W", label: "Wantagh Parkway", asset: "img/shields/United States/NY/W.png" },
                    ],
                  },
                ],
              },

          { value: "NC", label: "North Carolina", asset: "img/shields/United States/NC-2Digit.svg" },
          { value: "ND", label: "North Dakota", asset: "img/shields/United States/ND-2Digit.svg" },

              {
                id: "us-ohio",
                label: "Ohio",
                children: [
                  { value: "OH", label: "Ohio", asset: "img/shields/United States/OH/OH-2Digit.svg" },
                  { value: "OHTP", label: "Ohio Turnpike", asset: "img/shields/United States/OH/OHTP.png" },
                ],
              },

              {
                id: "us-oklahoma",
                label: "Oklahoma",
                children: [
                  { value: "OK", label: "Oklahoma", asset: "img/shields/United States/OK/OK-2Digit.svg" },
                  { value: "OKCH", label: "Cherokee Turnpike", asset: "img/shields/United States/OK/OKCH.png" },
                  { value: "OKCR", label: "Creek Turnpike", asset: "img/shields/United States/OK/OKCR.png" },
                  { value: "OKHB", label: "H.E. Bailey Turnpike", asset: "img/shields/United States/OK/OKHB.png" },
                  { value: "OKIN", label: "Indian Nation Turnpike", asset: "img/shields/United States/OK/OKIN.png" },
                  { value: "OKKC", label: "Kickapoo Turnpike", asset: "img/shields/United States/OK/OKKC.png" },
                  { value: "OKKL", label: "Kilpatrick Turnpike", asset: "img/shields/United States/OK/OKKL.png" },
                  { value: "OKMS", label: "Muskogee Turnpike", asset: "img/shields/United States/OK/OKMS.png" },
                  { value: "OKTU", label: "Turner Turnpike", asset: "img/shields/United States/OK/OKTU.png" },
                  { value: "OKWR", label: "Will Rogers Turnpike", asset: "img/shields/United States/OK/OKWR.png" },
                ],
              },
              
          { value: "OR", label: "Oregon", asset: "img/shields/United States/OR-2Digit.svg" },

          {
            id: "us-pennsylvania",
            label: "Pennsylvania",
            children: [
              {
                value: "PA",
                label: "Pennsylvania",
                asset: "img/shields/United States/PA/PA-2Digit.svg"
              },
              {
                value: "PATPLOGO",
                label: "PA Turnpike",
                asset: "img/shields/United States/PA/PATP.png"
              },
              {
                value: "PATP",
                label: "PA Turnpike Route",
                asset: "img/shields/United States/PA/PATP-2Digit.svg"
              },
            ],
          },

          {
            id: "us-puertorico",
            label: "Puerto Rico",
            disabled: true,
            children: [
              { value: "PR", label: "Puerto Rico (primary)", disabled: true },
              { value: "PR-URBAN", label: "Puerto Rico (urban primary)", disabled: true },
              { value: "PR-SECONDARY", label: "Puerto Rico (secondary)", disabled: true },
              { value: "PR-TERTIARY", label: "Puerto Rico (tertiary)", disabled: true },
            ],
          },

          { value: "RI", label: "Rhode Island", asset: "img/shields/United States/RI-2Digit.svg" },
          { value: "SC", label: "South Carolina", asset: "img/shields/United States/SC-2Digit.svg" },
          { value: "SD", label: "South Dakota", asset: "img/shields/United States/SD-2Digit.svg" },

          {
            id: "us-tennessee",
            label: "Tennessee",
            children: [
              { value: "TN", label: "Tennessee", asset: "img/shields/United States/TN-2Digit.svg" },
              { value: "TN2", label: "Tennessee (secondary)", asset: "img/shields/United States/TN2-2Digit.svg" },
            ],
          },

          {
            id: "us-texas",
            label: "Texas",
            children: [
              { value: "TX", label: "Texas", asset: "img/shields/United States/TX/TX-2Digit.svg" },
              { value: "TXFM", label: "TX FM", asset: "img/shields/United States/TX/TXFM-4Digit.svg" },
              { value: "TXRM", label: "TX RM", asset: "img/shields/United States/TX/TXRM-2Digit.svg" },
              { value: "TXBELT", label: "TX Beltway", asset: "img/shields/United States/TX/TXBELTWAY-2Digit.svg" },
              { value: "TXLOOP", label: "TX Loop", asset: "img/shields/United States/TX/TXLOOP-2Digit.svg" },
              { value: "TXPARK", label: "TX Park Road", asset: "img/shields/United States/TX/TXPARK-2Digit.svg" },
              { value: "TXSPUR", label: "TX Spur", asset: "img/shields/United States/TX/TXSPUR-2Digit.svg" },
              { value: "TXEXPRESS", label: "TX Express Toll", asset: "img/shields/United States/TX/TXEXPRESS-2Digit.svg" },
              { value: "TXTOLL", label: "TX Toll TxDOT", asset: "img/shields/United States/TX/TXTOLL-2Digit.svg" },
              { value: "TXTOLLCTRMA", label: "TX Toll CTRMA", asset: "img/shields/United States/TX/TXTollCTRMA.svg" },
              { value: "TXTOLLNTTA", label: "TX Toll NTTA", asset: "img/shields/United States/TX/TXTollNTTA.svg" },
              { value: "TXTOLLFBTR", label: "Fort Bend Toll Road", asset: "img/shields/United States/TX/TXTollFBTR.png" },
              { value: "HTR", label: "Hardy Toll Road", asset: "img/shields/United States/TX/HTR.png" },
              { value: "SHT", label: "Sam Houston Tollway", asset: "img/shields/United States/TX/SHT.png" },
              { value: "WPT", label: "Westpark Tollway", asset: "img/shields/United States/TX/WPT.png" },
            ],
          },
              
          { value: "UT", label: "Utah", asset: "img/shields/United States/UT-2Digit.svg" },

          {
            id: "us-vermont",
            label: "Vermont",
            children: [
              { value: "VT", label: "Vermont", asset: "img/shields/United States/VT-2Digit.svg" },
              { value: "VT2", label: "Vermont (secondary)", asset: "img/shields/United States/VT2-2Digit.svg" },
            ],
          },

          {
            id: "us-virginia",
            label: "Virginia",
            children: [
              { value: "VA", label: "Virginia", asset: "img/shields/United States/VA-2Digit.svg" },
              { value: "VA2", label: "Virginia (secondary)", asset: "img/shields/United States/VA2-2Digit.svg" },
            ],
          },

          { value: "WA", label: "Washington", asset: "img/shields/United States/WA-2Digit.svg" },
          { value: "WV", label: "West Virginia", asset: "img/shields/United States/WV-2Digit.svg" },
          { value: "WI", label: "Wisconsin", asset: "img/shields/United States/WI-2Digit.svg" },
          { value: "WY", label: "Wyoming", asset: "img/shields/United States/WY-2Digit.svg" },
        ],
      },

      {
        id: "canada",
        label: "Canada",
        children: [
          {
            value: "TCH",
            label: "Trans-Canada Highway",
            asset: "img/shields/Canada/TCH-2Digit.svg",
          },
          {
            value: "TCHLeaf",
            label: "TCH Leaf",
            asset: "img/shields/Canada/TCHLeaf-2Digit.svg",
          },

          {
            id: "canada-alberta",
            label: "Alberta",
            children: [
              { value: "AB", label: "Alberta", asset: "img/shields/Canada/AB/AB-2Digit.svg" },
              { value: "AB2", label: "Alberta Secondary", asset: "img/shields/Canada/AB/AB2-2Digit.svg" },
              { value: "ABTC", label: "Alberta TCH", asset: "img/shields/Canada/AB/ABTC-2Digit.svg" },
            ],
          },

          {
            id: "canada-britishcolumbia",
            label: "British Columbia",
            children: [
              { value: "BC", label: "British Columbia", asset: "img/shields/Canada/BC/BC-2Digit.svg" },
              { value: "BCYH", label: "BC Yellowhead", asset: "img/shields/Canada/BC/BCYH-2Digit.svg" },
              { value: "BCTC", label: "BC TCH", asset: "img/shields/Canada/BC/BCTC-2Digit.svg" },
            ],
          },

          {
            id: "canada-manitoba",
            label: "Manitoba",
            children: [
              { value: "MB", label: "Manitoba", asset: "img/shields/Canada/MB/MB-2Digit.svg" },
              { value: "MB2", label: "Manitoba Secondary", asset: "img/shields/Canada/MB/MB2-2Digit.svg" },
              { value: "MBTC", label: "Manitoba TCH", asset: "img/shields/Canada/MB/MBTC-2Digit.svg" },
            ],
          },

          {
            id: "canada-newbrunswick",
            label: "New Brunswick",
            children: [
              { value: "NB", label: "New Brunswick", asset: "img/shields/Canada/NB/NB-2Digit.svg" },
              { value: "NBCONN", label: "NB Connector", asset: "img/shields/Canada/NB/NBCONN-2Digit.svg" },
              { value: "NBLOCAL", label: "NB Local", asset: "img/shields/Canada/NB/NBLOCAL-2Digit.svg" },
              { value: "NBTC", label: "NB TCH", asset: "img/shields/Canada/NB/NBTC-2Digit.svg" },
            ],
          },

          {
            id: "canada-newfoundland",
            label: "Newfoundland and Labrador",
            children: [
              { value: "NL", label: "Newfoundland and Labrador", asset: "img/shields/Canada/NL/NL-2Digit.svg" },
              { value: "NLTC", label: "NL TCH", asset: "img/shields/Canada/NL/NLTC-2Digit.svg" },
            ],
          },

          {
            id: "canada-novascotia",
            label: "Nova Scotia",
            children: [
              { value: "NS", label: "Nova Scotia", asset: "img/shields/Canada/NS/NS-2Digit.svg" },
              { value: "NSCONN", label: "NS Connector", asset: "img/shields/Canada/NS/NSCONN-2Digit.svg" },
              { value: "NSTC", label: "NS TCH", asset: "img/shields/Canada/NS/NSTC-2Digit.svg" },
            ],
          },

          {
            id: "canada-ontario",
            label: "Ontario",
            children: [
              { value: "ON", label: "Ontario", asset: "img/shields/Canada/ON/ON-2Digit.svg" },
              { value: "ON2", label: "Ontario Secondary", asset: "img/shields/Canada/ON/ON2-2Digit.svg" },
              { value: "ON3", label: "Ontario County", asset: "img/shields/Canada/ON/ON3-2Digit.svg" },
              { value: "ONDVP", label: "Don Valley Parkway", asset: "img/shields/Canada/ON/ON-DVP.png" },
              { value: "ONGAR", label: "Gardiner Expressway", asset: "img/shields/Canada/ON/ON-GAR.png" },
              { value: "ONTC", label: "Ontario TCH", asset: "img/shields/Canada/ON/ONTC-2Digit.svg" },
              { value: "ONTCCOR", label: "Central Ontario Route", asset: "img/shields/Canada/ON/ONTC-COR.svg" },
              { value: "ONTCGBR", label: "Georgian Bay Route", asset: "img/shields/Canada/ON/ONTC-GBR.svg" },
              { value: "ONTCLSR", label: "Lake Superior Route", asset: "img/shields/Canada/ON/ONTC-LSR.svg" },
              { value: "ONTCNOR", label: "Northern Ontario Route", asset: "img/shields/Canada/ON/ONTC-NOR.svg" },
              { value: "ONTCOVR", label: "Ottawa Valley Route", asset: "img/shields/Canada/ON/ONTC-OVR.svg" },
            ],
          },

          {
            value: "PEI",
            label: "Prince Edward Island",
            asset: "img/shields/Canada/PEI/PEI-2Digit.svg",
          },

          {
            id: "canada-quebec",
            label: "Quebec",
            children: [
              { value: "QC", label: "Quebec Autoroute", asset: "img/shields/Canada/QC/QC-2Digit.svg" },
              { value: "QC2", label: "Quebec Route", asset: "img/shields/Canada/QC/QC2-2Digit.svg" },
              { value: "QCTC", label: "Quebec TCH", asset: "img/shields/Canada/QC/QCTC-2Digit.svg" },
            ],
          },

          {
            id: "canada-saskatchewan",
            label: "Saskatchewan",
            children: [
              { value: "SK", label: "Saskatchewan", asset: "img/shields/Canada/SK/SK-2Digit.svg" },
              { value: "SK2", label: "SK Secondary", asset: "img/shields/Canada/SK/SK2-2Digit.svg" },
              { value: "SKTC", label: "SK TCH", asset: "img/shields/Canada/SK/SKTC-2Digit.svg" },
            ],
          },
        ],
      },
    ];
    
    const patchShieldPickerTreeForUploadedStateFolders = () => {
      const usRoot = SHIELD_PICKER_TREE.find((node) => node.id === "us");
      if (!usRoot || !Array.isArray(usRoot.children)) {
        return;
      }

        const replacementIds = new Set([
          "us-interstate",
          "us-usroute",
          "us-arizona",
          "us-florida",
          "us-georgia",
          "us-indiana",
          "us-kansas",
          "us-kentucky",
          "us-massachusetts",
          "us-maine",
          "us-minnesota",
          "us-nebraska",
          "us-wisconsin",
        ]);

      const replacementValues = new Set([
        "I",
        "I-BUS",
        "I-BS",
        "I-BL",
        "I-DS",
        "I-DL",
        "I-F",
        "US",
        "USCA",
        "US-CA",
        "C",
        "WI",
        "WICo",
        "WICO",
        "AZ",
        "AZLOOP",
        "AZ-LOOP",
        "FL",
        "FLToll",
        "FLTP",
        "FL-TURNPIKE",
        "GA",
        "GAALT",
        "GABYP",
        "GACONN",
        "GALOOP",
        "GASPUR",
        "IN",
        "INTR",
        "IN-TOLLROAD",
        "KS",
        "KSTP",
        "KS-TURNPIKE",
        "KY",
        "KYAA",
        "KYAU",
        "KYBG",
        "KYCM",
        "KYHR",
        "KYMT",
        "KYPR",
        "KYPU",
        "KYWK",
        "KYWN",
        "KY-AA",
        "KY-AUDUBON",
        "KY-BLUEGRASS",
        "KY-HALROGERS",
        "KY-MOUNTAIN",
        "KY-NATCHER",
        "KY-PENNYRILE",
        "KY-PURCHASE",
        "KY-WESTERN",
        "MA",
        "MATP",
        "MA-PIKE",
        "ME",
        "METP",
        "ME-TURNPIKE",
        "MN",
        "MNBUS",
        "MN-BUSINESS",
        "NE",
        "NELINK",
        "NE-LINK",
        "NESPUR",
        "NE-SPUR",
      ]);

      const shouldRemoveNode = (node) => {
        if (!node) {
          return false;
        }

        if (replacementIds.has(node.id)) {
          return true;
        }

        if (node.value && replacementValues.has(node.value)) {
          return true;
        }

        return false;
      };

      usRoot.children = usRoot.children.filter((node) => !shouldRemoveNode(node));

      const node = (value, label, asset) => ({
        value,
        label,
        asset,
      });

      const category = (id, label, children) => ({
        id,
        label,
        children,
      });

      const stateFolders = [
          category("us-interstate", "Interstate", [
            node("I", "Interstate", "img/shields/United States/Interstate/I-2Digit.svg"),
            node("I-BUS", "Interstate Business", "img/shields/United States/Interstate/I-BUS-2Digit.svg"),
            node("I-BL", "Interstate Business Loop", "img/shields/United States/Interstate/I-BL-2Digit.svg"),
            node("I-BS", "Interstate Business Spur", "img/shields/United States/Interstate/I-BS-2Digit.svg"),
            node("I-DL", "Interstate Downtown Loop", "img/shields/United States/Interstate/I-DL-2Digit.svg"),
            node("I-DS", "Interstate Downtown Spur", "img/shields/United States/Interstate/I-DS-2Digit.svg"),
            node("I-F", "Future Interstate", "img/shields/United States/Interstate/I-F-2Digit.svg"),
          ]),
          category("us-usroute", "U.S. Route", [
            node("US", "U.S. Route", "img/shields/United States/US Route/US-2Digit.svg"),
            node("USCA", "U.S. Route (CA style)", "img/shields/United States/US Route/US-CA-2Digit.svg"),
          ]),
        category("us-arizona", "Arizona", [
          node("AZ", "Arizona", "img/shields/United States/AZ/AZ-2Digit.svg"),
          node("AZLOOP", "Arizona Loop", "img/shields/United States/AZ/AZLOOP-3Digit.svg"),
        ]),
        
        category("us-florida", "Florida", [
          node("FL", "Florida", "img/shields/United States/FL/FL-2Digit.svg"),
          node("FLToll", "Florida Toll", "img/shields/United States/FL/FLToll-Current.svg"),
          node("FLTP", "Florida’s Turnpike", "img/shields/United States/FL/FLTP.svg"),
        ]),

        category("us-georgia", "Georgia", [
          node("GA", "Georgia", "img/shields/United States/GA/GA-2Digit.svg"),
          node("GAALT", "GA Alternate", "img/shields/United States/GA/GAALT-2Digit.svg"),
          node("GABYP", "GA Bypass", "img/shields/United States/GA/GABYP-2Digit.svg"),
          node("GACONN", "GA Connector", "img/shields/United States/GA/GACONN-2Digit.svg"),
          node("GALOOP", "GA Loop", "img/shields/United States/GA/GALOOP-2Digit.svg"),
          node("GASPUR", "GA Spur", "img/shields/United States/GA/GASPUR-2Digit.svg"),
        ]),

        category("us-indiana", "Indiana", [
          node("IN", "Indiana", "img/shields/United States/IN/IN-2Digit.svg"),
          node("INTR", "Indiana Toll Road", "img/shields/United States/IN/INTR.png"),
        ]),

        category("us-kansas", "Kansas", [
          node("KS", "Kansas", "img/shields/United States/KS/KS-2Digit.svg"),
          node("KSTP", "Kansas Turnpike", "img/shields/United States/KS/KSTP.png"),
        ]),

        category("us-kentucky", "Kentucky", [
          node("KY", "Kentucky", "img/shields/United States/KY/KY-2Digit.svg"),
          category("us-kentucky-parkways", "KY Parkways", [
            node("KYAA", "AA Highway", "img/shields/United States/KY/KYAA.png"),
            node("KYAU", "Audubon Parkway", "img/shields/United States/KY/KYAU.png"),
            node("KYBG", "Bluegrass Parkway", "img/shields/United States/KY/KYBG.png"),
            node("KYCM", "Cumberland Parkway", "img/shields/United States/KY/KYCM.png"),
            node("KYHR", "Hal Rogers Parkway", "img/shields/United States/KY/KYHR.png"),
            node("KYMT", "Mountain Parkway", "img/shields/United States/KY/KYMT.png"),
            node("KYPR", "Pennyrile Parkway", "img/shields/United States/KY/KYPR.png"),
            node("KYPU", "Purchase Parkway", "img/shields/United States/KY/KYPU.png"),
            node("KYWK", "Western KY Parkway", "img/shields/United States/KY/KYWK.png"),
            node("KYWN", "Natcher Parkway", "img/shields/United States/KY/KYWN.png"),
          ]),
        ]),

        category("us-maine", "Maine", [
          node("ME", "Maine", "img/shields/United States/ME/ME-2Digit.svg"),
          node("METP", "Maine Turnpike", "img/shields/United States/ME/METP.png"),
        ]),

        category("us-massachusetts", "Massachusetts", [
          node("MA", "Massachusetts", "img/shields/United States/MA/MA-2Digit.svg"),
          node("MATP", "Mass Pike", "img/shields/United States/MA/MATP.png"),
        ]),

        category("us-minnesota", "Minnesota", [
          node("MN", "Minnesota", "img/shields/United States/MN/MN-2Digit.svg"),
          node("MNBUS", "Minnesota Business", "img/shields/United States/MN/MNBUS-2Digit.svg"),
        ]),

        category("us-nebraska", "Nebraska", [
          node("NE", "Nebraska", "img/shields/United States/NE/NE-2Digit.svg"),
          node("NELINK", "Nebraska Link", "img/shields/United States/NE/NELINK-2Digit.svg"),
          node("NESPUR", "Nebraska Spur", "img/shields/United States/NE/NESPUR-2Digit.svg"),
        ]),
          
        category("us-wisconsin", "Wisconsin", [
          node("WI", "Wisconsin", "img/shields/United States/WI/WI-2Digit.svg"),
          node("WICo", "Wisconsin County", "img/shields/United States/WI/WICo-2Digit.svg"),
        ]),
        
        

      ];
        
        const countyNode = node(
          "C",
          "County",
          "img/shields/United States/C-2Digit.svg"
        );
        
        const sortUnitedStatesShieldPickerChildren = () => {
          const getPriority = (entry) => {
            if (entry.id === "us-interstate" || entry.label === "Interstate") {
              return 0;
            }

              if (entry.id === "us-usroute" || entry.label === "U.S. Route") {
                return 1;
              }

              if (entry.value === "C" || entry.label === "County") {
                return 2;
              }

              return 3;
          };

          const sortNodes = (nodes) => {
            if (!Array.isArray(nodes)) {
              return;
            }

            nodes.sort((a, b) => {
              const priorityA = getPriority(a);
              const priorityB = getPriority(b);

              if (priorityA !== priorityB) {
                return priorityA - priorityB;
              }

              return String(a.label || a.value || "").localeCompare(
                String(b.label || b.value || "")
              );
            });

            nodes.forEach((node) => {
              if (Array.isArray(node.children)) {
                sortNodes(node.children);
              }
            });
          };

          sortNodes(usRoot.children);
        };

      const insertIndex = usRoot.children.findIndex((entry) => {
        const label = entry.label || "";
        return label.localeCompare("Arizona") > 0;
      });

      if (insertIndex === -1) {
        usRoot.children.push(...stateFolders);
      } else {
        usRoot.children.splice(insertIndex, 0, ...stateFolders);
      }
      if (!usRoot.children.some((entry) => entry.value === "C")) {
        usRoot.children.push(countyNode);
      }
        sortUnitedStatesShieldPickerChildren();
    };

    patchShieldPickerTreeForUploadedStateFolders();

    SHIELD_PICKER_TREE.forEach(applyManualShieldPickerOrder);
    loadCustomShieldMakerRecords();
    refreshCustomShieldMakerRegistry();

    const flattenShieldPickerTree = (nodes, result = []) => {
      nodes.forEach((node) => {
        if (node.value) {
          result.push(node);
        }
        if (Array.isArray(node.children)) {
          flattenShieldPickerTree(node.children, result);
        }
      });
      return result;
    };

    const findShieldPickerEntryByValue = (value, nodes = SHIELD_PICKER_TREE) => {
      for (const node of nodes) {
        if (node.value === value) {
          return node;
        }
        if (Array.isArray(node.children)) {
          const found = findShieldPickerEntryByValue(value, node.children);
          if (found) {
            return found;
          }
        }
      }
      return null;
    };
    
    const findFirstSelectableShieldEntry = (nodes = []) => {
      for (const node of nodes) {
        if (!node.disabled && node.value) {
          return node;
        }
        if (Array.isArray(node.children) && node.children.length) {
          const found = findFirstSelectableShieldEntry(node.children);
          if (found) {
            return found;
          }
        }
      }
      return null;
    };

    const buildShieldPickerTriggerLabel = (entry) => {
      if (!entry) {
        return "Select shield";
      }
      return entry.label;
    };

    const buildShieldPickerIconSrc = (entry) => {
      if (!entry) {
        return SHIELD_DROPDOWN_PLACEHOLDER_ICON;
      }

      if (entry.asset) {
        return entry.asset;
      }

      if (Array.isArray(entry.children) && entry.children.length) {
        const firstChildShield = findFirstSelectableShieldEntry(entry.children);
        if (firstChildShield && firstChildShield.asset) {
          return firstChildShield.asset;
        }
      }

      return SHIELD_DROPDOWN_PLACEHOLDER_ICON;
    };

    const updateShieldPickerTreeState = (container, currentValue, expandedIds) => {
      container.querySelectorAll(".shieldPickerTreeRow").forEach((row) => {
        const nodeId = row.dataset.nodeId || "";
        row.classList.toggle("expanded", !!nodeId && expandedIds.has(nodeId));
      });

      container.querySelectorAll(".shieldPickerItem").forEach((button) => {
        const nodeId = button.dataset.nodeId || "";
        const nodeValue = button.dataset.nodeValue || "";
        const hasChildren = button.dataset.hasChildren === "true";
        const isExpanded = hasChildren && expandedIds.has(nodeId);

        button.classList.toggle("expanded", isExpanded);
        button.classList.toggle(
          "selected",
          !!nodeValue && nodeValue === currentValue
        );
      });

      container.querySelectorAll(".shieldPickerTreeChildren").forEach((children) => {
        const parentId = children.dataset.parentId || "";
        children.classList.toggle("expanded", !!parentId && expandedIds.has(parentId));
      });
    };
    
    const createShieldPickerRow = ({
      node,
      depth = 0,
      currentValue,
      expandedIds,
      onSelect,
      onToggle,
      onEdit,
    }) => {
      const row = document.createElement("div");
      row.className = "shieldPickerTreeRow";
      row.style.setProperty("--shieldPickerDepth", String(depth));
      row.dataset.nodeId = node.id || "";
      if (node.customSavedShield) {
        row.classList.add("customShieldPickerSavedRow");
      }

      const isExpanded =
        !!(node.children && node.children.length && expandedIds.has(node.id));

      if (isExpanded) {
        row.classList.add("expanded");
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "shieldPickerItem";
      button.dataset.nodeId = node.id || "";
      button.dataset.nodeValue = node.value || "";
      button.dataset.hasChildren =
        node.children && node.children.length ? "true" : "false";

      if (node.value && node.value === currentValue) {
        button.classList.add("selected");
      }
      if (node.disabled) {
        button.classList.add("disabled");
      }
      if (node.children && node.children.length) {
        button.classList.add("hasChildren");
      }
      if (isExpanded) {
        button.classList.add("expanded");
      }

      const icon = document.createElement("img");
      icon.className = "shieldPickerItemIcon";
      icon.src = buildShieldPickerIconSrc(node);
      icon.alt = "";
      icon.loading = "lazy";
      icon.decoding = "async";
      icon.draggable = false;
      icon.onerror = () => {
        icon.src = SHIELD_DROPDOWN_PLACEHOLDER_ICON;
      };
      button.appendChild(icon);

      const label = document.createElement("span");
      label.className = "shieldPickerItemLabel";
      label.textContent = node.label;
      button.appendChild(label);

      if (node.children && node.children.length) {
        const caret = document.createElement("span");
        caret.className = "shieldPickerItemCaret";
        caret.textContent = "▸";
        button.appendChild(caret);
      }

      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (node.children && node.children.length) {
          const wasExpanded = expandedIds.has(node.id);

          onToggle(node.id);

          if (!wasExpanded) {
            const firstChildShield = findFirstSelectableShieldEntry(node.children);
            if (firstChildShield) {
              onSelect(firstChildShield, {
                keepOpen: true,
                skipExpandPath: false,
                preserveTree: true,
              });
            }
          }

          return;
        }

        if (!node.disabled && node.value) {
          onSelect(node);
        }
      });

      row.appendChild(button);

      if (node.customSavedShield) {
        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "shieldPickerEditCustomShield";
        editButton.title = "Edit custom shield";
        editButton.setAttribute("aria-label", `Edit ${node.label || "custom shield"}`);
        editButton.innerHTML = `<span class="material-symbols-outlined">edit</span>`;
        editButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (typeof onEdit === "function") {
            onEdit(node);
          }
        });
        row.appendChild(editButton);
      }

      if (node.children && node.children.length) {
        const childrenWrap = document.createElement("div");
        childrenWrap.className = "shieldPickerTreeChildren";
        childrenWrap.dataset.parentId = node.id || "";

        if (isExpanded) {
          childrenWrap.classList.add("expanded");
        }

        node.children.forEach((child) => {
          childrenWrap.appendChild(
            createShieldPickerRow({
              node: child,
              depth: depth + 1,
              currentValue,
              expandedIds,
              onSelect,
              onToggle,
              onEdit,
            })
          );
        });

        row.appendChild(childrenWrap);
      }

      return row;
    };

    const renderShieldPickerTree = ({
      container,
      nodes,
      currentValue,
      expandedIds,
      onSelect,
      onToggle,
      onEdit,
    }) => {
      container.innerHTML = "";

      nodes.forEach((node) => {
        container.appendChild(
          createShieldPickerRow({
            node,
            depth: 0,
            currentValue,
            expandedIds,
            onSelect,
            onToggle,
            onEdit,
          })
        );
      });
    };

    const createShieldPicker = ({
      mount,
      value,
      onChange,
      placeholder = "Select shield",
      rootNodes = SHIELD_PICKER_TREE,
    }) => {
      const wrapper = document.createElement("div");
      wrapper.className = "shieldPicker";

      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "shieldPickerTrigger";

      const triggerIcon = document.createElement("img");
      triggerIcon.className = "shieldPickerTriggerIcon";
      triggerIcon.alt = "";
      trigger.appendChild(triggerIcon);

      const triggerLabel = document.createElement("span");
      triggerLabel.className = "shieldPickerTriggerLabel";
      trigger.appendChild(triggerLabel);

      const triggerCaret = document.createElement("span");
      triggerCaret.className = "shieldPickerTriggerCaret";
      triggerCaret.textContent = "▾";
      trigger.appendChild(triggerCaret);
        
        const popover = document.createElement("div");
        popover.className = "shieldPickerPopover";

        const getStoredShieldPickerScrollTop = () => {
          const raw = getStoredItem(STORAGE_KEYS.shieldPickerScrollTop);
          const parsed = parseFloat(raw);
          return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
        };

        const saveShieldPickerScrollTop = () => {
          setStoredItem(
            STORAGE_KEYS.shieldPickerScrollTop,
            String(Math.max(0, popover.scrollTop || 0))
          );
        };

        const restoreShieldPickerScrollTop = () => {
          const storedScrollTop = getStoredShieldPickerScrollTop();

          if (storedScrollTop !== null) {
            popover.scrollTop = storedScrollTop;
            return;
          }

          const selectedItem = popover.querySelector(".shieldPickerItem.selected");
          if (selectedItem) {
            selectedItem.scrollIntoView({
              block: "nearest",
              inline: "nearest",
            });
          }
        };

        const placePopover = () => {
          const rect = trigger.getBoundingClientRect();

          const visualScale =
            parseFloat(
              getComputedStyle(document.documentElement)
                .getPropertyValue("--sm-app-zoom")
            ) || 1;

          const viewportHeight = window.innerHeight;
          const bottomSpace = viewportHeight - rect.bottom - 12;
          const topSpace = rect.top - 12;
          const openUpward = bottomSpace < 220 && topSpace > bottomSpace;

          popover.style.position = "fixed";
          popover.style.left = rect.left + "px";
          popover.style.width = Math.max(rect.width, 320) + "px";

          if (openUpward) {
            popover.style.top = "auto";
            popover.style.bottom = viewportHeight - rect.top + 2 + "px";
            popover.style.maxHeight =
              Math.max(260, Math.min(760, topSpace / visualScale)) + "px";
          } else {
            popover.style.bottom = "auto";
            popover.style.top = rect.bottom + 2 + "px";
            popover.style.maxHeight =
              Math.max(260, Math.min(760, bottomSpace / visualScale)) + "px";
          }
        };;

      const tree = document.createElement("div");
      tree.className = "shieldPickerTree";
      popover.appendChild(tree);

      wrapper.appendChild(trigger);
      wrapper.appendChild(popover);
      mount.replaceWith(wrapper);

      let currentValue = value || "";
      const expandedIds = new Set(["us", "canada"]);

      const expandPathToValue = (targetValue, nodes = rootNodes, parents = []) => {
        for (const node of nodes) {
          if (node.value === targetValue) {
            parents.forEach((id) => expandedIds.add(id));
            return true;
          }
          if (Array.isArray(node.children)) {
            if (expandPathToValue(targetValue, node.children, [...parents, node.id])) {
              return true;
            }
          }
        }
        return false;
      };

      const syncTrigger = () => {
        const entry = findShieldPickerEntryByValue(currentValue, rootNodes);
        triggerLabel.textContent = entry
          ? buildShieldPickerTriggerLabel(entry)
          : placeholder;
        triggerIcon.src = buildShieldPickerIconSrc(entry);
        triggerIcon.onerror = () => {
          triggerIcon.src = SHIELD_DROPDOWN_PLACEHOLDER_ICON;
        };
      };

      const openCustomShieldMakerFromPicker = () => {
        const dialog = document.getElementById("customShieldMaker");
        const sdRouteInput = document.getElementById("sdShield_routeNumber");
        const sdShieldType = document.getElementById("sdShield_shieldType");
        const sdAlignment = document.getElementById("sdShield_alignment");

        const currentBlockElem =
          exposed && typeof exposed.getCurrentBlockElem === "function"
            ? exposed.getCurrentBlockElem()
            : null;

        const routeValue =
          sdRouteInput?.value ||
          currentBlockElem?.routeNumber ||
          document.querySelector(".sdShieldRouteNumberInput")?.value ||
          "123";

        if (dialog) {
          dialog._editingCustomShieldId = null;
          delete dialog.dataset.customShieldMakerUserUploaded;
          dialog._customShieldMakerSource = {
            ...currentBlockElem,
            shieldBase:
              currentValue ||
              currentBlockElem?.shieldBase ||
              currentBlockElem?.type ||
              "I",
            type:
              currentValue ||
              currentBlockElem?.shieldBase ||
              currentBlockElem?.type ||
              "I",
            shieldType:
              sdShieldType?.value ||
              currentBlockElem?.shieldType ||
              "Auto",
            routeNumber: routeValue,
            alignment:
              sdAlignment?.value ||
              currentBlockElem?.alignment ||
              "Center",
          };
        }

        const openButton = document.getElementById("openCustomShieldMaker");

        if (openButton) {
          openButton.click();
          return;
        }

        if (dialog) {
          dialog.style.display = "flex";

          if (!dialog.open) {
            dialog.showModal();
          }
        }
      };

      const rerenderTree = (forceRebuild = false) => {
        if (forceRebuild || !tree.childElementCount) {
          renderShieldPickerTree({
            container: tree,
            nodes: rootNodes,
            currentValue,
            expandedIds,
            onSelect: (node, options = {}) => {
              if (
                node.customShieldMaker ||
                node.value === SHIELD_PICKER_CUSTOM_MAKER_VALUE
              ) {
                saveShieldPickerScrollTop();
                wrapper.classList.remove("open");
                openCustomShieldMakerFromPicker();
                return;
              }

              currentValue = node.value;

              if (!options.skipExpandPath) {
                expandPathToValue(node.value);
              }

                syncTrigger();

                if (options.preserveTree) {
                  updateShieldPickerTreeState(tree, currentValue, expandedIds);
                } else {
                  rerenderTree(true);
                }

                  if (!options.keepOpen) {
                    saveShieldPickerScrollTop();
                    wrapper.classList.remove("open");
                  }

                if (typeof onChange === "function") {
                  onChange(node.value, node);
                }
              },
              onToggle: (id) => {
                if (expandedIds.has(id)) {
                  expandedIds.delete(id);
                } else {
                  expandedIds.add(id);
                }

                updateShieldPickerTreeState(tree, currentValue, expandedIds);
              },
              onEdit: (node) => {
                saveShieldPickerScrollTop();
                wrapper.classList.remove("open");
                document
                  .querySelectorAll(".shieldPicker.open")
                  .forEach((picker) => picker.classList.remove("open"));
                const dialog = document.getElementById("customShieldMaker");
                if (
                  dialog &&
                  typeof dialog._openSavedCustomShield === "function" &&
                  node.customShieldId
                ) {
                  dialog._openSavedCustomShield(node.customShieldId);
                }
              },
            });

            return;
          }

          updateShieldPickerTreeState(tree, currentValue, expandedIds);
        };

        trigger.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();

          const willOpen = !wrapper.classList.contains("open");

          if (!willOpen) {
            saveShieldPickerScrollTop();
          }

          wrapper.classList.toggle("open", willOpen);

          if (willOpen) {
            placePopover();
            rerenderTree();
            requestAnimationFrame(() => {
              restoreShieldPickerScrollTop();
            });
          }
        });

            document.addEventListener("click", (event) => {
              const clickedInsideTrigger = trigger.contains(event.target);
              const clickedInsidePopover = popover.contains(event.target);

              if (!clickedInsideTrigger && !clickedInsidePopover) {
                if (wrapper.classList.contains("open")) {
                  saveShieldPickerScrollTop();
                }

                wrapper.classList.remove("open");
              }
            });
            
            popover.addEventListener("scroll", () => {
              saveShieldPickerScrollTop();
            });
        
        window.addEventListener("resize", () => {
          if (wrapper.classList.contains("open")) {
            placePopover();
          }
        });

        window.addEventListener("scroll", () => {
          if (wrapper.classList.contains("open")) {
            placePopover();
          }
        }, true);

        expandPathToValue(currentValue);
        syncTrigger();
        rerenderTree(true);

      const pickerApi = {
        element: wrapper,
        getValue: () => currentValue,
        setValue: (nextValue) => {
          currentValue = nextValue || "";
          expandPathToValue(currentValue);
          syncTrigger();
          rerenderTree(true);
        },
        refresh: () => {
          expandPathToValue(currentValue);
          syncTrigger();
          rerenderTree(true);
        },
      };

      activeShieldPickerApis.add(pickerApi);
      return pickerApi;
    };
    
    const syncShieldBasePickerValue = (nextValue, { updateBlock = false } = {}) => {
      const normalizedValue =
        nextValue ||
        ShieldElement.prototype.defaultShieldBase ||
        "I";

      const nativeSelect = document.getElementById("sdShield_shieldBase");

      if (nativeSelect) {
        nativeSelect.dataset.pickerValue = normalizedValue;

        const hasNativeOption = Array.from(nativeSelect.options || []).some(
          (option) => option.value === normalizedValue
        );

        if (hasNativeOption) {
          nativeSelect.value = normalizedValue;
        }
      }

      const pickerApi =
        nativeSelect?._shieldPickerApi ||
        nativeSelect?.parentElement?.querySelector(".sdShieldBasePickerHost")
          ?._shieldPickerApi ||
        null;

      if (pickerApi && typeof pickerApi.setValue === "function") {
        pickerApi.setValue(normalizedValue);
      }

      if (updateBlock) {
        const currentBlockElem =
          exposed && typeof exposed.getCurrentBlockElem === "function"
            ? exposed.getCurrentBlockElem()
            : null;

        if (currentBlockElem) {
          currentBlockElem.shieldBase = normalizedValue;
          currentBlockElem.type = normalizedValue;
        }
      }

      return normalizedValue;
    };

    const ensureSdShieldBasePicker = () => {
      const nativeSelect = document.getElementById("sdShield_shieldBase");

      if (!nativeSelect) {
        return null;
      }

      let pickerHost = nativeSelect.parentElement?.querySelector(
        ".sdShieldBasePickerHost"
      );

      if (!pickerHost) {
        pickerHost = document.createElement("div");
        pickerHost.className = "sdShieldBasePickerHost";
        nativeSelect.insertAdjacentElement("afterend", pickerHost);
      }

      nativeSelect.style.display = "none";

      let pickerApi =
        nativeSelect._shieldPickerApi || pickerHost._shieldPickerApi || null;

      if (!pickerApi) {
        const placeholderSelect = document.createElement("select");
        placeholderSelect.id = "sdShield_shieldBase_pickerProxy";

        pickerHost.innerHTML = "";
        pickerHost.appendChild(placeholderSelect);

        pickerApi = createShieldPicker({
          mount: placeholderSelect,
          value:
            nativeSelect.dataset.pickerValue ||
            nativeSelect.value ||
            ShieldElement.prototype.defaultShieldBase ||
            "I",
          placeholder: "Shield type",
          onChange: (nextValue) => {
            if (!nextValue) {
              return;
            }

            syncShieldBasePickerValue(nextValue, { updateBlock: true });

            updateShieldCountyVisibility();

            if (typeof readForm === "function") {
              readForm();
            }
          },
        });

        nativeSelect._shieldPickerApi = pickerApi;
        pickerHost._shieldPickerApi = pickerApi;
      }

      const currentBlockElem =
        exposed && typeof exposed.getCurrentBlockElem === "function"
          ? exposed.getCurrentBlockElem()
          : null;

      const selectedShieldBase =
        currentBlockElem?.shieldBase ||
        currentBlockElem?.type ||
        nativeSelect.dataset.pickerValue ||
        nativeSelect.value ||
        ShieldElement.prototype.defaultShieldBase ||
        "I";

      syncShieldBasePickerValue(selectedShieldBase);

      return pickerApi;
    };
    
    const ensureGuideArrowPicker = () => {
      const nativeSelect = document.getElementById("guideArrow");
      if (!nativeSelect) {
        return null;
      }

      let pickerHost = nativeSelect.parentElement?.querySelector(".guideArrowPickerHost");
      let pickerApi = nativeSelect._arrowPickerApi || null;

      if (!pickerHost) {
        pickerHost = document.createElement("div");
        pickerHost.className = "guideArrowPickerHost";
        nativeSelect.insertAdjacentElement("afterend", pickerHost);
      }

      nativeSelect.style.display = "none";

      if (!pickerApi) {
        const placeholderSelect = document.createElement("select");
        placeholderSelect.id = "guideArrow_pickerProxy";
        pickerHost.innerHTML = "";
        pickerHost.appendChild(placeholderSelect);

        pickerApi = createFlatArrowPicker({
          mount: placeholderSelect,
            value: String(nativeSelect.value || "None").split(":")[0].trim(),          placeholder: "Arrows",
          items: ARROW_PICKER_ITEMS,
            previewOptions: { exitDirection: false },
          onChange: (nextValue) => {
            nativeSelect.value = nextValue;
            if (typeof readForm === "function") {
              readForm();
            }
          },
        });

        nativeSelect._arrowPickerApi = pickerApi;
      }

      if (pickerApi && typeof pickerApi.setValue === "function") {
          pickerApi.setValue(String(nativeSelect.value || "None").split(":")[0].trim());
      }

      return pickerApi;
    };
    
    const ensureExitOnlyDirectionPicker = () => {
      const nativeSelect = document.getElementById("exitOnlyDirection");
      if (!nativeSelect) {
        return null;
      }

      let pickerHost = nativeSelect.parentElement?.querySelector(".exitOnlyDirectionPickerHost");
      let pickerApi = nativeSelect._arrowPickerApi || null;

      if (!pickerHost) {
        pickerHost = document.createElement("div");
        pickerHost.className = "exitOnlyDirectionPickerHost";
        nativeSelect.insertAdjacentElement("afterend", pickerHost);
      }

      nativeSelect.style.display = "none";

      if (!pickerApi) {
        const placeholderSelect = document.createElement("select");
        placeholderSelect.id = "exitOnlyDirection_pickerProxy";
        pickerHost.innerHTML = "";
        pickerHost.appendChild(placeholderSelect);

        pickerApi = createFlatArrowPicker({
          mount: placeholderSelect,
            value: String(nativeSelect.value || "Down Arrow").split(":")[0].trim(),
          placeholder: "Direction",
          items: EXIT_ONLY_DIRECTION_ITEMS,
            previewOptions: { exitDirection: true },
          onChange: (nextValue) => {
            nativeSelect.value = nextValue;
            if (typeof readForm === "function") {
              readForm();
            }
          },
        });

        nativeSelect._arrowPickerApi = pickerApi;
      }

      if (pickerApi && typeof pickerApi.setValue === "function") {
          pickerApi.setValue(String(nativeSelect.value || "Down Arrow").split(":")[0].trim());
      }

      return pickerApi;
    };
    
    const getArrowDisplayLabel = (value) => String(value || "").split(":")[0].trim();

    const getGuideArrowEntryByLabel = (label) =>
      Sign.prototype.guideArrows.find(
        (entry) => getArrowDisplayLabel(entry) === label
      ) || label;

    const getExitArrowEntryByLabel = (label) =>
      Sign.prototype.exitguideArrows.find(
        (entry) => getArrowDisplayLabel(entry) === label
      ) || label;

    const normalizeArrowAssetCode = (rawCode) => {
      let code = String(rawCode || "").trim();

      if (!code) {
        return "";
      }

      if (code.includes("/")) {
        code = code.split("/")[0].trim();
      }

      if (/^E[A-C]-/i.test(code)) {
        const parts = code.split("-");
        code = `${code.charAt(1)}-${parts[1]}`;
      }

      return code;
    };

    const getArrowIconPathFromValue = (value, { exitDirection = false } = {}) => {
      const label = getArrowDisplayLabel(value);

      if (!label || label === "None") {
        return null;
      }

      const hardMap = {
        "Side Left": "A-4",
        "Side Right": "A-1",
        "Exit Only": "C-1",
        "Split Exit Only": "C-1",
        "Half Exit Only": "C-1",
      };

      let code = hardMap[label] || "";

      if (!code) {
        const entry = exitDirection
          ? getExitArrowEntryByLabel(label)
          : getGuideArrowEntryByLabel(label);

        const afterColon = String(entry).split(":")[1] || "";
        code = normalizeArrowAssetCode(afterColon);
      }

      if (!code) {
        return null;
      }

      const folder = /^[A-E]-[1-4]$/i.test(code)
        ? "img/arrows"
        : "img/arrows/SpecialArrows";

      return `${folder}/${code}.svg`;
    };

    const createArrowPreviewNode = (value, options = {}) => {
      const label = getArrowDisplayLabel(value);

      const makeArrowImg = (src, extraClass = "", invert = false) => {
        const img = document.createElement("img");
        img.className = `arrowPickerIconImage ${extraClass}`.trim();
        img.alt = "";
        img.src = src;
        img.loading = "lazy";
        img.decoding = "async";
        if (invert) {
          img.style.filter = "invert(1)";
        }
        img.onerror = () => {
          img.style.display = "none";
        };
        return img;
      };

      const makeSpecialBox = (theme, invertArrow = false) => {
        const box = document.createElement("span");
        box.className = `arrowPickerSpecialSvgBox ${theme}`;
        box.appendChild(makeArrowImg("img/arrows/C-1.svg", "", invertArrow));
        return box;
      };

      if (label === "Exit Only") {
        const wrap = document.createElement("span");
        wrap.className = "arrowPickerSpecialSvg";
        wrap.appendChild(makeSpecialBox("yellow", true));
        return wrap;
      }

      if (label === "Split Exit Only") {
        const wrap = document.createElement("span");
        wrap.className = "arrowPickerSpecialSvg";
        wrap.appendChild(makeSpecialBox("green", false));
        return wrap;
      }

      if (label === "Half Exit Only") {
        const wrap = document.createElement("span");
        wrap.className = "arrowPickerSpecialSvg dual";
        wrap.appendChild(makeSpecialBox("green", false));
        wrap.appendChild(makeSpecialBox("yellow", true));
        return wrap;
      }

        const path = getArrowIconPathFromValue(value, options);

        if (!path) {
          return null;
        }

      const img = document.createElement("img");
      img.className = "arrowPickerIconImage";
      img.alt = "";
      img.src = path;
      img.loading = "lazy";
      img.decoding = "async";
      img.onerror = () => {
        img.style.display = "none";
      };
      return img;
    };
    
    const ARROW_PICKER_ITEMS = Sign.prototype.guideArrows.map((entry) => {
      const label = getArrowDisplayLabel(entry);
      return {
        value: label,
        label,
        rawValue: entry,
      };
    });

    const EXIT_ONLY_DIRECTION_ITEMS = Sign.prototype.exitguideArrows.map((entry) => {
      const label = getArrowDisplayLabel(entry);
      return {
        value: label,
        label,
        rawValue: entry,
      };
    });
    
    const APL_ARROW_PICKER_ITEMS = [
      { value: "UP", label: "Up", arrowType: "APL_UP", flip: false },
      { value: "UP_LEFT", label: "Up Left Turn", arrowType: "APL_UP_TURN", flip: true },
      { value: "UP_RIGHT", label: "Up Right Turn", arrowType: "APL_UP_TURN", flip: false },
      { value: "DUAL_TURN", label: "Dual Turn", arrowType: "APL_DUAL_TURN", flip: false },
      { value: "LEFT_TURN", label: "Left Turn", arrowType: "APL_TURN", flip: true },
      { value: "RIGHT_TURN", label: "Right Turn", arrowType: "APL_TURN", flip: false },
    ];

    const createAPLArrowPreviewNode = (value) => {
      const item = APL_ARROW_PICKER_ITEMS.find((entry) => entry.value === value);
      if (!item) {
        return null;
      }

      const arrowDef = ArrowElement.prototype.arrows[item.arrowType];
      if (!arrowDef || !arrowDef.src) {
        return null;
      }

      const img = document.createElement("img");
      img.className = "arrowPickerIconImage aplArrowPickerIconImage";
      img.alt = "";
      img.src = arrowDef.src;
      img.loading = "lazy";
      img.decoding = "async";

      if (item.flip) {
        img.style.transform = "scaleX(-1)";
      }

      img.onerror = () => {
        img.style.display = "none";
      };

      return img;
    };

    const findArrowPickerEntryByValue = (value, items) =>
      items.find((item) => item.value === value) || null;

    const createFlatArrowPicker = ({
        mount,
        value,
        onChange,
        placeholder = "Select arrow",
        items = ARROW_PICKER_ITEMS,
        previewOptions = {},
        createPreviewNode = createArrowPreviewNode,
    }) => {
        const wrapper = document.createElement("div");
        wrapper.className = "shieldPicker arrowPicker";
    
        const placePopover = () => {
          const rect = trigger.getBoundingClientRect();
          popover.style.position = "fixed";
          popover.style.left = `${rect.left}px`;
          popover.style.top = `${rect.bottom + 2}px`;
          popover.style.width = `${Math.max(rect.width, 320)}px`;
          popover.style.maxHeight = `${Math.max(160, window.innerHeight - rect.bottom - 12)}px`;
        };

        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "shieldPickerTrigger";

        const triggerIconHolder = document.createElement("span");
        triggerIconHolder.className = "shieldPickerTriggerIcon arrowPickerIconHolder";
        trigger.appendChild(triggerIconHolder);

        const triggerLabel = document.createElement("span");
        triggerLabel.className = "shieldPickerTriggerLabel";
        trigger.appendChild(triggerLabel);

        const triggerCaret = document.createElement("span");
        triggerCaret.className = "shieldPickerTriggerCaret";
        triggerCaret.textContent = "▾";
        trigger.appendChild(triggerCaret);

        const popover = document.createElement("div");
        popover.className = "shieldPickerPopover";
        
        const list = document.createElement("div");
        list.className = "shieldPickerTree arrowPickerList";
        popover.appendChild(list);

        wrapper.appendChild(trigger);
        wrapper.appendChild(popover);
        mount.replaceWith(wrapper);

      let currentValue = value || "";

      const syncTrigger = () => {
        const entry = findArrowPickerEntryByValue(currentValue, items);
        triggerLabel.textContent = entry ? entry.label : placeholder;
          triggerIconHolder.innerHTML = "";
          const triggerIcon = createPreviewNode(entry ? entry.value : "", previewOptions);
          if (triggerIcon) {
            triggerIconHolder.appendChild(triggerIcon);
            triggerIconHolder.style.display = "";
          } else {
            triggerIconHolder.style.display = "none";
          }
      };

      const renderList = () => {
        list.innerHTML = "";

        items.forEach((item) => {
          const row = document.createElement("button");
          row.type = "button";
          row.className = "shieldPickerItem";
          if (item.value === currentValue) {
            row.classList.add("selected");
          }

            const iconNode = createPreviewNode(item.value, previewOptions);
            if (iconNode) {
              const iconHolder = document.createElement("span");
              iconHolder.className = "arrowPickerIconHolder";
              iconHolder.appendChild(iconNode);
              row.appendChild(iconHolder);
            }

          const label = document.createElement("span");
          label.className = "shieldPickerItemLabel";
          label.textContent = item.label;
          row.appendChild(label);

          row.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            currentValue = item.value;
            syncTrigger();
            renderList();
            wrapper.classList.remove("open");
            if (typeof onChange === "function") {
              onChange(item.value, item);
            }
          });

          list.appendChild(row);
        });
      };

        trigger.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();

          const willOpen = !wrapper.classList.contains("open");
          wrapper.classList.toggle("open", willOpen);

          if (willOpen) {
            placePopover();
          }
        });

        document.addEventListener("click", (event) => {
          const clickedInsideTrigger = trigger.contains(event.target);
          const clickedInsidePopover = popover.contains(event.target);

          if (!clickedInsideTrigger && !clickedInsidePopover) {
            wrapper.classList.remove("open");
          }
        });
        
        window.addEventListener("resize", () => {
          if (wrapper.classList.contains("open")) {
            placePopover();
          }
        });

        window.addEventListener("scroll", () => {
          if (wrapper.classList.contains("open")) {
            placePopover();
          }
        }, true);

      syncTrigger();
      renderList();

      return {
        element: wrapper,
        getValue: () => currentValue,
        setValue: (nextValue) => {
          currentValue = nextValue || "";
          syncTrigger();
          renderList();
        },
      };
    };

  const initUI = async () => {
    const sMConfigBar = document.querySelector("#sMConfigBar");
    const htmlElement = document.documentElement;
    const nightModeButton = document.querySelector("#nightMode");
    const prefersDarkScheme =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;

    const normalizeInterfaceThemeMode = (value) => {
      const normalized = String(value || "").toLowerCase();

      if (
        normalized === "light" ||
        normalized === "dark" ||
        normalized === "system"
      ) {
        return normalized;
      }

      return "dark";
    };

    const getSystemTheme = () =>
      prefersDarkScheme && prefersDarkScheme.matches ? "dark" : "light";

    const getResolvedThemeForMode = (themeMode) => {
      const normalized = normalizeInterfaceThemeMode(themeMode);
      return normalized === "system" ? getSystemTheme() : normalized;
    };

    const applyTheme = (theme) => {
      if (!theme) {
        return;
      }

      htmlElement.dataset.theme = theme;
    };

    const updateInterfaceThemeControl = (themeMode) => {
      const normalized = normalizeInterfaceThemeMode(themeMode);
      const themeModeButtons = document.querySelectorAll("[data-interface-theme-mode]");

      htmlElement.dataset.themeMode = normalized;

      themeModeButtons.forEach((button) => {
        const buttonMode = normalizeInterfaceThemeMode(
          button.dataset.interfaceThemeMode
        );

        button.classList.toggle("active", buttonMode === normalized);
      });
    };

    const applyInterfaceThemeMode = (themeMode, { persist = false } = {}) => {
      const normalized = normalizeInterfaceThemeMode(themeMode);
      const resolvedTheme = getResolvedThemeForMode(normalized);

      applyTheme(resolvedTheme);
      updateInterfaceThemeControl(normalized);

      if (persist) {
        setStoredItem(STORAGE_KEYS.interfaceThemeMode, normalized);
      }

      return normalized;
    };

    const getStoredInterfaceThemeMode = () =>
      normalizeInterfaceThemeMode(getStoredItem(STORAGE_KEYS.interfaceThemeMode));

    const toggleInterfaceThemeMode = () => {
      const nextThemeMode = htmlElement.dataset.theme === "dark" ? "light" : "dark";
      return applyInterfaceThemeMode(nextThemeMode, { persist: true });
    };

    const bindInterfaceThemeModeControl = () => {
      const themeModeButtons = document.querySelectorAll("[data-interface-theme-mode]");

      themeModeButtons.forEach((button) => {
        if (button.dataset.interfaceThemeModeBound === "true") {
          return;
        }

        button.dataset.interfaceThemeModeBound = "true";

        button.addEventListener("click", () => {
          applyInterfaceThemeMode(button.dataset.interfaceThemeMode, {
            persist: true,
          });
          updateUtilityButtonLabels();
        });
      });
    };

    const handleSystemThemeChange = () => {
      if (normalizeInterfaceThemeMode(htmlElement.dataset.themeMode) !== "system") {
        return;
      }

      applyInterfaceThemeMode("system");
      updateUtilityButtonLabels();
    };
      const settingsRestoreOnRefresh = document.getElementById("settingsSaveOnRefresh");
      if (settingsRestoreOnRefresh) {
        const storedRestoreMode = normalizeRestoreOnRefreshMode(
          getStoredItem(STORAGE_KEYS.restoreOnRefresh)
        );
        settingsRestoreOnRefresh.value = storedRestoreMode;

        if (settingsRestoreOnRefresh.dataset.restoreOnRefreshBound !== "true") {
          settingsRestoreOnRefresh.dataset.restoreOnRefreshBound = "true";
          settingsRestoreOnRefresh.addEventListener("change", () => {
            const selectedMode = normalizeRestoreOnRefreshMode(
              settingsRestoreOnRefresh.value
            );
            settingsRestoreOnRefresh.value = selectedMode;
            setStoredItem(STORAGE_KEYS.restoreOnRefresh, selectedMode);
          });
        }
      }
    const updateUtilityButtonLabels = () => {
        const exportButton = document.getElementById("export");
        const nightModeButton = document.getElementById("nightMode");
        const settingsButton = document.getElementById("settingsMenuButton");

        if (settingsButton) {
          const settingsLabel = settingsButton.querySelector(".buttonLabel");
          if (settingsLabel) {
            settingsLabel.textContent = "Settings";
          }
        }
        const hideConfigButton = document.getElementById("hideConfig");

        if (exportButton) {
          const exportLabel = exportButton.querySelector(".buttonLabel");
          if (exportLabel) {
            exportLabel.textContent = "Download";
          }
        }

        if (nightModeButton) {
          const nightModeLabel = nightModeButton.querySelector(".buttonLabel");
          const nextThemeLabel =
            htmlElement.dataset.theme === "dark" ? "Light Mode" : "Dark Mode";

          if (nightModeLabel) {
            nightModeLabel.textContent = nextThemeLabel;
          }
        }

        if (hideConfigButton) {
          const hideConfigLabel = hideConfigButton.querySelector(".buttonLabel");
          const isCollapsed = sMConfigBar.classList.contains("invisible");
          const menuLabel = isCollapsed ? "Show Menu" : "Hide Menu";
          const icon = hideConfigButton.querySelector(".material-symbols-outlined");

          if (hideConfigLabel) {
            hideConfigLabel.textContent = menuLabel;
          }
          if (icon) {
            icon.textContent = isCollapsed ? "menu_open" : "open_in_full";
          }
        }
        try {
          ensureGuideArrowPicker();
        } catch (error) {
          console.error("Failed to initialize guide arrow picker", error);
        }

        try {
          ensureExitOnlyDirectionPicker();
        } catch (error) {
          console.error("Failed to initialize exit-only direction picker", error);
        }
    };
      applyInterfaceThemeMode(getStoredInterfaceThemeMode());
      bindInterfaceThemeModeControl();

      if (prefersDarkScheme) {
        if (typeof prefersDarkScheme.addEventListener === "function") {
          prefersDarkScheme.addEventListener("change", handleSystemThemeChange);
        } else if (typeof prefersDarkScheme.addListener === "function") {
          prefersDarkScheme.addListener(handleSystemThemeChange);
        }
      }

      updateUtilityButtonLabels();
      const exportButton = document.getElementById("export");
      const downloadDialog = document.getElementById("downloadContent");
      const cancelDownloadButton = document.getElementById("cancelDownload");
      const modalHolder = document.getElementById("modalHolder");

      if (exportButton && downloadDialog && modalHolder) {
        exportButton.type = "button";
        exportButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();

          modalHolder.style.display = "flex";
          downloadDialog.style.display = "flex";

          requestAnimationFrame(() => {
            if (typeof app !== "undefined" && typeof app.updatePreview === "function") {
              app.updatePreview().catch((error) => {
                console.error("Failed to update download preview", error);
              });
            }
          });
        });
      }

      if (cancelDownloadButton && downloadDialog && modalHolder) {
        cancelDownloadButton.type = "button";
        cancelDownloadButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          downloadDialog.style.display = "none";
          modalHolder.style.display = "none";
        });
      }

      if (modalHolder && downloadDialog) {
        modalHolder.addEventListener("click", (event) => {
          if (event.target === modalHolder) {
            downloadDialog.style.display = "none";
            modalHolder.style.display = "none";
          }
        });
      }
      if (downloadDialog) {
        downloadDialog.addEventListener("click", (event) => {
          const rect = downloadDialog.getBoundingClientRect();
          const clickedInside =
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom;

          if (!clickedInside && downloadDialog.open) {
            downloadDialog.close();
          }
        });
      }
      const settingsMenuButton = document.getElementById("settingsMenuButton");
      const signMakerSettingsModal = document.getElementById("signMakerSettingsModal");
      const closeSignMakerSettings = document.getElementById("closeSignMakerSettings");

      const isSettingsOpen = () =>
        !!signMakerSettingsModal && signMakerSettingsModal.classList.contains("open");

      const openSettings = () => {
        if (!signMakerSettingsModal) {
          return;
        }
        signMakerSettingsModal.classList.add("open");
      };

      const closeSettings = () => {
        if (!signMakerSettingsModal) {
          return;
        }
        signMakerSettingsModal.classList.remove("open");
      };

      if (settingsMenuButton) {
        settingsMenuButton.type = "button";
        settingsMenuButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();

          if (isSettingsOpen()) {
            closeSettings();
          } else {
            openSettings();
          }
        });
      }

      if (closeSignMakerSettings) {
        closeSignMakerSettings.type = "button";
        closeSignMakerSettings.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          closeSettings();
        });
      }

      if (signMakerSettingsModal) {
        signMakerSettingsModal.addEventListener("click", (event) => {
          event.stopPropagation();
        });
      }
      const settingsSideTabs = document.querySelectorAll(".settingsSideTab");
      const settingsPages = document.querySelectorAll(".settingsPage");
      let currentSettingsPageId = "settingsGeneral";

      const showSettingsPage = (pageId) => {
        currentSettingsPageId = pageId;

        settingsSideTabs.forEach((tab) => {
          tab.classList.toggle(
            "active",
            tab.dataset.settingsPage === pageId
          );
        });

        settingsPages.forEach((page) => {
          page.classList.toggle("active", page.id === pageId);
        });
      };

      settingsSideTabs.forEach((tab) => {
        tab.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          showSettingsPage(tab.dataset.settingsPage);
        });
      });

      showSettingsPage("settingsGeneral");
      
      const applyShortcutDisplayFormatting = (root = document) => {
        const shortcutInputs = root.querySelectorAll('#settingsControls input[type="text"]');

        shortcutInputs.forEach((input) => {
          if (!input.value) {
            return;
          }
          input.value = formatShortcutForDisplay(input.value);
        });
      };
      
      const formatShortcutKeyName = (key) => {
        const normalized = String(key || "");

        const specialKeyMap = {
          " ": "SPACE",
          Escape: "Escape",
          Esc: "Escape",
          Control: "CTRL",
          Meta: "CMD",
          Alt: "ALT",
          Shift: "SHIFT",
          ArrowUp: "↑",
          ArrowDown: "↓",
          ArrowLeft: "←",
          ArrowRight: "→",
          PageUp: "PGUP",
          PageDown: "PGDN",
          Delete: "Delete",
          Backspace: "Backspace",
          Enter: "Enter",
          Tab: "Tab",
          Home: "Home",
          End: "End",
          Insert: "Insert",
        };

        if (specialKeyMap[normalized]) {
          return specialKeyMap[normalized];
        }

        if (/^F\d{1,2}$/i.test(normalized)) {
          return normalized.toUpperCase();
        }

        if (/^Numpad\d$/i.test(normalized)) {
          return normalized.replace(/^Numpad/i, "NUMPAD");
        }

        if (/^Key[A-Z]$/i.test(normalized)) {
          return normalized.slice(-1).toUpperCase();
        }

        if (/^Digit\d$/i.test(normalized)) {
          return normalized.slice(-1);
        }

        if (normalized.length === 1) {
          return normalized.toUpperCase();
        }

        return normalized.toUpperCase();
      };

      const buildShortcutString = (event) => {
        const parts = [];

        if (event.ctrlKey) {
          parts.push("CTRL");
        }
        if (event.metaKey) {
          parts.push(isMacOS ? "CTRL" : "CMD");
        }
        if (event.altKey) {
          parts.push("ALT");
        }
        if (event.shiftKey) {
          parts.push("SHIFT");
        }

        const keyName = normalizeEventKeyForShortcut(event);

        if (!["CTRL", "CMD", "ALT", "SHIFT"].includes(keyName)) {
          parts.push(keyName);
        }

        return parts.join("+");
      };

      const bindShortcutCaptureInputs = (root = document) => {
        const shortcutInputs = root.querySelectorAll(
          '#settingsControls input[type="text"]'
        );

        shortcutInputs.forEach((input) => {
          if (input.dataset.shortcutCaptureBound === "true") {
            return;
          }

          input.dataset.shortcutCaptureBound = "true";
          input.setAttribute("autocomplete", "off");
          input.setAttribute("autocorrect", "off");
          input.setAttribute("autocapitalize", "off");
          input.setAttribute("spellcheck", "false");

            input.addEventListener("keydown", (event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                input.blur();
                return;
              }

              if (event.key === "Backspace") {
                event.preventDefault();
                event.stopPropagation();
                input.value = "";
                persistShortcutInputValue(input);
                return;
              }

              event.preventDefault();
              event.stopPropagation();

                const shortcutValue = buildShortcutString(event);
                if (!shortcutValue) {
                  return;
                }

                input.dataset.shortcutInternalValue = shortcutValue;
                input.value = formatShortcutForDisplay(shortcutValue);
                persistShortcutInputValue(input);
            });

          input.addEventListener("focus", () => {
            input.select();
          });
        });
      };

      bindShortcutCaptureInputs(document);
      
      const bindExitTabSliderReset = (buttonId, inputId, valueId, getResetValue) => {
        const button = document.getElementById(buttonId);
        const input = document.getElementById(inputId);
        const valueLabel = document.getElementById(valueId);

        if (!button || !input || button.dataset.boundReset === "true") {
          return;
        }

        button.dataset.boundReset = "true";

        button.addEventListener("click", () => {
          const resetValue =
            typeof getResetValue === "function" ? getResetValue() : getResetValue;

          input.value = String(resetValue);

          if (valueLabel) {
            valueLabel.innerHTML = String(resetValue);
          }

          formHandler.readForm();
        });
      };

      bindExitTabSliderReset(
        "borderReset",
        "borderThickness",
        "borderValue",
        () => ExitTab.prototype.defaultBorderThickness
      );

      bindExitTabSliderReset(
        "minimumReset",
        "minHeight",
        "minValue",
        () => ExitTab.prototype.defaultMinHeight
      );

      bindExitTabSliderReset(
        "sizeReset",
        "fontSize",
        "fontValue",
        () => ExitTab.prototype.defaultFontSize
      );

      bindExitTabSliderReset(
        "nestedSpacingReset",
        "nestedTabSpacing",
        "nestedSpacingValue",
        () => ExitTab.prototype.defaultNestedTabSpacing
      );
      
      const bindShortcutResetButtons = (root = document) => {
          const shortcutInputs = root.querySelectorAll(
            '#settingsControls input[type="text"]'
          );

        shortcutInputs.forEach((input) => {
            if (!input.dataset.defaultShortcutCaptured) {
              input.dataset.defaultShortcutCaptured = "true";
              input.dataset.defaultShortcutValue = input.defaultValue || "";
            }

          if (input.dataset.shortcutResetWrapped === "true") {
            return;
          }

          const wrapper = document.createElement("div");
          wrapper.className = "settingsShortcutField";

          input.parentNode.insertBefore(wrapper, input);
          wrapper.appendChild(input);

            const resetButton = document.createElement("button");
            resetButton.type = "button";
            resetButton.tabIndex = -1;
            resetButton.className = "settingsShortcutResetButton";
            resetButton.setAttribute("aria-label", `Reset ${input.id} to default`);
            resetButton.setAttribute("title", "Reset to default");
            resetButton.innerHTML =
              '<span class="material-symbols-outlined">restart_alt</span>';

            resetButton.addEventListener("mousedown", (event) => {
              event.preventDefault();
              event.stopPropagation();
            });

            resetButton.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();

              const parentField = resetButton.closest(".settingsShortcutField");
              const targetInput = parentField
                ? parentField.querySelector('input[type="text"]')
                : null;

              if (!targetInput) {
                return;
              }

                targetInput.dataset.shortcutInternalValue =
                  targetInput.dataset.defaultShortcutValue || "";
                targetInput.value = formatShortcutForDisplay(
                  targetInput.dataset.shortcutInternalValue
                );
                persistShortcutInputValue(targetInput);
                targetInput.blur();
                resetButton.blur();
                targetInput.dispatchEvent(new Event("input", { bubbles: true }));
                targetInput.dispatchEvent(new Event("change", { bubbles: true }));
            });

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.tabIndex = -1;
            deleteButton.className = "settingsShortcutDeleteButton";
            deleteButton.setAttribute("aria-label", `Clear ${input.id}`);
            deleteButton.setAttribute("title", "Clear shortcut");
            deleteButton.innerHTML =
              '<span class="material-symbols-outlined">close</span>';

            deleteButton.addEventListener("mousedown", (event) => {
              event.preventDefault();
              event.stopPropagation();
            });

            deleteButton.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();

              const parentField = deleteButton.closest(".settingsShortcutField");
              const targetInput = parentField
                ? parentField.querySelector('input[type="text"]')
                : null;

              if (!targetInput) {
                return;
              }

                targetInput.dataset.shortcutInternalValue = "";
                targetInput.value = "";
                persistShortcutInputValue(targetInput);
                targetInput.blur();
                deleteButton.blur();
                targetInput.dispatchEvent(new Event("input", { bubbles: true }));
                targetInput.dispatchEvent(new Event("change", { bubbles: true }));
            });

            wrapper.appendChild(resetButton);
            wrapper.appendChild(deleteButton);
            input.dataset.shortcutResetWrapped = "true";
        });
      };

      bindShortcutCaptureInputs(document);
      bindShortcutResetButtons(document);
      applyStoredShortcutOverrides(document);
      
      const settingsResetControlsDefaults = document.getElementById("settingsResetControlsDefaults");

      if (settingsResetControlsDefaults) {
        settingsResetControlsDefaults.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();

          const shortcutInputs = document.querySelectorAll(
            '#settingsControls input[type="text"]'
          );

          shortcutInputs.forEach((input) => {
            const defaultValue = input.dataset.defaultShortcutValue || input.defaultValue || "";
            input.dataset.shortcutInternalValue = defaultValue;
            input.value = formatShortcutForDisplay(defaultValue);
            persistShortcutInputValue(input);
            input.blur();
          });
        });
      }

    function reDisplay() {
      for (const holder of document.querySelectorAll(".sMModal")) {
        if (holder.classList.contains(sMConfigBar.dataset.currentMenu)) {
          holder.style.display = "block";
        } else {
          holder.style.display = "";
        }
      }

      if (sMConfigBar.dataset.currentMenu == "panelSelector") {
        document.querySelector("#panelSelect").style.display = "flex";
        document.querySelectorAll(
          ".sMConfigOption:has(#panelSelector)"
        )[0].className = "sMConfigOption selected";
      } else {
        document.querySelector("#panelSelect").style.display = "";
        document.querySelectorAll(
          ".sMConfigOption:has(#panelSelector)"
        )[0].className = "sMConfigOption";
      }

      for (const button of document.querySelectorAll(".sMConfigOption")) {
        if (!button.id || button.id == "nightMode") {
          continue;
        }

        if (button.id == sMConfigBar.dataset.currentMenu) {
          button.className = "sMConfigOption selected";
        } else {
          button.className = "sMConfigOption";
        }
      }
    }

    for (const button of document.querySelectorAll(".sMConfigOption")) {
        button.onclick = function () {
            if (
              !button.id ||
              button.id === "nightMode" ||
              button.id === "export" ||
              button.id === "hideConfig" ||
              button.id === "undoButton" ||
              button.id === "settingsMenuButton"
            ) {
              return;
            }
            
           if (button.id === "guideArrowConfig") {
              if (sMConfigBar.dataset.currentMenu === button.id) {
              sMConfigBar.dataset.currentMenu = "";
              reDisplay();
              } else {
              ensureGuideArrowMenuOpen();
              }
              return;
           }

          if (sMConfigBar.dataset.currentMenu == button.id) {
            sMConfigBar.dataset.currentMenu = "";
          } else {
            sMConfigBar.dataset.currentMenu = button.id;
          }

          reDisplay();
        };
    }

      const getShortcutTokensForField = (fieldId) => {
        const field = document.getElementById(fieldId);
        if (!field) {
          return [];
        }

        const rawValue = field.dataset.shortcutInternalValue || "";

        return String(rawValue)
          .split("|")
          .map((part) => normalizeShortcutToken(part))
          .filter(Boolean);
      };

      const normalizeEventKeyForShortcut = (event) => {
        const key = event.key;
        const code = event.code || "";

        const specialMap = {
          Escape: "ESC",
          Esc: "ESC",
          ArrowUp: "↑",
          ArrowDown: "↓",
          ArrowLeft: "←",
          ArrowRight: "→",
          PageUp: "PGUP",
          PageDown: "PGDN",
          Backspace: "BACKSPACE",
          Delete: "DELETE",
          Enter: "ENTER",
          Tab: "TAB",
          Home: "HOME",
          End: "END",
          Insert: "INSERT",
          " ": "SPACE",
        };

        if (specialMap[key]) {
          return specialMap[key];
        }

        if (/^Key[A-Z]$/i.test(code)) {
          return code.slice(-1).toUpperCase();
        }

        if (/^Digit\d$/i.test(code)) {
          return code.slice(-1);
        }

        if (/^Numpad\d$/i.test(code)) {
          return code.replace(/^Numpad/i, "NUMPAD");
        }

        if (/^F\d{1,2}$/i.test(key)) {
          return key.toUpperCase();
        }

        if (key && key.length === 1) {
          return key.toUpperCase();
        }

        return String(key || "").toUpperCase();
      };

      const getEventShortcutToken = (event) => {
        const parts = [];

        if (event.ctrlKey) {
          parts.push("CTRL");
        }
        if (event.metaKey) {
          parts.push(isMacOS ? "CTRL" : "CMD");
        }
        if (event.altKey) {
          parts.push("ALT");
        }
        if (event.shiftKey) {
          parts.push("SHIFT");
        }

        const normalizedKey = normalizeEventKeyForShortcut(event);
        if (
          normalizedKey &&
          !["CTRL", "CMD", "ALT", "SHIFT"].includes(normalizedKey)
        ) {
          parts.push(normalizedKey);
        }

        return normalizeShortcutToken(parts.join("+"));
      };

      const shortcutFieldMatchesEvent = (fieldId, event) => {
        const eventToken = getEventShortcutToken(event);
        if (!eventToken) {
          return false;
        }

        const configuredTokens = getShortcutTokensForField(fieldId);
        if (!configuredTokens.length) {
          return false;
        }

        return configuredTokens.includes(eventToken);
      };

      const shouldSuppressAllAppShortcuts = (event) => {
        const activeEl = document.activeElement;
        if (!activeEl) {
          return false;
        }

        const tagName = activeEl.tagName;
        const inputType = (activeEl.type || "").toLowerCase();

        const isTypingField =
          activeEl.isContentEditable ||
          tagName === "TEXTAREA" ||
          tagName === "SELECT" ||
          (tagName === "INPUT" &&
            ![
              "button",
              "checkbox",
              "color",
              "file",
              "hidden",
              "image",
              "radio",
              "range",
              "reset",
              "submit",
            ].includes(inputType));

        const isInsideCustomShieldPicker =
          !!activeEl.closest?.(".shieldPicker") ||
          !!document.querySelector(".shieldPicker.open");

        if (!isTypingField && !isInsideCustomShieldPicker) {
          return false;
        }

        const eventToken = event ? getEventShortcutToken(event) : "";
        const isEscape = eventToken === "ESC";
        const isUndo =
          eventToken === normalizeShortcutToken("CTRL+Z") ||
          eventToken === normalizeShortcutToken("CMD+Z");
        const isRedo =
          eventToken === normalizeShortcutToken("CTRL+SHIFT+Z") ||
          eventToken === normalizeShortcutToken("CMD+SHIFT+Z") ||
          eventToken === normalizeShortcutToken("CTRL+Y") ||
          eventToken === normalizeShortcutToken("CMD+Y");

        return !(isEscape || isUndo || isRedo);
      };

      const closeCurrentSidebarMenu = () => {
        if (!sMConfigBar) {
          return;
        }

        sMConfigBar.dataset.currentMenu = "";
        reDisplay();
      };

      const openConfigMenuById = (menuId) => {
        if (!sMConfigBar) {
          return;
        }

        sMConfigBar.dataset.currentMenu = menuId || "";
        reDisplay();
      };

      const toggleConfigMenuById = (menuId) => {
        if (!sMConfigBar) {
          return;
        }

        if (sMConfigBar.dataset.currentMenu === menuId) {
          sMConfigBar.dataset.currentMenu = "";
        } else {
          sMConfigBar.dataset.currentMenu = menuId;
        }

        reDisplay();
      };
      
      const closeTopmostUI = () => {
        const downloadDialog = document.getElementById("downloadContent");
        const welcomeDialog = document.getElementById("welcomeToSignMaker");
        const shieldDialog = document.getElementById("shieldImgSelector");
        const iconDialog = document.getElementById("iconSelectorModal");
        const tollDialog = document.getElementById("tollLogoSelectorModal");
        const arrowDialog = document.getElementById("arrowSelectorModal");

        if (signMakerSettingsModal && signMakerSettingsModal.classList.contains("open")) {
          closeSettings();
          return true;
        }

          if (
            downloadDialog &&
            downloadDialog.style.display !== "none" &&
            downloadDialog.style.display !== ""
          ) {
            downloadDialog.style.display = "none";
            const modalHolder = document.getElementById("modalHolder");
            if (modalHolder) {
              modalHolder.style.display = "none";
            }
            return true;
          }

        if (welcomeDialog && welcomeDialog.open) {
          welcomeDialog.close();
          return true;
        }

        if (shieldDialog && shieldDialog.open) {
          shieldDialog.close();
          return true;
        }

        if (iconDialog && iconDialog.open) {
          iconDialog.close();
          return true;
        }

        if (tollDialog && tollDialog.open) {
          tollDialog.close();
          return true;
        }

        if (arrowDialog && arrowDialog.open) {
          arrowDialog.close();
          return true;
        }

        if (sMConfigBar && sMConfigBar.dataset.currentMenu) {
          closeCurrentSidebarMenu();
          return true;
        }

        return false;
      };
      
      const isDownloadMenuOpen = () =>
        !!downloadDialog &&
        downloadDialog.style.display !== "" &&
        downloadDialog.style.display !== "none";

      const isShortcutBlockingOverlayOpen = () =>
        isSettingsOpen() || isDownloadMenuOpen();

      const ensureSubpanelMenuOpen = () => {
        if (!sMConfigBar) {
          return;
        }

        if (sMConfigBar.dataset.currentMenu !== "subPanelConfig") {
          sMConfigBar.dataset.currentMenu = "subPanelConfig";
          reDisplay();
        }
      };

      const ensureExitTabMenuOpen = () => {
        if (!sMConfigBar) {
          return;
        }

        if (sMConfigBar.dataset.currentMenu !== "exitTabConfig") {
          sMConfigBar.dataset.currentMenu = "exitTabConfig";
          reDisplay();
        }
      };

      const getPreferredGuideArrowMenuMode = () => {
        syncPostReference();

        const panel = post?.panels?.[exposed?.vars?.currentlySelectedPanelIndex];
        const sign = panel?.sign;

        if (!sign) {
          return "standard";
        }

        const hasAPLArrows =
          Array.isArray(sign.aplArrows) && sign.aplArrows.length > 0;

        const hasStandardArrows =
          String(sign.guideArrow || "None") !== "None";

        if (sign.arrowMode === "apl" && hasAPLArrows) {
          return "apl";
        }

        if (sign.arrowMode === "standard" || hasStandardArrows) {
          return "standard";
        }

        return hasAPLArrows ? "apl" : "standard";
      };

      const ensureGuideArrowMenuOpen = (mode = null) => {
        if (!sMConfigBar) {
          return;
        }

        const resolvedMode = mode || getPreferredGuideArrowMenuMode();

        if (sMConfigBar.dataset.currentMenu !== "guideArrowConfig") {
          sMConfigBar.dataset.currentMenu = "guideArrowConfig";
          reDisplay();
        }

        const targetTab =
          resolvedMode === "apl"
            ? '.guideArrowConfig .sMModalTab[data-tab="sMAPL"]'
            : '.guideArrowConfig .sMModalTab[data-tab="sMGuideArrowSetting"]';

        const tabButton = document.querySelector(targetTab);

        if (tabButton) {
          tabButton.click();
        }
      };

      ensureSubpanelMenuOpenPublic = ensureSubpanelMenuOpen;
      ensureExitTabMenuOpenPublic = ensureExitTabMenuOpen;
      ensureGuideArrowMenuOpenPublic = ensureGuideArrowMenuOpen;

      const showShortcutNotice = (message) => {
        if (!message) {
          return;
        }

        let notice = document.getElementById("shortcutActionNotice");

        if (!notice) {
          notice = document.createElement("div");
          notice.id = "shortcutActionNotice";
          notice.style.position = "fixed";
          notice.style.top = "1rem";
          notice.style.left = "50%";
          notice.style.transform = "translateX(-50%)";
          notice.style.zIndex = "5000";
          notice.style.padding = "0.4rem 0.8rem";
          notice.style.background = "rgba(0, 0, 0, 0.75)";
          notice.style.color = "#fff";
          notice.style.borderRadius = "0.35rem";
          notice.style.fontFamily = "Inter, sans-serif";
          notice.style.fontSize = "0.95rem";
          notice.style.opacity = "0";
          notice.style.pointerEvents = "none";
          notice.style.transition = "opacity 0.2s ease";
          document.body.appendChild(notice);
        }

        notice.textContent = message;
        notice.style.opacity = "1";

        clearTimeout(notice._hideTimer);
        notice._hideTimer = setTimeout(() => {
          notice.style.opacity = "0";
        }, 900);
      };

      const secondaryShortcutActions = [
        {
          fieldId: "settingsControlCloseMenu",
          run: () => {
            closeTopmostUI();
          },
        },
        {
          fieldId: "settingsControlShowHideMenus",
          run: () => {
            const hideConfigButton = document.getElementById("hideConfig");
            if (hideConfigButton) {
              hideConfigButton.click();
            }
          },
        },
        {
          fieldId: "settingsControlUndoEdit",
          run: () => {
            if (typeof app !== "undefined" && typeof app.undo === "function") {
              app.undo();
            } else if (exposed && typeof exposed.undo === "function") {
              exposed.undo();
            }
          },
        },
        {
          fieldId: "settingsControlRedoEdit",
          run: () => {
            if (typeof app !== "undefined" && typeof app.redo === "function") {
              app.redo();
            } else if (exposed && typeof exposed.redo === "function") {
              exposed.redo();
            }
          },
        },
        {
          fieldId: "settingsControlClearAll",
          run: () => {
            if (typeof app !== "undefined" && typeof app.clearAll === "function") {
              app.clearAll();
            } else if (exposed && typeof exposed.clearAll === "function") {
              exposed.clearAll();
            }
          },
        },
        {
          fieldId: "settingsControlPostSettings",
          run: () => toggleConfigMenuById("postConfig"),
        },
        {
          fieldId: "settingsControlPanelMenu",
          run: () => toggleConfigMenuById("panelSelector"),
        },
        {
          fieldId: "settingsControlPanelStyle",
          run: () => toggleConfigMenuById("panelStyleConfig"),
        },
        {
          fieldId: "settingsControlExitTabs",
          run: () => toggleConfigMenuById("exitTabConfig"),
        },
        {
          fieldId: "settingsControlSubpanels",
          run: () => toggleConfigMenuById("subPanelConfig"),
        },
        {
          fieldId: "settingsControlGuideArrows",
          run: () => ensureGuideArrowMenuOpen(),
        },
        {
          fieldId: "settingsControlTemplates",
          run: () => toggleConfigMenuById("templates"),
        },
        {
          fieldId: "settingsControlDownload",
          run: () => {
            const downloadButton = document.getElementById("export");
            if (downloadButton) {
              downloadButton.click();
            }
          },
        },
        {
          fieldId: "settingsControlDarkMode",
          run: () => {
            const darkModeButton = document.getElementById("nightMode");
            if (darkModeButton) {
              darkModeButton.click();
            }
          },
        },
        {
          fieldId: "settingsControlZoomIn",
          run: () => {
            const nextScale = zoomInterfaceIn();
            showShortcutNotice(`UI Scale: ${nextScale}%`);
          },
        },
        {
          fieldId: "settingsControlZoomOut",
          run: () => {
            const nextScale = zoomInterfaceOut();
            showShortcutNotice(`UI Scale: ${nextScale}%`);
          },
        },
      ];

      const firstColumnShortcutActions = [
        {
          fieldId: "settingsControlNewPanel",
          run: () => {
            if (typeof app !== "undefined" && typeof app.createPanelRightOfSelected === "function") {
              app.createPanelRightOfSelected();
              showShortcutNotice(`Selected: Panel ${exposed.vars.currentlySelectedPanelIndex + 1}`);
            }
          },
        },
        {
          fieldId: "settingsControlNewPanelLeft",
          run: () => {
            if (typeof app !== "undefined" && typeof app.createPanelLeftOfSelected === "function") {
              app.createPanelLeftOfSelected();
              showShortcutNotice(`Selected: Panel ${exposed.vars.currentlySelectedPanelIndex + 1}`);
            }
          },
        },
        {
          fieldId: "settingsControlNewSubpanel",
          run: () => {
            ensureSubpanelMenuOpen();
            if (typeof app !== "undefined" && typeof app.createSubPanelRightOfSelected === "function") {
              app.createSubPanelRightOfSelected();
              showShortcutNotice(`Selected: Subpanel ${exposed.vars.currentlySelectedSubPanelIndex + 1}`);
            }
          },
        },
        {
          fieldId: "settingsControlNewSubpanelLeft",
          run: () => {
            ensureSubpanelMenuOpen();
            if (typeof app !== "undefined" && typeof app.createSubPanelLeftOfSelected === "function") {
              app.createSubPanelLeftOfSelected();
              showShortcutNotice(`Selected: Subpanel ${exposed.vars.currentlySelectedSubPanelIndex + 1}`);
            }
          },
        },
        {
          fieldId: "settingsControlNewRow",
          run: () => {
            ensureSubpanelMenuOpen();
            if (typeof app !== "undefined" && typeof app.createRowBelowSelected === "function") {
              app.createRowBelowSelected();
              showShortcutNotice(`Selected: Row ${exposed.vars.currentlySelectedRowIndex + 1}`);
            }
          },
        },
        {
          fieldId: "settingsControlNewRowTop",
          run: () => {
            ensureSubpanelMenuOpen();
            if (typeof app !== "undefined" && typeof app.createRowAboveSelected === "function") {
              app.createRowAboveSelected();
              showShortcutNotice(`Selected: Row ${exposed.vars.currentlySelectedRowIndex + 1}`);
            }
          },
        },
        {
          fieldId: "settingsControlNextPanel",
          run: () => {
            if (typeof app !== "undefined" && typeof app.selectNextPanel === "function") {
              app.selectNextPanel();
              showShortcutNotice(`Selected: Panel ${exposed.vars.currentlySelectedPanelIndex + 1}`);
            }
          },
        },
        {
          fieldId: "settingsControlPreviousPanel",
          run: () => {
            if (typeof app !== "undefined" && typeof app.selectPreviousPanel === "function") {
              app.selectPreviousPanel();
              showShortcutNotice(`Selected: Panel ${exposed.vars.currentlySelectedPanelIndex + 1}`);
            }
          },
        },
        {
          fieldId: "settingsControlNextSubpanel",
          run: () => {
            ensureSubpanelMenuOpen();
            if (typeof app !== "undefined" && typeof app.selectNextSubPanel === "function") {
              app.selectNextSubPanel();
              showShortcutNotice(`Selected: Subpanel ${exposed.vars.currentlySelectedSubPanelIndex + 1}`);
            }
          },
        },
        {
          fieldId: "settingsControlPreviousSubpanel",
          run: () => {
            ensureSubpanelMenuOpen();
            if (typeof app !== "undefined" && typeof app.selectPreviousSubPanel === "function") {
              app.selectPreviousSubPanel();
              showShortcutNotice(`Selected: Subpanel ${exposed.vars.currentlySelectedSubPanelIndex + 1}`);
            }
          },
        },
        {
          fieldId: "settingsControlNextRow",
          run: () => {
            ensureSubpanelMenuOpen();
            if (typeof app !== "undefined" && typeof app.selectNextRow === "function") {
              app.selectNextRow();
              showShortcutNotice(`Selected: Row ${exposed.vars.currentlySelectedRowIndex + 1}`);
            }
          },
        },
        {
          fieldId: "settingsControlPreviousRow",
          run: () => {
            ensureSubpanelMenuOpen();
            if (typeof app !== "undefined" && typeof app.selectPreviousRow === "function") {
              app.selectPreviousRow();
              showShortcutNotice(`Selected: Row ${exposed.vars.currentlySelectedRowIndex + 1}`);
            }
          },
        },
        {
          fieldId: "settingsControlDeletePanel",
          run: () => {
            if (typeof app !== "undefined" && typeof app.deleteCurrentPanelShortcut === "function") {
              const deletedIndex = app.deleteCurrentPanelShortcut();
              if (deletedIndex !== null && deletedIndex !== undefined) {
                showShortcutNotice(`Deleted Panel ${deletedIndex + 1}`);
              }
            }
          },
        },
        {
          fieldId: "settingsControlDeleteSubpanel",
          run: () => {
            ensureSubpanelMenuOpen();
            if (typeof app !== "undefined" && typeof app.deleteCurrentSubPanelShortcut === "function") {
              const deletedIndex = app.deleteCurrentSubPanelShortcut();
              if (deletedIndex !== null && deletedIndex !== undefined) {
                showShortcutNotice(`Deleted Subpanel ${deletedIndex + 1}`);
              }
            }
          },
        },
        {
          fieldId: "settingsControlDeleteRow",
          run: () => {
            ensureSubpanelMenuOpen();
            if (typeof app !== "undefined" && typeof app.deleteCurrentRowShortcut === "function") {
              const deletedIndex = app.deleteCurrentRowShortcut();
              if (deletedIndex !== null && deletedIndex !== undefined) {
                showShortcutNotice(`Deleted Row ${deletedIndex + 1}`);
              }
            }
          },
        },
      ];

      document.addEventListener("keydown", (event) => {
        if (event.defaultPrevented) {
          return;
        }

        if (event.key !== "Escape" && isShortcutBlockingOverlayOpen()) {
          return;
        }

        if (shouldSuppressAllAppShortcuts(event)) {
          return;
        }

        const allShortcutActions = [
          ...firstColumnShortcutActions,
          ...secondaryShortcutActions,
        ];

        for (const action of allShortcutActions) {
          if (!shortcutFieldMatchesEvent(action.fieldId, event)) {
            continue;
          }

          event.preventDefault();
          event.stopPropagation();
          action.run();
          return;
        }
      });

    for (const button of document.querySelectorAll(".sMModalTab")) {
      button.onclick = function () {
          if (!button.dataset.tab) {
            return;
          }

          if (button.dataset.tab === "sMAPL") {
            const panel = post?.panels?.[exposed.vars.currentlySelectedPanelIndex];
            const subPanelCount = panel?.sign?.subPanels?.length || 0;

            if (subPanelCount <= 1) {
              const promptOverlay = document.createElement("div");
              promptOverlay.className = "aplSubpanelPromptOverlay";
              promptOverlay.innerHTML = `
                <div class="aplSubpanelPrompt">
                  <h3>APL arrows need at least two subpanels.</h3>
                  <p>Add a new subpanel before opening the APL arrows menu?</p>
                  <div class="aplSubpanelPromptActions">
                    <button type="button" data-apl-subpanel-choice="left">Add to left</button>
                    <button type="button" data-apl-subpanel-choice="right">Add to right</button>
                    <button type="button" data-apl-subpanel-choice="cancel">Cancel</button>
                  </div>
                </div>
              `;

              document.body.appendChild(promptOverlay);

              promptOverlay.addEventListener("click", (event) => {
                const choiceButton = event.target.closest("[data-apl-subpanel-choice]");
                if (!choiceButton) {
                  return;
                }

                const choice = choiceButton.dataset.aplSubpanelChoice;
                promptOverlay.remove();

                if (choice === "left") {
                  exposed.addAPLSubPanelLeftAndOpen();
                } else if (choice === "right") {
                  exposed.addAPLSubPanelRightAndOpen();
                } else {
                  return;
                }

                const aplTabButton = document.querySelector(
                  '.guideArrowConfig .sMModalTab[data-tab="sMAPL"]'
                );

                if (aplTabButton) {
                  setTimeout(() => aplTabButton.click(), 0);
                }
              });

              return;
            }

              if (
                exposed &&
                typeof exposed.initializeAPLArrowsForCurrentPanel === "function"
              ) {
                const guideArrowSelect = document.getElementById("guideArrow");
                if (guideArrowSelect) {
                  guideArrowSelect.value = "None";
                }

                exposed.initializeAPLArrowsForCurrentPanel();
              }
          }
          
          if (button.dataset.tab === "sMGuideArrowSetting") {
            if (
              exposed &&
              typeof exposed.setCurrentPanelArrowMode === "function"
            ) {
              exposed.setCurrentPanelArrowMode("standard");
            }
          }

          const modal = document.querySelectorAll(
            '.sMModal:has(.sMModalTab[data-tab="' + button.dataset.tab + '"]'
          )[0];

        if (modal.dataset.currentMenu != button.dataset.tab) {
          modal.dataset.currentMenu = button.dataset.tab;
        }

        for (const holder of modal.querySelectorAll(".sMModalContent > *")) {
          if (holder.id != modal.dataset.currentMenu) {
            holder.classList.add("tabHidden");
          } else {
            holder.classList.remove("tabHidden");
          }
        }

        for (const btn of modal.querySelectorAll(".sMModalTab")) {
          if (btn.dataset.tab == button.dataset.tab) {
            btn.className = "sMModalTab selected";
          } else {
            btn.className = "sMModalTab";
          }
        }

        // Refresh templates list when Saved tab is opened
        if (button.dataset.tab === "sMTemplatesSaved" && typeof app !== "undefined" && typeof app.refreshTemplatesList === "function") {
          app.refreshTemplatesList();
        }
      };
    }
      
      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") {
          return;
        }

        const settingsModal = document.getElementById("signMakerSettingsModal");

        if (settingsModal && settingsModal.classList.contains("open")) {
          const activeEl = document.activeElement;
          const activeIsControlsShortcut =
            activeEl &&
            activeEl.matches &&
            activeEl.matches('#settingsControls input[type="text"]');

          if (activeIsControlsShortcut) {
            event.preventDefault();
            event.stopPropagation();
            activeEl.blur();
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          settingsModal.classList.remove("open");
          return;
        }

        const openDialogs = [
          document.getElementById("downloadContent"),
          document.getElementById("welcomeToSignMaker"),
          document.getElementById("shieldImgSelector"),
          document.getElementById("customShieldMaker"),
        ].filter((dialog) => dialog && dialog.open);

        if (!openDialogs.length) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        openDialogs[openDialogs.length - 1].close();
      });

    document.querySelector("#panelSelector").onclick = function () {
      if (sMConfigBar.dataset.currentMenu == this.id) {
        sMConfigBar.dataset.currentMenu = "";
      } else {
        sMConfigBar.dataset.currentMenu = this.id;
      }

      reDisplay();
    };

    document.getElementsByName("signMaker")[0].onsubmit = function (e) {
      e.preventDefault();
        applyEditorInputBehavior(document);
    };
    
    document.addEventListener(
      "change",
      (event) => {
        if (event.target && event.target.id === "exitFont") {
          exitTabFontCheckboxChangedByUser = true;
        }
      },
      true
    );

    const registerPanelButton = (selector, actionName) => {
      const button = document.querySelector(selector);
      const action =
        exposed && actionName && typeof exposed[actionName] === "function"
          ? exposed[actionName]
          : null;
      if (!button || !action) {
        return;
      }
      button.type = "button";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        action();
      });
    };

    registerPanelButton("#newPanel", "newPanel");
    registerPanelButton("#duplicatePanel", "duplicatePanel");
    registerPanelButton("#deletePanel", "deletePanel");

    const panelSpacingSlider = document.getElementById("panelSpacing");
    const panelSpacingValueInput =
      document.getElementById("panelSpacingValue");

    const syncPanelSpacingInputs = (value) => {
      if (panelSpacingSlider) {
        panelSpacingSlider.value = value;
      }
      if (panelSpacingValueInput) {
        panelSpacingValueInput.value = value;
      }
    };

    const commitPanelSpacingChange = (value) => {
      const parsedValue = parseFloat(value);
      const normalized =
        Number.isFinite(parsedValue) && parsedValue >= 0
          ? Math.min(parsedValue, 8)
          : 4;
      syncPanelSpacingInputs(normalized);
      if (exposed && typeof exposed.setPanelSpacing === "function") {
        exposed.setPanelSpacing(normalized);
      } else if (post) {
        post.panelSpacing = normalized;
        if (exposed && typeof exposed.redraw === "function") {
          exposed.redraw();
        }
      }
    };

    if (panelSpacingSlider) {
      panelSpacingSlider.addEventListener("input", () => {
        if (panelSpacingValueInput) {
          panelSpacingValueInput.value = panelSpacingSlider.value;
        }
      });
      panelSpacingSlider.addEventListener("change", () => {
        commitPanelSpacingChange(panelSpacingSlider.value);
      });
    }

    if (panelSpacingValueInput) {
      panelSpacingValueInput.addEventListener("input", () => {
        if (panelSpacingSlider) {
          panelSpacingSlider.value = panelSpacingValueInput.value;
        }
      });
      panelSpacingValueInput.addEventListener("change", () => {
        commitPanelSpacingChange(panelSpacingValueInput.value);
      });
    }

    const postThicknessValueInput =
      document.getElementById("postThicknessValue");

    const commitPostThicknessChange = (value) => {
      const normalizedThickness =
        post && typeof post.normalizeThickness === "function"
          ? post.normalizeThickness(value)
          : normalizeStoredPostThickness(value);
      if (post) {
        post.thickness = normalizedThickness;
      }
      if (postThicknessValueInput) {
        postThicknessValueInput.value = normalizedThickness;
      }
      setStoredItem(STORAGE_KEYS.postThickness, normalizedThickness);
      if (exposed && typeof exposed.redraw === "function") {
        exposed.redraw();
      }
    };

    if (postThicknessValueInput) {
      postThicknessValueInput.addEventListener("input", () => {
        commitPostThicknessChange(postThicknessValueInput.value);
      });
      postThicknessValueInput.addEventListener("change", () => {
        commitPostThicknessChange(postThicknessValueInput.value);
      });
    }

    document.addEventListener("input", checkForLimonEasterEgg, true);

      document.getElementById("cancelDownload").onclick = function (event) {
        event.preventDefault();
        const dialog = document.querySelector("#downloadContent");
        if (dialog && dialog.open) {
          dialog.close();
        }
      };
      
    document.getElementById("hideConfig").onclick = function () {
          if (sMConfigBar.classList.contains("invisible")) {
            sMConfigBar.classList.remove("invisible");
          } else {
            sMConfigBar.classList.add("invisible");
          }
          updateUtilityButtonLabels();
    };
    
      const closeWelcomeButton = document.querySelector("#closeWelcome");
      if (closeWelcomeButton) {
        closeWelcomeButton.onclick = function () {
          const modalHolder = document.querySelector("#modalHolder");
          const welcomeDialog = document.querySelector("#welcomeToSignMaker");

          localStorage.setItem("closedWelcome", "true");

          if (welcomeDialog && typeof welcomeDialog.close === "function") {
            try {
              welcomeDialog.close();
            } catch (error) {}
          }

          if (welcomeDialog) {
            welcomeDialog.style.display = "none";
          }

          if (modalHolder) {
            modalHolder.style.display = "none";
          }
        };
      }

    newRowDropTargetButton = document.getElementById("sMSPCreateRow");
    if (newRowDropTargetButton) {
      newRowDropTargetButton.addEventListener("dragenter", handleNewRowDragEnter);
      newRowDropTargetButton.addEventListener("dragover", handleNewRowDragOver);
      newRowDropTargetButton.addEventListener("dragleave", handleNewRowDragLeave);
      newRowDropTargetButton.addEventListener("drop", handleNewRowDrop);
    }

    const toolTip = document.createElement("span");
    toolTip.className = "toolTip";
    toolTip.style.opacity = 0;
    document.body.appendChild(toolTip);
    for (const element of document.querySelectorAll("[data-toolTip]")) {
      element.addEventListener("mouseover", () => {
        const boundingRect = element.getBoundingClientRect();
        toolTip.textContent = element.dataset.tooltip;
        toolTip.style.left =
          boundingRect.left +
          (boundingRect.right - boundingRect.left) / 2 +
          "px";
        toolTip.style.top = boundingRect.top - toolTip.offsetHeight - 10 + "px";
        toolTip.style.opacity = 1;
        toolTip.style.transform = "translateX(-50%)";

        if (sMConfigBar.contains(element)) {
          toolTip.style.fontFamily = "Overpass";
        } else {
          toolTip.style.fontFamily = "Inter";
        }
      });

      element.addEventListener("mouseout", () => {
        toolTip.style.opacity = 0;
        toolTip.style.left = "-100px";
        toolTip.style.top = 0;
        toolTip.textContent = "";
        toolTip.style.transform = "";
      });
    }

    if (nightModeButton) {
      nightModeButton.addEventListener("click", () => {
        toggleInterfaceThemeMode();
        updateUtilityButtonLabels();
      });
    }

    document
      .querySelector("#smSPShieldAdvanced")
      .addEventListener("click", () => {
        if (
          document.querySelector("#advancedMenu").classList.contains("hidden")
        ) {
          document.querySelector("#advancedMenu").classList.remove("hidden");
        } else {
          document.querySelector("#advancedMenu").classList.add("hidden");
        }
      });

    const horizontalScrollOnWheel = document.querySelectorAll(
      ".horizontal-scroll-on-wheel"
    );
    horizontalScrollOnWheel.forEach((scrollableElement) => {
      scrollableElement.addEventListener("wheel", (event) => {
        if (scrollCooldown) {
          return;
        }

        event.preventDefault();
        // Smoothly increase scrollableElement.scrollLeft by event.deltaY;
        scrollableElement.scrollBy({
          left: event.deltaY,
          behavior: "smooth",
        });
      });
    });

      const welcomeDialog = document.querySelector("#welcomeToSignMaker");
      if (!localStorage.getItem("closedWelcome") && welcomeDialog) {
        const modalHolder = document.querySelector("#modalHolder");

        if (modalHolder) {
          modalHolder.style.display = "flex";
        }

        welcomeDialog.style.display = "flex";
      }

    // Populate post kind options
    const postPositionSelectElmt = document.getElementById("postPosition");
    for (const polePosition of Post.prototype.polePositions) {
      const displayLabel = formatPostKindLabel(polePosition);
      lib.appendOption(postPositionSelectElmt, polePosition, {
        selected: polePosition == post.polePosition,
        text: displayLabel,
      });
    }

    const postColorSelectElmt = document.getElementById("postColor");
    if (postColorSelectElmt) {
      for (const colorOption of Post.prototype.colors) {
        lib.appendOption(postColorSelectElmt, colorOption, {
          selected: colorOption === post.color,
        });
      }
    }

    // Populate color options
    const colorSelectElmt = document.getElementById("panelColor");
    for (const color in lib.colors) {
      lib.appendOption(colorSelectElmt, color, {
        text: color,
      });
    }

    const cornerTypeSelectElmt = document.getElementById("panelCorner");
    for (const corner of Panel.prototype.cornerType) {
      lib.appendOption(cornerTypeSelectElmt, corner, {
        selected: corner == "Sharp",
      });
    }

    // Populate exit tab position options
    const exitTabPositionSelectElmt =
      document.getElementById("exitTabPosition");
    for (const position of ExitTab.prototype.positions) {
      lib.appendOption(exitTabPositionSelectElmt, position, {
        selected: position == "Right",
      });
    }

    // Populate exit tab width options
    const exitTabWidthSelectElmt = document.getElementById("exitTabWidth");
    for (const width of ExitTab.prototype.widths) {
      lib.appendOption(exitTabWidthSelectElmt, width, {
        selected: width == "Full",
      });
    }

    // Populate the exit color options
    const exitColorSelectElement = document.getElementById("exitColor");
    for (const exitColor of ExitTab.prototype.colors) {
      lib.appendOption(exitColorSelectElement, exitColor);
    }

    // Populate the exit variants
    const exitVariantSelectElmt = document.getElementById("exitVariant");
    for (const exitVariant of ExitTab.prototype.variants) {
      lib.appendOption(exitVariantSelectElmt, exitVariant);
    }
    if (exitVariantSelectElmt) {
      exitVariantSelectElmt.addEventListener("change", (event) => {
        toggleExitTabVariantOptionsVisibility(event.target.value);
      });
      toggleExitTabVariantOptionsVisibility(exitVariantSelectElmt.value);
    }

    const exitTollLogoSelectElmt =
      document.getElementById("exitTollLogoSelect");
    if (exitTollLogoSelectElmt) {
      for (const [logoKey, logoDef] of Object.entries(
        TollLogoElement.prototype.logos
      )) {
        lib.appendOption(exitTollLogoSelectElmt, logoKey, {
          text: logoDef.label,
          selected: logoKey == TollLogoElement.prototype.defaultLogo,
        });
      }
    }

    // Populate the exit icons
    const iconSelectSelectElmt = document.getElementById("iconSelect");
    if (iconSelectSelectElmt) {
      for (const icons of ExitTab.prototype.icons) {
        lib.appendOption(iconSelectSelectElmt, icons.split(":")[0]);
      }
    }

    // Populate the shield position options
    const shieldPositionsSelectElmt =
      document.getElementById("shieldsPosition");
    for (const position of Sign.prototype.shieldPositions) {
      lib.appendOption(shieldPositionsSelectElmt, position, {
        selected: position == "Above",
      });
    }

    // Populate global positioning
    const globalPosition = document.getElementById("globalPosition");
    for (const position of Sign.prototype.globalPositioning) {
      lib.appendOption(globalPosition, position, {
        selected: position == "Top",
      });
    }

    // Populate the element list
    const sMSPElementSelect = document.getElementById("sMSPElementSelect");
    for (const element in Control.prototype.blockElements) {
        lib.appendOption(sMSPElementSelect, element, {
            selected: element == "ControlTextElement",
            text: Control.prototype.blockElements[element],
        });
    }
    

    // Populate the guide arrow options
    const guideArrowSelectElmt = document.getElementById("guideArrow");
    for (const guideArrow of Sign.prototype.guideArrows) {
      const display = guideArrow.split(":")[0];

      lib.appendOption(guideArrowSelectElmt, display);
    }

    // Populate the exit only guide arrow options
    const exitOnlyDirectionElmt = document.getElementById("exitOnlyDirection");
    for (const exitguideArrows of Sign.prototype.exitguideArrows) {
      const display = exitguideArrows.split(":")[0];

      lib.appendOption(exitOnlyDirectionElmt, display);
    }

    // exit-only labels
    // Populate the arrow directions
    const arrowDirectionElmt = document.getElementById("arrowLocations");
    for (const arrowDirection of Sign.prototype.arrowPositions) {
      lib.appendOption(arrowDirectionElmt, arrowDirection);
    }

    // Populate the other symbol options
    const otherSymbolSelectElement = document.getElementById("otherSymbol");
    for (const otherSymbol of Sign.prototype.otherSymbols) {
      lib.appendOption(otherSymbolSelectElement, otherSymbol);
    }

    // Control Signs Revision
    let textElem_fontFamilySelects = [
      document.querySelector("#sdCtrlText_fontFamily"),
      document.querySelector("#sdAdvisory_fontFamily"),
      document.querySelector("#sdActionMessage_fontFamily"),
    ];
    let textElem_alignmentSelects = [
      document.querySelector("#sdCtrlText_alignment"),
      document.querySelector("#sdAdvisory_alignment"),
      document.querySelector("#sdActionMessage_alignment"),
      document.querySelector("#sdBlocker_alignment"),
      document.querySelector("#sdElectronicSign_alignment"),
      document.querySelector("#sdTollLogo_alignment"),
      document.querySelector("#sdBeacon_alignment"),
      document.querySelector("#sdIcon_alignment"),
      document.querySelector("#sdShield_alignment"),
      document.querySelector("#sdArrow_alignment"),
    ];
    let textElem_bgColorSelects = [
      document.querySelector("#sdCtrlText_backgroundColor"),
      document.querySelector("#sdAdvisory_backgroundColor"),
      document.querySelector("#sdActionMessage_backgroundColor"),
      document.querySelector("#sdIcon_borderColor"),
      document.querySelector("#sdIcon_backgroundColor"),
      document.querySelector("#sdBlock_backgroundColor"),
      document.querySelector("#sdTollLogo_backgroundColor"),
    ];
    let divider_widthMeasurement = document.querySelector(
      "#sdBlocker_dividerMeasurement"
    );
    let divider_orientationSelect = document.querySelector(
      "#sdBlocker_orientation"
    );
    let divider_colorSelect = document.querySelector("#sdBlocker_dividerColor");
    let shield_shieldBase = document.querySelector("#sdShield_shieldBase");
    let iconElem_iconsSelect = document.querySelector("#sdIcon_icon");
    const beaconColorSelect = document.querySelector("#sdBeacon_color");
    const controlTextColorSelect = document.querySelector(
      "#sdCtrlText_textColor"
    );
    const blockBorderColorSelect = document.querySelector(
      "#sdBlock_borderColor"
    );

    for (const elem of textElem_fontFamilySelects) {
      for (const fontFamily of TextElement.prototype.fontFamily) {
        lib.appendOption(elem, fontFamily);
      }
    }

    if (beaconColorSelect) {
      for (const color of BeaconElement.prototype.colors) {
        lib.appendOption(beaconColorSelect, color);
      }
    }

    if (controlTextColorSelect) {
      const textColorOptions = ControlTextElement.getTextColorOptions();
      for (const optionValue of textColorOptions) {
        if (optionValue) {
          lib.appendOption(controlTextColorSelect, optionValue);
        }
      }
      const defaultTextColor =
        ControlTextElement.defaultTextColor ||
        (textColorOptions.length ? textColorOptions[0] : "");
      if (defaultTextColor) {
        controlTextColorSelect.value = defaultTextColor;
      }
    }

    if (blockBorderColorSelect) {
      const defaultBorderColor = Block.defaultBorderColor || "Match BG";
      const borderColorOptions = [defaultBorderColor].concat(
        Object.keys(lib.colors || {})
      );
      const seenBorderColors = new Set();
      for (const optionValue of borderColorOptions) {
        if (!optionValue || seenBorderColors.has(optionValue)) {
          continue;
        }
        lib.appendOption(blockBorderColorSelect, optionValue);
        seenBorderColors.add(optionValue);
      }
      blockBorderColorSelect.value = defaultBorderColor;
    }

    const controlTextFontSelect = document.querySelector(
      "#sdCtrlText_fontFamily"
    );
    if (controlTextFontSelect) {
      let defaultControlFont = null;
      defaultControlFont = ControlTextElement.getDefaultFont();
      if (defaultControlFont) {
        controlTextFontSelect.value = defaultControlFont;
      }

      controlTextFontSelect.addEventListener("change", () => {
        const selectedFont = controlTextFontSelect.value;
        const availableFonts = TextElement.prototype.fontFamily;
        if (!selectedFont || !availableFonts.includes(selectedFont)) {
          return;
        }
        ControlTextElement.setDefaultFont(selectedFont);
        setStoredItem(STORAGE_KEYS.controlTextFont, selectedFont);
      });
    }
    

      const clampPercentValue = (value, inputEl) => {
        const parsed = parseFloat(value);
        const min = inputEl && inputEl.min !== "" ? parseFloat(inputEl.min) : 0;
        const max = inputEl && inputEl.max !== "" ? parseFloat(inputEl.max) : 300;

        if (!Number.isFinite(parsed)) {
          return min;
        }

        return Math.max(min, Math.min(max, parsed));
      };

      const syncPercentValueDisplay = (inputId) => {
        const inputEl = document.getElementById(inputId);
        const valueEl = document.getElementById(inputId + "Val");

        if (!inputEl || !valueEl) {
          return;
        }

        if (valueEl.tagName === "INPUT") {
          valueEl.value = inputEl.value;
        } else {
          valueEl.textContent = `${inputEl.value}%`;
        }
      };
      
      const settingsDefaultsFontFamilyIds = [
        "settingsDefaultsControlTextFontFamily",
        "settingsDefaultsAdvisoryFontFamily",
        "settingsDefaultsActionFontFamily",
      ];

      const settingsDefaultsFontIds = {
        settingsDefaultsControlTextFontFamily: "settingsDefaultsControlTextFont",
        settingsDefaultsAdvisoryFontFamily: "settingsDefaultsAdvisoryFont",
        settingsDefaultsActionFontFamily: "settingsDefaultsActionFont",
      };

      const clearviewFonts = TextElement.prototype.fontFamily.filter((font) =>
        /^Clearview/i.test(font)
      );

      const highwayGothicFonts = TextElement.prototype.fontFamily.filter((font) =>
        /^Series/i.test(font)
      );

      const arialFonts = TextElement.prototype.fontFamily.filter(
        (font) => font === "Arial" || font === "Arial Bold"
      );

      const transportFonts = TextElement.prototype.fontFamily.filter(
        (font) => font === "Transport"
      );

      const din1451Fonts = TextElement.prototype.fontFamily.filter(
        (font) => font === "DIN 1451"
      );

      const rawlinsonFonts = TextElement.prototype.fontFamily.filter((font) =>
        /^Rawlinson/i.test(font)
      );
      
      const itcStoneSansFonts = TextElement.prototype.fontFamily.filter((font) =>
        /^ITC Stone Sans/i.test(font)
      );

      const helveticaNeueFonts = TextElement.prototype.fontFamily.filter((font) =>
        /^Helvetica Neue/i.test(font)
      );

      const settingsDefaultsFontFamilies = {
        Clearview: clearviewFonts,
        "Highway Gothic": highwayGothicFonts,
        Arial: arialFonts,
        Transport: transportFonts,
        "DIN 1451": din1451Fonts,
        Rawlinson: rawlinsonFonts,
        "ITC Stone Sans": itcStoneSansFonts,
        "Helvetica Neue": helveticaNeueFonts,
      };

      const settingsDefaultsFontDefaults = {
        Clearview: clearviewFonts.includes("Clearview 5WR")
          ? "Clearview 5WR"
          : (clearviewFonts[0] || ""),
        "Highway Gothic": highwayGothicFonts.includes("Series EM")
          ? "Series EM"
          : (highwayGothicFonts[0] || ""),
        Arial: arialFonts.includes("Arial")
          ? "Arial"
          : (arialFonts[0] || ""),
        Transport: transportFonts[0] || "",
        "DIN 1451": din1451Fonts[0] || "",
          Rawlinson: rawlinsonFonts.includes("Rawlinson Regular")
            ? "Rawlinson Regular"
            : (rawlinsonFonts[0] || ""),
          "ITC Stone Sans": itcStoneSansFonts.includes("ITC Stone Sans Regular")
            ? "ITC Stone Sans Regular"
            : (itcStoneSansFonts[0] || ""),
          "Helvetica Neue": helveticaNeueFonts.includes("Helvetica Neue Roman")
            ? "Helvetica Neue Roman"
            : (helveticaNeueFonts[0] || ""),
      };
    const settingsDefaultsClearviewFontOrder = [
      "1B",
      "1W",
      "2B",
      "2W",
      "3B",
      "3W",
      "4B",
      "4W",
      "5B",
      "5W",
      "5WR",
      "6B",
      "6W",
    ];

    const settingsDefaultsHighwayGothicFontOrder = [
      "A",
      "B",
      "C",
      "D",
      "E",
      "EEM",
      "EM",
      "F",
    ];

    const settingsDefaultsFontButtonGroupIds = {
      settingsDefaultsControlTextFont: "settingsDefaultsControlTextFontButtons",
      settingsDefaultsAdvisoryFont: "settingsDefaultsAdvisoryFontButtons",
      settingsDefaultsActionFont: "settingsDefaultsActionFontButtons",
    };

    const shouldUseSettingsDefaultsFontButtons = (family) =>
      family === "Clearview" || family === "Highway Gothic";

    const getSettingsDefaultsFontSuffix = (font, family) => {
      if (family === "Clearview") {
        return String(font || "").replace(/^Clearview\s*/i, "").trim();
      }

      if (family === "Highway Gothic") {
        return String(font || "").replace(/^Series\s*/i, "").trim();
      }

      return String(font || "").trim();
    };

    const sortSettingsDefaultsFontsForButtons = (family, fonts) => {
      const order =
        family === "Highway Gothic"
          ? settingsDefaultsHighwayGothicFontOrder
          : settingsDefaultsClearviewFontOrder;

      return [...fonts].sort((a, b) => {
        const aSuffix = getSettingsDefaultsFontSuffix(a, family);
        const bSuffix = getSettingsDefaultsFontSuffix(b, family);

        const aIndex = order.indexOf(aSuffix);
        const bIndex = order.indexOf(bSuffix);

        if (aIndex === -1 && bIndex === -1) {
          return aSuffix.localeCompare(bSuffix, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        }

        if (aIndex === -1) {
          return 1;
        }

        if (bIndex === -1) {
          return -1;
        }

        return aIndex - bIndex;
      });
    };

    const refreshSettingsDefaultsFontButtons = (
      fontId,
      selectedFamily,
      matchingFonts
    ) => {
      const fontSelect = document.getElementById(fontId);
      const buttonGroupId = settingsDefaultsFontButtonGroupIds[fontId];
      const buttonGroup = buttonGroupId
        ? document.getElementById(buttonGroupId)
        : null;

      if (!fontSelect || !buttonGroup) {
        return;
      }

      const shouldShowButtons =
        shouldUseSettingsDefaultsFontButtons(selectedFamily) &&
        Array.isArray(matchingFonts) &&
        matchingFonts.length > 0;

      buttonGroup.hidden = !shouldShowButtons;
      buttonGroup.innerHTML = "";

      if (!shouldShowButtons) {
        return;
      }

      const orderedFonts = sortSettingsDefaultsFontsForButtons(
        selectedFamily,
        matchingFonts
      );

      buttonGroup.style.setProperty(
        "--settingsDefaultsFontButtonCount",
        String(orderedFonts.length || 1)
      );

      for (const font of orderedFonts) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "settingsDefaultsFontButton";
        button.dataset.fontValue = font;
        button.textContent = getSettingsDefaultsFontSuffix(font, selectedFamily);
        button.classList.toggle("active", fontSelect.value === font);

        button.style.fontFamily = `"${font}", sans-serif`;
        button.style.fontSize =
          selectedFamily === "Highway Gothic" ? "0.9rem" : "0.8rem";

        button.addEventListener("click", () => {
          setNativeFontSelectValue(fontSelect, font, { dispatch: true });
          refreshSettingsDefaultsFontButtons(
            fontId,
            selectedFamily,
            matchingFonts
          );
        });

        buttonGroup.appendChild(button);
      }
    };

    const refreshAllSettingsDefaultsFontButtons = () => {
      Object.entries(settingsDefaultsFontIds).forEach(
        ([fontFamilyId, fontId]) => {
          const familySelect = document.getElementById(fontFamilyId);
          const selectedFamily = familySelect?.value || "";
          const matchingFonts =
            settingsDefaultsFontFamilies[selectedFamily] || [];

          refreshSettingsDefaultsFontButtons(
            fontId,
            selectedFamily,
            matchingFonts
          );
        }
      );
    };
      
      const SETTINGS_DEFAULTS_STORAGE_KEY = "signMaker.settingsDefaults";

      const settingsDefaultsFieldDefaults = {
        settingsDefaultsControlTextText: "Control",
        settingsDefaultsControlTextFontFamily: "Clearview",
        settingsDefaultsControlTextFont: "Clearview 5WR",
        settingsDefaultsControlTextSize: "100",
        settingsDefaultsControlTextColor: ControlTextElement.defaultTextColor,
        settingsDefaultsControlTextBg: "Inherit",

        settingsDefaultsShieldType: ShieldElement.prototype.defaultShieldBase,
        settingsDefaultsShieldRouteNumber: "",
        settingsDefaultsShieldSize: "3",
        settingsDefaultsShieldBanner1: "Right",
        settingsDefaultsShieldBanner2: "Above",

        settingsDefaultsAdvisoryText: "Advisory",
        settingsDefaultsAdvisoryFontFamily: "Highway Gothic",
        settingsDefaultsAdvisoryFont: "Series E",
        settingsDefaultsAdvisorySize: "70",
        settingsDefaultsAdvisoryColor: "Black",
        settingsDefaultsAdvisoryBg: "Yellow",

        settingsDefaultsActionText: "Action",
        settingsDefaultsActionFontFamily: "Clearview",
        settingsDefaultsActionFont: "Clearview 5WR",
        settingsDefaultsActionSize: "70",
        settingsDefaultsActionColor: ControlTextElement.defaultTextColor,
        settingsDefaultsActionBg: "Inherit",
        
        settingsDefaultsExitTabText: "",
        settingsDefaultsExitTabType: "Standard",
        settingsDefaultsExitTabAlignment: "Right",
        settingsDefaultsExitTabPosition: "Edge",
        settingsDefaultsExitTabPanelColor: "Panel Color",
        settingsDefaultsExitTabBorderThickness: 0.2,
        settingsDefaultsExitTabMinHeight: 2,
        settingsDefaultsExitTabTextSize: 20,
        settingsDefaultsExitTabNestedSpacing: 0,
        settingsDefaultsExitTabFHWAStyle: false,
        settingsDefaultsExitTabLeft: false,
        settingsDefaultsExitTabFullBorder: false,
        settingsDefaultsExitTabSquareCorners: false,
        settingsDefaultsExitTabTopOffset: false,
        settingsDefaultsExitTabVerticalArrangement: false,
        settingsDefaultsExitTabCAStyle: false,
        
        settingsDefaultsArrowValue: ArrowElement.prototype.defaultArrow,
        settingsDefaultsArrowRotation: "0",
        settingsDefaultsArrowSize: "1.75",
        settingsDefaultsArrowHorizontalPadding: "0",
        settingsDefaultsArrowVerticalPadding: "0",
        settingsDefaultsArrowAlignment: "Center",

        settingsDefaultsIconValue: IconElement.prototype.defaultIcon,
        settingsDefaultsIconSize: "3",
        settingsDefaultsIconBgColor: "Inherit",
        settingsDefaultsIconSpacing: "0",
        settingsDefaultsIconAlignment: "Center",
        settingsDefaultsIconBorder: false,

        settingsDefaultsTollLogoValue: TollLogoElement.prototype.defaultLogo,
        settingsDefaultsTollLogoSize: "3",
        settingsDefaultsTollLogoSpacing: "0",
        settingsDefaultsTollLogoBorderRadius: "0",
        settingsDefaultsTollLogoBgColor: "Inherit",
        settingsDefaultsTollLogoHorizontalBgPadding: "0.2",
        settingsDefaultsTollLogoVerticalBgPadding: "0.05",
        settingsDefaultsTollLogoSquareIcon: false,
        settingsDefaultsTollLogoShowOnlyBlock: false,
      };

      const getStoredSettingsDefaults = () => {
        try {
          const raw = localStorage.getItem(SETTINGS_DEFAULTS_STORAGE_KEY);
          if (!raw) return {};
          const parsed = JSON.parse(raw);
          return parsed && typeof parsed === "object" ? parsed : {};
        } catch (error) {
          return {};
        }
      };

      const setStoredSettingsDefaults = (values) => {
        try {
          localStorage.setItem(
            SETTINGS_DEFAULTS_STORAGE_KEY,
            JSON.stringify(values || {})
          );
        } catch (error) {
          // ignore storage write failures
        }
      };

      const saveSettingsDefaultsField = (id, value) => {
        const stored = getStoredSettingsDefaults();
        stored[id] = value;
        setStoredSettingsDefaults(stored);
      };
      
      const storedSettingsDefaults = getStoredSettingsDefaults();
    
      if (
        !Object.prototype.hasOwnProperty.call(
          storedSettingsDefaults,
          "__blankShieldRouteNumberDefaultMigrated"
        )
      ) {
        if (storedSettingsDefaults.settingsDefaultsShieldRouteNumber === "1") {
          storedSettingsDefaults.settingsDefaultsShieldRouteNumber = "";
        }

        storedSettingsDefaults.__blankShieldRouteNumberDefaultMigrated = true;
        setStoredSettingsDefaults(storedSettingsDefaults);
      }
    
      const getMergedSettingsDefaults = () => ({
        ...settingsDefaultsFieldDefaults,
        ...getStoredSettingsDefaults(),
      });

      const mapSettingsDefaultsExitTabTypeToVariant = (value) => {
        switch (value) {
          case "Standard":
            return "Default";
          case "Full Left":
            return "Full Left";
          case "Toll Pass":
            return "Toll Logo";
          default:
            return "Default";
        }
      };

      const applyExitTabSettingsDefaults = () => {
        const defaults = getMergedSettingsDefaults();

        const parseNumberOrFallback = (value, fallback) => {
          const parsed = typeof value === "number" ? value : parseFloat(value);
          return Number.isFinite(parsed) ? parsed : fallback;
        };

        ExitTab.prototype.defaultText =
          String(defaults.settingsDefaultsExitTabText ?? "");

        ExitTab.prototype.defaultVariant =
          mapSettingsDefaultsExitTabTypeToVariant(
            defaults.settingsDefaultsExitTabType
          );

        ExitTab.prototype.defaultPosition =
          ExitTab.prototype.positions.includes(defaults.settingsDefaultsExitTabAlignment)
            ? defaults.settingsDefaultsExitTabAlignment
            : "Right";

        ExitTab.prototype.defaultWidth =
          ExitTab.prototype.widths.includes(defaults.settingsDefaultsExitTabPosition)
            ? defaults.settingsDefaultsExitTabPosition
            : "Narrow";

        ExitTab.prototype.defaultColor =
          ExitTab.prototype.colors.includes(defaults.settingsDefaultsExitTabPanelColor)
            ? defaults.settingsDefaultsExitTabPanelColor
            : "Panel Color";

        ExitTab.prototype.defaultBorderThickness = Math.max(
          0,
          parseNumberOrFallback(defaults.settingsDefaultsExitTabBorderThickness, 0.2)
        );

        ExitTab.prototype.defaultMinHeight = Math.max(
          0,
          parseNumberOrFallback(defaults.settingsDefaultsExitTabMinHeight, 2)
        );

        ExitTab.prototype.defaultFontSize = Math.max(
          10,
          parseNumberOrFallback(defaults.settingsDefaultsExitTabTextSize, 20)
        );

        ExitTab.prototype.defaultNestedTabSpacing = Math.max(
          0,
          parseNumberOrFallback(defaults.settingsDefaultsExitTabNestedSpacing, 0)
        );

        ExitTab.prototype.defaultFHWAFont = !!defaults.settingsDefaultsExitTabFHWAStyle;
        ExitTab.prototype.defaultShowLeft = !!defaults.settingsDefaultsExitTabLeft;
        ExitTab.prototype.defaultFullBorder = !!defaults.settingsDefaultsExitTabFullBorder;
        ExitTab.prototype.defaultSquareCorners = !!defaults.settingsDefaultsExitTabSquareCorners;
        ExitTab.prototype.defaultTopOffset = !!defaults.settingsDefaultsExitTabTopOffset;
        ExitTab.prototype.defaultVerticalArrangement =
          !!defaults.settingsDefaultsExitTabVerticalArrangement;
        ExitTab.prototype.defaultCAStyle = !!defaults.settingsDefaultsExitTabCAStyle;
      };

      applyExitTabSettingsDefaults();
      
      const bindExitTabSettingsDefaultsPersistence = (id, { checkbox = false } = {}) => {
        const el = document.getElementById(id);
        if (!el || el.dataset.exitTabDefaultsBound === "true") {
          return;
        }

        el.dataset.exitTabDefaultsBound = "true";

        const persist = () => {
          const value = checkbox ? !!el.checked : el.value;
          saveSettingsDefaultsField(id, value);
          applyExitTabSettingsDefaults();
        };

        el.addEventListener("change", persist);
        if (!checkbox) {
          el.addEventListener("input", persist);
        }
      };
      
      [
        "settingsDefaultsExitTabText",
        "settingsDefaultsExitTabType",
        "settingsDefaultsExitTabAlignment",
        "settingsDefaultsExitTabPosition",
        "settingsDefaultsExitTabPanelColor",
        "settingsDefaultsExitTabBorderThickness",
        "settingsDefaultsExitTabMinHeight",
        "settingsDefaultsExitTabTextSize",
        "settingsDefaultsExitTabNestedSpacing",
      ].forEach((id) => bindExitTabSettingsDefaultsPersistence(id));

      [
        "settingsDefaultsExitTabFHWAStyle",
        "settingsDefaultsExitTabLeft",
        "settingsDefaultsExitTabFullBorder",
        "settingsDefaultsExitTabSquareCorners",
        "settingsDefaultsExitTabTopOffset",
        "settingsDefaultsExitTabVerticalArrangement",
        "settingsDefaultsExitTabCAStyle",
      ].forEach((id) => bindExitTabSettingsDefaultsPersistence(id, { checkbox: true }));
      
      const getSettingsDefaultsFamilyPreviewFont = (family) => {
        if (family === "Clearview") return '"Clearview 5WR", "Transport", sans-serif';
        if (family === "Highway Gothic") return '"Series EM", "Highway Gothic", sans-serif';
        if (family === "Arial") return 'Arial, sans-serif';
        if (family === "Transport") return '"Transport", sans-serif';
        return 'Inter, sans-serif';
      };

      const populateSimpleSelect = (selectEl, options, selectedValue = "") => {
        if (!selectEl) {
          return;
        }

        selectEl.innerHTML = "";

        for (const option of options) {
          if (typeof option === "string") {
            lib.appendOption(selectEl, option, {
              selected: option === selectedValue,
            });
          } else if (option && typeof option === "object") {
            lib.appendOption(selectEl, option.value, {
              text: option.label ?? option.value,
              selected: option.value === selectedValue,
            });
          }
        }
      };

      const updateSettingsDefaultsFontSelect = (fontFamilySelectId) => {
        const fontFamilySelect = document.getElementById(fontFamilySelectId);
        const fontSelect = document.getElementById(
          settingsDefaultsFontIds[fontFamilySelectId]
        );

        if (!fontFamilySelect || !fontSelect) {
          return;
        }

        const selectedFamily = fontFamilySelect.value;
        const matchingFonts = settingsDefaultsFontFamilies[selectedFamily] || [];
        const fontId = settingsDefaultsFontIds[fontFamilySelectId];

        const preferredStoredFont = Object.prototype.hasOwnProperty.call(
          storedSettingsDefaults,
          fontId
        )
          ? storedSettingsDefaults[fontId]
          : settingsDefaultsFieldDefaults[fontId];

        const defaultFontForFamily =
          matchingFonts.includes(preferredStoredFont)
            ? preferredStoredFont
            : settingsDefaultsFontDefaults[selectedFamily] || matchingFonts[0] || "";

        populateSimpleSelect(fontSelect, matchingFonts, defaultFontForFamily);
        fontSelect.value = defaultFontForFamily;

        fontSelect.classList.add("settingsDefaultsFontNativeSelect", "hidden");
        fontSelect.hidden = true;

        const shouldShowFontButtons =
          shouldUseSettingsDefaultsFontButtons(selectedFamily);

        const fontLabel = document.querySelector(`label[for="${fontSelect.id}"]`);
        if (fontLabel) {
          fontLabel.classList.toggle("hidden", !shouldShowFontButtons);
        }

        refreshSettingsDefaultsFontButtons(
          fontId,
          selectedFamily,
          matchingFonts
        );

        fontSelect.style.fontFamily = `"${fontSelect.value || "Inter"}", sans-serif`;
        fontSelect.style.fontSize =
          selectedFamily === "Highway Gothic" ? "1.2rem" : "1rem";
      };
      
      settingsDefaultsFontFamilyIds.forEach((id) => {
        const selectEl = document.getElementById(id);
        if (!selectEl) {
          return;
        }

        const selectedFamily =
          Object.prototype.hasOwnProperty.call(storedSettingsDefaults, id)
            ? storedSettingsDefaults[id]
            : settingsDefaultsFieldDefaults[id];

        populateSimpleSelect(
          selectEl,
          Object.keys(settingsDefaultsFontFamilies),
          selectedFamily
        );

          const syncFamilyPreview = () => {
            syncSettingsDefaultsFamilyPreviewSelect(selectEl);
          };

          if (selectEl.dataset.defaultsFontFamilyBound !== "true") {
            selectEl.dataset.defaultsFontFamilyBound = "true";

            selectEl.addEventListener("change", () => {
              updateSettingsDefaultsFontSelect(id);
              syncFamilyPreview();

              saveSettingsDefaultsField(id, selectEl.value);
              storedSettingsDefaults[id] = selectEl.value;

              const fontId = settingsDefaultsFontIds[id];
              const fontSelect = document.getElementById(fontId);

              if (fontSelect) {
                saveSettingsDefaultsField(fontId, fontSelect.value);
                storedSettingsDefaults[fontId] = fontSelect.value;
              }

              if (typeof syncAllFontPickers === "function") {
                syncAllFontPickers();
              }
            });
          }

          updateSettingsDefaultsFontSelect(id);
          syncFamilyPreview();
      });
      
    Object.entries(settingsDefaultsFontIds).forEach(([fontFamilyId, fontId]) => {
      const fontSelect = document.getElementById(fontId);

      if (!fontSelect) {
        return;
      }

      const syncDefaultsFontPreview = () => {
        fontSelect.style.fontFamily = `"${fontSelect.value || "Inter"}", sans-serif`;

        let familySelectId = null;
        if (fontId === "settingsDefaultsControlTextFont") {
          familySelectId = "settingsDefaultsControlTextFontFamily";
        } else if (fontId === "settingsDefaultsAdvisoryFont") {
          familySelectId = "settingsDefaultsAdvisoryFontFamily";
        } else if (fontId === "settingsDefaultsActionFont") {
          familySelectId = "settingsDefaultsActionFontFamily";
        }

        const familySelect = familySelectId
          ? document.getElementById(familySelectId)
          : null;

        const selectedFamily = familySelect?.value || "";
        const matchingFonts = settingsDefaultsFontFamilies[selectedFamily] || [];

        fontSelect.style.fontSize =
          selectedFamily === "Highway Gothic" ? "1.2rem" : "1rem";

        refreshSettingsDefaultsFontButtons(
          fontId,
          selectedFamily,
          matchingFonts
        );
      };

      syncDefaultsFontPreview();

      if (fontSelect.dataset.defaultsFontPreviewBound !== "true") {
        fontSelect.dataset.defaultsFontPreviewBound = "true";
          fontSelect.addEventListener("change", () => {
            syncDefaultsFontPreview();

            saveSettingsDefaultsField(fontId, fontSelect.value);
            storedSettingsDefaults[fontId] = fontSelect.value;
          });
      }
    });

      const settingsDefaultsTextColorSelects = [
        document.getElementById("settingsDefaultsControlTextColor"),
        document.getElementById("settingsDefaultsAdvisoryColor"),
        document.getElementById("settingsDefaultsActionColor"),
      ];

      const settingsDefaultsBgColorSelects = [
        document.getElementById("settingsDefaultsControlTextBg"),
        document.getElementById("settingsDefaultsAdvisoryBg"),
        document.getElementById("settingsDefaultsActionBg"),
        document.getElementById("settingsDefaultsExitTabPanelColor"),
      ];

      const settingsDefaultsTextColors = ControlTextElement.getTextColorOptions();
      const settingsDefaultsBackgroundColors = TextElement.prototype.backgroundColor;

      settingsDefaultsTextColorSelects.forEach((selectEl) => {
        populateSimpleSelect(selectEl, settingsDefaultsTextColors, ControlTextElement.defaultTextColor);
      });

      settingsDefaultsBgColorSelects.forEach((selectEl) => {
        if (selectEl?.id === "settingsDefaultsExitTabPanelColor") {
          populateSimpleSelect(selectEl, settingsDefaultsBackgroundColors, "Panel Color");
        } else {
          populateSimpleSelect(selectEl, settingsDefaultsBackgroundColors, "Inherit");
        }
      });

      const settingsDefaultsShieldType = document.getElementById("settingsDefaultsShieldType");
      let settingsDefaultsShieldPicker = null;

      if (settingsDefaultsShieldType) {
        const existingShieldValue =
          settingsDefaultsShieldType.value ||
          getStoredItem("signMaker.settingsDefaults")
            ? (() => {
                try {
                  const parsed = JSON.parse(
                    getStoredItem("signMaker.settingsDefaults") || "{}"
                  );
                  return parsed.settingsDefaultsShieldType || "I";
                } catch (error) {
                  return "I";
                }
              })()
            : "I";

        settingsDefaultsShieldPicker = createShieldPicker({
          mount: settingsDefaultsShieldType,
          value: existingShieldValue,
          placeholder: "Shield type",
          onChange: (nextValue) => {
            const settingsDefaultsShieldRouteNumber = document.getElementById("settingsDefaultsShieldRouteNumber");
            const storedRaw = getStoredItem("signMaker.settingsDefaults");
            let storedDefaults = {};
            try {
              storedDefaults = storedRaw ? JSON.parse(storedRaw) : {};
            } catch (error) {
              storedDefaults = {};
            }
            storedDefaults.settingsDefaultsShieldType = nextValue;
            setStoredItem("signMaker.settingsDefaults", JSON.stringify(storedDefaults));
            if (typeof readForm === "function") {
              readForm();
            }
          },
        });
      }
      if (settingsDefaultsShieldType) {
        settingsDefaultsShieldType.innerHTML = "";
        for (const shield of ShieldElement.prototype.blockShieldBases) {
          lib.appendOption(settingsDefaultsShieldType, shield.value, {
            text: shield.label,
            selected:
              shield.value === ShieldElement.prototype.defaultShieldBase,
          });
        }
      }

      const settingsDefaultsShieldBanner1 = document.getElementById("settingsDefaultsShieldBanner1");
      const settingsDefaultsShieldBanner2 = document.getElementById("settingsDefaultsShieldBanner2");
      const shieldBannerPositions = ShieldElement.prototype.getBannerPositionOptions();

      populateSimpleSelect(
        settingsDefaultsShieldBanner1,
        shieldBannerPositions,
        settingsDefaultsFieldDefaults.settingsDefaultsShieldBanner1
      );

      populateSimpleSelect(
        settingsDefaultsShieldBanner2,
        shieldBannerPositions,
        settingsDefaultsFieldDefaults.settingsDefaultsShieldBanner2
      );

    const settingsDefaultsControlTextText = document.getElementById("settingsDefaultsControlTextText");
    const settingsDefaultsAdvisoryText = document.getElementById("settingsDefaultsAdvisoryText");
    const settingsDefaultsActionText = document.getElementById("settingsDefaultsActionText");
    const settingsDefaultsShieldRouteNumber = document.getElementById("settingsDefaultsShieldRouteNumber");

      Object.entries(settingsDefaultsFieldDefaults).forEach(([id, fallbackValue]) => {
        const el = document.getElementById(id);
        if (!el) {
          return;
        }

        const storedValue = Object.prototype.hasOwnProperty.call(storedSettingsDefaults, id)
          ? storedSettingsDefaults[id]
          : fallbackValue;

        if (el.type === "checkbox") {
          el.checked = !!storedValue;
        } else if (el.tagName === "SELECT") {
          const hasMatchingOption = Array.from(el.options).some(
            (option) => option.value === storedValue
          );
          const safeValue = hasMatchingOption ? storedValue : fallbackValue;
          el.value = safeValue;
          storedSettingsDefaults[id] = safeValue;
        } else {
          el.value = storedValue;
        }
      });
      
      setStoredSettingsDefaults(storedSettingsDefaults);
      
      updateSettingsDefaultsFontSelect("settingsDefaultsControlTextFontFamily");
      updateSettingsDefaultsFontSelect("settingsDefaultsAdvisoryFontFamily");
      updateSettingsDefaultsFontSelect("settingsDefaultsActionFontFamily");

      initializeFontPickers();

      [
        "settingsDefaultsControlTextFontFamily",
        "settingsDefaultsAdvisoryFontFamily",
        "settingsDefaultsActionFontFamily",
      ].forEach((id) => {
        const selectEl = document.getElementById(id);
        if (!selectEl) {
          return;
        }

        if (selectEl.value === "Clearview") {
          selectEl.style.fontFamily = "Clearview 5WR";
        } else if (selectEl.value === "Highway Gothic") {
          selectEl.style.fontFamily = "Series EM";
        } else if (selectEl.value === "Arial") {
          selectEl.style.fontFamily = "Arial";
        } else if (selectEl.value === "Transport") {
          selectEl.style.fontFamily = "Transport";
        } else if (selectEl.value === "DIN 1451") {
          selectEl.style.fontFamily = '"DIN 1451", sans-serif';
          selectEl.style.fontSize = "1rem";
        } else if (selectEl.value === "Rawlinson") {
          selectEl.style.fontFamily = '"Rawlinson Regular", serif';
          selectEl.style.fontSize = "1rem";
        } else if (selectEl.value === "Helvetica Neue") {
          selectEl.style.fontFamily = '"Helvetica Neue Roman", sans-serif';
          selectEl.style.fontSize = "1rem";
        } else {
          selectEl.style.fontFamily = "Inter";
        }
      });
      
      [
        "settingsDefaultsControlTextFontFamily",
        "settingsDefaultsAdvisoryFontFamily",
        "settingsDefaultsActionFontFamily",
      ].forEach((id) => {
        const selectEl = document.getElementById(id);
        if (selectEl && !selectEl.value) {
          selectEl.value = settingsDefaultsFieldDefaults[id];
        }
      });
      updateSettingsDefaultsFontSelect("settingsDefaultsControlTextFontFamily");
      updateSettingsDefaultsFontSelect("settingsDefaultsAdvisoryFontFamily");
      updateSettingsDefaultsFontSelect("settingsDefaultsActionFontFamily");
      
      const bindSettingsDefaultsSlider = (sliderId, valueId, formatter = (value) => value) => {
        const slider = document.getElementById(sliderId);
        const valueEl = document.getElementById(valueId);

        if (!slider || !valueEl) {
          return;
        }

        const syncValue = () => {
          valueEl.textContent = formatter(slider.value);
        };

        syncValue();

        if (slider.dataset.defaultsSliderBound !== "true") {
          slider.dataset.defaultsSliderBound = "true";
          slider.addEventListener("input", syncValue);
          slider.addEventListener("change", syncValue);
        }
      };

      bindSettingsDefaultsSlider(
        "settingsDefaultsControlTextSize",
        "settingsDefaultsControlTextSizeValue",
        (value) => `${value}%`
      );

      bindSettingsDefaultsSlider(
        "settingsDefaultsAdvisorySize",
        "settingsDefaultsAdvisorySizeValue",
        (value) => `${value}%`
      );

      bindSettingsDefaultsSlider(
        "settingsDefaultsActionSize",
        "settingsDefaultsActionSizeValue",
        (value) => `${value}%`
      );

      bindSettingsDefaultsSlider(
        "settingsDefaultsShieldSize",
        "settingsDefaultsShieldSizeValue",
        (value) => `${value} rem`
      );
      
      bindSettingsDefaultsSlider(
        "settingsDefaultsExitTabBorderThickness",
        "settingsDefaultsExitTabBorderThicknessValue",
        (value) => value
      );

      bindSettingsDefaultsSlider(
        "settingsDefaultsExitTabMinHeight",
        "settingsDefaultsExitTabMinHeightValue",
        (value) => value
      );

      bindSettingsDefaultsSlider(
        "settingsDefaultsExitTabTextSize",
        "settingsDefaultsExitTabTextSizeValue",
        (value) => value
      );

      bindSettingsDefaultsSlider(
        "settingsDefaultsExitTabNestedSpacing",
        "settingsDefaultsExitTabNestedSpacingValue",
        (value) => value
      );
    
    const settingsDefaultsBlockElementSliderIds = [
      ["settingsDefaultsArrowSize", "settingsDefaultsArrowSizeValue"],
      ["settingsDefaultsArrowHorizontalPadding", "settingsDefaultsArrowHorizontalPaddingValue"],
      ["settingsDefaultsArrowVerticalPadding", "settingsDefaultsArrowVerticalPaddingValue"],
      ["settingsDefaultsIconSize", "settingsDefaultsIconSizeValue"],
      ["settingsDefaultsIconSpacing", "settingsDefaultsIconSpacingValue"],
      ["settingsDefaultsTollLogoSize", "settingsDefaultsTollLogoSizeValue"],
      ["settingsDefaultsTollLogoSpacing", "settingsDefaultsTollLogoSpacingValue"],
      ["settingsDefaultsTollLogoBorderRadius", "settingsDefaultsTollLogoBorderRadiusValue"],
      ["settingsDefaultsTollLogoHorizontalBgPadding", "settingsDefaultsTollLogoHorizontalBgPaddingValue"],
      ["settingsDefaultsTollLogoVerticalBgPadding", "settingsDefaultsTollLogoVerticalBgPaddingValue"],
    ];

    settingsDefaultsBlockElementSliderIds.forEach(([sliderId, valueId]) => {
      bindSettingsDefaultsSlider(sliderId, valueId, (value) => value);
    });

    const dispatchSettingsDefaultsInputAndChange = (el) => {
      if (!el) {
        return;
      }

      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };

    const resetSettingsDefaultsField = (id) => {
      const el = document.getElementById(id);

      if (!el || !Object.prototype.hasOwnProperty.call(settingsDefaultsFieldDefaults, id)) {
        return;
      }

      const value = settingsDefaultsFieldDefaults[id];

      if (el.type === "checkbox") {
        el.checked = !!value;
      } else {
        el.value = value == null ? "" : String(value);
      }

      dispatchSettingsDefaultsInputAndChange(el);
    };

    const updateSettingsDefaultsSegmentedButtons = (pageId, valueInputId) => {
      const valueInput = document.getElementById(valueInputId);
      const page = document.getElementById(pageId);

      if (!valueInput || !page) {
        return;
      }

      page
        .querySelectorAll(".settingsDefaultsSegmentedButton")
        .forEach((button) => {
          button.classList.toggle(
            "active",
            button.textContent.trim() === valueInput.value
          );
        });
    };

    const bindSettingsDefaultsSegmentedButtons = (pageId, valueInputId) => {
      const valueInput = document.getElementById(valueInputId);
      const page = document.getElementById(pageId);

      if (!valueInput || !page) {
        return;
      }

      page
        .querySelectorAll(".settingsDefaultsSegmentedButton")
        .forEach((button) => {
          if (button.dataset.defaultsSegmentBound === "true") {
            return;
          }

          button.dataset.defaultsSegmentBound = "true";

          button.addEventListener("click", (event) => {
            event.preventDefault();

            valueInput.value = button.textContent.trim();
            dispatchSettingsDefaultsInputAndChange(valueInput);
            updateSettingsDefaultsSegmentedButtons(pageId, valueInputId);
          });
        });

      updateSettingsDefaultsSegmentedButtons(pageId, valueInputId);
    };

    bindSettingsDefaultsSegmentedButtons(
      "settingsDefaultArrow",
      "settingsDefaultsArrowAlignment"
    );

    bindSettingsDefaultsSegmentedButtons(
      "settingsDefaultIcon",
      "settingsDefaultsIconAlignment"
    );

    const arrowRotationInput = document.getElementById("settingsDefaultsArrowRotation");

    if (arrowRotationInput) {
      document
        .querySelectorAll(
          "#settingsDefaultArrow .settingsDefaultsRotationButtonGroup .settingsDefaultsPresetButton"
        )
        .forEach((button) => {
          if (button.dataset.defaultsRotationBound === "true") {
            return;
          }

          button.dataset.defaultsRotationBound = "true";

          button.addEventListener("click", (event) => {
            event.preventDefault();

            arrowRotationInput.value = button.textContent.trim();
            dispatchSettingsDefaultsInputAndChange(arrowRotationInput);

            document
              .querySelectorAll(
                "#settingsDefaultArrow .settingsDefaultsRotationButtonGroup .settingsDefaultsPresetButton"
              )
              .forEach((rotationButton) => {
                rotationButton.classList.toggle(
                  "active",
                  rotationButton.textContent.trim() === arrowRotationInput.value
                );
              });
          });
        });
    }

    const settingsDefaultsInlineResetTargets = {
      "Reset arrow rotation": "settingsDefaultsArrowRotation",
      "Reset arrow size": "settingsDefaultsArrowSize",
      "Reset horizontal padding": "settingsDefaultsArrowHorizontalPadding",
      "Reset vertical padding": "settingsDefaultsArrowVerticalPadding",
      "Reset icon size": "settingsDefaultsIconSize",
      "Reset icon spacing": "settingsDefaultsIconSpacing",
      "Reset toll logo size": "settingsDefaultsTollLogoSize",
      "Reset toll logo spacing": "settingsDefaultsTollLogoSpacing",
      "Reset toll logo border radius": "settingsDefaultsTollLogoBorderRadius",
      "Reset horizontal background padding": "settingsDefaultsTollLogoHorizontalBgPadding",
      "Reset vertical background padding": "settingsDefaultsTollLogoVerticalBgPadding",
    };

    document.querySelectorAll(".settingsDefaultsInlineReset").forEach((button) => {
      if (button.dataset.defaultsInlineResetBound === "true") {
        return;
      }

      const targetId = settingsDefaultsInlineResetTargets[button.getAttribute("aria-label")];

      if (!targetId) {
        return;
      }

      button.dataset.defaultsInlineResetBound = "true";

      button.addEventListener("click", (event) => {
        event.preventDefault();
        resetSettingsDefaultsField(targetId);
      });
    });

    const refreshSettingsDefaultsAssetLabels = () => {
      const configs = [
        {
          inputId: "settingsDefaultsArrowValue",
          labelId: "settingsDefaultsArrowCurrent",
          sourceObject: ArrowElement.prototype.arrows,
          defaultKey: ArrowElement.prototype.defaultArrow,
        },
        {
          inputId: "settingsDefaultsIconValue",
          labelId: "settingsDefaultsIconCurrent",
          sourceObject: IconElement.prototype.icons,
          defaultKey: IconElement.prototype.defaultIcon,
        },
        {
          inputId: "settingsDefaultsTollLogoValue",
          labelId: "settingsDefaultsTollLogoCurrent",
          sourceObject: TollLogoElement.prototype.logos,
          defaultKey: TollLogoElement.prototype.defaultLogo,
        },
      ];

      configs.forEach(({ inputId, labelId, sourceObject, defaultKey }) => {
        const input = document.getElementById(inputId);
        const label = document.getElementById(labelId);

        if (!input || !label || !sourceObject) {
          return;
        }

        const key = sourceObject[input.value] ? input.value : defaultKey;
        const definition = sourceObject[key];

        if (definition) {
          label.textContent = String(definition.label || definition.name || key);
        }
      });
    };

    refreshSettingsDefaultsAssetLabels();
      
    const settingsDefaultsSimpleFieldIds = [
      "settingsDefaultsControlTextText",
      "settingsDefaultsControlTextColor",
      "settingsDefaultsControlTextBg",
      "settingsDefaultsShieldType",
      "settingsDefaultsShieldRouteNumber",
      "settingsDefaultsShieldBanner1",
      "settingsDefaultsShieldBanner2",
      "settingsDefaultsAdvisoryText",
      "settingsDefaultsAdvisoryColor",
      "settingsDefaultsAdvisoryBg",
      "settingsDefaultsActionText",
      "settingsDefaultsActionColor",
      "settingsDefaultsActionBg",
      "settingsDefaultsExitTabText",
      "settingsDefaultsExitTabType",
      "settingsDefaultsExitTabAlignment",
      "settingsDefaultsExitTabPosition",
      "settingsDefaultsExitTabPanelColor",
      "settingsDefaultsArrowValue",
      "settingsDefaultsArrowRotation",
      "settingsDefaultsArrowAlignment",
      "settingsDefaultsIconValue",
      "settingsDefaultsIconBgColor",
      "settingsDefaultsIconAlignment",
      "settingsDefaultsTollLogoValue",
      "settingsDefaultsTollLogoBgColor",
    ];

    settingsDefaultsSimpleFieldIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) {
        return;
      }

      const value = Object.prototype.hasOwnProperty.call(storedSettingsDefaults, id)
        ? storedSettingsDefaults[id]
        : settingsDefaultsFieldDefaults[id];

      if (el.type === "checkbox") {
        el.checked = !!value;
      } else {
        el.value = value;
      }
    });

    settingsDefaultsSimpleFieldIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el || el.dataset.defaultsPersistBound === "true") {
        return;
      }

      el.dataset.defaultsPersistBound = "true";

      const persist = () => {
        const value = el.type === "checkbox" ? !!el.checked : el.value;
        saveSettingsDefaultsField(id, value);
        storedSettingsDefaults[id] = value;
      };

      el.addEventListener("change", persist);

      if (el.tagName !== "SELECT") {
        el.addEventListener("input", persist);
      }
    });
      
      [
        "settingsDefaultsExitTabFHWAStyle",
        "settingsDefaultsExitTabLeft",
        "settingsDefaultsExitTabFullBorder",
        "settingsDefaultsExitTabSquareCorners",
        "settingsDefaultsExitTabTopOffset",
        "settingsDefaultsExitTabVerticalArrangement",
        "settingsDefaultsExitTabCAStyle",
        "settingsDefaultsIconBorder",
        "settingsDefaultsTollLogoSquareIcon",
        "settingsDefaultsTollLogoShowOnlyBlock",
      ].forEach((id) => {
        const el = document.getElementById(id);
        if (!el || el.dataset.defaultsPersistBound === "true") {
          return;
        }

        el.dataset.defaultsPersistBound = "true";

        const persist = () => saveSettingsDefaultsField(id, el.checked);
        el.addEventListener("change", persist);
      });
      
      /* slider persistence array */
      [
        "settingsDefaultsControlTextSize",
        "settingsDefaultsAdvisorySize",
        "settingsDefaultsActionSize",
        "settingsDefaultsShieldSize",
        "settingsDefaultsExitTabBorderThickness",
        "settingsDefaultsExitTabMinHeight",
        "settingsDefaultsExitTabTextSize",
        "settingsDefaultsExitTabNestedSpacing",
        "settingsDefaultsArrowSize",
        "settingsDefaultsArrowHorizontalPadding",
        "settingsDefaultsArrowVerticalPadding",
        "settingsDefaultsIconSize",
        "settingsDefaultsIconSpacing",
        "settingsDefaultsTollLogoSize",
        "settingsDefaultsTollLogoSpacing",
        "settingsDefaultsTollLogoBorderRadius",
        "settingsDefaultsTollLogoHorizontalBgPadding",
        "settingsDefaultsTollLogoVerticalBgPadding",
      ].forEach((id) => {
        const el = document.getElementById(id);
        if (!el || el.dataset.defaultsPersistBound === "true") {
          return;
        }

        el.dataset.defaultsPersistBound = "true";
        const persist = () => saveSettingsDefaultsField(id, el.value);
        el.addEventListener("change", persist);
        el.addEventListener("input", persist);
      });
      
      
      const settingsResetDefaultsButton = document.getElementById("settingsResetDefaultsButton");
          applyExitTabSettingsDefaults();

      if (settingsResetDefaultsButton && settingsResetDefaultsButton.dataset.bound !== "true") {
        settingsResetDefaultsButton.dataset.bound = "true";

          settingsResetDefaultsButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();

              Object.entries(settingsDefaultsFieldDefaults).forEach(([id, value]) => {
                const el = document.getElementById(id);
                if (!el) {
                  return;
                }

                if (el.type === "checkbox") {
                  el.checked = !!value;
                } else {
                  el.value = value;
                }
              });

            updateSettingsDefaultsFontSelect("settingsDefaultsControlTextFontFamily");
            updateSettingsDefaultsFontSelect("settingsDefaultsAdvisoryFontFamily");
            updateSettingsDefaultsFontSelect("settingsDefaultsActionFontFamily");
              [
                "settingsDefaultsControlTextFontFamily",
                "settingsDefaultsAdvisoryFontFamily",
                "settingsDefaultsActionFontFamily",
              ].forEach((id) => {
                syncSettingsDefaultsFamilyPreviewSelect(document.getElementById(id));
              });

            document.getElementById("settingsDefaultsControlTextFont").value =
              settingsDefaultsFieldDefaults.settingsDefaultsControlTextFont;
            document.getElementById("settingsDefaultsAdvisoryFont").value =
              settingsDefaultsFieldDefaults.settingsDefaultsAdvisoryFont;
            document.getElementById("settingsDefaultsActionFont").value =
              settingsDefaultsFieldDefaults.settingsDefaultsActionFont;
              [
                "settingsDefaultsControlTextFont",
                "settingsDefaultsAdvisoryFont",
                "settingsDefaultsActionFont",
              ].forEach((id) => {
                syncFontPreviewSelect(document.getElementById(id));
              });
            refreshAllSettingsDefaultsFontButtons();

            Object.entries(settingsDefaultsFieldDefaults).forEach(([id, value]) => {
              saveSettingsDefaultsField(id, value);
            });
            Object.assign(storedSettingsDefaults, settingsDefaultsFieldDefaults);
              
              const syncEvent = new Event("input", { bubbles: true });
              const changeEvent = new Event("change", { bubbles: true });

              [
                "settingsDefaultsControlTextSize",
                "settingsDefaultsAdvisorySize",
                "settingsDefaultsActionSize",
                "settingsDefaultsShieldSize",
                "settingsDefaultsExitTabBorderThickness",
                "settingsDefaultsExitTabMinHeight",
                "settingsDefaultsExitTabTextSize",
                "settingsDefaultsExitTabNestedSpacing",
                "settingsDefaultsArrowSize",
                "settingsDefaultsArrowHorizontalPadding",
                "settingsDefaultsArrowVerticalPadding",
                "settingsDefaultsIconSize",
                "settingsDefaultsIconSpacing",
                "settingsDefaultsTollLogoSize",
                "settingsDefaultsTollLogoSpacing",
                "settingsDefaultsTollLogoBorderRadius",
                "settingsDefaultsTollLogoHorizontalBgPadding",
                "settingsDefaultsTollLogoVerticalBgPadding",
              ].forEach((id) => {
                const slider = document.getElementById(id);
                if (slider) {
                  slider.dispatchEvent(syncEvent);
                  slider.dispatchEvent(changeEvent);
                }
              });
              
              const settingsDefaultsExitTabFHWAStyle = document.getElementById("settingsDefaultsExitTabFHWAStyle");
              const settingsDefaultsExitTabTextSize = document.getElementById("settingsDefaultsExitTabTextSize");

              if (
                settingsDefaultsExitTabFHWAStyle &&
                settingsDefaultsExitTabTextSize &&
                settingsDefaultsExitTabFHWAStyle.dataset.exitTabTextSizeBound !== "true"
              ) {
                settingsDefaultsExitTabFHWAStyle.dataset.exitTabTextSizeBound = "true";

                settingsDefaultsExitTabFHWAStyle.addEventListener("change", () => {
                  const nextValue = settingsDefaultsExitTabFHWAStyle.checked ? "18" : "20";
                  settingsDefaultsExitTabTextSize.value = nextValue;
                  saveSettingsDefaultsField("settingsDefaultsExitTabTextSize", nextValue);
                  settingsDefaultsExitTabTextSize.dispatchEvent(new Event("input", { bubbles: true }));
                  settingsDefaultsExitTabTextSize.dispatchEvent(new Event("change", { bubbles: true }));
                });
              }

              document.getElementById("settingsDefaultsControlTextSizeValue").textContent =
                `${document.getElementById("settingsDefaultsControlTextSize").value}%`;
              document.getElementById("settingsDefaultsAdvisorySizeValue").textContent =
                `${document.getElementById("settingsDefaultsAdvisorySize").value}%`;
              document.getElementById("settingsDefaultsActionSizeValue").textContent =
                `${document.getElementById("settingsDefaultsActionSize").value}%`;
              document.getElementById("settingsDefaultsShieldSizeValue").textContent =
                `${document.getElementById("settingsDefaultsShieldSize").value} rem`;
              

            settingsDefaultsFontFamilyIds.forEach((id) => {
              const familyEl = document.getElementById(id);
              if (!familyEl) {
                return;
              }

              if (familyEl.value === "Clearview") {
                familyEl.style.fontFamily = '"Clearview 5WR", sans-serif';
                familyEl.style.fontSize = "1rem";
              } else if (familyEl.value === "Highway Gothic") {
                familyEl.style.fontFamily = '"Series EM", sans-serif';
                familyEl.style.fontSize = "1.1rem";
              } else if (familyEl.value === "Arial") {
                familyEl.style.fontFamily = "Arial, sans-serif";
                familyEl.style.fontSize = "1rem";
              } else if (familyEl.value === "Transport") {
                familyEl.style.fontFamily = '"Transport", sans-serif';
                familyEl.style.fontSize = "1rem";
              } else {
                familyEl.style.fontFamily = "Inter, sans-serif";
                familyEl.style.fontSize = "1rem";
              }
            });

            Object.values(settingsDefaultsFontIds).forEach((id) => {
              const fontEl = document.getElementById(id);
              if (fontEl) {
                fontEl.style.fontFamily = fontEl.value || "Inter";
              }
            });
            updateSettingsDefaultsSegmentedButtons(
              "settingsDefaultArrow",
              "settingsDefaultsArrowAlignment"
            );

            updateSettingsDefaultsSegmentedButtons(
              "settingsDefaultIcon",
              "settingsDefaultsIconAlignment"
            );

            document
              .querySelectorAll(
                "#settingsDefaultArrow .settingsDefaultsRotationButtonGroup .settingsDefaultsPresetButton"
              )
              .forEach((button) => {
                const rotationInput = document.getElementById("settingsDefaultsArrowRotation");

                button.classList.toggle(
                  "active",
                  rotationInput && button.textContent.trim() === rotationInput.value
                );
              });

            refreshSettingsDefaultsAssetLabels();
          });
      }

    for (const elem of textElem_alignmentSelects) {
      for (const alignment of TextElement.prototype.alignment) {
        lib.appendOption(elem, alignment);
      }
    }

    for (const elem of textElem_bgColorSelects) {
      for (const backgroundColor of TextElement.prototype.backgroundColor) {
        lib.appendOption(elem, backgroundColor);
      }
    }

    for (const fontFamily of ElectronicSignElement.prototype.fontFamily) {
      lib.appendOption(
        document.querySelector("#sdElectronicSign_fontFamily"),
        fontFamily
      );
    }

    for (const textColor of ElectronicSignElement.prototype.textColors) {
      lib.appendOption(
        document.querySelector("#sdElectronicSign_textColor"),
        textColor
      );
    }

    for (const measurement of DividerElement.prototype.dividerMeasurement) {
      lib.appendOption(divider_widthMeasurement, measurement);
    }

    for (const orientation of DividerElement.prototype.orientations || []) {
      lib.appendOption(divider_orientationSelect, orientation);
    }

    for (const { value, label } of DividerElement.prototype.dividerColors) {
      lib.appendOption(divider_colorSelect, value, { text: label });
    }

    if (shield_shieldBase && ShieldElement.prototype.blockShieldBases) {
      const shields = ShieldElement.prototype.blockShieldBases || [];
      const currentValue =
        shield_shieldBase.value || ShieldElement.prototype.defaultShieldBase;
      shield_shieldBase.innerHTML = "";

      const groupMap = new Map();
      for (const shield of shields) {
        const categories = Array.isArray(shield.categories)
          ? shield.categories
          : [];
        const groupLabel = categories.length ? categories.join(" / ") : "Other";
        if (!groupMap.has(groupLabel)) {
          groupMap.set(groupLabel, []);
        }
        groupMap.get(groupLabel).push(shield);
      }

      let firstOptionValue = "";
      const sortedGroups = Array.from(groupMap.entries()).sort((a, b) =>
        a[0].localeCompare(b[0])
      );

      for (const [groupLabel, groupShields] of sortedGroups) {
        const optgroup = document.createElement("optgroup");
        optgroup.label = groupLabel;

        groupShields
          .slice()
          .sort((a, b) =>
            (a.label || a.value).localeCompare(b.label || b.value)
          )
          .forEach(({ value, label }) => {
            const option = document.createElement("option");
            option.value = value;
            option.text = label || value;
            if (!firstOptionValue) {
              firstOptionValue = value;
            }
            if (currentValue && value === currentValue) {
              option.selected = true;
            }
            optgroup.appendChild(option);
          });

        shield_shieldBase.appendChild(optgroup);
      }

      if (!shield_shieldBase.value && firstOptionValue) {
        shield_shieldBase.value = firstOptionValue;
      }
    }
      if (shield_shieldBase) {
        shield_shieldBase.addEventListener("change", () => {
          updateShieldCountyVisibility();
        });
        updateShieldCountyVisibility();
      }

      const shieldVariantSelect = document.querySelector("#sdShield_shieldType");
      if (shieldVariantSelect && ShieldElement.prototype.blockShieldVariants) {
        const AUTO_VARIANT_VALUE = ShieldElement.prototype.defaultVariant || "Auto";

        const populateVariantOptions = (baseValue, currentValue) => {
          shieldVariantSelect.innerHTML = "";

          const config = ShieldElement.prototype.getBlockShieldConfig(baseValue);
          const variants =
            (config && Array.isArray(config.variants) && config.variants.length
              ? config.variants
              : []) || [];

          const baseOptions = variants.length
            ? variants
            : (ShieldElement.prototype.blockShieldVariants || []).map(
                (variant) => variant.value || variant
              );

          const optionsToUse = [
            AUTO_VARIANT_VALUE,
            ...baseOptions.filter((variant) => variant !== AUTO_VARIANT_VALUE),
          ];

          for (const variant of optionsToUse) {
            lib.appendOption(shieldVariantSelect, variant, {
              text: variant === AUTO_VARIANT_VALUE ? "Auto" : variant,
            });
          }

          const nextValue =
            currentValue && optionsToUse.includes(currentValue)
              ? currentValue
              : AUTO_VARIANT_VALUE;

          shieldVariantSelect.value = nextValue;
        };

        populateVariantOptions(
          shield_shieldBase?.dataset?.pickerValue ||
            shield_shieldBase?.value ||
            ShieldElement.prototype.defaultShieldBase,
          shieldVariantSelect.value || AUTO_VARIANT_VALUE
        );

        if (shield_shieldBase) {
          shield_shieldBase.addEventListener("change", () => {
            populateVariantOptions(
              shield_shieldBase.dataset?.pickerValue ||
                shield_shieldBase.value ||
                ShieldElement.prototype.defaultShieldBase,
              AUTO_VARIANT_VALUE
            );
          });
        }
      }

      const manualBannerCheckbox = document.getElementById("sdShield_manualBanners");
      if (manualBannerCheckbox) {
        manualBannerCheckbox.addEventListener("change", () => {
          syncManualBannerInputMode({ convert: true });
          readForm();
        });
      }

      /* Populate the fixed Shield banner dropdowns */
      const blockShieldBannerSelects = [
        document.querySelector("#sdShield_bannerType"),
        document.querySelector("#sdShield_bannerType2"),
      ];

      const bannerTypeOptions = Shield.prototype.bannerTypes || [];

      for (const select of blockShieldBannerSelects) {
        if (!select) {
          continue;
        }

        select.innerHTML = "";

        for (const bannerType of bannerTypeOptions) {
          lib.appendOption(select, bannerType);
        }

        if (!bannerTypeOptions.includes("None")) {
          lib.appendOption(select, "None");
        }
      }

      /* Clicking blank space in the Banner Font row should blur the number input */
      const shieldFontRow = document.querySelector(
        '#smSPProperties > [data-property="sdShield"] .sdShieldFontRow'
      );

      if (shieldFontRow && !shieldFontRow.dataset.blankBlurListener) {
        shieldFontRow.addEventListener("mousedown", (event) => {
          const clickedControl = event.target.closest(
            "input, select, button, label, option"
          );

          if (!clickedControl && document.activeElement) {
            document.activeElement.blur();
          }
        });

        shieldFontRow.dataset.blankBlurListener = "true";
      }

    const blockBannerPositionSelects = [
      document.querySelector("#sdShield_bannerPosition"),
      document.querySelector("#sdShield_bannerPosition2"),
    ];
    const bannerPositionOptions = ShieldElement.prototype.blockBannerPositions;
    for (const select of blockBannerPositionSelects) {
      if (!select || !bannerPositionOptions.length) {
        continue;
      }
      for (const bannerPosition of bannerPositionOptions) {
        lib.appendOption(select, bannerPosition);
      }
    }

    const blockBannerFontSelect = document.querySelector(
      "#sdShield_bannerFontFamily"
    );
    if (blockBannerFontSelect) {
      const bannerFontOptions = ShieldElement.prototype.getBannerFontOptions();
      if (
        (!bannerFontOptions || !bannerFontOptions.length) &&
        ShieldElement.prototype.defaultBannerFontFamily
      ) {
        lib.appendOption(
          blockBannerFontSelect,
          ShieldElement.prototype.defaultBannerFontFamily
        );
      } else {
        for (const font of bannerFontOptions) {
          lib.appendOption(blockBannerFontSelect, font);
        }
      }
      const defaultBannerFont =
        ShieldElement.prototype.defaultBannerFontFamily ||
        (bannerFontOptions.length ? bannerFontOptions[0] : "");
      if (defaultBannerFont) {
        blockBannerFontSelect.value = defaultBannerFont;
      }
      blockBannerFontSelect.addEventListener("change", () => {
        const selectedFont = blockBannerFontSelect.value;
        const bannerFontSizeInput = document.getElementById("sdShield_fontSize");

        if (selectedFont) {
          ShieldElement.prototype.defaultBannerFontFamily = selectedFont;
          setStoredItem(STORAGE_KEYS.bannerFontFamily, selectedFont);
        }

        if (bannerFontSizeInput) {
          const selectedDefault =
            ShieldElement.prototype.getDefaultBannerFontSizeForFont(selectedFont);

          const oppositeDefault =
            ShieldElement.prototype.isHighwayGothicBannerFont(selectedFont)
              ? ShieldElement.prototype.defaultNonHighwayGothicBannerFontSize
              : ShieldElement.prototype.defaultHighwayGothicBannerFontSize;

          const currentSize = parseFloat(bannerFontSizeInput.value);

          if (
            !Number.isFinite(currentSize) ||
            Math.abs(currentSize - oppositeDefault) < 0.001
          ) {
            bannerFontSizeInput.value = selectedDefault;
          }
        }

        readForm();
      });
    }



    const arrowElemSelect = document.querySelector("#sdArrow_arrow");
    const arrowSizeInput = document.querySelector("#sdArrow_size");
    if (arrowElemSelect) {
      const arrowKeys =
        ArrowElement.prototype.arrowKeys ||
        Object.keys(ArrowElement.prototype.arrows || {});
      for (const arrowKey of arrowKeys) {
        const arrowDefinition = ArrowElement.prototype.arrows[arrowKey] || {};
        lib.appendOption(arrowElemSelect, arrowKey, {
          text: arrowDefinition.label || arrowKey,
          selected: arrowKey === ArrowElement.prototype.defaultArrow,
        });
      }
    }

    if (arrowElemSelect && arrowSizeInput) {
      arrowElemSelect.addEventListener("change", () => {
        const arrowDefinition =
          ArrowElement.prototype.arrows[arrowElemSelect.value] || null;
        const defaultSize =
          arrowDefinition &&
            typeof arrowDefinition.defaultSize === "number" &&
            !isNaN(arrowDefinition.defaultSize)
            ? arrowDefinition.defaultSize
            : ArrowElement.prototype.defaultSize;
        arrowSizeInput.value = defaultSize;
        readForm();
      });
    }

    const arrowRotationSlider = document.getElementById("sdArrow_rotation");
    const arrowRotationVal = document.getElementById("sdArrow_rotationVal");
    if (arrowRotationSlider && arrowRotationVal) {
      arrowRotationSlider.addEventListener("input", () => {
        arrowRotationVal.value = arrowRotationSlider.value;
      });
    }

    const arrowRotationButtons = document.querySelectorAll(
      ".sdArrow_rotationPreset"
    );
    for (const button of arrowRotationButtons) {
      button.addEventListener("click", () => {
        if (!arrowRotationSlider || !arrowRotationVal) {
          return;
        }
        const degrees = parseFloat(button.dataset.degrees || "0") || 0;
        arrowRotationSlider.value = degrees.toString();
        arrowRotationVal.value = degrees.toString();
        arrowRotationButtons.forEach((presetButton) => {
          presetButton.classList.toggle("activated", presetButton === button);
        });
        readForm();
      });
    }

    const arrowFlipInput = document.getElementById("sdArrow_flip");
    const arrowFlipButton = document.getElementById("sdArrow_flipButton");
    if (arrowFlipButton && arrowFlipInput) {
      arrowFlipButton.addEventListener("click", () => {
        const newValue = arrowFlipInput.value === "true" ? "false" : "true";
        arrowFlipInput.value = newValue;
        const isFlipped = newValue === "true";
        arrowFlipButton.classList.toggle("activated", isFlipped);
        arrowFlipButton.setAttribute(
          "aria-pressed",
          isFlipped ? "true" : "false"
        );
        arrowFlipButton.textContent = isFlipped ? "Unflip" : "Flip";
        readForm();
      });
    }

    document.querySelectorAll(".smallVal").forEach((valEl) => {
      const onChange = (e) => {
        const id = valEl.id || "";
        if (id.endsWith("Val")) {
          const controlId = id.slice(0, -3);
          const control = document.getElementById(controlId);
          if (control) {
            if (
              control.type === "range" ||
              control.type === "number" ||
              control.tagName === "INPUT" ||
              control.tagName === "SELECT"
            ) {
              control.value = valEl.value;
            }
          }
        }
        readForm();
      };
      valEl.addEventListener("change", onChange);
    });

    const tollLogoSelectElmt = document.getElementById("sdTollLogo_logo");
    if (tollLogoSelectElmt) {
      for (const logoKey in TollLogoElement.prototype.logos) {
        const logoDef = TollLogoElement.prototype.logos[logoKey];
        lib.appendOption(tollLogoSelectElmt, logoKey, {
          text: logoDef.label,
          selected: logoKey == TollLogoElement.prototype.defaultLogo,
        });
      }
    }

    const iconSelectElmt = document.getElementById("sdIcon_icon");
    if (iconSelectElmt) {
      for (const iconKey in IconElement.prototype.icons) {
        const iconDef = IconElement.prototype.icons[iconKey];
        lib.appendOption(iconSelectElmt, iconKey, {
          text: iconDef.label,
          selected: iconKey == IconElement.prototype.defaultIcon,
        });
      }
    }

    // Populate shield directory
    const presetShieldList = document.querySelector("#presetShieldList");

    const createShieldRow = (name, properties) => {
      const shieldCategoryType = document.createElement("div");
      const shieldCategoryImg = document.createElement("img");
      const shieldItemName = document.createElement("span");
      const shieldItemSeleted = document.createElement("span");
      shieldCategoryType.className = "shieldCategoryType";
      shieldCategoryImg.className = "shieldItemImg";
      shieldItemName.className = "shieldItemName";
      shieldItemSeleted.className =
        "shieldItemSelected material-symbols-outlined";

      shieldCategoryImg.src = Shield.prototype.getDirectoryFromShield(
        name,
        properties.variants[0] || ""
      );

      shieldItemName.textContent = properties.name;
      shieldItemSeleted.textContent = "radio_button_unchecked";

      shieldCategoryType.appendChild(shieldCategoryImg);
      shieldCategoryType.appendChild(shieldItemName);
      shieldCategoryType.appendChild(shieldItemSeleted);

      shieldCategoryType.dataset.name = name;

      return shieldCategoryType;
    };

    const createShieldCategory = (name) => {
      const shieldCategory = document.createElement("div");
      const shieldCategoryHead = document.createElement("div");
      const dropdownArrow = document.createElement("span");
      const shieldCategoryName = document.createElement("span");

      shieldCategory.className = "shieldCategory";
      shieldCategoryHead.className = "shieldCategoryHead";
      dropdownArrow.className = "material-symbols-outlined";
      dropdownArrow.textContent = "arrow_drop_down";
      shieldCategoryName.className = "shieldCategoryName";
      shieldCategoryName.textContent = name + " (Expand)";

      shieldCategoryHead.addEventListener("click", () => {
        shieldCategory.classList.toggle("open");
        dropdownArrow.textContent = shieldCategory.classList.contains("open")
          ? "arrow_drop_up"
          : "arrow_drop_down";
        shieldCategoryName.textContent =
          name +
          (shieldCategory.classList.contains("open")
            ? " (Collapse)"
            : " (Expand)");
      });

      shieldCategoryHead.appendChild(dropdownArrow);
      shieldCategoryHead.appendChild(shieldCategoryName);
      shieldCategory.append(shieldCategoryHead);
      shieldCategory.dataset.category = name;

      return shieldCategory;
    };

    const createFromDir = (dir, parentElem) => {
      for (const category in dir) {
        if (category == "type") {
          continue;
        }
        const cat = dir[category];
        if (cat.type == "category") {
          const holder = createShieldCategory(category);
          createFromDir(cat, holder);
          parentElem.appendChild(holder);
        } else if (cat.type == "shield") {
          parentElem.appendChild(createShieldRow(category, cat));
        }
      }
    };

    createFromDir(Shield.prototype.shieldDirectory, presetShieldList);

    document.querySelector("#presetShields").addEventListener("click", () => {
      document.querySelector(".shieldLibrary").dataset.tab = "presetShieldList";
      document.querySelector("#presetShields").className = "selected";
      document.querySelector("#customShields").className = "";
    });

    document.querySelector("#customShields").addEventListener("click", () => {
      document.querySelector(".shieldLibrary").dataset.tab = "uploadShield";
      document.querySelector("#customShields").className = "selected";
      document.querySelector("#presetShields").className = "";
    });

    // Search
    document
      .querySelector("#presetShieldSearch")
      .addEventListener("input", () => {
        const query = document
          .querySelector("#presetShieldSearch")
          .value.toLowerCase();
        const searchFromDir = (dir, parentElem) => {
          let hasAnything = false;
          for (const category in dir) {
            const cat = dir[category];
            if (category == "type") {
              continue;
            }

            if (cat.type == "category") {
              const childElem = parentElem.querySelector(
                '.shieldCategory[data-category="' + category + '"]'
              );
              if (searchFromDir(cat, childElem)) {
                hasAnything = true;
                childElem.classList.remove("hidden");

                if (query != "") {
                  console.log(query);
                  childElem.classList.remove("open");
                  childElem.querySelector(".shieldCategoryHead").click();
                }
              } else {
                childElem.classList.add("hidden");
                childElem.classList.add("open");
                childElem.querySelector(".shieldCategoryHead").click();
              }
            } else if (
              cat.type == "shield" &&
              cat.name.toLowerCase().includes(query)
            ) {
              hasAnything = true;
              parentElem.querySelector(
                '.shieldCategoryType[data-name="' + category + '"]'
              ).style.display = "";
            } else {
              parentElem.querySelector(
                '.shieldCategoryType[data-name="' + category + '"]'
              ).style.display = "none";
            }
          }
          return hasAnything;
        };
        searchFromDir(Shield.prototype.shieldDirectory, presetShieldList);
        bindAllFontPreviewSelects(document);
      });
  };
    
/* END OF INITUI */

  // Show/hide dependent small inputs for a given block (e.g. sdCtrlText, sdAdvisory, sdActionMessage, sdIcon)
  const setDependentVisibility = (block) => {
    const el = (id) => document.getElementById(id);

    const toggleTargets = (checkboxId, targetIds) => {
      const chk = el(checkboxId);
      if (!chk) return;
      for (const tid of targetIds) {
        const target = el(tid);
        if (!target) continue;
        if (chk.checked) target.classList.remove("hidden");
        else target.classList.add("hidden");

        const labels = document.querySelectorAll(`label[for="${tid}"]`);
        labels.forEach((label) => {
          if (chk.checked) label.classList.remove("hidden");
          else label.classList.add("hidden");
        });
      }
    };

    // numeral formatting -> _numeralFormattingSize
    toggleTargets(`${block}_useNumeralFormatting`, [
      `${block}_numeralFormattingSize`,
    ]);
    // banner formatting -> _bannerFormattingSize and _bannerFirstLetterSize
    toggleTargets(`${block}_useBannerFormatting`, [
      `${block}_bannerFormattingSize`,
      `${block}_bannerFirstLetterSize`,
    ]);
    // small capitals -> _firstLetterSize
    toggleTargets(`${block}_smallCapitals`, [`${block}_firstLetterSize`]);
    // icon border -> border color / radius (sdIcon_border)
    toggleTargets(`${block}_border`, [
      `${block}_borderColor`,
      `${block}_borderRadius`,
    ]);
    toggleTargets(`${block}_background`, [
      `${block}_backgroundColor`,
      `${block}_borderRadius`,
      `${block}_horizontalPadding`,
      `${block}_verticalPadding`,
      `${block}_hasOnlyBlock`,
    ]);
  };

    
    const updateShieldCountyVisibility = () => {
      const shieldBaseEl = document.getElementById("sdShield_shieldBase");
      const countyLabel = document.getElementById("sdShield_countyTextLabel");
      const countyInput = document.getElementById("sdShield_countyText");

      if (!shieldBaseEl || !countyLabel || !countyInput) {
        return;
      }

      const selectedValue = String(shieldBaseEl.value || "").toLowerCase();
      const selectedText = String(
        shieldBaseEl.options?.[shieldBaseEl.selectedIndex]?.text || ""
      ).toLowerCase();

      const isCountyShield =
        selectedValue === "county" ||
        selectedText === "county" ||
        selectedValue.includes("county") ||
        selectedText.includes("county");

      countyLabel.classList.toggle("sdShieldCountyHidden", !isCountyShield);
      countyInput.classList.toggle("sdShieldCountyHidden", !isCountyShield);
    };

    

    const applyExitOnlyArrowVisibility = () => {
      const currentPanel = post?.panels?.[exposed?.vars?.currentlySelectedPanelIndex];
      if (!currentPanel || !currentPanel.sign) {
        return;
      }

      const exitOnlyDirectionLabel = document.getElementById("exitOnlyDirectionLabel");
      const showExitOnlyLabel = document.getElementById("showExitOnlyLabel");
      const hideExitArrowLabel = document.getElementById("hideExitArrowLabel");
      const exitOnlyDirection = document.getElementById("exitOnlyDirection");
      const showExitOnly = document.getElementById("showExitOnly");
      const hideExitArrow = document.getElementById("hideExitArrow");
        const exitOnlyDirectionHost = document.querySelector(".exitOnlyDirectionPickerHost");
      const exitOnlyBorderModeLabel = document.getElementById("exitOnlyBorderModeLabel");
      const exitOnlyBorderModeSelect = document.getElementById("exitOnlyBorderMode");
      const exitOnlyLeftTextLabel = document.getElementById("exitOnlyLeftTextLabel");
      const exitOnlyLeftTextInput = document.getElementById("exitOnlyLeftText");
      const exitOnlyRightTextLabel = document.getElementById("exitOnlyRightTextLabel");
      const exitOnlyRightTextInput = document.getElementById("exitOnlyRightText");

      const isExitOnlyMode =
        currentPanel.sign.guideArrow === "Exit Only" ||
        currentPanel.sign.guideArrow === "Split Exit Only" ||
        currentPanel.sign.guideArrow === "Half Exit Only";

      const setVisible = (el, visible) => {
        if (!el) return;
        el.classList.toggle("invisible", !visible);
        el.style.visibility = visible ? "visible" : "hidden";
      };

      setVisible(exitOnlyDirectionLabel, isExitOnlyMode);
      setVisible(showExitOnlyLabel, isExitOnlyMode);
        setVisible(exitOnlyDirection, isExitOnlyMode);
        setVisible(exitOnlyDirectionHost, isExitOnlyMode);
      setVisible(showExitOnly, isExitOnlyMode);
      setVisible(hideExitArrowLabel, isExitOnlyMode);
      setVisible(hideExitArrow, isExitOnlyMode);
      setVisible(exitOnlyLeftTextLabel, isExitOnlyMode);
      setVisible(exitOnlyLeftTextInput, isExitOnlyMode);
      setVisible(exitOnlyRightTextLabel, isExitOnlyMode);
      setVisible(exitOnlyRightTextInput, isExitOnlyMode);

      const shouldShowBorderMode =
        isExitOnlyMode &&
        !post.secondExitOnly &&
        (currentPanel.sign.guideArrow === "Half Exit Only" ||
          currentPanel.sign.guideArrow === "Exit Only");

      setVisible(exitOnlyBorderModeLabel, shouldShowBorderMode);
      setVisible(exitOnlyBorderModeSelect, shouldShowBorderMode);
    };
    const getDefaultBannerType = () =>
      ShieldElement.prototype.defaultBannerType || "None";

    const normalizeManualBannerText = (value) =>
      String(value || "").trim();

    const findManualBannerOptionCaseInsensitive = (value) => {
      const normalized = normalizeManualBannerText(value).toLowerCase();

      if (!normalized) {
        return getDefaultBannerType();
      }

      const options = Shield.prototype.bannerTypes || [];

      return (
        options.find(
          (option) => String(option).toLowerCase() === normalized
        ) || null
      );
    };

    const syncManualBannerInputMode = ({ convert = false } = {}) => {
      const manualCheckbox = document.getElementById("sdShield_manualBanners");

      const bannerPairs = [
        {
          select: document.getElementById("sdShield_bannerType"),
          input: document.getElementById("sdShield_bannerCustomText"),
        },
        {
          select: document.getElementById("sdShield_bannerType2"),
          input: document.getElementById("sdShield_bannerCustomText2"),
        },
      ];

      const manual = !manualCheckbox || manualCheckbox.checked;

      bannerPairs.forEach(({ select, input }) => {
        if (!select || !input) {
          return;
        }

        if (convert) {
          if (manual) {
            input.value = select.value || getDefaultBannerType();
          } else {
            const matchedOption = findManualBannerOptionCaseInsensitive(input.value);
            select.value = matchedOption || getDefaultBannerType();
            input.value = "";
          }
        }

        select.hidden = manual;
        input.hidden = !manual;
      });
    };
    
  const updateExitTabLeftControlVisibility = (exitNumberValue) => {
    const hasExitNumber = String(exitNumberValue || "").trim() !== "";

    const showLeftLabel = document.getElementById("showLeftLabel");
    const showLeft = document.getElementById("showLeft");

    if (showLeftLabel) {
      showLeftLabel.style.display = "";
    }

    if (showLeft) {
      showLeft.style.display = "";
    }

    return hasExitNumber;
  };
  
  const updateExitTabBilingualControls = (exitTab = {}) => {
    const isBilingual = exitTab.bilingual === true;

    const mainSettingsGrid = document.getElementById("exitTabMainSettingsGrid");
    const exitNumberLabel = document.getElementById("exitNumberLabel");
    const bilingualCheckbox = document.getElementById("exitTabBilingual");
    const bottomTextLabel = document.getElementById("exitTabBilingualBottomTextLabel");
    const bottomTextInput = document.getElementById("exitTabBilingualBottomText");

    if (mainSettingsGrid) {
      mainSettingsGrid.classList.toggle("bilingualMode", isBilingual);
    }

    if (exitNumberLabel) {
      exitNumberLabel.textContent = isBilingual ? "Top:" : "Text:";
    }

    if (bilingualCheckbox) {
      bilingualCheckbox.checked = isBilingual;
    }

    if (bottomTextLabel) {
      bottomTextLabel.hidden = !isBilingual;
    }

    if (bottomTextInput) {
      bottomTextInput.hidden = !isBilingual;

      if (isBilingual && !bottomTextInput.value.trim()) {
        bottomTextInput.value = exitTab.bilingualBottomText || "SORTIE";
      }
    }
  };
    
  // Handle Form
  // Read the form and update the page by redrawing it.
  const readForm = function () {
    syncPostReference();
    if (
        exposed &&
        typeof exposed.beginUndoableChange === "function"
      ) {
        exposed.beginUndoableChange();
      }
    try {
    const form = document.forms[0];
    const currentPanel = exposed.getCurrentPanel();
    const selectedSubPanelIndex = exposed.vars.currentlySelectedSubPanelIndex;
    const subPanel =
      selectedSubPanelIndex >= 0
        ? currentPanel.sign.subPanels[selectedSubPanelIndex]
        : exposed.getCurrentSubPanel();

    if (!subPanel) {
      return;
    }
    const exitTab =
      exposed.vars.currentlySelectedNestedExitTabIndex != -1
        ? currentPanel.exitTabs[exposed.vars.currentlySelectedExitTabIndex]
          .nestedExitTabs[exposed.vars.currentlySelectedNestedExitTabIndex]
        : currentPanel.exitTabs[exposed.vars.currentlySelectedExitTabIndex];

    // Post
    post.polePosition = form["postPosition"].value;
    const requestedPostColor = form["postColor"] ? form["postColor"].value : null;
    if (
      requestedPostColor &&
      Array.isArray(Post.prototype.colors) &&
      Post.prototype.colors.includes(requestedPostColor)
    ) {
      post.color = requestedPostColor;
    }
    post.showPost = form["showPost"].checked;
    post.secondExitOnly = form["secondExitOnly"].checked;
    setStoredItem(STORAGE_KEYS.postPosition, post.polePosition);
    setStoredItem(STORAGE_KEYS.showPost, String(!!post.showPost));
    setStoredItem(STORAGE_KEYS.postColor, post.color);

    // Panel
    currentPanel.color = form["panelColor"].value;
    currentPanel.corner = form["panelCorner"].value;
    const panelBorderRadiusInput = parseFloat(form["panelBorderRadius"].value);
    currentPanel.borderRadius = Number.isFinite(panelBorderRadiusInput)
      ? Math.max(0, panelBorderRadiusInput)
      : Panel.prototype.defaultBorderRadius;

    post.disableFlash = form["disableFlash"].checked;

    // Exit Tab
    exitTab.number = form["exitNumber"].value;
      const exitTabBilingualField = form["exitTabBilingual"];
      const exitTabBilingualBottomTextField = form["exitTabBilingualBottomText"];

      exitTab.bilingual =
        exitTabBilingualField && typeof exitTabBilingualField.checked === "boolean"
          ? exitTabBilingualField.checked
          : false;

      exitTab.bilingualTopText = "EXIT";

      exitTab.bilingualBottomText =
        exitTabBilingualBottomTextField &&
        typeof exitTabBilingualBottomTextField.value === "string" &&
        exitTabBilingualBottomTextField.value.trim().length
          ? exitTabBilingualBottomTextField.value
          : "SORTIE";

      updateExitTabBilingualControls(exitTab);
    exitTab.width = exitTab.number.trim() === ""
        ? "Edge"
        : form["exitTabWidth"].value;
        const exitTabPositionField = form["exitTabPosition"];
        const showLeftField = form["showLeft"];

        const hasExitNumberText = updateExitTabLeftControlVisibility(exitTab.number);

        const previousPosition = exitTab.position || "Right";
        const previousShowLeft = exitTab.showLeft === true;

        let nextExitTabPosition = exitTabPositionField
          ? exitTabPositionField.value || previousPosition
          : previousPosition;

        let nextShowLeft = showLeftField
          ? showLeftField.checked
          : previousShowLeft;

        const activeElement = document.activeElement;
        const changedLeftCheckbox = showLeftField && activeElement === showLeftField;
        const changedPositionDropdown =
          exitTabPositionField && activeElement === exitTabPositionField;

        /*
          Left checkbox:
          - checking it forces position to Left
          - unchecking it does NOT move position away from Left
        */
        if (changedLeftCheckbox) {
          if (nextShowLeft) {
            nextExitTabPosition = "Left";
          }
        }
      
        if (changedPositionDropdown) {
          nextShowLeft = nextExitTabPosition === "Left";
        }

        exitTab.position = nextExitTabPosition;
        exitTab.showLeft = nextShowLeft;

        if (exitTabPositionField) {
          exitTabPositionField.value = exitTab.position;
        }

        if (showLeftField) {
          showLeftField.checked = exitTab.showLeft;
        }
        
    exitTab.color = form["exitColor"].value;
    exitTab.variant = form["exitVariant"].value;

    toggleExitTabVariantOptionsVisibility(exitTab.variant);
        
        const currentSign = currentPanel?.sign;

        if (currentSign) {
        const qcEnabled = document.getElementById("qcExitMarkerEnabled");
        const qcNumber = document.getElementById("qcExitMarkerNumber");
        const qcPosition = document.getElementById("qcExitMarkerPosition");
        const qcFlipped = document.getElementById("qcExitMarkerFlipped");
        const qcSize = document.getElementById("qcExitMarkerSize");
        const qcSizeValue = document.getElementById("qcExitMarkerSizeValue");

        if (qcEnabled) {
        currentSign.quebecExitMarkerEnabled = !!qcEnabled.checked;
        }

        if (qcNumber) {
        currentSign.quebecExitMarkerNumber = qcNumber.value || "1";
        }

        if (qcPosition) {
          currentSign.quebecExitMarkerPosition = String(qcPosition.value || "Center")
            .replace(/^Bottom\s+/i, "")
            .trim();
        }

        if (qcFlipped) {
        currentSign.quebecExitMarkerFlipped = !!qcFlipped.checked;
        }
        if (qcSize) {
          const parsedSize = parseFloat(qcSize.value);
          const resolvedSize =
            Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : 3.05;

          currentSign.quebecExitMarkerSizeRem = resolvedSize;

          if (qcSizeValue) {
            qcSizeValue.textContent = resolvedSize.toString();
          }
        }
    }

    const resolveDefaultTollLogoSize = () =>
      typeof ExitTab.prototype.defaultTollLogoSize === "number"
        ? ExitTab.prototype.defaultTollLogoSize
        : 3;
    const tollLogoSizeField = form["exitTollLogoSize"];
    const parsedTollLogoSize =
      tollLogoSizeField && tollLogoSizeField.value !== ""
        ? parseFloat(tollLogoSizeField.value)
        : NaN;
    const normalizedTollLogoSize =
      Number.isFinite(parsedTollLogoSize) && parsedTollLogoSize > 0
        ? parsedTollLogoSize
        : Number.isFinite(exitTab.tollLogoSize) && exitTab.tollLogoSize > 0
          ? exitTab.tollLogoSize
          : resolveDefaultTollLogoSize();
    exitTab.tollLogoSize = normalizedTollLogoSize;
    if (tollLogoSizeField) {
      tollLogoSizeField.value = normalizedTollLogoSize;
    }
    const tollLogoSizeValueElmt = document.getElementById(
      "exitTollLogoSizeValue"
    );
    if (tollLogoSizeValueElmt) {
      tollLogoSizeValueElmt.textContent = normalizedTollLogoSize.toString();
    }

    if (exitTab.variant == "Toll Logo") {
      const tollLogoSelectField = form["exitTollLogoSelect"];
      const tollLogoOptions = TollLogoElement.prototype.logos;
      let selectedLogo =
        tollLogoSelectField && tollLogoSelectField.value
          ? tollLogoSelectField.value
          : null;
      if (!tollLogoOptions || !tollLogoOptions[selectedLogo]) {
        selectedLogo =
          tollLogoOptions && TollLogoElement.prototype.defaultLogo
            ? TollLogoElement.prototype.defaultLogo
            : null;
      }
      exitTab.icon = selectedLogo;
      exitTab.useTextBasedIcon = false;
      const tollLogoOnlyField = form["exitTollLogoOnly"];
      exitTab.tollLogoOnly =
        tollLogoOnlyField && typeof tollLogoOnlyField.checked === "boolean"
          ? tollLogoOnlyField.checked
          : true;
      const tollLogoSquareField = form["exitTollLogoSquare"];
      exitTab.tollLogoSquare =
        tollLogoSquareField && typeof tollLogoSquareField.checked === "boolean"
          ? tollLogoSquareField.checked
          : false;
    } else if (exitTab.variant == "Icon") {
      const iconSelectField = form["iconSelect"];
      exitTab.icon = iconSelectField ? iconSelectField.value : null;
      exitTab.useTextBasedIcon = false;
    } else {
      exitTab.icon = null;
      exitTab.useTextBasedIcon = false;
      exitTab.tollLogoOnly =
        typeof exitTab.tollLogoOnly === "boolean" ? exitTab.tollLogoOnly : true;
      exitTab.tollLogoSquare = !!exitTab.tollLogoSquare;
    }

        const exitFontCheckbox = form["exitFont"];
        const fontSizeInput = form["fontSize"];
        const minHeightInput = form["minHeight"];

        const previousFHWAState =
          exitFontCheckbox?.dataset.lastFhwaState !== undefined
            ? exitFontCheckbox.dataset.lastFhwaState === "true"
            : !!exitTab.FHWAFont;

        const nextFHWAState = !!exitFontCheckbox?.checked;

        const setExitTabSliderValue = (input, valueId, value) => {
          if (input) {
            input.value = String(value);
          }

          const valueEl = document.getElementById(valueId);
          if (valueEl) {
            valueEl.innerHTML = String(value);
          }
        };

        /*
          Only auto-adjust when the FHWA checkbox itself was changed.
          Editing subpanels, text, shields, or other fields should not touch these sliders.
        */
        if (
          exitFontCheckbox &&
          exitTabFontCheckboxChangedByUser &&
          previousFHWAState !== nextFHWAState
        ) {
          if (nextFHWAState === true) {
            setExitTabSliderValue(fontSizeInput, "fontValue", 18);
            setExitTabSliderValue(minHeightInput, "minValue", 2);
          } else {
            setExitTabSliderValue(fontSizeInput, "fontValue", 20);
            setExitTabSliderValue(minHeightInput, "minValue", 2.5);
          }
        }

        if (exitFontCheckbox) {
          exitFontCheckbox.dataset.lastFhwaState = String(nextFHWAState);
        }

        exitTabFontCheckboxChangedByUser = false;
        exitTab.FHWAFont = nextFHWAState;

        const hasExitNumberForLeft =
          String(exitTab.number || "").trim() !== "";

        if (!hasExitNumberForLeft) {
          exitTab.showLeft = false;
        }

        exitTab.fullBorder = form["fullBorder"].checked;
        exitTab.squareCorners = form["squareCorners"].checked;
        exitTab.topOffset = form["topOffset"].checked;
        exitTab.verticalArrangement = form["verticalArrangement"].checked;
        exitTab.caStyle = form["caStyle"].checked;

        setStoredItem(STORAGE_KEYS.exitTabFHWAFont, String(!!exitTab.FHWAFont));
        setStoredItem(STORAGE_KEYS.exitTabFullBorder, String(!!exitTab.fullBorder));
        setStoredItem(STORAGE_KEYS.exitTabSquareCorners, String(!!exitTab.squareCorners));
        setStoredItem(STORAGE_KEYS.exitTabTopOffset, String(!!exitTab.topOffset));

        const borderThicknessInput = parseFloat(form["borderThickness"].value);
        exitTab.borderThickness = Number.isFinite(borderThicknessInput)
          ? Math.max(0, borderThicknessInput)
          : ExitTab.prototype.defaultBorderThickness;

        exitTab.minHeight = form["minHeight"].value;
        exitTab.fontSize = form["fontSize"].value;

        const parentExitTab = currentPanel.exitTabs[exposed.vars.currentlySelectedExitTabIndex];
        const nestedTabSpacingInput = parseFloat(form["nestedTabSpacing"]?.value);
        if (parentExitTab) {
          parentExitTab.nestedTabSpacing = Number.isFinite(nestedTabSpacingInput)
            ? Math.max(0, nestedTabSpacingInput)
            : 0;
        }
    // Misc Shields
    currentPanel.sign.shieldBacks = form["shieldBacks"].checked;

    // Sign
    currentPanel.sign.padding =
      form["paddingTop"].value.toString() +
      "rem " +
      form["paddingRight"].value.toString() +
      "rem " +
      form["paddingBottom"].value.toString() +
      "rem " +
      form["paddingLeft"].value.toString() +
      "rem";
    // Global Settings
    if (form["globalPosition"]) {
      currentPanel.sign.globalPositioning = form["globalPosition"].value;
    }
      
    // Shields
    for (
      let shieldIndex = 0, length = subPanel.shields.length;
      shieldIndex < length;
      shieldIndex++
    ) {
      let shield = subPanel.shields[shieldIndex];
      shield.type = document.getElementById(`shield${shieldIndex}_type`).value;
      shield.routeNumber = document.getElementById(
        `shield${shieldIndex}_routeNumber`
      ).value;
      shield.to = document.getElementById(`shield${shieldIndex}_to`).checked;
      shield.bannerType = document.getElementById(
        `shield${shieldIndex}_bannerType`
      ).value;
      const customBannerInput = document.getElementById(
        `shield${shieldIndex}_bannerCustomText`
      );
      const customBannerText =
        customBannerInput && customBannerInput.value
          ? customBannerInput.value.trim()
          : "";
      shield.bannerType = customBannerText || shield.bannerType;
      shield.bannerPosition = document.getElementById(
        `shield${shieldIndex}_bannerPosition`
      ).value;
      shield.bannerType2 = document.getElementById(
        `shield${shieldIndex}_bannerType2`
      ).value;
      const customBannerInput2 = document.getElementById(
        `shield${shieldIndex}_bannerCustomText2`
      );
      const customBannerText2 =
        customBannerInput2 && customBannerInput2.value
          ? customBannerInput2.value.trim()
          : "";
      shield.bannerType2 = customBannerText2 || shield.bannerType2;
      shield.specialBannerType =
        document.getElementById(`shield${shieldIndex}_specialBannerType`)
          .value || "None";
      shield.indentFirstLetter = document.getElementById(
        `shield${shieldIndex}_indentFirstLetter`
      ).checked;
      const indentSecondElmt = document.getElementById(
        `shield${shieldIndex}_indentFirstLetter2`
      );
      shield.indentFirstLetter2 =
        indentSecondElmt && typeof indentSecondElmt.checked === "boolean"
          ? indentSecondElmt.checked
          : shield.indentFirstLetter;
      shield.fontSize =
        String(document.getElementById(`shield${shieldIndex}_fontSize`).value) +
        "rem";

      const specialBannerTypeSelectElmt = document.getElementById(
        `shield${shieldIndex}_specialBannerType`
      );

      if (Shield.prototype.specialBannerTypes[shield.type] != undefined) {
        while (specialBannerTypeSelectElmt.firstChild) {
          specialBannerTypeSelectElmt.removeChild(
            specialBannerTypeSelectElmt.firstChild
          );
        }

        for (const specialBannerType of Object.keys(
          Shield.prototype.specialBannerTypes[shield.type]
        )) {
          if (exposed.checkSpecialShield(shieldIndex, specialBannerType)) {
            const optionElmt = document.createElement("option");
            optionElmt.value = specialBannerType;
            optionElmt.selected =
              shield.specialBannerType == specialBannerType || false;
            optionElmt.appendChild(document.createTextNode(specialBannerType));
            specialBannerTypeSelectElmt.appendChild(optionElmt);
          } else {
            if (shield.specialBannerType == specialBannerType) {
              shield.specialBannerType = "None";
            }
          }
        }

        let optionElmt = document.createElement("option");
        optionElmt.value = "None";
        optionElmt.selected = "None" == shield.specialBannerType || false;
        optionElmt.appendChild(document.createTextNode("None"));
        specialBannerTypeSelectElmt.appendChild(optionElmt);
        specialBannerTypeSelectElmt.style.visibility = "";
      } else {
        shield.specialBannerType = "None";
        specialBannerTypeSelectElmt.style.visibility = "hidden";
      }
    }

    // Control Text Revision
    const currentBlockElem = exposed.getCurrentBlockElem();
    const blockElemType =
      Control.prototype.blockInternalElements[
      Control.prototype.blockToClassElems.getElem(currentBlockElem)
      ];
    for (const propertyName in currentBlockElem) {
      const elementId = `${blockElemType}_${propertyName}`;
      const element = document.getElementById(elementId);

        if (element) {
          if (blockElemType === "sdShield" && propertyName === "shieldBase") {
            const selectedShieldBase = syncShieldBasePickerValue(
              currentBlockElem.shieldBase ||
                currentBlockElem.type ||
                element.dataset?.pickerValue ||
                element.value ||
                ShieldElement.prototype.defaultShieldBase ||
                "I",
              { updateBlock: true }
            );

            currentBlockElem.shieldBase = selectedShieldBase;
            currentBlockElem.type = selectedShieldBase;
            continue;
          }

          const handleCustomBanner =
            blockElemType === "sdShield" &&
            (propertyName === "bannerType" || propertyName === "bannerType2");

          if (handleCustomBanner) {
            const manualCheckbox = document.getElementById("sdShield_manualBanners");
            const manualBanners = !manualCheckbox || manualCheckbox.checked;

            const customInputId =
              propertyName === "bannerType"
                ? "sdShield_bannerCustomText"
                : "sdShield_bannerCustomText2";

            const customInput = document.getElementById(customInputId);

            if (manualBanners) {
              const customValue =
                customInput && typeof customInput.value === "string"
                  ? customInput.value.trim()
                  : "";

              currentBlockElem[propertyName] =
                customValue || ShieldElement.prototype.defaultBannerType || "None";
            } else {
              const selectedValue = element.tagName === "SELECT"
                ? element.value
                : ShieldElement.prototype.defaultBannerType || "None";

              currentBlockElem[propertyName] =
                selectedValue || ShieldElement.prototype.defaultBannerType || "None";
            }

            continue;
          }
        if (element.type === "checkbox") {
          currentBlockElem[propertyName] = element.checked;
        } else if (element.type === "radio") {
          if (element.checked) {
            currentBlockElem[propertyName] = element.value;
          }
        } else if (element.tagName === "SELECT") {
          currentBlockElem[propertyName] = element.value;
        } else {
          currentBlockElem[propertyName] = element.value;
        }
      }
    }
    if (blockElemType === "sdShield") {
      ensureSdShieldBasePicker();

      const manualCheckbox = document.getElementById("sdShield_manualBanners");
      currentBlockElem.manualBanners = !manualCheckbox || manualCheckbox.checked;

      const roadNameInput = document.getElementById("sdShield_roadName");
      currentBlockElem.roadName = roadNameInput
        ? String(roadNameInput.value || "").trim()
        : "";

      syncManualBannerInputMode();
    }

    if (blockElemType === "sdShield") {
      currentBlockElem.shieldSize =
        ShieldElement.prototype.normalizeShieldSize(
          currentBlockElem.shieldSize
        );
      currentBlockElem.scaleBannersWithShield =
        ShieldElement.prototype.normalizeScaleBannersWithShield(
          currentBlockElem.scaleBannersWithShield
        );
    }
    updateShieldCountyVisibility();

    if (blockElemType === "sdArrow") {
      currentBlockElem.flip =
        currentBlockElem.flip === true ||
        currentBlockElem.flip === "true" ||
        currentBlockElem.flip === 1 ||
        currentBlockElem.flip === "1" ||
        currentBlockElem.flip === "on";

      const validArrowAlignments = Array.isArray(TextElement.prototype.alignment)
        ? TextElement.prototype.alignment
        : ["Left", "Center", "Right"];

      currentBlockElem.alignment = validArrowAlignments.includes(
        currentBlockElem.alignment
      )
        ? currentBlockElem.alignment
        : "Center";
    }

    subPanel.blockElements.blockProperties[
      exposed.vars.currentlySelectedRowIndex
    ].topPadding = document.querySelector("#sdBlock_topPadding").value;
    subPanel.blockElements.blockProperties[
      exposed.vars.currentlySelectedRowIndex
    ].bottomPadding = document.querySelector("#sdBlock_bottomPadding").value;
    subPanel.blockElements.blockProperties[
      exposed.vars.currentlySelectedRowIndex
    ].backgroundColor = document.querySelector(
      "#sdBlock_backgroundColor"
    ).value;
    subPanel.blockElements.blockProperties[
      exposed.vars.currentlySelectedRowIndex
    ].borderColor = document.querySelector("#sdBlock_borderColor").value;
    subPanel.blockElements.blockProperties[
      exposed.vars.currentlySelectedRowIndex
    ].backgroundFullWidth = document.querySelector(
      "#sdBlock_backgroundFullWidth"
    ).checked;
    subPanel.blockElements.blockProperties[
      exposed.vars.currentlySelectedRowIndex
    ].width = document.querySelector("#sdBlock_width").value;
    subPanel.blockElements.blockProperties[
      exposed.vars.currentlySelectedRowIndex
    ].stretchLeft = document.querySelector("#sdBlock_stretchLeft").checked;
    subPanel.blockElements.blockProperties[
      exposed.vars.currentlySelectedRowIndex
    ].stretchCenter = document.querySelector("#sdBlock_stretchCenter").checked;
    subPanel.blockElements.blockProperties[
      exposed.vars.currentlySelectedRowIndex
    ].stretchRight = document.querySelector("#sdBlock_stretchRight").checked;

    if (
      currentPanel.sign.subPanels.length > 1 &&
      exposed.vars.currentlySelectedSubPanelIndex == 0
    ) {
      subPanel.width = parseInt(form["subPanelLength"].value);
    } else if (exposed.vars.currentlySelectedSubPanelIndex != 0) {
      const subPanelHeightField = form["subPanelHeight"];
      const rawHeightValue =
        subPanelHeightField && typeof subPanelHeightField.value === "string"
          ? subPanelHeightField.value.trim()
          : "";
      const hasCustomHeight = !!rawHeightValue;
      subPanel.customDividerHeight = hasCustomHeight;
      subPanel.height = SubPanels.normalizeHeight(
        hasCustomHeight ? rawHeightValue : undefined
      );
      subPanel.width = parseInt(form["subPanelLength"].value);
    }

    currentPanel.sign.shieldPosition = form["shieldsPosition"].value;
    var guideArrow_result = form["guideArrow"].value;

    for (const guideArrow_value of Sign.prototype.guideArrows) {
      if (guideArrow_result == guideArrow_value.split(":")[0]) {
        guideArrow_result = guideArrow_value;
        break;
      }
    }

        currentPanel.sign.guideArrow = guideArrow_result;

        if (guideArrow_result !== "None") {
          currentPanel.sign.arrowMode = "standard";
        } else if (currentPanel.sign.arrowMode !== "apl") {
          currentPanel.sign.arrowMode = "standard";
        }

        currentPanel.sign.guideArrowLanes = form["guideArrowLanes"].value;
        currentPanel.sign.arrowPosition = form["arrowLocations"].value;

    var exitOnlyDirection_result = form["exitOnlyDirection"].value;

    for (const exitOnlyDirection_value of Sign.prototype.exitguideArrows) {
      if (exitOnlyDirection_result == exitOnlyDirection_value.split(":")[0]) {
        exitOnlyDirection_result = exitOnlyDirection_value;
        break;
      }
    }
        
    

        if (currentPanel.sign.guideArrow == "Half Exit Only") {
          currentPanel.sign.arrowPosition = form["arrowLocations"].value;

          for (const arrowPosition of Sign.prototype.arrowPositions) {
            if (
              !form["arrowLocations"].querySelector(
                `option[value="${arrowPosition}"]`
              )
            ) {
              lib.appendOption(form["arrowLocations"], arrowPosition);
            }
          }
        } else if (
      currentPanel.sign.guideArrow == "Exit Only" &&
      (currentPanel.sign.guideArrowLanes == 1 ||
        currentPanel.sign.guideArrowLanes == 2)
    ) {
      currentPanel.sign.arrowPosition = form["arrowLocations"].value;

      for (const arrowPosition of Sign.prototype.arrowPositions) {
        if (
          !form["arrowLocations"].querySelector(
            `option[value="${arrowPosition}"]`
          )
        ) {
          lib.appendOption(form["arrowLocations"], arrowPosition);
        }
      }
    } else {
      currentPanel.sign.arrowPosition = form["arrowLocations"].value;

      if (!form["arrowLocations"].querySelector("option[value=Middle]")) {
        lib.appendOption(form["arrowLocations"], "Middle");
      }
    }

    const useCanadianDownArrowField = form["useCanadianDownArrows"];
    currentPanel.sign.useCanadianDownArrows = !!(
      useCanadianDownArrowField && useCanadianDownArrowField.checked
    );

    currentPanel.sign.exitguideArrows = exitOnlyDirection_result;
    currentPanel.sign.showExitOnly = form["showExitOnly"].checked;
    currentPanel.sign.hideExitArrow = form["hideExitArrow"]
      ? form["hideExitArrow"].checked
      : false;
    const borderModeField = form["exitOnlyBorderMode"];
    if (borderModeField) {
      const selectedMode = borderModeField.value;
      currentPanel.sign.exitOnlyBorderMode = Sign.prototype.exitOnlyBorderModes.includes(
        selectedMode
      )
        ? selectedMode
        : Sign.prototype.exitOnlyBorderModes[0];
    } else {
      currentPanel.sign.exitOnlyBorderMode = Sign.prototype.exitOnlyBorderModes[0];
    }
    currentPanel.sign.exitOnlyLeftText = form["exitOnlyLeftText"]
      ? form["exitOnlyLeftText"].value || ""
      : "";
    currentPanel.sign.exitOnlyRightText = form["exitOnlyRightText"]
      ? form["exitOnlyRightText"].value || ""
      : "";
    currentPanel.sign.exitOnlyLabelPreset = [
      currentPanel.sign.exitOnlyLeftText,
      currentPanel.sign.exitOnlyRightText,
    ]
      .filter((part) => part && part.trim().length > 0)
      .join(" ")
      .trim();
        const rawExitOnlyPadding = parseFloat(form["exitOnlyPadding"].value);
        currentPanel.sign.exitOnlyPadding = Number.isFinite(rawExitOnlyPadding)
          ? rawExitOnlyPadding
          : 0.25;

    currentPanel.sign.otherSymbol = form["otherSymbol"].value;
    currentPanel.sign.oSNum = form["oSNum"].value;

    // Other Symbols Extra
    if (currentPanel.sign.otherSymbol != "None") {
      form["oSNum"].style.display = "block";
    } else {
      form["oSNum"].style.display = "none";
    }

    applyExitOnlyArrowVisibility();
    
    var paddingValues = currentPanel.sign.padding.split("rem");

    var left = parseFloat(paddingValues[3]);
    var ctop = parseFloat(paddingValues[0]);
    var right = parseFloat(paddingValues[1]);
    var bottom = parseFloat(paddingValues[2]);

    const paddingLeft = document.getElementById("paddingLeft");
    const paddingTop = document.getElementById("paddingTop");
    const paddingRight = document.getElementById("paddingRight");
    const paddingBottom = document.getElementById("paddingBottom");

    paddingLeft.value = left;
    paddingTop.value = ctop;
    paddingRight.value = right;
    paddingBottom.value = bottom;

    updateForm();
    exposed.redraw();
    } finally {
        if (
        exposed &&
        typeof exposed.endUndoableChange === "function"
        ) {
        exposed.endUndoableChange();
        }
    }
};

  /**
   * Update the fields in the form to the values of the currently selected panel.
   */
  const updateForm = function () {
    syncPostReference();
      const currentPanelLabel = document.getElementById("currentlySelectedPanel");
      if (currentPanelLabel && post && Array.isArray(post.panels)) {
        const selectedPanel =
          exposed && typeof exposed.getCurrentPanel === "function"
            ? exposed.getCurrentPanel()
            : null;

        const selectedPanelIndex = selectedPanel
          ? post.panels.indexOf(selectedPanel)
          : -1;

        const panelNumber = (selectedPanelIndex >= 0 ? selectedPanelIndex : 0) + 1;
        currentPanelLabel.textContent = "Panel " + panelNumber;
      }
      
      const currentPanel =
        exposed && typeof exposed.getCurrentPanel === "function"
          ? exposed.getCurrentPanel()
          : null;

      if (currentPanel && currentPanel.sign) {
        document.getElementById("guideArrow").value =
          String(currentPanel.sign.guideArrow || "None").split(":")[0];

        document.getElementById("guideArrowLanes").value =
          currentPanel.sign.guideArrowLanes ?? 1;

        document.getElementById("arrowLocations").value =
          currentPanel.sign.arrowPosition || "Middle";

        document.getElementById("exitOnlyDirection").value =
          String(currentPanel.sign.exitguideArrows || "").split(":")[0];
      }

      const setupAssetSelectorModal = ({
        buttonId,
        modalId,
        closeId,
        searchId,
        gridId,
        inputId,
        labelId,
        sourceObject,
        defaultKey,
        itemClassName = "",
        previewClassName = "",
        currentLabelPrefix = "Current: ",
        shouldReadForm = true,
      }) => {
        const chooseBtn = document.getElementById(buttonId);
        const modal = document.getElementById(modalId);
        const closeBtn = document.getElementById(closeId);
        const search = document.getElementById(searchId);
        const grid = document.getElementById(gridId);
        const input = document.getElementById(inputId);
        const label = document.getElementById(labelId);

        if (!chooseBtn || !modal || !grid || !input || !sourceObject) {
          return;
        }

        const getCurrentKey = () =>
          sourceObject[input.value] ? input.value : defaultKey;

        const updateCurrentLabel = () => {
          if (!label) {
            return;
          }

          const currentKey = getCurrentKey();
          const currentDef = sourceObject[currentKey];

          if (currentDef) {
            label.textContent =
              currentLabelPrefix + String(currentDef.label || currentDef.name || currentKey);
          }
        };

          const populateGrid = (filter = "") => {
            lib.clearChildren(grid);

            const filterText = String(filter || "").trim().toLowerCase();
            const currentKey = getCurrentKey();

            const entries = Object.entries(sourceObject)
              .filter(([key, definition]) => {
                const itemLabel = String(definition?.label || definition?.name || key).toLowerCase();
                const itemKey = String(key).toLowerCase();

                return (
                  !filterText ||
                  itemLabel.includes(filterText) ||
                  itemKey.includes(filterText)
                );
              })
              .sort((a, b) =>
                String(a[1]?.label || a[1]?.name || a[0]).localeCompare(
                  String(b[1]?.label || b[1]?.name || b[0])
                )
              );

            for (const [key, definition] of entries) {
              const itemLabel = String(definition?.label || definition?.name || key);
              const itemSrc = String(definition?.src || definition?.asset || definition?.url || "");

              const item = document.createElement("button");
              item.type = "button";
              item.className = ["assetGridCard", itemClassName].filter(Boolean).join(" ");
              item.title = itemLabel;
              item.dataset.assetKey = key;
              item.classList.toggle("selected", key === currentKey);

              const preview = document.createElement("span");
              preview.className = "assetGridPreview";

              if (itemSrc) {
                const img = document.createElement("img");
                img.src = itemSrc;
                img.alt = itemLabel;
                img.loading = "lazy";
                img.decoding = "async";
                img.draggable = false;

                if (previewClassName) {
                  img.classList.add(previewClassName);
                }

                img.onerror = () => {
                  item.classList.add("assetPreviewMissing");
                  preview.textContent = "?";
                  img.remove();
                };

                preview.appendChild(img);
              } else {
                item.classList.add("assetPreviewMissing");
                preview.textContent = "?";
              }

              const text = document.createElement("span");
              text.className = "assetGridLabel";
              text.textContent = itemLabel;

              item.appendChild(preview);
              item.appendChild(text);

              item.addEventListener("click", () => {
                input.value = key;
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));

                updateCurrentLabel();

                if (shouldReadForm) {
                  readForm();
                }

                modal.close();
              });

              grid.appendChild(item);
            }

            if (!entries.length) {
              const empty = document.createElement("div");
              empty.className = "assetGridEmpty";
              empty.textContent = "No matches";
              grid.appendChild(empty);
            }
          };

        if (chooseBtn.dataset.assetSelectorInitialized !== "true") {
          chooseBtn.dataset.assetSelectorInitialized = "true";

          chooseBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (search) {
              search.value = "";
            }

            populateGrid("");

            if (typeof modal.showModal === "function") {
              modal.showModal();
            } else {
              modal.setAttribute("open", "");
            }

            if (search) {
              search.focus();
            }
          });

          if (closeBtn) {
            closeBtn.addEventListener("click", (event) => {
              event.preventDefault();
              modal.close();
            });
          }

          if (search) {
            search.addEventListener("input", () => {
              populateGrid(search.value);
            });

            search.addEventListener("keydown", (event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                modal.close();
              }
            });
          }

          modal.addEventListener("click", (event) => {
            if (event.target === modal) {
              modal.close();
            }
          });
        }

        updateCurrentLabel();
      };

      setupAssetSelectorModal({
        buttonId: "sdIcon_chooseBtn",
        modalId: "iconSelectorModal",
        closeId: "closeIconSelector",
        searchId: "iconSearch",
        gridId: "iconGrid",
        inputId: "sdIcon_icon",
        labelId: "sdIcon_selectedLabel",
        sourceObject: IconElement.prototype.icons,
        defaultKey: IconElement.prototype.defaultIcon,
        itemClassName: "IconGridCard",
        previewClassName: "iconPickerPreviewImage",
      });

      setupAssetSelectorModal({
        buttonId: "sdTollLogo_chooseBtn",
        modalId: "tollLogoSelectorModal",
        closeId: "closeTollLogoSelector",
        searchId: "tollLogoSearch",
        gridId: "tollLogoGrid",
        inputId: "sdTollLogo_logo",
        labelId: "sdTollLogo_selectedLabel",
        sourceObject: TollLogoElement.prototype.logos,
        defaultKey: TollLogoElement.prototype.defaultLogo,
        itemClassName: "tollLogoGridCard",
        previewClassName: "tollLogoPickerPreviewImage",
      });

      setupAssetSelectorModal({
        buttonId: "sdArrow_chooseBtn",
        modalId: "arrowSelectorModal",
        closeId: "closeArrowSelector",
        searchId: "arrowSearch",
        gridId: "arrowGrid",
        inputId: "sdArrow_arrow",
        labelId: "sdArrow_selectedLabel",
        sourceObject: ArrowElement.prototype.arrows,
        defaultKey: ArrowElement.prototype.defaultArrow,
        itemClassName: "arrowGridCard",
        previewClassName: "arrowPickerPreviewImage",
      });
    
      setupAssetSelectorModal({
        buttonId: "settingsDefaultsIconChooseButton",
        modalId: "iconSelectorModal",
        closeId: "closeIconSelector",
        searchId: "iconSearch",
        gridId: "iconGrid",
        inputId: "settingsDefaultsIconValue",
        labelId: "settingsDefaultsIconCurrent",
        sourceObject: IconElement.prototype.icons,
        defaultKey: IconElement.prototype.defaultIcon,
        itemClassName: "iconGridCard",
        previewClassName: "iconPickerPreviewImage",
        currentLabelPrefix: "",
        shouldReadForm: false,
      });

      setupAssetSelectorModal({
        buttonId: "settingsDefaultsTollLogoChooseButton",
        modalId: "tollLogoSelectorModal",
        closeId: "closeTollLogoSelector",
        searchId: "tollLogoSearch",
        gridId: "tollLogoGrid",
        inputId: "settingsDefaultsTollLogoValue",
        labelId: "settingsDefaultsTollLogoCurrent",
        sourceObject: TollLogoElement.prototype.logos,
        defaultKey: TollLogoElement.prototype.defaultLogo,
        itemClassName: "tollLogoGridCard",
        previewClassName: "tollLogoPickerPreviewImage",
        currentLabelPrefix: "",
        shouldReadForm: false,
      });

      setupAssetSelectorModal({
        buttonId: "settingsDefaultsArrowChooseButton",
        modalId: "arrowSelectorModal",
        closeId: "closeArrowSelector",
        searchId: "arrowSearch",
        gridId: "arrowGrid",
        inputId: "settingsDefaultsArrowValue",
        labelId: "settingsDefaultsArrowCurrent",
        sourceObject: ArrowElement.prototype.arrows,
        defaultKey: ArrowElement.prototype.defaultArrow,
        itemClassName: "arrowGridCard",
        previewClassName: "arrowPickerPreviewImage",
        currentLabelPrefix: "",
        shouldReadForm: false,
      });

    const panel = exposed.getCurrentPanel();
    const sign =
      exposed.vars.currentlySelectedSubPanelIndex >= 0
        ? panel.sign.subPanels[exposed.vars.currentlySelectedSubPanelIndex]
        : exposed.getCurrentSubPanel();

    const selectedExitTabIndex = exposed.vars.currentlySelectedExitTabIndex;
    const selectedNestedExitTabIndex =
      exposed.vars.currentlySelectedNestedExitTabIndex;
    const currentExitTab = panel.exitTabs[selectedExitTabIndex];

    const maxNested =
      ExitTab.prototype.maxNested != null ? ExitTab.prototype.maxNested : 1;

    if (currentExitTab && currentExitTab.nestedExitTabs.length > maxNested) {
      currentExitTab.nestedExitTabs.splice(maxNested);
    }

    if (
      currentExitTab &&
      selectedNestedExitTabIndex > -1 &&
      selectedNestedExitTabIndex >= currentExitTab.nestedExitTabs.length
    ) {
      const newNestedIndex =
        currentExitTab.nestedExitTabs.length > 0
          ? currentExitTab.nestedExitTabs.length - 1
          : -1;
      exposed.changeEditingExitTab(selectedExitTabIndex, newNestedIndex);
      return;
    }

    const exitTab =
      currentExitTab && selectedNestedExitTabIndex > -1
        ? currentExitTab.nestedExitTabs[selectedNestedExitTabIndex]
        : currentExitTab;

    const panelList = document.getElementById("panelList");
    const subPanelList = document.getElementById("subPanelList");
    const exitTabList = document.getElementById("exitTabList");
    toggleExitTabWiggle(false);
    clearExitTabDropIndicators();
    exitTabDragState = null;
    endPanelDrag();
    togglePanelListWiggle(false);

    if (exitTabList && !exitTabList.dataset.exitTabDragAttached) {
      exitTabList.addEventListener("dragover", handleExitTabDragOver);
      exitTabList.addEventListener("drop", handleExitTabDrop);
      exitTabList.addEventListener("dragleave", handleExitTabDragLeave);
      exitTabList.dataset.exitTabDragAttached = "true";
    }

    if (panelList && !panelList.dataset.panelDragAttached) {
      panelList.addEventListener("dragover", handlePanelDragOver);
      panelList.addEventListener("drop", handlePanelDrop);
      panelList.addEventListener("dragleave", handlePanelDragLeave);
      panelList.dataset.panelDragAttached = "true";
    }

    const postPositionSelectElmt = document.getElementById("postPosition");
    if (postPositionSelectElmt && post.polePosition) {
      postPositionSelectElmt.value = post.polePosition;
    }

    const postColorSelectElmt = document.getElementById("postColor");
    if (postColorSelectElmt && post.color) {
      postColorSelectElmt.value = post.color;
    }

    const showPostCheckbox = document.getElementById("showPost");
    if (showPostCheckbox) {
      showPostCheckbox.checked = !!post.showPost;
    }

    const secondExitOnlyCheckbox = document.getElementById("secondExitOnly");
    if (secondExitOnlyCheckbox) {
      secondExitOnlyCheckbox.checked = !!post.secondExitOnly;
    }

    while (panelList.firstChild) {
      panelList.removeChild(panelList.lastChild);
    }

    while (subPanelList.firstChild) {
      subPanelList.removeChild(subPanelList.lastChild);
    }

    while (exitTabList.firstChild) {
      exitTabList.removeChild(exitTabList.lastChild);
    }

      for (
        let panelIndex = 0, panelsLength = post.panels.length;
        panelIndex < panelsLength;
        panelIndex++
      ) {
        const panelRow = document.createElement("div");
        panelRow.className = "panelListRow";

        const panelButton = document.createElement("button");
        panelButton.id = "edit" + (panelIndex + 1);
        panelButton.type = "button";
        panelButton.className =
          "panelListButton" +
          (exposed.vars.currentlySelectedPanelIndex == panelIndex
            ? " active"
            : "");
        panelButton.dataset.panelIndex = panelIndex.toString();
        panelButton.draggable = post.panels.length > 1;

        const label = document.createElement("span");
        label.className = "panelListLabel";
        label.textContent = "Panel " + (panelIndex + 1);
        panelButton.appendChild(label);

        panelButton.addEventListener("click", function () {
          exposed.changeEditingPanel(panelIndex);
        });
        panelButton.addEventListener("dragstart", handlePanelDragStart);
        panelButton.addEventListener("dragend", handlePanelDragEnd);

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "panelDeleteButton";
        deleteButton.title = "Delete Panel " + (panelIndex + 1);
        deleteButton.setAttribute("aria-label", "Delete Panel " + (panelIndex + 1));

        const deleteIcon = document.createElement("span");
        deleteIcon.className = "material-symbols-outlined";
        deleteIcon.textContent = "delete";
        deleteButton.appendChild(deleteIcon);

          deleteButton.addEventListener("mousedown", function (event) {
            event.preventDefault();
            event.stopPropagation();
          });

          deleteButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();

            app.deletePanelAt(panelIndex);
          });
        panelRow.appendChild(panelButton);
        panelRow.appendChild(deleteButton);
        panelList.appendChild(panelRow);
      }

    const panelSpacingSlider = document.getElementById("panelSpacing");
    const panelSpacingValueInput =
      document.getElementById("panelSpacingValue");
    const resolvedPanelSpacing =
      typeof post.panelSpacing === "number" && post.panelSpacing >= 0
        ? post.panelSpacing
        : 0;
    if (panelSpacingSlider) {
      panelSpacingSlider.value = resolvedPanelSpacing;
    }
    if (panelSpacingValueInput) {
      panelSpacingValueInput.value = resolvedPanelSpacing;
    }

    const postThicknessValueInput =
      document.getElementById("postThicknessValue");
    const resolvedPostThickness =
      post && typeof post.normalizeThickness === "function"
        ? post.normalizeThickness(post.thickness)
        : normalizeStoredPostThickness(post ? post.thickness : undefined);
    if (post) {
      post.thickness = resolvedPostThickness;
    }
    if (postThicknessValueInput) {
      postThicknessValueInput.value = resolvedPostThickness;
    }
    
    const hasBlockElementContent = (controlData) =>
      controlData &&
      Array.isArray(controlData.rows) &&
      controlData.rows.some(
        (row) => Array.isArray(row) && row.some(Boolean)
      );

    const createSubPanelTab = ({
      id,
      label,
      subPanelIndex,
      deleteLabel,
      canDelete = true,
      emptyGlobal = false,
    }) => {
      const tabGroup = document.createElement("div");
      tabGroup.className =
        "subPanelTabGroup" +
        (exposed.vars.currentlySelectedSubPanelIndex === subPanelIndex
          ? " active"
          : "") +
        (emptyGlobal ? " emptyGlobalTab" : "") +
        (!canDelete ? " lockedSubPanelTab" : "");

      const tabButton = document.createElement("button");
      tabButton.id = id;
      tabButton.type = "button";
      tabButton.className = "subPanelTabButton";
      tabButton.textContent = label;

      tabButton.addEventListener("click", function () {
        exposed.changeEditingSubPanel(subPanelIndex);
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "subPanelTabDeleteButton";
      deleteButton.title = deleteLabel;
      deleteButton.setAttribute("aria-label", deleteLabel);
      deleteButton.disabled = !canDelete;

      const deleteIcon = document.createElement("span");
      deleteIcon.className = "material-symbols-outlined";
      deleteIcon.textContent = "delete";
      deleteButton.appendChild(deleteIcon);

      deleteButton.addEventListener("mousedown", function (event) {
        event.preventDefault();
        event.stopPropagation();
      });

      deleteButton.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();

        app.removeSubPanel(subPanelIndex);
      });

      tabGroup.appendChild(tabButton);
      tabGroup.appendChild(deleteButton);

      return tabGroup;
    };

    subPanelList.appendChild(
      createSubPanelTab({
        id: "globalTop",
        label: "Top",
        subPanelIndex: -2,
        deleteLabel: "Clear Top",
        emptyGlobal: !hasBlockElementContent(panel.sign.globalTopBlockElements),
      })
    );

    subPanelList.appendChild(
      createSubPanelTab({
        id: "globalBottom",
        label: "Bottom",
        subPanelIndex: -1,
        deleteLabel: "Clear Bottom",
        emptyGlobal: !hasBlockElementContent(panel.sign.globalBottomBlockElements),
      })
    );

    for (
      let subPanelIndex = 0, subPanelsLength = panel.sign.subPanels.length;
      subPanelIndex < subPanelsLength;
      subPanelIndex++
    ) {
      subPanelList.appendChild(
        createSubPanelTab({
          id: "sub_edit" + (subPanelIndex + 1),
          label: "Subpanel " + (subPanelIndex + 1),
          subPanelIndex,
          deleteLabel: "Delete Subpanel " + (subPanelIndex + 1),
          canDelete: panel.sign.subPanels.length > 1,
        })
      );
    }

    for (
      let exitTabIndex = 0, exitTabLength = panel.exitTabs.length;
      exitTabIndex < exitTabLength;
      exitTabIndex++
    ) {
      const exitTabGroup = document.createElement("div");
      exitTabGroup.className = "exitTabGroup";

      const exitTabButton = document.createElement("button");
      exitTabButton.type = "button";
      exitTabButton.id = "tab_edit" + (exitTabIndex + 1);
      exitTabButton.className = "exitTabButton";
      exitTabButton.textContent = "Exit Tab " + (exitTabIndex + 1);

      if (
        exposed.vars.currentlySelectedExitTabIndex === exitTabIndex &&
        exposed.vars.currentlySelectedNestedExitTabIndex === -1
      ) {
        exitTabButton.classList.add("active");
      }

      exitTabButton.addEventListener("click", function () {
        exposed.changeEditingExitTab(exitTabIndex);
      });

      exitTabButton.dataset.exitTabIndex = exitTabIndex.toString();
      exitTabButton.draggable = panel.exitTabs.length > 1;
      exitTabButton.addEventListener("dragstart", handleExitTabDragStart);
      exitTabButton.addEventListener("dragend", handleExitTabDragEnd);

      exitTabGroup.appendChild(exitTabButton);

      const nestedExitTabs =
        panel.exitTabs[exitTabIndex].nestedExitTabs || [];
      const allowedNestedLength = Math.min(
        nestedExitTabs.length,
        maxNested != null ? maxNested : nestedExitTabs.length
      );

      for (
        let nestIndex = 0;
        nestIndex < allowedNestedLength;
        nestIndex++
      ) {
        const nestedButton = document.createElement("button");
        nestedButton.type = "button";
        nestedButton.id =
          "tab_edit" + (exitTabIndex + 1) + "_nest" + (nestIndex + 1);
        nestedButton.className = "exitTabNestedButton";
        nestedButton.textContent = "Nested Exit Tab " + (nestIndex + 1);

        if (
          exposed.vars.currentlySelectedExitTabIndex === exitTabIndex &&
          exposed.vars.currentlySelectedNestedExitTabIndex === nestIndex
        ) {
          nestedButton.classList.add("active");
        }

        nestedButton.addEventListener("click", function () {
          exposed.changeEditingExitTab(exitTabIndex, nestIndex);
        });

        exitTabGroup.appendChild(nestedButton);
      }

      exitTabList.appendChild(exitTabGroup);
    }

    const addNestedButton = document.getElementById("addNestedExitTab");
    if (addNestedButton) {
      const selectedExitTab = panel.exitTabs[selectedExitTabIndex];
      const nestedCount =
        selectedExitTab && selectedExitTab.nestedExitTabs
          ? selectedExitTab.nestedExitTabs.length
          : 0;
      const limit = maxNested != null ? maxNested : 1;
      addNestedButton.disabled =
        !selectedExitTab || nestedCount >= limit;
    }

      // APL Arrow List Update
      const aplArrowList = document.getElementById("aplArrowList");
      const aplArrowTypeSelect = document.getElementById("aplArrowType");
      const selectedAPLIndex = exposed.vars.currentlySelectedAPLArrowIndex;

      const getAPLArrowKind = (arrow) => {
        if (arrow?.kind) return arrow.kind;
        if (arrow?.type === "APL_UP") return "UP";
        if (arrow?.type === "APL_UP_TURN") return arrow.flip ? "UP_LEFT" : "UP_RIGHT";
        if (arrow?.type === "APL_DUAL_TURN") return "DUAL_TURN";
        if (arrow?.type === "APL_TURN") return arrow.flip ? "LEFT_TURN" : "RIGHT_TURN";
        return "UP";
      };

      const getAPLArrowLabel = (arrow) => {
        const labels = {
          UP: "Up",
          UP_LEFT: "Up Left Turn",
          UP_RIGHT: "Up Right Turn",
          DUAL_TURN: "Dual Turn",
          LEFT_TURN: "Left Turn",
          RIGHT_TURN: "Right Turn",
        };

        return labels[getAPLArrowKind(arrow)] || "Up";
      };

      const createAPLDropZone = ({ placement, subPanelIndex, dividerAfterSubPanelIndex }) => {
        const dropZone = document.createElement("div");
        dropZone.className = "aplArrowDropZone";
        dropZone.textContent = "Drop arrow here";
        dropZone.dataset.aplDropPlacement = placement;

        if (placement === "divider") {
          dropZone.dataset.dividerAfterSubpanelIndex = String(dividerAfterSubPanelIndex);
        } else {
          dropZone.dataset.subpanelIndex = String(subPanelIndex);
        }

        dropZone.addEventListener("dragover", (event) => {
          event.preventDefault();
          dropZone.classList.add("dragOver");
        });

        dropZone.addEventListener("dragleave", () => {
          dropZone.classList.remove("dragOver");
        });

        dropZone.addEventListener("drop", (event) => {
          event.preventDefault();
          dropZone.classList.remove("dragOver");

          const fromIndex = Number(event.dataTransfer.getData("text/plain"));

          if (!Number.isFinite(fromIndex)) {
            return;
          }

          if (placement === "divider") {
            exposed.moveAPLArrow(fromIndex, {
              placement: "divider",
              dividerAfterSubPanelIndex,
            });
          } else {
            exposed.moveAPLArrow(fromIndex, {
              placement: "subpanel",
              subPanelIndex,
            });
          }
        });

        return dropZone;
      };

      let aplVisualArrowOrder = [];

      const shouldShowSpacingAfterArrow = (arrowIndex) => {
        const visualIndex = aplVisualArrowOrder.indexOf(arrowIndex);
        return visualIndex >= 0 && visualIndex < aplVisualArrowOrder.length - 1;
      };

      const createAPLArrowRow = (arrow, arrowIndex, sectionArrows, sectionLocalIndex) => {
        const arrowRow = document.createElement("div");
        arrowRow.className =
          "aplArrowListItem" + (arrowIndex === selectedAPLIndex ? " active" : "");
          arrowRow.draggable = false;
          arrowRow.dataset.aplIndex = String(arrowIndex);

          const dragHandle = document.createElement("button");
          dragHandle.type = "button";
          dragHandle.className = "aplArrowDragHandle";
          dragHandle.textContent = "☰";
          dragHandle.title = "Drag to reorder";
          dragHandle.draggable = true;

          arrowRow.addEventListener("dragstart", (event) => {
            const startedFromHandle = event.target.closest(".aplArrowDragHandle");

            if (!startedFromHandle) {
              event.preventDefault();
              event.stopPropagation();
              return;
            }

            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", String(arrowIndex));
            arrowRow.classList.add("dragging");
          });

        arrowRow.addEventListener("dragend", () => {
          arrowRow.classList.remove("dragging");
        });
          const stopControlDragStart = (element) => {
            if (!element) {
              return;
            }

            element.addEventListener("pointerdown", (event) => {
              event.stopPropagation();
            });

            element.addEventListener("mousedown", (event) => {
              event.stopPropagation();
            });

            element.addEventListener("dragstart", (event) => {
              event.preventDefault();
              event.stopPropagation();
            });
          };

        arrowRow.addEventListener("dragover", (event) => {
          event.preventDefault();
          arrowRow.classList.add("dragOver");
        });

        arrowRow.addEventListener("dragleave", () => {
          arrowRow.classList.remove("dragOver");
        });

        arrowRow.addEventListener("drop", (event) => {
          event.preventDefault();
          arrowRow.classList.remove("dragOver");

          const fromIndex = Number(event.dataTransfer.getData("text/plain"));

          if (!Number.isFinite(fromIndex)) {
            return;
          }

          if (arrow.placement === "divider") {
            exposed.moveAPLArrow(fromIndex, {
              placement: "divider",
              dividerAfterSubPanelIndex: arrow.dividerAfterSubPanelIndex,
              beforeIndex: arrowIndex,
            });
          } else {
            exposed.moveAPLArrow(fromIndex, {
              placement: "subpanel",
              subPanelIndex: arrow.subPanelIndex,
              beforeIndex: arrowIndex,
            });
          }
        });

          const currentKind = getAPLArrowKind(arrow);

          const typePickerMount = document.createElement("select");
          const typePickerHost = document.createElement("div");
          typePickerHost.className = "aplInlineTypePickerHost";
          typePickerHost.appendChild(typePickerMount);

          const typePickerApi = createFlatArrowPicker({
            mount: typePickerMount,
            value: currentKind,
            placeholder: "Arrow",
            items: APL_ARROW_PICKER_ITEMS,
            createPreviewNode: createAPLArrowPreviewNode,
            onChange: (nextValue) => {
              if (exposed && typeof exposed.updateAPLArrowType === "function") {
                exposed.updateAPLArrowType(nextValue, arrowIndex);
              }
            },
          });

          const typeSelect = typePickerApi.element;
          typeSelect.classList.add("aplInlineTypePicker");

          const sizeControl = document.createElement("div");
          sizeControl.className = "aplArrowSizeControl";

          const sizeLabel = document.createElement("span");
          sizeLabel.textContent = "Size:";

          const sizeSlider = document.createElement("input");
          sizeSlider.type = "range";
          sizeSlider.className = "aplArrowSizeSlider";
          sizeSlider.min = "1";
          sizeSlider.max = "10";
          sizeSlider.step = "0.1";
          sizeSlider.value = Number.isFinite(Number(arrow.arrowSizeRem))
            ? String(Number(arrow.arrowSizeRem))
            : "4.75";

          const sizeValue = document.createElement("span");
          sizeValue.textContent = `${sizeSlider.value} rem`;

          sizeSlider.addEventListener("input", function () {
            sizeValue.textContent = `${this.value} rem`;
          });

          sizeSlider.addEventListener("change", function () {
            if (exposed && typeof exposed.setAPLArrowSize === "function") {
              exposed.setAPLArrowSize(arrowIndex, this.value);
            }
          });
          stopControlDragStart(sizeSlider);

          sizeControl.appendChild(sizeLabel);
          sizeControl.appendChild(sizeSlider);
          sizeControl.appendChild(sizeValue);
          
        const exitOnlyLabel = document.createElement("label");
        exitOnlyLabel.className = "aplExitOnlyInlineLabel";

        const exitOnlyCheckbox = document.createElement("input");
        exitOnlyCheckbox.type = "checkbox";
        exitOnlyCheckbox.checked = arrow.exitOnly === true;

        exitOnlyCheckbox.addEventListener("change", () => {
          exposed.setAPLExitOnly(arrowIndex, exitOnlyCheckbox.checked);
        });

        exitOnlyLabel.appendChild(exitOnlyCheckbox);
        exitOnlyLabel.appendChild(document.createTextNode(" Exit Only"));

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "aplArrowDeleteButton";
        deleteButton.textContent = "Delete";

          deleteButton.addEventListener("click", () => {
            exposed.removeAPLArrowAt(arrowIndex);
          });

          stopControlDragStart(typeSelect);
          stopControlDragStart(exitOnlyCheckbox);
          stopControlDragStart(deleteButton);

          arrowRow.appendChild(dragHandle);
          arrowRow.appendChild(typeSelect);
          arrowRow.appendChild(sizeControl);
          arrowRow.appendChild(exitOnlyLabel);
          arrowRow.appendChild(deleteButton);

        return arrowRow;
      };
      
      const createAPLSpacingRow = (arrowIndex, arrow) => {
        if (!arrow) {
          return null;
        }

        const spacingRow = document.createElement("div");
        spacingRow.className = "aplArrowSpacingRow aplBetweenArrowSpacingRow";

        if (arrow.placement === "divider") {
          spacingRow.classList.add("aplSpacingAfterDivider");
        }

        const spacingLabel = document.createElement("label");
        spacingLabel.textContent = "Spacing:";

        const spacingSlider = document.createElement("input");
        spacingSlider.type = "range";
        spacingSlider.className = "aplArrowSpacingSlider";
        spacingSlider.min = "0";
        spacingSlider.max = "14";
        spacingSlider.step = "0.2";
          spacingSlider.value = Number.isFinite(Number(arrow?.spacingAfterRem))
            ? String(Number(arrow.spacingAfterRem))
            : "8";

        const spacingValue = document.createElement("span");
        spacingValue.textContent = `${spacingSlider.value} rem`;

        spacingSlider.addEventListener("input", function () {
          spacingValue.textContent = `${this.value} rem`;
        });

        spacingSlider.addEventListener("change", function () {
          exposed.setAPLArrowSpacing(arrowIndex, this.value);
        });

        spacingSlider.addEventListener("pointerdown", (event) => {
          event.stopPropagation();
        });

        spacingSlider.addEventListener("mousedown", (event) => {
          event.stopPropagation();
        });

        spacingSlider.addEventListener("dragstart", (event) => {
          event.preventDefault();
          event.stopPropagation();
        });

        spacingRow.appendChild(spacingLabel);
        spacingRow.appendChild(spacingSlider);
        spacingRow.appendChild(spacingValue);

        return spacingRow;
      };
      
      const createAPLBeforeSpacingRow = (arrowIndex, arrow) => {
        if (!arrow) {
          return null;
        }

        const spacingRow = document.createElement("div");
        spacingRow.className = "aplArrowSpacingRow aplBeforeArrowSpacingRow";

        const spacingLabel = document.createElement("label");
        spacingLabel.textContent = "Spacing:";

        const spacingSlider = document.createElement("input");
        spacingSlider.type = "range";
        spacingSlider.className = "aplArrowSpacingSlider";
        spacingSlider.min = "0";
        spacingSlider.max = "10";
        spacingSlider.step = "0.1";
          spacingSlider.max = "14";
          spacingSlider.step = "0.2";
          spacingSlider.value = Number.isFinite(Number(arrow.spacingBeforeRem))
            ? String(Number(arrow.spacingBeforeRem))
            : "8";

        const spacingValue = document.createElement("span");
        spacingValue.textContent = `${spacingSlider.value} rem`;

        spacingSlider.addEventListener("input", function () {
          spacingValue.textContent = `${this.value} rem`;
        });

        spacingSlider.addEventListener("change", function () {
          exposed.setAPLArrowBeforeSpacing(arrowIndex, this.value);
        });

        spacingSlider.addEventListener("pointerdown", (event) => {
          event.stopPropagation();
        });

        spacingSlider.addEventListener("mousedown", (event) => {
          event.stopPropagation();
        });

        spacingSlider.addEventListener("dragstart", (event) => {
          event.preventDefault();
          event.stopPropagation();
        });

        spacingRow.appendChild(spacingLabel);
        spacingRow.appendChild(spacingSlider);
        spacingRow.appendChild(spacingValue);

        return spacingRow;
      };

      if (aplArrowList) {
        lib.clearChildren(aplArrowList);

        const selectedSubPanelIndex = exposed.vars.currentlySelectedSubPanelIndex;
        const selectedSubpanelStatus = document.getElementById("aplSelectedSubpanelStatus");

        if (selectedSubpanelStatus) {
          selectedSubpanelStatus.textContent =
            "Selected Subpanel: Subpanel " + (selectedSubPanelIndex + 1);
        }

          const aplArrows = panel.sign.aplArrows || [];
          const subPanelCount = panel.sign.subPanels.length;

          aplVisualArrowOrder = [];

          for (let orderSubPanelIndex = 0; orderSubPanelIndex < subPanelCount; orderSubPanelIndex++) {
            aplArrows.forEach((arrow, index) => {
              if (
                arrow.placement !== "divider" &&
                arrow.subPanelIndex === orderSubPanelIndex
              ) {
                aplVisualArrowOrder.push(index);
              }
            });

            if (orderSubPanelIndex < subPanelCount - 1) {
              aplArrows.forEach((arrow, index) => {
                if (
                  arrow.placement === "divider" &&
                  arrow.dividerAfterSubPanelIndex === orderSubPanelIndex
                ) {
                  aplVisualArrowOrder.push(index);
                }
              });
            }
          }

          for (let subPanelIndex = 0; subPanelIndex < subPanelCount; subPanelIndex++) {
          const subPanelSection = document.createElement("div");
          subPanelSection.className =
            "aplSubpanelSection" +
            (subPanelIndex === selectedSubPanelIndex ? " selected" : "");

          const sectionHeader = document.createElement("div");
          sectionHeader.className = "aplSubpanelSectionHeader";
          sectionHeader.textContent = "Subpanel " + (subPanelIndex + 1);

          sectionHeader.addEventListener("click", () => {
            exposed.changeEditingSubPanel(subPanelIndex);
          });

          subPanelSection.appendChild(sectionHeader);

          const sectionArrows = aplArrows
            .map((arrow, index) => ({ arrow, index }))
            .filter(
              ({ arrow }) =>
                arrow.placement !== "divider" &&
                arrow.subPanelIndex === subPanelIndex
            );

          subPanelSection.appendChild(
            createAPLDropZone({
              placement: "subpanel",
              subPanelIndex,
            })
          );

              sectionArrows.forEach(({ arrow, index }, localIndex) => {
                if (localIndex === 0 && subPanelIndex > 0) {
                  const dividerBeforeThisSubpanel = aplArrows.some(
                    (candidate) =>
                      candidate.placement === "divider" &&
                      candidate.dividerAfterSubPanelIndex === subPanelIndex - 1
                  );

                  if (dividerBeforeThisSubpanel) {
                    const beforeSpacingRow = createAPLBeforeSpacingRow(index, arrow);
                    if (beforeSpacingRow) {
                      subPanelSection.appendChild(beforeSpacingRow);
                    }
                  }
                }

                subPanelSection.appendChild(
                  createAPLArrowRow(arrow, index, sectionArrows, localIndex)
                );

                  const hasDividerAfterSubpanel = aplArrows.some(
                    (candidate) =>
                      candidate.placement === "divider" &&
                      candidate.dividerAfterSubPanelIndex === subPanelIndex
                  );

                  const isLastArrowInSubpanel =
                    localIndex === sectionArrows.length - 1;

                  if (
                    localIndex < sectionArrows.length - 1 ||
                    (isLastArrowInSubpanel && hasDividerAfterSubpanel)
                  ) {
                    const spacingRow = createAPLSpacingRow(index, arrow);
                    if (spacingRow) {
                      subPanelSection.appendChild(spacingRow);
                    }
                  }
              });

          const addToSubpanelButton = document.createElement("button");
          addToSubpanelButton.type = "button";
          addToSubpanelButton.textContent = "Add arrow to Subpanel " + (subPanelIndex + 1);

          addToSubpanelButton.addEventListener("click", () => {
            exposed.changeEditingSubPanel(subPanelIndex);

            exposed.addAPLArrow(null, {
              placement: "subpanel",
              subPanelIndex,
            });
          });

          subPanelSection.appendChild(addToSubpanelButton);
          aplArrowList.appendChild(subPanelSection);

          if (subPanelIndex < subPanelCount - 1) {
            const dividerSection = document.createElement("div");
            dividerSection.className = "aplDividerSection";

            const dividerHeader = document.createElement("div");
            dividerHeader.className = "aplDividerSectionHeader";
              dividerHeader.textContent = "Divider " + (subPanelIndex + 1);

            dividerSection.appendChild(dividerHeader);

            dividerSection.appendChild(
              createAPLDropZone({
                placement: "divider",
                dividerAfterSubPanelIndex: subPanelIndex,
              })
            );

            const dividerArrows = aplArrows
              .map((arrow, index) => ({ arrow, index }))
              .filter(
                ({ arrow }) =>
                  arrow.placement === "divider" &&
                  arrow.dividerAfterSubPanelIndex === subPanelIndex
              );

              dividerArrows.forEach(({ arrow, index }, localIndex) => {
                dividerSection.appendChild(
                  createAPLArrowRow(arrow, index, dividerArrows, localIndex)
                );
              });

              if (dividerArrows.length === 0) {
                const addDividerArrowButton = document.createElement("button");
                addDividerArrowButton.type = "button";
                addDividerArrowButton.textContent = "Add divider arrow";

                  addDividerArrowButton.addEventListener("click", () => {
                    exposed.addAPLArrow(null, {
                      placement: "divider",
                      dividerAfterSubPanelIndex: subPanelIndex,
                    });
                  });

                dividerSection.appendChild(addDividerArrowButton);
              }
              aplArrowList.appendChild(dividerSection);
          }
        }

        if (
          aplArrowTypeSelect &&
          aplArrows.length > 0 &&
          selectedAPLIndex < aplArrows.length
        ) {
          aplArrowTypeSelect.value = getAPLArrowKind(aplArrows[selectedAPLIndex]);
        }
      }

    // Panel Setting Config

    // Panel Config
    const panelColorSelectElmt = document.getElementById("panelColor");
    for (const option of panelColorSelectElmt.options) {
      if (option.value == panel.color) {
        option.selected = true;
        break;
      }
    }

    const panelCornerSelectElmt = document.getElementById("panelCorner");
    for (const option of panelCornerSelectElmt.options) {
      if (option.value == panel.corner) {
        option.selected = true;
        break;
      }
    }

    const panelBorderRadiusElmt = document.getElementById("panelBorderRadius");
    if (panelBorderRadiusElmt) {
      const resolvedRadius =
        typeof panel.borderRadius === "number"
          ? panel.borderRadius
          : Panel.prototype.defaultBorderRadius;
      panelBorderRadiusElmt.value = resolvedRadius;
    }

    // Global Panel
    const outActionMessage = document.getElementById("outActionMessage");
    const outActionMessageLabel = document.getElementById(
      "outActionMessageLabel"
    );
    const globalPositioning = document.getElementById("globalPosition");
    const globalPositionLabel = document.getElementById("globalPositionLabel");
    const g_actionMessage = document.getElementById("g_actionMessage");

    g_actionMessage.className =
      exposed.vars.currentlySelectedSubPanelIndex >= 0 ? "invisible" : "";
    outActionMessage.className =
      exposed.vars.currentlySelectedSubPanelIndex >= 0 ? "invisible" : "";
    outActionMessageLabel.className =
      exposed.vars.currentlySelectedSubPanelIndex >= 0 ? "invisible" : "";
    g_actionMessage.className =
      exposed.vars.currentlySelectedSubPanelIndex >= 0 ? "invisible" : "";
    globalPositioning.className =
      exposed.vars.currentlySelectedSubPanelIndex >= 0 ? "invisible" : "";
    globalPositionLabel.className =
      exposed.vars.currentlySelectedSubPanelIndex >= 0 ? "invisible" : "";

    outActionMessage.checked = panel.sign.advisoryMessage;

    // Sub Panel
    const subPanelHeight = document.getElementById("subPanelHeight");
    const subPanelHeightLabel = document.getElementById("subPanelHeightLabel");
    const subPanelLength = document.getElementById("subPanelLength");
    const subPanelLengthLabel = document.getElementById("subPanelLengthLabel");

    subPanelHeight.style.display =
      exposed.vars.currentlySelectedSubPanelIndex > 0 ? "initial" : "none";
    subPanelHeightLabel.style.display =
      exposed.vars.currentlySelectedSubPanelIndex > 0 ? "inline-block" : "none";

    subPanelLength.style.display =
      exposed.vars.currentlySelectedSubPanelIndex != -1 &&
        panel.sign.subPanels.length > 1
        ? "initial"
        : "none";
    subPanelLengthLabel.style.display =
      exposed.vars.currentlySelectedSubPanelIndex != -1 &&
        panel.sign.subPanels.length > 1
        ? "inline-block"
        : "none";

    // Exit Tabs
    const exitNumberElmt = document.getElementById("exitNumber");
    const exitTabBilingualField = document.getElementById("exitTabBilingual");
    const exitTabBilingualBottomTextField = document.getElementById("exitTabBilingualBottomText");

    if (exitTabBilingualField) {
      exitTabBilingualField.checked = exitTab.bilingual === true;
    }

    if (exitTabBilingualBottomTextField) {
      exitTabBilingualBottomTextField.value =
        exitTab.bilingualBottomText || "SORTIE";
    }

    updateExitTabBilingualControls(exitTab);
    exitNumberElmt.value = exitTab.number;

    const exitTabPositionSelectElmt =
      document.getElementById("exitTabPosition");
    for (const option of exitTabPositionSelectElmt.options) {
      if (option.value == exitTab.position) {
        option.selected = true;
        break;
      }
    }
      const showLeft = document.getElementById("showLeft");
      const showLeftLabel = document.getElementById("showLeftLabel");
      const hasExitNumberText = updateExitTabLeftControlVisibility(exitTab.number);

      if (showLeft) {
        showLeft.checked = hasExitNumberText && exitTab.showLeft === true;
      }

    const exitTabWidthSelectElmt = document.getElementById("exitTabWidth");
    for (const option of exitTabWidthSelectElmt.options) {
      if (option.value == exitTab.width) {
        option.selected = true;
        break;
      }
    }

    const exitTabColorElmt = document.querySelector("#exitColor");
    for (const option of exitTabColorElmt.options) {
      if (option.value == exitTab.color) {
        option.selected = true;
        break;
      }
    }

    const exitTabVariantElmt = document.querySelector("#exitVariant");
    if (exitTabVariantElmt) {
      for (const option of exitTabVariantElmt.options) {
        if (option.value == exitTab.variant) {
          option.selected = true;
          break;
        }
      }
      toggleExitTabVariantOptionsVisibility(exitTab.variant);
    }
      const currentSign = panel?.sign;

      if (currentSign) {
        const qcEnabled = document.getElementById("qcExitMarkerEnabled");
        const qcNumber = document.getElementById("qcExitMarkerNumber");
        const qcPosition = document.getElementById("qcExitMarkerPosition");
        const qcFlipped = document.getElementById("qcExitMarkerFlipped");
        const qcSize = document.getElementById("qcExitMarkerSize");
        const qcSizeValue = document.getElementById("qcExitMarkerSizeValue");

        if (qcEnabled) {
          qcEnabled.checked = !!currentSign.quebecExitMarkerEnabled;
        }

        if (qcNumber) {
          qcNumber.value = currentSign.quebecExitMarkerNumber || "1";
        }

        if (qcPosition) {
        qcPosition.value = String(currentSign.quebecExitMarkerPosition || "Center")
          .replace(/^Bottom\s+/i, "")
          .trim();
        }

        if (qcFlipped) {
          qcFlipped.checked = !!currentSign.quebecExitMarkerFlipped;
        }
        if (qcSize) {
            const resolvedSize =
              Number.isFinite(parseFloat(currentSign.quebecExitMarkerSizeRem))
                ? parseFloat(currentSign.quebecExitMarkerSizeRem)
                : 3.3;

            qcSize.value = resolvedSize;

            if (qcSizeValue) {
              qcSizeValue.innerHTML = resolvedSize;
            }
        }
      }

    const tollLogoSizeInput = document.getElementById("exitTollLogoSize");
    const tollLogoSizeValueElmt = document.getElementById(
      "exitTollLogoSizeValue"
    );
    const resolvedTollLogoSize = (() => {
      const parsed = parseFloat(exitTab.tollLogoSize);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
      return typeof ExitTab.prototype.defaultTollLogoSize === "number"
        ? ExitTab.prototype.defaultTollLogoSize
        : 3;
    })();
    if (tollLogoSizeInput) {
      tollLogoSizeInput.value = resolvedTollLogoSize;
    }
    if (tollLogoSizeValueElmt) {
      tollLogoSizeValueElmt.textContent = resolvedTollLogoSize.toString();
    }

    const tollLogoSelect = document.getElementById("exitTollLogoSelect");
    if (tollLogoSelect && tollLogoSelect.options.length > 0) {
      const desiredLogo =
        exitTab.icon || TollLogoElement.prototype.defaultLogo || "";
      for (const option of tollLogoSelect.options) {
        if (option.value == desiredLogo) {
          option.selected = true;
          break;
        }
      }
    }

    const tollLogoOnly = document.getElementById("exitTollLogoOnly");
    if (tollLogoOnly) {
      tollLogoOnly.checked =
        exitTab.tollLogoOnly === undefined ? true : exitTab.tollLogoOnly;
    }

    const tollLogoSquare = document.getElementById("exitTollLogoSquare");
    if (tollLogoSquare) {
      tollLogoSquare.checked = !!exitTab.tollLogoSquare;
    }

    const iconSetting = document.getElementById("iconSelect");
    if (iconSetting) {
      iconSetting.value = exitTab.icon || "";

      for (const option of iconSetting.options) {
        if (option.value == exitTab.icon) {
          option.selected = true;
          break;
        }
      }
    }

    const exitFont = document.getElementById("exitFont");
    exitFont.checked = exitTab.FHWAFont;

    const fullBorder = document.getElementById("fullBorder");
    fullBorder.checked = exitTab.fullBorder;

    const squareCorners = document.getElementById("squareCorners");
    squareCorners.checked = exitTab.squareCorners;

    const topOffset = document.getElementById("topOffset");
    topOffset.checked = exitTab.topOffset;

    const verticalArrangement = document.getElementById("verticalArrangement");
    verticalArrangement.checked = exitTab.verticalArrangement;

    const caStyle = document.getElementById("caStyle");
    caStyle.checked = exitTab.caStyle;

    const borderThickness = document.getElementById("borderThickness");
    const resolvedBorderThickness = (() => {
      const parsedValue = parseFloat(exitTab.borderThickness);
      if (Number.isFinite(parsedValue) && parsedValue >= 0) {
        return parsedValue;
      }
      return ExitTab.prototype.defaultBorderThickness;
    })();
    exitTab.borderThickness = resolvedBorderThickness;
    borderThickness.value = resolvedBorderThickness;
    document.getElementById("borderValue").innerHTML =
      resolvedBorderThickness.toString();

    const minHeight = document.getElementById("minHeight");
    const resolvedMinHeight = (() => {
      const parsedValue = parseFloat(exitTab.minHeight);

      if (Number.isFinite(parsedValue) && parsedValue > 0) {
        return parsedValue;
      }

      return ExitTab.prototype.defaultMinHeight;
    })();

    exitTab.minHeight = resolvedMinHeight;
    minHeight.value = resolvedMinHeight;
    document.getElementById("minValue").innerHTML = resolvedMinHeight.toString();

    const fontSize = document.getElementById("fontSize");
    const resolvedFontSize = (() => {
      const parsedValue = parseFloat(exitTab.fontSize);

      if (Number.isFinite(parsedValue) && parsedValue > 0) {
        return parsedValue;
      }

      return ExitTab.prototype.defaultFontSize;
    })();

    exitTab.fontSize = resolvedFontSize;
    fontSize.value = resolvedFontSize;
    document.getElementById("fontValue").innerHTML = resolvedFontSize.toString();

    // Nested Tab Spacing (from parent exit tab)
    const nestedTabSpacingInput = document.getElementById("nestedTabSpacing");
    if (nestedTabSpacingInput) {
      const parentExitTab = panel.exitTabs[selectedExitTabIndex];
      const resolvedSpacing = parentExitTab?.nestedTabSpacing ?? 0;
      nestedTabSpacingInput.value = resolvedSpacing;
    }
      
      const nestedSpacingValue = document.getElementById("nestedSpacingValue");
      if (nestedSpacingValue) {
        nestedSpacingValue.innerHTML = nestedTabSpacingInput.value.toString();
      }

      const exitFontCheckbox = document.getElementById("exitFont");
      if (exitFontCheckbox) {
        exitFontCheckbox.dataset.lastFhwaState = String(!!exitTab.FHWAFont);
      }

    // Shields
    updateShieldSubform();

    // Control Text Revision
    // Control Text Revision
    const sMSPTextList = document.querySelector("#sMSPTextList");
    const currentEditingTarget =
      typeof exposed.getCurrentSubPanel === "function"
        ? exposed.getCurrentSubPanel()
        : sign;
    const currentBlockElements = currentEditingTarget?.blockElements;
    const currentRows = Array.isArray(currentBlockElements?.rows)
      ? currentBlockElements.rows
      : [];

    sMSPTextList.innerHTML = "";

    document.querySelector("#SMSPSelectLabel").textContent =
      "Selected: Row " + (exposed.vars.currentlySelectedRowIndex + 1);
    document.querySelector("#SMSPElementLabel").textContent =
      "Selected: Block " + (exposed.vars.currentlySelectedBlockIndex + 1);

    document.querySelector("#sMSPDeleteSelectedRow").disabled =
      currentRows.length <= 1;

    document.querySelector("#smSPDeleteSelectedBlock").disabled =
      currentRows.length <= 1 &&
      (!currentRows[exposed.vars.currentlySelectedRowIndex] ||
        currentRows[exposed.vars.currentlySelectedRowIndex].length <= 1);

    for (let row = 0; row < currentRows.length; row++) {
      const sMControlRow = document.createElement("div");
      sMControlRow.dataset.dataRow = row.toString();
      sMControlRow.className =
        "sMControlRow" +
        (row == exposed.vars.currentlySelectedRowIndex ? " selected" : "");

      for (let item = 0; item < currentRows[row].length; item++) {
        const blockElement = currentRows[row][item];

        const currentBlockElemType =
          Control.prototype.blockToClassElems.getElem(blockElement) ||
          blockElement.constructor.name;

        const textEditorBlock = document.createElement("div");
        textEditorBlock.className =
          "textEditorBlock " +
          Control.prototype.blockInternalElements[currentBlockElemType] +
          (item == exposed.vars.currentlySelectedBlockIndex &&
            row == exposed.vars.currentlySelectedRowIndex
            ? " selected"
            : "");
        textEditorBlock.dataset.row = row.toString();
        textEditorBlock.dataset.block = item.toString();
        textEditorBlock.draggable = true;

        const blockTypeLabel = document.createElement("span");
        blockTypeLabel.className = "textEditorBlockLabel";
        blockTypeLabel.textContent =
          Control.prototype.blockElements[currentBlockElemType] || "Block";

        const blockTypeChevron = document.createElement("span");
        blockTypeChevron.className = "blockTypeChevron";
        blockTypeChevron.textContent = "▾";

        const blockTypeSelect = document.createElement("select");
        blockTypeSelect.className = "blockTypeInlineSelect";
        blockTypeSelect.value = currentBlockElemType;
        blockTypeSelect.setAttribute("aria-label", "Change block type");
        blockTypeSelect.title = "Change block type";

        for (const element in Control.prototype.blockElements) {
          lib.appendOption(blockTypeSelect, element, {
            selected: element === currentBlockElemType,
            text: Control.prototype.blockElements[element],
          });
        }

        blockTypeSelect.addEventListener("mousedown", (event) => {
          event.stopPropagation();
        });

        blockTypeSelect.addEventListener("click", (event) => {
          event.stopPropagation();
        });

        blockTypeSelect.addEventListener("dragstart", (event) => {
          event.preventDefault();
          event.stopPropagation();
        });

        blockTypeSelect.addEventListener("change", (event) => {
          event.preventDefault();
          event.stopPropagation();

          if (typeof exposed.replaceControlElemTypeAt === "function") {
            exposed.replaceControlElemTypeAt(
              row,
              item,
              blockTypeSelect.value
            );
          }
        });

        textEditorBlock.appendChild(blockTypeLabel);
        textEditorBlock.appendChild(blockTypeChevron);
        textEditorBlock.appendChild(blockTypeSelect);

        sMControlRow.appendChild(textEditorBlock);
        textEditorBlock.addEventListener("dragstart", handleBlockDragStart);
        textEditorBlock.addEventListener("dragend", handleBlockDragEnd);
        textEditorBlock.addEventListener(
          "click",
          (event) => {
            if (textEditorBlock.dataset.dragging === "true") {
              event.preventDefault();
              return;
            }

            exposed.setSelectedRow(row);
            exposed.setSelectedControlElem(item);
          },
          { once: true }
        );
      }

      sMSPTextList.appendChild(sMControlRow);
      sMControlRow.draggable = true;
      sMControlRow.style.position = "relative";
      sMControlRow.addEventListener("dragstart", handleRowDragStart);
      sMControlRow.addEventListener("dragend", handleRowDragEnd);
      sMControlRow.addEventListener("dragenter", handleRowDragEnter);
      sMControlRow.addEventListener("dragover", handleRowDragOver);
      sMControlRow.addEventListener("dragleave", handleRowDragLeave);
      sMControlRow.addEventListener("drop", handleRowDrop);
      sMControlRow.addEventListener(
        "click",
        () => {
          exposed.setSelectedRow(row);
        },
        { once: true }
      );
    }

    // Attach row list container drag events for row reordering
    sMSPTextList.addEventListener("dragover", handleRowListDragOver);
    sMSPTextList.addEventListener("drop", handleRowListDrop);
    sMSPTextList.addEventListener("dragleave", handleRowListDragLeave);

    for (const divConfig of document.querySelectorAll(
      "#smSPProperties > div"
    )) {
      if (
        divConfig.dataset.property ==
        Control.prototype.blockInternalElements[
        Control.prototype.blockToClassElems.getElem(
          exposed.getCurrentBlockElem()
        )
        ]
      ) {
        divConfig.classList.remove("hidden");
        selectedSettings = divConfig;
      } else {
        divConfig.classList.add("hidden");
      }
    }
    const currentBlockElem = exposed.getCurrentBlockElem();
    const blockElemType =
      Control.prototype.blockInternalElements[
      Control.prototype.blockToClassElems.getElem(currentBlockElem)
      ];

    if (blockElemType === "sdArrow") {
      const normalizePadding = (value, fallback = 0) => {
        const parsed = parseFloat(
          value !== null && value !== undefined ? value : fallback
        );
        return isNaN(parsed) ? fallback : parsed;
      };

      const fallbackPadding =
        currentBlockElem.padding !== undefined &&
          currentBlockElem.padding !== null
          ? currentBlockElem.padding
          : 0;

      currentBlockElem.paddingHorizontal = normalizePadding(
        currentBlockElem.paddingHorizontal,
        fallbackPadding
      );
      currentBlockElem.paddingVertical = normalizePadding(
        currentBlockElem.paddingVertical,
        fallbackPadding
      );

      delete currentBlockElem.padding;

      currentBlockElem.flip =
        currentBlockElem.flip === true ||
        currentBlockElem.flip === "true" ||
        currentBlockElem.flip === 1 ||
        currentBlockElem.flip === "1" ||
        currentBlockElem.flip === "on";
        const validArrowAlignments = Array.isArray(TextElement.prototype.alignment)
          ? TextElement.prototype.alignment
          : ["Left", "Center", "Right"];

        currentBlockElem.alignment = validArrowAlignments.includes(
          currentBlockElem.alignment
        )
          ? currentBlockElem.alignment
          : "Center";
    }

    if (blockElemType === "sdShield") {
      currentBlockElem.bannerFontFamily =
        ShieldElement.prototype.normalizeBannerFontFamily(
          currentBlockElem.bannerFontFamily
        );
      currentBlockElem.scaleBannersWithShield =
        ShieldElement.prototype.normalizeScaleBannersWithShield(
          currentBlockElem.scaleBannersWithShield
        );
      if (currentBlockElem.indentFirstLetter === undefined) {
        currentBlockElem.indentFirstLetter = true;
      }
      if (currentBlockElem.indentFirstLetter2 === undefined) {
        currentBlockElem.indentFirstLetter2 =
          currentBlockElem.indentFirstLetter;
      }
      currentBlockElem.shieldSize =
        ShieldElement.prototype.normalizeShieldSize(
          currentBlockElem.shieldSize
        );
      if (currentBlockElem.smallCaps === undefined) {
        currentBlockElem.smallCaps = true;
      }
      if (currentBlockElem.smallCaps2 === undefined) {
        currentBlockElem.smallCaps2 = currentBlockElem.smallCaps;
      }
      if (currentBlockElem.manualBanners === undefined) {
        currentBlockElem.manualBanners = true;
      }
      if (currentBlockElem.roadName === undefined) {
        currentBlockElem.roadName = "";
      }
      if (currentBlockElem.alignment === undefined) {
        currentBlockElem.alignment = "Center";
      }
    }

    if (blockElemType === "sdBlocker") {
      currentBlockElem.orientation =
        DividerElement.prototype.normalizeOrientation(
          currentBlockElem.orientation
        );
    }

    for (const propertyName in currentBlockElem) {
      const elementId = `${blockElemType}_${propertyName}`;
      const element = document.getElementById(elementId);
      const displayElement = document.getElementById(elementId + "Val");

      if (element) {
        const handleCustomBanner =
          blockElemType === "sdShield" &&
          (propertyName === "bannerType" || propertyName === "bannerType2");

        if (handleCustomBanner) {
          const manualCheckbox = document.getElementById("sdShield_manualBanners");

          if (manualCheckbox) {
            manualCheckbox.checked = currentBlockElem.manualBanners !== false;
          }

          const customInputId =
            propertyName === "bannerType"
              ? "sdShield_bannerCustomText"
              : "sdShield_bannerCustomText2";

          const customInput = document.getElementById(customInputId);
          const bannerOptions = Shield.prototype.bannerTypes || [];
          const currentBanner =
            currentBlockElem[propertyName] || getDefaultBannerType();

          const matchedPreset = bannerOptions.find(
            (option) =>
              String(option).toLowerCase() === String(currentBanner).toLowerCase()
          );

          const manualBanners = !manualCheckbox || manualCheckbox.checked;

          if (element.tagName === "SELECT") {
            element.value = matchedPreset || getDefaultBannerType();
            element.addEventListener("change", readForm, { once: true });
          }

          if (customInput) {
            customInput.value = manualBanners ? currentBanner : "";
            customInput.addEventListener("blur", readForm, { once: true });
          }

          syncManualBannerInputMode();

          if (displayElement) {
            displayElement.textContent = currentBanner;
          }

          continue;
        }

        if (element.type === "checkbox") {
          element.checked = currentBlockElem[propertyName];
          element.addEventListener("change", readForm, { once: true });
        } else if (element.type === "radio") {
          if (element.value === currentBlockElem[propertyName].toString()) {
            element.checked = true;
          }
          element.addEventListener("change", readForm, { once: true });
        } else if (element.tagName === "SELECT") {
          element.value = currentBlockElem[propertyName];

          element.addEventListener("change", readForm, { once: true });
          element.addEventListener("blur", readForm, { once: true });
        } else {
          element.value = currentBlockElem[propertyName];
          element.addEventListener(
            element.type === "text" ? "blur" : "change",
            readForm,
            { once: true }
          );

          if (
            element.type === "range" &&
            displayElement &&
            !element.dataset.syncDisplay
          ) {
            element.addEventListener("input", () => {
              displayElement.value = element.value;
            });
            element.dataset.syncDisplay = "true";
          }
        }
      }

      if (displayElement) {
        if (
          displayElement.tagName === "INPUT" &&
          displayElement.type === "number"
        ) {
          displayElement.value = currentBlockElem[propertyName];
        } else {
          displayElement.textContent = currentBlockElem[propertyName];
        }
      }
    }

    if (blockElemType === "sdArrow") {
      const arrowRotationButtons = document.querySelectorAll(
        ".sdArrow_rotationPreset"
      );
      const currentRotation = parseFloat(currentBlockElem.rotation) || 0;
      arrowRotationButtons.forEach((button) => {
        const degrees = parseFloat(button.dataset.degrees || "0") || 0;
        button.classList.toggle(
          "activated",
          Math.abs((((currentRotation % 360) + 360) % 360) - degrees) < 0.5
        );
      });

      const arrowFlipInput = document.getElementById("sdArrow_flip");
      const arrowFlipButton = document.getElementById("sdArrow_flipButton");
      if (arrowFlipInput && arrowFlipButton) {
        arrowFlipInput.value = currentBlockElem.flip ? "true" : "false";
        arrowFlipButton.classList.toggle("activated", currentBlockElem.flip);
        arrowFlipButton.setAttribute(
          "aria-pressed",
          currentBlockElem.flip ? "true" : "false"
        );
      }
    }

    document.querySelector("#sdBlock_topPadding").value =
      sign.blockElements.blockProperties[
        exposed.vars.currentlySelectedRowIndex
      ].topPadding;
    document
      .querySelector("#sdBlock_topPadding")
      .addEventListener("change", readForm, { once: true });

    document.querySelector("#sdBlock_bottomPadding").value =
      sign.blockElements.blockProperties[
        exposed.vars.currentlySelectedRowIndex
      ].bottomPadding;
    document
      .querySelector("#sdBlock_bottomPadding")
      .addEventListener("change", readForm, { once: true });

    const topPadValEl = document.querySelector("#sdBlock_topPaddingVal");
    const bottomPadValEl = document.querySelector("#sdBlock_bottomPaddingVal");
    const topPadValue =
      sign.blockElements.blockProperties[exposed.vars.currentlySelectedRowIndex]
        .topPadding;
    const bottomPadValue =
      sign.blockElements.blockProperties[exposed.vars.currentlySelectedRowIndex]
        .bottomPadding;
    if (topPadValEl) {
      if (topPadValEl.tagName === "INPUT" && topPadValEl.type === "number") {
        topPadValEl.value = topPadValue;
      } else {
        topPadValEl.textContent = topPadValue;
      }
    }
    if (bottomPadValEl) {
      if (
        bottomPadValEl.tagName === "INPUT" &&
        bottomPadValEl.type === "number"
      ) {
        bottomPadValEl.value = bottomPadValue;
      } else {
        bottomPadValEl.textContent = bottomPadValue;
      }
    }

    document.querySelector("#sdBlock_backgroundColor").value =
      sign.blockElements.blockProperties[
        exposed.vars.currentlySelectedRowIndex
      ].backgroundColor;

    document
      .querySelector("#sdBlock_backgroundColor")
      .addEventListener("blur", readForm, { once: true });

    const blockBorderColorEl = document.querySelector("#sdBlock_borderColor");
    if (blockBorderColorEl) {
      const storedBorderColor =
        sign.blockElements.blockProperties[
          exposed.vars.currentlySelectedRowIndex
        ].borderColor;
      blockBorderColorEl.value =
        storedBorderColor || Block.defaultBorderColor || "Match BG";
      blockBorderColorEl.addEventListener("blur", readForm, { once: true });
    }

    const blockBackgroundFullWidthEl = document.querySelector(
      "#sdBlock_backgroundFullWidth"
    );
    blockBackgroundFullWidthEl.checked =
      !!sign.blockElements.blockProperties[
        exposed.vars.currentlySelectedRowIndex
      ].backgroundFullWidth;
    blockBackgroundFullWidthEl.addEventListener("change", readForm, {
      once: true,
    });

    document.querySelector("#sdBlock_width").value =
      sign.blockElements.blockProperties[
        exposed.vars.currentlySelectedRowIndex
      ].width;
    document
      .querySelector("#sdBlock_width")
      .addEventListener("change", readForm, { once: true });

    document
      .querySelector("#sdBlock_stretchLeft")
      .addEventListener("change", readForm, { once: true });

    document.querySelector("#sdBlock_stretchLeft").checked =
      sign.blockElements.blockProperties[
        exposed.vars.currentlySelectedRowIndex
      ].stretchLeft;

    document
      .querySelector("#sdBlock_stretchCenter")
      .addEventListener("change", readForm, { once: true });
    document.querySelector("#sdBlock_stretchCenter").checked =
      sign.blockElements.blockProperties[
        exposed.vars.currentlySelectedRowIndex
      ].stretchCenter;

    document
      .querySelector("#sdBlock_stretchRight")
      .addEventListener("change", readForm, { once: true });
    document.querySelector("#sdBlock_stretchRight").checked =
      sign.blockElements.blockProperties[
        exposed.vars.currentlySelectedRowIndex
      ].stretchRight;

    /*
    // Old Control Text
    const controlTextElmt = document.getElementById("controlText");
    controlTextElmt.value = sign.controlText;
 
    const actionMessageElmt = document.getElementById("actionMessage");
    actionMessageElmt.value = sign.actionMessage;
    */
    const shieldPositionsSelectElmt =
      document.getElementById("shieldsPosition");
    for (const option of shieldPositionsSelectElmt.options) {
      if (option.value == panel.sign.shieldPosition) {
        option.selected = true;
        break;
      }
    }

    const shieldBacksElmt = document.getElementById("shieldBacks");
    shieldBacksElmt.checked = panel.sign.shieldBacks;

    const guideArrowSelectElmt = document.getElementById("guideArrow");
    for (const option of guideArrowSelectElmt.options) {
      if (option.value == panel.sign.guideArrow) {
        option.selected = true;
        break;
      }
    }

    const guideArrowLanesElmt = document.getElementById("guideArrowLanes");
    guideArrowLanesElmt.value = panel.sign.guideArrowLanes;

    const useCanadianDownArrowsElmt = document.getElementById(
      "useCanadianDownArrows"
    );
    if (useCanadianDownArrowsElmt) {
      useCanadianDownArrowsElmt.checked = !!panel.sign.useCanadianDownArrows;
    }

    const exitOnlyDirectionLabel = document.getElementById(
      "exitOnlyDirectionLabel"
    );
    const showExitOnlyLabel = document.getElementById("showExitOnlyLabel");
    const hideExitArrowLabel = document.getElementById("hideExitArrowLabel");
    const exitOnlyDirection = document.getElementById("exitOnlyDirection");
    const showExitOnly = document.getElementById("showExitOnly");
    const hideExitArrow = document.getElementById("hideExitArrow");
    const exitOnlyBorderModeLabel = document.getElementById(
      "exitOnlyBorderModeLabel"
    );
    const exitOnlyBorderModeSelect = document.getElementById(
      "exitOnlyBorderMode"
    );
    const exitOnlyLeftTextLabel = document.getElementById(
      "exitOnlyLeftTextLabel"
    );
    const exitOnlyLeftTextInput = document.getElementById("exitOnlyLeftText");
    const exitOnlyRightTextLabel = document.getElementById(
      "exitOnlyRightTextLabel"
    );
    const exitOnlyRightTextInput = document.getElementById("exitOnlyRightText");
    const exitOnlyPadding = document.getElementById("exitOnlyPadding");
    const exitOnlyPaddingValue = document.getElementById("paddingValue");
    const exitOnlyPaddingLabel = document.getElementById(
      "exitOnlyPaddingLabel"
    );

    exitOnlyDirectionLabel.className = !panel.sign.guideArrow.includes(
      "Exit Only"
    )
      ? "invisible"
      : "";
    exitOnlyPaddingLabel.className =
      !panel.sign.guideArrow.includes("Exit Only") ||
        panel.sign.guideArrow == "Split Exit Only"
        ? "invisible"
        : "";
    showExitOnlyLabel.className = !panel.sign.guideArrow.includes("Exit Only")
      ? "invisible"
      : "";
    if (hideExitArrowLabel) {
      hideExitArrowLabel.className = !panel.sign.guideArrow.includes("Exit Only")
        ? "invisible"
        : "";
    }
    exitOnlyDirection.className = !panel.sign.guideArrow.includes("Exit Only")
      ? "invisible"
      : "";
    exitOnlyPadding.className =
      !panel.sign.guideArrow.includes("Exit Only") ||
        panel.sign.guideArrow == "Split Exit Only"
        ? "invisible"
        : "";
    showExitOnly.className = !panel.sign.guideArrow.includes("Exit Only")
      ? "invisible"
      : "";
    if (hideExitArrow) {
      hideExitArrow.className = !panel.sign.guideArrow.includes("Exit Only")
        ? "invisible"
        : "";
    }
    if (exitOnlyLeftTextLabel && exitOnlyLeftTextInput) {
      exitOnlyLeftTextLabel.className = !panel.sign.guideArrow.includes(
        "Exit Only"
      )
        ? "invisible"
        : "";
      exitOnlyLeftTextInput.className = !panel.sign.guideArrow.includes(
        "Exit Only"
      )
        ? "invisible"
        : "";
      exitOnlyLeftTextInput.value = panel.sign.exitOnlyLeftText || "";
    }
    if (exitOnlyRightTextLabel && exitOnlyRightTextInput) {
      exitOnlyRightTextLabel.className = !panel.sign.guideArrow.includes(
        "Exit Only"
      )
        ? "invisible"
        : "";
      exitOnlyRightTextInput.className = !panel.sign.guideArrow.includes(
        "Exit Only"
      )
        ? "invisible"
        : "";
      exitOnlyRightTextInput.value = panel.sign.exitOnlyRightText || "";
    }
    paddingValue.className =
      !panel.sign.guideArrow.includes("Exit Only") ||
        panel.sign.guideArrow == "Split Exit Only"
        ? "invisible"
        : "";
    if (exitOnlyBorderModeLabel && exitOnlyBorderModeSelect) {
      const shouldShowBorderMode =
        !post.secondExitOnly &&
        (panel.sign.guideArrow == "Half Exit Only" ||
          panel.sign.guideArrow == "Exit Only");
      exitOnlyBorderModeLabel.className = shouldShowBorderMode
        ? ""
        : "invisible";
      exitOnlyBorderModeSelect.className = shouldShowBorderMode
        ? ""
        : "invisible";
      const resolvedBorderMode = Sign.prototype.exitOnlyBorderModes.includes(
        panel.sign.exitOnlyBorderMode
      )
        ? panel.sign.exitOnlyBorderMode
        : Sign.prototype.exitOnlyBorderModes[0];
      exitOnlyBorderModeSelect.value = resolvedBorderMode;
    }
    showExitOnly.checked = !!panel.sign.showExitOnly;
    showExitOnly.value = panel.sign.showExitOnly;
    if (hideExitArrow) {
      hideExitArrow.checked = !!panel.sign.hideExitArrow;
      hideExitArrow.value = panel.sign.hideExitArrow;
    }
      const resolvedExitOnlyPadding =
        panel.sign.exitOnlyPadding !== undefined &&
        panel.sign.exitOnlyPadding !== null &&
        panel.sign.exitOnlyPadding !== ""
          ? panel.sign.exitOnlyPadding
          : 0.25;

      panel.sign.exitOnlyPadding = resolvedExitOnlyPadding;
      exitOnlyPadding.value = resolvedExitOnlyPadding;
      exitOnlyPaddingValue.textContent = resolvedExitOnlyPadding;

    for (const option of exitOnlyDirection.options) {
      if (option.value == panel.sign.exitguideArrows) {
        option.selected = true;
        break;
      }
    }
    
      let currentBlockElemForPickerSync = null;

      try {
        currentBlockElemForPickerSync =
          exposed && typeof exposed.getCurrentBlockElem === "function"
            ? exposed.getCurrentBlockElem()
            : null;
      } catch (error) {
        currentBlockElemForPickerSync = null;
      }

      if (
        currentBlockElemForPickerSync &&
        Control.prototype.blockInternalElements[
          Control.prototype.blockToClassElems.getElem(currentBlockElemForPickerSync)
        ] === "sdShield" &&
        typeof ensureSdShieldBasePicker === "function"
      ) {
        ensureSdShieldBasePicker();

        syncShieldBasePickerValue(
          currentBlockElemForPickerSync.shieldBase ||
            currentBlockElemForPickerSync.type ||
            ShieldElement.prototype.defaultShieldBase ||
            "I"
        );
      }

      if (typeof ensureGuideArrowPicker === "function") {
        ensureGuideArrowPicker();
      }
      if (typeof ensureExitOnlyDirectionPicker === "function") {
        ensureExitOnlyDirectionPicker();
      }

    const otherSymbolSelectElement = document.getElementById("otherSymbol");
    for (const option of otherSymbolSelectElement.options) {
      if (option.value == panel.sign.otherSymbol) {
        option.selected = true;
        break;
      }
    }

    const oSNumElmt = document.getElementById("oSNum");
    oSNumElmt.value = panel.sign.oSNum;

    const advisoryMessageElmt = document.getElementById("outActionMessage");
    advisoryMessageElmt.checked = panel.sign.advisoryMessage;

    // Ensure dependent small inputs reflect the corresponding checkbox state
    [
      "sdCtrlText",
      "sdAdvisory",
      "sdActionMessage",
      "sdIcon",
      "sdTollLogo",
    ].forEach((block) => setDependentVisibility(block));
      applyEditorInputBehavior(document);
      bindAllFontPreviewSelects(document);
      syncAllFontPickers();
      applyExitOnlyArrowVisibility();
      syncGlobalBlockControls();
  };
    
    /* END OF UPDATEFORM */

  /**
   * Update the fields in the form relating to shields to the values of the currently selected panel.
   */
  const updateShieldSubform = function () {
    const shieldsContainerElmt = document.getElementById("shields");

    if (!shieldsContainerElmt) {
      return;
    }

    let subPanel;

    if (exposed.vars.currentlySelectedSubPanelIndex < 0) {
      subPanel =
        typeof exposed.getCurrentSubPanel === "function"
          ? exposed.getCurrentSubPanel()
          : null;
    } else {
      subPanel =
        typeof exposed.getCurrentSubPanel === "function"
          ? exposed.getCurrentSubPanel()
          : null;
    }

    const shields = Array.isArray(subPanel?.shields) ? subPanel.shields : [];

    while (shieldsContainerElmt.firstChild) {
      shieldsContainerElmt.removeChild(shieldsContainerElmt.lastChild);
    }

    for (
      let shieldIndex = 0, length = shields.length;
      shieldIndex < length;
      shieldIndex++
    ) {
      const rowContainerElmt = document.createElement("div");
      rowContainerElmt.style.width = "100%";

      const toCheckElmt = document.createElement("input");
      toCheckElmt.type = "checkbox";
      toCheckElmt.id = `shield${shieldIndex}_to`;
      toCheckElmt.name = `shield${shieldIndex}_to`;
      toCheckElmt.checked = shields[shieldIndex].to;
      toCheckElmt.addEventListener("change", readForm);
      rowContainerElmt.appendChild(toCheckElmt);

      const toCheckLabelElmt = document.createElement("label");
      toCheckLabelElmt.setAttribute("for", `shield${shieldIndex}_to`);
      toCheckLabelElmt.appendChild(document.createTextNode(" TO "));
      rowContainerElmt.appendChild(toCheckLabelElmt);

      // Populate shield options
        const typeSelectPlaceholder = document.createElement("select");
        typeSelectPlaceholder.id = `shield${shieldIndex}_type`;
        rowContainerElmt.appendChild(typeSelectPlaceholder);

        const shieldPicker = createShieldPicker({
          mount: typeSelectPlaceholder,
          value:
            shields[shieldIndex].shieldBase ||
            shields[shieldIndex].type ||
            "I",
          placeholder: "Shield type",
          onChange: (nextValue) => {
            const shield = shields[shieldIndex];
            if ("shieldBase" in shield) {
              shield.shieldBase = nextValue;
            }
            if ("type" in shield) {
              shield.type = nextValue;
            }
            if (typeof readForm === "function") {
              readForm();
            }
          },
        });

      const routeNumberElmt = document.createElement("input");
      routeNumberElmt.type = "text";
      routeNumberElmt.id = `shield${shieldIndex}_routeNumber`;
      routeNumberElmt.placeholder = "00";
      routeNumberElmt.value = shields[shieldIndex].routeNumber;
      routeNumberElmt.addEventListener("change", readForm);
      rowContainerElmt.appendChild(routeNumberElmt);

      // Populate special banner type options
      const specialBannerTypeSelectElmt = document.createElement("select");

      if (
        Shield.prototype.specialBannerTypes[shields[shieldIndex].type] !=
        undefined
      ) {
        for (const specialBannerType of Object.keys(
          Shield.prototype.specialBannerTypes[shields[shieldIndex].type]
        )) {
          if (exposed.checkSpecialShield(shieldIndex, specialBannerType)) {
            const optionElmt = document.createElement("option");
            optionElmt.value = specialBannerType;
            if (specialBannerType == shields[shieldIndex].specialBannerType) {
              optionElmt.selected = true;
            } else {
              optionElmt.selected = false;
            }
            optionElmt.appendChild(document.createTextNode(specialBannerType));
            specialBannerTypeSelectElmt.appendChild(optionElmt);
          }
        }

        let optionElmt = document.createElement("option");
        optionElmt.value = "None";
        if ("None" == shields[shieldIndex].specialBannerType) {
          optionElmt.selected = true;
        } else {
          optionElmt.selected = false;
        }
        optionElmt.appendChild(document.createTextNode("None"));
        specialBannerTypeSelectElmt.appendChild(optionElmt);
        specialBannerTypeSelectElmt.style.visibility = "";
      } else {
        specialBannerTypeSelectElmt.style.visibility = "hidden";
      }

      specialBannerTypeSelectElmt.id = `shield${shieldIndex}_specialBannerType`;
      specialBannerTypeSelectElmt.addEventListener("change", readForm);
      rowContainerElmt.appendChild(specialBannerTypeSelectElmt);

      rowContainerElmt.appendChild(document.createElement("br"));

      const indentElmt = document.createElement("input");
      indentElmt.type = "checkbox";
      indentElmt.id = `shield${shieldIndex}_indentFirstLetter`;
      indentElmt.checked =
        shields[shieldIndex].indentFirstLetter !== undefined
          ? shields[shieldIndex].indentFirstLetter
          : true;
      indentElmt.onchange = readForm;
      rowContainerElmt.appendChild(indentElmt);

      const indentLabelElmt = document.createElement("label");
      indentLabelElmt.setAttribute(
        "for",
        `shield${shieldIndex}_indentFirstLetter`
      );
      indentLabelElmt.appendChild(
        document.createTextNode("Enlarge First Letter")
      );
      rowContainerElmt.appendChild(indentLabelElmt);
      const indentElmt2 = document.createElement("input");
      indentElmt2.type = "checkbox";
      indentElmt2.id = `shield${shieldIndex}_indentFirstLetter2`;
      indentElmt2.checked =
        shields[shieldIndex].indentFirstLetter2 !== undefined
          ? shields[shieldIndex].indentFirstLetter2
          : shields[shieldIndex].indentFirstLetter;
      indentElmt2.onchange = readForm;
      rowContainerElmt.appendChild(indentElmt2);

      const indentLabelElmt2 = document.createElement("label");
      indentLabelElmt2.setAttribute(
        "for",
        `shield${shieldIndex}_indentFirstLetter2`
      );
      indentLabelElmt2.appendChild(
        document.createTextNode("Enlarge First Letter (2nd Banner)")
      );
      rowContainerElmt.appendChild(indentLabelElmt2);

      const fontSizeLabelElmt = document.createElement("label");
      fontSizeLabelElmt.setAttribute("for", `shield${shieldIndex}_fontSize`);
      fontSizeLabelElmt.appendChild(document.createTextNode("Text Size: "));
      fontSizeLabelElmt.style.marginLeft = "2rem";
      rowContainerElmt.appendChild(fontSizeLabelElmt);

      const fontSizeText = document.createElement("input");
      fontSizeText.type = "number";
      fontSizeText.id = `shield${shieldIndex}_fontSize`;
      fontSizeText.placeholder = 1.6;
      fontSizeText.value = parseFloat(
        shields[shieldIndex].fontSize.split("rem")[0]
      );
      fontSizeText.min = 1;
      fontSizeText.max = 3;
      fontSizeText.style.width = "4rem";
      fontSizeText.onchange = readForm;
      rowContainerElmt.appendChild(fontSizeText);

      rowContainerElmt.appendChild(document.createElement("br"));

      rowContainerElmt.appendChild(document.createTextNode("Banners:"));

      rowContainerElmt.appendChild(document.createElement("br"));

      // Populate banner type options
      const bannerTypeSelectElmt = document.createElement("select");
      for (const bannerType of Shield.prototype.bannerTypes) {
        lib.appendOption(bannerTypeSelectElmt, bannerType, {
          selected: shields[shieldIndex].bannerType == bannerType,
        });
      }
      bannerTypeSelectElmt.id = `shield${shieldIndex}_bannerType`;
      bannerTypeSelectElmt.addEventListener("change", readForm);
      rowContainerElmt.appendChild(bannerTypeSelectElmt);
      const bannerCustomInputElmt = document.createElement("input");
      bannerCustomInputElmt.type = "text";
      bannerCustomInputElmt.placeholder = "Custom text";
      bannerCustomInputElmt.id = `shield${shieldIndex}_bannerCustomText`;
      const isCustomBanner =
        !Shield.prototype.bannerTypes.includes(shields[shieldIndex].bannerType);
      bannerCustomInputElmt.value = isCustomBanner
        ? shields[shieldIndex].bannerType
        : "";
      bannerCustomInputElmt.addEventListener("blur", readForm);
      rowContainerElmt.appendChild(bannerCustomInputElmt);

      // Populate banner position options
      const bannerPositionSelectElmt = document.createElement("select");
      for (const bannerPosition of Shield.prototype.bannerPositions) {
        lib.appendOption(bannerPositionSelectElmt, bannerPosition, {
          selected: shields[shieldIndex].bannerPosition == bannerPosition,
        });
      }
      bannerPositionSelectElmt.id = `shield${shieldIndex}_bannerPosition`;
      bannerPositionSelectElmt.addEventListener("change", readForm);
      rowContainerElmt.appendChild(bannerPositionSelectElmt);

      rowContainerElmt.appendChild(document.createElement("br"));

      const bannerType2SelectElmt = document.createElement("select");
      for (const bannerType2 of Shield.prototype.bannerTypes) {
        lib.appendOption(bannerType2SelectElmt, bannerType2, {
          selected: shields[shieldIndex].bannerType2 == bannerType2,
        });
      }
      bannerType2SelectElmt.id = `shield${shieldIndex}_bannerType2`;
      bannerType2SelectElmt.addEventListener("change", readForm);
      rowContainerElmt.appendChild(bannerType2SelectElmt);
      const bannerCustomInputElmt2 = document.createElement("input");
      bannerCustomInputElmt2.type = "text";
      bannerCustomInputElmt2.placeholder = "Custom text";
      bannerCustomInputElmt2.id = `shield${shieldIndex}_bannerCustomText2`;
      const isCustomBanner2 =
        !Shield.prototype.bannerTypes.includes(shields[shieldIndex].bannerType2);
      bannerCustomInputElmt2.value = isCustomBanner2
        ? shields[shieldIndex].bannerType2
        : "";
      bannerCustomInputElmt2.addEventListener("blur", readForm);
      rowContainerElmt.appendChild(bannerCustomInputElmt2);

      // Populate banner position options

      rowContainerElmt.appendChild(document.createElement("br"));

      const duplicateElmt = document.createElement("input");
      duplicateElmt.type = "button";
      duplicateElmt.value = "Duplicate";
      duplicateElmt.dataset.shieldIndex = shieldIndex;
      duplicateElmt.addEventListener("click", function () {
        exposed.duplicateShield(shieldIndex);
      });
      rowContainerElmt.appendChild(duplicateElmt);

      const deleteElmt = document.createElement("input");
      deleteElmt.type = "button";
      deleteElmt.value = "Delete";
      deleteElmt.dataset.shieldIndex = shieldIndex;
      deleteElmt.addEventListener("click", function () {
        exposed.deleteShield(deleteElmt.dataset.shieldIndex);
      });

      rowContainerElmt.appendChild(deleteElmt);

      shieldsContainerElmt.appendChild(rowContainerElmt);
    }
  };

  const updateShieldModalVisual = (selected, differentShield) => {
    const holder = document.querySelector(".shieldPreview");
    const img = holder.querySelector(".selectedShieldPreview");

    if (selected.shieldType === "custom" && selected.imageData) {
      img.src = selected.imageData;
    } else {
      img.src = Shield.prototype.getDirectoryFromShield(
        selected.shieldValue,
        selected.variant
      );
    }

    if (selected.shieldBacks) {
      img.style.setProperty(
        "--shieldBackColor",
        (
          lib.colors[selected.shieldBackColor] || selected.shieldBackColor
        ).toLowerCase()
      );
      img.style.setProperty(
        "--shieldBackRadius",
        selected.shieldBorderRadius + "px"
      );
    } else {
      img.style.setProperty("--shieldBackColor", "");
      img.style.setProperty("--shieldBackRadius", "");
    }

    holder.querySelector(".selectedShieldName").textContent =
      selected.shieldName;

    if (differentShield) {
      document.querySelector("#selectedShieldVariant").innerHTML = "";
      for (const variant of Shield.prototype.getPropertiesFromName(
        selected.shieldValue
      ).variants) {
        lib.appendOption(
          document.querySelector("#selectedShieldVariant"),
          variant,
          { selected: selected.variant == variant }
        );
      }
    }

    document.querySelector("#selectedShieldBacks").value = selected.shieldBacks;
    document.querySelector("#selectedBackColor").value = selected.backColor;
    document.querySelector("#selectedBackRoudness").value =
      selected.shieldBorderRadius;
  };

  const promptShield = function (currentValue, returnMethod = null) {
    const modal = document.querySelector("#shieldImgSelector");
    const holder = document.querySelector("#modalHolder");
    let eventListeners = [];
    return new Promise((resolve, reject) => {
      let selectedShield = {
        shieldType: currentValue?.shieldType || "preset",
        shieldName: currentValue?.shieldName || "Interstate",
        shieldValue: currentValue?.shieldValue || "I",
        variant: currentValue?.variant || "2 Digit",

        shieldBacks: currentValue?.shieldBacks || false,
        shieldBackColor: currentValue?.shieldBackColor || "Black",
        shieldBorderRadius: currentValue?.shieldBorderRadius || 4,

        imageType: currentValue?.imageType || "file",
        imageData: currentValue?.imageData || "",
      };

      // Setup tabs
      document.querySelector("#presetShields").addEventListener("click", () => {
        document.querySelector(".shieldLibrary").dataset.tab =
          "presetShieldList";
        document.querySelector("#presetShields").className = "selected";
        document.querySelector("#customShields").className = "";
        selectedShield.shieldType = "preset";
      });

      document.querySelector("#customShields").addEventListener("click", () => {
        document.querySelector(".shieldLibrary").dataset.tab = "uploadShield";
        document.querySelector("#customShields").className = "selected";
        document.querySelector("#presetShields").className = "";
        selectedShield.shieldType = "custom";
      });

      updateShieldModalVisual(selectedShield, true);

      holder.style.display = "flex";
      modal.style.display = "flex";
      modal.showModal();

      // Setup close button
      // Setup file upload
      const fileInput = document.querySelector("#uploadCustomShield");
      if (fileInput) {
        fileInput.addEventListener("change", (e) => {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
              selectedShield.shieldType = "custom";
              selectedShield.imageType = "data";
              selectedShield.imageData = e.target.result;
              selectedShield.shieldName = file.name.split(".")[0];
              updateShieldModalVisual(selectedShield, true);
            };
            reader.readAsDataURL(file);
          }
        });
      }

      // Setup tabs
      document
        .querySelector("#presetShields")
        ?.addEventListener("click", () => {
          document.querySelector(".shieldLibrary").dataset.tab =
            "presetShieldList";
          document.querySelector("#presetShields").className = "selected";
          document.querySelector("#customShields").className = "";
          selectedShield.shieldType = "preset";
        });

      document
        .querySelector("#customShields")
        ?.addEventListener("click", () => {
          document.querySelector(".shieldLibrary").dataset.tab = "uploadShield";
          document.querySelector("#customShields").className = "selected";
          document.querySelector("#presetShields").className = "";
          selectedShield.shieldType = "custom";
        });

      // Setup close button
      document.querySelector("#shieldImgSelectorClose")?.addEventListener(
        "click",
        () => {
          holder.style.display = "none";
          modal.style.display = "none";
          modal.close();

          // Cleanup event listeners
          for (const e of eventListeners) {
            e.element.removeEventListener("click", e.handler);
          }
          eventListeners.length = 0;

          if (returnMethod) returnMethod(null);
          resolve(null);
        },
        { once: true }
      );

      const setShield = (event) => {
        let isDifferent =
          selectedShield.shieldValue != event.currentTarget.dataset.name;
        selectedShield.shieldName =
          event.currentTarget.querySelector(".shieldItemName").textContent;
        selectedShield.shieldValue = event.currentTarget.dataset.name;
        searchFromDir(
          Shield.prototype.shieldDirectory,
          document.querySelector("#presetShieldList")
        );

        if (
          isDifferent &&
          !Shield.prototype
            .getPropertiesFromName(selectedShield.shieldValue)
            .variants.includes(selectedShield.variant)
        ) {
          selectedShield.variant =
            Shield.prototype.getPropertiesFromName(selectedShield.shieldValue)
              .variants[0] || "";
        }

        updateShieldModalVisual(selectedShield, isDifferent);
      };

      const searchFromDir = (dir, parentElem, createListeners) => {
        let hasAnything = false;
        for (const category in dir) {
          const cat = dir[category];
          if (category == "type") {
            continue;
          }

          if (cat.type == "category") {
            const childElem = parentElem.querySelector(
              '.shieldCategory[data-category="' + category + '"]'
            );
            if (searchFromDir(cat, childElem, createListeners)) {
              hasAnything = true;
              if (selectedShield.name != "") {
                childElem.classList.remove("open");
                childElem.querySelector(".shieldCategoryHead").click();
              }
            }
          } else if (cat.type == "shield") {
            const childElem = parentElem.querySelector(
              '.shieldCategoryType[data-name="' + category + '"]'
            );

            if (cat.name == selectedShield.shieldName) {
              hasAnything = true;
              childElem.classList.add("selected");
              childElem.querySelector(".shieldItemSelected").textContent =
                "radio_button_checked";
            } else {
              childElem.classList.remove("selected");
              childElem.querySelector(".shieldItemSelected").textContent =
                "radio_button_unchecked";
            }

            if (createListeners) {
              childElem.addEventListener("click", setShield);
              eventListeners.push({ element: childElem, handler: setShield });
            }
          }
        }
        return hasAnything;
      };

      searchFromDir(
        Shield.prototype.shieldDirectory,
        document.querySelector("#presetShieldList"),
        true
      );

      const handleVariant = (e) => {
        selectedShield.variant = e.currentTarget.value;
        updateShieldModalVisual(selectedShield, false);
      };
      document
        .querySelector("#selectedShieldVariant")
        .addEventListener("change", handleVariant);
      eventListeners.push({
        element: document.querySelector("#selectedShieldVariant"),
        handler: handleVariant,
      });

      const handleBackColor = (e) => {
        selectedShield.shieldBackColor = e.currentTarget.value;
        updateShieldModalVisual(selectedShield, false);
      };
      document
        .querySelector("#selectedBackColor")
        .addEventListener("change", handleBackColor);
      eventListeners.push({
        element: document.querySelector("#selectedBackColor"),
        handler: handleBackColor,
      });

      const handleBorderRadius = (e) => {
        selectedShield.shieldBorderRadius = parseInt(e.currentTarget.value);
        updateShieldModalVisual(selectedShield, false);
      };
      document
        .querySelector("#selectedBackRoudness")
        .addEventListener("change", handleBorderRadius);
      eventListeners.push({
        element: document.querySelector("#selectedBackRoudness"),
        handler: handleBorderRadius,
      });

      const handleShieldBackCheckbox = (e) => {
        selectedShield.shieldBacks = e.currentTarget.checked;
        updateShieldModalVisual(selectedShield, false);
      };
      document
        .querySelector("#selectedShieldBacks")
        .addEventListener("change", handleShieldBackCheckbox);
      eventListeners.push({
        element: document.querySelector("#selectedShieldBacks"),
        handler: handleShieldBackCheckbox,
      });

      window.customShields.loadSavedShields((shield) => {
        selectedShield.shieldType = "custom";
        selectedShield.shieldName = shield.fileName;
        selectedShield.imageType = "data";
        selectedShield.imageData = shield.data;
        updateShieldModalVisual(selectedShield, true);
      });

      document.querySelector("#setShield").addEventListener("click", () => {
        holder.style.display = "none";
        modal.style.display = "none";
        modal.close();

        // Cleanup event listeners
        for (const e of eventListeners) {
          e.element.removeEventListener("click", e.handler);
        }
        eventListeners.length = 0;

        if (returnMethod) returnMethod(selectedShield);
        resolve(selectedShield);
      });
    });
  };

    return {
      init: initialize,
      readForm,
      updateForm,
      updateShieldSubform,
      ensureSubpanelMenuOpen: () => ensureSubpanelMenuOpenPublic(),
      ensureExitTabMenuOpen: () => ensureExitTabMenuOpenPublic(),
      ensureGuideArrowMenuOpen: (mode) => ensureGuideArrowMenuOpenPublic(mode),
    };
})();
