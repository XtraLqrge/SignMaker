class Panel {
  /**
   * Creates a new Panel consisting of a sign and an exit tab.
   * @param {string} color - Background color of the sign and exit tab.
   * @param {Sign} sign - Sign to make up the panel.
   * @param {String} corner - Choice of Sharp or Rounded Corners on the Panel
   * @param {ExitTab} [exitTab=null] - Optional exit tab to include in the panel.
   */
  constructor(sign, color, exitTabs = [], corner, borderRadius, dms = false) {
    if (Object.keys(lib.colors).includes(color)) {
      this.color = color;
    } else {
      this.color = "Green";
    }
    const availableCornerTypes = Array.isArray(this.cornerType)
      ? this.cornerType
      : ["Sharp", "Round"];
    if (availableCornerTypes.includes(corner)) {
      this.corner = corner;
    } else {
      this.corner = availableCornerTypes.includes(this.defaultCorner)
        ? this.defaultCorner
        : availableCornerTypes[1] || "Round";
    }

    this.sign = sign;
    this.exitTabs = exitTabs;
    // The old dms flag is v2.2's electronic sign; it now loads as a VMS panel.
    Object.assign(this, VmsPanel.settings(), { isVms: !!dms });
    this.borderThickness = 0.2;

    if (typeof borderRadius === "number" && borderRadius >= 0) {
      this.borderRadius = borderRadius;
    } else {
      this.borderRadius = Panel.prototype.defaultBorderRadius;
    }
  }

  newExitTab() {
    const exitTab = new ExitTab();
    exitTab.borderThickness = Panel.getBorderThickness(this);

    this.exitTabs.push(exitTab);
  }

  // v2.19 panel border thickness, 0 to 0.4rem in 0.1rem steps (0.2 is standard).
  static getBorderThickness(panel = {}) {
    if (panel.hideBorder === true && panel.borderThickness == null) return 0;
    const value = parseFloat(panel.borderThickness);
    return Number.isFinite(value) ? Math.round(Math.max(0, Math.min(0.4, value)) * 10) / 10 : 0.2;
  }

  // Exit tabs follow the panel's border thickness when it changes.
  static setBorderThickness(panel, value) {
    panel.borderThickness = Panel.getBorderThickness({ borderThickness: value });
    delete panel.hideBorder;
    const syncTabs = (tabs) => (tabs || []).forEach((tab) => {
      tab.borderThickness = panel.borderThickness;
      syncTabs(tab.nestedExitTabs);
    });
    syncTabs(panel.exitTabs);
  }

  deleteExitTab(index, secondaryIndex) {
    const exitTab = this.exitTabs[index];
    if (!exitTab) {
      return;
    }

    if (
      typeof secondaryIndex === "number" &&
      secondaryIndex > -1 &&
      exitTab.nestedExitTabs &&
      secondaryIndex < exitTab.nestedExitTabs.length
    ) {
      exitTab.nestedExitTabs.splice(secondaryIndex, 1);
      return;
    }

    this.exitTabs.splice(index, 1);
  }

  duplicateExitTab(index) {
    const exisitingTab = this.exitTabs[index];

    const newNest = [];

    const maxNested =
      typeof ExitTab !== "undefined" && ExitTab.prototype.maxNested != null
        ? ExitTab.prototype.maxNested
        : exisitingTab.nestedExitTabs.length;

    for (const nest of exisitingTab.nestedExitTabs) {
      if (newNest.length >= maxNested) {
        break;
      }
      newNest.push(Object.assign(new ExitTab(nest), nest));
    }

    const exitTab = new ExitTab({
      ...exisitingTab,
      nestedExitTabs: newNest,
    });

    this.exitTabs.push(exitTab);
  }
}

/* vvv DO NOT CHANGE THIS, IDK WHY BUT THE ENTIRE PROGRAM BREAKS WITHOUT THIS LINE vvv */
Panel.prototype.cornerType = ["Sharp", "Round"];
/* ^^^ DO NOT CHANGE THIS, IDK WHY BUT THE ENTIRE PROGRAM BREAKS WITHOUT THIS LINE ^^^ */

Panel.prototype.defaultCorner = "Round";
Panel.prototype.defaultBorderRadius = 0.75;

// Applies saved VMS settings, reading v2.2's dms flag as a VMS panel.
Panel.applyVmsData = function (panel, data = {}) {
  Object.assign(panel, VmsPanel.settings(data), {
    isVms: data.isVms === undefined ? !!data.dms : data.isVms === true,
  });
  delete panel.dms;
};
