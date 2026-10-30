/*
  CustomShieldMaker.js - Custom Shield Maker from SignMaker v2.19.
  Builds shields from an uploaded SVG/PNG with a styled route number.
  Saved shields live in IndexedDB (localStorage as a fallback) and appear
  in the shield picker and the shield list.
*/

const CustomShieldMaker = (() => {
  const STORAGE_KEYS = {
    customShieldMakerShields: "signMaker.customShieldMaker.shields.v1",
  };
  const getStoredItem = (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  };
  const setStoredItem = (key, value) => {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  };
  const SHIELD_PICKER_TREE = ShieldPicker.tree;
  const SHIELD_PICKER_CUSTOM_MAKER_VALUE = ShieldPicker.customMakerValue;
  const refreshAllShieldPickers = () => {
    hooks.onShieldListChanged?.();
    ShieldPicker.refreshAll();
  };
  let exposed = null;
  let hooks = {};
  let fontPicker = null;
  let routeColorPicker = null;
  const syncAllFontPickers = () => fontPicker?.sync();
  const syncAllColorPickers = () => routeColorPicker?.sync();
  const updateForm = () => hooks.updateForm?.();
  const updateShieldCountyVisibility = () => {};
  const ensureSubpanelMenuOpenPublic = () => hooks.openSubpanelMenu?.();
  // Selects a shield base on the current block through the editor's shield select.
  const syncShieldBasePickerValue = (value) => hooks.selectShieldBase?.(value);

  const FORM_PERSISTENCE_DB_NAME = "signMaker.formPersistence.v1";
  const FORM_PERSISTENCE_DB_STORE = "keyValue";
  let formPersistenceDbPromise = null;

  const openFormPersistenceDB = () => {
    if (formPersistenceDbPromise) {
      return formPersistenceDbPromise;
    }

    formPersistenceDbPromise = new Promise((resolve, reject) => {
      if (typeof window === "undefined" || !window.indexedDB) {
        reject(new Error("IndexedDB is not available."));
        return;
      }

      const request = window.indexedDB.open(FORM_PERSISTENCE_DB_NAME, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(FORM_PERSISTENCE_DB_STORE)) {
          db.createObjectStore(FORM_PERSISTENCE_DB_STORE, { keyPath: "key" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Unable to open form persistence database."));
      request.onblocked = () => reject(new Error("Form persistence database open was blocked."));
    });

    formPersistenceDbPromise.catch(() => {
      formPersistenceDbPromise = null;
    });

    return formPersistenceDbPromise;
  };

  const setPersistentFormValue = async (key, value) => {
    const db = await openFormPersistenceDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(FORM_PERSISTENCE_DB_STORE, "readwrite");
      const store = transaction.objectStore(FORM_PERSISTENCE_DB_STORE);
      store.put({ key, value, dateModified: new Date().toISOString() });

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error || new Error("Unable to save persistent form value."));
      transaction.onabort = () => reject(transaction.error || new Error("Persistent form value save was aborted."));
    });
  };

  const getPersistentFormValue = async (key) => {
    const db = await openFormPersistenceDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(FORM_PERSISTENCE_DB_STORE, "readonly");
      const store = transaction.objectStore(FORM_PERSISTENCE_DB_STORE);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result ? request.result.value : null);
      request.onerror = () => reject(request.error || new Error("Unable to read persistent form value."));
    });
  };

  const parseStoredRecordArray = (raw) => {
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Unable to parse stored record array", error);
      return [];
    }
  };

  const CUSTOM_SHIELD_MAKER_VALUE_PREFIX = "CUSTOMSHIELD-";
  const CUSTOM_SHIELD_MAKER_VARIANT_KEYS = ["1", "2", "3", "4"];
  let customShieldMakerRecords = [];

  const getCustomShieldMakerVariantLabel = (variantKey) =>
    `${variantKey} Digit`;

  const getCustomShieldMakerVariantAssetKey = (variantKey) =>
    `${variantKey}Digit`;

  const getCustomShieldMakerVariantFallbackOrder = (variantKey) => {
    const normalized = normalizeCustomShieldMakerVariantKey(variantKey, "2");
    const fallbackOrders = {
      "1": ["1", "2", "3", "4"],
      "2": ["2", "1", "3", "4"],
      "3": ["3", "2", "4", "1"],
      "4": ["4", "3", "2", "1"],
    };

    return fallbackOrders[normalized] || fallbackOrders["2"];
  };

  const getCustomShieldMakerImageVariantKeys = (imageDataByVariant = {}) =>
    CUSTOM_SHIELD_MAKER_VARIANT_KEYS.filter((variantKey) => {
      const imageData = imageDataByVariant?.[variantKey];
      return typeof imageData === "string" && imageData.trim().length > 0;
    });

  const normalizeCustomShieldMakerVariantKey = (variantKey, fallback = "2") => {
    const normalized = String(variantKey || "").trim().replace(/\D+/g, "");
    return CUSTOM_SHIELD_MAKER_VARIANT_KEYS.includes(normalized)
      ? normalized
      : fallback;
  };

  const getCustomShieldMakerVariantKeyFromRoute = (routeNumber) => {
    const rawRoute = String(routeNumber || "").trim();
    let count = 0;

    if (typeof ShieldElement !== "undefined" && ShieldElement.prototype.getRouteCharacterCount) {
      count = ShieldElement.prototype.getRouteCharacterCount(rawRoute);
    } else {
      try {
        count = (rawRoute.match(/[\p{L}\p{N}]/gu) || []).length;
      } catch (error) {
        count = (rawRoute.match(/[A-Za-z0-9]/g) || []).length;
      }
    }

    if (count <= 1) {
      return "1";
    }
    if (count === 2) {
      return "2";
    }
    if (count === 3) {
      return "3";
    }
    return "4";
  };

  const normalizeCustomShieldMakerVariantList = (variants, fallback = ["2"]) => {
    const source = Array.isArray(variants) && variants.length ? variants : fallback;
    const normalized = [];

    for (const variant of source) {
      const variantKey = normalizeCustomShieldMakerVariantKey(variant, "");
      if (variantKey && !normalized.includes(variantKey)) {
        normalized.push(variantKey);
      }
    }

    return normalized.length ? normalized : ["2"];
  };

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

  const normalizeCustomShieldMakerRouteStyle = (routeStyle = {}) => ({
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
  });

  const normalizeCustomShieldMakerAnchor = (anchor = {}, routeStyle = {}) => ({
    x: getCustomShieldMakerDisplayNumber(anchor.x, 50),
    y: getCustomShieldMakerDisplayNumber(anchor.y, 50),
    seedTop: getCustomShieldMakerDisplayNumber(
      anchor.seedTop,
      getCustomShieldMakerDisplayNumber(routeStyle.topOffset, 0)
    ),
    seedHorizontal: getCustomShieldMakerDisplayNumber(
      anchor.seedHorizontal,
      getCustomShieldMakerDisplayNumber(routeStyle.horizontalOffset, 0)
    ),
  });

  const normalizeCustomShieldMakerRecord = (record = {}, index = 0) => {
    const id = String(record.id || createCustomShieldMakerId());
    const value = getCustomShieldMakerValue(id);
    const legacyVariantKey = getCustomShieldMakerVariantKeyFromRoute(
      record.routeNumber || "12"
    );
    const rawImageDataByVariant =
      record.imageDataByVariant && typeof record.imageDataByVariant === "object"
        ? record.imageDataByVariant
        : {};
    const rawStyleByVariant =
      record.routeStyleByVariant && typeof record.routeStyleByVariant === "object"
        ? record.routeStyleByVariant
        : {};
    const rawAnchorByVariant =
      record.anchorByVariant && typeof record.anchorByVariant === "object"
        ? record.anchorByVariant
        : {};

    const enabledVariants = normalizeCustomShieldMakerVariantList(
      record.enabledVariants || record.selectedVariants || record.variants,
      Object.keys(rawImageDataByVariant).length
        ? Object.keys(rawImageDataByVariant)
        : [legacyVariantKey]
    );

    const imageDataByVariant = {};
    for (const variantKey of CUSTOM_SHIELD_MAKER_VARIANT_KEYS) {
      const imageData = rawImageDataByVariant[variantKey];
      if (typeof imageData === "string" && imageData.trim()) {
        imageDataByVariant[variantKey] = imageData;
      }
    }

    if (!Object.keys(imageDataByVariant).length && record.imageData) {
      imageDataByVariant[legacyVariantKey] = String(record.imageData || "");
    }

    const routeStyleByVariant = {};
    const anchorByVariant = {};
    const legacyRouteStyle = normalizeCustomShieldMakerRouteStyle(record.routeStyle || {});
    const legacyAnchor = normalizeCustomShieldMakerAnchor(
      record.anchor || record.routeStyle?.anchor || {},
      legacyRouteStyle
    );

    for (const variantKey of CUSTOM_SHIELD_MAKER_VARIANT_KEYS) {
      const style = normalizeCustomShieldMakerRouteStyle(
        rawStyleByVariant[variantKey] ||
          (variantKey === legacyVariantKey ? record.routeStyle : null) ||
          legacyRouteStyle
      );
      routeStyleByVariant[variantKey] = style;
      anchorByVariant[variantKey] = normalizeCustomShieldMakerAnchor(
        rawAnchorByVariant[variantKey] ||
          (variantKey === legacyVariantKey ? record.anchor : null) ||
          legacyAnchor,
        style
      );
    }

    const activeVariant = normalizeCustomShieldMakerVariantKey(
      record.activeVariant || legacyVariantKey,
      legacyVariantKey
    );
    const imageData =
      imageDataByVariant[activeVariant] ||
      Object.values(imageDataByVariant).find(Boolean) ||
      String(record.imageData || "");

    const sourceShieldBase = String(record.sourceShieldBase || "").trim();
    const usesUploadedImage = record.usesUploadedImage === true;
    const preserveCountyText =
      record.preserveCountyText === true &&
      !usesUploadedImage &&
      (typeof ShieldElement?.prototype?.normalizeShieldCode === "function"
        ? ShieldElement.prototype.normalizeShieldCode(sourceShieldBase).toUpperCase() === "C"
        : sourceShieldBase.toUpperCase() === "C");
    const preserveShieldBacks =
      !usesUploadedImage &&
      (typeof ShieldElement?.prototype?.normalizeShieldCode === "function"
        ? ShieldElement.prototype.normalizeShieldCode(sourceShieldBase).toUpperCase() === "C"
        : sourceShieldBase.toUpperCase() === "C");

    return {
      id,
      value,
      name: String(record.name || `Custom Shield ${index + 1}`).trim() || `Custom Shield ${index + 1}`,
      imageData,
      imageDataByVariant,
      enabledVariants: getCustomShieldMakerImageVariantKeys(imageDataByVariant),
      activeVariant,
      routeNumber: String(record.routeNumber ?? "").trim(),
      routeStyle: routeStyleByVariant[activeVariant] || legacyRouteStyle,
      routeStyleByVariant,
      anchor: anchorByVariant[activeVariant] || legacyAnchor,
      anchorByVariant,
      sourceShieldBase,
      usesUploadedImage,
      preserveCountyText,
      preserveShieldBacks,
      dateCreated: record.dateCreated || new Date().toISOString(),
      dateModified: record.dateModified || record.dateCreated || new Date().toISOString(),
    };
  };

  const loadCustomShieldMakerRecords = async () => {
    let records = [];

    try {
      records = parseStoredRecordArray(getStoredItem(STORAGE_KEYS.customShieldMakerShields));
    } catch (error) {
      console.warn("Unable to load custom shield maker records from localStorage", error);
    }

    customShieldMakerRecords = records.map(normalizeCustomShieldMakerRecord).filter((record) => record.imageData);

    try {
      const indexedValue = await getPersistentFormValue(STORAGE_KEYS.customShieldMakerShields);
      const indexedRecords = parseStoredRecordArray(indexedValue);
      if (indexedRecords.length || !records.length) {
        records = indexedRecords;
      }
    } catch (error) {
      if (!records.length) {
        console.warn("Unable to load custom shield maker records from IndexedDB", error);
      }
    }

    customShieldMakerRecords = records.map(normalizeCustomShieldMakerRecord).filter((record) => record.imageData);
    return customShieldMakerRecords;
  };

  const saveCustomShieldMakerRecords = () => {
    const serializedRecords = JSON.stringify(customShieldMakerRecords);
    const savedToLocalStorage = setStoredItem(
      STORAGE_KEYS.customShieldMakerShields,
      serializedRecords
    );

    setPersistentFormValue(STORAGE_KEYS.customShieldMakerShields, serializedRecords).catch((error) => {
      console.warn("Unable to save custom shield maker records to IndexedDB", error);
    });

    return savedToLocalStorage;
  };

  const getCustomShieldMakerRecordById = (id) =>
    customShieldMakerRecords.find((record) => record.id === id) || null;

  const getCustomShieldMakerRecordByValue = (value) =>
    customShieldMakerRecords.find((record) => record.value === value) || null;

  const getCustomShieldMakerVariantImage = (record, variantKey) => {
    const imageDataByVariant = record?.imageDataByVariant || {};
    const requestedVariant = normalizeCustomShieldMakerVariantKey(
      variantKey,
      record?.activeVariant || "2"
    );

    for (const fallbackVariant of getCustomShieldMakerVariantFallbackOrder(requestedVariant)) {
      const fallbackImage = imageDataByVariant[fallbackVariant];
      if (typeof fallbackImage === "string" && fallbackImage.trim()) {
        return fallbackImage;
      }
    }

    return record?.imageData || Object.values(imageDataByVariant).find(Boolean) || "";
  };

  const buildCustomShieldMakerConfig = (record) => {
    const imageVariantKeys = getCustomShieldMakerImageVariantKeys(
      record.imageDataByVariant
    );
    const assetPathByVariant = {};

    for (const variantKey of imageVariantKeys) {
      assetPathByVariant[getCustomShieldMakerVariantAssetKey(variantKey)] =
        record.imageDataByVariant[variantKey];
    }

    return {
      value: record.value,
      label: record.name,
      variants: CUSTOM_SHIELD_MAKER_VARIANT_KEYS.map(getCustomShieldMakerVariantLabel),
      assetPath: getCustomShieldMakerVariantImage(record, record.activeVariant || imageVariantKeys[0] || "2"),
      assetPathByVariant,
      assetName: record.value,
      assetFolder: "",
      suppressRouteNumber: false,
      categories: ["Custom"],
      className: `CUSTOMSHIELD customShieldMakerSaved customShieldMaker-${record.id}${
        record.preserveShieldBacks === true ? " customShieldMakerCountyBackSource" : ""
      }`,
      customShieldMaker: true,
      customShieldMakerId: record.id,
      sourceShieldBase: record.sourceShieldBase || "",
      preserveCountyText: record.preserveCountyText === true,
      preserveShieldBacks: record.preserveShieldBacks === true,
      customRouteStyle: record.routeStyle,
      customAnchor: record.anchor,
      customRouteStyleByVariant: record.routeStyleByVariant || {},
      customAnchorByVariant: record.anchorByVariant || {},
    };
  };

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
    asset: getCustomShieldMakerVariantImage(record, record.activeVariant || "2"),
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
    const customColorControls = document.getElementById("customShieldMakerCustomColorControls");
    const customColorInput = document.getElementById("customShieldMakerRouteCustomColor");
    const customColorSwatch = document.getElementById("customShieldMakerRouteCustomColorSwatch");
    const fontSelect = document.getElementById("customShieldMakerRouteFont");
    const fontSizeInput = document.getElementById("customShieldMakerRouteFontSize");
    const fontWeightInput = document.getElementById("customShieldMakerRouteFontWeight");
    const letterSpacingInput = document.getElementById("customShieldMakerRouteLetterSpacing");
    const topOffsetInput = document.getElementById("customShieldMakerRouteTopOffset");
    const horizontalOffsetInput = document.getElementById("customShieldMakerRouteHorizontalOffset");
    const alignmentSelect = document.getElementById("customShieldMakerRouteAlignment");
    const alignmentButtons = Array.from(
      document.querySelectorAll("#customShieldMakerRouteAlignmentButtons .customShieldMakerAlignmentButton")
    );
    const normalizeCustomShieldMakerAlignment = (value) => {
      const normalized = String(value || "center").toLowerCase();
      return normalized === "left" || normalized === "right" ? normalized : "center";
    };
    const syncCustomShieldMakerAlignmentButtons = () => {
      const selectedAlignment = normalizeCustomShieldMakerAlignment(
        alignmentSelect?.value
      );

      for (const button of alignmentButtons) {
        const isSelected =
          normalizeCustomShieldMakerAlignment(button.dataset.alignment) ===
          selectedAlignment;
        button.classList.toggle("selected", isSelected);
        button.setAttribute("aria-pressed", String(isSelected));
      }
    };
    const fontSizeValueInput = document.getElementById("customShieldMakerRouteFontSizeVal");
    const letterSpacingValueInput = document.getElementById("customShieldMakerRouteLetterSpacingVal");
    const topOffsetValueInput = document.getElementById("customShieldMakerRouteTopOffsetVal");
    const horizontalOffsetValueInput = document.getElementById("customShieldMakerRouteHorizontalOffsetVal");
    const nameInput = document.getElementById("customShieldMakerNameInput");
    const saveButton = document.getElementById("customShieldMakerSaveButton");
    const deleteButton = document.getElementById("customShieldMakerDeleteButton");
    const bindCustomShieldMakerRangePair = (slider, valueInput) => {
      if (!slider || !valueInput || slider.dataset.customShieldRangePairBound === "true") {
        return;
      }

      slider.dataset.customShieldRangePairBound = "true";

      const syncValueFromSlider = () => {
        valueInput.value = slider.value;
      };

      const commitSliderFromValue = () => {
        const parsed = parseFloat(valueInput.value);
        if (!Number.isFinite(parsed)) {
          valueInput.value = slider.value;
          return;
        }
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        const resolved = Math.max(
          Number.isFinite(min) ? min : parsed,
          Math.min(Number.isFinite(max) ? max : parsed, parsed)
        );
        slider.value = resolved;
        valueInput.value = resolved;
        slider.dispatchEvent(new Event("input", { bubbles: true }));
      };

      slider.addEventListener("input", syncValueFromSlider);
      valueInput.addEventListener("input", () => {});
      valueInput.addEventListener("change", commitSliderFromValue);
      valueInput.addEventListener("blur", commitSliderFromValue);
      syncValueFromSlider();
    };

    bindCustomShieldMakerRangePair(fontSizeInput, fontSizeValueInput);
    bindCustomShieldMakerRangePair(letterSpacingInput, letterSpacingValueInput);
    bindCustomShieldMakerRangePair(topOffsetInput, topOffsetValueInput);
    bindCustomShieldMakerRangePair(horizontalOffsetInput, horizontalOffsetValueInput);

    const variantButtons = Array.from(
      document.querySelectorAll("#customShieldMakerVariantButtons [data-variant-digit]")
    );
    const currentVariantLabel = document.getElementById("customShieldMakerCurrentVariantLabel");
    const variantStatus = document.getElementById("customShieldMakerVariantStatus");
    const uploadButtonText = document.getElementById("customShieldMakerUploadButtonText");

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

    const normalizeCustomShieldMakerHexColor = (value, fallback = "#000000") => {
      const rawValue = String(value || "").trim();
      return /^#[0-9a-f]{6}$/i.test(rawValue) ? rawValue : fallback;
    };

    const getCustomShieldMakerRouteColorValue = () => {
      return colorSelect?.value || "Black";
    };

    const clearCustomShieldMakerTemporaryRouteColors = () => {
      if (!colorSelect) {
        return;
      }

      const temporaryOptions = Array.from(colorSelect.options || []).filter(
        (option) => option.dataset.customShieldMakerTemporaryColor === "true"
      );
      const selectedWasTemporary = temporaryOptions.some(
        (option) => option.value === colorSelect.value
      );

      temporaryOptions.forEach((option) => option.remove());

      if (selectedWasTemporary) {
        colorSelect.value = Array.from(colorSelect.options || []).some(
          (option) => option.value === "Black"
        )
          ? "Black"
          : colorSelect.options?.[0]?.value || "";
      }

      if (typeof syncAllColorPickers === "function") {
        syncAllColorPickers();
      }
    };

    const ensureCustomShieldMakerTemporaryRouteColor = (value) => {
      if (!colorSelect) {
        return String(value || "").trim();
      }

      const rawValue = String(value || "").trim();
      const normalizedValue =
        typeof normalizeCustomCssColorValue === "function"
          ? normalizeCustomCssColorValue(rawValue)
          : rawValue;
      const resolvedValue = normalizedValue || rawValue;

      if (!resolvedValue) {
        return "";
      }

      const comparableValue =
        typeof getCustomColorComparableValue === "function"
          ? getCustomColorComparableValue(resolvedValue)
          : resolvedValue.toLowerCase();
      const existingOption = Array.from(colorSelect.options || []).find((option) => {
        if (option.value === resolvedValue || option.value === rawValue) {
          return true;
        }

        if (!comparableValue || typeof getCustomColorComparableValue !== "function") {
          return false;
        }

        return getCustomColorComparableValue(option.value) === comparableValue;
      });

      if (existingOption) {
        return existingOption.value;
      }

      if (
        typeof isValidCssColorValue === "function" &&
        !isValidCssColorValue(resolvedValue)
      ) {
        return "";
      }

      const option = document.createElement("option");
      option.value = resolvedValue;
      option.textContent = resolvedValue;
      option.dataset.customShieldMakerTemporaryColor = "true";
      colorSelect.appendChild(option);
      return option.value;
    };

    const updateCustomShieldMakerCustomColorControls = () => {
      if (customColorControls) {
        customColorControls.hidden = true;
      }

      const nextColor = normalizeCustomShieldMakerHexColor(customColorInput?.value);

      if (customColorInput) {
        customColorInput.value = nextColor;
      }

      if (customColorSwatch) {
        customColorSwatch.style.backgroundColor = nextColor;
      }
    };

    const setCustomShieldMakerRouteColorControlValue = (value) => {
      const rawValue = String(value || "Black").trim() || "Black";
      const resolvedValue = ensureCustomShieldMakerTemporaryRouteColor(rawValue);
      setSelectValueSafely(colorSelect, resolvedValue || rawValue, "Black");
      if (typeof syncAllColorPickers === "function") {
        syncAllColorPickers();
      }
      updateCustomShieldMakerCustomColorControls();
    };

    const getCustomShieldMakerLastPreviewVariant = () => {
      const state = dialog._customShieldMakerVariantState;
      const lastVariant = normalizeCustomShieldMakerVariantKey(
        dialog._customShieldMakerLastRouteVariant || state?.activeVariant || "2",
        "2"
      );

      if (state?.imageDataByVariant?.[lastVariant]) {
        return lastVariant;
      }

      const firstVariantWithImage = getCustomShieldMakerImageVariantKeys(
        state?.imageDataByVariant || {}
      )[0];

      return firstVariantWithImage || lastVariant;
    };

    const getCustomShieldMakerVariantKeyForEditor = () => {
      const routeText = String(routeInput?.value || "").trim();

      if (routeText) {
        const nextVariant = getCustomShieldMakerVariantKeyFromRoute(routeText);
        dialog._customShieldMakerLastRouteVariant = nextVariant;
        return nextVariant;
      }

      return getCustomShieldMakerLastPreviewVariant();
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

    const createEmptyCustomShieldMakerVariantState = () => {
      const activeVariant = getCustomShieldMakerVariantKeyForEditor();

      return {
        enabledVariants: [],
        activeVariant,
        imageDataByVariant: {},
        routeStyleByVariant: {},
        anchorByVariant: {},
      };
    };

    const ensureCustomShieldMakerVariantState = () => {
      if (!dialog._customShieldMakerVariantState) {
        dialog._customShieldMakerVariantState = createEmptyCustomShieldMakerVariantState();
      }

      const state = dialog._customShieldMakerVariantState;
      state.imageDataByVariant = state.imageDataByVariant || {};
      state.enabledVariants = getCustomShieldMakerImageVariantKeys(
        state.imageDataByVariant
      );
      state.activeVariant = normalizeCustomShieldMakerVariantKey(
        state.activeVariant,
        getCustomShieldMakerVariantKeyForEditor()
      );

      state.routeStyleByVariant = state.routeStyleByVariant || {};
      state.anchorByVariant = state.anchorByVariant || {};

      return state;
    };

    const getCustomShieldMakerEditorStyle = () => ({
      color: getCustomShieldMakerRouteColorValue(),
      fontFamily: fontSelect?.value || "Series D",
      fontSize: getDisplayInputValue(fontSizeInput, 220),
      fontWeight: getDisplayInputValue(fontWeightInput, 10),
      letterSpacing: getDisplayInputValue(letterSpacingInput, 0),
      topOffset: getDisplayInputValue(topOffsetInput, 0),
      horizontalOffset: getDisplayInputValue(horizontalOffsetInput, 0),
      alignment: alignmentSelect?.value || "center",
    });

    const getCustomShieldMakerEditorAnchor = () =>
      dialog._customShieldMakerAnchor || {
        x: 50,
        y: 50,
        seedTop: getDisplayInputValue(topOffsetInput, 0),
        seedHorizontal: getDisplayInputValue(horizontalOffsetInput, 0),
      };

    const getFirstCustomShieldMakerVariantImage = (state) =>
      Object.values(state?.imageDataByVariant || {}).find(Boolean) ||
      (previewImg && !previewImg.hidden ? previewImg.src : "");

    const getCustomShieldMakerEditorVariantImage = (state, variantKey) => {
      const requestedVariant = normalizeCustomShieldMakerVariantKey(
        variantKey,
        state?.activeVariant || "2"
      );
      const imageDataByVariant = state?.imageDataByVariant || {};

      for (const fallbackVariant of getCustomShieldMakerVariantFallbackOrder(requestedVariant)) {
        const fallbackImage = imageDataByVariant[fallbackVariant];
        if (typeof fallbackImage === "string" && fallbackImage.trim()) {
          return fallbackImage;
        }
      }

      return getFirstCustomShieldMakerVariantImage(state) || "";
    };

    const persistCurrentCustomShieldMakerVariantState = () => {
      const state = ensureCustomShieldMakerVariantState();
      const activeVariant = normalizeCustomShieldMakerVariantKey(
        state.activeVariant,
        getCustomShieldMakerVariantKeyForEditor()
      );

      state.activeVariant = activeVariant;

      state.routeStyleByVariant[activeVariant] = getCustomShieldMakerEditorStyle();
      state.anchorByVariant[activeVariant] = getCustomShieldMakerEditorAnchor();
      state.enabledVariants = getCustomShieldMakerImageVariantKeys(
        state.imageDataByVariant
      );

      return state;
    };

    const setInputValueIfPresent = (input, value) => {
      if (input) {
        input.value = formatCustomShieldNumber(value, "0");
      }
    };

    const updateCustomShieldMakerVariantButtons = () => {
      const state = ensureCustomShieldMakerVariantState();
      const activeVariant = normalizeCustomShieldMakerVariantKey(
        state.activeVariant,
        getCustomShieldMakerVariantKeyForEditor()
      );

      for (const button of variantButtons) {
        const variantKey = normalizeCustomShieldMakerVariantKey(button.dataset.variantDigit, "");
        const hasDedicatedImage = !!state.imageDataByVariant[variantKey];
        const isCurrent = variantKey === activeVariant;
        button.classList.toggle("selected", hasDedicatedImage);
        button.classList.toggle("currentVariant", isCurrent);
        button.setAttribute("aria-pressed", String(hasDedicatedImage));
        button.title = isCurrent
          ? "This is the variant currently being edited. Change the route number length to edit another variant."
          : hasDedicatedImage
            ? "This digit-count variant has its own uploaded shield image."
            : "This digit-count variant will use the closest custom shield image fallback.";
      }

      if (currentVariantLabel) {
        currentVariantLabel.textContent = `Editing ${activeVariant} digit`;
      }

      if (uploadButtonText) {
        uploadButtonText.textContent = `Upload ${activeVariant} Digit SVG or PNG`;
      }

      const hasDedicatedImage = !!state.imageDataByVariant[activeVariant];
      const fallbackImage = getCustomShieldMakerEditorVariantImage(state, activeVariant);

      if (variantStatus) {
        variantStatus.textContent = hasDedicatedImage
          ? `${activeVariant} digit has its own shield image.`
          : fallbackImage
            ? `${activeVariant} digit does not have its own shield image.`
            : "Route number length selects the variant being edited.";
      }
    };

    const applyCustomShieldMakerVariantToEditor = (variantKey, { preserveRouteNumber = true } = {}) => {
      const state = ensureCustomShieldMakerVariantState();
      const normalizedVariant = normalizeCustomShieldMakerVariantKey(variantKey, state.activeVariant || "2");
      const fallbackVariant = state.activeVariant || normalizedVariant;
      const fallbackStyle =
        state.routeStyleByVariant[normalizedVariant] ||
        state.routeStyleByVariant[fallbackVariant] ||
        getCustomShieldMakerEditorStyle();
      const fallbackAnchor =
        state.anchorByVariant[normalizedVariant] ||
        state.anchorByVariant[fallbackVariant] ||
        getCustomShieldMakerEditorAnchor();
      const imageData = getCustomShieldMakerEditorVariantImage(state, normalizedVariant);

      state.activeVariant = normalizedVariant;
      state.enabledVariants = getCustomShieldMakerImageVariantKeys(
        state.imageDataByVariant
      );

      if (previewImg) {
        previewImg.src = imageData;
        previewImg.hidden = !imageData;
      }

      if (emptyPreview) {
        emptyPreview.hidden = !!imageData;
      }

      const style = normalizeCustomShieldMakerRouteStyle(fallbackStyle);
      setCustomShieldMakerRouteColorControlValue(style.color || "Black");
      setSelectValueSafely(fontSelect, style.fontFamily || "Series D", "Series D");
      if (fontSelect?._fontPickerApi) {
        fontSelect._fontPickerApi.sync();
      }
      setInputValueIfPresent(fontSizeInput, style.fontSize);
      setInputValueIfPresent(fontWeightInput, style.fontWeight);
      setInputValueIfPresent(letterSpacingInput, style.letterSpacing);
      setInputValueIfPresent(topOffsetInput, style.topOffset);
      setInputValueIfPresent(horizontalOffsetInput, style.horizontalOffset);

      if (alignmentSelect) {
        alignmentSelect.value = normalizeCustomShieldMakerAlignment(
          style.alignment
        );
        syncCustomShieldMakerAlignmentButtons();
      }

      setCustomShieldMakerAnchor(normalizeCustomShieldMakerAnchor(fallbackAnchor, style));
      updateCustomShieldMakerVariantButtons();

      if (!preserveRouteNumber && routeInput) {
        routeInput.value = normalizedVariant === "1" ? "1" : "1".repeat(Number(normalizedVariant));
      }
    };

    const syncCustomShieldMakerVariantFromRouteNumber = () => {
      const state = ensureCustomShieldMakerVariantState();
      const nextVariant = getCustomShieldMakerVariantKeyForEditor();

      if (nextVariant !== state.activeVariant) {
        persistCurrentCustomShieldMakerVariantState();
        applyCustomShieldMakerVariantToEditor(nextVariant);
      } else {
        state.activeVariant = nextVariant;
        state.enabledVariants = getCustomShieldMakerImageVariantKeys(
          state.imageDataByVariant
        );
        updateCustomShieldMakerVariantButtons();
      }
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

      const motorway = isMotorwayFont(fontSelect?.value);
      const routeCharacters = Array.from(motorway
        ? encodeMotorwayRouteText(routeText) : String(routeText || ""));
      routeNumber.classList.toggle("motorwayRouteNumber", motorway);
      const isDigit = (character) => /^[0-9]$/.test(character || "");

      routeNumber.replaceChildren();

      routeCharacters.forEach((character, index) => {
        const previousCharacter = routeCharacters[index - 1] || "";
        const nextCharacter = routeCharacters[index + 1] || "";
        const classNames = ["routeChar", "customShieldMakerRouteChar"];

        if (/^[0-9A-Za-z]$/.test(character)) {
          classNames.push(`routeChar-${character.toUpperCase()}`);
        } else if (character === " ") {
          classNames.push("routeChar-space");
        }

        if (isDigit(character) && isDigit(previousCharacter)) {
          classNames.push("routeChar-hasPreviousDigit");
        }
        if (isDigit(character) && isDigit(nextCharacter)) {
          classNames.push("routeChar-hasNextDigit");
        }
        if (character === "3" && previousCharacter === "3") {
          classNames.push("routeChar-previous3");
        }
        if (character === "3" && nextCharacter === "3") {
          classNames.push("routeChar-next3");
        }

        const characterSpan = document.createElement("span");
        characterSpan.className = classNames.join(" ");
        characterSpan.textContent = character === " " ? "\u00A0" : character;
        routeNumber.appendChild(characterSpan);
      });
    };

    const applyCustomShieldMakerLetterSpacing = (spacingValue) => {
      if (!routeNumber) {
        return;
      }

      routeNumber.style.gap = "0";
      Array.from(routeNumber.children).forEach((characterSpan, index) => {
        characterSpan.style.marginLeft = index === 0 ? "0" : spacingValue;
      });
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

      updateCustomShieldMakerCustomColorControls();

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
        "";

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
      const sourceRouteNumber = String(source.routeNumber ?? "").trim();
      const fallbackSeedVariant = dialog._customShieldMakerLastRouteVariant || "2";
      sampleShield.routeNumber = sourceRouteNumber || "1".repeat(Number(fallbackSeedVariant));
      sampleShield.alignment = source.alignment || "Center";

      if (sourceRouteNumber) {
        dialog._customShieldMakerLastRouteVariant = getCustomShieldMakerVariantKeyFromRoute(sourceRouteNumber);
      }

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
        const sampleImageSource =
          sampleImg.currentSrc ||
          sampleImg.getAttribute("src") ||
          sampleImg.src ||
          "";
        const sampleImageFallback =
          typeof window.getSignMakerAssetFallback === "function"
            ? window.getSignMakerAssetFallback(sampleImageSource)
            : null;

        previewImg.src = sampleImageFallback || sampleImageSource;

        if (typeof window.applySignMakerAssetFallback === "function") {
          window.applySignMakerAssetFallback(
            previewImg,
            sampleImageSource
          );
        }

        previewImg.hidden = false;
      }

      if (emptyPreview) {
        emptyPreview.hidden = true;
      }

      if (routeInput) {
        routeInput.value = "";
      }

      if (alignmentSelect) {
        alignmentSelect.value = normalizeCustomShieldMakerAlignment(
          sampleShield.alignment
        );
        syncCustomShieldMakerAlignmentButtons();
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
        const computedRouteColor =
          typeof normalizeCustomCssColorValue === "function"
            ? normalizeCustomCssColorValue(computedRoute.color)
            : computedRoute.color;
        const fontName = getFontOptionFromComputedFamily(computedRoute.fontFamily);

        setCustomShieldMakerRouteColorControlValue(
          colorName || computedRouteColor || computedRoute.color || "Black"
        );
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

      const seedVariantKey = getCustomShieldMakerVariantKeyForEditor();
      dialog._customShieldMakerVariantState = {
        enabledVariants: [seedVariantKey],
        activeVariant: seedVariantKey,
        imageDataByVariant: previewImg && !previewImg.hidden && previewImg.src
          ? { [seedVariantKey]: previewImg.src }
          : {},
        routeStyleByVariant: { [seedVariantKey]: getCustomShieldMakerEditorStyle() },
        anchorByVariant: { [seedVariantKey]: getCustomShieldMakerEditorAnchor() },
      };
      updateCustomShieldMakerVariantButtons();

      sampleRoot.remove();
    };

    const updateCustomShieldMakerPreview = () => {
      if (!routeNumber) {
        return;
      }

      const syncPairedValueInput = (slider, valueInput) => {
        if (slider && valueInput && document.activeElement !== valueInput) {
          valueInput.value = slider.value;
        }
      };
      syncPairedValueInput(fontSizeInput, fontSizeValueInput);
      syncPairedValueInput(letterSpacingInput, letterSpacingValueInput);
      syncPairedValueInput(topOffsetInput, topOffsetValueInput);
      syncPairedValueInput(horizontalOffsetInput, horizontalOffsetValueInput);

      const routeText = String(routeInput?.value || "").trim();
      updateCustomShieldMakerCustomColorControls();

      const selectedColor = getCustomShieldMakerRouteColorValue();
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
      const renderedSelectedFont = typeof resolveTextFontFamilyForRender === "function"
        ? resolveTextFontFamilyForRender(selectedFont, { backgroundColor: "Blue" }, { color: "Blue" })
        : selectedFont;
      const normalizedRenderedSelectedFont = String(renderedSelectedFont || "")
        .replace(/["']/g, "")
        .trim();
      const usesSeriesDSpacingFix = normalizedRenderedSelectedFont === "Series D";
      routeNumber.classList.toggle("seriesDSpacingFix", usesSeriesDSpacingFix);
      document
        .getElementById("customShieldMakerShieldShell")
        ?.classList.toggle("seriesDSpacingFix", usesSeriesDSpacingFix);
      routeNumber.style.fontFamily = `"${renderedSelectedFont}", sans-serif`;
      routeNumber.style.fontSize = previewEmFromDisplayValue(
        isMotorwayFont(renderedSelectedFont)
          ? getDisplayInputValue(fontSizeInput, 220) * 0.8
          : fontSizeInput?.value,
        220
      );
      routeNumber.style.fontWeight = String(cssWeight);
      routeNumber.style.fontVariationSettings = `"wght" ${requestedWeight}`;
      routeNumber.style.letterSpacing = "0";
      applyCustomShieldMakerLetterSpacing(letterSpacingValue);
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

    let customShieldMakerUndoStack = [];
    let customShieldMakerRedoStack = [];
    let customShieldMakerLastHistoryKey = "";
    let customShieldMakerRestoringHistory = false;

    const cloneCustomShieldMakerObject = (value) => {
      try {
        return JSON.parse(JSON.stringify(value || {}));
      } catch (error) {
        return {};
      }
    };

    const getCustomShieldMakerHistorySnapshot = () => {
      const previewSrc = previewImg && !previewImg.hidden ? previewImg.src : "";

      return {
        name: nameInput?.value || "",
        routeNumber: routeInput?.value || "",
        color: colorSelect?.value || "Black",
        customColor: normalizeCustomShieldMakerHexColor(customColorInput?.value),
        fontFamily: fontSelect?.value || "Series D",
        fontSize: fontSizeInput?.value || "",
        fontWeight: fontWeightInput?.value || "",
        letterSpacing: letterSpacingInput?.value || "",
        topOffset: topOffsetInput?.value || "",
        horizontalOffset: horizontalOffsetInput?.value || "",
        alignment: alignmentSelect?.value || "center",
        previewSrc,
        previewHidden: !previewSrc,
        emptyPreviewHidden: !!emptyPreview?.hidden,
        userUploaded: dialog.dataset.customShieldMakerUserUploaded === "true",
        activeVariant: dialog._customShieldMakerVariantState?.activeVariant || "2",
        lastRouteVariant: dialog._customShieldMakerLastRouteVariant || "",
        variantState: cloneCustomShieldMakerObject(dialog._customShieldMakerVariantState),
        anchor: cloneCustomShieldMakerObject(dialog._customShieldMakerAnchor),
      };
    };

    const restoreCustomShieldMakerHistorySnapshot = (snapshot) => {
      if (!snapshot) {
        return;
      }

      customShieldMakerRestoringHistory = true;

      try {
        if (nameInput) nameInput.value = snapshot.name || "";
        if (routeInput) routeInput.value = snapshot.routeNumber || "";
        if (fontSelect) fontSelect.value = snapshot.fontFamily || "Series D";
        if (fontSizeInput) fontSizeInput.value = snapshot.fontSize || "";
        if (fontWeightInput) fontWeightInput.value = snapshot.fontWeight || "";
        if (letterSpacingInput) letterSpacingInput.value = snapshot.letterSpacing || "";
        if (topOffsetInput) topOffsetInput.value = snapshot.topOffset || "";
        if (horizontalOffsetInput) horizontalOffsetInput.value = snapshot.horizontalOffset || "";
        if (alignmentSelect) {
          alignmentSelect.value = normalizeCustomShieldMakerAlignment(
            snapshot.alignment
          );
          syncCustomShieldMakerAlignmentButtons();
        }

        if (colorSelect) {
          setCustomShieldMakerRouteColorControlValue(
            snapshot.color || "Black"
          );
        }

        if (customColorInput) {
          customColorInput.value = normalizeCustomShieldMakerHexColor(snapshot.customColor);
        }

        dialog._customShieldMakerVariantState = cloneCustomShieldMakerObject(snapshot.variantState);
        dialog._customShieldMakerAnchor = cloneCustomShieldMakerObject(snapshot.anchor);
        dialog._customShieldMakerLastRouteVariant = snapshot.lastRouteVariant || "";

        if (snapshot.userUploaded) {
          dialog.dataset.customShieldMakerUserUploaded = "true";
        } else {
          delete dialog.dataset.customShieldMakerUserUploaded;
        }

        if (previewImg) {
          previewImg.src = snapshot.previewSrc || "";
          previewImg.hidden = !!snapshot.previewHidden || !snapshot.previewSrc;
        }

        if (emptyPreview) {
          emptyPreview.hidden = !!snapshot.previewSrc;
        }

        updateCustomShieldMakerCustomColorControls();
        updateCustomShieldMakerVariantButtons();
        updateCustomShieldMakerPreview();
      } finally {
        customShieldMakerRestoringHistory = false;
      }
    };

    const resetCustomShieldMakerHistory = () => {
      const snapshot = getCustomShieldMakerHistorySnapshot();
      customShieldMakerUndoStack = [snapshot];
      customShieldMakerRedoStack = [];
      customShieldMakerLastHistoryKey = JSON.stringify(snapshot);
    };

    const recordCustomShieldMakerHistoryCheckpoint = () => {
      if (customShieldMakerRestoringHistory || !dialog.open) {
        return;
      }

      const snapshot = getCustomShieldMakerHistorySnapshot();
      const snapshotKey = JSON.stringify(snapshot);

      if (snapshotKey === customShieldMakerLastHistoryKey) {
        return;
      }

      customShieldMakerUndoStack.push(snapshot);

      if (customShieldMakerUndoStack.length > 100) {
        customShieldMakerUndoStack.shift();
      }

      customShieldMakerRedoStack = [];
      customShieldMakerLastHistoryKey = snapshotKey;
    };

    const undoCustomShieldMakerEdit = () => {
      if (customShieldMakerUndoStack.length <= 1) {
        return;
      }

      const currentSnapshot = customShieldMakerUndoStack.pop();
      customShieldMakerRedoStack.push(currentSnapshot);
      const previousSnapshot = customShieldMakerUndoStack[customShieldMakerUndoStack.length - 1];
      customShieldMakerLastHistoryKey = JSON.stringify(previousSnapshot);
      restoreCustomShieldMakerHistorySnapshot(previousSnapshot);
    };

    const redoCustomShieldMakerEdit = () => {
      if (!customShieldMakerRedoStack.length) {
        return;
      }

      const nextSnapshot = customShieldMakerRedoStack.pop();
      customShieldMakerUndoStack.push(nextSnapshot);
      customShieldMakerLastHistoryKey = JSON.stringify(nextSnapshot);
      restoreCustomShieldMakerHistorySnapshot(nextSnapshot);
    };

    const isCustomShieldMakerUndoShortcut = (event) => {
      const primaryModifier = isMacOS ? event.metaKey : event.ctrlKey;
      return primaryModifier && !event.altKey && !event.shiftKey && String(event.key).toLowerCase() === "z";
    };

    const isCustomShieldMakerRedoShortcut = (event) => {
      const primaryModifier = isMacOS ? event.metaKey : event.ctrlKey;
      const key = String(event.key).toLowerCase();

      if (primaryModifier && event.shiftKey && !event.altKey && key === "z") {
        return true;
      }

      return !isMacOS && primaryModifier && !event.shiftKey && !event.altKey && key === "y";
    };

    const isCustomShieldMakerTypingTarget = (target) => {
      if (!target || !dialog.contains(target)) {
        return false;
      }

      const tagName = target.tagName;
      const inputType = String(target.type || "").toLowerCase();

      return (
        target.isContentEditable ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        (tagName === "INPUT" &&
          ![
            "button",
            "checkbox",
            "file",
            "hidden",
            "image",
            "radio",
            "range",
            "reset",
            "submit",
          ].includes(inputType))
      );
    };

    document.addEventListener(
      "keydown",
      (event) => {
        if (!dialog.open) {
          return;
        }

        if (event.key === "Escape") {
          return;
        }

        if (isCustomShieldMakerUndoShortcut(event)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          undoCustomShieldMakerEdit();
          return;
        }

        if (isCustomShieldMakerRedoShortcut(event)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          redoCustomShieldMakerEdit();
          return;
        }

        if (isCustomShieldMakerTypingTarget(event.target)) {
          return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
      },
      true
    );

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

      resetCustomShieldMakerHistory();
    };

    const applyCustomShieldMakerRecordToEditor = (record) => {
      if (!record) {
        return;
      }

      populateCustomShieldMakerSelects();
      const normalizedRecord = normalizeCustomShieldMakerRecord(record);
      const activeVariant = normalizeCustomShieldMakerVariantKey(
        normalizedRecord.activeVariant ||
          getCustomShieldMakerVariantKeyFromRoute(normalizedRecord.routeNumber || routeInput?.value || ""),
        getCustomShieldMakerVariantKeyForEditor()
      );
      const enabledVariants = getCustomShieldMakerImageVariantKeys(
        normalizedRecord.imageDataByVariant
      );

      dialog._editingCustomShieldId = normalizedRecord.id;
      if (normalizedRecord.usesUploadedImage) {
        dialog.dataset.customShieldMakerUserUploaded = "true";
      } else {
        delete dialog.dataset.customShieldMakerUserUploaded;
      }
      dialog._customShieldMakerSource = {
        shieldBase: normalizedRecord.value,
        type: normalizedRecord.value,
        sourceShieldBase: normalizedRecord.sourceShieldBase || "",
        routeNumber: normalizedRecord.routeNumber || routeInput?.value || "",
        alignment: normalizedRecord.routeStyleByVariant?.[activeVariant]?.alignment || "center",
      };
      dialog._customShieldMakerVariantState = {
        enabledVariants,
        activeVariant,
        imageDataByVariant: { ...(normalizedRecord.imageDataByVariant || {}) },
        routeStyleByVariant: { ...(normalizedRecord.routeStyleByVariant || {}) },
        anchorByVariant: { ...(normalizedRecord.anchorByVariant || {}) },
      };

      if (nameInput) {
        nameInput.value = normalizedRecord.name || getDefaultCustomShieldMakerName();
      }

      if (routeInput) {
        routeInput.value = normalizedRecord.routeNumber || "";
      }

      if (normalizedRecord.routeNumber) {
        dialog._customShieldMakerLastRouteVariant = getCustomShieldMakerVariantKeyFromRoute(
          normalizedRecord.routeNumber
        );
      } else {
        dialog._customShieldMakerLastRouteVariant = activeVariant;
      }

      applyCustomShieldMakerVariantToEditor(activeVariant);
    };

    const collectCustomShieldMakerRecordFromEditor = () => {
      const existingRecord = dialog._editingCustomShieldId
        ? getCustomShieldMakerRecordById(dialog._editingCustomShieldId)
        : null;

      const state = persistCurrentCustomShieldMakerVariantState();
      const activeVariant = normalizeCustomShieldMakerVariantKey(
        state.activeVariant,
        getCustomShieldMakerVariantKeyForEditor()
      );
      const enabledVariants = getCustomShieldMakerImageVariantKeys(
        state.imageDataByVariant
      );

      const imageData =
        state.imageDataByVariant[activeVariant] ||
        getFirstCustomShieldMakerVariantImage(state) ||
        "";

      if (!imageData) {
        window.alert("Upload or select a shield image before saving.");
        return null;
      }

      const id = existingRecord?.id || createCustomShieldMakerId();
      const now = new Date().toISOString();
      const fallbackName = existingRecord?.name || getDefaultCustomShieldMakerName();
      const name = String(nameInput?.value || fallbackName).trim() || fallbackName;
      const routeStyleByVariant = {};
      const anchorByVariant = {};
      const makerSource = dialog._customShieldMakerSource || {};
      const sourceShieldBase = String(
        existingRecord?.sourceShieldBase ||
          makerSource.sourceShieldBase ||
          makerSource.shieldBase ||
          makerSource.type ||
          ""
      ).trim();
      const normalizedSourceShieldBase =
        typeof ShieldElement?.prototype?.normalizeShieldCode === "function"
          ? ShieldElement.prototype.normalizeShieldCode(sourceShieldBase).toUpperCase()
          : sourceShieldBase.toUpperCase();
      const usesUploadedImage =
        dialog.dataset.customShieldMakerUserUploaded === "true";
      const preserveCountyText =
        normalizedSourceShieldBase === "C" && !usesUploadedImage;
      const preserveShieldBacks =
        normalizedSourceShieldBase === "C" && !usesUploadedImage;

      for (const variantKey of CUSTOM_SHIELD_MAKER_VARIANT_KEYS) {
        routeStyleByVariant[variantKey] = normalizeCustomShieldMakerRouteStyle(
          state.routeStyleByVariant[variantKey] || state.routeStyleByVariant[activeVariant] || {}
        );
        anchorByVariant[variantKey] = normalizeCustomShieldMakerAnchor(
          state.anchorByVariant[variantKey] || state.anchorByVariant[activeVariant] || {},
          routeStyleByVariant[variantKey]
        );
      }

      return {
        id,
        value: getCustomShieldMakerValue(id),
        name,
        imageData,
        imageDataByVariant: { ...(state.imageDataByVariant || {}) },
        enabledVariants,
        activeVariant,
        routeNumber: String(routeInput?.value || "").trim(),
        routeStyle: routeStyleByVariant[activeVariant],
        routeStyleByVariant,
        anchor: anchorByVariant[activeVariant],
        anchorByVariant,
        sourceShieldBase,
        usesUploadedImage,
        preserveCountyText,
        preserveShieldBacks,
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
        closeCustomShieldMaker();
        window.setTimeout(() => {
          if (typeof ensureSubpanelMenuOpenPublic === "function") {
            ensureSubpanelMenuOpenPublic();
          }
        }, 0);
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
        hideCustomShieldMaker();
      }
    };

    const hideCustomShieldMaker = () => {
      dialog.style.display = "none";
      clearCustomShieldMakerTemporaryRouteColors();

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
      dialog._customShieldMakerVariantState = null;
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

        const state = ensureCustomShieldMakerVariantState();
        const activeVariant = normalizeCustomShieldMakerVariantKey(
          state.activeVariant,
          getCustomShieldMakerVariantKeyForEditor()
        );
        state.activeVariant = activeVariant;

        state.imageDataByVariant[activeVariant] = readerEvent.target.result;
        state.enabledVariants = getCustomShieldMakerImageVariantKeys(
          state.imageDataByVariant
        );
        state.routeStyleByVariant[activeVariant] = getCustomShieldMakerEditorStyle();
        state.anchorByVariant[activeVariant] = getCustomShieldMakerEditorAnchor();
        updateCustomShieldMakerVariantButtons();
        updateCustomShieldMakerPreview();
        recordCustomShieldMakerHistoryCheckpoint();
      };

      reader.readAsDataURL(file);
    });

    const constrainMotorwayRouteInput = () => {
      if (!routeInput || !isMotorwayFont(fontSelect?.value)) return;
      const previous = routeInput.value;
      const cursor = routeInput.selectionStart;
      routeInput.value = normalizeMotorwayRouteText(previous);
      if (cursor !== null && document.activeElement === routeInput) {
        const position = normalizeMotorwayRouteText(previous.slice(0, cursor)).length;
        routeInput.setSelectionRange(position, position);
      }
    };
    routeInput?.addEventListener("input", () => {
      constrainMotorwayRouteInput();
      syncCustomShieldMakerVariantFromRouteNumber();
      updateCustomShieldMakerPreview();
      persistCurrentCustomShieldMakerVariantState();
      recordCustomShieldMakerHistoryCheckpoint();
    });
    routeInput?.addEventListener("change", () => {
      constrainMotorwayRouteInput();
      syncCustomShieldMakerVariantFromRouteNumber();
      updateCustomShieldMakerPreview();
      persistCurrentCustomShieldMakerVariantState();
      recordCustomShieldMakerHistoryCheckpoint();
    });
    fontSelect?.addEventListener("change", constrainMotorwayRouteInput);

    const applyCustomShieldMakerAlignment = (
      value,
      { recordHistory = true } = {}
    ) => {
      if (!alignmentSelect) {
        return false;
      }

      alignmentSelect.value = normalizeCustomShieldMakerAlignment(value);
      syncCustomShieldMakerAlignmentButtons();
      updateCustomShieldMakerPreview();
      persistCurrentCustomShieldMakerVariantState();

      if (recordHistory) {
        recordCustomShieldMakerHistoryCheckpoint();
      }

      return true;
    };

    for (const button of alignmentButtons) {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        applyCustomShieldMakerAlignment(button.dataset.alignment);
      });
    }

    alignmentSelect?.addEventListener(
      "input",
      syncCustomShieldMakerAlignmentButtons
    );
    alignmentSelect?.addEventListener(
      "change",
      syncCustomShieldMakerAlignmentButtons
    );
    syncCustomShieldMakerAlignmentButtons();

    [
      nameInput,
      colorSelect,
      customColorInput,
      fontSelect,
      fontSizeInput,
      fontWeightInput,
      letterSpacingInput,
      topOffsetInput,
      horizontalOffsetInput,
      alignmentSelect,
    ].forEach((input) => {
      input?.addEventListener("input", () => {
        updateCustomShieldMakerCustomColorControls();
        updateCustomShieldMakerPreview();
        persistCurrentCustomShieldMakerVariantState();
        recordCustomShieldMakerHistoryCheckpoint();
      });
      input?.addEventListener("change", () => {
        updateCustomShieldMakerCustomColorControls();
        updateCustomShieldMakerPreview();
        persistCurrentCustomShieldMakerVariantState();
        recordCustomShieldMakerHistoryCheckpoint();
      });
    });

    for (const button of variantButtons) {
      button.addEventListener("click", () => {
        const state = ensureCustomShieldMakerVariantState();
        const variantKey = normalizeCustomShieldMakerVariantKey(
          button.dataset.variantDigit,
          state.activeVariant || "2"
        );

        if (state.imageDataByVariant[variantKey]) {
          delete state.imageDataByVariant[variantKey];
          delete state.enabledVariants;
          state.enabledVariants = getCustomShieldMakerImageVariantKeys(
            state.imageDataByVariant
          );
          updateCustomShieldMakerVariantButtons();
          if (variantKey === state.activeVariant) {
            applyCustomShieldMakerVariantToEditor(variantKey);
            updateCustomShieldMakerPreview();
          }
          recordCustomShieldMakerHistoryCheckpoint();
          return;
        }

        if (variantKey === state.activeVariant) {
          uploadButton?.click();
          return;
        }

        updateCustomShieldMakerVariantButtons();
        recordCustomShieldMakerHistoryCheckpoint();
      });
    }

    populateCustomShieldMakerSelects();
    syncCustomShieldMakerAlignmentButtons();
    fontPicker = createNativeSelectPicker(fontSelect, "Route number font", {
      textStyleForValue: (font) => ({
        fontFamily: `"${resolveTextFontFamilyForRender(font, {}, null)}"`,
      }),
    });
    const routeColorSelect = document.getElementById("customShieldMakerRouteColor");
    routeColorPicker = createNativeSelectPicker(routeColorSelect, "Route number color", {
      colorForValue: (color) => lib.colors[color] || (/^#|^rgb/i.test(color) ? color : null),
    });
    ensureCustomShieldMakerVariantState();
    updateCustomShieldMakerVariantButtons();
    updateCustomShieldMakerPreview();
  };

  // Opens the maker from the shield picker, seeded from the selected shield block.
  const openFromPicker = (currentValue) => {
    const dialog = document.getElementById("customShieldMaker");
    const currentBlockElem = exposed?.getCurrentBlockElem?.() || null;
    dialog._editingCustomShieldId = null;
    delete dialog.dataset.customShieldMakerUserUploaded;
    dialog._customShieldMakerSource = {
      ...currentBlockElem,
      shieldBase: currentValue || currentBlockElem?.shieldBase || "I",
      type: currentValue || currentBlockElem?.shieldBase || "I",
      shieldType: document.getElementById("sdShield_shieldType")?.value || currentBlockElem?.shieldType || "Auto",
      routeNumber: document.getElementById("sdShield_routeNumber")?.value || currentBlockElem?.routeNumber || "",
      alignment: document.getElementById("sdShield_alignment")?.value || currentBlockElem?.alignment || "Center",
    };
    document.getElementById("openCustomShieldMaker").click();
  };

  const init = async (exposedFunctions, formHooks) => {
    exposed = exposedFunctions;
    hooks = formHooks;
    initCustomShieldMaker();
    ShieldPicker.enableCustomShieldMaker(openFromPicker);
    try {
      await loadCustomShieldMakerRecords();
    } catch (error) {
      console.warn("Unable to load custom shield maker records", error);
    }
    refreshCustomShieldMakerRegistry();
  };

  return { init, isCustomShieldMakerValue };
})();
