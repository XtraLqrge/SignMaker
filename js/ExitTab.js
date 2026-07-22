class ExitTab {
  /**
   * Creates a new ExitTab.
   * @param {string} number - Number to display on the exit tab.
   * @param {string} [position=null] - Position to display the exit tab relative to the sign.
   * @param {string} [width=null] - Width of the exit tab (narrow or wide).
   */
    constructor(options = {}) {
      const hasExplicitFontFamily =
        Object.prototype.hasOwnProperty.call(options, "fontFamily") &&
        typeof options.fontFamily === "string" &&
        options.fontFamily.trim().length > 0;
      const hasLegacyFHWAFontChoice =
        Object.prototype.hasOwnProperty.call(options, "FHWAFont") &&
        !hasExplicitFontFamily;

      const {
      number = ExitTab.prototype.defaultText,
      position = ExitTab.prototype.defaultPosition,
      width = ExitTab.prototype.defaultWidth,
      color = ExitTab.prototype.defaultColor,
      variant = ExitTab.prototype.defaultVariant,
      icon = null,
      useTextBasedIcon = false,
      fullBorder = ExitTab.prototype.defaultFullBorder,
      squareCorners = ExitTab.prototype.defaultSquareCorners,
      topOffset = ExitTab.prototype.defaultTopOffset,
      showLeft = ExitTab.prototype.defaultShowLeft,
      borderThickness = ExitTab.prototype.defaultBorderThickness,
      minHeight = ExitTab.prototype.defaultMinHeight,
      nestedExitTabs = [],
      nestedTabSpacing = ExitTab.prototype.defaultNestedTabSpacing,
      FHWAFont = ExitTab.prototype.defaultFHWAFont,
      fontFamily = null,
      fontSize = ExitTab.prototype.defaultFontSize,
      characterSpacing = ExitTab.prototype.defaultCharacterSpacing,
      horizontalPadding = ExitTab.prototype.defaultHorizontalPadding,
      exitTextSizePercent = ExitTab.prototype.defaultExitTextSizePercent,
      exitTextSizePercentVersion = ExitTab.prototype.exitTextSizePercentVersion,
      textColor = ExitTab.prototype.defaultTextColor,
      fullWidthRestoreConfig = null,
      tollLogoOnly = true,
      tollLogoSquare = false,
      tollLogoSize = null,
      assetHorizontalPadding = 0,
      assetVerticalPadding = 0,
      transparent = ExitTab.prototype.defaultTransparent,
      verticalArrangement = ExitTab.prototype.defaultVerticalArrangement,
      caStyle = ExitTab.prototype.defaultCAStyle,
      bilingual = false,
      bilingualTopText = "EXIT",
      bilingualBottomText = "SORTIE"
    } = options;
    this.number = number;
    if (this.positions.includes(position)) {
      this.position = position;
    } else {
      this.position = this.positions[2];
    }
    if (this.widths.includes(width)) {
      this.width = width;
    } else {
      this.width = this.widths[2];
    }
    if (this.colors.includes(color)) {
      this.color = color;
    } else {
      this.color = this.colors[0];
    }

    const normalizedVariant = variant === "Standard" ? "Default" : variant;
    if (this.variants.includes(normalizedVariant)) {
      this.variant = normalizedVariant;
    } else {
      this.variant = this.variants[0];
    }

    this.fullBorder = fullBorder;
    this.squareCorners = squareCorners;
    const parsedBorderThickness =
      typeof borderThickness === "number"
        ? borderThickness
        : parseFloat(borderThickness);
    const fallbackBorderThickness =
      typeof ExitTab.prototype.defaultBorderThickness === "number"
        ? ExitTab.prototype.defaultBorderThickness
        : 0.2;
    this.borderThickness = Number.isFinite(parsedBorderThickness)
      ? Math.max(0, parsedBorderThickness)
      : fallbackBorderThickness;
    this.topOffset = topOffset;
    this.minHeight = minHeight;
    this.nestedExitTabs = nestedExitTabs;
    const parsedNestedTabSpacing =
      typeof nestedTabSpacing === "number"
        ? nestedTabSpacing
        : parseFloat(nestedTabSpacing);
    this.nestedTabSpacing = Number.isFinite(parsedNestedTabSpacing)
      ? Math.max(0, parsedNestedTabSpacing)
      : 0;
    const resolvedFontFamily = (() => {
      const explicitFont = typeof fontFamily === "string" && fontFamily.trim().length
        ? fontFamily.trim()
        : null;
      if (explicitFont) {
        return explicitFont;
      }

      if (!hasLegacyFHWAFontChoice) {
        const defaultFontFamily =
          typeof ExitTab.prototype.defaultFontFamily === "string" &&
          ExitTab.prototype.defaultFontFamily.trim().length
            ? ExitTab.prototype.defaultFontFamily.trim()
            : null;

        if (defaultFontFamily) {
          return defaultFontFamily;
        }
      }

      return FHWAFont === false
        ? (ExitTab.prototype.defaultClearviewFontFamily || "Series 5WR")
        : (ExitTab.prototype.defaultFHWAFontFamily || "Series EEM");
    })();
    this.fontFamily = resolvedFontFamily;
    this.FHWAFont = /^Series\s/i.test(String(resolvedFontFamily || ""));
    this.icon = icon;
    this.showLeft = showLeft;
    this.fontSize = fontSize;
    const parsedCharacterSpacing =
      typeof characterSpacing === "number"
        ? characterSpacing
        : parseFloat(characterSpacing);
    this.characterSpacing = Number.isFinite(parsedCharacterSpacing)
      ? Math.max(-0.15, Math.min(0.25, parsedCharacterSpacing))
      : ExitTab.prototype.defaultCharacterSpacing;
    const parsedHorizontalPadding =
      typeof horizontalPadding === "number"
        ? horizontalPadding
        : parseFloat(horizontalPadding);
    this.horizontalPadding = Number.isFinite(parsedHorizontalPadding)
      ? Math.max(0, Math.min(3, parsedHorizontalPadding))
      : ExitTab.prototype.defaultHorizontalPadding;
    const parsedExitTextSizePercent =
      typeof exitTextSizePercent === "number"
        ? exitTextSizePercent
        : parseFloat(exitTextSizePercent);
    const parsedExitTextSizeVersion = parseInt(exitTextSizePercentVersion, 10);
    const isLegacyExitTextSizePercent =
      parsedExitTextSizeVersion !== ExitTab.prototype.exitTextSizePercentVersion &&
      Number.isFinite(parsedExitTextSizePercent) &&
      (parsedExitTextSizePercent === 100 || parsedExitTextSizePercent === 60);
    this.exitTextSizePercent = isLegacyExitTextSizePercent
      ? ExitTab.prototype.defaultExitTextSizePercent
      : Number.isFinite(parsedExitTextSizePercent)
        ? Math.max(25, Math.min(100, parsedExitTextSizePercent))
        : ExitTab.prototype.defaultExitTextSizePercent;
    this.exitTextSizePercentVersion = ExitTab.prototype.exitTextSizePercentVersion;
    this.textColor = typeof textColor === "string" && textColor.trim().length
      ? textColor.trim()
      : ExitTab.prototype.defaultTextColor;
    this.fullWidthRestoreConfig =
      fullWidthRestoreConfig && typeof fullWidthRestoreConfig === "object"
        ? { ...fullWidthRestoreConfig }
        : null;
    this.verticalArrangement = verticalArrangement;
    this.caStyle = caStyle;
    const defaultTollLogoSize =
      typeof ExitTab.prototype.defaultTollLogoSize === "number"
        ? ExitTab.prototype.defaultTollLogoSize: 3;
    this.tollLogoOnly = !!tollLogoOnly;
    this.tollLogoSquare = !!tollLogoSquare;
    const parsedTollLogoSize =
      typeof tollLogoSize === "number" ? tollLogoSize : parseFloat(tollLogoSize);
    this.tollLogoSize = Number.isFinite(parsedTollLogoSize) && parsedTollLogoSize > 0
      ? parsedTollLogoSize
      : defaultTollLogoSize;
    const parsedAssetHorizontalPadding =
      typeof assetHorizontalPadding === "number"
        ? assetHorizontalPadding
        : parseFloat(assetHorizontalPadding);
    this.assetHorizontalPadding = Number.isFinite(parsedAssetHorizontalPadding)
      ? Math.max(-3, Math.min(3, parsedAssetHorizontalPadding))
      : 0;
    const parsedAssetVerticalPadding =
      typeof assetVerticalPadding === "number"
        ? assetVerticalPadding
        : parseFloat(assetVerticalPadding);
    this.assetVerticalPadding = Number.isFinite(parsedAssetVerticalPadding)
      ? Math.max(-3, Math.min(3, parsedAssetVerticalPadding))
      : 0;
    this.transparent = transparent === true || transparent === "true";
    if (
      Array.isArray(this.nestedExitTabs) &&
      ExitTab.prototype.maxNested != null &&
      this.nestedExitTabs.length > ExitTab.prototype.maxNested
    ) {
      this.nestedExitTabs = this.nestedExitTabs.slice(
        0,
        ExitTab.prototype.maxNested
      );
    }
      this.bilingual = bilingual === true || bilingual === "true";
      this.bilingualTopText =
        typeof bilingualTopText === "string" && bilingualTopText.trim().length
          ? bilingualTopText
          : "EXIT";
      this.bilingualBottomText =
        typeof bilingualBottomText === "string" && bilingualBottomText.trim().length
          ? bilingualBottomText
          : "SORTIE";
  }

  nestExitTab() {
    if (this.nestedExitTabs.length >= ExitTab.prototype.maxNested) {
      return null;
    }
    const exitTab = new ExitTab();
    this.nestedExitTabs.push(exitTab);
    return exitTab;
  }

  deleteNestExitTab(index) {
    this.nestedExitTabs.splice(index, 1);
  }

  duplicateNestExitTab(index) {
    if (this.nestedExitTabs.length >= ExitTab.prototype.maxNested) {
      return null;
    }
    const exisitingTab = this.nestedExitTabs[index];
    if (!exisitingTab) {
      return null;
    }
    const exitTab = new ExitTab({
      number: exisitingTab.number,
      position: exisitingTab.position,
      width: exisitingTab.width,
      color: exisitingTab.color,
      variant: exisitingTab.variant,
      icon: exisitingTab.icon,
      squareCorners: exisitingTab.squareCorners,
      fullBorder: exisitingTab.fullBorder,
      borderThickness: exisitingTab.borderThickness,
      minHeight: exisitingTab.minHeight,
      fontSize: exisitingTab.fontSize,
      fontFamily: exisitingTab.fontFamily,
      characterSpacing: exisitingTab.characterSpacing,
      horizontalPadding: exisitingTab.horizontalPadding,
      exitTextSizePercent: exisitingTab.exitTextSizePercent,
      exitTextSizePercentVersion: exisitingTab.exitTextSizePercentVersion,
      textColor: exisitingTab.textColor,
      fullWidthRestoreConfig: exisitingTab.fullWidthRestoreConfig,
      tollLogoOnly: exisitingTab.tollLogoOnly,
      tollLogoSquare: exisitingTab.tollLogoSquare,
      tollLogoSize: exisitingTab.tollLogoSize,
      assetHorizontalPadding: exisitingTab.assetHorizontalPadding,
      assetVerticalPadding: exisitingTab.assetVerticalPadding,
      transparent: exisitingTab.transparent,
      verticalArrangement: exisitingTab.verticalArrangement,
      caStyle: exisitingTab.caStyle
    });

    this.nestedExitTabs.push(exitTab);
    return exitTab;
  }
}

