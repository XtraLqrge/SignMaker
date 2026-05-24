const app = (function () {
  let post = {};
  let currentlySelectedPanelIndex = -1;
  let currentlySelectedSubPanelIndex = 0;
  let currentlySelectedExitTabIndex = 0;
  let currentlySelectedNestedExitTabIndex = -1;
    let previewUpdateInProgress = false;
  let currentlySelectedRowIndex = 0,
    currentlySelectedBlockIndex = 0;

  let fileInfo = {
    fileType: "png",
    panel: -1,
    selectedPanelIndices: [],
  };

  let currentlySelectedAPLArrowIndex = 0;
  const DEFAULT_POST_POSITION = "Right";
  const DEFAULT_PANEL_SPACING = 4;
  const DEFAULT_STACKED_PANEL_SPACING = 0;
  const DEFAULT_STACKED_PANEL_MATCH_WIDTH = false;
  const APP_STORAGE_KEY = "signMaker.autosave.v1";
  const RESTORE_ON_REFRESH_STORAGE_KEY = "signMaker.restoreOnRefresh";


  const ensureExtendedGuideArrowOptions = () => {
    if (
      typeof Sign === "undefined" ||
      !Sign.prototype ||
      !Array.isArray(Sign.prototype.guideArrows)
    ) {
      return;
    }

    const additions = [
      "Down (IL):DOWN_IL",
      "Down (CA):DOWN_CA",
    ];

    const getLabel = (entry) => String(entry || "").split(":")[0].trim();
    const existingLabels = new Set(Sign.prototype.guideArrows.map(getLabel));

    let insertIndex = Sign.prototype.guideArrows.findIndex(
      (entry) => getLabel(entry) === "Down Arrow"
    );

    if (insertIndex < 0) {
      insertIndex = Sign.prototype.guideArrows.findIndex(
        (entry) => getLabel(entry) === "None"
      );
    }

    if (insertIndex < 0) {
      insertIndex = Sign.prototype.guideArrows.length - 1;
    }

    for (const addition of additions) {
      const label = getLabel(addition);

      if (existingLabels.has(label)) {
        continue;
      }

      insertIndex += 1;
      Sign.prototype.guideArrows.splice(insertIndex, 0, addition);
      existingLabels.add(label);
    }
  };

  const getCurrentPanel = () => {
    return post.panels[currentlySelectedPanelIndex];
  };

  const isStackedPanelBottom = (panelIndex = currentlySelectedPanelIndex) =>
    !!(
      post &&
      Array.isArray(post.panels) &&
      panelIndex > 0 &&
      post.panels[panelIndex] &&
      post.panels[panelIndex].stackedWithPrevious === true
    );

  const getStackedPanelTopIndex = (panelIndex = currentlySelectedPanelIndex) => {
    if (!post || !Array.isArray(post.panels) || post.panels.length === 0) {
      return 0;
    }

    const normalizedIndex = clamp(
      typeof panelIndex === "number" ? panelIndex : currentlySelectedPanelIndex,
      0,
      post.panels.length - 1
    );

    return isStackedPanelBottom(normalizedIndex) ? normalizedIndex - 1 : normalizedIndex;
  };

  const getStackedPanelBottomIndex = (panelIndex = currentlySelectedPanelIndex) => {
    if (!post || !Array.isArray(post.panels) || post.panels.length === 0) {
      return -1;
    }

    const topIndex = getStackedPanelTopIndex(panelIndex);
    const possibleBottomIndex = topIndex + 1;

    return possibleBottomIndex < post.panels.length &&
      post.panels[possibleBottomIndex]?.stackedWithPrevious === true
      ? possibleBottomIndex
      : -1;
  };

  const normalizeStackedPanelSpacing = (value) => {
    const parsed = typeof value === "string" ? parseFloat(value) : Number(value);

    if (!Number.isFinite(parsed)) {
      return DEFAULT_STACKED_PANEL_SPACING;
    }

    return Math.max(0, Math.min(4, parsed));
  };

  const getStackedPanelSettingsForTopIndex = (topIndex) => {
    const panel =
      post &&
      Array.isArray(post.panels) &&
      topIndex >= 0 &&
      topIndex < post.panels.length
        ? post.panels[topIndex]
        : null;

    if (!panel) {
      return {
        spacing: DEFAULT_STACKED_PANEL_SPACING,
        matchWidth: DEFAULT_STACKED_PANEL_MATCH_WIDTH,
      };
    }

    panel.stackedPanelSpacing = normalizeStackedPanelSpacing(
      panel.stackedPanelSpacing
    );
    panel.stackedPanelMatchWidth = panel.stackedPanelMatchWidth === true;

    return {
      spacing: panel.stackedPanelSpacing,
      matchWidth: panel.stackedPanelMatchWidth,
    };
  };

  const getCurrentStackedPanelInfo = () => {
    const topIndex = getStackedPanelTopIndex(currentlySelectedPanelIndex);
    const bottomIndex = getStackedPanelBottomIndex(topIndex);
    const settings = getStackedPanelSettingsForTopIndex(topIndex);

    return {
      topIndex,
      bottomIndex,
      selectedSlot: currentlySelectedPanelIndex === bottomIndex ? "Bottom" : "Top",
      hasBottom: bottomIndex >= 0,
      spacing: settings.spacing,
      matchWidth: settings.matchWidth,
    };
  };

  const GLOBAL_TOP_SUBPANEL_INDEX = -2;
  const GLOBAL_BOTTOM_SUBPANEL_INDEX = -1;

  const getGlobalBlockPositionFromIndex = (subPanelIndex) =>
    subPanelIndex === GLOBAL_TOP_SUBPANEL_INDEX ? "Top" : "Bottom";

  const getGlobalBlockKey = (position) =>
    String(position || "").toLowerCase() === "top"
      ? "globalTopBlockElements"
      : "globalBottomBlockElements";

  const createDefaultGlobalBlockElement = () => new ActionMessageElement();

  const createDefaultGlobalBlockElements = () =>
    new Control({
      rows: [[createDefaultGlobalBlockElement()]],
      blockProperties: [new Block()],
    });

  const normalizeGlobalBlockElements = (controlData) => {
    const hasRows =
      controlData &&
      typeof controlData === "object" &&
      Array.isArray(controlData.rows);

    const control = hasRows
      ? Object.assign(new Control(), controlData)
      : createDefaultGlobalBlockElements();

    if (!Array.isArray(control.rows) || control.rows.length === 0) {
      control.rows = [[createDefaultGlobalBlockElement()]];
    }

    if (!control.rows.some((row) => Array.isArray(row) && row.length > 0)) {
      control.rows = [[createDefaultGlobalBlockElement()]];
    }

    if (!Array.isArray(control.blockProperties)) {
      control.blockProperties = [];
    }

    while (control.blockProperties.length < control.rows.length) {
      control.blockProperties.push(new Block());
    }

    return control;
  };

  const ensureGlobalBlockElements = (sign, position = "Bottom") => {
    if (!sign) {
      return null;
    }

    const key = getGlobalBlockKey(position);

    if (!sign[key] && sign.blockElements && key === "globalBottomBlockElements") {
      sign[key] = sign.blockElements;
    }

    sign[key] = normalizeGlobalBlockElements(sign[key]);

    return sign[key];
  };

  const getCurrentSubPanel = () => {
    const panel = getCurrentPanel();

    if (!panel || !panel.sign) {
      return null;
    }

    if (currentlySelectedSubPanelIndex < 0) {
      const position = getGlobalBlockPositionFromIndex(currentlySelectedSubPanelIndex);

      return {
        isGlobalBlockTarget: true,
        globalBlockPosition: position,
        blockElements: ensureGlobalBlockElements(panel.sign, position),
        shields: [],
      };
    }

    return panel.sign.subPanels[currentlySelectedSubPanelIndex];
  };

  const getCurrentBlockRows = () => {
    return getCurrentSubPanel().blockElements.rows[currentlySelectedRowIndex];
  };

  const getCurrentBlockElem = () => {
    return getCurrentBlockRows()[currentlySelectedBlockIndex];
  };

  const clamp = (number, min, max) => Math.max(min, Math.min(number, max));

  const isPanelConfiguredHidden = (panelIndex) =>
    !!(
      post &&
      Array.isArray(post.panels) &&
      post.panels[panelIndex] &&
      post.panels[panelIndex].hiddenFromPost === true
    );

  const isPanelHiddenForLiveRender = (panelIndex) => {
    if (!post || !Array.isArray(post.panels) || !post.panels[panelIndex]) {
      return false;
    }

    const panel = post.panels[panelIndex];
    const topIndex = isStackedPanelBottom(panelIndex) ? panelIndex - 1 : panelIndex;
    const topPanelHidden =
      topIndex >= 0 && post.panels[topIndex]?.hiddenFromPost === true;

    const hiddenByOwnSetting = panel.hiddenFromPost === true;
    const hiddenByStackTop = isStackedPanelBottom(panelIndex) && topPanelHidden;

    return (hiddenByOwnSetting || hiddenByStackTop) &&
      panelIndex !== currentlySelectedPanelIndex;
  };

  const isPanelHiddenForExport = (panelIndex) => {
    if (!post || !Array.isArray(post.panels) || !post.panels[panelIndex]) {
      return false;
    }

    const topIndex = isStackedPanelBottom(panelIndex) ? panelIndex - 1 : panelIndex;

    return (
      post.panels[panelIndex].hiddenFromPost === true ||
      (topIndex >= 0 && post.panels[topIndex]?.hiddenFromPost === true)
    );
  };

  const getPanelDisplayNumber = (panelIndex) => {
    if (!post || !Array.isArray(post.panels)) {
      return 1;
    }

    let panelNumber = 0;
    const normalizedPanelIndex = clamp(
      Number(panelIndex),
      0,
      Math.max(0, post.panels.length - 1)
    );

    for (let index = 0; index <= normalizedPanelIndex; index++) {
      if (!post.panels[index]?.stackedWithPrevious) {
        panelNumber++;
      }
    }

    return Math.max(1, panelNumber);
  };

  const getPanelDisplayLabel = (panelIndex) => {
    const number = getPanelDisplayNumber(panelIndex);
    const suffix = isStackedPanelBottom(panelIndex) ? "A" : "";

    return `${number}${suffix}`;
  };

  const getExportablePanelGroups = ({ includeHidden = false } = {}) => {
    if (!post || !Array.isArray(post.panels)) {
      return [];
    }

    const groups = [];

    for (let panelIndex = 0; panelIndex < post.panels.length; panelIndex++) {
      if (post.panels[panelIndex]?.stackedWithPrevious === true) {
        continue;
      }

      if (!includeHidden && isPanelHiddenForExport(panelIndex)) {
        continue;
      }

      const bottomIndex = getStackedPanelBottomIndex(panelIndex);
      groups.push({
        label: String(getPanelDisplayNumber(panelIndex)),
        topIndex: panelIndex,
        bottomIndex,
        indices: bottomIndex >= 0 ? [panelIndex, bottomIndex] : [panelIndex],
      });
    }

    return groups;
  };

  const getDownloadPanelSelection = () => {
    if (!Array.isArray(fileInfo.selectedPanelIndices)) {
      fileInfo.selectedPanelIndices = [];
    }

    const validTopPanelIndices = new Set(
      getExportablePanelGroups().map((group) => group.topIndex)
    );

    fileInfo.selectedPanelIndices = fileInfo.selectedPanelIndices
      .map((panelIndex) => Number(panelIndex))
      .filter(
        (panelIndex, index, panelIndices) =>
          Number.isInteger(panelIndex) &&
          validTopPanelIndices.has(panelIndex) &&
          panelIndices.indexOf(panelIndex) === index
      );

    return fileInfo.selectedPanelIndices;
  };
  const normalizePostThickness = (value) => {
    const parsed =
      typeof value === "string" ? parseFloat(value) : Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
    return typeof Post.prototype.defaultThickness === "number"
      ? Post.prototype.defaultThickness
      : 1;
  };
  const FHWA_BASELINE_OFFSET_VAR = "var(--fhwaBaselineShift)";
    const HIGHWAY_GOTHIC_TEXT_RENDER_SCALE = 1.5;
    const isHighwayGothicTextFont = (fontFamily) =>
      /^Series\s/i.test(String(fontFamily || "")) ||
      String(fontFamily || "") === "Highway Gothic" ||
      String(fontFamily || "") === "Highway Gothic Wide";

    const getRenderedHighwayGothicTextSize = (fontSize, usesHighwayGothic) => {
      const parsedSize = parseFloat(fontSize);
      const safeSize = Number.isFinite(parsedSize) ? parsedSize : 0;

      return usesHighwayGothic
        ? safeSize * HIGHWAY_GOTHIC_TEXT_RENDER_SCALE
        : safeSize;
    };

    const scaleRenderedHighwayGothicTextElement = (element) => {
      if (!element || element.dataset.highwayGothicTextScaled === "true") {
        return;
      }

      element.dataset.highwayGothicTextScaled = "true";

      requestAnimationFrame(() => {
        const computedFontSize = parseFloat(
          window.getComputedStyle(element).fontSize
        );

        if (Number.isFinite(computedFontSize) && computedFontSize > 0) {
          element.style.fontSize =
            computedFontSize * HIGHWAY_GOTHIC_TEXT_RENDER_SCALE + "px";
        }
      });
    };
    
    const HISTORY_LIMIT = 100;
    let undoStack = [];
    let redoStack = [];
    let isApplyingHistory = false;
    let pendingBeforeSnapshot = null;

    const getSelectionSnapshot = () => ({
      currentlySelectedPanelIndex,
      currentlySelectedSubPanelIndex,
      currentlySelectedExitTabIndex,
      currentlySelectedNestedExitTabIndex,
      currentlySelectedRowIndex,
      currentlySelectedBlockIndex,
      currentlySelectedAPLArrowIndex,
      fileInfo: { ...fileInfo },
    });

    const applySelectionSnapshot = (selection = {}) => {
      currentlySelectedPanelIndex =
        typeof selection.currentlySelectedPanelIndex === "number"
          ? selection.currentlySelectedPanelIndex
          : currentlySelectedPanelIndex;
      currentlySelectedSubPanelIndex =
        typeof selection.currentlySelectedSubPanelIndex === "number"
          ? selection.currentlySelectedSubPanelIndex
          : currentlySelectedSubPanelIndex;
      currentlySelectedExitTabIndex =
        typeof selection.currentlySelectedExitTabIndex === "number"
          ? selection.currentlySelectedExitTabIndex
          : currentlySelectedExitTabIndex;
      currentlySelectedNestedExitTabIndex =
        typeof selection.currentlySelectedNestedExitTabIndex === "number"
          ? selection.currentlySelectedNestedExitTabIndex
          : currentlySelectedNestedExitTabIndex;
      currentlySelectedRowIndex =
        typeof selection.currentlySelectedRowIndex === "number"
          ? selection.currentlySelectedRowIndex
          : currentlySelectedRowIndex;
      currentlySelectedBlockIndex =
        typeof selection.currentlySelectedBlockIndex === "number"
          ? selection.currentlySelectedBlockIndex
          : currentlySelectedBlockIndex;
      currentlySelectedAPLArrowIndex =
        typeof selection.currentlySelectedAPLArrowIndex === "number"
          ? selection.currentlySelectedAPLArrowIndex
          : currentlySelectedAPLArrowIndex;

      if (selection.fileInfo && typeof selection.fileInfo === "object") {
        fileInfo = {
          fileType:
            typeof selection.fileInfo.fileType === "string"
              ? selection.fileInfo.fileType
              : fileInfo.fileType,
          panel:
            typeof selection.fileInfo.panel === "number"
              ? selection.fileInfo.panel
              : fileInfo.panel,
          selectedPanelIndices: Array.isArray(selection.fileInfo.selectedPanelIndices)
            ? selection.fileInfo.selectedPanelIndices
                .map((panelIndex) => Number(panelIndex))
                .filter((panelIndex) => Number.isInteger(panelIndex) && panelIndex >= 0)
            : Array.isArray(fileInfo.selectedPanelIndices)
              ? fileInfo.selectedPanelIndices
              : [],
        };
      }
    };
    
    const normalizeSelectionForCurrentPost = () => {
      if (!post || !Array.isArray(post.panels) || post.panels.length === 0) {
        currentlySelectedPanelIndex = -1;
        currentlySelectedSubPanelIndex = 0;
        currentlySelectedExitTabIndex = 0;
        currentlySelectedNestedExitTabIndex = -1;
        currentlySelectedRowIndex = 0;
        currentlySelectedBlockIndex = 0;
        currentlySelectedAPLArrowIndex = 0;
        return;
      }

      currentlySelectedPanelIndex = clamp(
        currentlySelectedPanelIndex,
        0,
        post.panels.length - 1
      );

      const panel = post.panels[currentlySelectedPanelIndex];

      if (panel?.sign?.subPanels?.length) {
        currentlySelectedSubPanelIndex = clamp(
          currentlySelectedSubPanelIndex,
          GLOBAL_TOP_SUBPANEL_INDEX,
          panel.sign.subPanels.length - 1
        );
      } else {
        currentlySelectedSubPanelIndex = GLOBAL_BOTTOM_SUBPANEL_INDEX;
      }

      if (panel?.exitTabs?.length) {
        currentlySelectedExitTabIndex = clamp(
          currentlySelectedExitTabIndex,
          0,
          panel.exitTabs.length - 1
        );

        const exitTab = panel.exitTabs[currentlySelectedExitTabIndex];
        const nestedCount = Array.isArray(exitTab?.nestedExitTabs)
          ? exitTab.nestedExitTabs.length
          : 0;

        if (nestedCount > 0) {
          currentlySelectedNestedExitTabIndex = clamp(
            currentlySelectedNestedExitTabIndex,
            -1,
            nestedCount - 1
          );
        } else {
          currentlySelectedNestedExitTabIndex = -1;
        }
      } else {
        currentlySelectedExitTabIndex = 0;
        currentlySelectedNestedExitTabIndex = -1;
      }

      const workingSubPanel =
        currentlySelectedSubPanelIndex < 0
          ? getCurrentSubPanel()
          : panel?.sign?.subPanels?.[currentlySelectedSubPanelIndex];

      const rows = workingSubPanel?.blockElements?.rows;

      if (Array.isArray(rows) && rows.length > 0) {
        currentlySelectedRowIndex = clamp(
          currentlySelectedRowIndex,
          0,
          rows.length - 1
        );

        const row = rows[currentlySelectedRowIndex];
        if (Array.isArray(row) && row.length > 0) {
          currentlySelectedBlockIndex = clamp(
            currentlySelectedBlockIndex,
            0,
            row.length - 1
          );
        } else {
          currentlySelectedBlockIndex = 0;
        }
      } else {
        currentlySelectedRowIndex = 0;
        currentlySelectedBlockIndex = 0;
      }

      const aplArrows =
        panel.sign.arrowMode === "apl" ? panel.sign.aplArrows || [] : [];
      if (Array.isArray(aplArrows) && aplArrows.length > 0) {
        currentlySelectedAPLArrowIndex = clamp(
          currentlySelectedAPLArrowIndex,
          0,
          aplArrows.length - 1
        );
      } else {
        currentlySelectedAPLArrowIndex = 0;
      }

      if (typeof fileInfo?.panel === "number") {
        if (fileInfo.panel >= post.panels.length) {
          fileInfo.panel = post.panels.length - 1;
        }
        if (fileInfo.panel < -1) {
          fileInfo.panel = -1;
        }
      }

      getDownloadPanelSelection();
    };


    const normalizeSubpanelDividerSettings = (sign) => {
      if (!sign || !Array.isArray(sign.subPanels)) {
        return [];
      }

      const dividerCount = Math.max(0, sign.subPanels.length - 1);

      if (!Array.isArray(sign.disabledSubpanelDividers)) {
        sign.disabledSubpanelDividers = [];
      }

      const normalized = [];

      for (let index = 0; index < dividerCount; index++) {
        normalized[index] = sign.disabledSubpanelDividers[index] === true;
      }

      sign.disabledSubpanelDividers = normalized;
      return sign.disabledSubpanelDividers;
    };

    const isSubpanelDividerVisibleForSign = (sign, dividerIndex) => {
      if (!sign || !Array.isArray(sign.subPanels)) {
        return false;
      }

      const normalizedIndex = Number(dividerIndex);

      if (
        !Number.isFinite(normalizedIndex) ||
        normalizedIndex < 0 ||
        normalizedIndex >= Math.max(0, sign.subPanels.length - 1)
      ) {
        return false;
      }

      const disabledDividers = normalizeSubpanelDividerSettings(sign);
      return disabledDividers[normalizedIndex] !== true;
    };

    const formatSubpanelNumberList = (numbers) => {
      const labels = Array.isArray(numbers) ? numbers.map(String) : [];

      if (labels.length === 0) {
        return "";
      }

      if (labels.length === 1) {
        return labels[0];
      }

      if (labels.length === 2) {
        return `${labels[0]} and ${labels[1]}`;
      }

      return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
    };

    const getAPLSubpanelGroupsForSign = (sign) => {
      if (!sign || !Array.isArray(sign.subPanels) || sign.subPanels.length === 0) {
        return [];
      }

      normalizeSubpanelDividerSettings(sign);

      const groups = [];
      let currentGroup = {
        start: 0,
        end: 0,
        indices: [0],
      };

      for (let subPanelIndex = 0; subPanelIndex < sign.subPanels.length - 1; subPanelIndex++) {
        if (isSubpanelDividerVisibleForSign(sign, subPanelIndex)) {
          groups.push(currentGroup);
          currentGroup = {
            start: subPanelIndex + 1,
            end: subPanelIndex + 1,
            indices: [subPanelIndex + 1],
          };
        } else {
          currentGroup.end = subPanelIndex + 1;
          currentGroup.indices.push(subPanelIndex + 1);
        }
      }

      groups.push(currentGroup);

      return groups.map((group, groupIndex) => ({
        ...group,
        groupIndex,
        label:
          group.indices.length === 1
            ? `Subpanel ${group.indices[0] + 1}`
            : `Subpanels ${formatSubpanelNumberList(
                group.indices.map((index) => index + 1)
              )}`,
      }));
    };

    const getAPLGroupForSubPanelIndex = (sign, subPanelIndex) => {
      const groups = getAPLSubpanelGroupsForSign(sign);
      const normalizedIndex = Number(subPanelIndex);

      return (
        groups.find((group) => group.indices.includes(normalizedIndex)) ||
        groups[0] ||
        null
      );
    };

    const getAPLGroupStartForSubPanelIndex = (sign, subPanelIndex) => {
      const group = getAPLGroupForSubPanelIndex(sign, subPanelIndex);
      return group ? group.start : 0;
    };

    const getVisibleAPLDividerIndicesForSign = (sign) =>
      getAPLSubpanelGroupsForSign(sign)
        .slice(0, -1)
        .map((group) => group.end)
        .filter((dividerIndex) => isSubpanelDividerVisibleForSign(sign, dividerIndex));

    const getNearestVisibleAPLDividerIndex = (sign, dividerIndex) => {
      const visibleDividers = getVisibleAPLDividerIndicesForSign(sign);

      if (!visibleDividers.length) {
        return null;
      }

      const normalizedIndex = Number(dividerIndex);

      if (
        Number.isFinite(normalizedIndex) &&
        visibleDividers.includes(normalizedIndex)
      ) {
        return normalizedIndex;
      }

      return visibleDividers[0];
    };

    const normalizeAPLArrowsForSubpanelDividerGroups = (sign) => {
      if (!sign || !Array.isArray(sign.aplArrows)) {
        return;
      }

      normalizeSubpanelDividerSettings(sign);

      sign.aplArrows = sign.aplArrows.filter((arrow) => {
        if (arrow?.placement !== "divider") {
          return true;
        }

        return isSubpanelDividerVisibleForSign(
          sign,
          arrow.dividerAfterSubPanelIndex
        );
      });

      for (const arrow of sign.aplArrows) {
        if (!arrow || arrow.placement === "divider") {
          continue;
        }

        arrow.subPanelIndex = getAPLGroupStartForSubPanelIndex(
          sign,
          typeof arrow.subPanelIndex === "number" ? arrow.subPanelIndex : 0
        );
      }
    };

    const setSubpanelDividerVisible = function (dividerIndex, visible) {
      return runWithUndo(() => {
        const sign = getCurrentPanel()?.sign;

        if (!sign || !Array.isArray(sign.subPanels)) {
          return;
        }

        const rawIndex = Number(dividerIndex);

        if (!Number.isFinite(rawIndex)) {
          return;
        }

        const normalizedIndex = clamp(
          rawIndex,
          0,
          Math.max(0, sign.subPanels.length - 2)
        );

        const disabledDividers = normalizeSubpanelDividerSettings(sign);
        disabledDividers[normalizedIndex] = visible === false;

        normalizeAPLArrowsForSubpanelDividerGroups(sign);

        formHandler.updateForm();
        redraw();
      });
    };

    const getAPLSubpanelGroupsForCurrentPanel = () => {
      const sign = getCurrentPanel()?.sign;
      return getAPLSubpanelGroupsForSign(sign);
    };

    const isSubpanelDividerVisible = (dividerIndex) => {
      const sign = getCurrentPanel()?.sign;
      return isSubpanelDividerVisibleForSign(sign, dividerIndex);
    };

    const historyReplacer = (key, value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return value;
      }

      const ctorName =
        value.constructor && value.constructor.name
          ? value.constructor.name
          : null;

      if (!ctorName || ctorName === "Object") {
        return value;
      }

      return {
        __undoType: ctorName,
        ...value,
      };
    };

    const historyReviver = (key, value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return value;
      }

      const typeName = value.__undoType;
      if (!typeName) {
        return value;
      }

      delete value.__undoType;

      const ctor =
        typeof window !== "undefined" && typeof window[typeName] === "function"
          ? window[typeName]
          : null;

      if (!ctor) {
        return value;
      }

      return Object.assign(Object.create(ctor.prototype), value);
    };

    const serializeAppState = () => {
      try {
        return JSON.stringify(
          {
            post,
            selection: getSelectionSnapshot(),
          },
          historyReplacer
        );
      } catch (error) {
        console.error("Failed to serialize undo state", error);
        return null;
      }
    };
    
    const saveAppState = () => {
      try {
        const snapshot = serializeAppState();
        if (snapshot) {
          window.localStorage.setItem(APP_STORAGE_KEY, snapshot);
        }
      } catch (error) {
        console.error("Failed to save app state", error);
      }
    };
    
    const normalizeRestoreOnRefreshMode = (value) => {
      const normalized = String(value || "").toLowerCase();
      if (normalized === "always" || normalized === "prompt" || normalized === "never") {
        return normalized;
      }
      return "always";
    };

    const getRestoreOnRefreshMode = () => {
      try {
        return normalizeRestoreOnRefreshMode(
          window.localStorage.getItem(RESTORE_ON_REFRESH_STORAGE_KEY)
        );
      } catch (error) {
        console.error("Failed to read restore-on-refresh setting", error);
        return "always";
      }
    };

    const loadSavedAppState = () => {
      try {
        const snapshot = window.localStorage.getItem(APP_STORAGE_KEY);
        if (!snapshot) {
          return false;
        }

        const restoreMode = getRestoreOnRefreshMode();

        if (restoreMode === "never") {
          return false;
        }

        if (restoreMode === "prompt") {
          const shouldRestore = window.confirm(
            "Restore your previous sign from the last refresh?"
          );
          if (!shouldRestore) {
            return false;
          }
        }

        restoreAppState(snapshot);
        return true;
      } catch (error) {
        console.error("Failed to load saved app state", error);
        return false;
      }
    };

    const reconstructPostFromSnapshot = (postData) => {
      if (!postData) {
        return null;
      }

      const reconstructControl = (controlData) => {
        const control = new Control();
        const rows = [];
        const blockProperties = [];

        if (Array.isArray(controlData?.rows)) {
          for (const rowData of controlData.rows) {
            const row = [];

            if (Array.isArray(rowData)) {
              for (const elemData of rowData) {
                let elemType = elemData?._elementType;

                if (!elemType && Control.prototype.blockToClassElems) {
                  if (elemData.icon !== undefined) {
                    elemType = "IconElement";
                  } else if (elemData.arrow !== undefined) {
                    elemType = "ArrowElement";
                  } else if (
                    elemData.logo !== undefined ||
                    elemData.tollLogo !== undefined
                  ) {
                    elemType = "TollLogoElement";
                  } else if (
                    elemData.shieldBase !== undefined ||
                    elemData.type !== undefined
                  ) {
                    elemType = "ShieldElement";
                  } else if (elemData.dividerWidth !== undefined) {
                    elemType = "DividerElement";
                  } else if (
                    elemData.beacon !== undefined ||
                    (elemData.size !== undefined &&
                      elemData.color !== undefined &&
                      !elemData.textContent)
                  ) {
                    elemType = "BeaconElement";
                  } else if (elemData.textContent !== undefined) {
                    if (elemData.glow !== undefined) {
                      elemType = "ElectronicSignElement";
                    } else if (
                      elemData.borderRadius !== undefined &&
                      elemData.horizPadding !== undefined
                    ) {
                      elemType = "AdvisoryMessageElement";
                    } else if (elemData.spacing !== undefined) {
                      elemType = "ControlTextElement";
                    } else {
                      elemType = "ActionMessageElement";
                    }
                  }
                }

                if (
                  elemType &&
                  Control.prototype.blockToClassElems &&
                  Control.prototype.blockToClassElems[elemType]
                ) {
                  const ElemClass = Control.prototype.blockToClassElems[elemType];
                  const elem = new ElemClass(elemData);
                  Object.assign(elem, elemData);
                  delete elem._elementType;
                  row.push(elem);
                }
              }
            }

            rows.push(row);

            const blockIndex = rows.length - 1;
            const blockData = controlData?.blockProperties?.[blockIndex];
            if (blockData) {
              const block = new Block(blockData);
              Object.assign(block, blockData);
              blockProperties.push(block);
            } else {
              blockProperties.push(new Block());
            }
          }
        }

        control.rows = rows;
        control.blockProperties = blockProperties;
        return control;
      };

      const newPost = new Post(
        postData.polePosition || "Right",
        postData.lanesWide || 1,
        postData.color || Post.prototype.colors[0]
      );

      if (typeof postData.panelSpacing === "number") {
        newPost.panelSpacing = postData.panelSpacing;
      }
      if (typeof postData.thickness === "number") {
        newPost.thickness = postData.thickness;
      }
      if (typeof postData.showPost === "boolean") {
        newPost.showPost = postData.showPost;
      }
      if (typeof postData.disableFlash === "boolean") {
        newPost.disableFlash = postData.disableFlash;
      }
      if (typeof postData.secondExitOnly === "boolean") {
        newPost.secondExitOnly = postData.secondExitOnly;
      }

      newPost.panels = [];

      if (Array.isArray(postData.panels)) {
        for (const panelData of postData.panels) {
          const subPanels = [];

          if (Array.isArray(panelData.sign?.subPanels)) {
            for (const subPanelData of panelData.sign.subPanels) {
              const blockElements = reconstructControl(subPanelData.blockElements);

              const subPanel = new SubPanels({
                blockElements,
              });
              Object.assign(subPanel, subPanelData);
              subPanel.blockElements = blockElements;
              subPanels.push(subPanel);
            }
          }

          const signData = panelData.sign || {};
          const sign = new Sign({
            subPanels,
          });

          if (Array.isArray(signData.shields)) {
            sign.shields = signData.shields.map((shieldData) => {
              const shield = new Shield(shieldData);
              Object.assign(shield, shieldData);
              return shield;
            });
          }

          Object.assign(sign, signData);
          sign.subPanels = subPanels;
          
          if (signData.globalTopBlockElements) {
            sign.globalTopBlockElements = reconstructControl(signData.globalTopBlockElements);
          }

          if (signData.globalBottomBlockElements) {
            sign.globalBottomBlockElements = reconstructControl(signData.globalBottomBlockElements);
          } else if (signData.blockElements) {
            sign.globalBottomBlockElements = reconstructControl(signData.blockElements);
          }

          const panel = new Panel(
            sign,
            panelData.color,
            [],
            panelData.corner,
            panelData.borderRadius
          );

          if (Array.isArray(panelData.exitTabs)) {
            panel.exitTabs = panelData.exitTabs.map((exitTabData) => {
              const exitTab = new ExitTab(exitTabData);
              Object.assign(exitTab, exitTabData);

              if (Array.isArray(exitTabData.nestedExitTabs)) {
                exitTab.nestedExitTabs = exitTabData.nestedExitTabs.map(
                  (nestedData) => {
                    const nested = new ExitTab(nestedData);
                    Object.assign(nested, nestedData);
                    return nested;
                  }
                );
              }

              return exitTab;
            });
          }

          Object.assign(panel, panelData);
          panel.sign = sign;
          newPost.panels.push(panel);
        }
      }

      return newPost;
    };
    
    
    
    const restoreAppState = (snapshot) => {
      if (!snapshot) {
        return;
      }

      try {
        const parsed = JSON.parse(snapshot);
        if (!parsed || !parsed.post) {
          return;
        }

        isApplyingHistory = true;

        const rebuiltPost = reconstructPostFromSnapshot(parsed.post);
        if (!rebuiltPost) {
          return;
        }

        post = rebuiltPost;

        const clampSelection = (value, min, max, fallback) => {
          if (typeof value !== "number" || Number.isNaN(value)) {
            return fallback;
          }
          return Math.max(min, Math.min(value, max));
        };

        const panelCount = post?.panels?.length ?? 0;
        currentlySelectedPanelIndex = clampSelection(
          parsed.selection?.currentlySelectedPanelIndex ?? 0,
          0,
          Math.max(0, panelCount - 1),
          0
        );

        const currentPanel = post?.panels?.[currentlySelectedPanelIndex];

        const subPanelCount = currentPanel?.sign?.subPanels?.length ?? 0;
        currentlySelectedSubPanelIndex = clampSelection(
          parsed.selection?.currentlySelectedSubPanelIndex ?? 0,
          GLOBAL_TOP_SUBPANEL_INDEX,
          Math.max(GLOBAL_BOTTOM_SUBPANEL_INDEX, subPanelCount - 1),
          0
        );

        const exitTabCount = currentPanel?.exitTabs?.length ?? 0;
        currentlySelectedExitTabIndex = clampSelection(
          parsed.selection?.currentlySelectedExitTabIndex ?? 0,
          0,
          Math.max(0, exitTabCount - 1),
          0
        );

        const currentExitTab =
          currentPanel?.exitTabs?.[currentlySelectedExitTabIndex];
        const nestedCount = currentExitTab?.nestedExitTabs?.length ?? 0;
        currentlySelectedNestedExitTabIndex = clampSelection(
          parsed.selection?.currentlySelectedNestedExitTabIndex ?? -1,
          -1,
          Math.max(-1, nestedCount - 1),
          -1
        );

        const workingSubPanel =
          currentlySelectedSubPanelIndex < 0
            ? getCurrentSubPanel()
            : currentPanel?.sign?.subPanels?.[currentlySelectedSubPanelIndex];

        const rowCount = workingSubPanel?.blockElements?.rows?.length ?? 0;
        currentlySelectedRowIndex = clampSelection(
          parsed.selection?.currentlySelectedRowIndex ?? 0,
          0,
          Math.max(0, rowCount - 1),
          0
        );

        const rowLength =
          workingSubPanel?.blockElements?.rows?.[currentlySelectedRowIndex]?.length ?? 0;

        currentlySelectedBlockIndex = clampSelection(
          parsed.selection?.currentlySelectedBlockIndex ?? 0,
          0,
          Math.max(0, rowLength - 1),
          0
        );

        const aplCount = currentPanel?.sign?.aplArrows?.length ?? 0;
        currentlySelectedAPLArrowIndex = clampSelection(
          parsed.selection?.currentlySelectedAPLArrowIndex ?? 0,
          0,
          Math.max(0, aplCount - 1),
          0
        );

        if (parsed.selection?.fileInfo && typeof parsed.selection.fileInfo === "object") {
          fileInfo = {
            fileType:
              typeof parsed.selection.fileInfo.fileType === "string"
                ? parsed.selection.fileInfo.fileType
                : fileInfo.fileType,
            panel:
              typeof parsed.selection.fileInfo.panel === "number"
                ? parsed.selection.fileInfo.panel
                : fileInfo.panel,
          };
        }

        formHandler.updateForm();
        redraw();
      } catch (error) {
        console.error("Failed to restore undo state", error);
      } finally {
        isApplyingHistory = false;
      }
    };
    const updateUndoButtons = () => {
        const undoSelectors = [
          "#undo",
          "#undoButton",
          "#undoBtn",
          "[data-action='undo']",
          "[aria-label='Undo']",
          "[title='Undo (CTRL+Z)']",
        ];

        for (const selector of undoSelectors) {
          const button = document.querySelector(selector);
          if (button) {
            button.disabled = undoStack.length === 0;
          }
        }

        const redoSelectors = [
          "#redoButton",
          "#redoBtn",
          "[data-action='redo']",
          "[aria-label='Redo (CTRL+Y)']",
          "[title='Redo (CTRL+Y)']",
        ];

        for (const selector of redoSelectors) {
          const button = document.querySelector(selector);
          if (button) {
            button.disabled = redoStack.length === 0;
          }
        }
    };

    const pushUndoSnapshot = (snapshot) => {
      if (!snapshot) {
        return;
      }
      if (undoStack.length && undoStack[undoStack.length - 1] === snapshot) {
        return;
      }
      undoStack.push(snapshot);
      if (undoStack.length > HISTORY_LIMIT) {
        undoStack.shift();
      }
      updateUndoButtons();
    };

    const beginUndoableChange = () => {
      if (isApplyingHistory) {
        return;
      }
      if (pendingBeforeSnapshot !== null) {
        return;
      }
      pendingBeforeSnapshot = serializeAppState();
    };

    const endUndoableChange = () => {
      if (isApplyingHistory) {
        pendingBeforeSnapshot = null;
        return;
      }

      if (pendingBeforeSnapshot === null) {
        return;
      }

        const afterSnapshot = serializeAppState();
          if (afterSnapshot && afterSnapshot !== pendingBeforeSnapshot) {
            pushUndoSnapshot(pendingBeforeSnapshot);
            redoStack.length = 0;
        }

        pendingBeforeSnapshot = null;
        updateUndoButtons();
        saveAppState();
    };

    const runWithUndo = (callback) => {
      beginUndoableChange();
      const result = callback();
      endUndoableChange();
      return result;
    };

    const undo = () => {
      if (!undoStack.length || isApplyingHistory) {
        return;
      }

      const currentSnapshot = serializeAppState();
      const previousSnapshot = undoStack.pop();

      if (currentSnapshot) {
        redoStack.push(currentSnapshot);
        if (redoStack.length > HISTORY_LIMIT) {
          redoStack.shift();
        }
      }

      restoreAppState(previousSnapshot);
      updateUndoButtons();
        saveAppState();
    };

    const redo = () => {
      if (!redoStack.length || isApplyingHistory) {
        return;
      }

      const currentSnapshot = serializeAppState();
      const nextSnapshot = redoStack.pop();

      if (currentSnapshot) {
        pushUndoSnapshot(currentSnapshot);
      }

      restoreAppState(nextSnapshot);
      updateUndoButtons();
        saveAppState();
    };
    
    const clearAll = () => {
      return runWithUndo(() => {
          const previousShowPost =
            typeof post?.showPost === "boolean" ? post.showPost : true;

          post = new Post(DEFAULT_POST_POSITION);
          post.panelSpacing = DEFAULT_PANEL_SPACING;
          post.showPost = previousShowPost;

          try {
            window.localStorage.setItem("signMaker.postPosition", DEFAULT_POST_POSITION);
            window.localStorage.setItem("signMaker.showPost", String(!!post.showPost));
          } catch (error) {
            console.warn("Unable to reset saved post settings", error);
          }

        currentlySelectedPanelIndex = -1;
        currentlySelectedSubPanelIndex = 0;
        currentlySelectedExitTabIndex = 0;
        currentlySelectedNestedExitTabIndex = -1;
        currentlySelectedRowIndex = 0;
        currentlySelectedBlockIndex = 0;
        currentlySelectedAPLArrowIndex = 0;

        fileInfo = {
          fileType: "png",
          panel: -1,
          selectedPanelIndices: [],
        };

        post.newPanel();
        currentlySelectedPanelIndex = post.panels.length - 1;

        redoStack.length = 0;

        formHandler.updateForm();
        redraw();
        saveAppState();
      });
    };
    
  const applyHighwayGothicStyling = (element, fontFamily = "Series E") => {
    if (!element) {
      return;
    }
    element.style.fontFamily = fontFamily;
    element.style.setProperty("--fhwaBaselineOffset", FHWA_BASELINE_OFFSET_VAR);
  };
    

    const applyExitOnlyTextSizing = (element) => {
      if (!element) {
        return;
      }

      if (post.fontType === true) {
        applyHighwayGothicStyling(element);
      } else {
        element.style.removeProperty("font-family");
        element.style.removeProperty("--fhwaBaselineOffset");
      }
    };
    
  const applyPanelBorderGradient = (signElmt) => {
    if (!signElmt || !signElmt.isConnected) {
      return;
    }

    const computed = window.getComputedStyle(signElmt);
    const fillColor =
      computed.backgroundColor && computed.backgroundColor !== "rgba(0, 0, 0, 0)"
        ? computed.backgroundColor
        : "transparent";
    const defaultBorderColor =
      computed.borderTopColor && computed.borderTopColor !== "rgba(0, 0, 0, 0)"
        ? computed.borderTopColor
        : "currentColor";

    const syncDynamicCornerPatches = (topCornerColor, bottomCornerColor) => {
      const signContainerElmt = signElmt.closest(".signContainer");

      if (!signContainerElmt) {
        return;
      }

      const ensurePatch = (position) => {
        const className = `dynamicSignCornerPatch ${position}`;
        let patchElmt = signContainerElmt.querySelector(
          `:scope > .dynamicSignCornerPatch.${position}`
        );

        if (!patchElmt) {
          patchElmt = document.createElement("div");
          patchElmt.className = className;
          signContainerElmt.insertBefore(patchElmt, signContainerElmt.firstChild);
        }

        return patchElmt;
      };

      const syncPatch = (position, color) => {
        const patchElmt = signContainerElmt.querySelector(
          `:scope > .dynamicSignCornerPatch.${position}`
        );

        if (!color) {
          patchElmt?.remove();
          signContainerElmt.removeAttribute(`data-dynamic-${position}-corner`);
          signContainerElmt.style.removeProperty(
            `--dynamicSign${position === "top" ? "Top" : "Bottom"}CornerColor`
          );
          return;
        }

        const nextPatch = ensurePatch(position);
        nextPatch.style.backgroundColor = color;
        signContainerElmt.dataset[`dynamic${position[0].toUpperCase()}${position.slice(1)}Corner`] = "true";
        signContainerElmt.style.setProperty(
          `--dynamicSign${position === "top" ? "Top" : "Bottom"}CornerColor`,
          color
        );
      };

      syncPatch("top", topCornerColor);
      syncPatch("bottom", bottomCornerColor);

      const hasPatches = !!signContainerElmt.querySelector(
        ":scope > .dynamicSignCornerPatch"
      );
      signContainerElmt.classList.toggle(
        "hasDynamicSignCornerPatches",
        hasPatches
      );
    };

    const clearDynamicPanelBackground = () => {
      signElmt.style.removeProperty("background-image");
      signElmt.style.removeProperty("background-origin");
      signElmt.style.removeProperty("background-clip");
      signElmt.style.removeProperty("background-repeat");
      signElmt.style.removeProperty("background-position");
      signElmt.style.removeProperty("background-size");
      signElmt.style.removeProperty("border-color");
      syncDynamicCornerPatches(null, null);
    };

    const backgroundRows = Array.from(
      signElmt.querySelectorAll(".blockElementRow[data-full-bleed-background-color]")
    ).filter((row) => row.dataset.fullBleedBackgroundColor);

    const borderRows = Array.from(
      signElmt.querySelectorAll(
        ".blockElementRow[data-full-bleed-background-color], .blockElementRow[data-full-bleed-border-color]"
      )
    ).filter(
      (row, index, rows) =>
        rows.indexOf(row) === index &&
        (row.dataset.fullBleedBackgroundColor || row.dataset.fullBleedBorderColor)
    );

    if (!backgroundRows.length && !borderRows.length) {
      clearDynamicPanelBackground();
      return;
    }

    const signRect = signElmt.getBoundingClientRect();
    const signHeight = signRect.height;

    if (!signHeight) {
      clearDynamicPanelBackground();
      return;
    }

    const getRowsInside = (root, dataAttribute) => {
      if (!root) {
        return [];
      }

      return Array.from(
        root.querySelectorAll(`.blockElementRow[${dataAttribute}]`)
      ).filter((row) => row.dataset[dataAttribute.replace(/^data-/, "").replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())]);
    };

    const getBackgroundRowsInside = (root) =>
      root
        ? Array.from(
            root.querySelectorAll(".blockElementRow[data-full-bleed-background-color]")
          ).filter((row) => row.dataset.fullBleedBackgroundColor)
        : [];

    const getBorderRowsInside = (root) =>
      root
        ? Array.from(
            root.querySelectorAll(
              ".blockElementRow[data-full-bleed-background-color], .blockElementRow[data-full-bleed-border-color]"
            )
          ).filter(
            (row, index, rows) =>
              rows.indexOf(row) === index &&
              (row.dataset.fullBleedBackgroundColor || row.dataset.fullBleedBorderColor)
          )
        : [];

    const resolveCssColor = (color) => {
      const rawColor = String(color || "").trim();

      if (!rawColor) {
        return "";
      }

      if (/^rgba?\(/i.test(rawColor)) {
        return rawColor;
      }

      const probe = document.createElement("span");
      probe.style.color = rawColor;
      probe.style.position = "absolute";
      probe.style.left = "-9999px";
      probe.style.top = "-9999px";
      probe.style.pointerEvents = "none";
      document.body.appendChild(probe);
      const resolvedColor = window.getComputedStyle(probe).color;
      probe.remove();
      return resolvedColor || rawColor;
    };

    const getContrastingBorderColor = (backgroundColor) => {
      const resolvedColor = resolveCssColor(backgroundColor);
      const match = resolvedColor.match(
        /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i
      );

      if (!match) {
        return defaultBorderColor;
      }

      const r = Number(match[1]);
      const g = Number(match[2]);
      const b = Number(match[3]);

      if (![r, g, b].every(Number.isFinite)) {
        return defaultBorderColor;
      }

      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      return luminance > 0.58
        ? ((lib?.colors && lib.colors.Black) || "black")
        : ((lib?.colors && lib.colors.White) || "white");
    };

    const getRowSpan = (rowEl, rowsInGlobalTop, rowsInGlobalBottom) => {
      const rowRect = rowEl.getBoundingClientRect();
      let start = rowRect.top - signRect.top;
      let end = rowRect.bottom - signRect.top;

      if (end <= start) {
        return null;
      }

      const globalTop = rowEl.closest(".globalTop");
      const globalBottom = rowEl.closest(".globalBottom");

      if (globalTop && rowsInGlobalTop[0] === rowEl) {
        start = 0;
      }

      if (
        globalBottom &&
        rowsInGlobalBottom[rowsInGlobalBottom.length - 1] === rowEl
      ) {
        end = signHeight;
      }

      const startPct = Math.max(0, Math.min(100, (start / signHeight) * 100));
      const endPct = Math.max(0, Math.min(100, (end / signHeight) * 100));

      if (endPct <= startPct) {
        return null;
      }

      return {
        start: startPct,
        end: endPct,
      };
    };

    const buildSegments = (rows, getColor, getGlobalRows) => {
      const segments = [];

      for (const rowEl of rows) {
        const color = getColor(rowEl);

        if (!color) {
          continue;
        }

        const globalTop = rowEl.closest(".globalTop");
        const globalBottom = rowEl.closest(".globalBottom");
        const rowsInGlobalTop = globalTop ? getGlobalRows(globalTop) : [];
        const rowsInGlobalBottom = globalBottom ? getGlobalRows(globalBottom) : [];
        const span = getRowSpan(rowEl, rowsInGlobalTop, rowsInGlobalBottom);

        if (!span) {
          continue;
        }

        segments.push({
          ...span,
          color,
        });
      }

      segments.sort((a, b) => a.start - b.start);

      const mergedSegments = [];
      for (const segment of segments) {
        const previous = mergedSegments[mergedSegments.length - 1];

        if (
          previous &&
          previous.color === segment.color &&
          segment.start <= previous.end
        ) {
          previous.end = Math.max(previous.end, segment.end);
        } else {
          mergedSegments.push({ ...segment });
        }
      }

      return mergedSegments;
    };

    const buildGradient = (segments, gapColor) => {
      const gradientStops = [];
      let cursor = 0;

      const addSegment = (color, start, end) => {
        const startClamped = Math.max(0, Math.min(100, start));
        const endClamped = Math.max(0, Math.min(100, end));

        if (endClamped <= startClamped) {
          return;
        }

        gradientStops.push(
          `${color} ${startClamped.toFixed(4)}%`,
          `${color} ${endClamped.toFixed(4)}%`
        );
      };

      for (const segment of segments) {
        if (segment.start > cursor) {
          addSegment(gapColor, cursor, segment.start);
        }

        addSegment(segment.color, Math.max(cursor, segment.start), segment.end);
        cursor = Math.max(cursor, segment.end);
      }

      if (cursor < 100) {
        addSegment(gapColor, cursor, 100);
      }

      return `linear-gradient(to bottom, ${gradientStops.join(", ")})`;
    };

    const backgroundSegments = buildSegments(
      backgroundRows,
      (row) => row.dataset.fullBleedBackgroundColor,
      getBackgroundRowsInside
    );

    const borderSegments = buildSegments(
      borderRows,
      (row) =>
        row.dataset.fullBleedBorderColor ||
        getContrastingBorderColor(row.dataset.fullBleedBackgroundColor),
      getBorderRowsInside
    );

    if (!backgroundSegments.length && !borderSegments.length) {
      clearDynamicPanelBackground();
      return;
    }

    const contentGradient = buildGradient(backgroundSegments, fillColor);
    const borderGradient = buildGradient(borderSegments, defaultBorderColor);

    const getBackgroundSegmentTouchingEdge = (edge) => {
      if (!backgroundSegments.length) {
        return null;
      }

      if (edge === "top") {
        return (
          backgroundSegments.find((segment) => segment.start <= 0.001) || null
        );
      }

      return (
        [...backgroundSegments]
          .reverse()
          .find((segment) => segment.end >= 99.999) || null
      );
    };

    syncDynamicCornerPatches(
      getBackgroundSegmentTouchingEdge("top")?.color || null,
      getBackgroundSegmentTouchingEdge("bottom")?.color || null
    );

    signElmt.style.borderColor = "transparent";
    signElmt.style.backgroundImage = `${contentGradient}, ${borderGradient}`;
    signElmt.style.backgroundOrigin = "border-box, border-box";
    signElmt.style.backgroundClip = "padding-box, border-box";
    signElmt.style.backgroundRepeat = "no-repeat, no-repeat";
    signElmt.style.backgroundPosition = "0 0, 0 0";
    signElmt.style.backgroundSize = "100% 100%, 100% 100%";
  };

  const schedulePanelBorderGradientUpdate = (panelContainerElmt) => {
    if (!panelContainerElmt) {
      return;
    }

    const update = () => {
      const signs = panelContainerElmt.querySelectorAll(".sign");
      for (const signElmt of signs) {
        applyPanelBorderGradient(signElmt);
      }
    };

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(update);
    } else {
      update();
    }
  };
    
    const SIDE_MENU_VIEWPORT_GAP = 24;
    const MIN_POST_VIEW_SCALE = 0.42;
    let postViewportLayoutFrame = null;
    let postViewportLayoutObserver = null;

    const getVisibleSideMenuElements = () => {
      const viewportWidth =
        window.innerWidth || document.documentElement.clientWidth || 0;

      const rawCandidates = [
        document.getElementById("sMConfigBar"),
        document.getElementById("panelSelect"),
        ...document.querySelectorAll(".sMModal"),
      ].filter(Boolean);

      const seen = new Set();
      const candidates = [];

      for (const element of rawCandidates) {
        if (seen.has(element)) {
          continue;
        }
        seen.add(element);

        if (element.id === "sMConfigBar") {
          const configPosition =
            element.dataset.position ||
            document.documentElement.dataset.configPosition ||
            "right";

          if (configPosition === "top" || configPosition === "bottom") {
            continue;
          }
        }

        const styles = window.getComputedStyle(element);

        if (
          styles.display === "none" ||
          styles.visibility === "hidden" ||
          styles.opacity === "0" ||
          element.classList.contains("hidden") ||
          element.classList.contains("invisible")
        ) {
          continue;
        }

        const rect = element.getBoundingClientRect();

        if (rect.width <= 0 || rect.height <= 0) {
          continue;
        }

        if (rect.right <= 0 || rect.left >= viewportWidth) {
          continue;
        }

        const center = rect.left + rect.width / 2;

        candidates.push({
          element,
          pushDirection: center < viewportWidth / 2 ? "left" : "right",
        });
      }

      return candidates;
    };

    const getMainVisualScale = () => {
      const mainEl = document.querySelector("main");
      if (!mainEl) {
        return 1;
      }

      const layoutWidth = mainEl.offsetWidth || mainEl.clientWidth || 0;
      const visualWidth = mainEl.getBoundingClientRect().width || 0;

      if (!layoutWidth || !visualWidth) {
        return 1;
      }

      const scale = visualWidth / layoutWidth;
      return Number.isFinite(scale) && scale > 0 ? scale : 1;
    };

    const updatePostViewportLayout = () => {
      const postContainerElmt = document.getElementById("postContainer");
      if (!postContainerElmt) {
        return;
      }

      const viewportWidth =
        window.innerWidth || document.documentElement.clientWidth || 0;
      const naturalPostWidth = postContainerElmt.offsetWidth || 0;
      const mainVisualScale = getMainVisualScale();

      postContainerElmt.style.transformOrigin = "center center";
      postContainerElmt.style.transition = "transform 280ms ease";
      postContainerElmt.style.willChange = "transform";

      if (!viewportWidth || !naturalPostWidth || !mainVisualScale) {
        postContainerElmt.style.transform = "translateX(0px) scale(1)";
        return;
      }

      const visibleMenus = getVisibleSideMenuElements();
      if (!visibleMenus.length) {
        postContainerElmt.style.transform = "translateX(0px) scale(1)";
        return;
      }

      const leftPushMenus = visibleMenus.filter(
        ({ pushDirection }) => pushDirection === "left"
      );
      const rightPushMenus = visibleMenus.filter(
        ({ pushDirection }) => pushDirection === "right"
      );

      const visiblePostWidthAtNormalScale = naturalPostWidth * mainVisualScale;
      const normalPostLeft = (viewportWidth - visiblePostWidthAtNormalScale) / 2;
      const normalPostRight = normalPostLeft + visiblePostWidthAtNormalScale;

      let leftBlockedEdge = 0;
      let rightBlockedEdge = viewportWidth;

      if (leftPushMenus.length) {
        leftBlockedEdge = Math.max(
          ...leftPushMenus.map(({ element }) => {
            const rect = element.getBoundingClientRect();
            return Math.max(0, Math.min(viewportWidth, rect.right));
          })
        );
      }

      if (rightPushMenus.length) {
        rightBlockedEdge = Math.min(
          ...rightPushMenus.map(({ element }) => {
            const rect = element.getBoundingClientRect();
            return Math.max(0, Math.min(viewportWidth, rect.left));
          })
        );
      }

      const intrudesFromLeft =
        leftBlockedEdge + SIDE_MENU_VIEWPORT_GAP > normalPostLeft;
      const intrudesFromRight =
        rightBlockedEdge - SIDE_MENU_VIEWPORT_GAP < normalPostRight;

      if (!intrudesFromLeft && !intrudesFromRight) {
        postContainerElmt.style.transform = "translateX(0px) scale(1)";
        return;
      }

      const safeLeft = Math.max(0, leftBlockedEdge + SIDE_MENU_VIEWPORT_GAP);
      const safeRight = Math.min(
        viewportWidth,
        rightBlockedEdge - SIDE_MENU_VIEWPORT_GAP
      );
      const availableViewportWidth = Math.max(1, safeRight - safeLeft);

      const targetVisibleCenter = (safeLeft + safeRight) / 2;
      const viewportCenter = viewportWidth / 2;
      const targetVisibleShift = targetVisibleCenter - viewportCenter;
      const targetTranslateX = targetVisibleShift / mainVisualScale;

      const targetScale =
        visiblePostWidthAtNormalScale > availableViewportWidth
          ? Math.max(
              MIN_POST_VIEW_SCALE,
              availableViewportWidth / visiblePostWidthAtNormalScale
            )
          : 1;

      postContainerElmt.style.transform =
        `translateX(${targetTranslateX}px) scale(${Math.min(1, targetScale)})`;
    };

    const schedulePostViewportLayoutUpdate = () => {
      if (postViewportLayoutFrame !== null) {
        window.cancelAnimationFrame(postViewportLayoutFrame);
      }

      postViewportLayoutFrame = window.requestAnimationFrame(() => {
        postViewportLayoutFrame = null;
        updatePostViewportLayout();
      });
    };
    

    const bindPostViewportLayoutWatcher = () => {
      if (postViewportLayoutObserver) {
        return;
      }

      const schedule = () => {
        schedulePostViewportLayoutUpdate();

        window.requestAnimationFrame(() => {
          schedulePostViewportLayoutUpdate();
        });

        setTimeout(schedulePostViewportLayoutUpdate, 80);
      };

      const targets = [
        document.body,
        document.documentElement,
        document.querySelector(".modals"),
        document.getElementById("panelSelect"),
        document.getElementById("sMConfigBar"),
      ].filter(Boolean);

      postViewportLayoutObserver = new MutationObserver(schedule);

      for (const target of targets) {
        postViewportLayoutObserver.observe(target, {
          attributes: true,
          childList: true,
          subtree: true,
          attributeFilter: [
            "style",
            "class",
            "hidden",
            "open",
            "data-current-menu",
            "data-position",
          ],
        });
      }

      window.addEventListener("resize", schedule);
      window.addEventListener("load", schedule);

      schedule();
    };

  // Initialize the application, and populates dropdowns and the default post.

    const init = async function () {
      post = new Post(DEFAULT_POST_POSITION);
      post.panelSpacing = DEFAULT_PANEL_SPACING;

      ensureExtendedGuideArrowOptions();

      formHandler.init(exposeToFormHandler);

      // Initialize CustomShields after formHandler and wait for it
      window.customShields = new CustomShields();
      await window.customShields.initialized;

        const restored = loadSavedAppState();

        if (!restored) {
          post.newPanel();
          currentlySelectedPanelIndex = post.panels.length - 1;
        }

        formHandler.updateForm();
        redraw();

        requestAnimationFrame(() => {
          redraw();
          if (document.fonts && typeof document.fonts.ready?.then === "function") {
            document.fonts.ready.then(() => {
              redraw();
            });
          }
        });

        if (!restored) {
          saveAppState();
        }

        window.addEventListener("beforeunload", saveAppState);
        window.addEventListener("keydown", (event) => {
          if (!event.ctrlKey || !event.shiftKey) {
            return;
          }

          const activeTag = document.activeElement?.tagName;
          const isTyping =
            activeTag === "INPUT" ||
            activeTag === "TEXTAREA" ||
            document.activeElement?.isContentEditable;

          if (isTyping) {
            return;
          }

            if (event.key === "." && event.shiftKey) {
              event.preventDefault();
              selectNextPanel();
            } else if (event.key === "," && event.shiftKey) {
              event.preventDefault();
              selectPreviousPanel();
            }
        });

      bindPostViewportLayoutWatcher();
      schedulePostViewportLayoutUpdate();
    };

  // Create a new panel, set the current editing panel to that panel, update the form, and redraw.
    const newPanel = function () {
      return runWithUndo(() => {
        post.newPanel();
        currentlySelectedPanelIndex = post.panels.length - 1;
        normalizeSelectionForCurrentPost();
        formHandler.updateForm();
        redraw();
        requestAnimationFrame(() => {
          redraw();
          schedulePostViewportLayoutUpdate();
        });
      });
    };

  // Clone the panel, set the current editing panel to that panel, update the form and redraw.
    const duplicatePanel = function () {
      return runWithUndo(() => {
        post.duplicatePanel(currentlySelectedPanelIndex);
        currentlySelectedPanelIndex++;
        normalizeSelectionForCurrentPost();
        formHandler.updateForm();
        redraw();
        requestAnimationFrame(() => {
          redraw();
          schedulePostViewportLayoutUpdate();
        });
      });
    };

  /*
    Delete the current panel, set the current editing panel to the panel before, update the form and redraw.
    If no panel is found, create a new one.
  */
    const deletePanel = function () {
      return runWithUndo(() => {
        post.deletePanel(currentlySelectedPanelIndex);
        if (currentlySelectedPanelIndex > 0) {
          currentlySelectedPanelIndex--;
        }
        if (post.panels.length == 0) {
          post.newPanel();
          currentlySelectedPanelIndex = post.panels.length - 1;
        }
        formHandler.updateForm();
        redraw();
      });
    };
    const deletePanelAt = function (panelIndex = currentlySelectedPanelIndex) {
      return runWithUndo(() => {
        if (!post || !Array.isArray(post.panels) || post.panels.length === 0) {
          return;
        }

        const deleteIndex = clamp(panelIndex, 0, post.panels.length - 1);
        const deletedPanelWasTopOfStack =
          !isStackedPanelBottom(deleteIndex) &&
          getStackedPanelBottomIndex(deleteIndex) >= 0;

        post.deletePanel(deleteIndex);

        if (deletedPanelWasTopOfStack && post.panels[deleteIndex]) {
          post.panels[deleteIndex].stackedWithPrevious = false;
        }

        if (post.panels[0]) {
          post.panels[0].stackedWithPrevious = false;
        }

        if (!post.panels.length) {
          post.newPanel();
          currentlySelectedPanelIndex = 0;
        } else {
          currentlySelectedPanelIndex = clamp(
            deleteIndex,
            0,
            post.panels.length - 1
          );
        }

        currentlySelectedSubPanelIndex = 0;
        currentlySelectedExitTabIndex = 0;
        currentlySelectedNestedExitTabIndex = -1;
        currentlySelectedRowIndex = 0;
        currentlySelectedBlockIndex = 0;
        currentlySelectedAPLArrowIndex = 0;

        formHandler.updateForm();
        redraw();
      });
    };

    const togglePanelHidden = function (panelIndex = currentlySelectedPanelIndex) {
      return runWithUndo(() => {
        if (!post || !Array.isArray(post.panels) || post.panels.length === 0) {
          return;
        }

        const normalizedIndex = clamp(panelIndex, 0, post.panels.length - 1);
        const panel = post.panels[normalizedIndex];

        if (!panel) {
          return;
        }

        panel.hiddenFromPost = panel.hiddenFromPost !== true;
        getDownloadPanelSelection();

        formHandler.updateForm();
        redraw();

        const downloadDialog = document.getElementById("downloadContent");
        if (downloadDialog && downloadDialog.open) {
          updatePreview();
        }
      });
    };

  // Shift a panel to the left, and redraw.
    const shiftLeft = function () {
      return runWithUndo(() => {
        currentlySelectedPanelIndex = post.shiftLeft(currentlySelectedPanelIndex);
        redraw();
      });
    };

  // Shift a panel to the right, and redraw.
    const shiftRight = function () {
      return runWithUndo(() => {
        currentlySelectedPanelIndex = post.shiftRight(currentlySelectedPanelIndex);
        redraw();
      });
    };
    
    const selectNextPanel = function () {
      if (!post || !Array.isArray(post.panels) || post.panels.length === 0) {
        return;
      }
      const nextIndex = clamp(
        currentlySelectedPanelIndex + 1,
        0,
        post.panels.length - 1
      );
      if (nextIndex !== currentlySelectedPanelIndex) {
        changeEditingPanel(nextIndex);
      }
    };

    const selectPreviousPanel = function () {
      if (!post || !Array.isArray(post.panels) || post.panels.length === 0) {
        return;
      }
      const prevIndex = clamp(
        currentlySelectedPanelIndex - 1,
        0,
        post.panels.length - 1
      );
      if (prevIndex !== currentlySelectedPanelIndex) {
        changeEditingPanel(prevIndex);
      }
    };

    const movePanel = function (fromIndex, toIndex) {
      return runWithUndo(() => {
        if (!post || !Array.isArray(post.panels) || post.panels.length < 2) {
          return;
        }

        const normalizedFrom = clamp(
          typeof fromIndex === "number" ? fromIndex : currentlySelectedPanelIndex,
          0,
          post.panels.length - 1
        );
        let normalizedTo = clamp(
          typeof toIndex === "number" ? toIndex : normalizedFrom,
          0,
          post.panels.length
        );

        if (
          normalizedFrom === normalizedTo ||
          normalizedFrom + 1 === normalizedTo
        ) {
          return;
        }

        const selectedPanelRef =
          currentlySelectedPanelIndex >= 0 &&
          currentlySelectedPanelIndex < post.panels.length
            ? post.panels[currentlySelectedPanelIndex]
            : null;

        post.movePanel(normalizedFrom, normalizedTo);

        if (selectedPanelRef) {
          const updatedIndex = post.panels.indexOf(selectedPanelRef);
          if (updatedIndex !== -1) {
            currentlySelectedPanelIndex = updatedIndex;
          } else {
            currentlySelectedPanelIndex = clamp(
              currentlySelectedPanelIndex,
              0,
              post.panels.length - 1
            );
          }
        } else {
          currentlySelectedPanelIndex = clamp(
            currentlySelectedPanelIndex,
            0,
            post.panels.length - 1
          );
        }

        formHandler.updateForm();
        redraw();
      });
    };

  // --- Rendered Panel Drag and Drop ---
  let renderedPanelDragState = null;

  const toggleRenderedPanelWiggle = (isActive) => {
    const panels = document.querySelectorAll("#panelContainer > .panel");
    for (const panel of panels) {
      panel.classList.toggle("panelWiggle", isActive);
      if (isActive) {
        panel.style.setProperty("--wiggle-delay", `${Math.random() * 0.12}s`);
      } else {
        panel.style.removeProperty("--wiggle-delay");
      }
    }
  };

  const clearRenderedPanelDropIndicators = () => {
    document
      .querySelectorAll(".panel.dropBefore, .panel.dropAfter")
      .forEach((el) => el.classList.remove("dropBefore", "dropAfter"));
  };

  const endRenderedPanelDrag = () => {
    toggleRenderedPanelWiggle(false);
    clearRenderedPanelDropIndicators();
    document
      .querySelectorAll(".panel.dragging")
      .forEach((el) => {
        el.classList.remove("dragging");
        delete el.dataset.dragging;
      });
    renderedPanelDragState = null;
  };

  const getRenderedPanelDropPosition = (container, clientX) => {
    const panels = Array.from(container.querySelectorAll(".panel"));
    if (!panels.length) {
      return { dropIndex: 0, targetPanel: null, placement: null };
    }

    let dropIndex = panels.length;
    let targetPanel = null;
    let placement = "after";
    let foundPosition = false;

    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      const rect = panel.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      if (clientX < midpoint) {
        dropIndex = i;
        placement = "before";
        foundPosition = true;
        targetPanel = panel.dataset.dragging === "true" ? null : panel;
        break;
      }
    }

    if (!foundPosition) {
      const lastPanel = panels[panels.length - 1];
      if (lastPanel.dataset.dragging !== "true") {
        targetPanel = lastPanel;
        placement = "after";
      } else {
        placement = null;
      }
    } else if (!targetPanel) {
      placement = null;
    }

    return { dropIndex, targetPanel, placement };
  };

  const handleRenderedPanelDragStart = (event) => {
    const panel = event.currentTarget;
    const fromIndex = Number(panel.dataset.panelIndex);
    if (Number.isNaN(fromIndex)) {
      return;
    }
    renderedPanelDragState = { fromIndex, dropIndex: fromIndex };
    panel.dataset.dragging = "true";
    panel.classList.add("dragging");
    toggleRenderedPanelWiggle(true);
    clearRenderedPanelDropIndicators();

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.dropEffect = "move";
      event.dataTransfer.setData("text/plain", "");
    }
  };

  const handleRenderedPanelDragOver = (event) => {
    if (!renderedPanelDragState) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    const container = document.getElementById("panelContainer");
    if (!container) {
      return;
    }
    const { dropIndex, targetPanel, placement } = getRenderedPanelDropPosition(
      container,
      event.clientX
    );
    renderedPanelDragState.dropIndex = dropIndex;

    clearRenderedPanelDropIndicators();
    if (targetPanel && placement) {
      targetPanel.classList.add(
        placement === "before" ? "dropBefore" : "dropAfter"
      );
    }
  };

  const handleRenderedPanelDrop = (event) => {
    if (!renderedPanelDragState) {
      return;
    }
    event.preventDefault();
    const fromIndex = renderedPanelDragState.fromIndex;
    const dropIndex =
      renderedPanelDragState.dropIndex !== undefined
        ? renderedPanelDragState.dropIndex
        : fromIndex;
    movePanel(fromIndex, dropIndex);
    endRenderedPanelDrag();
  };

  const handleRenderedPanelDragLeave = (event) => {
    if (!renderedPanelDragState) {
      return;
    }
    const container = document.getElementById("panelContainer");
    const related = event.relatedTarget;
    if (related && container && container.contains(related)) {
      return;
    }
    clearRenderedPanelDropIndicators();
  };

  const handleRenderedPanelDragEnd = () => {
    if (renderedPanelDragState) {
      endRenderedPanelDrag();
    }
  };

  // Set the current panel based off parameter number, within the correct range (0 < # of panels - 1)

    const changeEditingPanel = function (
      panelNumber,
      { suppressFlash = false, preserveSubPanel = false } = {}
    ) {
      currentlySelectedPanelIndex = clamp(panelNumber, 0, post.panels.length - 1);

      if (!preserveSubPanel) {
        currentlySelectedSubPanelIndex = 0;
      } else {
        const subPanelCount =
          post.panels[currentlySelectedPanelIndex]?.sign?.subPanels?.length || 0;

        currentlySelectedSubPanelIndex = clamp(
          currentlySelectedSubPanelIndex,
          0,
          Math.max(0, subPanelCount - 1)
        );
      }

      currentlySelectedRowIndex = 0;
      currentlySelectedBlockIndex = 0;

      formHandler.updateForm();
      redraw();

      if (suppressFlash) {
        return;
      }

        flashElementAfterPostTransform(() => {
          const panelElmt = document.getElementById(
            "panel" + currentlySelectedPanelIndex
          );
          if (!panelElmt) {
            return null;
          }

          return panelElmt.querySelector(".sign");
        });
    };

    const setPanelSpacing = function (value) {
      return runWithUndo(() => {
        if (!post) {
          return;
        }
        const parsedValue = parseFloat(value);
          const normalized =
            Number.isFinite(parsedValue) && parsedValue >= 0
              ? Math.min(parsedValue, 10)
              : 0;
        if (post.panelSpacing === normalized) {
          return;
        }
        post.panelSpacing = normalized;
        formHandler.updateForm();
        redraw();
      });
    };

    const addSubPanel = function () {
      return runWithUndo(() => {
        const sign = getCurrentPanel()?.sign;

        if (!sign || !Array.isArray(sign.subPanels)) {
          return;
        }

        sign.newSubPanel();

        currentlySelectedSubPanelIndex = sign.subPanels.length - 1;
        currentlySelectedRowIndex = 0;
        currentlySelectedBlockIndex = 0;
        currentlySelectedAPLArrowIndex = 0;

        normalizeSelectionForCurrentPost();
        formHandler.updateForm();
        redraw();

        requestAnimationFrame(() => {
          redraw();
        });
      });
    };

    const removeSubPanel = function (subPanelIndex = currentlySelectedSubPanelIndex) {
      return runWithUndo(() => {
        const panel = getCurrentPanel();
        const sign = panel?.sign;

        if (!sign) {
          return;
        }

        const targetIndex = Number(subPanelIndex);

        if (
          targetIndex === GLOBAL_TOP_SUBPANEL_INDEX ||
          targetIndex === GLOBAL_BOTTOM_SUBPANEL_INDEX
        ) {
          const globalPosition = getGlobalBlockPositionFromIndex(targetIndex);
          const globalKey = getGlobalBlockKey(globalPosition);

          delete sign[globalKey];

          if (currentlySelectedSubPanelIndex === targetIndex) {
            currentlySelectedSubPanelIndex =
              Array.isArray(sign.subPanels) && sign.subPanels.length > 0
                ? 0
                : GLOBAL_BOTTOM_SUBPANEL_INDEX;
          }

          currentlySelectedRowIndex = 0;
          currentlySelectedBlockIndex = 0;
          currentlySelectedAPLArrowIndex = 0;

          formHandler.updateForm();
          redraw();
          return;
        }

        if (!Array.isArray(sign.subPanels) || sign.subPanels.length <= 1) {
          return;
        }

        const deleteIndex = clamp(targetIndex, 0, sign.subPanels.length - 1);

        sign.deleteSubPanel(deleteIndex);

        if (currentlySelectedSubPanelIndex === deleteIndex) {
          currentlySelectedSubPanelIndex = clamp(
            deleteIndex,
            0,
            sign.subPanels.length - 1
          );
        } else if (currentlySelectedSubPanelIndex > deleteIndex) {
          currentlySelectedSubPanelIndex--;
        }

        currentlySelectedRowIndex = 0;
        currentlySelectedBlockIndex = 0;
        currentlySelectedAPLArrowIndex = 0;

        normalizeSelectionForCurrentPost();
        formHandler.updateForm();
        redraw();
      });
    };

  // Duplicate the current subpanel, set the editing to that subpanel, update the form, and redraw.
    const duplicateSubPanel = function () {
      return runWithUndo(() => {
        const sign = getCurrentPanel().sign;
        sign.duplicateSubPanel(currentlySelectedSubPanelIndex);
        currentlySelectedSubPanelIndex++;
        formHandler.updateForm();
        redraw();
      });
    };

  // Set the current editing (SUB)panel based off paramter number, within the correct range (0 < # of panels - 1)
    const changeEditingSubPanel = function (subPanelNumber) {
      const sign = getCurrentPanel()?.sign;

      if (!sign) {
        return;
      }

      currentlySelectedSubPanelIndex = clamp(
        subPanelNumber,
        GLOBAL_TOP_SUBPANEL_INDEX,
        Array.isArray(sign.subPanels)
          ? sign.subPanels.length - 1
          : GLOBAL_BOTTOM_SUBPANEL_INDEX
      );

      if (currentlySelectedSubPanelIndex < 0) {
        ensureGlobalBlockElements(
          sign,
          getGlobalBlockPositionFromIndex(currentlySelectedSubPanelIndex)
        );
      }

      currentlySelectedRowIndex = 0;
      currentlySelectedBlockIndex = 0;
      currentlySelectedAPLArrowIndex = 0;

      formHandler.updateForm();
      redraw();
      flashSelectedSubPanel({ waitForPostTransform: true });
    };
    
    const flashSelectedSubPanel = ({ waitForPostTransform = false } = {}) => {
      const getSelectedSubPanelElmt = () => {
        const panelElmt = document.getElementById(
          "panel" + currentlySelectedPanelIndex
        );

        if (!panelElmt) {
          return null;
        }

        if (currentlySelectedSubPanelIndex === GLOBAL_TOP_SUBPANEL_INDEX) {
          return panelElmt.querySelector(".globalTop");
        }

        if (currentlySelectedSubPanelIndex === GLOBAL_BOTTOM_SUBPANEL_INDEX) {
          return panelElmt.querySelector(".globalBottom");
        }

        return panelElmt.querySelector(
          `[data-subpanel-index="${currentlySelectedSubPanelIndex}"]`
        );
      };

      if (waitForPostTransform) {
        flashElementAfterPostTransform(getSelectedSubPanelElmt);
        return;
      }

      const subPanelElmt = getSelectedSubPanelElmt();

      if (subPanelElmt) {
        flashElement(subPanelElmt);
      }
    };
    
    const isGuideArrowMenuOpen = () => {
      const guideArrowMenu = document.querySelector(".sMModal.guideArrowConfig");

      if (!guideArrowMenu) {
        return false;
      }

      const styles = window.getComputedStyle(guideArrowMenu);

      return styles.display !== "none" && styles.visibility !== "hidden";
    };

    const isAPLMenuOpen = () => {
      const aplTab = document.getElementById("sMAPL");

      if (!aplTab) {
        return false;
      }

      return !aplTab.classList.contains("tabHidden");
    };
    
    const selectRenderedPanelArea = ({
      panelIndex,
      subPanelIndex = 0,
      rowIndex = 0,
      blockIndex = 0,
      exitTabIndex = null,
      menu = "subpanel",
      guideMode = null,
      flashTarget = null,
    } = {}) => {
      const selectedPanelIndex = clamp(panelIndex, 0, post.panels.length - 1);
      currentlySelectedPanelIndex = selectedPanelIndex;

      const selectedPanel = getCurrentPanel();
      const subPanelCount = selectedPanel?.sign?.subPanels?.length || 0;

      const requestedSubPanelIndex = Number(subPanelIndex);
      if (
        requestedSubPanelIndex === GLOBAL_TOP_SUBPANEL_INDEX ||
        requestedSubPanelIndex === GLOBAL_BOTTOM_SUBPANEL_INDEX
      ) {
        currentlySelectedSubPanelIndex = requestedSubPanelIndex;
        ensureGlobalBlockElements(
          selectedPanel.sign,
          getGlobalBlockPositionFromIndex(requestedSubPanelIndex)
        );
      } else {
        currentlySelectedSubPanelIndex = clamp(
          Number.isFinite(requestedSubPanelIndex) ? requestedSubPanelIndex : 0,
          0,
          Math.max(0, subPanelCount - 1)
        );
      }

      const selectedTarget = getCurrentSubPanel();
      const selectedRows = selectedTarget?.blockElements?.rows || [];
      const requestedRowIndex = Number(rowIndex);
      currentlySelectedRowIndex = clamp(
        Number.isFinite(requestedRowIndex) ? requestedRowIndex : 0,
        0,
        Math.max(0, selectedRows.length - 1)
      );
      const selectedBlocks = selectedRows[currentlySelectedRowIndex] || [];
      const requestedBlockIndex = Number(blockIndex);
      currentlySelectedBlockIndex = clamp(
        Number.isFinite(requestedBlockIndex) ? requestedBlockIndex : 0,
        0,
        Math.max(0, selectedBlocks.length - 1)
      );

      if (exitTabIndex !== null && selectedPanel?.exitTabs?.length) {
        currentlySelectedExitTabIndex = clamp(
          exitTabIndex,
          0,
          selectedPanel.exitTabs.length - 1
        );
        currentlySelectedNestedExitTabIndex = -1;
      }

      formHandler.updateForm();

      if (
        menu === "exitTabs" &&
        typeof formHandler.ensureExitTabMenuOpen === "function"
      ) {
        formHandler.ensureExitTabMenuOpen();
      } else if (
        menu === "guideArrows" &&
        typeof formHandler.ensureGuideArrowMenuOpen === "function"
      ) {
        const mode =
          guideMode ||
          (selectedPanel?.sign?.arrowMode === "apl" ? "apl" : "standard");

        formHandler.ensureGuideArrowMenuOpen(mode);
      } else if (
        menu === "subpanel" &&
        typeof formHandler.ensureSubpanelMenuOpen === "function"
      ) {
        formHandler.ensureSubpanelMenuOpen();
      }

        const flashInfo = {
          panelIndex: selectedPanelIndex,
          subPanelIndex: currentlySelectedSubPanelIndex,
          exitTabIndex,
          targetType:
            menu === "exitTabs"
              ? "exitTab"
              : menu === "guideArrows"
                ? "guideArrows"
                : "subpanel",
        };

        redraw();
        flashSelectedSubPanel({ waitForPostTransform: true });
    };

    const getElementVisualScale = (element) => {
      if (!element) {
        return 1;
      }

      const rect = element.getBoundingClientRect();
      const layoutWidth = element.offsetWidth || element.clientWidth || 0;
      const layoutHeight = element.offsetHeight || element.clientHeight || 0;

      const scaleX =
        layoutWidth > 0 && rect.width > 0 ? rect.width / layoutWidth : 1;

      const scaleY =
        layoutHeight > 0 && rect.height > 0 ? rect.height / layoutHeight : scaleX;

      return {
        x: Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1,
        y: Number.isFinite(scaleY) && scaleY > 0 ? scaleY : 1,
      };
    };

    const flashElement = (targetElmt) => {
      if (!targetElmt) return;
      if (post && post.disableFlash) return;
      if (!targetElmt.isConnected) return;

      const rect = targetElmt.getBoundingClientRect();

      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      const overlay = document.createElement("div");
      overlay.className = "flash-selection";

      overlay.style.position = "fixed";
      overlay.style.top = rect.top + "px";
      overlay.style.left = rect.left + "px";
      overlay.style.width = rect.width + "px";
      overlay.style.height = rect.height + "px";
      overlay.style.borderRadius = window.getComputedStyle(targetElmt).borderRadius || "0.25rem";
      overlay.style.zIndex = "999999";

      document.body.appendChild(overlay);

      setTimeout(() => {
        overlay.remove();
      }, 500);
    };
    
    const flashElementAfterPostTransform = (targetResolver) => {
      if (post && post.disableFlash) return;

      const postContainer = document.getElementById("postContainer");

      const runFlash = () => {
        requestAnimationFrame(() => {
          const targetElmt =
            typeof targetResolver === "function" ? targetResolver() : targetResolver;

          if (!targetElmt || !targetElmt.isConnected) return;
          flashElement(targetElmt);
        });
      };

      if (!postContainer) {
        runFlash();
        return;
      }

      const computed = window.getComputedStyle(postContainer);
      const durationParts = (computed.transitionDuration || "0s").split(",");
      const delayParts = (computed.transitionDelay || "0s").split(",");

      const toMs = (value) => {
        const trimmed = String(value).trim();
        if (trimmed.endsWith("ms")) return parseFloat(trimmed) || 0;
        if (trimmed.endsWith("s")) return (parseFloat(trimmed) || 0) * 1000;
        return parseFloat(trimmed) || 0;
      };

      const transitionMs = Math.max(
        ...durationParts.map((duration, index) => {
          const delay = delayParts[index] ?? delayParts[0] ?? "0s";
          return toMs(duration) + toMs(delay);
        }),
        0
      );

      if (transitionMs <= 0) {
        runFlash();
        return;
      }

      let finished = false;

      const finish = () => {
        if (finished) return;
        finished = true;
        postContainer.removeEventListener("transitionend", onTransitionEnd);
        runFlash();
      };

      const onTransitionEnd = (event) => {
        if (event.target !== postContainer) return;
        if (event.propertyName !== "transform") return;
        finish();
      };

      postContainer.addEventListener("transitionend", onTransitionEnd);

      setTimeout(finish, transitionMs + 40);
    };
    
    const getFreshFlashTarget = ({
      panelIndex = currentlySelectedPanelIndex,
      subPanelIndex = currentlySelectedSubPanelIndex,
      exitTabIndex = null,
      targetType = "subpanel",
    } = {}) => {
      const panelElmt = document.getElementById("panel" + panelIndex);

      if (!panelElmt) {
        return null;
      }

      if (targetType === "panel") {
        return panelElmt;
      }

      if (targetType === "exitTab") {
        return panelElmt.querySelector(
          `.exitTabContainer[data-exit-tab-index="${exitTabIndex ?? 0}"], .exitTabCont[data-exit-tab-index="${exitTabIndex ?? 0}"]`
        );
      }

      if (targetType === "guideArrows") {
        return panelElmt.querySelector(".guideArrows, .aplArrows, .subpanelAplArrows");
      }

      return panelElmt.querySelector(
        `.subPanelDisplay[data-subpanel-index="${subPanelIndex}"]`
      );
    };

  // Create a new exit tab, update the form, and redraw.
    const newExitTab = function () {
      return runWithUndo(() => {
        const panel = getCurrentPanel();
        panel.newExitTab();
        currentlySelectedExitTabIndex = panel.exitTabs.length - 1;
        currentlySelectedNestedExitTabIndex = -1;
        formHandler.updateForm();
        redraw();
      });
    };

  // Create a new nested exit tab within the parent exit tab.
    const newNestExitTab = function () {
      return runWithUndo(() => {
        const panel = getCurrentPanel();
        if (!panel || !panel.exitTabs.length) {
          return;
        }
        const exitTab = panel.exitTabs[currentlySelectedExitTabIndex];
        if (!exitTab) {
          return;
        }
        const nested = exitTab.nestExitTab();
        if (!nested) {
          return;
        }
        currentlySelectedNestedExitTabIndex = exitTab.nestedExitTabs.length - 1;
        formHandler.updateForm();
        redraw();
      });
    };
    
  // Create a duplicate of the exit tab.
    const duplicateExitTab = function (exitTabIndex = currentlySelectedExitTabIndex) {
      return runWithUndo(() => {
        const panel = getCurrentPanel();
        if (!panel || !panel.exitTabs.length) {
          return;
        }
        exitTabIndex = clamp(exitTabIndex, 0, panel.exitTabs.length - 1);
        panel.duplicateExitTab(exitTabIndex);
        currentlySelectedExitTabIndex = clamp(
          exitTabIndex + 1,
          0,
          panel.exitTabs.length - 1
        );
        currentlySelectedNestedExitTabIndex = -1;
        formHandler.updateForm();
        redraw();
      });
    };

  // Delete the exit tab.
    const removeExitTab = function (exitTabIndex = currentlySelectedExitTabIndex) {
      return runWithUndo(() => {
        const panel = getCurrentPanel();
        if (!panel || !panel.exitTabs.length) {
          return;
        }

        exitTabIndex = clamp(exitTabIndex, 0, panel.exitTabs.length - 1);
        panel.deleteExitTab(exitTabIndex);

        if (!panel.exitTabs.length) {
          panel.newExitTab();
          currentlySelectedExitTabIndex = 0;
        } else {
          currentlySelectedExitTabIndex = clamp(
            exitTabIndex,
            0,
            panel.exitTabs.length - 1
          );
        }

        currentlySelectedNestedExitTabIndex = -1;
        formHandler.updateForm();
        redraw();
      });
    };

  // Delete the exit tab within the parent exitTab
    const deleteNestExitTab = function (
      nestExitTabIndex = currentlySelectedNestedExitTabIndex
    ) {
      return runWithUndo(() => {
        const exitTab = getCurrentPanel().exitTabs[currentlySelectedExitTabIndex];
        if (!exitTab || !exitTab.nestedExitTabs.length) {
          return;
        }

        nestExitTabIndex = clamp(
          nestExitTabIndex,
          0,
          exitTab.nestedExitTabs.length - 1
        );

        exitTab.deleteNestExitTab(nestExitTabIndex);

        if (exitTab.nestedExitTabs.length === 0) {
          currentlySelectedNestedExitTabIndex = -1;
        } else {
          currentlySelectedNestedExitTabIndex = Math.min(
            nestExitTabIndex,
            exitTab.nestedExitTabs.length - 1
          );
        }

        formHandler.updateForm();
        redraw();
      });
    };
    
    const moveExitTab = function (fromIndex, toIndex) {
      return runWithUndo(() => {
        const panel = getCurrentPanel();
        if (!panel || !panel.exitTabs || panel.exitTabs.length < 2) {
          return;
        }

        const exitTabs = panel.exitTabs;
        const maxIndex = exitTabs.length - 1;
        const normalizedFrom = clamp(fromIndex, 0, maxIndex);
        let normalizedTo = clamp(toIndex, 0, exitTabs.length);

        if (
          normalizedTo === normalizedFrom ||
          normalizedTo === normalizedFrom + 1
        ) {
          return;
        }

        const [movedExitTab] = exitTabs.splice(normalizedFrom, 1);
        if (!movedExitTab) {
          return;
        }

        if (normalizedTo > normalizedFrom) {
          normalizedTo--;
        }

        normalizedTo = clamp(normalizedTo, 0, exitTabs.length);
        exitTabs.splice(normalizedTo, 0, movedExitTab);

        currentlySelectedExitTabIndex = normalizedTo;
        currentlySelectedNestedExitTabIndex = -1;
        formHandler.updateForm();
        redraw();
      });
    };

  // Set the current editing exit tab based off paramter number, its child, within the correct range (0 < # of exit Tabs - 1 // Secondary: 0 < # of child exit Tabs)
  const changeEditingExitTab = function (exitTabNumber, nestedExitTabNumber) {
    currentlySelectedExitTabIndex = clamp(
      exitTabNumber,
      0,
      getCurrentPanel().exitTabs.length - 1
    );
    currentlySelectedNestedExitTabIndex =
      nestedExitTabNumber != null
        ? clamp(
          nestedExitTabNumber,
          -1,
          getCurrentPanel().exitTabs[currentlySelectedExitTabIndex]
            .nestedExitTabs.length - 1
        )
        : -1;
    formHandler.updateForm();
  };

  // Add a new shield to the current panel's sign, update the shield subform, and redraw the sign.
    const newShield = function () {
      return runWithUndo(() => {
        const sign = getCurrentPanel().sign;
        sign.newShield(currentlySelectedSubPanelIndex);
        formHandler.updateShieldSubform();
        redraw();
      });
    };

  // Delete the current shield, update the shield subform, and redraw the sign
    const deleteShield = function (shieldIndex) {
      return runWithUndo(() => {
        const sign = getCurrentPanel().sign;
        sign.deleteShield(shieldIndex, currentlySelectedSubPanelIndex);
        formHandler.updateShieldSubform();
        redraw();
      });
    };

  // Delete all shields of a sign
    const clearShields = function () {
      return runWithUndo(() => {
        const subPanel = getCurrentSubPanel();
        const shields = subPanel.shields;
        const sign = getCurrentPanel().sign;

        while (shields.length > 0) {
          sign.deleteShield(shields.length - 1, currentlySelectedSubPanelIndex);
        }

        formHandler.updateShieldSubform();
        redraw();
      });
    };

  // Duplicate a shield
    const duplicateShield = function (shieldIndex) {
      return runWithUndo(() => {
        const sign = getCurrentPanel().sign;
        sign.duplicateShield(shieldIndex, currentlySelectedSubPanelIndex);
        formHandler.updateShieldSubform();
        redraw();
      });
    };

  const checkSpecialShield = function (shieldIndex, specialShield) {
    const shields = getCurrentSubPanel().shields;
    const shield = shields[shieldIndex];
    const specialShieldType =
      Shield.prototype.specialBannerTypes[shield.type][specialShield];

    if (specialShieldType != undefined) {
      if (shield.routeNumber.length >= specialShieldType) {
        return true;
      }
    }

    return false;
  };

  // Revised Control Panel
  
  const SETTINGS_DEFAULTS_STORAGE_KEY = "signMaker.settingsDefaults";

  const getStoredSettingsDefaultsForNewBlocks = () => {
    try {
      const raw = window.localStorage.getItem(SETTINGS_DEFAULTS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  };

  const getSettingsDefaultValue = (defaults, key, fallback) => {
    return Object.prototype.hasOwnProperty.call(defaults, key)
      ? defaults[key]
      : fallback;
  };

  const getValidShieldBannerPositionDefault = (value, fallback) => {
    const options = ShieldElement.prototype.blockBannerPositions || [];

    return options.includes(value) ? value : fallback;
  };

  const applyStoredShieldDefaultsToBlock = (blockElement) => {
    if (
      typeof ShieldElement === "undefined" ||
      !(blockElement instanceof ShieldElement)
    ) {
      return blockElement;
    }

    const defaults = getStoredSettingsDefaultsForNewBlocks();

    const defaultShieldBase =
      getSettingsDefaultValue(
        defaults,
        "settingsDefaultsShieldType",
        ShieldElement.prototype.defaultShieldBase || "I"
      ) || ShieldElement.prototype.defaultShieldBase || "I";

    const defaultRouteNumber = getSettingsDefaultValue(
      defaults,
      "settingsDefaultsShieldRouteNumber",
      ""
    );

    const defaultShieldSizeRaw = getSettingsDefaultValue(
      defaults,
      "settingsDefaultsShieldSize",
      "3"
    );

    const defaultShieldSize = parseFloat(defaultShieldSizeRaw);

    blockElement.shieldBase = defaultShieldBase;
    blockElement.type = defaultShieldBase;
    blockElement.routeNumber =
      defaultRouteNumber === null || defaultRouteNumber === undefined
        ? ""
        : String(defaultRouteNumber);

    if (Number.isFinite(defaultShieldSize) && defaultShieldSize > 0) {
      blockElement.shieldSize = defaultShieldSize;
    }

    blockElement.bannerPosition = getValidShieldBannerPositionDefault(
      getSettingsDefaultValue(defaults, "settingsDefaultsShieldBanner1", "Right"),
      "Right"
    );

    blockElement.bannerPosition2 = getValidShieldBannerPositionDefault(
      getSettingsDefaultValue(defaults, "settingsDefaultsShieldBanner2", "Above"),
      "Above"
    );

    return blockElement;
  };

  const applyStoredShieldDefaultsToCurrentBlock = () => {
    const row =
      getCurrentSubPanel()?.blockElements?.rows?.[currentlySelectedRowIndex];

    if (!Array.isArray(row)) {
      return null;
    }

    return applyStoredShieldDefaultsToBlock(row[currentlySelectedBlockIndex]);
  };
  
    const newRow = (selectedBlock, evt) => {
      return runWithUndo(() => {
        const blockElems = getCurrentSubPanel().blockElements;
        const insertAbove = evt && evt.shiftKey;
        currentlySelectedBlockIndex = 0;
        if (insertAbove) {
          blockElems.addRow(currentlySelectedRowIndex, selectedBlock);
        } else {
          blockElems.addRow(++currentlySelectedRowIndex, selectedBlock);
        }
        applyStoredShieldDefaultsToCurrentBlock();
        formHandler.updateForm();
        redraw();
      });
    };

    const dupRow = () => {
      return runWithUndo(() => {
        const blockElems = getCurrentSubPanel().blockElements;
        blockElems.duplicateRow(currentlySelectedRowIndex++);
        formHandler.updateForm();
        redraw();
      });
    };

    const delRow = () => {
      return runWithUndo(() => {
        const subPanel = getCurrentSubPanel();
        const blockElems = subPanel?.blockElements;

        if (!blockElems || blockElems.rows.length <= 1) {
          return;
        }

        const deleteIndex = clamp(
          currentlySelectedRowIndex,
          0,
          blockElems.rows.length - 1
        );

        blockElems.deleteRow(deleteIndex);

        currentlySelectedRowIndex = Math.max(0, deleteIndex - 1);
        currentlySelectedBlockIndex = 0;

        normalizeSelectionForCurrentPost();
        redraw();
        formHandler.updateForm();
      });
    };
    
    const createPanelRightOfSelected = () => {
      return runWithUndo(() => {
        if (!post || !Array.isArray(post.panels)) {
          return;
        }

        const insertIndex = clamp(currentlySelectedPanelIndex + 1, 0, post.panels.length);
        post.newPanel();

        const newPanel = post.panels.pop();
        post.panels.splice(insertIndex, 0, newPanel);

        currentlySelectedPanelIndex = insertIndex;
        currentlySelectedSubPanelIndex = 0;
        currentlySelectedRowIndex = 0;
        currentlySelectedBlockIndex = 0;

        normalizeSelectionForCurrentPost();
        redraw();
        formHandler.updateForm();
      });
    };

    const createPanelLeftOfSelected = () => {
      return runWithUndo(() => {
        if (!post || !Array.isArray(post.panels)) {
          return;
        }

        const insertIndex = clamp(currentlySelectedPanelIndex, 0, post.panels.length);
        post.newPanel();

        const newPanel = post.panels.pop();
        post.panels.splice(insertIndex, 0, newPanel);

        currentlySelectedPanelIndex = insertIndex;
        currentlySelectedSubPanelIndex = 0;
        currentlySelectedRowIndex = 0;
        currentlySelectedBlockIndex = 0;

        normalizeSelectionForCurrentPost();
        redraw();
        formHandler.updateForm();
      });
    };

    const createStackedPanelBelowSelected = () => {
      return runWithUndo(() => {
        if (!post || !Array.isArray(post.panels) || post.panels.length === 0) {
          return;
        }

        const topIndex = getStackedPanelTopIndex(currentlySelectedPanelIndex);
        const existingBottomIndex = getStackedPanelBottomIndex(topIndex);

        if (existingBottomIndex >= 0) {
          currentlySelectedPanelIndex = existingBottomIndex;
          currentlySelectedSubPanelIndex = 0;
          currentlySelectedRowIndex = 0;
          currentlySelectedBlockIndex = 0;
          normalizeSelectionForCurrentPost();
          redraw();
          formHandler.updateForm();
          return;
        }

        const topPanel = post.panels[topIndex];
        if (topPanel) {
          getStackedPanelSettingsForTopIndex(topIndex);
        }

        const insertIndex = clamp(topIndex + 1, 0, post.panels.length);
        post.newPanel();

        const newPanel = post.panels.pop();
        if (!newPanel) {
          return;
        }

        newPanel.color = "Yellow";
        newPanel.stackedWithPrevious = true;
        post.panels.splice(insertIndex, 0, newPanel);

        currentlySelectedPanelIndex = insertIndex;
        currentlySelectedSubPanelIndex = 0;
        currentlySelectedRowIndex = 0;
        currentlySelectedBlockIndex = 0;
        currentlySelectedAPLArrowIndex = 0;

        normalizeSelectionForCurrentPost();
        redraw();
        formHandler.updateForm();
      });
    };

    const changeEditingStackedPanelSlot = (slot) => {
      if (!post || !Array.isArray(post.panels) || post.panels.length === 0) {
        return;
      }

      const normalizedSlot = String(slot || "Top").toLowerCase();
      const topIndex = getStackedPanelTopIndex(currentlySelectedPanelIndex);
      const bottomIndex = getStackedPanelBottomIndex(topIndex);

      if (normalizedSlot === "bottom") {
        if (bottomIndex >= 0) {
          changeEditingPanel(bottomIndex);
        } else {
          createStackedPanelBelowSelected();
        }
        return;
      }

      changeEditingPanel(topIndex);
    };

    const removeStackedPanelSlot = (slot) => {
      return runWithUndo(() => {
        if (!post || !Array.isArray(post.panels) || post.panels.length === 0) {
          return;
        }

        const normalizedSlot = String(slot || "Bottom").toLowerCase();
        const topIndex = getStackedPanelTopIndex(currentlySelectedPanelIndex);
        const bottomIndex = getStackedPanelBottomIndex(topIndex);

        if (normalizedSlot === "bottom") {
          if (bottomIndex < 0) {
            return;
          }

          post.deletePanel(bottomIndex);
          currentlySelectedPanelIndex = topIndex;
        } else {
          if (bottomIndex < 0 || post.panels.length <= 1) {
            return;
          }

          post.deletePanel(topIndex);
          const promotedIndex = clamp(topIndex, 0, post.panels.length - 1);
          if (post.panels[promotedIndex]) {
            post.panels[promotedIndex].stackedWithPrevious = false;
          }
          currentlySelectedPanelIndex = promotedIndex;
        }

        currentlySelectedSubPanelIndex = 0;
        currentlySelectedRowIndex = 0;
        currentlySelectedBlockIndex = 0;
        currentlySelectedAPLArrowIndex = 0;

        normalizeSelectionForCurrentPost();
        redraw();
        formHandler.updateForm();
      });
    };


    const setStackedPanelSpacing = (value) => {
      return runWithUndo(() => {
        if (!post || !Array.isArray(post.panels) || post.panels.length === 0) {
          return;
        }

        const topIndex = getStackedPanelTopIndex(currentlySelectedPanelIndex);
        const topPanel = post.panels[topIndex];

        if (!topPanel) {
          return;
        }

        topPanel.stackedPanelSpacing = normalizeStackedPanelSpacing(value);

        redraw();
        formHandler.updateForm();
      });
    };

    const setStackedPanelMatchWidth = (matchWidth) => {
      return runWithUndo(() => {
        if (!post || !Array.isArray(post.panels) || post.panels.length === 0) {
          return;
        }

        const topIndex = getStackedPanelTopIndex(currentlySelectedPanelIndex);
        const topPanel = post.panels[topIndex];

        if (!topPanel) {
          return;
        }

        topPanel.stackedPanelMatchWidth = matchWidth === true;

        redraw();
        formHandler.updateForm();
      });
    };

    const createSubPanelRightOfSelected = () => {
      return runWithUndo(() => {
        const sign = getCurrentPanel()?.sign;

        if (!sign || !Array.isArray(sign.subPanels)) {
          return;
        }

        const insertIndex = clamp(
          currentlySelectedSubPanelIndex + 1,
          0,
          sign.subPanels.length
        );

        sign.newSubPanel();

        const newSubPanel = sign.subPanels.pop();

        if (!newSubPanel) {
          return;
        }

        sign.subPanels.splice(insertIndex, 0, newSubPanel);

        currentlySelectedSubPanelIndex = insertIndex;
        currentlySelectedRowIndex = 0;
        currentlySelectedBlockIndex = 0;
        currentlySelectedAPLArrowIndex = 0;

        normalizeSelectionForCurrentPost();
        formHandler.updateForm();
        redraw();

        requestAnimationFrame(() => {
          redraw();
        });
      });
    };

    const createSubPanelLeftOfSelected = () => {
      return runWithUndo(() => {
        const sign = getCurrentPanel()?.sign;

        if (!sign || !Array.isArray(sign.subPanels)) {
          return;
        }

        const insertIndex = clamp(
          currentlySelectedSubPanelIndex,
          0,
          sign.subPanels.length
        );

        sign.newSubPanel();

        const newSubPanel = sign.subPanels.pop();

        if (!newSubPanel) {
          return;
        }

        sign.subPanels.splice(insertIndex, 0, newSubPanel);

        currentlySelectedSubPanelIndex = insertIndex;
        currentlySelectedRowIndex = 0;
        currentlySelectedBlockIndex = 0;
        currentlySelectedAPLArrowIndex = 0;

        normalizeSelectionForCurrentPost();
        formHandler.updateForm();
        redraw();

        requestAnimationFrame(() => {
          redraw();
        });
      });
    };

    const createRowBelowSelected = () => {
      return runWithUndo(() => {
        const blockElems = getCurrentSubPanel()?.blockElements;
        const selectedElem =
          document.querySelector("#sMSPElementSelect")?.value || "ControlTextElement";

        if (!blockElems || typeof blockElems.addRow !== "function") {
          return;
        }

        const insertIndex = currentlySelectedRowIndex + 1;
        blockElems.addRow(insertIndex, selectedElem);
        currentlySelectedRowIndex = insertIndex;
        currentlySelectedBlockIndex = 0;
        applyStoredShieldDefaultsToCurrentBlock();
        formHandler.updateForm();
        redraw();
      });
    };

    const createRowAboveSelected = () => {
      return runWithUndo(() => {
        const blockElems = getCurrentSubPanel()?.blockElements;
        const selectedElem =
          document.querySelector("#sMSPElementSelect")?.value || "ControlTextElement";

        if (!blockElems || typeof blockElems.addRow !== "function") {
          return;
        }

        const insertIndex = currentlySelectedRowIndex;
        blockElems.addRow(insertIndex, selectedElem);
        currentlySelectedRowIndex = insertIndex;
        currentlySelectedBlockIndex = 0;
        applyStoredShieldDefaultsToCurrentBlock();
        formHandler.updateForm();
        redraw();
      });
    };

    const selectNextSubPanel = () => {
      const sign = getCurrentPanel()?.sign;
      if (!sign || !Array.isArray(sign.subPanels) || sign.subPanels.length === 0) {
        return;
      }

      const nextIndex = clamp(
        currentlySelectedSubPanelIndex + 1,
        0,
        sign.subPanels.length - 1
      );

      if (nextIndex !== currentlySelectedSubPanelIndex) {
        changeEditingSubPanel(nextIndex);
        redraw();
      }
    };

    const selectPreviousSubPanel = () => {
      const sign = getCurrentPanel()?.sign;
      if (!sign || !Array.isArray(sign.subPanels) || sign.subPanels.length === 0) {
        return;
      }

      const prevIndex = clamp(
        currentlySelectedSubPanelIndex - 1,
        0,
        sign.subPanels.length - 1
      );

      if (prevIndex !== currentlySelectedSubPanelIndex) {
        changeEditingSubPanel(prevIndex);
        redraw();
      }
    };

    const selectNextRow = () => {
      const rows = getCurrentSubPanel()?.blockElements?.rows || [];
      if (!rows.length) {
        return;
      }

      const nextIndex = clamp(
        currentlySelectedRowIndex + 1,
        0,
        rows.length - 1
      );

      if (nextIndex !== currentlySelectedRowIndex) {
        setSelectedRow(nextIndex);
        redraw();
      }
    };

    const selectPreviousRow = () => {
      const rows = getCurrentSubPanel()?.blockElements?.rows || [];
      if (!rows.length) {
        return;
      }

      const prevIndex = clamp(
        currentlySelectedRowIndex - 1,
        0,
        rows.length - 1
      );

      if (prevIndex !== currentlySelectedRowIndex) {
        setSelectedRow(prevIndex);
        redraw();
      }
    };

    const deleteCurrentPanelShortcut = () => {
      if (!post || !Array.isArray(post.panels) || post.panels.length <= 1) {
        return null;
      }

      const deletedIndex = currentlySelectedPanelIndex;
      deletePanel();
      return deletedIndex;
    };

    const deleteCurrentSubPanelShortcut = () => {
      const deletedIndex = currentlySelectedSubPanelIndex;
      removeSubPanel(deletedIndex);
      return deletedIndex;
    };

    const deleteCurrentRowShortcut = () => {
      return runWithUndo(() => {
        const rows = getCurrentSubPanel()?.blockElements?.rows || [];
        if (rows.length <= 1) {
          return null;
        }

        const deleteIndex = clamp(
          currentlySelectedRowIndex,
          0,
          rows.length - 1
        );

        getCurrentSubPanel().blockElements.deleteRow(deleteIndex);
        currentlySelectedRowIndex = Math.max(0, deleteIndex - 1);
        currentlySelectedBlockIndex = 0;

        normalizeSelectionForCurrentPost();
        formHandler.updateForm();
        redraw();

        return deleteIndex;
      });
    };

    const moveRow = (fromIndex, toIndex) => {
      return runWithUndo(() => {
        const blockElements = getCurrentSubPanel().blockElements;
        const rows = blockElements.rows;
        const blockProps = blockElements.blockProperties;
        const rowCount = rows.length;

        if (rowCount < 2) {
          return fromIndex;
        }

        const clampIdx = (val, max) => Math.max(0, Math.min(val, max));
        const normalizedFrom = clampIdx(fromIndex, rowCount - 1);
        let normalizedTo = clampIdx(toIndex, rowCount);

        if (normalizedFrom === normalizedTo || normalizedFrom + 1 === normalizedTo) {
          return normalizedFrom;
        }

        const [movedRow] = rows.splice(normalizedFrom, 1);
        const [movedProps] = blockProps.splice(normalizedFrom, 1);

        if (normalizedTo > normalizedFrom) {
          normalizedTo--;
        }

        rows.splice(normalizedTo, 0, movedRow);
        blockProps.splice(normalizedTo, 0, movedProps);

        currentlySelectedRowIndex = normalizedTo;
        currentlySelectedBlockIndex = 0;
        formHandler.updateForm();
        redraw();
        return normalizedTo;
      });
    };
    const setSelectedRow = (row) => {
      const rows = getCurrentSubPanel()?.blockElements?.rows || [];
      const normalizedRow = clamp(row, 0, Math.max(0, rows.length - 1));

      if (normalizedRow === currentlySelectedRowIndex) {
        return;
      }

      currentlySelectedRowIndex = normalizedRow;
      currentlySelectedBlockIndex = 0;
      formHandler.updateForm();
    };
    
    const setSelectedRowAndBlock = (row, block) => {
      const rows = getCurrentSubPanel()?.blockElements?.rows || [];
      const requestedRow = Number(row);
      const normalizedRow = clamp(
        Number.isFinite(requestedRow) ? requestedRow : 0,
        0,
        Math.max(0, rows.length - 1)
      );
      const blocksInRow = rows[normalizedRow] || [];
      const requestedBlock = Number(block);

      currentlySelectedRowIndex = normalizedRow;
      currentlySelectedBlockIndex = clamp(
        Number.isFinite(requestedBlock) ? requestedBlock : 0,
        0,
        Math.max(0, blocksInRow.length - 1)
      );

      formHandler.updateForm();
      redraw();
    };

    const newControlElem = (selectedElem) => {
      return runWithUndo(() => {
        const blockElems = getCurrentSubPanel().blockElements;
        blockElems.addElement(
          Control.prototype.blockToClassElems[selectedElem],
          {},
          currentlySelectedRowIndex,
          ++currentlySelectedBlockIndex
        );

        applyStoredShieldDefaultsToCurrentBlock();

        formHandler.updateForm();
        redraw();
      });
    };
  
    const isTextControlBlock = (blockElement) =>
      typeof TextElement !== "undefined" && blockElement instanceof TextElement;

    const createReplacementControlElem = (nextElemType, previousBlock) => {
      const Constructor = Control.prototype.blockToClassElems[nextElemType];

      if (typeof Constructor !== "function") {
        return null;
      }

      const nextBlock = new Constructor();

      const nextIsShield =
        typeof ShieldElement !== "undefined" && nextBlock instanceof ShieldElement;

      if (nextIsShield) {
        applyStoredShieldDefaultsToBlock(nextBlock);
      }

      // Shield -> Control Text / Action Message / Advisory Message:
      // do not clear textContent. Their constructors already apply the saved/default text.
      return nextBlock;
    };

    const replaceControlElemTypeAt = (rowIndex, blockIndex, nextElemType) => {
      return runWithUndo(() => {
        if (!Control.prototype.blockToClassElems[nextElemType]) {
          return;
        }

        const subPanel = getCurrentSubPanel();

        if (!subPanel || !subPanel.blockElements) {
          return;
        }

        const rows = subPanel.blockElements.rows;

        if (!Array.isArray(rows) || rows.length === 0) {
          return;
        }

        const normalizedRowIndex = clamp(
          rowIndex,
          0,
          Math.max(0, rows.length - 1)
        );

        const row = rows[normalizedRowIndex];

        if (!Array.isArray(row) || row.length === 0) {
          return;
        }

        const normalizedBlockIndex = clamp(
          blockIndex,
          0,
          Math.max(0, row.length - 1)
        );

        const previousBlock = row[normalizedBlockIndex];

        if (!previousBlock) {
          return;
        }

        const previousElemType =
          Control.prototype.blockToClassElems.getElem(previousBlock);

        if (previousElemType === nextElemType) {
          currentlySelectedRowIndex = normalizedRowIndex;
          currentlySelectedBlockIndex = normalizedBlockIndex;
          formHandler.updateForm();
          return;
        }

        const nextBlock = createReplacementControlElem(
          nextElemType,
          previousBlock
        );

        if (!nextBlock) {
          return;
        }

        row[normalizedBlockIndex] = nextBlock;
        currentlySelectedRowIndex = normalizedRowIndex;
        currentlySelectedBlockIndex = normalizedBlockIndex;

        formHandler.updateForm();
        redraw();
      });
    };

    const delControlElem = () => {
      return runWithUndo(() => {
        const blockElems = getCurrentSubPanel().blockElements;
        if (
          blockElems.removeElement(
            currentlySelectedRowIndex,
            currentlySelectedBlockIndex
          )
        ) {
          currentlySelectedRowIndex--;
          currentlySelectedBlockIndex = getCurrentBlockRows().length - 1;
        } else {
          currentlySelectedBlockIndex--;
        }
        formHandler.updateForm();
        redraw();
      });
    };

    const moveControlElem = (
      fromRowIndex,
      fromBlockIndex,
      toRowIndex,
      toBlockIndex
    ) => {
      return runWithUndo(() => {
        const blockElements = getCurrentSubPanel().blockElements;
        const sourceRow = blockElements.rows[fromRowIndex];
        if (!sourceRow || !sourceRow.length) {
          return;
        }

        const movingWithinRow = fromRowIndex === toRowIndex;
        const rowLengthBeforeRemoval = sourceRow.length;

        const normalizedFrom = clamp(
          fromBlockIndex,
          0,
          Math.max(0, rowLengthBeforeRemoval - 1)
        );
        const [movedElem] = sourceRow.splice(normalizedFrom, 1);
        if (!movedElem) {
          return;
        }

        let destinationRowIndex = toRowIndex;
        if (!movingWithinRow && sourceRow.length === 0) {
          blockElements.rows.splice(fromRowIndex, 1);
          blockElements.blockProperties.splice(fromRowIndex, 1);
          if (fromRowIndex < toRowIndex) {
            destinationRowIndex = Math.max(0, toRowIndex - 1);
          }
        }

        const targetRow = blockElements.rows[destinationRowIndex];
        if (!targetRow) {
          return;
        }

        let normalizedTo;
        if (movingWithinRow) {
          const maxIndex = rowLengthBeforeRemoval;
          normalizedTo = clamp(toBlockIndex, 0, maxIndex);
          if (normalizedTo > normalizedFrom) {
            normalizedTo--;
          }
        } else {
          normalizedTo = clamp(toBlockIndex, 0, targetRow.length);
        }

        targetRow.splice(normalizedTo, 0, movedElem);

        currentlySelectedRowIndex = destinationRowIndex;
        currentlySelectedBlockIndex = normalizedTo;
        formHandler.updateForm();
        redraw();
      });
    };
    const duplicateBlockIntoNewRow = (sourceRowIndex, sourceBlockIndex) => {
      return runWithUndo(() => {
        const blockElements = getCurrentSubPanel().blockElements;
        if (
          !blockElements ||
          !Array.isArray(blockElements.rows) ||
          !blockElements.rows.length
        ) {
          return;
        }

        const normalizedRow = clamp(
          sourceRowIndex,
          0,
          blockElements.rows.length - 1
        );
        const sourceRow = blockElements.rows[normalizedRow];
        if (!Array.isArray(sourceRow) || !sourceRow.length) {
          return;
        }

        const normalizedBlock = clamp(
          sourceBlockIndex,
          0,
          Math.max(0, sourceRow.length - 1)
        );
        const sourceBlock = sourceRow[normalizedBlock];
        if (!sourceBlock) {
          return;
        }

        const blockElemType =
          Control.prototype.blockToClassElems.getElem(sourceBlock);
        if (!blockElemType) {
          return;
        }
        const Constructor = Control.prototype.blockToClassElems[blockElemType];
        if (typeof Constructor !== "function") {
          return;
        }

        const duplicatedBlock = Object.assign(new Constructor(), sourceBlock);
        const insertRowIndex = clamp(
          normalizedRow + 1,
          0,
          blockElements.rows.length
        );

        blockElements.rows.splice(insertRowIndex, 0, [duplicatedBlock]);
        blockElements.blockProperties.splice(insertRowIndex, 0, new Block());

        currentlySelectedRowIndex = insertRowIndex;
        currentlySelectedBlockIndex = 0;
        formHandler.updateForm();
        redraw();
      });
    };

  const setSelectedControlElem = (block) => {
    currentlySelectedBlockIndex = clamp(
      block,
      0,
      getCurrentBlockRows().length - 1
    );
    formHandler.updateForm();

    // Flash the selected block element on the sign
    const subPanelContainer = document.querySelector(
      `.blockElementMaster[data-panel-index="${currentlySelectedPanelIndex}"][data-subpanel="${currentlySelectedSubPanelIndex}"]`
    );
    if (subPanelContainer) {
      const signBlockElmt = subPanelContainer.querySelector(
        `[data-sign-row="${currentlySelectedRowIndex}"][data-sign-block="${currentlySelectedBlockIndex}"]`
      );
        if (signBlockElmt) {
          flashElementAfterPostTransform(() => {
            const freshSubPanelContainer = document.querySelector(
              `.blockElementMaster[data-panel-index="${currentlySelectedPanelIndex}"][data-subpanel="${currentlySelectedSubPanelIndex}"]`
            );
            if (!freshSubPanelContainer) {
              return null;
            }

            return freshSubPanelContainer.querySelector(
              `[data-sign-row="${currentlySelectedRowIndex}"][data-sign-block="${currentlySelectedBlockIndex}"]`
            );
          });
        }
    }
  };

    const duplicateControlElem = () => {
      return runWithUndo(() => {
        const subPanel = getCurrentSubPanel();
        if (!subPanel || !subPanel.blockElements) {
          return;
        }
        const blockElements = subPanel.blockElements;
        const rows = blockElements.rows || [];
        const row = rows[currentlySelectedRowIndex];
        if (!Array.isArray(row) || !row.length) {
          return;
        }
        const sourceBlock = row[currentlySelectedBlockIndex];
        if (!sourceBlock) {
          return;
        }
        const blockElemType =
          Control.prototype.blockToClassElems.getElem(sourceBlock);
        const Constructor = blockElemType
          ? Control.prototype.blockToClassElems[blockElemType]
          : null;
        if (typeof Constructor !== "function") {
          return;
        }
        const duplicatedBlock = Object.assign(new Constructor(), sourceBlock);
        const insertIndex = clamp(
          currentlySelectedBlockIndex + 1,
          0,
          row.length
        );
        row.splice(insertIndex, 0, duplicatedBlock);
        currentlySelectedBlockIndex = insertIndex;
        formHandler.updateForm();
        redraw();
      });
    };
    
    // APL Arrow Management Functions
      const APL_ARROW_TYPES = {
        UP: {
          label: "Up",
          type: "APL_UP",
          flip: false,
        },
        UP_LEFT: {
          label: "Up Left Turn",
          type: "APL_UP_TURN",
          flip: true,
        },
        UP_RIGHT: {
          label: "Up Right Turn",
          type: "APL_UP_TURN",
          flip: false,
        },
        DUAL_TURN: {
          label: "Dual Turn",
          type: "APL_DUAL_TURN",
          flip: false,
        },
        LEFT_TURN: {
          label: "Left Turn",
          type: "APL_TURN",
          flip: true,
        },
        RIGHT_TURN: {
          label: "Right Turn",
          type: "APL_TURN",
          flip: false,
        },
      };

        const getDefaultAPLArrowSizeRem = (arrowType) => {
          if (arrowType === "APL_TURN") {
            return 3.5;
          }

          if (arrowType === "APL_DUAL_TURN") {
            return 4.5;
          }

          return 4.75;
        };

        const DEFAULT_APL_ARROW_SPACING_REM = 12;
        const APL_EDGE_PADDING_REM = 0.45;
        const APL_EXIT_ONLY_LABEL_WIDTH_REM = 3.25;
        const APL_EXIT_ONLY_STRAIGHT_GAP_REM = 1.15;
        const APL_EXIT_ONLY_TURN_GAP_REM = 1.1;
        const APL_EXIT_ONLY_TURN_STEM_OFFSET_REM = -0.75;
        const APL_ARROW_ZONE_EXTRA_REM = 1.15;
        const APL_DIVIDER_ARROW_BOTTOM_OFFSET_REM = 0.45;
        const APL_DIVIDER_LINE_GAP_REM = 0.25;

        const normalizeAPLArrowKind = (kind) =>
          APL_ARROW_TYPES[kind] ? kind : "UP";

        const normalizeArrowMode = (mode) =>
          mode === "apl" ? "apl" : "standard";

        const setCurrentPanelArrowMode = function (mode) {
          return runWithUndo(() => {
            const panel = getCurrentPanel();
            const sign = panel?.sign;

            if (!sign) {
              return;
            }

            const nextMode = normalizeArrowMode(mode);
            sign.arrowMode = nextMode;

            if (nextMode === "apl") {
              sign.guideArrow = "None";

              const guideArrowSelect = document.getElementById("guideArrow");
              if (guideArrowSelect) {
                guideArrowSelect.value = "None";
              }
            }

            formHandler.updateForm();
            redraw();
          });
        };

        const normalizeAPLArrowSpacing = (value, fallback = DEFAULT_APL_ARROW_SPACING_REM) => {
          const parsed = Number(value);
          return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
        };

      const getAPLArrowKindFromArrow = (arrow) => {
        if (!arrow) {
          return "UP";
        }

        if (arrow.type === "APL_UP") {
          return "UP";
        }

        if (arrow.type === "APL_UP_TURN") {
          return arrow.flip ? "UP_LEFT" : "UP_RIGHT";
        }

        if (arrow.type === "APL_DUAL_TURN") {
          return "DUAL_TURN";
        }

        if (arrow.type === "APL_TURN") {
          return arrow.flip ? "LEFT_TURN" : "RIGHT_TURN";
        }

        return "UP";
      };

        const shouldResetAPLArrowSizeForTypeChange = (oldKind, newKind) => {
          const oldPreset = APL_ARROW_TYPES[normalizeAPLArrowKind(oldKind)];
          const newPreset = APL_ARROW_TYPES[normalizeAPLArrowKind(newKind)];

          if (!oldPreset || !newPreset) {
            return false;
          }

          return oldPreset.type !== newPreset.type;
        };

        const applyAPLArrowKind = (arrow, kind, { resetSizeOnTypeChange = false } = {}) => {
          const oldKind = arrow.kind || getAPLArrowKindFromArrow(arrow);
          const normalizedKind = normalizeAPLArrowKind(kind);
          const preset = APL_ARROW_TYPES[normalizedKind];

          arrow.kind = normalizedKind;
          arrow.type = preset.type;
          arrow.flip = preset.flip;

          if (
            resetSizeOnTypeChange &&
            shouldResetAPLArrowSizeForTypeChange(oldKind, normalizedKind)
          ) {
            arrow.arrowSizeRem = getDefaultAPLArrowSizeRem(arrow.type);
          }

          return arrow;
        };

      const normalizeAPLArrowObject = (arrow, fallbackSubPanelIndex = 0) => {
        if (!arrow) {
          return null;
        }

        const sign = getCurrentPanel().sign;
        const maxSubPanelIndex = Math.max(0, sign.subPanels.length - 1);

        if (!arrow.kind) {
          arrow.kind = getAPLArrowKindFromArrow(arrow);
        }

        applyAPLArrowKind(arrow, arrow.kind);

        if (arrow.placement !== "divider") {
          arrow.placement = "subpanel";
        }

        if (arrow.placement === "divider") {
          const dividerIndex =
            typeof arrow.dividerAfterSubPanelIndex === "number"
              ? arrow.dividerAfterSubPanelIndex
              : typeof arrow.subPanelIndex === "number"
                ? arrow.subPanelIndex
                : fallbackSubPanelIndex;

          arrow.dividerAfterSubPanelIndex = clamp(
            dividerIndex,
            0,
            Math.max(0, sign.subPanels.length - 2)
          );

          delete arrow.subPanelIndex;
        } else {
          arrow.subPanelIndex = clamp(
            typeof arrow.subPanelIndex === "number"
              ? arrow.subPanelIndex
              : fallbackSubPanelIndex,
            0,
            maxSubPanelIndex
          );

          delete arrow.dividerAfterSubPanelIndex;
        }

        arrow.dividerAfter = false;
        arrow.groupedWithDivider = false;

          const afterSpacing = Number(arrow.spacingAfterRem);
          const beforeSpacing = Number(arrow.spacingBeforeRem);

          if (arrow.aplSpacingInitialized !== true) {
            arrow.spacingAfterRem =
              Number.isFinite(afterSpacing) && afterSpacing > 0
                ? afterSpacing
                : DEFAULT_APL_ARROW_SPACING_REM;

            arrow.spacingBeforeRem =
              Number.isFinite(beforeSpacing) && beforeSpacing > 0
                ? beforeSpacing
                : DEFAULT_APL_ARROW_SPACING_REM;

            arrow.aplSpacingInitialized = true;
          } else {
            arrow.spacingAfterRem =
              Number.isFinite(afterSpacing) && afterSpacing >= 0
                ? afterSpacing
                : DEFAULT_APL_ARROW_SPACING_REM;

            arrow.spacingBeforeRem =
              Number.isFinite(beforeSpacing) && beforeSpacing >= 0
                ? beforeSpacing
                : DEFAULT_APL_ARROW_SPACING_REM;
          }

          if (!Number.isFinite(Number(arrow.arrowSizeRem))) {
            arrow.arrowSizeRem = getDefaultAPLArrowSizeRem(arrow.type);
          }

          return arrow;
      };

      const normalizeAllAPLArrows = () => {
        const sign = getCurrentPanel().sign;

        if (!Array.isArray(sign.aplArrows)) {
          sign.aplArrows = [];
        }

        sign.aplArrows.forEach((arrow, index) => {
          normalizeAPLArrowObject(arrow, index);
        });

        normalizeAPLArrowsForSubpanelDividerGroups(sign);
      };

    const getDefaultAPLArrowKindForSubPanel = (
      subPanelIndex,
      { useAdjacentDividerSuggestions = false } = {}
    ) => {
      const panel = getCurrentPanel();
      const sign = panel?.sign;
      const count = sign?.subPanels?.length || 0;

      const index = clamp(
        typeof subPanelIndex === "number"
          ? subPanelIndex
          : currentlySelectedSubPanelIndex,
        0,
        Math.max(0, count - 1)
      );

      const hasLeftExitTab =
        Array.isArray(panel?.exitTabs) &&
        panel.exitTabs.some(
          (exitTab) =>
            String(exitTab?.position || "").toLowerCase() === "left"
        );

      const getFallbackKind = () => {
        if (count === 2) {
          if (index === 0) {
            return hasLeftExitTab ? "LEFT_TURN" : "UP";
          }

          if (index === 1) {
            return hasLeftExitTab ? "UP" : "RIGHT_TURN";
          }
        }

        if (count === 3) {
          if (index === 0) return "LEFT_TURN";
          if (index === 1) return "UP";
          if (index === 2) return "RIGHT_TURN";
        }

        return "UP";
      };

      const getAdjacentDividerSuggestion = (side) => {
        const dividerAfterSubPanelIndex =
          side === "left" ? index - 1 : index;

        if (
          dividerAfterSubPanelIndex < 0 ||
          dividerAfterSubPanelIndex > count - 2
        ) {
          return null;
        }

        const dividerArrow = (sign.aplArrows || []).find(
          (arrow) =>
            arrow.placement === "divider" &&
            arrow.dividerAfterSubPanelIndex === dividerAfterSubPanelIndex
        );

        if (!dividerArrow) {
          return null;
        }

        const dividerKind = normalizeAPLArrowKind(
          dividerArrow.kind || getAPLArrowKindFromArrow(dividerArrow)
        );

        const isStrongDividerKind =
          dividerKind === "DUAL_TURN" ||
          dividerKind === "UP_LEFT" ||
          dividerKind === "UP_RIGHT";

        let suggestedKind = null;

        if (dividerKind === "UP") {
          suggestedKind = "UP";
        } else if (side === "left") {
          if (
            dividerKind === "UP_RIGHT" ||
            dividerKind === "DUAL_TURN" ||
            dividerKind === "RIGHT_TURN"
          ) {
            suggestedKind = "RIGHT_TURN";
          } else if (
            dividerKind === "UP_LEFT" ||
            dividerKind === "LEFT_TURN"
          ) {
            suggestedKind = "LEFT_TURN";
          }
        } else if (side === "right") {
          if (
            dividerKind === "UP_LEFT" ||
            dividerKind === "DUAL_TURN" ||
            dividerKind === "LEFT_TURN"
          ) {
            suggestedKind = "LEFT_TURN";
          } else if (
            dividerKind === "UP_RIGHT" ||
            dividerKind === "RIGHT_TURN"
          ) {
            suggestedKind = "RIGHT_TURN";
          }
        }

        if (!suggestedKind) {
          suggestedKind = dividerKind;
        }

        return {
          dividerKind,
          suggestedKind: normalizeAPLArrowKind(suggestedKind),
          isStrongDividerKind,
        };
      };

      if (useAdjacentDividerSuggestions) {
        const leftSuggestion = getAdjacentDividerSuggestion("left");
        const rightSuggestion = getAdjacentDividerSuggestion("right");

        if (leftSuggestion && rightSuggestion) {
          if (leftSuggestion.dividerKind === rightSuggestion.dividerKind) {
            return leftSuggestion.dividerKind;
          }

          if (leftSuggestion.suggestedKind === rightSuggestion.suggestedKind) {
            return leftSuggestion.suggestedKind;
          }

          if (
            leftSuggestion.isStrongDividerKind &&
            !rightSuggestion.isStrongDividerKind
          ) {
            return leftSuggestion.suggestedKind;
          }

          if (
            rightSuggestion.isStrongDividerKind &&
            !leftSuggestion.isStrongDividerKind
          ) {
            return rightSuggestion.suggestedKind;
          }

          return getFallbackKind();
        }

        if (leftSuggestion) {
          return leftSuggestion.suggestedKind;
        }

        if (rightSuggestion) {
          return rightSuggestion.suggestedKind;
        }
      }

      return getFallbackKind();
    };

    const getDefaultAPLDividerKind = (dividerAfterSubPanelIndex) => {
      const sign = getCurrentPanel().sign;
      const count = sign.subPanels.length;
      const index = clamp(
        typeof dividerAfterSubPanelIndex === "number" ? dividerAfterSubPanelIndex : 0,
        0,
        Math.max(0, count - 2)
      );

      if (count === 2) {
        return "UP_RIGHT";
      }

      if (count === 3) {
        return index === 0 ? "UP_LEFT" : "UP_RIGHT";
      }

      return "UP_RIGHT";
    };

    const getDefaultAPLArrowKindForSelectedSubPanel = () =>
      getDefaultAPLArrowKindForSubPanel(currentlySelectedSubPanelIndex);

    const getPreviousAPLSpacingForPlacement = ({
      placement,
      subPanelIndex,
      dividerAfterSubPanelIndex,
    }) => {
      const sign = getCurrentPanel().sign;

      if (placement === "divider") {
        const normalizedDividerIndex = getNearestVisibleAPLDividerIndex(
          sign,
          dividerAfterSubPanelIndex
        );

        const previousDividerArrows = sign.aplArrows.filter(
          (arrow) =>
            arrow.placement === "divider" &&
            arrow.dividerAfterSubPanelIndex === normalizedDividerIndex
        );

        const previousArrow = previousDividerArrows[previousDividerArrows.length - 1];

        if (previousArrow) {
          return normalizeAPLArrowSpacing(previousArrow.spacingAfterRem);
        }

        return DEFAULT_APL_ARROW_SPACING_REM;
      }

      const normalizedSubPanelIndex = getAPLGroupStartForSubPanelIndex(
        sign,
        subPanelIndex
      );

      const previousSubpanelArrows = sign.aplArrows.filter(
        (arrow) =>
          arrow.placement !== "divider" &&
          arrow.subPanelIndex === normalizedSubPanelIndex
      );

      const previousArrow = previousSubpanelArrows[previousSubpanelArrows.length - 1];

      if (previousArrow) {
        return normalizeAPLArrowSpacing(previousArrow.spacingAfterRem);
      }

      return DEFAULT_APL_ARROW_SPACING_REM;
    };

    const addAPLArrow = function (
      kind = null,
      {
        placement = "subpanel",
        subPanelIndex = currentlySelectedSubPanelIndex,
        dividerAfterSubPanelIndex = Math.max(0, currentlySelectedSubPanelIndex),
      } = {}
    ) {
      return runWithUndo(() => {
        const sign = getCurrentPanel().sign;
        normalizeAllAPLArrows();

        const normalizedPlacement = placement === "divider" ? "divider" : "subpanel";

        const normalizedSubPanelIndex = getAPLGroupStartForSubPanelIndex(
          sign,
          clamp(subPanelIndex, 0, Math.max(0, sign.subPanels.length - 1))
        );

        const normalizedDividerIndex = getNearestVisibleAPLDividerIndex(
          sign,
          clamp(dividerAfterSubPanelIndex, 0, Math.max(0, sign.subPanels.length - 2))
        );

        if (normalizedPlacement === "divider" && normalizedDividerIndex === null) {
          return;
        }

          const targetSubpanelAlreadyHasArrows =
            normalizedPlacement !== "divider" &&
            sign.aplArrows.some(
              (arrow) =>
                arrow.placement !== "divider" &&
                arrow.subPanelIndex === normalizedSubPanelIndex
            );

          const arrowKind = normalizeAPLArrowKind(
            kind ||
              (normalizedPlacement === "divider"
                ? getDefaultAPLDividerKind(normalizedDividerIndex)
                : getDefaultAPLArrowKindForSubPanel(normalizedSubPanelIndex, {
                    useAdjacentDividerSuggestions: !targetSubpanelAlreadyHasArrows,
                  }))
          );

        if (
          normalizedPlacement === "divider" &&
          sign.aplArrows.some(
            (arrow) =>
              arrow.placement === "divider" &&
              arrow.dividerAfterSubPanelIndex === normalizedDividerIndex
          )
        ) {
          return;
        }

        const inheritedSpacing = getPreviousAPLSpacingForPlacement({
          placement: normalizedPlacement,
          subPanelIndex: normalizedSubPanelIndex,
          dividerAfterSubPanelIndex: normalizedDividerIndex,
        });

        sign.newAPLArrow(APL_ARROW_TYPES[arrowKind].type);

        const newArrowIndex = sign.aplArrows.length - 1;
        const newArrow = sign.aplArrows[newArrowIndex];

        applyAPLArrowKind(newArrow, arrowKind);

        newArrow.placement = normalizedPlacement;

        if (newArrow.placement === "divider") {
          newArrow.dividerAfterSubPanelIndex = normalizedDividerIndex;
          delete newArrow.subPanelIndex;
        } else {
          newArrow.subPanelIndex = normalizedSubPanelIndex;
          delete newArrow.dividerAfterSubPanelIndex;
        }

        newArrow.spacingAfterRem = inheritedSpacing;
        newArrow.spacingBeforeRem = inheritedSpacing;
        newArrow.aplSpacingInitialized = true;
        newArrow.arrowSizeRem = getDefaultAPLArrowSizeRem(newArrow.type);
        newArrow.exitOnly = false;
        newArrow.dividerAfter = false;
        newArrow.groupedWithDivider = false;

        currentlySelectedAPLArrowIndex = newArrowIndex;

        formHandler.updateForm();
        redraw();
      });
    };

      const removeAPLArrowAt = function (arrowIndex) {
        return runWithUndo(() => {
          const sign = getCurrentPanel().sign;
          normalizeAllAPLArrows();

          if (arrowIndex < 0 || arrowIndex >= sign.aplArrows.length) {
            return;
          }

          sign.aplArrows.splice(arrowIndex, 1);

          currentlySelectedAPLArrowIndex = clamp(
            currentlySelectedAPLArrowIndex,
            0,
            Math.max(0, sign.aplArrows.length - 1)
          );

          formHandler.updateForm();
          redraw();
        });
      };

      const removeAPLArrow = function () {
        return removeAPLArrowAt(currentlySelectedAPLArrowIndex);
      };

      const selectAPLArrow = function (index) {
        const sign = getCurrentPanel().sign;
        normalizeAllAPLArrows();

        currentlySelectedAPLArrowIndex = clamp(
          index,
          0,
          Math.max(0, sign.aplArrows.length - 1)
        );

        const arrow = sign.aplArrows[currentlySelectedAPLArrowIndex];

        if (arrow?.placement === "subpanel") {
          currentlySelectedSubPanelIndex = clamp(
            arrow.subPanelIndex,
            0,
            sign.subPanels.length - 1
          );
        } else if (arrow?.placement === "divider") {
          currentlySelectedSubPanelIndex = clamp(
            arrow.dividerAfterSubPanelIndex,
            0,
            sign.subPanels.length - 1
          );
        }

        formHandler.updateForm();
      };

      const updateAPLArrowType = function (kind, index = currentlySelectedAPLArrowIndex) {
        return runWithUndo(() => {
          const sign = getCurrentPanel().sign;
          normalizeAllAPLArrows();

          if (index >= 0 && index < sign.aplArrows.length) {
              applyAPLArrowKind(sign.aplArrows[index], kind, {
                resetSizeOnTypeChange: true,
              });
            currentlySelectedAPLArrowIndex = index;

            formHandler.updateForm();
            redraw();
          }
        });
      };

      const toggleAPLArrowFlip = function (index) {
        return runWithUndo(() => {
          const sign = getCurrentPanel().sign;
          normalizeAllAPLArrows();

          const targetIndex =
            typeof index === "number" ? index : currentlySelectedAPLArrowIndex;

          if (targetIndex >= 0 && targetIndex < sign.aplArrows.length) {
            const arrow = sign.aplArrows[targetIndex];

            if (arrow.kind === "UP_LEFT") {
              applyAPLArrowKind(arrow, "UP_RIGHT");
            } else if (arrow.kind === "UP_RIGHT") {
              applyAPLArrowKind(arrow, "UP_LEFT");
            } else if (arrow.kind === "LEFT_TURN") {
              applyAPLArrowKind(arrow, "RIGHT_TURN");
            } else if (arrow.kind === "RIGHT_TURN") {
              applyAPLArrowKind(arrow, "LEFT_TURN");
            } else {
              arrow.flip = !arrow.flip;
            }

            currentlySelectedAPLArrowIndex = targetIndex;

            formHandler.updateForm();
            redraw();
          }
        });
      };

      const addAPLDivider = function () {
        return;
      };

      const setAPLArrowSpacing = function (arrowIndex, spacingRem) {
        return runWithUndo(() => {
          const sign = getCurrentPanel().sign;
          normalizeAllAPLArrows();

          if (arrowIndex >= 0 && arrowIndex < sign.aplArrows.length) {
            const parsedSpacing = parseFloat(spacingRem);
              sign.aplArrows[arrowIndex].spacingAfterRem =
                Number.isFinite(parsedSpacing) && parsedSpacing >= 0
                  ? parsedSpacing
                  : DEFAULT_APL_ARROW_SPACING_REM;
              sign.aplArrows[arrowIndex].aplSpacingInitialized = true;

            formHandler.updateForm();
            redraw();
          }
        });
      };
    
        const setAPLArrowBeforeSpacing = function (arrowIndex, spacingRem) {
          return runWithUndo(() => {
            const sign = getCurrentPanel().sign;

            if (arrowIndex >= 0 && arrowIndex < sign.aplArrows.length) {
              const parsedSpacing = parseFloat(spacingRem);
                sign.aplArrows[arrowIndex].spacingBeforeRem =
                  Number.isFinite(parsedSpacing) && parsedSpacing >= 0
                    ? parsedSpacing
                    : DEFAULT_APL_ARROW_SPACING_REM;
                sign.aplArrows[arrowIndex].aplSpacingInitialized = true;

              formHandler.updateForm();
              redraw();
            }
          });
        };
    
        const setAPLArrowSize = function (arrowIndex, sizeRem) {
          return runWithUndo(() => {
            const sign = getCurrentPanel().sign;
            normalizeAllAPLArrows();

            if (arrowIndex >= 0 && arrowIndex < sign.aplArrows.length) {
              const parsedSize = parseFloat(sizeRem);
              sign.aplArrows[arrowIndex].arrowSizeRem =
                Number.isFinite(parsedSize) && parsedSize > 0
                  ? parsedSize
                  : getDefaultAPLArrowSizeRem(sign.aplArrows[arrowIndex].type);

              formHandler.updateForm();
              redraw();
            }
          });
        };

      const setAPLExitOnly = function (index, isExitOnly) {
        return runWithUndo(() => {
          const sign = getCurrentPanel().sign;
          normalizeAllAPLArrows();

          if (index >= 0 && index < sign.aplArrows.length) {
            sign.aplArrows[index].exitOnly = !!isExitOnly;
            currentlySelectedAPLArrowIndex = index;

            formHandler.updateForm();
            redraw();
          }
        });
      };

      const moveAPLArrow = function (
        fromIndex,
        {
          placement = "subpanel",
          subPanelIndex = 0,
          dividerAfterSubPanelIndex = 0,
          beforeIndex = null,
        } = {}
      ) {
        return runWithUndo(() => {
          const sign = getCurrentPanel().sign;
          normalizeAllAPLArrows();

          if (fromIndex < 0 || fromIndex >= sign.aplArrows.length) {
            return;
          }

            if (
              placement === "divider" &&
              sign.aplArrows.some(
                (arrow, index) =>
                  index !== fromIndex &&
                  arrow.placement === "divider" &&
                  arrow.dividerAfterSubPanelIndex === dividerAfterSubPanelIndex
              )
            ) {
              return;
            }

            const [arrow] = sign.aplArrows.splice(fromIndex, 1);

          arrow.placement = placement === "divider" ? "divider" : "subpanel";

          if (arrow.placement === "divider") {
            const normalizedDividerIndex = getNearestVisibleAPLDividerIndex(
              sign,
              dividerAfterSubPanelIndex
            );

            if (normalizedDividerIndex === null) {
              arrow.placement = "subpanel";
              arrow.subPanelIndex = getAPLGroupStartForSubPanelIndex(sign, 0);
              delete arrow.dividerAfterSubPanelIndex;
            } else {
              arrow.dividerAfterSubPanelIndex = normalizedDividerIndex;
              delete arrow.subPanelIndex;
            }
          } else {
            arrow.subPanelIndex = getAPLGroupStartForSubPanelIndex(
              sign,
              clamp(subPanelIndex, 0, Math.max(0, sign.subPanels.length - 1))
            );
            delete arrow.dividerAfterSubPanelIndex;
          }

          let insertIndex =
            typeof beforeIndex === "number"
              ? clamp(beforeIndex, 0, sign.aplArrows.length)
              : sign.aplArrows.length;

          if (fromIndex < insertIndex) {
            insertIndex--;
          }

          sign.aplArrows.splice(insertIndex, 0, arrow);
          currentlySelectedAPLArrowIndex = insertIndex;

          formHandler.updateForm();
          redraw();
        });
      };

    const initializeAPLArrowsForCurrentPanel = function () {
      return runWithUndo(() => {
        const panel = getCurrentPanel();
        const sign = panel?.sign;

        if (!sign || !Array.isArray(sign.subPanels)) {
          return;
        }

          normalizeAllAPLArrows();

          sign.arrowMode = "apl";
          sign.guideArrow = "None";

          const guideArrowSelect = document.getElementById("guideArrow");
          if (guideArrowSelect) {
            guideArrowSelect.value = "None";
          }

          if (sign.aplPresetInitialized || sign.aplArrows.length > 0) {
            sign.aplPresetInitialized = true;
            formHandler.updateForm();
            redraw();
            return;
          }

        const makePresetArrow = ({
          kind,
          type,
          flip,
          placement,
          subPanelIndex,
          dividerAfterSubPanelIndex,
        }) => {
          sign.newAPLArrow(type);

          const arrow = sign.aplArrows[sign.aplArrows.length - 1];

          Object.assign(arrow, {
            kind,
            type,
            flip,
            placement,
            spacingAfterRem: DEFAULT_APL_ARROW_SPACING_REM,
            spacingBeforeRem: DEFAULT_APL_ARROW_SPACING_REM,
            aplSpacingInitialized: true,
            arrowSizeRem: getDefaultAPLArrowSizeRem(type),
            exitOnly: false,
            dividerAfter: false,
            groupedWithDivider: false,
          });

          if (placement === "divider") {
            arrow.dividerAfterSubPanelIndex = dividerAfterSubPanelIndex;
            delete arrow.subPanelIndex;
          } else {
            arrow.subPanelIndex = subPanelIndex;
            delete arrow.dividerAfterSubPanelIndex;
          }
        };

        const aplGroups = getAPLSubpanelGroupsForSign(sign);
        const count = aplGroups.length;

        if (count === 1) {
          makePresetArrow({
            kind: "UP",
            type: "APL_UP",
            flip: false,
            placement: "subpanel",
            subPanelIndex: aplGroups[0]?.start || 0,
          });
        } else if (count === 2) {
          makePresetArrow({
            kind: "UP",
            type: "APL_UP",
            flip: false,
            placement: "subpanel",
            subPanelIndex: aplGroups[0].start,
          });

          makePresetArrow({
            kind: "RIGHT_TURN",
            type: "APL_TURN",
            flip: false,
            placement: "subpanel",
            subPanelIndex: aplGroups[1].start,
          });

          makePresetArrow({
            kind: "UP_RIGHT",
            type: "APL_UP_TURN",
            flip: false,
            placement: "divider",
            dividerAfterSubPanelIndex: aplGroups[0].end,
          });
        } else if (count === 3) {
          makePresetArrow({
            kind: "LEFT_TURN",
            type: "APL_TURN",
            flip: true,
            placement: "subpanel",
            subPanelIndex: aplGroups[0].start,
          });

          makePresetArrow({
            kind: "UP",
            type: "APL_UP",
            flip: false,
            placement: "subpanel",
            subPanelIndex: aplGroups[1].start,
          });

          makePresetArrow({
            kind: "RIGHT_TURN",
            type: "APL_TURN",
            flip: false,
            placement: "subpanel",
            subPanelIndex: aplGroups[2].start,
          });

          makePresetArrow({
            kind: "UP_LEFT",
            type: "APL_UP_TURN",
            flip: true,
            placement: "divider",
            dividerAfterSubPanelIndex: aplGroups[0].end,
          });

          makePresetArrow({
            kind: "UP_RIGHT",
            type: "APL_UP_TURN",
            flip: false,
            placement: "divider",
            dividerAfterSubPanelIndex: aplGroups[1].end,
          });
        } else {
          aplGroups.forEach((group, groupIndex) => {
            makePresetArrow({
              kind:
                groupIndex === 0
                  ? "LEFT_TURN"
                  : groupIndex === aplGroups.length - 1
                    ? "RIGHT_TURN"
                    : "UP",
              type:
                groupIndex === 0 || groupIndex === aplGroups.length - 1
                  ? "APL_TURN"
                  : "APL_UP",
              flip: groupIndex === 0,
              placement: "subpanel",
              subPanelIndex: group.start,
            });

            if (groupIndex < aplGroups.length - 1) {
              makePresetArrow({
                kind: groupIndex === 0 ? "UP_LEFT" : "UP_RIGHT",
                type: "APL_UP_TURN",
                flip: groupIndex === 0,
                placement: "divider",
                dividerAfterSubPanelIndex: group.end,
              });
            }
          });
        }

        sign.aplPresetInitialized = true;
        currentlySelectedAPLArrowIndex = 0;

        formHandler.updateForm();
        redraw();
      });
    };

      const addAPLSubPanelLeftAndOpen = function () {
        return runWithUndo(() => {
          const sign = getCurrentPanel().sign;
          const oldSelected = currentlySelectedSubPanelIndex;

          sign.newSubPanel();
          const newSubPanel = sign.subPanels.pop();
          sign.subPanels.splice(oldSelected, 0, newSubPanel);

          currentlySelectedSubPanelIndex = oldSelected;
          currentlySelectedRowIndex = 0;
          currentlySelectedBlockIndex = 0;

          formHandler.updateForm();
          redraw();
        });
      };

      const addAPLSubPanelRightAndOpen = function () {
        return runWithUndo(() => {
          const sign = getCurrentPanel().sign;
          const oldSelected = currentlySelectedSubPanelIndex;

          sign.newSubPanel();
          const newSubPanel = sign.subPanels.pop();
          sign.subPanels.splice(oldSelected + 1, 0, newSubPanel);

          currentlySelectedSubPanelIndex = oldSelected;
          currentlySelectedRowIndex = 0;
          currentlySelectedBlockIndex = 0;

          formHandler.updateForm();
          redraw();
        });
      };

// END OF APL_ARROW_TYPES

  const buildMileageTemplate = () => {
    const destinations = ["A", "B", "C"];
    const rows = destinations.map((label) => [
      new ControlTextElement({ textContent: `Destination ${label}` }),
      new DividerElement({ visible: false, dividerWidth: 3, dividerMeasurement: "rem" }),
      new ControlTextElement({ textContent: "X" }),
    ]);
    const blockProperties = rows.map(() => new Block());
    return { rows, blockProperties };
  };

  const buildSimpleExitTemplate = () => {
    const actionMessage = new ActionMessageElement();
    actionMessage.textContent = "Distance";
    actionMessage.fontFamily = "Series EM";

    const rows = [
      [new ShieldElement({ shieldBase: "I", routeNumber: "X" })],
      [new ControlTextElement({ textContent: "Destination" })],
      [actionMessage],
    ];
    const blockProperties = [new Block(), new Block(), new Block()];
    return { rows, blockProperties };
  };

  const buildTolledExitTemplate = () => {
    const rows = [
      [
        new TollLogoElement({ logo: "MUTCD", logoHeight: 2 }),
        new ControlTextElement({
          textContent: "OR",
          fontSize: 50,
          fontFamily: "Series E",
          textColor: "Black",
        }),
        new ControlTextElement({
          textContent: "PAY BY\\nPLATE",
          fontSize: 50,
          fontFamily: "Series E",
          textColor: "Black",
        }),
      ],
      [
        new DividerElement({
          dividerWidth: 100,
          dividerMeasurement: "%",
          dividerColor: "Black",
          fullBleed: true,
        }),
      ],
      [new ControlTextElement({ textContent: "Destination" })],
    ];
    const blockProperties = [
      new Block({ backgroundColor: "White", bottomPadding: 0.25 }),
      new Block(),
      new Block(),
    ];
    return { rows, blockProperties };
  };

  const buildControlCitiesAdvanceJunctionTemplate = () => {
    const actionMessage = new ActionMessageElement();
    actionMessage.textContent = "Distance";
    actionMessage.fontFamily = "Series EM";

    const rows = [
      [
        new ShieldElement({
          shieldBase: "I",
          routeNumber: "X",
          bannerType: "Jct",
          bannerPosition: "Left",
        }),
      ],
      [new ControlTextElement({ textContent: "Destination A\\nDestination B" })],
      [actionMessage],
    ];
    const blockProperties = [new Block(), new Block(), new Block()];
    return { rows, blockProperties };
  };

    const applyTemplate = (templateName) => {
      return runWithUndo(() => {
        const confirmationMessage =
          "Are you sure you want to apply this template? THIS WILL OVERRIDE YOUR CURRENT SUBPANEL!";
        if (!window.confirm(confirmationMessage)) {
          return;
        }
        const subPanel = getCurrentSubPanel();
        if (!subPanel) {
          return;
        }
        let templateData = null;
        switch (templateName) {
          case "mileage-sign":
            templateData = buildMileageTemplate();
            break;
          case "simple-exit":
            templateData = buildSimpleExitTemplate();
            break;
          case "tolled-exit":
            templateData = buildTolledExitTemplate();
            break;
          case "control-cities-advance-junction":
            templateData = buildControlCitiesAdvanceJunctionTemplate();
            break;
          default:
            return;
        }
        subPanel.blockElements = new Control(templateData);
        currentlySelectedRowIndex = 0;
        currentlySelectedBlockIndex = 0;
        formHandler.updateForm();
        redraw();
      });
    };

  /**
    Download the sign from options
  */

  function getFile() {
    if (fileInfo.panel == -1) {
      /*
        post.showPost === true means the post is hidden.
        When hidden, export only the panel container so the old post area is not captured.
      */
      if (post.showPost === true) {
        return document.querySelector("#panelContainer");
      }

      return document.querySelector("#postContainer");
    }

    const selectedPanels = getDownloadPanelSelection();

    if (!selectedPanels.length) {
      return null;
    }

    return document.querySelector("#panelContainer");
  }

  const downloadFile = function (dataURL, ending) {
    let a = document.createElement(`a`);
    a.setAttribute("href", dataURL);
    a.setAttribute("download", "downloadedSign" + ending);
    a.click();
    a.remove();
  };
    
    const waitForImagesInElement = async (root, timeoutMs = 2500) => {
      if (!root) {
        return;
      }

      const images = Array.from(root.querySelectorAll("img"));
      if (!images.length) {
        return;
      }

      for (const img of images) {
        img.loading = "eager";
        img.decoding = "sync";
      }

      const imagePromises = images.map((img) => {
        if (img.complete) {
          return Promise.resolve();
        }

        return new Promise((resolve) => {
          const done = () => {
            img.removeEventListener("load", done);
            img.removeEventListener("error", done);
            resolve();
          };
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        });
      });

      await Promise.race([
        Promise.all(imagePromises),
        new Promise((resolve) => setTimeout(resolve, timeoutMs)),
      ]);
    };
  
  const waitForNextFrame = () =>
    new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });

  const getExportPixelRatio = (width, height, isPreview) => {
    if (isPreview) {
      return 1;
    }
    const maxDimension = Math.max(width, height);
    if (maxDimension >= 1800) {
      return 4;
    }
    if (maxDimension >= 1000) {
      return 3;
    }
    return 2;
  };

  const getExportBox = (element) => {
    const rect = element.getBoundingClientRect();

    return {
      width: Math.ceil(
        Math.max(rect.width, element.scrollWidth, element.offsetWidth, 1)
      ),
      height: Math.ceil(
        Math.max(rect.height, element.scrollHeight, element.offsetHeight, 1)
      ),
    };
  };

  const readBlobAsDataUrl = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const inlineFontFaceUrls = async (cssText, baseHref) => {
    if (!cssText || !cssText.includes("url(")) {
      return cssText || "";
    }

    const replacements = [];
    const urlRegex = /url\((['"]?)([^'")]+)\1\)/g;
    let match;

    while ((match = urlRegex.exec(cssText)) !== null) {
      const fullMatch = match[0];
      const rawUrl = String(match[2] || "").trim();

      if (!rawUrl || rawUrl.startsWith("data:")) {
        continue;
      }

      try {
        const resolvedUrl = new URL(rawUrl, baseHref || document.baseURI).href;
        const response = await fetch(resolvedUrl);

        if (!response.ok) {
          continue;
        }

        const dataUrl = await readBlobAsDataUrl(await response.blob());
        replacements.push([fullMatch, `url(${dataUrl})`]);
      } catch (error) {
        // Leave this URL as-is if it cannot be read.
      }
    }

    let inlinedCss = cssText;
    for (const [from, to] of replacements) {
      inlinedCss = inlinedCss.split(from).join(to);
    }

    return inlinedCss;
  };

  const getSafeExportFontEmbedCSS = async () => {
    const fontFaceRules = [];

    for (const sheet of Array.from(document.styleSheets)) {
      let rules;

      try {
        rules = Array.from(sheet.cssRules || []);
      } catch (error) {
        // Skip cross-origin stylesheets, such as Google Material Symbols.
        continue;
      }

      for (const rule of rules) {
        if (rule.type === CSSRule.FONT_FACE_RULE) {
          fontFaceRules.push({
            cssText: rule.cssText,
            baseHref: sheet.href || document.baseURI,
          });
        }
      }
    }

    const inlinedRules = await Promise.all(
      fontFaceRules.map((rule) =>
        inlineFontFaceUrls(rule.cssText, rule.baseHref)
      )
    );

    return inlinedRules.join("\n");
  };
  
  const materializeExportBannerFirstLetters = (root) => {
    if (!root) {
      return () => {};
    }

    const bannerElements = Array.from(
      root.querySelectorAll(".bannerA:not(.TOLL):not(.noIndent), .bannerB:not(.TOLL):not(.noIndent)")
    );

    const restoreCallbacks = [];

    for (const bannerEl of bannerElements) {
      const text = bannerEl.textContent || "";

      if (!text.trim()) {
        continue;
      }

      const firstVisibleMatch = text.match(/\S/);

      if (!firstVisibleMatch) {
        continue;
      }

      const baseStyle = window.getComputedStyle(bannerEl);
      const firstLetterStyle = window.getComputedStyle(
        bannerEl,
        "::first-letter"
      );

      const originalHTML = bannerEl.innerHTML;
      const originalClassName = bannerEl.className;

      const firstIndex = firstVisibleMatch.index;
      const beforeFirst = text.slice(0, firstIndex);
      const firstLetter = text.charAt(firstIndex);
      const afterFirst = text.slice(firstIndex + 1);

      const firstLetterSpan = document.createElement("span");
      firstLetterSpan.className = "exportBannerFirstLetter";
      firstLetterSpan.textContent = firstLetter;

      const copiedProperties = [
        "fontFamily",
        "fontSize",
        "fontWeight",
        "fontStyle",
        "fontStretch",
        "letterSpacing",
        "lineHeight",
        "color",
        "textTransform",
      ];

      for (const property of copiedProperties) {
        const value = firstLetterStyle[property];

        if (value && value !== baseStyle[property]) {
          firstLetterSpan.style[property] = value;
        }
      }

      bannerEl.classList.add("exportRealFirstLetter");
      bannerEl.replaceChildren();

      if (beforeFirst) {
        bannerEl.appendChild(document.createTextNode(beforeFirst));
      }

      bannerEl.appendChild(firstLetterSpan);

      if (afterFirst) {
        bannerEl.appendChild(document.createTextNode(afterFirst));
      }

      restoreCallbacks.push(() => {
        bannerEl.className = originalClassName;
        bannerEl.innerHTML = originalHTML;
      });
    }

    return () => {
      for (const restore of restoreCallbacks.reverse()) {
        restore();
      }
    };
  };


  const isElementVisibleForExport = (node) => {
    if (!node || !(node instanceof Element)) {
      return false;
    }

    const style = window.getComputedStyle(node);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0"
    ) {
      return false;
    }

    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const getElementAndDescendantBounds = (element) => {
    const rects = [];
    const addRect = (node) => {
      if (!isElementVisibleForExport(node)) {
        return;
      }

      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        rects.push(rect);
      }
    };

    addRect(element);
    element.querySelectorAll("*").forEach(addRect);

    if (!rects.length) {
      const fallbackRect = element.getBoundingClientRect();
      return {
        left: fallbackRect.left,
        top: fallbackRect.top,
        right: fallbackRect.right,
        bottom: fallbackRect.bottom,
        width: Math.max(fallbackRect.width, 1),
        height: Math.max(fallbackRect.height, 1),
      };
    }

    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    const right = Math.max(...rects.map((rect) => rect.right));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));

    return {
      left,
      top,
      right,
      bottom,
      width: Math.max(right - left, 1),
      height: Math.max(bottom - top, 1),
    };
  };

  const isPanelExportSourceElement = (child) =>
    child?.classList &&
    (child.classList.contains("panel") || child.classList.contains("panelStack"));

  const getPanelExportTopIndexFromElement = (element) => {
    if (!element || !element.dataset) {
      return null;
    }

    if (element.classList.contains("panelStack")) {
      const stackIndex = Number(element.dataset.stackTopPanelIndex);
      return Number.isInteger(stackIndex) ? stackIndex : null;
    }

    const panelIndex = Number(element.dataset.panelIndex);
    return Number.isInteger(panelIndex) ? panelIndex : null;
  };

  const getSelectedExportPanelIndexSet = () => {
    if (fileInfo.panel == -1) {
      return null;
    }

    const selectedPanels = getDownloadPanelSelection();

    if (!selectedPanels.length) {
      return new Set();
    }

    return new Set(selectedPanels);
  };

  const isPanelSourceAllowedForExport = (element, selectedPanelIndexSet) => {
    if (!isPanelExportSourceElement(element)) {
      return false;
    }

    const topPanelIndex = getPanelExportTopIndexFromElement(element);

    if (selectedPanelIndexSet) {
      return selectedPanelIndexSet.has(topPanelIndex);
    }

    return true;
  };

  const getExportCloneSourceElements = (element) => {
    if (!element) {
      return [];
    }

    const selectedPanelIndexSet = getSelectedExportPanelIndexSet();

    if (element.id === "panelContainer") {
      return Array.from(element.children).filter((child) =>
        isPanelSourceAllowedForExport(child, selectedPanelIndexSet)
      );
    }

    if (element.id === "postContainer") {
      const panelContainer = element.querySelector("#panelContainer");
      const panels = panelContainer
        ? Array.from(panelContainer.children).filter((child) =>
            isPanelSourceAllowedForExport(child, selectedPanelIndexSet)
          )
        : [];
      const posts =
        selectedPanelIndexSet && selectedPanelIndexSet.size > 0
          ? []
          : Array.from(element.children).filter(
              (child) =>
                child.classList &&
                child.classList.contains("post") &&
                isElementVisibleForExport(child)
            );

      return [...posts, ...panels];
    }

    return [element];
  };

  const getExportLayoutScale = (element) => {
    if (!element) {
      return 1;
    }

    const rect = element.getBoundingClientRect();
    const layoutWidth = element.offsetWidth || element.scrollWidth || 0;
    const layoutHeight = element.offsetHeight || element.scrollHeight || 0;

    const scaleX =
      layoutWidth > 0 && rect.width > 0 ? rect.width / layoutWidth : 1;
    const scaleY =
      layoutHeight > 0 && rect.height > 0 ? rect.height / layoutHeight : scaleX;

    const scales = [scaleX, scaleY].filter(
      (value) => Number.isFinite(value) && value > 0
    );

    if (!scales.length) {
      return 1;
    }

    return Math.max(0.01, Math.min(...scales));
  };

  const createStaticExportClone = (element) => {
    if (!element || !element.isConnected) {
      return null;
    }

    const sourceElements = getExportCloneSourceElements(element).filter(
      isElementVisibleForExport
    );

    if (!sourceElements.length) {
      return null;
    }

    const selectedPanelIndexSet = getSelectedExportPanelIndexSet();
    const shouldCompactSelectedPanels =
      selectedPanelIndexSet &&
      selectedPanelIndexSet.size > 0 &&
      (element.id === "panelContainer" || element.id === "postContainer");

    const layoutScale = getExportLayoutScale(element);
    const normalizeMeasurement = (value) => value / layoutScale;

    const panelContainer =
      element.id === "panelContainer"
        ? element
        : element.querySelector("#panelContainer");
    const panelContainerStyle = panelContainer
      ? window.getComputedStyle(panelContainer)
      : null;
    const selectedPanelGap = shouldCompactSelectedPanels
      ? normalizeMeasurement(
          parseFloat(
            panelContainerStyle?.columnGap ||
              panelContainerStyle?.gap ||
              panelContainerStyle?.getPropertyValue("gap") ||
              "0"
          ) || 0
        )
      : 0;

    const sourceInfos = sourceElements.map((sourceElement) => ({
      sourceElement,
      sourceRect: sourceElement.getBoundingClientRect(),
      bounds: getElementAndDescendantBounds(sourceElement),
    }));

    const left = Math.min(...sourceInfos.map((info) => info.bounds.left));
    const top = Math.min(...sourceInfos.map((info) => info.bounds.top));
    const right = Math.max(...sourceInfos.map((info) => info.bounds.right));
    const bottom = Math.max(...sourceInfos.map((info) => info.bounds.bottom));
    const padding = 12;

    const compactContentWidth = sourceInfos.reduce((totalWidth, info, index) => {
      const boundsWidth = normalizeMeasurement(info.bounds.width);
      return totalWidth + boundsWidth + (index > 0 ? selectedPanelGap : 0);
    }, 0);

    const exportWidth = Math.ceil(
      (shouldCompactSelectedPanels
        ? compactContentWidth
        : normalizeMeasurement(right - left)) +
        padding * 2
    );
    const exportHeight = Math.ceil(normalizeMeasurement(bottom - top) + padding * 2);

    const host = document.createElement("div");
    host.className = "exportStaticCaptureHost";
    host.style.position = "fixed";
    host.style.left = "calc(100vw + 100px)";
    host.style.top = "0";
    host.style.width = exportWidth + "px";
    host.style.height = exportHeight + "px";
    host.style.overflow = "hidden";
    host.style.background = "transparent";
    host.style.pointerEvents = "none";
    host.style.zIndex = "0";
    host.style.boxSizing = "border-box";

    const wrapper = document.createElement("div");
    wrapper.className = "exportStaticCaptureWrapper";
    wrapper.style.position = "relative";
    wrapper.style.left = "0";
    wrapper.style.top = "0";
    wrapper.style.width = exportWidth + "px";
    wrapper.style.height = exportHeight + "px";
    wrapper.style.overflow = "hidden";
    wrapper.style.background = "transparent";
    wrapper.style.pointerEvents = "none";
    wrapper.style.boxSizing = "border-box";

    let compactLeft = padding;

    sourceInfos.forEach(({ sourceElement, sourceRect, bounds }) => {
      const clone = sourceElement.cloneNode(true);

      if (clone.classList.contains("panelHiddenFromPost")) {
        return;
      }

      Array.from(clone.querySelectorAll(".panelHiddenFromPost")).forEach(
        (hiddenPanelClone) => hiddenPanelClone.remove()
      );

      if (clone.classList.contains("panelStack") && !clone.querySelector(".panel")) {
        return;
      }

      const cloneLeft = shouldCompactSelectedPanels
        ? compactLeft + normalizeMeasurement(sourceRect.left - bounds.left)
        : normalizeMeasurement(sourceRect.left - left) + padding;

      const sourceStyle = window.getComputedStyle(sourceElement);
      const isPanelLikeClone = isPanelExportSourceElement(sourceElement);

      clone.classList.add("exportStaticCaptureClone");
      clone.style.position = "absolute";
      clone.style.left = cloneLeft + "px";
      clone.style.top = normalizeMeasurement(sourceRect.top - top) + padding + "px";
      clone.style.boxSizing = sourceStyle.boxSizing || "content-box";
      clone.style.paddingTop = sourceStyle.paddingTop;
      clone.style.paddingRight = sourceStyle.paddingRight;
      clone.style.paddingBottom = sourceStyle.paddingBottom;
      clone.style.paddingLeft = sourceStyle.paddingLeft;
      clone.style.width = isPanelLikeClone
        ? sourceStyle.width
        : normalizeMeasurement(sourceRect.width) + "px";
      clone.style.height = isPanelLikeClone
        ? sourceStyle.height
        : normalizeMeasurement(sourceRect.height) + "px";
      clone.style.minWidth = isPanelLikeClone ? sourceStyle.minWidth : "0";
      clone.style.maxWidth = isPanelLikeClone ? sourceStyle.maxWidth : "none";
      clone.style.minHeight = isPanelLikeClone ? sourceStyle.minHeight : "0";
      clone.style.maxHeight = isPanelLikeClone ? sourceStyle.maxHeight : "none";
      clone.style.margin = "0";
      clone.style.overflow = "visible";
      clone.style.transform = "none";
      clone.style.transition = "none";
      clone.style.pointerEvents = "none";

      wrapper.appendChild(clone);

      if (shouldCompactSelectedPanels) {
        compactLeft += normalizeMeasurement(bounds.width) + selectedPanelGap;
      }
    });

    host.appendChild(wrapper);
    document.body.appendChild(host);

    return {
      node: wrapper,
      cleanup: () => host.remove(),
    };
  };

  const withTemporaryExportStyles = async (element, callback) => {
    const staticClone = createStaticExportClone(element);
    const exportElement = staticClone ? staticClone.node : element;
    const oldInline = staticClone
      ? null
      : {
          transform: element.style.transform,
          transition: element.style.transition,
          width: element.style.width,
          minWidth: element.style.minWidth,
          height: element.style.height,
          overflow: element.style.overflow,
          padding: element.style.padding,
          background: element.style.background,
        };

    if (!staticClone) {
      element.classList.add("exportCaptureTarget");
      element.style.transform = "none";
      element.style.transition = "none";
      element.style.overflow = "visible";
    }

    let restoreExportBannerFirstLetters = () => {};

    try {
      await waitForNextFrame();

      restoreExportBannerFirstLetters =
        materializeExportBannerFirstLetters(exportElement);

      await waitForNextFrame();
      await waitForImagesInElement(exportElement);
      await waitForNextFrame();
      const box = getExportBox(exportElement);
      return await callback(box, exportElement);
    } finally {
      restoreExportBannerFirstLetters();

      if (staticClone) {
        staticClone.cleanup();
      } else {
        element.classList.remove("exportCaptureTarget");
        element.style.transform = oldInline.transform;
        element.style.transition = oldInline.transition;
        element.style.width = oldInline.width;
        element.style.minWidth = oldInline.minWidth;
        element.style.height = oldInline.height;
        element.style.overflow = oldInline.overflow;
        element.style.padding = oldInline.padding;
        element.style.background = oldInline.background;
      }
    }
  };

  const saveSign = async function (file, isPreview, isSVG) {
    try {
      if (!file) {
        throw new Error("No export target found");
      }

      return await withTemporaryExportStyles(file, async ({ width, height }, exportElement) => {
        const exportOptions = {
          cacheBust: true,
          width,
          height,
          backgroundColor: "transparent",
          fontEmbedCSS: await getSafeExportFontEmbedCSS(),
          style: {
            transform: "none",
            transition: "none",
          },
        };

        if (isSVG) {
          const svgDataUrl = await htmlToImage.toSvg(exportElement, exportOptions);

          if (isPreview) {
            return svgDataUrl;
          }

          downloadFile(svgDataUrl, ".svg");
          return true;
        }

        const pngExportScale = getExportPixelRatio(width, height, isPreview);

        const pngDataUrl = await htmlToImage.toPng(exportElement, {
          ...exportOptions,
          pixelRatio: pngExportScale,
        });

        if (isPreview) {
          return pngDataUrl;
        }

        downloadFile(pngDataUrl, ".png");
        return true;
      });
    } catch (error) {
      console.error("Error Saving!", error);
      throw error;
    }
  };

    const setDownloadButtonsDisabled = (disabled) => {
      ["downloadPNG", "downloadSVG"].forEach((buttonId) => {
        const button = document.getElementById(buttonId);
        if (button) {
          button.disabled = !!disabled;
        }
      });
    };

    const renderDownloadPanelButtons = () => {
      const buttonContainer = document.getElementById("downloadPanelButtons");
      const message = document.getElementById("downloadPanelButtonsMessage");

      if (!buttonContainer) {
        return;
      }

      const groups = getExportablePanelGroups();
      const selectedPanels = new Set(getDownloadPanelSelection());

      buttonContainer.replaceChildren();

      groups.forEach((group) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className =
          "downloadPanelSelectButton" +
          (selectedPanels.has(group.topIndex) ? " selected" : "");
        button.textContent = group.label;
        button.dataset.panelIndex = String(group.topIndex);
        button.setAttribute(
          "aria-pressed",
          selectedPanels.has(group.topIndex) ? "true" : "false"
        );
        button.title = "Export Panel " + group.label;

        button.addEventListener("click", () => {
          const currentSelection = new Set(getDownloadPanelSelection());

          if (currentSelection.has(group.topIndex)) {
            currentSelection.delete(group.topIndex);
          } else {
            currentSelection.add(group.topIndex);
          }

          fileInfo.selectedPanelIndices = Array.from(currentSelection);
          fileInfo.panel = fileInfo.selectedPanelIndices.length
            ? fileInfo.selectedPanelIndices[0]
            : null;

          updatePreview();
        });

        buttonContainer.appendChild(button);
      });

      if (message) {
        if (!groups.length) {
          message.textContent = "No visible panels are available to export.";
        } else if (!selectedPanels.size) {
          message.textContent = "Select at least one panel to export.";
        } else {
          message.textContent = "";
        }
      }
    };

    const syncDownloadSelection = () => {
      const entirePost_option = document.getElementById("entirePost");
      const panelNumberSelector = document.getElementById("singularPanel");
      const downloadContents = document.getElementById("downloadContents");

      if (entirePost_option && entirePost_option.checked === true) {
        fileInfo.panel = -1;
        fileInfo.selectedPanelIndices = [];

        if (panelNumberSelector) {
          panelNumberSelector.style.display = "none";
        }

        if (downloadContents) {
          downloadContents.style.verticalAlign = "10rem";
        }

        setDownloadButtonsDisabled(false);
        return true;
      }

      if (panelNumberSelector) {
        panelNumberSelector.style.display = "block";
      }

      if (downloadContents) {
        downloadContents.style.verticalAlign = "";
      }

      renderDownloadPanelButtons();

      const selectedPanels = getDownloadPanelSelection();
      fileInfo.panel = selectedPanels.length ? selectedPanels[0] : null;

      const hasSelection = selectedPanels.length > 0;
      setDownloadButtonsDisabled(!hasSelection);

      return hasSelection;
    };

    const downloadPNGSign = async function () {
      if (!syncDownloadSelection()) {
        return;
      }

      const file = getFile();

      if (!file) {
        return;
      }

      await saveSign(file, false, false);
    };

    const downloadSVGSign = async function () {
      if (!syncDownloadSelection()) {
        return;
      }

      const file = getFile();

      if (!file) {
        return;
      }

      await saveSign(file, false, true);
    };

    const updatePreview = async function () {
      const downloadPreview = document.getElementById("downloadPreview");

      if (!downloadPreview) {
        return;
      }

      const hasSelection = syncDownloadSelection();

      while (downloadPreview.firstChild) {
        downloadPreview.removeChild(downloadPreview.lastChild);
      }

      if (!hasSelection) {
        const emptyBox = document.createElement("div");
        emptyBox.textContent = "Select at least one panel to preview or download.";
        emptyBox.className = "downloadPreviewLoading";
        downloadPreview.appendChild(emptyBox);
        return;
      }

      const loadingBox = document.createElement("div");
      loadingBox.textContent = "Loading...";
      loadingBox.className = "downloadPreviewLoading";
      downloadPreview.appendChild(loadingBox);

      try {
        const file = getFile();

        if (!file) {
          throw new Error("No export target found");
        }

        const dataUrl = await saveSign(file, true, true);

        while (downloadPreview.firstChild) {
          downloadPreview.removeChild(downloadPreview.lastChild);
        }

        const previewImg = new Image();
        previewImg.src = dataUrl;
        previewImg.style.maxWidth = "100%";
        previewImg.style.height = "auto";
        previewImg.style.display = "block";
        previewImg.style.margin = "0 auto";

        downloadPreview.appendChild(previewImg);
      } catch (error) {
        console.error("Preview failed", error);

        while (downloadPreview.firstChild) {
          downloadPreview.removeChild(downloadPreview.lastChild);
        }

        const errorBox = document.createElement("div");
        errorBox.textContent = "Preview failed";
        errorBox.style.padding = "1rem";
        errorBox.style.background = "white";
        errorBox.style.color = "black";
        errorBox.style.fontFamily = "sans-serif";
        downloadPreview.appendChild(errorBox);
      }
    };

    const resetPadding = function (mode, params) {
      return runWithUndo(() => {
        getCurrentPanel().sign.padding = "0.3rem 0.75rem 0.3rem 0.75rem";

        document.getElementById("paddingTop").value = 0.3;
        document.getElementById("paddingRight").value = 0.75;
        document.getElementById("paddingBottom").value = 0.3;
        document.getElementById("paddingLeft").value = 0.75;

        formHandler.updateForm();
        redraw();
      });
    };

  /**
   * Redraw the panels on the post.
   */
    
  const redraw = function () {
    const postContainerElmt = document.getElementById("postContainer");
    const panelContainerElmt = document.getElementById("panelContainer");
    const posts = document.getElementsByClassName("post");
    const availablePolePositions = Post.prototype.polePositions;
    const polePosition = availablePolePositions.includes(post.polePosition)
      ? post.polePosition
      : availablePolePositions[0];
    const polePositionClass = `polePosition${polePosition}`;
    const availableColors = Post.prototype.colors;
    const normalizedPostColor = availableColors.includes(post.color)
      ? post.color
      : availableColors[0];
    const colorClass = normalizedPostColor ? ` postColor${normalizedPostColor}` : "";
    postContainerElmt.className = `${polePositionClass}${colorClass}`;
    const normalizedThickness = post.normalizeThickness(post.thickness);
    post.thickness = normalizedThickness;
    postContainerElmt.style.setProperty(
      "--postThickness",
      normalizedThickness + "rem"
    );

    // post

    if (post.showPost == true) {
      for (let i = 0; i < posts.length; i++) {
        posts[i].style.visibility = "hidden";
      }
      panelContainerElmt.style.background = "none";
    } else {
      const polePosition = (post.polePosition || "").toLowerCase();
      for (let i = 0; i < posts.length; i++) {
        posts[i].style.visibility = "hidden";
      }
      if (polePosition === "overhead") {
        for (let i = 0; i < posts.length; i++) {
          posts[i].style.visibility = "visible";
        }
      } else if (polePosition === "left") {
        if (posts[0]) {
          posts[0].style.visibility = "visible";
        }
      } else if (polePosition === "right") {
        if (posts[1]) {
          posts[1].style.visibility = "visible";
        }
      } else if (polePosition === "rural" || polePosition === "center") {
        // Posts remain hidden; custom backgrounds render supports.
      } else {
        for (let i = 0; i < posts.length; i++) {
          posts[i].style.visibility = "visible";
        }
      }
      panelContainerElmt.style.background = "";
    }

    lib.clearChildren(panelContainerElmt);
    if (panelContainerElmt) {
      // Attach drag handlers to panelContainer once
      if (!panelContainerElmt.dataset.panelDragAttached) {
        panelContainerElmt.addEventListener("dragover", handleRenderedPanelDragOver);
        panelContainerElmt.addEventListener("drop", handleRenderedPanelDrop);
        panelContainerElmt.addEventListener("dragleave", handleRenderedPanelDragLeave);
        panelContainerElmt.dataset.panelDragAttached = "true";
      }
      const spacingValue =
        typeof post.panelSpacing === "number" && post.panelSpacing > 0
          ? Math.max(0, post.panelSpacing)
          : 0;

      panelContainerElmt.style.setProperty(
        "--panelSpacing",
        spacingValue + "rem"
      );
    }

    var firstExitTab = null;
    let currentPanelStackElmt = null;

      const isPanelVisibleInCurrentPost = (panelIndex) =>
        !isPanelHiddenForLiveRender(panelIndex);



      for (let index = 0; index < post.panels.length; index++) {
          const panel = post.panels[index];

          if (!isPanelVisibleInCurrentPost(index)) {
            if (!isStackedPanelBottom(index)) {
              currentPanelStackElmt = null;
            }
            continue;
          }

          const panelElmt = document.createElement("div");
          panelElmt.className = `panel ${panel.color.toLowerCase()} ${panel.corner.toLowerCase()}`;
          if (isPanelConfiguredHidden(index)) {
            panelElmt.classList.add("panelHiddenFromPost");
          }
          const numericPanelBorderRadius =
          typeof panel.borderRadius === "number"
          ? panel.borderRadius
          : parseFloat(panel.borderRadius);
          const panelBorderRadius = Number.isFinite(numericPanelBorderRadius)
          ? Math.max(0, numericPanelBorderRadius)
          : Panel.prototype.defaultBorderRadius;
          panelElmt.style.setProperty(
                                      "--signBorderRadius",
                                      panelBorderRadius + "rem"
                                      );
          panelElmt.id = "panel" + index;
          panelElmt.dataset.panelIndex = index.toString();
          panelElmt.addEventListener("click", (event) => {
              const clickedPanelIndex = Number(event.currentTarget.dataset.panelIndex);
              
              if (Number.isNaN(clickedPanelIndex)) {
                  return;
              }
              
              selectRenderedPanelArea({
                  panelIndex: clickedPanelIndex,
                  subPanelIndex: 0,
                  menu: "subpanel",
                  flashTarget: event.currentTarget.querySelector(".subPanelDisplay"),
              });
          });
          panelElmt.draggable = post.panels.length > 1;
          panelElmt.addEventListener("dragstart", handleRenderedPanelDragStart);
          panelElmt.addEventListener("dragend", handleRenderedPanelDragEnd);

          const isBottomStackedPanel =
            index > 0 && panel.stackedWithPrevious === true;
          const nextPanelIsStackedUnderThis =
            index + 1 < post.panels.length &&
            post.panels[index + 1]?.stackedWithPrevious === true &&
            isPanelVisibleInCurrentPost(index + 1);

          if (isBottomStackedPanel && currentPanelStackElmt) {
            panelElmt.classList.add("stackedPanelBottom");
            currentPanelStackElmt.appendChild(panelElmt);
          } else if (nextPanelIsStackedUnderThis) {
            currentPanelStackElmt = document.createElement("div");
            const stackedPanelSettings = getStackedPanelSettingsForTopIndex(index);
            currentPanelStackElmt.className =
              "panelStack" +
              (stackedPanelSettings.matchWidth ? " stackedPanelMatchWidth" : "");
            currentPanelStackElmt.dataset.stackTopPanelIndex = String(index);
            currentPanelStackElmt.style.setProperty(
              "--stackedPanelSpacing",
              stackedPanelSettings.spacing + "rem"
            );
            panelElmt.classList.add("stackedPanelTop");
            panelContainerElmt.appendChild(currentPanelStackElmt);
            currentPanelStackElmt.appendChild(panelElmt);
          } else {
            currentPanelStackElmt = null;
            panelContainerElmt.appendChild(panelElmt);
          }
          
          // Store CA style exit tabs to append inside sign later
          const caStyleExitTabs = [];
          
          for (
               let exitTabIndex = panel.exitTabs.length - 1;
               exitTabIndex > -1;
               exitTabIndex--
               ) {
                   var exitTab = panel.exitTabs[exitTabIndex];
                   
                   const exitTabCont = document.createElement("div");
                   exitTabCont.className = `exitTabContainer ${exitTab.position.toLowerCase()} ${exitTab.width.toLowerCase()}`;
                   exitTabCont.style.position = "relative";
                   exitTabCont.style.zIndex = "1";
                   
                   // If CA style, don't append to panel yet - store for later insertion inside sign
                   if (exitTab.caStyle && exitTab.variant == "Default") {
                       caStyleExitTabs.push({exitTabCont, exitTabIndex});
                   } else {
                       panelElmt.appendChild(exitTabCont);
                   }
                   
                   // Apply nested tab spacing CSS variable
                   const nestedTabSpacingValue =
                   typeof exitTab.nestedTabSpacing === "number" && exitTab.nestedTabSpacing > 0
                   ? exitTab.nestedTabSpacing
                   : 0;
                   exitTabCont.style.setProperty("--nestedTabSpacing", nestedTabSpacingValue + "rem");
                   exitTabCont.dataset.panelIndex = String(index);
                   exitTabCont.dataset.exitTabIndex = String(exitTabIndex);
                   
                   exitTabCont.addEventListener("click", (event) => {
                       event.stopPropagation();
                       
                       const clickedPanelIndex = Number(event.currentTarget.dataset.panelIndex);
                       const clickedExitTabIndex = Number(event.currentTarget.dataset.exitTabIndex);
                       
                       selectRenderedPanelArea({
                           panelIndex: clickedPanelIndex,
                           subPanelIndex: 0,
                           exitTabIndex: Number.isNaN(clickedExitTabIndex) ? 0 : clickedExitTabIndex,
                           menu: "exitTabs",
                           flashTarget: event.currentTarget,
                       });
                   });
                   
                   var nestedExitTabs = exitTab.nestedExitTabs.length;
                   
                   for (let nestIndex = -1; nestIndex < nestedExitTabs; nestIndex++) {
                       if (nestIndex != -1) {
                           exitTab = exitTab.nestedExitTabs[nestIndex];
                       }
                       
                       const exitTabElmt = document.createElement("div");
                       exitTabElmt.className = `exitTab ${exitTab.position.toLowerCase()} ${exitTab.width.toLowerCase()}`;
                       if (exitTab.squareCorners) {
                           exitTabElmt.className += " squareCorners";
                       }
                       const numericBorderThickness =
                       typeof exitTab.borderThickness === "number"
                       ? exitTab.borderThickness
                       : parseFloat(exitTab.borderThickness);
                       const normalizedBorderThickness =
                       Number.isFinite(numericBorderThickness) && numericBorderThickness >= 0
                       ? numericBorderThickness
                       : ExitTab.prototype.defaultBorderThickness;
                       exitTab.borderThickness = normalizedBorderThickness;
                       const isBorderlessTab = normalizedBorderThickness <= 0;
                       const borderThicknessRem = normalizedBorderThickness.toString() + "rem";
                       if (isBorderlessTab) {
                           exitTabElmt.classList.add("borderless");
                       }
                       const usesHighwayGothicFont = !!exitTab.FHWAFont || post.fontType === true;
                       const registerExitTabText = (element) => {
                           if (!element) {
                               return element;
                           }
                           element.classList.add("exitTabText");
                           return element;
                       };
                       const appendStandardExitNumber = (parentElmt) => {
                           if (!parentElmt || !exitTab.number) {
                               return;
                           }
                           const normalizedNumberText = String(exitTab.number).replace(
                                                                                       /\\n/g,
                                                                                       "\n"
                                                                                       );
                           const numberLines = normalizedNumberText.split("\n");
                           const renderExitNumberSegments = (targetElmt, lineText) => {
                               if (!targetElmt) {
                                   return;
                               }
                               const safeLineText =
                               typeof lineText === "string" ? lineText : String(lineText || "");
                               const txtArr = safeLineText.toUpperCase().split(/(\d+\S*)/);
                               const rawTrailingText = txtArr.slice(2).join("");
                               const separatedSuffixMatch = rawTrailingText.match(/^(\s+)(\S[\s\S]*?)\s*$/);
                               const trailingText = separatedSuffixMatch ? separatedSuffixMatch[2] : rawTrailingText;
                               const suffixWasSeparated = !!separatedSuffixMatch;
                               const separatedSuffixSpaceCount = suffixWasSeparated
                                 ? Math.max(1, separatedSuffixMatch[1].length)
                                 : 0;
                               
                               // Handle vertical arrangement
                               if (exitTab.verticalArrangement && txtArr.length > 1) {
                                   // #endregion
                                   const verticalContainer = document.createElement("div");
                                   verticalContainer.className = "exitTabVerticalContainer";
                                   registerExitTabText(verticalContainer);
                                   
                                   const leadingText = txtArr[0] || "";
                                   if (leadingText && leadingText.trim().length > 0) {
                                       const topTextElmt = document.createElement("div");
                                       topTextElmt.className = "exitTabVerticalText";
                                       registerExitTabText(topTextElmt);
                                       if (usesHighwayGothicFont) {
                                           topTextElmt.style.setProperty(
                                                                         "--exitTabAdditionalOffset",
                                                                         "-0.5px"
                                                                         );
                                       }
                                       topTextElmt.appendChild(document.createTextNode(leadingText));
                                       if (exitTab.topOffset == false) {
                                           topTextElmt.style.setProperty("--exitTabTextBaseOffset", "0rem");
                                       }
                                       verticalContainer.appendChild(topTextElmt);
                                   }
                                   
                                   const bottomNumberElmt = document.createElement("div");
                                   bottomNumberElmt.className = "exitTabVerticalNumber";
                                   registerExitTabText(bottomNumberElmt);
                                   const spanNumeralElmt = document.createElement("span");
                                   spanNumeralElmt.className = "numeral";
                                   registerExitTabText(spanNumeralElmt);
                                   spanNumeralElmt.appendChild(document.createTextNode(txtArr[1]));
                                   bottomNumberElmt.appendChild(spanNumeralElmt);
                                   if (trailingText) {
                                       const trailingSpanElmt = document.createElement("span");
                                       trailingSpanElmt.className = "numeral exitTabTrailing";
                                       trailingSpanElmt.textContent = trailingText;

                                       if (suffixWasSeparated) {
                                           trailingSpanElmt.classList.add("exitTabSeparatedSuffix");
                                           trailingSpanElmt.style.setProperty(
                                               "--exitTabTrailingGap",
                                               `${separatedSuffixSpaceCount * 0.02}em`
                                           );
                                       }

                                       registerExitTabText(trailingSpanElmt);
                                       targetElmt.appendChild(trailingSpanElmt);
                                   }
                                   verticalContainer.appendChild(bottomNumberElmt);
                                   targetElmt.appendChild(verticalContainer);
                                   // #endregion
                                   return;
                               }
                               
                               // Original horizontal arrangement
                               const divTextElmt = document.createElement("div");
                               registerExitTabText(divTextElmt);
                               if (usesHighwayGothicFont) {
                                   divTextElmt.style.setProperty(
                                     "--exitTabAdditionalOffset",
                                     "-0.5px"
                                     );
                               }
                               const leadingText = txtArr[0] || "";
                               divTextElmt.appendChild(
                               document.createTextNode(
                               leadingText.length > 0
                               ? leadingText
                               : safeLineText.length === 0
                               ? "\u00a0"
                               : ""
                               )
                               );
                               targetElmt.appendChild(divTextElmt);
                               
                               if (txtArr.length > 1) {
                                   divTextElmt.classList.add("exitFormat");
                                   if (leadingText && leadingText.trim().length > 0) {
                                     const spacerElmt = document.createElement("span");
                                     spacerElmt.textContent = " ";
                                     spacerElmt.classList.add("exitTabTextSpacer");

                                     if (suffixWasSeparated) {
                                         spacerElmt.classList.add("exitTabSeparatedSuffixSpacer");
                                     }

                                     registerExitTabText(spacerElmt);
                                     targetElmt.appendChild(spacerElmt);
                                   }
                                   const spanNumeralElmt = document.createElement("span");
                                   spanNumeralElmt.className = "numeral";
                                   registerExitTabText(spanNumeralElmt);
                                   spanNumeralElmt.appendChild(document.createTextNode(txtArr[1]));
                                   targetElmt.appendChild(spanNumeralElmt);
                                   if (trailingText) {
                                       const trailingSpanElmt = document.createElement("span");
                                       trailingSpanElmt.className = "numeral exitTabTrailing";
                                       trailingSpanElmt.textContent = trailingText;

                                       if (suffixWasSeparated) {
                                           trailingSpanElmt.classList.add("exitTabSeparatedSuffix");
                                           trailingSpanElmt.style.setProperty(
                                               "--exitTabTrailingGap",
                                               `${separatedSuffixSpaceCount * 0.02}em`
                                           );
                                       }

                                       registerExitTabText(trailingSpanElmt);
                                       targetElmt.appendChild(trailingSpanElmt);
                                   }
                                   if (exitTab.topOffset == false) {
                                       divTextElmt.style.setProperty("--exitTabTextBaseOffset", "0rem");
                                   }
                               }
                           };
                           
                           if (numberLines.length <= 1) {
                               renderExitNumberSegments(parentElmt, normalizedNumberText);
                               return;
                           }
                           
                           const multiLineContainerElmt = document.createElement("div");
                           multiLineContainerElmt.className = "exitTabNumberLinesContainer";
                           parentElmt.appendChild(multiLineContainerElmt);
                           
                           numberLines.forEach((lineText) => {
                               const lineWrapperElmt = document.createElement("div");
                               lineWrapperElmt.className = "exitTabNumberLine";
                               multiLineContainerElmt.appendChild(lineWrapperElmt);
                               renderExitNumberSegments(lineWrapperElmt, lineText || "");
                           });
                       };
                     
                       const appendBilingualExitNumber = (parentElmt) => {
                         if (!parentElmt) {
                           return;
                         }

                         const cleanBilingualExitNumber = (value) => {
                           return String(value || "")
                             .replace(/\n/g, " ")
                             .replace(/\b(EXIT|SORTIE)\b/gi, "")
                             .replace(/\s+/g, " ")
                             .trim();
                         };

                         const numberText = cleanBilingualExitNumber(exitTab.number);
                         const topText = String(exitTab.bilingualTopText || "EXIT").trim() || "EXIT";
                         const bottomText =
                           String(exitTab.bilingualBottomText || "SORTIE").trim() || "SORTIE";

                         const bilingualWrapper = document.createElement("div");
                         bilingualWrapper.className = "exitTabBilingualBlock";
                         registerExitTabText(bilingualWrapper);

                         const topLine = document.createElement("div");
                         topLine.className = "exitTabBilingualLine exitTabBilingualTopLine";
                         registerExitTabText(topLine);

                         const topLabel = document.createElement("span");
                         topLabel.className = "exitTabBilingualLabelText";
                         registerExitTabText(topLabel);
                         topLabel.appendChild(document.createTextNode(topText.toUpperCase()));
                         topLine.appendChild(topLabel);

                         const bottomLine = document.createElement("div");
                         bottomLine.className = "exitTabBilingualLine exitTabBilingualBottomLine";
                         registerExitTabText(bottomLine);

                         const bottomLabel = document.createElement("span");
                         bottomLabel.className = "exitTabBilingualLabelText";
                         registerExitTabText(bottomLabel);
                         bottomLabel.appendChild(document.createTextNode(bottomText.toUpperCase()));
                         bottomLine.appendChild(bottomLabel);

                         if (numberText) {
                           const numberElmt = document.createElement("span");
                           numberElmt.className = "numeral exitTabBilingualNumber";
                           registerExitTabText(numberElmt);
                           numberElmt.appendChild(document.createTextNode(numberText.toUpperCase()));
                           bottomLine.appendChild(numberElmt);
                         }

                         bilingualWrapper.appendChild(topLine);
                         bilingualWrapper.appendChild(bottomLine);
                         parentElmt.appendChild(bilingualWrapper);
                       };
                       
                       const exitTabHolderElmt = document.createElement("div");
                       exitTabHolderElmt.className = "exitTabHolder";
                       exitTabHolderElmt.style.position = "relative";
                       exitTabHolderElmt.style.zIndex = "1";
                       exitTabHolderElmt.appendChild(exitTabElmt);
                       
                       exitTabCont.appendChild(exitTabHolderElmt);
                       
                       if (exitTab.color != "Panel Color" && exitTab.color != undefined) {
                           exitTabElmt.className += ` ${exitTab.color.toLowerCase()}`;
                           exitTabHolderElmt.className += ` ${exitTab.color.toLowerCase()}`;
                       } else {
                           exitTabElmt.className += ` ${panel.color.toLowerCase()}`;
                           exitTabHolderElmt.className += ` ${panel.color.toLowerCase()}`;
                       }
                       
                       if (exitTab.verticalArrangement && exitTab.variant == "Default") {
                           exitTabElmt.classList.add("verticalArrangement");
                           // #endregion
                       }
                       
                       if (usesHighwayGothicFont) {
                           applyHighwayGothicStyling(exitTabElmt);
                           exitTabElmt.style.setProperty(
                             "--fhwaBaselineOffset",
                             "calc(var(--fhwaBaselineShift) + 1px)"
                             );
                           exitTabElmt.style.setProperty("--exitTabNumeralScale", "0.95");
                       }
                       
                       if (
                           exitTab.number ||
                           exitTab.showLeft ||
                           exitTab.variant != "Default"
                           ) {
                               if (exitTab.variant == "Default") {
                                   const leftElmt = document.createElement("div");
                                   
                                   if (exitTab.showLeft) {
                                       leftElmt.classList.add("yellowElmt");
                                       registerExitTabText(leftElmt);
                                       leftElmt.appendChild(document.createTextNode("LEFT"));
                                       exitTabElmt.appendChild(leftElmt);
                                       exitTabElmt.style.display = "inline-block";
                                       
                                       if (exitTab.number) {
                                           leftElmt.style.marginRight = "0.4rem";
                                       }
                                   }
                                   
                                   exitTabElmt.classList.remove(
                                     "bilingualExitTab",
                                     "bilingualCompactExitTab"
                                   );

                                   exitTabHolderElmt.classList.remove(
                                     "bilingualCompactExitTabHolder"
                                   );

                                   exitTabCont.classList.remove(
                                     "bilingualCompactExitTabContainer"
                                   );

                                   if (exitTab.bilingual === true) {
                                     exitTabElmt.classList.add("bilingualExitTab");

                                     const exitTabWidthClass = String(exitTab.width || "").toLowerCase();

                                     if (exitTabWidthClass === "edge" || exitTabWidthClass === "narrow") {
                                       exitTabElmt.classList.add("bilingualCompactExitTab");
                                       exitTabHolderElmt.classList.add("bilingualCompactExitTabHolder");
                                       exitTabCont.classList.add("bilingualCompactExitTabContainer");
                                     }

                                     appendBilingualExitNumber(exitTabElmt);
                                   } else {
                                     appendStandardExitNumber(exitTabElmt);
                                   }
                               } else if (exitTab.variant == "Toll Logo") {
                                   exitTabCont.classList.add("tollLogoExitTabContainer");
                                   exitTabHolderElmt.classList.add("tollLogoExitHolder");
                                   const tollLogoContainerElmt = document.createElement("div");
                                   tollLogoContainerElmt.className = "tollLogoLogoWrapper";
                                   const tollLogoHolderElmt = document.createElement("div");
                                   tollLogoHolderElmt.className = "tollLogoImageHolder";
                                   if (exitTab.tollLogoSquare) {
                                       tollLogoHolderElmt.classList.add("squareIcon");
                                   }
                                   const defaultTollLogoSize =
                                   typeof ExitTab.prototype.defaultTollLogoSize === "number"
                                   ? ExitTab.prototype.defaultTollLogoSize
                                   : 3;
                                   let resolvedTollLogoSize = parseFloat(exitTab.tollLogoSize);
                                   if (!Number.isFinite(resolvedTollLogoSize) || resolvedTollLogoSize <= 0) {
                                       resolvedTollLogoSize = defaultTollLogoSize;
                                   }
                                   exitTabElmt.style.setProperty(
                                                                 "--tollLogoSize",
                                                                 resolvedTollLogoSize.toString() + "rem"
                                                                 );
                                   tollLogoHolderElmt.style.setProperty(
                                                                        "--tollLogoSize",
                                                                        resolvedTollLogoSize.toString() + "rem"
                                                                        );
                                   const tollLogos = TollLogoElement.prototype.logos;
                                   const tollLogoKey =
                                   tollLogos && exitTab.icon && tollLogos[exitTab.icon]
                                   ? exitTab.icon
                                   : TollLogoElement.prototype.defaultLogo;
                                   const tollLogoDef = tollLogos && tollLogos[tollLogoKey];
                                   if (tollLogoDef) {
                                       const tollLogoImgElmt = document.createElement("img");
                                       tollLogoImgElmt.src = tollLogoDef.src;
                                       tollLogoImgElmt.alt = tollLogoDef.label || "Toll logo";
                                       tollLogoImgElmt.className = "tollLogoImage";
                                       tollLogoImgElmt.loading = "lazy";
                                       tollLogoImgElmt.decoding = "async";
                                       tollLogoHolderElmt.appendChild(tollLogoImgElmt);
                                   } else if (exitTab.icon) {
                                       const logoTextElmt = document.createElement("span");
                                       logoTextElmt.textContent = exitTab.icon.toUpperCase();
                                       registerExitTabText(logoTextElmt);
                                       tollLogoHolderElmt.appendChild(logoTextElmt);
                                   }
                                   tollLogoContainerElmt.appendChild(tollLogoHolderElmt);
                                   exitTabElmt.appendChild(tollLogoContainerElmt);
                                   exitTabElmt.classList.add("tollLogoExitTab");
                                   if (exitTab.tollLogoOnly) {
                                       exitTabElmt.classList.add("logoOnly");
                                       exitTabHolderElmt.classList.add("logoOnly");
                                       exitTabCont.classList.add("logoOnly");
                                   } else {
                                       const tollLogoNumberWrapperElmt = document.createElement("div");
                                       tollLogoNumberWrapperElmt.className = "tollLogoNumberWrapper";
                                       appendStandardExitNumber(tollLogoNumberWrapperElmt);
                                       exitTabElmt.appendChild(tollLogoNumberWrapperElmt);
                                   }
                               } else if (exitTab.variant == "Icon") {
                               } else if (exitTab.variant == "Full Left") {
                                   exitTabElmt.classList.add("fullLeft");
                                   const bannerElmt = document.createElement("div");
                                   bannerElmt.className = "fullLeftBanner";
                                   registerExitTabText(bannerElmt);
                                   bannerElmt.appendChild(document.createTextNode("LEFT"));
                                   exitTabElmt.appendChild(bannerElmt);
                                   
                                   const numberWrapperElmt = document.createElement("div");
                                   numberWrapperElmt.className = "fullLeftNumber";
                                   exitTabElmt.appendChild(numberWrapperElmt);
                                   appendStandardExitNumber(numberWrapperElmt);
                               } else if (exitTab.variant == "HOV 1") {
                                   exitTabCont.classList.add("hovExitTabContainer");
                                   exitTabHolderElmt.classList.add("hovExitTabHolder");
                                   exitTabElmt.classList.add("hovExitTab");
                                   
                                   const hovIconColumnElmt = document.createElement("div");
                                   hovIconColumnElmt.className = "hovIconColumn";
                                   const hovIconImgElmt = document.createElement("img");
                                   hovIconImgElmt.className = "hovIcon";
                                   hovIconImgElmt.src = "img/icons/HOV.png";
                                   hovIconImgElmt.alt = "HOV symbol";
                                   hovIconColumnElmt.appendChild(hovIconImgElmt);
                                   
                                   const hovContentColumnElmt = document.createElement("div");
                                   hovContentColumnElmt.className = "hovContentColumn";
                                   
                                   const hovTextRowElmt = document.createElement("div");
                                   hovTextRowElmt.className = "hovTextRow";
                                   const hovTextElmt = document.createElement("span");
                                   registerExitTabText(hovTextElmt);
                                   const hovExitNumber =
                                   typeof exitTab.number === "string"
                                   ? exitTab.number.trim().toUpperCase()
                                   : "";
                                   hovTextElmt.textContent = hovExitNumber
                                   ? `HOV EXIT ${hovExitNumber}`
                                   : "HOV EXIT";
                                   hovTextRowElmt.appendChild(hovTextElmt);
                                   hovContentColumnElmt.appendChild(hovTextRowElmt);
                                   
                                   const hovBottomBarElmt = document.createElement("div");
                                   hovBottomBarElmt.className = "hovBottomBar";
                                   hovContentColumnElmt.appendChild(hovBottomBarElmt);
                                   
                                   exitTabElmt.appendChild(hovIconColumnElmt);
                                   exitTabElmt.appendChild(hovContentColumnElmt);
                               } else if (exitTab.variant == "HOV 2") {
                               }
                               let firstExitTab = null;
                               let hasRightEdgeExitTab = false;
                               let hasLeftEdgeExitTab = false;
                               
                               exitTabElmt.style.visibility = "visible";
                               exitTabCont.className += " tabVisible";
                               if (exitTab.variant === "Default" || exitTab.variant === "Full Left") {
                                   const exitTabPosition =
                                   typeof exitTab.position === "string" ? exitTab.position.toLowerCase() : "";
                                   
                                   const exitTabWidth =
                                   typeof exitTab.width === "string" ? exitTab.width.toLowerCase() : "";
                                   
                                   if (exitTabWidth === "edge") {
                                       if (exitTabPosition === "right") {
                                           hasRightEdgeExitTab = true;
                                       } else if (exitTabPosition === "left") {
                                           hasLeftEdgeExitTab = true;
                                       }
                                   }
                               }
                               const cornerRadius = exitTab.squareCorners ? "0.25rem" : "0.5rem";
                               
                               const applyExitTabCornerShape = (elmt, fullBorder, borderless) => {
                                   if (!elmt) return;
                                   
                                   if (fullBorder === true) {
                                       if (borderless) {
                                           elmt.style.borderTopLeftRadius = "0";
                                           elmt.style.borderTopRightRadius = "0";
                                           elmt.style.borderBottomLeftRadius = "0";
                                           elmt.style.borderBottomRightRadius = "0";
                                       } else {
                                           elmt.style.borderTopLeftRadius = cornerRadius;
                                           elmt.style.borderTopRightRadius = cornerRadius;
                                           elmt.style.borderBottomLeftRadius = cornerRadius;
                                           elmt.style.borderBottomRightRadius = cornerRadius;
                                       }
                                   } else {
                                       if (borderless) {
                                           elmt.style.borderTopLeftRadius = "0";
                                           elmt.style.borderTopRightRadius = "0";
                                       } else {
                                           elmt.style.borderTopLeftRadius = cornerRadius;
                                           elmt.style.borderTopRightRadius = cornerRadius;
                                       }
                                       
                                       elmt.style.borderBottomLeftRadius = "0";
                                       elmt.style.borderBottomRightRadius = "0";
                                   }
                               };
                               
                               if (exitTab.fullBorder == true) {
                                   exitTabElmt.style.borderBottomWidth = borderThicknessRem;
                                   exitTabElmt.style.borderBottomStyle = isBorderlessTab ? "" : "solid";
                               } else {
                                   exitTabElmt.style.borderBottomWidth = "0";
                                   exitTabElmt.style.borderBottomStyle = "none";
                               }
                               
                               applyExitTabCornerShape(exitTabElmt, exitTab.fullBorder, isBorderlessTab);
                               if (exitTab.fullBorder !== true) {
                                   const overlapRem = Math.max(normalizedBorderThickness + 0.42, 0.54);
                                   const computedTabStyle = window.getComputedStyle(exitTabElmt);
                                   
                                   exitTabElmt.style.borderBottomWidth = "0";
                                   exitTabElmt.style.borderBottomStyle = "none";
                                   
                                   exitTabElmt.style.paddingBottom = `calc(${computedTabStyle.paddingBottom} + ${overlapRem}rem)`;
                                   exitTabElmt.style.marginBottom = `-${overlapRem}rem`;
                               }
                               
                               if (hasRightEdgeExitTab) {
                                   panelElmt.style.borderTopRightRadius = "0";
                               }
                               
                               if (hasLeftEdgeExitTab) {
                                   panelElmt.style.borderTopLeftRadius = "0";
                               }
                               
                               
                               exitTabElmt.style.borderTopWidth = borderThicknessRem;
                               exitTabElmt.style.borderLeftWidth = borderThicknessRem;
                               exitTabElmt.style.borderRightWidth = borderThicknessRem;
                               let resolvedFontSize = exitTab.fontSize;
                               if (typeof resolvedFontSize === "string") {
                                 resolvedFontSize = parseFloat(resolvedFontSize);
                               }
                               if (!Number.isFinite(resolvedFontSize)) {
                                 resolvedFontSize = 0;
                               }

                               resolvedFontSize = getRenderedHighwayGothicTextSize(
                                 resolvedFontSize,
                                 usesHighwayGothicFont
                               );

                               exitTabElmt.style.fontSize = resolvedFontSize.toString() + "px";
                               // #endregion
                               // Increase minHeight when vertical arrangement is enabled to accommodate stacked content
                               // Large numerals (1.5em scale) need extra space, so increase minHeight more
                               if (exitTab.verticalArrangement && exitTab.variant == "Default") {
                                   const baseMinHeight = parseFloat(exitTab.minHeight) || 2.25;
                                   // Account for numeral scaling (1.5em) and vertical spacing
                                   const calculatedMinHeight = Math.max(baseMinHeight * 1.5, 3.75);
                                   exitTabElmt.style.minHeight = calculatedMinHeight.toString() + "rem";
                                   // #endregion
                               } else {
                                   exitTabElmt.style.minHeight = exitTab.minHeight.toString() + "rem";
                               }
                               if (exitTab.variant == "Toll Logo" && exitTab.tollLogoOnly) {
                                   exitTabElmt.style.minHeight = "0";
                               }
                           }
                   }
                   
                   if (exitTabIndex == 0) {
                       firstExitTab = exitTabCont;
                   }
                   
                   exitTabCont.style.display = "flex";
               }
          
          function createShield(i, p) {
              /*
               i: index (table parent)
               p: parent (object)
               */
            
              var position;
        
              for (const shield of i) {
                  if (
                      shield.bannerPosition != "Above" &&
                      (shield.bannerType != "None" || shield.bannerType2 != "None")
                      ) {
                          position = shield.bannerPosition;
                          break;
                      }
              }
              
              for (const shield of i) {
                  if (
                      (shield.bannerPosition != "Above" && shield.bannerType != "None") ||
                      (shield.bannerType2 != "None" && !locked)
                      ) {
                          position = shield.bannerPosition;
                          locked = true;
                      }
                  
                  const toElmt = document.createElement("p");
                  toElmt.className = "to";
                  toElmt.appendChild(document.createTextNode("TO"));
                  p.appendChild(toElmt);
                  
                  const bannerShieldContainerElmt = document.createElement("div");
                  bannerShieldContainerElmt.className = `bannerShieldContainer ${shield.type
            } ${shield.specialBannerType.toLowerCase()} bannerPosition${shield.bannerPosition
            }`;
                  
                  switch (shield.routeNumber.length) {
                      case 1:
                          bannerShieldContainerElmt.className += " one";
                          break;
                      case 2:
                          bannerShieldContainerElmt.className += " two";
                          break;
                      case 3:
                          bannerShieldContainerElmt.className += " three";
                          break;
                      default:
                          bannerShieldContainerElmt.className += " three";
                          break;
                  }
                  
                  p.appendChild(bannerShieldContainerElmt);
                  
                  const bannerContainerElmt = document.createElement("div");
                  bannerContainerElmt.className = `bannerContainer`;
                  bannerShieldContainerElmt.appendChild(bannerContainerElmt);
                  
                  const bannerElmt = document.createElement("p");
                  bannerElmt.className =
                  "bannerA" + (!shield.indentFirstLetter ? " noIndent" : "");
                  bannerElmt.style = "--fontSize:" + shield.fontSize;
                  bannerContainerElmt.appendChild(bannerElmt);
                  
                  const shieldElmt = document.createElement("div");
                  shieldElmt.className = "shield";
                  shieldElmt.id = "shield" + i.indexOf(shield).toString();
                  bannerShieldContainerElmt.appendChild(shieldElmt);
                  
                  const shieldImgElmt = document.createElement("img");
                  shieldImgElmt.type = "image/png";
                  shieldImgElmt.className = "shieldImg";
                  
                  switch (shield.routeNumber.length) {
                      case 1:
                          shieldImgElmt.className += " one";
                          break;
                      case 2:
                          shieldImgElmt.className += " two";
                          break;
                      case 3:
                          shieldImgElmt.className += " three";
                          break;
                      case 4:
                          shieldImgElmt.className += " four";
                          break;
                      default:
                          shieldImgElmt.className += " three";
                          break;
                  }
                  
                  shieldElmt.appendChild(shieldImgElmt);
                  
                  const bannerContainerElmt2 = document.createElement("div");
                  bannerContainerElmt2.className = `bannerContainer2`;
                  bannerShieldContainerElmt.appendChild(bannerContainerElmt2);
                  
                  const bannerElmt2 = document.createElement("p");
                  bannerElmt2.className =
                  "bannerB" +
                  (!(shield.indentFirstLetter2 ?? shield.indentFirstLetter)
                   ? " noIndent"
                   : "");
                  bannerElmt2.style = "--fontSize:" + shield.fontSize;
                  bannerContainerElmt2.appendChild(bannerElmt2);
                  
                  if (shield.bannerType2 == "Toll") {
                      bannerElmt2.className += " TOLL";
                  }
                  
                  const routeNumberElmt = document.createElement("p");
                  routeNumberElmt.className = "routeNumber";
                  shieldElmt.appendChild(routeNumberElmt);
                  
                  if (shield.to) {
                      toElmt.style.display = "inline";
                      bannerShieldContainerElmt.style.marginLeft = "0";
                  }
                  
                  // Shield type
                  var lengthValue = shield.routeNumber.length;
                  
                  if (shield.routeNumber.length == 1) {
                      lengthValue = 2;
                  }
                  
                  const sameElement = [
                      "AK",
                      "C",
                      "CO",
                      "FL",
                      "CD",
                      "DC",
                      "HI",
                      "ID",
                      "LA",
                      "MI",
                      "MN",
                      "MT",
                      "MT2",
                      "NB",
                      "NC",
                      "NE",
                      "NH",
                      "NM",
                      "NV",
                      "PEI",
                      "QC2",
                      "REC2",
                      "SC",
                      "TN",
                      "UT",
                      "VA2",
                      "WA",
                      "WI",
                      "WY",
                  ];
                  
                  if (sameElement.includes(shield.type)) {
                      lengthValue = 2;
                  }
                  
                  var imgFileConstr = shield.type + "-" + lengthValue;
                  
                  if (shield.specialBannerType != "None") {
                      imgFileConstr += "-" + shield.specialBannerType.toUpperCase();
                  }
                  
                  const resolvedShieldPath = Shield.prototype.getDirectoryFromShield(
                      shield.type,
                      lengthValue + "Digit" + (
                      shield.specialBannerType != "None"
                      ? "-" + shield.specialBannerType.toUpperCase()
                      : ""
                      )
                  );
                  
                  console.log("[Shield render]", {
                      type: shield.type,
                      routeNumber: shield.routeNumber,
                      lengthValue,
                      specialBannerType: shield.specialBannerType,
                      resolvedShieldPath,
                  });
                  
                  shieldImgElmt.src = resolvedShieldPath;
                  
                  shieldImgElmt.src =
                  resolvedShieldPath && !resolvedShieldPath.endsWith("null")
                  ? resolvedShieldPath
                  : "img/shields/" + imgFileConstr + ".svg";
                  
                  //shield
                  
                  if (shield.type == "I" && shield.routeNumber.length == 3) {
                      shieldImgElmt.style.width = "3.8rem";
                  }
                  
                  if (position == "Right") {
                      var shieldDistance;
                      
                      if (i == panel.sign.shields) {
                          shieldDistance = panel.sign.shieldDistance;
                      } else {
                          shieldDistance =
                          panel.sign.subPanels[currentlySelectedSubPanelIndex]
                          .shieldDistance;
                      }
                      
                      shieldElmt.style.right = shieldDistance.toString() + "rem";
                      
                      if (shield.bannerType2 != "None") {
                          bannerContainerElmt2.style.right =
                          (shieldDistance * 2).toString() + "rem";
                          bannerContainerElmt2.style.position = "relative";
                          p.style.marginLeft =
                          (i.length * shieldDistance * 2).toString() + "rem";
                      } else {
                          p.style.marginLeft =
                          (i.length * shieldDistance).toString() + "rem";
                      }
                  } else if (position == "Left") {
                      var shieldDistance;
                      
                      if (i == panel.sign.shields) {
                          shieldDistance = panel.sign.shieldDistance;
                      } else {
                          shieldDistance =
                          panel.sign.subPanels[currentlySelectedSubPanelIndex]
                          .shieldDistance;
                      }
                      
                      shieldElmt.style.left = shieldDistance.toString() + "rem";
                      
                      if (shield.bannerType2 != "None") {
                          bannerContainerElmt2.style.left =
                          (shieldDistance * 2).toString() + "rem";
                          bannerContainerElmt2.style.position = "relative";
                          p.style.marginRight =
                          (i.length * shieldDistance * 2).toString() + "rem";
                      } else {
                          p.style.marginRight =
                          (i.length * shieldDistance).toString() + "rem";
                      }
                  }
                  
                  // Route Number
                  routeNumberElmt.appendChild(
                                              document.createTextNode(shield.routeNumber)
                                              );
                  
                  // Route banner
                  
                  if (shield.bannerType == "Toll") {
                      bannerElmt.className += " TOLL";
                  }
                  
                  if (shield.bannerType != "None") {
                      bannerElmt.appendChild(document.createTextNode(shield.bannerType));
                  } else {
                      bannerElmt.appendChild(document.createTextNode(" "));
                  }
                  
                  if (shield.bannerType2 != "None") {
                      bannerElmt2.appendChild(
                                              document.createTextNode(shield.bannerType2)
                                              );
                  } else {
                      bannerElmt2.appendChild(document.createTextNode(" "));
                  }
                  
                  // Font change
                  
                  if (post.fontType == true) {
                      applyHighwayGothicStyling(toElmt);
                      applyHighwayGothicStyling(bannerElmt);
                      applyHighwayGothicStyling(bannerElmt2);
                  }
              }
          }
          
          function monitorActionMessage(i, p) {
              /*
               i: Array
               p: Parent (element)
               */
              
              if (i.actionMessage != "") {
                  if (post.fontType == true) {
                    applyHighwayGothicStyling(p);
                    scaleRenderedHighwayGothicTextElement(p);
                  } else {
                    p.style.fontFamily = "Clearview 5WR";
                  }
                  p.style.visibility = "visible";
                  p.style.display = "inline-flex";
                  p.className = `actionMessage action_message`;
                  const txtArr = i.actionMessage.split(/(\d+\S*)/);
                  const txtFrac = txtArr[0].split(/([\u00BC-\u00BE]+\S*)/);
                  
                  p.appendChild(document.createTextNode(txtFrac[0]));
                  
                  if (
                      (i.actionMessage.includes("½") ||
                       i.actionMessage.includes("¼") ||
                       i.actionMessage.includes("¾")) &&
                      txtArr.length > 2
                      ) {
                          const spanElmt = document.createElement("span");
                          spanElmt.className = "numeral special";
                          
                          if (post.fontType) {
                              spanElmt.style.fontSize = "1.5rem";
                          }
                          
                          spanElmt.appendChild(document.createTextNode(txtArr[1]));
                          p.appendChild(spanElmt);
                          
                          const spanFractionElmt = document.createElement("span");
                          spanFractionElmt.className = "fraction special";
                          
                          if (post.fontType) {
                              spanFractionElmt.style.fontSize = "1.15rem";
                              spanFractionElmt.style.top = "-0.15rem";
                              spanFractionElmt.style.position = "relative";
                          }
                          
                          spanFractionElmt.appendChild(
                               document.createTextNode(
                               txtArr[2].split(/([\u00BC-\u00BE]+\S*)/)[1]
                                                       )
                         );
                          p.appendChild(spanFractionElmt);
                          p.appendChild(
                            document.createTextNode(
                            txtArr[2]
                            .split(/([\u00BC-\u00BE]+\S*)/)
                            .slice(2)
                            .join("")
                            )
                        );
                      } else {
                          if (txtArr.length > 1) {
                              const spanElmt = document.createElement("span");
                              spanElmt.className = "numeral";
                              
                              if (post.fontType) {
                                  spanElmt.style.fontSize = "1.5rem";
                              }
                              
                              spanElmt.appendChild(document.createTextNode(txtArr[1]));
                              p.appendChild(spanElmt);
                              p.appendChild(document.createTextNode(txtArr.slice(2).join("")));
                          }
                          if (txtFrac.length > 1) {
                              const spanFractionElmt = document.createElement("span");
                              spanFractionElmt.className = "fraction";
                              
                              if (post.fontType) {
                                  spanFractionElmt.style.fontSize = "1.15rem";
                                  spanFractionElmt.style.top = "-0.15rem";
                                  spanFractionElmt.style.position = "relative";
                              }
                              
                              spanFractionElmt.appendChild(document.createTextNode(txtFrac[1]));
                              p.appendChild(spanFractionElmt);
                              p.appendChild(document.createTextNode(txtFrac.slice(2).join("")));
                          }
                      }
              } else {
                  p.style.display = "none";
              }
          }
          
          function monitorControlText(i, p) {
              function LineEditor(line) {
                  if (line.includes("</>")) {
                      line = line.split("</>");
                      p.appendChild(
                                    document.createTextNode(line[0] + "⠀⠀⠀⠀⠀⠀⠀⠀⠀" + line[1])
                                    );
                  } else if (line.includes("<-->")) {
                  } else {
                      p.appendChild(document.createTextNode(line));
                  }
              }
              
              const controlTextArray = i.controlText.split("\n");
              for (
                   let lineNum = 0, length = controlTextArray.length - 1;
                   lineNum < length;
                   lineNum++
                   ) {
                       LineEditor(controlTextArray[lineNum]);
                       p.appendChild(document.createElement("br"));
                   }
              
              LineEditor(controlTextArray[controlTextArray.length - 1]);
          }
          
          const signCont = document.createElement("div");
          signCont.className = `signContainer ${panel.exitTabs[0].width.toLowerCase()}`;
          panelElmt.appendChild(signCont);
          
          const signElmt = document.createElement("div");
          signElmt.className = `sign ${panel.exitTabs[0].width.toLowerCase()}`;
          signElmt.style.position = "relative";
          signElmt.style.zIndex = "2";
          
          if (panel.exitTabs.length > 0 && panel.exitTabs[0].number != null) {
              signElmt.className += " tabVisible";
          }
          
          signCont.appendChild(signElmt);
          
          const g_top = document.createElement("div");
          g_top.className = `globalTop`;
          g_top.dataset.subpanelIndex = String(GLOBAL_TOP_SUBPANEL_INDEX);
          g_top.dataset.globalPosition = "Top";
          signElmt.appendChild(g_top);
          
          const signHolderElmt = document.createElement("div");
          signHolderElmt.className = `signHolder`;
          signElmt.appendChild(signHolderElmt);
          
          const g_bottom = document.createElement("div");
          g_bottom.className = `globalBottom`;
          g_bottom.dataset.subpanelIndex = String(GLOBAL_BOTTOM_SUBPANEL_INDEX);
          g_bottom.dataset.globalPosition = "Bottom";
          signElmt.appendChild(g_bottom);

          const markSelectedRenderedSubpanel = (targetElmt, subPanelIndex) => {
            targetElmt.classList.toggle(
              "selectedRenderedSubpanel",
              index === currentlySelectedPanelIndex &&
                subPanelIndex === currentlySelectedSubPanelIndex
            );
          };

          const bindRenderedBlockSelection = (blockMasterElmt, subPanelIndex) => {
            if (!blockMasterElmt) {
              return;
            }

            blockMasterElmt.dataset.panelIndex = String(index);
            blockMasterElmt.dataset.subpanel = String(subPanelIndex);

            const rows = Array.from(
              blockMasterElmt.querySelectorAll(".blockElementRow")
            );

            rows.forEach((rowElmt, rowIndex) => {
              rowElmt.dataset.signRow = String(rowIndex);
              rowElmt.classList.toggle(
                "selectedRenderedBlockRow",
                index === currentlySelectedPanelIndex &&
                  subPanelIndex === currentlySelectedSubPanelIndex &&
                  rowIndex === currentlySelectedRowIndex
              );

              rowElmt.addEventListener("click", (event) => {
                if (event.target.closest("[data-sign-row][data-sign-block]")) {
                  return;
                }

                event.stopPropagation();
                selectRenderedPanelArea({
                  panelIndex: index,
                  subPanelIndex,
                  rowIndex,
                  blockIndex: 0,
                  menu: "subpanel",
                  flashTarget: rowElmt,
                });
              });
            });

            blockMasterElmt
              .querySelectorAll("[data-sign-row][data-sign-block]")
              .forEach((blockElmt) => {
                const rowIndex = Number(blockElmt.dataset.signRow);
                const blockIndex = Number(blockElmt.dataset.signBlock);

                blockElmt.classList.toggle(
                  "selectedRenderedBlockElement",
                  index === currentlySelectedPanelIndex &&
                    subPanelIndex === currentlySelectedSubPanelIndex &&
                    rowIndex === currentlySelectedRowIndex &&
                    blockIndex === currentlySelectedBlockIndex
                );

                blockElmt.addEventListener("click", (event) => {
                  event.preventDefault();
                  event.stopPropagation();

                  selectRenderedPanelArea({
                    panelIndex: index,
                    subPanelIndex,
                    rowIndex: Number.isNaN(rowIndex) ? 0 : rowIndex,
                    blockIndex: Number.isNaN(blockIndex) ? 0 : blockIndex,
                    menu: "subpanel",
                    flashTarget: blockElmt,
                  });
                });
              });
          };
        
          const renderGlobalBlockElements = () => {
            const renderGlobalBlocksForPosition = (position, targetElmt) => {
              const key = getGlobalBlockKey(position);
              const globalBlockElements = panel.sign?.[key];

              const hasGlobalRows =
                globalBlockElements &&
                Array.isArray(globalBlockElements.rows) &&
                globalBlockElements.rows.some(
                  (row) => Array.isArray(row) && row.length > 0
                );

              if (!hasGlobalRows) {
                return;
              }

              if (typeof globalBlockElements.createElement !== "function") {
                panel.sign[key] = normalizeGlobalBlockElements(globalBlockElements);
              }

              if (typeof panel.sign[key]?.createElement !== "function") {
                return;
              }

              const globalRenderTarget = {
                isGlobalBlockTarget: true,
                globalBlockPosition: position,
                blockElements: panel.sign[key],
                shields: [],
              };

              const globalBlockElement = panel.sign[key].createElement(
                panel,
                globalRenderTarget
              );

              const globalIndex =
                position === "Top"
                  ? GLOBAL_TOP_SUBPANEL_INDEX
                  : GLOBAL_BOTTOM_SUBPANEL_INDEX;

              globalBlockElement.classList.add("globalPanelBlockElements");
              globalBlockElement.dataset.panelIndex = String(index);
              globalBlockElement.dataset.subpanel = String(globalIndex);
              bindRenderedBlockSelection(globalBlockElement, globalIndex);
              markSelectedRenderedSubpanel(targetElmt, globalIndex);
              targetElmt.addEventListener("click", (event) => {
                if (event.target.closest("[data-sign-row][data-sign-block]")) {
                  return;
                }

                event.stopPropagation();
                selectRenderedPanelArea({
                  panelIndex: index,
                  subPanelIndex: globalIndex,
                  rowIndex: 0,
                  blockIndex: 0,
                  menu: "subpanel",
                  flashTarget: targetElmt,
                });
              });
              targetElmt.appendChild(globalBlockElement);
              targetElmt.classList.add("hasGlobalBlocks");
            };

            renderGlobalBlocksForPosition("Top", g_top);
            renderGlobalBlocksForPosition("Bottom", g_bottom);
          };
          renderGlobalBlockElements();
          
          const g_shieldsContainerElmt = document.createElement("div");
          g_shieldsContainerElmt.className = `shieldsContainer ${panel.sign.shieldBacks ? "shieldBacks" : ""
        }`;
          
          createShield(panel.sign.shields, g_shieldsContainerElmt);
          
          /*
           const g_controlTextElmt = document.createElement("p");
           g_controlTextElmt.className = "controlText";
           
           if (post.fontType) {
           applyHighwayGothicStyling(g_controlTextElmt, "Series EM");
           }
           
           monitorControlText(panel.sign, g_controlTextElmt);
           
           const g_actionMessageElmt = document.createElement("div");
           g_actionMessageElmt.className = `actionMessage`;
           
           if (post.fontType) {
           applyHighwayGothicStyling(g_actionMessageElmt);
           }
           
           monitorActionMessage(panel.sign, g_actionMessageElmt);
           
           if (
           panel.sign.shields.length != 0 ||
           panel.sign.controlText != "" ||
           panel.sign.actionMessage != ""
           ) {
           if (panel.sign.globalPositioning.toLowerCase() == "top") {
           g_top.appendChild(g_shieldsContainerElmt);
           g_top.appendChild(g_controlTextElmt);
           g_top.appendChild(g_actionMessageElmt);
           g_top.style.padding = "0.5rem 0rem 0.5rem 0rem";
           } else if (panel.sign.globalPositioning.toLowerCase() == "bottom") {
           g_bottom.appendChild(g_shieldsContainerElmt);
           g_bottom.appendChild(g_controlTextElmt);
           g_bottom.appendChild(g_actionMessageElmt);
           g_bottom.style.padding = "0.5rem 0rem 0.5rem 0rem";
           } else if (panel.sign.globalPositioning.toLowerCase() == "shield top") {
           g_top.appendChild(g_shieldsContainerElmt);
           g_bottom.appendChild(g_controlTextElmt);
           g_bottom.appendChild(g_actionMessageElmt);
           g_top.style.padding = "0.5rem 0rem 0.5rem 0rem";
           g_bottom.style.padding = "0.5rem 0rem 0.5rem 0rem";
           } else if (
           panel.sign.globalPositioning.toLowerCase() == "control top"
           ) {
           g_bottom.appendChild(g_shieldsContainerElmt);
           g_top.appendChild(g_controlTextElmt);
           g_top.appendChild(g_actionMessageElmt);
           g_top.style.padding = "0.5rem 0rem 0.5rem 0rem";
           g_bottom.style.padding = "0.5rem 0rem 0.5rem 0rem";
           }
           }
           */
          
          panel.sign.arrowMode = normalizeArrowMode(panel.sign.arrowMode);
          
          const guideArrowsElmt = document.createElement("div");
          guideArrowsElmt.className = `guideArrows ${panel.sign.guideArrow
          .replace("/", "-")
          .replace(" ", "_")
          .toLowerCase()} ${panel.sign.arrowPosition.toLowerCase()}`;
          const standardGuideArrowSpacing = parseFloat(panel.sign.exitOnlyPadding);
          const resolvedGuideArrowSpacing = Number.isFinite(standardGuideArrowSpacing)
            ? standardGuideArrowSpacing
            : 0.25;
          guideArrowsElmt.style.setProperty(
            "--guideArrowSpacing",
            resolvedGuideArrowSpacing + "rem"
          );
          const applyGuideArrowVerticalSpacing = (element) => {
            if (!element) {
              return;
            }

            const spacingValue = resolvedGuideArrowSpacing + "rem";
            element.style.setProperty("--guideArrowSpacing", spacingValue);
            element.style.setProperty("padding-top", spacingValue, "important");
            element.style.setProperty("padding-bottom", spacingValue, "important");
          };
          
          if (panel.sign.arrowMode === "apl") {
              guideArrowsElmt.style.display = "none";
              guideArrowsElmt.style.visibility = "hidden";
          }
          
          signCont.appendChild(guideArrowsElmt);
          guideArrowsElmt.dataset.panelIndex = String(index);
          
          guideArrowsElmt.addEventListener("click", (event) => {
              event.stopPropagation();
              
              const clickedPanelIndex = Number(event.currentTarget.dataset.panelIndex);
              
              selectRenderedPanelArea({
                  panelIndex: clickedPanelIndex,
                  subPanelIndex: 0,
                  menu: "guideArrows",
                  guideMode: "standard",
                  flashTarget: event.currentTarget,
              });
          });
          
          const otherSymbolsElmt = document.createElement("div");
          otherSymbolsElmt.className = `otherSymbols ${panel.sign.otherSymbol
        .replace("/", "-")
        .replace(" ", "_")
        .toLowerCase()}`;
          guideArrowsElmt.appendChild(otherSymbolsElmt);
          
          const oSNumElmt = document.createElement("div");
          oSNumElmt.className = `oSNum`;
          otherSymbolsElmt.appendChild(oSNumElmt);
          
          const arrowContElmt = document.createElement("div");
          arrowContElmt.className = `arrowContainer`;
          guideArrowsElmt.appendChild(arrowContElmt);
          
          // APL Arrows Container
          const aplArrowsElmt = document.createElement("div");
          aplArrowsElmt.className = "aplArrows";
          signCont.appendChild(aplArrowsElmt);
          if (panel.sign.arrowMode !== "apl") {
            aplArrowsElmt.style.display = "none";
            aplArrowsElmt.style.visibility = "hidden";
          }
          
          const sideLeftArrowElmt = document.createElement("img");
          sideLeftArrowElmt.className = "sideLeftArrow";
          sideLeftArrowElmt.src = "img/arrows/A-4.svg";
          signHolderElmt.appendChild(sideLeftArrowElmt);
          
          // subpanels
          
          // Calculate APL arrow groups before the loop
          const aplArrows =
            panel.sign.arrowMode === "apl" ? panel.sign.aplArrows || [] : [];
          
          const aplSubpanelGroups = getAPLSubpanelGroupsForSign(panel.sign);
          const aplVisualArrowOrder = [];

          aplSubpanelGroups.forEach((group, groupIndex) => {
            aplArrows.forEach((arrow, index) => {
              if (
                arrow.placement !== "divider" &&
                group.indices.includes(arrow.subPanelIndex)
              ) {
                aplVisualArrowOrder.push(index);
              }
            });

            if (groupIndex < aplSubpanelGroups.length - 1) {
              aplArrows.forEach((arrow, index) => {
                if (
                  arrow.placement === "divider" &&
                  arrow.dividerAfterSubPanelIndex === group.end &&
                  isSubpanelDividerVisibleForSign(panel.sign, group.end)
                ) {
                  aplVisualArrowOrder.push(index);
                }
              });
            }
          });

          const shouldRenderAPLSpacingAfter = (arrowIndex) => {
              const visualIndex = aplVisualArrowOrder.indexOf(arrowIndex);
              return visualIndex >= 0 && visualIndex < aplVisualArrowOrder.length - 1;
          };
          
          const arrowGroups = Array.from(
             { length: panel.sign.subPanels.length },
             () => []
             );
          
          const APL_EDGE_PADDING_REM = 1;
          const APL_EXIT_ONLY_LABEL_WIDTH_REM = 3.25;
          const APL_EXIT_ONLY_STRAIGHT_GAP_REM = 1.15;
          const APL_EXIT_ONLY_TURN_GAP_REM = 1.1;
          const APL_EXIT_ONLY_TURN_STEM_OFFSET_REM = -0.75;

          const getSafeAPLSpacingRem = (value) => {
            const parsed = parseFloat(value);
            return Number.isFinite(parsed) && parsed >= 0
              ? parsed
              : DEFAULT_APL_ARROW_SPACING_REM;
          };

          const getSafeAPLSizeRem = (arrow) => {
            const parsed = parseFloat(arrow?.arrowSizeRem);
            if (Number.isFinite(parsed) && parsed > 0) {
              return parsed;
            }

            return getDefaultAPLArrowSizeRem(arrow?.type);
          };
          
          const getAPLArrowZoneHeightRem = () => {
            const maxArrowHeightRem = aplArrows.reduce((maxHeight, arrow) => {
              return Math.max(maxHeight, getSafeAPLSizeRem(arrow));
            }, 0);

            return maxArrowHeightRem > 0
              ? maxArrowHeightRem + APL_ARROW_ZONE_EXTRA_REM
              : 5.95;
          };

          const aplArrowZoneHeightRem = getAPLArrowZoneHeightRem();

          if (panel.sign.arrowMode === "apl" && aplArrows.length > 0) {
            signHolderElmt.style.setProperty(
              "--aplArrowZoneHeight",
              `${aplArrowZoneHeightRem}rem`
            );
          }

          const getAPLExitOnlyRenderedSides = (arrow, subPanelIndex) => {
            if (!isExitOnlyValue(arrow?.exitOnly)) {
              return { left: false, right: false };
            }

            const arrowGroup = getAPLArrowGroup(subPanelIndex);
            const arrowIndex = arrowGroup.findIndex(
              (arrowData) => arrowData?.arrow === arrow
            );

            if (arrowIndex < 0) {
              return { left: true, right: true };
            }

            const sharedAcrossBoundary = isBoundarySharedExitOnlyArrow(
              subPanelIndex,
              arrowIndex
            );

            const sharedInsideSubpanel =
              isAPLExitOnlyArrowAt(subPanelIndex, arrowIndex - 1) ||
              isAPLExitOnlyArrowAt(subPanelIndex, arrowIndex + 1);

            /*
              Shared APL Exit Only arrows do not render their individual EXIT/ONLY
              labels, so they should not reserve the old far-side label width.
            */
            if (sharedAcrossBoundary || sharedInsideSubpanel) {
              return { left: false, right: false };
            }

            return { left: true, right: true };
          };

        const getAPLExitOnlyExtentsRem = (arrow, subPanelIndex) => {
          if (!isExitOnlyValue(arrow?.exitOnly)) {
            return { left: 0, right: 0 };
          }

          const type = String(arrow.type || "");
          const isTurnArrow = type.includes("TURN");

          const gap = isTurnArrow
            ? APL_EXIT_ONLY_TURN_GAP_REM
            : APL_EXIT_ONLY_STRAIGHT_GAP_REM;

          let stemOffset = isTurnArrow ? APL_EXIT_ONLY_TURN_STEM_OFFSET_REM : 0;

          if (arrow.flip) {
            stemOffset *= -1;
          }

          const renderedSides = getAPLExitOnlyRenderedSides(arrow, subPanelIndex);

          return {
            left: renderedSides.left
              ? APL_EXIT_ONLY_LABEL_WIDTH_REM + gap - stemOffset
              : 0,
            right: renderedSides.right
              ? APL_EXIT_ONLY_LABEL_WIDTH_REM + gap + stemOffset
              : 0,
          };
        };

          const getAPLArrowHalfWidthRem = (arrow) => {
            const size = getSafeAPLSizeRem(arrow);

            switch (arrow?.type) {
              case "APL_UP":
                return Math.max(0.65, size * 0.16);

              case "APL_TURN":
                return Math.max(1.1, size * 0.31);

              case "APL_UP_TURN":
                return Math.max(1.25, size * 0.34);

              case "APL_DUAL_TURN":
                return Math.max(1.45, size * 0.38);

              default:
                return Math.max(0.9, size * 0.25);
            }
          };

          const getAPLVisualExtentsRem = (arrow, subPanelIndex) => {
            const arrowHalfWidth = getAPLArrowHalfWidthRem(arrow);
            const labelExtents = getAPLExitOnlyExtentsRem(arrow, subPanelIndex);

            return {
              left: Math.max(arrowHalfWidth, labelExtents.left) + APL_EDGE_PADDING_REM,
              right: Math.max(arrowHalfWidth, labelExtents.right) + APL_EDGE_PADDING_REM,
            };
          };

          const getAPLLeftReserveRem = (arrow, subPanelIndex) => {
            if (!arrow) {
              return 0;
            }

            const visual = getAPLVisualExtentsRem(arrow, subPanelIndex);

            if (subPanelIndex === 0) {
              return visual.left;
            }

            return Math.max(getSafeAPLSpacingRem(arrow.spacingBeforeRem), visual.left);
          };

          const getAPLRightReserveRem = (arrow, subPanelIndex) => {
            if (!arrow) {
              return 0;
            }

            const visual = getAPLVisualExtentsRem(arrow, subPanelIndex);

            if (subPanelIndex >= panel.sign.subPanels.length - 1) {
              return visual.right;
            }

            return Math.max(getSafeAPLSpacingRem(arrow.spacingAfterRem), visual.right);
          };

          const getAPLSubpanelMinWidthRem = (arrowGroup = [], subPanelIndex = 0) => {
            if (!Array.isArray(arrowGroup) || arrowGroup.length === 0) {
              return 0;
            }

            const firstArrow = arrowGroup[0]?.arrow;
            const lastArrow = arrowGroup[arrowGroup.length - 1]?.arrow;

            let widthRem = getAPLLeftReserveRem(firstArrow, subPanelIndex);

            for (let i = 1; i < arrowGroup.length; i++) {
              const previousArrow = arrowGroup[i - 1]?.arrow;
              widthRem += getSafeAPLSpacingRem(previousArrow?.spacingAfterRem);
            }

            widthRem += getAPLRightReserveRem(lastArrow, subPanelIndex);

            return widthRem;
          };

          for (let ai = 0; ai < aplArrows.length; ai++) {
            const arrow = aplArrows[ai];

            if (!arrow || arrow.placement === "divider") {
              continue;
            }

            const targetSubPanelIndex = getAPLGroupStartForSubPanelIndex(
              panel.sign,
              typeof arrow.subPanelIndex === "number" ? arrow.subPanelIndex : 0
            );

            if (targetSubPanelIndex >= 0 && targetSubPanelIndex < arrowGroups.length) {
              arrowGroups[targetSubPanelIndex].push({ arrow, index: ai });
            }
          }

          const getAPLArrowGroup = (subPanelIndex) => {
            const groupStart = getAPLGroupStartForSubPanelIndex(
              panel.sign,
              subPanelIndex
            );

            return arrowGroups.length > 0 &&
              groupStart >= 0 &&
              groupStart < arrowGroups.length
              ? arrowGroups[groupStart]
              : [];
          };

          const isExitOnlyValue = (value) =>
            value === true ||
            value === "true" ||
            value === "on" ||
            value === 1 ||
            value === "1";

          const isAPLExitOnlyArrowAt = (subPanelIndex, arrowIndex) => {
            const group = getAPLArrowGroup(subPanelIndex);
            return isExitOnlyValue(group[arrowIndex]?.arrow?.exitOnly);
          };

          const getAPLBoundaryArrowKey = (subPanelIndex, arrowIndex) =>
            `${subPanelIndex}:${arrowIndex}`;

          const getAPLBoundaryDividerKey = (dividerSubPanelIndex) =>
            `divider:${dividerSubPanelIndex}`;

          const sharedExitOnlyBoundaryDividers = new Set();
          const sharedExitOnlyBoundaryArrowKeys = new Set();
          const sharedExitOnlyBoundaryDividerArrowKeys = new Set();

          if (panel.sign.arrowMode === "apl") {
            for (
              let dividerSubPanelIndex = 1;
              dividerSubPanelIndex < panel.sign.subPanels.length;
              dividerSubPanelIndex++
            ) {
              const leftSubPanelIndex = dividerSubPanelIndex - 1;
              const rightSubPanelIndex = dividerSubPanelIndex;

              if (!isSubpanelDividerVisibleForSign(panel.sign, leftSubPanelIndex)) {
                continue;
              }

              const leftGroup = getAPLArrowGroup(leftSubPanelIndex);
              const rightGroup = getAPLArrowGroup(rightSubPanelIndex);

              const leftArrowIndex = leftGroup.length - 1;
              const rightArrowIndex = 0;

              const dividerArrow = (panel.sign.aplArrows || []).find(
                (arrow) =>
                  arrow.placement === "divider" &&
                  arrow.dividerAfterSubPanelIndex === leftSubPanelIndex
              );

              const leftExitOnly =
                leftArrowIndex >= 0 &&
                isAPLExitOnlyArrowAt(leftSubPanelIndex, leftArrowIndex);

              const rightExitOnly =
                rightGroup.length > 0 &&
                isAPLExitOnlyArrowAt(rightSubPanelIndex, rightArrowIndex);

              const dividerExitOnly = isExitOnlyValue(dividerArrow?.exitOnly);

              const shouldShareAcrossBoundary =
                (leftExitOnly && rightExitOnly) ||
                (leftExitOnly && dividerExitOnly) ||
                (dividerExitOnly && rightExitOnly);

              if (shouldShareAcrossBoundary) {
                sharedExitOnlyBoundaryDividers.add(dividerSubPanelIndex);

                if (leftExitOnly) {
                  sharedExitOnlyBoundaryArrowKeys.add(
                    getAPLBoundaryArrowKey(leftSubPanelIndex, leftArrowIndex)
                  );
                }

                if (rightExitOnly) {
                  sharedExitOnlyBoundaryArrowKeys.add(
                    getAPLBoundaryArrowKey(rightSubPanelIndex, rightArrowIndex)
                  );
                }

                if (dividerExitOnly) {
                  sharedExitOnlyBoundaryDividerArrowKeys.add(
                    getAPLBoundaryDividerKey(dividerSubPanelIndex)
                  );
                }
              }
            }
          }

          const isBoundarySharedExitOnlyArrow = (subPanelIndex, arrowIndex) =>
            sharedExitOnlyBoundaryArrowKeys.has(
              getAPLBoundaryArrowKey(subPanelIndex, arrowIndex)
            );

          const isBoundarySharedExitOnlyDividerArrow = (dividerSubPanelIndex) =>
            sharedExitOnlyBoundaryDividerArrowKeys.has(
              getAPLBoundaryDividerKey(dividerSubPanelIndex)
            );
        const getSharedExitOnlyBoundaryCenterOffsetRem = (dividerSubPanelIndex) => {
          const leftSubPanelIndex = dividerSubPanelIndex - 1;
          const rightSubPanelIndex = dividerSubPanelIndex;

          const leftGroup = getAPLArrowGroup(leftSubPanelIndex);
          const rightGroup = getAPLArrowGroup(rightSubPanelIndex);

          const leftArrow = leftGroup[leftGroup.length - 1]?.arrow;
          const rightArrow = rightGroup[0]?.arrow;

          const dividerArrow = (panel.sign.aplArrows || []).find(
            (arrow) =>
              arrow.placement === "divider" &&
              arrow.dividerAfterSubPanelIndex === leftSubPanelIndex
          );

          const leftExitOnly = isExitOnlyValue(leftArrow?.exitOnly);
          const rightExitOnly = isExitOnlyValue(rightArrow?.exitOnly);
          const dividerExitOnly = isExitOnlyValue(dividerArrow?.exitOnly);

          /*
            Positive = move right from the divider.
            Negative = move left from the divider.
            This places the plaque between the two arrows instead of directly on the divider.
          */
          if (dividerExitOnly && rightExitOnly) {
            return getAPLLeftReserveRem(rightArrow, rightSubPanelIndex) / 2;
          }

          if (leftExitOnly && dividerExitOnly) {
            return -getAPLRightReserveRem(leftArrow, leftSubPanelIndex) / 2;
          }

          if (leftExitOnly && rightExitOnly) {
            return (
              getAPLLeftReserveRem(rightArrow, rightSubPanelIndex) -
              getAPLRightReserveRem(leftArrow, leftSubPanelIndex)
            ) / 2;
          }

          return 0;
        };
        
          for (
               let subPanelIndex = 0;
               subPanelIndex < panel.sign.subPanels.length;
               subPanelIndex++
               ) {
                   const subPanel = panel.sign.subPanels[subPanelIndex];
                   let locked = false;
                   
                   if (
                       subPanelIndex > 0 &&
                       isSubpanelDividerVisibleForSign(panel.sign, subPanelIndex - 1)
                    ) {
                       const subPanel = panel.sign.subPanels[subPanelIndex];
                       const subDivider = document.createElement("div");
                       subDivider.className = "subDivider";
                       subDivider.id = "subDivider" + subPanelIndex.toString();
                       
                       const dividerArrow =
                       panel.sign.arrowMode === "apl"
                       ? (panel.sign.aplArrows || []).find(
                                                           (arrow) =>
                                                           arrow.placement === "divider" &&
                                                           arrow.dividerAfterSubPanelIndex === subPanelIndex - 1
                                                           )
                       : null;
                       
                       if (dividerArrow) {
                           const arrowDef = ArrowElement.prototype.arrows[dividerArrow.type];
                           if (arrowDef) {
                               const divArrowSlot = document.createElement("div");
                               divArrowSlot.className = "aplArrowSlot aplDividerArrowSlot";
                               divArrowSlot.dataset.arrowType = dividerArrow.type;
                               
                               if (dividerArrow.flip) {
                                   divArrowSlot.dataset.flipped = "true";
                               }
                               
                               const dividerArrowSizeRem = getSafeAPLSizeRem(dividerArrow);
                               const dividerStopOffsetRem =
                                 dividerArrowSizeRem +
                                 APL_DIVIDER_ARROW_BOTTOM_OFFSET_REM +
                                 APL_DIVIDER_LINE_GAP_REM;

                               subDivider.style.setProperty(
                                 "--aplDividerStopOffset",
                                 `${dividerStopOffsetRem}rem`
                               );

                               subDivider.style.setProperty(
                                 "--aplDividerArrowBottomOffset",
                                 `${APL_DIVIDER_ARROW_BOTTOM_OFFSET_REM}rem`
                               );

                               divArrowSlot.style.setProperty(
                                 "--aplArrowSlotHeight",
                                 `${dividerArrowSizeRem}rem`
                               );
                               
                               const divArrowImg = document.createElement("img");
                               divArrowImg.className = "aplArrow aplDividerArrow";
                               divArrowImg.dataset.type = dividerArrow.type;
                               divArrowImg.src = arrowDef.src;
                               divArrowImg.alt = arrowDef.label;
                               
                               divArrowImg.style.height = `${dividerArrowSizeRem}rem`;
                               
                               divArrowSlot.appendChild(divArrowImg);
                               
                               if (isExitOnlyValue(dividerArrow.exitOnly)) {
                                   const boundarySharedExitOnly =
                                     isBoundarySharedExitOnlyDividerArrow(subPanelIndex);

                                   divArrowSlot.classList.add("aplExitOnlyContainer");

                                   if (boundarySharedExitOnly) {
                                       divArrowSlot.classList.add("aplExitOnlySharedRunMember");
                                   } else {
                                       const exitSpan = document.createElement("span");
                                       exitSpan.className = "aplExitOnlyLabel aplExitOnlyExit";
                                       exitSpan.textContent = "EXIT";
                                       
                                       const onlySpan = document.createElement("span");
                                       onlySpan.className = "aplExitOnlyLabel aplExitOnlyOnly";
                                       onlySpan.textContent = "ONLY";
                                       
                                       divArrowSlot.appendChild(exitSpan);
                                       divArrowSlot.appendChild(onlySpan);
                                   }
                               }
                               
                               subDivider.appendChild(divArrowSlot);
                               subDivider.classList.add("hasArrow");
                               
                           }
                       }
                     
                     if (sharedExitOnlyBoundaryDividers.has(subPanelIndex)) {
                         subDivider.classList.add("hasSharedExitOnlyBoundary");

                         const sharedBoundaryLabel = document.createElement("span");
                         sharedBoundaryLabel.className =
                           "aplExitOnlyLabel aplExitOnlySharedLabel aplExitOnlyBoundarySharedLabel";
                         sharedBoundaryLabel.textContent = "EXIT ONLY";

                         sharedBoundaryLabel.style.setProperty(
                           "--aplExitOnlyBoundaryCenterOffset",
                           `${getSharedExitOnlyBoundaryCenterOffsetRem(subPanelIndex)}rem`
                         );

                         subDivider.appendChild(sharedBoundaryLabel);
                     }
                       
                       const dividerHeight = (subPanel && subPanel.height) || "";
                       if (
                           
                           subPanel &&
                           subPanel.customDividerHeight &&
                           typeof dividerHeight === "string" &&
                           dividerHeight.trim().length
                           ) {
                               subDivider.style.height = dividerHeight;
                           } else {
                               subDivider.style.removeProperty("height");
                           }
                       subDivider.style.alignSelf = "stretch";
                       signHolderElmt.appendChild(subDivider);
                   }
                   
                   const new_subPanel = document.createElement("div");
                   new_subPanel.className = "subPanelDisplay";
                   new_subPanel.id = "S_subPanel" + subPanelIndex.toString();
                   new_subPanel.dataset.panelIndex = String(index);
                   new_subPanel.dataset.subpanelIndex = String(subPanelIndex);
                   
                   markSelectedRenderedSubpanel(new_subPanel, subPanelIndex);
                   new_subPanel.addEventListener("click", (event) => {
                       if (event.target.closest("[data-sign-row][data-sign-block]")) {
                         return;
                       }

                       event.stopPropagation();
                       
                       const clickedPanelIndex = Number(event.currentTarget.dataset.panelIndex);
                       const clickedSubPanelIndex = Number(event.currentTarget.dataset.subpanelIndex);
                       const guideArrowMenuOpen = isGuideArrowMenuOpen();
                       
                       selectRenderedPanelArea({
                           panelIndex: Number.isNaN(clickedPanelIndex) ? 0 : clickedPanelIndex,
                           subPanelIndex: Number.isNaN(clickedSubPanelIndex) ? 0 : clickedSubPanelIndex,
                           rowIndex: 0,
                           blockIndex: 0,
                           menu: guideArrowMenuOpen ? "none" : "subpanel",
                           flashTarget: event.currentTarget,
                       });
                   });
                   signHolderElmt.appendChild(new_subPanel);
                   
                   const signContentContainerElmt = document.createElement("div");
                   signContentContainerElmt.className = `signContentContainer shieldPosition${panel.sign.shieldPosition}`;
                   signContentContainerElmt.id =
                   "signContentContainer" + subPanelIndex.toString();
                   new_subPanel.appendChild(signContentContainerElmt);
                   
                   // Insert CA style exit tabs at the beginning of the first subpanel
                   if (subPanelIndex === 0 && caStyleExitTabs.length > 0) {
                       caStyleExitTabs.forEach(({exitTabCont}) => {
                           exitTabCont.classList.add("caStyle");
                           signContentContainerElmt.appendChild(exitTabCont);
                       });
                   }
                   
                   const shieldsContainerElmt = document.createElement("div");
                   shieldsContainerElmt.className = `shieldsContainer ${panel.sign.shieldBacks ? "shieldBacks" : ""
          }`;
                   shieldsContainerElmt.id = "shieldsContainer" + subPanelIndex.toString();
                   signContentContainerElmt.appendChild(shieldsContainerElmt);
                   
                   /*
                    const controlTextElmt = document.createElement("p");
                    controlTextElmt.className = "controlText";
                    controlTextElmt.id = "controlText" + subPanelIndex.toString();
                    signContentContainerElmt.appendChild(controlTextElmt);
                    
                    
                    const actionMessageElmt = document.createElement("div");
                    actionMessageElmt.className = `actionMessage`;
                    actionMessageElmt.id = "actionMessage" + subPanelIndex.toString();
                    signContentContainerElmt.appendChild(actionMessageElmt);
                    */
                   
                   const blockElement = subPanel.blockElements.createElement(
                                                                             panel,
                                                                             subPanel
                                                                             );
                   blockElement.dataset.panelIndex = String(index);
                   blockElement.dataset.subpanel = String(subPanelIndex);
                   bindRenderedBlockSelection(blockElement, subPanelIndex);
                   signContentContainerElmt.appendChild(blockElement);
                   
                   // Shields
                   createShield(subPanel.shields, shieldsContainerElmt);
                   
                   // sign
                   signContentContainerElmt.style.padding = panel.sign.padding;
                   
                   // APL Arrows for this subpanel - always create container if APL arrows exist on sign
                   if (panel.sign.arrowMode === "apl" && panel.sign.aplArrows && panel.sign.aplArrows.length > 0) {
                       const subPanelArrowContainer = document.createElement("div");
                       subPanelArrowContainer.className = "aplArrows subpanelAplArrows";
                       const arrowGroupForWidth =
                       arrowGroups.length > 0 && subPanelIndex < arrowGroups.length
                       ? arrowGroups[subPanelIndex]
                       : [];
                       
                       const aplSubpanelMinWidthRem = getAPLSubpanelMinWidthRem(
                                                                                arrowGroupForWidth,
                                                                                subPanelIndex
                                                                                );
                       
                       if (aplSubpanelMinWidthRem > 0) {
                           new_subPanel.style.setProperty(
                                                          "--aplSubpanelMinWidth",
                                                          `${aplSubpanelMinWidthRem}rem`
                                                          );
                           new_subPanel.classList.add("hasAplWidthReserve");
                       }
                       const subPanelHasExitOnlyArrow =
                       arrowGroups.length > 0 &&
                       subPanelIndex < arrowGroups.length &&
                       arrowGroups[subPanelIndex].some((arrowData) => arrowData.arrow?.exitOnly);
                       
                       if (subPanelHasExitOnlyArrow) {
                           subPanelArrowContainer.classList.add("hasAplExitOnly");
                           new_subPanel.classList.add("hasAplExitOnlySubpanel");
                           
                           if (subPanelIndex === 0) {
                               new_subPanel.classList.add("hasAplExitOnlyLeftEdge");
                           }
                           
                           if (subPanelIndex === panel.sign.subPanels.length - 1) {
                               new_subPanel.classList.add("hasAplExitOnlyRightEdge");
                           }
                       }
                       subPanelArrowContainer.style.display = "flex";
                       subPanelArrowContainer.dataset.panelIndex = String(index);
                       subPanelArrowContainer.dataset.subpanelIndex = String(subPanelIndex);
                       
                       subPanelArrowContainer.addEventListener("click", (event) => {
                           event.stopPropagation();
                           
                           const clickedPanelIndex = Number(event.currentTarget.dataset.panelIndex);
                           const clickedSubPanelIndex = Number(event.currentTarget.dataset.subpanelIndex);
                           
                           selectRenderedPanelArea({
                               panelIndex: clickedPanelIndex,
                               subPanelIndex: Number.isNaN(clickedSubPanelIndex) ? 0 : clickedSubPanelIndex,
                               menu: "guideArrows",
                               guideMode: "apl",
                               flashTarget: event.currentTarget.closest(".subPanelDisplay"),
                           });
                       });
                       
                       subPanelArrowContainer.style.gap = "0";
                       
                       // Only add arrows if this subpanel has an arrow group
                       // Only add arrows if this subpanel has an arrow group
                     if (arrowGroupForWidth.length > 0) {
                         const arrowGroup = arrowGroupForWidth;

                       const isExitOnlyAPLArrow = (group, arrowIndex) =>
                         isExitOnlyValue(group[arrowIndex]?.arrow?.exitOnly);

                         const isInSharedExitOnlyRun = (group, arrowIndex) =>
                           isExitOnlyAPLArrow(group, arrowIndex) &&
                           (
                             isExitOnlyAPLArrow(group, arrowIndex - 1) ||
                             isExitOnlyAPLArrow(group, arrowIndex + 1)
                           );

                         const isFirstSharedExitOnlyArrow = (group, arrowIndex) =>
                           isExitOnlyAPLArrow(group, arrowIndex) &&
                           !isExitOnlyAPLArrow(group, arrowIndex - 1) &&
                           isExitOnlyAPLArrow(group, arrowIndex + 1);

                         const getSharedExitOnlyRunEndIndex = (group, startIndex) => {
                           let endIndex = startIndex;

                           while (isExitOnlyAPLArrow(group, endIndex + 1)) {
                             endIndex++;
                           }

                           return endIndex;
                         };

                         const getSharedExitOnlyCenterOffsetRem = (group, startIndex, endIndex) => {
                           let totalSpacingRem = 0;

                           for (let i = startIndex + 1; i <= endIndex; i++) {
                             totalSpacingRem += getSafeAPLSpacingRem(
                               group[i - 1]?.arrow?.spacingAfterRem
                             );
                           }

                           return totalSpacingRem / 2;
                         };
                         
                         for (let gi = 0; gi < arrowGroup.length; gi++) {
                               const arrowData = arrowGroup[gi];
                               const arrow = arrowData.arrow;
                               
                               const arrowDef = ArrowElement.prototype.arrows[arrow.type];
                               if (!arrowDef) {
                                   continue;
                               }
                               
                               const arrowImg = document.createElement("img");
                               arrowImg.className = "aplArrow";
                               arrowImg.dataset.type = arrow.type;
                               arrowImg.src = arrowDef.src;
                               arrowImg.alt = arrowDef.label;
                               
                               const arrowSizeRem = Number(arrow.arrowSizeRem);
                               if (Number.isFinite(arrowSizeRem) && arrowSizeRem > 0) {
                                   arrowImg.style.height = `${arrowSizeRem}rem`;
                               }
                               
                               if (arrow.groupedWithDivider) {
                                   arrowImg.style.visibility = "hidden";
                               }
                               
                               const arrowSlot = document.createElement("div");
                               arrowSlot.className = "aplArrowSlot";
                               arrowSlot.dataset.arrowType = arrow.type;
                               
                               if (arrow.flip) {
                                   arrowSlot.dataset.flipped = "true";
                               }
                               
                               const arrowSizeForSlot = Number(arrow.arrowSizeRem);
                               if (Number.isFinite(arrowSizeForSlot) && arrowSizeForSlot > 0) {
                                   arrowSlot.style.setProperty("--aplArrowSlotHeight", `${arrowSizeForSlot}rem`);
                               }
                               
                               arrowImg.style.margin = "0";
                               arrowImg.style.transform = "";
                               arrowSlot.appendChild(arrowImg);
                               
                           if (isExitOnlyValue(arrow.exitOnly)) {
                               const boundarySharedExitOnly =
                                 isBoundarySharedExitOnlyArrow(subPanelIndex, gi);

                               const sameSubpanelSharedRun =
                                 isInSharedExitOnlyRun(arrowGroup, gi);

                               arrowSlot.classList.add("aplExitOnlyContainer");

                               if (boundarySharedExitOnly || sameSubpanelSharedRun) {
                                   arrowSlot.classList.add("aplExitOnlySharedRunMember");
                               }

                               if (
                                   isFirstSharedExitOnlyArrow(arrowGroup, gi) &&
                                   !boundarySharedExitOnly
                               ) {
                                   const runEndIndex = getSharedExitOnlyRunEndIndex(arrowGroup, gi);
                                   const centerOffsetRem = getSharedExitOnlyCenterOffsetRem(
                                     arrowGroup,
                                     gi,
                                     runEndIndex
                                   );

                                   arrowSlot.classList.add("aplExitOnlySharedLead");

                                   const sharedSpan = document.createElement("span");
                                   sharedSpan.className = "aplExitOnlyLabel aplExitOnlySharedLabel";
                                   sharedSpan.textContent = "EXIT ONLY";
                                   sharedSpan.style.setProperty(
                                     "--aplExitOnlySharedCenterOffset",
                                     `${centerOffsetRem}rem`
                                   );

                                   arrowSlot.appendChild(sharedSpan);
                               } else if (!boundarySharedExitOnly && !sameSubpanelSharedRun) {
                                   const exitSpan = document.createElement("span");
                                   exitSpan.className = "aplExitOnlyLabel aplExitOnlyExit";
                                   exitSpan.textContent = "EXIT";
                                   
                                   const onlySpan = document.createElement("span");
                                   onlySpan.className = "aplExitOnlyLabel aplExitOnlyOnly";
                                   onlySpan.textContent = "ONLY";
                                   
                                   arrowSlot.appendChild(exitSpan);
                                   arrowSlot.appendChild(onlySpan);
                               }
                           }
                               
                               subPanelArrowContainer.appendChild(arrowSlot);
                               
                               const isFirstArrowInSubpanel = gi === 0;
                               const isLastArrowInSubpanel = gi === arrowGroup.length - 1;
                               const previousArrow = gi > 0 ? arrowGroup[gi - 1]?.arrow : null;

                               arrowSlot.style.marginLeft = isFirstArrowInSubpanel
                                 ? `${getAPLLeftReserveRem(arrow, subPanelIndex)}rem`
                                 : `${getSafeAPLSpacingRem(previousArrow?.spacingAfterRem)}rem`;

                               arrowSlot.style.marginRight = isLastArrowInSubpanel
                                 ? `${getAPLRightReserveRem(arrow, subPanelIndex)}rem`
                                 : "0";
                           }
                       }
                       
                       new_subPanel.appendChild(subPanelArrowContainer);
                       
                   }
                   
               }
               
          
        const sideRightArrowElmt = document.createElement("img");
        sideRightArrowElmt.className = "sideRightArrow";
        sideRightArrowElmt.src = "img/arrows/A-1.svg";
        signHolderElmt.appendChild(sideRightArrowElmt);

        const syncStandardGuideArrowSubpanelWidth = () => {
          const isStandardGuideArrow =
            panel.sign.arrowMode !== "apl" &&
            panel.sign.guideArrow !== "None" &&
            panel.sign.guideArrow !== "Side Left" &&
            panel.sign.guideArrow !== "Side Right";

          if (!isStandardGuideArrow || !arrowContElmt || !signHolderElmt) {
            return;
          }

          const apply = () => {
            const arrowContainerWidth = Math.ceil(
              Math.max(
                arrowContElmt.scrollWidth || 0,
                arrowContElmt.getBoundingClientRect().width || 0,
                guideArrowsElmt?.scrollWidth || 0,
                guideArrowsElmt?.getBoundingClientRect().width || 0
              )
            );

            if (!arrowContainerWidth) {
              return;
            }

            const currentSubpanelGroupWidth = Math.ceil(
              Math.max(
                signHolderElmt.scrollWidth || 0,
                signHolderElmt.getBoundingClientRect().width || 0
              )
            );

            const desiredSubpanelGroupWidth = Math.max(
              arrowContainerWidth,
              currentSubpanelGroupWidth
            );

            if (arrowContainerWidth > currentSubpanelGroupWidth + 1) {
              signHolderElmt.classList.add("hasStandardGuideArrowWidthReserve");
              signHolderElmt.style.setProperty(
                "--standardGuideArrowMinWidth",
                `${desiredSubpanelGroupWidth}px`
              );
              signHolderElmt.style.width = `${desiredSubpanelGroupWidth}px`;
              signHolderElmt.style.minWidth = `${desiredSubpanelGroupWidth}px`;
            } else {
              signHolderElmt.classList.remove("hasStandardGuideArrowWidthReserve");
              signHolderElmt.style.removeProperty("--standardGuideArrowMinWidth");
              signHolderElmt.style.removeProperty("width");
              signHolderElmt.style.removeProperty("min-width");
            }

            const standardDividers = Array.from(
              signHolderElmt.querySelectorAll(":scope > .subDivider")
            );

            const standardGuideArrowImgs = Array.from(
              arrowContElmt.querySelectorAll("img.arrow, img.exitOnlyArrow, img.qcExitOnlyArrow")
            ).filter((img) => {
              const rect = img.getBoundingClientRect();
              const styles = window.getComputedStyle(img);

              return (
                rect.width > 0 &&
                rect.height > 0 &&
                styles.display !== "none" &&
                styles.visibility !== "hidden"
              );
            });

            const arrowRects = standardGuideArrowImgs.map((img) => {
              const rect = img.getBoundingClientRect();

              return {
                left: rect.left,
                right: rect.right,
                center: rect.left + rect.width / 2,
                width: rect.width,
                height: rect.height,
              };
            });

            standardDividers.forEach((divider) => {
              divider.classList.remove("hasStandardGuideArrowBelow");
              divider.style.removeProperty("--standardGuideArrowDividerStopOffset");

              const dividerRect = divider.getBoundingClientRect();
              const dividerCenter = dividerRect.left + dividerRect.width / 2;

              const arrowDirectlyBelow = arrowRects.find((arrowRect) => {
                const horizontalPadding = Math.max(6, arrowRect.width * 0.18);

                return (
                  dividerCenter >= arrowRect.left - horizontalPadding &&
                  dividerCenter <= arrowRect.right + horizontalPadding
                );
              });

              if (!arrowDirectlyBelow) {
                return;
              }

              divider.classList.add("hasStandardGuideArrowBelow");
              divider.style.setProperty(
                "--standardGuideArrowDividerStopOffset",
                `${Math.max(7, Math.min(12, arrowDirectlyBelow.height * 0.18))}px`
              );
            });
          };

          requestAnimationFrame(() => {
            apply();
            requestAnimationFrame(apply);
          });

          arrowContElmt.querySelectorAll("img").forEach((img) => {
            if (!img.complete) {
              img.addEventListener("load", apply, { once: true });
            }
          });
        };
          
          // Guide arrows
          
          const ExitKeys = ["EA", "EB", "EC"];
          const MainKeys = ["A", "B", "C", "D", "E"];
          var path;
          
          const qcExitMarkerMode =
            panel.sign.quebecExitMarkerEnabled === true &&
            (
              panel.sign.guideArrow === "Exit Only" ||
              panel.sign.guideArrow === "Half Exit Only" ||
              panel.sign.guideArrow === "Split Exit Only"
            );

          const qcExitArrowSide =
            String(panel.sign.arrowPosition || "Middle").toLowerCase() === "left"
              ? "left"
              : "right";

          const qcExitArrowSideClass =
            qcExitArrowSide === "left" ? "Left" : "Right";
          
          const createQuebecExitOnlyArrowElmt = () => {
            const arrowImg = document.createElement("img");
            arrowImg.className = "exitOnlyArrow qcExitOnlyArrow";
            arrowImg.src = "img/arrows/QC_EXIT_RIGHT.svg";
            arrowImg.alt = "Quebec exit arrow";

            if (qcExitArrowSide === "left") {
              arrowImg.classList.add("flipped");
            }

            return arrowImg;
          };
          
          const createArrowElmt = function (key, dir, name, extra) {
              if (dir == "MainArrows!ExitOnly") {
                  key = key.split("/")[1];
              } else {
                  key = key.split("/")[0];
              }

              key = String(key || "").trim();

              const specialGuideArrowBlocks = {
                  DOWN_CA: {
                      src: "img/arrowBlocks/DOWN_CA.svg",
                      className: "canadianDownArrow",
                  },
                  DOWN_IL: {
                      src: "img/arrowBlocks/DOWN_IL.svg",
                      className: "illinoisDownArrow",
                  },
              };

              if (specialGuideArrowBlocks[key]) {
                  const specialArrowElmt = document.createElement("img");
                  specialArrowElmt.className = name || "exitOnlyArrow ";

                  if (extra) {
                      specialArrowElmt.className += " " + extra;
                  }

                  specialArrowElmt.src = specialGuideArrowBlocks[key].src;
                  specialArrowElmt.classList.add(specialGuideArrowBlocks[key].className, "downarrow");
                  return specialArrowElmt;
              }

              if (
                  ExitKeys.includes(key.split("-")[0]) ||
                  MainKeys.includes(key.split("-")[0])
                  ) {
                      const downArrowElmt = document.createElement("img");
                      downArrowElmt.className = name || "exitOnlyArrow ";

                      if (extra) {
                          downArrowElmt.className += " " + extra;
                      }

                      if (ExitKeys.includes(key.split("-")[0])) {
                          key = key.split("-")[0].split("")[1] + "-" + key.split("-")[1];
                          downArrowElmt.style.filter = "invert(1)";
                      }

                      if (qcExitMarkerMode) {
                          downArrowElmt.src = "img/arrows/QC_EXIT_RIGHT.svg";
                          downArrowElmt.classList.add("qcExitOnlyArrow");
                          downArrowElmt.style.filter = "none";

                          if (qcExitArrowSide === "left") {
                              downArrowElmt.classList.add("flipped");
                          } else {
                              downArrowElmt.classList.remove("flipped");
                          }

                          return downArrowElmt;
                      }

                      const shouldUseCanadianDownArrow =
                      panel.sign.useCanadianDownArrows && key === "C-1";

                      if (shouldUseCanadianDownArrow) {
                          downArrowElmt.src = "img/arrowBlocks/DOWN_CA.svg";
                          downArrowElmt.classList.add("canadianDownArrow");
                      } else {
                          downArrowElmt.src = "img/arrows/" + key + ".svg";
                      }

                      return downArrowElmt;
                  }
          };

        const canAlignStandardGuideArrow =
          panel.sign.guideArrow != "Exit Only" &&
          panel.sign.guideArrow != "Side Left" &&
          panel.sign.guideArrow != "Side Right" &&
          panel.sign.guideArrow != "Half Exit Only";

        if (canAlignStandardGuideArrow) {
          arrowContElmt.style.cssFloat = "none";
          arrowContElmt.style.float = "none";
          arrowContElmt.style.width = "max-content";

          if (panel.sign.arrowPosition == "Left") {
            arrowContElmt.style.marginLeft = "0";
            arrowContElmt.style.marginRight = "auto";
            arrowContElmt.style.paddingLeft = "0";
            arrowContElmt.style.paddingRight = "0";
            arrowContElmt.style.justifyContent = "flex-start";
          } else if (panel.sign.arrowPosition == "Right") {
            arrowContElmt.style.marginLeft = "auto";
            arrowContElmt.style.marginRight = "0";
            arrowContElmt.style.paddingLeft = "0";
            arrowContElmt.style.paddingRight = "0";
            arrowContElmt.style.justifyContent = "flex-end";
          } else {
            arrowContElmt.style.marginLeft = "auto";
            arrowContElmt.style.marginRight = "auto";
            arrowContElmt.style.paddingLeft = "0";
            arrowContElmt.style.paddingRight = "0";
            arrowContElmt.style.justifyContent = "center";
          }
        }
          
          
          if (panel.sign.guideArrow.includes("Exit Only")) {
              const createExitOnlyArrowElmt = (direction) => {
                if (qcExitMarkerMode) {
                  return createQuebecExitOnlyArrowElmt();
                }

                const arrowImg = ArrowElmt(direction, "", true);
                  arrowImg.classList.remove("arrow");
                  arrowImg.classList.add("exitOnlyArrow");
                  
                  const directionClass = String(direction)
                  .toLowerCase()
                  .replace(/\s+/g, "-")
                  .replace(/\//g, "-");
                  
                  arrowImg.classList.add(`exitOnlyArrow--${directionClass}`);
                  return arrowImg;
              };
              
              const applyExitOnlyTextSizing = (element) => {
                if (!element) {
                  return;
                }

                if (post.fontType === true) {
                  applyHighwayGothicStyling(element);
                } else {
                  element.style.removeProperty("font-family");
                  element.style.removeProperty("--fhwaBaselineOffset");
                }
              };
              
              const createExitOnlyTextElmt = (text, bonusClass = "") => {
                  const span = document.createElement("span");
                  span.className = "exitOnlyText" + bonusClass;
                  span.appendChild(document.createTextNode(text));
                  return span;
              };
              
              const getExitOnlyBonusClass = () => {
                  return panel.sign.guideArrow == "Split Exit Only" ? " split" : "";
              };
              const borderWidthValue = "0.2rem";
              const exitOnlyBorderModes = Sign.prototype.exitOnlyBorderModes;
              const resolvedExitOnlyBorderMode = exitOnlyBorderModes.includes(
                                                                              panel.sign.exitOnlyBorderMode
                                                                              )
              ? panel.sign.exitOnlyBorderMode
              : exitOnlyBorderModes[0];
              const hideExitOnlyArrows = panel.sign.hideExitArrow === true;
              arrowContElmt.classList.toggle("hideExitOnlyArrows", hideExitOnlyArrows);
              if (
                  !post.secondExitOnly &&
                  panel.sign.guideArrow != "Split Exit Only" &&
                  panel.sign.guideArrow != "Half Exit Only"
                  ) {
                      guideArrowsElmt.style.padding = panel.sign.exitOnlyPadding + "rem";
                  }
              
              
              
              if (
                  panel.sign.guideArrow == "Exit Only" &&
                  !post.secondExitOnly
                  ) {
                      guideArrowsElmt.style.borderTopWidth =
                      resolvedExitOnlyBorderMode === "edge" ? borderWidthValue : "0";
                  }
              
              const isHalfExitOnly = panel.sign.guideArrow == "Half Exit Only";

              const rawHalfExitArrowPosition =
                typeof panel.sign.arrowPosition === "string"
                  ? panel.sign.arrowPosition
                  : "Middle";

              const halfExitRenderPosition =
                rawHalfExitArrowPosition === "Middle" ? "Right" : rawHalfExitArrowPosition;

              const halfExitRenderPositionLower = halfExitRenderPosition.toLowerCase();
              
              if (isHalfExitOnly) {
                  const secondaryContainer = document.createElement("div");
                  secondaryContainer.className = `arrowContainer ${panel.sign.guideArrow
                    .replace("/", "-")
                    .replace(" ", "_")
                    .toLowerCase()} ${halfExitRenderPositionLower}`;
                  applyGuideArrowVerticalSpacing(secondaryContainer);
                  
                  guideArrowsElmt.className += post.secondExitOnly
                  ? " new2"
                  : " default";
                  guideArrowsElmt.classList.remove("halfExitNoBorder");
                  
                  if (!post.secondExitOnly) {
                      const borderMode = resolvedExitOnlyBorderMode;
                      halfExitRenderPositionLower;
                      const overlap = `-${borderWidthValue}`;
                      const touchesLeftEdge =
                        halfExitRenderPositionLower === "left" ||
                        halfExitRenderPositionLower === "middle";

                      const touchesRightEdge =
                        halfExitRenderPositionLower === "right" ||
                        halfExitRenderPositionLower === "middle";
                      
                      secondaryContainer.style.backgroundColor = "var(--yellow)";
                      secondaryContainer.style.color = "var(--black)";
                      secondaryContainer.style.borderStyle = "solid";
                      secondaryContainer.style.borderColor = "var(--black)";
                      secondaryContainer.style.borderTopWidth = "0";
                      secondaryContainer.style.borderRightWidth = "0";
                      secondaryContainer.style.borderBottomWidth = "0";
                      secondaryContainer.style.borderLeftWidth = "0";
                      secondaryContainer.style.marginBottom = "0";
                      secondaryContainer.style.marginLeft = "0";
                      secondaryContainer.style.marginRight = "0";
                      
                      if (borderMode !== "none") {
                          const edges = {
                              top: borderMode === "edge",
                              right: borderMode === "edge",
                              bottom: true,
                              left: borderMode === "edge",
                          };
                          
                          if (borderMode === "white-edge") {
                              edges.top = false;
                              edges.left = touchesLeftEdge;
                              edges.right = touchesRightEdge;
                          }
                          
                          secondaryContainer.style.borderTopWidth = edges.top
                          ? borderWidthValue
                          : "0";
                          secondaryContainer.style.borderRightWidth = edges.right
                          ? borderWidthValue
                          : "0";
                          secondaryContainer.style.borderBottomWidth = edges.bottom
                          ? borderWidthValue
                          : "0";
                          secondaryContainer.style.borderLeftWidth = edges.left
                          ? borderWidthValue
                          : "0";
                          
                          if (edges.bottom) {
                              secondaryContainer.style.marginBottom = overlap;
                          }
                          if (edges.left) {
                              secondaryContainer.style.marginLeft = overlap;
                          }
                          if (edges.right) {
                              secondaryContainer.style.marginRight = overlap;
                          }
                      } else {
                          secondaryContainer.style.borderStyle = "none";
                          const sideOverlap = "-0.02rem";
                          if (touchesLeftEdge) {
                              secondaryContainer.style.marginLeft = sideOverlap;
                          }
                          if (touchesRightEdge) {
                              secondaryContainer.style.marginRight = sideOverlap;
                          }
                          secondaryContainer.style.marginBottom = overlap;
                      }
                      
                      const leftRadius =
                      touchesLeftEdge && borderMode === "none" ? "0.85rem" : "0.75rem";
                      const rightRadius =
                      touchesRightEdge && borderMode === "none" ? "0.85rem" : "0.75rem";
                      secondaryContainer.style.borderBottomLeftRadius = touchesLeftEdge
                      ? leftRadius
                      : "0";
                      secondaryContainer.style.borderBottomRightRadius = touchesRightEdge
                      ? rightRadius
                      : "0";
                      
                      if (borderMode === "none") {
                          secondaryContainer.style.zIndex = "0";
                      } else {
                          secondaryContainer.style.removeProperty("z-index");
                      }
                  }
                  
                  guideArrowsElmt.classList.remove("halfExitNoBorder");
                  path = secondaryContainer;

                  const halfExitGuideLane = document.createElement("div");
                  halfExitGuideLane.className = `arrowContainer halfExitGuideLane ${
                    halfExitRenderPositionLower === "left" ? "right" : "left"
                  }`;
                  applyGuideArrowVerticalSpacing(halfExitGuideLane);

                  const arrow = createArrowElmt(
                    panel.sign.exitguideArrows.split(":")[1],
                    "MainArrows!ExitOnly",
                    "halfarrow",
                    halfExitRenderPositionLower
                  );

                  if (qcExitMarkerMode) {
                    arrow.src = "img/arrows/QC_EXIT_RIGHT.svg";
                    arrow.classList.add("qcExitOnlyArrow");

                    if (String(panel.sign.arrowPosition || "Middle").toLowerCase() === "left") {
                      arrow.classList.add("flipped");
                    }
                  }

                  halfExitGuideLane.appendChild(arrow);

                  if (halfExitRenderPositionLower === "left") {
                    arrowContElmt.appendChild(secondaryContainer);
                    arrowContElmt.appendChild(halfExitGuideLane);
                  } else {
                    arrowContElmt.appendChild(halfExitGuideLane);
                    arrowContElmt.appendChild(secondaryContainer);
                  }

                  applyGuideArrowVerticalSpacing(path);
              } else {
                  path = arrowContElmt;
              }
          }
          
        if ("Side Left" == panel.sign.guideArrow) {
            signElmt.classList.add("hasSideGuideArrow", "hasSideLeftGuideArrow");
            signHolderElmt.classList.add("hasSideGuideArrow", "hasSideLeftGuideArrow");
            sideLeftArrowElmt.style.display = "block";
        } else if ("Side Right" == panel.sign.guideArrow) {
            signElmt.classList.add("hasSideGuideArrow", "hasSideRightGuideArrow");
            signHolderElmt.classList.add("hasSideGuideArrow", "hasSideRightGuideArrow");
            sideRightArrowElmt.style.display = "block";
        } else if ("None" != panel.sign.guideArrow) {
              signElmt.style.borderBottomLeftRadius = "0";
              signElmt.style.borderBottomRightRadius = "0";
              signElmt.style.borderBottomWidth = "0";
              signElmt.style.width = "100%";
              guideArrowsElmt.style.display = "block";
              guideArrowsElmt.style.visibility = "visible";
              if (
                  "Exit Only" == panel.sign.guideArrow ||
                  "Split Exit Only" == panel.sign.guideArrow ||
                  "Half Exit Only" == panel.sign.guideArrow
                  ) {
                      if (
                          post.secondExitOnly == true ||
                          panel.sign.guideArrow == "Half Exit Only"
                          ) {
                              if (panel.sign.guideArrow == "Exit Only") {
                                  guideArrowsElmt.className += " new";
                                  arrowContElmt.className += " new";
                              }
                              if (panel.sign.guideArrow == "Half Exit Only") {
                                  path.classList.add("new2");
                                  arrowContElmt.classList.add("new2", "halfExitWrapper");

                                  arrowContElmt.style.justifyContent = "stretch";
                                  arrowContElmt.style.gap = "0";
                                  arrowContElmt.style.width = "max-content";
                                  arrowContElmt.style.minWidth = "100%";

                                  guideArrowsElmt.style.width = "max-content";
                                  guideArrowsElmt.style.minWidth = "100%";

                                  signCont.style.width = "max-content";
                              }
                              guideArrowsElmt.style.display = "flex";
                          }
                      
                      if (post.secondExitOnly && panel.sign.guideArrow == "Exit Only") {
                          console.log("hi");
                          applyGuideArrowVerticalSpacing(path);
                      }
                      
                      /*
                       
                       if (panel.sign.advisoryMessage) {
                       actionMessageElmt.style.fontFamily = "Series E";
                       }
                       
                       */
                      
                      // Interlase arrows and the words EXIT and ONLY, ensuring
                      //   EXIT ONLY is centered between all the arrows.
                      if (
                          panel.sign.guideArrowLanes == 0 &&
                          panel.sign.advisoryMessage == true
                          ) {
                              const actionMessage = document.createElement("span");
                              actionMessage.className = "exitOnlyText";
                              actionMessage.appendChild(
                                                        document.createTextNode(panel.sign.advisoryText)
                                                        );
                              path.appendChild(actionMessage);
                          } else {
                              
                              const exitOnlyLabelLeft = qcExitMarkerMode
                              ? ""
                              : (typeof panel.sign.exitOnlyLeftText === "string" ? panel.sign.exitOnlyLeftText : "EXIT").trim();
                              
                              const exitOnlyLabelRight = qcExitMarkerMode
                              ? ""
                              : (typeof panel.sign.exitOnlyRightText === "string" ? panel.sign.exitOnlyRightText : "ONLY").trim();
                              
                              const exitOnlyLabelFull = qcExitMarkerMode
                              ? ""
                              : [exitOnlyLabelLeft, exitOnlyLabelRight]
                              .filter((text) => text && text.length > 0)
                              .join(" ")
                              .trim();
                              const isSplitExitOnly = panel.sign.guideArrow == "Split Exit Only";
                              const shouldRenderLabel = (text) =>
                              !(panel.sign.showExitOnly == false &&
                                isSplitExitOnly &&
                                (!text || text.length === 0));
                              for (
                                   let arrowIndex = 0, length = panel.sign.guideArrowLanes;
                                   arrowIndex < length;
                                   arrowIndex++
                                   ) {
                                       // Evens
                                       if (length % 2 == 0) {
                                           if (arrowIndex == Math.floor(length / 2)) {
                                               if (length == 2 && panel.sign.guideArrow == "Exit Only") {
                                               } else {
                                                   if (shouldRenderLabel(exitOnlyLabelFull)) {
                                                       const textExitOnlySpanElmt = document.createElement("span");
                                                       if (panel.sign.showExitOnly == false) {
                                                           textExitOnlySpanElmt.appendChild(
                                                                                            document.createTextNode(exitOnlyLabelFull)
                                                                                            );
                                                           
                                                           var bonus = "";
                                                           
                                                           if (panel.sign.guideArrow == "Split Exit Only") {
                                                               bonus = " yellowElmt";
                                                           }
                                                           
                                                           textExitOnlySpanElmt.className = "exitOnlyText" + bonus;
                                                           applyExitOnlyTextSizing(textExitOnlySpanElmt);
                                                       } else {
                                                           textExitOnlySpanElmt.appendChild(
                                                                                            document.createTextNode("⠀⠀⠀⠀ ⠀⠀⠀⠀")
                                                                                            );
                                                           textExitOnlySpanElmt.className = "exitOnlyText";
                                                           applyExitOnlyTextSizing(textExitOnlySpanElmt);
                                                       }
                                                       path.appendChild(textExitOnlySpanElmt);
                                                   }
                                                   
                                                   if (panel.sign.guideArrow == "Split Exit Only") {
                                                       path.appendChild(
                                                                        createArrowElmt(
                                                                                        panel.sign.exitguideArrows.split(":")[1],
                                                                                        "MainArrows!ExitOnly"
                                                                                        )
                                                                        );
                                                   } else {
                                                       path.appendChild(
                                                                        createArrowElmt(panel.sign.exitguideArrows.split(":")[1])
                                                                        );
                                                   }
                                                   
                                                   if (arrowIndex + 1 < length && length != 2) {
                                                       const space = document.createElement("span");
                                                       space.className = "exitOnlySpace";
                                                       path.appendChild(space);
                                                   }
                                               }
                                           } else if (
                                                      length == 2 &&
                                                      panel.sign.guideArrow == "Exit Only"
                                                      ) {
                                                          let arrowEl1 = createArrowElmt(
                                                                                         panel.sign.exitguideArrows.split(":")[1]
                                                                                         );
                                                          let arrowEl2 = createArrowElmt(
                                                                                         panel.sign.exitguideArrows.split(":")[1]
                                                                                         );
                                                          
                                                          let fullTextEl = null;
                                                          if (shouldRenderLabel(exitOnlyLabelFull)) {
                                                              fullTextEl = document.createElement("span");
                                                              if (panel.sign.showExitOnly == false) {
                                                                  fullTextEl.appendChild(
                                                                                         document.createTextNode(exitOnlyLabelFull)
                                                                                         );
                                                              } else {
                                                                  fullTextEl.appendChild(
                                                                                         document.createTextNode("⠀⠀⠀⠀ ⠀⠀⠀⠀")
                                                                                         );
                                                              }
                                                              fullTextEl.className = "exitOnlyText exitOnlyTextFull";
                                                              applyExitOnlyTextSizing(fullTextEl);
                                                          }
                                                          
                                                          if (arrowEl1) path.appendChild(arrowEl1);
                                                          if (fullTextEl) path.appendChild(fullTextEl);
                                                          if (arrowEl2) path.appendChild(arrowEl2);
                                                          
                                                      } else {
                                                          if (panel.sign.guideArrow == "Split Exit Only") {
                                                              path.appendChild(
                                                                               createArrowElmt(
                                                                                               panel.sign.exitguideArrows.split(":")[1],
                                                                                               "MainArrows!ExitOnly"
                                                                                               )
                                                                               );
                                                          } else {
                                                              path.appendChild(
                                                                               createArrowElmt(panel.sign.exitguideArrows.split(":")[1])
                                                                               );
                                                          }
                                                          
                                                          if (
                                                              arrowIndex + 1 < length &&
                                                              arrowIndex + 1 != Math.ceil(length / 2) &&
                                                              length != 2
                                                              ) {
                                                                  const space = document.createElement("span");
                                                                  space.className = "exitOnlySpace";
                                                                  path.appendChild(space);
                                                              }
                                                      }
                                       } else {
                                           // Odds
                                           if (arrowIndex == Math.floor(length / 2)) {
                                               let leftTextEl = null;
                                               if (shouldRenderLabel(exitOnlyLabelLeft)) {
                                                   leftTextEl = document.createElement("span");
                                                   if (panel.sign.showExitOnly == false) {
                                                       leftTextEl.appendChild(
                                                                              document.createTextNode(exitOnlyLabelLeft)
                                                                              );
                                                       
                                                       var bonus = "";
                                                       
                                                       if (panel.sign.guideArrow == "Split Exit Only") {
                                                           bonus = " yellowElmt";
                                                       }
                                                       
                                                       leftTextEl.className = "exitOnlyText" + bonus;
                                                       applyExitOnlyTextSizing(leftTextEl);
                                                   } else {
                                                       leftTextEl.appendChild(
                                                                              document.createTextNode("⠀⠀⠀⠀")
                                                                              );
                                                       leftTextEl.className = "exitOnlyText";
                                                       applyExitOnlyTextSizing(leftTextEl);
                                                   }
                                               }
                                               
                                               let arrowEl = null;
                                               if (panel.sign.guideArrow == "Split Exit Only") {
                                                   arrowEl = createArrowElmt(
                                                                             panel.sign.exitguideArrows.split(":")[1],
                                                                             "MainArrows!ExitOnly"
                                                                             );
                                               } else {
                                                   arrowEl = createArrowElmt(
                                                                             panel.sign.exitguideArrows.split(":")[1]
                                                                             );
                                               }
                                               
                                               let rightTextEl = null;
                                               if (shouldRenderLabel(exitOnlyLabelRight)) {
                                                   rightTextEl = document.createElement("span");
                                                   if (panel.sign.showExitOnly == false) {
                                                       rightTextEl.appendChild(
                                                                               document.createTextNode(exitOnlyLabelRight)
                                                                               );
                                                       
                                                       var bonus = "";
                                                       
                                                       if (panel.sign.guideArrow == "Split Exit Only") {
                                                           bonus = " yellowElmt";
                                                       }
                                                       
                                                       rightTextEl.className = "exitOnlyText" + bonus;
                                                       applyExitOnlyTextSizing(rightTextEl);
                                                   } else {
                                                       rightTextEl.appendChild(
                                                                               document.createTextNode("⠀⠀⠀⠀")
                                                                               );
                                                       rightTextEl.className = "exitOnlyText";
                                                       applyExitOnlyTextSizing(rightTextEl);
                                                   }
                                               }
                                               
                                               const isExitOnlySingle =
                                                   panel.sign.guideArrow == "Exit Only" && length == 1;

                                               const arrowPos = isExitOnlySingle
                                                   ? (
                                                       qcExitMarkerMode
                                                           ? qcExitArrowSide
                                                           : (panel.sign.arrowPosition || "Middle").toLowerCase()
                                                     )
                                                   : "middle";

                                               if (qcExitMarkerMode && isExitOnlySingle) {
                                                   path.classList.add("qcExitOnlyPath");

                                                   if (arrowPos === "left") {
                                                       path.classList.add("qcExitOnlyPathLeft");
                                                       path.classList.remove("qcExitOnlyPathRight");
                                                   } else {
                                                       path.classList.add("qcExitOnlyPathRight");
                                                       path.classList.remove("qcExitOnlyPathLeft");
                                                   }

                                                   if (arrowEl) {
                                                       arrowEl.classList.toggle("flipped", arrowPos === "left");
                                                       path.appendChild(arrowEl);
                                                   }
                                               } else if (arrowPos === "left") {
                                                   if (arrowEl) path.appendChild(arrowEl);
                                                   if (leftTextEl) path.appendChild(leftTextEl);
                                                   if (rightTextEl) path.appendChild(rightTextEl);
                                               } else if (arrowPos === "right") {
                                                   if (leftTextEl) path.appendChild(leftTextEl);
                                                   if (rightTextEl) path.appendChild(rightTextEl);
                                                   if (arrowEl) path.appendChild(arrowEl);
                                               } else {
                                                   if (leftTextEl) path.appendChild(leftTextEl);
                                                   if (arrowEl) path.appendChild(arrowEl);
                                                   if (rightTextEl) path.appendChild(rightTextEl);
                                               }
                                           } else if (arrowIndex == Math.ceil(length / 2)) {
                                               if (panel.sign.guideArrow == "Split Exit Only") {
                                                   path.appendChild(
                                                                    createArrowElmt(
                                                                                    panel.sign.exitguideArrows.split(":")[1],
                                                                                    "MainArrows!ExitOnly"
                                                                                    )
                                                                    );
                                               } else {
                                                   path.appendChild(
                                                                    createArrowElmt(panel.sign.exitguideArrows.split(":")[1])
                                                                    );
                                               }
                                               
                                               if (
                                                   arrowIndex + 1 < length &&
                                                   arrowIndex + 1 != Math.floor(length / 2) &&
                                                   length != 2
                                                   ) {
                                                       const space = document.createElement("span");
                                                       space.className = "exitOnlySpace";
                                                       path.appendChild(space);
                                                   }
                                           } else {
                                               if (panel.sign.guideArrow == "Split Exit Only") {
                                                   path.appendChild(
                                                                    createArrowElmt(
                                                                                    panel.sign.exitguideArrows.split(":")[1],
                                                                                    "MainArrows!ExitOnly"
                                                                                    )
                                                                    );
                                               } else {
                                                   path.appendChild(
                                                                    createArrowElmt(panel.sign.exitguideArrows.split(":")[1])
                                                                    );
                                               }
                                               
                                               if (
                                                   arrowIndex + 1 < length &&
                                                   arrowIndex + 1 != Math.floor(length / 2) &&
                                                   length != 2
                                                   ) {
                                                       const space = document.createElement("span");
                                                       space.className = "exitOnlySpace";
                                                       path.appendChild(space);
                                                   }
                                           }
                                       }
                                   }
                          }
                  } else {
                      arrowContElmt.classList.remove("hideExitOnlyArrows");
                      guideArrowsElmt.style.paddingTop = resolvedGuideArrowSpacing + "rem";
                      guideArrowsElmt.style.paddingBottom = resolvedGuideArrowSpacing + "rem";
                      for (
                           let arrowIndex = 0, length = panel.sign.guideArrowLanes;
                           arrowIndex < length;
                           arrowIndex++
                           ) {
                               const guideArrowType = panel.sign.guideArrow
                               .split(":")[0]
                               .toLowerCase()
                               .replace(/ /g, "");
                               
                               if (arrowIndex % 2 == 0) {
                                   arrowContElmt.insertBefore(
                                                              createArrowElmt(
                                                                              panel.sign.guideArrow.split(":")[1],
                                                                              "MainArrows",
                                                                              "arrow",
                                                                              guideArrowType
                                                                              ),
                                                              arrowContElmt.childNodes[0]
                                                              );
                               } else {
                                   arrowContElmt.appendChild(
                                                             createArrowElmt(
                                                                             panel.sign.guideArrow.split(":")[1],
                                                                             "MainArrows",
                                                                             "arrow",
                                                                             guideArrowType
                                                                             )
                                                             );
                               }
                           }
                  }
          }

          syncStandardGuideArrowSubpanelWidth();

          // Bottom Symbols
          
          if (panel.sign.oSNum != "" && panel.sign.otherSymbol != "None") {
              signElmt.style.borderBottomLeftRadius = "0";
              signElmt.style.borderBottomRightRadius = "0";
              signElmt.style.borderBottomWidth = "0";
              guideArrowsElmt.style.display = "block";
              guideArrowsElmt.style.visibility = "visible";
              oSNumElmt.style.visibility = "visible";
              oSNumElmt.className = `oSNum`;
              oSNumElmt.appendChild(document.createTextNode(panel.sign.oSNum));
              switch (panel.sign.oSNum.length) {
                  case 1:
                      oSNumElmt.className += " short";
                      break;
                  case 2:
                      oSNumElmt.className += " short";
                      break;
                  case 3:
                      oSNumElmt.className += " three";
                      break;
                  case 5:
                      oSNumElmt.className += " five";
                      break;
                  default:
                      oSNumElmt.className += " three";
                      break;
              }
          } else {
              otherSymbolsElmt.style.display = "none";
          }
          
          switch (panel.sign.otherSymbol) {
              case "Quebec-Style Exit Marker": //Fallthrough
              case "Quebec-Left":
                  const markerElmt = document.createElement("object");
                  markerElmt.className = "markerImg";
                  markerElmt.type = "image/svg+xml";
                  markerElmt.data = "img/other-symbols/QC-Exit.svg";
                  if (panel.sign.otherSymbol == "Quebec-Left") {
                      otherSymbolsElmt.className += " left";
                  }
                  otherSymbolsElmt.appendChild(markerElmt);
              default:
          }
          if (panel.sign.quebecExitMarkerEnabled) {
              const normalizeQuebecMarkerPosition = (value) => {
                  const normalized = String(value || "Center")
                      .replace(/^Bottom\s+/i, "")
                      .trim();

                  if (
                      normalized === "Left" ||
                      normalized === "Center" ||
                      normalized === "Right"
                  ) {
                      return normalized;
                  }

                  return "Center";
              };

              const qcUsesBottomBand =
                  panel.sign.guideArrow === "Exit Only" ||
                  panel.sign.guideArrow === "Half Exit Only" ||
                  panel.sign.guideArrow === "Split Exit Only";

              const qcRawArrowPosition = String(
                  panel.sign.arrowPosition || "Middle"
              ).toLowerCase();

              const qcArrowSide = qcRawArrowPosition === "left" ? "Left" : "Right";

              const qcMarkerPosition = qcUsesBottomBand
                  ? qcArrowSide === "Left"
                      ? "Right"
                      : "Left"
                  : normalizeQuebecMarkerPosition(panel.sign.quebecExitMarkerPosition);

              const qcMarker = document.createElement("div");
              qcMarker.className = "qcExitMarker";
              qcMarker.classList.add(`qc${qcMarkerPosition}`);
              qcMarker.classList.add(qcUsesBottomBand ? "qcInBand" : "qcOnSign");

              const qcMarkerSize = parseFloat(panel.sign.quebecExitMarkerSizeRem);
              const resolvedQcMarkerWidth =
                  Number.isFinite(qcMarkerSize) && qcMarkerSize > 0 ? qcMarkerSize : 3.05;

              const resolvedQcMarkerHeight = resolvedQcMarkerWidth * 0.387;
              const resolvedQcMarkerFontSize = resolvedQcMarkerWidth * 0.33;

              qcMarker.style.setProperty("--qc-marker-width", `${resolvedQcMarkerWidth}rem`);
              qcMarker.style.setProperty("--qc-marker-height", `${resolvedQcMarkerHeight}rem`);
              qcMarker.style.setProperty("--qc-marker-font-size", `${resolvedQcMarkerFontSize}rem`);

              const shouldFlipQcMarker =
                  panel.sign.quebecExitMarkerFlipped ||
                  (qcUsesBottomBand && qcArrowSide === "Left");

              if (shouldFlipQcMarker) {
                  qcMarker.classList.add("flipped");
              }

              const qcImg = document.createElement("img");
              qcImg.className = "qcExitMarkerImg";
              qcImg.src = "img/other-symbols/QC-Exit.svg";
              qcImg.alt = "Quebec exit marker";

              const qcNum = document.createElement("span");
              qcNum.className = "qcExitMarkerNumber";
              qcNum.textContent = String(panel.sign.quebecExitMarkerNumber || "1").trim();

              qcMarker.appendChild(qcImg);
              qcMarker.appendChild(qcNum);

              if (qcUsesBottomBand && path) {
                  guideArrowsElmt.classList.add("qcExitMarkerMode");
                  guideArrowsElmt.classList.add(`qcArrow${qcArrowSide}`);

                  path.classList.add("qcExitOnlyPair");

                  const existingQcArrow = path.querySelector(".qcExitOnlyArrow");

                  if (existingQcArrow) {
                      existingQcArrow.classList.toggle("flipped", qcArrowSide === "Left");

                      if (qcArrowSide === "Left") {
                          path.appendChild(qcMarker);
                      } else {
                          path.insertBefore(qcMarker, existingQcArrow);
                      }
                  } else {
                      path.appendChild(qcMarker);
                  }
              } else {
                  signElmt.appendChild(qcMarker);
              }
          }
          
          // APL Arrows Rendering
          // aplArrows is already defined above
            if (panel.sign.arrowMode === "apl" && aplArrows.length > 0) {
                signElmt.style.removeProperty("border-bottom-width");
                signElmt.style.removeProperty("width");
            }
          
          var width = signCont.clientWidth;
          var exitWidth = firstExitTab.clientWidth;
          
          if (exitWidth > width) {
              signCont.style.width = firstExitTab.clientWidth + "px";
          }
          
          schedulePanelBorderGradientUpdate(panelElmt);
          }
      }
      
      schedulePostViewportLayoutUpdate();
    
    // end of redraw //

  // Expose necessary variables and functions to formHandler
    const exposeToFormHandler = {
        getCurrentPanel,
        getCurrentSubPanel,
        getCurrentBlockRows,
        getCurrentBlockElem,
        getPost: () => post,
        getCurrentStackedPanelInfo,
        setStackedPanelSpacing,
        setStackedPanelMatchWidth,
        checkSpecialShield,
        redraw,
        setSelectedRow,
        setSelectedControlElem,
        setSelectedRowAndBlock,
        replaceControlElemTypeAt,
        beginUndoableChange,
        endUndoableChange,
        undo,

        moveControlElem: (...args) => runWithUndo(() => moveControlElem(...args)),
        moveRow: (...args) => runWithUndo(() => moveRow(...args)),
        changeEditingPanel,
        movePanel: (...args) => runWithUndo(() => movePanel(...args)),
        newPanel: (...args) => runWithUndo(() => newPanel(...args)),
        duplicatePanel: (...args) => runWithUndo(() => duplicatePanel(...args)),
        deletePanel: (...args) => runWithUndo(() => deletePanel(...args)),
        togglePanelHidden,
        changeEditingSubPanel,
        addSubPanel: (...args) => runWithUndo(() => addSubPanel(...args)),
        removeSubPanel: (...args) => runWithUndo(() => removeSubPanel(...args)),
        duplicateSubPanel: (...args) => runWithUndo(() => duplicateSubPanel(...args)),
        changeEditingExitTab,
        newExitTab: (...args) => runWithUndo(() => newExitTab(...args)),
        duplicateExitTab: (...args) => runWithUndo(() => duplicateExitTab(...args)),
        removeExitTab: removeSubPanel,
        moveExitTab: (...args) => runWithUndo(() => moveExitTab(...args)),
        newNestExitTab: (...args) => runWithUndo(() => newNestExitTab(...args)),
        deleteNestExitTab: (...args) => runWithUndo(() => deleteNestExitTab(...args)),
        setPanelSpacing: setPanelSpacing,
        setSubpanelDividerVisible,
        isSubpanelDividerVisible,
        getAPLSubpanelGroups: getAPLSubpanelGroupsForCurrentPanel,
        duplicateBlockIntoNewRow: (...args) =>
        runWithUndo(() => duplicateBlockIntoNewRow(...args)),
        deleteShield: (...args) => runWithUndo(() => deleteShield(...args)),
        duplicateShield: (...args) => runWithUndo(() => duplicateShield(...args)),
        addAPLArrow: (...args) => runWithUndo(() => addAPLArrow(...args)),
        removeAPLArrow: (...args) => runWithUndo(() => removeAPLArrow(...args)),
        selectAPLArrow,
        updateAPLArrowType: (...args) => runWithUndo(() => updateAPLArrowType(...args)),
        toggleAPLArrowFlip: (...args) => runWithUndo(() => toggleAPLArrowFlip(...args)),
        addAPLDivider: (...args) => runWithUndo(() => addAPLDivider(...args)),
        setAPLGroupedWithDivider: () => {},
        setAPLExitOnly,
        setAPLArrowSpacing,
        setAPLArrowBeforeSpacing,
        setAPLArrowSize,
        moveAPLArrow,
        removeAPLArrowAt,
        initializeAPLArrowsForCurrentPanel,
        setCurrentPanelArrowMode,
        addAPLSubPanelLeftAndOpen,
        addAPLSubPanelRightAndOpen,
      vars: {
        get currentlySelectedPanelIndex() {
          return currentlySelectedPanelIndex;
        },
        get currentlySelectedSubPanelIndex() {
          return currentlySelectedSubPanelIndex;
        },
        get currentlySelectedExitTabIndex() {
          return currentlySelectedExitTabIndex;
        },
        get currentlySelectedNestedExitTabIndex() {
          return currentlySelectedNestedExitTabIndex;
        },
        get currentlySelectedRowIndex() {
          return currentlySelectedRowIndex;
        },
        get currentlySelectedBlockIndex() {
          return currentlySelectedBlockIndex;
        },
        get currentlySelectedAPLArrowIndex() {
          return currentlySelectedAPLArrowIndex;
        },
      },
    };
    
  const getPost = function () {
    return post;
  };

  const setPost = function (newPost) {
    post = newPost;
    if (!post) {
      return;
    }
    if (typeof post.panelSpacing !== "number" || post.panelSpacing < 0) {
      post.panelSpacing = 0;
    }
    post.thickness = post.normalizeThickness(post.thickness);
    currentlySelectedPanelIndex = 0;
    formHandler.updateForm();
    redraw();
      saveAppState();
  };

  // Template management functions
  let templateDB = null;
  const TEMPLATE_LOAD_WARNING_STORAGE_KEY = "signMaker.templateLoadWarning";

  const initTemplateDB = async function () {
    if (!templateDB) {
      templateDB = new IndexDB();
      await templateDB.dbInitialized;
    }
    return templateDB;
  };

  const getTemplateLoadWarningEnabled = function () {
    try {
      return window.localStorage.getItem(TEMPLATE_LOAD_WARNING_STORAGE_KEY) === "true";
    } catch (error) {
      return false;
    }
  };

  const setTemplateLoadWarningEnabled = function (enabled) {
    try {
      window.localStorage.setItem(
        TEMPLATE_LOAD_WARNING_STORAGE_KEY,
        enabled ? "true" : "false"
      );
    } catch (error) {
      console.warn("Unable to save template load warning setting", error);
    }
  };

  const addTemplateElementTypes = (obj, visited = new WeakSet()) => {
    if (!obj || typeof obj !== "object" || visited.has(obj)) {
      return;
    }

    visited.add(obj);

    if (Array.isArray(obj)) {
      obj.forEach((item) => addTemplateElementTypes(item, visited));
      return;
    }

    if (Control.prototype.blockToClassElems) {
      try {
        const elemType = Control.prototype.blockToClassElems.getElem?.(obj);
        if (elemType) {
          obj._elementType = elemType;
        }
      } catch (error) {
        // Not a block element instance.
      }
    }

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key) && key !== "_elementType") {
        addTemplateElementTypes(obj[key], visited);
      }
    }
  };

  const removeTemplateElementTypes = (obj, visited = new WeakSet()) => {
    if (!obj || typeof obj !== "object" || visited.has(obj)) {
      return;
    }

    visited.add(obj);

    if (Array.isArray(obj)) {
      obj.forEach((item) => removeTemplateElementTypes(item, visited));
      return;
    }

    if (obj._elementType) {
      delete obj._elementType;
    }

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        removeTemplateElementTypes(obj[key], visited);
      }
    }
  };

  const serializeTemplateData = function (scope = "post") {
    if (!post || !Array.isArray(post.panels) || post.panels.length === 0) {
      throw new Error("There is no sign to save.");
    }

    addTemplateElementTypes(post);

    let snapshot;
    try {
      snapshot = JSON.parse(JSON.stringify(post));
    } finally {
      removeTemplateElementTypes(post);
    }

    if (scope === "panel") {
      const selectedPanel = snapshot.panels?.[currentlySelectedPanelIndex];
      if (!selectedPanel) {
        throw new Error("There is no selected panel to save.");
      }

      snapshot.panels = [selectedPanel];
    }

    return JSON.stringify(snapshot, null, 2);
  };

  const getTemplatePanelsFromData = function (template) {
    if (!template || typeof template.data !== "string") {
      return [];
    }

    const parsedPostData = JSON.parse(template.data);
    const rebuiltPost = reconstructPostFromSnapshot(parsedPostData);

    if (!rebuiltPost || !Array.isArray(rebuiltPost.panels)) {
      return [];
    }

    return rebuiltPost.panels;
  };

  const getTemplatePostFromData = function (template) {
    if (!template || typeof template.data !== "string") {
      return null;
    }

    const parsedPostData = JSON.parse(template.data);
    return reconstructPostFromSnapshot(parsedPostData);
  };

  const saveTemplate = async function (templateName, scope = "post") {
    if (!templateName || templateName.trim() === "") {
      alert("Please enter a template name");
      return;
    }

    try {
      const db = await initTemplateDB();
      const normalizedScope = scope === "panel" ? "panel" : "post";
      const postData = serializeTemplateData(normalizedScope);

      const templateData = {
        name: templateName.trim(),
        data: postData,
        templateScope: normalizedScope,
        dateCreated: new Date().toISOString(),
        dateModified: new Date().toISOString(),
      };

      await db.saveTemplate(templateData);

      const templateNameInput = document.getElementById("templateNameInput");
      if (templateNameInput) {
        templateNameInput.value = "";
      }

      await refreshTemplatesList();
    } catch (error) {
      console.error("Error saving template:", error);
      alert("Failed to save template: " + error.message);
    }
  };

  const savePanelTemplate = function (templateName) {
    return saveTemplate(templateName, "panel");
  };

  const savePostTemplate = function (templateName) {
    return saveTemplate(templateName, "post");
  };

  const normalizeTemplateLoadMode = (mode) => {
    const normalized = String(mode || "replace-post").toLowerCase();
    if (normalized === "replace-panel" || normalized === "add") {
      return normalized;
    }
    return "replace-post";
  };

  const getTemplateLoadConfirmationMessage = (mode) => {
    if (mode === "replace-panel") {
      return "Are you sure you want to load this template? THIS WILL REPLACE THE SELECTED PANEL!";
    }

    return "Are you sure you want to load this template? THIS WILL REPLACE YOUR CURRENT SIGN!";
  };

  const loadTemplate = async function (templateId, mode = "replace-post") {
    if (!templateId) {
      return;
    }

    const loadMode = normalizeTemplateLoadMode(mode);

    if (
      loadMode !== "add" &&
      getTemplateLoadWarningEnabled() &&
      !window.confirm(getTemplateLoadConfirmationMessage(loadMode))
    ) {
      return;
    }

    try {
      const db = await initTemplateDB();
      const template = await db.getTemplate(templateId);

      if (!template) {
        alert("Template not found");
        return;
      }

      if (loadMode === "replace-post") {
        const newPost = getTemplatePostFromData(template);

        if (!newPost) {
          alert("Template could not be loaded.");
          return;
        }

        beginUndoableChange();
        post = newPost;
        normalizeSelectionForCurrentPost();
        currentlySelectedPanelIndex = 0;
        currentlySelectedSubPanelIndex = 0;
        currentlySelectedRowIndex = 0;
        currentlySelectedBlockIndex = 0;
        formHandler.updateForm();
        redraw();
        endUndoableChange();
        return;
      }

      const templatePanels = getTemplatePanelsFromData(template);

      if (!templatePanels.length) {
        alert("Template does not contain any panels.");
        return;
      }

      beginUndoableChange();

      const selectedIndex = clamp(
        currentlySelectedPanelIndex,
        0,
        Math.max(0, post.panels.length - 1)
      );

      if (loadMode === "replace-panel") {
        post.panels.splice(selectedIndex, 1, ...templatePanels);
        currentlySelectedPanelIndex = selectedIndex;
      } else {
        post.panels.splice(selectedIndex + 1, 0, ...templatePanels);
        currentlySelectedPanelIndex = selectedIndex + 1;
      }

      normalizeSelectionForCurrentPost();
      currentlySelectedSubPanelIndex = 0;
      currentlySelectedRowIndex = 0;
      currentlySelectedBlockIndex = 0;
      formHandler.updateForm();
      redraw();
      endUndoableChange();
    } catch (error) {
      console.error("Error loading template:", error);
      alert("Failed to load template: " + error.message);
      endUndoableChange();
    }
  };

  const renameTemplate = async function (templateId) {
    if (!templateId) {
      return;
    }

    try {
      const db = await initTemplateDB();
      const template = await db.getTemplate(templateId);

      if (!template) {
        alert("Template not found");
        return;
      }

      const newName = window.prompt("Rename template:", template.name || "");

      if (newName === null) {
        return;
      }

      const trimmedName = newName.trim();
      if (!trimmedName) {
        alert("Please enter a template name");
        return;
      }

      const renamedTemplate = {
        ...template,
        name: trimmedName,
        dateModified: new Date().toISOString(),
      };

      if (typeof db.updateTemplate === "function") {
        await db.updateTemplate(templateId, renamedTemplate);
      } else {
        await db.saveTemplate(renamedTemplate);
      }

      await refreshTemplatesList();
    } catch (error) {
      console.error("Error renaming template:", error);
      alert("Failed to rename template: " + error.message);
    }
  };

  const deleteTemplate = async function (templateId) {
    if (!templateId) {
      return;
    }

    try {
      const db = await initTemplateDB();
      await db.deleteTemplate(templateId);
      await refreshTemplatesList();
    } catch (error) {
      console.error("Error deleting template:", error);
      alert("Failed to delete template: " + error.message);
    }
  };

  const getTemplateSearchValue = function () {
    const searchInput = document.getElementById("templateSearchInput");
    return String(searchInput?.value || "").trim().toLowerCase();
  };

  const getTemplateSortMode = function () {
    const sortSelect = document.getElementById("templateSortSelect");
    return sortSelect?.value === "alphabetical" ? "alphabetical" : "date-created";
  };

  const refreshTemplatesList = async function () {
    try {
      const db = await initTemplateDB();
      let templates = await db.getAllTemplates();

      const templatesList = document.getElementById("savedTemplatesList");
      if (!templatesList) {
        return;
      }

      templatesList.innerHTML = "";

      const searchValue = getTemplateSearchValue();
      if (searchValue) {
        templates = templates.filter((template) =>
          String(template.name || "").toLowerCase().includes(searchValue)
        );
      }

      const sortMode = getTemplateSortMode();
      if (sortMode === "alphabetical") {
        templates.sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || ""), undefined, {
            sensitivity: "base",
            numeric: true,
          })
        );
      } else {
        templates.sort((a, b) => {
          const dateA = new Date(a.dateCreated || a.dateModified || 0);
          const dateB = new Date(b.dateCreated || b.dateModified || 0);
          return dateB - dateA;
        });
      }

      if (templates.length === 0) {
        templatesList.innerHTML = `<p class="templateEmptyMessage">${
          searchValue ? "No saved templates match your search" : "No saved templates"
        }</p>`;
        return;
      }

      templates.forEach((template) => {
        const escapedId = escapeHtml(template.id);
        const templateItem = document.createElement("div");
        templateItem.className = "templateItem";
        templateItem.innerHTML = `
          <div class="templateItemInfo">
            <div class="templateNameRow">
              <span class="templateItemName">${escapeHtml(template.name)}</span>
              <button class="templateRenameBtn" onclick="app.renameTemplate('${escapedId}')" title="Rename Template" aria-label="Rename Template">
                <span class="material-symbols-outlined">edit</span>
              </button>
            </div>
            <span class="templateItemDate">${formatDate(template.dateCreated || template.dateModified)}</span>
          </div>
          <div class="templateItemActions">
            <button class="templateLoadBtn templateLoadPostBtn" onclick="app.loadTemplate('${escapedId}', 'replace-post')" title="Replace Post">
              <span class="material-symbols-outlined">upload</span>
              <span>Replace Post</span>
            </button>
            <button class="templateLoadBtn templateLoadPanelBtn" onclick="app.loadTemplate('${escapedId}', 'replace-panel')" title="Replace Panel">
              <span class="material-symbols-outlined">move_down</span>
              <span>Replace Panel</span>
            </button>
            <button class="templateLoadBtn templateAddBtn" onclick="app.loadTemplate('${escapedId}', 'add')" title="Add Template After Selected Panel">
              <span class="material-symbols-outlined">add</span>
              <span>Add</span>
            </button>
            <button class="templateDeleteBtn" onclick="app.deleteTemplate('${escapedId}')" title="Delete Template" aria-label="Delete Template">
              <span class="material-symbols-outlined">delete</span>
            </button>
          </div>
        `;
        templatesList.appendChild(templateItem);
      });
    } catch (error) {
      console.error("Error refreshing templates list:", error);
    }
  };

  const escapeHtml = function (text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  };

  const formatDate = function (dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

    return {
        init: init,
        newPanel: (...args) => runWithUndo(() => newPanel(...args)),
        duplicatePanel: (...args) => runWithUndo(() => duplicatePanel(...args)),
        deletePanel: (...args) => runWithUndo(() => deletePanel(...args)),
        deletePanelAt: deletePanelAt,
        togglePanelHidden: togglePanelHidden,
        shiftLeft: shiftLeft,
        shiftRight: shiftRight,
        movePanel: (...args) => runWithUndo(() => movePanel(...args)),
        changeEditingPanel: changeEditingPanel,
        setPanelSpacing: (...args) => runWithUndo(() => setPanelSpacing(...args)),
        setSubpanelDividerVisible,
        isSubpanelDividerVisible,
        getAPLSubpanelGroups: getAPLSubpanelGroupsForCurrentPanel,
        newShield: (...args) => runWithUndo(() => newShield(...args)),
        clearShields: (...args) => runWithUndo(() => clearShields(...args)),
        newSubPanel: (...args) => runWithUndo(() => addSubPanel(...args)),
        removeSubPanel: (...args) => runWithUndo(() => removeSubPanel(...args)),
        changeEditingSubPanel: changeEditingSubPanel,
        duplicateSubPanel: (...args) => runWithUndo(() => duplicateSubPanel(...args)),
        downloadPNGSign: downloadPNGSign,
        downloadSVGSign: downloadSVGSign,
        updatePreview: updatePreview,
        resetPadding: (...args) => runWithUndo(() => resetPadding(...args)),
        duplicateControlElem: (...args) => runWithUndo(() => duplicateControlElem(...args)),
        applyTemplate: (...args) => runWithUndo(() => applyTemplate(...args)),
        newExitTab: (...args) => runWithUndo(() => newExitTab(...args)),
        duplicateExitTab: (...args) => runWithUndo(() => duplicateExitTab(...args)),
        removeExitTab: (...args) => runWithUndo(() => removeExitTab(...args)),
        moveExitTab: (...args) => runWithUndo(() => moveExitTab(...args)),
        changeEditingExitTab: changeEditingExitTab,
        newNestExitTab: (...args) => runWithUndo(() => newNestExitTab(...args)),
        deleteNestExitTab: (...args) => runWithUndo(() => deleteNestExitTab(...args)),
        getPost: getPost,
        setPost: setPost,
        post: post,

        newRow: (...args) => runWithUndo(() => newRow(...args)),
        dupRow: (...args) => runWithUndo(() => dupRow(...args)),
        delRow: (...args) => runWithUndo(() => delRow(...args)),
        newControlElem: (...args) => runWithUndo(() => newControlElem(...args)),
        delControlElem: (...args) => runWithUndo(() => delControlElem(...args)),
        clearAll: clearAll,
        saveTemplate: saveTemplate,
        savePanelTemplate: savePanelTemplate,
        savePostTemplate: savePostTemplate,
        loadTemplate: loadTemplate,
        renameTemplate: renameTemplate,
        deleteTemplate: deleteTemplate,
        refreshTemplatesList: refreshTemplatesList,
        setTemplateLoadWarningEnabled: setTemplateLoadWarningEnabled,

        undo,
        redo,
        
        setSelectedRowAndBlock,

        exposeToFormHandler,
        
        createPanelRightOfSelected,
        createPanelLeftOfSelected,
        createStackedPanelBelowSelected,
        changeEditingStackedPanelSlot,
        removeStackedPanelSlot,
        setStackedPanelSpacing,
        setStackedPanelMatchWidth,
        createSubPanelRightOfSelected,
        createSubPanelLeftOfSelected,
        createRowBelowSelected,
        createRowAboveSelected,
        selectNextPanel,
        selectPreviousPanel,
        selectNextSubPanel,
        selectPreviousSubPanel,
        selectNextRow,
        selectPreviousRow,
        deleteCurrentPanelShortcut,
        deleteCurrentSubPanelShortcut,
        deleteCurrentRowShortcut,
    };
})();
