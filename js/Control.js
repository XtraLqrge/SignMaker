// Control.js
const fractionMap = {
  "1/2": "½",
  "1/3": "⅓",
  "2/3": "⅔",
  "1/4": "¼",
  "3/4": "¾",
  "1/5": "⅕",
  "2/5": "⅖",
  "3/5": "⅗",
  "4/5": "⅘",
  "1/6": "⅙",
  "5/6": "⅚",
  "1/7": "⅐",
  "1/8": "⅛",
  "3/8": "⅜",
  "5/8": "⅝",
  "7/8": "⅞",
  "1/9": "⅑",
  "1/10": "⅒",
};
const fractionRegex = new RegExp(Object.keys(fractionMap).join("|"), "g");

class TextElement {
  constructor({
    textContent = "New Sign",
    backgroundColor = "Inherit",
    fontFamily = "Clearview 5WR",
    fontSize = 100,
    useBannerFormatting = false,
    bannerFormattingSize = 100,
    bannerFirstLetterSize = 120,
    useNumeralFormatting = false,
    numeralFormattingSize = 150,
    alignment = "Center",
    lineHeight = 100,
  } = {}) {
    this.textContent = textContent;
    this.fontFamily = fontFamily;
    this.backgroundColor = backgroundColor;
    this.fontSize = fontSize;
    this.useBannerFormatting = useBannerFormatting;
    this.useNumeralFormatting = useNumeralFormatting;
    this.bannerFormattingSize = bannerFormattingSize;
    this.numeralFormattingSize = numeralFormattingSize;
    this.bannerFirstLetterSize = bannerFirstLetterSize;
    this.alignment = alignment;
    this.lineHeight = lineHeight;
  }

  splitString() {
    let result = [this.textContent];
    let tagged = [];

    // Define the banner types to split by if useBannerFormating is true
    const numeralPattern = /(\d+\S*)|([\u00BC-\u00BE]+\S*)/;
    const lightNumeralPattern = new RegExp(
      numeralPattern.source + "|" + Object.values(fractionMap).join("|"),
      "g"
    );

    const bannerPattern = new RegExp(
      `(\\s*)(\\b(?:${Shield.prototype.bannerTypes.join("|")})\\b)(\\s*)`,
      "gi"
    );
    const lightBannerPattern = new RegExp(
      `(\\b(?:${Shield.prototype.bannerTypes.join("|")})\\b)`,
      "gi"
    );

    if (this.useBannerFormatting) {
      result = result[0].split(bannerPattern).filter(Boolean);
    }

    if (this.useNumeralFormatting) {
      let newResult = [];
      for (let i = 0; i < result.length; i++) {
        let currentResult = result[i]
          .split(numeralPattern)
          .filter(Boolean)
          .map((val) =>
            val.replace(fractionRegex, (match) => fractionMap[match])
          );
        newResult = newResult.concat(currentResult);
      }
      result = newResult;
    }

    result = result.map((val) =>
      val.replace(/\\t/g, "\t").replace(/\\n/g, "\n")
    );
    for (let i = 0; i < result.length; i++) {
      let r = result[i];
      if (lightNumeralPattern.test(r) && this.useNumeralFormatting) {
        tagged[i] = { type: "numeral", value: r };
      } else if (lightBannerPattern.test(r) && this.useBannerFormatting) {
        tagged[i] = { type: "banner", value: r };
      } else {
        tagged[i] = { type: "text", value: r };
      }
    }

    return tagged;
  }

  createElement(panel) {
    const newText = document.createElement("div");
    newText.className = "bE-textElement";
    const usesHighwayGothic =
      typeof this.fontFamily === "string" &&
      this.fontFamily.toLowerCase().includes("series");

    // Set custom CSS properties here based off the this. properties
      newText.style.setProperty("--fontFamily", '"' + this.fontFamily + '"');

      const renderedFontSize = getRenderedTextFontSize(
        this.fontSize,
        this.fontFamily
      );

      newText.style.setProperty(
        "--fontSize",
        1.75 * (renderedFontSize / 100) + "rem"
      );

      newText.style.removeProperty("font-size");
    newText.style.setProperty(
      "--blockBgColor",
      this.backgroundColor == "Inherit"
        ? ""
        : (
          lib.colors[this.backgroundColor] || this.backgroundColor
        ).toLowerCase()
    );
    newText.style.setProperty("--alignment", this.alignment);
    newText.style.setProperty("--numeralSize", this.numeralFormattingSize);
    newText.style.setProperty("--bannerSize", this.bannerFormattingSize);
    newText.style.setProperty(
      "--bannerFirstLetterSize",
      this.bannerFirstLetterSize
    );
    newText.style.setProperty("--lineHeight", this.lineHeight);
    if (usesHighwayGothic) {
      newText.style.setProperty(
        "--fhwaBaselineOffset",
        "var(--fhwaBaselineShift)"
      );
    }

    if (
      this.backgroundColor == "Orange" ||
      this.backgroundColor == "White" ||
      this.backgroundColor == "Yellow" ||
      this.backgroundColor == "Fluorescent Yellow-Green"
    ) {
      newText.style.color = "black";
    } else if (this.backgroundColor != "Inherit") {
      newText.style.color = "white";
    }

    let splitTextContent = this.splitString();
    for (let i = 0; i < splitTextContent.length; i++) {
      let text = splitTextContent[i];
      const newTextFragment = document.createElement("span");
      newTextFragment.className = "bE-" + text.type;
      newTextFragment.textContent = text.value;

      newText.appendChild(newTextFragment);
    }

    return newText;
  }
}

TextElement.prototype.fontFamily = [
  "Clearview 1B",
  "Clearview 1W",
  "Clearview 2B",
  "Clearview 2W",
  "Clearview 3B",
  "Clearview 3W",
  "Clearview 4B",
  "Clearview 4W",
  "Clearview 5B",
  "Clearview 5W",
  "Clearview 5WR",
  "Clearview 6B",
  "Clearview 6W",
  "Series B",
  "Series C",
  "Series D",
  "Series E",
  "Series EEM",
  "Series EM",
  "Series F",
  "DIN 1451",
  "Rawlinson Regular",
  "Rawlinson Bold",
  "ITC Stone Sans Regular",
  "ITC Stone Sans Semibold",
  "Helvetica Neue Thin",
  "Helvetica Neue Light",
  "Helvetica Neue Roman",
  "Helvetica Neue Medium",
  "Helvetica Neue Bold",
  "Arial",
  "Arial Bold",
  "Transport",
];

TextElement.prototype.alignment = ["Left", "Center", "Right"];

TextElement.prototype.backgroundColor = ["Inherit"].concat(
  Object.keys(lib.colors)
);

const SETTINGS_DEFAULTS_STORAGE_KEY = "signMaker.settingsDefaults";