ExitTab.prototype.positions = ["Left", "Center", "Right"];
ExitTab.prototype.variants = ["Default", "Toll Logo", "Icon", "Full Left", "Stacked", "Quebec Exit Marker"];
ExitTab.prototype.widths = ["Narrow", "Wide", "Full", "Edge", "Out", "Side"];
ExitTab.prototype.defaultBorderThickness = 0.2;
ExitTab.prototype.defaultTollLogoSize = 3;
ExitTab.prototype.defaultIcon = "AIRPORT";
ExitTab.prototype.defaultFullBorder = true;
ExitTab.prototype.defaultSquareCorners = true;
ExitTab.prototype.defaultTopOffset = false;
ExitTab.prototype.defaultFHWAFont = true;
ExitTab.prototype.defaultFontFamily = "Series EEM";
ExitTab.prototype.defaultFHWAFontFamily = "Series EEM";
ExitTab.prototype.defaultClearviewFontFamily = "Series 5WR";
ExitTab.prototype.defaultCharacterSpacing = 0;
ExitTab.prototype.defaultTextColor = "Panel Color";
ExitTab.prototype.exitTextSizePercentVersion = 3;
ExitTab.prototype.defaultVerticalArrangement = false;
ExitTab.prototype.defaultCAStyle = false;
ExitTab.prototype.defaultText = "";
ExitTab.prototype.defaultVariant = "Default";
ExitTab.prototype.defaultPosition = "Right";
ExitTab.prototype.defaultWidth = "Edge";
ExitTab.prototype.defaultColor = "Panel Color";
ExitTab.prototype.defaultShowLeft = false;
ExitTab.prototype.defaultMinHeight = 2;
ExitTab.prototype.defaultNestedTabSpacing = 0;
ExitTab.prototype.defaultFontSize = 18;
ExitTab.prototype.defaultHorizontalPadding = 0;
ExitTab.prototype.defaultTransparent = false;
ExitTab.prototype.defaultExitTextSizePercent = 70;
ExitTab.prototype.colors = (() => {
  const colors = ["Panel Color"];
  if (typeof lib !== "undefined" && lib?.colors) {
    colors.push(...Object.keys(lib.colors));
  } else {
    colors.push(
      "Green",
      "Blue",
      "Brown",
      "Yellow",
      "White",
      "Black",
      "Purple",
      "Orange",
      "Red",
      "Fluorescent Pink",
      "Fluorescent Yellow-Green"
    );
  }
  return colors;
})();
ExitTab.prototype.icons = [
  "Hazardous Materials:HM.png:var(--white):var(--white)",
  "No Hazardous Materials:NO-HM.png:var(--white):var(--white)",
  "Hospital:H.png:var(--blue):var(--white)"
]
ExitTab.prototype.maxNested = 999;

