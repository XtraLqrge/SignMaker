const app = (function () {
  let post = {};
  let currentlySelectedPanelIndex = -1;
  let currentlySelectedSubPanelIndex = 0;
  let currentlySelectedExitTabIndex = 0;
  let currentlySelectedNestedExitTabIndex = -1;

  let currentlySelectedRowIndex = 0,
    currentlySelectedBlockIndex = 0;
  let currentlyEditingGroupPath = [];
  let controlElemClipboardRows = [];

  let fileInfo = {
    fileType: "png",
    panel: -1,
    // Panels chosen in the export dialog when not exporting the entire post.
    panels: [0],
  };

  let currentlySelectedAPLArrowIndex = 0;
  const SESSION_STORAGE_KEY = "signMaker.session";
  const RESTORE_ON_REFRESH_STORAGE_KEY = "signMaker.restoreOnRefresh";
  const SESSION_DB_NAME = "signMaker.session";
  const SESSION_DB_STORE = "session";
  const SESSION_STORAGE_VERSION = 2;
  // Exit Only arrow padding a new sign starts with (rem on every side).
  const EXIT_ONLY_DEFAULT_PADDING = 0.25;
  let isSessionPersisting = false;
  const HISTORY_LIMIT = 100;
  const undoHistory = [];
  const redoHistory = [];
  let lastHistoryEntry = null;
  let isApplyingHistory = false;
  const EXIT_TAB_APL_EDGE_WIDTH = "APL Edge";

  const isAplEdgeExitTabWidth = (width) =>
    String(width || "").trim().toLowerCase() ===
    EXIT_TAB_APL_EDGE_WIDTH.toLowerCase();

  const GUIDE_ARROW_ASPECT_RATIOS = Object.freeze({
    TYPE_A: 2667 / 4188,
    TYPE_A_EXTENDED: 3405 / 7346,
    TYPE_B: 11937 / 13642,
    TYPE_C_45: 22103 / 35195,
    TYPE_C_45_ALT: 2863 / 3007,
    TYPE_C_90: 13398 / 13416,
    TYPE_D: 641 / 1044,
    DOWN: 6667 / 4584,
    DOWN_CA: 2848 / 1676,
    UK: 4954 / 12396,
    APL_UP: 537 / 1675,
    APL_UP_TURN: 1418 / 1678,
    APL_TURN: 1081 / 1347,
    APL_DUAL_TURN: 2267 / 1794,
    APL_UP_CFX: 311 / 752,
    APL_UP_TURN_CFX: 640 / 752,
    APL_TURN_CFX: 502 / 501,
  });

  const reserveRotatedGuideArrowSpace = function (
    element,
    arrowKind,
    rotation,
    { width = null, height = null } = {}
  ) {
    if (!element) {
      return;
    }

    const aspectRatio = GUIDE_ARROW_ASPECT_RATIOS[arrowKind] || 1;
    const resolvedWidth = Number.isFinite(width)
      ? Math.max(width, 0)
      : Math.max((Number.isFinite(height) ? height : 0) * aspectRatio, 0);
    const resolvedHeight = Number.isFinite(height)
      ? Math.max(height, 0)
      : Math.max(resolvedWidth / aspectRatio, 0);
    const parsedRotation = parseFloat(rotation);
    const radians =
      ((Number.isFinite(parsedRotation) ? parsedRotation : 0) * Math.PI) / 180;
    const rotatedWidth =
      Math.abs(resolvedWidth * Math.cos(radians)) +
      Math.abs(resolvedHeight * Math.sin(radians));
    const rotatedHeight =
      Math.abs(resolvedWidth * Math.sin(radians)) +
      Math.abs(resolvedHeight * Math.cos(radians));

    element.classList.add("guideArrowAsset");
    element.style.width = rotatedWidth + "rem";
    element.style.height = rotatedHeight + "rem";
  };

  const getCurrentPanel = () => {
    return post.panels[currentlySelectedPanelIndex];
  };

  const canUseAplEdgeExitTab = (panel = getCurrentPanel()) =>
    !!(
      panel &&
      panel.sign &&
      Array.isArray(panel.sign.subPanels) &&
      panel.sign.subPanels.length > 1
    );

  const normalizeExitTabAplEdgeAvailabilityForPanel = (panel) => {
    if (!panel || !Array.isArray(panel.exitTabs) || canUseAplEdgeExitTab(panel)) {
      return false;
    }

    let changed = false;
    const normalizeTab = (tab) => {
      if (tab && isAplEdgeExitTabWidth(tab.width)) {
        tab.width = "Edge";
        changed = true;
      }
    };

    panel.exitTabs.forEach((tab) => {
      normalizeTab(tab);
      if (Array.isArray(tab?.nestedExitTabs)) {
        tab.nestedExitTabs.forEach(normalizeTab);
      }
    });

    return changed;
  };

  const getAplEdgeDividerForExitTab = (sign, position = "Right") => {
    const dividerCount = Math.max(0, sign?.subPanels?.length - 1);
    if (!dividerCount) {
      return null;
    }

    return String(position || "Right").toLowerCase() === "left"
      ? 0
      : dividerCount - 1;
  };

  const getCurrentSubPanel = () => {
    return getCurrentPanel().sign.subPanels[currentlySelectedSubPanelIndex];
  };

  const getActiveGroupContext = () => {
    const subPanel = getCurrentSubPanel();
    let control = subPanel && subPanel.blockElements;
    let groupElement = null;
    const normalizedPath = [];

    if (!control || !Array.isArray(control.rows)) {
      currentlyEditingGroupPath = [];
      return { control, groupElement, path: normalizedPath };
    }

    for (const segment of currentlyEditingGroupPath) {
      if (!segment || typeof segment !== "object") {
        break;
      }

      const rowIndex = clamp(
        Number(segment.rowIndex),
        0,
        Math.max(0, control.rows.length - 1)
      );
      const row = control.rows[rowIndex];
      if (!Array.isArray(row) || !row.length) {
        break;
      }

      const blockIndex = clamp(
        Number(segment.blockIndex),
        0,
        Math.max(0, row.length - 1)
      );
      const candidate = row[blockIndex];
      if (!(candidate instanceof GroupedBlockElement)) {
        break;
      }

      normalizedPath.push({ rowIndex, blockIndex });
      groupElement = candidate;
      control = candidate.blockElements;
      if (!control || !Array.isArray(control.rows)) {
        break;
      }
    }

    if (normalizedPath.length !== currentlyEditingGroupPath.length) {
      currentlyEditingGroupPath = normalizedPath;
    }

    return { control, groupElement, path: normalizedPath };
  };

  const getActiveBlockElements = () => {
    const context = getActiveGroupContext();
    const subPanel = getCurrentSubPanel();
    return context.control || (subPanel && subPanel.blockElements) || new Control();
  };

  const getActiveGroupElement = () => getActiveGroupContext().groupElement;

  const getCurrentBlockRows = () => {
    return getActiveBlockElements().rows[currentlySelectedRowIndex] || [];
  };

  const getCurrentBlockElem = () => {
    return getCurrentBlockRows()[currentlySelectedBlockIndex];
  };

  const clamp = (number, min, max) => Math.max(min, Math.min(number, max));
  const clampFinite = (value, min, max, fallback = min) => {
    const number = Number(value);
    return clamp(Number.isFinite(number) ? number : fallback, min, max);
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
  // v2.19 stacked panels: a panel marked stackedWithPrevious joins the group
  // of the panel before it and is drawn above or below that group's main
  // panel. The main panel holds the group's spacing and match-width settings.
  const isStackedPanelBottom = (panelIndex) =>
    panelIndex > 0 && post?.panels?.[panelIndex]?.stackedWithPrevious === true;
  const getStackedPanelTopIndex = (panelIndex = currentlySelectedPanelIndex) => {
    let topIndex = clamp(panelIndex, 0, Math.max(0, post.panels.length - 1));
    while (isStackedPanelBottom(topIndex)) {
      topIndex--;
    }
    return topIndex;
  };
  const getStackedPanelGroupIndices = (panelIndex = currentlySelectedPanelIndex) => {
    const topIndex = getStackedPanelTopIndex(panelIndex);
    const indices = [topIndex];
    while (isStackedPanelBottom(indices[indices.length - 1] + 1)) {
      indices.push(indices[indices.length - 1] + 1);
    }
    return indices;
  };
  const isStackedPanelAboveMain = (panelIndex) =>
    isStackedPanelBottom(panelIndex) &&
    post.panels[panelIndex].stackedPanelPlacement === "above";
  // Group indices from top to bottom as drawn.
  const getStackedPanelVerticalOrder = (panelIndex = currentlySelectedPanelIndex) => {
    const [topIndex, ...additional] = getStackedPanelGroupIndices(panelIndex);
    return [
      ...additional.filter(isStackedPanelAboveMain),
      topIndex,
      ...additional.filter((index) => !isStackedPanelAboveMain(index)),
    ];
  };
  const normalizeStackedPanelSpacing = (value) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? Math.max(-4, Math.min(4, parsed)) : 0;
  };
  // Hiding a main panel hides its whole stack.
  const isPanelHiddenFromPost = (panelIndex) =>
    post.panels[panelIndex]?.hiddenFromPost === true ||
    (isStackedPanelBottom(panelIndex) &&
      post.panels[getStackedPanelTopIndex(panelIndex)]?.hiddenFromPost === true);
  // Panels are numbered by group; additional panels get letters top to bottom (1A, 1B).
  const getPanelDisplayLabel = (panelIndex) => {
    const topIndex = getStackedPanelTopIndex(panelIndex);
    let number = 0;
    for (let index = 0; index <= topIndex; index++) {
      if (!isStackedPanelBottom(index)) number++;
    }
    if (panelIndex === topIndex) {
      return String(number);
    }
    const order = getStackedPanelVerticalOrder(topIndex).filter((index) => index !== topIndex);
    return number + String.fromCharCode(65 + order.indexOf(panelIndex));
  };
  const getCurrentStackedPanelInfo = () => {
    const topIndex = getStackedPanelTopIndex(currentlySelectedPanelIndex);
    const topPanel = post.panels[topIndex];
    return {
      topIndex,
      selectedIndex: currentlySelectedPanelIndex,
      additional: getStackedPanelVerticalOrder(topIndex)
        .filter((index) => index !== topIndex)
        .map((index) => ({ index, label: getPanelDisplayLabel(index) })),
      spacing: normalizeStackedPanelSpacing(topPanel?.stackedPanelSpacing),
      matchWidth: topPanel?.stackedPanelMatchWidth === true,
    };
  };
  const clearPanelStacking = (panel) => {
    if (!panel) return;
    panel.stackedWithPrevious = false;
    delete panel.stackedPanelPlacement;
  };
  // v2.2's "Vertical panels" option becomes one stack of every panel.
  const migrateVerticalPanelOrientation = (targetPost) => {
    if (targetPost.panelOrientation === "Vertical" && targetPost.panels.length > 1) {
      targetPost.panels.forEach((panel, index) => {
        if (index > 0) {
          panel.stackedWithPrevious = true;
          panel.stackedPanelPlacement = "below";
        }
      });
      targetPost.panels[0].stackedPanelSpacing =
        normalizeStackedPanelSpacing(targetPost.panelSpacing);
    }
    targetPost.panelOrientation = "Horizontal";
  };

  const normalizeSignAlignment = (value) => {
    if (post && typeof post.normalizeSignAlignment === "function") {
      return post.normalizeSignAlignment(value);
    }
    return value === "Top" || value === "Bottom" ? value : "Center";
  };
  const getSignAlignmentFlexValue = (value) => {
    const normalized = normalizeSignAlignment(value);
    if (normalized === "Top") {
      return "flex-start";
    }
    if (normalized === "Bottom") {
      return "flex-end";
    }
    return "center";
  };
  const resetGroupEditing = () => {
    currentlyEditingGroupPath = [];
  };
  const FHWA_BASELINE_OFFSET_VAR = "var(--fhwaBaselineShift)";
  const FHWA_EXIT_TAB_FONT_SCALE = 1.5;
  const applyHighwayGothicStyling = (element, fontFamily = "Series E") => {
    if (!element) {
      return;
    }
    element.style.fontFamily = fontFamily;
    element.style.setProperty("--fhwaBaselineOffset", FHWA_BASELINE_OFFSET_VAR);
  };
  const applyPanelBorderGradient = (signElmt) => {
    if (!signElmt || !signElmt.isConnected) {
      return;
    }

    const computed = window.getComputedStyle(signElmt);
    const defaultBorderColor =
      computed.borderTopColor ||
      computed.borderColor ||
      (lib.colors && lib.colors.White) ||
      "rgb(255, 255, 255)";
    const borderWidth = parseFloat(computed.borderTopWidth) || 0;
    const borderTopWidth = parseFloat(computed.borderTopWidth) || borderWidth;
    const borderRightWidth =
      parseFloat(computed.borderRightWidth) || borderWidth;
    const borderBottomWidth =
      parseFloat(computed.borderBottomWidth) || borderWidth;
    const borderLeftWidth = parseFloat(computed.borderLeftWidth) || borderWidth;
    const fillColor =
      computed.backgroundColor && computed.backgroundColor !== "rgba(0, 0, 0, 0)"
        ? computed.backgroundColor
        : "transparent";
    const overlayHost = signElmt.parentElement || signElmt;

    const clearDynamicBorder = () => {
      signElmt.querySelectorAll(".fullBleedBorderOverlay").forEach((overlay) => {
        overlay.remove();
      });
      if (overlayHost !== signElmt) {
        overlayHost
          .querySelectorAll(":scope > .fullBleedBorderOverlay")
          .forEach((overlay) => {
            overlay.remove();
          });
      }
      signElmt.style.removeProperty("backgroundImage");
      signElmt.style.removeProperty("backgroundOrigin");
      signElmt.style.removeProperty("backgroundClip");
      signElmt.style.removeProperty("backgroundRepeat");
      signElmt.style.removeProperty("backgroundPosition");
      signElmt.style.removeProperty("borderColor");
    };

    const fullBleedRows = signElmt.querySelectorAll(
      ".blockElementRow[data-full-bleed-border-color]"
    );

    if (!fullBleedRows.length) {
      clearDynamicBorder();
      return;
    }

    const signRect = signElmt.getBoundingClientRect();
    const overlayHostRect = overlayHost.getBoundingClientRect();
    const signHeight = signRect.height;
    const signWidth = signRect.width;
    if (!signHeight || !signWidth || !overlayHostRect.width) {
      clearDynamicBorder();
      return;
    }

    const subPanelCount = Array.from(
      signElmt.querySelectorAll(".subPanelDisplay")
    ).reduce((count, subPanelEl) => {
      const renderedCount = parseInt(subPanelEl.dataset.subpanelCount, 10);
      return Number.isFinite(renderedCount) && renderedCount > count
        ? renderedCount
        : count;
    }, 0);

    const multiSubPanelSign = subPanelCount > 1;
    if (multiSubPanelSign) {
      clearDynamicBorder();

      const parseRadius = (radiusValue) => {
        const parsed = parseFloat(radiusValue);
        return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
      };
      const radius = {
        topLeft: parseRadius(computed.borderTopLeftRadius),
        topRight: parseRadius(computed.borderTopRightRadius),
        bottomRight: parseRadius(computed.borderBottomRightRadius),
        bottomLeft: parseRadius(computed.borderBottomLeftRadius),
      };
      const overlayEdgeThreshold = 1;
      const signInnerHeight =
        signElmt.clientHeight ||
        Math.max(0, signHeight - borderTopWidth - borderBottomWidth);
      const normalizeColor = (color) =>
        typeof color === "string" ? color.trim().toLowerCase() : "";
      const getHorizontalDivider = (rowEl) =>
        rowEl?.querySelector(".dividerElement.fullBleed:not(.vertical)") ||
        null;
      const getHorizontalDividerColor = (rowEl) => {
        const dividerEl = getHorizontalDivider(rowEl);
        if (!dividerEl) {
          return "";
        }
        const dividerColor = window.getComputedStyle(dividerEl).backgroundColor;
        return normalizeColor(
          dividerColor || rowEl.dataset.fullBleedBorderColor
        );
      };
      const rowSharesStroke = (rowEl, color) =>
        rowEl?.dataset?.fullBleedStroke === "true" &&
        normalizeColor(rowEl.dataset.fullBleedBorderColor) === color;
      const rowHasMatchingDivider = (rowEl, color) =>
        getHorizontalDividerColor(rowEl) === color;
      const strokeRows = Array.from(fullBleedRows).filter(
        (rowEl) =>
          rowEl.dataset.fullBleedStroke === "true" ||
          getHorizontalDivider(rowEl)
      );
      if (!strokeRows.length) {
        return;
      }

      for (const rowEl of strokeRows) {
        const color = rowEl.dataset.fullBleedBorderColor;
        if (!color) {
          continue;
        }

        const colorKey = normalizeColor(color);
        const subPanelEl = rowEl.closest(".subPanelDisplay");
        const subPanelIndex = parseInt(subPanelEl?.dataset.subpanelIndex, 10);
        const renderedSubPanelCount = parseInt(
          subPanelEl?.dataset.subpanelCount,
          10
        );
        const resolvedSubPanelCount =
          Number.isFinite(renderedSubPanelCount) && renderedSubPanelCount > 0
            ? renderedSubPanelCount
            : subPanelCount;
        const resolvedSubPanelIndex = Number.isFinite(subPanelIndex)
          ? subPanelIndex
          : 0;
        const touchesOuterLeft = resolvedSubPanelIndex <= 0;
        const touchesOuterRight =
          resolvedSubPanelIndex >= resolvedSubPanelCount - 1;
        const rowRect = rowEl.getBoundingClientRect();
        const baseTop = rowRect.top - signRect.top - borderTopWidth;
        const touchesTop = baseTop <= overlayEdgeThreshold;
        const touchesBottom =
          signInnerHeight - (baseTop + rowRect.height) <= overlayEdgeThreshold;
        const outerTopBleed = touchesTop ? borderTopWidth : 0;
        const outerBottomBleed = touchesBottom ? borderBottomWidth : 0;
        const outerLeftBleed = touchesOuterLeft ? borderLeftWidth : 0;
        const outerRightBleed = touchesOuterRight ? borderRightWidth : 0;
        const internalLeftBleed = touchesOuterLeft ? 0 : borderWidth;
        const internalRightBleed = touchesOuterRight ? 0 : borderWidth;
        const top =
          rowRect.top - overlayHostRect.top - outerTopBleed;
        const left =
          rowRect.left -
          overlayHostRect.left -
          internalLeftBleed -
          outerLeftBleed;
        const width =
          rowRect.width +
          internalLeftBleed +
          internalRightBleed +
          outerLeftBleed +
          outerRightBleed;
        const height = rowRect.height + outerTopBleed + outerBottomBleed;
        if (width <= 0 || height <= 0) {
          continue;
        }

        const previousRow = rowEl.previousElementSibling;
        const nextRow = rowEl.nextElementSibling;
        const isHorizontalDividerRow = !!getHorizontalDivider(rowEl);
        const omitTopBorder =
          rowSharesStroke(previousRow, colorKey) ||
          rowHasMatchingDivider(previousRow, colorKey);
        const omitBottomBorder =
          rowSharesStroke(nextRow, colorKey) ||
          rowHasMatchingDivider(nextRow, colorKey);
        const drawTopBorder =
          !isHorizontalDividerRow && touchesTop && !omitTopBorder;
        const drawBottomBorder =
          !isHorizontalDividerRow && touchesBottom && !omitBottomBorder;

        const overlay = document.createElement("div");
        overlay.className = "fullBleedBorderOverlay";
        overlay.style.left = `${left}px`;
        overlay.style.top = `${top}px`;
        overlay.style.width = `${width}px`;
        overlay.style.height = `${height}px`;
        overlay.style.borderColor = color;
        overlay.style.borderTopWidth = drawTopBorder
          ? `${borderWidth}px`
          : "0";
        overlay.style.borderRightWidth = `${borderWidth}px`;
        overlay.style.borderBottomWidth = drawBottomBorder
          ? `${borderWidth}px`
          : "0";
        overlay.style.borderLeftWidth = `${borderWidth}px`;

        const topLeftRadius =
          drawTopBorder && touchesOuterLeft
            ? radius.topLeft
            : 0;
        const topRightRadius =
          drawTopBorder && touchesOuterRight
            ? radius.topRight
            : 0;
        const bottomRightRadius =
          drawBottomBorder && touchesOuterRight
            ? radius.bottomRight
            : 0;
        const bottomLeftRadius =
          drawBottomBorder && touchesOuterLeft
            ? radius.bottomLeft
            : 0;
        overlay.style.borderRadius =
          `${topLeftRadius}px ${topRightRadius}px ` +
          `${bottomRightRadius}px ${bottomLeftRadius}px`;

        overlayHost.appendChild(overlay);
      }

      return;
    }

    const segments = [];
    for (const rowEl of fullBleedRows) {
      const color = rowEl.dataset.fullBleedBorderColor;
      if (!color) {
        continue;
      }

      const rowRect = rowEl.getBoundingClientRect();
      let start = rowRect.top - signRect.top;
      let end = rowRect.bottom - signRect.top;
      if (end <= start) {
        continue;
      }

      const edgeThreshold = borderWidth + 0.5;
      if (start <= edgeThreshold) {
        start = 0;
      }
      if (signHeight - end <= edgeThreshold) {
        end = signHeight;
      }

      const startPct = Math.max(
        0,
        Math.min(100, (start / signHeight) * 100)
      );
      const endPct = Math.max(0, Math.min(100, (end / signHeight) * 100));
      if (endPct <= startPct) {
        continue;
      }

      segments.push({ start: startPct, end: endPct, color });
    }

    if (!segments.length) {
      clearDynamicBorder();
      return;
    }

    segments.sort((a, b) => a.start - b.start);

    const gradientStops = [];
    let cursor = 0;
    const addSegment = (color, start, end) => {
      const startClamped = Math.max(0, Math.min(100, start));
      const endClamped = Math.max(0, Math.min(100, end));
      if (endClamped <= startClamped) {
        return;
      }
      const startLabel = startClamped.toFixed(4);
      const endLabel = endClamped.toFixed(4);
      gradientStops.push(`${color} ${startLabel}%`, `${color} ${endLabel}%`);
    };

    for (const segment of segments) {
      if (segment.start > cursor) {
        addSegment(defaultBorderColor, cursor, segment.start);
      }
      const segStart = Math.max(cursor, segment.start);
      addSegment(segment.color, segStart, segment.end);
      cursor = Math.max(cursor, segment.end);
    }

    if (cursor < 100) {
      addSegment(defaultBorderColor, cursor, 100);
    }

    const gradient = `linear-gradient(to bottom, ${gradientStops.join(", ")})`;
    signElmt.style.borderColor = "transparent";
    signElmt.style.backgroundImage = `linear-gradient(${fillColor}, ${fillColor}), ${gradient}`;
    signElmt.style.backgroundOrigin = "padding-box, border-box";
    signElmt.style.backgroundClip = "padding-box, border-box";
    signElmt.style.backgroundRepeat = "no-repeat, no-repeat";
    signElmt.style.backgroundPosition = "0 0, 0 0";
  };

  const applyVerticalDividerLaneBleed = (signElmt) => {
    if (!signElmt || !signElmt.isConnected) {
      return;
    }

    const verticalDividers = signElmt.querySelectorAll(
      ".dividerElement.vertical.fullBleed"
    );
    if (!verticalDividers.length) {
      return;
    }

    for (const dividerEl of verticalDividers) {
      dividerEl.style.setProperty("--dividerLaneBleedTop", "0px");
      dividerEl.style.setProperty("--dividerLaneBleedBottom", "0px");

      const laneEl = dividerEl.parentElement;
      if (!laneEl) {
        continue;
      }

      const laneRect = laneEl.getBoundingClientRect();
      const dividerRect = dividerEl.getBoundingClientRect();
      if (!laneRect.height || !dividerRect.height) {
        continue;
      }

      const laneBleedTop = Math.max(0, dividerRect.top - laneRect.top);
      const laneBleedBottom = Math.max(0, laneRect.bottom - dividerRect.bottom);

      dividerEl.style.setProperty("--dividerLaneBleedTop", `${laneBleedTop}px`);
      dividerEl.style.setProperty(
        "--dividerLaneBleedBottom",
        `${laneBleedBottom}px`
      );
    }
  };

  const schedulePanelBorderGradientUpdate = (panelContainerElmt) => {
    if (!panelContainerElmt) {
      return;
    }

    const update = () => {
      const signs = panelContainerElmt.querySelectorAll(".sign");
      for (const signElmt of signs) {
        applyVerticalDividerLaneBleed(signElmt);
        applyPanelBorderGradient(signElmt);
      }
    };

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(update);
    } else {
      update();
    }
  };

  const scheduleAlignmentGuideUpdate = (
    postContainerElmt,
    panelContainerElmt
  ) => {
    const guideElmt = document.getElementById("alignmentGuides");
    if (!guideElmt || !postContainerElmt || !panelContainerElmt) {
      return;
    }

    const spacing = post.normalizeAlignmentGuideSpacing(
      post.alignmentGuideSpacing
    );
    const phase = post.normalizeAlignmentGuidePhase(
      post.alignmentGuidePhase,
      spacing
    );
    post.alignmentGuideSpacing = spacing;
    post.alignmentGuidePhase = phase;
    guideElmt.classList.toggle("visible", !!post.showAlignmentGuides);
    guideElmt.style.setProperty("--alignmentGuideSpacing", spacing + "rem");
    guideElmt.style.setProperty("--alignmentGuidePhase", phase + "rem");

    if (!post.showAlignmentGuides) {
      return;
    }

    const update = () => {
      const panelElmts = Array.from(
        panelContainerElmt.querySelectorAll(":scope > .panel")
      );
      if (!panelElmts.length) {
        guideElmt.classList.remove("visible");
        return;
      }

      const postRect = postContainerElmt.getBoundingClientRect();
      const panelContainerRect = panelContainerElmt.getBoundingClientRect();
      const panelBottom = Math.max(
        ...panelElmts.map((panelElmt) => panelElmt.getBoundingClientRect().bottom)
      );
      const top = Math.min(
        postRect.height,
        Math.max(0, panelBottom - postRect.top)
      );
      const left = Math.max(0, panelContainerRect.left - postRect.left);
      const right = Math.min(
        postRect.width,
        panelContainerRect.right - postRect.left
      );

      guideElmt.style.top = top + "px";
      guideElmt.style.left = left + "px";
      guideElmt.style.width = Math.max(0, right - left) + "px";
    };

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(update);
    } else {
      update();
    }
  };

  const getSelectionState = () => ({
    currentlySelectedPanelIndex,
    currentlySelectedSubPanelIndex,
    currentlySelectedExitTabIndex,
    currentlySelectedNestedExitTabIndex,
    currentlySelectedRowIndex,
    currentlySelectedBlockIndex,
    currentlySelectedAPLArrowIndex,
    currentlyEditingGroupPath,
  });

  const createHistoryEntry = () => ({
    post: serializePostWithElementTypes(),
    selection: JSON.parse(JSON.stringify(getSelectionState())),
  });

  const captureHistoryAfterRedraw = () => {
    if (activeTemplateEditor) {
      return;
    }
    if (
      !post ||
      !Array.isArray(post.panels) ||
      post.panels.length === 0
    ) {
      return;
    }

    const currentEntry = createHistoryEntry();
    if (isApplyingHistory) {
      lastHistoryEntry = currentEntry;
      return;
    }

    if (!lastHistoryEntry) {
      lastHistoryEntry = currentEntry;
      return;
    }

    if (lastHistoryEntry.post === currentEntry.post) {
      lastHistoryEntry.selection = currentEntry.selection;
      return;
    }

    undoHistory.push({
      post: lastHistoryEntry.post,
      selection: lastHistoryEntry.selection,
    });
    if (undoHistory.length > HISTORY_LIMIT) {
      undoHistory.splice(0, undoHistory.length - HISTORY_LIMIT);
    }
    redoHistory.length = 0;
    lastHistoryEntry = currentEntry;
  };

  const applyHistoryEntry = (entry) => {
    if (!entry || typeof entry.post !== "string") {
      return false;
    }

    isApplyingHistory = true;
    try {
      setPost(reconstructPostFromData(JSON.parse(entry.post)), entry.selection);
      lastHistoryEntry = createHistoryEntry();
      return true;
    } catch (error) {
      console.warn("Unable to restore SignMaker history", error);
      return false;
    } finally {
      isApplyingHistory = false;
    }
  };

  const undo = () => {
    if (activeTemplateEditor) {
      return false;
    }
    if (!undoHistory.length) {
      return false;
    }

    const currentEntry = createHistoryEntry();
    const previousEntry = undoHistory.pop();
    redoHistory.push(currentEntry);
    if (applyHistoryEntry(previousEntry)) {
      return true;
    }

    redoHistory.pop();
    undoHistory.push(previousEntry);
    return false;
  };

  const redo = () => {
    if (activeTemplateEditor) {
      return false;
    }
    if (!redoHistory.length) {
      return false;
    }

    const currentEntry = createHistoryEntry();
    const nextEntry = redoHistory.pop();
    undoHistory.push(currentEntry);
    if (applyHistoryEntry(nextEntry)) {
      return true;
    }

    undoHistory.pop();
    redoHistory.push(nextEntry);
    return false;
  };

  const syncFocusedEditorBeforeHistory = () => {
    const activeElement = document.activeElement;
    if (
      !activeElement ||
      !activeElement.matches?.("input, select, textarea, [contenteditable='true']")
    ) {
      return;
    }

    if (formHandler && typeof formHandler.readForm === "function") {
      formHandler.readForm();
    }
  };

  const handleUndoRedoShortcut = (event) => {
    if (formHandler.getKeybindMode() === "none") {
      return;
    }

    const isUndo = formHandler.shortcutMatches(event, "UndoEdit");
    const isRedo = !isUndo && formHandler.shortcutMatches(event, "RedoEdit");
    if (!isUndo && !isRedo) {
      return;
    }

    try {
      syncFocusedEditorBeforeHistory();
    } catch (error) {
      console.warn("Unable to sync the active editor before history", error);
    }

    const didApplyHistory = isUndo ? undo() : redo();
    if (didApplyHistory) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  // v2.19 keyboard shortcuts for panels, subpanels and rows. Each returns a
  // short notice for the shortcut toast, or null when nothing changed.
  const insertNewPanelAt = (insertIndex) => {
    post.newPanel();
    post.panels.splice(insertIndex, 0, post.panels.pop());
    currentlySelectedPanelIndex = insertIndex;
    currentlySelectedSubPanelIndex = 0;
    currentlySelectedExitTabIndex = 0;
    currentlySelectedNestedExitTabIndex = -1;
    currentlySelectedRowIndex = 0;
    currentlySelectedBlockIndex = 0;
    currentlySelectedAPLArrowIndex = 0;
    resetGroupEditing();
    formHandler.updateForm();
    redraw();
    return `Selected: Panel ${insertIndex + 1}`;
  };

  const selectMainPanel = (direction) => {
    const group = getStackedPanelGroupIndices();
    let index = direction > 0 ? group[group.length - 1] + 1 : group[0] - 1;
    if (index < 0 || index >= post.panels.length) return null;
    index = getStackedPanelTopIndex(index);
    changeEditingPanel(index);
    return `Selected: Panel ${index + 1}`;
  };

  const insertNewSubPanel = (left) => {
    const sign = getCurrentPanel().sign;
    const insertIndex = Math.max(0, currentlySelectedSubPanelIndex) + (left ? 0 : 1);
    sign.newSubPanel();
    sign.subPanels.splice(insertIndex, 0, sign.subPanels.pop());
    changeEditingSubPanel(insertIndex);
    redraw();
    return `Selected: Subpanel ${insertIndex + 1}`;
  };

  const selectSubPanel = (direction) => {
    const count = getCurrentPanel().sign.subPanels.length;
    const index = clamp(currentlySelectedSubPanelIndex + direction, 0, count - 1);
    if (index === currentlySelectedSubPanelIndex) return null;
    changeEditingSubPanel(index);
    redraw();
    return `Selected: Subpanel ${index + 1}`;
  };

  const selectRow = (direction) => {
    const index = clamp(currentlySelectedRowIndex + direction, 0,
      getActiveBlockElements().rows.length - 1);
    if (index === currentlySelectedRowIndex) return null;
    setSelectedRow(index);
    redraw();
    return `Selected: Row ${index + 1}`;
  };

  const shortcutActions = {
    NewPanel: () => {
      const group = getStackedPanelGroupIndices();
      return insertNewPanelAt(group[group.length - 1] + 1);
    },
    NewPanelLeft: () => insertNewPanelAt(getStackedPanelTopIndex()),
    NewSubpanel: () => insertNewSubPanel(false),
    NewSubpanelLeft: () => insertNewSubPanel(true),
    NewRow: () => {
      newRow(document.getElementById("sMSPElementSelect").value);
      return `Selected: Row ${currentlySelectedRowIndex + 1}`;
    },
    NewRowTop: () => {
      newRow(document.getElementById("sMSPElementSelect").value, { shiftKey: true });
      return `Selected: Row ${currentlySelectedRowIndex + 1}`;
    },
    NextPanel: () => selectMainPanel(1),
    PreviousPanel: () => selectMainPanel(-1),
    NextSubpanel: () => selectSubPanel(1),
    PreviousSubpanel: () => selectSubPanel(-1),
    NextRow: () => selectRow(1),
    PreviousRow: () => selectRow(-1),
    DeletePanel: () => {
      if (post.panels.length <= 1) return null;
      const index = currentlySelectedPanelIndex;
      deletePanel();
      return `Deleted Panel ${index + 1}`;
    },
    DeleteSubpanel: () => {
      const sign = getCurrentPanel().sign;
      if (sign.subPanels.length <= 1) return null;
      const index = Math.max(0, currentlySelectedSubPanelIndex);
      sign.deleteSubPanel(index);
      changeEditingSubPanel(Math.min(index, sign.subPanels.length - 1));
      redraw();
      return `Deleted Subpanel ${index + 1}`;
    },
    DeleteRow: () => {
      if (getActiveBlockElements().rows.length <= 1) return null;
      const index = currentlySelectedRowIndex;
      delRow();
      return `Deleted Row ${index + 1}`;
    },
    ClearAll: () => {
      clearAll();
      return null;
    },
  };

  const runShortcutAction = (name) => shortcutActions[name]?.() ?? null;

  // Saving serializes the whole post and writes localStorage, so routine
  // saves (every redraw while a slider moves) wait until edits pause. Leaving
  // the page saves at once (syncForm).
  let sessionPersistTimer = 0;
  const persistSessionState = ({ syncForm = false } = {}) => {
    clearTimeout(sessionPersistTimer);
    if (syncForm) {
      writeSessionState({ syncForm });
    } else {
      sessionPersistTimer = setTimeout(writeSessionState, 250);
    }
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      clearTimeout(sessionPersistTimer);
      writeSessionState();
    }
  });

  const writeSessionState = ({ syncForm = false } = {}) => {
    if (
      isSessionPersisting ||
      !post ||
      !Array.isArray(post.panels) ||
      post.panels.length === 0
    ) {
      return;
    }

    if (syncForm && formHandler && typeof formHandler.readForm === "function") {
      isSessionPersisting = true;
      try {
        formHandler.readForm();
      } catch (error) {
        console.warn("Unable to sync form before saving session", error);
      } finally {
        isSessionPersisting = false;
      }
    }

    if (lastHistoryEntry) {
      lastHistoryEntry.selection = JSON.parse(
        JSON.stringify(getSelectionState())
      );
    }

    try {
      const templateWorkspaceData = activeTemplateEditor?.workspaceData;
      const sessionData = {
        version: SESSION_STORAGE_VERSION,
        savedAt: new Date().toISOString(),
        post: templateWorkspaceData
          ? JSON.parse(templateWorkspaceData)
          : JSON.parse(serializePostWithElementTypes()),
        selection: templateWorkspaceData
          ? cloneTemplateValue(activeTemplateEditor.workspaceSelection)
          : getSelectionState(),
        fileInfo: { ...fileInfo },
        templateEditor: createTemplateEditorSessionState(),
      };
      const serialized = JSON.stringify(sessionData);
      try {
        window.localStorage.setItem(SESSION_STORAGE_KEY, serialized);
        writeSessionDatabase(null);
      } catch (quotaError) {
        // Large sessions (uploaded shields and icons) go to IndexedDB instead.
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
        writeSessionDatabase(serialized);
      }
    } catch (error) {
      console.warn("Unable to save SignMaker session", error);
    }
  };

  let sessionDatabasePromise = null;
  let sessionDatabaseHasValue = false;
  const openSessionDatabase = () => {
    sessionDatabasePromise ||= new Promise((resolve, reject) => {
      const request = window.indexedDB.open(SESSION_DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(SESSION_DB_STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return sessionDatabasePromise;
  };
  // Stores the session, or clears a stored one when given null.
  const writeSessionDatabase = (serialized) => {
    if (serialized === null && !sessionDatabaseHasValue) {
      return;
    }
    sessionDatabaseHasValue = serialized !== null;
    openSessionDatabase()
      .then((database) => {
        const store = database
          .transaction(SESSION_DB_STORE, "readwrite")
          .objectStore(SESSION_DB_STORE);
        if (serialized === null) {
          store.delete(SESSION_STORAGE_KEY);
        } else {
          store.put(serialized, SESSION_STORAGE_KEY);
        }
      })
      .catch((error) => console.warn("Unable to save SignMaker session to IndexedDB", error));
  };
  const readSessionDatabase = async () => {
    try {
      const database = await openSessionDatabase();
      const value = await new Promise((resolve, reject) => {
        const request = database
          .transaction(SESSION_DB_STORE, "readonly")
          .objectStore(SESSION_DB_STORE)
          .get(SESSION_STORAGE_KEY);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      sessionDatabaseHasValue = value !== null;
      return value;
    } catch (error) {
      console.warn("Unable to read SignMaker session from IndexedDB", error);
      return null;
    }
  };

  // "always", "prompt" (ask first) or "never".
  const getRestoreOnRefreshMode = () => {
    try {
      const mode = window.localStorage.getItem(RESTORE_ON_REFRESH_STORAGE_KEY);
      return ["always", "prompt", "never"].includes(mode) ? mode : "always";
    } catch (error) {
      return "always";
    }
  };

  const restoreSavedSession = async () => {
    try {
      const storedSession =
        window.localStorage.getItem(SESSION_STORAGE_KEY) ||
        (await readSessionDatabase());
      if (!storedSession) {
        return false;
      }
      const restoreMode = getRestoreOnRefreshMode();
      if (
        restoreMode === "never" ||
        (restoreMode === "prompt" &&
          !window.confirm("Restore your previous sign from the last refresh?"))
      ) {
        return false;
      }

      const sessionData = JSON.parse(storedSession);
      const postData = sessionData && (sessionData.post || sessionData);
      if (!postData || !Array.isArray(postData.panels) || !postData.panels.length) {
        return false;
      }

      if (sessionData.fileInfo && typeof sessionData.fileInfo === "object") {
        fileInfo = { ...fileInfo, ...sessionData.fileInfo };
      }

      const workspacePost = reconstructPostFromData(postData);
      if (sessionData.templateEditor) {
        try {
          restoreTemplateEditorSession(
            sessionData.templateEditor,
            postData,
            sessionData.selection
          );
          return true;
        } catch (editorError) {
          console.warn(
            "Unable to restore the template editing session; restoring the workspace instead",
            editorError
          );
          activeTemplateEditor = null;
          setPost(workspacePost, sessionData.selection);
          updateTemplateEditorControls();
          return true;
        }
      }

      setPost(workspacePost, sessionData.selection);
      updateTemplateEditorStatus();
      return true;
    } catch (error) {
      console.warn("Unable to restore SignMaker session", error);
      try {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      } catch (storageError) {
        console.warn("Unable to clear invalid SignMaker session", storageError);
      }
      return false;
    }
  };

  // Initialize the application, and populates dropdowns and the default post.

  // v2.19 startup: draw a restored sign before the editor builds its menus,
  // and show it once its fonts have loaded (see js/FontLoader.js).
  const paintSavedSessionEarly = () => {
    if (getRestoreOnRefreshMode() !== "always") {
      return false;
    }
    try {
      const sessionData = JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY) || "null");
      const postData = sessionData && (sessionData.post || sessionData);
      if (!Array.isArray(postData?.panels) || !postData.panels.length || sessionData.templateEditor) {
        return false;
      }
      post = reconstructPostFromData(postData);
      currentlySelectedPanelIndex = 0;
      redraw();
      return true;
    } catch (error) {
      post = new Post(Post.prototype.polePositions[0]);
      return false;
    }
  };

  const revealSignWhenFontsLoad = async () => {
    try {
      await window.SignMakerFonts?.preparePost(post);
      await window.SignMakerFonts?.prepareElement(document.getElementById("panelContainer"));
    } finally {
      document.documentElement.removeAttribute("data-sign-loading");
    }
  };

  const init = async function () {
    watchSignContentClasses();
    post = new Post(Post.prototype.polePositions[0]);
    const signReveal = paintSavedSessionEarly() ? revealSignWhenFontsLoad() : null;
    await formHandler.init(exposeToFormHandler);
    blockDefaults.init();

    // Initialize CustomShields after formHandler and wait for it
    window.customShields = new CustomShields();
    await window.customShields.initialized;

    window.addEventListener("beforeunload", () => {
      persistSessionState({ syncForm: true });
      window.SignMakerFonts?.remember(document.getElementById("panelContainer"));
    });
    document.addEventListener("keydown", handleUndoRedoShortcut, true);

    document.getElementById("restoreOnRefresh").value = getRestoreOnRefreshMode();
    if (!(await restoreSavedSession())) {
      newPanel();
    }
    // Not awaited: the editor is usable while the fonts finish.
    signReveal || revealSignWhenFontsLoad();
    formHandler.warmEditorWindows();

    await refreshTemplatesList();
  };

  // Create a new panel, set the current editing panel to that panel, update the form, and redraw.
  const newPanel = function () {
    post.newPanel();
    currentlySelectedPanelIndex = post.panels.length - 1;
    currentlySelectedSubPanelIndex = 0;
    currentlySelectedExitTabIndex = 0;
    currentlySelectedNestedExitTabIndex = -1;
    currentlySelectedRowIndex = 0;
    currentlySelectedBlockIndex = 0;
    currentlySelectedAPLArrowIndex = 0;
    resetGroupEditing();
    formHandler.updateForm();
    redraw();
  };

  // Clone the panel as a standalone panel after its stack, set the current
  // editing panel to that panel, update the form and redraw.
  const duplicatePanel = function (panelIndex = currentlySelectedPanelIndex) {
    if (
      !post ||
      !Array.isArray(post.panels) ||
      panelIndex < 0 ||
      panelIndex >= post.panels.length
    ) {
      return;
    }

    post.duplicatePanel(panelIndex);
    const [copy] = post.panels.splice(panelIndex + 1, 1);
    clearPanelStacking(copy);
    copy.hiddenFromPost = false;
    const groupIndices = getStackedPanelGroupIndices(panelIndex);
    currentlySelectedPanelIndex = groupIndices[groupIndices.length - 1] + 1;
    post.panels.splice(currentlySelectedPanelIndex, 0, copy);
    resetGroupEditing();
    formHandler.updateForm();
    redraw();
  };

  /*
    Delete the current panel, set the current editing panel to the panel before, update the form and redraw.
    If no panel is found, create a new one.
  */
  // Deleting a main panel deletes its stack; an additional panel goes alone.
  const deletePanel = function (panelIndex = currentlySelectedPanelIndex) {
    const indices = isStackedPanelBottom(panelIndex)
      ? [panelIndex]
      : getStackedPanelGroupIndices(panelIndex);
    const selectedPanel = post.panels[currentlySelectedPanelIndex];
    for (let i = indices.length - 1; i >= 0; i--) {
      post.deletePanel(indices[i]);
    }
    clearPanelStacking(post.panels[0]);
    currentlySelectedPanelIndex = post.panels.includes(selectedPanel)
      ? post.panels.indexOf(selectedPanel)
      : clamp(indices[0] - 1, 0, Math.max(0, post.panels.length - 1));
    resetGroupEditing();
    if (post.panels.length == 0) {
      newPanel();
    } else {
      formHandler.updateForm();
      redraw();
    }
  };

  // Reset the workspace immediately, using the same blank panel as deleting the last panel.
  const clearAll = function () {
    activeTemplateEditor = null;
    controlElemClipboardRows = [];
    fileInfo = { fileType: "png", panel: -1 };
    closeCopyPanelContextMenu();
    closeDownloadPanelContextMenu();
    post = new Post(Post.prototype.polePositions[0]);
    newPanel();
    updateTemplateEditorControls();
  };

  // Shift a panel to the left, and redraw.
  const shiftLeft = function () {
    currentlySelectedPanelIndex = post.shiftLeft(currentlySelectedPanelIndex);
    redraw();
  };

  // Shift a panel to the right, and redraw.
  const shiftRight = function () {
    currentlySelectedPanelIndex = post.shiftRight(currentlySelectedPanelIndex);
    redraw();
  };

  // Moves a panel's whole stack; a drop inside another stack lands after it.
  const movePanel = function (fromIndex, toIndex) {
    if (!post || !Array.isArray(post.panels) || post.panels.length < 2) {
      return;
    }

    const fromGroup = getStackedPanelGroupIndices(
      typeof fromIndex === "number" ? fromIndex : currentlySelectedPanelIndex
    );
    const fromStart = fromGroup[0];
    const fromEnd = fromStart + fromGroup.length;
    let normalizedTo = clamp(
      typeof toIndex === "number" ? toIndex : fromStart,
      0,
      post.panels.length
    );
    if (isStackedPanelBottom(normalizedTo)) {
      const targetGroup = getStackedPanelGroupIndices(normalizedTo);
      normalizedTo = targetGroup[targetGroup.length - 1] + 1;
    }

    if (normalizedTo >= fromStart && normalizedTo <= fromEnd) {
      return;
    }

    const selectedPanelRef =
      currentlySelectedPanelIndex >= 0 &&
        currentlySelectedPanelIndex < post.panels.length
        ? post.panels[currentlySelectedPanelIndex]
        : null;

    const movingPanels = post.panels.splice(fromStart, fromGroup.length);
    if (normalizedTo > fromStart) {
      normalizedTo -= fromGroup.length;
    }
    post.panels.splice(normalizedTo, 0, ...movingPanels);
    clearPanelStacking(post.panels[0]);

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
  };

  // --- Rendered Panel Drag and Drop ---
  let renderedPanelDragState = null;
  let templatePanelDragState = null;

  const toggleRenderedPanelWiggle = (isActive) => {
    const panels = document.querySelectorAll(
      "#panelContainer > .panel, #panelContainer > .panelStack"
    );
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
      .querySelectorAll(":is(.panel, .panelStack):is(.dropBefore, .dropAfter)")
      .forEach((el) => el.classList.remove("dropBefore", "dropAfter"));
  };

  const clearTemplatePanelDropIndicator = () => {
    document
      .querySelectorAll(".panel.templateReplaceTarget")
      .forEach((panel) => panel.classList.remove("templateReplaceTarget"));
  };

  const endRenderedPanelDrag = () => {
    toggleRenderedPanelWiggle(false);
    clearRenderedPanelDropIndicators();
    document
      .querySelectorAll(":is(.panel, .panelStack).dragging")
      .forEach((el) => {
        el.classList.remove("dragging");
        delete el.dataset.dragging;
      });
    renderedPanelDragState = null;
  };

  const getRenderedPanelDropPosition = (container, clientX, clientY) => {
    // Stacks move as one, so drops land between top-level panels and stacks.
    const panels = Array.from(
      container.querySelectorAll(":scope > .panel, :scope > .panelStack")
    );
    if (!panels.length) {
      return { dropIndex: 0, targetPanel: null, placement: null };
    }

    let dropIndex = post.panels.length;
    let targetPanel = null;
    let placement = "after";
    let foundPosition = false;

    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      const rect = panel.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      if (clientX < midpoint) {
        dropIndex = Number(panel.dataset.panelIndex);
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
    if (templatePanelDragState) {
      const targetPanel = event.target.closest?.("#panelContainer > .panel");
      if (!targetPanel) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
      clearTemplatePanelDropIndicator();
      targetPanel.classList.add("templateReplaceTarget");
      return;
    }

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
      event.clientX,
      event.clientY
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
    if (templatePanelDragState) {
      const targetPanel = event.target.closest?.("#panelContainer > .panel");
      if (!targetPanel) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const targetPanelIndex = Number(targetPanel.dataset.panelIndex);
      const { templateId, variantId } = templatePanelDragState;
      templatePanelDragState = null;
      clearTemplatePanelDropIndicator();
      document
        .querySelectorAll(".templateReplacePanelBtn.templateDragging")
        .forEach((button) => button.classList.remove("templateDragging"));
      if (!Number.isNaN(targetPanelIndex)) {
        loadTemplate(templateId, "replace-panel", variantId, targetPanelIndex);
      }
      return;
    }

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
    if (templatePanelDragState) {
      const container = document.getElementById("panelContainer");
      const related = event.relatedTarget;
      if (!related || !container || !container.contains(related)) {
        clearTemplatePanelDropIndicator();
      }
      return;
    }

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

  const changeEditingPanel = function (panelNumber) {
    const previousPanelIndex = currentlySelectedPanelIndex;
    currentlySelectedPanelIndex = clamp(panelNumber, 0, post.panels.length - 1);
    // A hidden panel only draws while selected.
    if (
      previousPanelIndex !== currentlySelectedPanelIndex &&
      (isPanelHiddenFromPost(previousPanelIndex) ||
        isPanelHiddenFromPost(currentlySelectedPanelIndex))
    ) {
      redraw();
    }
    currentlySelectedSubPanelIndex = 0;
    resetGroupEditing();
    // Reset row and block indices to prevent accessing non-existent elements
    currentlySelectedRowIndex = 0;
    currentlySelectedBlockIndex = 0;
    formHandler.updateForm();

    // Flash the selected panel
    const panelElmt = document.getElementById("panel" + currentlySelectedPanelIndex);
    if (panelElmt) {
      const signElmt = panelElmt.querySelector(".sign");
      if (signElmt) {
        flashElement(signElmt);
      }
    }
    persistSessionState();
  };

  const setPanelSpacing = function (value) {
    if (!post) {
      return;
    }
    const parsedValue = parseFloat(value);
    const normalized =
      Number.isFinite(parsedValue) && parsedValue >= 0
        ? Math.min(parsedValue, 8)
        : 0;
    if (post.panelSpacing === normalized) {
      return;
    }
    post.panelSpacing = normalized;
    formHandler.updateForm();
    redraw();
  };

  // Adds an empty panel to the selected panel's stack, above or below its main panel.
  const createStackedPanel = function (placement) {
    const topIndex = getStackedPanelTopIndex(currentlySelectedPanelIndex);
    const groupIndices = getStackedPanelGroupIndices(topIndex);
    post.newPanel();
    const panel = post.panels.pop();
    panel.color = post.panels[topIndex].color;
    panel.stackedWithPrevious = true;
    panel.stackedPanelPlacement = placement === "above" ? "above" : "below";
    currentlySelectedPanelIndex = groupIndices[groupIndices.length - 1] + 1;
    post.panels.splice(currentlySelectedPanelIndex, 0, panel);
    currentlySelectedSubPanelIndex = 0;
    currentlySelectedExitTabIndex = 0;
    currentlySelectedNestedExitTabIndex = -1;
    currentlySelectedRowIndex = 0;
    currentlySelectedBlockIndex = 0;
    resetGroupEditing();
    formHandler.updateForm();
    redraw();
  };

  const setStackedPanelSpacing = function (value) {
    post.panels[getStackedPanelTopIndex()].stackedPanelSpacing =
      normalizeStackedPanelSpacing(value);
    formHandler.updateForm();
    redraw();
  };

  const setStackedPanelMatchWidth = function (matchWidth) {
    post.panels[getStackedPanelTopIndex()].stackedPanelMatchWidth = matchWidth === true;
    formHandler.updateForm();
    redraw();
  };

  // Hidden panels stay in the file but are left off the post and exports.
  // The selected panel still draws (faded) so it can be edited.
  const togglePanelHidden = function (panelIndex = currentlySelectedPanelIndex) {
    const panel = post.panels[panelIndex];
    if (!panel) {
      return;
    }
    panel.hiddenFromPost = panel.hiddenFromPost !== true;
    formHandler.updateForm();
    redraw();
  };

  const setSignAlignment = function (value) {
    if (!post) {
      return;
    }
    const normalized = normalizeSignAlignment(value);
    if (post.signAlignment === normalized) {
      return;
    }
    post.signAlignment = normalized;
    formHandler.updateForm();
    redraw();
  };

  const addSubPanel = function () {
    const sign = getCurrentPanel().sign;
    sign.newSubPanel();
    currentlySelectedSubPanelIndex++;
    resetGroupEditing();
    formHandler.updateForm();
    redraw();
  };

  const removeSubPanel = function () {
    const sign = getCurrentPanel().sign;
    if (sign.subPanels.length > 1) {
      sign.deleteSubPanel(sign.subPanels.length - 2);
      currentlySelectedSubPanelIndex--;
      resetGroupEditing();
      formHandler.updateForm();
      redraw();
    }
  };

  // Duplicate the current subpanel, set the editing to that subpanel, update the form, and redraw.
  const duplicateSubPanel = function () {
    const sign = getCurrentPanel().sign;
    sign.duplicateSubPanel(currentlySelectedSubPanelIndex);
    currentlySelectedSubPanelIndex++;
    resetGroupEditing();
    formHandler.updateForm();
    redraw();
  };

  const moveSubPanel = function (fromIndex, toIndex) {
    const panel = getCurrentPanel();
    const sign = panel && panel.sign;
    const subPanels = sign && sign.subPanels;
    if (!Array.isArray(subPanels) || subPanels.length < 2) {
      return;
    }

    const subPanelCount = subPanels.length;
    const fromNumber = Number(fromIndex);
    const toNumber = Number(toIndex);
    const normalizedFrom = clamp(
      Number.isFinite(fromNumber) ? Math.trunc(fromNumber) : 0,
      0,
      subPanelCount - 1
    );
    let normalizedTo = clamp(
      Number.isFinite(toNumber) ? Math.trunc(toNumber) : normalizedFrom,
      0,
      subPanelCount
    );

    if (
      normalizedFrom === normalizedTo ||
      normalizedFrom + 1 === normalizedTo
    ) {
      return;
    }

    const selectedSubPanelRef =
      currentlySelectedSubPanelIndex >= 0 &&
        currentlySelectedSubPanelIndex < subPanels.length
        ? subPanels[currentlySelectedSubPanelIndex]
        : null;
    const aplBuckets =
      Array.isArray(sign.aplArrows) && sign.aplArrows.length
        ? getAPLArrowBuckets(sign)
        : null;

    const [movedSubPanel] = subPanels.splice(normalizedFrom, 1);
    if (!movedSubPanel) {
      return;
    }

    if (normalizedTo > normalizedFrom) {
      normalizedTo--;
    }

    subPanels.splice(normalizedTo, 0, movedSubPanel);

    if (aplBuckets) {
      const [movedBucket] = aplBuckets.splice(normalizedFrom, 1);
      aplBuckets.splice(normalizedTo, 0, movedBucket || []);
      rebuildAPLArrowBuckets(sign, aplBuckets);
    }

    if (selectedSubPanelRef) {
      const updatedIndex = subPanels.indexOf(selectedSubPanelRef);
      currentlySelectedSubPanelIndex =
        updatedIndex >= 0
          ? updatedIndex
          : clamp(currentlySelectedSubPanelIndex, 0, subPanels.length - 1);
    }

    resetGroupEditing();
    normalizeEditorSelection();
    formHandler.updateForm();
    redraw();
  };

  // Set the current editing (SUB)panel based off paramter number, within the correct range (0 < # of panels - 1)
  const changeEditingSubPanel = function (subPanelNumber) {
    currentlySelectedSubPanelIndex = clamp(
      subPanelNumber,
      -1,
      getCurrentPanel().sign.subPanels.length - 1
    );
    resetGroupEditing();
    // Reset row and block indices to prevent accessing non-existent elements
    currentlySelectedRowIndex = 0;
    currentlySelectedBlockIndex = 0;
    formHandler.updateForm();

    // Flash the selected subpanel
    const panelElmt = document.getElementById(
      "panel" + currentlySelectedPanelIndex
    );
    const subPanelElmt = panelElmt
      ? panelElmt.querySelector("#S_subPanel" + currentlySelectedSubPanelIndex)
      : null;
    if (subPanelElmt) {
      flashElement(subPanelElmt);
    }
    persistSessionState();
  };

  const flashElement = (targetElmt) => {
    if (!targetElmt) return;
    if (post && post.disableFlash) return;

    const postContainer = document.getElementById("postContainer");
    if (!postContainer) return;

    const rect = targetElmt.getBoundingClientRect();
    const containerRect = postContainer.getBoundingClientRect();

    const overlay = document.createElement("div");
    overlay.className = "flash-selection";
    overlay.style.top = (rect.top - containerRect.top) + "px";
    overlay.style.left = (rect.left - containerRect.left) + "px";
    overlay.style.width = rect.width + "px";
    overlay.style.height = rect.height + "px";

    postContainer.appendChild(overlay);

    setTimeout(() => {
      overlay.remove();
    }, 500);
  };

  // Create a new exit tab, update the form, and redraw.
  const newExitTab = function () {
    const panel = getCurrentPanel();
    panel.newExitTab();
    currentlySelectedExitTabIndex = panel.exitTabs.length - 1;
    currentlySelectedNestedExitTabIndex = -1;
    formHandler.updateForm();
    redraw();
  };

  // Create a new nested exit tab within the parent exit tab.
  const newNestExitTab = function () {
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
  };

  // Create a duplicate of the exit tab.
  const duplicateExitTab = function (exitTabIndex = currentlySelectedExitTabIndex) {
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
  };

  // Delete the exit tab.
  const removeExitTab = function (exitTabIndex = currentlySelectedExitTabIndex) {
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
  };

  // Delete the exit tab within the parent exitTab
  const deleteNestExitTab = function (
    nestExitTabIndex = currentlySelectedNestedExitTabIndex
  ) {
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
  };

  const moveExitTab = function (fromIndex, toIndex) {
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
    persistSessionState();
  };

  // Add a new shield to the current panel's sign, update the shield subform, and redraw the sign.
  const newShield = function () {
    const sign = getCurrentPanel().sign;
    sign.newShield(currentlySelectedSubPanelIndex);
    formHandler.updateShieldSubform();
    redraw();
  };

  // Delete the current shield, update the shield subform, and redraw the sign
  const deleteShield = function (shieldIndex) {
    const sign = getCurrentPanel().sign;
    sign.deleteShield(shieldIndex, currentlySelectedSubPanelIndex);
    formHandler.updateShieldSubform();
    redraw();
  };

  // Delete all shields of a sign
  const clearShields = function () {
    const subPanel = getCurrentSubPanel();
    const shields = subPanel.shields;

    while (shields.length > 0) {
      deleteShield(shields.length - 1, currentlySelectedSubPanelIndex);
    }
  };

  // Duplicate a shield
  const duplicateShield = function (shieldIndex) {
    const sign = getCurrentPanel().sign;
    sign.duplicateShield(shieldIndex, currentlySelectedSubPanelIndex);
    formHandler.updateShieldSubform();
    redraw();
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
  const newRow = (selectedBlock, evt) => {
    const blockElems = getActiveBlockElements();
    const insertAbove = evt && evt.shiftKey;
    const sourceRowIndex = currentlySelectedRowIndex;
    const insertRowIndex = insertAbove
      ? sourceRowIndex
      : sourceRowIndex + 1;
    currentlySelectedBlockIndex = 0;
    blockElems.addRow(insertRowIndex, selectedBlock, { sourceRowIndex });
    blockElems.rows[insertRowIndex][0] = blockDefaults.create(
      Control.prototype.blockToClassElems[selectedBlock]
    );
    currentlySelectedRowIndex = insertRowIndex;
    formHandler.updateForm();
    redraw();
  };

  const dupRow = () => {
    const blockElems = getActiveBlockElements();
    blockElems.duplicateRow(currentlySelectedRowIndex++);
    formHandler.updateForm();
    redraw();
  };

  const delRow = () => {
    const blockElems = getActiveBlockElements();
    if (blockElems.rows.length == 1) {
      return;
    }

    blockElems.deleteRow(currentlySelectedRowIndex);
    currentlySelectedRowIndex = Math.max(currentlySelectedRowIndex - 1, 0);

    formHandler.updateForm();
    redraw();
  };

  const moveRow = (fromIndex, toIndex) => {
    const blockElements = getActiveBlockElements();
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
  };

  // refreshForm is false when a block is selected right after, which
  // refreshes the form itself.
  const setSelectedRow = (row, refreshForm = true) => {
    currentlySelectedRowIndex = clamp(
      row,
      0,
      getActiveBlockElements().rows.length - 1
    );
    if (refreshForm) formHandler.updateForm();
    persistSessionState();
  };

  const insertControlElemAt = (selectedElem, rowIndex, blockIndex) => {
    const blockElems = getActiveBlockElements();
    const Constructor = Control.prototype.blockToClassElems[selectedElem];
    if (
      typeof Constructor !== "function" ||
      !blockElems ||
      !Array.isArray(blockElems.rows) ||
      !blockElems.rows.length
    ) {
      return false;
    }

    const normalizedRowIndex = clamp(
      Number(rowIndex),
      0,
      blockElems.rows.length - 1
    );
    const targetRow = blockElems.rows[normalizedRowIndex];
    const normalizedBlockIndex = clamp(
      Number(blockIndex),
      0,
      targetRow.length
    );
    targetRow.splice(normalizedBlockIndex, 0, blockDefaults.create(Constructor));

    currentlySelectedRowIndex = normalizedRowIndex;
    currentlySelectedBlockIndex = normalizedBlockIndex;
    formHandler.updateForm();
    redraw();
    return true;
  };

  const insertControlElemInNewRow = (selectedElem, rowIndex) => {
    const blockElems = getActiveBlockElements();
    const Constructor = Control.prototype.blockToClassElems[selectedElem];
    if (
      typeof Constructor !== "function" ||
      !blockElems ||
      !Array.isArray(blockElems.rows)
    ) {
      return false;
    }

    const normalizedRowIndex = clamp(
      Number(rowIndex),
      0,
      blockElems.rows.length
    );
    const neighborRowIndex = normalizedRowIndex === 0
      ? 0
      : normalizedRowIndex - 1;
    const rowProperties =
      typeof blockElems.createBlockWithNeighborBackground === "function"
        ? blockElems.createBlockWithNeighborBackground(
          normalizedRowIndex,
          neighborRowIndex
        )
        : new Block();

    blockElems.rows.splice(normalizedRowIndex, 0, [blockDefaults.create(Constructor)]);
    blockElems.blockProperties.splice(
      normalizedRowIndex,
      0,
      rowProperties
    );

    currentlySelectedRowIndex = normalizedRowIndex;
    currentlySelectedBlockIndex = 0;
    formHandler.updateForm();
    redraw();
    return true;
  };

  const newControlElem = (selectedElem) => {
    return insertControlElemAt(
      selectedElem,
      currentlySelectedRowIndex,
      currentlySelectedBlockIndex + 1
    );
  };

  const normalizeControlElemRefs = (refs, blockElements) => {
    const rows = blockElements?.rows;
    const normalizedRefs = [];
    const seenKeys = new Set();

    if (Array.isArray(rows)) {
      const sourceRefs = Array.isArray(refs) && refs.length
        ? refs
        : [
          {
            rowIndex: currentlySelectedRowIndex,
            blockIndex: currentlySelectedBlockIndex,
          },
        ];

      for (const ref of sourceRefs) {
        const rowIndex = Number(ref?.rowIndex);
        const blockIndex = Number(ref?.blockIndex);
        if (!Number.isInteger(rowIndex) || !Number.isInteger(blockIndex)) {
          continue;
        }

        const row = rows[rowIndex];
        if (!Array.isArray(row) || blockIndex < 0 || blockIndex >= row.length) {
          continue;
        }

        const key = `${rowIndex}:${blockIndex}`;
        if (seenKeys.has(key)) {
          continue;
        }

        seenKeys.add(key);
        normalizedRefs.push({ rowIndex, blockIndex });
      }
    }

    return normalizedRefs.sort(
      (left, right) =>
        left.rowIndex - right.rowIndex || left.blockIndex - right.blockIndex
    );
  };

  const cloneControlElemClipboardRows = (blockElements) =>
    controlElemClipboardRows
      .map((clipboardRow) => ({
        blocks: Array.isArray(clipboardRow.blocks)
          ? clipboardRow.blocks
            .map((block) => blockElements.cloneElement(block))
            .filter(Boolean)
          : [],
        rowProperty: blockElements.cloneBlockProperties(
          clipboardRow.rowProperty || new Block()
        ),
      }))
      .filter((clipboardRow) => clipboardRow.blocks.length > 0);

  // The block clipboard is also kept in localStorage, so it survives a refresh
  // and pastes into other tabs.
  const CONTROL_ELEM_CLIPBOARD_STORAGE_KEY = "signMaker.blockClipboard";
  let controlElemClipboardSavedAt = 0;
  const saveControlElemClipboard = () => {
    const rows = controlElemClipboardRows.map(({ blocks, rowProperty }) => ({
      blocks,
      rowProperty,
    }));
    addElementTypes(rows);
    try {
      controlElemClipboardSavedAt = Date.now();
      window.localStorage.setItem(
        CONTROL_ELEM_CLIPBOARD_STORAGE_KEY,
        JSON.stringify({ savedAt: controlElemClipboardSavedAt, rows })
      );
    } catch (error) {
      console.warn("Unable to save the block clipboard", error);
    } finally {
      removeElementTypes(rows);
    }
  };
  const loadStoredControlElemClipboard = () => {
    try {
      const stored = JSON.parse(
        window.localStorage.getItem(CONTROL_ELEM_CLIPBOARD_STORAGE_KEY) || "null"
      );
      if (!stored || !(stored.savedAt > controlElemClipboardSavedAt)) {
        return;
      }
      const control = reconstructControl({
        rows: stored.rows.map((row) => row.blocks),
        blockProperties: stored.rows.map((row) => row.rowProperty),
      });
      controlElemClipboardRows = control.rows.map((blocks, index) => ({
        blocks,
        rowProperty: control.blockProperties[index],
      }));
      controlElemClipboardSavedAt = stored.savedAt;
    } catch (error) {
      console.warn("Unable to read the stored block clipboard", error);
    }
  };

  const copyControlElements = (refs) => {
    const blockElements = getActiveBlockElements();
    const rows = blockElements?.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      controlElemClipboardRows = [];
      return { copied: false, copiedBlockCount: 0 };
    }

    const normalizedRefs = normalizeControlElemRefs(refs, blockElements);
    if (!normalizedRefs.length) {
      controlElemClipboardRows = [];
      return { copied: false, copiedBlockCount: 0 };
    }

    const clipboardRows = [];
    let currentClipboardRow = null;

    for (const ref of normalizedRefs) {
      if (!currentClipboardRow || currentClipboardRow.rowIndex !== ref.rowIndex) {
        currentClipboardRow = {
          rowIndex: ref.rowIndex,
          blocks: [],
          rowProperty: blockElements.cloneBlockProperties(
            blockElements.blockProperties[ref.rowIndex]
          ),
        };
        clipboardRows.push(currentClipboardRow);
      }

      currentClipboardRow.blocks.push(
        blockElements.cloneElement(rows[ref.rowIndex][ref.blockIndex])
      );
    }

    controlElemClipboardRows = clipboardRows;
    saveControlElemClipboard();
    return {
      copied: true,
      copiedBlockCount: normalizedRefs.length,
      rowCount: clipboardRows.length,
    };
  };

  const cutControlElements = (refs) => {
    const blockElements = getActiveBlockElements();
    const rows = blockElements?.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return { cut: false, copiedBlockCount: 0 };
    }

    const normalizedRefs = normalizeControlElemRefs(refs, blockElements);
    if (!normalizedRefs.length) {
      return { cut: false, copiedBlockCount: 0 };
    }

    const totalBlockCount = rows.reduce(
      (total, row) => total + (Array.isArray(row) ? row.length : 0),
      0
    );
    if (normalizedRefs.length >= totalBlockCount) {
      return {
        cut: false,
        copiedBlockCount: 0,
        reason: "At least one block must remain.",
      };
    }

    const copyResult = copyControlElements(normalizedRefs);
    if (!copyResult.copied) {
      return { cut: false, copiedBlockCount: 0 };
    }

    const firstSelection = normalizedRefs[0];
    const selectionsByRow = new Map();
    normalizedRefs.forEach(({ rowIndex, blockIndex }) => {
      if (!selectionsByRow.has(rowIndex)) {
        selectionsByRow.set(rowIndex, []);
      }
      selectionsByRow.get(rowIndex).push(blockIndex);
    });

    Array.from(selectionsByRow.keys())
      .sort((left, right) => right - left)
      .forEach((rowIndex) => {
        const row = rows[rowIndex];
        selectionsByRow
          .get(rowIndex)
          .sort((left, right) => right - left)
          .forEach((blockIndex) => row.splice(blockIndex, 1));

        if (row.length === 0) {
          rows.splice(rowIndex, 1);
          blockElements.blockProperties.splice(rowIndex, 1);
        }
      });

    currentlySelectedRowIndex = clamp(
      firstSelection.rowIndex,
      0,
      rows.length - 1
    );
    currentlySelectedBlockIndex = clamp(
      firstSelection.blockIndex,
      0,
      rows[currentlySelectedRowIndex].length - 1
    );

    formHandler.updateForm();
    redraw();
    return {
      cut: true,
      copiedBlockCount: copyResult.copiedBlockCount,
      rowCount: copyResult.rowCount,
    };
  };

  const pasteControlElements = () => {
    const blockElements = getActiveBlockElements();
    const rows = blockElements?.rows;
    if (!Array.isArray(rows)) {
      return { pasted: false, pastedBlockCount: 0 };
    }

    loadStoredControlElemClipboard();
    const clipboardRows = cloneControlElemClipboardRows(blockElements);
    if (!clipboardRows.length) {
      return { pasted: false, pastedBlockCount: 0 };
    }

    if (rows.length === 0) {
      rows.push([]);
      blockElements.blockProperties.push(new Block());
    }

    const targetRowIndex = clamp(
      currentlySelectedRowIndex,
      0,
      Math.max(0, rows.length - 1)
    );

    if (clipboardRows.length === 1) {
      const targetRow = rows[targetRowIndex];
      const insertIndex = targetRow.length
        ? clamp(currentlySelectedBlockIndex + 1, 0, targetRow.length)
        : 0;

      targetRow.splice(insertIndex, 0, ...clipboardRows[0].blocks);
      currentlySelectedRowIndex = targetRowIndex;
      currentlySelectedBlockIndex = insertIndex;
    } else {
      const insertRowIndex = clamp(targetRowIndex + 1, 0, rows.length);
      rows.splice(
        insertRowIndex,
        0,
        ...clipboardRows.map((clipboardRow) => clipboardRow.blocks)
      );
      blockElements.blockProperties.splice(
        insertRowIndex,
        0,
        ...clipboardRows.map((clipboardRow) => clipboardRow.rowProperty)
      );
      currentlySelectedRowIndex = insertRowIndex;
      currentlySelectedBlockIndex = 0;
    }

    formHandler.updateForm();
    redraw();
    return {
      pasted: true,
      pastedBlockCount: clipboardRows.reduce(
        (total, clipboardRow) => total + clipboardRow.blocks.length,
        0
      ),
      rowCount: clipboardRows.length,
    };
  };

  const replaceControlElemTypeAt = (rowIndex, blockIndex, nextElemType) => {
    if (!Control.prototype.blockToClassElems[nextElemType]) {
      return;
    }

    const blockElems = getActiveBlockElements();
    const rows = blockElems && blockElems.rows;
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
    currentlySelectedRowIndex = normalizedRowIndex;
    currentlySelectedBlockIndex = normalizedBlockIndex;

    if (previousElemType === nextElemType) {
      formHandler.updateForm();
      persistSessionState();
      return;
    }

    const Constructor = Control.prototype.blockToClassElems[nextElemType];
    if (typeof Constructor !== "function") {
      return;
    }

    row[normalizedBlockIndex] = blockDefaults.create(Constructor);
    formHandler.updateForm();
    redraw();
  };

  const delControlElem = () => {
    const blockElems = getActiveBlockElements();
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
  };

  const moveControlElem = (
    fromRowIndex,
    fromBlockIndex,
    toRowIndex,
    toBlockIndex
  ) => {
    const blockElements = getActiveBlockElements();
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
  };

  const duplicateBlockIntoNewRow = (sourceRowIndex, sourceBlockIndex) => {
    const blockElements = getActiveBlockElements();
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

    const duplicatedBlock =
      typeof blockElements.cloneElement === "function"
        ? blockElements.cloneElement(sourceBlock)
        : Object.assign(new Constructor(), sourceBlock);
    const insertRowIndex = clamp(
      normalizedRow + 1,
      0,
      blockElements.rows.length
    );

    blockElements.rows.splice(insertRowIndex, 0, [duplicatedBlock]);
    blockElements.blockProperties.splice(
      insertRowIndex,
      0,
      typeof blockElements.createBlockWithNeighborBackground === "function"
        ? blockElements.createBlockWithNeighborBackground(
          insertRowIndex,
          normalizedRow
        )
        : new Block()
    );

    currentlySelectedRowIndex = insertRowIndex;
    currentlySelectedBlockIndex = 0;
    formHandler.updateForm();
    redraw();
  };

  const setSelectedControlElem = (block) => {
    currentlySelectedBlockIndex = clamp(
      block,
      0,
      getCurrentBlockRows().length - 1
    );
    formHandler.updateForm();

    // Flash the selected block element on the sign
    const panelElmt = document.getElementById(
      "panel" + currentlySelectedPanelIndex
    );
    const subPanelContainer = panelElmt
      ? panelElmt.querySelector(
          `.blockElementMaster[data-subpanel="${currentlySelectedSubPanelIndex}"]`
        )
      : null;
    if (subPanelContainer) {
      const signBlockElmt = subPanelContainer.querySelector(
        `[data-sign-row="${currentlySelectedRowIndex}"][data-sign-block="${currentlySelectedBlockIndex}"]`
      );
      if (signBlockElmt) {
        flashElement(signBlockElmt);
      }
    }
    persistSessionState();
  };

  const duplicateControlElem = () => {
    const subPanel = getCurrentSubPanel();
    if (!subPanel || !subPanel.blockElements) {
      return;
    }
    const blockElements = getActiveBlockElements();
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
    const duplicatedBlock =
      typeof blockElements.cloneElement === "function"
        ? blockElements.cloneElement(sourceBlock)
        : Object.assign(new Constructor(), sourceBlock);
    const insertIndex = clamp(
      currentlySelectedBlockIndex + 1,
      0,
      row.length
    );
    row.splice(insertIndex, 0, duplicatedBlock);
    currentlySelectedBlockIndex = insertIndex;
    formHandler.updateForm();
    redraw();
  };

  const enterGroupElement = (
    rowIndex = currentlySelectedRowIndex,
    blockIndex = currentlySelectedBlockIndex
  ) => {
    const blockElements = getActiveBlockElements();
    const row = blockElements.rows[rowIndex];
    if (!Array.isArray(row)) {
      return false;
    }

    const groupElement = row[blockIndex];
    if (!(groupElement instanceof GroupedBlockElement)) {
      return false;
    }

    currentlyEditingGroupPath.push({ rowIndex, blockIndex });
    currentlySelectedRowIndex = 0;
    currentlySelectedBlockIndex = 0;
    normalizeEditorSelection();
    formHandler.updateForm();
    redraw();
    return true;
  };

  const exitGroupElement = () => {
    if (!currentlyEditingGroupPath.length) {
      return false;
    }

    const previousGroup = currentlyEditingGroupPath.pop();
    currentlySelectedRowIndex = previousGroup.rowIndex;
    currentlySelectedBlockIndex = previousGroup.blockIndex;
    normalizeEditorSelection();
    formHandler.updateForm();
    redraw();
    return true;
  };

  const groupSelectedBlockElements = (selectedBlocks = []) => {
    const blockElements = getActiveBlockElements();
    if (
      !blockElements ||
      !Array.isArray(blockElements.rows) ||
      !Array.isArray(selectedBlocks) ||
      selectedBlocks.length < 2
    ) {
      return false;
    }

    const validSelections = selectedBlocks
      .map((selection) => ({
        rowIndex: Number(selection.rowIndex),
        blockIndex: Number(selection.blockIndex),
      }))
      .filter(({ rowIndex, blockIndex }) => {
        const row = blockElements.rows[rowIndex];
        return (
          Number.isInteger(rowIndex) &&
          Number.isInteger(blockIndex) &&
          Array.isArray(row) &&
          blockIndex >= 0 &&
          blockIndex < row.length
        );
      })
      .sort((a, b) =>
        a.rowIndex === b.rowIndex
          ? a.blockIndex - b.blockIndex
          : a.rowIndex - b.rowIndex
      );

    const uniqueSelections = [];
    const seenSelectionKeys = new Set();
    for (const selection of validSelections) {
      const key = `${selection.rowIndex}:${selection.blockIndex}`;
      if (!seenSelectionKeys.has(key)) {
        seenSelectionKeys.add(key);
        uniqueSelections.push(selection);
      }
    }

    if (uniqueSelections.length < 2) {
      return false;
    }

    const firstSelection = uniqueSelections[0];
    const sourceRows = new Map();
    for (const selection of uniqueSelections) {
      if (!sourceRows.has(selection.rowIndex)) {
        sourceRows.set(selection.rowIndex, []);
      }
      sourceRows.get(selection.rowIndex).push(selection.blockIndex);
    }

    const groupedRows = [];
    const groupedBlockProperties = [];
    for (const [rowIndex, blockIndexes] of sourceRows.entries()) {
      const sourceRow = blockElements.rows[rowIndex];
      const groupedRow = blockIndexes.map((blockIndex) => sourceRow[blockIndex]);
      groupedRows.push(groupedRow);
      groupedBlockProperties.push(
        blockElements.cloneBlockProperties(
          blockElements.blockProperties[rowIndex]
        )
      );
    }

    const parentInsertProperties = blockElements.cloneBlockProperties(
      blockElements.blockProperties[firstSelection.rowIndex]
    );

    const rowIndexesDescending = Array.from(sourceRows.keys()).sort(
      (a, b) => b - a
    );
    let firstRowWasRemoved = false;
    let insertBlockIndex = firstSelection.blockIndex;

    for (const rowIndex of rowIndexesDescending) {
      const sourceRow = blockElements.rows[rowIndex];
      const blockIndexesDescending = sourceRows
        .get(rowIndex)
        .slice()
        .sort((a, b) => b - a);

      for (const blockIndex of blockIndexesDescending) {
        sourceRow.splice(blockIndex, 1);
      }

      if (rowIndex === firstSelection.rowIndex) {
        insertBlockIndex = firstSelection.blockIndex;
      }

      if (sourceRow.length === 0) {
        blockElements.rows.splice(rowIndex, 1);
        blockElements.blockProperties.splice(rowIndex, 1);
        if (rowIndex === firstSelection.rowIndex) {
          firstRowWasRemoved = true;
        }
      }
    }

    const groupedBlock = new GroupedBlockElement({
      blockElements: new Control({
        rows: groupedRows,
        blockProperties: groupedBlockProperties,
      }),
    });

    if (firstRowWasRemoved || !blockElements.rows[firstSelection.rowIndex]) {
      const insertRowIndex = clamp(
        firstSelection.rowIndex,
        0,
        blockElements.rows.length
      );
      blockElements.rows.splice(insertRowIndex, 0, [groupedBlock]);
      blockElements.blockProperties.splice(
        insertRowIndex,
        0,
        parentInsertProperties
      );
      currentlySelectedRowIndex = insertRowIndex;
      currentlySelectedBlockIndex = 0;
    } else {
      const targetRow = blockElements.rows[firstSelection.rowIndex];
      targetRow.splice(
        clamp(insertBlockIndex, 0, targetRow.length),
        0,
        groupedBlock
      );
      currentlySelectedRowIndex = firstSelection.rowIndex;
      currentlySelectedBlockIndex = clamp(
        insertBlockIndex,
        0,
        targetRow.length - 1
      );
    }

    formHandler.updateForm();
    redraw();
    return true;
  };

  const ungroupSelectedBlockElement = () => {
    const blockElements = getActiveBlockElements();
    const row = blockElements.rows[currentlySelectedRowIndex];
    if (!Array.isArray(row)) {
      return false;
    }

    const groupElement = row[currentlySelectedBlockIndex];
    if (!(groupElement instanceof GroupedBlockElement)) {
      return false;
    }

    const nestedControl = groupElement.blockElements;
    const nestedRows = Array.isArray(nestedControl?.rows)
      ? nestedControl.rows
      : [];
    if (!nestedRows.length) {
      row.splice(currentlySelectedBlockIndex, 1);
      formHandler.updateForm();
      redraw();
      return true;
    }

    const parentRowProperties = blockElements.cloneBlockProperties(
      blockElements.blockProperties[currentlySelectedRowIndex]
    );
    const beforeGroup = row.slice(0, currentlySelectedBlockIndex);
    const afterGroup = row.slice(currentlySelectedBlockIndex + 1);
    const replacementRows = nestedRows.map((nestedRow, index) => {
      const sourceRow = Array.isArray(nestedRow) ? nestedRow : [];
      if (nestedRows.length === 1) {
        return beforeGroup.concat(sourceRow, afterGroup);
      }
      if (index === 0) {
        return beforeGroup.concat(sourceRow);
      }
      if (index === nestedRows.length - 1) {
        return sourceRow.concat(afterGroup);
      }
      return sourceRow;
    });
    const replacementBlockProperties = replacementRows.map((_, index) =>
      nestedControl && typeof nestedControl.cloneBlockProperties === "function"
        ? nestedControl.cloneBlockProperties(
          nestedControl.blockProperties[index] || parentRowProperties
        )
        : blockElements.cloneBlockProperties(parentRowProperties)
    );

    blockElements.rows.splice(
      currentlySelectedRowIndex,
      1,
      ...replacementRows
    );
    blockElements.blockProperties.splice(
      currentlySelectedRowIndex,
      1,
      ...replacementBlockProperties
    );

    currentlySelectedBlockIndex = clamp(
      beforeGroup.length,
      0,
      Math.max(0, replacementRows[0].length - 1)
    );
    formHandler.updateForm();
    redraw();
    return true;
  };

  const APL_ARROW_KINDS = {
    UP: { type: "APL_UP", flip: false },
    UP_LEFT: { type: "APL_UP_TURN", flip: true },
    UP_RIGHT: { type: "APL_UP_TURN", flip: false },
    DUAL_TURN: { type: "APL_DUAL_TURN", flip: false },
    LEFT_TURN: { type: "APL_TURN", flip: true },
    RIGHT_TURN: { type: "APL_TURN", flip: false },
    UP_CFX: { type: "APL_UP_CFX", flip: false },
    UP_LEFT_CFX: { type: "APL_UP_TURN_CFX", flip: true },
    UP_RIGHT_CFX: { type: "APL_UP_TURN_CFX", flip: false },
    LEFT_TURN_CFX: { type: "APL_TURN_CFX", flip: true },
    RIGHT_TURN_CFX: { type: "APL_TURN_CFX", flip: false },
  };

  const DEFAULT_APL_ARROW_SPACING_REM = 12;
  const APL_ARROW_ZONE_EXTRA_REM = 1.15;
  const APL_ARROW_EDGE_PADDING_REM = 1;
  const APL_ARROW_OUTER_EDGE_PADDING_REM = APL_ARROW_EDGE_PADDING_REM / 4;
  const APL_EXIT_ONLY_STRAIGHT_GAP_REM = 1.15;
  const APL_EXIT_ONLY_TURN_GAP_REM = 0.72;
  const APL_EXIT_ONLY_TURN_STEM_OFFSET_REM = 1.1;

  const getDefaultAPLArrowSizeRem = function (arrowType) {
    if (arrowType === "APL_TURN") return 3.5;
    if (arrowType === "APL_TURN_CFX") return 3.25;
    if (arrowType === "APL_DUAL_TURN") return 4.5;
    return 4.75;
  };

  const normalizeAPLArrowSpacing = function (
    value,
    fallback = DEFAULT_APL_ARROW_SPACING_REM
  ) {
    if (value == null || String(value).trim() === "") {
      return fallback;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };

  const normalizeAPLArrowData = function (arrow) {
    if (!arrow || typeof arrow !== "object") {
      return arrow;
    }

    const legacyLeftSpacing =
      arrow.arrowMarginLeft == null ? NaN : Number(arrow.arrowMarginLeft);
    const legacyRightSpacing =
      arrow.arrowMarginRight == null ? NaN : Number(arrow.arrowMarginRight);
    arrow.spacingBeforeRem = normalizeAPLArrowSpacing(
      arrow.spacingBeforeRem,
      Number.isFinite(legacyLeftSpacing)
        ? Math.max(0, legacyLeftSpacing)
        : DEFAULT_APL_ARROW_SPACING_REM
    );
    arrow.spacingAfterRem = normalizeAPLArrowSpacing(
      arrow.spacingAfterRem,
      Number.isFinite(legacyRightSpacing)
        ? Math.max(0, legacyRightSpacing)
        : DEFAULT_APL_ARROW_SPACING_REM
    );

    const parsedSize = Number(arrow.arrowSizeRem);
    arrow.arrowSizeRem =
      Number.isFinite(parsedSize) && parsedSize > 0
        ? parsedSize
        : getDefaultAPLArrowSizeRem(arrow.type);

    arrow.aplSpacingInitialized = true;
    return arrow;
  };

  const getAPLArrowKind = function (arrow) {
    if (arrow && APL_ARROW_KINDS[arrow.kind]) {
      return arrow.kind;
    }
    if (!arrow || arrow.type === "APL_UP") return "UP";
    if (arrow.type === "APL_UP_TURN") return arrow.flip ? "UP_LEFT" : "UP_RIGHT";
    if (arrow.type === "APL_DUAL_TURN") return "DUAL_TURN";
    if (arrow.type === "APL_TURN") return arrow.flip ? "LEFT_TURN" : "RIGHT_TURN";
    if (arrow.type === "APL_UP_CFX") return "UP_CFX";
    if (arrow.type === "APL_UP_TURN_CFX") {
      return arrow.flip ? "UP_LEFT_CFX" : "UP_RIGHT_CFX";
    }
    if (arrow.type === "APL_TURN_CFX") {
      return arrow.flip ? "LEFT_TURN_CFX" : "RIGHT_TURN_CFX";
    }
    return "UP";
  };

  const normalizeAPLArrowKind = function (kindOrType, arrow) {
    if (APL_ARROW_KINDS[kindOrType]) {
      return kindOrType;
    }
    if (kindOrType === "APL_UP_TURN") {
      return arrow && arrow.flip ? "UP_LEFT" : "UP_RIGHT";
    }
    if (kindOrType === "APL_TURN") {
      return arrow && arrow.flip ? "LEFT_TURN" : "RIGHT_TURN";
    }
    if (kindOrType === "APL_DUAL_TURN") {
      return "DUAL_TURN";
    }
    if (kindOrType === "APL_UP_CFX") {
      return "UP_CFX";
    }
    if (kindOrType === "APL_UP_TURN_CFX") {
      return arrow && arrow.flip ? "UP_LEFT_CFX" : "UP_RIGHT_CFX";
    }
    if (kindOrType === "APL_TURN_CFX") {
      return arrow && arrow.flip ? "LEFT_TURN_CFX" : "RIGHT_TURN_CFX";
    }
    return "UP";
  };

  const applyAPLArrowKind = function (arrow, kindOrType) {
    if (!arrow) {
      return;
    }
    const kind = normalizeAPLArrowKind(kindOrType, arrow);
    const definition = APL_ARROW_KINDS[kind] || APL_ARROW_KINDS.UP;
    arrow.kind = kind;
    arrow.type = definition.type;
    arrow.flip = definition.flip;
    normalizeAPLArrowData(arrow);
  };

  const createAPLArrowData = function (kindOrType = "UP") {
    const sign = getCurrentPanel().sign;
    sign.newAPLArrow((APL_ARROW_KINDS[kindOrType] || {}).type || kindOrType || "APL_UP");
    const arrow = sign.aplArrows.pop();
    applyAPLArrowKind(arrow, kindOrType);
    arrow.arrowSizeRem = getDefaultAPLArrowSizeRem(arrow.type);
    return arrow;
  };

  const isAPLDividerArrow = function (arrow) {
    return arrow?.placement === "divider" || arrow?.groupedWithDivider === true;
  };

  const orderAPLBucketForRendering = function (bucket) {
    return bucket
      .filter((arrow) => !isAPLDividerArrow(arrow))
      .concat(bucket.filter((arrow) => isAPLDividerArrow(arrow)));
  };

  const getAPLArrowBuckets = function (sign) {
    const subPanelCount = Math.max(1, sign?.subPanels?.length || 1);
    const buckets = Array.from({ length: subPanelCount }, () => []);
    const aplArrows = sign?.aplArrows || [];
    aplArrows.forEach(normalizeAPLArrowData);
    const hasExplicitPlacement = aplArrows.some((arrow) => {
      return (
        arrow &&
        (arrow.placement === "subpanel" ||
          arrow.placement === "divider" ||
          Number.isFinite(Number(arrow.subPanelIndex)) ||
          Number.isFinite(Number(arrow.dividerAfterSubPanelIndex)))
      );
    });

    if (hasExplicitPlacement) {
      for (const arrow of aplArrows) {
        if (isAPLDividerArrow(arrow)) {
          const dividerIndex = clampFinite(
            arrow.dividerAfterSubPanelIndex,
            0,
            Math.max(0, subPanelCount - 2),
            0
          );
          arrow.placement = "divider";
          arrow.groupedWithDivider = true;
          arrow.dividerAfterSubPanelIndex = dividerIndex;
          delete arrow.subPanelIndex;
          buckets[dividerIndex].push(arrow);
        } else {
          const targetSubPanelIndex = clampFinite(
            arrow.subPanelIndex,
            0,
            subPanelCount - 1,
            0
          );
          arrow.placement = "subpanel";
          arrow.groupedWithDivider = false;
          arrow.subPanelIndex = targetSubPanelIndex;
          delete arrow.dividerAfterSubPanelIndex;
          buckets[targetSubPanelIndex].push(arrow);
        }
      }

      return buckets.map(orderAPLBucketForRendering);
    }

    let bucketIndex = 0;

    for (const arrow of aplArrows) {
      buckets[Math.min(bucketIndex, subPanelCount - 1)].push(arrow);
      if (arrow.dividerAfter && bucketIndex < subPanelCount - 1) {
        bucketIndex++;
      }
    }

    return buckets.map(orderAPLBucketForRendering);
  };

  const rebuildAPLArrowBuckets = function (sign, buckets) {
    const subPanelCount = Math.max(1, sign?.subPanels?.length || 1);
    const normalizedBuckets = Array.from(
      { length: subPanelCount },
      (_, index) => Array.isArray(buckets[index]) ? buckets[index] : []
    );
    const rebuiltArrows = [];

    normalizedBuckets.forEach((bucket, bucketIndex) => {
      const orderedBucket = orderAPLBucketForRendering(bucket);

      orderedBucket.forEach((arrow, arrowIndex) => {
        if (isAPLDividerArrow(arrow)) {
          arrow.placement = "divider";
          arrow.groupedWithDivider = true;
          arrow.dividerAfterSubPanelIndex = Math.min(
            bucketIndex,
            Math.max(0, subPanelCount - 2)
          );
          delete arrow.subPanelIndex;
        } else {
          arrow.placement = "subpanel";
          arrow.groupedWithDivider = false;
          arrow.subPanelIndex = bucketIndex;
          delete arrow.dividerAfterSubPanelIndex;
        }

        arrow.dividerAfter =
          bucketIndex < subPanelCount - 1 && arrowIndex === orderedBucket.length - 1;
        rebuiltArrows.push(arrow);
      });
    });

    sign.aplArrows = rebuiltArrows;
  };

  const getAPLSubpanelGroupsForCurrentPanel = function () {
    const sign = getCurrentPanel().sign;
    const buckets = getAPLArrowBuckets(sign);

    return buckets.map((bucket, index) => {
      const arrowIndexes = bucket
        .map((arrow) => sign.aplArrows.indexOf(arrow))
        .filter((arrowIndex) => arrowIndex >= 0);
      return {
        start: index,
        end: index,
        indices: [index],
        groupIndex: index,
        label: "Subpanel " + (index + 1),
        arrowIndexes,
      };
    });
  };

  // APL Arrow Management Functions
  const addAPLArrow = function (
    kindOrType = "UP",
    { placement = "subpanel", subPanelIndex = currentlySelectedSubPanelIndex, dividerAfterSubPanelIndex = 0 } = {}
  ) {
    const sign = getCurrentPanel().sign;
    const arrow = createAPLArrowData(kindOrType || "UP");
    const shouldPlaceInBucket = arguments.length > 1;

    if (shouldPlaceInBucket) {
      const buckets = getAPLArrowBuckets(sign);
      const targetIndex =
        placement === "divider"
          ? clampFinite(
            dividerAfterSubPanelIndex,
            0,
            Math.max(0, buckets.length - 2),
            0
          )
          : clampFinite(subPanelIndex, 0, buckets.length - 1, 0);

      arrow.groupedWithDivider = placement === "divider";
      arrow.exitOnly = placement === "divider" ? false : !!arrow.exitOnly;
      buckets[targetIndex].push(arrow);
      rebuildAPLArrowBuckets(sign, buckets);
      currentlySelectedAPLArrowIndex = sign.aplArrows.indexOf(arrow);
    } else {
      sign.aplArrows.push(arrow);
      currentlySelectedAPLArrowIndex = sign.aplArrows.length - 1;
    }

    sign.arrowMode = "apl";
    sign.guideArrow = "None";
    sign.bottomArrowKind = "None";
    sign.bottomArrowRotation = 0;
    formHandler.updateForm();
    redraw();
  };

  const removeAPLArrowAt = function (index) {
    const sign = getCurrentPanel().sign;
    if (index < 0 || index >= sign.aplArrows.length) {
      return;
    }
    sign.aplArrows.splice(index, 1);
    currentlySelectedAPLArrowIndex = clamp(
      currentlySelectedAPLArrowIndex,
      0,
      Math.max(0, sign.aplArrows.length - 1)
    );
    formHandler.updateForm();
    redraw();
  };

  const removeAPLArrow = function () {
    const sign = getCurrentPanel().sign;
    if (sign.aplArrows.length === 0) {
      return;
    }
    removeAPLArrowAt(currentlySelectedAPLArrowIndex);
  };

  const selectAPLArrow = function (index) {
    const sign = getCurrentPanel().sign;
    currentlySelectedAPLArrowIndex = clamp(index, 0, Math.max(0, sign.aplArrows.length - 1));
    formHandler.updateForm();
    persistSessionState();
  };

  const updateAPLArrowType = function (kindOrType, index = currentlySelectedAPLArrowIndex) {
    const sign = getCurrentPanel().sign;
    if (sign.aplArrows.length > 0 && index >= 0 && index < sign.aplArrows.length) {
      const arrow = sign.aplArrows[index];
      applyAPLArrowKind(arrow, kindOrType);
      arrow.arrowSizeRem = getDefaultAPLArrowSizeRem(arrow.type);
      currentlySelectedAPLArrowIndex = index;
      formHandler.updateForm();
      redraw();
    }
  };

  const toggleAPLArrowFlip = function (index) {
    const sign = getCurrentPanel().sign;
    const targetIndex = typeof index === 'number' ? index : currentlySelectedAPLArrowIndex;
    if (sign.aplArrows.length > 0 && targetIndex >= 0 && targetIndex < sign.aplArrows.length) {
      sign.toggleAPLArrowFlip(targetIndex);
      formHandler.updateForm();
      redraw();
    }
  };

  const addAPLDivider = function (arrowIndex) {
    const sign = getCurrentPanel().sign;
    if (arrowIndex >= 0 && arrowIndex < sign.aplArrows.length) {
      const arrow = sign.aplArrows[arrowIndex];
      if (arrow.dividerAfter) {
        // Toggle off - remove divider
        sign.setAPLDivider(arrowIndex, false);
        // Remove the associated subpanel if there are more than 1
        if (sign.subPanels.length > 1) {
          sign.deleteSubPanel(sign.subPanels.length - 2);
          currentlySelectedSubPanelIndex = Math.max(0, currentlySelectedSubPanelIndex - 1);
        }
      } else {
        // Toggle on - add divider and create subpanel
        if (confirm("This will add a new subpanel. Continue?")) {
          sign.setAPLDivider(arrowIndex, true);
          sign.newSubPanel();
          currentlySelectedSubPanelIndex++;
        }
      }
      formHandler.updateForm();
      redraw();
    }
  };

  const addAPLDividerArrow = function (dividerAfterSubPanelIndex) {
    addAPLArrow("UP_RIGHT", {
      placement: "divider",
      dividerAfterSubPanelIndex,
    });
  };

  const setAPLArrowSpacing = function (arrowIndex, spacingRem) {
    const sign = getCurrentPanel().sign;
    const arrow = sign.aplArrows[arrowIndex];
    if (!arrow) {
      return;
    }

    arrow.spacingAfterRem = normalizeAPLArrowSpacing(spacingRem);
    arrow.aplSpacingInitialized = true;
    formHandler.updateForm();
    redraw();
  };

  const setAPLArrowBeforeSpacing = function (arrowIndex, spacingRem) {
    const sign = getCurrentPanel().sign;
    const arrow = sign.aplArrows[arrowIndex];
    if (!arrow) {
      return;
    }

    arrow.spacingBeforeRem = normalizeAPLArrowSpacing(spacingRem);
    arrow.aplSpacingInitialized = true;
    formHandler.updateForm();
    redraw();
  };

  const setAPLArrowSize = function (arrowIndex, sizeRem) {
    const sign = getCurrentPanel().sign;
    const arrow = sign.aplArrows[arrowIndex];
    if (!arrow) {
      return;
    }

    const parsedSize = Number(sizeRem);
    arrow.arrowSizeRem =
      Number.isFinite(parsedSize) && parsedSize > 0
        ? parsedSize
        : getDefaultAPLArrowSizeRem(arrow.type);
    formHandler.updateForm();
    redraw();
  };

  const moveAPLArrow = function (
    fromIndex,
    { placement = "subpanel", subPanelIndex = 0, dividerAfterSubPanelIndex = 0, beforeIndex = null } = {}
  ) {
    const sign = getCurrentPanel().sign;
    if (fromIndex < 0 || fromIndex >= sign.aplArrows.length) {
      return;
    }

    const arrow = sign.aplArrows[fromIndex];
    const buckets = getAPLArrowBuckets(sign);

    for (const bucket of buckets) {
      const existingIndex = bucket.indexOf(arrow);
      if (existingIndex >= 0) {
        bucket.splice(existingIndex, 1);
        break;
      }
    }

    const targetIndex =
      placement === "divider"
        ? clampFinite(
          dividerAfterSubPanelIndex,
          0,
          Math.max(0, buckets.length - 2),
          0
        )
        : clampFinite(subPanelIndex, 0, buckets.length - 1, 0);
    const targetBucket = buckets[targetIndex];
    const beforeArrow =
      typeof beforeIndex === "number" && beforeIndex >= 0
        ? sign.aplArrows[beforeIndex]
        : null;
    const insertIndex = beforeArrow ? targetBucket.indexOf(beforeArrow) : -1;

    arrow.groupedWithDivider = placement === "divider";
    if (placement === "divider") {
      arrow.exitOnly = false;
    }

    if (insertIndex >= 0) {
      targetBucket.splice(insertIndex, 0, arrow);
    } else {
      targetBucket.push(arrow);
    }

    rebuildAPLArrowBuckets(sign, buckets);
    currentlySelectedAPLArrowIndex = sign.aplArrows.indexOf(arrow);
    formHandler.updateForm();
    redraw();
  };

  const initializeAPLArrowsForCurrentPanel = function () {
    const sign = getCurrentPanel().sign;
    sign.arrowMode = "apl";
    sign.guideArrow = "None";
    sign.bottomArrowKind = "None";
    sign.bottomArrowRotation = 0;

    if (sign.aplArrows && sign.aplArrows.length > 0) {
      formHandler.updateForm();
      redraw();
      return;
    }

    const subPanelCount = Math.max(1, sign.subPanels.length);
    const buckets = Array.from({ length: subPanelCount }, () => []);
    const makeArrow = function (kind, groupedWithDivider = false) {
      const arrow = createAPLArrowData(kind);
      arrow.groupedWithDivider = groupedWithDivider;
      arrow.exitOnly = false;
      return arrow;
    };

    if (subPanelCount === 1) {
      buckets[0].push(makeArrow("UP"));
    } else if (subPanelCount === 2) {
      buckets[0].push(makeArrow("UP"));
      buckets[0].push(makeArrow("UP_RIGHT", true));
      buckets[1].push(makeArrow("RIGHT_TURN"));
    } else if (subPanelCount === 3) {
      buckets[0].push(makeArrow("LEFT_TURN"));
      buckets[0].push(makeArrow("UP_LEFT", true));
      buckets[1].push(makeArrow("UP"));
      buckets[1].push(makeArrow("UP_RIGHT", true));
      buckets[2].push(makeArrow("RIGHT_TURN"));
    } else {
      for (let index = 0; index < subPanelCount; index++) {
        const isFirst = index === 0;
        const isLast = index === subPanelCount - 1;
        buckets[index].push(
          makeArrow(isFirst ? "LEFT_TURN" : isLast ? "RIGHT_TURN" : "UP")
        );

        if (!isLast) {
          buckets[index].push(makeArrow(isFirst ? "UP_LEFT" : "UP_RIGHT", true));
        }
      }
    }

    rebuildAPLArrowBuckets(sign, buckets);
    currentlySelectedAPLArrowIndex = 0;
    formHandler.updateForm();
    redraw();
  };

  const setAPLCombineExitOnlyLabels = function (enabled) {
    const sign = getCurrentPanel().sign;
    sign.combineAPLExitOnlyLabels = !!enabled;
    formHandler.updateForm();
    redraw();
  };

  const addAPLSubPanelLeftAndOpen = function () {
    const sign = getCurrentPanel().sign;
    const selectedIndex = clamp(
      currentlySelectedSubPanelIndex,
      0,
      Math.max(0, sign.subPanels.length - 1)
    );
    sign.newSubPanel();
    const newSubPanel = sign.subPanels.pop();
    sign.subPanels.splice(selectedIndex, 0, newSubPanel);
    currentlySelectedSubPanelIndex = selectedIndex;
    resetGroupEditing();
    formHandler.updateForm();
    redraw();
  };

  const addAPLSubPanelRightAndOpen = function () {
    const sign = getCurrentPanel().sign;
    const selectedIndex = clamp(
      currentlySelectedSubPanelIndex,
      0,
      Math.max(0, sign.subPanels.length - 1)
    );
    sign.newSubPanel();
    const newSubPanel = sign.subPanels.pop();
    sign.subPanels.splice(selectedIndex + 1, 0, newSubPanel);
    currentlySelectedSubPanelIndex = selectedIndex + 1;
    resetGroupEditing();
    formHandler.updateForm();
    redraw();
  };

  const setCurrentPanelArrowMode = function (mode) {
    const sign = getCurrentPanel().sign;
    sign.arrowMode = mode === "apl" ? "apl" : "standard";
    if (sign.arrowMode === "apl") {
      sign.guideArrow = "None";
      sign.bottomArrowKind = "None";
      sign.bottomArrowRotation = 0;
    }
    formHandler.updateForm();
    redraw();
  };

  const buildMileageTemplate = () => {
    const destinations = ["A", "B", "C"];
    const rows = destinations.map((label) => [
      new ControlTextElement({ textContent: `Destination ${label}` }),
      new DividerElement({
        visible: false,
        dividerWidth: 3,
        dividerMeasurement: "rem",
        fullBleed: true,
      }),
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
    resetGroupEditing();
    currentlySelectedRowIndex = 0;
    currentlySelectedBlockIndex = 0;
    formHandler.updateForm();
    redraw();
  };

  /**
    Download the sign from options
  */

  // Export choices are main panels (a stack exports together); hidden
  // panels can't be chosen.
  const getExportablePanelIndices = () =>
    post.panels
      .map((panel, index) => index)
      .filter((index) => !isStackedPanelBottom(index) && !isPanelHiddenFromPost(index));

  const getSelectedExportPanels = () => {
    const exportable = getExportablePanelIndices();
    const selected = (Array.isArray(fileInfo.panels) ? fileInfo.panels : [fileInfo.panel])
      .map((index) => getStackedPanelTopIndex(Number(index)))
      .filter((index) => exportable.includes(index));
    return selected.length ? [...new Set(selected)] : exportable.slice(0, 1);
  };

  // The rendered element for a main panel: its stack when it has one.
  const getRenderedPanelGroupElement = (panelIndex) => {
    const panelElmt = document.getElementById("panel" + panelIndex);
    return panelElmt?.parentElement?.classList.contains("panelStack")
      ? panelElmt.parentElement
      : panelElmt;
  };

  function getFile() {
    if (fileInfo.panel == -1) {
      return document.querySelector("#postContainer");
    }

    const panels = getSelectedExportPanels();
    if (panels.length > 1) {
      return document.querySelector("#panelContainer");
    }
    return getRenderedPanelGroupElement(panels[0] ?? 0);
  }

  // Several selected panels export together; the others are hidden meanwhile.
  // Exports run one at a time so a preview never restores a download's panels.
  let exportPanelSelectionQueue = Promise.resolve();
  const withExportPanelSelection = (callback) => {
    const run = exportPanelSelectionQueue.then(() => exportPanelSelection(callback));
    exportPanelSelectionQueue = run.catch(() => {});
    return run;
  };
  const exportPanelSelection = async (callback) => {
    const panels = getSelectedExportPanels();
    const hidden = [];
    if (fileInfo.panel != -1 && panels.length > 1) {
      document.querySelectorAll(
        "#panelContainer > .panel, #panelContainer > .panelStack"
      ).forEach((panelElmt) => {
        if (!panels.includes(Number(panelElmt.dataset.panelIndex))) {
          hidden.push([panelElmt, panelElmt.style.display]);
          panelElmt.style.display = "none";
        }
      });
    }
    try {
      return await callback(getFile());
    } finally {
      hidden.forEach(([panelElmt, display]) => {
        panelElmt.style.display = display;
      });
    }
  };

  const renderDownloadPanelButtons = () => {
    const holder = document.getElementById("downloadPanelButtons");
    const selected = getSelectedExportPanels();
    holder.replaceChildren(
      ...getExportablePanelIndices().map((index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = getPanelDisplayLabel(index);
        button.className = selected.includes(index) ? "activated" : "";
        button.setAttribute("aria-pressed", String(selected.includes(index)));
        button.addEventListener("click", () => {
          const next = selected.includes(index)
            ? selected.filter((value) => value !== index)
            : selected.concat(index).sort((a, b) => a - b);
          if (next.length) {
            fileInfo.panels = next;
            updatePreview();
          }
        });
        return button;
      })
    );
  };

  const openExportDialog = () => {
    const panels = getSelectedExportPanels();
    fileInfo.panels = panels.length ? panels : [currentlySelectedPanelIndex];
    document.getElementById("modalHolder").style.display = "flex";
    const dialog = document.getElementById("downloadContent");
    dialog.style.display = "flex";
    if (!dialog.open) {
      dialog.showModal();
    }
    updateFileType(fileInfo.fileType === "svg" ? "svg" : "png");
  };

  const copyExportSelection = async () => {
    const button = document.getElementById("copyDownload");
    try {
      await withExportPanelSelection(async (file) => {
        if (fileInfo.fileType === "svg") {
          const svgDataUrl = await renderSignExport(file, "svg", false);
          const svgText = decodeURIComponent(svgDataUrl.slice(svgDataUrl.indexOf(",") + 1));
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/svg+xml": new Blob([svgText], { type: "image/svg+xml" }) }),
            ]);
          } catch (error) {
            // Not every browser accepts SVG images on the clipboard; copy the markup.
            await navigator.clipboard.writeText(svgText);
          }
        } else {
          await copyExportTargetToClipboard(file);
        }
      });
      button.textContent = "Copied";
    } catch (error) {
      console.error("Unable to copy the export", error);
      button.textContent = "Copy failed";
    }
    setTimeout(() => {
      button.textContent = "Copy";
    }, 1500);
  };

  const downloadFile = function (dataURL, ending) {
    let a = document.createElement(`a`);
    a.setAttribute("href", dataURL);
    a.setAttribute("download", "downloadedSign" + ending);
    a.click();
    a.remove();
  };

  const downloadBlob = function (blob, ending) {
    const url = URL.createObjectURL(blob);
    let a = document.createElement("a");
    a.setAttribute("href", url);
    a.setAttribute("download", "downloadedSign" + ending);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  const MAX_EXPORT_CANVAS_DIMENSION = 16384;
  const MAX_EXPORT_CANVAS_PIXELS = 134217728;

  const getExportPixelRatio = (width, height, isPreview) => {
    if (isPreview) {
      return 1;
    }

    const safeWidth = Math.max(width, 1);
    const safeHeight = Math.max(height, 1);
    const dimensionRatio =
      MAX_EXPORT_CANVAS_DIMENSION / Math.max(safeWidth, safeHeight);
    const areaRatio = Math.sqrt(
      MAX_EXPORT_CANVAS_PIXELS / Math.max(safeWidth * safeHeight, 1)
    );
    const maxRatio = Math.min(dimensionRatio, areaRatio);
    const requestedRatio = Number.isFinite(post.copyScale) ? post.copyScale : 8;
    const safeRequestedRatio = requestedRatio <= 0 ? 0.1 : requestedRatio;

    return Math.max(0.1, Math.min(safeRequestedRatio, Math.floor(maxRatio * 100) / 100));
  };

  const getExportBox = (element) => {
    const rect = element.getBoundingClientRect();
    const exportWidth = Number.parseFloat(element.dataset?.exportWidth || "");
    const exportHeight = Number.parseFloat(element.dataset?.exportHeight || "");

    if (
      Number.isFinite(exportWidth) &&
      exportWidth > 0 &&
      Number.isFinite(exportHeight) &&
      exportHeight > 0
    ) {
      return {
        width: Math.ceil(exportWidth),
        height: Math.ceil(exportHeight),
      };
    }

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

  const loadImageFromBlob = (blob) =>
    new Promise((resolve, reject) => {
      const imageUrl = URL.createObjectURL(blob);
      const image = new Image();
      const cleanup = () => URL.revokeObjectURL(imageUrl);

      image.onload = () => {
        cleanup();
        resolve(image);
      };
      image.onerror = () => {
        cleanup();
        reject(new Error("Unable to decode exported PNG"));
      };
      image.src = imageUrl;
    });

  const decodeImageForTrim = async (blob) => {
    if (typeof createImageBitmap === "function") {
      try {
        const imageBitmap = await createImageBitmap(blob);
        return {
          image: imageBitmap,
          cleanup: () => {
            if (typeof imageBitmap.close === "function") {
              imageBitmap.close();
            }
          },
        };
      } catch (error) {
        // Fall back to Image decoding below.
      }
    }

    return {
      image: await loadImageFromBlob(blob),
      cleanup: () => {},
    };
  };

  const trimTransparentPngBlob = async (blob) => {
    if (!blob) {
      return blob;
    }

    let decodedImage = null;

    try {
      decodedImage = await decodeImageForTrim(blob);
      const image = decodedImage.image;
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;

      if (!width || !height) {
        return blob;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context) {
        return blob;
      }

      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, width, height).data;
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const alpha = pixels[(y * width + x) * 4 + 3];

          if (alpha === 0) {
            continue;
          }

          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }

      if (
        maxX < minX ||
        maxY < minY ||
        (minX === 0 && minY === 0 && maxX === width - 1 && maxY === height - 1)
      ) {
        return blob;
      }

      const trimWidth = maxX - minX + 1;
      const trimHeight = maxY - minY + 1;
      const trimCanvas = document.createElement("canvas");
      trimCanvas.width = trimWidth;
      trimCanvas.height = trimHeight;
      const trimContext = trimCanvas.getContext("2d");

      if (!trimContext) {
        return blob;
      }

      trimContext.drawImage(
        canvas,
        minX,
        minY,
        trimWidth,
        trimHeight,
        0,
        0,
        trimWidth,
        trimHeight
      );

      return await new Promise((resolve) => {
        trimCanvas.toBlob((trimmedBlob) => {
          resolve(trimmedBlob || blob);
        }, "image/png");
      });
    } catch (error) {
      return blob;
    } finally {
      if (decodedImage) {
        decodedImage.cleanup();
      }
    }
  };

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

      let resolvedUrl = rawUrl;

      try {
        resolvedUrl = new URL(rawUrl, baseHref || document.baseURI).href;
        const response = await fetch(resolvedUrl);

        if (!response.ok) {
          throw new Error("Unable to fetch font " + response.status);
        }

        const dataUrl = await readBlobAsDataUrl(await response.blob());
        replacements.push([fullMatch, `url(${dataUrl})`]);
      } catch (error) {
        if (resolvedUrl && !String(resolvedUrl).startsWith("file:")) {
          replacements.push([fullMatch, `url("${resolvedUrl}")`]);
        }
      }
    }

    let inlinedCss = cssText;
    for (const [from, to] of replacements) {
      inlinedCss = inlinedCss.split(from).join(to);
    }

    return inlinedCss;
  };

  const waitForDocumentFonts = async (timeoutMs = 3000) => {
    if (!document.fonts || !document.fonts.ready) {
      return;
    }

    await Promise.race([
      document.fonts.ready.catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  };

  const getBundledExportFontEmbedCSS = () => {
    const bundledFaces = Array.isArray(window.SIGNMAKER_EXPORT_FONT_FACES)
      ? window.SIGNMAKER_EXPORT_FONT_FACES
      : [];

    return bundledFaces
      .filter((fontFace) => fontFace && fontFace.fontFamily && fontFace.data)
      .map((fontFace) => {
        const format = fontFace.format || "woff2";
        const mimeType =
          format === "woff"
            ? "font/woff"
            : format === "truetype"
              ? "application/font-truetype"
              : "font/woff2";

        return [
          "@font-face {",
          `  font-family: "${fontFace.fontFamily}";`,
          `  src: url("data:${mimeType};base64,${fontFace.data}") format("${format}");`,
          `  font-weight: ${fontFace.fontWeight || "normal"};`,
          `  font-style: ${fontFace.fontStyle || "normal"};`,
          "  font-display: block;",
          "}",
        ].join("\n");
      })
      .join("\n");
  };

  const getBundledExportFontFamilySet = () => {
    const bundledFaces = Array.isArray(window.SIGNMAKER_EXPORT_FONT_FACES)
      ? window.SIGNMAKER_EXPORT_FONT_FACES
      : [];

    return new Set(
      bundledFaces
        .map((fontFace) =>
          String(fontFace?.fontFamily || "").replace(/^["']|["']$/g, "")
        )
        .filter(Boolean)
    );
  };

  const quoteExportFontFamily = (fontFamily) =>
    `"${String(fontFamily || "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')}"`;

  const getExportFontFamilyValue = (fontFamily) => {
    const quotedFontFamily = quoteExportFontFamily(fontFamily);
    return fontFamily === "Series EM"
      ? quotedFontFamily
      : `${quotedFontFamily}, "Series EM"`;
  };

  let bundledExportFontStyleElement = null;

  const ensureBundledExportFontsAvailable = async (root) => {
    const bundledFontCSS = getBundledExportFontEmbedCSS();
    if (!bundledFontCSS || !document.fonts) {
      return;
    }

    if (!bundledExportFontStyleElement) {
      bundledExportFontStyleElement = document.createElement("style");
      bundledExportFontStyleElement.id = "signmaker-export-font-bundle";
      bundledExportFontStyleElement.textContent = bundledFontCSS;
      document.head.appendChild(bundledExportFontStyleElement);
    }

    const fontFamilies = new Set();
    const exportFontElements =
      root instanceof Element
        ? [
            ...(root.matches("[data-export-font-family]") ? [root] : []),
            ...Array.from(root.querySelectorAll("[data-export-font-family]")),
          ]
        : [];

    exportFontElements.forEach((element) => {
      const fontFamily = element.dataset.exportFontFamily;
      if (fontFamily) {
        fontFamilies.add(fontFamily);
      }
    });

    const fontLoadPromises = Array.from(fontFamilies).map((fontFamily) =>
      document.fonts.load(`16px ${quoteExportFontFamily(fontFamily)}`).catch(() => {})
    );

    await Promise.race([
      Promise.all(fontLoadPromises),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);

    await waitForDocumentFonts();
  };

  const applyExplicitExportFontFamilies = (root) => {
    if (!root) {
      return () => {};
    }

    const restoreCallbacks = [];
    const exportFontElements =
      root instanceof Element
        ? [
            ...(root.matches("[data-export-font-family]") ? [root] : []),
            ...Array.from(root.querySelectorAll("[data-export-font-family]")),
          ]
        : [];

    exportFontElements.forEach((element) => {
      const fontFamily = element.dataset.exportFontFamily;
      if (!fontFamily) {
        return;
      }

      const fontFamilyValue = getExportFontFamilyValue(fontFamily);

      [element, ...Array.from(element.querySelectorAll("*"))].forEach(
        (fontElement) => {
          const oldFontFamily = fontElement.style.getPropertyValue("font-family");
          const oldPriority = fontElement.style.getPropertyPriority("font-family");

          fontElement.style.setProperty(
            "font-family",
            fontFamilyValue,
            "important"
          );
          restoreCallbacks.push(() => {
            if (oldFontFamily) {
              fontElement.style.setProperty(
                "font-family",
                oldFontFamily,
                oldPriority
              );
            } else {
              fontElement.style.removeProperty("font-family");
            }
          });
        }
      );
    });

    return () => {
      for (const restore of restoreCallbacks.reverse()) {
        restore();
      }
    };
  };

  const bundledExportAssetFallbacks = {
    "img/arrowBlocks/APL_TURN_CFX.svg":
      "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+Cjxzdmcgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgdmlld0JveD0iMCAwIDUwMiA1MDEiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSIgeG1sbnM6c2VyaWY9Imh0dHA6Ly93d3cuc2VyaWYuY29tLyIgc3R5bGU9ImZpbGwtcnVsZTpldmVub2RkO2NsaXAtcnVsZTpldmVub2RkO3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbWl0ZXJsaW1pdDoyOyI+CiAgICA8ZyB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwxLC0xODcwLjI0MzY4MSwtNzQ0Ljc2MzA1MykiPgogICAgICAgIDxnIHRyYW5zZm9ybT0ibWF0cml4KDAuNzA3MTA3LDAuNzA3MTA3LC0wLjcwNzEwNywwLjcwNzEwNywyNDU5LjMyNTA3OSw5LjkxMzE5MykiPgogICAgICAgICAgICA8ZyBpZD0iVHVybiI+CiAgICAgICAgICAgICAgICA8cGF0aCBkPSJNNDE1LjAyNCwxMjQ4LjExMUw0OTguOTkxLDEyNDguMTI2TDQ5OC45OTEsNzU2LjEwOEM0OTguOTkxLDc1Ni4xMDggNTE5LjU2Nyw3NTkuNTYzIDU0My4wOTgsNzYzLjUxNEM1NTMuOTM0LDc2NS4zMzQgNTY0Ljc3MSw3NjAuMjkxIDU3MC4zNTcsNzUwLjgyOUM1NzUuOTQ0LDc0MS4zNjggNTc1LjEyNSw3MjkuNDQzIDU2OC4yOTgsNzIwLjgzNEM1MjIuOTA0LDY2My41OSA0NTcuNzc1LDU4MS40NiA0NTcuNzc1LDU4MS40NkM0NTcuNzc1LDU4MS40NiAzOTIuNTA2LDY2My4zNDMgMzQ2LjEwNSw3MjEuNTU3QzMzOS4xNDksNzMwLjI4NCAzMzguMzkyLDc0Mi40MjkgMzQ0LjIxMiw3NTEuOTUyQzM1MC4wMzIsNzYxLjQ3NCAzNjEuMTg1LDc2Ni4zNCAzNzIuMTI0LDc2NC4xM0MzOTUuMzA2LDc1OS40NDcgNDE1LjE3LDc1NS40MzQgNDE1LjE3LDc1NS40MzRMNDE1LjAyNCwxMjQ4LjExMVoiIHN0eWxlPSJmaWxsOiNmZmY7Ii8+CiAgICAgICAgICAgIDwvZz4KICAgICAgICA8L2c+CiAgICA8L2c+Cjwvc3ZnPgo=",
    "img/arrowBlocks/APL_UP_CFX.svg":
      "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+Cjxzdmcgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgdmlld0JveD0iMCAwIDMxMSA3NTIiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSIgeG1sbnM6c2VyaWY9Imh0dHA6Ly93d3cuc2VyaWYuY29tLyIgc3R5bGU9ImZpbGwtcnVsZTpldmVub2RkO2NsaXAtcnVsZTpldmVub2RkO3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbWl0ZXJsaW1pdDoyOyI+CiAgICA8ZyB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwxLC0zMDAuNjYxNjQxLC01ODEuNDU5NjQ0KSI+CiAgICAgICAgPGcgaWQ9IlVwIj4KICAgICAgICAgICAgPHBhdGggZD0iTTQxNS4wMjQsMTMzMi45NjRMNDk4Ljk5MSwxMzMyLjk3OUw0OTguOTkxLDc1Ni4xMDhDNDk4Ljk5MSw3NTYuMTA4IDUxOS41NjcsNzU5LjU2MyA1NDMuMDk4LDc2My41MTRDNTUzLjkzNCw3NjUuMzM0IDU2NC43NzEsNzYwLjI5MSA1NzAuMzU3LDc1MC44MjlDNTc1Ljk0NCw3NDEuMzY4IDU3NS4xMjUsNzI5LjQ0MyA1NjguMjk4LDcyMC44MzRDNTIyLjkwNCw2NjMuNTkgNDU3Ljc3NSw1ODEuNDYgNDU3Ljc3NSw1ODEuNDZDNDU3Ljc3NSw1ODEuNDYgMzkyLjUwNiw2NjMuMzQzIDM0Ni4xMDUsNzIxLjU1N0MzMzkuMTQ5LDczMC4yODQgMzM4LjM5Miw3NDIuNDI5IDM0NC4yMTIsNzUxLjk1MkMzNTAuMDMyLDc2MS40NzQgMzYxLjE4NSw3NjYuMzQgMzcyLjEyNCw3NjQuMTNDMzk1LjMwNiw3NTkuNDQ3IDQxNS4xNyw3NTUuNDM0IDQxNS4xNyw3NTUuNDM0TDQxNS4wMjQsMTMzMi45NjRaIiBzdHlsZT0iZmlsbDojZmZmOyIvPgogICAgICAgIDwvZz4KICAgIDwvZz4KPC9zdmc+Cg==",
    "img/arrowBlocks/APL_UP_TURN_CFX.svg":
      "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+Cjxzdmcgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgdmlld0JveD0iMCAwIDY0MCA3NTIiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSIgeG1sbnM6c2VyaWY9Imh0dHA6Ly93d3cuc2VyaWYuY29tLyIgc3R5bGU9ImZpbGwtcnVsZTpldmVub2RkO2NsaXAtcnVsZTpldmVub2RkO3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbWl0ZXJsaW1pdDoyOyI+CiAgICA8ZyB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwxLC05ODYuODczOTYyLC01ODEuNDU5NjQ0KSI+CiAgICAgICAgPGcgaWQ9IlVwLVR1cm4iIHNlcmlmOmlkPSJVcCBUdXJuIj4KICAgICAgICAgICAgPGcgdHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsMSw2ODYuMjEyMzIxLDApIj4KICAgICAgICAgICAgICAgIDxwYXRoIGQ9Ik00MTUuMDI0LDEzMzIuOTY0TDQ5OC45OTEsMTMzMi45NzlMNDk4Ljk5MSw3NTYuMTA4QzQ5OC45OTEsNzU2LjEwOCA1MTkuNTY3LDc1OS41NjMgNTQzLjA5OCw3NjMuNTE0QzU1My45MzQsNzY1LjMzNCA1NjQuNzcxLDc2MC4yOTEgNTcwLjM1Nyw3NTAuODI5QzU3NS45NDQsNzQxLjM2OCA1NzUuMTI1LDcyOS40NDMgNTY4LjI5OCw3MjAuODM0QzUyMi45MDQsNjYzLjU5IDQ1Ny43NzUsNTgxLjQ2IDQ1Ny43NzUsNTgxLjQ2QzQ1Ny43NzUsNTgxLjQ2IDM5Mi41MDYsNjYzLjM0MyAzNDYuMTA1LDcyMS41NTdDMzM5LjE0OSw3MzAuMjg0IDMzOC4zOTIsNzQyLjQyOSAzNDQuMjEyLDc1MS45NTJDMzUwLjAzMiw3NjEuNDc0IDM2MS4xODUsNzY2LjM0IDM3Mi4xMjQsNzY0LjEzQzM5NS4zMDYsNzU5LjQ0NyA0MTUuMTcsNzU1LjQzNCA0MTUuMTcsNzU1LjQzNEw0MTUuMDI0LDEzMzIuOTY0WiIgc3R5bGU9ImZpbGw6I2ZmZjsiLz4KICAgICAgICAgICAgPC9nPgogICAgICAgICAgICA8ZyB0cmFuc2Zvcm09Im1hdHJpeCgwLjcwNzEwNywwLjcwNzEwNywtMC43MDcxMDcsMC43MDcxMDcsMTcxNC4xMDM4NTgsOS45MTMxOTMpIj4KICAgICAgICAgICAgICAgIDxwYXRoIGQ9Ik00MTUuMDI0LDEyNDguMTExTDQ5OC45OTEsMTI0OC4xMjZMNDk4Ljk5MSw3NTYuMTA4QzQ5OC45OTEsNzU2LjEwOCA1MTkuNTY3LDc1OS41NjMgNTQzLjA5OCw3NjMuNTE0QzU1My45MzQsNzY1LjMzNCA1NjQuNzcxLDc2MC4yOTEgNTcwLjM1Nyw3NTAuODI5QzU3NS45NDQsNzQxLjM2OCA1NzUuMTI1LDcyOS40NDMgNTY4LjI5OCw3MjAuODM0QzUyMi45MDQsNjYzLjU5IDQ1Ny43NzUsNTgxLjQ2IDQ1Ny43NzUsNTgxLjQ2QzQ1Ny43NzUsNTgxLjQ2IDM5Mi41MDYsNjYzLjM0MyAzNDYuMTA1LDcyMS41NTdDMzM5LjE0OSw3MzAuMjg0IDMzOC4zOTIsNzQyLjQyOSAzNDQuMjEyLDc1MS45NTJDMzUwLjAzMiw3NjEuNDc0IDM2MS4xODUsNzY2LjM0IDM3Mi4xMjQsNzY0LjEzQzM5NS4zMDYsNzU5LjQ0NyA0MTUuMTcsNzU1LjQzNCA0MTUuMTcsNzU1LjQzNEw0MTUuMDI0LDEyNDguMTExWiIgc3R5bGU9ImZpbGw6I2ZmZjsiLz4KICAgICAgICAgICAgPC9nPgogICAgICAgIDwvZz4KICAgIDwvZz4KPC9zdmc+Cg==",
  };

  let bundledExportAssetMap = null;
  let bundledExportAssetLowerMap = null;

  const getBundledExportAssetMap = () => {
    if (bundledExportAssetMap) {
      return bundledExportAssetMap;
    }

    const exportAssets =
      window.SIGNMAKER_EXPORT_ASSETS &&
      typeof window.SIGNMAKER_EXPORT_ASSETS === "object"
        ? window.SIGNMAKER_EXPORT_ASSETS
        : {};

    bundledExportAssetMap = {
      ...bundledExportAssetFallbacks,
      ...window.SIGNMAKER_ARROW_ASSETS,
      ...exportAssets,
    };
    return bundledExportAssetMap;
  };

  const getBundledExportAssetLowerMap = () => {
    if (bundledExportAssetLowerMap) {
      return bundledExportAssetLowerMap;
    }

    bundledExportAssetLowerMap = {};
    const assetMap = getBundledExportAssetMap();
    Object.keys(assetMap).forEach((assetPath) => {
      bundledExportAssetLowerMap[assetPath.toLowerCase()] = assetMap[assetPath];
    });
    return bundledExportAssetLowerMap;
  };

  const normalizeExportAssetPath = (rawUrl) => {
    if (!rawUrl || String(rawUrl).startsWith("data:")) {
      return "";
    }

    const cleanUrl = String(rawUrl).split("#")[0].split("?")[0];

    try {
      const url = new URL(cleanUrl, document.baseURI);
      const decodedPath = decodeURIComponent(url.pathname || "");
      const imgIndex = decodedPath.lastIndexOf("/img/");
      if (imgIndex >= 0) {
        return decodedPath.slice(imgIndex + 1);
      }
      if (decodedPath.startsWith("/img/")) {
        return decodedPath.slice(1);
      }
    } catch (error) {
      // Fall through to relative path normalization.
    }

    const decodedCleanUrl = decodeURIComponent(cleanUrl);
    const normalized = decodedCleanUrl.replace(/\\/g, "/").replace(/^\.?\//, "");
    const imgIndex = normalized.lastIndexOf("img/");
    return imgIndex >= 0 ? normalized.slice(imgIndex) : normalized;
  };

  const getBundledExportAssetDataUrl = (rawUrl) => {
    const assetPath = normalizeExportAssetPath(rawUrl);
    if (!assetPath) {
      return "";
    }

    const assetMap = getBundledExportAssetMap();
    return (
      assetMap[assetPath] ||
      getBundledExportAssetLowerMap()[assetPath.toLowerCase()] ||
      ""
    );
  };

  const fetchedExportAssetDataUrls = new Map();

  const fetchExportAssetDataUrl = (rawUrl) => {
    if (!rawUrl) {
      return Promise.resolve("");
    }

    const stringUrl = String(rawUrl);
    if (stringUrl.startsWith("data:")) {
      return Promise.resolve(stringUrl);
    }

    let resolvedUrl;
    try {
      resolvedUrl = new URL(stringUrl, document.baseURI).href;
    } catch (error) {
      return Promise.resolve("");
    }

    if (fetchedExportAssetDataUrls.has(resolvedUrl)) {
      return fetchedExportAssetDataUrls.get(resolvedUrl);
    }

    const dataUrlPromise = (async () => {
      try {
        const response = await fetch(resolvedUrl);
        if (!response.ok) {
          return "";
        }
        return await readBlobAsDataUrl(await response.blob());
      } catch (error) {
        return "";
      }
    })();

    fetchedExportAssetDataUrls.set(resolvedUrl, dataUrlPromise);
    return dataUrlPromise;
  };

  const getExportAssetDataUrl = async (...rawUrls) => {
    for (const rawUrl of rawUrls) {
      const bundledDataUrl = getBundledExportAssetDataUrl(rawUrl);
      if (bundledDataUrl) {
        return bundledDataUrl;
      }
    }

    for (const rawUrl of rawUrls) {
      const fetchedDataUrl = await fetchExportAssetDataUrl(rawUrl);
      if (fetchedDataUrl) {
        return fetchedDataUrl;
      }
    }

    return "";
  };

  const inlineBundledExportAssets = async (root) => {
    if (!root) {
      return;
    }

    const imagePromises = Array.from(root.querySelectorAll("img[src]")).map(
      async (img) => {
        const dataUrl = await getExportAssetDataUrl(
          img.getAttribute("src"),
          img.src
        );

        if (!dataUrl) {
          return;
        }

        img.removeAttribute("srcset");
        img.loading = "eager";
        img.decoding = "sync";
        img.src = dataUrl;

        if (typeof img.decode === "function") {
          try {
            await img.decode();
          } catch (error) {
            // The later image wait still handles browsers without SVG decode support.
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    );

    const objectPromises = Array.from(
      root.querySelectorAll("object[data]")
    ).map(async (objectElement) => {
      const dataUrl = await getExportAssetDataUrl(
        objectElement.getAttribute("data"),
        objectElement.data
      );

      if (dataUrl) {
        objectElement.data = dataUrl;
      }
    });

    const svgImagePromises = Array.from(
      root.querySelectorAll("image[href], image[xlink\\:href]")
    ).map(async (imageElement) => {
      const href =
        imageElement.getAttribute("href") ||
        imageElement.getAttribute("xlink:href");
      const dataUrl = await getExportAssetDataUrl(href);

      if (!dataUrl) {
        return;
      }

      imageElement.setAttribute("href", dataUrl);
      imageElement.setAttribute("xlink:href", dataUrl);
    });

    await Promise.all([
      ...imagePromises,
      ...objectPromises,
      ...svgImagePromises,
    ]);
  };

  let safeExportFontEmbedCSSPromise = null;

  const getSafeExportFontEmbedCSS = async () => {
    await window.SignMakerExportResources.fonts();
    if (safeExportFontEmbedCSSPromise) {
      return safeExportFontEmbedCSSPromise;
    }

    safeExportFontEmbedCSSPromise = (async () => {
      const fontFaceRules = [];
      const bundledFontFamilies = getBundledExportFontFamilySet();

      for (const sheet of Array.from(document.styleSheets)) {
        let rules;

        try {
          rules = Array.from(sheet.cssRules || []);
        } catch (error) {
          continue;
        }

        for (const rule of rules) {
          if (rule.type === CSSRule.FONT_FACE_RULE) {
            const fontFamily = String(
              rule.style.getPropertyValue("font-family") || ""
            ).replace(/^["']|["']$/g, "");

            if (bundledFontFamilies.has(fontFamily)) {
              continue;
            }

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

      return [inlinedRules.join("\n"), getBundledExportFontEmbedCSS()]
        .filter(Boolean)
        .join("\n");
    })();

    return safeExportFontEmbedCSSPromise;
  };

  const materializeExportBannerFirstLetters = (root) => {
    if (!root) {
      return () => {};
    }

    const bannerElements = Array.from(
      root.querySelectorAll(
        ".bannerA:not(.TOLL):not(.noIndent), .bannerB:not(.TOLL):not(.noIndent), .bE-banner"
      )
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

  const EXPORT_SIGN_BOUNDS_SELECTOR = [
    ".sign",
    ".exitTabContainer.tabVisible",
    ".exitTabHolder",
    ".exitTab",
    ".guideArrows",
    ".sideLeftArrow",
    ".sideRightArrow",
  ].join(", ");

  const getPreferredExportBoundsElements = (element) => {
    if (!element || !(element instanceof Element)) {
      return [];
    }

    const boundsElements = [];

    if (element.matches(EXPORT_SIGN_BOUNDS_SELECTOR)) {
      boundsElements.push(element);
    }

    element.querySelectorAll(EXPORT_SIGN_BOUNDS_SELECTOR).forEach((node) => {
      boundsElements.push(node);
    });

    return boundsElements.filter(isElementVisibleForExport);
  };

  const getElementAndDescendantBounds = (element, { includeSelf = true } = {}) => {
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

    const preferredBoundsElements = getPreferredExportBoundsElements(element);

    if (preferredBoundsElements.length) {
      preferredBoundsElements.forEach(addRect);
    } else if (includeSelf) {
      addRect(element);
    }

    if (!preferredBoundsElements.length) {
      element.querySelectorAll("*").forEach(addRect);
    }

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
    child?.classList && child.classList.contains("panel");

  const getExportCloneSourceElements = (element) => {
    if (!element) {
      return [];
    }

    if (element.id === "panelContainer") {
      const panels = Array.from(element.children).filter(isPanelExportSourceElement);
      return panels.length ? panels : [element];
    }

    if (element.id === "postContainer") {
      return Array.from(element.children).filter(
        (child) =>
          (child.id === "panelContainer" ||
            (child.classList &&
              (child.classList.contains("post") || child.classList.contains("fdotSupport")))) &&
          isElementVisibleForExport(child)
      );
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

  const clearExportSelectionClasses = (clone) => {
    if (!clone || !clone.classList) {
      return;
    }

    clone.classList.remove("groupPreviewPanel");
    clone.querySelectorAll(".groupPreviewPanel").forEach((node) => {
      node.classList.remove("groupPreviewPanel");
    });
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

    const layoutScale = getExportLayoutScale(element);
    const normalizeMeasurement = (value) => value / layoutScale;

    const sourceInfos = sourceElements.map((sourceElement) => {
      const includePanelContainerSelf =
        sourceElement.id === "panelContainer" && element.id !== "panelContainer";

      return {
        sourceElement,
        sourceRect: sourceElement.getBoundingClientRect(),
        bounds: getElementAndDescendantBounds(sourceElement, {
          includeSelf:
            includePanelContainerSelf ||
            (sourceElement.id !== "panelContainer" &&
              !isPanelExportSourceElement(sourceElement)),
        }),
      };
    });

    const left = Math.min(...sourceInfos.map((info) => info.bounds.left));
    const top = Math.min(...sourceInfos.map((info) => info.bounds.top));
    const right = Math.max(...sourceInfos.map((info) => info.bounds.right));
    const bottom = Math.max(...sourceInfos.map((info) => info.bounds.bottom));
    const exportWidth = Math.ceil(normalizeMeasurement(right - left));
    const exportHeight = Math.ceil(normalizeMeasurement(bottom - top));

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
    wrapper.dataset.exportWidth = String(exportWidth);
    wrapper.dataset.exportHeight = String(exportHeight);

    sourceInfos.forEach(({ sourceElement, sourceRect }) => {
      const clone = sourceElement.cloneNode(true);
      const sourceStyle = window.getComputedStyle(sourceElement);

      clearExportSelectionClasses(clone);

      // Ancestor rules (such as the FDOT support layout hiding empty exit
      // tabs) no longer match a detached panel. Keep those elements hidden
      // so they cannot add spacers and push sign content outside the crop.
      const sourceDescendants = sourceElement.querySelectorAll("*");
      const cloneDescendants = clone.querySelectorAll("*");
      sourceDescendants.forEach((sourceNode, index) => {
        if (window.getComputedStyle(sourceNode).display === "none") {
          cloneDescendants[index].style.setProperty("display", "none", "important");
        }
      });

      [
        "background",
        "background-color",
        "background-image",
        "background-position",
        "background-size",
        "background-repeat",
        "background-origin",
        "background-clip",
      ].forEach((propertyName) => {
        const propertyValue = sourceStyle.getPropertyValue(propertyName);
        if (propertyValue) {
          clone.style.setProperty(propertyName, propertyValue);
        }
      });

      if (sourceElement.id === "panelContainer") {
        [
          "display",
          "flex-direction",
          "align-items",
          "justify-content",
          "gap",
          "column-gap",
          "row-gap",
        ].forEach((propertyName) => {
          const propertyValue = sourceStyle.getPropertyValue(propertyName);
          if (propertyValue) {
            clone.style.setProperty(propertyName, propertyValue);
          }
        });
      }

      if (element.id === "panelContainer" && sourceElement.id === "panelContainer") {
        clone.style.setProperty("background", "transparent", "important");
        clone.style.setProperty("background-image", "none", "important");
      }

      [
        "--post-color-mid",
        "--post-color-light",
        "--post-color-dark",
        "--postThickness",
        "--postGradient",
        "--panelSpacing",
      ].forEach((propertyName) => {
        const propertyValue = sourceStyle.getPropertyValue(propertyName);
        if (propertyValue) {
          clone.style.setProperty(propertyName, propertyValue);
        }
      });

      clone.classList.add("exportStaticCaptureClone");
      clone.style.position = "absolute";
      clone.style.left = normalizeMeasurement(sourceRect.left - left) + "px";
      clone.style.top = normalizeMeasurement(sourceRect.top - top) + "px";
      clone.style.boxSizing = sourceStyle.boxSizing || "content-box";
      clone.style.paddingTop = sourceStyle.paddingTop;
      clone.style.paddingRight = sourceStyle.paddingRight;
      clone.style.paddingBottom = sourceStyle.paddingBottom;
      clone.style.paddingLeft = sourceStyle.paddingLeft;
      clone.style.width = normalizeMeasurement(sourceRect.width) + "px";
      clone.style.height = normalizeMeasurement(sourceRect.height) + "px";
      clone.style.minWidth = "0";
      clone.style.maxWidth = "none";
      clone.style.minHeight = "0";
      clone.style.maxHeight = "none";
      clone.style.margin = "0";
      clone.style.overflow = "visible";
      clone.style.transform = "none";
      clone.style.transition = "none";
      clone.style.pointerEvents = "none";

      wrapper.appendChild(clone);
    });

    host.appendChild(wrapper);
    document.body.appendChild(host);

    return {
      node: wrapper,
      cleanup: () => host.remove(),
    };
  };

  const withTemporaryExportStyles = async (element, callback) => {
    await VmsPanel.refresh(element);
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
    let restoreExplicitExportFontFamilies = () => {};

    try {
      await ensureBundledExportFontsAvailable(exportElement);
      await waitForNextFrame();
      restoreExportBannerFirstLetters =
        materializeExportBannerFirstLetters(exportElement);
      restoreExplicitExportFontFamilies =
        applyExplicitExportFontFamilies(exportElement);
      await inlineBundledExportAssets(exportElement);
      await waitForNextFrame();
      await waitForImagesInElement(exportElement);
      await waitForNextFrame();
      await VmsPanel.refresh(exportElement, { force: true, exporting: true });
      await waitForNextFrame();
      const box = getExportBox(exportElement);
      return await callback(box, exportElement);
    } finally {
      restoreExplicitExportFontFamilies();
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

  const scaleRasterExportUSRouteOutlines = (element, pixelRatio) => {
    if (!element || !Number.isFinite(pixelRatio) || pixelRatio <= 0) {
      return () => {};
    }

    const restores = [];
    const outlineWidth = pixelRatio;

    element
      .querySelectorAll(".blockElementMaster .bannerShieldContainer.US .shieldImg")
      .forEach((shieldImage) => {
        const computedStyle = window.getComputedStyle(shieldImage);
        if (computedStyle.filter === "none") {
          return;
        }

        const previousFilter = shieldImage.style.filter;
        const outlineColor =
          computedStyle.getPropertyValue("--black").trim() || "#000";
        shieldImage.style.filter = [
          `drop-shadow(${outlineWidth}px 0 0 ${outlineColor})`,
          `drop-shadow(-${outlineWidth}px 0 0 ${outlineColor})`,
          `drop-shadow(0 ${outlineWidth}px 0 ${outlineColor})`,
          `drop-shadow(0 -${outlineWidth}px 0 ${outlineColor})`,
        ].join(" ");

        restores.push(() => {
          if (previousFilter) {
            shieldImage.style.filter = previousFilter;
          } else {
            shieldImage.style.removeProperty("filter");
          }
        });
      });

    return () => restores.forEach((restore) => restore());
  };

  const renderSignExport = async function (file, format, isPreview = false) {
    if (!file) {
      throw new Error("No export target found");
    }

    await Promise.all([
      window.SignMakerExportResources.fonts(),
      window.SignMakerExportResources.assets(),
    ]);
    // Live file:// arrows may have built the small startup asset lookup.
    bundledExportAssetMap = null;
    bundledExportAssetLowerMap = null;
    await waitForDocumentFonts();
    // Lazy shield images can still have placeholder dimensions immediately
    // after insertion. Resolve them before freezing the export clone's bounds.
    await waitForImagesInElement(file);
    await waitForNextFrame();

    const hiddenPanels = Array.from(file.querySelectorAll(".panelHiddenFromPost"));
    hiddenPanels.forEach((panelElmt) => { panelElmt.style.display = "none"; });
    try {
      return await renderVisibleSignExport(file, format, isPreview);
    } finally {
      hiddenPanels.forEach((panelElmt) => { panelElmt.style.display = ""; });
    }
  };

  const renderVisibleSignExport = async function (file, format, isPreview) {
    return await withTemporaryExportStyles(
      file,
      async ({ width, height }, exportElement) => {
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

        if (format === "svg") {
          return await htmlToImage.toSvg(exportElement, exportOptions);
        }

        const pixelRatio = getExportPixelRatio(width, height, isPreview);

        // html-to-image scales the SVG artwork for high-resolution PNG exports,
        // but WebKit leaves CSS filter offsets at their original raster size.
        // Materialize the U.S. Route outline at the export pixel ratio so the
        // copied/downloaded image matches the one-pixel outline on the sign.
        const restoreUSRouteOutlines = scaleRasterExportUSRouteOutlines(
          exportElement,
          pixelRatio
        );

        try {
          if (format === "blob") {
            const blob = await htmlToImage.toBlob(exportElement, {
              ...exportOptions,
              pixelRatio,
            });
            if (!blob) {
              throw new Error("PNG render failed");
            }
            return await trimTransparentPngBlob(blob);
          }

          return await htmlToImage.toPng(exportElement, {
            ...exportOptions,
            pixelRatio,
          });
        } finally {
          restoreUSRouteOutlines();
        }
      }
    );
  };

  const saveSign = async function (file, isPreview, isSVG) {
    try {
      if (isSVG) {
        const svgDataUrl = await renderSignExport(file, "svg", isPreview);

        if (isPreview) {
          return svgDataUrl;
        }

        downloadFile(svgDataUrl, ".svg");
        return true;
      }

      const pngDataUrl = await renderSignExport(file, "png", isPreview);

      if (isPreview) {
        return pngDataUrl;
      }

      downloadFile(pngDataUrl, ".png");
      return true;
    } catch (error) {
      console.error("Error Saving!", error);
      throw error;
    }
  };

  const getClipboardFile = function () {
    if (post.copySignsOnly !== false || post.showPost === true) {
      return document.querySelector("#panelContainer");
    }

    return document.querySelector("#postContainer");
  };

  const getPanelClipboardFile = function (panelIndex) {
    const normalizedPanelIndex = Number.parseInt(panelIndex, 10);

    if (!Number.isInteger(normalizedPanelIndex) || normalizedPanelIndex < 0) {
      return null;
    }

    return getRenderedPanelGroupElement(getStackedPanelTopIndex(normalizedPanelIndex));
  };

  const copyExportTargetToClipboard = async function (file) {
    if (!file) {
      throw new Error("No export target found");
    }

    const blobPromise = renderSignExport(file, "blob", false);
    let renderedBlob = null;
    const getRenderedBlob = async () => {
      if (!renderedBlob) {
        renderedBlob = await blobPromise;
      }
      return renderedBlob;
    };
    const canWriteImage =
      navigator.clipboard &&
      typeof navigator.clipboard.write === "function" &&
      typeof ClipboardItem !== "undefined";

    if (canWriteImage) {
      try {
        let clipboardItem;
        try {
          clipboardItem = new ClipboardItem({ "image/png": blobPromise });
        } catch (itemError) {
          clipboardItem = new ClipboardItem({
            "image/png": await getRenderedBlob(),
          });
        }

        await navigator.clipboard.write([clipboardItem]);
        return "copied";
      } catch (clipboardError) {
        console.error("Clipboard image write failed", clipboardError);
        const blob = await getRenderedBlob();
        downloadBlob(blob, ".png");
        alert(
          "This browser blocked image clipboard access, so the PNG was downloaded instead."
        );
        return "downloaded";
      }
    }

    const blob = await getRenderedBlob();
    downloadBlob(blob, ".png");
    alert(
      "This browser does not support copying images directly, so the PNG was downloaded instead."
    );
    return "downloaded";
  };

  let copySignInProgress = false;
  let copyButtonRestoreTimer = null;
  let downloadCopiedSignInProgress = false;
  let downloadButtonRestoreTimer = null;

  const setCopyButtonState = (state) => {
    const button = document.getElementById("export");
    const icon = button?.querySelector(".material-symbols-outlined");

    if (!button || !icon) {
      return;
    }

    if (copyButtonRestoreTimer) {
      clearTimeout(copyButtonRestoreTimer);
      copyButtonRestoreTimer = null;
    }

    const restore = () => {
      button.disabled = false;
      button.classList.remove("activated");
      button.dataset.tooltip = "Copy Sign";
      icon.textContent = "content_copy";
    };

    if (state === "copying") {
      button.disabled = true;
      button.classList.remove("activated");
      button.dataset.tooltip = "Copying...";
      icon.textContent = "hourglass_empty";
      return;
    }

    if (state === "copied") {
      button.disabled = false;
      button.classList.add("activated");
      button.dataset.tooltip = "Copied";
      icon.textContent = "check";
      copyButtonRestoreTimer = setTimeout(restore, 1400);
      return;
    }

    if (state === "downloaded") {
      button.disabled = false;
      button.classList.add("activated");
      button.dataset.tooltip = "Downloaded PNG";
      icon.textContent = "download_done";
      copyButtonRestoreTimer = setTimeout(restore, 1800);
      return;
    }

    if (state === "error") {
      button.disabled = false;
      button.classList.remove("activated");
      button.dataset.tooltip = "Copy Failed";
      icon.textContent = "error";
      copyButtonRestoreTimer = setTimeout(restore, 1800);
      return;
    }

    restore();
  };

  const setDownloadButtonState = (state) => {
    const button = document.getElementById("exportDownload");
    const icon = button?.querySelector(".material-symbols-outlined");

    if (!button || !icon) {
      return;
    }

    if (downloadButtonRestoreTimer) {
      clearTimeout(downloadButtonRestoreTimer);
      downloadButtonRestoreTimer = null;
    }

    const restore = () => {
      button.disabled = false;
      button.classList.remove("activated");
      button.dataset.tooltip = "Download Sign";
      icon.textContent = "download";
    };

    if (state === "downloading") {
      button.disabled = true;
      button.classList.remove("activated");
      button.dataset.tooltip = "Downloading...";
      icon.textContent = "hourglass_empty";
      return;
    }

    if (state === "downloaded") {
      button.disabled = false;
      button.classList.add("activated");
      button.dataset.tooltip = "Downloaded PNG";
      icon.textContent = "download_done";
      downloadButtonRestoreTimer = setTimeout(restore, 1400);
      return;
    }

    if (state === "error") {
      button.disabled = false;
      button.classList.remove("activated");
      button.dataset.tooltip = "Download Failed";
      icon.textContent = "error";
      downloadButtonRestoreTimer = setTimeout(restore, 1800);
      return;
    }

    restore();
  };

  const copySignToClipboard = async function () {
    if (copySignInProgress || downloadCopiedSignInProgress) {
      return false;
    }

    copySignInProgress = true;
    setCopyButtonState("copying");

    try {
      const file = getClipboardFile();
      const result = await copyExportTargetToClipboard(file);
      setCopyButtonState(result);
      return result === "copied";
    } catch (error) {
      console.error("Error Copying Sign!", error);
      setCopyButtonState("error");
      alert("Unable to copy the sign: " + error.message);
      return false;
    } finally {
      copySignInProgress = false;
    }
  };

  const copyPanelToClipboard = async function (panelIndex) {
    if (copySignInProgress || downloadCopiedSignInProgress) {
      return false;
    }

    const panelNumber = Number.parseInt(panelIndex, 10) + 1;
    copySignInProgress = true;
    setCopyButtonState("copying");

    try {
      const file = getPanelClipboardFile(panelIndex);
      const result = await copyExportTargetToClipboard(file);
      setCopyButtonState(result);
      return result === "copied";
    } catch (error) {
      console.error("Error Copying Panel!", error);
      setCopyButtonState("error");
      alert("Unable to copy Panel " + panelNumber + ": " + error.message);
      return false;
    } finally {
      copySignInProgress = false;
    }
  };

  const downloadPanelSign = async function (panelIndex) {
    if (copySignInProgress || downloadCopiedSignInProgress) {
      return false;
    }

    const normalizedPanelIndex = Number.parseInt(panelIndex, 10);
    const panelLabel = Number.isInteger(normalizedPanelIndex)
      ? "Panel " + (normalizedPanelIndex + 1).toString()
      : "the panel";
    downloadCopiedSignInProgress = true;
    setDownloadButtonState("downloading");

    try {
      const file = getPanelClipboardFile(panelIndex);
      const blob = await renderSignExport(file, "blob", false);
      downloadBlob(blob, ".png");
      setDownloadButtonState("downloaded");
      return true;
    } catch (error) {
      console.error("Error Downloading Panel!", error);
      setDownloadButtonState("error");
      alert("Unable to download " + panelLabel + ": " + error.message);
      return false;
    } finally {
      downloadCopiedSignInProgress = false;
    }
  };

  let panelContextMenuListenersActive = false;

  function getPanelContextMenu(type) {
    return document.getElementById(
      type === "download" ? "downloadPanelContextMenu" : "copyPanelContextMenu"
    );
  }

  function removePanelContextMenuListeners() {
    if (!panelContextMenuListenersActive) {
      return;
    }

    document.removeEventListener("mousedown", handlePanelContextMenuMouseDown);
    document.removeEventListener("keydown", handlePanelContextMenuKeyDown);
    window.removeEventListener("resize", closePanelContextMenus);
    window.removeEventListener("scroll", closePanelContextMenus, true);
    panelContextMenuListenersActive = false;
  }

  function closePanelContextMenus() {
    ["copy", "download"].forEach((type) => {
      const menu = getPanelContextMenu(type);
      if (menu) {
        menu.classList.add("hidden");
        menu.replaceChildren();
      }
    });

    removePanelContextMenuListeners();
  }

  function closeCopyPanelContextMenu() {
    closePanelContextMenus();
  }

  function closeDownloadPanelContextMenu() {
    closePanelContextMenus();
  }

  function handlePanelContextMenuMouseDown(event) {
    const copyMenu = getPanelContextMenu("copy");
    const downloadMenu = getPanelContextMenu("download");
    const copyButton = document.getElementById("export");
    const downloadButton = document.getElementById("exportDownload");

    if (
      (copyMenu && copyMenu.contains(event.target)) ||
      (downloadMenu && downloadMenu.contains(event.target)) ||
      (copyButton && copyButton.contains(event.target)) ||
      (downloadButton && downloadButton.contains(event.target))
    ) {
      return;
    }

    closePanelContextMenus();
  }

  function handlePanelContextMenuKeyDown(event) {
    if (event.key === "Escape") {
      closePanelContextMenus();
    }
  }

  const positionPanelContextMenu = function (menu, event) {
    const viewportMargin = 4;
    const rect = menu.getBoundingClientRect();
    const maxLeft = Math.max(viewportMargin, window.innerWidth - rect.width - viewportMargin);
    const maxTop = Math.max(viewportMargin, window.innerHeight - rect.height - viewportMargin);
    const left = Math.min(Math.max(event.clientX, viewportMargin), maxLeft);
    const top = Math.min(Math.max(event.clientY, viewportMargin), maxTop);

    menu.style.left = left + "px";
    menu.style.top = top + "px";
  };

  const openPanelContextMenu = function (event, type, selectPanel, extraItem = null) {
    const menu = getPanelContextMenu(type);

    if (!menu || typeof selectPanel !== "function") {
      return;
    }

    closePanelContextMenus();

    const panelCount = Array.isArray(post.panels) ? post.panels.length : 0;

    if (!panelCount) {
      return;
    }

    if (menu.parentElement !== document.body) {
      document.body.appendChild(menu);
    }

    for (let panelIndex = 0; panelIndex < panelCount; panelIndex++) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Panel " + (panelIndex + 1).toString();
      button.addEventListener("click", (clickEvent) => {
        clickEvent.preventDefault();
        closePanelContextMenus();
        selectPanel(panelIndex);
      });
      item.appendChild(button);
      menu.appendChild(item);
    }

    if (extraItem) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = extraItem.label;
      button.addEventListener("click", (clickEvent) => {
        clickEvent.preventDefault();
        closePanelContextMenus();
        extraItem.action();
      });
      item.appendChild(button);
      menu.appendChild(item);
    }

    menu.classList.remove("hidden");
    positionPanelContextMenu(menu, event);

    const firstButton = menu.querySelector("button");
    if (firstButton) {
      firstButton.focus({ preventScroll: true });
    }

    setTimeout(() => {
      document.addEventListener("mousedown", handlePanelContextMenuMouseDown);
      document.addEventListener("keydown", handlePanelContextMenuKeyDown);
      window.addEventListener("resize", closePanelContextMenus);
      window.addEventListener("scroll", closePanelContextMenus, true);
      panelContextMenuListenersActive = true;
    }, 0);
  };

  const openCopyPanelContextMenu = function (event) {
    openPanelContextMenu(event, "copy", copyPanelToClipboard);
  };

  const openDownloadPanelContextMenu = function (event) {
    openPanelContextMenu(event, "download", downloadPanelSign, {
      label: "Export...",
      action: openExportDialog,
    });
  };

  const downloadCopiedSign = async function () {
    if (copySignInProgress || downloadCopiedSignInProgress) {
      return false;
    }

    downloadCopiedSignInProgress = true;
    setDownloadButtonState("downloading");

    try {
      const file = getClipboardFile();
      const blob = await renderSignExport(file, "blob", false);
      downloadBlob(blob, ".png");
      setDownloadButtonState("downloaded");
      return true;
    } catch (error) {
      console.error("Error Downloading Sign!", error);
      setDownloadButtonState("error");
      alert("Unable to download the sign: " + error.message);
      return false;
    } finally {
      downloadCopiedSignInProgress = false;
    }
  };

  const downloadSign = async function () {
    const downloadPreview = document.getElementById("downloadPreview");
    const entirePost_option = document.getElementById("entirePost");
    const panelContainer = document.getElementById("panelContainer");
    const panelNumberSelector = document.getElementById("singularPanel");

    let background = "";

    if (entirePost_option.checked == true) {
      fileInfo.panel = -1;
      panelNumberSelector.style.display = "none";
      document.getElementById("downloadContents").style.verticalAlign = "10rem";
    } else {
      fileInfo.panel = getSelectedExportPanels()[0] ?? 0;
      panelNumberSelector.style.display = "block";
      document.getElementById("downloadContents").style.verticalAlign = "";
      renderDownloadPanelButtons();
    }

    if (fileInfo.fileType == "png") {
      await withExportPanelSelection((file) => saveSign(file, false));
    } else if (fileInfo.fileType == "svg") {
      await withExportPanelSelection((file) => saveSign(file, false, true));
    }
  };

  const updatePreview = async function () {
    const downloadPreview = document.getElementById("downloadPreview");
    const entirePost_option = document.getElementById("entirePost");
    const panelContainer = document.getElementById("panelContainer");
    const panelNumberSelector = document.getElementById("singularPanel");

    let background = "";

    if (entirePost_option.checked == true) {
      fileInfo.panel = -1;
      panelNumberSelector.style.display = "none";
      document.getElementById("downloadContents").style.verticalAlign = "10rem";
    } else {
      fileInfo.panel = getSelectedExportPanels()[0] ?? 0;
      panelNumberSelector.style.display = "block";
      document.getElementById("downloadContents").style.verticalAlign = "";
      renderDownloadPanelButtons();
    }
    persistSessionState();

    while (downloadPreview.firstChild) {
      downloadPreview.removeChild(downloadPreview.lastChild);
    }

    const targetImg = new Image();
    targetImg.src = await withExportPanelSelection((file) => saveSign(file, true));
    downloadPreview.appendChild(targetImg);
  };

  const updateFileType = function (fileType) {
    fileInfo.fileType = fileType;
    updatePreview();

    if (fileType == "png") {
      document.getElementById("PNG").className = "activated";
      document.getElementById("SVG").className = "";
    } else if (fileType == "svg") {
      document.getElementById("PNG").className = "";
      document.getElementById("SVG").className = "activated";
    }
    persistSessionState();
  };

  const resetPadding = function (mode, params) {
    getCurrentPanel().sign.padding = "0.3rem 0.75rem 0.3rem 0.75rem";

    document.getElementById("paddingTop").value = 0.3;
    document.getElementById("paddingRight").value = 0.75;
    document.getElementById("paddingBottom").value = 0.3;
    document.getElementById("paddingLeft").value = 0.75;

    if (
      formHandler &&
      typeof formHandler.commitPanelPadding === "function"
    ) {
      formHandler.commitPanelPadding({ syncInputs: true });
    } else {
      formHandler.updateForm();
      redraw();
    }
  };

  /**
   * Redraw the panels on the post.
   */

  // v2.19 guide arrows (Standard Arrow and the Exit Only editor) render
  // inside v2.2's redraw; these are the helpers those branches need.
  const SPECIAL_COLOR_VALUES = new Set([
    "",
    "Inherit",
    "Match BG",
    "Default",
    "Panel Color",
    "Transparent",
  ]);
  const getResolvedCssColorValue = (value) => {
    const rawValue = String(value || "").trim();
    if (!rawValue || SPECIAL_COLOR_VALUES.has(rawValue)) {
      return "";
    }

    if (typeof lib !== "undefined" && lib.colors && lib.colors[rawValue]) {
      return lib.colors[rawValue];
    }

    return rawValue;
  };
  const resolveCssColorToRgb = (value) => {
    const resolvedValue = getResolvedCssColorValue(value);
    if (!resolvedValue) {
      return null;
    }

    const probe = document.createElement("span");
    probe.style.position = "absolute";
    probe.style.left = "-9999px";
    probe.style.color = resolvedValue;
    document.body.appendChild(probe);
    const computedColor = window.getComputedStyle(probe).color;
    probe.remove();

    const match = computedColor.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)/i);
    if (!match) {
      return null;
    }

    return {
      r: Math.max(0, Math.min(255, Math.round(Number(match[1])))),
      g: Math.max(0, Math.min(255, Math.round(Number(match[2])))),
      b: Math.max(0, Math.min(255, Math.round(Number(match[3])))),
      a: Math.max(0, Math.min(1, Number(match[4] ?? 1))),
    };
  };
  const getReadableTextColorForCssColor = (value) => {
    const rgb = resolveCssColorToRgb(value);
    if (!rgb) {
      return "var(--white)";
    }

    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) * (rgb.a || 1);
    return luminance > 155 ? "var(--black)" : "var(--white)";
  };
  // v2.19 custom colors: a panel or exit tab colored outside the palette
  // gets its color and a readable text color through CSS variables.
  const isCustomCssColorValue = (value) => {
    const rawValue = String(value || "").trim();
    return !!rawValue && !SPECIAL_COLOR_VALUES.has(rawValue) &&
      !(typeof lib !== "undefined" && lib.colors?.[rawValue]) &&
      CSS.supports("color", rawValue);
  };
  const applyCustomColorVars = (elements, prefix, colorValue) => {
    if (!isCustomCssColorValue(colorValue)) {
      return false;
    }
    const textColor = getReadableTextColorForCssColor(colorValue);
    for (const element of elements.filter(Boolean)) {
      element.classList.add(`custom${prefix}Color`);
      element.style.setProperty(`--${prefix.charAt(0).toLowerCase() + prefix.slice(1)}CustomBg`, colorValue);
      element.style.setProperty(`--${prefix.charAt(0).toLowerCase() + prefix.slice(1)}CustomFg`, textColor);
      if (prefix === "Panel") {
        element.style.setProperty("--panelCustomArrowFilter",
          textColor === "var(--black)" ? "invert(100%)" : "none");
      }
    }
    return true;
  };
  // A custom post color shades into the post's metal gradient.
  const applyCustomPostColorVars = (postContainerElmt, colorValue) => {
    const properties = ["--post-color-mid", "--post-color-light", "--post-color-dark", "--postGradient"];
    const rgb = colorValue ? resolveCssColorToRgb(colorValue) : null;
    if (!rgb) {
      properties.forEach((property) => postContainerElmt.style.removeProperty(property));
      return;
    }
    const shade = (amount) => {
      const mix = amount >= 0 ? 255 : 0;
      const weight = Math.abs(amount);
      const channel = (value) => Math.round(value + (mix - value) * weight);
      return `rgb(${channel(rgb.r)}, ${channel(rgb.g)}, ${channel(rgb.b)})`;
    };
    const lightColor = shade(0.28);
    const darkColor = shade(-0.38);
    postContainerElmt.style.setProperty("--post-color-mid", colorValue);
    postContainerElmt.style.setProperty("--post-color-light", lightColor);
    postContainerElmt.style.setProperty("--post-color-dark", darkColor);
    postContainerElmt.style.setProperty("--postGradient",
      `linear-gradient(90deg, ${colorValue} 0%, ${lightColor} 40%, ${darkColor} 100%)`);
  };
  const getExitOnlyContrastColor = (value) => {
    const rgb = resolveCssColorToRgb(value);
    if (!rgb) return getReadableTextColorForCssColor(value);
    const linear = (channel) => {
      const fraction = channel / 255;
      return fraction <= 0.04045 ? fraction / 12.92 : ((fraction + 0.055) / 1.055) ** 2.4;
    };
    const luminance = 0.2126 * linear(rgb.r) + 0.7152 * linear(rgb.g) + 0.0722 * linear(rgb.b);
    return luminance > 0.179 ? "var(--black)" : "var(--white)";
  };
  const exitOnlyArrowMasks = new Map();
  const embeddedExitOnlyArrowMasks = new Map();
  const exitOnlyArrowRatios = new Map();
  // Exit Only arrows are drawn with a CSS mask, which must be a same-origin or
  // data: URL. Opened from disk, fetching the SVG fails and a file:// mask is
  // blocked, so the arrow vanished; use the bundled copy (ExportAssetData.js).
  const getEmbeddedExitOnlyArrowMask = (src) => {
    if (!exitOnlyArrowMasks.has(src)) {
      const bundled = getBundledExportAssetDataUrl(src);
      const bundledMask = bundled ? `url("${bundled}")` : null;
      const request = location.protocol === "file:"
        ? Promise.resolve(bundledMask)
        : fetch(src)
          .then((response) => response.ok ? response.text() : null)
          .then((svg) => svg ? `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")` : bundledMask)
          .catch(() => bundledMask);
      exitOnlyArrowMasks.set(src, request.then((mask) => {
        if (mask) embeddedExitOnlyArrowMasks.set(src, mask);
        return mask;
      }));
      if (bundledMask && location.protocol === "file:") embeddedExitOnlyArrowMasks.set(src, bundledMask);
    }
    return exitOnlyArrowMasks.get(src);
  };

  const renderedArrowMaskLoads = new Map();
  // Resolves once a mask (or arrow source) image has decoded.
  const waitForRenderedArrowMask = (mask, source) => {
    const key = mask || source;
    if (!renderedArrowMaskLoads.has(key)) {
      const image = new Image();
      image.src = mask ? mask.slice(5, -2) : source;
      renderedArrowMaskLoads.set(
        key,
        image.decode().then(() => true, () => {
          renderedArrowMaskLoads.delete(key);
          return false;
        })
      );
    }
    return renderedArrowMaskLoads.get(key);
  };

  let selectedGuideArrowIndex = 0;
  let selectedGuideArrowPanelIndex = -1;
  let guideArrowPointerDragActive = false;
  // v2.2 records history after every redraw, so edits run directly.
  const runWithUndo = (callback) => callback();
  // Clicking a rendered arrow selects its panel and opens the Guide Arrows window.
  const selectRenderedPanelArea = ({ panelIndex, menu, suppressRedraw = false, deferMenu = false } = {}) => {
    if (panelIndex !== currentlySelectedPanelIndex && !suppressRedraw) {
      changeEditingPanel(panelIndex);
    } else if (panelIndex !== currentlySelectedPanelIndex) {
      currentlySelectedPanelIndex = panelIndex;
      formHandler.updateForm();
    }
    selectedGuideArrowPanelIndex = panelIndex;
    const configBar = document.getElementById("sMConfigBar");
    if (menu === "guideArrows" && !deferMenu && configBar?.dataset.currentMenu !== "guideArrowConfig") {
      document.getElementById("guideArrowConfig")?.click();
    }
  };

  // v2.19 exit tab dragging: a tab can be dragged sideways along its sign
  // (dragOffsetRem) and snaps to the panel, subpanels and other tabs
  // (dragSnapAnchor). Panels without moved tabs keep v2.2's layout.
  const newExitTabLayoutId = () =>
    globalThis.crypto?.randomUUID?.() ||
    `layout-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const ensureExitTabLayoutIds = (panel) => {
    const subpanelIds = new Set();
    panel.sign?.subPanels?.forEach((subpanel) => {
      if (!subpanel.layoutId || subpanelIds.has(subpanel.layoutId)) {
        subpanel.layoutId = newExitTabLayoutId();
      }
      subpanelIds.add(subpanel.layoutId);
    });
    const tabIds = new Set();
    panel.exitTabs?.forEach((tab) => {
      [tab, ...(tab.nestedExitTabs || [])].forEach((item) => {
        if (!item.layoutId || tabIds.has(item.layoutId)) {
          item.layoutId = newExitTabLayoutId();
        }
        tabIds.add(item.layoutId);

        const hasDragPlacement = !!item.dragSnapAnchor || !!Number(item.dragOffsetRem);
        if (hasDragPlacement && (
          (item.dragLayoutPosition !== undefined && item.dragLayoutPosition !== item.position) ||
          (item !== tab && item.dragParentLayoutPosition !== undefined &&
            item.dragParentLayoutPosition !== tab.position)
        )) {
          item.dragOffsetRem = 0;
          item.dragSnapAnchor = null;
        }
        if (item.dragSnapAnchor || Number(item.dragOffsetRem)) {
          item.dragLayoutPosition = item.position;
          if (item !== tab) item.dragParentLayoutPosition = tab.position;
        } else {
          delete item.dragLayoutPosition;
          delete item.dragParentLayoutPosition;
        }
      });
    });
  };

  const getExitTabAnchorRect = (panelElmt, anchor) => {
    if (anchor?.kind === "panel") {
      return panelElmt.querySelector(":scope > .signContainer > .sign")?.getBoundingClientRect();
    }
    if (anchor?.kind === "subpanel") {
      const target = Array.from(panelElmt.querySelectorAll(".sign .subPanelDisplay"))
        .find((elmt) => elmt.dataset.layoutId === anchor.id);
      return target?.getClientRects().length ? target.getBoundingClientRect() : null;
    }
    if (anchor?.kind === "tab") {
      const target = Array.from(panelElmt.querySelectorAll(".exitTabHolder > .exitTab"))
        .find((elmt) => elmt.dataset.layoutId === anchor.id);
      return target?.getClientRects().length && getComputedStyle(target).visibility === "visible"
        ? target.getBoundingClientRect() : null;
    }
    return null;
  };

  const exitTabAnchorPoint = (rect, point) =>
    point === "left" ? rect.left : point === "right" ? rect.right : (rect.left + rect.right) / 2;

  const getExitTabAnchorPoint = (panelElmt, anchor, rect) => {
    if (anchor.kind === "subpanel" && anchor.seam && anchor.point !== "center") {
      const subpanel = Array.from(panelElmt.querySelectorAll(".sign .subPanelDisplay"))
        .find((elmt) => elmt.dataset.layoutId === anchor.id);
      const divider = anchor.point === "left"
        ? subpanel?.previousElementSibling
        : subpanel?.nextElementSibling;
      if (divider?.classList.contains("subDivider")) {
        const dividerRect = divider.getBoundingClientRect();
        return (dividerRect.left + dividerRect.right) / 2;
      }
    }
    return exitTabAnchorPoint(rect, anchor.point);
  };

  const getAnchoredExitTabLeft = (panelElmt, tabElmt, anchor) => {
    const first = getExitTabAnchorRect(panelElmt, anchor);
    if (!first) return null;
    const second = anchor.between && getExitTabAnchorRect(panelElmt, anchor.between);
    if (anchor.between && !second) return null;
    const target = second
      ? (getExitTabAnchorPoint(panelElmt, anchor, first) +
          getExitTabAnchorPoint(panelElmt, anchor.between, second)) / 2
      : getExitTabAnchorPoint(panelElmt, anchor, first);
    const tabWidth = tabElmt.getBoundingClientRect().width;
    const borderSide = anchor.seam && anchor.self !== "center"
      ? parseFloat(getComputedStyle(tabElmt)[anchor.self === "right"
        ? "borderRightWidth" : "borderLeftWidth"]) / 2 || 0
      : 0;
    const selfPoint = anchor.self === "right"
      ? tabWidth - borderSide
      : anchor.self === "center" ? tabWidth / 2 : borderSide;
    return target - selfPoint;
  };

  const wouldCycleExitTabAnchor = (panelElmt, tabElmt, anchor) => {
    const panel = post.panels[Number(panelElmt.dataset.panelIndex)];
    const byId = new Map();
    panel?.exitTabs?.forEach((tab) => {
      [tab, ...(tab.nestedExitTabs || [])].forEach((item) => byId.set(item.layoutId, item));
    });
    const visited = new Set();
    const pointsToDraggedTab = (target) => {
      if (target?.kind !== "tab") return false;
      if (target.id === tabElmt.dataset.layoutId) return true;
      if (visited.has(target.id)) return false;
      visited.add(target.id);
      const next = byId.get(target.id)?.dragSnapAnchor;
      return next && (pointsToDraggedTab(next) || pointsToDraggedTab(next.between));
    };
    return pointsToDraggedTab(anchor) || pointsToDraggedTab(anchor?.between);
  };

  // Work in rendered coordinates so snapping also follows the post's zoom.
  const resolveExitTabDragPlacement = (
    panelElmt, tabElmt, requestedLeft, snap = true, allowCrossing = false
  ) => {
    const signElmt = panelElmt.querySelector(":scope > .signContainer > .sign");
    if (!signElmt) return { left: requestedLeft, anchor: null };
    const sign = signElmt.getBoundingClientRect();
    const tab = tabElmt.getBoundingClientRect();
    const width = tab.width;
    if (!width || width > sign.width) return { left: tab.left, anchor: null };

    const blockers = Array.from(panelElmt.querySelectorAll(".exitTabHolder > .exitTab"))
      .filter((other) => other !== tabElmt && other.getClientRects().length &&
        getComputedStyle(other).visibility === "visible")
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.top < tab.bottom - 1 && rect.bottom > tab.top + 1)
      .sort((a, b) => a.rect.left - b.rect.left);

    const allowed = allowCrossing ? [[sign.left, sign.right - width]] : [];
    if (!allowCrossing) {
      let edge = sign.left;
      for (const { rect: other } of blockers) {
        if (other.left - edge >= width) allowed.push([edge, other.left - width]);
        edge = Math.max(edge, other.right);
      }
      if (sign.right - edge >= width) allowed.push([edge, sign.right - width]);
    }
    if (!allowed.length) return { left: tab.left, anchor: null };

    const clampToAllowed = (left) => allowed.reduce((best, range) => {
      const clamped = Math.max(range[0], Math.min(range[1], left));
      return Math.abs(clamped - left) < Math.abs(best - left) ? clamped : best;
    }, allowed[0][0]);
    if (!snap) return { left: clampToAllowed(requestedLeft), anchor: null };

    const candidates = [];
    const addCandidates = (rect, target, element = null) => {
      const leftAnchor = { ...target, point: "left", self: "left",
        ...(element?.previousElementSibling?.classList.contains("subDivider") ? { seam: true } : {}) };
      const rightAnchor = { ...target, point: "right", self: "right",
        ...(element?.nextElementSibling?.classList.contains("subDivider") ? { seam: true } : {}) };
      candidates.push(
        { left: element ? getAnchoredExitTabLeft(panelElmt, tabElmt, leftAnchor) : rect.left,
          anchor: leftAnchor },
        { left: element ? getAnchoredExitTabLeft(panelElmt, tabElmt, rightAnchor) : rect.right - width,
          anchor: rightAnchor },
        { left: (rect.left + rect.right - width) / 2,
          anchor: { ...target, point: "center", self: "center" } }
      );
    };
    addCandidates(sign, { kind: "panel" });
    signElmt.querySelectorAll(".subPanelDisplay").forEach((subpanel) => {
      const rect = subpanel.getBoundingClientRect();
      addCandidates(rect, { kind: "subpanel", id: subpanel.dataset.layoutId }, subpanel);
    });
    blockers.forEach(({ element, rect: other }, index) => {
      const target = { kind: "tab", id: element.dataset.layoutId };
      candidates.push(
        { left: other.left - width, anchor: { ...target, point: "left", self: "right" } },
        { left: other.right, anchor: { ...target, point: "right", self: "left" } },
        { left: (other.left + other.right - width) / 2,
          anchor: { ...target, point: "center", self: "center" } }
      );
      if (index > 0) {
        const previous = blockers[index - 1];
        candidates.push(
          { left: (previous.rect.right + other.left - width) / 2,
            anchor: { kind: "tab", id: previous.element.dataset.layoutId,
              point: "right", self: "center", between: { ...target, point: "left" } } },
          { left: ((previous.rect.left + previous.rect.right + other.left + other.right) / 4) - width / 2,
            anchor: { kind: "tab", id: previous.element.dataset.layoutId,
              point: "center", self: "center", between: { ...target, point: "center" } } }
        );
      }
    });
    const scale = signElmt.offsetWidth ? sign.width / signElmt.offsetWidth : 1;
    const threshold = 10 * scale;
    const nearby = candidates
      .filter(({ left }) => Number.isFinite(left) &&
        allowed.some(([low, high]) => left >= low - 0.5 && left <= high + 0.5))
      .filter(({ anchor }) => !allowCrossing || anchor.kind !== "tab" ||
        anchor.self !== "center" || !!anchor.between)
      .filter(({ anchor }) => !wouldCycleExitTabAnchor(panelElmt, tabElmt, anchor))
      .filter(({ left }) => Math.abs(left - requestedLeft) <= threshold)
      .sort((a, b) => Math.abs(a.left - requestedLeft) - Math.abs(b.left - requestedLeft))[0];
    return nearby
      ? { left: clampToAllowed(nearby.left), anchor: nearby.anchor }
      : { left: clampToAllowed(requestedLeft), anchor: null };
  };

  const setRenderedExitTabOffset = (holder, offset) => {
    holder.style.translate = offset ? `${offset}rem 0` : "";
    holder.dataset.dragOffsetRem = String(offset);
    const container = holder.closest(".exitTabContainer");
    if (container) {
      container.classList.toggle("hasDraggedExitTab",
        Array.from(container.querySelectorAll(".exitTabHolder"))
          .some((item) => Number(item.dataset.dragOffsetRem || 0) !== 0));
    }
  };

  const getExitTabRemPixels = (tabElmt) => {
    const rect = tabElmt.getBoundingClientRect();
    const scale = tabElmt.offsetWidth ? rect.width / tabElmt.offsetWidth : 1;
    return (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) * scale;
  };

  const moveRenderedExitTabToLeft = (holder, tabElmt, tab, left) => {
    const rect = tabElmt.getBoundingClientRect();
    if (Math.abs(left - rect.left) < 0.05) return false;
    tab.dragOffsetRem = Math.round(((Number(tab.dragOffsetRem) || 0) +
      (left - rect.left) / getExitTabRemPixels(tabElmt)) * 10000) / 10000;
    setRenderedExitTabOffset(holder, tab.dragOffsetRem);
    return true;
  };

  // Older saved tabs have a numeric drag offset but no stored snap target.
  // Adopt a target only when that saved position already lines up closely.
  const adoptNearbyExitTabAnchors = (panelElmt, panel) => {
    panelElmt.querySelectorAll(".exitTabHolder > .exitTab.draggableExitTab").forEach((tabElmt) => {
      const holder = tabElmt.parentElement;
      const parentTab = panel.exitTabs[Number(holder.dataset.exitTabIndex)];
      const nestedIndex = Number(holder.dataset.nestedExitTabIndex);
      const tab = nestedIndex >= 0 ? parentTab?.nestedExitTabs?.[nestedIndex] : parentTab;
      if (!tab || Object.prototype.hasOwnProperty.call(tab, "dragSnapAnchor") ||
          !Number(tab.dragOffsetRem) ||
          !tabElmt.getClientRects().length ||
          getComputedStyle(tabElmt).visibility !== "visible") return;
      const rect = tabElmt.getBoundingClientRect();
      const placement = resolveExitTabDragPlacement(panelElmt, tabElmt, rect.left);
      const scale = tabElmt.offsetWidth ? rect.width / tabElmt.offsetWidth : 1;
      tab.dragSnapAnchor = placement.anchor &&
        Math.abs(placement.left - rect.left) <= 5 * scale
        ? placement.anchor : null;
    });
  };

  const applyRenderedExitTabAnchors = (panelElmt, panel) => {
    if (!panelElmt.isConnected || panelElmt.dataset.exitTabDragActive === "true") return;
    const tabs = Array.from(panelElmt.querySelectorAll(".exitTabHolder > .exitTab.draggableExitTab"));
    const byId = new Map(tabs.map((element) => [element.dataset.layoutId, element]));
    const completed = new Set();
    const visiting = new Set();
    const signRect = panelElmt.querySelector(":scope > .signContainer > .sign")?.getBoundingClientRect();
    const apply = (tabElmt) => {
      if (completed.has(tabElmt) || visiting.has(tabElmt)) return;
      visiting.add(tabElmt);
      const holder = tabElmt.parentElement;
      const parentTab = panel.exitTabs[Number(holder.dataset.exitTabIndex)];
      const nestedIndex = Number(holder.dataset.nestedExitTabIndex);
      const tab = nestedIndex >= 0 ? parentTab?.nestedExitTabs?.[nestedIndex] : parentTab;
      const anchor = tab?.dragSnapAnchor;
      if (anchor && tabElmt.getClientRects().length &&
          getComputedStyle(tabElmt).visibility === "visible") {
        if (anchor.kind === "subpanel" && (anchor.point === "left" || anchor.point === "right")) {
          anchor.seam = true;
        }
        for (const target of [anchor, anchor.between].filter(Boolean)) {
          const dependency = target.kind === "tab" ? byId.get(target.id) : null;
          if (dependency && dependency !== tabElmt && !visiting.has(dependency)) apply(dependency);
        }
        const desiredLeft = getAnchoredExitTabLeft(panelElmt, tabElmt, anchor);
        if (desiredLeft !== null) {
          const rect = tabElmt.getBoundingClientRect();
          // Move all anchors to their new positions before collision checks.
          // Otherwise a tab can be blocked by a neighbor's old position.
          const safeLeft = signRect && rect.width <= signRect.width
            ? Math.max(signRect.left, Math.min(signRect.right - rect.width, desiredLeft))
            : rect.left;
          if (Math.abs(safeLeft - rect.left) >= 0.05) {
            const offset = Math.round(((Number(tab.dragOffsetRem) || 0) +
              (safeLeft - rect.left) / getExitTabRemPixels(tabElmt)) * 10000) / 10000;
            tab.dragOffsetRem = offset;
            setRenderedExitTabOffset(holder, offset);
          }
        }
      }
      visiting.delete(tabElmt);
      completed.add(tabElmt);
    };
    tabs.forEach(apply);
    // A changed alignment can shift an unanchored tab beyond the sign too.
    // Bring every visible tab inside before resolving collisions between tabs.
    tabs.forEach((tabElmt) => {
      const holder = tabElmt.parentElement;
      const parentTab = panel.exitTabs[Number(holder.dataset.exitTabIndex)];
      const nestedIndex = Number(holder.dataset.nestedExitTabIndex);
      const tab = nestedIndex >= 0 ? parentTab?.nestedExitTabs?.[nestedIndex] : parentTab;
      if (!tab || !signRect || !tabElmt.getClientRects().length ||
          getComputedStyle(tabElmt).visibility !== "visible") return;
      const rect = tabElmt.getBoundingClientRect();
      if (rect.width > signRect.width) return;
      const boundedLeft = Math.max(signRect.left, Math.min(signRect.right - rect.width, rect.left));
      if (Math.abs(boundedLeft - rect.left) > 1) {
        moveRenderedExitTabToLeft(holder, tabElmt, tab, boundedLeft);
        tab.dragLayoutPosition = tab.position;
        if (nestedIndex >= 0) tab.dragParentLayoutPosition = parentTab.position;
      }
    });
    for (let pass = 0; pass < tabs.length; pass++) {
      let changed = false;
      tabs.forEach((tabElmt) => {
        const holder = tabElmt.parentElement;
        const parentTab = panel.exitTabs[Number(holder.dataset.exitTabIndex)];
        const nestedIndex = Number(holder.dataset.nestedExitTabIndex);
        const tab = nestedIndex >= 0 ? parentTab?.nestedExitTabs?.[nestedIndex] : parentTab;
        if (!tab || !tabElmt.getClientRects().length ||
            getComputedStyle(tabElmt).visibility !== "visible") return;
        const rect = tabElmt.getBoundingClientRect();
        const safeLeft = resolveExitTabDragPlacement(panelElmt, tabElmt, rect.left, false).left;
        if (Math.abs(safeLeft - rect.left) < (tab.dragSnapAnchor ? 0.05 : 0.5)) return;
        if (moveRenderedExitTabToLeft(holder, tabElmt, tab, safeLeft)) {
          changed = true;
          tab.dragLayoutPosition = tab.position;
          if (nestedIndex >= 0) tab.dragParentLayoutPosition = parentTab.position;
        }
      });
      if (!changed) break;
    }

    // Two tabs can overlap so much that neither has a free interval on its
    // own. Pack that row together when their combined width fits the sign.
    if (signRect) {
      const visible = tabs.filter((element) => element.getClientRects().length &&
        getComputedStyle(element).visibility === "visible");
      const bands = [];
      visible.forEach((element) => {
        const rect = element.getBoundingClientRect();
        const band = bands.find((item) => rect.top < item.bottom - 1 &&
          rect.bottom > item.top + 1);
        if (band) {
          band.tabs.push(element);
          band.top = Math.min(band.top, rect.top);
          band.bottom = Math.max(band.bottom, rect.bottom);
        } else {
          bands.push({ tabs: [element], top: rect.top, bottom: rect.bottom });
        }
      });
      bands.forEach(({ tabs: bandTabs }) => {
        if (bandTabs.length < 2) return;
        const positions = bandTabs.map((element) => ({
          element, rect: element.getBoundingClientRect(), left: element.getBoundingClientRect().left,
        })).sort((a, b) => a.left - b.left);
        const totalWidth = positions.reduce((sum, item) => sum + item.rect.width, 0);
        if (totalWidth > signRect.width + 0.5) return;
        let right = signRect.left;
        positions.forEach((item) => {
          item.left = Math.max(right, Math.min(item.left, signRect.right - item.rect.width));
          right = item.left + item.rect.width;
        });
        if (right > signRect.right) {
          right = signRect.right;
          for (let i = positions.length - 1; i >= 0; i--) {
            positions[i].left = Math.min(positions[i].left, right - positions[i].rect.width);
            right = positions[i].left;
          }
        }
        positions.forEach(({ element, left }) => {
          const holder = element.parentElement;
          const parentTab = panel.exitTabs[Number(holder.dataset.exitTabIndex)];
          const nestedIndex = Number(holder.dataset.nestedExitTabIndex);
          const tab = nestedIndex >= 0 ? parentTab?.nestedExitTabs?.[nestedIndex] : parentTab;
          if (tab && moveRenderedExitTabToLeft(holder, element, tab, left)) {
            tab.dragLayoutPosition = tab.position;
            if (nestedIndex >= 0) tab.dragParentLayoutPosition = parentTab.position;
          }
        });
      });
    }
  };

  let exitTabAnchorObservers = [];
  const watchRenderedExitTabAnchors = (panelElmt, panel) => {
    if (!panelElmt.querySelector(".exitTab.draggableExitTab")) return;
    let frame = 0;
    const schedule = () => {
      if (frame || !panelElmt.isConnected) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        applyRenderedExitTabAnchors(panelElmt, panel);
      });
    };
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(schedule);
      [panelElmt, ...panelElmt.querySelectorAll(".sign, .subPanelDisplay, .exitTab")]
        .forEach((element) => observer.observe(element));
      exitTabAnchorObservers.push(observer);
    }
    document.fonts?.ready?.then(schedule).catch(() => {});
  };

  const getExitTabDragPeers = (panelElmt, tabElmt) => {
    const draggedRect = tabElmt.getBoundingClientRect();
    return Array.from(panelElmt.querySelectorAll(".exitTabHolder > .exitTab.draggableExitTab"))
      .filter((element) => element.getClientRects().length &&
        getComputedStyle(element).visibility === "visible")
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.top < draggedRect.bottom - 1 &&
        rect.bottom > draggedRect.top + 1)
      .sort((a, b) => a.rect.left - b.rect.left);
  };

  const settleDraggedExitTabOrder = (panelElmt, tabElmt, exitTab, initialPeers) => {
    const panel = post.panels[Number(panelElmt.dataset.panelIndex)];
    const signElmt = panelElmt.querySelector(":scope > .signContainer > .sign");
    if (!panel || !signElmt) return;
    const signRect = signElmt.getBoundingClientRect();
    const draggedRect = tabElmt.getBoundingClientRect();
    const originalIndex = initialPeers.findIndex(({ element }) => element === tabElmt);
    const others = initialPeers.filter(({ element }) => element !== tabElmt &&
      element.isConnected && element.getClientRects().length);
    if (originalIndex < 0 || !others.length) {
      const placement = resolveExitTabDragPlacement(panelElmt, tabElmt, draggedRect.left);
      moveRenderedExitTabToLeft(tabElmt.parentElement, tabElmt, exitTab, placement.left);
      exitTab.dragSnapAnchor = placement.anchor;
      applyRenderedExitTabAnchors(panelElmt, panel);
      return;
    }

    const center = draggedRect.left + draggedRect.width / 2;
    const nextIndex = others.filter(({ rect }) => center > rect.left + rect.width / 2).length;
    if (nextIndex !== originalIndex) {
      const ordered = others.slice();
      ordered.splice(nextIndex, 0, { element: tabElmt, rect: draggedRect });
      const totalWidth = ordered.reduce((sum, entry) => sum + entry.rect.width, 0);
      if (totalWidth <= signRect.width + 0.5) {
        const slots = initialPeers.map(({ rect }) => rect.left);
        const positions = ordered.map((entry, index) => ({
          element: entry.element,
          width: entry.rect.width,
          left: entry.element === tabElmt ? draggedRect.left : slots[index],
        }));
        let right = signRect.left;
        positions.forEach((entry) => {
          entry.left = Math.max(right, Math.min(entry.left, signRect.right - entry.width));
          right = entry.left + entry.width;
        });
        if (right > signRect.right) {
          right = signRect.right;
          for (let i = positions.length - 1; i >= 0; i--) {
            positions[i].left = Math.min(positions[i].left, right - positions[i].width);
            right = positions[i].left;
          }
        }
        positions.forEach(({ element, left }) => {
          const holder = element.parentElement;
          const parentTab = panel.exitTabs[Number(holder.dataset.exitTabIndex)];
          const nestedIndex = Number(holder.dataset.nestedExitTabIndex);
          const tab = nestedIndex >= 0 ? parentTab?.nestedExitTabs?.[nestedIndex] : parentTab;
          if (!tab || !moveRenderedExitTabToLeft(holder, element, tab, left)) return;
          tab.dragSnapAnchor = null;
          tab.dragLayoutPosition = tab.position;
          if (nestedIndex >= 0) tab.dragParentLayoutPosition = parentTab.position;
        });
        exitTab.dragSnapAnchor = null;
      }
    }

    const placement = resolveExitTabDragPlacement(
      panelElmt, tabElmt, tabElmt.getBoundingClientRect().left
    );
    moveRenderedExitTabToLeft(tabElmt.parentElement, tabElmt, exitTab, placement.left);
    exitTab.dragSnapAnchor = placement.anchor;
    applyRenderedExitTabAnchors(panelElmt, panel);
  };

  const bindRenderedExitTabDrag = (panelElmt, holder, tabElmt, exitTab) => {
    if (!panelElmt || !holder || !tabElmt || !exitTab) return;
    tabElmt.classList.add("draggableExitTab");
    const initialOffset = Number(exitTab.dragOffsetRem) || 0;
    setRenderedExitTabOffset(holder, initialOffset);

    let suppressClick = false;
    holder.addEventListener("click", (event) => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClick = false;
    }, true);
    tabElmt.addEventListener("dragstart", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    tabElmt.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const signElmt = panelElmt.querySelector(":scope > .signContainer > .sign");
      if (!signElmt) return;
      const startRect = tabElmt.getBoundingClientRect();
      if (startRect.width >= signElmt.getBoundingClientRect().width - 1) return;
      event.stopPropagation();
      const startX = event.clientX;
      const initialPeers = getExitTabDragPeers(panelElmt, tabElmt);
      const previousZIndex = holder.style.zIndex;
      const dragContainer = holder.closest(".exitTabContainer");
      const previousContainerZIndex = dragContainer?.style.zIndex;
      const startOffset = Number(exitTab.dragOffsetRem) || 0;
      const startAnchor = exitTab.dragSnapAnchor || null;
      const startLayoutPosition = exitTab.dragLayoutPosition;
      const startParentLayoutPosition = exitTab.dragParentLayoutPosition;
      const scale = tabElmt.offsetWidth ? startRect.width / tabElmt.offsetWidth : 1;
      const remPixels = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) * scale;
      // Stacked panels drag from their .panelStack wrapper.
      const dragHost = panelElmt.closest(".panelStack") || panelElmt;
      const wasPanelDraggable = dragHost.draggable;
      dragHost.draggable = false;
      tabElmt.setPointerCapture(event.pointerId);
      let moved = false;

      const finish = (endEvent, cancelled) => {
        endEvent.stopPropagation();
        tabElmt.removeEventListener("pointermove", move);
        tabElmt.removeEventListener("pointerup", up);
        tabElmt.removeEventListener("pointercancel", cancel);
        if (tabElmt.hasPointerCapture(endEvent.pointerId)) tabElmt.releasePointerCapture(endEvent.pointerId);
        dragHost.draggable = wasPanelDraggable;
        if (!moved) return;
        delete panelElmt.dataset.exitTabDragActive;
        tabElmt.classList.remove("draggingExitTab");
        holder.style.zIndex = previousZIndex;
        if (dragContainer) dragContainer.style.zIndex = previousContainerZIndex;
        if (cancelled) {
          exitTab.dragOffsetRem = startOffset;
          exitTab.dragSnapAnchor = startAnchor;
          if (startLayoutPosition === undefined) delete exitTab.dragLayoutPosition;
          else exitTab.dragLayoutPosition = startLayoutPosition;
          if (startParentLayoutPosition === undefined) delete exitTab.dragParentLayoutPosition;
          else exitTab.dragParentLayoutPosition = startParentLayoutPosition;
          setRenderedExitTabOffset(holder, startOffset);
          applyRenderedExitTabAnchors(panelElmt, post.panels[Number(panelElmt.dataset.panelIndex)]);
        } else {
          suppressClick = true;
          setTimeout(() => { suppressClick = false; }, 0);
          settleDraggedExitTabOrder(panelElmt, tabElmt, exitTab, initialPeers);
          schedulePanelBorderGradientUpdate(panelElmt);
        }
        if (!cancelled) {
          captureHistoryAfterRedraw();
          persistSessionState();
        }
      };
      const move = (moveEvent) => {
        if (moveEvent.pointerId !== event.pointerId) return;
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        if (!moved && Math.abs(moveEvent.clientX - startX) < 3) return;
        if (!moved) {
          moved = true;
          panelElmt.dataset.exitTabDragActive = "true";
          tabElmt.classList.add("draggingExitTab");
          holder.style.zIndex = "5";
          if (dragContainer) dragContainer.style.zIndex = "4";
        }
        const placement = resolveExitTabDragPlacement(
          panelElmt, tabElmt, startRect.left + moveEvent.clientX - startX,
          true, true
        );
        const offset = Math.round((startOffset + (placement.left - startRect.left) / remPixels) * 10000) / 10000;
        exitTab.dragOffsetRem = offset;
        exitTab.dragSnapAnchor = placement.anchor;
        exitTab.dragLayoutPosition = exitTab.position;
        const parentTab = post.panels[Number(panelElmt.dataset.panelIndex)]
          ?.exitTabs?.[Number(holder.dataset.exitTabIndex)];
        if (parentTab && parentTab !== exitTab) {
          exitTab.dragParentLayoutPosition = parentTab.position;
        }
        setRenderedExitTabOffset(holder, offset);
      };
      const up = (upEvent) => finish(upEvent, false);
      const cancel = (cancelEvent) => finish(cancelEvent, true);
      tabElmt.addEventListener("pointermove", move);
      tabElmt.addEventListener("pointerup", up);
      tabElmt.addEventListener("pointercancel", cancel);
    });
  };

  const hasDraggedExitTabs = (panel) =>
    (panel.exitTabs || []).some((tab) => [tab, ...(tab.nestedExitTabs || [])]
      .some((item) => item.dragSnapAnchor || Number(item.dragOffsetRem)));

  const disconnectExitTabAnchorObservers = () => {
    exitTabAnchorObservers.forEach((observer) => observer.disconnect());
    exitTabAnchorObservers = [];
  };

  const layoutDraggedExitTabs = (panelContainerElmt) => {
    panelContainerElmt.querySelectorAll(".panel[data-panel-index]").forEach((panelElmt) => {
      const panel = post.panels[Number(panelElmt.dataset.panelIndex)];
      if (!panel || !hasDraggedExitTabs(panel)) return;
      adoptNearbyExitTabAnchors(panelElmt, panel);
      applyRenderedExitTabAnchors(panelElmt, panel);
      watchRenderedExitTabAnchors(panelElmt, panel);
    });
  };


  // signs.css styles the sign by what an element contains. :has() did that,
  // but WebKit re-checked those rules across the page on every redraw, which
  // made each edit about 4ms slower; these classes are set from the same
  // conditions instead. [element, contains, class]
  const SIGN_CONTENT_CLASSES = [
    [".subPanelDisplay", ".subpanelAplArrows", "smHasAplArrows"],
    [".signHolder", ".subpanelAplArrows", "smHasAplArrows"],
    [".exitTab", ".tagOnlyText", "smHasTagOnlyText"],
    [".signContainer", ".guideArrows.exit_only", "smHasExitOnlyArrows"],
    [".signContainer", "> .guideArrows.exit_only", "smHasExitOnlyRow"],
    [".signContainer", "> .guideArrows.half_exit.only", "smHasHalfExitOnlyRow"],
    [".signContainer", "> .guideArrows.half_exit.only .arrowContainer.left.new2", "smHalfExitLeftNew2"],
    [".signContainer", "> .guideArrows.half_exit.only .arrowContainer.new:first-child", "smHalfExitFirstNew"],
    [".signContainer", "> .guideArrows.half_exit.only .arrowContainer.right.new2", "smHalfExitRightNew2"],
    [".signContainer", "> .guideArrows.half_exit.only .arrowContainer.new:last-child", "smHalfExitLastNew"],
    [".signContainer", "> .guideArrows.modernExitOnly", "smHasModernExitOnly"],
    [".guideArrows.modernExitOnly-laneSplit.modernExitOnlyColoredEdges", ".onLeft", "smHasOnLeft"],
    [".guideArrows.modernExitOnly-laneSplit.modernExitOnlyColoredEdges", ".onRight", "smHasOnRight"],
    [".signContainer", "> .guideArrows.modernExitOnly-standard.modernExitOnlyColoredEdges", "smModernStandardColoredEdges"],
    [".signContainer", "> .guideArrows.modernExitOnly-laneSplit.modernExitOnlyColoredEdges .modernExitColoredLane.onLeft", "smModernSplitColoredLeft"],
    [".signContainer", "> .guideArrows.modernExitOnly-laneSplit.modernExitOnlyColoredEdges .modernExitColoredLane.onRight", "smModernSplitColoredRight"],
  ];
  const syncSignContentClasses = (root) => {
    for (const [subject, condition, className] of SIGN_CONTENT_CLASSES) {
      root.querySelectorAll(subject).forEach((element) => {
        element.classList.toggle(className, !!element.querySelector(`:scope ${condition}`));
      });
    }
  };
  // Redraws and arrows that load later both change the sign; update the
  // classes before the next paint.
  let signContentClassesQueued = false;
  const watchSignContentClasses = () => {
    const panelContainerElmt = document.getElementById("panelContainer");
    new MutationObserver(() => {
      if (signContentClassesQueued) return;
      signContentClassesQueued = true;
      queueMicrotask(() => {
        signContentClassesQueued = false;
        syncSignContentClasses(panelContainerElmt);
      });
    }).observe(panelContainerElmt, { childList: true, subtree: true });
    syncSignContentClasses(panelContainerElmt);
  };

  const redraw = function () {
    VmsPanel.disconnect();
    disconnectExitTabAnchorObservers();
    setSignFractionsEnabled(post.signFractions);
    const postContainerElmt = document.getElementById("postContainer");
    const panelContainerElmt = document.getElementById("panelContainer");
    const posts = document.getElementsByClassName("post");
    const availablePolePositions = Post.prototype.polePositions;
    const polePosition = availablePolePositions.includes(post.polePosition)
      ? post.polePosition
      : availablePolePositions[0];
    post.polePosition = polePosition;
    const polePositionClass = `polePosition${polePosition}`;
    const availableColors = Post.prototype.colors;
    const postUsesCustomColor = isCustomCssColorValue(post.color);
    const normalizedPostColor = !postUsesCustomColor && availableColors.includes(post.color)
      ? post.color
      : availableColors[0];
    const colorClass = normalizedPostColor && !postUsesCustomColor
      ? ` postColor${normalizedPostColor}`
      : "";
    postContainerElmt.className = `${polePositionClass}${colorClass}`;
    applyCustomPostColorVars(postContainerElmt, postUsesCustomColor ? post.color : "");
    postContainerElmt.classList.toggle(
      "showBlockBoundingBoxes",
      !!post.showBlockBoundingBoxes
    );
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
    const signAlignment = normalizeSignAlignment(post.signAlignment);
    post.signAlignment = signAlignment;
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
      panelContainerElmt.style.alignItems = getSignAlignmentFlexValue(signAlignment);
      panelContainerElmt.style.justifyContent = "";
      panelContainerElmt.dataset.panelOrientation = "horizontal";
      panelContainerElmt.dataset.signAlignment =
        signAlignment.toLowerCase();
    }

    var index = -1;
    var firstExitTab = null;
    let currentPanelStackElmt = null;

    for (const panel of post.panels) {
      index++;
      const panelHidden = isPanelHiddenFromPost(index);
      if (panelHidden && index !== currentlySelectedPanelIndex) {
        if (!isStackedPanelBottom(index)) {
          currentPanelStackElmt = null;
        }
        continue;
      }
      ensureExitTabLayoutIds(panel);
      normalizeExitTabAplEdgeAvailabilityForPanel(panel);
      const isPanelGroupPreview =
        currentlyEditingGroupPath.length > 0 &&
        index === currentlySelectedPanelIndex &&
        currentlySelectedSubPanelIndex > -1;

      const panelElmt = document.createElement("div");
      panelElmt.className = `panel ${panel.color.toLowerCase()} ${panel.corner.toLowerCase()}`;
      applyCustomColorVars([panelElmt], "Panel", panel.color);
      VmsPanel.configure(panelElmt, panel);
      panelElmt.classList.toggle("groupPreviewPanel", isPanelGroupPreview);
      const panelBorderWidth = Panel.getBorderThickness(panel);
      panelElmt.classList.toggle("panelBorderHidden", panelBorderWidth === 0);
      if (panelBorderWidth !== 0.2) {
        panelElmt.style.setProperty("--signBorderWidth", `${panelBorderWidth}rem`);
        panelElmt.style.setProperty("--panelBorderWidth", `${panelBorderWidth}rem`);
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
      panelElmt.classList.toggle("panelHiddenFromPost", panelHidden);
      const isAdditionalStackedPanel = isStackedPanelBottom(index);
      panelElmt.draggable = post.panels.length > 1 && !isAdditionalStackedPanel;
      panelElmt.addEventListener("dragstart", handleRenderedPanelDragStart);
      panelElmt.addEventListener("dragend", handleRenderedPanelDragEnd);
      const panelClickIndex = index;
      panelElmt.addEventListener("click", (event) => {
        event.stopPropagation();
        changeEditingPanel(panelClickIndex);
      });
      const hasDrawnStackPanels = !isAdditionalStackedPanel &&
        getStackedPanelGroupIndices(index).slice(1).some(
          (stackIndex) => !isPanelHiddenFromPost(stackIndex) || stackIndex === currentlySelectedPanelIndex
        );
      if (isAdditionalStackedPanel && currentPanelStackElmt) {
        const isAboveMain = isStackedPanelAboveMain(index);
        panelElmt.classList.add(
          "stackedPanelAdditional",
          isAboveMain ? "stackedPanelAbove" : "stackedPanelBelow"
        );
        const mainPanelElmt = currentPanelStackElmt.querySelector(":scope > .stackedPanelMain");
        if (isAboveMain && mainPanelElmt) {
          currentPanelStackElmt.insertBefore(panelElmt, mainPanelElmt);
        } else {
          currentPanelStackElmt.appendChild(panelElmt);
        }
      } else if (hasDrawnStackPanels) {
        const spacing = normalizeStackedPanelSpacing(panel.stackedPanelSpacing);
        currentPanelStackElmt = document.createElement("div");
        currentPanelStackElmt.className = "panelStack";
        currentPanelStackElmt.classList.toggle(
          "stackedPanelMatchWidth",
          panel.stackedPanelMatchWidth === true
        );
        currentPanelStackElmt.classList.toggle("negativeStackedPanelSpacing", spacing < 0);
        currentPanelStackElmt.dataset.stackTopPanelIndex = String(index);
        currentPanelStackElmt.style.setProperty("--stackedPanelSpacing", Math.max(0, spacing) + "rem");
        currentPanelStackElmt.style.setProperty("--stackedPanelOverlap", Math.min(0, spacing) + "rem");
        currentPanelStackElmt.draggable = panelElmt.draggable;
        panelElmt.draggable = false;
        currentPanelStackElmt.dataset.panelIndex = index.toString();
        currentPanelStackElmt.addEventListener("dragstart", handleRenderedPanelDragStart);
        currentPanelStackElmt.addEventListener("dragend", handleRenderedPanelDragEnd);
        panelElmt.classList.add("stackedPanelMain");
        currentPanelStackElmt.appendChild(panelElmt);
        panelContainerElmt.appendChild(currentPanelStackElmt);
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
        const parentExitTab = panel.exitTabs[exitTabIndex];
        var exitTab = parentExitTab;
        const hasAttachedExitTab =
          parentExitTab.width === "Side" ||
          !!parentExitTab.attached ||
          (Array.isArray(parentExitTab.nestedExitTabs) &&
            parentExitTab.nestedExitTabs.some(
              (nestedTab) => !!nestedTab.attached
            ));

        const exitTabCont = document.createElement("div");
        exitTabCont.className = `exitTabContainer ${exitTab.position.toLowerCase()} ${exitTab.width.toLowerCase()}`;
        if (isAplEdgeExitTabWidth(exitTab.width)) {
          exitTabCont.classList.add("aplEdge");
          exitTabCont.dataset.aplEdgePosition = String(
            exitTab.position || "Right"
          );
        }
        if (
          hasAttachedExitTab &&
          !(parentExitTab.caStyle && parentExitTab.variant == "Default")
        ) {
          exitTabCont.classList.add("attached");
        }

        // If CA style, don't append to panel yet - store for later insertion inside sign
        if (exitTab.caStyle && exitTab.variant == "Default") {
          caStyleExitTabs.push({ exitTabCont, exitTabIndex });
        } else {
          panelElmt.appendChild(exitTabCont);
        }

        // Apply nested tab spacing CSS variable
        const nestedTabSpacingValue =
          typeof exitTab.nestedTabSpacing === "number" && exitTab.nestedTabSpacing > 0
            ? exitTab.nestedTabSpacing
            : 0;
        exitTabCont.style.setProperty("--nestedTabSpacing", nestedTabSpacingValue + "rem");

        var nestedExitTabs = exitTab.nestedExitTabs.length;

        for (let nestIndex = -1; nestIndex < nestedExitTabs; nestIndex++) {
          if (nestIndex != -1) {
            exitTab = exitTab.nestedExitTabs[nestIndex];
          }
          // Quebec exit markers draw on the sign instead of as a tab.
          if (exitTab.variant === "Quebec Exit Marker") {
            continue;
          }

          const exitTabElmt = document.createElement("div");
          exitTabElmt.className = `exitTab ${exitTab.position.toLowerCase()} ${exitTab.width.toLowerCase()}`;
          if (isAplEdgeExitTabWidth(exitTab.width)) {
            exitTabElmt.classList.add("aplEdge");
          }
          const isSideExitTab = exitTab.width === "Side";
          if (exitTab.squareCorners) {
            exitTabElmt.className += " squareCorners";
          }
          const exitTabHorizontalPadding = ExitTab.normalizeHorizontalPadding(
            exitTab.horizontalPadding
          );
          if (exitTabHorizontalPadding !== 0) {
            exitTabElmt.style.setProperty(
              "--exitTabHorizontalPadding",
              exitTabHorizontalPadding + "rem"
            );
          }
          const exitTabCornerRadius = exitTab.cornerRadius === "panel"
            ? "var(--signBorderRadius, 0.75rem)"
            : ExitTab.normalizeCornerRadius(exitTab.cornerRadius) + "rem";
          exitTabElmt.style.setProperty("--exitTabCornerRadius", exitTabCornerRadius);
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
          const exitTabFontFamily =
            exitTab.fontFamily || ExitTab.prototype.defaultFontFamily;
          const usesHighwayGothicFont =
            /^Series\s/i.test(exitTabFontFamily) || post.fontType === true;
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
              const separatedSuffixMatch = rawTrailingText.match(
                /^(\s+)(\S[\s\S]*?)\s*$/
              );
              const trailingText = separatedSuffixMatch
                ? separatedSuffixMatch[2]
                : rawTrailingText;
              const suffixWasSeparated = !!separatedSuffixMatch;
              const separatedSuffixSpaceCount = suffixWasSeparated
                ? Math.max(1, separatedSuffixMatch[1].length)
                : 0;

              if (exitTab.verticalArrangement && txtArr.length > 1) {
                const verticalContainer = document.createElement("div");
                verticalContainer.className = "exitTabVerticalContainer";

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
                const spanNumeralElmt = document.createElement("span");
                spanNumeralElmt.className = "numeral";
                registerExitTabText(spanNumeralElmt);
                spanNumeralElmt.appendChild(document.createTextNode(txtArr[1]));
                bottomNumberElmt.appendChild(spanNumeralElmt);
                if (trailingText) {
                  const trailingSpanElmt = document.createElement("span");
                  trailingSpanElmt.className =
                    "numeral exitTabTrailing exitTabVerticalTrailing";
                  trailingSpanElmt.textContent = trailingText;
                  if (suffixWasSeparated) {
                    trailingSpanElmt.classList.add("exitTabSeparatedSuffix");
                    trailingSpanElmt.style.setProperty(
                      "--exitTabTrailingGap",
                      `${separatedSuffixSpaceCount * 0.02}em`
                    );
                  }
                  registerExitTabText(trailingSpanElmt);
                  bottomNumberElmt.appendChild(trailingSpanElmt);
                }
                verticalContainer.appendChild(bottomNumberElmt);
                targetElmt.appendChild(verticalContainer);
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

          // v2.19 bilingual tabs stack EXIT over SORTIE beside the number.
          const appendBilingualExitNumber = (parentElmt) => {
            const numberText = String(exitTab.number || "")
              .replace(/\\n|\n/g, " ")
              .replace(/\b(EXIT|SORTIE)\b/gi, "")
              .replace(/\s+/g, " ")
              .trim();
            const wrapper = document.createElement("div");
            wrapper.className = "exitTabBilingualBlock";
            registerExitTabText(wrapper);
            for (const [lineClass, text] of [
              ["exitTabBilingualTopLine", exitTab.bilingualTopText || "EXIT"],
              ["exitTabBilingualBottomLine", exitTab.bilingualBottomText || "SORTIE"],
            ]) {
              const line = document.createElement("div");
              line.className = `exitTabBilingualLine ${lineClass}`;
              const label = document.createElement("span");
              label.className = "exitTabBilingualLabelText";
              registerExitTabText(label);
              label.textContent = String(text).trim().toUpperCase();
              line.appendChild(label);
              if (lineClass === "exitTabBilingualBottomLine" && numberText) {
                const numberElmt = document.createElement("span");
                numberElmt.className = "numeral exitTabBilingualNumber";
                registerExitTabText(numberElmt);
                numberElmt.textContent = numberText.toUpperCase();
                line.appendChild(numberElmt);
              }
              wrapper.appendChild(line);
            }
            parentElmt.appendChild(wrapper);
          };

          const exitTabHolderElmt = document.createElement("div");
          exitTabHolderElmt.className = "exitTabHolder";
          if (
            (isSideExitTab || exitTab.attached) &&
            !(exitTab.caStyle && exitTab.variant == "Default")
          ) {
            exitTabElmt.classList.add("attached");
            exitTabHolderElmt.classList.add("attached");
          }
          exitTabHolderElmt.appendChild(exitTabElmt);

          exitTabCont.appendChild(exitTabHolderElmt);
          exitTabHolderElmt.dataset.exitTabIndex = String(exitTabIndex);
          exitTabHolderElmt.dataset.nestedExitTabIndex = String(nestIndex);
          exitTabElmt.dataset.layoutId = exitTab.layoutId;
          bindRenderedExitTabDrag(panelElmt, exitTabHolderElmt, exitTabElmt, exitTab);

          if (exitTab.color != "Panel Color" && exitTab.color != undefined) {
            exitTabElmt.className += ` ${exitTab.color.toLowerCase()}`;
            exitTabHolderElmt.className += ` ${exitTab.color.toLowerCase()}`;
          } else {
            exitTabElmt.className += ` ${panel.color.toLowerCase()}`;
            exitTabHolderElmt.className += ` ${panel.color.toLowerCase()}`;
          }

          const exitTabBackgroundColor =
            exitTab.color != "Panel Color" && exitTab.color != undefined
              ? exitTab.color
              : panel.color;
          applyCustomColorVars(
            [exitTabElmt, exitTabHolderElmt, exitTabCont],
            "ExitTab",
            exitTabBackgroundColor
          );
          const renderedExitTabFont = resolveTextFontFamilyForRender(
            exitTabFontFamily,
            { backgroundColor: exitTabBackgroundColor },
            panel
          );
          exitTabElmt.style.setProperty(
            "--exitTabFontFamily",
            `"${renderedExitTabFont}"`
          );
          exitTabElmt.dataset.exportFontFamily = renderedExitTabFont;

          if (exitTab.verticalArrangement && exitTab.variant == "Default") {
            exitTabElmt.classList.add("verticalArrangement");
          }

          const exitTabCharacterSpacing = Number(exitTab.characterSpacing) || 0;
          if (exitTabCharacterSpacing !== 0) {
            exitTabElmt.classList.add("customExitTabSpacing");
            exitTabElmt.style.setProperty(
              "--exitTabCharacterSpacing",
              String(exitTabCharacterSpacing)
            );
          }
          const exitTextSizePercent = Number(exitTab.exitTextSizePercent) ||
            ExitTab.prototype.defaultExitTextSizePercent;
          exitTabElmt.style.setProperty(
            "--exitTabPrefixScale",
            String(exitTextSizePercent / 100)
          );
          if (exitTextSizePercent !== ExitTab.prototype.defaultExitTextSizePercent) {
            exitTabElmt.classList.add("customExitTextSize");
          }
          if (exitTab.textColor && exitTab.textColor !== "Panel Color") {
            const exitTabTextColor = getResolvedCssColorValue(exitTab.textColor);
            if (exitTabTextColor) {
              exitTabElmt.style.setProperty("--exitTabTextColor", exitTabTextColor);
              exitTabElmt.classList.add("customExitTabTextColor");
            }
          }

          if (usesHighwayGothicFont) {
            const highwayGothicFont = /^Series\s/i.test(exitTabFontFamily)
              ? exitTabFontFamily
              : "Series E";
            applyHighwayGothicStyling(exitTabElmt, highwayGothicFont);
            exitTabElmt.dataset.exportFontFamily = highwayGothicFont;
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

              if (exitTab.bilingual === true) {
                exitTabElmt.classList.add("bilingualExitTab");
                const widthClass = String(exitTab.width || "").toLowerCase();
                if (widthClass === "edge" || widthClass === "narrow") {
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
              if (exitTab.transparent === true) {
                exitTabElmt.classList.add("transparentAsset");
                exitTabHolderElmt.classList.add("transparentAsset");
                exitTabCont.classList.add("transparentAsset");
              }
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
              exitTabElmt.classList.add("iconExitTab");
              const icons = IconElement.prototype.icons;
              const iconDef = icons[exitTab.icon] || icons.AIRPORT || icons[IconElement.prototype.defaultIcon];
              const iconSize = parseFloat(exitTab.tollLogoSize);
              exitTabElmt.style.setProperty(
                "--exitIconSize",
                (Number.isFinite(iconSize) ? Math.max(1, Math.min(6, iconSize)) : 3) + "rem"
              );
              const iconWrapperElmt = document.createElement("div");
              iconWrapperElmt.className = "exitTabIconWrapper";
              const iconImgElmt = document.createElement("img");
              iconImgElmt.className = "exitTabIconImage";
              iconImgElmt.src = iconDef.src;
              iconImgElmt.alt = iconDef.label;
              iconImgElmt.decoding = "async";
              iconWrapperElmt.appendChild(iconImgElmt);
              exitTabElmt.appendChild(iconWrapperElmt);
              if (exitTab.transparent === true) {
                exitTabElmt.classList.add("transparentAsset");
                exitTabHolderElmt.classList.add("transparentAsset");
                exitTabCont.classList.add("transparentAsset");
              }
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

            exitTabElmt.style.visibility = "visible";
            exitTabCont.classList.add("tabVisible");
            exitTabCont.style.display = "flex";
            if (exitTabCont.parentElement === panelElmt) {
              panelElmt.classList.add("hasVisibleExitTab");
            }

            const cornerRadius = exitTab.squareCorners
              ? "0.25rem"
              : exitTabCornerRadius;

            if (exitTab.fullBorder == true || isSideExitTab) {
              exitTabElmt.style.borderBottomWidth = borderThicknessRem;
              exitTabElmt.style.borderBottomStyle = isBorderlessTab ? "" : "solid";
              exitTabElmt.style.borderRadius = isBorderlessTab ? "0" : cornerRadius;
            } else {
              exitTabElmt.style.borderBottomWidth = "";
              exitTabElmt.style.borderBottomStyle = "";
              exitTabElmt.style.borderRadius = "";
            }

            exitTabElmt.style.borderTopWidth = borderThicknessRem;
            exitTabElmt.style.borderLeftWidth = borderThicknessRem;
            exitTabElmt.style.borderRightWidth = borderThicknessRem;
            if (exitTab.caStyle && exitTab.variant == "Default") {
              // A fully bordered box with the sign's radius; CSS slides its
              // flush edges under the sign's border so the joins are rounded.
              exitTabElmt.style.borderBottomWidth = borderThicknessRem;
              exitTabElmt.style.borderBottomStyle = isBorderlessTab ? "" : "solid";
              exitTabElmt.style.borderRadius = isBorderlessTab
                ? "0" : "var(--signBorderRadius, 0.75rem)";
            }
            let resolvedFontSize = exitTab.fontSize;
            if (typeof resolvedFontSize === "string") {
              resolvedFontSize = parseFloat(resolvedFontSize);
            }
            if (!Number.isFinite(resolvedFontSize)) {
              resolvedFontSize = 0;
            }
            if (usesHighwayGothicFont) {
              resolvedFontSize *= FHWA_EXIT_TAB_FONT_SCALE;
            }
            exitTabElmt.style.fontSize = resolvedFontSize.toString() + "px";

            const parsedMinHeight = parseFloat(exitTab.minHeight);
            const resolvedMinHeight =
              Number.isFinite(parsedMinHeight) && parsedMinHeight >= 0
                ? parsedMinHeight
                : 2.25;
            exitTabElmt.style.minHeight = resolvedMinHeight.toString() + "rem";
            if (exitTab.variant == "Toll Logo" && exitTab.tollLogoOnly) {
              exitTabElmt.style.minHeight = "0";
            }
          }
        }

        if (exitTabIndex == 0) {
          firstExitTab = exitTabCont;
        }
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
            const bannerText =
              Shield.prototype.getBannerDisplayText(shield.bannerType);
            bannerElmt.appendChild(
              document.createTextNode(bannerText)
            );
            if (bannerText.includes("\n")) {
              bannerElmt.classList.add("multilineBanner");
            }
          } else {
            bannerElmt.appendChild(document.createTextNode(" "));
          }

          if (shield.bannerType2 != "None") {
            const bannerText2 =
              Shield.prototype.getBannerDisplayText(shield.bannerType2);
            bannerElmt2.appendChild(document.createTextNode(bannerText2));
            if (bannerText2.includes("\n")) {
              bannerElmt2.classList.add("multilineBanner");
            }
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
          } else {
            p.style.fontFamily = "Series E";
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

      const visibleSideExitTabs = Array.from(panelElmt.children).filter(
        (element) =>
          element.matches(
            ".exitTabContainer.side.tabVisible.left, .exitTabContainer.side.tabVisible.right"
          )
      );
      const signRowElmt =
        visibleSideExitTabs.length > 0 ? document.createElement("div") : null;
      if (signRowElmt) {
        signRowElmt.className = "signSideLayout";
        panelElmt.appendChild(signRowElmt);
        visibleSideExitTabs
          .filter((element) => element.classList.contains("left"))
          .forEach((element) => signRowElmt.appendChild(element));
      }

      const signCont = document.createElement("div");
      signCont.className = `signContainer ${panel.exitTabs[0].width.toLowerCase()}`;
      (signRowElmt || panelElmt).appendChild(signCont);

      if (signRowElmt) {
        visibleSideExitTabs
          .filter((element) => element.classList.contains("right"))
          .forEach((element) => signRowElmt.appendChild(element));
      }

      const signElmt = document.createElement("div");
      signElmt.className = `sign ${panel.exitTabs[0].width.toLowerCase()}`;

      // CA style tabs sit inside the sign, so it keeps its own corners.
      const firstTabIsCaStyle =
        panel.exitTabs[0]?.caStyle && panel.exitTabs[0].variant == "Default";
      if (
        panel.exitTabs.length > 0 &&
        panel.exitTabs[0].number != null &&
        !firstTabIsCaStyle
      ) {
        signElmt.className += " tabVisible";
      }

      signCont.appendChild(signElmt);

      const g_top = document.createElement("div");
      g_top.className = `globalTop`;
      signElmt.appendChild(g_top);

      const signHolderElmt = document.createElement("div");
      signHolderElmt.className = `signHolder`;
      signElmt.appendChild(signHolderElmt);

      const applyAplEdgeExitTabLayout = () => {
        const aplEdgeTabs = Array.from(
          panelElmt.querySelectorAll(":scope > .exitTabContainer.aplEdge")
        );

        if (!aplEdgeTabs.length) {
          return;
        }

        const signRect = signElmt.getBoundingClientRect();
        if (!signRect.width) {
          return;
        }

        aplEdgeTabs.forEach((tabContainer) => {
          const tabPosition = String(
            tabContainer.dataset.aplEdgePosition ||
              (tabContainer.classList.contains("left") ? "Left" : "Right")
          ).toLowerCase();
          const dividerIndex = getAplEdgeDividerForExitTab(
            panel.sign,
            tabPosition
          );

          if (dividerIndex == null) {
            return;
          }

          const dividerElmt = signHolderElmt.querySelector(
            `:scope > #subDivider${dividerIndex + 1}`
          );
          if (!dividerElmt) {
            return;
          }

          const dividerRect = dividerElmt.getBoundingClientRect();
          const rawWidth =
            tabPosition === "left"
              ? dividerRect.right - signRect.left
              : signRect.right - dividerRect.left;
          const tabWidth = Math.max(0, Math.ceil(rawWidth));

          if (!tabWidth) {
            return;
          }

          tabContainer.style.setProperty("--aplEdgeTabWidth", `${tabWidth}px`);
          tabContainer.style.width = `${tabWidth}px`;
          tabContainer.style.minWidth = `${tabWidth}px`;
          tabContainer.style.maxWidth = `${tabWidth}px`;

          if (tabPosition === "left") {
            tabContainer.style.marginLeft = "0";
            tabContainer.style.marginRight = "auto";
          } else {
            tabContainer.style.marginLeft = "auto";
            tabContainer.style.marginRight = "0";
          }
        });
      };

      const g_bottom = document.createElement("div");
      g_bottom.className = `globalBottom`;
      signElmt.appendChild(g_bottom);

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

      const configuredGuideArrowKind = ArrowElement.prototype.arrows[
        panel.sign.bottomArrowKind
      ]
        ? panel.sign.bottomArrowKind
        : null;
      const resolvedGuideArrowKind =
        configuredGuideArrowKind ||
        (panel.sign.guideArrow !== "None"
          ? ArrowElement.prototype.defaultArrow
          : null);
      const createConfiguredGuideArrow = function (name, extra) {
        if (!resolvedGuideArrowKind) {
          return null;
        }

        const arrow = new ArrowElement({
          arrow: resolvedGuideArrowKind,
          rotation: panel.sign.bottomArrowRotation,
        });
        const arrowElement = arrow.createElement();
        arrowElement.dataset.arrowKind = resolvedGuideArrowKind;
        for (const className of `${name || "exitOnlyArrow"} ${extra || ""}`
          .trim()
          .split(/\s+/)) {
          if (className) {
            arrowElement.classList.add(className);
          }
        }

        let reservedArrowSize = { height: 2 };
        if (name === "sideLeftArrow" || name === "sideRightArrow") {
          reservedArrowSize = { height: 2.5 };
        } else if (
          (!name || name === "exitOnlyArrow" || name === "halfarrow") &&
          resolvedGuideArrowKind === "TYPE_A"
        ) {
          reservedArrowSize = { width: 1.75 };
        }
        const layoutRotation = panel.sign.guideArrow.includes("Exit Only")
          ? 0
          : panel.sign.bottomArrowRotation;
        reserveRotatedGuideArrowSpace(
          arrowElement,
          resolvedGuideArrowKind,
          layoutRotation,
          reservedArrowSize
        );
        return arrowElement;
      };
      const hasBottomArrow =
        panel.sign.arrowMode !== "apl" &&
        panel.sign.guideArrow === "None" &&
        !!configuredGuideArrowKind;
      const guideArrowClass = hasBottomArrow
        ? "bottom_arrow"
        : panel.sign.guideArrow
          .replace("/", "-")
          .replace(" ", "_")
          .toLowerCase();
      const guideArrowsElmt = document.createElement("div");
      guideArrowsElmt.className = `guideArrows ${guideArrowClass} ${panel.sign.arrowPosition.toLowerCase()}`;
      signCont.appendChild(guideArrowsElmt);

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

      const sideLeftArrowElmt = createConfiguredGuideArrow("sideLeftArrow");
      if (sideLeftArrowElmt) {
        signHolderElmt.appendChild(sideLeftArrowElmt);
      }

      // subpanels

      // Calculate APL arrow groups before the loop
      const aplArrows = panel.sign.aplArrows || [];
      const aplBuckets =
        aplArrows.length > 0 ? getAPLArrowBuckets(panel.sign) : [];
      const toIndexedAPLArrow = (arrow) => ({
        arrow,
        index: aplArrows.indexOf(arrow),
      });
      const arrowGroups = aplBuckets.map((bucket) =>
        bucket
          .filter((arrow) => !isAPLDividerArrow(arrow))
          .map(toIndexedAPLArrow)
          .filter((arrowData) => arrowData.index >= 0)
      );
      const dividerArrowGroups = aplBuckets.map((bucket) =>
        bucket
          .filter(isAPLDividerArrow)
          .map(toIndexedAPLArrow)
          .filter((arrowData) => arrowData.index >= 0)
      );

      const isAPLExitOnlyValue = (value) =>
        value === true ||
        value === "true" ||
        value === "on" ||
        value === 1 ||
        value === "1";

      const getSafeAPLSizeRem = (arrow) => {
        const parsed = Number(arrow?.arrowSizeRem);
        return Number.isFinite(parsed) && parsed > 0
          ? parsed
          : getDefaultAPLArrowSizeRem(arrow?.type);
      };

      const isAPLTurnArrowWithOffset = (arrow) =>
        arrow?.type === "APL_TURN" ||
        arrow?.type === "APL_UP_TURN" ||
        arrow?.type === "APL_TURN_CFX" ||
        arrow?.type === "APL_UP_TURN_CFX";

      const getAPLExitOnlyGapRem = (arrow) =>
        isAPLTurnArrowWithOffset(arrow)
          ? APL_EXIT_ONLY_TURN_GAP_REM
          : APL_EXIT_ONLY_STRAIGHT_GAP_REM;

      const getAPLExitOnlyStemOffsetRem = (arrow) => {
        if (!isAPLTurnArrowWithOffset(arrow)) {
          return 0;
        }

        const sizeBasedOffset = getSafeAPLSizeRem(arrow) * 0.32;
        const offset = Math.max(
          0.9,
          Math.min(1.2, sizeBasedOffset || APL_EXIT_ONLY_TURN_STEM_OFFSET_REM)
        );
        return arrow?.flip ? offset : -offset;
      };

      // Exit-only label size as a percent of the default (50-150%).
      const getAPLExitOnlySizeScale = (arrow) => {
        const size = Number(arrow?.exitOnlySize);
        return Number.isFinite(size) && arrow?.exitOnlySize != null
          ? Math.max(50, Math.min(150, size)) / 100
          : 1;
      };

      const getAPLLabelWidthRem = (arrow, side = "left") => {
        const fallback = side === "left" ? "EXIT" : "ONLY";
        const value =
          side === "left" ? arrow?.exitOnlyTextLeft : arrow?.exitOnlyTextRight;
        const text = String(value == null ? fallback : value);
        const padding = Number(arrow?.exitOnlyPadding);
        const horizontalPadding = Number.isFinite(padding)
          ? Math.max(0, padding) * 2
          : 0.36;
        return Math.max(
          4,
          text.length * 0.7 * getAPLExitOnlySizeScale(arrow) + horizontalPadding
        );
      };

      const isAPLArrowInCombinedRun = (arrowGroup, arrowIndex) =>
        panel.sign.combineAPLExitOnlyLabels === true &&
        isAPLExitOnlyValue(arrowGroup[arrowIndex]?.arrow?.exitOnly) &&
        (isAPLExitOnlyValue(arrowGroup[arrowIndex - 1]?.arrow?.exitOnly) ||
          isAPLExitOnlyValue(arrowGroup[arrowIndex + 1]?.arrow?.exitOnly));

      const getAPLArrowHalfWidthRem = (arrow) => {
        const aspectRatio = GUIDE_ARROW_ASPECT_RATIOS[arrow?.type] || 1;
        return Math.max(0.65, (getSafeAPLSizeRem(arrow) * aspectRatio) / 2);
      };

      const getAPLVisualExtentsRem = (arrowGroup, arrowIndex) => {
        const arrow = arrowGroup[arrowIndex]?.arrow;
        const arrowHalfWidth = getAPLArrowHalfWidthRem(arrow);

        if (
          !isAPLExitOnlyValue(arrow?.exitOnly) ||
          isAPLArrowInCombinedRun(arrowGroup, arrowIndex)
        ) {
          return { left: arrowHalfWidth, right: arrowHalfWidth };
        }

        const gap = getAPLExitOnlyGapRem(arrow);
        const stemOffset = getAPLExitOnlyStemOffsetRem(arrow);
        const leftLabelExtent = arrow?.exitOnlyHideLeft
          ? 0
          : getAPLLabelWidthRem(arrow, "left") + gap - stemOffset;
        const rightLabelExtent = arrow?.exitOnlyHideRight
          ? 0
          : getAPLLabelWidthRem(arrow, "right") + gap + stemOffset;

        return {
          left: Math.max(arrowHalfWidth, leftLabelExtent),
          right: Math.max(arrowHalfWidth, rightLabelExtent),
        };
      };

      const getAPLLeftReserveRem = (arrowGroup, subPanelIndex) => {
        if (!arrowGroup.length) return 0;
        const visual = getAPLVisualExtentsRem(arrowGroup, 0);
        if (subPanelIndex === 0) {
          return visual.left + APL_ARROW_OUTER_EDGE_PADDING_REM;
        }
        return Math.max(
          normalizeAPLArrowSpacing(arrowGroup[0].arrow.spacingBeforeRem),
          visual.left + APL_ARROW_EDGE_PADDING_REM
        );
      };

      const getAPLRightReserveRem = (arrowGroup, subPanelIndex) => {
        if (!arrowGroup.length) return 0;
        const lastIndex = arrowGroup.length - 1;
        const visual = getAPLVisualExtentsRem(arrowGroup, lastIndex);
        if (subPanelIndex >= panel.sign.subPanels.length - 1) {
          return visual.right + APL_ARROW_OUTER_EDGE_PADDING_REM;
        }
        return Math.max(
          normalizeAPLArrowSpacing(
            arrowGroup[lastIndex].arrow.spacingAfterRem
          ),
          visual.right + APL_ARROW_EDGE_PADDING_REM
        );
      };

      const getAPLSubpanelMinWidthRem = (arrowGroup, subPanelIndex) => {
        if (!arrowGroup.length) return 0;

        let widthRem = getAPLLeftReserveRem(arrowGroup, subPanelIndex);
        for (let index = 1; index < arrowGroup.length; index++) {
          widthRem += normalizeAPLArrowSpacing(
            arrowGroup[index - 1].arrow.spacingAfterRem
          );
        }
        widthRem += getAPLRightReserveRem(arrowGroup, subPanelIndex);
        return widthRem;
      };

      const aplArrowZoneHeightRem =
        aplArrows.length > 0
          ? Math.max(...aplArrows.map(getSafeAPLSizeRem)) +
            APL_ARROW_ZONE_EXTRA_REM
          : 5.9;
      const aplDividerStopOffsetRem = Math.max(
        0,
        aplArrowZoneHeightRem - APL_ARROW_ZONE_EXTRA_REM + 0.25
      );

      if (aplArrows.length > 0) {
        [signElmt, signHolderElmt].forEach((targetElmt) => {
          targetElmt.style.setProperty(
            "--aplArrowZoneHeight",
            `${aplArrowZoneHeightRem}rem`
          );
          targetElmt.style.setProperty(
            "--aplDividerStopOffset",
            `${aplDividerStopOffsetRem}rem`
          );
        });
      }

      const firstRenderedSubPanelIndex = isPanelGroupPreview
        ? clamp(
          currentlySelectedSubPanelIndex,
          0,
          Math.max(0, panel.sign.subPanels.length - 1)
        )
        : 0;
      const lastRenderedSubPanelIndex = isPanelGroupPreview
        ? firstRenderedSubPanelIndex + 1
        : panel.sign.subPanels.length;

      for (
        let subPanelIndex = firstRenderedSubPanelIndex;
        subPanelIndex < lastRenderedSubPanelIndex;
        subPanelIndex++
      ) {
        const subPanel = panel.sign.subPanels[subPanelIndex];
        let locked = false;

        if (subPanelIndex > 0 && !isPanelGroupPreview) {
          const subPanel = panel.sign.subPanels[subPanelIndex];
          const subDivider = document.createElement("div");
          subDivider.className = "subDivider";
          subDivider.id = "subDivider" + subPanelIndex.toString();
          if (subPanel?.hideDivider) {
            subDivider.classList.add("hiddenLine");
          }

          const dividerGroup = dividerArrowGroups[subPanelIndex - 1] || [];
          const dividerArrow =
            dividerGroup.length > 0
              ? dividerGroup[dividerGroup.length - 1].arrow
              : null;
          const dividerArrowDefinition =
            ArrowElement.prototype.arrows[dividerArrow?.type];
          if (dividerArrow && dividerArrowDefinition) {
            const divArrowImg = document.createElement("img");
            divArrowImg.className = "aplDividerArrow";
            divArrowImg.dataset.type = dividerArrow.type;
            divArrowImg.src = dividerArrowDefinition.src;
            divArrowImg.alt = dividerArrowDefinition.label;
            divArrowImg.style.height = `${getSafeAPLSizeRem(dividerArrow)}rem`;

            if (dividerArrow.flip) {
              divArrowImg.style.transform = "scaleX(-1)";
            }

            subDivider.appendChild(divArrowImg);
            subDivider.classList.add("hasArrow");
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
        if (subPanel?.layoutId) new_subPanel.dataset.layoutId = subPanel.layoutId;
        new_subPanel.id = "S_subPanel" + subPanelIndex.toString();
        new_subPanel.dataset.subpanelIndex = subPanelIndex.toString();
        new_subPanel.dataset.subpanelCount =
          panel.sign.subPanels.length.toString();
        new_subPanel.classList.toggle("firstAplSubPanel", subPanelIndex === 0);
        new_subPanel.classList.toggle(
          "lastAplSubPanel",
          subPanelIndex === panel.sign.subPanels.length - 1
        );
        signHolderElmt.appendChild(new_subPanel);

        const signContentContainerElmt = document.createElement("div");
        signContentContainerElmt.className = `signContentContainer shieldPosition${panel.sign.shieldPosition}`;
        signContentContainerElmt.id =
          "signContentContainer" + subPanelIndex.toString();
        new_subPanel.appendChild(signContentContainerElmt);

        // Insert CA style exit tabs above the first subpanel's padded content
        // so they sit flush in the corner of the sign's border.
        if (
          !isPanelGroupPreview &&
          subPanelIndex === 0 &&
          caStyleExitTabs.length > 0
        ) {
          caStyleExitTabs.forEach(({ exitTabCont }) => {
            exitTabCont.classList.add("caStyle");
            new_subPanel.insertBefore(exitTabCont, signContentContainerElmt);
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

        const renderedBlockElements = isPanelGroupPreview
          ? getActiveBlockElements()
          : subPanel.blockElements;
        const blockElement = renderedBlockElements.createElement(
          panel,
          subPanel
        );
        blockElement.classList.toggle("groupPreviewOnly", isPanelGroupPreview);
        blockElement.dataset.subpanel = subPanelIndex;
        signContentContainerElmt.appendChild(blockElement);

        // Shields
        if (!isPanelGroupPreview) {
          createShield(subPanel.shields, shieldsContainerElmt);
        }

        // sign
        signContentContainerElmt.style.padding = panel.sign.padding;

        // APL Arrows for this subpanel - always create the bottom border zone
        // when APL mode is active. EXIT ONLY keeps v2.2's existing markup and
        // styling; only the outer layout item participates in lane spacing.
        if (
          !isPanelGroupPreview &&
          panel.sign.aplArrows &&
          panel.sign.aplArrows.length > 0
        ) {
          const subPanelArrowContainer = document.createElement("div");
          subPanelArrowContainer.className = "aplArrows subpanelAplArrows";

          const arrowTrack = document.createElement("div");
          arrowTrack.className = "aplArrowTrack";
          subPanelArrowContainer.appendChild(arrowTrack);

          const arrowGroup = arrowGroups[subPanelIndex] || [];
          const fallbackTrackWidthRem = getAPLSubpanelMinWidthRem(
            arrowGroup,
            subPanelIndex
          );
          const renderedItems = [];

          if (fallbackTrackWidthRem > 0) {
            new_subPanel.classList.add("hasAplWidthReserve");
            new_subPanel.style.setProperty(
              "--aplSubpanelMinWidth",
              `${fallbackTrackWidthRem}rem`
            );
          }

          const applyAPLExitOnlyLabelStyles = (label, arrow) => {
            if (arrow.exitOnlyBgColor === "white") {
              label.style.backgroundColor = "var(--white)";
            }
            if (arrow.exitOnlyPadding != null) {
              const padding = `${arrow.exitOnlyPadding}rem`;
              label.style.paddingLeft = padding;
              label.style.paddingRight = padding;
            }
            if (arrow.exitOnlyBorderRadius != null) {
              label.style.borderRadius = `${arrow.exitOnlyBorderRadius}rem`;
            }
            if (arrow.exitOnlyFont) {
              const font = resolveTextFontFamilyForRender(arrow.exitOnlyFont, {}, panel);
              label.style.fontFamily = `"${String(font).replace(/["\\]/g, "")}"`;
            }
            const sizeScale = getAPLExitOnlySizeScale(arrow);
            if (sizeScale !== 1) {
              label.style.fontSize = `calc(${sizeScale} * 1em)`;
            }
            if (Number.isFinite(Number(arrow.exitOnlyLetterSpacing))) {
              label.style.letterSpacing = `${Math.max(-0.15, Math.min(0.5, Number(arrow.exitOnlyLetterSpacing)))}em`;
            }
          };

          const createAPLArrowImage = (arrow) => {
            const arrowDefinition = ArrowElement.prototype.arrows[arrow.type];
            if (!arrowDefinition) {
              return null;
            }

            const arrowImage = document.createElement("img");
            const arrowSizeRem = getSafeAPLSizeRem(arrow);
            const aspectRatio = GUIDE_ARROW_ASPECT_RATIOS[arrow.type] || 1;
            arrowImage.className = "aplArrow";
            arrowImage.dataset.type = arrow.type;
            arrowImage.src = arrowDefinition.src;
            arrowImage.alt = arrowDefinition.label;
            arrowImage.style.height = `${arrowSizeRem}rem`;
            arrowImage.style.width = `${arrowSizeRem * aspectRatio}rem`;
            arrowImage.style.margin = "0";
            if (arrow.flip) {
              arrowImage.style.transform = "scaleX(-1)";
            }
            return arrowImage;
          };

          const createAPLExitOnlyContainer = (arrow, includeLabels = true) => {
            const arrowImage = createAPLArrowImage(arrow);
            if (!arrowImage) {
              return null;
            }

            const container = document.createElement("div");
            container.className = "aplExitOnlyContainer";
            container.dataset.arrowType = arrow.type;
            if (arrow.flip) {
              container.dataset.flipped = "true";
            }

            if (includeLabels) {
              const exitSpan = document.createElement("span");
              exitSpan.className = "aplExitOnlyLabel aplExitOnlyExit";
              exitSpan.textContent =
                arrow.exitOnlyTextLeft != null
                  ? arrow.exitOnlyTextLeft
                  : "EXIT";
              applyAPLExitOnlyLabelStyles(exitSpan, arrow);
              if (arrow.exitOnlyHideLeft) {
                exitSpan.style.display = "none";
              }
              container.appendChild(exitSpan);
            }

            container.appendChild(arrowImage);

            if (includeLabels) {
              const onlySpan = document.createElement("span");
              onlySpan.className = "aplExitOnlyLabel aplExitOnlyOnly";
              onlySpan.textContent =
                arrow.exitOnlyTextRight != null
                  ? arrow.exitOnlyTextRight
                  : "ONLY";
              applyAPLExitOnlyLabelStyles(onlySpan, arrow);
              if (arrow.exitOnlyHideRight) {
                onlySpan.style.display = "none";
              }
              container.appendChild(onlySpan);
            }

            return container;
          };

          const appendAPLLayoutItem = (content, startIndex, endIndex) => {
            if (!content) {
              return;
            }
            const layoutItem = document.createElement("div");
            layoutItem.className = "aplArrowLayoutItem";
            layoutItem.appendChild(content);
            arrowTrack.appendChild(layoutItem);
            renderedItems.push({ layoutItem, startIndex, endIndex });
          };

          for (let groupIndex = 0; groupIndex < arrowGroup.length;) {
            const arrow = arrowGroup[groupIndex].arrow;

            if (
              panel.sign.combineAPLExitOnlyLabels === true &&
              isAPLExitOnlyValue(arrow.exitOnly) &&
              isAPLExitOnlyValue(arrowGroup[groupIndex + 1]?.arrow?.exitOnly)
            ) {
              let runEndIndex = groupIndex + 1;
              while (
                isAPLExitOnlyValue(
                  arrowGroup[runEndIndex + 1]?.arrow?.exitOnly
                )
              ) {
                runEndIndex++;
              }

              const firstArrow = arrow;
              const lastArrow = arrowGroup[runEndIndex].arrow;
              const combinedText = [];
              if (!firstArrow.exitOnlyHideLeft) {
                combinedText.push(
                  firstArrow.exitOnlyTextLeft != null
                    ? firstArrow.exitOnlyTextLeft
                    : "EXIT"
                );
              }
              if (!lastArrow.exitOnlyHideRight) {
                combinedText.push(
                  lastArrow.exitOnlyTextRight != null
                    ? lastArrow.exitOnlyTextRight
                    : "ONLY"
                );
              }

              const sharedLabel = document.createElement("span");
              sharedLabel.className =
                "aplExitOnlyLabel aplExitOnlyCombinedLabel";
              sharedLabel.textContent = combinedText
                .filter((part) => String(part).trim().length > 0)
                .join(" ");
              if (!sharedLabel.textContent) {
                sharedLabel.style.display = "none";
              }
              applyAPLExitOnlyLabelStyles(sharedLabel, firstArrow);

              const combinedGroup = document.createElement("div");
              combinedGroup.className = "aplCombinedExitOnlyGroup";
              const memberCount = runEndIndex - groupIndex + 1;
              const labelInsertIndex = Math.ceil(memberCount / 2);

              for (
                let memberIndex = groupIndex;
                memberIndex <= runEndIndex;
                memberIndex++
              ) {
                if (memberIndex - groupIndex === labelInsertIndex) {
                  combinedGroup.appendChild(sharedLabel);
                }
                const memberContainer = createAPLExitOnlyContainer(
                  arrowGroup[memberIndex].arrow,
                  false
                );
                if (memberContainer) {
                  memberContainer.classList.add("aplCombinedExitOnlyMember");
                  combinedGroup.appendChild(memberContainer);
                }
              }
              if (!sharedLabel.parentElement) {
                combinedGroup.appendChild(sharedLabel);
              }

              appendAPLLayoutItem(
                combinedGroup,
                groupIndex,
                runEndIndex
              );
              groupIndex = runEndIndex + 1;
              continue;
            }

            const content = isAPLExitOnlyValue(arrow.exitOnly)
              ? createAPLExitOnlyContainer(arrow)
              : createAPLArrowImage(arrow);
            appendAPLLayoutItem(content, groupIndex, groupIndex);
            groupIndex++;
          }

          new_subPanel.appendChild(subPanelArrowContainer);

          if (renderedItems.length > 0) {
            const rootFontSize =
              parseFloat(getComputedStyle(document.documentElement).fontSize) ||
              16;
            const getItemWidthRem = (item) =>
              item.layoutItem.getBoundingClientRect().width / rootFontSize;

            renderedItems.forEach((item, itemIndex) => {
              const itemWidthRem = getItemWidthRem(item);
              const isFirstRenderedItem = itemIndex === 0;
              const isLastRenderedItem =
                itemIndex === renderedItems.length - 1;
              const isLeftSignEdge =
                isFirstRenderedItem && subPanelIndex === 0;
              const isRightSignEdge =
                isLastRenderedItem &&
                subPanelIndex >= panel.sign.subPanels.length - 1;
              let marginLeftRem = 0;

              if (isFirstRenderedItem) {
                const visualReserve =
                  itemWidthRem / 2 +
                  (isLeftSignEdge
                    ? APL_ARROW_OUTER_EDGE_PADDING_REM
                    : APL_ARROW_EDGE_PADDING_REM);
                const requestedReserve = isLeftSignEdge
                  ? 0
                  : normalizeAPLArrowSpacing(
                    arrowGroup[item.startIndex].arrow.spacingBeforeRem
                  );
                marginLeftRem =
                  Math.max(visualReserve, requestedReserve) - itemWidthRem / 2;
              } else {
                const previousItem = renderedItems[itemIndex - 1];
                const previousWidthRem = getItemWidthRem(previousItem);
                const requestedSpacing = normalizeAPLArrowSpacing(
                  arrowGroup[previousItem.endIndex].arrow.spacingAfterRem
                );
                marginLeftRem = Math.max(
                  0,
                  requestedSpacing - previousWidthRem / 2 - itemWidthRem / 2
                );
              }

              item.layoutItem.style.marginLeft = `${marginLeftRem}rem`;

              if (isLastRenderedItem) {
                const visualReserve =
                  itemWidthRem / 2 +
                  (isRightSignEdge
                    ? APL_ARROW_OUTER_EDGE_PADDING_REM
                    : APL_ARROW_EDGE_PADDING_REM);
                const requestedReserve = isRightSignEdge
                  ? 0
                  : normalizeAPLArrowSpacing(
                    arrowGroup[item.endIndex].arrow.spacingAfterRem
                  );
                item.layoutItem.style.marginRight = `${
                  Math.max(visualReserve, requestedReserve) - itemWidthRem / 2
                }rem`;
              }

              const visualInsetRem =
                (isLeftSignEdge ? APL_ARROW_OUTER_EDGE_PADDING_REM : 0) -
                (isRightSignEdge ? APL_ARROW_OUTER_EDGE_PADDING_REM : 0);
              if (visualInsetRem !== 0) {
                item.layoutItem.style.transform =
                  `translateX(${visualInsetRem}rem)`;
              }
            });

            const trackWidthRem =
              arrowTrack.getBoundingClientRect().width / rootFontSize;
            new_subPanel.classList.add("hasAplWidthReserve");
            new_subPanel.style.setProperty(
              "--aplSubpanelMinWidth",
              `${Math.max(fallbackTrackWidthRem, trackWidthRem)}rem`
            );
          }
        }

        /*
        monitorControlText(subPanel, controlTextElmt);

        if (post.fontType == true) {
          controlTextElmt.style.fontFamily = "Series EM";
        }

        //monitorActionMessage(subPanel, actionMessageElmt);
        */
      }

      // v2.19 measures each APL column after its content has rendered and then
      // pins that natural width. Relying on flex/max-content alone lets a
      // widening APL divider become part of the neighboring subpanel's
      // intrinsic width, so removing the divider does not reliably shrink the
      // boundary again.
      const syncAplSubpanelWidths = () => {
        if (isPanelGroupPreview || !aplArrows.length || !signHolderElmt) {
          return;
        }

        const subpanelCells = Array.from(
          signHolderElmt.querySelectorAll(":scope > .subPanelDisplay")
        );
        if (!subpanelCells.length) {
          return;
        }

        signHolderElmt.classList.add("aplContentHolder");

        const rootFontSize =
          parseFloat(getComputedStyle(document.documentElement).fontSize) ||
          16;
        const clearLinkedWidth = (cell) => {
          cell.style.removeProperty("--linkedSubpanelWidth");
          cell.style.removeProperty("width");
          cell.style.removeProperty("min-width");
          cell.style.removeProperty("max-width");
          cell.style.removeProperty("flex");
        };
        const getNaturalWidth = (element) => {
          if (!element) {
            return 0;
          }
          const rect = element.getBoundingClientRect();
          return Math.max(
            rect.width || 0,
            element.scrollWidth || 0,
            element.offsetWidth || 0
          );
        };

        // Clear the previous measurement first. This is the important v2.19
        // behavior that allows an APL column to shrink after a divider arrow is
        // removed instead of measuring the old width as new content.
        subpanelCells.forEach(clearLinkedWidth);

        const desiredWidths = subpanelCells.map((cell) => {
          const contentContainer = cell.querySelector(
            ":scope > .signContentContainer"
          );
          const arrowTrack = cell.querySelector(
            ":scope > .subpanelAplArrows > .aplArrowTrack"
          );
          const aplReserveRem = parseFloat(
            cell.style.getPropertyValue("--aplSubpanelMinWidth") || "0"
          );
          const aplReservePx = Number.isFinite(aplReserveRem)
            ? aplReserveRem * rootFontSize
            : 0;

          return Math.ceil(
            Math.max(
              getNaturalWidth(contentContainer),
              getNaturalWidth(arrowTrack),
              aplReservePx,
              1
            )
          );
        });

        // A divider-mounted arrow straddles two subpanels. Reserve its visible
        // half on each side only while that arrow exists; an empty divider no
        // longer holds either neighboring column at the wider size.
        const holderChildren = Array.from(signHolderElmt.children);
        holderChildren.forEach((child, childIndex) => {
          if (!child.classList.contains("subDivider")) {
            return;
          }

          const dividerArrow = child.querySelector(".aplDividerArrow");
          if (!dividerArrow) {
            return;
          }

          if (
            !dividerArrow.complete &&
            !dividerArrow.dataset.aplWidthLoadBound
          ) {
            dividerArrow.dataset.aplWidthLoadBound = "true";
            dividerArrow.addEventListener("load", syncAplSubpanelWidths, {
              once: true,
            });
          }

          const dividerRect = child.getBoundingClientRect();
          const arrowRect = dividerArrow.getBoundingClientRect();
          if (!dividerRect.width || !arrowRect.width) {
            return;
          }

          const dividerCenter = dividerRect.left + dividerRect.width / 2;
          const leftNeeded = Math.max(0, dividerCenter - arrowRect.left);
          const rightNeeded = Math.max(0, arrowRect.right - dividerCenter);
          const leftCellIndex = holderChildren
            .slice(0, childIndex)
            .filter((node) => node.classList.contains("subPanelDisplay"))
            .length - 1;
          const rightCellIndex = leftCellIndex + 1;

          if (leftCellIndex >= 0 && leftCellIndex < desiredWidths.length) {
            desiredWidths[leftCellIndex] = Math.ceil(
              Math.max(desiredWidths[leftCellIndex], leftNeeded * 2)
            );
          }
          if (rightCellIndex >= 0 && rightCellIndex < desiredWidths.length) {
            desiredWidths[rightCellIndex] = Math.ceil(
              Math.max(desiredWidths[rightCellIndex], rightNeeded * 2)
            );
          }
        });

        desiredWidths.forEach((resolvedWidth, cellIndex) => {
          const cell = subpanelCells[cellIndex];
          const widthPx = `${Math.max(1, resolvedWidth)}px`;
          cell.style.setProperty("--linkedSubpanelWidth", widthPx);
          cell.style.flex = "0 0 auto";
          cell.style.width = widthPx;
          cell.style.minWidth = widthPx;
          cell.style.maxWidth = "none";
        });
      };

      const sideRightArrowElmt = createConfiguredGuideArrow("sideRightArrow");
      if (sideRightArrowElmt) {
        signHolderElmt.appendChild(sideRightArrowElmt);
      }

      const syncStandardGuideArrowSubpanelWidth = () => {
        let intrinsicSubpanelGroupWidth = null;
        const isStandardGuideArrow =
          panel.sign.arrowMode !== "apl" &&
          panel.sign.guideArrow !== "None" &&
          panel.sign.guideArrow !== "Side Left" &&
          panel.sign.guideArrow !== "Side Right" &&
          !(["Exit Only", "Half Exit Only", "Split Exit Only"].includes(panel.sign.guideArrow) &&
            Number(panel.sign.exitOnlyEditorVersion) >= 1) &&
          !(panel.sign.guideArrow === "Standard Arrow" &&
            (Number(panel.sign.guideArrowLanes) === 0 ||
             ["Left", "Right"].includes(panel.sign.standardArrowPosition)));

        if (!isStandardGuideArrow || !arrowContElmt || !signHolderElmt) {
          return;
        }

        const apply = () => {
          if (intrinsicSubpanelGroupWidth === null) {
            const measuredWidth = Array.from(signHolderElmt.children)
              .filter((child) => child.matches(".subPanelDisplay, .subDivider"))
              .reduce((width, child) => width + child.getBoundingClientRect().width, 0);
            if (measuredWidth > 0) intrinsicSubpanelGroupWidth = measuredWidth;
          }
          // Measure the arrows' own width. The guide arrow row spans the sign,
          // and the sign grows with the subpanels, so measuring the row (or
          // keeping the width set last time) widened the panel on every pass.
          const previousArrowWidth = arrowContElmt.style.width;
          arrowContElmt.style.width = "max-content";
          const arrowContainerWidth = Math.ceil(arrowContElmt.getBoundingClientRect().width || 0);
          arrowContElmt.style.width = previousArrowWidth;

          if (!arrowContainerWidth) {
            return;
          }

          const desiredSubpanelGroupWidth = Math.max(
            arrowContainerWidth,
            Math.ceil(intrinsicSubpanelGroupWidth || 0)
          );

          if (arrowContainerWidth > intrinsicSubpanelGroupWidth + 1) {
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
            arrowContElmt.querySelectorAll("img.arrow, img.standardGuideArrowImage, img.exitOnlyArrow, img.qcExitOnlyArrow")
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

        apply();
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

      // When the guide arrow row is wider than the subpanels, stretch the
      // subpanels to fill the sign (v2.19).
      const syncWidenedSubpanelFill = () => {
        const apply = () => {
          if (!signElmt || !signHolderElmt) {
            return;
          }
          const subpanels = Array.from(signHolderElmt.children)
            .filter((child) => child.classList.contains("subPanelDisplay"));
          // Start each pass from the subpanels' own widths. Adding to widths an
          // earlier pass set widened the sign again on every pass, so the
          // panel grew over several frames each time arrow padding changed.
          signElmt.classList.remove("hasWideningPanelFeature");
          signHolderElmt.classList.remove("forceWidenedSubpanels");
          subpanels.forEach((child) => {
            child.style.removeProperty("box-sizing");
            child.style.removeProperty("width");
            child.style.removeProperty("min-width");
          });
          // Compare layout widths inside the sign's border. The border made
          // the sign always look wider, so the fill switched on, its 100%
          // width overrode the arrow width reserve, and the panel shrank and
          // grew again on alternate frames.
          const signInnerWidth = signElmt.clientWidth;
          const holderWidth = signHolderElmt.offsetWidth;
          if (!(signInnerWidth > 0 && holderWidth > 0 && signInnerWidth > holderWidth + 1)) {
            return;
          }
          signElmt.classList.add("hasWideningPanelFeature");
          signHolderElmt.classList.add("forceWidenedSubpanels");
          const dividers = Array.from(signHolderElmt.children)
            .filter((child) => child.classList.contains("subDivider"));
          const subpanelWidth = subpanels.reduce(
            (sum, child) => sum + child.getBoundingClientRect().width, 0
          );
          const dividerWidth = dividers.reduce(
            (sum, child) => sum + child.getBoundingClientRect().width, 0
          );
          const holderStyle = getComputedStyle(signHolderElmt);
          const innerWidth = Math.max(signElmt.clientWidth, signHolderElmt.clientWidth) -
            (parseFloat(holderStyle.paddingLeft) || 0) -
            (parseFloat(holderStyle.paddingRight) || 0);
          const gapWidth = Math.max(0, subpanels.length + dividers.length - 1) *
            (parseFloat(holderStyle.columnGap || holderStyle.gap) || 0);
          const missingWidth = innerWidth - subpanelWidth - dividerWidth - gapWidth;
          if (subpanels.length && missingWidth > 1) {
            const extra = missingWidth / subpanels.length;
            subpanels.forEach((child) => {
              const width = child.getBoundingClientRect().width;
              // Important, or the stylesheet's max-content widths win.
              child.style.boxSizing = "border-box";
              child.style.setProperty("width", `${width + extra}px`, "important");
              child.style.setProperty("min-width", `${width + extra}px`, "important");
            });
          }
        };
        apply();
        requestAnimationFrame(() => {
          apply();
          requestAnimationFrame(apply);
        });
      };

      const panelBorderThickness = Panel.getBorderThickness(panel);
      let suppressArrowBandClickUntil = 0;

      // Guide arrows

      var path;

      const createArrowElmt = function (_key, _dir, name, extra) {
        return createConfiguredGuideArrow(name, extra);
      };

      if (panel.sign.guideArrow === "Standard Arrow" && panel.sign.arrowMode !== "apl") {
          const arrowCount = Math.max(0, Math.min(6, Math.round(Number(panel.sign.guideArrowLanes) || 0)));
          if (arrowCount > 0) {
              let key = ArrowElement.prototype.arrows[panel.sign.standardArrowType]
                  ? panel.sign.standardArrowType : "DOWN";
              let src = ArrowElement.prototype.arrows[key].src;
              let angle = ((Math.round(Number(panel.sign.standardArrowAngle) || 0) % 360) + 360) % 360;
              let fixedDirection = key.startsWith("TYPE_C_") || key === "TYPE_E";
              let renderedAngle = fixedDirection ? 0 : angle;
              let flipped = fixedDirection && panel.sign.standardArrowFlip === true;
              const size = Math.max(1, Math.min(5, Number(panel.sign.standardArrowSize) || 3));
              const padding = Math.max(0, Math.min(5, Number(panel.sign.standardArrowPadding) || 0));
              const spacing = Math.max(0, Math.min(25, Number(panel.sign.standardArrowSpacing) || 0));
              const position = ["Left", "Right"].includes(panel.sign.standardArrowPosition)
                  ? panel.sign.standardArrowPosition : "Down";
              const alignment = ["Left", "Right"].includes(panel.sign.standardArrowAlignment)
                  ? panel.sign.standardArrowAlignment : "Center";
              let extendedScale, adjustArrowBandPadding, initialArrowHeight, diagonalAmount;
              let verticalPadding, diagonalHorizontalReduction, horizontalPadding, diagonalHeightScale, diagonalHeightReduction;
              const configureStandardArrow = (detail = {}) => {
                key = ArrowElement.prototype.arrows[detail.type] ? detail.type :
                  ArrowElement.prototype.arrows[panel.sign.standardArrowType] ? panel.sign.standardArrowType : "DOWN";
                src = ArrowElement.prototype.arrows[key].src;
                angle = ((Math.round(Number(detail.angle ?? panel.sign.standardArrowAngle) || 0) % 360) + 360) % 360;
                fixedDirection = key.startsWith("TYPE_C_") || key === "TYPE_E";
                renderedAngle = fixedDirection ? 0 : angle;
                flipped = fixedDirection && panel.sign.standardArrowFlip === true;
                extendedScale = key === "TYPE_A_EXTENDED" ? 1.15 : 1;
                adjustArrowBandPadding = ["DOWN", "DOWN_ALT", "TYPE_A", "TYPE_A_EXTENDED", "TYPE_B"].includes(key);
                initialArrowHeight = (key.startsWith("DOWN") ? 1.5 : 1.85) * size / 3 * extendedScale;
                diagonalAmount = Math.abs(Math.sin(renderedAngle * Math.PI / 90));
                verticalPadding = padding * (2 - 1.5 * diagonalAmount) + (key === "TYPE_B" ? 0.08 : 0);
                diagonalHorizontalReduction = key === "TYPE_B" ? 0.25
                  : ["TYPE_A", "TYPE_A_EXTENDED"].includes(key) ? 0.4 : 0.6;
                horizontalPadding = ["TYPE_D", "TYPE_E"].includes(key) ? 0 : adjustArrowBandPadding
                  ? Math.max(0, 0.65 - diagonalHorizontalReduction * size / 3 * diagonalAmount)
                  : key.startsWith("TYPE_C_") ? 0.75
                  : 1;
                diagonalHeightScale = ["DOWN", "DOWN_ALT"].includes(key) ? 0.9
                  : ["TYPE_A", "TYPE_A_EXTENDED"].includes(key) ? 0.4 * extendedScale
                  : key === "TYPE_B" ? 0.55 : 0;
                diagonalHeightReduction = diagonalHeightScale * size / 3 * diagonalAmount;
              };
              configureStandardArrow();
              const createStandardArrow = () => {
                  const arrowKey = key, arrowSrc = src, arrowAngle = renderedAngle;
                  const arrowFlip = flipped, arrowExtendedScale = extendedScale;
                  const arrowVerticalPadding = verticalPadding, arrowDiagonalAmount = diagonalAmount;
                  const arrowDiagonalHeightReduction = diagonalHeightReduction;
                  const frame = document.createElement("span");
                  frame.className = "standardGuideArrowFrame";
                  frame.style.width = `${initialArrowHeight}rem`;
                  frame.style.height = `${Math.max(0.1, initialArrowHeight + arrowVerticalPadding * 2 - arrowDiagonalHeightReduction)}rem`;
                  const image = document.createElement("img");
                  image.className = "standardGuideArrowImage";
                  image.alt = "";
                  image.style.width = "auto";
                  image.style.height = `${initialArrowHeight}rem`;
                  image.style.transform = `translate(-50%, -50%) rotate(${arrowAngle}deg) scaleX(${arrowFlip ? -1 : 1})`;
                  frame.appendChild(image);
                  image.draggable = false;
                  const resizeFrame = () => {
                      const measuredRatio = image.offsetWidth / image.offsetHeight ||
                          image.naturalWidth / image.naturalHeight || 1;
                      const ratio = Number.isFinite(measuredRatio) && measuredRatio > 0 ? measuredRatio : 1;
                      const originalDiagonalArea = 1.85 * 1.85;
                      const baseHeight = arrowKey.startsWith("DOWN") ? 1.5 :
                          arrowKey === "TYPE_B" ? 1.85 : Math.sqrt(originalDiagonalArea / ratio);
                      const arrowHeight = baseHeight * size / 3 * arrowExtendedScale;
                      image.style.height = `${arrowHeight}rem`;
                      const radians = arrowAngle * Math.PI / 180;
                      const width = arrowHeight * ratio;
                      const boundsWidth = Math.abs(width * Math.cos(radians)) + Math.abs(arrowHeight * Math.sin(radians));
                      const boundsHeight = Math.abs(width * Math.sin(radians)) + Math.abs(arrowHeight * Math.cos(radians));
                      frame.style.width = `${boundsWidth}rem`;
                      frame.style.height = `${Math.max(0.1, boundsHeight + arrowVerticalPadding * 2 - arrowDiagonalHeightReduction)}rem`;
                      if (position !== "Down") {
                          // The rotated rectangle is tallest at diagonal angles, but much
                          // of its top and bottom corners are empty. Reduce that empty
                          // vertical space while leaving horizontal placement unchanged.
                          const opticalInset = Math.min(boundsWidth * 0.25, 0.55 * size / 3 * arrowDiagonalAmount);
                          signElmt.style.setProperty("--sideGuideArrowReserve", `${Math.max(0.1, boundsWidth + padding * 2 + 0.3 - opticalInset)}rem`);
                          signElmt.style.minHeight = `${Math.max(0.5, boundsHeight + 0.45 - 1.1 * size / 3 * arrowDiagonalAmount + 2 * arrowVerticalPadding)}rem`;
                      } else {
                          syncStandardGuideArrowSubpanelWidth();
                      }
                  };
                  image.addEventListener("load", resizeFrame);
                  frame._refreshArrowLayout = resizeFrame;
                  image.src = arrowSrc;
                  if (image.complete && image.naturalWidth) resizeFrame();
                  requestAnimationFrame(resizeFrame);
                  return frame;
              };
              if (position === "Down") {
                  signElmt.style.borderBottomLeftRadius = "0";
                  signElmt.style.borderBottomRightRadius = "0";
                  signElmt.style.borderBottomWidth = "0";
                  signElmt.style.width = "100%";
                  guideArrowsElmt.classList.add("standardGuideArrowBand");
                  guideArrowsElmt.style.display = "block";
                  guideArrowsElmt.style.visibility = "visible";
                  if (!panel.sign.oSNum && panel.sign.otherSymbol === "None") {
                      otherSymbolsElmt.style.display = "none";
                  }
                  arrowContElmt.style.gap = "0";
                  arrowContElmt.style.marginLeft = alignment === "Left" ? "0" : "auto";
                  arrowContElmt.style.marginRight = alignment === "Right" ? "0" : "auto";
                  for (let i = 0; i < arrowCount; i++) {
                      const detail = panel.sign.standardArrowIndividuals?.[i] || {};
                      configureStandardArrow(detail);
                      const frame = createStandardArrow();
                      frame.dataset.standardArrowIndex = String(i);
                      frame.dataset.panelIndex = String(index);
                      frame.draggable = false;
                      frame.classList.toggle("selectedGuideArrow", selectedGuideArrowPanelIndex === index && selectedGuideArrowIndex === i);
                      frame.style.left = `${Math.max(-25, Math.min(25, Number(detail.offsetX) || 0))}rem`;
                      frame.addEventListener("pointerdown", (event) => {
                        if (event.button !== 0) return;
                        event.preventDefault();
                        event.stopPropagation();
                        const canDrag = arrowCount > 1 &&
                          selectedGuideArrowPanelIndex === index &&
                          currentlySelectedPanelIndex === index &&
                          document.getElementById("sMConfigBar")?.dataset.currentMenu === "guideArrowConfig" &&
                          document.querySelector(".guideArrowConfig")?.dataset.currentMenu === "sMStandardArrows" &&
                          document.getElementById("standardArrowIndividual")?.open === true &&
                          document.getElementById("standardArrowIndividual")?.inert !== true;
                        if (!canDrag) {
                          suppressArrowBandClickUntil = performance.now() + 750;
                          selectRenderedPanelArea({ panelIndex: index, menu: "guideArrows",
                            guideMode: "standard", suppressRedraw: true, deferMenu: true });
                          formHandler.ensureGuideArrowMenuOpen("standard");
                          return;
                        }
                        suppressArrowBandClickUntil = performance.now() + 750;
                        const origin = event.clientX;
                        const initial = Number(detail.offsetX) || 0;
                        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
                        const canvasScale = arrowContElmt.offsetWidth
                          ? arrowContElmt.getBoundingClientRect().width / arrowContElmt.offsetWidth : 1;
                        let moved = false;
                        const panelWasDraggable = panelElmt.draggable;
                        panelElmt.draggable = false;
                        guideArrowPointerDragActive = true;
                        frame.setPointerCapture(event.pointerId);
                        selectedGuideArrowIndex = i;
                        arrowContElmt.querySelectorAll(".standardGuideArrowFrame").forEach((arrow) =>
                          arrow.classList.toggle("selectedGuideArrow", arrow === frame));
                        formHandler.selectStandardArrowIndividual(i);
                        const restorePanelDrag = () => {
                          panelElmt.draggable = panelWasDraggable;
                          guideArrowPointerDragActive = false;
                        };
                        const move = (moveEvent) => {
                          if (moveEvent.pointerId !== event.pointerId) return;
                          if (arrowCount < 2) return;
                          const delta = (moveEvent.clientX - origin) / (rem * (canvasScale || 1));
                          if (Math.abs(delta) > 0.1) moved = true;
                          frame.style.left = `${Math.max(-100, Math.min(100, initial + delta))}rem`;
                        };
                        frame.addEventListener("pointermove", move);
                        const finish = (upEvent) => {
                          if (upEvent.pointerId !== event.pointerId) return;
                          suppressArrowBandClickUntil = performance.now() + 750;
                          frame.removeEventListener("pointermove", move);
                          restorePanelDrag();
                          if (moved) runWithUndo(() => {
                            const frames = Array.from(arrowContElmt.querySelectorAll(".standardGuideArrowFrame"));
                            const positions = frames.map((node, originalIndex) => ({
                              originalIndex, rect: node.getBoundingClientRect()
                            })).sort((a, b) =>
                              (a.rect.left + a.rect.right) - (b.rect.left + b.rect.right));
                            const previous = Array.from({ length: arrowCount }, (_, arrowIndex) =>
                              ({ ...(panel.sign.standardArrowIndividuals?.[arrowIndex] || {}) }));
                            const updated = positions.map(({ originalIndex }) => ({
                              ...previous[originalIndex], offsetX: 0
                            }));
                            for (let gapIndex = 0; gapIndex < updated.length - 1; gapIndex++) {
                              const pixels = positions[gapIndex + 1].rect.left - positions[gapIndex].rect.right;
                              updated[gapIndex].spacingAfter = Math.round(
                                Math.max(0, Math.min(25, pixels / (rem * (canvasScale || 1)))) * 100
                              ) / 100;
                            }
                            selectedGuideArrowIndex = positions.findIndex(({ originalIndex }) => originalIndex === i);
                            panel.sign.standardArrowIndividuals = updated;
                            redraw();
                            formHandler.selectStandardArrowIndividual(selectedGuideArrowIndex);
                          });
                        };
                        frame.addEventListener("pointerup", finish, { once: true });
                        frame.addEventListener("pointercancel", () => {
                          frame.removeEventListener("pointermove", move);
                          frame.style.left = `${initial}rem`;
                          restorePanelDrag();
                        }, { once: true });
                      });
                      frame.addEventListener("click", (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      });
                      if (i === 0) frame.style.marginLeft = `${horizontalPadding}rem`;
                      if (i === arrowCount - 1) frame.style.marginRight = `${horizontalPadding}rem`;
                      arrowContElmt.appendChild(frame);
                      if (i < arrowCount - 1) {
                        const gap = document.createElement("span");
                        gap.className = "standardGuideArrowGap";
                        gap.style.width = `${Math.max(0, Math.min(25, Number(detail.spacingAfter ?? spacing) || 0))}rem`;
                        gap.style.flexShrink = "0";
                        arrowContElmt.appendChild(gap);
                      }
                  }
              } else {
                  signElmt.classList.add("hasSideGuideArrow", `hasSide${position}GuideArrow`);
                  signHolderElmt.classList.add("hasSideGuideArrow", `hasSide${position}GuideArrow`);
                  sideLeftArrowElmt.remove();
                  sideRightArrowElmt.remove();
                  configureStandardArrow(panel.sign.standardArrowIndividuals?.[0] || {});
                  const sideFrame = createStandardArrow();
                  sideFrame.classList.add("standardSideGuideArrow", `standardSide${position}`);
                  sideFrame.style.setProperty("--standardSideInset", `${["TYPE_D", "TYPE_E"].includes(key) ? 0 : 0.35}rem`);
                  sideFrame.dataset.panelIndex = String(index);
                  sideFrame.addEventListener("click", (event) => {
                      event.stopPropagation();
                      selectRenderedPanelArea({ panelIndex: index, subPanelIndex: 0,
                          menu: "guideArrows", guideMode: "standard", flashTarget: signElmt });
                      selectedGuideArrowIndex = 0;
                      formHandler.selectStandardArrowIndividual(0);
                  });
                  signElmt.appendChild(sideFrame);
              }
          }
      } else if (["Exit Only", "Half Exit Only", "Split Exit Only"].includes(panel.sign.guideArrow) &&
                 Number(panel.sign.exitOnlyEditorVersion) >= 1 && panel.sign.arrowMode !== "apl") {
          const sign = panel.sign;
          const variant = sign.guideArrow === "Half Exit Only" ? "laneSplit" :
              sign.guideArrow === "Split Exit Only" ? "boxed" : "standard";
          const count = Math.max(0, Math.min(6, Math.round(Number(sign.guideArrowLanes) || 0)));
          const key = ArrowElement.prototype.arrows[sign.exitArrowType] ? sign.exitArrowType : "DOWN";
          const src = ArrowElement.prototype.arrows[key].src;
          const fixed = key.startsWith("TYPE_C_") || key === "TYPE_E";
          const angle = fixed ? 0 : ((Math.round(Number(sign.exitArrowAngle) || 0) % 360) + 360) % 360;
          const size = Math.max(1, Math.min(5, Number(sign.exitArrowSize) || 3));
          const padding = Math.max(0, Math.min(8, Number(sign.exitArrowPadding) || 0));
          const spacing = Math.max(0, Math.min(25, Number(sign.exitArrowSpacing) || 0));
          const diagonalAmount = Math.abs(Math.sin(angle * Math.PI / 90));
          const extendedScale = key === "TYPE_A_EXTENDED" ? 1.15 : 1;
          // As in v2.2, padding pads every side of the arrows by the same
          // amount. The edge spacing below already suits the default padding.
          const verticalPadding = padding * (1 - 0.75 * diagonalAmount) + (key === "TYPE_B" ? 0.08 : 0);
          const extraSidePadding = padding - EXIT_ONLY_DEFAULT_PADDING;
          const horizontalReduction = key === "TYPE_B" ? 0.43 :
              ["TYPE_A", "TYPE_A_EXTENDED"].includes(key) ? 0.55 : 0.6;
          const noHorizontalPadding = ["TYPE_D", "TYPE_E"].includes(key);
          const standardEdgePadding = 0.2;
          const horizontalPadding = noHorizontalPadding ? 0 :
              ["DOWN", "DOWN_ALT", "TYPE_A", "TYPE_A_EXTENDED", "TYPE_B"].includes(key)
                  ? Math.max(0, 0.65 - horizontalReduction * size / 3 * diagonalAmount)
                  : key.startsWith("TYPE_C_") ? 0.75
                  : 1;
          const standardHorizontalPadding = noHorizontalPadding ? 0 :
              ["DOWN", "DOWN_ALT", "TYPE_A", "TYPE_A_EXTENDED", "TYPE_B"].includes(key)
                  ? Math.max(0, 0.45 + standardEdgePadding - (key === "TYPE_B" ? 0.25 :
                      ["TYPE_A", "TYPE_A_EXTENDED"].includes(key) ? 0.4 : 0.6) * size / 3 * diagonalAmount)
                  : key.startsWith("TYPE_C_") ? 0.55 + standardEdgePadding : 1;
          const coloredEdgePadding = variant === "boxed" ? standardHorizontalPadding :
              horizontalPadding + (noHorizontalPadding ? 0 :
                  variant === "laneSplit" ? 0.18 : ["DOWN", "DOWN_ALT", "TYPE_A", "TYPE_A_EXTENDED"].includes(key) ? 0.12 : 0);
          const heightReduction =
              (["DOWN", "DOWN_ALT"].includes(key) ? 0.9 :
               ["TYPE_A", "TYPE_A_EXTENDED"].includes(key) ? 0.4 * extendedScale :
               key === "TYPE_B" ? 0.55 : 0) * size / 3 * diagonalAmount;
          const background = getResolvedCssColorValue(sign.exitBackgroundColor || "Yellow") || "var(--yellow)";
          const inherited = getExitOnlyContrastColor(background);
          const textColor = sign.exitTextColor && sign.exitTextColor !== "Inherit"
              ? getResolvedCssColorValue(sign.exitTextColor) : inherited;
          const borderColor = sign.exitBorderColor && sign.exitBorderColor !== "Inherit"
              ? getResolvedCssColorValue(sign.exitBorderColor) : inherited;
          const cornerColored = sign.exitColorEdges === true && panel.corner === "Sharp" && variant !== "boxed";
          const borderWidth = `${panelBorderThickness}rem`;

          signElmt.style.borderBottomLeftRadius = "0";
          signElmt.style.borderBottomRightRadius = "0";
          signElmt.style.borderBottomWidth = "0";
          signElmt.style.width = "100%";
          guideArrowsElmt.classList.add("modernExitOnly", `modernExitOnly-${variant}`);
          guideArrowsElmt.classList.toggle("modernExitOnlyColoredEdges", cornerColored);
          guideArrowsElmt.classList.toggle("modernExitOnlyTexasBorder",
              sign.exitColorEdges === false && sign.exitTexasBorder !== false && variant !== "boxed");
          guideArrowsElmt.classList.toggle("modernExitOnlyTopBorder", !!sign.exitTopBorder);
          guideArrowsElmt.style.display = "flex";
          guideArrowsElmt.style.visibility = "visible";
          guideArrowsElmt.style.setProperty("--exitOnlyBackground", background);
          signCont.style.setProperty("--exitOnlyBackground", background);
          guideArrowsElmt.style.setProperty("--exitOnlyTextColor", textColor);
          guideArrowsElmt.style.setProperty("--exitOnlyBorderColor", borderColor);
          guideArrowsElmt.style.setProperty("--exitOnlyPanelColor", getResolvedCssColorValue(panel.color) || "var(--green)");
          guideArrowsElmt.style.setProperty("--exitOnlyPanelBorderColor",
              getReadableTextColorForCssColor(getResolvedCssColorValue(panel.color) || "var(--green)"));
          guideArrowsElmt.style.setProperty("--exitOnlyTopBorder", sign.exitTopBorder ? borderWidth : "0px");
          guideArrowsElmt.style.setProperty("--exitOnlyVerticalPadding", `${verticalPadding}rem`);
          guideArrowsElmt.style.setProperty("--exitOnlyHorizontalPadding", `${Math.max(0, coloredEdgePadding + extraSidePadding)}rem`);
          guideArrowsElmt.style.setProperty("--exitOnlyPlainOuterPadding", `${Math.max(0, (noHorizontalPadding ? 0 : Math.max(0.45, standardHorizontalPadding)) + extraSidePadding)}rem`);
          guideArrowsElmt.style.setProperty("--exitOnlyEdgeRadius", "var(--signBorderRadius, 0.75rem)");
          otherSymbolsElmt.style.display = "none";
          sideLeftArrowElmt.remove();
          sideRightArrowElmt.remove();

          let splitPlainArrowDragging = false;
          const syncSplitExitLanePlacement = () => {
              if (variant !== "laneSplit" || splitPlainArrowDragging) return;
              const colored = arrowContElmt.querySelector(":scope > .modernExitColoredLane");
              const plain = arrowContElmt.querySelector(":scope > .modernExitPlainLane");
              const plainArrow = plain?.querySelector(":scope > .modernExitArrowFrame");
              if (!colored || !plain) return;

              // Measure the intrinsic colored area before assigning it a
              // subpanel's width. This also clears a previous balanced layout
              // when a text edit makes that layout too narrow to fit.
              colored.style.removeProperty("width");
              colored.style.removeProperty("flex");
              if (plainArrow) {
                  plainArrow.style.removeProperty("left");
                  plainArrow.style.removeProperty("right");
                  plainArrow.style.removeProperty("transform");
              }

              const subpanels = Array.from(signHolderElmt.children)
                  .filter((child) => child.classList.contains("subPanelDisplay"));
              const dividers = Array.from(signHolderElmt.children)
                  .filter((child) => child.classList.contains("subDivider"));
              const coloredLeft = colored.classList.contains("onLeft");
              const correspondingSubpanel = subpanels[coloredLeft ? 0 : 1];
              if (sign.exitForceSubpanelWidth && subpanels.length === 2 && correspondingSubpanel) {
                  const subpanelWidth = correspondingSubpanel.getBoundingClientRect().width;
                  const intrinsicWidth = colored.getBoundingClientRect().width;
                  if (intrinsicWidth > subpanelWidth + 1) {
                      const scale = correspondingSubpanel.getBoundingClientRect().width /
                          (correspondingSubpanel.offsetWidth || subpanelWidth);
                      correspondingSubpanel.style.setProperty("--linkedSubpanelWidth",
                          `${intrinsicWidth / (scale || 1)}px`);
                  }
              }
              const rowRect = arrowContElmt.getBoundingClientRect();
              const coloredRect = colored.getBoundingClientRect();
              const leftWidth = subpanels[0]?.getBoundingClientRect().width || 0;
              const rightWidth = subpanels[1]?.getBoundingClientRect().width || 0;
              const divider = dividers[0];
              const dividerRect = divider?.getBoundingClientRect();
              const dividerVisible = dividerRect?.width > 0 &&
                  !divider.classList.contains("hiddenDividerWithAplArrow") &&
                  getComputedStyle(divider).display !== "none";
              const division = dividerVisible
                  ? (coloredLeft ? dividerRect.right : dividerRect.left)
                  : (coloredLeft ? subpanels[0]?.getBoundingClientRect().right
                      : subpanels[1]?.getBoundingClientRect().left);
              const coloredWidth = coloredLeft
                  ? division - rowRect.left : rowRect.right - division;
              const plainWidth = coloredLeft
                  ? rowRect.right - division : division - rowRect.left;
              const balanced = count === 1 && subpanels.length === 2 && dividers.length === 1 &&
                  leftWidth > 0 && rightWidth > 0 &&
                  Math.min(leftWidth, rightWidth) / Math.max(leftWidth, rightWidth) >= 0.8 &&
                  coloredWidth >= coloredRect.width - 1 &&
                  plainWidth >= (plainArrow?.getBoundingClientRect().width || 0) + 2 *
                      (parseFloat(getComputedStyle(plain).paddingLeft) || 0);
              const forceWidth = sign.exitForceSubpanelWidth && subpanels.length === 2 &&
                  coloredWidth > coloredRect.width + 1;

              if (balanced || forceWidth) {
                  // The divider is the boundary between the two arrow areas.
                  // Keep each area aligned with the subpanel directly above it.
                  colored.style.width = `${coloredWidth}px`;
                  colored.style.flex = `0 0 ${coloredWidth}px`;
                  if (balanced && plainArrow) {
                      plainArrow.style.left = "50%";
                      plainArrow.style.transform = "translate(-50%, -50%)";
                  }
              }
              if (plainArrow && !balanced) {
                  // The plain lane can grow without taking its arrow farther
                  // than the requested gap from the adjacent exit arrow.
                  const exitArrows = colored.querySelectorAll(".modernExitArrowFrame");
                  const exitArrow = coloredLeft ? exitArrows[exitArrows.length - 1] : exitArrows[0];
                  if (!exitArrow) return;
                  const plainRect = plain.getBoundingClientRect();
                  const plainArrowRect = plainArrow.getBoundingClientRect();
                  const exitArrowRect = exitArrow.getBoundingClientRect();
                  const plainStyle = getComputedStyle(plain);
                  const outerPadding = parseFloat(coloredLeft
                      ? plainStyle.paddingRight : plainStyle.paddingLeft) || 0;
                  const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
                  const minCenter = plainRect.left + plainArrowRect.width / 2;
                  const maxCenter = plainRect.right - plainArrowRect.width / 2;
                  const farCenter = coloredLeft
                      ? maxCenter - outerPadding : minCenter + outerPadding;
                  const gapCenter = coloredLeft
                      ? exitArrowRect.right + spacing * rootSize + plainArrowRect.width / 2
                      : exitArrowRect.left - spacing * rootSize - plainArrowRect.width / 2;
                  const center = Math.max(minCenter, Math.min(maxCenter,
                      coloredLeft ? Math.min(farCenter, gapCenter) : Math.max(farCenter, gapCenter)));
                  plainArrow.style.left = `${center - plainRect.left}px`;
                  plainArrow.style.transform = "translate(-50%, -50%)";
              }
              if (plainArrow && sign.exitSplitPlainArrowPosition != null) {
                  const plainRect = plain.getBoundingClientRect();
                  const arrowWidth = plainArrow.getBoundingClientRect().width;
                  const fraction = Math.max(0, Math.min(1, Number(sign.exitSplitPlainArrowPosition) || 0));
                  const center = Math.max(arrowWidth / 2, Math.min(plainRect.width - arrowWidth / 2,
                      fraction * plainRect.width));
                  plainArrow.style.left = `${center / (plainRect.width / (plain.offsetWidth || plainRect.width) || 1)}px`;
                  plainArrow.style.transform = "translate(-50%, -50%)";
              }
          };

          const syncExitOnlyPanelWidth = () => {
            const apply = () => {
              if (splitPlainArrowDragging) return;
              signHolderElmt.classList.remove("hasStandardGuideArrowWidthReserve");
              signHolderElmt.style.removeProperty("--standardGuideArrowMinWidth");
              signHolderElmt.style.removeProperty("width");
              signHolderElmt.style.removeProperty("min-width");
              signElmt.style.removeProperty("min-width");
              signCont.style.removeProperty("min-width");
              const colored = arrowContElmt.querySelector(".modernExitColoredLane");
              const sequence = colored?.querySelector(".modernExitSequence");
              if (!sequence) return;
              const pixels = (value) => parseFloat(value) || 0;
              const styles = getComputedStyle(sequence);
              const items = [...sequence.children];
              const sequenceWidth = items.reduce((width, item) =>
                  width + item.getBoundingClientRect().width, 0) +
                  Math.max(0, items.length - 1) * pixels(styles.columnGap);
              const coloredStyle = getComputedStyle(colored);
              const coloredWidth = sequenceWidth +
                  pixels(coloredStyle.paddingLeft) + pixels(coloredStyle.paddingRight) +
                  pixels(coloredStyle.borderLeftWidth) + pixels(coloredStyle.borderRightWidth);
              colored.dataset.intrinsicWidth = String(coloredWidth);
              const plain = arrowContElmt.querySelector(".modernExitPlainLane");
              const guideStyle = getComputedStyle(guideArrowsElmt);
              const arrowFrames = [...sequence.querySelectorAll(".modernExitArrowFrame")];
              const rootSize = pixels(getComputedStyle(document.documentElement).fontSize) || 16;
              const standardArrowWidth = arrowFrames.length && variant !== "laneSplit"
                  ? arrowFrames.reduce((width, frame) =>
                      width + (Number(frame.dataset.standardBoundsWidth) || frame.getBoundingClientRect().width / rootSize) * rootSize, 0) +
                    Math.max(0, arrowFrames.length - 1) * spacing * rootSize +
                    2 * standardHorizontalPadding * rootSize + 0.4 * rootSize
                  : 0;
              // The arrows' own width, not the row's: the row spans the sign,
              // which grows with this reserve, so it widened on every pass.
              const previousArrowWidth = arrowContElmt.style.width;
              arrowContElmt.style.width = "max-content";
              const arrowContentWidth = arrowContElmt.getBoundingClientRect().width;
              arrowContElmt.style.width = previousArrowWidth;
              const areaWidth = Math.ceil(Math.max(
                  coloredWidth + (plain ? plain.getBoundingClientRect().width : 0) +
                      pixels(guideStyle.borderLeftWidth) + pixels(guideStyle.borderRightWidth) +
                      pixels(guideStyle.paddingLeft) + pixels(guideStyle.paddingRight),
                  standardArrowWidth,
                  arrowContentWidth
              ));
              const signWidth = Math.ceil(signElmt.getBoundingClientRect().width || 0);
              const holderWidth = Math.ceil(signHolderElmt.getBoundingClientRect().width || 0);
              if (areaWidth > holderWidth + 1) {
                  signHolderElmt.classList.add("hasStandardGuideArrowWidthReserve");
                  signHolderElmt.style.setProperty("--standardGuideArrowMinWidth", `${areaWidth}px`);
                  signHolderElmt.style.width = `${areaWidth}px`;
                  signHolderElmt.style.minWidth = `${areaWidth}px`;
              }
              if (areaWidth > signWidth + 1) {
                  signElmt.style.minWidth = `${areaWidth}px`;
                  signCont.style.minWidth = `${areaWidth}px`;
              }
              // The text slots of a single-arrow exit area may grow after the
              // sequence's intrinsic width was measured. Fill the subpanel row
              // against the final rendered area, not that earlier estimate.
              if (variant === "laneSplit") {
                  // Position the arrows before this redraw can be painted.
                  // Later measurements cover font and SVG loading without
                  // exposing the temporary edge position.
                  syncWidenedSubpanelFill();
                  syncSplitExitLanePlacement();
                  const forcedHolderWidth = Math.ceil(signHolderElmt.scrollWidth || 0);
                  if (sign.exitForceSubpanelWidth && forcedHolderWidth > signElmt.getBoundingClientRect().width + 1) {
                      signElmt.style.minWidth = `${forcedHolderWidth}px`;
                      signCont.style.minWidth = `${forcedHolderWidth}px`;
                      syncSplitExitLanePlacement();
                  }
                  requestAnimationFrame(() => {
                      syncSplitExitLanePlacement();
                      requestAnimationFrame(syncSplitExitLanePlacement);
                  });
              } else {
                  requestAnimationFrame(syncWidenedSubpanelFill);
              }
            };
            apply();
            requestAnimationFrame(() => {
              apply();
              requestAnimationFrame(apply);
            });
            if (document.fonts?.ready) {
              document.fonts.ready.then(apply).catch(() => {});
            }
          };

          const makeArrow = (plain = false) => {
              const frame = document.createElement("span");
              frame.className = "modernExitArrowFrame";
              const image = document.createElement("img");
              image.className = "modernExitArrowImage";
              image.src = src;
              image.alt = "";
              image.style.transform = `translate(-50%, -50%) rotate(${angle}deg) scaleX(${fixed && sign.exitArrowFlip ? -1 : 1})`;
              const arrowTone = plain && (!sign.exitTextColor || sign.exitTextColor === "Inherit")
                  ? getReadableTextColorForCssColor(getResolvedCssColorValue(panel.color) || "var(--green)")
                  : textColor;
              frame.appendChild(image);
              const shape = document.createElement("span");
              shape.className = "modernExitArrowImage modernExitArrowShape";
              shape.style.transform = image.style.transform;
              shape.style.backgroundColor = arrowTone;
              const mask = `url("${src.replace(/"/g, "%22")}")`;
              shape.style.maskImage = embeddedExitOnlyArrowMasks.get(src) || mask;
              shape.style.webkitMaskImage = shape.style.maskImage;
              frame.appendChild(shape);
              image.style.visibility = "hidden";
              frame._arrowMaskReady = getEmbeddedExitOnlyArrowMask(src).then((embeddedMask) => {
                  if (embeddedMask) {
                      shape.style.maskImage = embeddedMask;
                      shape.style.webkitMaskImage = embeddedMask;
                  } else if (location.protocol === "file:") {
                      // No usable mask: show the arrow image itself rather than nothing.
                      image.style.visibility = "";
                      shape.remove();
                  }
                  return waitForRenderedArrowMask(embeddedMask, src);
              });
              let lastRatio = 0;
              const resize = (ratio) => {
                  if (!Number.isFinite(ratio) || ratio <= 0 || ratio === lastRatio) return;
                  lastRatio = ratio;
                  const baseHeight = key.startsWith("DOWN") ? 1.5 : key === "TYPE_B" ? 1.85 : Math.sqrt(1.85 * 1.85 / ratio);
                  const height = baseHeight * size / 3 * extendedScale;
                  const radians = angle * Math.PI / 180;
                  const width = height * ratio;
                  const boundsWidth = Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians));
                  const boundsHeight = Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians));
                  const opticalInset = ["DOWN", "DOWN_ALT", "TYPE_A", "TYPE_A_EXTENDED", "TYPE_B", "TYPE_D"]
                      .includes(key) ? Math.min(boundsWidth * 0.18, 0.55) * diagonalAmount : 0;
                  image.style.height = `${height}rem`;
                  shape.style.width = `${width}rem`;
                  shape.style.height = `${height}rem`;
                  frame.dataset.standardBoundsWidth = String(boundsWidth);
                  frame.style.width = `${Math.max(0.3, boundsWidth - (plain || variant === "boxed" ? 0 : opticalInset))}rem`;
                  frame.style.height = `${Math.max(0.1, boundsHeight - heightReduction)}rem`;
                  syncExitOnlyPanelWidth();
              };
              image.addEventListener("load", () => {
                  const ratio = image.naturalWidth / image.naturalHeight;
                  if (Number.isFinite(ratio) && ratio > 0) {
                      exitOnlyArrowRatios.set(src, ratio);
                      resize(ratio);
                  }
              });
              const cachedRatio = exitOnlyArrowRatios.get(src) ||
                  (image.complete && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 0);
              if (cachedRatio) resize(cachedRatio);
              frame._refreshArrowLayout = syncExitOnlyPanelWidth;
              return frame;
          };
          const makeText = (value, name) => {
              const el = document.createElement("span");
              el.className = `modernExitText modernExitText-${name}`;
              const displayedText = String(value).replace(/\\n/g, "\n");
              el.textContent = displayedText;
              if (displayedText.includes("\n")) el.classList.add("modernExitMultiline");
              if (variant === "boxed") {
                  el.classList.add(/[gjpqy]/.test(displayedText.split("\n").at(-1))
                      ? "modernExitHasDescender" : "modernExitNoDescender");
              }
              let font = typeof resolveTextFontFamilyForRender === "function"
                  ? resolveTextFontFamilyForRender(sign.exitTextFont || "Series E",
                      { backgroundColor: sign.exitBackgroundColor || "Yellow" }, panel)
                  : sign.exitTextFont || "Series E";
              if (isMotorwayFont(font)) font = getMotorwayFallbackFont(font);
              el.style.fontFamily = `"${String(font).replace(/["\\]/g, "")}"`;
              const gothic = /^Series\s(?:B|C|D|E|EEM|EM|F)\b/i.test(sign.exitTextFont || "Series E");
              el.style.fontSize = `${1.75 * Math.max(50, Math.min(100, Number(sign.exitTextSize) || 70)) / 100 * (gothic ? 1.2 : 1)}rem`;
              const letterSpacing = Number(sign.exitTextSpacing);
              el.style.letterSpacing = `${Number.isFinite(letterSpacing) ? letterSpacing : 0}em`;
              return el;
          };
          const makeColoredLane = (laneCount) => {
              const lane = document.createElement("div");
              lane.className = "modernExitColoredLane";
              const sequence = document.createElement("div");
              sequence.className = "modernExitSequence";
              sequence.style.setProperty("--exitOnlyArrowGap", `${spacing}rem`);
              const appendArrow = () => sequence.appendChild(makeArrow(variant === "boxed"));
              const appendGap = () => {
                  const gap = document.createElement("span");
                  gap.className = "modernExitArrowGap";
                  sequence.appendChild(gap);
              };
              const appendArrows = (number) => {
                  for (let i = 0; i < number; i++) {
                      if (i) appendGap();
                      appendArrow();
                  }
              };
              const makeTextSlot = (value, name) => {
                  const slot = document.createElement("span");
                  slot.className = "modernExitTextSlot";
                  slot.appendChild(makeText(value, name));
                  return slot;
              };
              const leftText = makeTextSlot(sign.exitOnlyLeftText ?? "EXIT", "left");
              const rightText = makeTextSlot(sign.exitOnlyRightText ?? "ONLY", "right");
              const combinedText = laneCount === 0 || (laneCount > 1 && laneCount % 2 === 0);
              const appendTexts = () => {
                  if (combinedText) {
                      const left = String(sign.exitOnlyLeftText ?? "EXIT");
                      const right = String(sign.exitOnlyRightText ?? "ONLY");
                      const joined = left + (left.length && right.length ? " " : "") + right;
                      sequence.appendChild(makeTextSlot(joined, "combined"));
                  } else {
                      sequence.append(leftText, rightText);
                  }
              };
              // A split exit's alignment moves the colored area as a unit. Its
              // text and arrows keep their normal order inside that area.
              const alignment = variant === "laneSplit" || laneCount > 1
                  ? "Center" : sign.exitArrowAlignment || "Center";
              sequence.dataset.arrowCount = String(laneCount);
              sequence.dataset.alignment = alignment.toLowerCase();
              if (laneCount === 1 && alignment === "Center") {
                  // Keep both words next to the arrow as the panel widens.
                  sequence.style.justifyContent = "center";
                  sequence.style.columnGap = "0.55rem";
                  for (const slot of [leftText, rightText]) {
                      slot.style.flex = "0 0 auto";
                      slot.style.width = "max-content";
                      slot.style.minWidth = "max-content";
                  }
              }
              if (laneCount === 0) {
                  appendTexts();
              } else if (alignment === "Left") {
                  appendArrows(laneCount);
                  appendTexts();
              } else if (alignment === "Right") {
                  appendTexts();
                  appendArrows(laneCount);
              } else if (laneCount === 1) {
                  sequence.appendChild(leftText);
                  appendArrow();
                  sequence.appendChild(rightText);
              } else if (laneCount % 2 === 0) {
                  appendArrows(laneCount / 2);
                  appendTexts();
                  appendArrows(laneCount / 2);
              } else {
                  appendArrows(Math.floor(laneCount / 2));
                  sequence.appendChild(leftText);
                  appendArrow();
                  sequence.appendChild(rightText);
                  appendArrows(Math.floor(laneCount / 2));
              }
              lane.appendChild(sequence);
              document.fonts?.ready?.then(syncExitOnlyPanelWidth);
              return lane;
          };

          arrowContElmt.classList.add("modernExitLayout");
          if (variant === "laneSplit") {
              const colored = makeColoredLane(count);
              const plain = document.createElement("div");
              plain.className = "modernExitPlainLane";
              if (count > 0) {
                  const plainArrow = makeArrow(true);
                  plainArrow.draggable = false;
                  plainArrow.addEventListener("click", (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                  });
                  plainArrow.addEventListener("pointerdown", (event) => {
                      if (event.button !== 0) return;
                      event.preventDefault();
                      event.stopPropagation();
                      suppressArrowBandClickUntil = performance.now() + 750;
                      const original = sign.exitSplitPlainArrowPosition;
                      const initialX = event.clientX;
                      const laneRect = plain.getBoundingClientRect();
                      const arrowRect = plainArrow.getBoundingClientRect();
                      const initialCenter = arrowRect.left + arrowRect.width / 2;
                      const scale = laneRect.width / (plain.offsetWidth || laneRect.width);
                      const wasDraggable = panelElmt.draggable;
                      panelElmt.draggable = false;
                      guideArrowPointerDragActive = true;
                      splitPlainArrowDragging = true;
                      plainArrow.setPointerCapture(event.pointerId);
                      let moved = false;
                      let position = original;
                      const move = (moveEvent) => {
                          if (moveEvent.pointerId !== event.pointerId) return;
                          moveEvent.preventDefault();
                          moveEvent.stopPropagation();
                          if (laneRect.width <= arrowRect.width) return;
                          if (Math.abs(moveEvent.clientX - initialX) > 3) moved = true;
                          if (!moved) return;
                          const rawCenter = Math.max(laneRect.left + arrowRect.width / 2,
                              Math.min(laneRect.right - arrowRect.width / 2,
                                  initialCenter + moveEvent.clientX - initialX));
                          const midpoint = laneRect.left + laneRect.width / 2;
                          const center = Math.abs(rawCenter - midpoint) <= 10 ? midpoint : rawCenter;
                          position = (center - laneRect.left) / laneRect.width;
                          plainArrow.style.left = `${(center - laneRect.left) / (scale || 1)}px`;
                          plainArrow.style.transform = "translate(-50%, -50%)";
                      };
                      const restore = () => {
                          window.removeEventListener("pointermove", move, true);
                          window.removeEventListener("pointerup", finish, true);
                          window.removeEventListener("pointercancel", cancel, true);
                          plainArrow.removeEventListener("lostpointercapture", cancel);
                          panelElmt.draggable = wasDraggable;
                          guideArrowPointerDragActive = false;
                          splitPlainArrowDragging = false;
                          suppressArrowBandClickUntil = performance.now() + 750;
                      };
                      const finish = (upEvent) => {
                          if (upEvent.pointerId !== event.pointerId) return;
                          upEvent.preventDefault();
                          upEvent.stopPropagation();
                          move(upEvent);
                          restore();
                          if (moved && position != null) runWithUndo(() => {
                              sign.exitSplitPlainArrowPosition = position;
                          });
                          else selectRenderedPanelArea({ panelIndex: index, menu: "guideArrows",
                              guideMode: "standard", suppressRedraw: true, flashTarget: guideArrowsElmt });
                      };
                      const cancel = (cancelEvent) => {
                          if (cancelEvent.pointerId !== event.pointerId) return;
                          cancelEvent.stopPropagation();
                          restore();
                          syncSplitExitLanePlacement();
                      };
                      window.addEventListener("pointermove", move, true);
                      window.addEventListener("pointerup", finish, true);
                      window.addEventListener("pointercancel", cancel, true);
                      plainArrow.addEventListener("lostpointercapture", cancel);
                  });
                  plain.appendChild(plainArrow);
              }
              const coloredLeft = sign.exitArrowAlignment === "Left";
              arrowContElmt.appendChild(coloredLeft ? colored : plain);
              arrowContElmt.appendChild(coloredLeft ? plain : colored);
              colored.classList.add(coloredLeft ? "onLeft" : "onRight");
              colored.style.borderTopWidth = sign.exitTopBorder ? borderWidth : "0";
          } else {
              arrowContElmt.appendChild(makeColoredLane(count));
          }
          syncExitOnlyPanelWidth();
      } else {
        // v2.2's guide arrows: side arrows, legacy Exit Only rows and lane arrows.
        if (
          panel.sign.arrowPosition == "Left" &&
          panel.sign.guideArrow != "Exit Only" &&
          panel.sign.guideArrow != "Side Left" &&
          panel.sign.guideArrow != "Side Right" &&
          panel.sign.guideArrow != "Half Exit Only"
        ) {
          arrowContElmt.style.justifyContent = "left";
        } else if (panel.sign.arrowPosition == "Middle") {
          arrowContElmt.style.cssFloat = "none";
        } else if (
          panel.sign.arrowPosition == "Right" &&
          panel.sign.guideArrow != "Exit Only" &&
          panel.sign.guideArrow != "Side Left" &&
          panel.sign.guideArrow != "Side Right" &&
          panel.sign.guideArrow != "Half Exit Only"
        ) {
          arrowContElmt.style.justifyContent = "right";
        }

        if (panel.sign.guideArrow.includes("Exit Only")) {
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
            panel.sign.guideArrow === "Exit Only" ||
            panel.sign.guideArrow === "Half Exit Only"
          ) {
            const parsedArrowHorizontalPadding = parseFloat(
              panel.sign.exitOnlyArrowHorizontalPadding
            );
            const arrowHorizontalPadding = Number.isFinite(
              parsedArrowHorizontalPadding
            )
              ? Math.min(Math.max(parsedArrowHorizontalPadding, 0), 6)
              : 0;
            arrowContElmt.style.setProperty(
              "--exitOnlyArrowHorizontalPadding",
              `${arrowHorizontalPadding}rem`
            );
          }
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

          if (panel.sign.guideArrow == "Half Exit Only") {
            const secondaryContainer = document.createElement("div");
            secondaryContainer.className = `arrowContainer ${panel.sign.guideArrow
              .replace("/", "-")
              .replace(" ", "_")
              .toLowerCase()} ${panel.sign.arrowPosition.toLowerCase()} halfExitOnlyPanel`;

            guideArrowsElmt.className += post.secondExitOnly
              ? " new2"
              : " default";
            guideArrowsElmt.classList.remove("halfExitNoBorder");

            if (!post.secondExitOnly) {
              const borderMode = resolvedExitOnlyBorderMode;
              const arrowPos = panel.sign.arrowPosition.toLowerCase();
              const overlap = `-${borderWidthValue}`;
              const touchesLeftEdge =
                arrowPos === "left" || arrowPos === "middle";
              const touchesRightEdge =
                arrowPos === "right" || arrowPos === "middle";

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

            const arrow = createArrowElmt(
              panel.sign.exitguideArrows.split(":")[1],
              "MainArrows!ExitOnly",
              "halfarrow",
              panel.sign.arrowPosition.toLowerCase()
            );

            if (panel.sign.arrowPosition.toLowerCase() == "left") {
              arrowContElmt.appendChild(secondaryContainer);
              arrowContElmt.appendChild(arrow);

              if (panel.sign.guideArrowLanes > 1) {
                var marginLeft = 4;

                for (let i = 1; i <= panel.sign.guideArrowLanes - 2; i++) {
                  if (i % 2 == 0) {
                    marginLeft += 12;
                  } else {
                    marginLeft += 4;
                  }
                }
              }
            } else {
              arrowContElmt.appendChild(arrow);
              arrowContElmt.appendChild(secondaryContainer);

              if (panel.sign.guideArrowLanes > 1) {
                var marginLeft = 11;

                for (let i = 1; i <= panel.sign.guideArrowLanes - 2; i++) {
                  if (i % 2 == 0) {
                    marginLeft += 12;
                  } else {
                    marginLeft += 4;
                  }
                }
              }
            }

            path.style.padding = panel.sign.exitOnlyPadding + "rem";
          } else {
            path = arrowContElmt;
          }
        }

        if ("Side Left" == panel.sign.guideArrow) {
          if (sideLeftArrowElmt) {
            sideLeftArrowElmt.style.display = "flex";
          }
        } else if ("Side Right" == panel.sign.guideArrow) {
          if (sideRightArrowElmt) {
            sideRightArrowElmt.style.display = "flex";
          }
        } else if ("None" != panel.sign.guideArrow || hasBottomArrow) {
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
                path.className += " new2";
                arrowContElmt.className += " new2";
                const arrowPositionSetting =
                  typeof panel.sign.arrowPosition === "string"
                    ? panel.sign.arrowPosition.toLowerCase()
                    : "middle";
                let justifyContent = "center";
                if (arrowPositionSetting === "left") {
                  justifyContent = "flex-start";
                } else if (arrowPositionSetting === "right") {
                  justifyContent = "flex-end";
                }
                arrowContElmt.style.justifyContent = justifyContent;
                arrowContElmt.style.gap = (typeof panel.sign.halfExitGap === "number" ? panel.sign.halfExitGap : 5) + "rem";
                arrowContElmt.style.width = "100%";
              }
              guideArrowsElmt.style.display = "flex";
            }

            if (post.secondExitOnly && panel.sign.guideArrow == "Exit Only") {
              console.log("hi");
              path.style.padding = panel.sign.exitOnlyPadding + "rem";
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
              const exitOnlyLabelLeft = (typeof panel.sign.exitOnlyLeftText === "string" ? panel.sign.exitOnlyLeftText : "EXIT").trim();
              const exitOnlyLabelRight = (typeof panel.sign.exitOnlyRightText === "string" ? panel.sign.exitOnlyRightText : "ONLY").trim();
              const exitOnlyLabelFull = [exitOnlyLabelLeft, exitOnlyLabelRight]
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
                        } else {
                          textExitOnlySpanElmt.appendChild(
                            document.createTextNode("⠀⠀⠀⠀ ⠀⠀⠀⠀")
                          );
                          textExitOnlySpanElmt.className = "exitOnlyText";
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
                    // Special handling for 2 arrows Exit Only
                    const arrowPos = (
                      panel.sign.arrowPosition || "Middle"
                    ).toLowerCase();

                    let arrowEl1 = createArrowElmt(
                      panel.sign.exitguideArrows.split(":")[1]
                    );
                    let arrowEl2 = createArrowElmt(
                      panel.sign.exitguideArrows.split(":")[1]
                    );

                    let leftTextEl = null;
                    if (shouldRenderLabel(exitOnlyLabelLeft)) {
                      leftTextEl = document.createElement("span");
                      if (panel.sign.showExitOnly == false) {
                        leftTextEl.appendChild(
                          document.createTextNode(exitOnlyLabelLeft)
                        );
                        leftTextEl.className = "exitOnlyText";
                      } else {
                        leftTextEl.appendChild(
                          document.createTextNode("⠀⠀⠀⠀")
                        );
                        leftTextEl.className = "exitOnlyText";
                      }
                    }

                    let rightTextEl = null;
                    if (shouldRenderLabel(exitOnlyLabelRight)) {
                      rightTextEl = document.createElement("span");
                      if (panel.sign.showExitOnly == false) {
                        rightTextEl.appendChild(
                          document.createTextNode(exitOnlyLabelRight)
                        );
                        rightTextEl.className = "exitOnlyText";
                      } else {
                        rightTextEl.appendChild(
                          document.createTextNode("⠀⠀⠀⠀")
                        );
                        rightTextEl.className = "exitOnlyText";
                      }
                    }

                    if (arrowPos === "left") {
                      // (arrow) EXIT (arrow) ONLY
                      if (arrowEl1) path.appendChild(arrowEl1);
                      if (leftTextEl) path.appendChild(leftTextEl);
                      if (arrowEl2) path.appendChild(arrowEl2);
                      if (rightTextEl) path.appendChild(rightTextEl);
                    } else if (arrowPos === "right") {
                      // EXIT (arrow) ONLY (arrow)
                      if (leftTextEl) path.appendChild(leftTextEl);
                      if (arrowEl1) path.appendChild(arrowEl1);
                      if (rightTextEl) path.appendChild(rightTextEl);
                      if (arrowEl2) path.appendChild(arrowEl2);
                    } else {

                      if (arrowEl1) path.appendChild(arrowEl1);
                      if (leftTextEl) path.appendChild(leftTextEl);
                      if (rightTextEl) path.appendChild(rightTextEl);
                      if (arrowEl2) path.appendChild(arrowEl2);
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
                      } else {
                        leftTextEl.appendChild(
                          document.createTextNode("⠀⠀⠀⠀")
                        );
                        leftTextEl.className = "exitOnlyText";
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
                      } else {
                        rightTextEl.appendChild(
                          document.createTextNode("⠀⠀⠀⠀")
                        );
                        rightTextEl.className = "exitOnlyText";
                      }
                    }

                    const isExitOnlySingle =
                      panel.sign.guideArrow == "Exit Only" && length == 1;
                    const arrowPos = isExitOnlySingle
                      ? (panel.sign.arrowPosition || "Middle").toLowerCase()
                      : "middle";

                    if (arrowPos === "left") {
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
          } else if (hasBottomArrow) {
            arrowContElmt.classList.remove("hideExitOnlyArrows");
            const bottomArrowGap = Number.isFinite(panel.sign.bottomArrowGap)
              ? Math.max(panel.sign.bottomArrowGap, 0)
              : 0.5;
            const bottomArrowSpacing = Number.isFinite(
              panel.sign.bottomArrowSpacing
            )
              ? Math.max(panel.sign.bottomArrowSpacing, 0)
              : 1;
            guideArrowsElmt.style.padding = bottomArrowGap + "rem";
            arrowContElmt.style.gap = bottomArrowSpacing + "rem";
            for (
              let arrowIndex = 0, length = panel.sign.guideArrowLanes;
              arrowIndex < length;
              arrowIndex++
            ) {
              const bottomArrow = new ArrowElement({
                arrow: panel.sign.bottomArrowKind,
                rotation: panel.sign.bottomArrowRotation,
              });
              const bottomArrowElmt = bottomArrow.createElement();
              bottomArrowElmt.classList.add("bottomGuideArrow");
              reserveRotatedGuideArrowSpace(
                bottomArrowElmt,
                panel.sign.bottomArrowKind,
                panel.sign.bottomArrowRotation,
                { width: bottomArrow.size }
              );

              if (arrowIndex % 2 == 0) {
                arrowContElmt.insertBefore(
                  bottomArrowElmt,
                  arrowContElmt.childNodes[0]
                );
              } else {
                arrowContElmt.appendChild(bottomArrowElmt);
              }
            }
          } else {
            arrowContElmt.classList.remove("hideExitOnlyArrows");
            for (
              let arrowIndex = 0, length = panel.sign.guideArrowLanes;
              arrowIndex < length;
              arrowIndex++
            ) {
              if (arrowIndex % 2 == 0) {
                arrowContElmt.insertBefore(
                  createArrowElmt(
                    panel.sign.guideArrow.split(":")[1],
                    "MainArrows",
                    "arrow",
                    panel.sign.guideArrow
                      .split(":")[0]
                      .toLowerCase()
                      .replace(/ /g, "")
                  ),
                  arrowContElmt.childNodes[0]
                );
              } else {
                arrowContElmt.appendChild(
                  createArrowElmt(
                    panel.sign.guideArrow.split(":")[1],
                    "MainArrows",
                    "arrow",
                    panel.sign.guideArrow.split(":")[0]
                  )
                );
              }
            }
          }
        }
        // Bottom Symbols
      }

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

      // v2.19 Quebec exit marker: the numbered QC symbol on the sign's bottom
      // edge, opposite the arrow when the sign has an Exit Only band.
      const qcExitTab = panel.exitTabs.find(
        (tab) => tab?.variant === "Quebec Exit Marker" && String(tab.number || "").trim()
      );
      if (qcExitTab) {
        const hasExitOnlyBand = ["Exit Only", "Half Exit Only", "Split Exit Only"]
          .includes(panel.sign.guideArrow);
        const arrowOnLeft =
          String(panel.sign.arrowPosition || "").toLowerCase() === "left";
        const qcPosition = hasExitOnlyBand
          ? (arrowOnLeft ? "Right" : "Left")
          : ["Left", "Center", "Right"].includes(qcExitTab.position)
            ? qcExitTab.position
            : "Right";
        const qcWidth = Math.max(2, Math.min(6, (parseFloat(qcExitTab.fontSize) || 18) / 5));
        const qcMarker = document.createElement("div");
        qcMarker.className = `qcExitMarker qcOnSign qc${qcPosition}`;
        qcMarker.classList.toggle("flipped", hasExitOnlyBand && arrowOnLeft);
        qcMarker.style.setProperty("--qc-marker-width", `${qcWidth}rem`);
        qcMarker.style.setProperty("--qc-marker-height", `${qcWidth * 0.387}rem`);
        qcMarker.style.setProperty("--qc-marker-font-size", `${qcWidth * 0.33}rem`);
        const qcImg = document.createElement("img");
        qcImg.className = "qcExitMarkerImg";
        qcImg.src = "img/other-symbols/QC-Exit.svg";
        qcImg.alt = "Quebec exit marker";
        const qcNumber = document.createElement("span");
        qcNumber.className = "qcExitMarkerNumber";
        qcNumber.textContent = String(qcExitTab.number).trim();
        qcMarker.append(qcImg, qcNumber);
        signElmt.appendChild(qcMarker);
      }

      // APL Arrows Rendering
      // aplArrows is already defined above
      if (aplArrows.length > 0) {
        // The APL row lives inside the sign, so the sign keeps its own bottom
        // border and rounded corners (matching v2.19).
        signElmt.style.removeProperty("border-bottom-width");
        signElmt.style.removeProperty("width");
        // APL arrows are now rendered inside subpanels
        syncAplSubpanelWidths();
        requestAnimationFrame(() => {
          syncAplSubpanelWidths();
          requestAnimationFrame(syncAplSubpanelWidths);
        });
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(syncAplSubpanelWidths).catch(() => {});
        }
      }

      formatRemainingSignFractions(panelElmt);
      applyAplEdgeExitTabLayout();

      var width = signCont.clientWidth;
      var exitWidth = firstExitTab.clientWidth;

      if (!firstExitTab.classList.contains("side") && exitWidth > width) {
        signCont.style.width = firstExitTab.clientWidth + "px";
      }

      panelElmt.style.marginTop = "";
      if (
        panelElmt.parentElement?.classList.contains("panelStack") &&
        panelElmt.previousElementSibling &&
        panelElmt.classList.contains("hasVisibleExitTab")
      ) {
        const panelRect = panelElmt.getBoundingClientRect();
        const signRect = signCont.getBoundingClientRect();
        const signOffset = signRect.top - panelRect.top;
        if (signOffset > 0) {
          panelElmt.style.marginTop = "-" + signOffset + "px";
        }
      }

      schedulePanelBorderGradientUpdate(panelElmt);
    }
    layoutDraggedExitTabs(panelContainerElmt);
    panelContainerElmt
      .querySelectorAll(".panel.vmsPanel")
      .forEach((vmsPanelElmt) => VmsPanel.mount(vmsPanelElmt));
    scheduleAlignmentGuideUpdate(postContainerElmt, panelContainerElmt);
    captureHistoryAfterRedraw();
    persistSessionState();
  };

  VmsPanel.setFontProvider((root) => getSafeExportFontEmbedCSS(root));
  // VMS panels rasterize an isolated copy of the sign, never the live editor.
  VmsPanel.setCaptureProvider(async (screen, options) => {
    const panel = screen.closest(".panel");
    const captureClone = panel ? createStaticExportClone(panel) : null;
    const source = captureClone?.node.querySelector(".signContainer");
    if (!source) {
      captureClone?.cleanup();
      throw new Error("Unable to prepare an isolated VMS capture.");
    }
    source.dataset.vmsCaptureSource = "true";
    let restore = () => {};
    try {
      restore = materializeExportBannerFirstLetters(source);
      await waitForImagesInElement(source);
      return await htmlToImage.toCanvas(source, options);
    } finally {
      restore();
      captureClone?.cleanup();
    }
  });
  window.addEventListener("resize", () => VmsPanel.refreshPreviews());

  // Expose necessary variables and functions to formHandler
  const exposeToFormHandler = {
    // v2.2 records history after each redraw, so the v2.19 editor's undo
    // brackets have nothing to do.
    beginUndoableChange: () => {},
    endUndoableChange: () => {},
    getCurrentPanel,
    getCurrentSubPanel,
    getCurrentBlockRows,
    getCurrentBlockElem,
    getActiveBlockElements,
    getActiveGroupElement,
    getGroupEditingPath: () => currentlyEditingGroupPath.slice(),
    getPost: () => post,
    checkSpecialShield,
    redraw,
    runShortcutAction,
    setSelectedRow,
    setSelectedControlElem,
    moveControlElem,
    insertControlElemAt,
    insertControlElemInNewRow,
    copyControlElements,
    cutControlElements,
    pasteControlElements,
    replaceControlElemTypeAt,
    moveRow,
    enterGroupElement,
    exitGroupElement,
    groupSelectedBlockElements,
    ungroupSelectedBlockElement,
    changeEditingPanel,
    movePanel,
    newPanel,
    duplicatePanel,
    deletePanel,
    changeEditingSubPanel,
    moveSubPanel,
    changeEditingExitTab,
    newExitTab,
    duplicateExitTab,
    removeExitTab,
    moveExitTab,
    newNestExitTab,
    deleteNestExitTab,
    setPanelSpacing,
    getCurrentStackedPanelInfo,
    getPanelDisplayLabel,
    isStackedPanelBottom,
    getStackedPanelTopIndex,
    isPanelHiddenFromPost,
    setSignAlignment,
    duplicateBlockIntoNewRow,
    deleteShield,
    duplicateShield,
    addAPLArrow,
    removeAPLArrow,
    removeAPLArrowAt,
    selectAPLArrow,
    updateAPLArrowType,
    toggleAPLArrowFlip,
    addAPLDivider,
    addAPLDividerArrow,
    setAPLArrowSpacing,
    setAPLArrowBeforeSpacing,
    setAPLArrowSize,
    moveAPLArrow,
    initializeAPLArrowsForCurrentPanel,
    setAPLCombineExitOnlyLabels,
    addAPLSubPanelLeftAndOpen,
    addAPLSubPanelRightAndOpen,
    getAPLSubpanelGroups: getAPLSubpanelGroupsForCurrentPanel,
    getAPLArrowKind,
    canUseAplEdgeExitTab,
    setCurrentPanelArrowMode,
    setAPLGroupedWithDivider: (index, grouped) => {
      getCurrentPanel().sign.setAPLGroupedWithDivider(index, grouped);
      formHandler.updateForm();
      redraw();
    },
    setAPLExitOnly: (index, isExitOnly) => {
      const sign = getCurrentPanel().sign;
      if (index >= 0 && index < sign.aplArrows.length) {
        sign.aplArrows[index].exitOnly = !!isExitOnly;
        currentlySelectedAPLArrowIndex = index;
        formHandler.updateForm();
        redraw();
      }
    },
    setAPLArrowMarginLeft: (index, margin) => {
      getCurrentPanel().sign.setAPLArrowMarginLeft(index, margin);
      setAPLArrowBeforeSpacing(index, margin);
    },
    setAPLArrowMarginRight: (index, margin) => {
      getCurrentPanel().sign.setAPLArrowMarginRight(index, margin);
      setAPLArrowSpacing(index, margin);
    },
    setAPLExitOnlyBgColor: (index, color) => {
      getCurrentPanel().sign.setAPLExitOnlyBgColor(index, color);
      redraw();
    },
    setAPLExitOnlyPadding: (index, padding) => {
      getCurrentPanel().sign.setAPLExitOnlyPadding(index, padding);
      redraw();
    },
    setAPLExitOnlyBorderRadius: (index, radius) => {
      getCurrentPanel().sign.setAPLExitOnlyBorderRadius(index, radius);
      redraw();
    },
    setAPLExitOnlyTextLeft: (index, text) => {
      getCurrentPanel().sign.setAPLExitOnlyTextLeft(index, text);
      redraw();
    },
    setAPLExitOnlyFont: (index, font) => {
      getCurrentPanel().sign.setAPLExitOnlyFont(index, font);
      redraw();
    },
    setAPLExitOnlySize: (index, size) => {
      getCurrentPanel().sign.setAPLExitOnlySize(index, size);
      redraw();
    },
    setAPLExitOnlyLetterSpacing: (index, spacing) => {
      getCurrentPanel().sign.setAPLExitOnlyLetterSpacing(index, spacing);
      redraw();
    },
    setAPLExitOnlyTextRight: (index, text) => {
      getCurrentPanel().sign.setAPLExitOnlyTextRight(index, text);
      redraw();
    },
    setAPLExitOnlyHideLeft: (index, hidden) => {
      getCurrentPanel().sign.setAPLExitOnlyHideLeft(index, hidden);
      redraw();
    },
    setAPLExitOnlyHideRight: (index, hidden) => {
      getCurrentPanel().sign.setAPLExitOnlyHideRight(index, hidden);
      redraw();
    },
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

  const normalizeIndex = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.trunc(number) : fallback;
  };

  const normalizeEditorSelection = () => {
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
      normalizeIndex(currentlySelectedPanelIndex),
      0,
      post.panels.length - 1
    );

    const panel = post.panels[currentlySelectedPanelIndex];
    const subPanels = Array.isArray(panel?.sign?.subPanels)
      ? panel.sign.subPanels
      : [];
    currentlySelectedSubPanelIndex =
      currentlySelectedSubPanelIndex === -1
        ? -1
        : clamp(
            normalizeIndex(currentlySelectedSubPanelIndex),
            0,
            Math.max(0, subPanels.length - 1)
          );

    const exitTabs = Array.isArray(panel?.exitTabs) ? panel.exitTabs : [];
    currentlySelectedExitTabIndex = exitTabs.length
      ? clamp(
          normalizeIndex(currentlySelectedExitTabIndex),
          0,
          exitTabs.length - 1
        )
      : 0;

    const nestedExitTabs = Array.isArray(
      exitTabs[currentlySelectedExitTabIndex]?.nestedExitTabs
    )
      ? exitTabs[currentlySelectedExitTabIndex].nestedExitTabs
      : [];
    currentlySelectedNestedExitTabIndex =
      currentlySelectedNestedExitTabIndex === -1
        ? -1
        : clamp(
            normalizeIndex(currentlySelectedNestedExitTabIndex),
            0,
            Math.max(0, nestedExitTabs.length - 1)
          );

    const selectedSubPanel =
      currentlySelectedSubPanelIndex === -1
        ? null
        : subPanels[currentlySelectedSubPanelIndex];
    if (!selectedSubPanel) {
      resetGroupEditing();
    } else {
      getActiveGroupContext();
    }
    const activeBlockElements =
      selectedSubPanel && currentlySelectedSubPanelIndex !== -1
        ? getActiveBlockElements()
        : null;
    const rows = Array.isArray(activeBlockElements?.rows)
      ? activeBlockElements.rows
      : [];
    currentlySelectedRowIndex = rows.length
      ? clamp(normalizeIndex(currentlySelectedRowIndex), 0, rows.length - 1)
      : 0;

    const row = Array.isArray(rows[currentlySelectedRowIndex])
      ? rows[currentlySelectedRowIndex]
      : [];
    currentlySelectedBlockIndex = row.length
      ? clamp(normalizeIndex(currentlySelectedBlockIndex), 0, row.length - 1)
      : 0;

    const aplArrows = Array.isArray(panel?.sign?.aplArrows)
      ? panel.sign.aplArrows
      : [];
    currentlySelectedAPLArrowIndex = aplArrows.length
      ? clamp(
          normalizeIndex(currentlySelectedAPLArrowIndex),
          0,
          aplArrows.length - 1
        )
      : 0;
  };

  const applySelectionState = (selection) => {
    if (selection && typeof selection === "object") {
      currentlySelectedPanelIndex = normalizeIndex(
        selection.currentlySelectedPanelIndex,
        currentlySelectedPanelIndex
      );
      currentlySelectedSubPanelIndex = normalizeIndex(
        selection.currentlySelectedSubPanelIndex,
        currentlySelectedSubPanelIndex
      );
      currentlySelectedExitTabIndex = normalizeIndex(
        selection.currentlySelectedExitTabIndex,
        currentlySelectedExitTabIndex
      );
      currentlySelectedNestedExitTabIndex = normalizeIndex(
        selection.currentlySelectedNestedExitTabIndex,
        currentlySelectedNestedExitTabIndex
      );
      currentlySelectedRowIndex = normalizeIndex(
        selection.currentlySelectedRowIndex,
        currentlySelectedRowIndex
      );
      currentlySelectedBlockIndex = normalizeIndex(
        selection.currentlySelectedBlockIndex,
        currentlySelectedBlockIndex
      );
      currentlySelectedAPLArrowIndex = normalizeIndex(
        selection.currentlySelectedAPLArrowIndex,
        currentlySelectedAPLArrowIndex
      );
      currentlyEditingGroupPath = Array.isArray(selection.currentlyEditingGroupPath)
        ? selection.currentlyEditingGroupPath
          .map((segment) => ({
            rowIndex: normalizeIndex(segment?.rowIndex, 0),
            blockIndex: normalizeIndex(segment?.blockIndex, 0),
          }))
          .filter(
            (segment) =>
              Number.isFinite(segment.rowIndex) &&
              Number.isFinite(segment.blockIndex)
          )
        : [];
    }

    normalizeEditorSelection();
  };

  const addElementTypes = (obj, visited = new WeakSet()) => {
    if (!obj || typeof obj !== "object" || visited.has(obj)) {
      return;
    }

    visited.add(obj);

    if (Array.isArray(obj)) {
      obj.forEach((item) => addElementTypes(item, visited));
      return;
    }

    if (Control.prototype.blockToClassElems) {
      try {
        const elemType = Control.prototype.blockToClassElems.getElem?.(obj);
        if (elemType) {
          obj._elementType = elemType;
        }
      } catch (error) {
        // Not a Control element instance.
      }
    }

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key) && key !== "_elementType") {
        addElementTypes(obj[key], visited);
      }
    }
  };

  const removeElementTypes = (obj, visited = new WeakSet()) => {
    if (!obj || typeof obj !== "object" || visited.has(obj)) {
      return;
    }

    visited.add(obj);

    if (Array.isArray(obj)) {
      obj.forEach((item) => removeElementTypes(item, visited));
      return;
    }

    if (obj._elementType) {
      delete obj._elementType;
    }

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        removeElementTypes(obj[key], visited);
      }
    }
  };

  const serializePostWithElementTypes = (space) => {
    addElementTypes(post);
    try {
      return JSON.stringify(post, null, space);
    } finally {
      removeElementTypes(post);
    }
  };

  const serializeCurrentPanelTemplate = (space) => {
    const panel = getCurrentPanel();
    if (!panel) {
      throw new Error("No panel is selected");
    }

    addElementTypes(panel);
    try {
      return JSON.stringify(
        {
          templateType: "panel",
          panel,
        },
        null,
        space
      );
    } finally {
      removeElementTypes(panel);
    }
  };

  const inferControlElementType = (elemData) => {
    if (!elemData || typeof elemData !== "object") {
      return null;
    }

    if (elemData._elementType) {
      return elemData._elementType;
    }

    if (!Control.prototype.blockToClassElems) {
      return null;
    }

    if (
      elemData.blockElements &&
      Array.isArray(elemData.blockElements.rows)
    ) {
      return "GroupedBlockElement";
    }
    if (elemData.icon !== undefined) {
      return "IconElement";
    }
    if (elemData.arrow !== undefined) {
      return "ArrowElement";
    }
    if (elemData.logo !== undefined || elemData.tollLogo !== undefined) {
      return "TollLogoElement";
    }
    if (elemData.shieldBase !== undefined || elemData.type !== undefined) {
      return "ShieldElement";
    }
    if (elemData.dividerWidth !== undefined) {
      return "DividerElement";
    }
    if (
      elemData.beacon !== undefined ||
      (elemData.size !== undefined &&
        elemData.color !== undefined &&
        !elemData.textContent)
    ) {
      return "BeaconElement";
    }
    if (elemData.textContent !== undefined) {
      if (elemData.glow !== undefined) {
        return "ElectronicSignElement";
      }
      if (
        elemData.borderRadius !== undefined &&
        elemData.horizPadding !== undefined
      ) {
        return "AdvisoryMessageElement";
      }
      if (elemData.spacing !== undefined) {
        return "ControlTextElement";
      }
      return "ActionMessageElement";
    }

    return null;
  };

  const reconstructControl = (controlData) => {
    if (!controlData) {
      return new Control();
    }

    const control = new Control();
    const rows = [];
    const blockProperties = [];

    if (Array.isArray(controlData.rows)) {
      for (const rowData of controlData.rows) {
        const row = [];
        if (Array.isArray(rowData)) {
          for (const elemData of rowData) {
            const elemType = inferControlElementType(elemData);

            if (
              elemType &&
              Control.prototype.blockToClassElems &&
              Control.prototype.blockToClassElems[elemType]
            ) {
              const ElemClass = Control.prototype.blockToClassElems[elemType];
              const elem =
                elemType === "GroupedBlockElement"
                  ? new ElemClass({
                    ...elemData,
                    blockElements: reconstructControl(elemData.blockElements),
                  })
                  : new ElemClass(elemData);
              Object.assign(elem, elemData);
              if (typeof elem.fontFamily === "string") {
                elem.fontFamily = normalizeTextFontFamilyName(elem.fontFamily);
              }
              if (elemType === "ShieldElement") {
                elem.bannerFontFamily =
                  ShieldElement.prototype.normalizeBannerFontFamily(
                    elem.bannerFontFamily
                  );
                elem.bannerFontFamily2 =
                  ShieldElement.prototype.normalizeBannerFontFamily(
                    elem.bannerFontFamily2 || elem.bannerFontFamily
                  );
              }
              if (elemType === "GroupedBlockElement") {
                elem.blockElements = reconstructControl(elemData.blockElements);
              }
              delete elem._elementType;
              row.push(elem);
            } else {
              console.warn("Could not reconstruct element:", elemData);
            }
          }
        }
        rows.push(row);

        const blockIndex = rows.length - 1;
        const blockData = controlData.blockProperties?.[blockIndex];
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

  const reconstructPostFromData = (postData) => {
    const newPost = new Post(
      postData.polePosition || Post.prototype.polePositions[0],
      postData.lanesWide || 1,
      postData.color || Post.prototype.colors[0]
    );

    Object.assign(newPost, postData);

    if (Array.isArray(postData.panels)) {
      newPost.panels = [];
      for (const panelData of postData.panels) {
        const subPanels = [];
        if (Array.isArray(panelData.sign?.subPanels)) {
          for (const subPanelData of panelData.sign.subPanels) {
            const blockElements = reconstructControl(subPanelData.blockElements);
            const subPanel = new SubPanels({
              ...subPanelData,
              blockElements,
            });
            Object.assign(subPanel, subPanelData);
            subPanel.blockElements = blockElements;
            subPanels.push(subPanel);
          }
        }

        const signData = panelData.sign || {};
        const sign = new Sign({
          ...signData,
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
        sign.migrateLegacyBottomArrow(signData);
        sign.subPanels = subPanels;

        const panel = new Panel(
          sign,
          panelData.color,
          [],
          panelData.corner,
          panelData.borderRadius,
          panelData.dms
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
        Panel.applyVmsData(panel, panelData);
        panel.sign = sign;
        newPost.panels.push(panel);
      }
    }

    return newPost;
  };

  const getPanelDataFromTemplate = (templateData) => {
    if (!templateData || typeof templateData !== "object") {
      return null;
    }

    if (templateData.panel && typeof templateData.panel === "object") {
      return templateData.panel;
    }

    if (templateData.sign && typeof templateData.sign === "object") {
      return templateData;
    }

    if (Array.isArray(templateData.panels) && templateData.panels.length) {
      const panelIndex = clamp(
        normalizeIndex(currentlySelectedPanelIndex),
        0,
        templateData.panels.length - 1
      );
      return templateData.panels[panelIndex] || templateData.panels[0];
    }

    return null;
  };

  const replaceCurrentPanelFromTemplate = (templateData) => {
    if (!post || !Array.isArray(post.panels) || !post.panels.length) {
      throw new Error("No panel is available to replace");
    }

    const panelData = getPanelDataFromTemplate(templateData);
    if (!panelData) {
      throw new Error("Template does not include a panel");
    }

    const targetPanelIndex = clamp(
      normalizeIndex(currentlySelectedPanelIndex),
      0,
      post.panels.length - 1
    );
    const templatePost = reconstructPostFromData({ panels: [panelData] });
    const replacementPanel = templatePost.panels[0];
    if (!replacementPanel) {
      throw new Error("Template panel could not be loaded");
    }

    post.panels[targetPanelIndex] = replacementPanel;
    currentlySelectedPanelIndex = targetPanelIndex;
    currentlySelectedSubPanelIndex = 0;
    currentlySelectedExitTabIndex = 0;
    currentlySelectedNestedExitTabIndex = -1;
    currentlySelectedRowIndex = 0;
    currentlySelectedBlockIndex = 0;
    currentlySelectedAPLArrowIndex = 0;
    resetGroupEditing();
    normalizeEditorSelection();
    formHandler.updateForm();
    redraw();
  };

  const getPost = function () {
    return post;
  };

  const setPost = function (newPost, selection) {
    post = newPost;
    if (!post) {
      return;
    }
    if (typeof post.panelSpacing !== "number" || post.panelSpacing < 0) {
      post.panelSpacing = 0;
    }
    migrateVerticalPanelOrientation(post);
    post.signAlignment = normalizeSignAlignment(post.signAlignment);
    post.thickness = post.normalizeThickness(post.thickness);
    if (typeof post.copySignsOnly !== "boolean") {
      post.copySignsOnly = true;
    }
    post.signFractions = post.signFractions === true;
    if (!Number.isFinite(post.copyScale)) {
      post.copyScale = 8;
    }
    post.copyScale = Math.min(8, Math.max(0, post.copyScale));
    post.showBlockBoundingBoxes = !!post.showBlockBoundingBoxes;
    post.showAlignmentGuides = !!post.showAlignmentGuides;
    post.alignmentGuideSpacing = post.normalizeAlignmentGuideSpacing(
      post.alignmentGuideSpacing
    );
    post.alignmentGuidePhase = post.normalizeAlignmentGuidePhase(
      post.alignmentGuidePhase,
      post.alignmentGuideSpacing
    );
    if (selection) {
      applySelectionState(selection);
    } else {
      resetGroupEditing();
      currentlySelectedPanelIndex = 0;
      normalizeEditorSelection();
    }
    formHandler.updateForm();
    redraw();
  };

  // Template management functions
  let templateDB = null;
  let defaultTemplatesPromise = null;
  let activeTemplateEditor = null;
  const TEMPLATE_LOAD_WARNING_STORAGE_KEY = "signMaker.templateLoadWarning";
  const DEFAULT_TEMPLATE_DATE = "2026-08-24T00:00:00.000Z";
  const DEFAULT_TEMPLATE_DEFINITIONS = [
    {
      id: "default-simple-exit",
      name: "Simple Exit",
      build: buildSimpleExitTemplate,
    },
    {
      id: "default-mileage-sign",
      name: "Mileage Sign",
      build: buildMileageTemplate,
    },
    {
      id: "default-tolled-exit",
      name: "Tolled Exit",
      build: buildTolledExitTemplate,
    },
    {
      id: "default-control-cities-advance-junction",
      name: "Control Cities Advance Junction",
      build: buildControlCitiesAdvanceJunctionTemplate,
    },
  ];

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

  const cloneTemplateValue = (value) => JSON.parse(JSON.stringify(value));

  const createDefaultTemplateData = (buildTemplate) => {
    const defaultPost = new Post(Post.prototype.polePositions[0]);
    defaultPost.newPanel();
    defaultPost.panels[0].sign.subPanels[0].blockElements = new Control(
      buildTemplate()
    );

    addElementTypes(defaultPost);
    try {
      return JSON.stringify(defaultPost, null, 2);
    } finally {
      removeElementTypes(defaultPost);
    }
  };

  const ensureDefaultTemplates = async function (db) {
    if (!defaultTemplatesPromise) {
      defaultTemplatesPromise = (async () => {
        const existingTemplates = await db.getAllTemplates();
        const existingIds = new Set(
          existingTemplates.map((template) => String(template.id))
        );

        for (const definition of DEFAULT_TEMPLATE_DEFINITIONS) {
          if (existingIds.has(definition.id)) {
            continue;
          }

          await db.saveTemplate({
            id: definition.id,
            name: definition.name,
            data: createDefaultTemplateData(definition.build),
            templateScope: "panel",
            variants: [],
            isDefault: true,
            dateCreated: DEFAULT_TEMPLATE_DATE,
            dateModified: DEFAULT_TEMPLATE_DATE,
          });
        }
      })().catch((error) => {
        defaultTemplatesPromise = null;
        throw error;
      });
    }

    return defaultTemplatesPromise;
  };

  const serializeTemplateData = function (scope = "post") {
    if (!post || !Array.isArray(post.panels) || post.panels.length === 0) {
      throw new Error("There is no sign to save.");
    }

    addElementTypes(post);
    let snapshot;
    try {
      snapshot = cloneTemplateValue(post);
    } finally {
      removeElementTypes(post);
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

  const normalizeTemplateSnapshot = (snapshot) => {
    if (!snapshot || typeof snapshot !== "object") {
      throw new Error("Template data is invalid.");
    }

    if (snapshot.panel && typeof snapshot.panel === "object") {
      return { panels: [snapshot.panel] };
    }

    if (snapshot.sign && typeof snapshot.sign === "object") {
      return { panels: [snapshot] };
    }

    if (Array.isArray(snapshot.panels)) {
      return snapshot;
    }

    throw new Error("Template does not contain any panels.");
  };

  const inferTemplateScope = (template) => {
    if (template?.templateScope === "post") {
      return "post";
    }
    if (template?.templateScope === "panel") {
      return "panel";
    }

    try {
      const snapshot = JSON.parse(template?.data || "{}");
      return Array.isArray(snapshot.panels) && snapshot.panels.length > 1
        ? "post"
        : "panel";
    } catch (error) {
      return "panel";
    }
  };

  const normalizeTemplateVariants = (template) => {
    if (!Array.isArray(template?.variants)) {
      return [];
    }

    const usedVariantIds = new Set();
    return template.variants
      .filter((variant) => variant && typeof variant === "object")
      .map((variant, index) => {
        const originalId = String(variant.id || `variant-${index + 1}`);
        let uniqueId = originalId;
        let duplicateNumber = 2;
        while (usedVariantIds.has(uniqueId)) {
          uniqueId = `${originalId}-${duplicateNumber}`;
          duplicateNumber += 1;
        }
        usedVariantIds.add(uniqueId);

        return {
          ...variant,
          id: uniqueId,
          name: String(variant.name || `Variant ${index + 1}`),
          data:
            typeof variant.data === "string" && variant.data.length > 0
              ? variant.data
              : template.data,
          fontFamily:
            typeof variant.fontFamily === "string" ? variant.fontFamily : "",
        };
      });
  };

  const applyFontFamilyToTemplateData = (value, fontFamily, visited = new WeakSet()) => {
    if (!value || typeof value !== "object" || visited.has(value)) {
      return;
    }

    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach((item) =>
        applyFontFamilyToTemplateData(item, fontFamily, visited)
      );
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      if (key === "fontFamily") {
        value[key] = fontFamily;
      } else {
        applyFontFamilyToTemplateData(child, fontFamily, visited);
      }
    }
  };

  const getTemplateVariant = (template, variantId) => {
    const normalizedId = String(variantId || "");
    if (!normalizedId) {
      return null;
    }

    const variant = normalizeTemplateVariants(template).find(
      (candidate) => candidate.id === normalizedId
    );
    if (!variant) {
      throw new Error(
        `Template variant "${normalizedId}" no longer exists. Base was not changed.`
      );
    }
    return variant;
  };

  const getTemplateSnapshot = (template, variantId) => {
    const variant = getTemplateVariant(template, variantId);
    const serializedData = variant?.data || template?.data;
    if (typeof serializedData !== "string") {
      throw new Error("Template data is missing.");
    }

    const snapshot = normalizeTemplateSnapshot(JSON.parse(serializedData));
    if (variant?.fontFamily) {
      applyFontFamilyToTemplateData(snapshot, variant.fontFamily);
    }
    return snapshot;
  };

  const getTemplatePostFromData = (template, variantId) =>
    reconstructPostFromData(getTemplateSnapshot(template, variantId));

  const getTemplatePanelsFromData = (template, variantId) => {
    const rebuiltPost = getTemplatePostFromData(template, variantId);
    return Array.isArray(rebuiltPost?.panels) ? rebuiltPost.panels : [];
  };

  const saveTemplate = async function (templateName, scope = "post") {
    if (activeTemplateEditor) {
      showTemplateTab("sMTemplateEditor");
      alert("Save or cancel the current template edit before creating another template.");
      return;
    }

    if (!templateName || templateName.trim() === "") {
      alert("Please enter a template name");
      return;
    }

    try {
      if (formHandler && typeof formHandler.readForm === "function") {
        formHandler.readForm();
      }

      const db = await initTemplateDB();
      await ensureDefaultTemplates(db);
      const normalizedScope = scope === "panel" ? "panel" : "post";
      const serializedData = serializeTemplateData(normalizedScope);
      const now = new Date().toISOString();

      const templateData = {
        name: templateName.trim(),
        data: serializedData,
        templateScope: normalizedScope,
        variants: [],
        dateCreated: now,
        dateModified: now,
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

  const getTemplateLoadConfirmationMessage = (mode) =>
    mode === "replace-panel"
      ? "Are you sure you want to load this template? THIS WILL REPLACE THE SELECTED PANEL!"
      : "Are you sure you want to load this template? THIS WILL REPLACE YOUR CURRENT POST!";

  const recordTemplateUse = async function (db, template) {
    try {
      await db.saveTemplate({
        ...template,
        dateLastUsed: new Date().toISOString(),
      });
      if (getTemplateSortMode() === "last-used") {
        await refreshTemplatesList();
      }
    } catch (error) {
      console.warn("Unable to update template last-used date", error);
    }
  };

  const loadTemplate = async function (
    templateId,
    mode = "replace-post",
    variantId = "",
    targetPanelIndex = null
  ) {
    if (!templateId) {
      return;
    }

    if (activeTemplateEditor) {
      showTemplateTab("sMTemplateEditor");
      alert("Save or cancel the current template edit before loading another template.");
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
        const newPost = getTemplatePostFromData(template, variantId);
        if (!newPost || !Array.isArray(newPost.panels) || !newPost.panels.length) {
          throw new Error("Template does not contain any panels.");
        }
        setPost(newPost);
        await recordTemplateUse(db, template);
        return;
      }

      const templatePanels = getTemplatePanelsFromData(template, variantId);
      if (!templatePanels.length) {
        throw new Error("Template does not contain any panels.");
      }

      const hasRequestedIndex =
        targetPanelIndex !== null && targetPanelIndex !== undefined;
      const requestedIndex = hasRequestedIndex
        ? Number(targetPanelIndex)
        : Number.NaN;
      const selectedIndex = clamp(
        Number.isInteger(requestedIndex)
          ? requestedIndex
          : currentlySelectedPanelIndex,
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

      currentlySelectedSubPanelIndex = 0;
      currentlySelectedExitTabIndex = 0;
      currentlySelectedNestedExitTabIndex = -1;
      currentlySelectedRowIndex = 0;
      currentlySelectedBlockIndex = 0;
      currentlySelectedAPLArrowIndex = 0;
      resetGroupEditing();
      normalizeEditorSelection();
      formHandler.updateForm();
      redraw();
      await recordTemplateUse(db, template);
    } catch (error) {
      console.error("Error loading template:", error);
      alert("Failed to load template: " + error.message);
    }
  };

  const deleteTemplate = async function (templateId) {
    if (!templateId) {
      return;
    }

    if (activeTemplateEditor) {
      showTemplateTab("sMTemplateEditor");
      alert("Save or cancel the current template edit before deleting a template.");
      return;
    }

    try {
      const db = await initTemplateDB();
      const template = await db.getTemplate(templateId);
      if (template?.isDefault || String(templateId).startsWith("default-")) {
        return;
      }
      await db.deleteTemplate(templateId);
      await refreshTemplatesList();
    } catch (error) {
      console.error("Error deleting template:", error);
      alert("Failed to delete template: " + error.message);
    }
  };

  const renameTemplate = async function (templateId) {
    if (!templateId || String(templateId).startsWith("default-")) {
      return;
    }

    if (activeTemplateEditor) {
      showTemplateTab("sMTemplateEditor");
      alert("Save or cancel the current template edit before renaming a template.");
      return;
    }

    try {
      const db = await initTemplateDB();
      const template = await db.getTemplate(templateId);
      if (!template || template.isDefault) {
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

      await db.updateTemplate(templateId, {
        ...template,
        name: trimmedName,
        dateModified: new Date().toISOString(),
      });
      await refreshTemplatesList();
    } catch (error) {
      console.error("Error renaming template:", error);
      alert("Failed to rename template: " + error.message);
    }
  };

  const getTemplateSearchValue = function () {
    const searchInput = document.getElementById("templateSearchInput");
    return String(searchInput?.value || "").trim().toLowerCase();
  };

  const getTemplateSortMode = function () {
    const sortSelect = document.getElementById("templateSortSelect");
    const sortMode = sortSelect?.value;
    return sortMode === "alphabetical" || sortMode === "last-used"
      ? sortMode
      : "date-created";
  };

  const createTemplateActionButton = (className, icon, label, title) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.title = title || label;

    const iconElement = document.createElement("span");
    iconElement.className = "material-symbols-outlined";
    iconElement.textContent = icon;
    button.appendChild(iconElement);

    if (label) {
      const labelElement = document.createElement("span");
      labelElement.textContent = label;
      button.appendChild(labelElement);
    }
    return button;
  };

  const endTemplatePanelDrag = () => {
    templatePanelDragState = null;
    clearTemplatePanelDropIndicator();
    document
      .querySelectorAll(".templateReplacePanelBtn.templateDragging")
      .forEach((button) => button.classList.remove("templateDragging"));
  };

  const getTemplateEditorFormState = () => ({
    name: String(document.getElementById("templateEditorName")?.value || ""),
    variantName: String(
      document.getElementById("templateEditorVariantName")?.value || ""
    ),
    variantFont: String(
      document.getElementById("templateEditorVariantFont")?.value || ""
    ),
    newVariantName: String(
      document.getElementById("templateNewVariantName")?.value || ""
    ),
    newVariantFont: String(
      document.getElementById("templateNewVariantFont")?.value || ""
    ),
  });

  const applyTemplateEditorFormState = (formState) => {
    if (!formState || typeof formState !== "object") {
      return;
    }

    const valuesById = {
      templateEditorName: formState.name,
      templateEditorVariantName: formState.variantName,
      templateEditorVariantFont: formState.variantFont,
      templateNewVariantName: formState.newVariantName,
      templateNewVariantFont: formState.newVariantFont,
    };
    for (const [id, value] of Object.entries(valuesById)) {
      const input = document.getElementById(id);
      if (input && typeof value === "string") {
        input.value = value;
      }
    }
  };

  const createTemplateEditorSessionState = () => {
    if (!activeTemplateEditor) {
      return null;
    }

    const templatesModal = document.querySelector(".sMModal.templates");
    const selectedTab = ["sMTemplatesSaved", "sMTemplateEditor"].includes(
      templatesModal?.dataset.currentMenu
    )
      ? templatesModal.dataset.currentMenu
      : "sMTemplateEditor";

    return {
      draft: cloneTemplateValue(activeTemplateEditor.draft),
      activeVariantId: String(activeTemplateEditor.activeVariantId || ""),
      editorData: JSON.parse(serializePostWithElementTypes()),
      editorSelection: cloneTemplateValue(getSelectionState()),
      selectedTab,
      modalOpen:
        document.getElementById("sMConfigBar")?.dataset.currentMenu ===
        "templates",
      formState: getTemplateEditorFormState(),
    };
  };

  const restoreTemplateEditorSession = (
    editorSession,
    workspaceData,
    workspaceSelection
  ) => {
    if (!editorSession || typeof editorSession !== "object") {
      throw new Error("Template editor session is invalid.");
    }

    const draft = cloneTemplateValue(editorSession.draft);
    if (!draft || typeof draft !== "object") {
      throw new Error("Template editor draft is missing.");
    }
    draft.templateScope = inferTemplateScope(draft);
    draft.variants = normalizeTemplateVariants(draft);

    const activeVariantId = String(editorSession.activeVariantId || "");
    if (activeVariantId) {
      getTemplateVariant(draft, activeVariantId);
    }

    const editorData = editorSession.editorData;
    if (
      !editorData ||
      typeof editorData !== "object" ||
      !Array.isArray(editorData.panels) ||
      !editorData.panels.length
    ) {
      throw new Error("Template editor canvas is missing.");
    }

    activeTemplateEditor = {
      draft,
      activeVariantId,
      workspaceData: JSON.stringify(workspaceData, null, 2),
      workspaceSelection: cloneTemplateValue(workspaceSelection),
    };

    isSessionPersisting = true;
    try {
      setPost(
        reconstructPostFromData(editorData),
        editorSession.editorSelection
      );
    } finally {
      isSessionPersisting = false;
    }

    updateTemplateEditorControls();
    applyTemplateEditorFormState(editorSession.formState);
    updateTemplateEditorStatus();

    const selectedTab = ["sMTemplatesSaved", "sMTemplateEditor"].includes(
      editorSession.selectedTab
    )
      ? editorSession.selectedTab
      : "sMTemplateEditor";
    showTemplateTab(selectedTab);

    if (editorSession.modalOpen) {
      const configBar = document.getElementById("sMConfigBar");
      if (configBar?.dataset.currentMenu !== "templates") {
        document.getElementById("templates")?.click();
      }
    }
  };

  const updateTemplateEditorStatus = () => {
    const hasEditor = !!activeTemplateEditor;
    const nameInput = document.getElementById("templateEditorName");
    const variantNameInput = document.getElementById(
      "templateEditorVariantName"
    );
    const templateName = hasEditor
      ? String(nameInput?.value || activeTemplateEditor.draft.name || "").trim() ||
        "Untitled Template"
      : "";
    const activeVariant = hasEditor && activeTemplateEditor.activeVariantId
      ? activeTemplateEditor.draft.variants.find(
          (variant) => variant.id === activeTemplateEditor.activeVariantId
        )
      : null;
    const versionName = !hasEditor
      ? ""
      : activeTemplateEditor.activeVariantId
        ? String(variantNameInput?.value || activeVariant?.name || "").trim() ||
          "Missing Variant"
        : "Base";
    const statusText = hasEditor
      ? `Editing “${templateName}” — ${versionName}`
      : "";

    const templatesButtonLabel = document.getElementById(
      "templatesButtonLabel"
    );
    if (templatesButtonLabel) {
      templatesButtonLabel.textContent = hasEditor
        ? "Templates (Editing)"
        : "Templates";
    }

    const templatesButton = document.getElementById("templates");
    if (templatesButton) {
      if (hasEditor) {
        templatesButton.title = statusText;
        templatesButton.setAttribute("aria-label", statusText);
      } else {
        templatesButton.removeAttribute("title");
        templatesButton.removeAttribute("aria-label");
      }
    }

    const editorTab = document.getElementById("sMTemplateEditorTab");
    if (editorTab) {
      editorTab.textContent = hasEditor
        ? "Template Editor (Editing)"
        : "Template Editor";
      editorTab.title = hasEditor ? statusText : "";
    }

    const heading = document.getElementById("templateEditorHeading");
    if (heading) {
      heading.textContent = hasEditor ? statusText : "Template Editor";
    }

    const notice = document.getElementById("templateEditingNotice");
    if (notice) {
      notice.hidden = !hasEditor;
    }
    const noticeText = document.getElementById("templateEditingNoticeText");
    if (noticeText) {
      noticeText.textContent = hasEditor
        ? `${statusText}. Unsaved changes are preserved.`
        : "";
    }

    const saveButton = document.getElementById("templateEditorSaveBtn");
    if (saveButton) {
      const saveLabel = hasEditor
        ? `Save ${templateName} — ${versionName} and exit`
        : "Save template and exit";
      saveButton.title = saveLabel;
      saveButton.setAttribute("aria-label", saveLabel);
    }
  };

  const showTemplateTab = (tabId) => {
    const modal = document.querySelector(".sMModal.templates");
    if (!modal) {
      return;
    }

    modal.dataset.currentMenu = tabId;
    modal.querySelectorAll(":scope > .sMModalContent > div").forEach((holder) => {
      holder.classList.toggle("tabHidden", holder.id !== tabId);
    });
    modal.querySelectorAll(":scope > .sMModalBar .sMModalTab").forEach((tab) => {
      tab.classList.toggle("selected", tab.dataset.tab === tabId);
    });
    updateTemplateEditorStatus();
  };

  const showActiveTemplateEditor = () => {
    if (!activeTemplateEditor) {
      return;
    }
    showTemplateTab("sMTemplateEditor");
    const configBar = document.getElementById("sMConfigBar");
    if (configBar?.dataset.currentMenu !== "templates") {
      document.getElementById("templates")?.click();
    }
    persistSessionState();
  };

  const populateTemplateFontSelect = (select, emptyLabel) => {
    if (!select) {
      return;
    }
    select.innerHTML = "";
    if (emptyLabel) {
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = emptyLabel;
      select.appendChild(emptyOption);
    }
    for (const fontFamily of TextElement.prototype.fontFamily || []) {
      const option = document.createElement("option");
      option.value = fontFamily;
      option.textContent = fontFamily;
      select.appendChild(option);
    }
  };

  const getActiveTemplateEditorVariant = () => {
    if (!activeTemplateEditor?.activeVariantId) {
      return null;
    }
    const variant = activeTemplateEditor.draft.variants.find(
      (variant) => variant.id === activeTemplateEditor.activeVariantId
    );
    if (!variant) {
      throw new Error(
        `The selected template variant "${activeTemplateEditor.activeVariantId}" no longer exists. Base was not changed.`
      );
    }
    return variant;
  };

  const updateTemplateEditorControls = () => {
    const empty = document.getElementById("templateEditorEmpty");
    const form = document.getElementById("templateEditorForm");
    if (!empty || !form) {
      return;
    }

    const hasEditor = !!activeTemplateEditor;
    empty.hidden = hasEditor;
    form.hidden = !hasEditor;
    if (!hasEditor) {
      updateTemplateEditorStatus();
      return;
    }

    const draft = activeTemplateEditor.draft;
    const nameInput = document.getElementById("templateEditorName");
    const scopeLabel = document.getElementById("templateEditorScope");
    const versionSelect = document.getElementById("templateEditorVariantSelect");
    const variantNameInput = document.getElementById("templateEditorVariantName");
    const variantFontSelect = document.getElementById("templateEditorVariantFont");
    const applyFontButton = document.getElementById("templateEditorApplyFont");
    const deleteVariantButton = document.getElementById("templateEditorDeleteVariant");

    nameInput.value = draft.name || "";
    scopeLabel.textContent = draft.templateScope === "post" ? "Post" : "Panel";

    versionSelect.innerHTML = "";
    const baseOption = document.createElement("option");
    baseOption.value = "";
    baseOption.textContent = "Base";
    versionSelect.appendChild(baseOption);
    for (const variant of draft.variants) {
      const option = document.createElement("option");
      option.value = variant.id;
      option.textContent = variant.name;
      versionSelect.appendChild(option);
    }
    versionSelect.value = activeTemplateEditor.activeVariantId || "";

    const activeVariant = getActiveTemplateEditorVariant();
    variantNameInput.disabled = !activeVariant;
    variantNameInput.value = activeVariant?.name || "Base";
    populateTemplateFontSelect(variantFontSelect, "Keep Current Fonts");
    variantFontSelect.disabled = !activeVariant;
    variantFontSelect.value = activeVariant?.fontFamily || "";
    applyFontButton.disabled = !activeVariant;
    deleteVariantButton.disabled = !activeVariant;

    const newVariantFont = document.getElementById("templateNewVariantFont");
    if (newVariantFont && !newVariantFont.options.length) {
      populateTemplateFontSelect(newVariantFont, "Keep Current Fonts");
    }
    updateTemplateEditorStatus();
  };

  const captureActiveTemplateEditorVersion = () => {
    if (!activeTemplateEditor) {
      return;
    }
    if (formHandler && typeof formHandler.readForm === "function") {
      formHandler.readForm();
    }

    const nameInput = document.getElementById("templateEditorName");
    const variantNameInput = document.getElementById("templateEditorVariantName");
    const variantFontSelect = document.getElementById("templateEditorVariantFont");
    const activeVariant = getActiveTemplateEditorVariant();
    activeTemplateEditor.draft.name = String(nameInput?.value || "").trim();
    const serializedData = serializeTemplateData(
      activeTemplateEditor.draft.templateScope
    );
    if (activeVariant) {
      activeVariant.name = String(variantNameInput?.value || activeVariant.name).trim();
      activeVariant.fontFamily = String(variantFontSelect?.value || "");
      activeVariant.data = serializedData;
      activeVariant.dateModified = new Date().toISOString();
    } else {
      activeTemplateEditor.draft.data = serializedData;
    }
  };

  const loadActiveTemplateEditorVersion = () => {
    if (!activeTemplateEditor) {
      return;
    }
    const editorPost = getTemplatePostFromData(
      activeTemplateEditor.draft,
      activeTemplateEditor.activeVariantId
    );
    setPost(editorPost);
  };

  const restoreTemplateEditorWorkspace = () => {
    if (!activeTemplateEditor) {
      return;
    }
    const { workspaceData, workspaceSelection } = activeTemplateEditor;
    activeTemplateEditor = null;
    setPost(
      reconstructPostFromData(JSON.parse(workspaceData)),
      workspaceSelection
    );
    updateTemplateEditorControls();
  };

  const editTemplate = async function (templateId, variantId = "") {
    if (!templateId) {
      return;
    }

    if (activeTemplateEditor) {
      if (!window.confirm("Discard the current template editing session?")) {
        return;
      }
      restoreTemplateEditorWorkspace();
    }

    try {
      if (formHandler && typeof formHandler.readForm === "function") {
        formHandler.readForm();
      }
      const db = await initTemplateDB();
      const template = await db.getTemplate(templateId);
      if (!template) {
        throw new Error("Template not found.");
      }

      const draft = cloneTemplateValue(template);
      draft.templateScope = inferTemplateScope(draft);
      draft.variants = normalizeTemplateVariants(draft);
      const normalizedVariantId = String(variantId || "");
      const requestedVariant = draft.variants.find(
        (variant) => variant.id === normalizedVariantId
      );
      if (normalizedVariantId && !requestedVariant) {
        throw new Error(
          `Template variant "${normalizedVariantId}" no longer exists. Base was not opened.`
        );
      }

      activeTemplateEditor = {
        draft,
        activeVariantId: normalizedVariantId,
        workspaceData: serializePostWithElementTypes(2),
        workspaceSelection: cloneTemplateValue(getSelectionState()),
      };

      updateTemplateEditorControls();
      showTemplateTab("sMTemplateEditor");
      loadActiveTemplateEditorVersion();
    } catch (error) {
      if (activeTemplateEditor) {
        try {
          restoreTemplateEditorWorkspace();
          showTemplateTab("sMTemplatesSaved");
        } catch (restoreError) {
          activeTemplateEditor = null;
          updateTemplateEditorControls();
        }
      }
      console.error("Error opening template editor:", error);
      alert("Failed to open template editor: " + error.message);
    }
  };

  const switchTemplateEditorVariant = function (variantId) {
    if (!activeTemplateEditor) {
      return;
    }
    try {
      captureActiveTemplateEditorVersion();
      const normalizedId = String(variantId || "");
      if (
        normalizedId &&
        !activeTemplateEditor.draft.variants.some(
          (variant) => variant.id === normalizedId
        )
      ) {
        throw new Error(
          `Template variant "${normalizedId}" no longer exists. Base was not selected.`
        );
      }
      activeTemplateEditor.activeVariantId = normalizedId;
      updateTemplateEditorControls();
      loadActiveTemplateEditorVersion();
    } catch (error) {
      updateTemplateEditorControls();
      console.error("Error switching template variant:", error);
      alert("Failed to switch template variant: " + error.message);
    }
  };

  const createTemplateVariantId = () =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? `variant-${crypto.randomUUID()}`
      : `variant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const addTemplateEditorVariant = function () {
    if (!activeTemplateEditor) {
      return;
    }

    const nameInput = document.getElementById("templateNewVariantName");
    const fontSelect = document.getElementById("templateNewVariantFont");
    const variantName = String(nameInput?.value || "").trim();
    if (!variantName) {
      alert("Please enter a variant name");
      return;
    }

    try {
      captureActiveTemplateEditorVersion();
      const sourceVariant = getActiveTemplateEditorVariant();
      const sourceData = sourceVariant?.data || activeTemplateEditor.draft.data;
      const snapshot = normalizeTemplateSnapshot(JSON.parse(sourceData));
      const fontFamily = String(fontSelect?.value || "");
      if (fontFamily) {
        applyFontFamilyToTemplateData(snapshot, fontFamily);
      }

      const variant = {
        id: createTemplateVariantId(),
        name: variantName,
        data: JSON.stringify(snapshot, null, 2),
        fontFamily,
        dateCreated: new Date().toISOString(),
        dateModified: new Date().toISOString(),
      };
      activeTemplateEditor.draft.variants.push(variant);
      activeTemplateEditor.activeVariantId = variant.id;
      if (nameInput) {
        nameInput.value = "";
      }
      if (fontSelect) {
        fontSelect.value = "";
      }
      updateTemplateEditorControls();
      loadActiveTemplateEditorVersion();
    } catch (error) {
      console.error("Error adding template variant:", error);
      alert("Failed to add template variant: " + error.message);
    }
  };

  const applyTemplateEditorFont = function () {
    const variant = getActiveTemplateEditorVariant();
    if (!variant) {
      return;
    }
    const fontSelect = document.getElementById("templateEditorVariantFont");
    const fontFamily = String(fontSelect?.value || "");
    variant.fontFamily = fontFamily;
    if (!fontFamily) {
      return;
    }
    applyFontFamilyToTemplateData(post, fontFamily);
    formHandler.updateForm();
    redraw();
  };

  const deleteTemplateEditorVariant = function () {
    const variant = getActiveTemplateEditorVariant();
    if (!activeTemplateEditor || !variant) {
      return;
    }
    if (!window.confirm(`Delete the "${variant.name}" variant?`)) {
      return;
    }

    activeTemplateEditor.draft.variants = activeTemplateEditor.draft.variants.filter(
      (candidate) => candidate.id !== variant.id
    );
    activeTemplateEditor.activeVariantId = "";
    updateTemplateEditorControls();
    loadActiveTemplateEditorVersion();
  };

  const saveTemplateEditor = async function () {
    if (!activeTemplateEditor) {
      return;
    }

    try {
      captureActiveTemplateEditorVersion();
      if (!activeTemplateEditor.draft.name) {
        alert("Please enter a template name");
        return;
      }

      const db = await initTemplateDB();
      const updatedTemplate = {
        ...activeTemplateEditor.draft,
        variants: activeTemplateEditor.draft.variants,
        dateModified: new Date().toISOString(),
      };
      await db.updateTemplate(updatedTemplate.id, updatedTemplate);
      restoreTemplateEditorWorkspace();
      showTemplateTab("sMTemplatesSaved");
      await refreshTemplatesList();
    } catch (error) {
      console.error("Error saving template:", error);
      alert("Failed to save template: " + error.message);
    }
  };

  const cancelTemplateEditor = function () {
    restoreTemplateEditorWorkspace();
    showTemplateTab("sMTemplatesSaved");
    refreshTemplatesList();
  };

  const refreshTemplatesList = async function () {
    try {
      const db = await initTemplateDB();
      await ensureDefaultTemplates(db);
      let templates = await db.getAllTemplates();

      const templatesList = document.getElementById("savedTemplatesList");
      if (!templatesList) {
        return;
      }

      templatesList.innerHTML = "";

      const warningCheckbox = document.getElementById("templateLoadWarning");
      if (warningCheckbox) {
        warningCheckbox.checked = getTemplateLoadWarningEnabled();
      }

      const searchValue = getTemplateSearchValue();
      if (searchValue) {
        templates = templates.filter((template) => {
          const variantNames = normalizeTemplateVariants(template)
            .map((variant) => variant.name)
            .join(" ");
          return `${template.name || ""} ${variantNames}`
            .toLowerCase()
            .includes(searchValue);
        });
      }

      if (templates.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.className = "templateEmptyMessage";
        emptyMessage.textContent = searchValue
          ? "No templates match your search"
          : "No templates";
        templatesList.appendChild(emptyMessage);
        return;
      }

      const sortMode = getTemplateSortMode();
      templates.sort((a, b) => {
        if (sortMode === "last-used") {
          const dateLastUsedA = Date.parse(a.dateLastUsed || "") || 0;
          const dateLastUsedB = Date.parse(b.dateLastUsed || "") || 0;
          const lastUsedDifference = dateLastUsedB - dateLastUsedA;
          if (lastUsedDifference) {
            return lastUsedDifference;
          }
        }
        const defaultDifference = Number(!!b.isDefault) - Number(!!a.isDefault);
        if (defaultDifference) {
          return defaultDifference;
        }
        if (sortMode === "alphabetical") {
          return String(a.name || "").localeCompare(
            String(b.name || ""),
            undefined,
            { sensitivity: "base", numeric: true }
          );
        }
        const dateA = new Date(a.dateCreated || a.dateModified || 0);
        const dateB = new Date(b.dateCreated || b.dateModified || 0);
        return dateB - dateA;
      });

      templates.forEach((template) => {
        const variants = normalizeTemplateVariants(template);
        const templateItem = document.createElement("div");
        templateItem.className = "templateItem";

        const info = document.createElement("div");
        info.className = "templateItemInfo";
        const nameRow = document.createElement("div");
        nameRow.className = "templateNameRow";
        const name = document.createElement("span");
        name.className = "templateItemName";
        name.textContent = template.name || "Untitled Template";
        nameRow.appendChild(name);

        let variantSelect = null;
        if (variants.length) {
          variantSelect = document.createElement("select");
          variantSelect.className = "templateVariantSelect";
          variantSelect.setAttribute("aria-label", `${template.name} variant`);
          const baseOption = document.createElement("option");
          baseOption.value = "";
          baseOption.textContent = "Base";
          variantSelect.appendChild(baseOption);
          for (const variant of variants) {
            const option = document.createElement("option");
            option.value = variant.id;
            option.textContent = variant.name;
            variantSelect.appendChild(option);
          }
          nameRow.appendChild(variantSelect);
        }

        const selectedVariantId = () => variantSelect?.value || "";
        const editButton = createTemplateActionButton(
          "templateEditBtn",
          "edit",
          "",
          "Edit Template"
        );
        editButton.setAttribute("aria-label", "Edit Template");
        editButton.addEventListener("click", () =>
          editTemplate(template.id, selectedVariantId())
        );
        nameRow.appendChild(editButton);
        if (!template.isDefault && !String(template.id).startsWith("default-")) {
          const renameButton = createTemplateActionButton(
            "templateRenameBtn",
            "edit_note",
            "",
            "Rename Template"
          );
          renameButton.setAttribute("aria-label", "Rename Template");
          renameButton.addEventListener("click", () => renameTemplate(template.id));
          nameRow.appendChild(renameButton);
        }
        info.appendChild(nameRow);

        const metadata = document.createElement("span");
        metadata.className = "templateItemDate";
        const scope = inferTemplateScope(template) === "post" ? "Post" : "Panel";
        metadata.textContent = `${template.isDefault ? "Default · " : ""}${scope} · ${formatDate(
          template.dateModified || template.dateCreated
        )}`;
        info.appendChild(metadata);
        templateItem.appendChild(info);

        const actions = document.createElement("div");
        actions.className = "templateItemActions";
        const replacePostButton = createTemplateActionButton(
          "templateLoadBtn templateLoadPostBtn",
          "upload",
          "Replace Post"
        );
        replacePostButton.addEventListener("click", () =>
          loadTemplate(template.id, "replace-post", selectedVariantId())
        );
        actions.appendChild(replacePostButton);

        const replacePanelButton = createTemplateActionButton(
          "templateLoadBtn templateReplacePanelBtn",
          "move_down",
          "Replace Panel",
          "Replace the selected panel, or drag this button onto a panel"
        );
        replacePanelButton.draggable = true;
        replacePanelButton.addEventListener("click", () =>
          loadTemplate(template.id, "replace-panel", selectedVariantId())
        );
        replacePanelButton.addEventListener("dragstart", (event) => {
          templatePanelDragState = {
            templateId: template.id,
            variantId: selectedVariantId(),
          };
          replacePanelButton.classList.add("templateDragging");
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "copy";
            event.dataTransfer.setData(
              "application/x-signmaker-template",
              JSON.stringify(templatePanelDragState)
            );
            event.dataTransfer.setData("text/plain", template.name || "Template");
          }
        });
        replacePanelButton.addEventListener("dragend", endTemplatePanelDrag);
        actions.appendChild(replacePanelButton);

        const addButton = createTemplateActionButton(
          "templateLoadBtn templateAddBtn",
          "add",
          "Add",
          "Add template after the selected panel"
        );
        addButton.addEventListener("click", () =>
          loadTemplate(template.id, "add", selectedVariantId())
        );
        actions.appendChild(addButton);

        if (!template.isDefault && !String(template.id).startsWith("default-")) {
          const deleteButton = createTemplateActionButton(
            "templateDeleteBtn",
            "delete",
            "",
            "Delete Template"
          );
          deleteButton.setAttribute("aria-label", "Delete Template");
          deleteButton.addEventListener("click", () => deleteTemplate(template.id));
          actions.appendChild(deleteButton);
        }
        templateItem.appendChild(actions);
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
    newPanel: newPanel,
    duplicatePanel: duplicatePanel,
    deletePanel: deletePanel,
    clearAll: clearAll,
    shiftLeft: shiftLeft,
    shiftRight: shiftRight,
    movePanel: movePanel,
    changeEditingPanel: changeEditingPanel,
    setPanelSpacing: setPanelSpacing,
    createStackedPanelAbove: () => createStackedPanel("above"),
    createStackedPanelBelow: () => createStackedPanel("below"),
    setStackedPanelSpacing: setStackedPanelSpacing,
    setStackedPanelMatchWidth: setStackedPanelMatchWidth,
    togglePanelHidden: togglePanelHidden,
    setSignAlignment: setSignAlignment,
    canUseAplEdgeExitTab: canUseAplEdgeExitTab,
    newShield: newShield,
    clearShields: clearShields,
    newSubPanel: addSubPanel,
    removeSubPanel: removeSubPanel,
    changeEditingSubPanel: changeEditingSubPanel,
    moveSubPanel: moveSubPanel,
    duplicateSubPanel: duplicateSubPanel,
    copySignToClipboard: copySignToClipboard,
    copyPanelToClipboard: copyPanelToClipboard,
    openCopyPanelContextMenu: openCopyPanelContextMenu,
    closeCopyPanelContextMenu: closeCopyPanelContextMenu,
    openDownloadPanelContextMenu: openDownloadPanelContextMenu,
    closeDownloadPanelContextMenu: closeDownloadPanelContextMenu,
    downloadCopiedSign: downloadCopiedSign,
    downloadPanelSign: downloadPanelSign,
    downloadSign: downloadSign,
    copyExportSelection: copyExportSelection,
    updatePreview: updatePreview,
    updateFileType: updateFileType,
    setAPLCombineExitOnlyLabels: setAPLCombineExitOnlyLabels,
    resetPadding: resetPadding,
    duplicateControlElem: duplicateControlElem,
    applyTemplate: applyTemplate,
    newExitTab: newExitTab,
    duplicateExitTab: duplicateExitTab,
    removeExitTab: removeExitTab,
    moveExitTab: moveExitTab,
    changeEditingExitTab: changeEditingExitTab,
    newNestExitTab: newNestExitTab,
    deleteNestExitTab: deleteNestExitTab,
    runShortcutAction: runShortcutAction,
    getPost: getPost,
    setPost: setPost,
    undo: undo,
    redo: redo,
    post: post,

    newRow: newRow,
    dupRow: dupRow,
    delRow: delRow,
    newControlElem: newControlElem,
    copyControlElements: copyControlElements,
    cutControlElements: cutControlElements,
    pasteControlElements: pasteControlElements,
    replaceControlElemTypeAt: replaceControlElemTypeAt,
    delControlElem: delControlElem,
    enterGroupElement: enterGroupElement,
    exitGroupElement: exitGroupElement,
    groupSelectedBlockElements: groupSelectedBlockElements,
    ungroupSelectedBlockElement: ungroupSelectedBlockElement,

    saveTemplate: saveTemplate,
    savePanelTemplate: savePanelTemplate,
    savePostTemplate: savePostTemplate,
    loadTemplate: loadTemplate,
    editTemplate: editTemplate,
    renameTemplate: editTemplate,
    showActiveTemplateEditor: showActiveTemplateEditor,
    updateTemplateEditorStatus: updateTemplateEditorStatus,
    switchTemplateEditorVariant: switchTemplateEditorVariant,
    addTemplateEditorVariant: addTemplateEditorVariant,
    applyTemplateEditorFont: applyTemplateEditorFont,
    deleteTemplateEditorVariant: deleteTemplateEditorVariant,
    saveTemplateEditor: saveTemplateEditor,
    cancelTemplateEditor: cancelTemplateEditor,
    deleteTemplate: deleteTemplate,
    refreshTemplatesList: refreshTemplatesList,
    setTemplateLoadWarningEnabled: setTemplateLoadWarningEnabled,

    exposeToFormHandler,
  };
})();