const getStoredControlTextDefaults = () => {
  try {
    const raw = window.localStorage.getItem(SETTINGS_DEFAULTS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
};

const getStoredDefaultsOption = (options, optionKey, storedKey, fallbackValue) => {
  if (
    Object.prototype.hasOwnProperty.call(options, optionKey) &&
    options[optionKey] !== undefined &&
    options[optionKey] !== null &&
    options[optionKey] !== ""
  ) {
    return options[optionKey];
  }

  const storedDefaults = getStoredControlTextDefaults();
  const storedValue = storedDefaults[storedKey];

  if (storedValue !== undefined && storedValue !== null && storedValue !== "") {
    return storedValue;
  }

  return fallbackValue;
};

const normalizeStoredDefaultsNumber = (value, fallback = 0) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeStoredDefaultsBoolean = (value) =>
  value === true ||
  value === "true" ||
  value === 1 ||
  value === "1" ||
  value === "on";

const normalizeStoredDefaultsAlignment = (value) => {
  const alignments = Array.isArray(TextElement.prototype.alignment)
    ? TextElement.prototype.alignment
    : ["Left", "Center", "Right"];

  return alignments.includes(value) ? value : "Center";
};

const HIGHWAY_GOTHIC_TEXT_RENDER_SCALE = 1.2;

const isHighwayGothicFontFamily = (fontFamily) =>
  /^Series\s/i.test(String(fontFamily || "")) ||
  String(fontFamily || "") === "Highway Gothic" ||
  String(fontFamily || "") === "Highway Gothic Wide";

const getRenderedTextFontSize = (fontSize, fontFamily) => {
  const parsedSize = parseFloat(fontSize);
  const safeSize = Number.isFinite(parsedSize) ? parsedSize : 100;

  return isHighwayGothicFontFamily(fontFamily)
    ? safeSize * HIGHWAY_GOTHIC_TEXT_RENDER_SCALE
    : safeSize;
};

class ControlTextElement extends TextElement {
    constructor(options = {}) {
      const resolvedOptions = { ...options };

      const availableFonts =
        TextElement && TextElement.prototype
          ? TextElement.prototype.fontFamily
          : [];

      const storedOrFallbackFont = getStoredDefaultsOption(
        resolvedOptions,
        "fontFamily",
        "settingsDefaultsControlTextFont",
        typeof ControlTextElement.getDefaultFont === "function"
          ? ControlTextElement.getDefaultFont()
          : ControlTextElement.defaultFont
      );

      const resolvedFont =
        Array.isArray(availableFonts) && availableFonts.includes(storedOrFallbackFont)
          ? storedOrFallbackFont
          : (typeof ControlTextElement.getDefaultFont === "function"
              ? ControlTextElement.getDefaultFont()
              : ControlTextElement.defaultFont);

      resolvedOptions.textContent = getStoredDefaultsOption(
        resolvedOptions,
        "textContent",
        "settingsDefaultsControlTextText",
        "Control"
      );

      resolvedOptions.fontFamily = resolvedFont;

      resolvedOptions.fontSize = parseFloat(
        getStoredDefaultsOption(
          resolvedOptions,
          "fontSize",
          "settingsDefaultsControlTextSize",
          100
        )
      );

      resolvedOptions.backgroundColor = getStoredDefaultsOption(
        resolvedOptions,
        "backgroundColor",
        "settingsDefaultsControlTextBg",
        "Inherit"
      );

      const spacing = Object.prototype.hasOwnProperty.call(options, "spacing")
        ? options.spacing
        : 0;

      const smallCapitals = Object.prototype.hasOwnProperty.call(options, "smallCapitals")
        ? options.smallCapitals
        : false;

      const textColor = getStoredDefaultsOption(
        resolvedOptions,
        "textColor",
        "settingsDefaultsControlTextColor",
        ControlTextElement.defaultTextColor
      );

      super(resolvedOptions);

      this.spacing = spacing;
      this.smallCapitals = smallCapitals;
      this.textColor =
        typeof textColor === "string" && textColor.trim().length
          ? textColor
          : ControlTextElement.defaultTextColor;
    }

  createElement(panel) {
    const newText = super.createElement(panel);
    newText.style.setProperty("--spacing", this.spacing + "rem");
    newText.style.fontVariant = this.smallCapitals ? "small-caps" : "normal";
    newText.classList.add("bE-controlTextElement");

    const shouldOverrideTextColor =
      typeof this.textColor === "string" &&
      this.textColor.trim().length > 0 &&
      this.textColor !== ControlTextElement.defaultTextColor;
    if (shouldOverrideTextColor) {
      const resolvedTextColor =
        (lib?.colors && lib.colors[this.textColor]) || this.textColor;
      if (typeof resolvedTextColor === "string") {
        newText.style.color = resolvedTextColor.toLowerCase();
      } else if (resolvedTextColor) {
        newText.style.color = resolvedTextColor;
      }
    }

    return newText;
  }
}

ControlTextElement.defaultFont = TextElement.prototype.fontFamily.includes(
  "Clearview 5WR"
)
  ? "Clearview 5WR"
  : TextElement.prototype.fontFamily[0];

ControlTextElement.getDefaultFont = function () {
  const availableFonts = TextElement.prototype.fontFamily;
  const currentDefault = ControlTextElement.defaultFont || availableFonts[0];
  return availableFonts.includes(currentDefault)
    ? currentDefault
    : availableFonts[0];
};

ControlTextElement.setDefaultFont = function (font) {
  const availableFonts = TextElement.prototype.fontFamily;
  if (!font || !availableFonts.includes(font)) {
    return false;
  }
  ControlTextElement.defaultFont = font;
  return true;
};

ControlTextElement.defaultTextColor = "Match BG";
ControlTextElement.getTextColorOptions = function () {
  const palette = Object.keys(lib.colors);
  const options = [ControlTextElement.defaultTextColor];
  for (const color of palette) {
    if (!options.includes(color)) {
      options.push(color);
    }
  }
  return options;
};

class ActionMessageElement extends TextElement {
  constructor(options = {}) {
    const resolvedOptions = { ...options };

    const availableFonts =
      TextElement && TextElement.prototype
        ? TextElement.prototype.fontFamily
        : [];

    const storedOrFallbackFont = getStoredDefaultsOption(
      resolvedOptions,
      "fontFamily",
      "settingsDefaultsActionFont",
      "Clearview 5WR"
    );

    const resolvedFont =
      Array.isArray(availableFonts) && availableFonts.includes(storedOrFallbackFont)
        ? storedOrFallbackFont
        : "Clearview 5WR";

    resolvedOptions.textContent = getStoredDefaultsOption(
      resolvedOptions,
      "textContent",
      "settingsDefaultsActionText",
      "Action"
    );

    resolvedOptions.fontFamily = resolvedFont;

    resolvedOptions.fontSize = parseFloat(
      getStoredDefaultsOption(
        resolvedOptions,
        "fontSize",
        "settingsDefaultsActionSize",
        70
      )
    );

    resolvedOptions.backgroundColor = getStoredDefaultsOption(
      resolvedOptions,
      "backgroundColor",
      "settingsDefaultsActionBg",
      "Inherit"
    );

    const textColor = getStoredDefaultsOption(
      resolvedOptions,
      "textColor",
      "settingsDefaultsActionColor",
      ControlTextElement.defaultTextColor
    );

    const useNumeralFormatting = Object.prototype.hasOwnProperty.call(
      resolvedOptions,
      "useNumeralFormatting"
    )
      ? resolvedOptions.useNumeralFormatting
      : true;

    super(resolvedOptions);

    this.useNumeralFormatting = useNumeralFormatting;
    this.textColor =
      typeof textColor === "string" && textColor.trim().length
        ? textColor
        : ControlTextElement.defaultTextColor;
  }

  createElement(panel) {
    const newText = super.createElement(panel);

    const shouldOverrideTextColor =
      typeof this.textColor === "string" &&
      this.textColor.trim().length > 0 &&
      this.textColor !== ControlTextElement.defaultTextColor;

    if (shouldOverrideTextColor) {
      const resolvedTextColor =
        (lib?.colors && lib.colors[this.textColor]) || this.textColor;
      if (typeof resolvedTextColor === "string") {
        newText.style.color = resolvedTextColor.toLowerCase();
      } else if (resolvedTextColor) {
        newText.style.color = resolvedTextColor;
      }
    }

    return newText;
  }
}

class AdvisoryMessageElement extends TextElement {
  constructor(options = {}) {
    const resolvedOptions = { ...options };

    const availableFonts =
      TextElement && TextElement.prototype
        ? TextElement.prototype.fontFamily
        : [];

    const storedOrFallbackFont = getStoredDefaultsOption(
      resolvedOptions,
      "fontFamily",
      "settingsDefaultsAdvisoryFont",
      "Series E"
    );

    const resolvedFont =
      Array.isArray(availableFonts) && availableFonts.includes(storedOrFallbackFont)
        ? storedOrFallbackFont
        : "Series E";

    resolvedOptions.textContent = getStoredDefaultsOption(
      resolvedOptions,
      "textContent",
      "settingsDefaultsAdvisoryText",
      "Advisory"
    );

    resolvedOptions.fontFamily = resolvedFont;

    resolvedOptions.fontSize = parseFloat(
      getStoredDefaultsOption(
        resolvedOptions,
        "fontSize",
        "settingsDefaultsAdvisorySize",
        70
      )
    );

    resolvedOptions.backgroundColor = getStoredDefaultsOption(
      resolvedOptions,
      "backgroundColor",
      "settingsDefaultsAdvisoryBg",
      "Yellow"
    );

    const textColor = getStoredDefaultsOption(
      resolvedOptions,
      "textColor",
      "settingsDefaultsAdvisoryColor",
      "Black"
    );

    const borderRadius = Object.prototype.hasOwnProperty.call(resolvedOptions, "borderRadius")
      ? resolvedOptions.borderRadius
      : 4;

    const useNumeralFormatting = Object.prototype.hasOwnProperty.call(
      resolvedOptions,
      "useNumeralFormatting"
    )
      ? resolvedOptions.useNumeralFormatting
      : true;

    const horizPadding = Object.prototype.hasOwnProperty.call(resolvedOptions, "horizPadding")
      ? resolvedOptions.horizPadding
      : 0.3;

    const vertPadding = Object.prototype.hasOwnProperty.call(resolvedOptions, "vertPadding")
      ? resolvedOptions.vertPadding
      : 0.3;

    super(resolvedOptions);

    this.textColor =
      typeof textColor === "string" && textColor.trim().length
        ? textColor
        : ControlTextElement.defaultTextColor;
    this.borderRadius = borderRadius;
    this.useNumeralFormatting = useNumeralFormatting;
    this.horizPadding = horizPadding;
    this.vertPadding = vertPadding;
  }

  createElement(panel) {
    const newText = super.createElement(panel);
    newText.style.setProperty("--borderRadius", this.borderRadius + "px");
    newText.style.setProperty("--horizPadding", this.horizPadding);
    newText.style.setProperty("--vertPadding", this.vertPadding);
    newText.className = "bE-textElement bE-advisoryMessage";

    const shouldOverrideTextColor =
      typeof this.textColor === "string" &&
      this.textColor.trim().length > 0 &&
      this.textColor !== ControlTextElement.defaultTextColor;

    if (shouldOverrideTextColor) {
      const resolvedTextColor =
        (lib?.colors && lib.colors[this.textColor]) || this.textColor;
      if (typeof resolvedTextColor === "string") {
        newText.style.color = resolvedTextColor.toLowerCase();
      } else if (resolvedTextColor) {
        newText.style.color = resolvedTextColor;
      }
    }

    if (this.fontFamily.includes("Series")) {
      newText.classList.add("hgFix");
    }

    return newText;
  }
}

class ElectronicSignElement extends TextElement {
  constructor({
    fontFamily = "Electronic Highway Sign",
    textColor = "Orange",
    padding = 0.5,
    glow = true,
    setWidth = 0,
  } = {}) {
    super();
    this.fontFamily = fontFamily;
    this.textColor = textColor;
    this.backgroundColor = "Black";
    this.useNumeralFormatting = false;
    this.useBannerFormatting = false;
    this.padding = padding;
    this.glow = glow;
    this.setWidth = setWidth;
  }

  createElement(panel) {
    const newText = super.createElement(panel);
    newText.className = "bE-textElement bE-electronicSign";
    newText.style.setProperty(
      "--textColor",
      (lib.colors[this.textColor] || this.textColor).toLowerCase()
    );
    newText.style.setProperty("--padding", this.padding + "rem");
    newText.style.setProperty(
      "--textShadow",
      this.glow
        ? "0 0 0.25rem var(--textColor), 0 0 0.25rem var(--textColor)"
        : ""
    );
    newText.style.width = this.setWidth != 0 ? this.setWidth + "rem" : "";

    if (
      this.fontFamily.includes("Series") ||
      this.fontFamily.includes("Electronic")
    ) {
      newText.classList.add("hgFix");
    }

    return newText;
  }
}
ElectronicSignElement.prototype.fontFamily =
  TextElement.prototype.fontFamily.concat([
    "Electronic Highway Sign",
    "Modern VMS",
  ]);
ElectronicSignElement.prototype.textColors = [
  "Orange",
  "White",
  "Yellow",
  "Red",
];

const getCustomShieldMakerDisplayNumber = (value, fallback = 0) => {
  const parsed = parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getCustomShieldMakerDisplayEm = (value, fallback = 0) => {
  return getCustomShieldMakerDisplayNumber(value, fallback) / 100 + "em";
};

const getCustomShieldMakerCssColor = (colorNameOrValue) => {
  const rawColor = String(colorNameOrValue || "Black").trim();
  return (lib.colors && lib.colors[rawColor] ? lib.colors[rawColor] : rawColor).toLowerCase();
};

const applyCustomShieldMakerRouteStyle = (routeEl, config) => {
  if (!routeEl || !config?.customRouteStyle) {
    return;
  }

  const style = config.customRouteStyle || {};
  const anchor = config.customAnchor || style.anchor || {
    x: 50,
    y: 50,
    seedTop: getCustomShieldMakerDisplayNumber(style.topOffset, 0),
    seedHorizontal: getCustomShieldMakerDisplayNumber(style.horizontalOffset, 0),
  };

  const alignment = String(style.alignment || "center").toLowerCase();
  const anchorX =
    alignment === "left"
      ? 0
      : alignment === "right"
        ? 100
        : getCustomShieldMakerDisplayNumber(anchor.x, 50);

  const translateX =
    alignment === "left" ? "0%" : alignment === "right" ? "-100%" : "-50%";

  const topDisplay = getCustomShieldMakerDisplayNumber(style.topOffset, 0);
  const horizontalDisplay = getCustomShieldMakerDisplayNumber(
    style.horizontalOffset,
    0
  );
  const seedTop = getCustomShieldMakerDisplayNumber(anchor.seedTop, topDisplay);
  const seedHorizontal = getCustomShieldMakerDisplayNumber(
    anchor.seedHorizontal,
    horizontalDisplay
  );
  const requestedWeight = getCustomShieldMakerDisplayNumber(style.fontWeight, 10) / 10;
  const cssWeight = Math.min(1000, Math.max(1, requestedWeight));

  routeEl.style.color = getCustomShieldMakerCssColor(style.color);
  routeEl.style.fontFamily = `"${style.fontFamily || "Series D"}", sans-serif`;
  routeEl.style.fontSize = getCustomShieldMakerDisplayEm(style.fontSize, 220);
  routeEl.style.fontWeight = String(cssWeight);
  routeEl.style.fontVariationSettings = `"wght" ${requestedWeight}`;
  routeEl.style.letterSpacing = "0";
  routeEl.style.gap = getCustomShieldMakerDisplayEm(style.letterSpacing, 0);
  routeEl.style.position = "absolute";
  routeEl.style.display = "inline-flex";
  routeEl.style.alignItems = "center";
  routeEl.style.justifyContent =
    alignment === "left" ? "flex-start" : alignment === "right" ? "flex-end" : "center";
  routeEl.style.width = "max-content";
  routeEl.style.top = `calc(${getCustomShieldMakerDisplayNumber(anchor.y, 50)}% + ${
    (topDisplay - seedTop) / 100
  }em)`;
  routeEl.style.left = `calc(${anchorX}% + ${(horizontalDisplay - seedHorizontal) / 100}em)`;
  routeEl.style.right = "auto";
  routeEl.style.transform = `translate(${translateX}, -50%)`;
  routeEl.style.margin = "0";
  routeEl.style.lineHeight = "1";
  routeEl.style.whiteSpace = "nowrap";
  routeEl.style.textAlign = alignment;
};

// TEMP: Block-specific shield support will be replaced when the main shield
// system is integrated. Please treat this class as a stop-gap.
class ShieldElement extends Shield {
  constructor({
    shieldBase,
    shieldType,
    routeNumber = "1",
    type,
    specialBannerType,
    to = false,
    alignment = "Center",
    bannerType = ShieldElement.prototype.defaultBannerType,
    bannerType2 = ShieldElement.prototype.defaultBannerType,
    roadName = "",
    bannerPosition = ShieldElement.prototype.defaultBannerPosition,
    bannerPosition2 = ShieldElement.prototype.defaultBannerPosition,
    indentFirstLetter = true,
    indentFirstLetter2 = undefined,
    smallCaps = true,
    smallCaps2 = undefined,
    fontSize,
    bannerFontFamily = ShieldElement.prototype.defaultBannerFontFamily,
    countyText = "",
    shieldSize,
    scaleBannersWithShield = ShieldElement.prototype.defaultScaleBannersWithShield,
    size,
  } = {}) {
    super();
      const resolvedBase = getStoredDefaultsOption(
        { shieldBase, type },
        "shieldBase",
        "settingsDefaultsShieldType",
        ShieldElement.prototype.defaultShieldBase
      );

      const resolvedVariant =
        shieldType || specialBannerType || ShieldElement.prototype.defaultVariant;

      this.shieldBase = resolvedBase;
      this.shieldType = resolvedVariant;

      this.routeNumber = `${getStoredDefaultsOption(
        { routeNumber },
        "routeNumber",
        "settingsDefaultsShieldRouteNumber",
        ShieldElement.prototype.defaultRouteNumber
      ) ?? ""}`.trim() || ShieldElement.prototype.defaultRouteNumber;

      this.to = !!to;
      this.alignment =
        TextElement.prototype.alignment.includes(alignment) ? alignment : "Center";
      this.indentFirstLetter = indentFirstLetter !== false;
      const normalizedIndentSecond =
        indentFirstLetter2 !== undefined ? indentFirstLetter2 : indentFirstLetter;
      this.indentFirstLetter2 = normalizedIndentSecond !== false;
      this.smallCaps = smallCaps !== false;
      const normalizedSmallCapsSecond =
        smallCaps2 !== undefined ? smallCaps2 : smallCaps;
      this.smallCaps2 = normalizedSmallCapsSecond !== false;
      this.bannerType = ShieldElement.prototype.normalizeBannerType(bannerType);
      this.bannerType2 = ShieldElement.prototype.normalizeBannerType(bannerType2);
      this.roadName = typeof roadName === "string" ? roadName : "";

      const defaultBannerPosition1 = getStoredDefaultsOption(
        { bannerPosition },
        "bannerPosition",
        "settingsDefaultsShieldBanner1",
        ShieldElement.prototype.defaultBannerPosition
      );

      const defaultBannerPosition2 = getStoredDefaultsOption(
        { bannerPosition2 },
        "bannerPosition2",
        "settingsDefaultsShieldBanner2",
        ShieldElement.prototype.defaultBannerPosition2 ||
          ShieldElement.prototype.defaultBannerPosition
      );

      this.bannerPosition = ShieldElement.prototype.normalizeBannerPosition(
        defaultBannerPosition1
      );
      this.bannerPosition2 = ShieldElement.prototype.normalizeBannerPosition(
        defaultBannerPosition2
      );
      this.bannerFontFamily =
        ShieldElement.prototype.normalizeBannerFontFamily(bannerFontFamily);
      this.fontSize = ShieldElement.prototype.normalizeFontSize(
        fontSize,
        ShieldElement.prototype.getDefaultBannerFontSizeForFont(this.bannerFontFamily)
      );
      this.countyText = typeof countyText === "string" ? countyText : "";

      const storedShieldSize = getStoredDefaultsOption(
        { shieldSize, size },
        "shieldSize",
        "settingsDefaultsShieldSize",
        ShieldElement.prototype.defaultShieldSize
      );

      this.shieldSize = ShieldElement.prototype.normalizeShieldSize(storedShieldSize);
      this.scaleBannersWithShield = scaleBannersWithShield !== false;
    this.scaleBannersWithShield = scaleBannersWithShield !== false;

    // Legacy properties used by older save data and helpers
    this.type = resolvedBase;
    this.specialBannerType = "None";
  }

  createElement() {
    const wrapper = document.createElement("div");
    wrapper.className = "bE-shieldElement";

    if (this.to) {
      const toEl = document.createElement("p");
      toEl.className = "to";
      toEl.textContent = "TO";
      toEl.style.display = "inline";
      wrapper.appendChild(toEl);
    }

    const config = ShieldElement.prototype.getBlockShieldConfig(
      this.shieldBase
    );
    const normalizedRoute = `${this.routeNumber ?? ""}`.trim();
    const routeText = normalizedRoute;
    const variant = ShieldElement.prototype.resolveBlockVariant(
      this.shieldType,
      routeText,
      config
    );
    const variantKey = ShieldElement.prototype.formatVariantKey(variant);
    const shieldPath = ShieldElement.prototype.getShieldAssetPath(
      config,
      variantKey
    );
    const normalizedShieldSize = ShieldElement.prototype.normalizeShieldSize(
      this.shieldSize
    );
    const shieldScale =
      ShieldElement.prototype.getShieldScale(normalizedShieldSize);
    const bannerScale = this.scaleBannersWithShield ? shieldScale : 1;
    const fontSizeCss = ShieldElement.prototype.getFontSizeCss(this.fontSize);
    const bannerFontFamily =
      ShieldElement.prototype.normalizeBannerFontFamily(this.bannerFontFamily);
    wrapper.style.setProperty("--shieldScale", shieldScale.toString());
    wrapper.style.setProperty(
      "--shieldSize",
      normalizedShieldSize + "rem"
    );
    wrapper.style.setProperty("--bannerScale", bannerScale.toString());

    const shieldContainer = document.createElement("div");
    const containerClass = config.className || config.value;
    shieldContainer.className = `bannerShieldContainer ${containerClass}`;
    if (config?.customShieldMaker) {
      shieldContainer.classList.add("customShieldMakerRenderedContainer");
    }
    const containerSizeClass = ShieldElement.prototype.getContainerSizeClass(
      routeText, variant
    );
    if (containerSizeClass) {
      shieldContainer.classList.add(containerSizeClass);
    }
      
      const routeTextForFontCheck = String(this.routeNumber || "").trim();

      const routeCharCountForFontCheck =
        ShieldElement.prototype.getRouteCharacterCount(routeTextForFontCheck);

      const routeHasOneForFontCheck = routeTextForFontCheck.includes("1");

      const getsSeriesCWhenThreeCharsWithoutOne =
        SERIES_C_THREE_CHAR_NO_ONE_SHIELDS.some((shieldClass) =>
          shieldContainer.classList.contains(shieldClass)
        ) &&
        routeCharCountForFontCheck === 3 &&
        !routeHasOneForFontCheck;

      const getsSeriesDWhenThreeCharsWithOne =
        SERIES_D_THREE_CHAR_WITH_ONE_SHIELDS.some((shieldClass) =>
          shieldContainer.classList.contains(shieldClass)
        ) &&
        routeCharCountForFontCheck === 3 &&
        routeHasOneForFontCheck;

      shieldContainer.classList.toggle(
        "threeNoOne",
        getsSeriesCWhenThreeCharsWithoutOne
      );

      shieldContainer.classList.toggle(
        "threeWithOne",
        getsSeriesDWhenThreeCharsWithOne
      );


      const hasBannerA = ShieldElement.prototype.hasBannerValue(this.bannerType);
      const hasBannerB = ShieldElement.prototype.hasBannerValue(this.bannerType2);
      const hasRoadName = String(this.roadName || "").trim().length > 0;

      const normalizedBannerPosition =
        ShieldElement.prototype.normalizeBannerPosition(this.bannerPosition);
      const normalizedBannerPosition2 =
        ShieldElement.prototype.normalizeBannerPosition(this.bannerPosition2);

      const roadNamePosition = hasBannerA
        ? normalizedBannerPosition
        : hasBannerB
          ? normalizedBannerPosition2
          : normalizedBannerPosition;

      const bannerItems = [];

      if (hasBannerA) {
        bannerItems.push({
          position: normalizedBannerPosition,
          bannerClass: "bannerA",
          bannerValue: this.bannerType,
          containerClass: "bannerContainer",
          indentFirstLetter: this.indentFirstLetter,
          smallCaps: this.smallCaps,
        });
      }

      if (hasBannerB) {
        bannerItems.push({
          position: normalizedBannerPosition2,
          bannerClass: "bannerB",
          bannerValue: this.bannerType2,
          containerClass: "bannerContainer2",
          indentFirstLetter: this.indentFirstLetter2,
          smallCaps: this.smallCaps2,
        });
      }

      if (hasRoadName) {
        bannerItems.push({
          position: roadNamePosition,
          bannerClass: "bannerRoadName",
          bannerValue: String(this.roadName || "").trim(),
          containerClass: "roadNameBannerContainer",
          indentFirstLetter: false,
          smallCaps: false,
          isRoadName: true,
        });
      }

      const bannerPositions = [
        ...new Set(bannerItems.map((item) => item.position)),
      ];

      for (const position of bannerPositions) {
        const itemsForPosition = bannerItems.filter(
          (item) => item.position === position
        );

        if (!itemsForPosition.length) {
          continue;
        }

        if (
          itemsForPosition.length > 1 ||
          itemsForPosition.some((item) => item.isRoadName)
        ) {
          const stackedBannerSlot =
            ShieldElement.prototype.createStackedBannerSlot(
              position,
              itemsForPosition.map(({ position, isRoadName, ...item }) => item),
              fontSizeCss,
              this.indentFirstLetter,
              bannerFontFamily,
              this.smallCaps
            );

          if (itemsForPosition.some((item) => item.isRoadName)) {
            stackedBannerSlot.classList.add("roadNameStackedBanner");
          }

          shieldContainer.appendChild(stackedBannerSlot);
          continue;
        }

        const item = itemsForPosition[0];

        const bannerContainerElmt = ShieldElement.prototype.createBannerContainer(
          item.containerClass,
          item.bannerClass,
          item.bannerValue,
          fontSizeCss,
          item.indentFirstLetter,
          bannerFontFamily,
          false,
          position,
          item.smallCaps
        );

        shieldContainer.appendChild(bannerContainerElmt);
      }

    const shieldEl = document.createElement("div");
    shieldEl.className = "shield";

    const img = document.createElement("img");
    img.className = "shieldImg";
    const imageSizeClass = ShieldElement.prototype.getImageSizeClass(routeText, variant);
    if (imageSizeClass) {
      img.classList.add(imageSizeClass);
    }
    img.src = shieldPath;
    img.alt = `${config.label} shield`;
    img.loading = "lazy";
    img.decoding = "async";
    img.draggable = false;
    shieldEl.appendChild(img);

      const routeEl = document.createElement("p");
      routeEl.className = "routeNumber";
      routeEl.innerHTML = String(routeText || "")
        .split("")
        .map((char) => {
          const safeChar = char
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");

          const charClass = /^[0-9A-Za-z]$/.test(char)
            ? ` routeChar-${char.toUpperCase()}`
            : "";

          return `<span class="routeChar${charClass}">${safeChar}</span>`;
        })
        .join("");

      if (config?.customShieldMaker) {
        applyCustomShieldMakerRouteStyle(routeEl, config);
      }

      if (ShieldElement.prototype.isCountyShield(config)) {
        const countyLabel = document.createElement("p");
        countyLabel.className = "countyLabel";
        countyLabel.textContent = (this.countyText || "").trim().toUpperCase();
        if (countyLabel.textContent.length > 0) {
          shieldEl.appendChild(countyLabel);
        }
      }

      if (!config?.suppressRouteNumber) {
        shieldEl.appendChild(routeEl);
      }

      shieldContainer.appendChild(shieldEl);

      requestAnimationFrame(() => {
        const fontFamily = window.getComputedStyle(routeEl).fontFamily || "";
        const usesSeriesD = fontFamily.toLowerCase().includes("series d");

        shieldContainer.classList.toggle("seriesDSpacingFix", usesSeriesD);
      });

      if (!hasBannerA && !hasBannerB && !hasRoadName) {
        shieldContainer.classList.add("noBanners");
      }

    wrapper.appendChild(shieldContainer);

    return wrapper;
  }
}

const SERIES_C_THREE_CHAR_NO_ONE_SHIELDS = ["US", "USCA", "AZ", "AZLOOP", "CA", "CO", "HI", "IN", "MB", "MD", "ME", "MN", "MNBUS", "SC", "WI", "WY"];
const SERIES_D_THREE_CHAR_WITH_ONE_SHIELDS = ["US", "USCA", "AZ", "AZLOOP", "CA", "CO", "HI", "IN", "MB", "MD", "ME", "MN", "MNBUS", "SC", "WI", "WY"];

ShieldElement.prototype.defaultShieldBase = "I";
ShieldElement.prototype.defaultVariant = "Auto";
ShieldElement.prototype.defaultRouteNumber = "1";
ShieldElement.prototype.defaultBannerType = "None";
ShieldElement.prototype.defaultBannerPosition = "Right";
ShieldElement.prototype.defaultBannerPosition2 = "Above";
ShieldElement.prototype.defaultHighwayGothicBannerFontSize = 1.6;
ShieldElement.prototype.defaultNonHighwayGothicBannerFontSize = 1.4;
ShieldElement.prototype.defaultBannerFontSize =
  ShieldElement.prototype.defaultHighwayGothicBannerFontSize;
ShieldElement.prototype.defaultBannerFontFamily = "Series E";

ShieldElement.prototype.isHighwayGothicBannerFont = function (fontFamily) {
  return /^Series\b/i.test(String(fontFamily || ""));
};

ShieldElement.prototype.getDefaultBannerFontSizeForFont = function (fontFamily) {
  return ShieldElement.prototype.isHighwayGothicBannerFont(fontFamily)
    ? ShieldElement.prototype.defaultHighwayGothicBannerFontSize
    : ShieldElement.prototype.defaultNonHighwayGothicBannerFontSize;
};
ShieldElement.prototype.defaultCountyText = "";
ShieldElement.prototype.defaultShieldSize = 3;
ShieldElement.prototype.defaultScaleBannersWithShield = true;

ShieldElement.prototype.normalizeShieldCode = function (code) {
  if (typeof code !== "string") {
    return "";
  }
  return code.replace(/\s+/g, "").replace(/2nd$/i, "2");
};

ShieldElement.prototype.formatVariantKey = function (variant) {
  if (typeof variant !== "string") {
    return "";
  }
  return variant.replace(/\s+/g, "");
};

ShieldElement.prototype.getShieldClassNames = function (code) {
  const normalized = ShieldElement.prototype.normalizeShieldCode(code);
  if (!normalized) {
    return "";
  }

  if (normalized.includes("-")) {
    const [base, ...rest] = normalized.split("-");
    const modifier = rest.join("-").toLowerCase();
    return modifier ? `${base} ${modifier}` : base;
  }

  const prefixedModifiers = [
    "FL",
    "GA",
    "NE",
    "NB",
    "NS",
    "TX",
  ];
  const matchedPrefix = prefixedModifiers.find(
    (prefix) => normalized.startsWith(prefix) && normalized.length > prefix.length
  );

  if (matchedPrefix && !/\d/.test(normalized.slice(matchedPrefix.length))) {
    const modifier = normalized.slice(matchedPrefix.length).toLowerCase();
    return modifier ? `${matchedPrefix} ${modifier}` : matchedPrefix;
  }

  return normalized;
};

ShieldElement.prototype.buildBlockShieldList = function () {
    const shields = [];
    const directory = Shield.prototype.shieldDirectory;

    const explicitShieldAssetOverrides = {
      NY: {
        "2Digit": "img/shields/United States/NY/NY-2Digit.svg",
        "3Digit": "img/shields/United States/NY/NY-3Digit.svg",
      },
      NJ: {
        "2Digit": "img/shields/United States/NJ/NJ-2Digit.svg",
        "3Digit": "img/shields/United States/NJ/NJ-3Digit.svg",
      },
      IN: {
        "2Digit": "img/shields/United States/IN/IN-2Digit.svg",
        "3Digit": "img/shields/United States/IN/IN-3Digit.svg",
      },
      KS: {
        "2Digit": "img/shields/United States/KS/KS-2Digit.svg",
        "3Digit": "img/shields/United States/KS/KS-3Digit.svg",
      },
      KY: {
        "2Digit": "img/shields/United States/KY/KY-2Digit.svg",
        "3Digit": "img/shields/United States/KY/KY-3Digit.svg",
      },
      MA: {
        "2Digit": "img/shields/United States/MA/MA-2Digit.svg",
        "3Digit": "img/shields/United States/MA/MA-3Digit.svg",
      },
      ME: {
        "2Digit": "img/shields/United States/ME/ME-2Digit.svg",
        "3Digit": "img/shields/United States/ME/ME-3Digit.svg",
      },
      MN: {
        "2Digit": "img/shields/United States/MN/MN-2Digit.svg",
        "3Digit": "img/shields/United States/MN/MN-3Digit.svg",
      },
      NE: {
        "2Digit": "img/shields/United States/NE/NE-2Digit.svg",
        "3Digit": "img/shields/United States/NE/NE-3Digit.svg",
      },
      OK: {
        "2Digit": "img/shields/United States/OK/OK-2Digit.svg",
        "3Digit": "img/shields/United States/OK/OK-3Digit.svg",
      },
    };
    
  const traverse = (node, pathParts = []) => {
    if (!node || typeof node !== "object") {
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (!value || typeof value !== "object") {
        continue;
      }
      if (value.type === "category") {
        traverse(value, pathParts.concat(key));
      } else if (value.type === "shield") {
        const normalizedCode = ShieldElement.prototype.normalizeShieldCode(key);
        const variants = Array.isArray(value.variants) ? value.variants.slice() : [];
          const shieldFolderOverrides = {
            I: "img/shields/United States/Interstate",
            AZ: "img/shields/United States/AZ",
            AZLOOP: "img/shields/United States/AZ",

            GA: "img/shields/United States/GA",
            GAALT: "img/shields/United States/GA",
            GABYP: "img/shields/United States/GA",
            GACONN: "img/shields/United States/GA",
            GALOOP: "img/shields/United States/GA",
            GASPUR: "img/shields/United States/GA",

            IN: "img/shields/United States/IN",
            INTR: "img/shields/United States/IN",

            KS: "img/shields/United States/KS",
            KSTP: "img/shields/United States/KS",

            KY: "img/shields/United States/KY",

            MA: "img/shields/United States/MA",
            MATP: "img/shields/United States/MA",

            ME: "img/shields/United States/ME",
            METP: "img/shields/United States/ME",

            MN: "img/shields/United States/MN",
            MNBUS: "img/shields/United States/MN",

            NE: "img/shields/United States/NE",
            NELINK: "img/shields/United States/NE",
            NESPUR: "img/shields/United States/NE",

            NJ: "img/shields/United States/NJ",
            GSP: "img/shields/United States/NJ",
            NJTP: "img/shields/United States/NJ",
            PIP: "img/shields/United States/NJ",

            NY: "img/shields/United States/NY",

            OK: "img/shields/United States/OK",
          };

          const resolvedAssetFolder =
            shieldFolderOverrides[normalizedCode] ||
            ["img/shields"].concat(pathParts).join("/");

          shields.push({
            value: normalizedCode,
            label: value.name || normalizedCode,
            variants,
            assetFolder: resolvedAssetFolder,
            className: ShieldElement.prototype.getShieldClassNames(normalizedCode),
            assetName: normalizedCode,
            assetPathByVariant: explicitShieldAssetOverrides[normalizedCode] || null,
            categories: pathParts.slice(),
          });
      }
    }
  };

  traverse(directory);

    const ensureShield = ({
      value,
      label,
      variants = [],
      assetFolder,
      categories = [],
      assetName,
      assetPath,
      assetPathByVariant,
      suppressRouteNumber = false,
    }) => {
      const normalizedValue = ShieldElement.prototype.normalizeShieldCode(value);

      const existing = shields.find(
        (shield) =>
          ShieldElement.prototype.normalizeShieldCode(shield.value) ===
          normalizedValue
      );

        const normalizedShield = {
          value: normalizedValue,
          label: label || normalizedValue,
          variants,
          assetFolder,
          className: ShieldElement.prototype.getShieldClassNames(normalizedValue),
          assetName: assetName || normalizedValue,
          assetPath: assetPath || null,
          assetPathByVariant: assetPathByVariant || null,
          suppressRouteNumber: !!suppressRouteNumber,
          categories,
        };

      if (existing) {
        Object.assign(existing, normalizedShield);
        return;
      }

      shields.push(normalizedShield);
    };

    const ensureDigitShield = (value, label, folder, variants = ["2 Digit", "3 Digit"]) => {
      ensureShield({
        value,
        label,
        variants,
        assetFolder: folder,
        categories: ["United States"],
      });
    };

    const ensureExactShield = (value, label, path) => {
      ensureShield({
        value,
        label,
        variants: ["Image"],
        assetFolder: path.split("/").slice(0, -1).join("/"),
        assetName: value,
        assetPath: path,
        suppressRouteNumber: true,
        categories: ["United States"],
      });
    };
    
    const ensureVariantShield = ({
      value,
      label,
      folder,
      assetName = value,
      categories = ["United States"],
      variants = ["2 Digit", "3 Digit"],
    }) => {
      const assetPathByVariant = {};

      for (const variant of variants) {
        const variantKey = ShieldElement.prototype.formatVariantKey(variant);
        assetPathByVariant[variantKey] =
          `${folder}/${assetName}-${variantKey}.svg`;
      }

      ensureShield({
        value,
        label,
        variants,
        assetFolder: folder,
        assetName,
        assetPathByVariant,
        categories,
      });
    };

    ensureDigitShield("cir", "Circle", "img/shields/United States");
    ensureDigitShield("elp", "Ellipse", "img/shields/United States");
    ensureDigitShield("rec", "Rectangle", "img/shields/United States");
    ensureDigitShield("rec2", "Rectangle (Alt)", "img/shields/United States");
    
    /* Interstate */
    ensureVariantShield({
      value: "I",
      label: "Interstate",
      folder: "img/shields/United States/Interstate",
      categories: ["United States", "Interstate"],
    });

    ensureVariantShield({
      value: "I-BUS",
      label: "Interstate Business",
      folder: "img/shields/United States/Interstate",
      categories: ["United States", "Interstate"],
    });

    ensureVariantShield({
      value: "I-BL",
      label: "Interstate Business Loop",
      folder: "img/shields/United States/Interstate",
      categories: ["United States", "Interstate"],
    });

    ensureVariantShield({
      value: "I-BS",
      label: "Interstate Business Spur",
      folder: "img/shields/United States/Interstate",
      categories: ["United States", "Interstate"],
    });

    ensureVariantShield({
      value: "I-DL",
      label: "Interstate Downtown Loop",
      folder: "img/shields/United States/Interstate",
      categories: ["United States", "Interstate"],
    });

    ensureVariantShield({
      value: "I-DS",
      label: "Interstate Downtown Spur",
      folder: "img/shields/United States/Interstate",
      categories: ["United States", "Interstate"],
    });

    ensureVariantShield({
      value: "I-F",
      label: "Future Interstate",
      folder: "img/shields/United States/Interstate",
      categories: ["United States", "Interstate"],
    });

    /* US Route */
    ensureVariantShield({
      value: "US",
      label: "U.S. Route",
      folder: "img/shields/United States/US Route",
      categories: ["United States", "U.S. Route"],
    });

    ensureVariantShield({
      value: "USCA",
      label: "U.S. Route (CA style)",
      folder: "img/shields/United States/US Route",
      assetName: "US-CA",
      categories: ["United States", "U.S. Route"],
    });

    /* Wisconsin */
    ensureVariantShield({
      value: "WI",
      label: "Wisconsin",
      folder: "img/shields/United States/WI",
      categories: ["United States", "Wisconsin"],
    });

    ensureVariantShield({
      value: "WICo",
      label: "Wisconsin County",
      folder: "img/shields/United States/WI",
      assetName: "WICo",
      categories: ["United States", "Wisconsin"],
    });
    
    /* County */
    ensureShield({
      value: "C",
      label: "County",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/United States",
      assetName: "C",
      assetPathByVariant: {
        "2Digit": "img/shields/United States/C-2Digit.svg",
        "3Digit": "img/shields/United States/C-3Digit.svg",
      },
      categories: ["United States"],
      county: true,
    });

    /* AZ */
    ensureDigitShield("AZ", "Arizona", "img/shields/United States/AZ");
    ensureShield({
      value: "AZLOOP",
      label: "Arizona Loop",
      variants: ["3 Digit"],
      assetFolder: "img/shields/United States/AZ",
      assetName: "AZLOOP",
      categories: ["United States"],
    });
    /* FL */
    ensureDigitShield("FL", "Florida", "img/shields/United States/FL");

    ensureShield({
      value: "FLToll",
      label: "Florida Toll",
      variants: ["Image"],
      assetFolder: "img/shields/United States/FL",
      assetName: "FLToll",
      assetPath: "img/shields/United States/FL/FLToll-Current.svg",
      suppressRouteNumber: false,
      categories: ["United States"],
    });

    ensureShield({
      value: "FLTP",
      label: "Florida’s Turnpike",
      variants: ["Image"],
      assetFolder: "img/shields/United States/FL",
      assetName: "FLTP",
      assetPath: "img/shields/United States/FL/FLTP.svg",
      suppressRouteNumber: true,
      categories: ["United States"],
    });

    /* GA */
    ensureDigitShield("GA", "Georgia", "img/shields/United States/GA");
    ensureDigitShield("GAALT", "GA Alternate", "img/shields/United States/GA");
    ensureDigitShield("GABYP", "GA Bypass", "img/shields/United States/GA");
    ensureDigitShield("GACONN", "GA Connector", "img/shields/United States/GA");
    ensureDigitShield("GALOOP", "GA Loop", "img/shields/United States/GA");
    ensureDigitShield("GASPUR", "GA Spur", "img/shields/United States/GA");

    /* IN */
    ensureDigitShield("IN", "Indiana", "img/shields/United States/IN");
    ensureExactShield("INTR", "Indiana Toll Road", "img/shields/United States/IN/INTR.png");

    /* KS */
    ensureDigitShield("KS", "Kansas", "img/shields/United States/KS");
    ensureExactShield("KSTP", "Kansas Turnpike", "img/shields/United States/KS/KSTP.png");

    /* KY */
    ensureDigitShield("KY", "Kentucky", "img/shields/United States/KY");
    ensureExactShield("KYAA", "AA Highway", "img/shields/United States/KY/KYAA.png");
    ensureExactShield("KYAU", "Audubon Parkway", "img/shields/United States/KY/KYAU.png");
    ensureExactShield("KYBG", "Bluegrass Parkway", "img/shields/United States/KY/KYBG.png");
    ensureExactShield("KYCM", "Cumberland Parkway", "img/shields/United States/KY/KYCM.png");
    ensureExactShield("KYHR", "Hal Rogers Parkway", "img/shields/United States/KY/KYHR.png");
    ensureExactShield("KYMT", "Mountain Parkway", "img/shields/United States/KY/KYMT.png");
    ensureExactShield("KYPR", "Pennyrile Parkway", "img/shields/United States/KY/KYPR.png");
    ensureExactShield("KYPU", "Purchase Parkway", "img/shields/United States/KY/KYPU.png");
    ensureExactShield("KYWK", "Western KY Parkway", "img/shields/United States/KY/KYWK.png");
    ensureExactShield("KYWN", "Natcher Parkway", "img/shields/United States/KY/KYWN.png");

    /* MA */
    ensureDigitShield("MA", "Massachusetts", "img/shields/United States/MA");
    ensureExactShield("MATP", "Mass Pike", "img/shields/United States/MA/MATP.png");

    /* ME */
    ensureDigitShield("ME", "Maine", "img/shields/United States/ME");
    ensureExactShield("METP", "Maine Turnpike", "img/shields/United States/ME/METP.png");

    /* MN */
    ensureShield({
      value: "MN",
      label: "Minnesota",
      variants: ["2 Digit"],
      assetFolder: "img/shields/United States/MN",
      assetName: "MN",
      categories: ["United States"],
    });
    ensureShield({
      value: "MNBUS",
      label: "Minnesota Business",
      variants: ["2 Digit"],
      assetFolder: "img/shields/United States/MN",
      assetName: "MNBUS",
      categories: ["United States"],
    });

    /* NE */
    ensureDigitShield("NE", "Nebraska", "img/shields/United States/NE");
    ensureShield({
      value: "NELINK",
      label: "Nebraska Link",
      variants: ["2 Digit"],
      assetFolder: "img/shields/United States/NE",
      assetName: "NELINK",
      categories: ["United States"],
    });
    ensureShield({
      value: "NESPUR",
      label: "Nebraska Spur",
      variants: ["2 Digit"],
      assetFolder: "img/shields/United States/NE",
      assetName: "NESPUR",
      categories: ["United States"],
    });
    
    /* NJ */
    ensureDigitShield("NJ", "New Jersey", "img/shields/United States/NJ");
    ensureExactShield("GSP", "Garden State Parkway", "img/shields/United States/NJ/GSP.png");
    ensureExactShield("NJTP", "NJ Turnpike", "img/shields/United States/NJ/NJTP.png");
    ensureExactShield("PIP", "Palisades Interstate Parkway", "img/shields/United States/NJ/PIP.png");

    /* NY */
    ensureDigitShield("NY", "New York", "img/shields/United States/NY");
    ensureExactShield("B", "Bethpage Parkway", "img/shields/United States/NY/B.png");
    ensureExactShield("BMP", "Bear Mountain Parkway", "img/shields/United States/NY/BMP.png");
    ensureExactShield("BP", "Belt Parkway", "img/shields/United States/NY/BP.png");
    ensureExactShield("BR", "Bronx River Parkway", "img/shields/United States/NY/BR.png");
    ensureExactShield("BRP", "Bronx River Parkway", "img/shields/United States/NY/BRP.png");
    ensureExactShield("CCP", "Cross County Parkway", "img/shields/United States/NY/CCP.png");
    ensureExactShield("CI", "Cross Island Parkway", "img/shields/United States/NY/CI.png");
    ensureExactShield("FDR", "FDR Drive", "img/shields/United States/NY/FDR.png");
    ensureExactShield("GCP", "Grand Central Parkway", "img/shields/United States/NY/GCP.png");
    ensureExactShield("H", "Heckscher Parkway", "img/shields/United States/NY/H.png");
    ensureExactShield("HH", "Henry Hudson Parkway", "img/shields/United States/NY/HH.png");
    ensureExactShield("HR", "Hutchinson River Parkway", "img/shields/United States/NY/HR.png");
    ensureExactShield("HRD", "Harlem River Drive", "img/shields/United States/NY/HRD.png");
    ensureExactShield("HRP", "Hutchinson River Parkway", "img/shields/United States/NY/HRP.png");
    ensureExactShield("JR", "Jackie Robinson Parkway", "img/shields/United States/NY/JR.png");
    ensureExactShield("KWV", "Korean War Veterans Parkway", "img/shields/United States/NY/KWV.png");
    ensureExactShield("LOSP", "Lake Ontario State Parkway", "img/shields/United States/NY/LOSP.png");
    ensureExactShield("M", "Meadowbrook Parkway", "img/shields/United States/NY/M.png");
    ensureExactShield("MP", "Mosholu Parkway", "img/shields/United States/NY/MP.png");
    ensureExactShield("N", "Northern State Parkway", "img/shields/United States/NY/N.png");
    ensureExactShield("NSP", "Niagara Scenic Parkway", "img/shields/United States/NY/NSP.png");
    ensureExactShield("NYST", "NY State Thruway", "img/shields/United States/NY/NYST.png");
    ensureExactShield("O", "Ocean Parkway", "img/shields/United States/NY/O.png");
    ensureExactShield("Pe", "Pelham Parkway", "img/shields/United States/NY/Pe.png");
    ensureExactShield("RM", "Robert Moses Causeway", "img/shields/United States/NY/RM.png");
    ensureExactShield("SA", "Sagtikos Parkway", "img/shields/United States/NY/SA.png");
    ensureExactShield("SBP", "Sprain Brook Parkway", "img/shields/United States/NY/SBP.png");
    ensureExactShield("SM", "Sunken Meadow Parkway", "img/shields/United States/NY/SM.png");
    ensureExactShield("SMP", "Saw Mill Parkway", "img/shields/United States/NY/SMP.png");
    ensureExactShield("SO", "Southern State Parkway", "img/shields/United States/NY/SO.png");
    ensureExactShield("TSP", "Taconic State Parkway", "img/shields/United States/NY/TSP.png");
    ensureExactShield("W", "Wantagh Parkway", "img/shields/United States/NY/W.png");

    /* OH */
    ensureDigitShield("OH", "Ohio", "img/shields/United States/OH");
    ensureExactShield("OHTP", "Ohio Turnpike", "img/shields/United States/OH/OHTP.png");

    /* OK */
    ensureDigitShield("OK", "Oklahoma", "img/shields/United States/OK");
    ensureExactShield("OKCH", "Cherokee Turnpike", "img/shields/United States/OK/OKCH.png");
    ensureExactShield("OKCR", "Creek Turnpike", "img/shields/United States/OK/OKCR.png");
    ensureExactShield("OKHB", "H.E. Bailey Turnpike", "img/shields/United States/OK/OKHB.png");
    ensureExactShield("OKIN", "Indian Nation Turnpike", "img/shields/United States/OK/OKIN.png");
    ensureExactShield("OKKC", "Kickapoo Turnpike", "img/shields/United States/OK/OKKC.png");
    ensureExactShield("OKKL", "Kilpatrick Turnpike", "img/shields/United States/OK/OKKL.png");
    ensureExactShield("OKMS", "Muskogee Turnpike", "img/shields/United States/OK/OKMS.png");
    ensureExactShield("OKTU", "Turner Turnpike", "img/shields/United States/OK/OKTU.png");
    ensureExactShield("OKWR", "Will Rogers Turnpike", "img/shields/United States/OK/OKWR.png");
    
    /* PA */
    ensureShield({
      value: "PA",
      label: "Pennsylvania",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/United States/PA",
      assetName: "PA",
      assetPathByVariant: {
        "2Digit": "img/shields/United States/PA/PA-2Digit.svg",
        "3Digit": "img/shields/United States/PA/PA-3Digit.svg",
      },
      categories: ["United States", "Pennsylvania"],
    });

    ensureShield({
      value: "PATPLOGO",
      label: "PA Turnpike",
      variants: ["Image"],
      assetFolder: "img/shields/United States/PA",
      assetName: "PATP",
      assetPath: "img/shields/United States/PA/PATP.png",
      categories: ["United States", "Pennsylvania"],
    });

    ensureShield({
      value: "PATP",
      label: "PA Turnpike Route",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/United States/PA",
      assetName: "PATP",
      assetPathByVariant: {
        "2Digit": "img/shields/United States/PA/PATP-2Digit.svg",
        "3Digit": "img/shields/United States/PA/PATP-3Digit.svg",
      },
      categories: ["United States", "Pennsylvania"],
    });
    
    /* TX */
    ensureDigitShield("TX", "Texas", "img/shields/United States/TX");

    ensureShield({
      value: "TXBELT",
      label: "Texas Beltway",
      variants: ["2 Digit"],
      assetFolder: "img/shields/United States/TX",
      assetName: "TXBELTWAY",
      assetPathByVariant: {
        "2Digit": "img/shields/United States/TX/TXBELTWAY-2Digit.svg",
      },
      categories: ["United States", "Texas"],
    });

    ensureShield({
      value: "TXEXPRESS",
      label: "Texas Express Toll",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/United States/TX",
      assetName: "TXEXPRESS",
      assetPathByVariant: {
        "2Digit": "img/shields/United States/TX/TXEXPRESS-2Digit.svg",
        "3Digit": "img/shields/United States/TX/TXEXPRESS-3Digit.svg",
      },
      categories: ["United States", "Texas"],
    });

    ensureShield({
      value: "TXFM",
      label: "Texas FM",
      variants: ["4 Digit"],
      assetFolder: "img/shields/United States/TX",
      assetName: "TXFM",
      assetPathByVariant: {
        "4Digit": "img/shields/United States/TX/TXFM-4Digit.svg",
      },
      categories: ["United States", "Texas"],
    });

    ensureShield({
      value: "TXLOOP",
      label: "Texas Loop",
      variants: ["2 Digit", "3 Digit", "4 Digit"],
      assetFolder: "img/shields/United States/TX",
      assetName: "TXLOOP",
      assetPathByVariant: {
        "2Digit": "img/shields/United States/TX/TXLOOP-2Digit.svg",
        "3Digit": "img/shields/United States/TX/TXLOOP-3Digit.svg",
        "4Digit": "img/shields/United States/TX/TXLOOP-4Digit.svg",
      },
      categories: ["United States", "Texas"],
    });

    ensureShield({
      value: "TXPARK",
      label: "Texas Park Road",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/United States/TX",
      assetName: "TXPARK",
      assetPathByVariant: {
        "2Digit": "img/shields/United States/TX/TXPARK-2Digit.svg",
        "3Digit": "img/shields/United States/TX/TXPARK-3Digit.svg",
      },
      categories: ["United States", "Texas"],
    });

    ensureShield({
      value: "TXRM",
      label: "Texas RM",
      variants: ["2 Digit"],
      assetFolder: "img/shields/United States/TX",
      assetName: "TXRM",
      assetPathByVariant: {
        "2Digit": "img/shields/United States/TX/TXRM-2Digit.svg",
      },
      categories: ["United States", "Texas"],
    });

    ensureShield({
      value: "TXSPUR",
      label: "Texas Spur",
      variants: ["2 Digit", "3 Digit", "4 Digit"],
      assetFolder: "img/shields/United States/TX",
      assetName: "TXSPUR",
      assetPathByVariant: {
        "2Digit": "img/shields/United States/TX/TXSPUR-2Digit.svg",
        "3Digit": "img/shields/United States/TX/TXSPUR-3Digit.svg",
        "4Digit": "img/shields/United States/TX/TXSPUR-4Digit.svg",
      },
      categories: ["United States", "Texas"],
    });

    ensureShield({
      value: "TXTOLL",
      label: "Texas Toll",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/United States/TX",
      assetName: "TXTOLL",
      assetPathByVariant: {
        "2Digit": "img/shields/United States/TX/TXTOLL-2Digit.svg",
        "3Digit": "img/shields/United States/TX/TXTOLL-3Digit.svg",
      },
      categories: ["United States", "Texas"],
    });

    ensureExactShield("HTR", "Hardy Toll Road", "img/shields/United States/TX/HTR.png");
    ensureExactShield("SHT", "Sam Houston Tollway", "img/shields/United States/TX/SHT.png");
    ensureExactShield("TXTOLLCTRMA", "Texas Toll CTRMA", "img/shields/United States/TX/TXTollCTRMA.svg");
    ensureExactShield("TXTOLLNTTA", "Texas Toll NTTA", "img/shields/United States/TX/TXTollNTTA.svg");
    ensureExactShield("TXTOLLFBTR", "Fort Bend Toll Road", "img/shields/United States/TX/TXTollFBTR.png");
    ensureExactShield("WPT", "Westpark Tollway", "img/shields/United States/TX/WPT.png");
    
    /* CANADA */

    ensureShield({
      value: "TCH",
      label: "Trans-Canada Highway",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada",
      assetName: "TCH",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/TCH-2Digit.svg",
        "3Digit": "img/shields/Canada/TCH-3Digit.svg",
      },
      categories: ["Canada"],
    });
    ensureShield({
      value: "TCHLeaf",
      label: "TCH Leaf",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada",
      assetName: "TCHLeaf",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/TCHLeaf-2Digit.svg",
        "3Digit": "img/shields/Canada/TCHLeaf-3Digit.svg",
      },
      categories: ["Canada"],
    });

    /* AB */
    ensureShield({
      value: "AB",
      label: "Alberta",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/AB",
      assetName: "AB",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/AB/AB-2Digit.svg",
        "3Digit": "img/shields/Canada/AB/AB-3Digit.svg",
      },
      categories: ["Canada", "Alberta"],
    });

    ensureShield({
      value: "AB2",
      label: "Alberta Oval",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/AB",
      assetName: "AB2",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/AB/AB2-2Digit.svg",
        "3Digit": "img/shields/Canada/AB/AB2-3Digit.svg",
      },
      categories: ["Canada", "Alberta"],
    });

    ensureShield({
      value: "ABTC",
      label: "Alberta TCH",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/AB",
      assetName: "ABTC",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/AB/ABTC-2Digit.svg",
        "3Digit": "img/shields/Canada/AB/ABTC-3Digit.svg",
      },
      categories: ["Canada", "Alberta"],
    });

    /* BC */
    ensureShield({
      value: "BC",
      label: "British Columbia",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/BC",
      assetName: "BC",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/BC/BC-2Digit.svg",
        "3Digit": "img/shields/Canada/BC/BC-3Digit.svg",
      },
      categories: ["Canada", "British Columbia"],
    });

    ensureShield({
      value: "BCYH",
      label: "BC Yellowhead",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/BC",
      assetName: "BCYH",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/BC/BCYH-2Digit.svg",
        "3Digit": "img/shields/Canada/BC/BCYH-3Digit.svg",
      },
      categories: ["Canada", "British Columbia"],
    });
    
    ensureShield({
      value: "BCTC",
      label: "BC TCH",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/BC",
      assetName: "BCTC",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/BC/BCTC-2Digit.svg",
        "3Digit": "img/shields/Canada/BC/BCTC-3Digit.svg",
      },
      categories: ["Canada", "British Columbia"],
    });

    /* MB */
    ensureShield({
      value: "MB",
      label: "Manitoba",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/MB",
      assetName: "MB",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/MB/MB-2Digit.svg",
        "3Digit": "img/shields/Canada/MB/MB-3Digit.svg",
      },
      categories: ["Canada", "Manitoba"],
    });

    ensureShield({
      value: "MB2",
      label: "Manitoba Secondary",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/MB",
      assetName: "MB2",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/MB/MB2-2Digit.svg",
        "3Digit": "img/shields/Canada/MB/MB2-3Digit.svg",
      },
      categories: ["Canada", "Manitoba"],
    });

    ensureShield({
      value: "MBTC",
      label: "Manitoba TCH",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/MB",
      assetName: "MBTC",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/MB/MBTC-2Digit.svg",
        "3Digit": "img/shields/Canada/MB/MBTC-3Digit.svg",
      },
      categories: ["Canada", "Manitoba"],
    });

    /* NB */
    ensureShield({
      value: "NB",
      label: "New Brunswick",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/NB",
      assetName: "NB",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/NB/NB-2Digit.svg",
        "3Digit": "img/shields/Canada/NB/NB-3Digit.svg",
      },
      categories: ["Canada", "New Brunswick"],
    });

    ensureShield({
      value: "NBCONN",
      label: "NB Connector",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/NB",
      assetName: "NBCONN",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/NB/NBCONN-2Digit.svg",
        "3Digit": "img/shields/Canada/NB/NBCONN-3Digit.svg",
      },
      categories: ["Canada", "New Brunswick"],
    });

    ensureShield({
      value: "NBLOCAL",
      label: "NB Local",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/NB",
      assetName: "NBLOCAL",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/NB/NBLOCAL-2Digit.svg",
        "3Digit": "img/shields/Canada/NB/NBLOCAL-3Digit.svg",
      },
      categories: ["Canada", "New Brunswick"],
    });

    ensureShield({
      value: "NBTC",
      label: "NB TCH",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/NB",
      assetName: "NBTC",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/NB/NBTC-2Digit.svg",
        "3Digit": "img/shields/Canada/NB/NBTC-3Digit.svg",
      },
      categories: ["Canada", "New Brunswick"],
    });

    /* NL */
    ensureShield({
      value: "NL",
      label: "Newfoundland and Labrador",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/NL",
      assetName: "NL",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/NL/NL-2Digit.svg",
        "3Digit": "img/shields/Canada/NL/NL-3Digit.svg",
      },
      categories: ["Canada", "Newfoundland and Labrador"],
    });

    ensureShield({
      value: "NLTC",
      label: "NL TCH",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/NL",
      assetName: "NLTC",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/NL/NLTC-2Digit.svg",
        "3Digit": "img/shields/Canada/NL/NLTC-3Digit.svg",
      },
      categories: ["Canada", "Newfoundland and Labrador"],
    });

    /* NS */
    ensureShield({
      value: "NS",
      label: "Nova Scotia",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/NS",
      assetName: "NS",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/NS/NS-2Digit.svg",
        "3Digit": "img/shields/Canada/NS/NS-3Digit.svg",
      },
      categories: ["Canada", "Nova Scotia"],
    });

    ensureShield({
      value: "NSCONN",
      label: "NS Connector",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/NS",
      assetName: "NSCONN",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/NS/NSCONN-2Digit.svg",
        "3Digit": "img/shields/Canada/NS/NSCONN-3Digit.svg",
      },
      categories: ["Canada", "Nova Scotia"],
    });

    ensureShield({
      value: "NSTC",
      label: "NS TCH",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/NS",
      assetName: "NSTC",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/NS/NSTC-2Digit.svg",
        "3Digit": "img/shields/Canada/NS/NSTC-3Digit.svg",
      },
      categories: ["Canada", "Nova Scotia"],
    });

    /* ON */
    ensureShield({
      value: "ON",
      label: "Ontario",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/ON",
      assetName: "ON",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/ON/ON-2Digit.svg",
        "3Digit": "img/shields/Canada/ON/ON-3Digit.svg",
      },
      categories: ["Canada", "Ontario"],
    });

    ensureShield({
      value: "ON2",
      label: "Ontario Secondary",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/ON",
      assetName: "ON2",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/ON/ON2-2Digit.svg",
        "3Digit": "img/shields/Canada/ON/ON2-3Digit.svg",
      },
      categories: ["Canada", "Ontario"],
    });
    
    ensureShield({
      value: "ON3",
      label: "ON County",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/ON",
      assetName: "ON3",
      className: "ON3",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/ON/ON3-2Digit.svg",
        "3Digit": "img/shields/Canada/ON/ON3-3Digit.svg",
      },
      categories: ["Canada", "Ontario"],
      county: false,
    });

    ensureExactShield("ONDVP", "Don Valley Parkway", "img/shields/Canada/ON/ON-DVP.png");
    ensureExactShield("ONGAR", "Gardiner Expressway", "img/shields/Canada/ON/ON-GAR.png");

    ensureShield({
      value: "ONTC",
      label: "Ontario TCH",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/ON",
      assetName: "ONTC",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/ON/ONTC-2Digit.svg",
        "3Digit": "img/shields/Canada/ON/ONTC-3Digit.svg",
      },
      categories: ["Canada", "Ontario"],
    });

    ensureExactShield("ONTCCOR", "Central Ontario Route", "img/shields/Canada/ON/ONTC-COR.svg");
    ensureExactShield("ONTCGBR", "Georgian Bay Route", "img/shields/Canada/ON/ONTC-GBR.svg");
    ensureExactShield("ONTCLSR", "Lake Superior Route", "img/shields/Canada/ON/ONTC-LSR.svg");
    ensureExactShield("ONTCNOR", "Northern Ontario Route", "img/shields/Canada/ON/ONTC-NOR.svg");
    ensureExactShield("ONTCOVR", "Ottawa Valley Route", "img/shields/Canada/ON/ONTC-OVR.svg");

    /* PEI */
    ensureShield({
      value: "PEI",
      label: "Prince Edward Island",
      variants: ["2 Digit"],
      assetFolder: "img/shields/Canada/PEI",
      assetName: "PEI",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/PEI/PEI-2Digit.svg",
      },
      categories: ["Canada", "Prince Edward Island"],
    });

    /* QC */
    ensureShield({
      value: "QC",
      label: "Quebec Autoroute",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/QC",
      assetName: "QC",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/QC/QC-2Digit.svg",
        "3Digit": "img/shields/Canada/QC/QC-3Digit.svg",
      },
      categories: ["Canada", "Quebec"],
    });

    ensureShield({
      value: "QC2",
      label: "Quebec Route",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/QC",
      assetName: "QC2",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/QC/QC2-2Digit.svg",
        "3Digit": "img/shields/Canada/QC/QC2-3Digit.svg",
      },
      categories: ["Canada", "Quebec"],
    });

    ensureShield({
      value: "QCTC",
      label: "Quebec TCH",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/QC",
      assetName: "QCTC",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/QC/QCTC-2Digit.svg",
        "3Digit": "img/shields/Canada/QC/QCTC-3Digit.svg",
      },
      categories: ["Canada", "Quebec"],
    });

    /* SK */
    ensureShield({
      value: "SK",
      label: "Saskatchewan",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/SK",
      assetName: "SK",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/SK/SK-2Digit.svg",
        "3Digit": "img/shields/Canada/SK/SK-3Digit.svg",
      },
      categories: ["Canada", "Saskatchewan"],
    });

    ensureShield({
      value: "SK2",
      label: "Saskatchewan Secondary",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/SK",
      assetName: "SK2",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/SK/SK2-2Digit.svg",
        "3Digit": "img/shields/Canada/SK/SK2-3Digit.svg",
      },
      categories: ["Canada", "Saskatchewan"],
    });

    ensureShield({
      value: "SKTC",
      label: "Saskatchewan TCH",
      variants: ["2 Digit", "3 Digit"],
      assetFolder: "img/shields/Canada/SK",
      assetName: "SKTC",
      assetPathByVariant: {
        "2Digit": "img/shields/Canada/SK/SKTC-2Digit.svg",
        "3Digit": "img/shields/Canada/SK/SKTC-3Digit.svg",
      },
      categories: ["Canada", "Saskatchewan"],
    });

  return shields;
};