ExitTab.prototype.fontFamilies = (() => {
  if (typeof TextElement !== "undefined" && TextElement.prototype && Array.isArray(TextElement.prototype.fontFamily)) {
    return TextElement.prototype.fontFamily.slice();
  }
  return [
    "Series 5",
    "Series 5WR",
    "Series B",
    "Series C",
    "Series D",
    "Series E",
    "Series EEM",
    "Series EM",
    "Series F",
    "Transport",
    "DIN 1451",
  ];
})();
ExitTab.prototype.textColors = ExitTab.prototype.colors.slice();


ExitTab.prototype.profileFormattingKeys = [
  "variant",
  "position",
  "width",
  "color",
  "borderThickness",
  "minHeight",
  "fontSize",
  "fontFamily",
  "characterSpacing",
  "horizontalPadding",
  "exitTextSizePercent",
  "exitTextSizePercentVersion",
  "textColor",
  "FHWAFont",
  "showLeft",
  "fullBorder",
  "squareCorners",
  "topOffset",
  "verticalArrangement",
  "caStyle",
  "bilingual",
  "bilingualBottomText",
  "icon",
  "useTextBasedIcon",
  "tollLogoOnly",
  "tollLogoSize",
  "tollLogoSquare",
  "assetHorizontalPadding",
  "assetVerticalPadding",
  "transparent",
  "nestedTabSpacing",
];

