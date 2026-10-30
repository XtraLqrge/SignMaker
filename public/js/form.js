/*
  // form.js - JK_Potato/Computer
  Responsible for changes within the website form (editor)
*/

const formHandler = (function () {
  let exposed;
  let post;
  // Shield editor controls built in init (picker tree and shared dropdowns).
  let shieldBasePicker = null;
  let populateShieldVariantOptions = () => {};
  const shieldPickers = {};
  const syncShieldChoiceButtons = () => {
    document
      .querySelectorAll('[data-property="sdShield"] .sdShieldSquareButton')
      .forEach((button) => {
        const select = document.getElementById(button.dataset.shieldSelectTarget);
        const checkbox = document.getElementById(button.dataset.shieldCheckboxTarget);
        const active = select
          ? select.value === button.dataset.shieldSelectValue
          : !!checkbox?.checked;
        button.classList.toggle("activated", active);
        button.setAttribute("aria-pressed", String(active));
      });
  };
  // Banner and road name sizes are shown as tenths of a rem (16 = 1.6rem).
  const toShieldFontSizeDisplay = (value) => String(Math.round(parseFloat(value) * 10));
  const fromShieldFontSizeDisplay = (input, fallback) => {
    const parsed = parseFloat(input?.value);
    return ShieldElement.prototype.normalizeFontSize(
      Number.isFinite(parsed) ? parsed / 10 : fallback,
      fallback
    );
  };
  let blockDragState = null;
  let panelDragState = null;
  let subPanelDragState = null;
  let exitTabDragState = null;
  let rowDragState = null;
  let newRowDropTargetButton = null;
  let newBlockDragSourceButton = null;
  let blockCreateNewRowDropIndex = null;
  let blockSelectionMode = false;
  // Last block clicked in selection mode; shift-click selects up to it.
  let blockSelectionAnchor = null;
  let selectedBlockKeys = new Set();
  let blockSelectionContextKey = "";
  let scheduleMobileLayoutUpdate = () => {};
  const STORAGE_KEYS = {
    oldInterstateNumberPositioning: "signMaker.oldInterstateNumberPositioning",
    themeMode: "signMaker.interfaceThemeMode",
    toolbarPosition: "signMaker.toolbarPosition",
    uiScale: "signMaker.interfaceUiScale",
    keybindMode: "signMaker.keybindMode",
    shortcutOverrides: "signMaker.shortcutOverrides",
    postPosition: "signMaker.postPosition",
    postColor: "signMaker.postColor",
    signAlignment: "signMaker.signAlignment",
    showPost: "signMaker.showPost",
    copySignsOnly: "signMaker.copySignsOnly",
    copyScale: "signMaker.copyScale",
    postThickness: "signMaker.postThickness",
    controlTextFont: "signMaker.controlTextFont",
    actionMessageFont: "signMaker.actionMessageFont",
    bannerFontFamily: "signMaker.bannerFontFamily",
    exitTabPosition: "signMaker.exitTabPosition",
    exitTabWidth: "signMaker.exitTabWidth",
    exitTabFHWAFont: "signMaker.exitTabFHWAFont",
    exitTabFontFamily: "signMaker.exitTabFontFamily",
    exitTabCornerRadius: "signMaker.exitTabCornerRadius",
    exitTabHorizontalPadding: "signMaker.exitTabHorizontalPadding",
    exitTabFullBorder: "signMaker.exitTabFullBorder",
    exitTabSquareCorners: "signMaker.exitTabSquareCorners",
    exitTabExtendHorizontalPadding:
      "signMaker.exitTabExtendHorizontalPadding",
    exitTabMatchSignCornerRadius: "signMaker.exitTabMatchSignCornerRadius",
    exitTabAttached: "signMaker.exitTabAttached",
    exitTabTopOffset: "signMaker.exitTabTopOffset",
    panelCorner: "signMaker.panelCorner",
    panelPadding: "signMaker.panelPadding",
  };
  let localStorageAvailable;
  let localStorageWarningLogged = false;
  let hasPanelCornerPreference = false;
  const LIMON_TRIGGER_VALUE = "limon";
  const LIMON_VIDEO_URL = "https://www.youtube.com/watch?v=qA7qUG6uEbY";
  const EXIT_TAB_APL_EDGE_WIDTH = "APL Edge";
  const isAplEdgeExitTabWidth = (width) =>
    String(width || "").trim().toLowerCase() ===
    EXIT_TAB_APL_EDGE_WIDTH.toLowerCase();
  const canUseAplEdgeExitTab = () =>
    !!(
      exposed &&
      typeof exposed.canUseAplEdgeExitTab === "function" &&
      exposed.canUseAplEdgeExitTab()
    );
  const syncExitTabWidthOptions = (exitTab = null) => {
    const exitTabWidthSelectElmt = document.getElementById("exitTabWidth");
    if (!exitTabWidthSelectElmt) {
      return false;
    }

    const shouldAllowAplEdge = canUseAplEdgeExitTab();
    const aplEdgeOptions = Array.from(exitTabWidthSelectElmt.options).filter(
      (option) => isAplEdgeExitTabWidth(option.value)
    );

    if (shouldAllowAplEdge) {
      if (!aplEdgeOptions.length) {
        lib.appendOption(exitTabWidthSelectElmt, EXIT_TAB_APL_EDGE_WIDTH);
      }
      aplEdgeOptions.slice(1).forEach((option) => option.remove());
    } else if (exitTab && isAplEdgeExitTabWidth(exitTab.width)) {
      aplEdgeOptions.forEach((option) => option.remove());
      exitTab.width = "Edge";
    } else {
      aplEdgeOptions.forEach((option) => option.remove());
    }

    return shouldAllowAplEdge;
  };
  const BUILT_IN_PANEL_PADDING = "0.3rem 0.75rem 0.3rem 0.75rem";
  const BUILT_IN_PANEL_PADDING_VALUES = [0.3, 0.75, 0.3, 0.75];
  const PANEL_PADDING_FIELDS = [
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
  ];
  const BLOCK_ELEMENT_SYMBOLS = {
    ControlTextElement: "text_fields",
    ActionMessageElement: "campaign",
    AdvisoryMessageElement: "warning",
    DividerElement: "horizontal_rule",
    BeaconElement: "lightbulb",
    ElectronicSignElement: "display_settings",
    GroupedBlockElement: "folder",
  };
  const BLOCK_ELEMENT_ASSETS = {
    ShieldElement: "img/shields/United States/Interstate/I-2Digit.svg",
    ArrowElement: "img/arrowBlocks/TYPE_A.svg",
    IconElement: "img/icons/AIRPORT.svg",
    TollLogoElement: "img/tolls/EZPass.png",
  };
  const createBlockElementVisual = (blockElementType) => {
    if (BLOCK_ELEMENT_ASSETS[blockElementType]) {
      const asset = document.createElement("img");
      asset.className = "blockElementAsset";
      asset.src = BLOCK_ELEMENT_ASSETS[blockElementType];
      asset.alt = "";
      asset.setAttribute("aria-hidden", "true");
      return asset;
    }

    const symbol = document.createElement("span");
    symbol.className = "material-symbols-outlined blockElementSymbol";
    symbol.setAttribute("aria-hidden", "true");
    symbol.textContent = BLOCK_ELEMENT_SYMBOLS[blockElementType] || "widgets";
    return symbol;
  };
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
  const getDefaultPanelPadding = () =>
    typeof Sign !== "undefined" &&
      Sign.prototype &&
      typeof Sign.prototype.defaultPadding === "string"
      ? Sign.prototype.defaultPadding
      : BUILT_IN_PANEL_PADDING;
  const clampPanelPaddingValue = (value, fallback) => {
    const parsed = typeof value === "string" ? parseFloat(value) : Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(20, Math.max(0, parsed));
  };
  const parsePanelPaddingValues = (padding) => {
    const fallbackValues = BUILT_IN_PANEL_PADDING_VALUES.slice();
    const source =
      typeof padding === "string" && padding.trim().length > 0
        ? padding
        : getDefaultPanelPadding();
    const parts = source.trim().split(/\s+/).map((part) => parseFloat(part));
    let values = fallbackValues;

    if (parts.length === 1) {
      values = [parts[0], parts[0], parts[0], parts[0]];
    } else if (parts.length === 2) {
      values = [parts[0], parts[1], parts[0], parts[1]];
    } else if (parts.length === 3) {
      values = [parts[0], parts[1], parts[2], parts[1]];
    } else if (parts.length >= 4) {
      values = [parts[0], parts[1], parts[2], parts[3]];
    }

    return values.map((value, index) =>
      clampPanelPaddingValue(value, fallbackValues[index])
    );
  };
  const formatPanelPaddingValues = (values) =>
    values.map((value) => value + "rem").join(" ");
  const normalizePanelPaddingString = (padding) =>
    formatPanelPaddingValues(parsePanelPaddingValues(padding));
  const getPanelPaddingInputString = (fallbackPadding) => {
    const fallbackValues = parsePanelPaddingValues(fallbackPadding);
    const values = PANEL_PADDING_FIELDS.map((fieldId, index) => {
      const field = document.getElementById(fieldId);
      if (!field) {
        return fallbackValues[index];
      }
      return clampPanelPaddingValue(field.value, fallbackValues[index]);
    });
    return formatPanelPaddingValues(values);
  };
  const writePanelPaddingInputs = (padding) => {
    const values = parsePanelPaddingValues(padding);
    PANEL_PADDING_FIELDS.forEach((fieldId, index) => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.value = values[index];
      }
    });
  };
  const savePanelPaddingPreference = (padding) => {
    const normalizedPadding = normalizePanelPaddingString(padding);
    setStoredItem(STORAGE_KEYS.panelPadding, normalizedPadding);
    if (typeof Sign !== "undefined" && Sign.prototype) {
      Sign.prototype.defaultPadding = normalizedPadding;
    }
    return normalizedPadding;
  };

  const normalizePanelCorner = (corner) => {
    const availableCorners = Array.isArray(Panel.prototype.cornerType)
      ? Panel.prototype.cornerType
      : ["Sharp", "Round"];
    if (availableCorners.includes(corner)) {
      return corner;
    }
    return availableCorners.includes(Panel.prototype.defaultCorner)
      ? Panel.prototype.defaultCorner
      : "Round";
  };

  const savePanelCornerPreference = (corner) => {
    const normalizedCorner = normalizePanelCorner(corner);
    Panel.prototype.defaultCorner = normalizedCorner;
    setStoredItem(STORAGE_KEYS.panelCorner, normalizedCorner);
    hasPanelCornerPreference = true;
    return normalizedCorner;
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

  const formatPostKindLabel = (value) => {
    if (typeof value !== "string") {
      return "";
    }
    const spaced = value.replace(/([a-z])([A-Z])/g, "$1 $2");
    return spaced.replace(/[_-]+/g, " ").trim() || value;
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

    const storedCopySignsOnly = getStoredItem(STORAGE_KEYS.copySignsOnly);
    if (storedCopySignsOnly !== null) {
      post.copySignsOnly = storedCopySignsOnly === "true";
    } else if (typeof post.copySignsOnly !== "boolean") {
      post.copySignsOnly = true;
    }

    const storedCopyScale = parseFloat(getStoredItem(STORAGE_KEYS.copyScale));
    if (Number.isFinite(storedCopyScale)) {
      post.copyScale = Math.min(8, Math.max(0, storedCopyScale));
    } else if (!Number.isFinite(post.copyScale)) {
      post.copyScale = 8;
    }

    const storedPostColor = getStoredItem(STORAGE_KEYS.postColor);
    if (
      storedPostColor &&
      Array.isArray(Post.prototype.colors) &&
      Post.prototype.colors.includes(storedPostColor)
    ) {
      post.color = storedPostColor;
    }

    const storedSignAlignment = getStoredItem(STORAGE_KEYS.signAlignment);
    if (storedSignAlignment !== null && post) {
      post.signAlignment =
        typeof post.normalizeSignAlignment === "function"
          ? post.normalizeSignAlignment(storedSignAlignment)
          : storedSignAlignment;
    }

    const storedPostThickness = getStoredItem(STORAGE_KEYS.postThickness);
    if (storedPostThickness !== null && post) {
      const normalizedThickness =
        typeof post.normalizeThickness === "function"
          ? post.normalizeThickness(storedPostThickness)
          : normalizeStoredPostThickness(storedPostThickness);
      post.thickness = normalizedThickness;
    }

    const storedPanelCorner = getStoredItem(STORAGE_KEYS.panelCorner);
    if (
      storedPanelCorner &&
      Array.isArray(Panel.prototype.cornerType) &&
      Panel.prototype.cornerType.includes(storedPanelCorner)
    ) {
      savePanelCornerPreference(storedPanelCorner);
    }

    const storedPanelPadding = getStoredItem(STORAGE_KEYS.panelPadding);
    if (storedPanelPadding !== null) {
      savePanelPaddingPreference(storedPanelPadding);
    }

    const storedControlFont = normalizeTextFontFamilyName(
      getStoredItem(STORAGE_KEYS.controlTextFont)
    );
    const availableFonts = TextElement.prototype.fontFamily;
    if (
      storedControlFont &&
      Array.isArray(availableFonts) &&
      availableFonts.includes(storedControlFont)
    ) {
      ControlTextElement.setDefaultFont(storedControlFont);
    }

    const storedActionMessageFont = normalizeTextFontFamilyName(
      getStoredItem(STORAGE_KEYS.actionMessageFont)
    );
    if (
      storedActionMessageFont &&
      Array.isArray(availableFonts) &&
      availableFonts.includes(storedActionMessageFont)
    ) {
      ActionMessageElement.setDefaultFont(storedActionMessageFont);
    }

    const storedBannerFont = normalizeTextFontFamilyName(
      getStoredItem(STORAGE_KEYS.bannerFontFamily)
    );
    const bannerFonts = ShieldElement.prototype.getBannerFontOptions();
    if (
      storedBannerFont &&
      Array.isArray(bannerFonts) &&
      bannerFonts.includes(storedBannerFont)
    ) {
      ShieldElement.prototype.defaultBannerFontFamily = storedBannerFont;
    }

    // Older saves remembered the FHWA, Match Sign Radius and Extend Padding
    // checkboxes; read them when the newer settings are missing.
    const storedExitFont = getStoredItem(STORAGE_KEYS.exitTabFontFamily);
    const storedExitFHWA = getStoredItem(STORAGE_KEYS.exitTabFHWAFont);
    if (storedExitFont) {
      ExitTab.prototype.defaultFontFamily = storedExitFont;
    } else if (storedExitFHWA === "true") {
      ExitTab.prototype.defaultFontFamily = "Series E";
    }

    const storedExitPosition = getStoredItem(STORAGE_KEYS.exitTabPosition);
    if (
      storedExitPosition &&
      ExitTab.prototype.positions.includes(storedExitPosition)
    ) {
      ExitTab.prototype.defaultPosition = storedExitPosition;
    }

    const storedExitWidth = getStoredItem(STORAGE_KEYS.exitTabWidth);
    if (
      storedExitWidth &&
      ExitTab.prototype.widths.includes(storedExitWidth)
    ) {
      ExitTab.prototype.defaultWidth = storedExitWidth;
    }

    const storedExitFullBorder = getStoredItem(STORAGE_KEYS.exitTabFullBorder);
    if (storedExitFullBorder !== null) {
      ExitTab.prototype.defaultFullBorder = storedExitFullBorder === "true";
    }

    const storedExitSquareCorners = getStoredItem(STORAGE_KEYS.exitTabSquareCorners);
    if (storedExitSquareCorners !== null) {
      ExitTab.prototype.defaultSquareCorners = storedExitSquareCorners === "true";
    }

    const storedExitPadding = getStoredItem(STORAGE_KEYS.exitTabHorizontalPadding);
    const storedExitExtendedPadding = getStoredItem(
      STORAGE_KEYS.exitTabExtendHorizontalPadding
    ) ?? storedExitSquareCorners;
    if (storedExitPadding !== null) {
      ExitTab.prototype.defaultHorizontalPadding =
        ExitTab.normalizeHorizontalPadding(storedExitPadding);
    } else if (storedExitExtendedPadding === "true") {
      ExitTab.prototype.defaultHorizontalPadding =
        ExitTab.prototype.extendedHorizontalPadding;
    }

    const storedExitRadius = getStoredItem(STORAGE_KEYS.exitTabCornerRadius);
    if (storedExitRadius !== null) {
      ExitTab.prototype.defaultCornerRadius =
        ExitTab.normalizeCornerRadius(storedExitRadius);
    } else if (
      getStoredItem(STORAGE_KEYS.exitTabMatchSignCornerRadius) === "true"
    ) {
      ExitTab.prototype.defaultCornerRadius = "panel";
    }

    const storedExitAttached = getStoredItem(STORAGE_KEYS.exitTabAttached);
    if (storedExitAttached !== null) {
      ExitTab.prototype.defaultAttached = storedExitAttached === "true";
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

  const toggleSubPanelWiggle = (isActive) => {
    const buttons = document.querySelectorAll(".subPanelButton");
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

  // Toll Logo and Icon tabs share the size slider; the other options belong
  // to one variant.
  // Fixed markup, looked up once.
  let exitAssetOptionRows = null;
  let standardArrowPlacementButtons = null;
  const toggleExitTabVariantOptionsVisibility = (variantValue) => {
    const isIcon = variantValue === "Icon";
    document.getElementById("exitTollLogoOptions")
      .classList.toggle("hidden", variantValue !== "Toll Logo" && !isIcon);
    document.getElementById("exitAssetOptionsLegend").textContent =
      isIcon ? "Icon Options" : "Toll Logo Options";
    exitAssetOptionRows ??= [...document.querySelectorAll(".exitTollLogoOption, .exitIconOption")];
    exitAssetOptionRows.forEach((element) => element.classList.toggle("hidden",
      element.classList.contains("exitIconOption") ? !isIcon : isIcon));
  };

  const toggleExitTabAttachedOptionVisibility = (widthValue) => {
    const isSideExitTab = widthValue === "Side";
    const attachedInput = document.getElementById("exitTabAttached");
    const attachedLabel = document.querySelector(
      'label[for="exitTabAttached"]'
    );

    if (attachedInput) {
      attachedInput.classList.toggle("hidden", isSideExitTab);
      attachedInput.disabled = isSideExitTab;
    }
    if (attachedLabel) {
      attachedLabel.classList.toggle("hidden", isSideExitTab);
    }
  };

  // Square corners fix the radius, Transparent only applies to logo and icon
  // tabs, and the bottom text field only shows for bilingual tabs.
  const syncExitTabStyleControls = (exitTab) => {
    const square = !!exitTab.squareCorners;
    document.getElementById("exitTabUsePanelCornerRadius").disabled = square;
    document.getElementById("exitTabCornerRadius").disabled =
      square || exitTab.cornerRadius === "panel";
    document.getElementById("exitTabCornerRadiusReset").disabled = square;
    const isAssetTab = exitTab.variant === "Toll Logo" || exitTab.variant === "Icon";
    document.getElementById("exitTabTransparent").classList.toggle("hidden", !isAssetTab);
    document.getElementById("exitTabTransparentLabel").classList.toggle("hidden", !isAssetTab);
    document.getElementById("exitTabBilingualBottomText").hidden = !exitTab.bilingual;
  };

  // v2.19 stacked panels in the Subpanels window: switch between the main
  // panel and its additional panels, add one above or below, and set the
  // stack's spacing and width once it has more than one panel.
  const renderStackedPanelControls = () => {
    const holder = document.getElementById("stackedPanelList");
    const info = exposed.getCurrentStackedPanelInfo();
    const makeButton = (text, title, onClick, active = false) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = text;
      button.title = title;
      button.classList.toggle("active", active);
      button.addEventListener("click", onClick);
      return button;
    };
    const controls = [
      makeButton("Main Panel", "Edit the main panel",
        () => app.changeEditingPanel(info.topIndex), info.selectedIndex === info.topIndex),
    ];
    for (const { index, label } of info.additional) {
      controls.push(
        makeButton(label, `Edit panel ${label}`,
          () => app.changeEditingPanel(index), info.selectedIndex === index),
        makeButton("Delete " + label, `Delete panel ${label}`, () => app.deletePanel(index))
      );
    }
    controls.push(
      makeButton("Add Panel Above", "Add a panel above the main panel", () => app.createStackedPanelAbove()),
      makeButton("Add Panel Below", "Add a panel below the main panel", () => app.createStackedPanelBelow())
    );
    if (info.additional.length) {
      const spacingLabel = document.createElement("label");
      spacingLabel.htmlFor = "stackedPanelSpacing";
      spacingLabel.textContent = "Spacing:";
      const spacing = document.createElement("input");
      spacing.type = "number";
      spacing.id = "stackedPanelSpacing";
      spacing.min = "-4";
      spacing.max = "4";
      spacing.step = "0.05";
      spacing.value = String(info.spacing);
      spacing.addEventListener("change", () => app.setStackedPanelSpacing(spacing.value));
      const matchLabel = document.createElement("label");
      matchLabel.htmlFor = "stackedPanelMatchWidth";
      matchLabel.textContent = "Match width:";
      const matchWidth = document.createElement("input");
      matchWidth.type = "checkbox";
      matchWidth.id = "stackedPanelMatchWidth";
      matchWidth.checked = info.matchWidth;
      matchWidth.addEventListener("change", () => app.setStackedPanelMatchWidth(matchWidth.checked));
      controls.push(spacingLabel, spacing, matchLabel, matchWidth);
    }
    holder.replaceChildren(...controls);
  };

  // v2.19 exit tab profiles: named styles saved with the post, kept per
  // variant. Tabs linked to a profile share its styling; unlinked tabs use
  // v2.2's remembered defaults. v2.19's built-in "default" profile is unlinked.
  const EXIT_TAB_PROFILE_KEYS = [
    "position", "width", "color", "borderThickness", "minHeight", "fontSize",
    "fontFamily", "characterSpacing", "horizontalPadding", "exitTextSizePercent",
    "exitTextSizePercentVersion", "textColor", "FHWAFont", "showLeft",
    "fullBorder", "squareCorners", "cornerRadius", "attached", "topOffset",
    "verticalArrangement", "caStyle", "bilingual", "bilingualBottomText",
    "icon", "tollLogoOnly", "tollLogoSize", "tollLogoSquare", "transparent",
    "nestedTabSpacing",
  ];

  const getExitTabProfiles = () => {
    const store = post.exitTabProfiles && typeof post.exitTabProfiles === "object"
      ? post.exitTabProfiles
      : {};
    store.profiles = (Array.isArray(store.profiles) ? store.profiles : [])
      .filter((profile) => profile?.id && profile.id !== "default");
    for (const profile of store.profiles) {
      if (!profile.settingsByVariant || typeof profile.settingsByVariant !== "object") {
        profile.settingsByVariant = profile.settings ? { Default: profile.settings } : {};
      }
    }
    post.exitTabProfiles = store;
    return store.profiles;
  };

  const forEachExitTab = (callback) => {
    for (const panel of post.panels) {
      for (const exitTab of panel.exitTabs || []) {
        callback(exitTab);
        (exitTab.nestedExitTabs || []).forEach(callback);
      }
    }
  };

  const getEditedExitTab = () => {
    const panel = exposed.getCurrentPanel();
    const parent = panel?.exitTabs[exposed.vars.currentlySelectedExitTabIndex];
    const nestedIndex = exposed.vars.currentlySelectedNestedExitTabIndex ?? -1;
    return nestedIndex > -1 ? parent?.nestedExitTabs?.[nestedIndex] : parent;
  };

  const findExitTabProfile = (id) =>
    getExitTabProfiles().find((profile) => profile.id === id) || null;

  const captureExitTabStyle = (exitTab) => Object.fromEntries(
    EXIT_TAB_PROFILE_KEYS
      .filter((key) => exitTab[key] !== undefined)
      .map((key) => [key, Post.cloneData(exitTab[key])])
  );

  // Copies the profile's style for the tab's variant onto the tab. A profile
  // that has no style for this variant yet takes it from the tab.
  const applyExitTabProfile = (profile, exitTab) => {
    const settings = profile.settingsByVariant[exitTab.variant];
    if (settings) {
      Object.assign(exitTab, Post.cloneData(settings));
    } else {
      profile.settingsByVariant[exitTab.variant] = captureExitTabStyle(exitTab);
    }
    exitTab.profileId = profile.id;
  };

  // After an edit, a linked tab's style becomes its profile's style and is
  // copied to the other tabs of the same variant that use the profile.
  const syncLinkedExitTabs = (exitTab) => {
    const profile = findExitTabProfile(exitTab.profileId);
    if (!profile) {
      delete exitTab.profileId;
      return;
    }
    profile.settingsByVariant[exitTab.variant] = captureExitTabStyle(exitTab);
    forEachExitTab((tab) => {
      if (tab !== exitTab && tab.profileId === profile.id && tab.variant === exitTab.variant) {
        Object.assign(tab, Post.cloneData(profile.settingsByVariant[exitTab.variant]));
      }
    });
  };

  const syncExitTabProfileControls = (exitTab) => {
    const select = document.getElementById("exitTabProfileSelect");
    const profiles = getExitTabProfiles();
    lib.clearChildren(select);
    lib.appendOption(select, "", { text: "None" });
    for (const profile of profiles) {
      lib.appendOption(select, profile.id, { text: profile.name });
    }
    const linked = exitTab && findExitTabProfile(exitTab.profileId);
    select.value = linked ? linked.id : "";
    document.getElementById("exitTabProfileRename").disabled = !linked;
    document.getElementById("exitTabProfileDelete").disabled = !linked;
  };

  const finishExitTabProfileChange = () => {
    exposed.redraw();
    updateForm();
  };

  const setExitTabProfile = (profileId) => {
    const exitTab = getEditedExitTab();
    if (!exitTab) return;
    const profile = findExitTabProfile(profileId);
    if (profile) {
      applyExitTabProfile(profile, exitTab);
    } else {
      delete exitTab.profileId;
    }
    finishExitTabProfileChange();
  };

  const newExitTabProfile = () => {
    const exitTab = getEditedExitTab();
    if (!exitTab) return;
    const profiles = getExitTabProfiles();
    let index = profiles.length + 1;
    while (profiles.some((profile) => profile.name === `Profile ${index}`)) index++;
    const name = window.prompt("Profile name:", `Profile ${index}`);
    if (name === null) return;
    const profile = {
      id: `profile_${Date.now().toString(36)}`,
      name: name.trim() || `Profile ${index}`,
      settingsByVariant: { [exitTab.variant]: captureExitTabStyle(exitTab) },
    };
    profiles.push(profile);
    exitTab.profileId = profile.id;
    finishExitTabProfileChange();
  };

  const renameExitTabProfile = () => {
    const profile = findExitTabProfile(getEditedExitTab()?.profileId);
    if (!profile) return;
    const name = window.prompt("Rename profile:", profile.name);
    if (!name?.trim()) return;
    profile.name = name.trim();
    finishExitTabProfileChange();
  };

  // Deleting a profile leaves its tabs looking the same, just unlinked.
  const deleteExitTabProfile = () => {
    const profile = findExitTabProfile(getEditedExitTab()?.profileId);
    if (!profile) return;
    post.exitTabProfiles.profiles = getExitTabProfiles().filter((entry) => entry !== profile);
    forEachExitTab((tab) => {
      if (tab.profileId === profile.id) delete tab.profileId;
    });
    finishExitTabProfileChange();
  };

  const getBlockSelectionKey = (rowIndex, blockIndex) =>
    `${rowIndex}:${blockIndex}`;

  const getSelectedBlockRefs = () =>
    Array.from(selectedBlockKeys)
      .map((key) => {
        const [rowIndex, blockIndex] = key.split(":").map(Number);
        return { rowIndex, blockIndex };
      })
      .filter(
        ({ rowIndex, blockIndex }) =>
          Number.isInteger(rowIndex) && Number.isInteger(blockIndex)
      );

  const pruneSelectedBlockKeys = (blockElements) => {
    if (!blockElements || !Array.isArray(blockElements.rows)) {
      selectedBlockKeys.clear();
      return;
    }

    for (const key of Array.from(selectedBlockKeys)) {
      const [rowIndex, blockIndex] = key.split(":").map(Number);
      const row = blockElements.rows[rowIndex];
      if (!Array.isArray(row) || blockIndex < 0 || blockIndex >= row.length) {
        selectedBlockKeys.delete(key);
      }
    }
  };

  const syncGroupSelectionControls = () => {
    const selectionCheckbox = document.getElementById("sMSPBlockSelectionMode");
    if (selectionCheckbox) {
      selectionCheckbox.checked = blockSelectionMode;
    }

    const groupButton = document.getElementById("sMSPGroupSelectedBlocks");
    if (groupButton) {
      groupButton.classList.toggle("hidden", !blockSelectionMode);
      groupButton.disabled = !blockSelectionMode || selectedBlockKeys.size < 2;
    }
  };

  const clearBlockSelection = () => {
    selectedBlockKeys.clear();
    blockSelectionAnchor = null;
    syncGroupSelectionControls();
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

  const clearSubPanelDropIndicators = () => {
    document
      .querySelectorAll(".subPanelButton.dropBefore, .subPanelButton.dropAfter")
      .forEach((button) => button.classList.remove("dropBefore", "dropAfter"));
  };

  const endSubPanelDrag = () => {
    toggleSubPanelWiggle(false);
    clearSubPanelDropIndicators();
    subPanelDragState = null;
    document
      .querySelectorAll(".subPanelButton.dragging")
      .forEach((button) => {
        button.classList.remove("dragging");
        delete button.dataset.dragging;
      });
  };

  const getSubPanelDropPosition = (container, clientX) => {
    const buttons = Array.from(container.querySelectorAll(".subPanelButton"));
    if (!buttons.length) {
      return { dropIndex: 0, targetButton: null, placement: null };
    }

    let dropIndex = Number(
      buttons[buttons.length - 1].dataset.subPanelIndex || buttons.length - 1
    ) + 1;
    let targetButton = null;
    let placement = "after";
    let foundPosition = false;

    for (const button of buttons) {
      const rect = button.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      if (clientX < midpoint) {
        dropIndex = Number(button.dataset.subPanelIndex || 0);
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

  const handleSubPanelDragStart = (event) => {
    const button = event.currentTarget;
    const fromIndex = Number(button.dataset.subPanelIndex);
    if (Number.isNaN(fromIndex)) {
      return;
    }
    subPanelDragState = { fromIndex, dropIndex: fromIndex };
    button.dataset.dragging = "true";
    button.classList.add("dragging");
    toggleSubPanelWiggle(true);
    clearSubPanelDropIndicators();

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.dropEffect = "move";
      event.dataTransfer.setData("text/plain", "");
    }
  };

  const handleSubPanelDragOver = (event) => {
    if (!subPanelDragState) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    const container = event.currentTarget;
    const { dropIndex, targetButton, placement } = getSubPanelDropPosition(
      container,
      event.clientX
    );
    subPanelDragState.dropIndex = dropIndex;

    clearSubPanelDropIndicators();
    if (targetButton && placement) {
      targetButton.classList.add(
        placement === "before" ? "dropBefore" : "dropAfter"
      );
    }
  };

  const handleSubPanelDrop = (event) => {
    if (!subPanelDragState) {
      return;
    }
    event.preventDefault();
    const fromIndex = subPanelDragState.fromIndex;
    const dropIndex =
      subPanelDragState.dropIndex !== undefined
        ? subPanelDragState.dropIndex
        : fromIndex;
    if (typeof exposed.moveSubPanel === "function") {
      exposed.moveSubPanel(fromIndex, dropIndex);
    }
    endSubPanelDrag();
  };

  const handleSubPanelDragLeave = (event) => {
    if (!subPanelDragState) {
      return;
    }
    const container = event.currentTarget;
    const related = event.relatedTarget;
    if (related && container.contains(related)) {
      return;
    }
    clearSubPanelDropIndicators();
  };

  const handleSubPanelDragEnd = () => {
    if (subPanelDragState) {
      endSubPanelDrag();
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

  const getBlockCreateNewRowDropPosition = (container, clientY) => {
    const rows = Array.from(container.querySelectorAll(".sMControlRow"));
    if (!rows.length) {
      return { dropIndex: 0, targetRow: null, placement: null };
    }

    const rowRects = rows.map((row) => row.getBoundingClientRect());
    if (clientY < rowRects[0].top) {
      return { dropIndex: 0, targetRow: rows[0], placement: "before" };
    }

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
      if (
        clientY > rowRects[rowIndex - 1].bottom &&
        clientY < rowRects[rowIndex].top
      ) {
        return {
          dropIndex: rowIndex,
          targetRow: rows[rowIndex],
          placement: "before",
        };
      }
    }

    if (clientY > rowRects[rowRects.length - 1].bottom) {
      return {
        dropIndex: rows.length,
        targetRow: rows[rows.length - 1],
        placement: "after",
      };
    }

    return { dropIndex: null, targetRow: null, placement: null };
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
    if (blockDragState?.mode === "create") {
      const container = event.currentTarget;
      const { dropIndex, targetRow, placement } =
        getBlockCreateNewRowDropPosition(container, event.clientY);
      blockCreateNewRowDropIndex = dropIndex;
      container
        .querySelectorAll(".newBlockRowBefore, .newBlockRowAfter")
        .forEach((row) =>
          row.classList.remove("newBlockRowBefore", "newBlockRowAfter")
        );

      if (targetRow && placement) {
        event.preventDefault();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "copy";
        }
        targetRow.classList.add(
          placement === "before"
            ? "newBlockRowBefore"
            : "newBlockRowAfter"
        );
      }
      return;
    }

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
    if (
      blockDragState?.mode === "create" &&
      Number.isInteger(blockCreateNewRowDropIndex)
    ) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof exposed.insertControlElemInNewRow === "function") {
        exposed.insertControlElemInNewRow(
          blockDragState.elementType,
          blockCreateNewRowDropIndex
        );
      }
      endBlockDrag();
      return;
    }

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
    if (blockDragState?.mode === "create") {
      const container = event.currentTarget;
      const related = event.relatedTarget;
      if (related && container.contains(related)) {
        return;
      }
      blockCreateNewRowDropIndex = null;
      container
        .querySelectorAll(".newBlockRowBefore, .newBlockRowAfter")
        .forEach((row) =>
          row.classList.remove("newBlockRowBefore", "newBlockRowAfter")
        );
      return;
    }

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

  const isShortcutEditableTarget = (element) => {
    if (!element) {
      return false;
    }

    if (isTextInputElement(element)) {
      return true;
    }

    if (element.isContentEditable || element.tagName === "SELECT") {
      return true;
    }

    return !!(
      element.closest &&
      element.closest("input, textarea, select, [contenteditable='true']")
    );
  };

  const isSubpanelBlockEditorActive = () => {
    const configBar = document.getElementById("sMConfigBar");
    const blocksTab = document.getElementById("sMSPBlocks");

    return !!(
      configBar?.dataset.currentMenu === "subPanelConfig" &&
      blocksTab &&
      !blocksTab.classList.contains("tabHidden")
    );
  };

  const addHeaderFooter = (blockElems, placement, backgroundColor) => {
    if (
      !blockElems ||
      !Array.isArray(blockElems.rows) ||
      !Object.prototype.hasOwnProperty.call(lib.colors, backgroundColor)
    ) {
      return false;
    }

    const textFont =
      backgroundColor === "White" || backgroundColor === "Yellow"
        ? "Series E"
        : "Series EM";
    const dividerColor =
      backgroundColor === "Yellow" || backgroundColor === "White"
        ? "Black"
        : "White";
    let textRowIndex;

    if (placement === "header") {
      blockElems.addRow(0, "ControlTextElement");
      textRowIndex = 0;
      blockElems.addRow(1, "DividerElement");
      if (blockElems.rows[1]?.[0]) {
        blockElems.rows[1][0].dividerColor = dividerColor;
        blockElems.rows[1][0].fullBleed = true;
      }
      blockElems.blockProperties[textRowIndex].bottomPadding = 0.2;
    } else {
      const dividerRowIndex = blockElems.rows.length;
      blockElems.addRow(dividerRowIndex, "DividerElement");
      if (blockElems.rows[dividerRowIndex]?.[0]) {
        blockElems.rows[dividerRowIndex][0].dividerColor = dividerColor;
        blockElems.rows[dividerRowIndex][0].fullBleed = true;
      }
      textRowIndex = dividerRowIndex + 1;
      blockElems.addRow(textRowIndex, "ControlTextElement");
      blockElems.blockProperties[textRowIndex].topPadding = 0.2;
    }

    const textElement = blockElems.rows[textRowIndex]?.[0];
    if (textElement) {
      textElement.textContent = placement === "header" ? "Header" : "Footer";
      textElement.backgroundColor = "Inherit";
      textElement.textColor = ControlTextElement.defaultTextColor;
      textElement.fontFamily = textFont;
    }
    blockElems.blockProperties[textRowIndex].backgroundColor = backgroundColor;

    updateForm();
    if (exposed && typeof exposed.redraw === "function") {
      exposed.redraw();
    }
    return true;
  };


  // v2.19 remappable shortcuts. Values use v2.19's format ("CTRL+SHIFT+Z",
  // "|" between alternatives; CTRL also means Cmd) and its storage key.
  const SHORTCUTS = [
    ["NewPanel", "New Panel", "P"],
    ["NewPanelLeft", "New Panel to the left", "SHIFT+P"],
    ["NewSubpanel", "New Subpanel", "S"],
    ["NewSubpanelLeft", "New Subpanel to the left", "SHIFT+S"],
    ["NewRow", "New Row", "R"],
    ["NewRowTop", "New Row to the top", "SHIFT+R"],
    ["NextPanel", "Next Panel", "SHIFT+→"],
    ["PreviousPanel", "Previous Panel", "SHIFT+←"],
    ["NextSubpanel", "Next Subpanel", "→"],
    ["PreviousSubpanel", "Previous Subpanel", "←"],
    ["NextRow", "Next Row", "↓"],
    ["PreviousRow", "Previous Row", "↑"],
    ["DeletePanel", "Delete Panel", "ALT+P"],
    ["DeleteSubpanel", "Delete Subpanel", "ALT+S"],
    ["DeleteRow", "Delete Row", "ALT+R"],
    ["CloseMenu", "Close Menu", "ESC"],
    ["ShowHideMenus", "Show/Hide All Menus", "F1"],
    ["UndoEdit", "Undo", "CTRL+Z"],
    ["RedoEdit", "Redo", "CTRL+SHIFT+Z|CTRL+Y"],
    ["CopyElements", "Copy blocks", "CTRL+C"],
    ["CutElements", "Cut blocks", "CTRL+X"],
    ["PasteElements", "Paste blocks", "CTRL+V"],
    ["ClearAll", "Clear All", "CTRL+BACKSPACE"],
    ["PostSettings", "Post Settings", "1"],
    ["PanelMenu", "Panel Menu", "2"],
    ["PanelStyle", "Panel Style", "3"],
    ["ExitTabs", "Exit Tabs", "4"],
    ["Subpanels", "Subpanels", "5"],
    ["GuideArrows", "Guide Arrows", "6"],
    ["Templates", "Templates", "7"],
    ["Download", "Download", "8"],
    ["DarkMode", "Toggle Dark Mode", "9"],
    ["ZoomIn", "Zoom In", "="],
    ["ZoomOut", "Zoom Out", "-"],
  ];
  const UNDO_REDO_SHORTCUTS = new Set(["UndoEdit", "RedoEdit"]);
  const isMacPlatform = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || "");

  const normalizeShortcutToken = (value) => String(value || "").toUpperCase()
    .replace(/\s+/g, "").replace(/CMD|⌘|⌃/g, "CTRL").replace(/⇧/g, "SHIFT")
    .replace(/⌥/g, "ALT").replace(/ESCAPE/g, "ESC");

  // Read once and kept: every keydown checks all shortcuts against them.
  let shortcutOverridesCache = null;
  const getShortcutOverrides = () => {
    if (shortcutOverridesCache) return shortcutOverridesCache;
    try {
      const parsed = JSON.parse(getStoredItem(STORAGE_KEYS.shortcutOverrides) || "{}");
      shortcutOverridesCache = parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      shortcutOverridesCache = {};
    }
    return shortcutOverridesCache;
  };

  // Overrides are keyed by v2.19's field ids (settingsControlUndoEdit, ...).
  const getShortcutValue = (id) => {
    const overrides = getShortcutOverrides();
    const key = "settingsControl" + id;
    return Object.prototype.hasOwnProperty.call(overrides, key)
      ? String(overrides[key] || "")
      : SHORTCUTS.find(([shortcutId]) => shortcutId === id)?.[2] || "";
  };

  const setShortcutValue = (id, value) => {
    const overrides = getShortcutOverrides();
    overrides["settingsControl" + id] = value;
    setStoredItem(STORAGE_KEYS.shortcutOverrides, JSON.stringify(overrides));
    shortcutOverridesCache = overrides;
  };

  const SHORTCUT_KEY_NAMES = {
    Escape: "ESC", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
    Backspace: "BACKSPACE", Delete: "DELETE", Enter: "ENTER", Tab: "TAB",
    Home: "HOME", End: "END", PageUp: "PGUP", PageDown: "PGDN", " ": "SPACE",
  };

  const getEventShortcutToken = (event) => {
    const code = event.code || "";
    const key = SHORTCUT_KEY_NAMES[event.key] ||
      (/^Key[A-Z]$/.test(code) ? code.slice(-1)
        : /^Digit\d$/.test(code) ? code.slice(-1)
          : String(event.key || "").toUpperCase());
    if (["CONTROL", "META", "ALT", "SHIFT"].includes(key)) return "";
    return [
      (event.ctrlKey || event.metaKey) && "CTRL",
      event.altKey && "ALT",
      event.shiftKey && "SHIFT",
      key,
    ].filter(Boolean).join("+");
  };

  const formatShortcut = (value) => String(value || "").split("|").filter(Boolean)
    .map((token) => {
      const parts = normalizeShortcutToken(token).split("+");
      if (!isMacPlatform) return parts.join("+");
      const symbols = { CTRL: "⌘", SHIFT: "⇧", ALT: "⌥" };
      return parts.map((part) => symbols[part] || part).join("");
    }).join(" | ");

  const isTypingTarget = (element) => !!element && (element.isContentEditable ||
    element.tagName === "TEXTAREA" || element.tagName === "SELECT" ||
    (element.tagName === "INPUT" && !["button", "checkbox", "color", "file", "hidden",
      "image", "radio", "range", "reset", "submit"].includes((element.type || "").toLowerCase())));

  // Shortcuts without Ctrl/Cmd or Alt never fire while typing in a field.
  const shortcutMatches = (event, id) => {
    if (event.target?.closest?.(".appShortcutList")) return false;
    const token = normalizeShortcutToken(getEventShortcutToken(event));
    if (!token) return false;
    const matches = getShortcutValue(id).split("|").map(normalizeShortcutToken).includes(token);
    return matches && (/(^|\+)(CTRL|ALT)\+/.test(token) || !isTypingTarget(event.target));
  };

  const showShortcutNotice = (message) => {
    if (!message) return;
    let notice = document.getElementById("shortcutActionNotice");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "shortcutActionNotice";
      document.body.appendChild(notice);
    }
    notice.textContent = message;
    notice.classList.add("visible");
    clearTimeout(notice.hideTimer);
    notice.hideTimer = setTimeout(() => notice.classList.remove("visible"), 900);
  };

  const clickConfigButton = (id) => document.getElementById(id)?.click();

  // Menu, view and app actions; panel, subpanel and row actions run in main.js.
  const SHORTCUT_UI_ACTIONS = {
    CloseMenu: () => {
      const current = document.getElementById("sMConfigBar").dataset.currentMenu;
      if (!current) return false;
      clickConfigButton(current === "panelSelector" ? "panelSelector" : current);
    },
    ShowHideMenus: () => clickConfigButton("hideConfig"),
    PostSettings: () => clickConfigButton("postConfig"),
    PanelMenu: () => clickConfigButton("panelSelector"),
    PanelStyle: () => clickConfigButton("panelStyleConfig"),
    ExitTabs: () => clickConfigButton("exitTabConfig"),
    Subpanels: () => clickConfigButton("subPanelConfig"),
    GuideArrows: () => clickConfigButton("guideArrowConfig"),
    Templates: () => clickConfigButton("templates"),
    Download: () => clickConfigButton("exportDownload"),
    DarkMode: () => clickConfigButton("nightMode"),
    ZoomIn: () => showShortcutNotice(`UI Scale: ${stepUiScale(10)}%`),
    ZoomOut: () => showShortcutNotice(`UI Scale: ${stepUiScale(-10)}%`),
  };
  let stepUiScale = () => 100;

  const handleAppShortcut = (event) => {
    if (event.defaultPrevented || getKeybindMode() !== "all" ||
        document.querySelector("dialog[open]") ||
        document.activeElement?.closest?.(".appShortcutList")) {
      return;
    }
    for (const [id] of SHORTCUTS) {
      if (UNDO_REDO_SHORTCUTS.has(id) || ["CopyElements", "CutElements", "PasteElements"].includes(id)) {
        continue;
      }
      if (!shortcutMatches(event, id)) continue;
      const uiAction = SHORTCUT_UI_ACTIONS[id];
      if (uiAction) {
        if (uiAction() === false) return;
      } else {
        showShortcutNotice(exposed.runShortcutAction(id));
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  };

  // The Shortcuts tab: click a field and press keys; Backspace clears it.
  const buildShortcutSettings = () => {
    const list = document.getElementById("appShortcutList");
    for (const [id, label] of SHORTCUTS) {
      const labelElmt = document.createElement("label");
      labelElmt.htmlFor = "appShortcut" + id;
      labelElmt.textContent = label + ":";
      const input = document.createElement("input");
      input.type = "text";
      input.id = "appShortcut" + id;
      input.readOnly = true;
      input.dataset.shortcutId = id;
      input.value = formatShortcut(getShortcutValue(id));
      input.addEventListener("keydown", (event) => {
        if (event.key === "Tab") return;
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape") {
          input.blur();
          return;
        }
        const value = event.key === "Backspace" && !event.ctrlKey && !event.metaKey
          ? "" : getEventShortcutToken(event);
        if (value === "" && event.key !== "Backspace") return;
        setShortcutValue(id, value);
        input.value = formatShortcut(value);
      });
      list.append(labelElmt, input);
    }
    document.getElementById("resetAppShortcuts").addEventListener("click", () => {
      setStoredItem(STORAGE_KEYS.shortcutOverrides, "{}");
      shortcutOverridesCache = {};
      list.querySelectorAll("input").forEach((input) => {
        input.value = formatShortcut(getShortcutValue(input.dataset.shortcutId));
      });
    });
  };

  // The first time a window opens, the browser styles and lays out all of
  // it and decodes its images; for the larger v2.19 windows (Guide Arrows,
  // Subpanels) that took 15-20ms. Do that work for each window, one per idle
  // moment, after startup, so opening them later is quick.
  const warmEditorWindows = () => {
    const idle = window.requestIdleCallback || ((callback) => setTimeout(callback, 200));
    const windows = [...document.querySelectorAll(".sMModal")];
    const next = () => {
      const modal = windows.shift();
      if (!modal) return;
      const currentMenu = document.getElementById("sMConfigBar").dataset.currentMenu;
      if (!currentMenu || !modal.classList.contains(currentMenu)) {
        modal.classList.add("warmingLayout");
        modal.offsetHeight;
        modal.querySelectorAll("img").forEach((img) => img.decode?.().catch(() => {}));
        modal.classList.remove("warmingLayout");
      }
      idle(next);
    };
    idle(next);
  };

  // v2.19 keybind mode: "all", "undo-redo" (only undo/redo) or "none".
  const getKeybindMode = () => {
    const mode = getStoredItem(STORAGE_KEYS.keybindMode);
    return mode === "undo-redo" || mode === "none" ? mode : "all";
  };

  const handleBlockClipboardShortcut = (event) => {
    if (
      getKeybindMode() !== "all" ||
      !isSubpanelBlockEditorActive() ||
      isShortcutEditableTarget(event.target) ||
      event.altKey
    ) {
      return;
    }

    if (shortcutMatches(event, "CopyElements")) {
      event.preventDefault();
      event.stopPropagation();
      if (exposed && typeof exposed.copyControlElements === "function") {
        exposed.copyControlElements(getSelectedBlockRefs());
      }
      return;
    }

    if (shortcutMatches(event, "CutElements")) {
      event.preventDefault();
      event.stopPropagation();
      if (exposed && typeof exposed.cutControlElements === "function") {
        const result = exposed.cutControlElements(getSelectedBlockRefs());
        if (result?.cut) {
          clearBlockSelection();
          updateForm();
        }
      }
      return;
    }

    if (shortcutMatches(event, "PasteElements")) {
      event.preventDefault();
      event.stopPropagation();
      if (exposed && typeof exposed.pasteControlElements === "function") {
        const result = exposed.pasteControlElements();
        if (result?.pasted) {
          clearBlockSelection();
          updateForm();
        }
      }
    }
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
    document
      .querySelectorAll(".newBlockRowBefore, .newBlockRowAfter")
      .forEach((el) =>
        el.classList.remove("newBlockRowBefore", "newBlockRowAfter")
      );
  };

  const setBlockCreateDragState = (isActive) => {
    document
      .querySelector("#sMSPTextList")
      ?.classList.toggle("blockCreateDragActive", isActive);
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
    if (
      blockDragState?.mode !== "move" ||
      !newRowDropTargetButton
    ) {
      return;
    }
    event.preventDefault();
    setNewRowDropState(true);
  };

  const handleNewRowDragOver = (event) => {
    if (
      blockDragState?.mode !== "move" ||
      !newRowDropTargetButton
    ) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    setNewRowDropState(true);
  };

  const handleNewRowDragLeave = (event) => {
    if (
      blockDragState?.mode !== "move" ||
      !newRowDropTargetButton
    ) {
      return;
    }
    const related = event.relatedTarget;
    if (related && newRowDropTargetButton.contains(related)) {
      return;
    }
    setNewRowDropState(false);
  };

  const handleNewRowDrop = (event) => {
    if (
      blockDragState?.mode !== "move" ||
      !newRowDropTargetButton
    ) {
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
    setBlockCreateDragState(false);
    blockCreateNewRowDropIndex = null;
    blockDragState = null;
    document
      .querySelectorAll(".textEditorBlock.dragging")
      .forEach((el) => el.classList.remove("dragging"));
    document
      .querySelectorAll(".textEditorBlock")
      .forEach((el) => delete el.dataset.dragging);
    if (newBlockDragSourceButton) {
      newBlockDragSourceButton.classList.remove("dragging");
      delete newBlockDragSourceButton.dataset.dragging;
    }
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
    blockDragState = { mode: "move", rowIndex, blockIndex };
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

  const handleNewBlockDragStart = (event) => {
    const elementType = document.querySelector("#sMSPElementSelect")?.value;
    if (!Control.prototype.blockToClassElems[elementType]) {
      event.preventDefault();
      return;
    }

    blockDragState = { mode: "create", elementType };
    blockCreateNewRowDropIndex = null;
    event.currentTarget.dataset.dragging = "true";
    event.currentTarget.classList.add("dragging");
    toggleBlockWiggle(true);
    clearBlockDragIndicators();
    setBlockCreateDragState(true);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.dropEffect = "copy";
      event.dataTransfer.setData("text/plain", elementType);
    }
  };

  const handleNewBlockDragEnd = () => {
    if (blockDragState?.mode === "create") {
      endBlockDrag();
    }
  };

  const handleRowDragEnter = (event) => {
    if (!blockDragState) {
      return;
    }
    blockCreateNewRowDropIndex = null;
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
      event.dataTransfer.dropEffect =
        blockDragState.mode === "create" ? "copy" : "move";
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
    event.stopPropagation();
    const dropIndex = getDropIndexForRow(rowEl, event.clientX);
    if (
      blockDragState.mode === "create" &&
      typeof exposed.insertControlElemAt === "function"
    ) {
      exposed.insertControlElemAt(
        blockDragState.elementType,
        rowIndex,
        dropIndex
      );
    } else {
      exposed.moveControlElem(
        blockDragState.rowIndex,
        blockDragState.blockIndex,
        rowIndex,
        dropIndex
      );
    }
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

  const commitPanelPaddingChange = ({ syncInputs = false } = {}) => {
    const currentPanel =
      exposed && typeof exposed.getCurrentPanel === "function"
        ? exposed.getCurrentPanel()
        : null;
    if (!currentPanel || !currentPanel.sign) {
      return;
    }

    currentPanel.sign.padding = savePanelPaddingPreference(
      getPanelPaddingInputString(currentPanel.sign.padding)
    );

    if (syncInputs) {
      writePanelPaddingInputs(currentPanel.sign.padding);
    }

    if (exposed && typeof exposed.redraw === "function") {
      exposed.redraw();
    }
  };

  const getBottomArrowLabel = (arrowKind) => {
    const arrowDefinition = ArrowElement.prototype.arrows[arrowKind];
    if (!arrowDefinition) {
      return "None";
    }
    return arrowDefinition.label || arrowKind;
  };

  const syncBottomArrowRotationControls = (rotation) => {
    const parsedRotation = parseFloat(rotation);
    const resolvedRotation = Number.isFinite(parsedRotation)
      ? parsedRotation
      : 0;
    const rotationSlider = document.getElementById("bottomArrowRotation");
    const rotationValue = document.getElementById("bottomArrowRotationVal");
    if (rotationSlider) {
      rotationSlider.value = resolvedRotation.toString();
    }
    if (rotationValue) {
      rotationValue.value = resolvedRotation.toString();
    }

    const normalizedRotation =
      ((resolvedRotation % 360) + 360) % 360;
    document.querySelectorAll(".bottomArrowRotationPreset").forEach((button) => {
      const degrees = parseFloat(button.dataset.degrees || "0") || 0;
      button.classList.toggle(
        "activated",
        Math.abs(normalizedRotation - degrees) < 0.5
      );
    });
  };

  const clearBottomArrowKind = () => {
    const bottomArrowInput = document.getElementById("bottomArrowKind");
    const bottomArrowLabel = document.getElementById(
      "bottomArrowSelectedLabel"
    );
    if (bottomArrowInput) {
      bottomArrowInput.value = "None";
    }
    if (bottomArrowLabel) {
      bottomArrowLabel.textContent = "Current: None";
    }
    syncBottomArrowRotationControls(0);
  };

  // The hidden shield select lists every shield, including saved custom ones.
  const syncShieldBaseOptions = () => {
    const shield_shieldBase = document.querySelector("#sdShield_shieldBase");
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
  };

  // v2.19 guide arrow editor: Standard Arrows and Exit Only tabs.
  const getExitTabAvailableFonts = () => TextElement.prototype.fontFamily;
  const getResolvedColorValue = (value) =>
    (typeof lib !== "undefined" && lib.colors?.[value]) || value;
  // Opens the Guide Arrows window on the tab for the given mode.
  const ensureGuideArrowMenuOpen = (mode = null) => {
    if (document.getElementById("sMConfigBar")?.dataset.currentMenu !== "guideArrowConfig") {
      document.getElementById("guideArrowConfig")?.click();
    }
    const tab = mode === "exit" ? "sMExitOnlyArrows" : mode === "standard" ? "sMStandardArrows" : null;
    if (tab) {
      document.querySelector(`.guideArrowConfig .sMModalTab[data-tab="${tab}"]`)?.click();
    }
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
        items: EXIT_ONLY_TYPE_ITEMS,
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

    const directArrowMap = {
      "Down (Ontario)": "DOWN_ON",
      "Down (alt)": "DOWN_ALT",
    };

    if (directArrowMap[label]) {
      return window.resolveLegacyGuideArrow(directArrowMap[label]);
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

    return window.resolveLegacyGuideArrow(code);
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
      box.appendChild(makeArrowImg(ArrowElement.prototype.arrows.DOWN.src, "", invertArrow));
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

      const arrowAsset = getArrowIconPathFromValue(value, options);
      if (!arrowAsset) {
        return null;
      }

    const img = document.createElement("img");
    img.className = "arrowPickerIconImage";
    img.alt = "";
    img.src = arrowAsset.src;
    img.loading = "lazy";
    img.decoding = "async";
    img.style.transform = `rotate(${arrowAsset.rotation}deg)`;
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

  const STANDARD_ARROW_KEYS = [
    "DOWN", "DOWN_ALT", "TYPE_A", "TYPE_A_EXTENDED", "TYPE_B",
    "TYPE_C_45", "TYPE_C_45_ALT", "TYPE_C_90", "TYPE_D", "TYPE_E",
    "APL_UP", "APL_TURN", "APL_UP_TURN", "APL_DUAL_TURN",
    "APL_UP_CFX", "APL_TURN_CFX", "APL_UP_TURN_CFX", "DOWN_ON", "UK"
  ];
  const STANDARD_ARROW_LABELS = {
    TYPE_C_45: "Type C 45°",
    TYPE_C_45_ALT: "Type C 45° (alt)", TYPE_C_90: "Type C 90°",
    APL_UP_CFX: "CFX APL Up", APL_TURN_CFX: "CFX APL Turn",
    APL_UP_TURN_CFX: "CFX APL Up Turn"
  };
  const STANDARD_ARROW_ITEMS = STANDARD_ARROW_KEYS.map((key) => ({
    value: key,
    label: STANDARD_ARROW_LABELS[key] || ArrowElement.prototype.arrows[key]?.label || key
  }));
  const EXIT_ONLY_TYPE_ITEMS = ARROW_PICKER_ITEMS.filter((item) =>
    ["None", "Exit Only", "Split Exit Only", "Half Exit Only"].includes(item.label)
  );

  const EXIT_ONLY_DIRECTION_ITEMS = Sign.prototype.exitguideArrows.map((entry) => {
    const label = getArrowDisplayLabel(entry);
    return {
      value: label,
      label,
      rawValue: entry,
    };
  });

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
      const pickerListeners = new AbortController();
      const wrapper = document.createElement("div");
      wrapper.className = "shieldPicker arrowPicker";

      const placePopover = () => {
        const rect = trigger.getBoundingClientRect();
        // The popover lives on <body> and is scaled like the editor windows.
        const zoom =
          parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sm-app-zoom")) || 1;
        popover.style.position = "fixed";
        popover.style.left = `${rect.left}px`;
        popover.style.top = `${rect.bottom + 2}px`;
        popover.style.transformOrigin = "top left";
        popover.style.width = `${Math.max(rect.width / zoom, 320)}px`;
        popover.style.maxHeight = `${Math.max(160, (window.innerHeight - rect.bottom - 12) / zoom)}px`;
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
      triggerCaret.textContent = "keyboard_arrow_down";
      trigger.appendChild(triggerCaret);

      const popover = document.createElement("div");
      popover.className = "shieldPickerPopover arrowPickerPopover";

      const list = document.createElement("div");
      list.className = "shieldPickerTree arrowPickerList";
      popover.appendChild(list);

      wrapper.appendChild(trigger);
      document.body.appendChild(popover);
      mount.replaceWith(wrapper);
      new MutationObserver(() => {
        popover.classList.toggle("open", wrapper.classList.contains("open"));
      }).observe(wrapper, { attributes: true, attributeFilter: ["class"] });

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
      }, { signal: pickerListeners.signal });

      window.addEventListener("resize", () => {
        if (wrapper.classList.contains("open")) {
          placePopover();
        }
      }, { signal: pickerListeners.signal });

      window.addEventListener("scroll", () => {
        if (wrapper.classList.contains("open")) {
          placePopover();
        }
      }, { capture: true, signal: pickerListeners.signal });

    syncTrigger();
    renderList();

    return {
      element: wrapper,
      destroy: () => pickerListeners.abort(),
      getValue: () => currentValue,
      // updateForm calls this on every edit; only a new value needs work.
      setValue: (nextValue) => {
        if ((nextValue || "") === currentValue) return;
        currentValue = nextValue || "";
        syncTrigger();
        renderList();
      },
    };
  };

  const standardArrowField = (name) => document.getElementById(`standardArrow${name}`);
  const clampStandardValue = (value, min, max, precision, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed)
      ? Math.min(max, Math.max(min, Math.round(parsed * precision) / precision))
      : fallback;
  };
  const normalizeStandardAngle = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? ((Math.round(parsed) % 360) + 360) % 360 : 0;
  };
  const normalizeExitTextSpacing = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
  };
  const standardDefaultSide = (sign) =>
    sign?.standardArrowAlignment === "Left" || sign?.standardArrowPosition === "Left" ? "Left" : "Center";
  const exitDefaultSide = (sign) => sign?.exitArrowAlignment === "Left" ? "Left" : "Center";
  const splitDefaultSide = (sign, panel, angleValue = sign?.exitArrowAngle) => {
    const angle = normalizeStandardAngle(angleValue);
    const fixed = isFixedDirectionArrow(sign?.exitArrowType);
    const pointsLeft = Math.sin(angle * Math.PI / 180) < -0.001 || (fixed && sign?.exitArrowFlip === true);
    const pointsRight = Math.sin(angle * Math.PI / 180) > 0.001 || (fixed && sign?.exitArrowFlip !== true);
    // As in v2.2, the exit lane is on the left unless the arrow or a numbered
    // exit tab says right.
    const numberedTab = panel?.exitTabs?.find((tab) => String(tab?.number || "").trim());
    if (pointsLeft) return "Left";
    if (pointsRight || numberedTab?.position === "Right") return "Right";
    return "Left";
  };
  const replaceDefaultAngle = (field, key, oldSide, newSide) => {
    const value = field("AngleValue");
    if (normalizeStandardAngle(value.value) !== getDefaultGuideArrowAngle(key, oldSide)) return;
    const angle = getDefaultGuideArrowAngle(key, newSide);
    field("Angle").value = String(angle);
    value.value = String(angle);
  };
  const isFixedDirectionArrow = (key) => key?.startsWith("TYPE_C_") || key === "TYPE_E";
  const standardArrowPreview = (key) => {
    const src = ArrowElement.prototype.arrows[key]?.src;
    if (!src) return null;
    const image = document.createElement("img");
    image.src = src;
    image.alt = "";
    image.className = "arrowPickerIconImage";
    return image;
  };
  const guideArrowAssetLoads = new Map();
  const waitForGuideArrowAsset = (key) => {
    const src = ArrowElement.prototype.arrows[key]?.src;
    if (!src) return Promise.resolve();
    if (!guideArrowAssetLoads.has(src)) {
      const image = new Image();
      image.src = src;
      const ready = typeof image.decode === "function"
        ? image.decode().catch(() => {})
        : new Promise((resolve) => {
            if (image.complete) return resolve();
            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
          });
      guideArrowAssetLoads.set(src, ready);
    }
    return guideArrowAssetLoads.get(src);
  };
  let standardArrowSelection = 0;
  let selectedStandardArrowIndex = -1;
  let individualArrowPickers = [];
  const syncIndividualArrowControls = (sign) => {
    const host = document.getElementById("standardArrowIndividualRows");
    if (!host || !sign) return;
    for (const picker of individualArrowPickers) picker.destroy();
    individualArrowPickers = [];
    host.replaceChildren();
    const count = Math.max(0, Math.min(6, Math.round(Number(sign.guideArrowLanes) || 0)));
    const section = document.getElementById("standardArrowIndividual");
    const disabled = count < 2 || ["Left", "Right"].includes(sign.standardArrowPosition);
    section.dataset.disabled = String(disabled);
    section.inert = disabled;
    section.querySelector("summary").setAttribute("aria-disabled", String(disabled));
    if (disabled) {
      section.open = false;
      host.textContent = count < 2 ? "Add at least two arrows to edit them individually." : "Individual arrows are available in the down position.";
      return;
    }
    const details = Array.isArray(sign.standardArrowIndividuals) ? sign.standardArrowIndividuals : [];
    const headings = document.createElement("div");
    headings.className = "individualArrowRow individualArrowHeadings";
    for (const title of ["Arrow", "Type", "Angle"]) {
      const heading = document.createElement("span");
      heading.textContent = title;
      headings.append(heading);
    }
    host.append(headings);
    for (let i = 0; i < count; i++) {
      const item = details[i] || {};
      const row = document.createElement("div");
      row.className = "individualArrowRow";
      row.classList.toggle("selected", i === selectedStandardArrowIndex);
      const label = document.createElement("span");
      label.textContent = `Arrow ${i + 1}`;
      const typeHost = document.createElement("div");
      typeHost.className = "standardArrowPickerHost individualArrowPickerHost";
      const proxy = document.createElement("select");
      typeHost.append(proxy);
      const typeValue = STANDARD_ARROW_KEYS.includes(item.type) ? item.type : "";
      const angle = document.createElement("input");
      angle.type = "number";
      angle.step = "1";
      angle.value = String(item.angle == null ? normalizeStandardAngle(sign.standardArrowAngle) : normalizeStandardAngle(item.angle));
      angle.setAttribute("aria-label", `Arrow ${i + 1} angle in degrees`);
      angle.disabled = isFixedDirectionArrow(typeValue || sign.standardArrowType);
      const mutate = (key, value, { deferHistoryEnd = false, refresh = true } = {}) => {
        exposed.beginUndoableChange();
        sign.standardArrowIndividuals ||= [];
        sign.standardArrowIndividuals[i] ||= {};
        sign.standardArrowIndividuals[i][key] = value;
        selectedStandardArrowIndex = i;
        exposed.redraw();
        if (!deferHistoryEnd) exposed.endUndoableChange();
        if (refresh) syncIndividualArrowControls(sign);
      };
      let typeSelection = 0;
      const picker = createFlatArrowPicker({
        mount: proxy,
        value: typeValue,
        items: [
          { value: "", label: `Default (${STANDARD_ARROW_ITEMS.find((entry) => entry.value === sign.standardArrowType)?.label || "Down"})` },
          ...STANDARD_ARROW_ITEMS
        ],
        createPreviewNode: standardArrowPreview,
        onChange: async (previous) => {
        const selection = ++typeSelection;
        await waitForGuideArrowAsset(previous);
        if (selection !== typeSelection || exposed.getCurrentPanel()?.sign !== sign) return;
        const defaultAngle = getDefaultGuideArrowAngle(previous || sign.standardArrowType, standardDefaultSide(sign));
        exposed.beginUndoableChange();
        sign.standardArrowIndividuals ||= [];
        sign.standardArrowIndividuals[i] = { ...(sign.standardArrowIndividuals[i] || {}), type: previous || null, angle: previous ? defaultAngle : null };
        selectedStandardArrowIndex = i;
        exposed.endUndoableChange();
        exposed.redraw();
        syncIndividualArrowControls(sign);
        }
      });
      individualArrowPickers.push(picker);
      angle.addEventListener("change", () => mutate("angle", normalizeStandardAngle(angle.value)));
      angle.addEventListener("keydown", (event) => { if (event.key === "Enter") angle.blur(); });
      row.append(label, typeHost, angle);
      host.append(row);
      if (i < count - 1) {
        const spacingRow = document.createElement("div");
        spacingRow.className = "individualArrowSpacingRow";
        const spacingLabel = document.createElement("label");
        spacingLabel.textContent = `Spacing ${i + 1}–${i + 2}`;
        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = "4";
        slider.max = "12";
        slider.step = "0.1";
        const number = document.createElement("input");
        number.type = "number";
        number.min = "0";
        number.max = "25";
        number.step = "0.01";
        const spacing = clampStandardValue(item.spacingAfter ?? sign.standardArrowSpacing, 0, 25, 100, 8.5);
        slider.value = String(Math.min(12, Math.max(4, spacing)));
        number.value = spacing.toFixed(2);
        spacingLabel.htmlFor = `individualArrowSpacing${i}`;
        slider.id = spacingLabel.htmlFor;
        number.setAttribute("aria-label", `Spacing between arrows ${i + 1} and ${i + 2}`);
        slider.addEventListener("input", () => {
          number.value = Number(slider.value).toFixed(2);
          mutate("spacingAfter", Number(slider.value), { deferHistoryEnd: true, refresh: false });
        });
        const finish = () => exposed.endUndoableChange();
        for (const eventName of ["change", "pointerup", "pointercancel", "blur"]) slider.addEventListener(eventName, finish);
        number.addEventListener("change", () => {
          const value = clampStandardValue(number.value, 0, 25, 100, 8.5);
          number.value = value.toFixed(2);
          slider.value = String(Math.min(12, Math.max(4, value)));
          mutate("spacingAfter", value, { refresh: false });
        });
        number.addEventListener("keydown", (event) => { if (event.key === "Enter") number.blur(); });
        spacingRow.append(spacingLabel, slider, number);
        host.append(spacingRow);
      }
    }
  };
  const selectStandardArrowIndividual = (index) => {
    const sign = exposed.getCurrentPanel()?.sign;
    if (Number(sign?.guideArrowLanes) < 2 || ["Left", "Right"].includes(sign?.standardArrowPosition)) return;
    selectedStandardArrowIndex = index;
    document.getElementById("standardArrowIndividual").open = true;
    syncIndividualArrowControls(exposed.getCurrentPanel()?.sign);
  };
  const ensureStandardArrowPicker = () => {
    const select = standardArrowField("Type");
    if (!select) return;
    if (!select._arrowPickerApi) {
      for (const item of STANDARD_ARROW_ITEMS) {
        select.add(new Option(item.label, item.value));
      }
      select.style.display = "none";
      const proxy = document.createElement("select");
      select.parentElement.appendChild(proxy);
      select._arrowPickerApi = createFlatArrowPicker({
        mount: proxy,
        value: select.value || "DOWN",
        items: [{ value: "None", label: "None" }, ...STANDARD_ARROW_ITEMS],
        createPreviewNode: standardArrowPreview,
        onChange: async (key) => {
          if (key === "None") {
            standardArrowField("Type")._arrowPickerApi.setValue(select.value || "DOWN");
            document.getElementById("guideArrowLanes").value = "0";
            document.getElementById("guideArrow").value = "Standard Arrow";
            readForm();
            return;
          }
          const selection = ++standardArrowSelection;
          await waitForGuideArrowAsset(key);
          if (selection !== standardArrowSelection) return;
          const angle = getDefaultGuideArrowAngle(key, standardDefaultSide(exposed.getCurrentPanel()?.sign));
          select.value = key;
          if (Number(document.getElementById("guideArrowLanes").value) === 0) {
            document.getElementById("guideArrowLanes").value = "1";
          }
          standardArrowField("Angle").value = String(angle);
          standardArrowField("AngleValue").value = String(angle);
          document.getElementById("guideArrow").value = "Standard Arrow";
          readForm();
        }
      });
    }
    return select._arrowPickerApi;
  };
  const syncStandardArrowControls = (sign) => {
    if (!sign) return;
    const type = STANDARD_ARROW_KEYS.includes(sign.standardArrowType) ? sign.standardArrowType : "DOWN";
    const typeSelect = standardArrowField("Type");
    typeSelect.value = type;
    ensureStandardArrowPicker()?.setValue(type);
    const fixedDirection = isFixedDirectionArrow(type);
    const angleSlider = standardArrowField("Angle");
    const angleInput = standardArrowField("AngleValue");
    const flipButton = standardArrowField("Flip");
    angleSlider.disabled = fixedDirection;
    angleInput.hidden = fixedDirection;
    flipButton.hidden = !fixedDirection;
    document.querySelector('[data-standard-reset="Angle"]').disabled = fixedDirection;
    flipButton.setAttribute("aria-pressed", String(sign.standardArrowFlip === true));
    flipButton.classList.toggle("selected", sign.standardArrowFlip === true);
    for (const [name, value, digits] of [
      ["Angle", normalizeStandardAngle(sign.standardArrowAngle), 0],
      ["Size", clampStandardValue(sign.standardArrowSize, 1, 5, 10, 3), 1],
      ["Padding", clampStandardValue(sign.standardArrowPadding ?? sign.exitOnlyPadding, 0, 5, 100, 0.2), 2],
      ["Spacing", clampStandardValue(sign.standardArrowSpacing, 0, 25, 100, 8.5), 2]
    ]) {
      standardArrowField(name).value = Math.min(Number(standardArrowField(name).max), value);
      standardArrowField(`${name}Value`).value = value.toFixed(digits);
    }
    standardArrowPlacementButtons ??= [...document.querySelectorAll("[data-standard-alignment], [data-standard-position]")];
    for (const button of standardArrowPlacementButtons) {
      const selected = button.dataset.standardAlignment
        ? button.dataset.standardAlignment === (sign.standardArrowAlignment || "Center")
        : button.dataset.standardPosition === (sign.standardArrowPosition || "Down");
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
    const side = ["Left", "Right"].includes(sign.standardArrowPosition);
    standardArrowField("Spacing").disabled = side || Number(sign.guideArrowLanes) < 2;
    standardArrowField("SpacingValue").disabled = side || Number(sign.guideArrowLanes) < 2;
    document.querySelector('[data-standard-reset="Spacing"]').disabled = side || Number(sign.guideArrowLanes) < 2;
    document.getElementById("exitGuideArrowLanes").value = sign.guideArrowLanes ?? 1;
    syncIndividualArrowControls(sign);
  };
  const bindStandardArrowControls = () => {
    ensureStandardArrowPicker();
    document.getElementById("standardArrowIndividualReset").addEventListener("click", () => {
      const sign = exposed.getCurrentPanel()?.sign;
      if (!sign) return;
      exposed.beginUndoableChange();
      sign.standardArrowIndividuals = [];
      exposed.endUndoableChange();
      selectedStandardArrowIndex = -1;
      document.getElementById("standardArrowIndividual").open = false;
      syncIndividualArrowControls(sign);
      exposed.redraw();
    });
    document.addEventListener("pointerdown", (event) => {
      const active = document.activeElement;
      if (active?.matches?.('.standardArrowRow input[type="number"]') &&
          event.target !== active) {
        active.blur();
      }
    }, true);
    for (const field of document.querySelectorAll('.standardArrowRow input[type="number"]')) {
      field.addEventListener("keydown", (event) => {
        if (event.key === "Enter") field.blur();
      });
    }
    const commit = (options) => {
      document.getElementById("guideArrow").value = "Standard Arrow";
      readForm(options);
    };
    const count = document.getElementById("guideArrowLanes");
    count.addEventListener("change", () => {
      count.value = String(clampStandardValue(count.value, 0, 6, 1, 0));
      commit();
    });
    for (const [name, min, max, precision, digits, fallback] of [
      ["Angle", 0, 359, 1, 0, 0],
      ["Size", 1, 5, 10, 1, 3],
      ["Padding", 0, 5, 100, 2, 0.2],
      ["Spacing", 0, 25, 100, 2, 8.5]
    ]) {
      const slider = standardArrowField(name);
      const number = standardArrowField(`${name}Value`);
      slider.addEventListener("input", () => {
        number.value = Number(slider.value).toFixed(digits);
        commit({ deferHistoryEnd: true });
      });
      const finishSlider = () => exposed?.endUndoableChange?.();
      slider.addEventListener("change", finishSlider);
      slider.addEventListener("pointerup", finishSlider);
      slider.addEventListener("pointercancel", finishSlider);
      slider.addEventListener("blur", finishSlider);
      number.addEventListener("change", () => {
        const value = name === "Angle"
          ? normalizeStandardAngle(number.value)
          : clampStandardValue(number.value, min, max, precision, fallback);
        number.value = value.toFixed(digits);
        slider.value = String(Math.min(Number(slider.max), value));
        commit();
      });
    }
    standardArrowField("Flip").addEventListener("click", () => {
      const button = standardArrowField("Flip");
      button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true"));
      commit();
    });
    for (const button of document.querySelectorAll("[data-standard-reset]")) {
      button.addEventListener("click", () => {
        const name = button.dataset.standardReset;
        const defaults = { Angle: getDefaultGuideArrowAngle(standardArrowField("Type").value,
          standardDefaultSide(exposed.getCurrentPanel()?.sign)), Size: 3, Padding: 0.2, Spacing: 8.5 };
        const digits = name === "Angle" ? 0 : name === "Size" ? 1 : 2;
        standardArrowField(name).value = String(defaults[name]);
        standardArrowField(`${name}Value`).value = defaults[name].toFixed(digits);
        commit();
      });
    }
    for (const button of document.querySelectorAll("[data-standard-alignment], [data-standard-position]")) {
      button.addEventListener("click", () => {
        const property = button.dataset.standardAlignment ? "standardArrowAlignment" : "standardArrowPosition";
        const sign = exposed.getCurrentPanel()?.sign;
        if (!sign) return;
        const oldSide = standardDefaultSide(sign);
        sign[property] = button.dataset.standardAlignment || button.dataset.standardPosition;
        replaceDefaultAngle(standardArrowField, standardArrowField("Type").value, oldSide, standardDefaultSide(sign));
        commit();
      });
    }
    document.getElementById("exitGuideArrowLanes").addEventListener("change", (event) => {
      count.value = String(clampStandardValue(event.target.value, 0, 6, 1, 0));
      event.target.value = count.value;
      readForm();
    });
  };

  const exitArrowField = (name) => document.getElementById(`exitArrow${name}`);
  const exitTextField = (name) => document.getElementById(`exitText${name}`);
  let exitArrowSelection = 0;
  const ensureExitArrowPicker = () => {
    const select = exitArrowField("Type");
    if (!select || select._arrowPickerApi) return select?._arrowPickerApi;
    STANDARD_ARROW_ITEMS.forEach((item) => select.add(new Option(item.label, item.value)));
    select.style.display = "none";
    const proxy = document.createElement("select");
    select.parentElement.appendChild(proxy);
    select._arrowPickerApi = createFlatArrowPicker({
      mount: proxy, value: select.value || "TYPE_A", items: [{ value: "None", label: "None" }, ...STANDARD_ARROW_ITEMS],
      createPreviewNode: standardArrowPreview,
      onChange: async (key) => {
        if (key === "None") {
          exitArrowField("Type")._arrowPickerApi.setValue(select.value || "TYPE_A");
          exitArrowField("Count").value = "0";
          document.getElementById("guideArrowLanes").value = "0";
          readForm();
          return;
        }
        const selection = ++exitArrowSelection;
        await waitForGuideArrowAsset(key);
        if (selection !== exitArrowSelection) return;
        const angle = getDefaultGuideArrowAngle(key, exitDefaultSide(exposed.getCurrentPanel()?.sign));
        select.value = key;
        if (Number(exitArrowField("Count").value) === 0) {
          exitArrowField("Count").value = "1";
        }
        exitArrowField("Angle").value = String(angle);
        exitArrowField("AngleValue").value = String(angle);
        if (!["Exit Only", "Half Exit Only", "Split Exit Only"].includes(document.getElementById("guideArrow").value)) {
          document.getElementById("guideArrow").value = "Exit Only";
        }
        readForm();
      }
    });
    return select._arrowPickerApi;
  };
  const syncExitOnlyEditor = (sign, panel) => {
    if (!sign) return;
    const mode = ["Exit Only", "Half Exit Only", "Split Exit Only"].includes(sign.guideArrow)
      ? sign.guideArrow : "Exit Only";
    if (mode === "Half Exit Only" && !["Left", "Right"].includes(sign.exitArrowAlignment)) {
      sign.exitArrowAlignment = splitDefaultSide(sign, panel);
    }
    document.querySelectorAll("[data-exit-mode]").forEach((button) => {
      const selected = button.dataset.exitMode === mode;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    const type = STANDARD_ARROW_KEYS.includes(sign.exitArrowType) ? sign.exitArrowType : "TYPE_A";
    exitArrowField("Type").value = type;
    ensureExitArrowPicker()?.setValue(type);
    const fixed = isFixedDirectionArrow(type);
    exitArrowField("Angle").disabled = fixed;
    exitArrowField("AngleValue").hidden = fixed;
    exitArrowField("Flip").hidden = !fixed;
    document.querySelector('[data-exit-reset="Angle"]').disabled = fixed;
    exitArrowField("Flip").classList.toggle("selected", sign.exitArrowFlip === true);
    exitArrowField("Flip").setAttribute("aria-pressed", String(sign.exitArrowFlip === true));
    exitArrowField("Count").value = sign.guideArrowLanes ?? 1;
    for (const [name, value, digits] of [
      ["Angle", normalizeStandardAngle(sign.exitArrowAngle), 0],
      ["Size", clampStandardValue(sign.exitArrowSize, 1, 5, 10, 3.5), 1],
      ["Padding", clampStandardValue(sign.exitArrowPadding, 0, 8, 100, 0.25), 2],
      ["Spacing", clampStandardValue(sign.exitArrowSpacing, 0, 25, 100, 8.5), 2]
    ]) {
      exitArrowField(name).value = Math.min(Number(exitArrowField(name).max), value);
      exitArrowField(`${name}Value`).value = value.toFixed(digits);
    }
    exitArrowField("Spacing").disabled = Number(sign.guideArrowLanes) < 2;
    exitArrowField("SpacingValue").disabled = Number(sign.guideArrowLanes) < 2;
    document.querySelector('[data-exit-reset="Spacing"]').disabled = Number(sign.guideArrowLanes) < 2;
    const alignmentDisabled = mode !== "Half Exit Only" && Number(sign.guideArrowLanes) > 1;
    document.querySelectorAll("[data-exit-alignment]").forEach((button) => {
      const split = mode === "Half Exit Only";
      button.hidden = split && !["Left", "Right"].includes(button.dataset.exitAlignment);
      const selected = button.dataset.exitAlignment === (alignmentDisabled ? "Center" : sign.exitArrowAlignment || "Center");
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.disabled = alignmentDisabled || !button.dataset.exitAlignment || button.hidden;
    });
    exitTextField("Left").value = String(sign.exitOnlyLeftText ?? "EXIT").replace(/\r\n?|\n/g, "\\n");
    exitTextField("Right").value = String(sign.exitOnlyRightText ?? "ONLY").replace(/\r\n?|\n/g, "\\n");
    exitTextField("Font").value = sign.exitTextFont || "Series E";
    exitTextField("Font")._fontPickerApi?.sync();
    for (const [name, value, digits] of [
      ["Size", clampStandardValue(sign.exitTextSize, 50, 100, 1, 75), 0],
      ["Spacing", normalizeExitTextSpacing(sign.exitTextSpacing), 2]
    ]) {
      exitTextField(name).value = Math.max(Number(exitTextField(name).min), Math.min(Number(exitTextField(name).max), value));
      exitTextField(`${name}Value`).value = value.toFixed(digits);
    }
    const bg = getResolvedColorValue(sign.exitBackgroundColor || "Yellow");
    let rgb = String(bg).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!rgb && /^#[0-9a-f]{6}$/i.test(bg)) {
      rgb = [bg, parseInt(bg.slice(1, 3), 16), parseInt(bg.slice(3, 5), 16), parseInt(bg.slice(5, 7), 16)];
    }
    const linear = (channel) => {
      const fraction = Number(channel) / 255;
      return fraction <= 0.04045 ? fraction / 12.92 : ((fraction + 0.055) / 1.055) ** 2.4;
    };
    const luminance = rgb && (0.2126 * linear(rgb[1]) + 0.7152 * linear(rgb[2]) + 0.0722 * linear(rgb[3]));
    const inheritedColor = luminance !== null && luminance > 0.179
      ? "Black" : "White";
    for (const id of ["exitTextColor", "exitBorderColor"]) {
      document.getElementById(id).dataset.colorPickerEffectiveColor = inheritedColor;
    }
    for (const [id, value] of [
      ["exitTextColor", sign.exitTextColor || "Inherit"],
      ["exitBackgroundColor", sign.exitBackgroundColor || "Yellow"],
      ["exitBorderColor", sign.exitBorderColor || "Inherit"]
    ]) {
      const select = document.getElementById(id);
      select.value = value;
      select._colorPickerApi?.sync();
    }
    document.getElementById("exitTopBorder").checked = !!sign.exitTopBorder;
    document.getElementById("exitColorEdges").checked = !!sign.exitColorEdges;
    const texasBorder = document.getElementById("exitTexasBorder");
    texasBorder.checked = sign.exitTexasBorder !== false;
    texasBorder.closest(".exitOnlyTexasRow").hidden = !!sign.exitColorEdges || mode === "Split Exit Only";
    texasBorder.disabled = !!sign.exitColorEdges || mode === "Split Exit Only";
    const forceWidth = document.getElementById("exitForceSubpanelWidth");
    forceWidth.checked = !!sign.exitForceSubpanelWidth;
    forceWidth.closest(".exitOnlyForceWidthRow").hidden = mode !== "Half Exit Only" ||
      sign.subPanels?.length !== 2;
    document.getElementById("exitBorderColor").disabled = mode === "Split Exit Only";
    document.getElementById("exitTopBorder").disabled = mode === "Split Exit Only";
    document.getElementById("exitColorEdges").disabled = mode === "Split Exit Only" || panel?.corner !== "Sharp";
    const borderTrigger = document.querySelector('.colorPicker[data-source-select-id="exitBorderColor"] .colorPickerTrigger');
    if (borderTrigger) borderTrigger.disabled = mode === "Split Exit Only";
  };
  const bindExitOnlyEditor = () => {
    ensureExitArrowPicker();
    const splitAlignmentHistory = new WeakMap();
    const fontSelect = exitTextField("Font");
    getExitTabAvailableFonts().forEach((font) => fontSelect.add(new Option(font, font)));
    if (![...fontSelect.options].some((option) => option.value === "Series E")) {
      fontSelect.add(new Option("Series E", "Series E"));
    }
    fontSelect.value = "Series E";
    for (const id of ["exitTextColor", "exitBackgroundColor", "exitBorderColor"]) {
      const select = document.getElementById(id);
      Object.keys(lib.colors).forEach((color) => select.add(new Option(color, color)));
      select.value = id === "exitBackgroundColor" ? "Yellow" : "Inherit";
    }
    const commit = (options) => {
      if (!["Exit Only", "Half Exit Only", "Split Exit Only"].includes(document.getElementById("guideArrow").value)) {
        document.getElementById("guideArrow").value = "Exit Only";
      }
      document.getElementById("guideArrowLanes").value = exitArrowField("Count").value;
      document.getElementById("exitOnlyLeftText").value = exitTextField("Left").value;
      document.getElementById("exitOnlyRightText").value = exitTextField("Right").value;
      readForm(options);
    };
    // A sign that has never used this editor may hold older defaults; start it
    // from the current ones, which reproduce v2.2's Exit Only band.
    const EXIT_ONLY_DEFAULT_KEYS = ["exitArrowType", "exitArrowAngle", "exitArrowFlip", "exitArrowSize",
      "exitArrowPadding", "exitArrowSpacing", "exitArrowAlignment", "exitTextSize", "exitTextSpacing"];
    document.querySelectorAll("[data-exit-mode]").forEach((button) => button.addEventListener("click", () => {
      const sign = exposed.getCurrentPanel()?.sign;
      if (sign && !(sign.exitOnlyEditorVersion >= 1)) {
        const defaults = new Sign();
        EXIT_ONLY_DEFAULT_KEYS.forEach((key) => { sign[key] = defaults[key]; });
        syncExitOnlyEditor(sign, exposed.getCurrentPanel());
      }
      if (sign && button.dataset.exitMode === "Half Exit Only" && sign.guideArrow !== "Half Exit Only") {
        splitAlignmentHistory.set(sign, {
          previous: sign.exitArrowAlignment || "Center",
          changed: false
        });
        const oldSide = exitDefaultSide(sign);
        const nextSide = splitDefaultSide(sign, exposed.getCurrentPanel(), exitArrowField("AngleValue").value);
        sign.exitArrowAlignment = nextSide;
        replaceDefaultAngle(exitArrowField, exitArrowField("Type").value, oldSide, nextSide);
      }
      if (sign && sign.guideArrow === "Half Exit Only" && button.dataset.exitMode !== "Half Exit Only") {
        const history = splitAlignmentHistory.get(sign);
        if (history?.previous === "Center" && !history.changed) {
          sign.exitArrowAlignment = "Center";
        }
        splitAlignmentHistory.delete(sign);
      }
      document.getElementById("guideArrow").value = button.dataset.exitMode;
      commit();
    }));
    exitArrowField("Count").addEventListener("change", () => {
      exitArrowField("Count").value = clampStandardValue(exitArrowField("Count").value, 0, 6, 1, 1);
      commit();
    });
    for (const [field, name, min, max, precision, digits, fallback] of [
      [exitArrowField, "Angle", 0, 359, 1, 0, 0],
      [exitArrowField, "Size", 1, 5, 10, 1, 3.5],
      [exitArrowField, "Padding", 0, 5, 100, 2, 0.25],
      [exitArrowField, "Spacing", 0, 25, 100, 2, 8.5],
      [exitTextField, "Size", 50, 100, 1, 0, 75],
      [exitTextField, "Spacing", -0.15, 0.5, 100, 2, 0]
    ]) {
      const slider = field(name);
      const number = field(`${name}Value`);
      slider.addEventListener("input", () => {
        number.value = Number(slider.value).toFixed(digits);
        commit({ deferHistoryEnd: true });
      });
      const finish = () => exposed?.endUndoableChange?.();
      ["change", "pointerup", "pointercancel", "blur"].forEach((event) => slider.addEventListener(event, finish));
      number.addEventListener("change", () => {
        let value = field === exitArrowField && name === "Angle"
          ? normalizeStandardAngle(number.value)
          : field === exitTextField && name === "Spacing"
          ? normalizeExitTextSpacing(number.value)
          : clampStandardValue(number.value, min, max, precision, fallback);
        if (field === exitTextField && name === "Size") value = Math.round(value / 5) * 5;
        number.value = value.toFixed(digits);
        slider.value = Math.max(Number(slider.min), Math.min(Number(slider.max), value));
        commit();
      });
      number.addEventListener("keydown", (event) => { if (event.key === "Enter") number.blur(); });
    }
    document.addEventListener("pointerdown", (event) => {
      const active = document.activeElement;
      if (active?.matches?.('.exitOnlyRow input[type="number"]') && event.target !== active) active.blur();
    }, true);
    exitArrowField("Flip").addEventListener("click", () => {
      const button = exitArrowField("Flip");
      button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true"));
      commit();
    });
    for (const button of document.querySelectorAll("[data-exit-reset]")) {
      button.addEventListener("click", () => {
        const reset = button.dataset.exitReset;
        const isText = reset.startsWith("Text");
        const name = isText ? reset.slice(4) : reset;
        const field = isText ? exitTextField : exitArrowField;
        const defaults = isText
          ? { Size: 75, Spacing: 0 }
          : { Angle: getDefaultGuideArrowAngle(exitArrowField("Type").value,
              exitDefaultSide(exposed.getCurrentPanel()?.sign)), Size: 3.5, Padding: 0.25, Spacing: 8.5 };
        const digits = name === "Angle" || (isText && name === "Size") ? 0 : name === "Size" ? 1 : 2;
        field(name).value = String(defaults[name]);
        field(`${name}Value`).value = defaults[name].toFixed(digits);
        commit();
      });
    }
    document.querySelectorAll("[data-exit-alignment]").forEach((button) => button.addEventListener("click", () => {
      const sign = exposed.getCurrentPanel()?.sign;
      if (sign) {
        if (sign.guideArrow === "Half Exit Only") {
          const history = splitAlignmentHistory.get(sign);
          if (history) history.changed = true;
        }
        const oldSide = exitDefaultSide(sign);
        sign.exitArrowAlignment = button.dataset.exitAlignment;
        replaceDefaultAngle(exitArrowField, exitArrowField("Type").value, oldSide, exitDefaultSide(sign));
      }
      commit();
    }));
    ["Left", "Right"].forEach((name) => {
      const input = exitTextField(name);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") input.blur();
      });
      input.addEventListener("paste", (event) => {
        const pasted = event.clipboardData?.getData("text/plain");
        if (!pasted || !/[\r\n]/.test(pasted)) return;
        event.preventDefault();
        input.setRangeText(pasted.replace(/\r\n?|\n/g, "\\n"), input.selectionStart, input.selectionEnd, "end");
      });
      input.addEventListener("blur", () => {
        const stored = exposed.getCurrentPanel()?.sign?.[`exitOnly${name}Text`];
        if (input.value !== String(stored ?? (name === "Left" ? "EXIT" : "ONLY")).replace(/\r\n?|\n/g, "\\n")) {
          commit();
        }
      });
    });
    document.addEventListener("pointerdown", (event) => {
      const active = document.activeElement;
      if (active?.matches?.('.exitOnlyTextRow input[type="text"]') && event.target !== active) active.blur();
    }, true);
    ["exitTextFont", "exitTextColor", "exitBackgroundColor", "exitBorderColor", "exitTopBorder", "exitColorEdges", "exitTexasBorder", "exitForceSubpanelWidth"]
      .forEach((id) => document.getElementById(id).addEventListener("change", () => commit()));
  };

  const initialize = async (appExposed) => {
    exposed = appExposed;
    post = exposed.getPost();
    applyStoredPreferences();
    await initUI();
    bindStandardArrowControls();
    bindExitOnlyEditor();
    observeNativeSelects(convertSelect);
    loadCustomIconRecords().then((records) => {
      if (records.length) exposed.redraw();
    }).catch((error) => console.warn("Unable to load custom icons", error));
    await CustomShieldMaker.init(exposed, {
      updateForm,
      onShieldListChanged: syncShieldBaseOptions,
      selectShieldBase: (value) => {
        const select = document.getElementById("sdShield_shieldBase");
        select.value = value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      },
    });

    try {
      //console.log(promptShield(null));
    } catch (e) {
      console.error(e);
    }
  };

  const initUI = async () => {
    const sMConfigBar = document.querySelector("#sMConfigBar");
    const htmlElement = document.documentElement;
    const bodyElement = document.body;
    const nightModeButton = document.querySelector("#nightMode");
    const mobileMediaQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(max-width: 768px)")
        : null;
    const prefersDarkScheme =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;
    let userThemeOverride = false;
    let mobileToolbar;
    let mobileToolbarLeading;
    let mobileToolbarTrailing;
    const mobileToolbarPlaceholders = new Map();
    let panelSelectPlaceholder;

    const getSystemTheme = () =>
      prefersDarkScheme && prefersDarkScheme.matches ? "dark" : "light";

    const applyTheme = (theme) => {
      if (!theme) {
        return;
      }
      htmlElement.dataset.theme = theme;
    };

    const syncThemeWithSystem = () => {
      const systemTheme = getSystemTheme();
      if (!userThemeOverride) {
        applyTheme(systemTheme);
      } else if (htmlElement.dataset.theme === systemTheme) {
        userThemeOverride = false;
      }
    };

    // v2.19 Settings: theme mode and UI scale are kept per device.
    const themeModeSelect = document.getElementById("appThemeMode");
    const setThemeMode = (mode) => {
      const normalized = ["light", "dark"].includes(mode) ? mode : "system";
      setStoredItem(STORAGE_KEYS.themeMode, normalized);
      themeModeSelect.value = normalized;
      userThemeOverride = normalized !== "system";
      applyTheme(userThemeOverride ? normalized : getSystemTheme());
    };
    themeModeSelect.addEventListener("change", () => setThemeMode(themeModeSelect.value));
    const storedThemeMode = getStoredItem(STORAGE_KEYS.themeMode);
    themeModeSelect.value = ["light", "dark"].includes(storedThemeMode) ? storedThemeMode : "system";
    userThemeOverride = themeModeSelect.value !== "system";
    applyTheme(userThemeOverride ? themeModeSelect.value : getSystemTheme());

    const uiScaleInput = document.getElementById("appUiScale");
    const applyUiScale = (value, persist) => {
      const scale = Math.round(Math.max(50, Math.min(150, Number(value) || 100)) / 10) * 10;
      uiScaleInput.value = String(scale);
      document.getElementById("appUiScaleValue").textContent = `${scale}%`;
      if (scale === 100) {
        htmlElement.style.removeProperty("--sm-ui-zoom");
      } else {
        htmlElement.style.setProperty("--sm-ui-zoom", String(scale / 100));
      }
      if (persist) {
        setStoredItem(STORAGE_KEYS.uiScale, String(scale));
        reDisplay();
      }
    };
    applyUiScale(getStoredItem(STORAGE_KEYS.uiScale), false);
    stepUiScale = (step) => {
      applyUiScale(Number(uiScaleInput.value) + step, true);
      return Number(uiScaleInput.value);
    };
    buildShortcutSettings();
    document.addEventListener("keydown", handleAppShortcut);
    uiScaleInput.addEventListener("input", () =>
      document.getElementById("appUiScaleValue").textContent = `${uiScaleInput.value}%`);
    uiScaleInput.addEventListener("change", () => applyUiScale(uiScaleInput.value, true));

    // v2.2's bottom toolbar or v2.19's right sidebar (set early in index.html).
    const toolbarSelect = document.getElementById("appToolbarPosition");
    toolbarSelect.value = htmlElement.dataset.toolbar === "bottom" ? "bottom" : "right";
    toolbarSelect.addEventListener("change", () => {
      setStoredItem(STORAGE_KEYS.toolbarPosition, toolbarSelect.value);
      if (toolbarSelect.value === "bottom") htmlElement.dataset.toolbar = "bottom";
      else delete htmlElement.dataset.toolbar;
      reDisplay();
    });

    const oldInterstatePositioning = document.getElementById("appOldInterstateNumberPositioning");
    oldInterstatePositioning.checked = getStoredItem(STORAGE_KEYS.oldInterstateNumberPositioning) === "true";
    ShieldElement.oldInterstateNumberPositioning = oldInterstatePositioning.checked;
    oldInterstatePositioning.addEventListener("change", () => {
      ShieldElement.oldInterstateNumberPositioning = oldInterstatePositioning.checked;
      setStoredItem(STORAGE_KEYS.oldInterstateNumberPositioning, String(oldInterstatePositioning.checked));
      exposed.redraw();
    });

    const keybindModeSelect = document.getElementById("appKeybindMode");
    keybindModeSelect.value = getKeybindMode();
    keybindModeSelect.addEventListener("change", () =>
      setStoredItem(STORAGE_KEYS.keybindMode, keybindModeSelect.value));

    syncThemeWithSystem();
    if (prefersDarkScheme) {
      if (typeof prefersDarkScheme.addEventListener === "function") {
        prefersDarkScheme.addEventListener("change", syncThemeWithSystem);
      } else if (typeof prefersDarkScheme.addListener === "function") {
        prefersDarkScheme.addListener(syncThemeWithSystem);
      }
    }

    const isMobileLayout = () =>
      mobileMediaQuery ? mobileMediaQuery.matches : window.innerWidth <= 768;

    const ensureMobileToolbar = () => {
      if (mobileToolbar) {
        return;
      }

      mobileToolbar = document.createElement("nav");
      mobileToolbar.id = "mobileToolbar";
      mobileToolbar.setAttribute("aria-label", "Toolbar");

      mobileToolbarLeading = document.createElement("div");
      mobileToolbarLeading.className = "mobileToolbarGroup mobileToolbarLeading";

      mobileToolbarTrailing = document.createElement("div");
      mobileToolbarTrailing.className = "mobileToolbarGroup mobileToolbarTrailing";

      mobileToolbar.appendChild(mobileToolbarLeading);
      mobileToolbar.appendChild(mobileToolbarTrailing);
      bodyElement.appendChild(mobileToolbar);
    };

    const rememberToolbarItemPosition = (element) => {
      if (
        !element ||
        mobileToolbarPlaceholders.has(element) ||
        !element.parentNode
      ) {
        return;
      }

      const placeholder = document.createComment("mobile toolbar placeholder");
      element.parentNode.insertBefore(placeholder, element);
      mobileToolbarPlaceholders.set(element, placeholder);
    };

    const moveToolbarItem = (element, container) => {
      if (!element || !container || container.contains(element)) {
        return;
      }

      rememberToolbarItemPosition(element);
      container.appendChild(element);
    };

    const moveMobileToolbarItems = () => {
      ensureMobileToolbar();

      const exportButton = document.getElementById("export");
      const downloadButton = document.getElementById("exportDownload");
      const hideButton = document.getElementById("hideConfig");

      for (const button of [
        exportButton,
        downloadButton,
        nightModeButton,
        hideButton,
      ]) {
        moveToolbarItem(button, mobileToolbarTrailing);
      }
    };

    const restoreDesktopToolbarItems = () => {
      for (const [element, placeholder] of mobileToolbarPlaceholders) {
        if (
          element &&
          placeholder?.parentNode &&
          element.parentNode !== placeholder.parentNode
        ) {
          placeholder.parentNode.insertBefore(element, placeholder.nextSibling);
        }
      }
    };

    const moveMobilePanelSelect = (panelSelect) => {
      const modalLayer = document.querySelector(".modals");
      if (!panelSelect || !modalLayer) {
        return;
      }

      if (!panelSelectPlaceholder && panelSelect.parentNode) {
        panelSelectPlaceholder = document.createComment(
          "panel selector placeholder"
        );
        panelSelect.parentNode.insertBefore(panelSelectPlaceholder, panelSelect);
      }

      if (panelSelect.parentNode !== modalLayer) {
        modalLayer.appendChild(panelSelect);
      }
    };

    const restoreDesktopPanelSelect = (panelSelect) => {
      if (
        panelSelect &&
        panelSelectPlaceholder?.parentNode &&
        panelSelect.parentNode !== panelSelectPlaceholder.parentNode
      ) {
        panelSelectPlaceholder.parentNode.insertBefore(
          panelSelect,
          panelSelectPlaceholder.nextSibling
        );
      }
    };

    const updateMobileLayoutMetrics = () => {
      const mainElmt = document.querySelector("main");
      const postContainer = document.getElementById("postContainer");
      const panelSelect = document.getElementById("panelSelect");

      if (!isMobileLayout()) {
        restoreDesktopPanelSelect(panelSelect);
        restoreDesktopToolbarItems();
        bodyElement.classList.remove("mobile-sheet-open");
        htmlElement.style.removeProperty("--mobile-sheet-height");
        htmlElement.style.removeProperty("--mobile-sign-scale");
        htmlElement.style.removeProperty("--mobile-toolbar-height");
        htmlElement.style.removeProperty("--mobile-tabbar-height");
        return;
      }

      moveMobileToolbarItems();
      moveMobilePanelSelect(panelSelect);

      const currentMenu = sMConfigBar.dataset.currentMenu;
      const activeModal = currentMenu
        ? document.querySelector(".sMModal." + currentMenu)
        : null;
      const openModal =
        activeModal && activeModal.style.display !== "" ? activeModal : null;
      const openSheet =
        openModal ||
        (currentMenu === "panelSelector" &&
        panelSelect &&
        panelSelect.style.display !== ""
          ? panelSelect
          : null);

      const toolbarHeight = mobileToolbar
        ? mobileToolbar.getBoundingClientRect().height
        : 0;
      const tabbarHeight = sMConfigBar.getBoundingClientRect().height;
      const sheetHeight = openSheet
        ? openSheet.getBoundingClientRect().height
        : 0;

      htmlElement.style.setProperty(
        "--mobile-toolbar-height",
        Math.ceil(toolbarHeight) + "px"
      );
      htmlElement.style.setProperty(
        "--mobile-tabbar-height",
        Math.ceil(tabbarHeight) + "px"
      );
      htmlElement.style.setProperty(
        "--mobile-sheet-height",
        Math.ceil(sheetHeight) + "px"
      );

      bodyElement.classList.toggle("mobile-sheet-open", !!openSheet);

      if (!mainElmt || !postContainer) {
        return;
      }

      const mainRect = mainElmt.getBoundingClientRect();
      const postWidth = postContainer.offsetWidth;
      const postHeight = postContainer.offsetHeight;
      const horizontalInset = 16;
      const verticalInset = 16;
      const scaleValues = [];

      if (postWidth > 0 && mainRect.width > horizontalInset) {
        scaleValues.push((mainRect.width - horizontalInset) / postWidth);
      }

      if (postHeight > 0 && mainRect.height > verticalInset) {
        scaleValues.push((mainRect.height - verticalInset) / postHeight);
      }

      const nextScale = Math.max(
        0.1,
        Math.min(1, ...(scaleValues.length ? scaleValues : [1]))
      );
      htmlElement.style.setProperty(
        "--mobile-sign-scale",
        nextScale.toFixed(3)
      );
    };

    scheduleMobileLayoutUpdate = () => {
      requestAnimationFrame(updateMobileLayoutMetrics);
    };

    // A sidebar popover stays beside its button and inside the window, also
    // when its contents grow (e.g. a different Defaults category).
    let sidebarPopoverModal = null;
    const positionSidebarPopover = () => {
      const currentMenu = sMConfigBar.dataset.currentMenu;
      if (!sidebarPopoverModal || !currentMenu) return;
      const modalsElmt = document.querySelector(".modals");
      const zoom = parseFloat(getComputedStyle(htmlElement).getPropertyValue("--sm-app-zoom")) || 1;
      const buttonRect = document.getElementById(currentMenu).getBoundingClientRect();
      const barRect = sMConfigBar.getBoundingClientRect();
      const popoverHeight = sidebarPopoverModal.offsetHeight * zoom;
      modalsElmt.style.setProperty(
        "--sidebarPopoverTop",
        Math.max(16, Math.min(buttonRect.top, window.innerHeight - popoverHeight - 16)) + "px"
      );
      modalsElmt.style.setProperty(
        "--sidebarPopoverRight",
        window.innerWidth - barRect.left + 8 + "px"
      );
    };
    const sidebarPopoverResizeObserver = new ResizeObserver(() => positionSidebarPopover());

    const SIDEBAR_POPOVER_MENUS = new Set(["panelStyleConfig", "postConfig", "appSettingsConfig"]);

    function reDisplay() {
      const panelSelect = document.querySelector("#panelSelect");
      if (isMobileLayout()) {
        moveMobilePanelSelect(panelSelect);
      } else {
        restoreDesktopPanelSelect(panelSelect);
      }

      for (const holder of document.querySelectorAll(".sMModal")) {
        if (holder.classList.contains(sMConfigBar.dataset.currentMenu)) {
          holder.style.display = "block";
        } else {
          holder.style.display = "";
        }
      }

      if (sMConfigBar.dataset.currentMenu == "panelSelector") {
        if (panelSelect) {
          panelSelect.style.display = "flex";
        }
        document.querySelectorAll(
          ".sMConfigOption:has(#panelSelector)"
        )[0].className = "sMConfigOption selected";
      } else {
        if (panelSelect) {
          panelSelect.style.display = "";
        }
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

      const currentMenu = sMConfigBar.dataset.currentMenu;
      const openModal = currentMenu
        ? document.querySelector(".sMModal." + currentMenu)
        : null;
      const zoom =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--sm-app-zoom")
        ) || 1;

      // Small windows open as a popover beside their sidebar button (v2.19).
      const modalsElmt = document.querySelector(".modals");
      const isSidebarPopover =
        !isMobileLayout() && htmlElement.dataset.toolbar !== "bottom" &&
        !!openModal && SIDEBAR_POPOVER_MENUS.has(currentMenu);
      modalsElmt.classList.toggle("sidebarPopover", isSidebarPopover);
      sidebarPopoverModal = isSidebarPopover ? openModal : null;
      if (isSidebarPopover) {
        positionSidebarPopover();
        sidebarPopoverResizeObserver.disconnect();
        sidebarPopoverResizeObserver.observe(openModal);
      }

      // Shift panels away from the open window, by half its on-screen width.
      const mainElmt = document.querySelector("main");
      if (mainElmt) {
        if (isMobileLayout() || !openModal) {
          mainElmt.style.transform = "";
        } else {
          const shift = (openModal.offsetWidth * zoom) / 2;
          mainElmt.style.transform =
            "translateX(" + (isSidebarPopover ? -shift : shift) + "px)";
        }
      }

      scheduleMobileLayoutUpdate();
    }

    window.addEventListener("resize", () => {
      if (SIDEBAR_POPOVER_MENUS.has(sMConfigBar.dataset.currentMenu)) {
        reDisplay();
      }
    });

    for (const button of document.querySelectorAll(".sMConfigOption")) {
      button.onclick = function () {
        if (!button.id || button.id == "nightMode") {
          return;
        }

        if (sMConfigBar.dataset.currentMenu == button.id) {
          sMConfigBar.dataset.currentMenu = "";
        } else {
          sMConfigBar.dataset.currentMenu = button.id;
        }

        reDisplay();

        if (
          button.id === "templates" &&
          sMConfigBar.dataset.currentMenu === "templates" &&
          typeof app !== "undefined" &&
          typeof app.refreshTemplatesList === "function"
        ) {
          app.refreshTemplatesList();
        }
      };
    }

    for (const button of document.querySelectorAll(".sMModalTab")) {
      button.onclick = function () {
        if (!button.dataset.tab) {
          return;
        }

        if (button.dataset.tab === "sMAPL") {
          const panel = post?.panels?.[exposed.vars.currentlySelectedPanelIndex];
          const subPanelCount = panel?.sign?.subPanels?.length || 0;

          if (subPanelCount <= 1) {
            const shouldAddSubPanel = window.confirm(
              "APL arrows need at least two subpanels. Add a new subpanel?"
            );

            if (!shouldAddSubPanel) {
              return;
            }

            if (
              exposed &&
              typeof exposed.addAPLSubPanelRightAndOpen === "function"
            ) {
              exposed.addAPLSubPanelRightAndOpen();
            }
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

        if (
          button.dataset.tab === "sMStandardArrows" &&
          exposed &&
          typeof exposed.setCurrentPanelArrowMode === "function"
        ) {
          exposed.setCurrentPanelArrowMode("standard");
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

        // Refresh the unified template list when its tab is opened.
        if (button.dataset.tab === "sMTemplatesSaved" && typeof app !== "undefined" && typeof app.refreshTemplatesList === "function") {
          app.refreshTemplatesList();
        }

        scheduleMobileLayoutUpdate();
      };
    }

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
    };

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
          : 0;
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

    document.getElementById("panelListShowHiddenPanels")
      ?.addEventListener("change", () => updateForm());

    if (panelSpacingSlider) {
      panelSpacingSlider.addEventListener("input", (event) => {
        applyLiveEdit(event, () => commitPanelSpacingChange(panelSpacingSlider.value));
      });
      panelSpacingSlider.addEventListener("change", () => {
        commitPanelSpacingChange(panelSpacingSlider.value);
      });
    }

    if (panelSpacingValueInput) {
      panelSpacingValueInput.addEventListener("input", (event) => {
        applyLiveEdit(event, () => commitPanelSpacingChange(panelSpacingValueInput.value));
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

    PANEL_PADDING_FIELDS.forEach((fieldId) => {
      const field = document.getElementById(fieldId);
      if (!field || field.dataset.panelPaddingPersist === "true") {
        return;
      }
      field.dataset.panelPaddingPersist = "true";
      field.addEventListener("input", () => {
        commitPanelPaddingChange();
      });
      field.addEventListener("change", () => {
        commitPanelPaddingChange({ syncInputs: true });
      });
    });

    document.addEventListener("input", checkForLimonEasterEgg, true);
    document.addEventListener("keydown", handleBlockClipboardShortcut, true);

    document.getElementById("export").onclick = function (event) {
      event.preventDefault();
      if (typeof app !== "undefined" && typeof app.closeCopyPanelContextMenu === "function") {
        app.closeCopyPanelContextMenu();
      }
      if (typeof app !== "undefined" && typeof app.closeDownloadPanelContextMenu === "function") {
        app.closeDownloadPanelContextMenu();
      }
      if (typeof app !== "undefined" && typeof app.copySignToClipboard === "function") {
        app.copySignToClipboard();
      }
    };

    document.getElementById("export").oncontextmenu = function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof app !== "undefined" && typeof app.closeDownloadPanelContextMenu === "function") {
        app.closeDownloadPanelContextMenu();
      }
      if (typeof app !== "undefined" && typeof app.openCopyPanelContextMenu === "function") {
        app.openCopyPanelContextMenu(event);
      }
    };

    document.getElementById("exportDownload").onclick = function (event) {
      event.preventDefault();
      if (typeof app !== "undefined" && typeof app.closeCopyPanelContextMenu === "function") {
        app.closeCopyPanelContextMenu();
      }
      if (typeof app !== "undefined" && typeof app.closeDownloadPanelContextMenu === "function") {
        app.closeDownloadPanelContextMenu();
      }
      if (typeof app !== "undefined" && typeof app.downloadCopiedSign === "function") {
        app.downloadCopiedSign();
      }
    };

    document.getElementById("exportDownload").oncontextmenu = function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof app !== "undefined" && typeof app.closeCopyPanelContextMenu === "function") {
        app.closeCopyPanelContextMenu();
      }
      if (typeof app !== "undefined" && typeof app.openDownloadPanelContextMenu === "function") {
        app.openDownloadPanelContextMenu(event);
      }
    };

    document.getElementById("hideConfig").onclick = function () {
      const label = this.querySelector("span:not(.material-symbols-outlined)");
      if (sMConfigBar.classList.contains("invisible")) {
        sMConfigBar.classList.remove("invisible");
        this.dataset.tooltip = "Hide";
        label.textContent = "Hide Menu";
      } else {
        sMConfigBar.classList.add("invisible");
        this.dataset.tooltip = "Show";
        label.textContent = "Show Menu";
      }
      scheduleMobileLayoutUpdate();
    };

    // Exit tab slider resets return each slider to the ExitTab default.
    for (const [buttonId, sliderId, defaultValue] of [
      ["borderReset", "borderThickness", 0.2],
      ["minimumReset", "minHeight", 2.25],
      ["sizeReset", "fontSize", 18],
      ["exitTabCornerRadiusReset", "exitTabCornerRadius", 0.5],
      ["exitTabHorizontalPaddingReset", "exitTabHorizontalPadding", 0],
      ["exitTabTextSizePercentReset", "exitTabTextSizePercent", 67],
    ]) {
      document.getElementById(buttonId).addEventListener("click", () => {
        if (buttonId === "exitTabCornerRadiusReset") {
          document.getElementById("exitTabUsePanelCornerRadius").checked = false;
        }
        const slider = document.getElementById(sliderId);
        slider.value = defaultValue;
        slider.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }

    document.getElementById("cancelDownload").onclick = function () {
      document.querySelector("#modalHolder").style.display = "none";
      document.querySelector("#downloadContent").style.display = "none";
      document.querySelector("#downloadContent").close();
    };

    document.querySelector("#closeWelcome").onclick = function () {
      document.querySelector("#modalHolder").style.display = "none";
      localStorage.setItem("closedWelcome", true);
      document.querySelector("#welcomeToSignMaker").close();
    };

    newRowDropTargetButton = document.getElementById("sMSPCreateRow");
    if (newRowDropTargetButton) {
      newRowDropTargetButton.addEventListener("dragenter", handleNewRowDragEnter);
      newRowDropTargetButton.addEventListener("dragover", handleNewRowDragOver);
      newRowDropTargetButton.addEventListener("dragleave", handleNewRowDragLeave);
      newRowDropTargetButton.addEventListener("drop", handleNewRowDrop);
    }

    newBlockDragSourceButton = document.getElementById("sMSPCreateElement");
    if (newBlockDragSourceButton) {
      newBlockDragSourceButton.addEventListener(
        "dragstart",
        handleNewBlockDragStart
      );
      newBlockDragSourceButton.addEventListener(
        "dragend",
        handleNewBlockDragEnd
      );
    }

    const blockSelectionModeInput = document.getElementById(
      "sMSPBlockSelectionMode"
    );
    if (blockSelectionModeInput) {
      blockSelectionModeInput.addEventListener("change", () => {
        blockSelectionMode = blockSelectionModeInput.checked;
        if (!blockSelectionMode) {
          clearBlockSelection();
        }
        updateForm();
      });
    }

    const groupSelectedBlocksButton = document.getElementById(
      "sMSPGroupSelectedBlocks"
    );
    if (groupSelectedBlocksButton) {
      groupSelectedBlocksButton.addEventListener("click", (event) => {
        event.preventDefault();
        const didGroup =
          exposed &&
          typeof exposed.groupSelectedBlockElements === "function" &&
          exposed.groupSelectedBlockElements(getSelectedBlockRefs());
        if (didGroup) {
          blockSelectionMode = false;
          clearBlockSelection();
          updateForm();
        }
      });
    }

    const toolTip = document.createElement("span");
    toolTip.className = "toolTip";
    toolTip.style.opacity = 0;
    document.body.appendChild(toolTip);
    for (const element of document.querySelectorAll("[data-toolTip]")) {
      element.addEventListener("mouseover", () => {
        // Toolbar buttons only need a tooltip when their label is hidden.
        const label = element.querySelector(":scope > span:not(.material-symbols-outlined)");
        if (label && getComputedStyle(label).display !== "none") return;
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

    document.getElementById("clearAll").addEventListener("click", () => {
      app.clearAll();
    });

    if (nightModeButton) {
      nightModeButton.addEventListener("click", () => {
        const nextTheme =
          htmlElement.dataset.theme === "dark" ? "light" : "dark";
        setThemeMode(nextTheme === getSystemTheme() ? "system" : nextTheme);
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

    if (!localStorage.getItem("closedWelcome")) {
      document.querySelector("#modalHolder").style.display = "flex";
      document.querySelector("#welcomeToSignMaker").showModal();
    }

    // Populate post kind options
    const postPositionSelectElmt = document.getElementById("postPosition");
    for (const polePosition of Post.prototype.polePositions) {
      lib.appendOption(postPositionSelectElmt, polePosition, {
        selected: polePosition == post.polePosition,
        text: formatPostKindLabel(polePosition),
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

    const signAlignmentSelectElmt = document.getElementById("signAlignment");
    if (signAlignmentSelectElmt) {
      for (const alignmentOption of Post.prototype.signAlignments) {
        lib.appendOption(signAlignmentSelectElmt, alignmentOption, {
          selected: alignmentOption === post.signAlignment,
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
        selected: corner === normalizePanelCorner(Panel.prototype.defaultCorner),
      });
    }

    // Populate exit tab position options
    const exitTabPositionSelectElmt =
      document.getElementById("exitTabPosition");
    for (const position of ExitTab.prototype.positions) {
      lib.appendOption(exitTabPositionSelectElmt, position, {
        selected: position == ExitTab.prototype.defaultPosition,
      });
    }

    // Populate exit tab width options
    const exitTabWidthSelectElmt = document.getElementById("exitTabWidth");
    for (const width of ExitTab.prototype.widths) {
      lib.appendOption(exitTabWidthSelectElmt, width, {
        selected: width == ExitTab.prototype.defaultWidth,
      });
    }

    // Populate the exit color options
    const exitColorSelectElement = document.getElementById("exitColor");
    for (const exitColor of ExitTab.prototype.colors) {
      lib.appendOption(exitColorSelectElement, exitColor);
    }

    const exitFontSelect = document.getElementById("exitTabFontFamily");
    for (const font of getExitTabAvailableFonts()) {
      lib.appendOption(exitFontSelect, font);
    }
    const exitTextColorSelect = document.getElementById("exitTabTextColor");
    for (const color of ExitTab.prototype.colors) {
      lib.appendOption(exitTextColorSelect, color);
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
        selected: element == "Standard Control Text",
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
      lib.appendOption(arrowDirectionElmt, arrowDirection, {
        text: arrowDirection === "Middle" ? "Center" : arrowDirection,
      });
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
      document.querySelector("#sdGroupedBlock_alignment"),
    ];
    let textElem_bgColorSelects = [
      document.querySelector("#sdCtrlText_backgroundColor"),
      document.querySelector("#sdAdvisory_backgroundColor"),
      document.querySelector("#sdActionMessage_backgroundColor"),
      document.querySelector("#sdIcon_borderColor"),
      document.querySelector("#sdIcon_backgroundColor"),
      document.querySelector("#sdBlock_backgroundColor"),
      document.querySelector("#sdTollLogo_backgroundColor"),
      document.querySelector("#sdGroupedBlock_backgroundColor"),
      document.querySelector("#sdGroupedBlock_borderColor"),
    ];
    let divider_widthMeasurement = document.querySelector(
      "#sdBlocker_dividerMeasurement"
    );
    let divider_orientationSelect = document.querySelector(
      "#sdBlocker_orientation"
    );
    let divider_colorSelect = document.querySelector("#sdBlocker_dividerColor");
    let shield_shieldBase = document.querySelector("#sdShield_shieldBase");
    const shieldRouteNumberInput = document.querySelector(
      "#sdShield_routeNumber"
    );
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

    const advisoryTextColorSelect = document.querySelector(
      "#sdAdvisory_textColor"
    );
    if (advisoryTextColorSelect) {
      const advisoryTextColorOptions = AdvisoryMessageElement.getTextColorOptions();
      for (const optionValue of advisoryTextColorOptions) {
        if (optionValue) {
          lib.appendOption(advisoryTextColorSelect, optionValue);
        }
      }
      advisoryTextColorSelect.value = AdvisoryMessageElement.defaultTextColor;
    }

    const actionMessageTextColorSelect = document.querySelector(
      "#sdActionMessage_textColor"
    );
    if (actionMessageTextColorSelect) {
      const actionTextColorOptions = ActionMessageElement.getTextColorOptions();
      for (const optionValue of actionTextColorOptions) {
        if (optionValue) {
          lib.appendOption(actionMessageTextColorSelect, optionValue);
        }
      }
      actionMessageTextColorSelect.value = ActionMessageElement.defaultTextColor;
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

    const actionMessageFontSelect = document.querySelector(
      "#sdActionMessage_fontFamily"
    );
    if (actionMessageFontSelect) {
      const defaultActionMessageFont = ActionMessageElement.getDefaultFont();
      if (defaultActionMessageFont) {
        actionMessageFontSelect.value = defaultActionMessageFont;
      }

      actionMessageFontSelect.addEventListener("change", () => {
        const selectedFont = actionMessageFontSelect.value;
        const availableFonts = TextElement.prototype.fontFamily;
        if (!selectedFont || !availableFonts.includes(selectedFont)) {
          return;
        }
        ActionMessageElement.setDefaultFont(selectedFont);
        setStoredItem(STORAGE_KEYS.actionMessageFont, selectedFont);
      });
    }

    for (const elem of textElem_alignmentSelects) {
      for (const alignment of TextElement.prototype.alignment) {
        lib.appendOption(elem, alignment);
      }
    }

    let textElem_justificationSelects = [
      document.querySelector("#sdCtrlText_justification"),
      document.querySelector("#sdAdvisory_justification"),
      document.querySelector("#sdActionMessage_justification"),
      document.querySelector("#sdElectronicSign_justification"),
    ];
    for (const elem of textElem_justificationSelects) {
      for (const justification of TextElement.prototype.justification) {
        lib.appendOption(elem, justification);
      }
    }
    // Arrows default to the alignment of the block before them.
    for (const alignment of ["Auto", ...TextElement.prototype.alignment]) {
      lib.appendOption(document.getElementById("sdArrow_alignment"), alignment);
    }
    setupSdIconEditorControls();

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

    syncShieldBaseOptions();

    if (shield_shieldBase) {
      const pickerMount = document.createElement("span");
      shield_shieldBase.insertAdjacentElement("afterend", pickerMount);
      shieldBasePicker = ShieldPicker.create({
        mount: pickerMount,
        value: shield_shieldBase.value,
        placeholder: "Shield type",
        onChange: (value) => {
          if (shield_shieldBase.value === value) {
            return;
          }
          shield_shieldBase.value = value;
          shield_shieldBase.dispatchEvent(new Event("change", { bubbles: true }));
        },
      });
    }

    const shieldVariantSelect = document.querySelector("#sdShield_shieldType");
    if (shieldVariantSelect && ShieldElement.prototype.blockShieldVariants) {
      populateShieldVariantOptions = (baseValue, currentValue) => {
        shieldVariantSelect.innerHTML = "";
        const config = ShieldElement.prototype.getBlockShieldConfig(baseValue);
        const variants =
          (config && Array.isArray(config.variants) && config.variants.length
            ? config.variants
            : []) || [];
        // "Auto" picks the variant from the route number's length.
        const optionsToUse = variants.length
          ? (variants.length > 1 ? ["Auto"] : []).concat(variants)
          : (ShieldElement.prototype.blockShieldVariants || []).map(
            (variant) => variant.value || variant
          );
        for (const variant of optionsToUse) {
          lib.appendOption(shieldVariantSelect, variant, { text: variant });
        }
        if (currentValue && optionsToUse.includes(currentValue)) {
          shieldVariantSelect.value = currentValue;
        }
        shieldPickers.variant?.sync();
      };
      shieldPickers.variant = createNativeSelectPicker(
        shieldVariantSelect,
        "Shield variant"
      );

      populateShieldVariantOptions(
        shield_shieldBase?.value || ShieldElement.prototype.defaultShieldBase,
        shieldVariantSelect.value
      );
      syncShieldRouteCharacterLimit(
        shield_shieldBase?.value || ShieldElement.prototype.defaultShieldBase,
        shieldRouteNumberInput
      );

      if (shield_shieldBase) {
        shield_shieldBase.addEventListener("change", () => {
          populateShieldVariantOptions(shield_shieldBase.value, null);
          syncShieldRouteCharacterLimit(
            shield_shieldBase.value,
            shieldRouteNumberInput
          );
        });
      }
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

    const blockBannerFontSelects = [
      document.querySelector("#sdShield_bannerFontFamily1"),
      document.querySelector("#sdShield_bannerFontFamily2"),
      document.querySelector("#sdShield_roadNameFontFamily"),
    ];
    for (const blockBannerFontSelect of blockBannerFontSelects) {
      if (!blockBannerFontSelect) {
        continue;
      }
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
      shieldPickers[blockBannerFontSelect.id] = createNativeSelectPicker(
        blockBannerFontSelect,
        blockBannerFontSelect.getAttribute("aria-label") || "Font",
        {
          textStyleForValue: (font) => ({
            fontFamily: `"${resolveTextFontFamilyForRender(font, {}, null)}"`,
          }),
        }
      );
      blockBannerFontSelect.addEventListener("change", () => {
        const selectedFont = blockBannerFontSelect.value;
        if (
          selectedFont &&
          blockBannerFontSelect.id === "sdShield_bannerFontFamily1"
        ) {
          ShieldElement.prototype.defaultBannerFontFamily = selectedFont;
          setStoredItem(STORAGE_KEYS.bannerFontFamily, selectedFont);
        }
        readForm();
      });
    }

    for (const id of ["sdShield_bannerBackgroundColor1", "sdShield_bannerBackgroundColor2"]) {
      const select = document.getElementById(id);
      for (const color of TextElement.prototype.backgroundColor) {
        lib.appendOption(select, color);
      }
      select.value = ShieldElement.prototype.defaultBannerBackgroundColor;
      colorSelects.add(select);
      syncCustomColorOptions();
      shieldPickers[id] = createNativeSelectPicker(
        select,
        select.getAttribute("aria-label"),
        {
          colorForValue: (color) => lib.colors[color] || (isCustomColorValue(color) ? color : null),
          customColors: { add: addCustomColor, remove: removeCustomColor },
        }
      );
    }

    // Square choice buttons stand in for hidden selects and checkboxes.
    document
      .querySelectorAll('[data-property="sdShield"] .sdShieldSquareButton')
      .forEach((button) => {
        button.addEventListener("click", () => {
          const select = document.getElementById(button.dataset.shieldSelectTarget);
          const checkbox = document.getElementById(button.dataset.shieldCheckboxTarget);
          if (select) {
            select.value = button.dataset.shieldSelectValue;
            select.dispatchEvent(new Event("change", { bubbles: true }));
          } else if (checkbox) {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event("change", { bubbles: true }));
          }
          syncShieldChoiceButtons();
        });
      });

    const shieldSizeSlider = document.getElementById("sdShield_shieldSizeSlider");
    const shieldSizeInput = document.getElementById("sdShield_shieldSize");
    shieldSizeSlider.addEventListener("input", () => {
      shieldSizeInput.value = shieldSizeSlider.value;
      shieldSizeInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    shieldSizeInput.addEventListener("input", () => {
      shieldSizeSlider.value = shieldSizeInput.value;
    });

    for (const id of [
      "sdShield_bannerCustomText",
      "sdShield_bannerCustomText2",
      "sdShield_bannerFontSize1Display",
      "sdShield_bannerFontSize2Display",
      "sdShield_roadNameFontSizeDisplay",
    ]) {
      bindPreviewField(document.getElementById(id));
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

    const bottomArrowRotationSlider = document.getElementById(
      "bottomArrowRotation"
    );
    const bottomArrowRotationValue = document.getElementById(
      "bottomArrowRotationVal"
    );
    if (bottomArrowRotationSlider && bottomArrowRotationValue) {
      bottomArrowRotationSlider.addEventListener("input", () => {
        bottomArrowRotationValue.value = bottomArrowRotationSlider.value;
      });
      bottomArrowRotationSlider.addEventListener("input", readForm);
      bottomArrowRotationSlider.addEventListener("change", readForm);
    }

    const bottomArrowRotationButtons = document.querySelectorAll(
      ".bottomArrowRotationPreset"
    );
    for (const button of bottomArrowRotationButtons) {
      button.addEventListener("click", () => {
        const degrees = parseFloat(button.dataset.degrees || "0") || 0;
        syncBottomArrowRotationControls(degrees);
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
        // While typing into a slider's number box, wait for a value inside
        // the slider's range ("1" on the way to "150" would snap to the
        // minimum and redraw the sign at that size).
        const pairedRange = valEl.id?.endsWith("Val") &&
          document.getElementById(valEl.id.slice(0, -3));
        if (e.type === "input" && pairedRange?.type === "range") {
          const value = Number(valEl.value);
          if (valEl.value === "" || value < Number(pairedRange.min) || value > Number(pairedRange.max)) return;
        }
        applyLiveEdit(e, () => {
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
        });
      };
      valEl.addEventListener("input", onChange);
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
      });

    window.addEventListener("resize", scheduleMobileLayoutUpdate);
    window.addEventListener("orientationchange", scheduleMobileLayoutUpdate);
    if (mobileMediaQuery) {
      if (typeof mobileMediaQuery.addEventListener === "function") {
        mobileMediaQuery.addEventListener("change", scheduleMobileLayoutUpdate);
      } else if (typeof mobileMediaQuery.addListener === "function") {
        mobileMediaQuery.addListener(scheduleMobileLayoutUpdate);
      }
    }
    scheduleMobileLayoutUpdate();
  };


  // v2.19 Icon editor: size and padding sliders paired with number fields,
  // reset buttons, alignment buttons and a preview of the chosen icon.
  const syncSdIconControlPair = (controlId, valueId, value) => {
    document.getElementById(controlId).value = String(value);
    document.getElementById(valueId).value = String(value);
  };

  const updateSdIconExtraControls = (iconElement) => {
    const number = (value, fallback) => Number.isFinite(parseFloat(value)) ? parseFloat(value) : fallback;
    syncSdIconControlPair("sdIcon_iconSizeSlider", "sdIcon_iconSize", number(iconElement.iconSize, 3));
    syncSdIconControlPair("sdIcon_paddingHorizontal", "sdIcon_paddingHorizontalVal", number(iconElement.paddingHorizontal, 0));
    syncSdIconControlPair("sdIcon_paddingVertical", "sdIcon_paddingVerticalVal", number(iconElement.paddingVertical, 0));
    const definition = IconElement.prototype.icons[iconElement.icon] ||
      IconElement.prototype.icons[IconElement.prototype.defaultIcon];
    const preview = document.getElementById("sdIcon_previewImage");
    if (preview.getAttribute("src") !== definition?.src) preview.src = definition?.src || "";
    preview.alt = definition?.label || "";
    preview.classList.toggle("sdIconPreviewInvert", iconElement.invertColor === true);
    const alignment = String(iconElement.alignment || "Center");
    document.querySelectorAll("[data-sd-icon-align]").forEach((button) => {
      const active = button.dataset.sdIconAlign === alignment;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  };

  const setupSdIconEditorControls = () => {
    for (const [sliderId, inputId] of [
      ["sdIcon_iconSizeSlider", "sdIcon_iconSize"],
      ["sdIcon_paddingHorizontal", "sdIcon_paddingHorizontalVal"],
      ["sdIcon_paddingVertical", "sdIcon_paddingVerticalVal"],
    ]) {
      const slider = document.getElementById(sliderId);
      const input = document.getElementById(inputId);
      // The padding sliders are block properties and already read the form.
      slider.addEventListener("input", (event) => {
        input.value = slider.value;
        if (sliderId === "sdIcon_iconSizeSlider") readForm(event);
      });
      input.addEventListener("input", () => {
        if (Number.isFinite(parseFloat(input.value))) slider.value = input.value;
      });
    }
    for (const [buttonId, values] of [
      ["sdIcon_sizeReset", { sdIcon_iconSizeSlider: 3, sdIcon_iconSize: 3 }],
      ["sdIcon_paddingHorizontalReset", { sdIcon_paddingHorizontal: 0, sdIcon_paddingHorizontalVal: 0 }],
      ["sdIcon_paddingVerticalReset", { sdIcon_paddingVertical: 0, sdIcon_paddingVerticalVal: 0 }],
    ]) {
      document.getElementById(buttonId).addEventListener("click", (event) => {
        event.preventDefault();
        Object.entries(values).forEach(([id, value]) => {
          document.getElementById(id).value = String(value);
        });
        readForm();
      });
    }
    document.querySelectorAll("[data-sd-icon-align]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        document.getElementById("sdIcon_alignment").value = button.dataset.sdIconAlign;
        readForm();
      });
    });
  };

  // These labels are fixed markup; looking them up on every refill was slow.
  const dependentLabelCache = new Map();
  // Show/hide dependent small inputs for a given block (e.g. sdCtrlText, sdAdvisory, sdActionMessage, sdIcon)
  const setDependentVisibility = (block) => {
    const el = (id) => document.getElementById(id);

    const toggleTargets = (checkboxId, targetIds) => {
      const chk = el(checkboxId);
      if (!chk) return;
      for (const tid of targetIds) {
        const target = el(tid);
        if (!target) continue;
        target.classList.toggle("hidden", !chk.checked);
        let labels = dependentLabelCache.get(tid);
        if (!labels || labels.some((label) => !label.isConnected)) {
          labels = [...document.querySelectorAll(`label[for="${tid}"]`)];
          dependentLabelCache.set(tid, labels);
        }
        labels.forEach((label) => label.classList.toggle("hidden", !chk.checked));
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
    // small letters -> _smallLettersSize (v2.19)
    toggleTargets(`${block}_smallCapitals`, [`${block}_smallLettersSize`]);
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

  const syncShieldRouteCharacterLimit = (
    shieldBase,
    routeInput = document.getElementById("sdShield_routeNumber")
  ) => {
    if (!routeInput) {
      return;
    }
    const config = ShieldElement.prototype.getBlockShieldConfig(shieldBase);
    const maximumCharacters = Math.trunc(Number(config?.maxRouteCharacters));
    if (maximumCharacters > 0) {
      routeInput.maxLength = maximumCharacters;
      routeInput.value = ShieldElement.prototype.limitRouteCharacters(
        routeInput.value,
        config
      );
    } else {
      routeInput.removeAttribute("maxlength");
    }
  };

  // Handle Form
  const applyLiveEdit = (event, update) => {
    const field = event?.type === "input" ? event.target : null;
    if (field && (event.isComposing || field.type === "number"
      && (field.value === "" || !Number.isFinite(field.valueAsNumber) || !field.validity.valid))) return;
    const value = field?.value;
    const wasFocused = field && document.activeElement === field;
    const selection = field && typeof field.selectionStart === "number"
      ? [field.selectionStart, field.selectionEnd, field.selectionDirection] : null;
    update();
    if (!field) return;
    // updateForm rebuilds some editors. Keep the active draft and caret in its replacement.
    const current = field.id ? document.getElementById(field.id) : field;
    if (!current?.isConnected) return;
    if (current.value !== value) current.value = value;
    if (wasFocused) current.focus({ preventScroll: true });
    if (selection) current.setSelectionRange(...selection);
  };
  const bindPreviewField = (field) => {
    const event = field.tagName === "SELECT" || ["checkbox", "radio"].includes(field.type)
      ? "change" : "input";
    field.addEventListener(event, readForm);
  };
  // While a slider is dragged, each step only redraws the sign; the rest of
  // the form refreshes once when it is released. Refreshing the whole form on
  // every step made sliders lag. The flag covers every handler of one input
  // event (capture to bubble), whichever way it reaches readForm.
  // Typing in a text or number field works the same way: the form refreshes
  // when the field is committed (change), not on every keystroke.
  // Committing any field (a typed value, a checkbox, a radio or a dropdown)
  // redraws the sign at once and refreshes the rest of the form after the
  // next paint, so the click or key press itself stays within a frame.
  const deferredRefreshTypes = new Set(["range", "text", "number", "search", "checkbox", "radio"]);
  const defersFormRefresh = (target) =>
    deferredRefreshTypes.has(target?.type) || target?.tagName === "TEXTAREA" ||
    target?.tagName === "SELECT";
  let rangeInputActive = false;
  // A slider's number box or label used to follow it through the form
  // refresh; now that the refresh waits, update it here unless the slider's
  // own handler already did.
  const sliderDisplays = (slider) => [
    document.getElementById(slider.id + "Val"),
    document.getElementById(slider.id + "Value"),
    ...document.querySelectorAll(`output[for="${slider.id}"]`),
  ].filter((display, index, all) => display && all.indexOf(display) === index);
  let sliderDisplaysBefore = null;
  document.addEventListener("input", (event) => {
    rangeInputActive = defersFormRefresh(event.target);
    sliderDisplaysBefore = event.target?.type === "range" && event.target.id
      ? sliderDisplays(event.target).map((display) => [display, display.value ?? display.textContent])
      : null;
  }, true);
  window.addEventListener("input", (event) => {
    rangeInputActive = false;
    for (const [display, before] of sliderDisplaysBefore || []) {
      if ((display.value ?? display.textContent) !== before || display === document.activeElement) continue;
      if (display.tagName === "INPUT" || display.tagName === "OUTPUT") display.value = event.target.value;
      else display.textContent = event.target.value;
    }
    sliderDisplaysBefore = null;
  });
  // The refresh runs after the next paint, so committing a field (often by
  // clicking something else) doesn't hold up that click.
  let committedFieldRefresh = 0;
  document.addEventListener("change", (event) => {
    if (!defersFormRefresh(event.target)) return;
    rangeInputActive = true;
    // A change event that doesn't bubble never reaches the window listener.
    setTimeout(() => { rangeInputActive = false; }, 0);
    if (committedFieldRefresh) return;
    committedFieldRefresh = requestAnimationFrame(() => setTimeout(() => {
      committedFieldRefresh = 0;
      // Leave the field being typed into (if any) as the person left it.
      const active = document.activeElement;
      const draft = active?.matches?.("input, textarea") ? active.value : null;
      const selection = draft !== null && typeof active.selectionStart === "number"
        ? [active.selectionStart, active.selectionEnd, active.selectionDirection] : null;
      updateForm();
      if (draft !== null && active.isConnected && active.value !== draft) {
        active.value = draft;
        if (selection) active.setSelectionRange(...selection);
      }
    }, 0));
  }, true);
  window.addEventListener("change", () => { rangeInputActive = false; });

  // Read the form and update the page by redrawing it.
  const readForm = function (event) {
    applyLiveEdit(event, commitForm);
  };
  const commitForm = function () {
    const form = document.forms[0];
    const currentPanel = exposed.getCurrentPanel();
    const subPanel =
      exposed.vars.currentlySelectedSubPanelIndex != -1
        ? currentPanel.sign.subPanels[
        exposed.vars.currentlySelectedSubPanelIndex
        ]
        : currentPanel.sign;
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
      ((Array.isArray(Post.prototype.colors) &&
        Post.prototype.colors.includes(requestedPostColor)) ||
        isCustomColorValue(requestedPostColor))
    ) {
      post.color = requestedPostColor;
    }
    post.showPost = form["showPost"].checked;
    post.copySignsOnly = form["copySignsOnly"] ? form["copySignsOnly"].checked : true;
    post.signFractions = !!form["signFractions"]?.checked;
    post.signAlignment =
      form["signAlignment"] && typeof post.normalizeSignAlignment === "function"
        ? post.normalizeSignAlignment(form["signAlignment"].value)
        : "Center";
    const copyScaleInput = parseFloat(form["copyScaleValue"]?.value || form["copyScale"]?.value);
    post.copyScale = Number.isFinite(copyScaleInput)
      ? Math.min(8, Math.max(0, copyScaleInput))
      : 8;
    post.secondExitOnly = form["secondExitOnly"].checked;
    setStoredItem(STORAGE_KEYS.postPosition, post.polePosition);
    setStoredItem(STORAGE_KEYS.showPost, String(!!post.showPost));
    setStoredItem(STORAGE_KEYS.copySignsOnly, String(post.copySignsOnly !== false));
    setStoredItem(STORAGE_KEYS.copyScale, String(post.copyScale));
    setStoredItem(STORAGE_KEYS.postColor, post.color);
    setStoredItem(STORAGE_KEYS.signAlignment, post.signAlignment);

    // Panel
    currentPanel.color = form["panelColor"].value;
    currentPanel.corner = normalizePanelCorner(form["panelCorner"].value);
    const panelBorderRadiusInput = parseFloat(form["panelBorderRadius"].value);
    currentPanel.borderRadius = Number.isFinite(panelBorderRadiusInput)
      ? Math.max(0, panelBorderRadiusInput)
      : Panel.prototype.defaultBorderRadius;
    const panelBorderThickness = Panel.getBorderThickness({
      borderThickness: form["panelBorderThickness"].value,
    });
    if (panelBorderThickness !== Panel.getBorderThickness(currentPanel)) {
      Panel.setBorderThickness(currentPanel, panelBorderThickness);
      form["borderThickness"].value = String(panelBorderThickness);
    }
    VmsPanel.setEnabled(currentPanel, !!form["vmsPanel"]?.checked);
    if (currentPanel.isVms) {
      Object.assign(currentPanel, VmsPanel.settings({
        vmsResolution: form["vmsResolution"].value,
        vmsResolutionVersion: 5,
        vmsAntialias: form["vmsAntialias"].checked,
        vmsFrameColor: form["vmsFrameColor"].value,
      }));
    }

    post.disableFlash = form["disableFlash"].checked;
    post.showBlockBoundingBoxes = !!form["showBlockBoundingBoxes"]?.checked;
    post.showAlignmentGuides = !!form["showAlignmentGuides"]?.checked;
    post.alignmentGuideSpacing = post.normalizeAlignmentGuideSpacing(
      form["alignmentGuideSpacing"]?.value
    );
    post.alignmentGuidePhase = post.normalizeAlignmentGuidePhase(
      form["alignmentGuidePhase"]?.value,
      post.alignmentGuideSpacing
    );

    // Exit Tab
    exitTab.number = form["exitNumber"].value;
    const aplEdgeAllowed = syncExitTabWidthOptions(exitTab);
    const requestedExitTabWidth = form["exitTabWidth"].value;
    exitTab.width =
      isAplEdgeExitTabWidth(requestedExitTabWidth) && !aplEdgeAllowed
        ? "Edge"
        : requestedExitTabWidth;
    exitTab.position = form["exitTabPosition"].value;
    exitTab.color = form["exitColor"].value;
    exitTab.variant = form["exitVariant"].value;

    toggleExitTabVariantOptionsVisibility(exitTab.variant);

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
      const iconKey = form["exitIconPickerValue"].value;
      exitTab.icon = IconElement.prototype.icons[iconKey] ? iconKey : getDefaultExitTabIcon();
      exitTab.useTextBasedIcon = false;
    } else {
      exitTab.icon = null;
      exitTab.useTextBasedIcon = false;
      exitTab.tollLogoOnly =
        typeof exitTab.tollLogoOnly === "boolean" ? exitTab.tollLogoOnly : true;
      exitTab.tollLogoSquare = !!exitTab.tollLogoSquare;
    }

    exitTab.fontFamily =
      form["exitTabFontFamily"].value || ExitTab.prototype.defaultFontFamily;
    exitTab.FHWAFont = /^Series\s/i.test(exitTab.fontFamily);
    const characterSpacing = parseFloat(form["exitTabCharacterSpacing"].value);
    exitTab.characterSpacing = Number.isFinite(characterSpacing)
      ? Math.max(-0.15, Math.min(0.25, characterSpacing))
      : 0;
    exitTab.textColor = form["exitTabTextColor"].value || "Panel Color";
    exitTab.showLeft = form["showLeft"].checked;
    exitTab.fullBorder = form["fullBorder"].checked;
    exitTab.squareCorners = form["squareCorners"].checked;
    exitTab.cornerRadius = form["exitTabUsePanelCornerRadius"].checked
      ? "panel"
      : ExitTab.normalizeCornerRadius(form["exitTabCornerRadius"].value);
    exitTab.horizontalPadding = ExitTab.normalizeHorizontalPadding(
      form["exitTabHorizontalPadding"].value
    );
    exitTab.exitTextSizePercent = Math.max(
      25,
      Math.min(100, Number(form["exitTabTextSizePercent"].value) || 67)
    );
    exitTab.exitTextSizePercentVersion = ExitTab.prototype.exitTextSizePercentVersion;
    exitTab.transparent = form["exitTabTransparent"].checked;
    exitTab.bilingual = form["exitTabBilingual"].checked;
    exitTab.bilingualBottomText =
      form["exitTabBilingualBottomText"].value.trim() || "SORTIE";
    syncExitTabStyleControls(exitTab);
    exitTab.attached = form["exitTabAttached"].checked;
    exitTab.topOffset = form["topOffset"].checked;
    exitTab.verticalArrangement = form["verticalArrangement"].checked;
    exitTab.caStyle = form["caStyle"].checked;

    setStoredItem(STORAGE_KEYS.exitTabPosition, exitTab.position);
    setStoredItem(STORAGE_KEYS.exitTabWidth, exitTab.width);
    setStoredItem(STORAGE_KEYS.exitTabFontFamily, exitTab.fontFamily);
    setStoredItem(STORAGE_KEYS.exitTabFullBorder, String(!!exitTab.fullBorder));
    setStoredItem(STORAGE_KEYS.exitTabSquareCorners, String(!!exitTab.squareCorners));
    setStoredItem(
      STORAGE_KEYS.exitTabHorizontalPadding,
      String(exitTab.horizontalPadding)
    );
    setStoredItem(
      STORAGE_KEYS.exitTabCornerRadius,
      String(exitTab.cornerRadius)
    );
    setStoredItem(STORAGE_KEYS.exitTabAttached, String(!!exitTab.attached));
    setStoredItem(STORAGE_KEYS.exitTabTopOffset, String(!!exitTab.topOffset));
    const borderThicknessInput = parseFloat(form["borderThickness"].value);
    exitTab.borderThickness = Number.isFinite(borderThicknessInput)
      ? Math.max(0, borderThicknessInput)
      : ExitTab.prototype.defaultBorderThickness;
    exitTab.minHeight = form["minHeight"].value;
    exitTab.fontSize = form["fontSize"].value;

    // Nested Tab Spacing (always applies to parent exit tab, not nested tabs)
    const parentExitTab = currentPanel.exitTabs[exposed.vars.currentlySelectedExitTabIndex];
    const nestedTabSpacingInput = parseFloat(form["nestedTabSpacing"]?.value);
    if (parentExitTab) {
      parentExitTab.nestedTabSpacing = Number.isFinite(nestedTabSpacingInput)
        ? Math.max(0, nestedTabSpacingInput)
        : 0;
    }
    if (exitTab.profileId) {
      syncLinkedExitTabs(exitTab);
    }

    // Misc Shields
    currentPanel.sign.shieldBacks = form["shieldBacks"].checked;

    // Sign
    currentPanel.sign.padding = savePanelPaddingPreference(
      getPanelPaddingInputString(currentPanel.sign.padding)
    );
    // Global Settings
    currentPanel.sign.globalPositioning = form["globalPosition"].value;

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
        customBannerInput && typeof customBannerInput.value === "string"
          ? customBannerInput.value
          : "";
      if (customBannerText.length > 0) {
        shield.bannerType = customBannerText;
      }
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
        customBannerInput2 && typeof customBannerInput2.value === "string"
          ? customBannerInput2.value
          : "";
      if (customBannerText2.length > 0) {
        shield.bannerType2 = customBannerText2;
      }
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
    const activeBlockElements =
      exposed && typeof exposed.getActiveBlockElements === "function"
        ? exposed.getActiveBlockElements()
        : subPanel.blockElements;
    const blockElemType =
      Control.prototype.blockInternalElements[
      Control.prototype.blockToClassElems.getElem(currentBlockElem)
      ];
    for (const propertyName in currentBlockElem) {
      const elementId = `${blockElemType}_${propertyName}`;
      const element = document.getElementById(elementId);

      if (element) {
        const handleCustomBanner =
          blockElemType === "sdShield" &&
          (propertyName === "bannerType" || propertyName === "bannerType2");
        if (handleCustomBanner) {
          const customInputId =
            propertyName === "bannerType"
              ? "sdShield_bannerCustomText"
              : "sdShield_bannerCustomText2";
          const customInput = document.getElementById(customInputId);
          const customValue =
            customInput && typeof customInput.value === "string"
              ? customInput.value
              : "";
          if (customValue.length > 0) {
            currentBlockElem[propertyName] = customValue;
          } else if (element.tagName === "SELECT") {
            currentBlockElem[propertyName] = element.value;
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
      const shieldConfig = ShieldElement.prototype.getBlockShieldConfig(
        currentBlockElem.shieldBase
      );
      currentBlockElem.routeNumber =
        ShieldElement.prototype.limitRouteCharacters(
          currentBlockElem.routeNumber,
          shieldConfig
        );
      const routeNumberInput = document.getElementById(
        "sdShield_routeNumber"
      );
      syncShieldRouteCharacterLimit(
        currentBlockElem.shieldBase,
        routeNumberInput
      );
      if (routeNumberInput) {
        routeNumberInput.value = currentBlockElem.routeNumber;
      }
      currentBlockElem.shieldSize =
        ShieldElement.prototype.normalizeShieldSize(
          currentBlockElem.shieldSize
        );
      currentBlockElem.scaleBannersWithShield =
        ShieldElement.prototype.normalizeScaleBannersWithShield(
          currentBlockElem.scaleBannersWithShield
        );
      const disableSmallCapsElmt = document.getElementById(
        "sdShield_disableSmallCaps"
      );
      const disableSmallCapsElmt2 = document.getElementById(
        "sdShield_disableSmallCaps2"
      );
      if (disableSmallCapsElmt) {
        currentBlockElem.smallCaps = !disableSmallCapsElmt.checked;
      }
      if (disableSmallCapsElmt2) {
        currentBlockElem.smallCaps2 = !disableSmallCapsElmt2.checked;
      }
      // Whitespace-only text is kept: it holds an empty banner slot open.
      currentBlockElem.bannerType =
        document.getElementById("sdShield_bannerCustomText").value;
      currentBlockElem.bannerType2 =
        document.getElementById("sdShield_bannerCustomText2").value;
      currentBlockElem.bannerFontSize1 = fromShieldFontSizeDisplay(
        document.getElementById("sdShield_bannerFontSize1Display"),
        currentBlockElem.bannerFontSize1
      );
      currentBlockElem.bannerFontSize2 = fromShieldFontSizeDisplay(
        document.getElementById("sdShield_bannerFontSize2Display"),
        currentBlockElem.bannerFontSize2
      );
      currentBlockElem.roadNameFontSize = fromShieldFontSizeDisplay(
        document.getElementById("sdShield_roadNameFontSizeDisplay"),
        currentBlockElem.roadNameFontSize
      );
      currentBlockElem.bannerLetterSpacing =
        ShieldElement.prototype.normalizeBannerLetterSpacing(
          currentBlockElem.bannerLetterSpacing
        );
    }

    if (blockElemType === "sdArrow") {
      currentBlockElem.flip =
        currentBlockElem.flip === true ||
        currentBlockElem.flip === "true" ||
        currentBlockElem.flip === 1 ||
        currentBlockElem.flip === "1" ||
        currentBlockElem.flip === "on";
    }

    activeBlockElements.blockProperties[
      exposed.vars.currentlySelectedRowIndex
    ].topPadding = document.querySelector("#sdBlock_topPadding").value;
    activeBlockElements.blockProperties[
      exposed.vars.currentlySelectedRowIndex
    ].bottomPadding = document.querySelector("#sdBlock_bottomPadding").value;
    activeBlockElements.blockProperties[
      exposed.vars.currentlySelectedRowIndex
    ].backgroundColor = document.querySelector(
      "#sdBlock_backgroundColor"
    ).value;
    activeBlockElements.blockProperties[
      exposed.vars.currentlySelectedRowIndex
    ].borderColor = document.querySelector("#sdBlock_borderColor").value;
    activeBlockElements.blockProperties[
      exposed.vars.currentlySelectedRowIndex
    ].backgroundFullWidth = document.querySelector(
      "#sdBlock_backgroundFullWidth"
    ).checked;
    activeBlockElements.blockProperties[
      exposed.vars.currentlySelectedRowIndex
    ].width = document.querySelector("#sdBlock_width").value;
    activeBlockElements.blockProperties[
      exposed.vars.currentlySelectedRowIndex
    ].stretchLeft = document.querySelector("#sdBlock_stretchLeft").checked;
    activeBlockElements.blockProperties[
      exposed.vars.currentlySelectedRowIndex
    ].stretchCenter = document.querySelector("#sdBlock_stretchCenter").checked;
    activeBlockElements.blockProperties[
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
      if (exposed.vars.currentlySelectedSubPanelIndex > 0) {
        subPanel.hideDivider = !!form["subPanelHideDivider"]?.checked;
      }
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
    currentPanel.sign.guideArrowLanes = form["guideArrowLanes"].value;
    currentPanel.sign.arrowPosition = form["arrowLocations"].value;
    if (guideArrow_result === "Standard Arrow") {
      currentPanel.sign.standardArrowType = standardArrowField("Type").value;
      currentPanel.sign.standardArrowAngle = normalizeStandardAngle(standardArrowField("AngleValue").value);
      currentPanel.sign.standardArrowFlip = standardArrowField("Flip").getAttribute("aria-pressed") === "true";
      currentPanel.sign.standardArrowSize = clampStandardValue(standardArrowField("SizeValue").value, 1, 5, 10, 3);
      currentPanel.sign.standardArrowPadding = clampStandardValue(standardArrowField("PaddingValue").value, 0, 5, 100, 0.2);
      currentPanel.sign.standardArrowSpacing = clampStandardValue(standardArrowField("SpacingValue").value, 0, 25, 100, 8.5);
    }
    if (["Exit Only", "Half Exit Only", "Split Exit Only"].includes(guideArrow_result)) {
      const sign = currentPanel.sign;
      sign.exitOnlyEditorVersion = 2;
      sign.exitArrowType = exitArrowField("Type").value;
      sign.exitArrowAngle = normalizeStandardAngle(exitArrowField("AngleValue").value);
      sign.exitArrowFlip = exitArrowField("Flip").getAttribute("aria-pressed") === "true";
      sign.exitArrowSize = clampStandardValue(exitArrowField("SizeValue").value, 1, 5, 10, 3.5);
      sign.exitArrowPadding = clampStandardValue(exitArrowField("PaddingValue").value, 0, 8, 100, 0.25);
      sign.exitArrowSpacing = clampStandardValue(exitArrowField("SpacingValue").value, 0, 25, 100, 8.5);
      sign.exitTextFont = exitTextField("Font").value || "Series E";
      sign.exitTextSize = clampStandardValue(exitTextField("SizeValue").value, 50, 100, 1, 75);
      sign.exitTextSpacing = normalizeExitTextSpacing(exitTextField("SpacingValue").value);
      sign.exitTextColor = exitTextField("Color").value || "Inherit";
      sign.exitBackgroundColor = document.getElementById("exitBackgroundColor").value || "Yellow";
      sign.exitBorderColor = document.getElementById("exitBorderColor").value || "Inherit";
      sign.exitTopBorder = document.getElementById("exitTopBorder").checked;
      sign.exitColorEdges = document.getElementById("exitColorEdges").checked;
      sign.exitTexasBorder = document.getElementById("exitTexasBorder").checked;
      sign.exitForceSubpanelWidth = document.getElementById("exitForceSubpanelWidth").checked;
      sign.exitArrowAlignment = sign.exitArrowAlignment || "Center";
    }

    const bottomArrowKindField = form["bottomArrowKind"];
    const selectedBottomArrowKind = bottomArrowKindField
      ? bottomArrowKindField.value
      : "None";
    const resolvedBottomArrowKind = ArrowElement.prototype.arrows[
      selectedBottomArrowKind
    ]
      ? selectedBottomArrowKind
      : guideArrow_result !== "None"
        ? ArrowElement.prototype.defaultArrow
        : "None";
    currentPanel.sign.bottomArrowKind = resolvedBottomArrowKind;
    if (bottomArrowKindField) {
      bottomArrowKindField.value = resolvedBottomArrowKind;
    }
    const bottomArrowSelectedLabel = document.getElementById(
      "bottomArrowSelectedLabel"
    );
    if (bottomArrowSelectedLabel) {
      bottomArrowSelectedLabel.textContent =
        "Current: " + getBottomArrowLabel(resolvedBottomArrowKind);
    }
    const bottomArrowRotationField = form["bottomArrowRotation"];
    const parsedBottomArrowRotation = parseFloat(
      bottomArrowRotationField ? bottomArrowRotationField.value : 0
    );
    currentPanel.sign.bottomArrowRotation = Number.isFinite(
      parsedBottomArrowRotation
    )
      ? parsedBottomArrowRotation
      : 0;
    const parsedBottomArrowGap = parseFloat(
      form["bottomArrowGap"] ? form["bottomArrowGap"].value : 0.5
    );
    currentPanel.sign.bottomArrowGap = Number.isFinite(parsedBottomArrowGap)
      ? Math.max(parsedBottomArrowGap, 0)
      : 0.5;
    const parsedBottomArrowSpacing = parseFloat(
      form["bottomArrowSpacing"] ? form["bottomArrowSpacing"].value : 1
    );
    currentPanel.sign.bottomArrowSpacing = Number.isFinite(
      parsedBottomArrowSpacing
    )
      ? Math.max(parsedBottomArrowSpacing, 0)
      : 1;

    var exitOnlyDirection_result = form["exitOnlyDirection"].value;

    for (const exitOnlyDirection_value of Sign.prototype.exitguideArrows) {
      if (exitOnlyDirection_result == exitOnlyDirection_value.split(":")[0]) {
        exitOnlyDirection_result = exitOnlyDirection_value;
        break;
      }
    }

    if (currentPanel.sign.guideArrow == "Half Exit Only") {
      if (form["arrowLocations"].value == "Middle") {
        while (form["arrowLocations"].firstChild) {
          form["arrowLocations"].removeChild(form["arrowLocations"].lastChild);
        }

        for (const arrowPosition of Sign.prototype.arrowPositions) {
          if (arrowPosition != "Middle") {
            lib.appendOption(form["arrowLocations"], arrowPosition, {
              text: arrowPosition,
            });
          }
        }

        form["arrowLocations"].value = "Left";
        currentPanel.sign.arrowPosition = "Left";
      } else {
        currentPanel.sign.arrowPosition = form["arrowLocations"].value;

        if (!form["arrowLocations"].querySelector("option[value=Middle]")) {
          lib.appendOption(form["arrowLocations"], "Middle", {
            text: "Center",
          });
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
          lib.appendOption(form["arrowLocations"], arrowPosition, {
            text: arrowPosition === "Middle" ? "Center" : arrowPosition,
          });
        }
      }
    } else {
      currentPanel.sign.arrowPosition = form["arrowLocations"].value;

      if (!form["arrowLocations"].querySelector("option[value=Middle]")) {
        lib.appendOption(form["arrowLocations"], "Middle", {
          text: "Center",
        });
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
    currentPanel.sign.exitOnlyPadding = form["exitOnlyPadding"].value;
    const exitOnlyArrowHorizontalPaddingInput = parseFloat(
      form["exitOnlyArrowHorizontalPadding"]?.value
    );
    currentPanel.sign.exitOnlyArrowHorizontalPadding = Number.isFinite(
      exitOnlyArrowHorizontalPaddingInput
    )
      ? Math.min(Math.max(exitOnlyArrowHorizontalPaddingInput, 0), 6)
      : 0;
    const halfExitGapInput = parseFloat(document.getElementById("halfExitGap")?.value);
    currentPanel.sign.halfExitGap = Number.isFinite(halfExitGapInput) ? halfExitGapInput : 5;

    currentPanel.sign.otherSymbol = form["otherSymbol"].value;
    currentPanel.sign.oSNum = form["oSNum"].value;

    // Other Symbols Extra
    if (currentPanel.sign.otherSymbol != "None") {
      form["oSNum"].style.display = "block";
    } else {
      form["oSNum"].style.display = "none";
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

    if (
      currentPanel.sign.guideArrow != "Exit Only" &&
      currentPanel.sign.guideArrow != "Split Exit Only" &&
      currentPanel.sign.guideArrow != "Half Exit Only"
    ) {
      exitOnlyDirectionLabel.style.visibility = "hidden";
      showExitOnlyLabel.style.visibility = "hidden";
      exitOnlyDirection.style.visibility = "hidden";
      showExitOnly.style.visibility = "hidden";
      if (hideExitArrowLabel && hideExitArrow) {
        hideExitArrowLabel.style.visibility = "hidden";
        hideExitArrow.style.visibility = "hidden";
      }
      if (exitOnlyLeftTextLabel && exitOnlyLeftTextInput) {
        exitOnlyLeftTextLabel.style.visibility = "hidden";
        exitOnlyLeftTextInput.style.visibility = "hidden";
      }
      if (exitOnlyRightTextLabel && exitOnlyRightTextInput) {
        exitOnlyRightTextLabel.style.visibility = "hidden";
        exitOnlyRightTextInput.style.visibility = "hidden";
      }
      if (exitOnlyBorderModeLabel && exitOnlyBorderModeSelect) {
        exitOnlyBorderModeLabel.style.visibility = "hidden";
        exitOnlyBorderModeSelect.style.visibility = "hidden";
      }
    } else {
      exitOnlyDirectionLabel.style.visibility = "visible";
      showExitOnlyLabel.style.visibility = "visible";
      exitOnlyDirection.style.visibility = "visible";
      showExitOnly.style.visibility = "visible";
      if (hideExitArrowLabel && hideExitArrow) {
        hideExitArrowLabel.style.visibility = "visible";
        hideExitArrow.style.visibility = "visible";
      }
      if (exitOnlyLeftTextLabel && exitOnlyLeftTextInput) {
        exitOnlyLeftTextLabel.style.visibility = "visible";
        exitOnlyLeftTextInput.style.visibility = "visible";
      }
      if (exitOnlyRightTextLabel && exitOnlyRightTextInput) {
        exitOnlyRightTextLabel.style.visibility = "visible";
        exitOnlyRightTextInput.style.visibility = "visible";
      }
      if (exitOnlyBorderModeLabel && exitOnlyBorderModeSelect) {
        const shouldShowBorderMode =
          !post.secondExitOnly &&
          (currentPanel.sign.guideArrow == "Half Exit Only" ||
            currentPanel.sign.guideArrow == "Exit Only");
        exitOnlyBorderModeLabel.style.visibility = shouldShowBorderMode
          ? "visible"
          : "hidden";
        exitOnlyBorderModeSelect.style.visibility = shouldShowBorderMode
          ? "visible"
          : "hidden";
      }
    }

    writePanelPaddingInputs(currentPanel.sign.padding);

    if (!rangeInputActive) updateForm();
    exposed.redraw();
    scheduleMobileLayoutUpdate();
  };

  const setPanelCorner = (corner) => {
    const normalizedCorner = savePanelCornerPreference(corner);
    const panelCornerSelect = document.getElementById("panelCorner");
    if (panelCornerSelect) {
      panelCornerSelect.value = normalizedCorner;
    }
    readForm();
  };

  // v2.19 icon picker: uploaded icons are stored as data URIs (localStorage
  // plus an IndexedDB copy, under v2.19's keys) and registered as icons.
  const CUSTOM_ICON_VALUE_PREFIX = "CUSTOMICON-";
  const CUSTOM_ICONS_KEY = "signMaker.customIconPicker.icons.v1";
  const ICON_PICKER_PREFERENCES_KEY = "signMaker.iconPicker.preferences.v1";
  const FORM_PERSISTENCE_DB_NAME = "signMaker.formPersistence.v1";
  const FORM_PERSISTENCE_DB_STORE = "keyValue";
  let formPersistenceDbPromise = null;
  let customIconRecords = [];
  let iconPickerController = null;

  const openFormPersistenceDB = () => {
    if (!formPersistenceDbPromise) {
      formPersistenceDbPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) {
          reject(new Error("IndexedDB is not available."));
          return;
        }
        const request = window.indexedDB.open(FORM_PERSISTENCE_DB_NAME, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(FORM_PERSISTENCE_DB_STORE)) {
            request.result.createObjectStore(FORM_PERSISTENCE_DB_STORE, { keyPath: "key" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("Form persistence database open was blocked."));
      });
      formPersistenceDbPromise.catch(() => {
        formPersistenceDbPromise = null;
      });
    }
    return formPersistenceDbPromise;
  };

  const runFormPersistenceRequest = async (mode, action) => {
    const db = await openFormPersistenceDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(FORM_PERSISTENCE_DB_STORE, mode);
      const request = action(transaction.objectStore(FORM_PERSISTENCE_DB_STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
    });
  };

  const getPersistentFormValue = async (key) =>
    (await runFormPersistenceRequest("readonly", (store) => store.get(key)))?.value ?? null;

  const setPersistentFormValue = (key, value) =>
    runFormPersistenceRequest("readwrite", (store) =>
      store.put({ key, value, dateModified: new Date().toISOString() }));

  const persistFormValue = (key, value) => {
    setStoredItem(key, value);
    setPersistentFormValue(key, value).catch((error) => {
      console.warn("Unable to save to IndexedDB", error);
    });
  };

  const parseStoredRecordArray = (raw) => {
    try {
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  };

  const normalizeCustomIconRecord = (record = {}, index = 0) => {
    const id = String(record.id || "cicon_" + Date.now().toString(36) + "_" +
      Math.random().toString(36).slice(2, 8));
    const label = String(record.label || record.name || "")
      .replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    const now = new Date().toISOString();
    return {
      id,
      value: CUSTOM_ICON_VALUE_PREFIX + id.replace(/[^a-zA-Z0-9_-]/g, ""),
      label: label || `Custom Icon ${index + 1}`,
      src: String(record.src || record.data || "").trim(),
      dateCreated: record.dateCreated || now,
      dateModified: record.dateModified || record.dateCreated || now,
    };
  };

  const syncCustomIconRegistry = () => {
    const icons = IconElement.prototype.icons;
    for (const key of Object.keys(icons)) {
      if (icons[key].customIconPicker) delete icons[key];
    }
    customIconRecords.forEach((record, index) => {
      icons[record.value] = {
        label: record.label,
        src: record.src,
        customIconPicker: true,
        customIconId: record.id,
        customIconOrder: index,
        dateCreated: record.dateCreated,
      };
    });
    iconPickerController?.applyLabels();
  };

  const loadCustomIconRecords = async () => {
    let records = parseStoredRecordArray(getStoredItem(CUSTOM_ICONS_KEY));
    try {
      const indexedRecords = parseStoredRecordArray(await getPersistentFormValue(CUSTOM_ICONS_KEY));
      if (indexedRecords.length || !records.length) records = indexedRecords;
    } catch (error) {
      // localStorage copy is enough when IndexedDB is unavailable.
    }
    customIconRecords = records.map(normalizeCustomIconRecord).filter((record) => record.src);
    syncCustomIconRegistry();
    return customIconRecords;
  };

  const saveCustomIconRecords = () =>
    persistFormValue(CUSTOM_ICONS_KEY, JSON.stringify(customIconRecords));

  const upsertCustomIconRecord = (record) => {
    const normalized = normalizeCustomIconRecord(record, customIconRecords.length);
    if (!normalized.src) return null;
    const index = customIconRecords.findIndex((existing) => existing.id === normalized.id);
    if (index >= 0) {
      normalized.dateCreated = customIconRecords[index].dateCreated;
      customIconRecords[index] = normalized;
    } else {
      customIconRecords.push(normalized);
    }
    saveCustomIconRecords();
    syncCustomIconRegistry();
    return normalized;
  };

  // Signs that used a deleted icon fall back to the default icon.
  const revertCustomIconUsage = (key) => {
    const fallback = IconElement.prototype.defaultIcon;
    const revertControl = (control) => {
      for (const row of control?.rows || []) {
        for (const element of Array.isArray(row) ? row : []) {
          if (element instanceof IconElement && element.icon === key) element.icon = fallback;
        }
      }
    };
    for (const panel of exposed.getPost().panels) {
      for (const tab of panel.exitTabs || []) {
        for (const item of [tab, ...(tab.nestedExitTabs || [])]) {
          if (item.icon === key) item.icon = fallback;
        }
      }
      revertControl(panel.sign?.blockElements);
      for (const subPanel of panel.sign?.subPanels || []) {
        revertControl(subPanel.blockElements);
      }
    }
  };

  const getDefaultExitTabIcon = () =>
    IconElement.prototype.icons.AIRPORT ? "AIRPORT" : IconElement.prototype.defaultIcon;

  const getIconPickerController = () => {
    if (!iconPickerController) {
      iconPickerController = new IconPickerController({
        icons: IconElement.prototype.icons,
        loadPreferences: async () => {
          const stored = getStoredItem(ICON_PICKER_PREFERENCES_KEY) ||
            await getPersistentFormValue(ICON_PICKER_PREFERENCES_KEY).catch(() => null);
          return stored ? JSON.parse(stored) : null;
        },
        savePreferences: (preferences) =>
          persistFormValue(ICON_PICKER_PREFERENCES_KEY, JSON.stringify(preferences)),
        uploadIcon: upsertCustomIconRecord,
        onLabelsChanged: () => syncAssetPickerLabels(),
        deleteIcon: (definition, key) => {
          const before = customIconRecords.length;
          customIconRecords = customIconRecords.filter((record) => record.id !== definition.customIconId);
          if (customIconRecords.length === before) return false;
          saveCustomIconRecords();
          syncCustomIconRegistry();
          for (const inputId of ["sdIcon_icon", "exitIconPickerValue"]) {
            const input = document.getElementById(inputId);
            if (input.value === key) input.value = IconElement.prototype.defaultIcon;
          }
          revertCustomIconUsage(key);
          updateForm();
          exposed.redraw();
          return true;
        },
      });
    }
    return iconPickerController;
  };

  // v2.19 asset selector dialogs for the toll logo, arrow and guide arrow
  // pickers; the icon picker uses IconPickerController.
  const ASSET_PICKERS = [
    {
      buttonId: "sdIcon_chooseBtn", modalId: "iconSelectorModal",
      inputId: "sdIcon_icon", labelId: "sdIcon_selectedLabel",
      getAssets: () => IconElement.prototype.icons,
      defaultKey: () => IconElement.prototype.defaultIcon,
    },
    {
      buttonId: "sdTollLogo_chooseBtn", modalId: "tollLogoSelectorModal",
      inputId: "sdTollLogo_logo", labelId: "sdTollLogo_selectedLabel",
      getAssets: () => TollLogoElement.prototype.logos,
      defaultKey: () => TollLogoElement.prototype.defaultLogo,
      cardClass: "tollLogoGridCard",
    },
    {
      buttonId: "sdArrow_chooseBtn", modalId: "arrowSelectorModal",
      inputId: "sdArrow_arrow", labelId: "sdArrow_selectedLabel",
      getAssets: () => ArrowElement.prototype.arrows,
      defaultKey: () => ArrowElement.prototype.defaultArrow,
      cardClass: "arrowGridCard",
    },
    {
      buttonId: "exitIconChooseButton", modalId: "iconSelectorModal",
      inputId: "exitIconPickerValue", labelId: "exitIconCurrent", labelPrefix: "",
      getAssets: () => IconElement.prototype.icons,
      defaultKey: getDefaultExitTabIcon,
    },
    {
      buttonId: "exitTollLogoChooseButton", modalId: "tollLogoSelectorModal",
      inputId: "exitTollLogoSelect", labelId: "exitTollLogoCurrent", labelPrefix: "",
      getAssets: () => TollLogoElement.prototype.logos,
      defaultKey: () => TollLogoElement.prototype.defaultLogo,
      cardClass: "tollLogoGridCard",
    },
    {
      buttonId: "bottomArrowChooseBtn", modalId: "bottomArrowSelectorModal",
      inputId: "bottomArrowKind", labelId: "bottomArrowSelectedLabel",
      getAssets: () => ArrowElement.prototype.arrows,
      getKeys: () => ArrowElement.prototype.arrowKeys,
      defaultKey: () => null,
      cardClass: "arrowGridCard",
    },
  ];

  const syncAssetPickerLabels = () => {
    for (const picker of ASSET_PICKERS) {
      const input = document.getElementById(picker.inputId);
      const label = document.getElementById(picker.labelId);
      const definition = input && picker.getAssets()[input.value || picker.defaultKey()];
      if (label && definition) label.textContent = (picker.labelPrefix ?? "Current: ") + definition.label;
    }
  };

  const openAssetSelector = (picker) => {
    const modal = document.getElementById(picker.modalId);
    const search = modal.querySelector(".assetSelectorSearch");
    const grid = modal.querySelector(".assetPickerGrid");
    const input = document.getElementById(picker.inputId);
    const render = () => {
      const filter = search.value.trim().toLowerCase();
      const assets = picker.getAssets();
      const keys = (picker.getKeys?.() || Object.keys(assets)).filter((key) => {
        const label = String(assets[key]?.label || key).toLowerCase();
        return !filter || label.includes(filter) || key.toLowerCase().includes(filter);
      });
      grid.replaceChildren(...keys.map((key) => {
        const definition = assets[key];
        const card = document.createElement("button");
        card.type = "button";
        card.className = "assetGridCard " + picker.cardClass;
        card.title = definition.label || key;
        card.dataset.assetKey = key;
        card.classList.toggle("selected", key === input.value);
        const preview = document.createElement("span");
        preview.className = "assetGridPreview";
        const img = document.createElement("img");
        img.src = definition.src;
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        img.draggable = false;
        preview.appendChild(img);
        const text = document.createElement("span");
        text.className = "assetGridLabel";
        text.textContent = definition.label || key;
        card.append(preview, text);
        card.addEventListener("click", () => {
          input.value = key;
          syncAssetPickerLabels();
          readForm();
          modal.close();
        });
        return card;
      }));
      if (!keys.length) {
        const empty = document.createElement("div");
        empty.className = "assetGridEmpty";
        empty.textContent = "No matches";
        grid.appendChild(empty);
      }
    };
    search.value = "";
    search.oninput = render;
    render();
    modal.showModal();
    search.focus();
  };

  let assetPickersBound = false;
  const bindAssetPickers = () => {
    if (assetPickersBound) return;
    assetPickersBound = true;
    for (const picker of ASSET_PICKERS) {
      const button = document.getElementById(picker.buttonId);
      const modal = document.getElementById(picker.modalId);
      if (!button || !modal) continue;
      if (picker.modalId === "iconSelectorModal") {
        getIconPickerController().bindTarget(button, {
          getCurrentKey: () => document.getElementById(picker.inputId).value,
          onSelect: (key) => {
            document.getElementById(picker.inputId).value = key;
            syncAssetPickerLabels();
            readForm();
          },
        });
        continue;
      }
      button.addEventListener("click", (event) => {
        event.preventDefault();
        openAssetSelector(picker);
      });
      if (modal.dataset.assetSelectorBound) continue;
      modal.dataset.assetSelectorBound = "true";
      modal.querySelector(".assetSelectorClose").addEventListener("click", () => modal.close());
      modal.addEventListener("click", (event) => {
        if (event.target === modal) modal.close();
      });
    }
    document.getElementById("bottomArrowClearBtn")?.addEventListener("click", () => {
      clearBottomArrowKind();
      document.getElementById("guideArrow").value = "None";
      readForm();
    });
  };

  /**
   * Update the fields in the form to the values of the currently selected panel.
   */
  // v2.19 custom colors: any color picked from a color dropdown's "Custom…"
  // row is remembered (in v2.19's storage key) and offered in every color
  // dropdown, along with any custom color the loaded sign already uses.
  const CUSTOM_COLORS_KEY = "signMaker.customColors.v1";
  const colorSelects = new Set();
  let customColorScanPost = null;
  const isPaletteColor = (value) =>
    Object.prototype.hasOwnProperty.call(lib.colors, value);
  const isCustomColorValue = (value) =>
    !!value && !isPaletteColor(value) && CSS.supports("color", value);
  const getCustomColors = () => {
    try {
      const parsed = JSON.parse(getStoredItem(CUSTOM_COLORS_KEY) || "[]");
      return Array.isArray(parsed)
        ? parsed.filter((record) => isCustomColorValue(record?.value))
        : [];
    } catch (error) {
      return [];
    }
  };
  const syncCustomColorOptions = (usedValues = []) => {
    const values = [...getCustomColors().map((record) => record.value), ...usedValues]
      .map((value) => value.toLowerCase());
    for (const select of colorSelects) {
      if (!select.isConnected) {
        colorSelects.delete(select);
        continue;
      }
      for (const option of select.querySelectorAll("option[data-custom-color]")) {
        if (!values.includes(option.value) && !option.selected) option.remove();
      }
      for (const value of new Set(values)) {
        if (!select.querySelector(`option[value="${value}"]`)) {
          lib.appendOption(select, value, { text: value });
          select.lastElementChild.dataset.customColor = "true";
        }
      }
    }
  };
  const addCustomColor = (value) => {
    const colors = getCustomColors();
    if (isCustomColorValue(value) &&
        !colors.some((record) => record.value.toLowerCase() === value.toLowerCase())) {
      colors.push({
        id: `color_${Date.now().toString(36)}`,
        value: value.toLowerCase(),
        name: value.toLowerCase(),
        createdAt: new Date().toISOString(),
        order: colors.length,
      });
      setStoredItem(CUSTOM_COLORS_KEY, JSON.stringify(colors));
    }
    syncCustomColorOptions();
  };
  const removeCustomColor = (value) => {
    setStoredItem(CUSTOM_COLORS_KEY, JSON.stringify(
      getCustomColors().filter((record) => record.value.toLowerCase() !== value.toLowerCase())
    ));
    syncCustomColorOptions();
  };
  // Color dropdowns are the selects listing the sign palette.
  // Every dropdown uses the SignalMaker picker, including ones added later
  // (see observeNativeSelects). Color lists get swatches and the Custom… row,
  // and font lists preview each font.
  const convertSelect = (select) => {
    // Selects a stylesheet hides, or marked aria-hidden, already have their
    // own control (e.g. the Icon's alignment buttons).
    if (select.multiple || select.getAttribute("aria-hidden") === "true" ||
        (getComputedStyle(select).display === "none" && !select.hidden &&
          !select.classList.contains("hidden") && select.style.display !== "none")) {
      return;
    }
    const label = select.labels?.[0]?.textContent.replace(/:\s*$/, "").trim() ||
      select.getAttribute("aria-label") || select.title || "Option";
    const values = [...select.options].map((option) => option.value);
    const paletteNames = Object.keys(lib.colors);
    const fonts = new Set(TextElement.prototype.fontFamily);
    let options = {};
    if (values.filter((value) => paletteNames.includes(value)).length >= 3) {
      options = {
        colorForValue: (value) => lib.colors[value] || (isCustomColorValue(value) ? value : null),
        minMenuWidth: 200,
      };
      if (select.dataset.customColors !== "off") {
        options.customColors = { add: addCustomColor, remove: removeCustomColor };
        colorSelects.add(select);
      }
    } else if (values.filter((value) => fonts.has(value)).length >= 5) {
      options.textStyleForValue = (value) => {
        let font = value;
        try {
          font = resolveTextFontFamilyForRender(value, { backgroundColor: "White" }, null) || value;
        } catch (error) {
          // Unknown fonts preview in the fallback face.
        }
        return { fontFamily: `"${font}", "Series EM", sans-serif` };
      };
    }
    const picker = createNativeSelectPicker(select, label, options);
    // The block chips' type menu sits over the chip's ▾ and must not select
    // or drag the chip.
    if (select.classList.contains("blockTypeInlineSelect")) {
      picker.wrapper.classList.add("blockTypeInlinePicker");
      for (const type of ["pointerdown", "mousedown", "click", "dragstart"]) {
        picker.wrapper.addEventListener(type, (event) => {
          if (type === "dragstart") event.preventDefault();
          event.stopPropagation();
        });
      }
    }
    if (options.customColors) syncCustomColorOptions();
  };

  // Pickers mirror their selects, so resync them after the form is filled in.
  const updateForm = function () {
    const currentPost = exposed?.getPost?.();
    if (currentPost && currentPost !== customColorScanPost && colorSelects.size) {
      customColorScanPost = currentPost;
      // Sign color fields only; the VMS frame color has its own input.
      syncCustomColorOptions(
        [...JSON.stringify(currentPost).matchAll(
          /"(?!vms)[A-Za-z]*[Cc]olor\d*":"(#[0-9a-f]{3}(?:[0-9a-f]{3})?)"/gi
        )].map((match) => match[1])
      );
    }
    fillForm();
    window.nativeSelectPickers.forEach((picker) => picker.sync());
  };

  let headerFooterControls = null;
  let headerFooterTarget = null;
  const fillForm = function () {
    if (exposed && typeof exposed.getPost === "function") {
      post = exposed.getPost();
    }
    if (!post || !Array.isArray(post.panels) || post.panels.length === 0) {
      return;
    }

    bindAssetPickers();
    syncAssetPickerLabels();

    const panel = exposed.getCurrentPanel();
    const sign =
      exposed.vars.currentlySelectedSubPanelIndex != -1
        ? panel.sign.subPanels[exposed.vars.currentlySelectedSubPanelIndex]
        : panel.sign;

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
    // A refresh ends any list drag. Each cleanup searches the whole page, so
    // it only runs while a drag is in progress.
    if (exitTabDragState) {
      toggleExitTabWiggle(false);
      clearExitTabDropIndicators();
      exitTabDragState = null;
    }
    if (subPanelDragState) endSubPanelDrag();
    if (panelDragState) endPanelDrag();

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

    if (subPanelList && !subPanelList.dataset.subPanelDragAttached) {
      subPanelList.addEventListener("dragover", handleSubPanelDragOver);
      subPanelList.addEventListener("drop", handleSubPanelDrop);
      subPanelList.addEventListener("dragleave", handleSubPanelDragLeave);
      subPanelList.dataset.subPanelDragAttached = "true";
    }

    const postPositionSelectElmt = document.getElementById("postPosition");
    if (postPositionSelectElmt && post.polePosition) {
      postPositionSelectElmt.value = post.polePosition;
    }

    const postColorSelectElmt = document.getElementById("postColor");
    if (postColorSelectElmt && post.color) {
      postColorSelectElmt.value = post.color;
    }

    const signAlignmentSelectElmt = document.getElementById("signAlignment");
    const resolvedSignAlignment =
      post && typeof post.normalizeSignAlignment === "function"
        ? post.normalizeSignAlignment(post.signAlignment)
        : post?.signAlignment || "Center";
    if (post) {
      post.signAlignment = resolvedSignAlignment;
    }
    if (signAlignmentSelectElmt) {
      signAlignmentSelectElmt.value = resolvedSignAlignment;
    }

    const showPostCheckbox = document.getElementById("showPost");
    if (showPostCheckbox) {
      showPostCheckbox.checked = !!post.showPost;
    }

    const copySignsOnlyCheckbox = document.getElementById("copySignsOnly");
    if (copySignsOnlyCheckbox) {
      copySignsOnlyCheckbox.checked = post.copySignsOnly !== false;
    }

    const signFractionsCheckbox = document.getElementById("signFractions");
    if (signFractionsCheckbox) {
      signFractionsCheckbox.checked = post.signFractions === true;
    }

    const copyScaleValue = Number.isFinite(post.copyScale) ? post.copyScale : 8;
    const copyScaleSlider = document.getElementById("copyScale");
    const copyScaleNumber = document.getElementById("copyScaleValue");
    if (copyScaleSlider) {
      copyScaleSlider.value = copyScaleValue;
    }
    if (copyScaleNumber) {
      copyScaleNumber.value = copyScaleValue;
    }

    const secondExitOnlyCheckbox = document.getElementById("secondExitOnly");
    if (secondExitOnlyCheckbox) {
      secondExitOnlyCheckbox.checked = !!post.secondExitOnly;
    }

    const showBlockBoundingBoxesCheckbox = document.getElementById(
      "showBlockBoundingBoxes"
    );
    if (showBlockBoundingBoxesCheckbox) {
      showBlockBoundingBoxesCheckbox.checked = !!post.showBlockBoundingBoxes;
    }

    const showAlignmentGuidesCheckbox = document.getElementById(
      "showAlignmentGuides"
    );
    const alignmentGuideControls = document.getElementById(
      "alignmentGuideControls"
    );
    const alignmentGuideSpacingSlider = document.getElementById(
      "alignmentGuideSpacing"
    );
    const alignmentGuidePhaseSlider = document.getElementById(
      "alignmentGuidePhase"
    );
    const alignmentGuideSpacingValue = document.getElementById(
      "alignmentGuideSpacingValue"
    );
    const alignmentGuidePhaseValue = document.getElementById(
      "alignmentGuidePhaseValue"
    );
    const resolvedAlignmentGuideSpacing = post.normalizeAlignmentGuideSpacing(
      post.alignmentGuideSpacing
    );
    const resolvedAlignmentGuidePhase = post.normalizeAlignmentGuidePhase(
      post.alignmentGuidePhase,
      resolvedAlignmentGuideSpacing
    );
    post.alignmentGuideSpacing = resolvedAlignmentGuideSpacing;
    post.alignmentGuidePhase = resolvedAlignmentGuidePhase;
    if (showAlignmentGuidesCheckbox) {
      showAlignmentGuidesCheckbox.checked = !!post.showAlignmentGuides;
    }
    if (alignmentGuideControls) {
      alignmentGuideControls.classList.toggle(
        "hidden",
        !post.showAlignmentGuides
      );
    }
    if (alignmentGuideSpacingSlider) {
      alignmentGuideSpacingSlider.value = resolvedAlignmentGuideSpacing;
    }
    if (alignmentGuidePhaseSlider) {
      alignmentGuidePhaseSlider.max = resolvedAlignmentGuideSpacing;
      alignmentGuidePhaseSlider.value = resolvedAlignmentGuidePhase;
    }
    if (alignmentGuideSpacingValue) {
      alignmentGuideSpacingValue.value = resolvedAlignmentGuideSpacing;
      alignmentGuideSpacingValue.textContent = resolvedAlignmentGuideSpacing;
    }
    if (alignmentGuidePhaseValue) {
      alignmentGuidePhaseValue.value = resolvedAlignmentGuidePhase;
      alignmentGuidePhaseValue.textContent = resolvedAlignmentGuidePhase;
    }

    while (panelList.firstChild) {
      panelList.removeChild(panelList.lastChild);
    }

    while (subPanelList.firstChild) {
      subPanelList.removeChild(subPanelList.lastChild);

      if (subPanelList.lastChild == document.getElementById("global")) {
        if (exposed.vars.currentlySelectedSubPanelIndex == -1) {
          document.getElementById("global").className = "active";
        } else {
          document.getElementById("global").className = "";
        }

        break;
      }
    }

    while (exitTabList.firstChild) {
      exitTabList.removeChild(exitTabList.lastChild);
    }

    // v2.19 panel rows: stacked panels are labelled 1A, 1B under their main
    // panel, and each row can be duplicated, hidden or deleted.
    const showHiddenPanels =
      document.getElementById("panelListShowHiddenPanels")?.checked !== false;
    const createPanelRowAction = (icon, title, onClick) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "panelListAction";
      button.title = title;
      button.setAttribute("aria-label", title);
      const iconElmt = document.createElement("span");
      iconElmt.className = "material-symbols-outlined";
      iconElmt.textContent = icon;
      button.appendChild(iconElmt);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        onClick();
      });
      return button;
    };
    // Each main panel is followed by its stacked panels in letter order.
    const panelListOrder = post.panels
      .map((panel, index) => index)
      .sort((a, b) => {
        const topA = exposed.getStackedPanelTopIndex(a);
        const topB = exposed.getStackedPanelTopIndex(b);
        return topA - topB ||
          exposed.getPanelDisplayLabel(a).localeCompare(exposed.getPanelDisplayLabel(b));
      });
    for (const panelIndex of panelListOrder) {
      const isHidden = exposed.isPanelHiddenFromPost(panelIndex);
      const isSelected = exposed.vars.currentlySelectedPanelIndex == panelIndex;
      if (isHidden && !showHiddenPanels && !isSelected) {
        continue;
      }
      const isStacked = exposed.isStackedPanelBottom(panelIndex);
      const panelLabel = "Panel " + exposed.getPanelDisplayLabel(panelIndex);
      const row = document.createElement("div");
      row.className = "panelListRow";
      row.classList.toggle("stackedPanelListRow", isStacked);
      row.classList.toggle("hiddenFromPost", isHidden);

      const panelButton = document.createElement("button");
      panelButton.id = "edit" + (panelIndex + 1);
      panelButton.type = "button";
      panelButton.className = "panelListButton" + (isSelected ? " active" : "");
      panelButton.dataset.panelIndex = panelIndex.toString();
      panelButton.draggable = post.panels.length > 1 && !isStacked;

      const label = document.createElement("span");
      label.className = "panelListLabel";
      label.textContent = panelLabel;
      panelButton.appendChild(label);

      panelButton.addEventListener("click", function () {
        exposed.changeEditingPanel(panelIndex);
        panelButton.classList.add("active");
      });
      panelButton.addEventListener("dragstart", handlePanelDragStart);
      panelButton.addEventListener("dragend", handlePanelDragEnd);

      row.append(
        panelButton,
        createPanelRowAction("content_copy", "Duplicate " + panelLabel,
          () => app.duplicatePanel(panelIndex)),
        createPanelRowAction(post.panels[panelIndex].hiddenFromPost ? "visibility_off" : "visibility",
          (post.panels[panelIndex].hiddenFromPost ? "Show " : "Hide ") + panelLabel,
          () => app.togglePanelHidden(panelIndex)),
        createPanelRowAction("delete", "Delete " + panelLabel,
          () => app.deletePanel(panelIndex))
      );
      panelList.appendChild(row);
    }

    renderStackedPanelControls();

    const currentlySelectedPanelLabel = document.getElementById(
      "currentlySelectedPanel"
    );
    if (currentlySelectedPanelLabel) {
      currentlySelectedPanelLabel.textContent =
        "Panel " + exposed.getPanelDisplayLabel(exposed.vars.currentlySelectedPanelIndex);
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

    for (
      let subPanelIndex = 0, subPanelsLength = panel.sign.subPanels.length;
      subPanelIndex < subPanelsLength;
      subPanelIndex++
    ) {
      const subPanelButton = document.createElement("button");
      subPanelButton.id = "sub_edit" + (subPanelIndex + 1);
      subPanelButton.type = "button";
      subPanelButton.textContent = "SubPanel " + (subPanelIndex + 1);
      subPanelButton.className =
        "subPanelButton" +
        (exposed.vars.currentlySelectedSubPanelIndex == subPanelIndex
          ? " active"
          : "");
      subPanelButton.dataset.subPanelIndex = subPanelIndex.toString();
      subPanelButton.draggable = panel.sign.subPanels.length > 1;

      subPanelButton.addEventListener("click", function () {
        exposed.changeEditingSubPanel(subPanelIndex, panel);
        subPanelButton.classList.add("active");
      });
      subPanelButton.addEventListener("dragstart", handleSubPanelDragStart);
      subPanelButton.addEventListener("dragend", handleSubPanelDragEnd);

      subPanelList.appendChild(subPanelButton);
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
    const combineAPLExitOnlyLabels = document.getElementById(
      "combineAPLExitOnlyLabels"
    );
    if (combineAPLExitOnlyLabels) {
      combineAPLExitOnlyLabels.checked =
        panel.sign.combineAPLExitOnlyLabels === true;
    }
    const selectedAPLIndex = exposed.vars.currentlySelectedAPLArrowIndex;
    const APL_ARROW_TYPE_OPTIONS = [
      { value: "UP", label: "Up" },
      { value: "UP_LEFT", label: "Up Left Turn" },
      { value: "UP_RIGHT", label: "Up Right Turn" },
      { value: "DUAL_TURN", label: "Dual Turn" },
      { value: "LEFT_TURN", label: "Left Turn" },
      { value: "RIGHT_TURN", label: "Right Turn" },
      { value: "UP_CFX", label: "CFX Up" },
      { value: "UP_LEFT_CFX", label: "CFX Up Left Turn" },
      { value: "UP_RIGHT_CFX", label: "CFX Up Right Turn" },
      { value: "LEFT_TURN_CFX", label: "CFX Left Turn" },
      { value: "RIGHT_TURN_CFX", label: "CFX Right Turn" },
    ];

    const getAPLArrowKind = (arrow) => {
      if (exposed && typeof exposed.getAPLArrowKind === "function") {
        return exposed.getAPLArrowKind(arrow);
      }
      if (arrow?.type === "APL_UP_TURN") return arrow.flip ? "UP_LEFT" : "UP_RIGHT";
      if (arrow?.type === "APL_DUAL_TURN") return "DUAL_TURN";
      if (arrow?.type === "APL_TURN") return arrow.flip ? "LEFT_TURN" : "RIGHT_TURN";
      if (arrow?.type === "APL_UP_CFX") return "UP_CFX";
      if (arrow?.type === "APL_UP_TURN_CFX") {
        return arrow.flip ? "UP_LEFT_CFX" : "UP_RIGHT_CFX";
      }
      if (arrow?.type === "APL_TURN_CFX") {
        return arrow.flip ? "LEFT_TURN_CFX" : "RIGHT_TURN_CFX";
      }
      return "UP";
    };

    const appendAPLTypeOptions = (select, selectedKind) => {
      for (const option of APL_ARROW_TYPE_OPTIONS) {
        lib.appendOption(select, option.value, {
          selected: option.value === selectedKind,
          text: option.label,
        });
      }
    };

    const createAPLDropZone = ({ placement, subPanelIndex, dividerAfterSubPanelIndex }) => {
      const dropZone = document.createElement("div");
      dropZone.className = "aplArrowDropZone";
      dropZone.textContent = "Drop arrow here";

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
        if (!Number.isFinite(fromIndex) || !exposed || typeof exposed.moveAPLArrow !== "function") {
          return;
        }

        exposed.moveAPLArrow(fromIndex, {
          placement,
          subPanelIndex,
          dividerAfterSubPanelIndex,
        });
      });

      return dropZone;
    };

    const stopAPLControlDrag = (element) => {
      element.addEventListener("dragstart", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      element.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
      });
      element.addEventListener("mousedown", (event) => {
        event.stopPropagation();
      });
    };

    const stopAPLControlEvents = (element) => {
      stopAPLControlDrag(element);
      ["click", "change", "input"].forEach((eventName) => {
        element.addEventListener(eventName, (event) => {
          event.stopPropagation();
        });
      });
    };

    const parseAPLNullableNumber = (value) => {
      const text = String(value ?? "").trim();
      if (!text.length) {
        return null;
      }
      const parsedValue = parseFloat(text);
      return Number.isFinite(parsedValue) ? parsedValue : null;
    };

    const callAPLArrowSetter = (setterName, arrowIndex, value) => {
      if (exposed && typeof exposed[setterName] === "function") {
        exposed[setterName](arrowIndex, value);
      }
    };

    const createAPLSettingsRow = (labelText, controls) => {
      const row = document.createElement("div");
      row.className = "aplExitOnlySettingsRow";

      const label = document.createElement("label");
      label.textContent = labelText;
      row.appendChild(label);

      for (const control of Array.isArray(controls) ? controls : [controls]) {
        row.appendChild(control);
      }

      return row;
    };

    const createAPLNumberSetting = ({
      value,
      placeholder,
      setterName,
      arrowIndex,
      min = null,
      max = null,
      step = "0.1",
    }) => {
      const input = document.createElement("input");
      input.type = "number";
      input.step = step;
      input.placeholder = placeholder;
      input.value = value != null ? String(value) : "";

      if (min != null) {
        input.min = String(min);
      }
      if (max != null) {
        input.max = String(max);
      }

      input.id = `apl-${arrowIndex}-${setterName}`;
      const commit = (event) => applyLiveEdit(event, () => {
        callAPLArrowSetter(
          setterName,
          arrowIndex,
          parseAPLNullableNumber(input.value)
        );
      });
      input.addEventListener("input", commit);
      input.addEventListener("change", commit);
      stopAPLControlEvents(input);

      return input;
    };

    const createAPLTextSetting = ({ value, fallback, setterName, arrowIndex }) => {
      const input = document.createElement("input");
      input.type = "text";
      input.value = value != null ? value : fallback;
      input.id = `apl-${arrowIndex}-${setterName}`;
      input.addEventListener("input", (event) => applyLiveEdit(event, () => {
        callAPLArrowSetter(setterName, arrowIndex, input.value);
      }));
      stopAPLControlEvents(input);

      return input;
    };

    const createAPLHideSetting = ({ checked, setterName, arrowIndex }) => {
      const label = document.createElement("label");
      label.className = "aplExitOnlyHideLabel";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = checked === true;
      checkbox.addEventListener("change", () => {
        callAPLArrowSetter(setterName, arrowIndex, checkbox.checked);
      });
      stopAPLControlEvents(checkbox);

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(" Hide"));
      label.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      stopAPLControlDrag(label);

      return label;
    };

    const createAPLExitOnlySettings = (arrow, arrowIndex) => {
      const settings = document.createElement("div");
      settings.className = "aplExitOnlySettings";

      const settingsTitle = document.createElement("div");
      settingsTitle.className = "aplExitOnlySettingsTitle";
      settingsTitle.textContent = "Exit Only Settings";
      settings.appendChild(settingsTitle);

      const bgSelect = document.createElement("select");
      lib.appendOption(bgSelect, "yellow", {
        selected: arrow.exitOnlyBgColor !== "white",
        text: "Yellow",
      });
      lib.appendOption(bgSelect, "white", {
        selected: arrow.exitOnlyBgColor === "white",
        text: "White",
      });
      bgSelect.addEventListener("change", () => {
        callAPLArrowSetter("setAPLExitOnlyBgColor", arrowIndex, bgSelect.value);
      });
      stopAPLControlEvents(bgSelect);

      const leftTextInput = createAPLTextSetting({
        value: arrow.exitOnlyTextLeft,
        fallback: "EXIT",
        setterName: "setAPLExitOnlyTextLeft",
        arrowIndex,
      });
      const rightTextInput = createAPLTextSetting({
        value: arrow.exitOnlyTextRight,
        fallback: "ONLY",
        setterName: "setAPLExitOnlyTextRight",
        arrowIndex,
      });

      settings.appendChild(
        createAPLSettingsRow(
          "Margin Left",
          createAPLNumberSetting({
            value: arrow.arrowMarginLeft,
            placeholder: "Default",
            setterName: "setAPLArrowMarginLeft",
            arrowIndex,
            min: 0,
          })
        )
      );
      settings.appendChild(
        createAPLSettingsRow(
          "Margin Right",
          createAPLNumberSetting({
            value: arrow.arrowMarginRight,
            placeholder: "Default",
            setterName: "setAPLArrowMarginRight",
            arrowIndex,
            min: 0,
          })
        )
      );
      settings.appendChild(createAPLSettingsRow("Background", bgSelect));
      settings.appendChild(
        createAPLSettingsRow(
          "Padding",
          createAPLNumberSetting({
            value: arrow.exitOnlyPadding,
            placeholder: "Default",
            setterName: "setAPLExitOnlyPadding",
            arrowIndex,
            min: 0,
            step: "0.05",
          })
        )
      );
      const fontSelect = document.createElement("select");
      lib.appendOption(fontSelect, "", { text: "Default", selected: !arrow.exitOnlyFont });
      for (const font of TextElement.prototype.fontFamily) {
        lib.appendOption(fontSelect, font, { selected: arrow.exitOnlyFont === font });
      }
      fontSelect.addEventListener("change", () => {
        callAPLArrowSetter("setAPLExitOnlyFont", arrowIndex, fontSelect.value);
      });
      stopAPLControlEvents(fontSelect);
      settings.appendChild(createAPLSettingsRow("Font", fontSelect));
      settings.appendChild(
        createAPLSettingsRow(
          "Text Size (%)",
          createAPLNumberSetting({
            value: arrow.exitOnlySize,
            placeholder: "100",
            setterName: "setAPLExitOnlySize",
            arrowIndex,
            min: 50,
            max: 150,
            step: "1",
          })
        )
      );
      settings.appendChild(
        createAPLSettingsRow(
          "Letter Spacing",
          createAPLNumberSetting({
            value: arrow.exitOnlyLetterSpacing,
            placeholder: "0",
            setterName: "setAPLExitOnlyLetterSpacing",
            arrowIndex,
            min: -0.15,
            max: 0.5,
            step: "0.01",
          })
        )
      );
      settings.appendChild(
        createAPLSettingsRow(
          "Radius",
          createAPLNumberSetting({
            value: arrow.exitOnlyBorderRadius,
            placeholder: "Default",
            setterName: "setAPLExitOnlyBorderRadius",
            arrowIndex,
            min: 0,
            step: "0.05",
          })
        )
      );
      settings.appendChild(
        createAPLSettingsRow("Left Text", [
          leftTextInput,
          createAPLHideSetting({
            checked: arrow.exitOnlyHideLeft,
            setterName: "setAPLExitOnlyHideLeft",
            arrowIndex,
          }),
        ])
      );
      settings.appendChild(
        createAPLSettingsRow("Right Text", [
          rightTextInput,
          createAPLHideSetting({
            checked: arrow.exitOnlyHideRight,
            setterName: "setAPLExitOnlyHideRight",
            arrowIndex,
          }),
        ])
      );

      return settings;
    };

    const createAPLArrowRow = (arrow, arrowIndex, placement, placementIndex) => {
      const arrowBlock = document.createElement("div");
      arrowBlock.className = "aplArrowEditorBlock";

      const arrowRow = document.createElement("div");
      arrowRow.className =
        "aplArrowListItem" + (arrowIndex === selectedAPLIndex ? " active" : "");
      arrowRow.dataset.aplIndex = String(arrowIndex);

      const dragHandle = document.createElement("button");
      dragHandle.type = "button";
      dragHandle.className = "aplArrowDragHandle";
      dragHandle.textContent = "Move";
      dragHandle.draggable = true;
      dragHandle.addEventListener("dragstart", (event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(arrowIndex));
        arrowRow.classList.add("dragging");
      });
      dragHandle.addEventListener("dragend", () => {
        arrowRow.classList.remove("dragging");
      });

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

        if (!Number.isFinite(fromIndex) || !exposed || typeof exposed.moveAPLArrow !== "function") {
          return;
        }

        if (placement === "divider") {
          exposed.moveAPLArrow(fromIndex, {
            placement: "divider",
            dividerAfterSubPanelIndex:
              placementIndex ?? arrow.dividerAfterSubPanelIndex,
            beforeIndex: arrowIndex,
          });
        } else {
          exposed.moveAPLArrow(fromIndex, {
            placement: "subpanel",
            subPanelIndex: placementIndex ?? arrow.subPanelIndex,
            beforeIndex: arrowIndex,
          });
        }
      });

      const typeSelect = document.createElement("select");
      typeSelect.className = "aplInlineTypeSelect";
      appendAPLTypeOptions(typeSelect, getAPLArrowKind(arrow));
      typeSelect.addEventListener("change", () => {
        if (exposed && typeof exposed.updateAPLArrowType === "function") {
          exposed.updateAPLArrowType(typeSelect.value, arrowIndex);
        }
      });
      stopAPLControlEvents(typeSelect);

      const exitOnlyLabel = document.createElement("label");
      exitOnlyLabel.className = "aplExitOnlyInlineLabel";
      const exitOnlyCheckbox = document.createElement("input");
      exitOnlyCheckbox.type = "checkbox";
      exitOnlyCheckbox.checked = arrow.exitOnly === true;
      exitOnlyCheckbox.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      exitOnlyCheckbox.addEventListener("change", (event) => {
        event.stopPropagation();
        if (exposed && typeof exposed.setAPLExitOnly === "function") {
          exposed.setAPLExitOnly(arrowIndex, exitOnlyCheckbox.checked);
        }
      });
      stopAPLControlEvents(exitOnlyCheckbox);
      exitOnlyLabel.appendChild(exitOnlyCheckbox);
      exitOnlyLabel.appendChild(document.createTextNode(" Exit Only"));
      exitOnlyLabel.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      stopAPLControlDrag(exitOnlyLabel);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "aplArrowDeleteButton";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (exposed && typeof exposed.removeAPLArrowAt === "function") {
          exposed.removeAPLArrowAt(arrowIndex);
        }
      });
      stopAPLControlEvents(deleteButton);

      arrowRow.appendChild(dragHandle);
      arrowRow.appendChild(typeSelect);
      arrowRow.appendChild(exitOnlyLabel);
      arrowRow.appendChild(deleteButton);

      arrowRow.addEventListener("click", () => {
        if (exposed && typeof exposed.selectAPLArrow === "function") {
          exposed.selectAPLArrow(arrowIndex);
        }
      });

      arrowBlock.appendChild(arrowRow);

      if (arrow.exitOnly === true) {
        arrowBlock.appendChild(createAPLExitOnlySettings(arrow, arrowIndex));
      }

      return arrowBlock;
    };

    if (aplArrowList) {
      lib.clearChildren(aplArrowList);

      const selectedSubPanelIndex = exposed.vars.currentlySelectedSubPanelIndex;
      const selectedSubpanelStatus = document.getElementById("aplSelectedSubpanelStatus");
      const aplArrows = panel.sign.aplArrows || [];
      const aplGroups =
        exposed && typeof exposed.getAPLSubpanelGroups === "function"
          ? exposed.getAPLSubpanelGroups()
          : [];

      if (selectedSubpanelStatus) {
        const selectedGroup =
          aplGroups.find((group) => group.indices.includes(selectedSubPanelIndex)) ||
          aplGroups[0];
        selectedSubpanelStatus.textContent =
          "Selected Subpanel: " +
          (selectedGroup ? selectedGroup.label : "Subpanel 1");
      }

      aplGroups.forEach((group, groupIndex) => {
        const subPanelSection = document.createElement("div");
        subPanelSection.className =
          "aplSubpanelSection" +
          (group.indices.includes(selectedSubPanelIndex) ? " selected" : "");

        const sectionHeader = document.createElement("div");
        sectionHeader.className = "aplSubpanelSectionHeader";
        sectionHeader.textContent = group.label;
        sectionHeader.addEventListener("click", () => {
          if (exposed && typeof exposed.changeEditingSubPanel === "function") {
            exposed.changeEditingSubPanel(group.start);
          }
        });
        subPanelSection.appendChild(sectionHeader);

        subPanelSection.appendChild(
          createAPLDropZone({
            placement: "subpanel",
            subPanelIndex: group.start,
          })
        );

        const subpanelArrowIndexes = group.arrowIndexes.filter(
          (arrowIndex) => !aplArrows[arrowIndex]?.groupedWithDivider
        );

        subpanelArrowIndexes.forEach((arrowIndex) => {
          subPanelSection.appendChild(
            createAPLArrowRow(
              aplArrows[arrowIndex],
              arrowIndex,
              "subpanel",
              group.start
            )
          );
        });

        const addToSubpanelButton = document.createElement("button");
        addToSubpanelButton.type = "button";
        addToSubpanelButton.textContent = "Add arrow to " + group.label;
        addToSubpanelButton.addEventListener("click", () => {
          if (exposed && typeof exposed.addAPLArrow === "function") {
            exposed.addAPLArrow(null, {
              placement: "subpanel",
              subPanelIndex: group.start,
            });
          }
        });
        subPanelSection.appendChild(addToSubpanelButton);
        aplArrowList.appendChild(subPanelSection);

        if (groupIndex < aplGroups.length - 1) {
          const dividerSection = document.createElement("div");
          dividerSection.className = "aplDividerSection";

          const dividerHeader = document.createElement("div");
          dividerHeader.className = "aplDividerSectionHeader";
          dividerHeader.textContent = "Divider " + (group.end + 1);
          dividerSection.appendChild(dividerHeader);

          dividerSection.appendChild(
            createAPLDropZone({
              placement: "divider",
              dividerAfterSubPanelIndex: group.end,
            })
          );

          const dividerArrowIndexes = group.arrowIndexes.filter(
            (arrowIndex) => aplArrows[arrowIndex]?.groupedWithDivider
          );

          dividerArrowIndexes.forEach((arrowIndex) => {
            dividerSection.appendChild(
              createAPLArrowRow(
                aplArrows[arrowIndex],
                arrowIndex,
                "divider",
                group.end
              )
            );
          });

          if (dividerArrowIndexes.length === 0) {
            const addDividerArrowButton = document.createElement("button");
            addDividerArrowButton.type = "button";
            addDividerArrowButton.textContent = "Add divider arrow";
            addDividerArrowButton.addEventListener("click", () => {
              if (exposed && typeof exposed.addAPLDividerArrow === "function") {
                exposed.addAPLDividerArrow(group.end);
              }
            });
            dividerSection.appendChild(addDividerArrowButton);
          }

          aplArrowList.appendChild(dividerSection);
        }
      });
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
    panel.corner = normalizePanelCorner(panel.corner);
    if (!hasPanelCornerPreference) {
      savePanelCornerPreference(panel.corner);
    }
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

    const panelBorderThickness = Panel.getBorderThickness(panel);
    document.getElementById("panelBorderThickness").value = String(panelBorderThickness);
    document.getElementById("panelBorderThicknessValue").value =
      `${Math.round(panelBorderThickness / 0.2 * 100)}%`;

    const vmsSettings = VmsPanel.settings(panel);
    document.getElementById("vmsPanelSettings").hidden = panel.isVms !== true;
    document.getElementById("vmsResolution").value = vmsSettings.vmsResolution;
    document.getElementById("vmsAntialias").checked = vmsSettings.vmsAntialias;
    document.getElementById("vmsFrameColor").value = vmsSettings.vmsFrameColor;
    const vmsPanelElmt = document.getElementById("vmsPanel");
    if (vmsPanelElmt) {
      vmsPanelElmt.checked = panel.isVms === true;
    }

    writePanelPaddingInputs(panel.sign.padding);

    // Global Panel
    const outActionMessage = document.getElementById("outActionMessage");
    const outActionMessageLabel = document.getElementById(
      "outActionMessageLabel"
    );
    const globalPositioning = document.getElementById("globalPosition");
    const globalPositionLabel = document.getElementById("globalPositionLabel");
    const g_actionMessage = document.getElementById("g_actionMessage");

    g_actionMessage.className =
      exposed.vars.currentlySelectedSubPanelIndex != -1 ? "invisible" : "";
    outActionMessage.className =
      exposed.vars.currentlySelectedSubPanelIndex != -1 ? "invisible" : "";
    outActionMessageLabel.className =
      exposed.vars.currentlySelectedSubPanelIndex != -1 ? "invisible" : "";
    g_actionMessage.className =
      exposed.vars.currentlySelectedSubPanelIndex != -1 ? "invisible" : "";
    globalPositioning.className =
      exposed.vars.currentlySelectedSubPanelIndex != -1 ? "invisible" : "";
    globalPositionLabel.className =
      exposed.vars.currentlySelectedSubPanelIndex != -1 ? "invisible" : "";

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

    const subPanelHideDivider = document.getElementById("subPanelHideDivider");
    const subPanelHideDividerLabel = document.getElementById("subPanelHideDividerLabel");
    const selectedSubPanel =
      panel.sign.subPanels[exposed.vars.currentlySelectedSubPanelIndex];
    subPanelHideDivider.checked = !!selectedSubPanel?.hideDivider;
    subPanelHideDivider.style.display = subPanelHeight.style.display;
    subPanelHideDividerLabel.style.display = subPanelHeightLabel.style.display;

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
    exitNumberElmt.value = exitTab.number;

    const exitTabPositionSelectElmt =
      document.getElementById("exitTabPosition");
    for (const option of exitTabPositionSelectElmt.options) {
      if (option.value == exitTab.position) {
        option.selected = true;
        break;
      }
    }

    const exitTabWidthSelectElmt = document.getElementById("exitTabWidth");
    syncExitTabWidthOptions(exitTab);
    let exitTabWidthMatched = false;
    for (const option of exitTabWidthSelectElmt.options) {
      if (option.value == exitTab.width) {
        option.selected = true;
        exitTabWidthMatched = true;
        break;
      }
    }
    if (!exitTabWidthMatched) {
      exitTab.width = "Edge";
      exitTabWidthSelectElmt.value = "Edge";
    }
    toggleExitTabAttachedOptionVisibility(exitTab.width);

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

    document.getElementById("exitTollLogoSelect").value =
      TollLogoElement.prototype.logos[exitTab.icon] ? exitTab.icon : TollLogoElement.prototype.defaultLogo;
    document.getElementById("exitIconPickerValue").value =
      IconElement.prototype.icons[exitTab.icon] ? exitTab.icon : getDefaultExitTabIcon();
    syncAssetPickerLabels();

    const tollLogoOnly = document.getElementById("exitTollLogoOnly");
    if (tollLogoOnly) {
      tollLogoOnly.checked =
        exitTab.tollLogoOnly === undefined ? true : exitTab.tollLogoOnly;
    }

    const tollLogoSquare = document.getElementById("exitTollLogoSquare");
    if (tollLogoSquare) {
      tollLogoSquare.checked = !!exitTab.tollLogoSquare;
    }

    document.getElementById("exitTabFontFamily").value =
      exitTab.fontFamily || ExitTab.prototype.defaultFontFamily;
    document.getElementById("exitTabCharacterSpacing").value = String(
      Number(exitTab.characterSpacing) || 0
    );
    document.getElementById("exitTabTextColor").value =
      exitTab.textColor || "Panel Color";
    const usesPanelRadius = exitTab.cornerRadius === "panel";
    document.getElementById("exitTabUsePanelCornerRadius").checked = usesPanelRadius;
    const cornerRadiusValue = usesPanelRadius
      ? Number(panel?.borderRadius ?? Panel.prototype.defaultBorderRadius)
      : ExitTab.normalizeCornerRadius(exitTab.cornerRadius);
    document.getElementById("exitTabCornerRadius").value = String(cornerRadiusValue);
    document.getElementById("exitTabCornerRadiusValue").textContent =
      cornerRadiusValue.toFixed(2);
    const horizontalPadding = ExitTab.normalizeHorizontalPadding(exitTab.horizontalPadding);
    document.getElementById("exitTabHorizontalPadding").value = String(horizontalPadding);
    document.getElementById("exitTabHorizontalPaddingValue").textContent =
      horizontalPadding.toFixed(1);
    const exitTextSize = Number(exitTab.exitTextSizePercent) ||
      ExitTab.prototype.defaultExitTextSizePercent;
    document.getElementById("exitTabTextSizePercent").value = String(exitTextSize);
    document.getElementById("exitTabTextSizePercentValue").textContent = String(exitTextSize);
    document.getElementById("exitTabTransparent").checked = !!exitTab.transparent;
    document.getElementById("exitTabBilingual").checked = !!exitTab.bilingual;
    document.getElementById("exitTabBilingualBottomText").value =
      exitTab.bilingualBottomText || "SORTIE";

    const showLeft = document.getElementById("showLeft");
    showLeft.checked = exitTab.showLeft;

    const fullBorder = document.getElementById("fullBorder");
    fullBorder.checked = exitTab.fullBorder;

    const squareCorners = document.getElementById("squareCorners");
    squareCorners.checked = exitTab.squareCorners;

    syncExitTabStyleControls(exitTab);
    syncExitTabProfileControls(exitTab);

    const exitTabAttached = document.getElementById("exitTabAttached");
    exitTabAttached.checked = !!exitTab.attached;

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
    minHeight.value = exitTab.minHeight;
    document.getElementById("minValue").innerHTML = minHeight.value.toString();

    // Nested Tab Spacing (from parent exit tab)
    const nestedTabSpacingInput = document.getElementById("nestedTabSpacing");
    if (nestedTabSpacingInput) {
      const parentExitTab = panel.exitTabs[selectedExitTabIndex];
      const resolvedSpacing = parentExitTab?.nestedTabSpacing ?? 0;
      nestedTabSpacingInput.value = resolvedSpacing;
    }

    // Shields
    updateShieldSubform();

    // Control Text Revision
    const sMSPTextList = document.querySelector("#sMSPTextList");
    sMSPTextList.innerHTML = "";
    const activeBlockElements =
      exposed && typeof exposed.getActiveBlockElements === "function"
        ? exposed.getActiveBlockElements()
        : sign.blockElements;
    pruneSelectedBlockKeys(activeBlockElements);
    syncGroupSelectionControls();

    const groupPath =
      exposed && typeof exposed.getGroupEditingPath === "function"
        ? exposed.getGroupEditingPath()
        : [];
    const groupPathKey = groupPath
      .map((segment) => `${segment.rowIndex}:${segment.blockIndex}`)
      .join("/");
    if (groupPathKey !== blockSelectionContextKey) {
      blockSelectionContextKey = groupPathKey;
      selectedBlockKeys.clear();
      syncGroupSelectionControls();
    }
    const isEditingGroup = groupPath.length > 0;
    const groupNav = document.getElementById("sMSPGroupNav");
    const groupLabel = document.getElementById("sMSPGroupLabel");
    if (groupNav) {
      groupNav.classList.toggle("hidden", !isEditingGroup);
    }
    if (groupLabel) {
      const activeGroup =
        exposed && typeof exposed.getActiveGroupElement === "function"
          ? exposed.getActiveGroupElement()
          : null;
      groupLabel.textContent = activeGroup?.label
        ? `Editing: ${activeGroup.label}`
        : "Editing Group";
    }

    // START Add Header/Footer Controls
    // Built once and re-attached: rebuilding them (and their dropdown
    // pickers) on every form refresh was a noticeable part of its cost.
    headerFooterTarget = activeBlockElements;
    if (!headerFooterControls) {
      headerFooterControls = document.createElement("div");
      headerFooterControls.style.width = "100%";
      headerFooterControls.style.display = "flex";
      headerFooterControls.style.justifyContent = "center";
      headerFooterControls.style.gap = "10px";
      headerFooterControls.style.paddingBottom = "10px";
      for (const [label, placement] of [["Add Header…", "header"], ["Add Footer…", "footer"]]) {
        const select = document.createElement("select");
        select.setAttribute("aria-label", label);
        lib.appendOption(select, "", { text: label, selected: true });
        select.options[0].disabled = true;
        Object.keys(lib.colors).forEach((color) => {
          lib.appendOption(select, color);
        });
        select.addEventListener("change", () => {
          if (select.value) {
            addHeaderFooter(headerFooterTarget, placement, select.value);
          }
        });
        headerFooterControls.appendChild(select);
      }
    }
    headerFooterControls.querySelectorAll("select").forEach((select) => {
      select.value = "";
    });
    sMSPTextList.appendChild(headerFooterControls);
    // END Add Header/Footer Controls
    document.querySelector("#SMSPSelectLabel").textContent =
      "Selected: Row " + (exposed.vars.currentlySelectedRowIndex + 1);
    document.querySelector("#SMSPElementLabel").textContent =
      "Selected: Block " + (exposed.vars.currentlySelectedBlockIndex + 1);
    document.querySelector("#sMSPDeleteSelectedRow").disabled =
      activeBlockElements.rows.length == 1;
    document.querySelector("#sMSPDeleteSelectedBlock").disabled =
      activeBlockElements.rows.length == 1 &&
      exposed.getCurrentBlockRows().length == 1;
    const selectedBlockElement = exposed.getCurrentBlockElem();
    const ungroupButton = document.querySelector("#sMSPUngroupSelectedBlock");
    if (ungroupButton) {
      ungroupButton.disabled = !(selectedBlockElement instanceof GroupedBlockElement);
    }
    for (
      let row = 0;
      row < Object.keys(activeBlockElements.rows).length;
      row++
    ) {
      const sMControlRow = document.createElement("div");
      sMControlRow.dataset.dataRow = row.toString();
      sMControlRow.className =
        "sMControlRow" +
        (row === 0 ? " firstBlockEditorRow" : "") +
        (row === activeBlockElements.rows.length - 1
          ? " lastBlockEditorRow"
          : "") +
        (row == exposed.vars.currentlySelectedRowIndex ? " selected" : "");

      for (let item = 0; item < activeBlockElements.rows[row].length; item++) {
        const blockElement = activeBlockElements.rows[row][item];
        const blockElementType =
          Control.prototype.blockToClassElems.getElem(blockElement) ||
          blockElement.constructor.name;

        if (blockSelectionMode) {
          const selectionCheckbox = document.createElement("input");
          selectionCheckbox.type = "checkbox";
          selectionCheckbox.className = "blockSelectionCheckbox";
          const selectionKey = getBlockSelectionKey(row, item);
          selectionCheckbox.checked = selectedBlockKeys.has(selectionKey);
          selectionCheckbox.dataset.selectionKey = selectionKey;
          selectionCheckbox.addEventListener("click", (event) => {
            event.stopPropagation();
            if (event.shiftKey && blockSelectionAnchor) {
              // Select every block between the anchor and this one, in reading order.
              const position = ({ rowIndex, blockIndex }) => [rowIndex, blockIndex];
              const before = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]);
              const anchor = position(blockSelectionAnchor);
              const target = [row, item];
              const [start, end] = before(anchor, target) ? [anchor, target] : [target, anchor];
              activeBlockElements.rows.forEach((blocks, rowIndex) => {
                blocks.forEach((block, blockIndex) => {
                  const point = [rowIndex, blockIndex];
                  if (before(start, point) && before(point, end)) {
                    selectedBlockKeys.add(getBlockSelectionKey(rowIndex, blockIndex));
                  }
                });
              });
              document.querySelectorAll(".blockSelectionCheckbox").forEach((checkbox) => {
                checkbox.checked = selectedBlockKeys.has(checkbox.dataset.selectionKey);
              });
            } else if (selectionCheckbox.checked) {
              selectedBlockKeys.add(selectionKey);
            } else {
              selectedBlockKeys.delete(selectionKey);
            }
            blockSelectionAnchor = { rowIndex: row, blockIndex: item };
            syncGroupSelectionControls();
          });
          sMControlRow.appendChild(selectionCheckbox);
        }

        const textEditorBlock = document.createElement("div");
        textEditorBlock.className =
          "textEditorBlock " +
          Control.prototype.blockInternalElements[
          blockElementType
          ] +
          (item == exposed.vars.currentlySelectedBlockIndex &&
            row == exposed.vars.currentlySelectedRowIndex
            ? " selected"
            : "");
        textEditorBlock.dataset.row = row.toString();
        textEditorBlock.dataset.block = item.toString();
        textEditorBlock.draggable = true;

        const blockTypeLabel = document.createElement("span");
        blockTypeLabel.className = "textEditorBlockLabel";
        const visibleBlockLabel =
          blockElementType === "GroupedBlockElement"
            ? blockElement.label || "Grouped Block"
            : Control.prototype.blockElements[blockElementType] || "Block";
        textEditorBlock.setAttribute("aria-label", visibleBlockLabel);
        textEditorBlock.title = visibleBlockLabel;
        blockTypeLabel.appendChild(createBlockElementVisual(blockElementType));
        const blockTypeText = document.createElement("span");
        blockTypeText.className = "blockElementText";
        blockTypeText.textContent = visibleBlockLabel;
        blockTypeLabel.appendChild(blockTypeText);
        if (blockElementType === "GroupedBlockElement") {
          textEditorBlock.appendChild(blockTypeLabel);
          const chevron = document.createElement("span");
          chevron.className =
            "groupExpandButton material-symbols-outlined";
          chevron.textContent = "chevron_right";
          textEditorBlock.appendChild(chevron);
        } else {
          textEditorBlock.appendChild(blockTypeLabel);
        }

        const blockTypeChevron = document.createElement("span");
        blockTypeChevron.className = "blockTypeChevron";
        blockTypeChevron.textContent = "▾";

        const blockTypeSelect = document.createElement("select");
        blockTypeSelect.className = "blockTypeInlineSelect";
        blockTypeSelect.value = blockElementType;
        blockTypeSelect.setAttribute("aria-label", "Change block type");
        blockTypeSelect.title = "Change block type";

        for (const element in Control.prototype.blockElements) {
          lib.appendOption(blockTypeSelect, element, {
            selected: element === blockElementType,
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
            exposed.replaceControlElemTypeAt(row, item, blockTypeSelect.value);
          }
        });

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
            if (
              blockElement instanceof GroupedBlockElement &&
              event.target.closest(".groupExpandButton")
            ) {
              event.preventDefault();
              if (exposed && typeof exposed.enterGroupElement === "function") {
                exposed.enterGroupElement(row, item);
              }
              return;
            }
            // One form refresh for the row and block, and not a third from
            // the row's own click handler.
            event.stopPropagation();
            exposed.setSelectedRow(row, false);
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
    }

    if (blockElemType === "sdShield") {
      const shieldConfig = ShieldElement.prototype.getBlockShieldConfig(
        currentBlockElem.shieldBase
      );
      currentBlockElem.routeNumber =
        ShieldElement.prototype.limitRouteCharacters(
          currentBlockElem.routeNumber,
          shieldConfig
        );
      syncShieldRouteCharacterLimit(currentBlockElem.shieldBase);
      currentBlockElem.shieldType =
        ShieldElement.prototype.migrateLegacyBlockVariant(
          currentBlockElem.shieldType,
          currentBlockElem.routeNumber,
          shieldConfig
        );
      const normalizeDisableSmallCapsValue = (value) =>
        value === true ||
        value === "true" ||
        value === 1 ||
        value === "1" ||
        value === "on";

      if (
        currentBlockElem.disableSmallCaps !== undefined &&
        currentBlockElem.smallCaps === undefined
      ) {
        currentBlockElem.smallCaps = !normalizeDisableSmallCapsValue(
          currentBlockElem.disableSmallCaps
        );
      }
      if (
        currentBlockElem.disableSmallCaps2 !== undefined &&
        currentBlockElem.smallCaps2 === undefined
      ) {
        currentBlockElem.smallCaps2 = !normalizeDisableSmallCapsValue(
          currentBlockElem.disableSmallCaps2
        );
      }

      currentBlockElem.bannerFontFamily =
        ShieldElement.prototype.normalizeBannerFontFamily(
          currentBlockElem.bannerFontFamily
        );
      currentBlockElem.bannerFontFamily1 =
        ShieldElement.prototype.normalizeBannerFontFamily(
          currentBlockElem.bannerFontFamily1 ||
          currentBlockElem.bannerFontFamily
        );
      currentBlockElem.bannerFontFamily2 =
        ShieldElement.prototype.normalizeBannerFontFamily(
          currentBlockElem.bannerFontFamily2 ||
          currentBlockElem.bannerFontFamily
        );
      populateShieldVariantOptions(
        currentBlockElem.shieldBase,
        currentBlockElem.shieldType
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
      delete currentBlockElem.disableSmallCaps;
      delete currentBlockElem.disableSmallCaps2;
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
          const customInputId =
            propertyName === "bannerType"
              ? "sdShield_bannerCustomText"
              : "sdShield_bannerCustomText2";
          const customInput = document.getElementById(customInputId);
          const bannerOptions = Shield.prototype.bannerTypes || [];
          const isPreset = bannerOptions.includes(currentBlockElem[propertyName]);
          if (element.tagName === "SELECT") {
            element.value = isPreset
              ? currentBlockElem[propertyName]
              : ShieldElement.prototype.defaultBannerType;
            bindPreviewField(element);
          }
          if (customInput) {
            customInput.value = isPreset ? "" : currentBlockElem[propertyName];
            bindPreviewField(customInput);
          }
          if (displayElement) {
            displayElement.textContent = currentBlockElem[propertyName];
          }
          continue;
        }
        if (element.type === "checkbox") {
          element.checked = currentBlockElem[propertyName];
          bindPreviewField(element);
        } else if (element.type === "radio") {
          if (element.value === currentBlockElem[propertyName].toString()) {
            element.checked = true;
          }
          bindPreviewField(element);
        } else if (element.tagName === "SELECT") {
          element.value = currentBlockElem[propertyName];
          bindPreviewField(element);
        } else {
          // Preserve numeric drafts (such as "1.") and the caret during live edits.
          if (element.value !== String(currentBlockElem[propertyName])) {
            element.value = currentBlockElem[propertyName];
          }
          bindPreviewField(element);
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
        // If the display element is an input (we replaced many spans with number inputs), set value.
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

    if (blockElemType === "sdIcon") updateSdIconExtraControls(currentBlockElem);

    if (blockElemType === "sdShield") {
      const disableSmallCapsElmt = document.getElementById(
        "sdShield_disableSmallCaps"
      );
      const disableSmallCapsElmt2 = document.getElementById(
        "sdShield_disableSmallCaps2"
      );
      document.getElementById("sdShield_bannerCustomText").value =
        currentBlockElem.bannerType || "";
      document.getElementById("sdShield_bannerCustomText2").value =
        currentBlockElem.bannerType2 || "";
      for (const [id, value] of [
        ["sdShield_bannerFontSize1Display", currentBlockElem.bannerFontSize1],
        ["sdShield_bannerFontSize2Display", currentBlockElem.bannerFontSize2],
        ["sdShield_roadNameFontSizeDisplay", currentBlockElem.roadNameFontSize],
      ]) {
        const input = document.getElementById(id);
        // Leave an in-progress draft alone while it still means the same size.
        if (fromShieldFontSizeDisplay(input, value) !== value) {
          input.value = toShieldFontSizeDisplay(value);
        }
      }
      document.getElementById("sdShield_shieldSizeSlider").value =
        currentBlockElem.shieldSize;
      const shieldConfig = ShieldElement.prototype.getBlockShieldConfig(
        currentBlockElem.shieldBase
      );
      document.querySelector(".sdShieldCountyRow").hidden =
        !ShieldElement.prototype.isCountyShield(shieldConfig);
      const supportsShieldBacks =
        ShieldElement.prototype.supportsShieldBacks(shieldConfig);
      document.getElementById("sdShield_shieldBacks").hidden = !supportsShieldBacks;
      document.querySelector(".sdShieldBacksLabel").hidden = !supportsShieldBacks;
      if (shieldBasePicker?.getValue() !== currentBlockElem.shieldBase) {
        shieldBasePicker?.setValue(currentBlockElem.shieldBase);
      }
      Object.values(shieldPickers).forEach((picker) => picker.sync());
      syncShieldChoiceButtons();

      if (disableSmallCapsElmt) {
        disableSmallCapsElmt.checked = currentBlockElem.smallCaps === false;
        disableSmallCapsElmt.addEventListener("change", readForm, {
          once: true,
        });
      }
      if (disableSmallCapsElmt2) {
        disableSmallCapsElmt2.checked = currentBlockElem.smallCaps2 === false;
        disableSmallCapsElmt2.addEventListener("change", readForm, {
          once: true,
        });
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
      activeBlockElements.blockProperties[
        exposed.vars.currentlySelectedRowIndex
      ].topPadding;
    document
      .querySelector("#sdBlock_topPadding")
      .addEventListener("input", readForm);

    document.querySelector("#sdBlock_bottomPadding").value =
      activeBlockElements.blockProperties[
        exposed.vars.currentlySelectedRowIndex
      ].bottomPadding;
    document
      .querySelector("#sdBlock_bottomPadding")
      .addEventListener("input", readForm);

    const topPadValEl = document.querySelector("#sdBlock_topPaddingVal");
    const bottomPadValEl = document.querySelector("#sdBlock_bottomPaddingVal");
    const topPadValue =
      activeBlockElements.blockProperties[exposed.vars.currentlySelectedRowIndex]
        .topPadding;
    const bottomPadValue =
      activeBlockElements.blockProperties[exposed.vars.currentlySelectedRowIndex]
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
      activeBlockElements.blockProperties[
        exposed.vars.currentlySelectedRowIndex
      ].backgroundColor;

    document
      .querySelector("#sdBlock_backgroundColor")
      .addEventListener("change", readForm);

    const blockBorderColorEl = document.querySelector("#sdBlock_borderColor");
    if (blockBorderColorEl) {
      const storedBorderColor =
        activeBlockElements.blockProperties[
          exposed.vars.currentlySelectedRowIndex
        ].borderColor;
      blockBorderColorEl.value =
        storedBorderColor || Block.defaultBorderColor || "Match BG";
      blockBorderColorEl.addEventListener("change", readForm);
    }

    const blockBackgroundFullWidthEl = document.querySelector(
      "#sdBlock_backgroundFullWidth"
    );
    blockBackgroundFullWidthEl.checked =
      !!activeBlockElements.blockProperties[
        exposed.vars.currentlySelectedRowIndex
      ].backgroundFullWidth;
    blockBackgroundFullWidthEl.addEventListener("change", readForm, {
      once: true,
    });

    document.querySelector("#sdBlock_width").value =
      activeBlockElements.blockProperties[
        exposed.vars.currentlySelectedRowIndex
      ].width;
    document
      .querySelector("#sdBlock_width")
      .addEventListener("input", readForm);

    document
      .querySelector("#sdBlock_stretchLeft")
      .addEventListener("change", readForm, { once: true });

    document.querySelector("#sdBlock_stretchLeft").checked =
      activeBlockElements.blockProperties[
        exposed.vars.currentlySelectedRowIndex
      ].stretchLeft;

    document
      .querySelector("#sdBlock_stretchCenter")
      .addEventListener("change", readForm, { once: true });
    document.querySelector("#sdBlock_stretchCenter").checked =
      activeBlockElements.blockProperties[
        exposed.vars.currentlySelectedRowIndex
      ].stretchCenter;

    document
      .querySelector("#sdBlock_stretchRight")
      .addEventListener("change", readForm, { once: true });
    document.querySelector("#sdBlock_stretchRight").checked =
      activeBlockElements.blockProperties[
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
    guideArrowSelectElmt.value = Sign.prototype.guideArrows.includes(
      panel.sign.guideArrow
    )
      ? panel.sign.guideArrow
      : "None";

    const bottomArrowKindElmt = document.getElementById("bottomArrowKind");
    const bottomArrowSelectedLabelElmt = document.getElementById(
      "bottomArrowSelectedLabel"
    );
    const resolvedBottomArrowKind =
      ArrowElement.prototype.arrows[panel.sign.bottomArrowKind]
        ? panel.sign.bottomArrowKind
        : panel.sign.guideArrow !== "None"
          ? ArrowElement.prototype.defaultArrow
          : "None";
    if (bottomArrowKindElmt) {
      bottomArrowKindElmt.value = resolvedBottomArrowKind;
    }
    if (bottomArrowSelectedLabelElmt) {
      bottomArrowSelectedLabelElmt.textContent =
        "Current: " + getBottomArrowLabel(resolvedBottomArrowKind);
    }
    syncBottomArrowRotationControls(panel.sign.bottomArrowRotation);
    syncStandardArrowControls(panel.sign);
    syncExitOnlyEditor(panel.sign, panel);
    const bottomArrowGapElmt = document.getElementById("bottomArrowGap");
    const bottomArrowGapValueElmt = document.getElementById(
      "bottomArrowGapValue"
    );
    const resolvedBottomArrowGap = Number.isFinite(panel.sign.bottomArrowGap)
      ? panel.sign.bottomArrowGap
      : 0.5;
    if (bottomArrowGapElmt) {
      bottomArrowGapElmt.value = resolvedBottomArrowGap;
    }
    if (bottomArrowGapValueElmt) {
      bottomArrowGapValueElmt.textContent = resolvedBottomArrowGap;
    }
    const bottomArrowSpacingElmt = document.getElementById(
      "bottomArrowSpacing"
    );
    const bottomArrowSpacingValueElmt = document.getElementById(
      "bottomArrowSpacingValue"
    );
    const resolvedBottomArrowSpacing = Number.isFinite(
      panel.sign.bottomArrowSpacing
    )
      ? panel.sign.bottomArrowSpacing
      : 1;
    if (bottomArrowSpacingElmt) {
      bottomArrowSpacingElmt.value = resolvedBottomArrowSpacing;
    }
    if (bottomArrowSpacingValueElmt) {
      bottomArrowSpacingValueElmt.textContent = resolvedBottomArrowSpacing;
    }
    const bottomArrowGapLabelElmt = document.getElementById(
      "bottomArrowGapLabel"
    );
    const bottomArrowSpacingLabelElmt = document.getElementById(
      "bottomArrowSpacingLabel"
    );
    const showStandardArrowLayout =
      panel.sign.guideArrow === "None" && resolvedBottomArrowKind !== "None";
    for (const element of [
      bottomArrowGapLabelElmt,
      bottomArrowGapElmt,
      bottomArrowGapValueElmt,
      bottomArrowSpacingLabelElmt,
      bottomArrowSpacingElmt,
      bottomArrowSpacingValueElmt,
    ]) {
      if (element) {
        element.classList.toggle("invisible", !showStandardArrowLayout);
      }
    }

    const arrowLocationsElmt = document.getElementById("arrowLocations");
    if (arrowLocationsElmt) {
      const availableArrowPositions = Sign.prototype.arrowPositions.filter(
        (position) =>
          panel.sign.guideArrow !== "Half Exit Only" || position !== "Middle"
      );
      const currentArrowPositions = Array.from(arrowLocationsElmt.options).map(
        (option) => option.value
      );
      if (
        currentArrowPositions.join("|") !== availableArrowPositions.join("|")
      ) {
        lib.clearChildren(arrowLocationsElmt);
        for (const position of availableArrowPositions) {
          lib.appendOption(arrowLocationsElmt, position, {
            text: position === "Middle" ? "Center" : position,
          });
        }
      }
      arrowLocationsElmt.value = availableArrowPositions.includes(
        panel.sign.arrowPosition
      )
        ? panel.sign.arrowPosition
        : availableArrowPositions[0];
    }

    // A sign without guide arrows shows 0 arrows (as in v2.19), not the
    // stored lane count, which made the window look like it had an arrow.
    const guideArrowLanesElmt = document.getElementById("guideArrowLanes");
    guideArrowLanesElmt.value = (panel.sign.guideArrow || "None") === "None"
      ? "0" : panel.sign.guideArrowLanes;

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
    const exitOnlyArrowHorizontalPaddingElmt = document.getElementById(
      "exitOnlyArrowHorizontalPadding"
    );
    const exitOnlyArrowHorizontalPaddingValueElmt = document.getElementById(
      "exitOnlyArrowHorizontalPaddingValue"
    );
    const exitOnlyArrowHorizontalPaddingLabelElmt = document.getElementById(
      "exitOnlyArrowHorizontalPaddingLabel"
    );
    const halfExitGapElmt = document.getElementById("halfExitGap");
    const halfExitGapValueElmt = document.getElementById("halfExitGapValue");
    const halfExitGapLabelElmt = document.getElementById("halfExitGapLabel");
    const secondExitOnlyLabelElmt = document.getElementById(
      "secondExitOnlyLabel"
    );
    const secondExitOnlyElmt = document.getElementById("secondExitOnly");
    const isExitOnlyType = panel.sign.guideArrow.includes("Exit Only");

    exitOnlyDirectionLabel.className = !isExitOnlyType
      ? "invisible"
      : "";
    exitOnlyPaddingLabel.className =
      !isExitOnlyType ||
        panel.sign.guideArrow == "Split Exit Only"
        ? "invisible"
        : "";
    showExitOnlyLabel.className = !isExitOnlyType
      ? "invisible"
      : "";
    if (hideExitArrowLabel) {
      hideExitArrowLabel.className = !isExitOnlyType
        ? "invisible"
        : "";
    }
    exitOnlyDirection.className = !isExitOnlyType
      ? "invisible"
      : "";
    exitOnlyPadding.className =
      !isExitOnlyType ||
        panel.sign.guideArrow == "Split Exit Only"
        ? "invisible"
        : "";
    const showExitOnlyArrowHorizontalPadding =
      panel.sign.guideArrow === "Exit Only" ||
      panel.sign.guideArrow === "Half Exit Only";
    for (const element of [
      exitOnlyArrowHorizontalPaddingLabelElmt,
      exitOnlyArrowHorizontalPaddingElmt,
      exitOnlyArrowHorizontalPaddingValueElmt,
    ]) {
      if (element) {
        element.classList.toggle(
          "invisible",
          !showExitOnlyArrowHorizontalPadding
        );
      }
    }
    const isHalfExitOnly = panel.sign.guideArrow === "Half Exit Only";
    if (halfExitGapElmt) halfExitGapElmt.className = isHalfExitOnly ? "" : "invisible";
    if (halfExitGapValueElmt) halfExitGapValueElmt.className = isHalfExitOnly ? "" : "invisible";
    if (halfExitGapLabelElmt) halfExitGapLabelElmt.className = isHalfExitOnly ? "" : "invisible";
    showExitOnly.className = !isExitOnlyType
      ? "invisible"
      : "";
    if (hideExitArrow) {
      hideExitArrow.className = !isExitOnlyType
        ? "invisible"
        : "";
    }
    if (secondExitOnlyLabelElmt) {
      secondExitOnlyLabelElmt.classList.toggle("invisible", !isExitOnlyType);
    }
    if (secondExitOnlyElmt) {
      secondExitOnlyElmt.classList.toggle("invisible", !isExitOnlyType);
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
      !isExitOnlyType ||
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
    exitOnlyPadding.value = panel.sign.exitOnlyPadding;
    exitOnlyPaddingValue.textContent = panel.sign.exitOnlyPadding;
    const parsedExitOnlyArrowHorizontalPadding = parseFloat(
      panel.sign.exitOnlyArrowHorizontalPadding
    );
    const resolvedExitOnlyArrowHorizontalPadding = Number.isFinite(
      parsedExitOnlyArrowHorizontalPadding
    )
      ? Math.min(Math.max(parsedExitOnlyArrowHorizontalPadding, 0), 6)
      : 0;
    if (exitOnlyArrowHorizontalPaddingElmt) {
      exitOnlyArrowHorizontalPaddingElmt.value =
        resolvedExitOnlyArrowHorizontalPadding;
    }
    if (exitOnlyArrowHorizontalPaddingValueElmt) {
      exitOnlyArrowHorizontalPaddingValueElmt.textContent =
        resolvedExitOnlyArrowHorizontalPadding;
    }
    const resolvedGap = typeof panel.sign.halfExitGap === "number" ? panel.sign.halfExitGap : 5;
    if (halfExitGapElmt) halfExitGapElmt.value = resolvedGap;
    if (halfExitGapValueElmt) halfExitGapValueElmt.textContent = resolvedGap;

    for (const option of exitOnlyDirection.options) {
      if (option.value == panel.sign.exitguideArrows) {
        option.selected = true;
        break;
      }
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
    scheduleMobileLayoutUpdate();
  };

  /**
   * Update the fields in the form relating to shields to the values of the currently selected panel.
   */
  const updateShieldSubform = function () {
    const shieldsContainerElmt = document.getElementById("shields");
    var subPanel;

    if (exposed.vars.currentlySelectedSubPanelIndex == -1) {
      subPanel = getCurrentPanel().sign;
    } else {
      subPanel = exposed.getCurrentSubPanel();
    }
    const shields = subPanel.shields;

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
      const typeSelectElmt = document.createElement("select");
      for (const type in Shield.prototype.types) {
        lib.appendOption(typeSelectElmt, Shield.prototype.types[type], {
          selected: shields[shieldIndex].type == Shield.prototype.types[type],
          text: type,
        });
      }
      typeSelectElmt.id = `shield${shieldIndex}_type`;
      typeSelectElmt.addEventListener("change", readForm);
      rowContainerElmt.appendChild(typeSelectElmt);

      const routeNumberElmt = document.createElement("input");
      routeNumberElmt.type = "text";
      routeNumberElmt.id = `shield${shieldIndex}_routeNumber`;
      routeNumberElmt.placeholder = "00";
      routeNumberElmt.value = shields[shieldIndex].routeNumber;
      routeNumberElmt.addEventListener("input", readForm);
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
      fontSizeText.placeholder = 1.4;
      fontSizeText.value = parseFloat(
        shields[shieldIndex].fontSize.split("rem")[0]
      );
      fontSizeText.min = 1;
      fontSizeText.max = 3;
      fontSizeText.step = 0.1;
      fontSizeText.style.width = "4rem";
      fontSizeText.oninput = readForm;
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
      bannerCustomInputElmt.addEventListener("input", readForm);
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
      bannerCustomInputElmt2.addEventListener("input", readForm);
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
      selectedShield.variant = Shield.prototype.migrateLegacyVariant(
        selectedShield.shieldValue,
        selectedShield.variant
      );

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
            e.element.removeEventListener(e.type || "click", e.handler);
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
        type: "change",
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
        type: "change",
      });

      const handleBorderRadius = (e) => {
        if (!e.currentTarget.validity.valid) return;
        selectedShield.shieldBorderRadius = parseInt(e.currentTarget.value);
        updateShieldModalVisual(selectedShield, false);
      };
      document
        .querySelector("#selectedBackRoudness")
        .addEventListener("input", handleBorderRadius);
      eventListeners.push({
        element: document.querySelector("#selectedBackRoudness"),
        handler: handleBorderRadius,
        type: "input",
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
        type: "change",
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
          e.element.removeEventListener(e.type || "click", e.handler);
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
    setPanelCorner,
    clearBottomArrowKind,
    getKeybindMode,
    shortcutMatches,
    warmEditorWindows,
    commitPanelPadding: commitPanelPaddingChange,
    updateForm,
    updateShieldSubform,
    ensureGuideArrowMenuOpen,
    selectStandardArrowIndividual,
    setExitTabProfile,
    newExitTabProfile,
    renameExitTabProfile,
    deleteExitTabProfile,
  };
})();