ShieldElement.prototype.buildBlockShieldVariants = function (shields) {
  const variants = new Set(["Auto"]);
  (shields || []).forEach((shield) => {
    (shield.variants || []).forEach((variant) => variants.add(variant));
  });
  return Array.from(variants).map((variant) => ({
    value: variant,
    label: variant,
  }));
};

(() => {
  const shields = ShieldElement.prototype.buildBlockShieldList();
  ShieldElement.prototype.blockShieldBases = shields;
  ShieldElement.prototype.blockShieldVariants =
    ShieldElement.prototype.buildBlockShieldVariants(shields);
  if (shields.length && shields[0].value) {
    ShieldElement.prototype.defaultShieldBase = shields[0].value;
  }
})();
ShieldElement.prototype.blockBannerPositions = [
  "Above",
  "Below",
  "Left",
  "Right",
];

ShieldElement.prototype.getBannerPositionOptions = function () {
  return ShieldElement.prototype.blockBannerPositions;
};

ShieldElement.prototype.getBannerFontOptions = function () {
  return TextElement.prototype.fontFamily;
};

ShieldElement.prototype.normalizeBannerType = function (value) {
  const options = Shield.prototype.bannerTypes || [];
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return ShieldElement.prototype.defaultBannerType;
  }
  if (!options.length || options.includes(trimmed)) {
    return trimmed;
  }
  return trimmed;
};