ExitTab.prototype.getDefaultProfileSettings = function (variant = ExitTab.prototype.defaultVariant) {
  const normalizedVariant = variant === "Standard" ? "Default" : variant;
  const resolvedVariant = ExitTab.prototype.variants.includes(normalizedVariant)
    ? normalizedVariant
    : "Default";
  const isTollLogo = resolvedVariant === "Toll Logo";
  const isIcon = resolvedVariant === "Icon";

  return {
    number: ExitTab.prototype.defaultText,
    variant: resolvedVariant,
    position: ExitTab.prototype.defaultPosition,
    width: ExitTab.prototype.defaultWidth,
    color: ExitTab.prototype.defaultColor,
    borderThickness: ExitTab.prototype.defaultBorderThickness,
    minHeight: 2,
    fontSize: ExitTab.prototype.defaultFontSize,
    fontFamily: ExitTab.prototype.defaultFontFamily || ExitTab.prototype.defaultFHWAFontFamily || "Series EEM",
    characterSpacing: ExitTab.prototype.defaultCharacterSpacing,
    horizontalPadding: ExitTab.prototype.defaultHorizontalPadding,
    exitTextSizePercent: ExitTab.prototype.defaultExitTextSizePercent,
    exitTextSizePercentVersion: ExitTab.prototype.exitTextSizePercentVersion,
    textColor: ExitTab.prototype.defaultTextColor,
    FHWAFont: /^Series\s/i.test(String(ExitTab.prototype.defaultFontFamily || ExitTab.prototype.defaultFHWAFontFamily || "Series EEM")),
    showLeft: ExitTab.prototype.defaultShowLeft,
    fullBorder: ExitTab.prototype.defaultFullBorder,
    squareCorners: ExitTab.prototype.defaultSquareCorners,
    topOffset: ExitTab.prototype.defaultTopOffset,
    verticalArrangement: ExitTab.prototype.defaultVerticalArrangement,
    caStyle: ExitTab.prototype.defaultCAStyle,
    bilingual: false,
    bilingualBottomText: "SORTIE",
    icon: isTollLogo ? "TxTag" : isIcon ? "AIRPORT" : null,
    useTextBasedIcon: false,
    tollLogoOnly: isTollLogo,
    tollLogoSize: ExitTab.prototype.defaultTollLogoSize,
    tollLogoSquare: false,
    assetHorizontalPadding: 0,
    assetVerticalPadding: 0,
    transparent: false,
    nestedTabSpacing: ExitTab.prototype.defaultNestedTabSpacing,
  };
};