ShieldElement.prototype.normalizeBannerPosition = function (value) {
  const options = ShieldElement.prototype.getBannerPositionOptions();
  if (typeof value === "string" && options.includes(value)) {
    return value;
  }
  return ShieldElement.prototype.defaultBannerPosition;
};

ShieldElement.prototype.normalizeBannerFontFamily = function (value) {
  const options = ShieldElement.prototype.getBannerFontOptions();
  if (typeof value === "string" && options.includes(value)) {
    return value;
  }
  return (
    ShieldElement.prototype.defaultBannerFontFamily ||
    (options.length ? options[0] : "")
  );
};

ShieldElement.prototype.normalizeFontSize = function (
  value,
  fallbackSize = ShieldElement.prototype.defaultBannerFontSize
) {
  const parsed = parseFloat(
    typeof value === "string" ? value.replace(/rem$/i, "") : value
  );

  if (Number.isFinite(parsed)) {
    return Math.max(parsed, 0.1);
  }

  return fallbackSize;
};

ShieldElement.prototype.getFontSizeCss = function (value) {
  const normalized = ShieldElement.prototype.normalizeFontSize(value);
  return normalized + "rem";
};

ShieldElement.prototype.normalizeShieldSize = function (value) {
  if (typeof value === "string") {
    value = value.replace(/rem$/i, "");
  }
  const parsed = parseFloat(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return ShieldElement.prototype.defaultShieldSize;
};

ShieldElement.prototype.getShieldScale = function (size) {
  const base =
    ShieldElement.prototype.defaultShieldSize && ShieldElement.prototype.defaultShieldSize > 0
      ? ShieldElement.prototype.defaultShieldSize
      : 3;
  const normalizedSize = ShieldElement.prototype.normalizeShieldSize(size);
  return normalizedSize / base;
};

ShieldElement.prototype.normalizeScaleBannersWithShield = function (value) {
  if (
    value === false ||
    value === 0 ||
    value === "0" ||
    (typeof value === "string" && value.toLowerCase() === "false")
  ) {
    return false;
  }
  return true;
};

ShieldElement.prototype.hasBannerValue = function (value) {
  return typeof value === "string" && value !== "None" && value.trim().length > 0;
};

ShieldElement.prototype.createBannerElement = function (
  bannerClass,
  bannerValue,
  fontSizeCss,
  indentFirstLetter,
  bannerFontFamily,
  smallCaps = true
) {
  const bannerEl = document.createElement("p");
  const shouldIndent = indentFirstLetter !== false;
  bannerEl.className =
    bannerClass + (shouldIndent ? "" : " noIndent") + (smallCaps ? "" : " noSmallCaps");
  bannerEl.style.setProperty("--fontSize", fontSizeCss);

  const normalizedFont =
    ShieldElement.prototype.normalizeBannerFontFamily(bannerFontFamily);

  if (normalizedFont) {
    bannerEl.style.setProperty("--bannerFontFamily", `"${normalizedFont}"`);
    bannerEl.style.fontFamily = `"${normalizedFont}"`;
  }

  const normalizedBannerValue = String(bannerValue || "").trim();
  const lowerBannerValue = normalizedBannerValue.toLowerCase();
  const isRoadNameBanner = String(bannerClass || "")
    .split(/\s+/)
    .includes("bannerRoadName");

  if (lowerBannerValue === "toll") {
    bannerEl.classList.add("TOLL", "yellowElmt", "noIndent");
  }

  const displayBannerValue = isRoadNameBanner
    ? normalizedBannerValue.replace(/\\n/g, "\n")
    : normalizedBannerValue;

  bannerEl.textContent =
    normalizedBannerValue && normalizedBannerValue !== "None"
      ? displayBannerValue
      : " ";

  return bannerEl;
};

ShieldElement.prototype.isBilingualDirectionPair = function (firstValue, secondValue) {
  const first = String(firstValue || "").trim().toUpperCase();
  const second = String(secondValue || "").trim().toUpperCase();

  const pairs = {
    EAST: "EST",
    WEST: "OUEST",
    NORTH: "NORD",
    SOUTH: "SUD",
  };

  return pairs[first] === second;
};

ShieldElement.prototype.createStackedBannerSlot = function (
  position,
  banners,
  fontSizeCss,
  indentFirstLetter,
  bannerFontFamily,
  smallCaps = true
) {
  const normalizedPosition = ShieldElement.prototype.normalizeBannerPosition(
    position
  );

  const container = document.createElement("div");
  container.className = "stackedBannerSlot bannerSlot";
  container.classList.add(`bannerSlot-${normalizedPosition.toLowerCase()}`);

  const firstBannerValue = banners?.[0]?.bannerValue;
  const secondBannerValue = banners?.[1]?.bannerValue;

  if (
    ShieldElement.prototype.isBilingualDirectionPair(
      firstBannerValue,
      secondBannerValue
    )
  ) {
    container.classList.add("bilingualDirectionBanner");
  }

  const hasTollBanner = banners.some((banner) => {
    return String(banner.bannerValue || "").trim().toUpperCase() === "TOLL";
  });

  if (hasTollBanner) {
    container.classList.add("tollStackedBanner");
  }

  banners.forEach(
    ({
      bannerClass,
      bannerValue,
      containerClass,
      indentFirstLetter: bannerSpecificIndent,
      smallCaps: bannerSpecificSmallCaps,
    }) => {
      if (containerClass) {
        container.classList.add(containerClass);
      }

      const bannerIndent =
        typeof bannerSpecificIndent === "boolean"
          ? bannerSpecificIndent
          : indentFirstLetter;

      const bannerSmallCaps =
        typeof bannerSpecificSmallCaps === "boolean"
          ? bannerSpecificSmallCaps
          : smallCaps;

      const bannerEl = ShieldElement.prototype.createBannerElement(
        bannerClass,
        bannerValue,
        fontSizeCss,
        bannerIndent,
        bannerFontFamily,
        bannerSmallCaps
      );

      container.appendChild(bannerEl);
    }
  );

  return container;
};

ShieldElement.prototype.createBannerContainer = function (
  containerClass,
  bannerClass,
  bannerValue,
  fontSizeCss,
  indentFirstLetter,
  bannerFontFamily,
  isSecond,
  position,
  smallCaps = true
) {
  const container = document.createElement("div");
  container.className = containerClass;
  container.classList.add("bannerSlot");

  const normalizedPosition = ShieldElement.prototype.normalizeBannerPosition(
    position
  );
  container.classList.add(`bannerSlot-${normalizedPosition.toLowerCase()}`);

  const normalizedBannerValue = String(bannerValue || "").trim().toUpperCase();

  if (normalizedBannerValue === "TOLL") {
    container.classList.add("tollBannerSlot");
  }

  const bannerEl = ShieldElement.prototype.createBannerElement(
    bannerClass,
    bannerValue,
    fontSizeCss,
    indentFirstLetter,
    bannerFontFamily,
    smallCaps
  );

  container.appendChild(bannerEl);
  return container;
};

ShieldElement.prototype.getBlockShieldConfig = function (base) {
  const options = ShieldElement.prototype.blockShieldBases;
  const normalizedBase = ShieldElement.prototype.normalizeShieldCode(base);
  return (
    options.find(
      (option) =>
        ShieldElement.prototype.normalizeShieldCode(option.value) === normalizedBase
    ) || options[0]
  );
};

ShieldElement.prototype.resolveBlockVariant = function (
  desiredVariant,
  routeNumber,
  config
) {
  const allowed = config?.variants || [];
  if (!allowed.length) {
    return "";
  }
  const normalized = (desiredVariant || "").trim();
  if (normalized && normalized.toLowerCase() !== "auto") {
    if (allowed.includes(normalized)) {
      return normalized;
    }
    return allowed[0] || normalized;
  }
  const fallback = allowed[0] || ShieldElement.prototype.defaultVariant;
  const inferred = ShieldElement.prototype.getVariantFromRoute(routeNumber, config);
  return allowed.includes(inferred) ? inferred : fallback;
};

ShieldElement.prototype.getRouteCharacterCount = function (routeNumber) {
  const raw = String(routeNumber || "").trim();

  if (!raw) {
    return 0;
  }

  try {
    return (raw.match(/[\p{L}\p{N}]/gu) || []).length;
  } catch (error) {
    return (raw.match(/[A-Za-z0-9]/g) || []).length;
  }
};

ShieldElement.prototype.getRouteSizeClassFromCount = function (count) {
  if (!count) {
    return "";
  }
  if (count <= 1) {
    return "one";
  }
  if (count === 2) {
    return "two";
  }
  if (count === 3) {
    return "three";
  }
  if (count === 4) {
    return "four";
  }
  if (count === 5) {
    return "five";
  }
  return "six";
};

ShieldElement.prototype.getVariantFromRoute = function (routeNumber, config) {
  const characterCount = ShieldElement.prototype.getRouteCharacterCount(routeNumber);
  const supportsFourDigit =
    Array.isArray(config?.variants) && config.variants.includes("4 Digit");

  if (supportsFourDigit && characterCount >= 4) {
    return "4 Digit";
  }

  return characterCount >= 3 ? "3 Digit" : "2 Digit";
};

ShieldElement.prototype.getContainerSizeClass = function (routeNumber) {
  return ShieldElement.prototype.getRouteSizeClassFromCount(
    ShieldElement.prototype.getRouteCharacterCount(routeNumber)
  );
};

ShieldElement.prototype.getImageSizeClass = function (routeNumber) {
  return ShieldElement.prototype.getRouteSizeClassFromCount(
    ShieldElement.prototype.getRouteCharacterCount(routeNumber)
  );
};

ShieldElement.prototype.getShieldAssetPath = function (config, variantKey) {
  if (config?.assetPathByVariant && config.assetPathByVariant[variantKey]) {
    return config.assetPathByVariant[variantKey];
  }

  if (config?.assetPath) {
    return config.assetPath;
  }

  const assetFolder = config?.assetFolder || "img/shields";
  const assetName = config?.assetName || config?.value || "I";
  const suffix = variantKey ? `-${variantKey}` : "";
  return `${assetFolder}/${assetName}${suffix}.svg`;
};

ShieldElement.prototype.isCountyShield = function (config) {
  const normalized = ShieldElement.prototype.normalizeShieldCode(
    config?.value || config?.assetName || ""
  );

  return config?.county === true || normalized === "C";
};

ShieldElement.prototype.getEffectiveSizeClass = function (routeNumber, variant) {
  const normalizedVariant = ShieldElement.prototype.formatVariantKey(variant);

  if (normalizedVariant === "2Digit") {
    return "two";
  }
  if (normalizedVariant === "3Digit") {
    return "three";
  }
  if (normalizedVariant === "4Digit") {
    return "four";
  }

    return ShieldElement.prototype.getRouteSizeClassFromCount(
      ShieldElement.prototype.getRouteCharacterCount(routeNumber)
    );
};

class DividerElement {
  constructor({
    dividerWidth = 100,
    dividerMeasurement = "%",
    dividerHeight = 0.2,
    orientation = DividerElement.prototype.defaultOrientation,
    alignment = "Center",
    visible = true,
    dividerColor = "White",
    fullBleed = false,
  } = {}) {
    this.dividerWidth = dividerWidth;
    this.dividerMeasurement = dividerMeasurement;
    this.dividerHeight = dividerHeight;
    this.orientation =
      DividerElement.prototype.normalizeOrientation(orientation);
    this.alignment = alignment;
    this.visible = visible;
    this.dividerColor = dividerColor;
    this.fullBleed = fullBleed;
  }

  createElement(panel) {
    const newDivider = document.createElement("div");
    const isVertical =
      this.orientation === DividerElement.prototype.verticalOrientation;
    newDivider.className = "dividerElement" + (isVertical ? " vertical" : "");
    newDivider.style.visibility = this.visible ? "visible" : "hidden";
    const lengthValue = this.dividerWidth + this.dividerMeasurement;
    const thicknessValue = this.dividerHeight + "rem";
    newDivider.style.setProperty(
      "--dividerWidth",
      lengthValue
    );
    newDivider.style.setProperty("--dividerHeight", thicknessValue);
    newDivider.style.setProperty("--dividerLength", lengthValue);
    newDivider.style.setProperty("--dividerThickness", thicknessValue);
    newDivider.style.marginTop = "0";
    newDivider.style.marginBottom = "0";

    if (this.dividerColor && this.dividerColor !== "Default") {
      const resolvedColor =
        lib.colors[this.dividerColor] || this.dividerColor || "";
      if (resolvedColor) {
        newDivider.style.backgroundColor = resolvedColor;
      }
    }

    if (this.fullBleed) {
      newDivider.classList.add("fullBleed");
      const paddingString = panel?.sign?.padding || "";
      const paddingValues = paddingString.trim().split(/\s+/).filter(Boolean);

      let top = "0rem",
        right = "0rem",
        bottom = "0rem",
        left = "0rem";

      if (paddingValues.length === 1) {
        top = right = bottom = left = paddingValues[0];
      } else if (paddingValues.length === 2) {
        top = bottom = paddingValues[0];
        right = left = paddingValues[1];
      } else if (paddingValues.length === 3) {
        [top, right, bottom] = paddingValues;
        left = right;
      } else if (paddingValues.length >= 4) {
        [top, right, bottom, left] = paddingValues;
      }

      newDivider.style.setProperty(
        "--dividerBleedLeft",
        !isVertical ? left || "0rem" : "0rem"
      );
      newDivider.style.setProperty(
        "--dividerBleedRight",
        !isVertical ? right || "0rem" : "0rem"
      );
      newDivider.style.setProperty(
        "--dividerBleedTop",
        isVertical ? top || "0rem" : "0rem"
      );
      newDivider.style.setProperty(
        "--dividerBleedBottom",
        isVertical ? bottom || "0rem" : "0rem"
      );
    } else {
      newDivider.classList.remove("fullBleed");
      newDivider.style.setProperty("--dividerBleedLeft", "0rem");
      newDivider.style.setProperty("--dividerBleedRight", "0rem");
      newDivider.style.setProperty("--dividerBleedTop", "0rem");
      newDivider.style.setProperty("--dividerBleedBottom", "0rem");
    }

    return newDivider;
  }
}

DividerElement.prototype.dividerMeasurement = ["%", "rem"];
DividerElement.prototype.orientations = ["Horizontal", "Vertical"];
DividerElement.prototype.defaultOrientation = "Horizontal";
DividerElement.prototype.verticalOrientation = "Vertical";
DividerElement.prototype.normalizeOrientation = function (value) {
  const options = DividerElement.prototype.orientations || [];
  return options.includes(value)
    ? value
    : DividerElement.prototype.defaultOrientation;
};
DividerElement.prototype.dividerColors = [{ value: "Default", label: "Default" }].concat(
  Object.keys(lib.colors || {}).map((colorName) => ({
    value: colorName,
    label: colorName,
  }))
);

class IconElement {
  constructor(options = {}) {
    const icon = getStoredDefaultsOption(
      options,
      "icon",
      "settingsDefaultsIconValue",
      IconElement.prototype.defaultIcon
    );

    const iconSize = getStoredDefaultsOption(
      options,
      "iconSize",
      "settingsDefaultsIconSize",
      3
    );

    const backgroundColor = getStoredDefaultsOption(
      options,
      "backgroundColor",
      "settingsDefaultsIconBgColor",
      "Inherit"
    );

    const border = getStoredDefaultsOption(
      options,
      "border",
      "settingsDefaultsIconBorder",
      false
    );

    const borderRadius = Object.prototype.hasOwnProperty.call(options, "borderRadius")
      ? options.borderRadius
      : 4;

    const borderColor = Object.prototype.hasOwnProperty.call(options, "borderColor")
      ? options.borderColor
      : "White";

    const spacing = getStoredDefaultsOption(
      options,
      "spacing",
      "settingsDefaultsIconSpacing",
      0
    );

    const alignment = getStoredDefaultsOption(
      options,
      "alignment",
      "settingsDefaultsIconAlignment",
      "Center"
    );

    this.icon = IconElement.prototype.icons[icon]
      ? icon
      : IconElement.prototype.defaultIcon;
    this.iconSize = normalizeStoredDefaultsNumber(iconSize, 3);
    this.backgroundColor = backgroundColor;
    this.border = normalizeStoredDefaultsBoolean(border);
    this.borderRadius = normalizeStoredDefaultsNumber(borderRadius, 4);
    this.borderColor = borderColor;
    this.spacing = normalizeStoredDefaultsNumber(spacing, 0);
    this.alignment = normalizeStoredDefaultsAlignment(alignment);
  }
  
  createElement() {
    const container = document.createElement("div");
    container.className = "bE-iconElement";

    const parsedSpacing = parseFloat(this.spacing);
    const spacing = isNaN(parsedSpacing) ? 0 : parsedSpacing;
    container.style.setProperty("--spacing", spacing + "rem");

    const resolvedBgColor = lib.colors[this.backgroundColor] || this.backgroundColor.toLowerCase();
    container.style.setProperty("--iconBgColor", resolvedBgColor);

    container.style.setProperty("--borderRadius", this.borderRadius + "px");

    const resolvedBorderColor = lib.colors[this.borderColor] || this.borderColor.toLowerCase();
    container.style.setProperty("--iconBorderColor", resolvedBorderColor);

    const parsedSize = parseFloat(this.iconSize);
    const size = isNaN(parsedSize) ? 3 : parsedSize;
    container.style.setProperty("--iconSize", size + "rem");

    if (this.border) {
      container.classList.add("hasBorder");
    }

    if (this.backgroundColor !== "Inherit") {
      container.classList.add("hasBackground");
    }

    const iconDefinition =
      IconElement.prototype.icons[this.icon] ||
      IconElement.prototype.icons[IconElement.prototype.defaultIcon];

    if (iconDefinition) {
      const img = document.createElement("img");
      img.src = iconDefinition.src;
      img.alt = iconDefinition.label;
      img.loading = "lazy";
      img.decoding = "async";
      img.draggable = false;
      container.appendChild(img);
    } else {
      container.textContent = "Icon unavailable";
    }

    return container;
  }
}

IconElement.prototype.defaultIcon = "AIRPORT";
IconElement.prototype.icons = {
  "511": { label: "511", src: "img/icons/511.svg" },
  "AIRPORT": { label: "Airport", src: "img/icons/AIRPORT.svg" },
  "ALLTERRAIN_TRAIL": { label: "All-Terrain Trail", src: "img/icons/ALLTERRAIN_TRAIL.svg" },
  "ALTERNATIVE_FUEL_COMPRESSED_NATURAL_GAS": { label: "Alternative Fuel (Compressed Natural Gas)", src: "img/icons/ALTERNATIVE_FUEL_COMPRESSED_NATURAL_GAS.svg" },
  "ALTERNATIVE_FUEL_ETHANOL": { label: "Alternative Fuel (Ethanol)", src: "img/icons/ALTERNATIVE_FUEL_ETHANOL.svg" },
  "ARCHERY": { label: "Archery", src: "img/icons/ARCHERY.svg" },
  "BASEBALL": { label: "Baseball", src: "img/icons/BASEBALL.svg" },
  "BEACH": { label: "Beach", src: "img/icons/BEACH.svg" },
  "BEAR_VIEWING_AREA": { label: "Bear Viewing Area", src: "img/icons/BEAR_VIEWING_AREA.svg" },
  "BIKE": { label: "Bike", src: "img/icons/BIKE.svg" },
  "BIOFUEL": { label: "Biofuel", src: "img/icons/BIOFUEL.svg" },
  "BOAT_RAMP": { label: "Boat Ramp", src: "img/icons/BOAT_RAMP.svg" },
  "BUS_STATION": { label: "Bus Station", src: "img/icons/BUS_STATION.svg" },
  "BUS_STOP": { label: "Bus Stop", src: "img/icons/BUS_STOP.svg" },
  "CAMPFIRES": { label: "Campfires", src: "img/icons/CAMPFIRES.svg" },
  "CAMPING": { label: "Camping", src: "img/icons/CAMPING.svg" },
  "CANOEING": { label: "Canoeing", src: "img/icons/CANOEING.svg" },
  "CHAIR_LIFTSKI_LIFT": { label: "Chair Lift/Ski Lift", src: "img/icons/CHAIR_LIFTSKI_LIFT.svg" },
  "CLIMBING": { label: "Climbing", src: "img/icons/CLIMBING.svg" },
  "CROSS_COUNTRY_SKIING": { label: "Cross Country Skiing", src: "img/icons/CROSS_COUNTRY_SKIING.svg" },
  "DEER_VIEWING_AREA": { label: "Deer Viewing Area", src: "img/icons/DEER_VIEWING_AREA.svg" },
  "DIESEL_FUEL": { label: "Diesel Fuel", src: "img/icons/DIESEL_FUEL.svg" },
  "DOG_SLEDDING": { label: "Dog Sledding", src: "img/icons/DOG_SLEDDING.svg" },
  "DONT_WALK": { label: "Don't Walk", src: "img/icons/DONT_WALK.svg" },
  "ELECTRICAL_HOOKUP": { label: "Electrical Hookup", src: "img/icons/ELECTRICAL_HOOKUP.svg" },
  "ELECTRIC_VEHICLE_CHARGING": { label: "EV Charging", src: "img/icons/ELECTRIC_VEHICLE_CHARGING.svg" },
  "EMERGENCY_MEDICAL_SERVICES": { label: "EMS", src: "img/icons/EMERGENCY_MEDICAL_SERVICES.svg" },
  "EXIT_INSERT": { label: "Exit Insert", src: "img/icons/EXIT_INSERT.png" },
  "FIRE_EXTINGUISHER": { label: "Fire Extinguisher", src: "img/icons/FIRE_EXTINGUISHER.svg" },
  "FIRST_AID": { label: "First Aid", src: "img/icons/FIRST_AID.svg" },
  "FISHING_AREA": { label: "Fishing Area", src: "img/icons/FISHING_AREA.svg" },
  "FOOD": { label: "Food", src: "img/icons/FOOD.svg" },
  "GAS": { label: "Gas", src: "img/icons/GAS.svg" },
  "GOLFING": { label: "Golfing", src: "img/icons/GOLFING.svg" },
  "HAND_LAUNCHSMALL_BOAT_LAUNCH": { label: "Hand Launch/Small Boat Launch", src: "img/icons/HAND_LAUNCHSMALL_BOAT_LAUNCH.svg" },
  "HIKING_TRAIL": { label: "Hiking Trail", src: "img/icons/HIKING_TRAIL.svg" },
  "HM": { label: "HM", src: "img/icons/HM.png" },
  "HORSE_TRAIL": { label: "Horse Trail", src: "img/icons/HORSE_TRAIL.svg" },
  "HOSPITAL": { label: "Hospital", src: "img/icons/HOSPITAL.svg" },
  "HOV": { label: "HOV", src: "img/icons/HOV.png" },
  "HYDROGEN_FUEL": { label: "Hydrogen Fuel", src: "img/icons/HYDROGEN_FUEL.svg" },
  "INLINE_SKATING": { label: "Inline Skating", src: "img/icons/INLINE_SKATING.svg" },
  "INTERNATIONAL_SYMBOL_OF_ACCESSIBILITY": { label: "Accessibility", src: "img/icons/INTERNATIONAL_SYMBOL_OF_ACCESSIBILITY.svg" },
  "JET_SKIPERSONAL_WATERCRAFT": { label: "Jet Ski", src: "img/icons/JET_SKIPERSONAL_WATERCRAFT.svg" },
  "LAUNDROMAT": { label: "Laundromat", src: "img/icons/LAUNDROMAT.svg" },
  "LIBRARY": { label: "Library", src: "img/icons/LIBRARY.svg" },
  "LIGHTHOUSE": { label: "Lighthouse", src: "img/icons/LIGHTHOUSE.svg" },
  "LIGHT_RAIL_TRANSIT_STATION": { label: "Light Rail Station", src: "img/icons/LIGHT_RAIL_TRANSIT_STATION.svg" },
  "LIQUEFIED_NATURAL_GAS": { label: "Liquefied Natural Gas", src: "img/icons/LIQUEFIED_NATURAL_GAS.svg" },
  "LIQUEFIED_PETROLEUM_GAS": { label: "Liquefied Petroleum Gas", src: "img/icons/LIQUEFIED_PETROLEUM_GAS.svg" },
  "LITTER_CONTAINER": { label: "Litter Container", src: "img/icons/LITTER_CONTAINER.svg" },
  "LODGING": { label: "Lodging", src: "img/icons/LODGING.svg" },
  "LOOKOUT_TOWER": { label: "Lookout Tower", src: "img/icons/LOOKOUT_TOWER.svg" },
  "MARINA": { label: "Marina", src: "img/icons/MARINA.svg" },
  "MENS_RESTROOM": { label: "Men's Restroom", src: "img/icons/MENS_RESTROOM.svg" },
  "MOTORBOATING": { label: "Motorboating", src: "img/icons/MOTORBOATING.svg" },
  "NATURE_STUDY_AREA": { label: "Nature Study Area", src: "img/icons/NATURE_STUDY_AREA.svg" },
  "NO-HM": { label: "No HM", src: "img/icons/NO-HM.png" },
  "PARKING": { label: "Parking", src: "img/icons/PARKING.svg" },
  "PASSENGERS_ONLY_FERRY_TERMINAL": { label: "Passengers Only Ferry Terminal", src: "img/icons/PASSENGERS_ONLY_FERRY_TERMINAL.svg" },
  "PEDESTRIAN": { label: "Pedestrian", src: "img/icons/PEDESTRIAN.svg" },
  "PHARMACY": { label: "Pharmacy", src: "img/icons/PHARMACY.svg" },
  "PICKUP_TRUCKS": { label: "Pickup Trucks", src: "img/icons/PICKUP_TRUCKS.svg" },
  "PICNIC_SHELTER": { label: "Picnic Shelter", src: "img/icons/PICNIC_SHELTER.svg" },
  "PICNIC_SITE": { label: "Picnic Site", src: "img/icons/PICNIC_SITE.svg" },
  "POLICE": { label: "Police", src: "img/icons/POLICE.svg" },
  "POST_OFFICE": { label: "Post Office", src: "img/icons/POST_OFFICE.svg" },
  "RECREATIONAL_VEHICLE_SITE": { label: "RV Site", src: "img/icons/RECREATIONAL_VEHICLE_SITE.svg" },
  "RECYCLING": { label: "Recycling", src: "img/icons/RECYCLING.svg" },
  "RESTROOMS": { label: "Restrooms", src: "img/icons/RESTROOMS.svg" },
  "RV_SANITARY_STATION": { label: "RV Sanitary Station", src: "img/icons/RV_SANITARY_STATION.svg" },
  "SCHOOL_BUS": { label: "School Bus", src: "img/icons/SCHOOL_BUS.svg" },
  "SCHOOL_CROSSING": { label: "School Crossing", src: "img/icons/SCHOOL_CROSSING.svg" },
  "SCUBA_DIVING": { label: "Scuba Diving", src: "img/icons/SCUBA_DIVING.svg" },
  "SEAL_VIEWING": { label: "Seal Viewing", src: "img/icons/SEAL_VIEWING.svg" },
  "SEA_PLANE": { label: "Sea Plane", src: "img/icons/SEA_PLANE.svg" },
  "SHOWERS": { label: "Showers", src: "img/icons/SHOWERS.svg" },
  "SKATEBOARDING": { label: "Skateboarding", src: "img/icons/SKATEBOARDING.svg" },
  "SLEDDING": { label: "Sledding", src: "img/icons/SLEDDING.svg" },
  "SLEEPING_SHELTER": { label: "Sleeping Shelter", src: "img/icons/SLEEPING_SHELTER.svg" },
  "SMOKING": { label: "Smoking", src: "img/icons/SMOKING.svg" },
  "SNOWSHOEING": { label: "Snowshoeing", src: "img/icons/SNOWSHOEING.svg" },
  "SNOW_TUBING": { label: "Snow Tubing", src: "img/icons/SNOW_TUBING.svg" },
  "SPELUNKINGCAVES": { label: "Spelunking/Caves", src: "img/icons/SPELUNKINGCAVES.svg" },
  "STOP": { label: "Stop", src: "img/icons/STOP.svg" },
  "SWIMMING": { label: "Swimming", src: "img/icons/SWIMMING.svg" },
  "TECHNICAL_ROCK_CLIMBING": { label: "Technical Rock Climbing", src: "img/icons/TECHNICAL_ROCK_CLIMBING.svg" },
  "TELECOMMUNICATIONS_DEVICE_FOR_THE_DEAF": { label: "Telecommunications Device for the Deaf", src: "img/icons/TELECOMMUNICATIONS_DEVICE_FOR_THE_DEAF.svg" },
  "TELEPHONE": { label: "Telephone", src: "img/icons/TELEPHONE.svg" },
  "TENNIS": { label: "Tennis", src: "img/icons/TENNIS.svg" },
  "TOURIST_INFORMATION": { label: "Tourist Information", src: "img/icons/TOURIST_INFORMATION.svg" },
  "TRAILER_SITE": { label: "Trailer Site", src: "img/icons/TRAILER_SITE.svg" },
  "TRAIN_STATION": { label: "Train Station", src: "img/icons/TRAIN_STATION.svg" },
  "TRAMWAY": { label: "Tramway", src: "img/icons/TRAMWAY.svg" },
  "TRASH_DUMPSTER": { label: "Trash Dumpster", src: "img/icons/TRASH_DUMPSTER.svg" },
  "TRUCK_EXTERNAL_POWER": { label: "Truck External Power", src: "img/icons/TRUCK_EXTERNAL_POWER.svg" },
  "TRUCK_PARKING": { label: "Truck Parking", src: "img/icons/TRUCK_PARKING.svg" },
  "TUNNEL": { label: "Tunnel", src: "img/icons/TUNNEL.svg" },
  "VEHICLE_FERRY_STATION": { label: "Vehicle Ferry", src: "img/icons/VEHICLE_FERRY_STATION.svg" },
  "VIEWING_AREA": { label: "Viewing Area", src: "img/icons/VIEWING_AREA.svg" },
  "WATERSKIING": { label: "Waterskiing", src: "img/icons/WATERSKIING.svg" },
  "WHALE_VIEWING": { label: "Whale Viewing", src: "img/icons/WHALE_VIEWING.svg" },
  "WILDLIFE_VIEWING": { label: "Wildlife Viewing", src: "img/icons/WILDLIFE_VIEWING.svg" },
  "WINTER_RECREATIONAL_AREA": { label: "Winter Rec Area", src: "img/icons/WINTER_RECREATIONAL_AREA.svg" },
  "WIRELESS_INTERNET": { label: "WiFi", src: "img/icons/WIRELESS_INTERNET.svg" },
  "WOMENS_RESTROOM": { label: "Women's Restroom", src: "img/icons/WOMENS_RESTROOM.svg" },
  "YIELD": { label: "Yield", src: "img/icons/YIELD.svg" }
};

class BeaconElement {
  constructor({
    size = 2,
    alignment = "Center",
    flashDuration = 1,
    color = "Yellow",
    backplate = false,
    flashOpposite = false,
  } = {}) {
    const parsedSize = parseFloat(size);
    this.size = Number.isFinite(parsedSize) ? Math.max(parsedSize, 0.5) : 2;
    const parsedDuration = parseFloat(flashDuration);
    this.flashDuration =
      Number.isFinite(parsedDuration) && parsedDuration > 0
        ? parsedDuration
        : 1;
    const validAlignments = Array.isArray(TextElement.prototype.alignment)
      ? TextElement.prototype.alignment
      : [];
    this.alignment = validAlignments.includes(alignment) ? alignment : "Center";
    const availableColors = Array.isArray(BeaconElement.prototype.colors)
      ? BeaconElement.prototype.colors
      : [];
    this.color = availableColors.includes(color)
      ? color
      : availableColors[0] || "Yellow";
    this.backplate =
      backplate === true ||
      backplate === "true" ||
      backplate === 1 ||
      backplate === "1";
    this.flashOpposite =
      flashOpposite === true ||
      flashOpposite === "true" ||
      flashOpposite === 1 ||
      flashOpposite === "1";
  }

  createElement() {
    const parsedSize = parseFloat(this.size);
    const beaconSize = Number.isFinite(parsedSize) ? parsedSize : 2;
    const parsedDuration = parseFloat(this.flashDuration);
    const flashDuration =
      Number.isFinite(parsedDuration) && parsedDuration > 0
        ? parsedDuration
        : 1;

    const container = document.createElement("div");
    container.className = "bE-beaconElement";
    container.style.setProperty("--beaconSize", Math.max(beaconSize, 0.5) + "rem");
    container.style.setProperty("--beaconFlashDuration", flashDuration + "s");
    const resolvedColor =
      (lib?.colors && lib.colors[this.color]) || this.color || "Yellow";
    container.style.setProperty(
      "--beaconBulbColor",
      typeof resolvedColor === "string" ? resolvedColor : "Yellow"
    );
    container.style.setProperty(
      "--beaconBackplateThickness",
      BeaconElement.prototype.backplateThicknessRem + "rem"
    );
    container.style.setProperty(
      "--beaconBackplateRadius",
      BeaconElement.prototype.backplateCornerRadiusRem + "rem"
    );
    const backplateColorReference = BeaconElement.prototype.backplateColor;
    const resolvedBackplateColor =
      (lib?.colors && lib.colors[backplateColorReference]) ||
      BeaconElement.prototype.backplateFallbackColor ||
      backplateColorReference;
    container.style.setProperty(
      "--beaconBackplateColor",
      resolvedBackplateColor
    );
    if (this.backplate) {
      container.classList.add("hasBackplate");
    }
    if (this.flashOpposite) {
      container.classList.add("flashOpposite");
    }

    const bulb = document.createElement("div");
    bulb.className = "bE-beaconBulb";
    container.appendChild(bulb);

    return container;
  }
}

BeaconElement.prototype.colors = ["Yellow", "Red", "Purple"];
BeaconElement.prototype.halfInchInRem = 0.5 / 12;
BeaconElement.prototype.backplateThicknessRem =
  BeaconElement.prototype.halfInchInRem * 3;
BeaconElement.prototype.backplateCornerRadiusRem = 0.15;
BeaconElement.prototype.backplateColor = "Yellow";
BeaconElement.prototype.backplateFallbackColor = "#ffd200";

class ArrowElement {
  constructor(options = {}) {
    const arrow = getStoredDefaultsOption(
      options,
      "arrow",
      "settingsDefaultsArrowValue",
      ArrowElement.prototype.defaultArrow
    );

    const rotation = getStoredDefaultsOption(
      options,
      "rotation",
      "settingsDefaultsArrowRotation",
      0
    );

    const size = getStoredDefaultsOption(
      options,
      "size",
      "settingsDefaultsArrowSize",
      ArrowElement.prototype.defaultSize
    );

    const fallbackPadding =
      Object.prototype.hasOwnProperty.call(options, "padding") &&
      options.padding !== null &&
      options.padding !== undefined
        ? options.padding
        : 0;

    const paddingHorizontal = getStoredDefaultsOption(
      options,
      "paddingHorizontal",
      "settingsDefaultsArrowHorizontalPadding",
      fallbackPadding
    );

    const paddingVertical = getStoredDefaultsOption(
      options,
      "paddingVertical",
      "settingsDefaultsArrowVerticalPadding",
      fallbackPadding
    );

    const flip = Object.prototype.hasOwnProperty.call(options, "flip")
      ? options.flip
      : false;

    const alignment = getStoredDefaultsOption(
      options,
      "alignment",
      "settingsDefaultsArrowAlignment",
      "Center"
    );

    const resolveArrowKey = ArrowElement.prototype.arrows[arrow]
      ? arrow
      : ArrowElement.prototype.defaultArrow;

    this.arrow = resolveArrowKey;
    this.rotation = normalizeStoredDefaultsNumber(rotation, 0);
    this.flip = normalizeStoredDefaultsBoolean(flip);

    const arrowDefinition = ArrowElement.prototype.arrows[this.arrow] || {};
    const defaultSize =
      typeof arrowDefinition.defaultSize === "number"
        ? arrowDefinition.defaultSize
        : ArrowElement.prototype.defaultSize;

    this.size = normalizeStoredDefaultsNumber(size, defaultSize);
    this.paddingHorizontal = normalizeStoredDefaultsNumber(paddingHorizontal, 0);
    this.paddingVertical = normalizeStoredDefaultsNumber(paddingVertical, 0);
    this.alignment = normalizeStoredDefaultsAlignment(alignment);
  }
  
  createElement() {
    const container = document.createElement("div");
    container.className = "bE-arrowElement";

    const arrowDefinition =
      ArrowElement.prototype.arrows[this.arrow] ||
      ArrowElement.prototype.arrows[ArrowElement.prototype.defaultArrow];
    const img = document.createElement("img");
    img.src = arrowDefinition.src;
    img.alt = arrowDefinition.label;
    img.loading = "lazy";
    img.decoding = "async";
    img.draggable = false;
    container.appendChild(img);

    const parsedRotation = parseFloat(this.rotation);
    if (!isNaN(parsedRotation)) {
      container.style.setProperty("--arrowRotation", parsedRotation + "deg");
    }

    const parsedSize = parseFloat(this.size);
    if (!isNaN(parsedSize)) {
      container.style.setProperty(
        "--arrowSize",
        Math.max(parsedSize, 0) + "rem"
      );
    }

    const horizontalPadding = parseFloat(
      this.paddingHorizontal !== undefined
        ? this.paddingHorizontal
        : this.padding
    );
    const verticalPadding = parseFloat(
      this.paddingVertical !== undefined ? this.paddingVertical : this.padding
    );

    container.style.setProperty(
      "--arrowPaddingHorizontal",
      Math.max(isNaN(horizontalPadding) ? 0 : horizontalPadding, 0) + "rem"
    );
    container.style.setProperty(
      "--arrowPaddingVertical",
      Math.max(isNaN(verticalPadding) ? 0 : verticalPadding, 0) + "rem"
    );

    container.style.setProperty("--arrowFlip", this.flip ? "-1" : "1");

    return container;
  }
}

ArrowElement.prototype.arrows = {
  TYPE_A: { label: "Type A", src: "img/arrowBlocks/TYPE_A.svg" },
  TYPE_A_EXTENDED: {
    label: "Type A Extended",
    src: "img/arrowBlocks/TYPE_A_EXTENDED.svg",
  },
  TYPE_B: { label: "Type B", src: "img/arrowBlocks/TYPE_B.svg" },
  TYPE_C_45: { label: "Type C 45", src: "img/arrowBlocks/TYPE_C_45.svg" },
  TYPE_C_45_ALT: { label: "Type C 45 (alt)", src: "img/arrowBlocks/TYPE_C_45_ALT.svg" },
  TYPE_C_90: { label: "Type C 90", src: "img/arrowBlocks/TYPE_C_90.svg" },
  TYPE_D: { label: "Type D", src: "img/arrowBlocks/TYPE_D.svg" },
  DOWN: { label: "Down", src: "img/arrowBlocks/DOWN.svg", defaultSize: 2.75 },
  DOWN_CA: {
    label: "Down (CA)",
    src: "img/arrowBlocks/DOWN_CA.svg",
    defaultSize: 2.75,
  },
  UK: { label: "UK", src: "img/arrowBlocks/UK.svg" },
  APL_UP: { label: "APL Up", src: "img/arrowBlocks/APL_UP.svg" },
  APL_UP_TURN: { label: "APL Up Turn", src: "img/arrowBlocks/APL_UP_TURN.svg" },
  APL_TURN: { label: "APL Turn", src: "img/arrowBlocks/APL_TURN.svg" },
  APL_DUAL_TURN: { label: "APL Dual Turn", src: "img/arrowBlocks/APL_DUAL_TURN.svg" },
};
ArrowElement.prototype.defaultArrow = "TYPE_A";
ArrowElement.prototype.defaultSize = 1.75;
ArrowElement.prototype.arrowKeys = Object.keys(ArrowElement.prototype.arrows);

class TollLogoElement {
  constructor(options = {}) {
    const logo = getStoredDefaultsOption(
      options,
      "logo",
      "settingsDefaultsTollLogoValue",
      TollLogoElement.prototype.defaultLogo
    );

    const logoHeight = getStoredDefaultsOption(
      options,
      "logoHeight",
      "settingsDefaultsTollLogoSize",
      3
    );

    const spacing = getStoredDefaultsOption(
      options,
      "spacing",
      "settingsDefaultsTollLogoSpacing",
      0
    );

    const backgroundColor = getStoredDefaultsOption(
      options,
      "backgroundColor",
      "settingsDefaultsTollLogoBgColor",
      "Inherit"
    );

    const horizontalPadding = getStoredDefaultsOption(
      options,
      "horizontalPadding",
      "settingsDefaultsTollLogoHorizontalBgPadding",
      0.2
    );

    const verticalPadding = getStoredDefaultsOption(
      options,
      "verticalPadding",
      "settingsDefaultsTollLogoVerticalBgPadding",
      0.05
    );

    const squareIcon = getStoredDefaultsOption(
      options,
      "squareIcon",
      "settingsDefaultsTollLogoSquareIcon",
      false
    );

    const borderRadius = getStoredDefaultsOption(
      options,
      "borderRadius",
      "settingsDefaultsTollLogoBorderRadius",
      0
    );

    const hasOnlyBlock = getStoredDefaultsOption(
      options,
      "hasOnlyBlock",
      "settingsDefaultsTollLogoShowOnlyBlock",
      false
    );

    const background = Object.prototype.hasOwnProperty.call(options, "background")
      ? options.background
      : String(backgroundColor || "Inherit") !== "Inherit";

    const alignment = Object.prototype.hasOwnProperty.call(options, "alignment")
      ? options.alignment
      : "Center";

    this.logo = TollLogoElement.prototype.logos[logo]
      ? logo
      : TollLogoElement.prototype.defaultLogo;
    this.logoHeight = normalizeStoredDefaultsNumber(logoHeight, 3);
    this.spacing = normalizeStoredDefaultsNumber(spacing, 0);
    this.background = normalizeStoredDefaultsBoolean(background);
    this.squareIcon = normalizeStoredDefaultsBoolean(squareIcon);
    this.borderRadius = normalizeStoredDefaultsNumber(borderRadius, 0);
    this.backgroundColor = backgroundColor;
    this.horizontalPadding = normalizeStoredDefaultsNumber(horizontalPadding, 0.2);
    this.verticalPadding = normalizeStoredDefaultsNumber(verticalPadding, 0.05);
    this.hasOnlyBlock = normalizeStoredDefaultsBoolean(hasOnlyBlock);
    this.alignment = normalizeStoredDefaultsAlignment(alignment);
  }

  createElement() {
    const container = document.createElement("div");
    container.className = "bE-tollLogoElement";

    const parsedSpacing = parseFloat(this.spacing);
    const spacing = isNaN(parsedSpacing) ? 0 : parsedSpacing;
    container.style.setProperty("--spacing", spacing + "rem");
    container.style.setProperty(
      "--tollBgColor",
      lib.colors[this.backgroundColor] || this.backgroundColor.toLowerCase()
    );
    container.style.setProperty("--borderRadius", this.borderRadius + "px");
    container.style.setProperty(
      "--horizPadding",
      this.horizontalPadding + "rem"
    );
    container.style.setProperty("--vertPadding", this.verticalPadding + "rem");
    container.style.setProperty("--tollLogoHeight", this.logoHeight + "rem");

    if (this.background) {
      container.classList.add("hasBackground");
    }

    if (this.squareIcon) {
      container.style.aspectRatio = "1 / 1";
    }

    const logoDefinition =
      TollLogoElement.prototype.logos[this.logo] ||
      TollLogoElement.prototype.logos[TollLogoElement.prototype.defaultLogo];

    if (logoDefinition) {
      const img = document.createElement("img");
      img.src = logoDefinition.src;
      img.alt = logoDefinition.label;
      img.loading = "lazy";
      img.decoding = "async";
      img.draggable = false;
      container.appendChild(img);
    } else {
      container.textContent = "Toll logo unavailable";
    }

    if (this.hasOnlyBlock) {
      const onlyBlock = document.createElement("div");
      onlyBlock.className = "bE-tollOnlyBlock";
      onlyBlock.textContent = "ONLY";
      container.appendChild(onlyBlock);
      container.classList.add("hasOnlyBlock");

      if (
        this.backgroundColor.toLowerCase() == "white" ||
        this.backgroundColor.toLowerCase() == "yellow" ||
        this.backgroundColor.toLowerCase() == "fluorescent yellow-green" ||
        this.backgroundColor.toLowerCase() == "orange"
      ) {
        container.classList.add("inverseColor");
      }
    }

    return container;
  }
}

TollLogoElement.prototype.defaultLogo = "EZPass";
TollLogoElement.prototype.logos = {
  EZPass: { label: "E-ZPass", src: "img/tolls/EZPass.png" },
  TollTag: { label: "TollTag", src: "img/tolls/NTTA.svg" },
  TxTag: { label: "TxTag", src: "img/tolls/TXTAG.svg" },
  EZTAG: { label: "EZ TAG Square", src: "img/tolls/EZTAG.svg" },
  EZTAG2: { label: "EZ TAG Wide", src: "img/tolls/EZTAG-Sign-Wide.svg" },
  EZTAG3: {
    label: "EZ TAG FHWA Wide",
    src: "img/tolls/EZTAG-Sign-Wide-Alt.svg",
  },
  FasTrak: { label: "FasTrak", src: "img/tolls/FASTrak.png" },
  FreedomPass: { label: "Freedom Pass", src: "img/tolls/FREEDOMPASS.svg" },
  PeachPass: { label: "Peach Pass", src: "img/tolls/PEACHPASS.svg" },
  PeachPassAlt: { label: "Peach Pass (alt)", src: "img/tolls/PEACHPASS_ALT.png" },
  NCQuickPass: { label: "NC Quick Pass", src: "img/tolls/NCQUICKPASS.svg" },
  EPASS: { label: "E-PASS", src: "img/tolls/EPASS.svg" },
  SunPassOld: { label: "SunPass (old)", src: "img/tolls/SUNPASS-1.svg" },
  SunPassNew: { label: "SunPass (new)", src: "img/tolls/SUNPASS-2.svg" },
  ZipCash: { label: "ZipCash", src: "img/tolls/ZIPCASH.svg" },
  LEEWAY: { label: "LeeWay", src: "img/tolls/LEEWAY.svg" },
  KTAG: { label: "K-TAG", src: "img/tolls/KTAG.svg" },
  PikePassOld: { label: "Pikepass (old)", src: "img/tolls/PIKEPASS-OLD.svg" },
  PikePassNew: { label: "Pikepass (new)", src: "img/tolls/PIKEPASS-NEW.svg" },
  PlatePay: { label: "PlatePay", src: "img/tolls/PLATEPAY.svg" },
  PayByMail: { label: "Pay By Mail", src: "img/tolls/PAY_BY_MAIL.png" },
  IPASS: { label: "I-Pass", src: "img/tolls/I-Pass.svg" },
  GeauxPass: { label: "GeauxPass", src: "img/tolls/GEAUXPASS.svg" },
  GoodToGo: { label: "Good To Go!", src: "img/tolls/GOODTOGO.svg" },
  ExpressToll: { label: "ExpressToll", src: "img/tolls/EXPRESSTOLL.svg" },
  DPASS: { label: "D-PASS", src: "img/tolls/DPASS.svg" },
  MUTCD: { label: "MUTCD", src: "img/tolls/MUTCD.svg" },
};
TollLogoElement.prototype.alignment = TextElement.prototype.alignment;

class Block {
  constructor({
    topPadding = 0,
    bottomPadding = 0,
    backgroundColor = "Inherit",
    borderColor = "Match BG",
    backgroundFullWidth = true,
    width = 0,
    stretchLeft = true,
    stretchCenter = true,
    stretchRight = true,
  } = {}) {
    this.topPadding = topPadding;
    this.bottomPadding = bottomPadding;
    this.backgroundColor = backgroundColor;
    this.borderColor = borderColor;
    this.backgroundFullWidth = backgroundFullWidth;
    this.width = width;
    this.stretchLeft = stretchLeft;
    this.stretchCenter = stretchCenter;
    this.stretchRight = stretchRight;
  }
}
Block.defaultBorderColor = "Match BG";

class Control {
  constructor({ rows = [], blockProperties = [] } = {}) {
    this.rows = rows;
    this.blockProperties = blockProperties;
  }

  addElement(element, properties, row, column) {
    let newElement = new element(properties);
    if (!this.rows[row]) {
      this.rows[row] = [];
      this.blockProperties[row] = new Block();
    }

    if (column) {
      this.rows[row].splice(column, 0, newElement);
    } else {
      this.rows[row].push(newElement);
    }
  }

  removeElement(row, column) {
    if (row == null || column == null) {
      return;
    }

    this.rows[row].splice(column, 1);
    if (this.rows[row].length == 0) {
      this.rows.splice(row, 1);
      this.blockProperties.splice(row, 1);
      return true;
    }
    return false;
  }

  addRow(row, element) {
    if (this.rows[row] && this.rows[row].length != 0) {
      this.rows.splice(row, 0, []);
      this.blockProperties.splice(row, 0, new Block());
    }
    this.addElement(Control.prototype.blockToClassElems[element], {}, row, 0);
  }

  duplicateRow(row) {
    let newRows = [];
    for (const e of this.rows[row]) {
      const blockElemType = Control.prototype.blockToClassElems.getElem(e);
      newRows.push(
        Object.assign(
          new Control.prototype.blockToClassElems[blockElemType](),
          e
        )
      );
    }
    this.rows.splice(row + 1, 0, newRows);
    this.blockProperties.splice(row + 1, 0, new Block());
  }

  deleteRow(row) {
    this.rows.splice(row, 1);
    this.blockProperties.splice(row, 1);
  }

  createElement(panel, subPanel) {
    const flexBox = document.createElement("div");
    flexBox.className = "blockElementMaster";
    const resolveColorValue = (colorValue) => {
      if (typeof colorValue !== "string") {
        return "";
      }
      const trimmed = colorValue.trim();
      if (!trimmed) {
        return "";
      }
      const paletteValue =
        (lib && lib.colors && lib.colors[trimmed]) || trimmed;
      if (typeof paletteValue === "string") {
        return paletteValue.toLowerCase();
      }
      return paletteValue || "";
    };

    const parsePadding = (paddingString = "") => {
      const defaultPadding = {
        top: "0rem",
        right: "0rem",
        bottom: "0rem",
        left: "0rem",
      };

      if (!paddingString || typeof paddingString !== "string") {
        return defaultPadding;
      }

      const values = paddingString.trim().split(/\s+/).filter(Boolean);
      if (values.length === 0) {
        return defaultPadding;
      }

      if (values.length === 1) {
        return {
          top: values[0],
          right: values[0],
          bottom: values[0],
          left: values[0],
        };
      }

      if (values.length === 2) {
        return {
          top: values[0],
          right: values[1],
          bottom: values[0],
          left: values[1],
        };
      }

      if (values.length === 3) {
        return {
          top: values[0],
          right: values[1],
          bottom: values[2],
          left: values[1],
        };
      }

      return {
        top: values[0],
        right: values[1],
        bottom: values[2],
        left: values[3],
      };
    };

    const signPadding = parsePadding(panel?.sign?.padding);

    const totalRows = this.rows.length;
    for (let i = 0; i < totalRows; i++) {
      const row = this.rows[i];
      const properties = this.blockProperties[i];
      const topPadding = parseFloat(properties.topPadding) || 0;
      const bottomPadding = parseFloat(properties.bottomPadding) || 0;
      const topSpacing = topPadding + "rem";
      const bottomSpacing = bottomPadding + "rem";
      const bleedTop = i === 0 ? signPadding.top : "0rem";
      const bleedBottom = i === totalRows - 1 ? signPadding.bottom : "0rem";

      const flexRow = document.createElement("div");
      flexRow.className = "blockElementRow";
      flexRow.style.setProperty("--marginTop", topSpacing);
      flexRow.style.setProperty("--marginBottom", bottomSpacing);
      flexRow.style.setProperty("--blockPaddingTopExtra", "0rem");
      flexRow.style.setProperty("--blockPaddingBottomExtra", "0rem");
      const resolvedBackgroundColor =
        properties.backgroundColor == "Inherit"
          ? ""
          : (
            lib.colors[properties.backgroundColor] ||
            properties.backgroundColor
          ).toLowerCase();
      flexRow.style.setProperty(
        "--masterBlockBgColor",
        resolvedBackgroundColor
      );

      const usesLightBleedBackground =
        properties.backgroundColor == "Orange" ||
        properties.backgroundColor == "White" ||
        properties.backgroundColor == "Yellow" ||
        properties.backgroundColor == "Fluorescent Yellow-Green" ||
        properties.backgroundColor == "Fluorescent Pink";

      let appliedFullBleedBorderColor = "";
      if (properties.backgroundFullWidth) {
        flexRow.classList.add("fullBleed");
        flexRow.style.setProperty("--blockBleedLeft", signPadding.left);
        flexRow.style.setProperty("--blockBleedRight", signPadding.right);
        flexRow.style.setProperty("--blockBleedTop", bleedTop);
        flexRow.style.setProperty("--blockBleedBottom", bleedBottom);
        flexRow.style.width = "";
        flexRow.style.setProperty("--marginTop", "0rem");
        flexRow.style.setProperty("--marginBottom", "0rem");
        flexRow.style.setProperty("--blockPaddingTopExtra", topSpacing);
        flexRow.style.setProperty("--blockPaddingBottomExtra", bottomSpacing);
        const chosenBorderColor =
          typeof properties.borderColor === "string" &&
            properties.borderColor.trim().length
            ? properties.borderColor
            : Block.defaultBorderColor;
        const resolvedBorderColor =
          chosenBorderColor === Block.defaultBorderColor
            ? usesLightBleedBackground
              ? (lib.colors && lib.colors.Black) || "black"
              : (lib.colors && lib.colors.White) || "white"
            : resolveColorValue(chosenBorderColor);
        if (resolvedBorderColor) {
          flexRow.dataset.fullBleedBorderColor = resolvedBorderColor;
          appliedFullBleedBorderColor = resolvedBorderColor;
        } else {
          delete flexRow.dataset.fullBleedBorderColor;
        }
      } else {
        flexRow.classList.remove("fullBleed");
        flexRow.style.setProperty("--blockBleedLeft", "0rem");
        flexRow.style.setProperty("--blockBleedRight", "0rem");
        flexRow.style.setProperty("--blockBleedTop", "0rem");
        flexRow.style.setProperty("--blockBleedBottom", "0rem");
        flexRow.style.setProperty("--marginTop", topSpacing);
        flexRow.style.setProperty("--marginBottom", bottomSpacing);
        flexRow.style.width =
          properties.width == 0 ? "" : properties.width + "rem";
        delete flexRow.dataset.fullBleedBorderColor;
      }

      if (usesLightBleedBackground) {
        flexRow.style.color = "black";
        if (properties.backgroundFullWidth && !appliedFullBleedBorderColor) {
          const fallbackBorderColor =
            (lib.colors && lib.colors.Black) || "rgb(0, 0, 0)";
          flexRow.dataset.fullBleedBorderColor = fallbackBorderColor;
          appliedFullBleedBorderColor = fallbackBorderColor;
        }
      }

      const leftAlignment = document.createElement("div");
      leftAlignment.className = "blockElementLeft";
      const centerAlignment = document.createElement("div");
      centerAlignment.className = "blockElementCenter";
      const rightAlignment = document.createElement("div");
      rightAlignment.className = "blockElementRight";

      let lastKnownAlignment = centerAlignment;
      let dividerBorderColor = null;
      for (let blockIdx = 0; blockIdx < row.length; blockIdx++) {
        let elem = row[blockIdx];
        switch (elem.alignment) {
          case "Left":
            lastKnownAlignment = leftAlignment;
            break;
          case "Right":
            lastKnownAlignment = rightAlignment;
            break;
          case "Center":
            lastKnownAlignment = centerAlignment;
            break;
          default:
        }

        if (
          elem instanceof DividerElement &&
          elem.fullBleed === true &&
          dividerBorderColor === null
        ) {
          if (elem.dividerColor && elem.dividerColor !== "Default") {
            dividerBorderColor =
              lib.colors[elem.dividerColor] || elem.dividerColor;
          } else {
            dividerBorderColor = lib.colors.White || "white";
          }
        }

        const blockElmt = elem.createElement(panel, subPanel);
        blockElmt.dataset.signRow = i;
        blockElmt.dataset.signBlock = blockIdx;
        lastKnownAlignment.appendChild(blockElmt);
      }

      leftAlignment.style.flexGrow =
        properties.stretchLeft && leftAlignment.children.length > 0 ? "1" : "0";
      centerAlignment.style.flexGrow =
        properties.stretchCenter && centerAlignment.children.length > 0
          ? "1"
          : "0";
      rightAlignment.style.flexGrow =
        properties.stretchRight && rightAlignment.children.length > 0
          ? "1"
          : "0";

      if (dividerBorderColor) {
        const normalizedDividerColor =
          typeof dividerBorderColor === "string"
            ? dividerBorderColor.toLowerCase()
            : dividerBorderColor;
        flexRow.dataset.fullBleedBorderColor = normalizedDividerColor;
        appliedFullBleedBorderColor = normalizedDividerColor;
      }

      flexRow.dataset.lightBackground = usesLightBleedBackground
        ? "true"
        : "false";

      flexRow.appendChild(leftAlignment);
      flexRow.appendChild(centerAlignment);
      flexRow.appendChild(rightAlignment);
      flexBox.appendChild(flexRow);
    }

    return flexBox;
  }
}

Control.prototype.blockToClassElems = {
  ControlTextElement: ControlTextElement,
  DividerElement: DividerElement,
  ShieldElement: ShieldElement,
  AdvisoryMessageElement: AdvisoryMessageElement,
  IconElement: IconElement,
  BeaconElement: BeaconElement,
  ArrowElement: ArrowElement,
  TollLogoElement: TollLogoElement,
  ActionMessageElement: ActionMessageElement,
  ElectronicSignElement: ElectronicSignElement,
  getElem: (elemObj) => {
    if (!elemObj || typeof elemObj !== "object") {
      return null;
    }

    for (const key in Control.prototype.blockToClassElems) {
      if (key === "getElem") {
        continue;
      }

      const ElemClass = Control.prototype.blockToClassElems[key];

      if (typeof ElemClass !== "function" || !ElemClass.prototype) {
        continue;
      }

      if (elemObj instanceof ElemClass) {
        return key;
      }
    }

    return null;
  },
};

Control.prototype.blockElements = {
  ControlTextElement: "Control Text",
  ActionMessageElement: "Action Message",
  AdvisoryMessageElement: "Advisory Message",
  ShieldElement: "Shield",
  ArrowElement: "Arrow",
  DividerElement: "Divider",
  IconElement: "Icon",
  BeaconElement: "Flashing Beacon",
  TollLogoElement: "Toll Logo",
  ElectronicSignElement: "Electronic Sign",
};

Control.prototype.blockInternalElements = {
  ControlTextElement: "sdCtrlText",
  DividerElement: "sdBlocker",
  ShieldElement: "sdShield",
  AdvisoryMessageElement: "sdAdvisory",
  IconElement: "sdIcon",
  BeaconElement: "sdBeacon",
  ArrowElement: "sdArrow",
  TollLogoElement: "sdTollLogo",
  ActionMessageElement: "sdActionMessage",
  ElectronicSignElement: "sdElectronicSign",
};
