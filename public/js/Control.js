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
// Parse whole numeric tokens before considering fractions (never turn 11/20
// into a partial 1/2). Keep saved/editor text unchanged.
const signFractionValues = Object.fromEntries(
  Object.entries(fractionMap).map(([ascii, unicode]) => [unicode, ascii])
);
const signFractionPattern = /(?<![\p{L}\p{N}/⁄.])(?:(\d+)[ \u00a0]+)?(\d+)[/⁄](\d+)(?![\p{L}\p{N}/⁄])|(?:(\d+)[ \u00a0]*)?([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/gu;

// Ink measurements keep Series and Clearview numerals aligned despite their
// different em boxes. No Unicode fraction glyph or fallback font is used.
const signFractionMetrics = new Map();
// Safari's document.fonts.check() reports true before a declared face has
// loaded, so canvas measurements would come from a fallback font. Trust the
// declared FontFace status instead; only undeclared (local) fonts use check().
const isSignFontLoaded = (fontFamily) => {
  if (!document.fonts) return true;
  const faces = [...document.fonts].filter(
    (face) => face.family.replace(/["']/g, "") === fontFamily
  );
  return faces.length
    ? faces.some((face) => face.status === "loaded")
    : document.fonts.check(`1000px "${fontFamily}"`);
};
const getSignFractionMetrics = (fontFamily, value) => {
  const key = `${fontFamily}:${value}`;
  if (signFractionMetrics.has(key)) return signFractionMetrics.get(key);
  const context = document.createElement("canvas").getContext("2d");
  context.font = `1000px "${fontFamily}"`;
  const m = context.measureText(value);
  const result = {
    ascent: m.actualBoundingBoxAscent / 1000,
    descent: m.actualBoundingBoxDescent / 1000,
    left: m.actualBoundingBoxLeft / 1000,
    baseline: ((m.fontBoundingBoxAscent || m.actualBoundingBoxAscent) -
      (m.fontBoundingBoxDescent || 0)) / 2000,
    width: (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) / 1000,
    center: ((m.fontBoundingBoxAscent || m.actualBoundingBoxAscent) -
      (m.fontBoundingBoxDescent || 0) - m.actualBoundingBoxAscent +
      m.actualBoundingBoxDescent) / 2000,
  };
  // Do not retain fallback measurements taken before fonts finish loading.
  if (isSignFontLoaded(fontFamily)) {
    signFractionMetrics.set(key, result);
  }
  return result;
};

const appendSignFractionText = (parent, value, fontFamily, wholeScale = 1) => {
  if (!new RegExp(signFractionPattern.source, "u").test(value)) {
    parent.appendChild(document.createTextNode(value));
    return;
  }
  if (!isSignFontLoaded(fontFamily)) {
    document.fonts.load(`1000px "${fontFamily}"`).then(() => {
      if (isSignFontLoaded(fontFamily)) {
        parent.replaceChildren();
        appendSignFractionText(parent, value, fontFamily, wholeScale);
      }
    }).catch(() => {});
  }
  const cap = getSignFractionMetrics(fontFamily, "0");
  const digitHeight = cap.ascent + cap.descent;
  // Digits sit on the baseline of a digit-height slot whose top is y, so a
  // "1" (no overshoot) shares the letters' baseline. Other ink is top-aligned.
  const appendInk = (host, text, x, y, scale = 1, onBaseline = true) => {
    const m = getSignFractionMetrics(fontFamily, text);
    const span = document.createElement("span");
    span.textContent = text;
    span.style.cssText = `position:absolute;white-space:pre;font-size:${scale}em;line-height:1;left:${x / scale + m.left}em;top:0;`;
    // Remove half-leading so y refers to the glyph's ink top.
    span.style.height = "0";
    span.style.lineHeight = "0";
    span.style.top = `${y / scale + (onBaseline ? cap.ascent : m.ascent) - m.baseline}em`;
    host.appendChild(span);
    return m.width * scale;
  };
  let cursor = 0;
  for (const match of value.matchAll(signFractionPattern)) {
    const unicode = match[5];
    const [numerator, denominator] = unicode
      ? signFractionValues[unicode].split("/") : [match[2], match[3]];
    if (Number(denominator) === 0) continue;
    parent.appendChild(document.createTextNode(value.slice(cursor, match.index)));
    const whole = match[1] || match[4];
    const group = document.createElement("span");
    group.className = "bE-signFractionGroup";
    group.setAttribute("role", "img");
    group.setAttribute("aria-label", `${whole ? whole + " " : ""}${numerator}/${denominator}`);
    const height = digitHeight * 1.5;
    let x = 0;
    if (whole) {
      x = appendInk(group, whole, 0,
        (height - digitHeight * wholeScale) / 2, wholeScale);
      x += 0.5 * digitHeight * wholeScale;
    }
    // CFX 4.6.37: 1/4 and 1/2 are 2 digit-heights wide in CV4;
    // CV5 and 3/4 use 2.2. Other fractions expand to fit their digits.
    const standardWidth = digitHeight *
      (/^Clearview 5/.test(fontFamily) || numerator !== "1" ? 2.2 : 2);
    const nWidth = getSignFractionMetrics(fontFamily, numerator).width;
    const dWidth = getSignFractionMetrics(fontFamily, denominator).width;
    const slash = getSignFractionMetrics(fontFamily, "/");
    const slashScale = height / (slash.ascent + slash.descent);
    const slashWidth = slash.width * slashScale;
    const fractionWidth = numerator.length === 1 && denominator.length === 1
      ? standardWidth : Math.max(standardWidth, nWidth + dWidth + slashWidth);
    appendInk(group, numerator, x, 0);
    appendInk(group, "/", x + nWidth + (fractionWidth - nWidth - dWidth - slashWidth) / 2, 0, slashScale, false);
    appendInk(group, denominator, x + fractionWidth - dWidth, height - digitHeight);
    group.style.cssText = `display:inline-block;position:relative;width:${x + fractionWidth}em;height:${height}em;vertical-align:middle;line-height:0;`;
    // The group's font size is the letters', so center it on their ink even
    // when the whole numeral inside is enlarged.
    group.style.transform = `translateY(${cap.center}em)`;
    group.style.verticalAlign = `${((cap.ascent - cap.descent) * (whole ? wholeScale : 1) - height) / 2}em`;
    parent.appendChild(group);
    cursor = match.index + match[0].length;
  }
  parent.appendChild(document.createTextNode(value.slice(cursor)));
};

// Sign-wide choice between sign-spec fractions (above) and the original
// rendering, which shows typed text and uses the font's Unicode glyph for
// enlarged numerals. The original rendering is the default.
let signFractionsEnabled = false;
const setSignFractionsEnabled = (enabled) => {
  signFractionsEnabled = enabled === true;
};

// Flex centering uses the em box, which sits off the ink in Series fonts;
// scaling it lifts enlarged numerals. Re-center them on the letters' ink.
const centerEnlargedNumeral = (fragment, fontFamily, scale) => {
  const apply = () => {
    const center = getSignFractionMetrics(fontFamily, "0").center;
    // em units here are the numeral's.
    fragment.style.top =
      `calc(var(--fhwaBaselineOffset) + ${-center * (scale - 1) / scale}em)`;
  };
  apply();
  document.fonts?.load(`1000px "${fontFamily}"`).then(apply).catch(() => {});
};

// Exit tabs, shield banners and older sign labels also contain editable text.
// Apply the same treatment there; text blocks already use the renderer above.
const formatRemainingSignFractions = (root) => {
  if (!signFractionsEnabled) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.parentElement.closest(".bE-textElement, .bE-signFractionGroup, svg, style, script") &&
        new RegExp(signFractionPattern.source, "u").test(node.data)) nodes.push(node);
  }
  for (const node of nodes) {
    const parent = node.parentElement;
    const family = getComputedStyle(parent).fontFamily.split(",")[0].trim().replace(/["']/g, "");
    const wrapper = document.createElement("span");
    wrapper.style.cssText = "display:inline-flex;align-items:center;font-size:inherit;line-height:inherit";
    appendSignFractionText(wrapper, node.data, family);
    node.replaceWith(wrapper);
  }
};

const CLEARVIEW_FONT_SERIES = {
  "Clearview 1": { light: "Clearview 1B", dark: "Clearview 1W" },
  "Clearview 2": { light: "Clearview 2B", dark: "Clearview 2W" },
  "Clearview 3": { light: "Clearview 3B", dark: "Clearview 3W" },
  "Clearview 4": { light: "Clearview 4B", dark: "Clearview 4W" },
  "Clearview 5WR": { light: "Clearview 5WR", dark: "Clearview 5WR" },
  "Clearview 5": { light: "Clearview 5B", dark: "Clearview 5W" },
  "Clearview 6": { light: "Clearview 6B", dark: "Clearview 6W" },
};

const DEFAULT_CLEARVIEW_MAIN_FONT = "Clearview 5";
const DEFAULT_CLEARVIEW_SECONDARY_FONT = "Clearview 4";

// Keep the user-facing size consistent with Series EM. At 100px, Series EM's
// cap height is 56.90625px and every bundled Clearview face is 69.046875px.
const CLEARVIEW_SERIES_EM_SIZE_SCALE = 56.90625 / 69.046875;

const isClearviewRenderedFontFamily = (fontFamily) => {
  const raw = String(fontFamily || "").trim();
  return Object.values(CLEARVIEW_FONT_SERIES).some(
    ({ light, dark }) => raw === light || raw === dark
  );
};

const getTextFontSizeScaleForRender = (fontFamily) =>
  String(fontFamily || "").trim().startsWith("Clearview ")
    ? CLEARVIEW_SERIES_EM_SIZE_SCALE
    : 1;

const LEGACY_CLEARVIEW_TO_SERIES = {
  "Clearview 1W": "Clearview 1",
  "Clearview 1B": "Clearview 1",
  "Clearview 2W": "Clearview 2",
  "Clearview 2B": "Clearview 2",
  "Clearivew 2W": "Clearview 2",
  "Clearview 3W": "Clearview 3",
  "Clearview 3B": "Clearview 3",
  "Clearview 4W": "Clearview 4",
  "Clearview 4B": "Clearview 4",
  "Clearview 5W": "Clearview 5",
  "Clearview 5B": "Clearview 5",
  "Clearivew 5W": "Clearview 5",
  "Clearivew 5B": "Clearview 5",
  "Clearview 6W": "Clearview 6",
  "Clearview 6B": "Clearview 6",
  "Series 1": "Clearview 1",
  "Series 2": "Clearview 2",
  "Series 3": "Clearview 3",
  "Series 4": "Clearview 4",
  "Series 5R": "Clearview 5WR",
  "Series 5WR": "Clearview 5WR",
  "Series 5": "Clearview 5",
  "Series 6": "Clearview 6",
  // v2.19 font names.
  "Transport Regular": "Transport",
  "DIN 1451": "DIN 1451 Regular",
  "ITC Stone Sans Semibold": "ITC Stone Sans Bold",
  "Helvetica Neue Thin": "Helvetica Thin",
  "Helvetica Neue Light": "Helvetica Light",
  "Helvetica Neue Roman": "Helvetica Roman",
  "Helvetica Neue Medium": "Helvetica Medium",
  "Helvetica Neue Bold": "Helvetica Bold",
};

const normalizeTextFontFamilyName = (fontFamily) => {
  const raw = String(fontFamily || "").trim();
  return LEGACY_CLEARVIEW_TO_SERIES[raw] || raw;
};

const isClearviewTextFontFamily = (fontFamily) =>
  /^Clearview\s/i.test(normalizeTextFontFamilyName(fontFamily)) ||
  isClearviewRenderedFontFamily(fontFamily);

const normalizeTextLetterSpacing = (value, fallback = 0) => {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(-0.15, Math.min(0.5, parsed));
};

const applyBetweenCharacterLetterSpacing = (element, value, fallback = 0) => {
  if (!element) {
    return 0;
  }

  const normalizedSpacing = normalizeTextLetterSpacing(value, fallback);
  element.style.setProperty(
    "--betweenLetterSpacing",
    normalizedSpacing + "em"
  );
  element.classList.toggle(
    "bE-betweenLetterSpacing",
    Math.abs(normalizedSpacing) > 0.0001
  );

  if (Math.abs(normalizedSpacing) <= 0.0001) {
    element.style.removeProperty("letter-spacing");
  }

  return normalizedSpacing;
};

const normalizeSmallLettersSize = (value, fallback = 75) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? Math.max(25, Math.min(100, Math.round(parsed))) : fallback;
};

// Small capitals with an adjustable size (v2.19's Small Letters): lowercase
// letters show as capitals at --smallLettersSize percent. At the default this
// matches the font-variant small caps used before.
const applySmallLetters = (element) => {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => node.parentElement?.closest(".bE-smallLetters")
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const parts = String(node.nodeValue || "").split(/(\p{Ll}+)/u);
    if (parts.length < 2) continue;
    const fragment = document.createDocumentFragment();
    parts.forEach((part, index) => {
      if (!part) return;
      if (index % 2) {
        const span = document.createElement("span");
        span.className = "bE-smallLetters";
        span.textContent = part;
        fragment.appendChild(span);
      } else {
        fragment.appendChild(document.createTextNode(part));
      }
    });
    node.replaceWith(fragment);
  }
};

const getMotorwayFallbackFont = (fontFamily) =>
  fontFamily === "Motorway Temporary" ? "Transport Heavy" : "Transport";

const isMotorwayFont = (fontFamily) => /^Motorway (?:Permanent|Temporary)$/.test(fontFamily);

const normalizeMotorwayRouteText = (value) =>
  String(value ?? "").toUpperCase().replace(/[^ABEMNSW0-9 \n]/g, "");

const encodeMotorwayRouteText = (value) => {
  const text = normalizeMotorwayRouteText(value);
  const directions = { NE: "N", SE: "E", NW: "W", SW: "S", N: "n", E: "e", W: "w", S: "s" };
  return text.match(/NE|SE|NW|SW|[ABEMNSW0-9 \n]/g)?.map((part) => directions[part] || part).join("") || "";
};

const applyMotorwayTextFallback = (element, fontFamily) => {
  if (!element || !/^Motorway (?:Permanent|Temporary)$/.test(fontFamily)) return;

  const fallback = getMotorwayFallbackFont(fontFamily);
  element.style.fontFamily = `"${fallback}", sans-serif`;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  for (const textNode of textNodes) {
    const characters = Array.from(textNode.nodeValue || "");
    if (!characters.some((character) => /^[0-9ABEM&(),/]$/.test(character))) continue;

    const fragment = document.createDocumentFragment();
    let run = "";
    let motorwayRun = false;
    const flush = () => {
      if (!run) return;
      if (motorwayRun) {
        const span = document.createElement("span");
        span.className = "bE-motorwayGlyph";
        span.style.fontFamily = `"${fontFamily}", "${fallback}", sans-serif`;
        span.style.position = "relative";
        span.style.top = "0.12em";
        span.textContent = run;
        fragment.appendChild(span);
      } else {
        fragment.appendChild(document.createTextNode(run));
      }
      run = "";
    };

    for (const character of characters) {
      const supported = /^[0-9ABEM&(),/]$/.test(character);
      if (run && supported !== motorwayRun) flush();
      motorwayRun = supported;
      run += character;
    }
    flush();
    textNode.replaceWith(fragment);
  }
};

const getColorBrightness = (colorValue) => {
  const raw = String(colorValue || "").trim();
  if (!raw) {
    return null;
  }

  const lower = raw.toLowerCase();
  const darkNames = new Set([
    "green",
    "blue",
    "brown",
    "black",
    "red",
    "purple",
  ]);
  const lightNames = new Set([
    "white",
    "yellow",
    "orange",
    "fluorescent yellow-green",
    "fluorescent pink",
    "pink",
    "yellow-green",
  ]);

  if (darkNames.has(lower)) {
    return "dark";
  }
  if (lightNames.has(lower)) {
    return "light";
  }

  const namedColor =
    typeof lib !== "undefined" && lib.colors
      ? lib.colors[raw] ||
        lib.colors[raw.charAt(0).toUpperCase() + raw.slice(1)]
      : null;
  const resolved = String(namedColor || raw).trim();
  const rgbMatch = resolved.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  const hexMatch = resolved.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

  let red;
  let green;
  let blue;

  if (rgbMatch) {
    red = Number(rgbMatch[1]);
    green = Number(rgbMatch[2]);
    blue = Number(rgbMatch[3]);
  } else if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((part) => part + part)
        .join("");
    }
    red = parseInt(hex.slice(0, 2), 16);
    green = parseInt(hex.slice(2, 4), 16);
    blue = parseInt(hex.slice(4, 6), 16);
  }

  if (![red, green, blue].every(Number.isFinite)) {
    return null;
  }

  const luminance =
    (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance < 0.52 ? "dark" : "light";
};

const getTextElementBackgroundBrightness = (fontOwner = {}, panel = null) => {
  const backgroundColor = String(fontOwner.backgroundColor || "").trim();
  if (
    backgroundColor &&
    backgroundColor !== "Inherit" &&
    backgroundColor !== "Match BG" &&
    backgroundColor !== "Panel Color"
  ) {
    const brightness = getColorBrightness(backgroundColor);
    if (brightness) {
      return brightness;
    }
  }

  const panelColor =
    panel?.color ||
    panel?.sign?.color ||
    panel?.backgroundColor ||
    panel?.panelColor ||
    "Green";

  return getColorBrightness(panelColor) || "dark";
};

const resolveTextFontFamilyForRender = (
  fontFamily,
  fontOwner = {},
  panel = null
) => {
  const normalized = normalizeTextFontFamilyName(fontFamily);
  const series = CLEARVIEW_FONT_SERIES[normalized];
  if (!series) {
    return normalized;
  }

  const brightness = getTextElementBackgroundBrightness(fontOwner, panel);
  return brightness === "dark" ? series.dark : series.light;
};

class TextElement {
  constructor({
    textContent = "New Sign",
    backgroundColor = "Inherit",
    fontFamily = DEFAULT_CLEARVIEW_MAIN_FONT,
    fontSize = 100,
    useBannerFormatting = false,
    bannerFormattingSize = 100,
    bannerFirstLetterSize = 120,
    useNumeralFormatting = false,
    numeralFormattingSize = 150,
    alignment = "Center",
    justification = "Center",
    lineHeight = 100,
    letterSpacing = 0,
    smallLettersSize = 75,
  } = {}) {
    this.textContent = textContent;
    this.fontFamily = normalizeTextFontFamilyName(fontFamily);
    this.backgroundColor = backgroundColor;
    this.fontSize = fontSize;
    this.useBannerFormatting = useBannerFormatting;
    this.useNumeralFormatting = useNumeralFormatting;
    this.bannerFormattingSize = bannerFormattingSize;
    this.numeralFormattingSize = numeralFormattingSize;
    this.bannerFirstLetterSize = bannerFirstLetterSize;
    this.alignment = alignment;
    this.justification = justification;
    this.lineHeight = lineHeight;
    // v2.19: spacing between letters (em) and the size of small letters (%).
    this.letterSpacing = normalizeTextLetterSpacing(letterSpacing);
    this.smallLettersSize = normalizeSmallLettersSize(smallLettersSize);
  }

  // Original fraction handling: enlarged numerals swap "1/2" for "½".
  legacySplitString() {
    const value = String(this.textContent).replace(/\\t/g, "\t").replace(/\\n/g, "\n");
    const banners = Shield.prototype.bannerTypes.join("|");
    const fractions = Object.values(fractionMap).join("");
    const pattern = new RegExp(
      `(${this.useBannerFormatting ? `\\b(?:${banners})\\b` : "(?!)"})|(${this.useNumeralFormatting ? `(?:\\d+|[${fractions}])\\S*` : "(?!)"})`, "giu"
    );
    const result = [];
    let cursor = 0;
    for (const match of value.matchAll(pattern)) {
      if (match.index > cursor) result.push({ type: "text", value: value.slice(cursor, match.index) });
      result.push({
        type: match[1] !== undefined ? "banner" : "numeral",
        value: match[1] !== undefined ? match[0]
          : match[0].replace(fractionRegex, (fraction) => fractionMap[fraction]),
      });
      cursor = match.index + match[0].length;
    }
    if (cursor < value.length) result.push({ type: "text", value: value.slice(cursor) });
    return result;
  }

  splitString() {
    const value = String(this.textContent).replace(/\\t/g, "\t").replace(/\\n/g, "\n");
    const banners = Shield.prototype.bannerTypes.join("|");
    const pattern = new RegExp(
      `(${signFractionPattern.source})|(${this.useBannerFormatting ? `\\b(?:${banners})\\b` : "(?!)"})|(${this.useNumeralFormatting ? "\\d+" : "(?!)"})`, "giu"
    );
    const result = [];
    let cursor = 0;
    for (const match of value.matchAll(pattern)) {
      if (match.index > cursor) result.push({ type: "text", value: value.slice(cursor, match.index) });
      const fraction = match[1] !== undefined;
      result.push({
        type: fraction ? (this.useNumeralFormatting ? "numeral" : "text")
          : match[7] !== undefined ? "banner" : "numeral",
        value: match[0],
      });
      cursor = match.index + match[0].length;
    }
    if (cursor < value.length) result.push({ type: "text", value: value.slice(cursor) });
    for (let i = 0; i < result.length; i++) {
      if (new RegExp(`^(?:${signFractionPattern.source})$`, "u").test(result[i].value)) {
        for (const adjacent of [i - 1, i + 1]) {
          if (!result[adjacent] || result[adjacent].type !== "text") continue;
          const gap = adjacent < i ? /[ \u00a0]+$/ : /^[ \u00a0]+/;
          if (gap.test(result[adjacent].value)) {
            result[adjacent].value = result[adjacent].value.replace(gap, "");
            result[adjacent][adjacent < i ? "fractionGapAfter" : "fractionGapBefore"] = true;
          }
        }
      }
    }
    return result;
  }

  createElement(panel) {
    const newText = this.createTextBody(panel);
    applyBetweenCharacterLetterSpacing(newText, this.letterSpacing);
    if (Math.abs(normalizeTextLetterSpacing(this.letterSpacing)) > 0.0001) {
      newText.style.letterSpacing = "var(--betweenLetterSpacing)";
    }
    if (this.smallCapitals === true) {
      newText.style.setProperty("--smallLettersSize", normalizeSmallLettersSize(this.smallLettersSize));
      applySmallLetters(newText);
    }
    return newText;
  }

  createTextBody(panel) {
    const newText = document.createElement("div");
    newText.className = "bE-textElement";
    const renderedFontFamily = resolveTextFontFamilyForRender(
      this.fontFamily,
      this,
      panel
    );
    const usesHighwayGothic =
      typeof renderedFontFamily === "string" &&
      renderedFontFamily.toLowerCase().includes("series");

    // Set custom CSS properties here based off the this. properties
    newText.style.setProperty("--fontFamily", '"' + renderedFontFamily + '"');
    newText.style.fontFamily = '"' + renderedFontFamily + '", "Series EM"';
    newText.dataset.exportFontFamily = renderedFontFamily;
    const renderedFontSize =
      1.75 *
      (this.fontSize / 100) *
      getTextFontSizeScaleForRender(renderedFontFamily);
    const lineHeightFontSize = 1.75 * (this.fontSize / 100);
    newText.style.setProperty("--fontSize", renderedFontSize + "rem");
    newText.style.setProperty(
      "--lineHeightFontSize",
      lineHeightFontSize + "rem"
    );
    newText.style.setProperty(
      "--blockBgColor",
      this.backgroundColor == "Inherit"
        ? ""
        : (
          lib.colors[this.backgroundColor] || this.backgroundColor
        ).toLowerCase()
    );
    newText.style.setProperty("--alignment", this.alignment);
    newText.style.setProperty("--justification", (this.justification || "Center").toLowerCase());
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

    if (!signFractionsEnabled) {
      const scale = this.numeralFormattingSize / 100;
      for (const text of this.legacySplitString()) {
        const newTextFragment = document.createElement("span");
        newTextFragment.className = "bE-" + text.type;
        newTextFragment.textContent = text.value;
        if (text.type === "numeral" && scale !== 1) {
          centerEnlargedNumeral(newTextFragment, renderedFontFamily, scale);
        }
        newText.appendChild(newTextFragment);
      }
      return newText;
    }

    const normalizedText = String(this.textContent).replace(/\\n/g, "\n");
    if (normalizedText.includes("\n") && new RegExp(signFractionPattern.source, "u").test(normalizedText)) {
      newText.style.flexDirection = "column";
      newText.style.alignItems = "stretch";
      for (const line of normalizedText.split("\n")) {
        newText.appendChild(new TextElement({ ...this, textContent: line || "\u00a0" }).createElement(panel));
      }
      return newText;
    }

    let splitTextContent = this.splitString();
    for (let i = 0; i < splitTextContent.length; i++) {
      let text = splitTextContent[i];
      const newTextFragment = document.createElement("span");
      newTextFragment.className = "bE-" + text.type;
      // Fraction digits retain the surrounding letter size. Only whole
      // numerals follow the optional numeral enlargement setting.
      const scale = text.type === "numeral" ? this.numeralFormattingSize / 100 : 1;
      if (scale !== 1) {
        const probe = document.createElement("span");
        appendSignFractionText(probe, text.value, renderedFontFamily, scale);
        if (probe.querySelector(".bE-signFractionGroup")) {
          newTextFragment.className = "bE-text";
          probe.style.cssText = "display:inline-flex;align-items:center";
          newTextFragment.style.cssText = "display:inline-flex;align-items:center";
          newTextFragment.appendChild(probe);
        } else {
          newTextFragment.textContent = text.value;
          centerEnlargedNumeral(newTextFragment, renderedFontFamily, scale);
        }
      } else {
        appendSignFractionText(newTextFragment, text.value, renderedFontFamily);
        if (newTextFragment.querySelector(".bE-signFractionGroup")) {
          newTextFragment.style.cssText = "display:inline-flex;align-items:center";
        }
      }

      const applyFractionWordGap = () => {
        const wordGap = 1.25 * getSignFractionMetrics(renderedFontFamily, "0").ascent;
        if (text.fractionGapBefore) newTextFragment.style.marginLeft = `${wordGap}em`;
        if (text.fractionGapAfter && (text.value || !text.fractionGapBefore)) {
          newTextFragment.style.marginRight = `${wordGap}em`;
        }
      };
      if (text.fractionGapBefore || text.fractionGapAfter) {
        applyFractionWordGap();
        document.fonts?.load(`1000px "${renderedFontFamily}"`).then(applyFractionWordGap).catch(() => {});
      }
      newText.appendChild(newTextFragment);
    }

    return newText;
  }
}

TextElement.prototype.fontFamily = [
  "Clearview 1",
  "Clearview 2",
  "Clearview 3",
  "Clearview 4",
  "Clearview 5WR",
  "Clearview 5",
  "Clearview 6",
  "Series A",
  "Series B",
  "Series C",
  "Series D",
  "Series E",
  "Series EEM",
  "Series EM",
  "Series F",
  "DIN 1451 Regular",
  "DIN 1451 Narrow",
  "Motorway Permanent",
  "Motorway Temporary",
  "Rawlinson Regular",
  "Rawlinson Bold",
  "ITC Stone Sans Regular",
  "ITC Stone Sans Bold",
  "Helvetica Thin",
  "Helvetica Light",
  "Helvetica Roman",
  "Helvetica Medium",
  "Helvetica Bold",
  "Arial",
  "Arial Bold",
  "Transport",
  "Transport Heavy",
  "Modern VMS",
];

TextElement.prototype.alignment = ["Left", "Center", "Right"];

TextElement.prototype.justification = ["Left", "Center", "Right"];

TextElement.prototype.backgroundColor = ["Inherit"].concat(
  Object.keys(lib.colors)
);

class ControlTextElement extends TextElement {
  constructor(options = {}) {
    const {
      spacing = 0,
      smallCapitals = false,
      textColor = ControlTextElement.defaultTextColor,
    } = options;
    const resolvedOptions = { ...options };
    const availableFonts =
      TextElement && TextElement.prototype
        ? TextElement.prototype.fontFamily
        : null;
    const providedFont = normalizeTextFontFamilyName(resolvedOptions.fontFamily);
    resolvedOptions.fontFamily = providedFont;
    if (
      !providedFont ||
      !Array.isArray(availableFonts) ||
      !availableFonts.includes(providedFont)
    ) {
      const defaultFont =
        typeof ControlTextElement.getDefaultFont === "function"
          ? ControlTextElement.getDefaultFont()
          : ControlTextElement.defaultFont;
      if (defaultFont) {
        resolvedOptions.fontFamily = defaultFont;
      }
    }
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
    newText.style.fontVariant = "normal";
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
  DEFAULT_CLEARVIEW_MAIN_FONT
)
  ? DEFAULT_CLEARVIEW_MAIN_FONT
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
  const normalizedFont = normalizeTextFontFamilyName(font);
  if (!normalizedFont || !availableFonts.includes(normalizedFont)) {
    return false;
  }
  ControlTextElement.defaultFont = normalizedFont;
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
    const {
      fontSize = 70,
      useNumeralFormatting = true,
      textColor = ActionMessageElement.defaultTextColor,
      spacing = 0,
      smallCapitals = false,
    } = options;
    const resolvedOptions = { ...options };
    const availableFonts =
      TextElement && TextElement.prototype
        ? TextElement.prototype.fontFamily
        : null;
    const providedFont = normalizeTextFontFamilyName(resolvedOptions.fontFamily);
    resolvedOptions.fontFamily = providedFont;
    if (
      !providedFont ||
      !Array.isArray(availableFonts) ||
      !availableFonts.includes(providedFont)
    ) {
      const defaultFont =
        typeof ActionMessageElement.getDefaultFont === "function"
          ? ActionMessageElement.getDefaultFont()
          : ActionMessageElement.defaultFont;
      if (defaultFont) {
        resolvedOptions.fontFamily = defaultFont;
      }
    }

    super({
      ...resolvedOptions,
      fontSize,
      useNumeralFormatting,
    });

    this.fontSize = fontSize;
    this.useNumeralFormatting = useNumeralFormatting;
    this.spacing = spacing;
    this.smallCapitals = smallCapitals;
    this.textColor =
      typeof textColor === "string" && textColor.trim().length
        ? textColor
        : ActionMessageElement.defaultTextColor;
  }

  createElement(panel) {
    const newText = super.createElement(panel);
    newText.style.setProperty("--spacing", (parseFloat(this.spacing) || 0) + "rem");

    const shouldOverrideTextColor =
      typeof this.textColor === "string" &&
      this.textColor.trim().length > 0 &&
      this.textColor !== ActionMessageElement.defaultTextColor;
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

ActionMessageElement.defaultFont = TextElement.prototype.fontFamily.includes(
  DEFAULT_CLEARVIEW_SECONDARY_FONT
)
  ? DEFAULT_CLEARVIEW_SECONDARY_FONT
  : TextElement.prototype.fontFamily[0];

ActionMessageElement.getDefaultFont = function () {
  const availableFonts = TextElement.prototype.fontFamily;
  const currentDefault = ActionMessageElement.defaultFont || availableFonts[0];
  return availableFonts.includes(currentDefault)
    ? currentDefault
    : availableFonts[0];
};

ActionMessageElement.setDefaultFont = function (font) {
  const availableFonts = TextElement.prototype.fontFamily;
  const normalizedFont = normalizeTextFontFamilyName(font);
  if (!normalizedFont || !availableFonts.includes(normalizedFont)) {
    return false;
  }
  ActionMessageElement.defaultFont = normalizedFont;
  return true;
};

ActionMessageElement.defaultTextColor = "Match BG";
ActionMessageElement.getTextColorOptions = function () {
  const palette = Object.keys(lib.colors);
  const options = [ActionMessageElement.defaultTextColor];
  for (const color of palette) {
    if (!options.includes(color)) {
      options.push(color);
    }
  }
  return options;
};

class AdvisoryMessageElement extends TextElement {
  constructor({
    backgroundColor = "Yellow",
    fontFamily = "Series E",
    borderRadius = 4,
    useNumeralFormatting = true,
    horizPadding = 0.3,
    vertPadding = 0.3,
    textColor = AdvisoryMessageElement.defaultTextColor,
    spacing = 0,
    smallCapitals = false,
  } = {}) {
    super();
    this.spacing = spacing;
    this.smallCapitals = smallCapitals;
    this.backgroundColor = backgroundColor;
    this.fontFamily = normalizeTextFontFamilyName(fontFamily);
    this.borderRadius = borderRadius;
    this.useNumeralFormatting = useNumeralFormatting;
    this.horizPadding = horizPadding;
    this.vertPadding = vertPadding;
    this.textColor =
      typeof textColor === "string" && textColor.trim().length
        ? textColor
        : AdvisoryMessageElement.defaultTextColor;
  }

  createElement(panel) {
    const newText = super.createElement(panel);
    newText.style.setProperty("--borderRadius", this.borderRadius + "px");
    newText.style.setProperty("--spacing", (parseFloat(this.spacing) || 0) + "rem");
    newText.style.setProperty("--horizPadding", this.horizPadding);
    newText.style.setProperty("--vertPadding", this.vertPadding);
    newText.className = "bE-textElement bE-advisoryMessage";

    if (this.fontFamily.includes("Series")) {
      newText.classList.add("hgFix");
    }

    const shouldOverrideTextColor =
      typeof this.textColor === "string" &&
      this.textColor.trim().length > 0 &&
      this.textColor !== AdvisoryMessageElement.defaultTextColor;
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

AdvisoryMessageElement.defaultTextColor = "Match BG";
AdvisoryMessageElement.getTextColorOptions = function () {
  const palette = Object.keys(lib.colors);
  const options = [AdvisoryMessageElement.defaultTextColor];
  for (const color of palette) {
    if (!options.includes(color)) {
      options.push(color);
    }
  }
  return options;
};

class ElectronicSignElement extends TextElement {
  constructor({
    fontFamily = "Electronic Highway Sign",
    textColor = "Orange",
    padding = 0.5,
    glow = true,
    setWidth = 0,
  } = {}) {
    super();
    this.fontFamily = normalizeTextFontFamilyName(fontFamily);
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
ElectronicSignElement.prototype.fontFamily = Array.from(
  new Set(TextElement.prototype.fontFamily.concat(["Electronic Highway Sign"]))
);
ElectronicSignElement.prototype.textColors = [
  "Orange",
  "White",
  "Yellow",
  "Red",
];

// TEMP: Block-specific shield support will be replaced when the main shield
// system is integrated. Please treat this class as a stop-gap.
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
  const customShieldRenderedFont = typeof resolveTextFontFamilyForRender === "function"
    ? resolveTextFontFamilyForRender(style.fontFamily || "Series D", { backgroundColor: "Blue" }, { color: "Blue" })
    : (style.fontFamily || "Series D");
  if (isMotorwayFont(customShieldRenderedFont)) {
    routeEl.classList.add("motorwayRouteNumber");
    const encoded = encodeMotorwayRouteText(config.routeNumber || "");
    routeEl.replaceChildren(...Array.from(encoded, (character) => {
      const span = document.createElement("span");
      span.className = "routeChar";
      span.textContent = character;
      return span;
    }));
  }
  routeEl.style.fontFamily = `"${customShieldRenderedFont}", sans-serif`;
  routeEl.style.fontSize = getCustomShieldMakerDisplayEm(
    isMotorwayFont(customShieldRenderedFont)
      ? getCustomShieldMakerDisplayNumber(style.fontSize, 220) * 0.8
      : style.fontSize, 220);
  routeEl.style.fontWeight = String(cssWeight);
  routeEl.style.fontVariationSettings = `"wght" ${requestedWeight}`;
  routeEl.style.letterSpacing = "0";
  routeEl.style.gap = "0";
  const characterSpacingDisplay =
    getCustomShieldMakerDisplayNumber(style.letterSpacing, 0);
  const characterSpacing = characterSpacingDisplay / 100 + "em";
  const routeCharacters = Array.from(routeEl.children || []);
  routeCharacters.forEach((characterSpan, index) => {
    characterSpan.style.marginLeft = index === 0 ? "0" : characterSpacing;
  });
  routeEl.style.position = "absolute";
  routeEl.style.display = "inline-flex";
  routeEl.style.alignItems = "center";
  routeEl.style.justifyContent =
    alignment === "left" ? "flex-start" : alignment === "right" ? "flex-end" : "center";
  routeEl.style.width = "max-content";
  routeEl.style.top = `calc(${getCustomShieldMakerDisplayNumber(anchor.y, 50)}% + ${
    (topDisplay - seedTop) / 100
  }em)`;
  routeEl.style.left = `calc(${anchorX}% + ${
    (horizontalDisplay - seedHorizontal) / 100
  }em)`;
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
    bannerFontFamily1,
    bannerFontFamily2,
    bannerFontSize1,
    bannerFontSize2,
    roadNameFontFamily,
    roadNameFontSize,
    bannerBackgroundColor1 = ShieldElement.prototype.defaultBannerBackgroundColor,
    bannerBackgroundColor2 = ShieldElement.prototype.defaultBannerBackgroundColor,
    bannerLetterSpacing = ShieldElement.prototype.defaultBannerLetterSpacing,
    countyText = "",
    shieldSize,
    showTollBanner,
    tollBannerPosition,
    useOfficialDimensions = true,
    scaleBannersWithShield = ShieldElement.prototype.defaultScaleBannersWithShield,
    shieldBacks = false,
    manualBanners,
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
      this.migrateLegacyBanners(showTollBanner, tollBannerPosition);
      this.bannerFontFamily =
        ShieldElement.prototype.normalizeBannerFontFamily(bannerFontFamily);
      this.fontSize = ShieldElement.prototype.normalizeFontSize(
        fontSize,
        ShieldElement.prototype.getDefaultBannerFontSizeForFont(this.bannerFontFamily)
      );
      this.bannerFontFamily1 = ShieldElement.prototype.normalizeBannerFontFamily(
        bannerFontFamily1 || this.bannerFontFamily
      );
      this.bannerFontFamily2 = ShieldElement.prototype.normalizeBannerFontFamily(
        bannerFontFamily2 || this.bannerFontFamily
      );
      this.bannerFontSize1 = ShieldElement.prototype.normalizeFontSize(
        bannerFontSize1,
        this.fontSize
      );
      this.bannerFontSize2 = ShieldElement.prototype.normalizeFontSize(
        bannerFontSize2,
        this.fontSize
      );
      this.roadNameFontFamily = ShieldElement.prototype.normalizeBannerFontFamily(
        roadNameFontFamily || ShieldElement.prototype.defaultRoadNameFontFamily
      );
      this.roadNameFontSize = ShieldElement.prototype.normalizeFontSize(
        roadNameFontSize,
        ShieldElement.prototype.getDefaultRoadNameFontSizeForFont(this.roadNameFontFamily)
      );
      this.bannerBackgroundColor1 = ShieldElement.prototype.normalizeBannerBackgroundColor(
        bannerBackgroundColor1
      );
      this.bannerBackgroundColor2 = ShieldElement.prototype.normalizeBannerBackgroundColor(
        bannerBackgroundColor2
      );
      this.bannerLetterSpacing = ShieldElement.prototype.normalizeBannerLetterSpacing(
        bannerLetterSpacing
      );
      this.countyText = typeof countyText === "string" ? countyText : "";

      const storedShieldSize = getStoredDefaultsOption(
        { shieldSize, size },
        "shieldSize",
        "settingsDefaultsShieldSize",
        ShieldElement.prototype.defaultShieldSize
      );

      this.shieldSize = ShieldElement.prototype.normalizeShieldSize(storedShieldSize);
      this.useOfficialDimensions = useOfficialDimensions !== false;
      this.scaleBannersWithShield = scaleBannersWithShield !== false;
      this.shieldBacks =
        shieldBacks === true ||
        shieldBacks === "true" ||
        shieldBacks === 1 ||
        shieldBacks === "1" ||
        shieldBacks === "on";
      this.manualBanners = normalizeStoredDefaultsBoolean(
        getStoredDefaultsOption(
          { manualBanners },
          "manualBanners",
          "settingsDefaultsShieldManualBanners",
          ShieldElement.prototype.defaultManualBanners
        )
      );

    // Legacy properties used by older save data and helpers
    this.type = resolvedBase;
    this.specialBannerType = "None";
  }

  createElement(panel) {
    const wrapper = document.createElement("div");
    wrapper.className = "bE-shieldElement";

    let toEl = null;
    if (this.to) {
      toEl = document.createElement("p");
      toEl.className = "to";
      toEl.textContent = "TO";
      toEl.style.display = "inline";
      toEl.style.setProperty(
        "--toBannerFontSize",
        ShieldElement.prototype.getFontSizeCss(this.bannerFontSize1)
      );
      const firstBannerFont = ShieldElement.prototype.resolveBannerFontFamilyForRender(
        ShieldElement.prototype.normalizeBannerFontFamily(this.bannerFontFamily1), panel
      );
      if (firstBannerFont) {
        toEl.style.setProperty("--toBannerFontFamily", `"${String(firstBannerFont).replace(/"/g, '\\"')}"`);
      }
    }

    const config = ShieldElement.prototype.getBlockShieldConfig(
      this.shieldBase
    );
    const normalizedRoute = `${this.routeNumber ?? ""}`.trim();
    const routeText = ShieldElement.prototype.limitRouteCharacters(
      normalizedRoute,
      config
    );
    if (routeText !== normalizedRoute) {
      this.routeNumber = routeText;
    }

    const migratedShieldType =
      ShieldElement.prototype.migrateLegacyBlockVariant(
        this.shieldType,
        routeText,
        config
      );
    if (migratedShieldType !== this.shieldType) {
      this.shieldType = migratedShieldType;
    }

    const variant = ShieldElement.prototype.resolveBlockVariant(
      migratedShieldType,
      routeText,
      config
    );
    const variantKey = ShieldElement.prototype.formatVariantKey(variant);
    const normalizedShieldCode =
      ShieldElement.prototype.normalizeShieldCode(
        this.shieldBase || config?.value || ""
      ).toUpperCase();
    const supportsShieldBacks =
      ShieldElement.prototype.supportsShieldBacks(config);
    const shieldBacksEnabled =
      supportsShieldBacks && this.shieldBacks === true;

    const shieldPath =
      ShieldElement.prototype.getRenderedShieldAssetPath(
        config,
        variantKey,
        {
          shieldBase: this.shieldBase,
          shieldBacks: shieldBacksEnabled,
        }
      );
    const officialPhysicalDimensions = config?.officialDimensions
      ? ShieldElement.prototype.getVariantMetadata(
          config,
          "physicalDimensionsByVariant",
          variantKey
        )
      : null;
    const routeNumberStyle =
      ShieldElement.prototype.usesPresetFloridaRouteNumberCss(config)
        ? null
        : ShieldElement.prototype.getVariantMetadata(
            config,
            "routeNumberByVariant",
            variantKey
          );
    const renderedRouteText = routeNumberStyle
      ? routeText.toUpperCase()
      : routeText;
    const variablePanelWidth = routeNumberStyle?.variablePanelWidth || null;
    const physicalDimensions = this.useOfficialDimensions
      ? officialPhysicalDimensions
      : null;
    const normalizedShieldSize = ShieldElement.prototype.normalizeShieldSize(
      this.shieldSize
    );
    const requestedShieldScale =
      ShieldElement.prototype.getShieldScale(normalizedShieldSize);

    const basePhysicalWidthRem = physicalDimensions?.widthIn
      ? ShieldElement.prototype.inchesToRem(physicalDimensions.widthIn)
      : null;
    const basePhysicalHeightRem = physicalDimensions?.heightIn
      ? ShieldElement.prototype.inchesToRem(physicalDimensions.heightIn)
      : null;

    const physicalWidthRem = basePhysicalWidthRem
      ? basePhysicalWidthRem * requestedShieldScale
      : null;
    const physicalHeightRem = basePhysicalHeightRem
      ? basePhysicalHeightRem * requestedShieldScale
      : null;

    const isFloridaOfficialShield =
      ShieldElement.prototype.usesPresetFloridaRouteNumberCss(config);
    const isOntarioPrimaryShield = normalizedShieldCode === "ON";

    const configuredInternalScale = Number(config?.internalScale);
    const internalScale =
      isOntarioPrimaryShield
        ? 1.2
        : Number.isFinite(configuredInternalScale) && configuredInternalScale > 0
          ? configuredInternalScale
          : 1;

    const renderedShieldHeight =
      physicalHeightRem || normalizedShieldSize * internalScale;
    const shieldScale =
      ShieldElement.prototype.getShieldScale(renderedShieldHeight);

    /*
     * Banner sizing must follow the user's Shield Size field, not any hidden
     * physical/internal artwork enlargement.  Florida official shields get an
     * explicit requested-size variable below so their banners cannot inherit
     * the artwork scale through any container/layout rule.
     */
    const bannerScale =
      this.scaleBannersWithShield ? requestedShieldScale : 1;
    const fontSizeCss = ShieldElement.prototype.getFontSizeCss(this.fontSize);
    const bannerLetterSpacing = ShieldElement.prototype.normalizeBannerLetterSpacing(
      this.bannerLetterSpacing
    );
    const bannerFontFamily =
      ShieldElement.prototype.normalizeBannerFontFamily(this.bannerFontFamily);
    const renderedBannerFontFamily =
      ShieldElement.prototype.resolveBannerFontFamilyForRender(
        bannerFontFamily,
        panel
      );
    const roadNameFontFamily = ShieldElement.prototype.normalizeBannerFontFamily(
      this.roadNameFontFamily || ShieldElement.prototype.defaultRoadNameFontFamily
    );
    const roadNameFontSizeCss = ShieldElement.prototype.getFontSizeCss(
      this.roadNameFontSize ||
        ShieldElement.prototype.getDefaultRoadNameFontSizeForFont(roadNameFontFamily)
    );
    wrapper.style.setProperty("--shieldScale", shieldScale.toString());
    wrapper.style.setProperty(
      "--requestedShieldScale",
      requestedShieldScale.toString()
    );
    wrapper.style.setProperty(
      "--requestedShieldSize",
      normalizedShieldSize + "rem"
    );
    wrapper.style.setProperty(
      "--shieldSize",
      renderedShieldHeight + "rem"
    );
    wrapper.classList.toggle(
      "floridaOfficialShieldUserBannerScale",
      isFloridaOfficialShield
    );
    wrapper.classList.toggle(
      "ontarioPrimaryInternalScale",
      isOntarioPrimaryShield
    );
    if (physicalWidthRem && physicalHeightRem) {
      wrapper.style.setProperty("--shieldWidth", physicalWidthRem + "rem");
      wrapper.style.setProperty("--shieldHeight", physicalHeightRem + "rem");
    }
    if (officialPhysicalDimensions) {
      wrapper.dataset.widthIn = String(officialPhysicalDimensions.widthIn);
      wrapper.dataset.heightIn = String(officialPhysicalDimensions.heightIn);
    }
    wrapper.style.setProperty("--bannerScale", bannerScale.toString());
    if (renderedBannerFontFamily) {
      wrapper.style.setProperty(
        "--bannerFontFamily",
        `"${renderedBannerFontFamily}"`
      );
    }
    wrapper._mergeableAboveBanner =
      isFloridaOfficialShield || internalScale !== 1
        ? null
        : ShieldElement.prototype.getMergeableAboveBanner(
            this,
            bannerScale,
            panel
          );

    const shieldContainer = document.createElement("div");
    const containerClass = config.className || config.value;
    shieldContainer.className = `bannerShieldContainer ${containerClass}`;
    shieldContainer.classList.toggle(
      "oldInterstateNumberPositioning",
      shieldContainer.classList.contains("I") && ShieldElement.oldInterstateNumberPositioning === true
    );
    shieldContainer.classList.toggle(
      "shieldBacks",
      shieldBacksEnabled
    );
    const usesOfficialShieldRendering = Boolean(officialPhysicalDimensions);
    shieldContainer.classList.toggle(
      "officialFdotShield",
      usesOfficialShieldRendering && config?.standard === "FDOT"
    );
    shieldContainer.classList.toggle(
      "officialCfxShield",
      usesOfficialShieldRendering && config?.standard === "CFX"
    );
    shieldContainer.classList.toggle(
      "variableGuideWidth",
      Boolean(variablePanelWidth)
    );
    if (variantKey) {
      shieldContainer.classList.add(
        "variant-" + variantKey.toLowerCase().replace(/[^a-z0-9_-]/g, "-")
      );
    }
    if (toEl) {
      shieldContainer.classList.add("hasTo");
      shieldContainer.appendChild(toEl);
    }
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

      const isLouisianaFourCharRoute =
        shieldContainer.classList.contains("LA") &&
        routeCharCountForFontCheck === 4;

      shieldContainer.classList.toggle(
        "fourNoOne",
        isLouisianaFourCharRoute && !routeHasOneForFontCheck
      );

      shieldContainer.classList.toggle(
        "fourWithOne",
        isLouisianaFourCharRoute && routeHasOneForFontCheck
      );


      const hasBannerA = ShieldElement.prototype.hasBannerValue(this.bannerType);
      const hasBannerB = ShieldElement.prototype.hasBannerValue(this.bannerType2);
      const rawRoadName = String(this.roadName || "");
      const hasRoadName = rawRoadName.trim().length > 0;
      const roadNameIsMultiline = /\\n|\n/.test(rawRoadName);

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
          bannerLetterSpacing,
          bannerFontFamily: this.bannerFontFamily1,
          fontSizeCss: ShieldElement.prototype.getFontSizeCss(this.bannerFontSize1),
          backgroundColor: this.bannerBackgroundColor1,
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
          bannerLetterSpacing,
          bannerFontFamily: this.bannerFontFamily2,
          fontSizeCss: ShieldElement.prototype.getFontSizeCss(this.bannerFontSize2),
          backgroundColor: this.bannerBackgroundColor2,
        });
      }

      if (hasRoadName) {
        bannerItems.push({
          position: roadNamePosition,
          bannerClass: "bannerRoadName",
          bannerValue: rawRoadName.trim(),
          containerClass: "roadNameBannerContainer",
          indentFirstLetter: false,
          smallCaps: false,
          bannerLetterSpacing,
          bannerFontFamily: roadNameFontFamily,
          fontSizeCss: roadNameFontSizeCss,
          backgroundColor: "Inherit",
          isRoadName: true,
          isMultilineRoadName: roadNameIsMultiline,
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
              this.smallCaps,
              panel,
              bannerLetterSpacing
            );

          if (itemsForPosition.some((item) => item.isRoadName)) {
            stackedBannerSlot.classList.add("roadNameStackedBanner");
          }

          if (itemsForPosition.some((item) => item.isMultilineRoadName)) {
            stackedBannerSlot.classList.add("roadNameMultilineStack");
          }

          if (stackedBannerSlot.classList.contains("sideBannerStack")) {
            shieldContainer.classList.add("sideBannerStackLayout");
          }

          shieldContainer.appendChild(stackedBannerSlot);
          continue;
        }

        const item = itemsForPosition[0];

        const bannerContainerElmt = ShieldElement.prototype.createBannerContainer(
          item.containerClass,
          item.bannerClass,
          item.bannerValue,
          item.fontSizeCss || fontSizeCss,
          item.indentFirstLetter,
          item.bannerFontFamily || bannerFontFamily,
          false,
          position,
          item.smallCaps,
          panel,
          item.bannerLetterSpacing,
          item.backgroundColor
        );

        shieldContainer.appendChild(bannerContainerElmt);
      }

    const shieldEl = document.createElement("div");
    shieldEl.className = "shield";
    if (physicalWidthRem && physicalHeightRem) {
      shieldEl.style.width = physicalWidthRem + "rem";
      shieldEl.style.height = physicalHeightRem + "rem";
    } else if (internalScale !== 1) {
      shieldEl.style.height = renderedShieldHeight + "rem";
    } else if (variablePanelWidth && officialPhysicalDimensions) {
      shieldEl.style.width = `calc(var(--shieldSize) * ${
        officialPhysicalDimensions.widthIn / officialPhysicalDimensions.heightIn
      })`;
      shieldEl.style.height = "var(--shieldSize)";
    }

    const img = document.createElement("img");
    img.className = "shieldImg";
    const imageSizeClass = ShieldElement.prototype.getImageSizeClass(routeText, variant);
    if (imageSizeClass) {
      img.classList.add(imageSizeClass);
    }
    img.src = shieldPath;
    if (typeof window.applySignMakerAssetFallback === "function") {
      window.applySignMakerAssetFallback(img, shieldPath);
    }
    img.alt = `${config.label} shield`;

    const preloadedAspectRatio =
      window.SIGNMAKER_PRELOADED_SHIELD_ASPECTS?.get?.(shieldPath);

    if (
      Number.isFinite(preloadedAspectRatio) &&
      preloadedAspectRatio > 0
    ) {
      img.style.aspectRatio = String(preloadedAspectRatio);
    }

    img.loading = isFloridaOfficialShield ? "eager" : "lazy";
    img.decoding = isFloridaOfficialShield ? "sync" : "async";
    if (isFloridaOfficialShield) {
      img.fetchPriority = "high";
    }
    img.draggable = false;
    if (physicalWidthRem && physicalHeightRem) {
      img.style.width = physicalWidthRem + "rem";
      img.style.height = physicalHeightRem + "rem";
    } else if (internalScale !== 1) {
      img.style.width = "auto";
      img.style.height = renderedShieldHeight + "rem";
    } else if (variablePanelWidth && officialPhysicalDimensions) {
      const assetWidthIn = Number(variablePanelWidth.assetWidthIn);
      img.style.width = `calc(var(--shieldSize) * ${
        assetWidthIn / officialPhysicalDimensions.heightIn
      })`;
      img.style.height = "var(--shieldSize)";
    }
    if (variablePanelWidth && officialPhysicalDimensions) {
      const assetWidthIn = Number(variablePanelWidth.assetWidthIn);
      const assetWidthCss = this.useOfficialDimensions
        ? `${ShieldElement.prototype.inchesToRem(assetWidthIn)}rem`
        : `calc(var(--shieldSize) * ${
            assetWidthIn / officialPhysicalDimensions.heightIn
          })`;
      shieldEl.style.setProperty("--variableGuideAssetWidth", assetWidthCss);
      shieldEl.style.setProperty(
        "--variableGuideRadius",
        `calc(var(--shieldSize) * ${
          1.25 / officialPhysicalDimensions.heightIn
        })`
      );
      shieldEl.style.setProperty(
        "--variableGuideSeamCover",
        `calc(var(--shieldSize) * ${
          1.5 / officialPhysicalDimensions.heightIn
        })`
      );
      shieldEl.style.setProperty(
        "--variableGuideArtworkClip",
        `calc(var(--shieldSize) * ${
          // Hide the asset's border (outer ink edge at 0.9375 inches).
          // The full-width SVG overlay alone draws the panel border.
          1 / officialPhysicalDimensions.heightIn
        })`
      );
    }
    shieldEl.appendChild(img);

    let variableGuideContour = null;
    let variableGuideContourRect = null;
    if (
      variablePanelWidth &&
      officialPhysicalDimensions &&
      shieldContainer.classList.contains("FDOTSTATE")
    ) {
      const svgNamespace = "http://www.w3.org/2000/svg";
      const initialWidthIn = Number(officialPhysicalDimensions.widthIn);
      const heightIn = Number(officialPhysicalDimensions.heightIn);
      variableGuideContour = document.createElementNS(svgNamespace, "svg");
      variableGuideContour.classList.add("variableGuideContour");
      variableGuideContour.setAttribute(
        "viewBox",
        `0 0 ${initialWidthIn} ${heightIn}`
      );
      variableGuideContour.setAttribute("preserveAspectRatio", "none");
      variableGuideContour.setAttribute("aria-hidden", "true");
      variableGuideContour.setAttribute("focusable", "false");

      variableGuideContourRect = document.createElementNS(
        svgNamespace,
        "rect"
      );
      variableGuideContourRect.setAttribute("x", "0.0625");
      variableGuideContourRect.setAttribute("y", "0.0625");
      variableGuideContourRect.setAttribute(
        "width",
        String(initialWidthIn - 0.125)
      );
      variableGuideContourRect.setAttribute("height", String(heightIn - 0.125));
      variableGuideContourRect.setAttribute("rx", "1.1875");
      variableGuideContourRect.setAttribute("fill", "none");
      variableGuideContourRect.setAttribute("stroke", "#000000");
      variableGuideContourRect.setAttribute("stroke-width", "0.125");
      variableGuideContour.appendChild(variableGuideContourRect);
      const panelBorder = variableGuideContourRect.cloneNode(false);
      panelBorder.setAttribute("class", "variableGuidePanelBorder");
      panelBorder.setAttribute("x", "0.625");
      panelBorder.setAttribute("y", "0.625");
      panelBorder.setAttribute("width", String(initialWidthIn - 1.25));
      panelBorder.setAttribute("height", String(heightIn - 1.25));
      panelBorder.setAttribute("rx", "0.625");
      panelBorder.setAttribute("stroke-width", "0.625");
      variableGuideContour.appendChild(panelBorder);
      shieldEl.appendChild(variableGuideContour);
    }

      const routeEl = document.createElement("p");
      routeEl.className = "routeNumber";
      if (routeNumberStyle) {
        routeEl.classList.add("officialRouteNumber");
        if (Number.isFinite(routeNumberStyle.topIn)) {
          routeEl.style.setProperty(
            "--officialRouteCapTop",
            `${ShieldElement.prototype.inchesToRem(routeNumberStyle.topIn)}rem`
          );
        }
        const routeCharacterCount =
          ShieldElement.prototype.getRouteCharacterCount(routeText);
        const capHeightIn =
          routeNumberStyle.capHeightInByCharacterCount?.[routeCharacterCount] ||
          routeNumberStyle.capHeightIn;
        const routeFontFamily =
          routeNumberStyle.fontFamilyByCharacterCount?.[routeCharacterCount] ||
          routeNumberStyle.fontFamily;
        if (capHeightIn) {
          routeEl.style.fontSize =
            ShieldElement.prototype.cssRemFromCapHeight(capHeightIn);
        }
        if (routeFontFamily) {
          routeEl.style.fontFamily = `"${routeFontFamily}"`;
        }
        if (routeNumberStyle.color) {
          routeEl.style.color = routeNumberStyle.color;
        }
      }

      const usesV22NumberStyle =
        ShieldElement.prototype.usesV22NumberStyle(config);

      if (usesV22NumberStyle) {
        routeEl.textContent = renderedRouteText;
      } else {
      const routeCharacters = Array.from(String(renderedRouteText || ""));
      routeEl.innerHTML = routeCharacters
        .map((char, index) => {
          const isSpace = char === " ";
          const isDigit = /^[0-9]$/.test(char);
          const previousCharacter = routeCharacters[index - 1] || "";
          const nextCharacter = routeCharacters[index + 1] || "";
          const previousIsDigit = /^[0-9]$/.test(previousCharacter);
          const nextIsDigit = /^[0-9]$/.test(nextCharacter);
          const safeChar = isSpace
            ? "&nbsp;"
            : char
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;");

          const classNames = ["routeChar"];

          if (/^[0-9A-Za-z]$/.test(char)) {
            classNames.push(`routeChar-${char.toUpperCase()}`);
          } else if (isSpace) {
            classNames.push("routeChar-space");
          }

          if (isDigit && previousIsDigit) {
            classNames.push("routeChar-hasPreviousDigit");
          }
          if (isDigit && nextIsDigit) {
            classNames.push("routeChar-hasNextDigit");
          }
          if (char === "3" && previousCharacter === "3") {
            classNames.push("routeChar-previous3");
          }
          if (char === "3" && nextCharacter === "3") {
            classNames.push("routeChar-next3");
          }

          return `<span class="${classNames.join(" ")}">${safeChar}</span>`;
        })
        .join("");
      }

      if (config?.customShieldMaker) {
        const customVariantKey = String(variantKey || "").match(/^(\d+)/)?.[1] || "";
        const customVariantConfig = {
          ...config,
          routeNumber: renderedRouteText,
          customRouteStyle:
            (customVariantKey && config.customRouteStyleByVariant?.[customVariantKey]) ||
            config.customRouteStyle,
          customAnchor:
            (customVariantKey && config.customAnchorByVariant?.[customVariantKey]) ||
            config.customAnchor,
        };
        applyCustomShieldMakerRouteStyle(routeEl, customVariantConfig);
      }

      if (ShieldElement.prototype.isCountyShield(config)) {
        const countyLabel = document.createElement("p");
        countyLabel.className = "countyLabel";
        countyLabel.textContent = (this.countyText || "").trim().toUpperCase();
        if (countyLabel.textContent.length > 0) {
          shieldEl.appendChild(countyLabel);
        }
      }

      if (
        !config?.suppressRouteNumber &&
        !ShieldElement.prototype.isFixedRouteVariant(config, variantKey)
      ) {
        shieldEl.appendChild(routeEl);
      }

      shieldContainer.appendChild(shieldEl);

      const updateSeriesDRouteSpacingFix = () => {
        if (usesV22NumberStyle) {
          shieldContainer.classList.remove("seriesDSpacingFix");
          return;
        }

        const fontFamily = window.getComputedStyle(routeEl).fontFamily || "";
        const usesSeriesD = fontFamily.toLowerCase().includes("series d");

        shieldContainer.classList.toggle("seriesDSpacingFix", usesSeriesD);
      };

      const normalizeRouteCharacterSpacing = () => {
        if (
          usesV22NumberStyle ||
          routeEl.classList.contains("officialRouteNumber") ||
          config?.customShieldMaker
        ) {
          return;
        }

        const routeCharacters = Array.from(routeEl.children || []).filter(
          (child) => child.classList?.contains("routeChar")
        );

        if (!routeCharacters.length) {
          return;
        }

        const computedStyle = window.getComputedStyle(routeEl);
        const spacingPixels = parseFloat(computedStyle.letterSpacing);

        if (!Number.isFinite(spacingPixels) || Math.abs(spacingPixels) < 0.001) {
          return;
        }

        const fontSizePixels = parseFloat(computedStyle.fontSize);
        const spacingCss =
          Number.isFinite(fontSizePixels) && fontSizePixels > 0
            ? `${spacingPixels / fontSizePixels}em`
            : `${spacingPixels}px`;

        routeEl.style.letterSpacing = "0px";
        routeCharacters.forEach((characterSpan, index) => {
          characterSpan.style.letterSpacing = "0px";
          characterSpan.style.marginLeft = index === 0 ? "0px" : spacingCss;
        });
      };

      const updateRouteNumberTypography = () => {
        updateSeriesDRouteSpacingFix();
        normalizeRouteCharacterSpacing();
      };

      requestAnimationFrame(updateRouteNumberTypography);
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(updateRouteNumberTypography).catch(() => {});
      }

      if (!hasBannerA && !hasBannerB && !hasRoadName) {
        shieldContainer.classList.add("noBanners");
      }

    wrapper.appendChild(shieldContainer);

    if (
      routeEl.parentElement &&
      routeNumberStyle &&
      officialPhysicalDimensions
    ) {
      ShieldElement.prototype.scheduleOfficialRouteNumberLayout({
        wrapper,
        routeEl,
        shieldEl,
        img,
        routeText: renderedRouteText,
        routeNumberStyle,
        routeCharacterCount:
          ShieldElement.prototype.getRouteCharacterCount(routeText),
        officialPhysicalDimensions,
        useOfficialDimensions: this.useOfficialDimensions,
        variableGuideContour,
        variableGuideContourRect,
      });
    }

    return wrapper;
  }
}

const V22_NUMBER_STYLE_SHIELDS = [
  "I",
  "I-BUS",
  "I-BL",
  "I-BS",
  "I-DL",
  "I-DS",
  "I-F",
  "US",
  "USCA",
];

// Advance, left ink edge, and right ink edge, normalized to the 1,000-unit
// cap height in the bundled Roadgeek 2014 fonts. Safari reports the advance
// box as actualBoundingBox*, so official placements use these font metrics.
const SERIES_C_THREE_CHAR_NO_ONE_SHIELDS = ["US", "USCA", "AZ", "AZLOOP", "CA", "CO", "HI", "IN", "MB", "MD", "ME", "MN", "MNBUS", "PR", "PR2", "PR3", "SC", "WI", "WY"];
const SERIES_D_THREE_CHAR_WITH_ONE_SHIELDS = ["US", "USCA", "AZ", "AZLOOP", "CA", "CO", "HI", "IN", "MB", "MD", "ME", "MN", "MNBUS", "PR", "PR2", "PR3", "SC", "WI", "WY"];

ShieldElement.prototype.defaultShieldBase = "I";
ShieldElement.prototype.defaultVariant = "Auto";
ShieldElement.prototype.defaultRouteNumber = "1";
ShieldElement.prototype.defaultBannerType = "";
ShieldElement.prototype.defaultBannerPosition = "Right";
ShieldElement.prototype.defaultBannerPosition2 = "Above";
ShieldElement.prototype.defaultHighwayGothicBannerFontSize = 1.6;
ShieldElement.prototype.defaultNonHighwayGothicBannerFontSize = 1.4;
ShieldElement.prototype.defaultBannerFontSize =
  ShieldElement.prototype.defaultHighwayGothicBannerFontSize;
ShieldElement.prototype.defaultBannerFontFamily = "Series E";
ShieldElement.prototype.defaultHighwayGothicRoadNameFontSize = 1.6;
ShieldElement.prototype.defaultNonHighwayGothicRoadNameFontSize = 1.1;
ShieldElement.prototype.defaultRoadNameFontSize =
  ShieldElement.prototype.defaultHighwayGothicRoadNameFontSize;
ShieldElement.prototype.defaultRoadNameFontFamily = "Series E";
ShieldElement.prototype.defaultBannerBackgroundColor = "Inherit";
ShieldElement.prototype.defaultBannerLetterSpacing = 0;
ShieldElement.prototype.defaultManualBanners = true;

ShieldElement.prototype.isHighwayGothicBannerFont = function (fontFamily) {
  return /^Series\s(?:B|C|D|E|EEM|EM|F)\b/i.test(
    String(fontFamily || "")
  );
};

ShieldElement.prototype.getDefaultBannerFontSizeForFont = function (fontFamily) {
  return ShieldElement.prototype.isHighwayGothicBannerFont(fontFamily)
    ? ShieldElement.prototype.defaultHighwayGothicBannerFontSize
    : ShieldElement.prototype.defaultNonHighwayGothicBannerFontSize;
};

ShieldElement.prototype.getDefaultRoadNameFontSizeForFont = function (fontFamily) {
  return ShieldElement.prototype.isHighwayGothicBannerFont(fontFamily)
    ? ShieldElement.prototype.defaultHighwayGothicRoadNameFontSize
    : ShieldElement.prototype.defaultNonHighwayGothicRoadNameFontSize;
};

ShieldElement.prototype.normalizeBannerLetterSpacing = function (value) {
  return normalizeTextLetterSpacing(
    value,
    ShieldElement.prototype.defaultBannerLetterSpacing || 0
  );
};

ShieldElement.prototype.normalizeBannerBackgroundColor = function (value) {
  const raw = String(value ?? "").trim();
  if (!raw || /^none$/i.test(raw) || /^inherit$/i.test(raw)) {
    return ShieldElement.prototype.defaultBannerBackgroundColor || "Inherit";
  }

  if (typeof lib !== "undefined" && lib.colors && lib.colors[raw]) {
    return raw;
  }

  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw) || /^rgba?\(/i.test(raw)) {
    return raw;
  }

  if (/^panel color$/i.test(raw) || /^match bg$/i.test(raw)) {
    return raw;
  }

  return raw;
};

ShieldElement.prototype.resolveBannerBackgroundColor = function (value, panel = null) {
  const raw = ShieldElement.prototype.normalizeBannerBackgroundColor(value);
  if (!raw || /^inherit$/i.test(raw) || /^none$/i.test(raw)) {
    return "";
  }

  if (/^panel color$/i.test(raw) || /^match bg$/i.test(raw)) {
    const panelColor = panel?.color || panel?.sign?.color || panel?.backgroundColor || panel?.panelColor || "Green";
    return (typeof lib !== "undefined" && lib.colors && lib.colors[panelColor]) || panelColor;
  }

  if (typeof lib !== "undefined" && lib.colors && lib.colors[raw]) {
    return lib.colors[raw];
  }

  return raw;
};

ShieldElement.prototype.applyBannerBackgroundColor = function (bannerEl, value, panel = null) {
  if (!bannerEl) {
    return;
  }

  const resolvedColor = ShieldElement.prototype.resolveBannerBackgroundColor(value, panel);
  if (!resolvedColor) {
    return;
  }

  bannerEl.classList.add("customBannerBackground");
  bannerEl.style.setProperty("background-color", resolvedColor, "important");

  const brightness = typeof getColorBrightness === "function"
    ? getColorBrightness(resolvedColor)
    : null;

  if (brightness) {
    bannerEl.classList.toggle("lightBannerBackground", brightness === "light");
    bannerEl.classList.toggle("darkBannerBackground", brightness === "dark");
    bannerEl.style.setProperty(
      "color",
      brightness === "light" ? "var(--black)" : "var(--white)",
      "important"
    );
  }
};

ShieldElement.prototype.defaultCountyText = "";
ShieldElement.prototype.defaultShieldSize = 3;
ShieldElement.prototype.defaultScaleBannersWithShield = true;

const OFFICIAL_ROADGEEK_METRICS = {
  "Series C": {
    "0": [0.706, 0.059983, 0.646],
    "1": [0.407, 0.09, 0.297],
    "2": [0.677, 0.06, 0.617],
    "3": [0.677, 0.06, 0.617],
    "4": [0.738, 0.03, 0.648],
    "5": [0.677, 0.06, 0.617],
    "6": [0.738, 0.09, 0.648],
    "7": [0.678, 0.03, 0.588],
    "8": [0.677, 0.06, 0.617],
    "9": [0.677, 0.06, 0.617],
    A: [0.699, 0.03, 0.669],
    B: [0.732, 0.11, 0.672],
    C: [0.738, 0.09, 0.648],
    D: [0.762, 0.11, 0.672],
    E: [0.679, 0.11, 0.619],
    F: [0.649, 0.11, 0.619],
    G: [0.738, 0.09, 0.648],
    H: [0.782, 0.11, 0.672],
    I: [0.36, 0.11, 0.25],
    J: [0.649, 0.03, 0.539],
    K: [0.732, 0.11, 0.672],
    L: [0.649, 0.11, 0.619],
    M: [0.881, 0.11, 0.771],
    N: [0.782, 0.11, 0.672],
    O: [0.766, 0.089983, 0.676],
    P: [0.762, 0.11, 0.672],
    Q: [0.766, 0.090496, 0.677],
    R: [0.732, 0.11, 0.672],
    S: [0.677, 0.06, 0.617],
    T: [0.569, 0.03, 0.539],
    U: [0.782, 0.11, 0.672],
    V: [0.678, 0.03, 0.648],
    W: [0.819, 0.03, 0.789],
    X: [0.646, 0.03, 0.616],
    Y: [0.699, 0.03, 0.669],
    Z: [0.67, 0.06, 0.61],
    " ": [0.428, 0, 0],
    "-": [0.411, 0.03, 0.381],
  },
  "Series D": {
    "0": [0.909, 0.1, 0.809],
    "1": [0.473, 0.1, 0.353],
    "2": [0.881, 0.1, 0.781],
    "3": [0.956, 0.18, 0.856],
    "4": [0.888, 0.02, 0.768],
    "5": [0.881, 0.1, 0.781],
    "6": [0.881, 0.1, 0.781],
    "7": [0.817, 0.07, 0.747],
    "8": [0.881, 0.1, 0.781],
    "9": [0.881, 0.1, 0.781],
    A: [0.906, 0.03, 0.876],
    B: [0.85, 0.12, 0.8],
    C: [0.881, 0.099987, 0.781],
    D: [0.9, 0.12, 0.8],
    E: [0.79, 0.12, 0.74],
    F: [0.77, 0.12, 0.74],
    G: [0.881, 0.099985, 0.781],
    H: [0.92, 0.12, 0.8],
    I: [0.401, 0.12, 0.281],
    J: [0.789, 0.03, 0.669],
    K: [0.867, 0.12, 0.817],
    L: [0.77, 0.12, 0.74],
    M: [1.018, 0.12, 0.898],
    N: [0.92, 0.12, 0.8],
    O: [0.909, 0.1, 0.809],
    P: [0.83, 0.12, 0.8],
    Q: [0.909, 0.1, 0.809],
    R: [0.85, 0.12, 0.8],
    S: [0.78, 0.05, 0.73],
    T: [0.678, 0.03, 0.648],
    U: [0.92, 0.119978, 0.8],
    V: [0.819, 0.03, 0.789],
    W: [0.949, 0.03, 0.919],
    X: [0.78, 0.05, 0.73],
    Y: [0.914, 0.03, 0.884],
    Z: [0.78, 0.05, 0.73],
    " ": [0.599, 0, 0],
    "-": [0.411, 0.03, 0.381],
  },
};

ShieldElement.prototype.inchesPerRem = 12;
ShieldElement.prototype.roadgeekCapHeightRatio = 4 / 7;

ShieldElement.prototype.inchesToRem = function (inches) {
  const value = Number(inches);
  return Number.isFinite(value)
    ? value / ShieldElement.prototype.inchesPerRem
    : 0;
};

ShieldElement.prototype.cssRemFromCapHeight = function (inches) {
  const capHeightRem = ShieldElement.prototype.inchesToRem(inches);
  const fontSizeRem =
    capHeightRem / ShieldElement.prototype.roadgeekCapHeightRatio;
  return `${fontSizeRem.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")}rem`;
};

ShieldElement.prototype.measureOfficialRouteInk = function ({
  routeText,
  routeFontFamily,
  capHeightPixels,
  letterSpacingPixels = 0,
  context,
}) {
  const characters = Array.from(routeText);
  const familyMetrics = OFFICIAL_ROADGEEK_METRICS[routeFontFamily];
  let cursor = 0;
  let inkLeft = Number.POSITIVE_INFINITY;
  let inkRight = Number.NEGATIVE_INFINITY;

  characters.forEach((rawCharacter, index) => {
    const character = rawCharacter.toUpperCase();
    const glyphMetrics = familyMetrics?.[character];
    if (glyphMetrics) {
      const [advance, left, right] = glyphMetrics;
      if (right > left) {
        inkLeft = Math.min(inkLeft, cursor + left * capHeightPixels);
        inkRight = Math.max(inkRight, cursor + right * capHeightPixels);
      }
      cursor += advance * capHeightPixels;
    } else {
      const metrics = context.measureText(rawCharacter);
      const left = cursor - Number(metrics.actualBoundingBoxLeft || 0);
      const right = cursor + Number(metrics.actualBoundingBoxRight || metrics.width);
      inkLeft = Math.min(inkLeft, left);
      inkRight = Math.max(inkRight, right);
      cursor += metrics.width;
    }

    if (index < characters.length - 1) {
      cursor += letterSpacingPixels;
    }
  });

  if (!Number.isFinite(inkLeft) || !Number.isFinite(inkRight)) {
    inkLeft = 0;
    inkRight = 0;
  }
  return { inkLeft, inkRight, inkWidth: inkRight - inkLeft };
};

// Keep adjacent glyph ink separated before fitting an optically adjusted
// legend into its available span. Height is never reduced. If spacing alone
// cannot fit, horizontal condensation is an explicit display compromise.
ShieldElement.prototype.scheduleOfficialRouteNumberLayout = function ({
  wrapper,
  routeEl,
  shieldEl,
  img,
  routeText,
  routeNumberStyle,
  routeCharacterCount,
  officialPhysicalDimensions,
  useOfficialDimensions,
  variableGuideContour,
  variableGuideContourRect,
}) {
  const layout = () => {
    if (!routeEl.isConnected || !shieldEl.isConnected) {
      return;
    }
    const shieldBounds = shieldEl.getBoundingClientRect();
    const officialHeight = Number(officialPhysicalDimensions.heightIn);
    if (!(shieldBounds.height > 0) || !(officialHeight > 0)) {
      return;
    }

    const pixelsPerInch = shieldBounds.height / officialHeight;
    const capHeightIn = Number(
      routeNumberStyle.capHeightInByCharacterCount?.[routeCharacterCount] ||
        routeNumberStyle.capHeightIn
    );
    const routeFontFamily =
      routeNumberStyle.fontFamilyByCharacterCount?.[routeCharacterCount] ||
      routeNumberStyle.fontFamily;
    const fontSizePixels =
      (capHeightIn * pixelsPerInch) /
      ShieldElement.prototype.roadgeekCapHeightRatio;
    routeEl.style.fontSize = `${fontSizePixels}px`;
    routeEl.style.fontFamily = `"${routeFontFamily}"`;
    routeEl.style.top = `${
      Number(routeNumberStyle.topIn) * pixelsPerInch - fontSizePixels / 7
    }px`;
    routeEl.style.letterSpacing = "0px";

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    context.fontKerning = "none";
    context.font = `${fontSizePixels}px "${routeFontFamily}"`;
    const capHeightPixels = capHeightIn * pixelsPerInch;
    let measuredInk = ShieldElement.prototype.measureOfficialRouteInk({
      routeText,
      routeFontFamily,
      capHeightPixels,
      context,
    });

    let horizontalScale = 1;
    if (
      routeNumberStyle.allowOpticalSpacing &&
      routeCharacterCount > 1 &&
      Number(routeNumberStyle.maxWidthIn) > 0
    ) {
      const maximumWidth = routeNumberStyle.maxWidthIn * pixelsPerInch;
      if (measuredInk.inkWidth > maximumWidth) {
        const fit = ShieldElement.prototype.fitOfficialRouteInk({
          routeText,
          routeFontFamily,
          capHeightPixels,
          context,
        }, maximumWidth);
        routeEl.style.letterSpacing = `${fit.spacing}px`;
        horizontalScale = fit.scaleX;
        measuredInk = fit;
      }
    }
    routeEl.dataset.horizontalFit = String(horizontalScale);

    const { inkLeft, inkRight } = measuredInk;

    const variablePanelWidth = routeNumberStyle.variablePanelWidth;
    if (variablePanelWidth) {
      const minWidthIn = Number(variablePanelWidth.minWidthIn);
      const maxWidthIn = Number(variablePanelWidth.maxWidthIn);
      const assetWidthIn = Number(variablePanelWidth.assetWidthIn);
      const leftClearanceIn = Number(routeNumberStyle.leftIn);
      const rightClearanceIn = Number(variablePanelWidth.rightClearanceIn);
      const requiredWidthIn =
        leftClearanceIn +
        (inkRight - inkLeft) / pixelsPerInch +
        rightClearanceIn;
      const renderedWidthIn = Math.min(
        maxWidthIn,
        Math.max(minWidthIn, requiredWidthIn)
      );
      const renderedWidthCss = useOfficialDimensions
        ? `${ShieldElement.prototype.inchesToRem(renderedWidthIn)}rem`
        : `calc(var(--shieldSize) * ${renderedWidthIn / officialHeight})`;
      const assetWidthCss = useOfficialDimensions
        ? `${ShieldElement.prototype.inchesToRem(assetWidthIn)}rem`
        : `calc(var(--shieldSize) * ${assetWidthIn / officialHeight})`;

      shieldEl.style.width = renderedWidthCss;
      img.style.width = assetWidthCss;
      shieldEl.style.setProperty("--variableGuideAssetWidth", assetWidthCss);
      wrapper.style.setProperty("--shieldWidth", renderedWidthCss);
      wrapper.dataset.widthIn = String(renderedWidthIn);
      if (variableGuideContour && variableGuideContourRect) {
        variableGuideContour.setAttribute(
          "viewBox",
          `0 0 ${renderedWidthIn} ${officialHeight}`
        );
        variableGuideContourRect.setAttribute(
          "width",
          String(renderedWidthIn - 0.125)
        );
        variableGuideContour.querySelector(".variableGuidePanelBorder")
          ?.setAttribute("width", String(renderedWidthIn - 1.25));
      }
    }

    let targetPosition;
    let sourcePosition;
    if (variablePanelWidth) {
      targetPosition =
        (Number(wrapper.dataset.widthIn) - Number(variablePanelWidth.rightClearanceIn)) * pixelsPerInch;
      sourcePosition = inkRight;
    } else if (Number.isFinite(routeNumberStyle.leftIn)) {
      targetPosition = routeNumberStyle.leftIn * pixelsPerInch;
      sourcePosition = inkLeft;
    } else if (Number.isFinite(routeNumberStyle.rightIn)) {
      targetPosition = routeNumberStyle.rightIn * pixelsPerInch;
      sourcePosition = inkRight;
    } else {
      const centerXIn = Number.isFinite(routeNumberStyle.centerXIn)
        ? routeNumberStyle.centerXIn
        : officialPhysicalDimensions.widthIn / 2;
      targetPosition = centerXIn * pixelsPerInch;
      sourcePosition = (inkLeft + inkRight) / 2;
    }
    routeEl.style.transform = `translateX(${targetPosition - sourcePosition}px) scaleX(${horizontalScale})`;
  };

  queueMicrotask(layout);
  requestAnimationFrame(layout);
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      layout();
      requestAnimationFrame(layout);
    });
  }
};

ShieldElement.prototype.fitOfficialRouteInk = function (options, maximumWidth) {
  const measure = (spacing) => this.measureOfficialRouteInk({
    ...options, letterSpacingPixels: spacing,
  });
  let ink = measure(0);
  let spacing = 0;
  let scaleX = 1;
  const chars = Array.from(options.routeText.toUpperCase());
  const metrics = OFFICIAL_ROADGEEK_METRICS[options.routeFontFamily];
  if (maximumWidth > 0 && ink.inkWidth > maximumWidth) {
    let minimumSpacing = -Infinity;
    for (let i = 0; i < chars.length - 1; i++) {
      const a = metrics?.[chars[i]];
      const b = metrics?.[chars[i + 1]];
      if (!a || !b) { minimumSpacing = 0; break; }
      // Reserve 8% of cap height between bounding boxes, before scaling.
      minimumSpacing = Math.max(minimumSpacing,
        (0.08 - (a[0] + b[1] - a[2])) * options.capHeightPixels);
    }
    if (chars.length > 1) {
      spacing = Math.min(0, Math.max(minimumSpacing,
        (maximumWidth - ink.inkWidth) / (chars.length - 1)));
      ink = measure(spacing);
    }
    scaleX = Math.min(1, maximumWidth / ink.inkWidth);
  }
  return {
    spacing, scaleX,
    inkLeft: ink.inkLeft * scaleX,
    inkRight: ink.inkRight * scaleX,
    inkWidth: ink.inkWidth * scaleX,
  };
};

ShieldElement.prototype.normalizeShieldCode = function (code) {
  if (typeof code !== "string") {
    return "";
  }
  return Shield.prototype
    .normalizeShieldName(code)
    .replace(/\s+/g, "")
    .replace(/2nd$/i, "2");
};

ShieldElement.prototype.supportsShieldBacks = function (configOrValue) {
  const config =
    typeof configOrValue === "object" && configOrValue
      ? configOrValue
      : null;
  const rawValue = config
    ? config.value || config.assetName || ""
    : configOrValue;

  const normalized = ShieldElement.prototype.normalizeShieldCode(
    rawValue || ""
  ).toUpperCase();

  return (
    normalized === "US" ||
    normalized === "NJ" ||
    normalized === "C" ||
    normalized === "NVCC" ||
    config?.preserveShieldBacks === true
  );
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

  const traverse = (node, assetPathParts = [], categoryParts = []) => {
    if (!node || typeof node !== "object") {
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (!value || typeof value !== "object") {
        continue;
      }
      if (value.type === "category") {
        traverse(
          value,
          assetPathParts.concat(value.folder || key),
          categoryParts.concat(key)
        );
      } else if (value.type === "shield") {
        const normalizedCode = ShieldElement.prototype.normalizeShieldCode(key);
        const variants = Array.isArray(value.variants) ? value.variants.slice() : [];
        const shieldAssetPathParts = value.folder
          ? assetPathParts.concat(value.folder)
          : assetPathParts;
        shields.push({
          value: normalizedCode,
          label: value.name || normalizedCode,
          variants,
          fixedRouteVariants: Array.isArray(value.fixedRouteVariants)
            ? value.fixedRouteVariants.slice()
            : [],
          assetFolder: ["img/shields"].concat(shieldAssetPathParts).join("/"),
          className:
            value.className ||
            ShieldElement.prototype.getShieldClassNames(normalizedCode),
          assetName: value.assetName || normalizedCode,
          assetPath: value.assetPath || null,
          assetPathByVariant: value.assetPathByVariant || null,
          suppressRouteNumber: value.suppressRouteNumber === true,
          county: value.county === true,
          standard: value.standard || null,
          officialDimensions: value.officialDimensions === true,
          internalScale: value.internalScale || 1,
          maxRouteCharacters: value.maxRouteCharacters || null,
          physicalDimensionsByVariant: value.physicalDimensionsByVariant || null,
          routeNumberByVariant: value.routeNumberByVariant || null,
          autoVariantByCharacterCount:
            value.autoVariantByCharacterCount || null,
          legacyVariantAliases: value.legacyVariantAliases || null,
          categories: categoryParts.slice(),
        });
      }
    }
  };

  traverse(directory);

  const upsertShield = (definition) => {
    const normalizedValue = ShieldElement.prototype.normalizeShieldCode(
      definition.value
    );
    const normalizedDefinition = {
      value: normalizedValue,
      label: definition.label || normalizedValue,
      variants: Array.isArray(definition.variants)
        ? definition.variants.slice()
        : [],
      fixedRouteVariants: Array.isArray(definition.fixedRouteVariants)
        ? definition.fixedRouteVariants.slice()
        : [],
      assetFolder: definition.assetFolder || "img/shields",
      className:
        definition.className ||
        ShieldElement.prototype.getShieldClassNames(normalizedValue),
      assetName: definition.assetName || normalizedValue,
      assetPath: definition.assetPath || null,
      assetPathByVariant: definition.assetPathByVariant || null,
      suppressRouteNumber: definition.suppressRouteNumber === true,
      county: definition.county === true,
      standard: definition.standard || null,
      officialDimensions: definition.officialDimensions === true,
      maxRouteCharacters: definition.maxRouteCharacters || null,
      physicalDimensionsByVariant:
        definition.physicalDimensionsByVariant || null,
      routeNumberByVariant: definition.routeNumberByVariant || null,
      autoVariantByCharacterCount:
        definition.autoVariantByCharacterCount || null,
      legacyVariantAliases: definition.legacyVariantAliases || null,
      categories: Array.isArray(definition.categories)
        ? definition.categories.slice()
        : [],
    };
    const existing = shields.find(
      (shield) =>
        ShieldElement.prototype.normalizeShieldCode(shield.value) ===
        normalizedValue
    );
    if (existing) {
      Object.assign(existing, normalizedDefinition);
    } else {
      shields.push(normalizedDefinition);
    }
  };

  const addVariantGroup = (assetFolder, categories, definitions) => {
    definitions.forEach(
      ([value, label, variants = ["2 Digit", "3 Digit"], assetName = value, className]) => {
        const assetPathByVariant = {};
        variants.forEach((variant) => {
          const variantKey = ShieldElement.prototype.formatVariantKey(variant);
          const artworkKey =
            variantKey === "3Digit" &&
            Shield.prototype.usesSharedTwoDigitArtwork(assetName)
              ? "2Digit"
              : variantKey;
          assetPathByVariant[variantKey] =
            `${assetFolder}/${assetName}-${artworkKey}.svg`;
        });
        upsertShield({
          value,
          label,
          variants,
          assetFolder,
          assetName,
          assetPathByVariant,
          className,
          categories,
        });
      }
    );
  };

  const addExactGroup = (assetFolder, categories, definitions) => {
    definitions.forEach(
      ([value, label, fileName, suppressRouteNumber = true, className]) => {
        upsertShield({
          value,
          label,
          variants: ["Image"],
          assetFolder,
          assetName: value,
          assetPath: `${assetFolder}/${fileName}`,
          suppressRouteNumber,
          className,
          categories,
        });
      }
    );
  };

  addVariantGroup("img/shields/United States", ["United States"], [
    ["cir", "Circle"],
    ["elp", "Ellipse"],
    ["rec", "Rectangle"],
    ["rec2", "Rectangle (Alt)"],
  ]);

  addVariantGroup(
    "img/shields/United States/Interstate",
    ["United States", "Interstate"],
    [
      ["I", "Interstate"],
      ["I-BUS", "Interstate Business"],
      ["I-BL", "Interstate Business Loop"],
      ["I-BS", "Interstate Business Spur"],
      ["I-DL", "Interstate Downtown Loop"],
      ["I-DS", "Interstate Downtown Spur"],
      ["I-F", "Future Interstate"],
    ]
  );

  addVariantGroup(
    "img/shields/United States/US Route",
    ["United States", "U.S. Route"],
    [
      ["US", "U.S. Route"],
      ["USCA", "U.S. Route (California style)", undefined, "US-CA", "USCA"],
    ]
  );

  addVariantGroup("img/shields/United States/AZ", ["United States", "Arizona"], [
    ["AZ", "Arizona"],
    ["AZLOOP", "Arizona Loop", ["3 Digit"]],
  ]);
  addVariantGroup("img/shields/United States/GA", ["United States", "Georgia"], [
    ["GA", "Georgia"],
    ["GAALT", "Georgia Alternate"],
    ["GABYP", "Georgia Bypass"],
    ["GACONN", "Georgia Connector"],
    ["GALOOP", "Georgia Loop"],
    ["GASPUR", "Georgia Spur"],
  ]);
  addVariantGroup("img/shields/United States/IN", ["United States", "Indiana"], [
    ["IN", "Indiana"],
  ]);
  addExactGroup("img/shields/United States/IN", ["United States", "Indiana"], [
    ["INTR", "Indiana Toll Road", "INTR.png"],
  ]);
  addVariantGroup("img/shields/United States/KS", ["United States", "Kansas"], [
    ["KS", "Kansas"],
  ]);
  addExactGroup("img/shields/United States/KS", ["United States", "Kansas"], [
    ["KSTP", "Kansas Turnpike", "KSTP.png"],
  ]);
  addVariantGroup("img/shields/United States/KY", ["United States", "Kentucky"], [
    ["KY", "Kentucky", ["2 Digit", "3 Digit", "AA"]],
  ]);
  addExactGroup("img/shields/United States/KY", ["United States", "Kentucky"], [
    ["KYAA", "AA Highway", "KYAA.png"],
    ["KYAU", "Audubon Parkway", "KYAU.png"],
    ["KYBG", "Bluegrass Parkway", "KYBG.png"],
    ["KYCM", "Cumberland Parkway", "KYCM.png"],
    ["KYHR", "Hal Rogers Parkway", "KYHR.png"],
    ["KYMT", "Mountain Parkway", "KYMT.png"],
    ["KYPR", "Pennyrile Parkway", "KYPR.png"],
    ["KYPU", "Purchase Parkway", "KYPU.png"],
    ["KYWK", "Western Kentucky Parkway", "KYWK.png"],
    ["KYWN", "Natcher Parkway", "KYWN.png"],
  ]);
  addVariantGroup("img/shields/United States/MA", ["United States", "Massachusetts"], [
    ["MA", "Massachusetts", ["2 Digit", "3 Digit", "Turnpike"]],
  ]);
  addExactGroup("img/shields/United States/MA", ["United States", "Massachusetts"], [
    ["MATP", "Massachusetts Turnpike", "MATP.png"],
  ]);
  addVariantGroup("img/shields/United States/ME", ["United States", "Maine"], [
    ["ME", "Maine", ["2 Digit", "3 Digit", "Turnpike"]],
  ]);
  addExactGroup("img/shields/United States/ME", ["United States", "Maine"], [
    ["METP", "Maine Turnpike", "METP.png"],
  ]);
  addVariantGroup("img/shields/United States/MN", ["United States", "Minnesota"], [
    ["MN", "Minnesota", ["2 Digit"]],
    ["MNBUS", "Minnesota Business", ["2 Digit"]],
    ["MNCo", "Minnesota County"],
  ]);
  addVariantGroup("img/shields/United States/NE", ["United States", "Nebraska"], [
    ["NE", "Nebraska"],
    ["NELINK", "Nebraska Link", ["2 Digit"]],
    ["NESPUR", "Nebraska Spur", ["2 Digit"]],
  ]);
  upsertShield({
    value: "NV",
    label: "Nevada",
    variants: ["2 Digit", "CC215"],
    fixedRouteVariants: ["CC215"],
    assetFolder: "img/shields/United States/NV",
    assetPathByVariant: {
      "2Digit": "img/shields/United States/NV/NV-2Digit.svg",
      CC215: "img/shields/United States/NV/NV-CC215.svg",
    },
    legacyVariantAliases: {
      "3Digit": "2 Digit",
    },
    categories: ["United States", "Nevada"],
  });
  addVariantGroup("img/shields/United States/NV", ["United States", "Nevada"], [
    ["NVCC", "Clark County", ["2 Digit"]],
  ]);
  addVariantGroup("img/shields/United States/NJ", ["United States", "New Jersey"], [
    ["NJ", "New Jersey", ["2 Digit", "3 Digit", "NJTP", "GSP"]],
  ]);
  addExactGroup("img/shields/United States/NJ", ["United States", "New Jersey"], [
    ["GSP", "Garden State Parkway", "GSP.png"],
    ["NJTP", "New Jersey Turnpike", "NJTP.png"],
    ["PIP", "Palisades Interstate Parkway", "PIP.png"],
  ]);
  addVariantGroup("img/shields/United States/NY", ["United States", "New York"], [
    ["NY", "New York", ["2 Digit", "3 Digit", "Thruway"]],
  ]);
  addExactGroup("img/shields/United States/NY", ["United States", "New York"], [
    ["B", "Bethpage Parkway", "B.png"],
    ["BMP", "Bear Mountain Parkway", "BMP.png"],
    ["BP", "Belt Parkway", "BP.png"],
    ["BR", "Bronx River Parkway", "BR.png"],
    ["BRP", "Bronx River Parkway (alternate)", "BRP.png"],
    ["CCP", "Cross County Parkway", "CCP.png"],
    ["CI", "Cross Island Parkway", "CI.png"],
    ["FDR", "FDR Drive", "FDR.png"],
    ["GCP", "Grand Central Parkway", "GCP.png"],
    ["H", "Heckscher Parkway", "H.png"],
    ["HH", "Henry Hudson Parkway", "HH.png"],
    ["HR", "Hutchinson River Parkway", "HR.png"],
    ["HRD", "Harlem River Drive", "HRD.png"],
    ["HRP", "Hutchinson River Parkway (alternate)", "HRP.png"],
    ["JR", "Jackie Robinson Parkway", "JR.png"],
    ["KWV", "Korean War Veterans Parkway", "KWV.png"],
    ["LOSP", "Lake Ontario State Parkway", "LOSP.png"],
    ["M", "Meadowbrook Parkway", "M.png"],
    ["MP", "Mosholu Parkway", "MP.png"],
    ["N", "Northern State Parkway", "N.png"],
    ["NSP", "Niagara Scenic Parkway", "NSP.png"],
    ["NYST", "New York State Thruway", "NYST.png"],
    ["O", "Ocean Parkway", "O.png"],
    ["Pe", "Pelham Parkway", "Pe.png", true, "Pe"],
    ["RM", "Robert Moses Causeway", "RM.png"],
    ["SA", "Sagtikos Parkway", "SA.png"],
    ["SBP", "Sprain Brook Parkway", "SBP.png"],
    ["SM", "Sunken Meadow Parkway", "SM.png"],
    ["SMP", "Saw Mill Parkway", "SMP.png"],
    ["SO", "Southern State Parkway", "SO.png"],
    ["TSP", "Taconic State Parkway", "TSP.png"],
    ["W", "Wantagh Parkway", "W.png"],
  ]);
  addVariantGroup("img/shields/United States/OH", ["United States", "Ohio"], [
    ["OH", "Ohio", ["2 Digit", "3 Digit", "Turnpike"]],
  ]);
  addExactGroup("img/shields/United States/OH", ["United States", "Ohio"], [
    ["OHTP", "Ohio Turnpike", "OHTP.png"],
  ]);
  addVariantGroup("img/shields/United States/OK", ["United States", "Oklahoma"], [
    ["OK", "Oklahoma"],
  ]);
  addExactGroup("img/shields/United States/OK", ["United States", "Oklahoma"], [
    ["OKCH", "Cherokee Turnpike", "OKCH.png"],
    ["OKCR", "Creek Turnpike", "OKCR.png"],
    ["OKHB", "H.E. Bailey Turnpike", "OKHB.png"],
    ["OKIN", "Indian Nation Turnpike", "OKIN.png"],
    ["OKKC", "Kickapoo Turnpike", "OKKC.png"],
    ["OKKL", "Kilpatrick Turnpike", "OKKL.png"],
    ["OKMS", "Muskogee Turnpike", "OKMS.png"],
    ["OKTU", "Turner Turnpike", "OKTU.png"],
    ["OKWR", "Will Rogers Turnpike", "OKWR.png"],
  ]);
  addVariantGroup("img/shields/United States/PA", ["United States", "Pennsylvania"], [
    ["PA", "Pennsylvania", ["2 Digit", "3 Digit", "Turnpike"]],
    ["PATP", "Pennsylvania Turnpike Route"],
  ]);
  addExactGroup("img/shields/United States/PA", ["United States", "Pennsylvania"], [
    ["PATPLOGO", "Pennsylvania Turnpike", "PATP.png"],
  ]);
  addVariantGroup("img/shields/United States/PR", ["United States", "Puerto Rico"], [
    ["PR", "PR Primary"],
    ["PR2", "PR Urban Primary"],
    ["PR3", "PR Secondary", ["2 Digit", "3 Digit", "4 Digit"]],
    ["PR4", "PR Tertiary", ["2 Digit", "3 Digit", "4 Digit"]],
  ]);
  // Puerto Rico's 4 digit routes use the 3 digit artwork.
  ["PR3", "PR4"].forEach((value) => {
    const shield = shields.find((entry) => entry.value === value);
    shield.assetPathByVariant["4Digit"] = shield.assetPathByVariant["3Digit"];
  });
  addVariantGroup("img/shields/United States/TX", ["United States", "Texas"], [
    ["TX", "Texas"],
    ["TXBELT", "Texas Beltway", ["2 Digit"], "TXBELTWAY", "TX BELTWAY"],
    ["TXEXPRESS", "Texas Express Toll", undefined, "TXEXPRESS", "TX EXPRESS"],
    ["TXFM", "Texas Farm to Market", ["2 Digit", "3 Digit", "4 Digit", "5 Digit"], "TXFM", "TX FM"],
    ["TXLOOP", "Texas Loop", ["2 Digit", "3 Digit", "4 Digit"], "TXLOOP", "TX LOOP"],
    ["TXPARK", "Texas Park Road", ["2 Digit", "3 Digit"], "TXPARK", "TX PARK"],
    ["TXRM", "Texas Ranch to Market", ["2 Digit", "3 Digit", "4 Digit"], "TXRM", "TX RM"],
    ["TXSPUR", "Texas Spur", ["2 Digit", "3 Digit", "4 Digit"], "TXSPUR", "TX SPUR"],
    ["TXTOLL", "Texas Toll", undefined, "TXTOLL", "TX TOLL"],
  ]);
  addExactGroup("img/shields/United States/TX", ["United States", "Texas"], [
    ["HTR", "Hardy Toll Road", "HTR.png"],
    ["SHT", "Sam Houston Tollway", "SHT.png"],
    ["TXTOLLCTRMA", "Central Texas Regional Mobility Authority", "TXTollCTRMA.svg", false, "TX tollctrma"],
    ["TXTOLLNTTA", "North Texas Tollway Authority", "TXTollNTTA.svg", false, "TX tollntta"],
    ["TXTOLLFBTR", "Fort Bend Toll Road", "TXTollFBTR.png"],
    ["WPT", "Westpark Tollway", "WPT.png"],
  ]);
  addVariantGroup("img/shields/United States/WI", ["United States", "Wisconsin"], [
    ["WI", "Wisconsin"],
    ["WICo", "Wisconsin County"],
  ]);

  addVariantGroup("img/shields/Canada", ["Canada"], [
    ["TCH", "Trans-Canada Highway"],
    ["TCHLeaf", "Trans-Canada Highway Leaf"],
  ]);
  addVariantGroup("img/shields/Canada/AB", ["Canada", "Alberta"], [
    ["AB", "Alberta"],
    ["AB2", "Alberta Oval"],
    ["ABTC", "Alberta Trans-Canada Highway"],
  ]);
  addVariantGroup("img/shields/Canada/BC", ["Canada", "British Columbia"], [
    ["BC", "British Columbia"],
    ["BCYH", "British Columbia Yellowhead Highway"],
    ["BCTC", "British Columbia Trans-Canada Highway"],
  ]);
  addVariantGroup("img/shields/Canada/MB", ["Canada", "Manitoba"], [
    ["MB", "Manitoba"],
    ["MB2", "Manitoba Secondary"],
    ["MBTC", "Manitoba Trans-Canada Highway"],
  ]);
  addVariantGroup("img/shields/Canada/NB", ["Canada", "New Brunswick"], [
    ["NB", "New Brunswick"],
    ["NBCONN", "New Brunswick Connector", undefined, "NBCONN", "NBCONN"],
    ["NBLOCAL", "New Brunswick Local", undefined, "NBLOCAL", "NBLOCAL"],
    ["NBTC", "New Brunswick Trans-Canada Highway", undefined, "NBTC", "NB TC"],
  ]);
  addVariantGroup("img/shields/Canada/NL", ["Canada", "Newfoundland and Labrador"], [
    ["NL", "Newfoundland and Labrador"],
    ["NLTC", "Newfoundland and Labrador Trans-Canada Highway"],
  ]);
  addVariantGroup("img/shields/Canada/NS", ["Canada", "Nova Scotia"], [
    ["NS", "Nova Scotia"],
    ["NSCONN", "Nova Scotia Connector", ["2 Digit"], "NSCONN", "NSCONN"],
    ["NSTC", "Nova Scotia Trans-Canada Highway", undefined, "NSTC", "NSTC"],
  ]);
  addVariantGroup("img/shields/Canada/ON", ["Canada", "Ontario"], [
    ["ON", "Ontario"],
    ["ON2", "Ontario Secondary"],
    ["ON3", "Ontario County"],
    ["ONTC", "Ontario Trans-Canada Highway"],
  ]);
  addExactGroup("img/shields/Canada/ON", ["Canada", "Ontario"], [
    ["ONDVP", "Don Valley Parkway", "ON-DVP.png"],
    ["ONGAR", "Gardiner Expressway", "ON-GAR.png"],
    ["ONTCCOR", "Central Ontario Route", "ONTC-COR.svg"],
    ["ONTCGBR", "Georgian Bay Route", "ONTC-GBR.svg"],
    ["ONTCLSR", "Lake Superior Route", "ONTC-LSR.svg"],
    ["ONTCNOR", "Northern Ontario Route", "ONTC-NOR.svg"],
    ["ONTCOVR", "Ottawa Valley Route", "ONTC-OVR.svg"],
  ]);
  addVariantGroup("img/shields/Canada/PEI", ["Canada", "Prince Edward Island"], [
    ["PEI", "Prince Edward Island", ["2 Digit"]],
  ]);
  addVariantGroup("img/shields/Canada/QC", ["Canada", "Quebec"], [
    ["QC", "Quebec Autoroute"],
    ["QC2", "Quebec Route"],
    ["QCTC", "Quebec Trans-Canada Highway"],
  ]);
  addVariantGroup("img/shields/Canada/SK", ["Canada", "Saskatchewan"], [
    ["SK", "Saskatchewan"],
    ["SK2", "Saskatchewan Secondary"],
    ["SKTC", "Saskatchewan Trans-Canada Highway"],
  ]);

  addVariantGroup("img/shields/Australia", ["Australia"], [
    ["ALPHANUM", "Alphanumeric Route", ["2 Digit", "3 Digit", "4 Digit"]],
    ["NAT", "National Route", ["1 Digit", "2 Digit", "3 Digit"]],
    ["SR", "State Route", ["2 Digit"]],
    ["NR", "National Route (black)", ["2 Digit"]],
    ["MR", "Metroad", ["1 Digit", "2 Digit"]],
    ["TOLLBLUE", "Tollway", ["2 Digit", "3 Digit", "4 Digit"]],
    ["TD", "Tourist Drive", ["2 Digit", "3 Digit"]],
    ["FNSW", "New South Wales Freeway (retired)", ["2 Digit"]],
  ]);
  addVariantGroup("img/shields/New Zealand", ["New Zealand"], [
    ["SH", "State Highway", ["1 Digit", "2 Digit"]],
  ]);

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
  return TextElement.prototype.fontFamily.filter((font) => !isMotorwayFont(font));
};

ShieldElement.prototype.normalizeBannerType = function (value) {
  const options = Shield.prototype.bannerTypes || [];
  const rawValue = typeof value === "string" ? value : "";

  // A whitespace-only manual banner is intentional. It creates a blank
  // above-banner slot so adjacent shields can stay vertically aligned.
  if (rawValue.length > 0 && rawValue.trim() === "") {
    return rawValue;
  }

  const trimmed = rawValue.trim();
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
  const normalizedValue =
    typeof normalizeTextFontFamilyName === "function"
      ? normalizeTextFontFamilyName(value)
      : String(value || "").trim();

  if (normalizedValue && options.includes(normalizedValue)) {
    return normalizedValue;
  }

  if (normalizedValue) {
    const caseInsensitiveMatch = options.find(
      (option) =>
        String(option).toLowerCase() === String(normalizedValue).toLowerCase()
    );

    if (caseInsensitiveMatch) {
      return caseInsensitiveMatch;
    }
  }

  return (
    ShieldElement.prototype.defaultBannerFontFamily ||
    (options.length ? options[0] : "")
  );
};

ShieldElement.prototype.resolveBannerFontFamilyForRender = function (
  value,
  panel = null
) {
  const normalizedFont =
    ShieldElement.prototype.normalizeBannerFontFamily(value);

  if (typeof resolveTextFontFamilyForRender === "function") {
    return resolveTextFontFamilyForRender(normalizedFont, {}, panel);
  }

  if (
    typeof DISPLAY_FONT_TO_RENDER_FONT === "object" &&
    DISPLAY_FONT_TO_RENDER_FONT !== null &&
    DISPLAY_FONT_TO_RENDER_FONT[normalizedFont]
  ) {
    return DISPLAY_FONT_TO_RENDER_FONT[normalizedFont];
  }

  return normalizedFont;
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

ShieldElement.prototype.getBannerDisplayInfo = function (value) {
  const originalValue = String(value ?? "");
  const isBlankPlaceholder =
    originalValue.length > 0 && originalValue.trim() === "";
  const rawValue = isBlankPlaceholder ? originalValue : originalValue.trim();
  let displayValue = isBlankPlaceholder ? "\u00a0" : rawValue;
  let quoted = false;

  if (!isBlankPlaceholder && rawValue.length >= 2) {
    const firstChar = rawValue.charAt(0);
    const lastChar = rawValue.charAt(rawValue.length - 1);
    const matchingQuotes =
      (firstChar === '"' && lastChar === '"') ||
      (firstChar === "'" && lastChar === "'") ||
      (firstChar === "\u201c" && lastChar === "\u201d") ||
      (firstChar === "\u2018" && lastChar === "\u2019");

    if (matchingQuotes) {
      quoted = true;
      displayValue = rawValue.slice(1, -1).trim();
    }
  }

  const normalizedValue = isBlankPlaceholder
    ? ""
    : displayValue.toUpperCase().replace(/\s+/g, " ").trim();

  const yellowPlaqueValues = new Set([
    "TOLL",
    "TOLLWAY",
    "TURNPIKE",
    "TOLL ROAD",
  ]);
  const whitePlaqueValues = new Set([
    "TRUCKS",
    "NO TRUCKS",
    "HAZMATS",
    "NO HAZMATS",
  ]);
  const orangePlaqueValues = new Set(["DETOUR"]);

  const isTollPlaque = yellowPlaqueValues.has(normalizedValue);
  const isTruckPlaque = whitePlaqueValues.has(normalizedValue);
  const isDetourPlaque = orangePlaqueValues.has(normalizedValue);
  const isSpecialPlaque = isTollPlaque || isTruckPlaque || isDetourPlaque;
  const specialPlaqueKind = isTollPlaque
    ? "yellow"
    : isTruckPlaque
      ? "white"
      : isDetourPlaque
        ? "orange"
        : "";
  const automaticBackgroundColor = isTollPlaque
    ? "Yellow"
    : isTruckPlaque
      ? "White"
      : isDetourPlaque
        ? "Orange"
        : "";

  return {
    rawValue,
    displayValue,
    normalizedValue,
    quoted,
    isBlankPlaceholder,
    isTollPlaque,
    isTruckPlaque,
    isDetourPlaque,
    isSpecialPlaque,
    specialPlaqueKind,
    automaticBackgroundColor,
  };
};

// v2.2 saved "None" for an empty banner and a separate TOLL checkbox.
ShieldElement.prototype.migrateLegacyBanners = function (
  showTollBanner,
  tollBannerPosition
) {
  const legacyBannerValues = { none: "", toll: "TOLL" };
  ["bannerType", "bannerType2"].forEach((key) => {
    const legacyValue = legacyBannerValues[String(this[key]).trim().toLowerCase()];
    if (legacyValue !== undefined) {
      this[key] = legacyValue;
    }
  });
  if (showTollBanner !== true) {
    return;
  }
  const slot = !this.bannerType ? "" : !this.bannerType2 ? "2" : null;
  if (slot === null) {
    return;
  }
  this[`bannerType${slot}`] = "TOLL";
  this[`bannerPosition${slot}`] = ShieldElement.prototype.normalizeBannerPosition(
    tollBannerPosition || "Above"
  );
};

ShieldElement.prototype.hasBannerValue = function (value) {
  const bannerInfo = ShieldElement.prototype.getBannerDisplayInfo(value);
  return (
    bannerInfo.isBlankPlaceholder ||
    bannerInfo.displayValue !== ""
  );
};

ShieldElement.prototype.getMergeableAboveBanner = function (
  shield,
  bannerScale = 1,
  panel = null
) {
  if (!shield) {
    return null;
  }

  const bannerCandidates = [
    {
      value: shield.bannerType,
      position: shield.bannerPosition,
      bannerClass: "bannerA",
      indentFirstLetter: shield.indentFirstLetter,
      smallCaps: shield.smallCaps,
      fontSize: shield.bannerFontSize1,
      bannerFontFamily: shield.bannerFontFamily1,
      backgroundColor: shield.bannerBackgroundColor1,
    },
    {
      value: shield.bannerType2,
      position: shield.bannerPosition2,
      bannerClass: "bannerB",
      indentFirstLetter:
        shield.indentFirstLetter2 !== undefined
          ? shield.indentFirstLetter2
          : shield.indentFirstLetter,
      smallCaps:
        shield.smallCaps2 !== undefined ? shield.smallCaps2 : shield.smallCaps,
      fontSize: shield.bannerFontSize2,
      bannerFontFamily: shield.bannerFontFamily2,
      backgroundColor: shield.bannerBackgroundColor2,
    },
  ].filter(
    (candidate) =>
      ShieldElement.prototype.normalizeBannerPosition(candidate.position) ===
        "Above" &&
      ShieldElement.prototype.hasBannerValue(candidate.value)
  );

  const rawRoadName = String(shield.roadName || "");
  const hasRoadName = rawRoadName.trim().length > 0;
  const hasBannerA = ShieldElement.prototype.hasBannerValue(shield.bannerType);
  const hasBannerB = ShieldElement.prototype.hasBannerValue(shield.bannerType2);
  const roadNamePosition = hasBannerA
    ? ShieldElement.prototype.normalizeBannerPosition(shield.bannerPosition)
    : hasBannerB
      ? ShieldElement.prototype.normalizeBannerPosition(shield.bannerPosition2)
      : ShieldElement.prototype.normalizeBannerPosition(shield.bannerPosition);

  // Do not merge stacked content. A shared banner is only used when one plain
  // banner is the sole item occupying the Above slot on each shield.
  if (
    bannerCandidates.length !== 1 ||
    (hasRoadName && roadNamePosition === "Above")
  ) {
    return null;
  }

  const candidate = bannerCandidates[0];
  const info = ShieldElement.prototype.getBannerDisplayInfo(candidate.value);

  // Quotation marks are an explicit opt-out. Blank placeholders reserve space
  // but do not form a visible shared banner.
  if (
    info.quoted ||
    info.isBlankPlaceholder ||
    !info.displayValue
  ) {
    return null;
  }

  return {
    text: info.displayValue,
    bannerClass: candidate.bannerClass,
    indentFirstLetter:
      info.isSpecialPlaque
        ? false
        : candidate.indentFirstLetter !== false,
    smallCaps: candidate.smallCaps !== false,
    fontSizeCss: ShieldElement.prototype.getFontSizeCss(
      ShieldElement.prototype.normalizeFontSize(candidate.fontSize, shield.fontSize)
    ),
    bannerFontFamily: ShieldElement.prototype.normalizeBannerFontFamily(
      candidate.bannerFontFamily || shield.bannerFontFamily
    ),
    backgroundColor: ShieldElement.prototype.normalizeBannerBackgroundColor(
      candidate.backgroundColor
    ),
    bannerLetterSpacing: ShieldElement.prototype.normalizeBannerLetterSpacing(
      shield.bannerLetterSpacing
    ),
    bannerScale: Number.isFinite(Number(bannerScale)) ? Number(bannerScale) : 1,
    panelColor:
      panel?.color ||
      panel?.sign?.color ||
      panel?.backgroundColor ||
      panel?.panelColor ||
      "Green",
    plaqueKind: info.isSpecialPlaque ? info.specialPlaqueKind : "plain",
  };
};

ShieldElement.prototype.createBannerElement = function (
  bannerClass,
  bannerValue,
  fontSizeCss,
  indentFirstLetter,
  bannerFontFamily,
  smallCaps = true,
  panel = null,
  bannerLetterSpacing = 0,
  bannerBackgroundColor = "Inherit"
) {
  const bannerEl = document.createElement("p");
  const shouldIndent = indentFirstLetter !== false;
  bannerEl.className =
    bannerClass + (shouldIndent ? "" : " noIndent") + (smallCaps ? "" : " noSmallCaps");
  bannerEl.style.setProperty("--fontSize", fontSizeCss);

  const normalizedFont =
    ShieldElement.prototype.normalizeBannerFontFamily(bannerFontFamily);
  const renderedFont =
    ShieldElement.prototype.resolveBannerFontFamilyForRender(
      normalizedFont,
      panel
    );

  if (renderedFont) {
    bannerEl.style.setProperty("--bannerFontFamily", `"${renderedFont}"`);
    bannerEl.style.fontFamily = `"${renderedFont}"`;
  }

  const normalizedBannerLetterSpacing = applyBetweenCharacterLetterSpacing(
    bannerEl,
    bannerLetterSpacing
  );
  if (Math.abs(normalizedBannerLetterSpacing) > 0.0001) {
    bannerEl.style.letterSpacing = "var(--betweenLetterSpacing)";
  }

  const bannerInfo = ShieldElement.prototype.getBannerDisplayInfo(bannerValue);
  const normalizedBannerValue = bannerInfo.displayValue;

  if (bannerInfo.isBlankPlaceholder) {
    bannerEl.classList.add("blankBannerPlaceholder");
  }

  const isRoadNameBanner = String(bannerClass || "")
    .split(/\s+/)
    .includes("bannerRoadName");

  const isSpecialPlaqueBanner =
    !isRoadNameBanner && !bannerInfo.quoted && bannerInfo.isSpecialPlaque;

  if (isSpecialPlaqueBanner) {
    bannerEl.classList.add("specialShieldPlaque", "noIndent");
  }

  if (isSpecialPlaqueBanner && bannerInfo.isTollPlaque) {
    // Keep the historical TOLL class for all automatic yellow plaques so they
    // inherit the exact same sizing and positioning rules as the original TOLL build.
    bannerEl.classList.add("TOLL", "yellowElmt");
  }

  if (isSpecialPlaqueBanner && bannerInfo.isTruckPlaque) {
    bannerEl.classList.add("truckPlaque", "whiteElmt");
  }

  if (isSpecialPlaqueBanner && bannerInfo.isDetourPlaque) {
    bannerEl.classList.add("detourPlaque", "orangeElmt");
  }

  ShieldElement.prototype.applyBannerBackgroundColor(
    bannerEl,
    bannerBackgroundColor,
    panel
  );

  if (isRoadNameBanner && /\\n|\n/.test(normalizedBannerValue)) {
    bannerEl.classList.add("multilineRoadName");
  }

  const displayBannerValue = isRoadNameBanner
    ? normalizedBannerValue.replace(/\\n/g, "\n")
    : normalizedBannerValue;

  bannerEl.textContent = bannerInfo.isBlankPlaceholder
    ? "W"
    : normalizedBannerValue
      ? displayBannerValue
      : " ";

  if (/^Motorway (?:Permanent|Temporary)$/.test(renderedFont)) {
    bannerEl.style.setProperty("--bannerFontFamily", `"${getMotorwayFallbackFont(renderedFont)}"`);
    applyMotorwayTextFallback(bannerEl, renderedFont);
  }

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
  smallCaps = true,
  panel = null,
  bannerLetterSpacing = 0
) {
  const normalizedPosition = ShieldElement.prototype.normalizeBannerPosition(
    position
  );

  const container = document.createElement("div");
  container.className = "stackedBannerSlot bannerSlot";
  container.classList.add(`bannerSlot-${normalizedPosition.toLowerCase()}`);

  const normalizedBannerFont =
    ShieldElement.prototype.normalizeBannerFontFamily(bannerFontFamily);
  const renderedBannerFont =
    ShieldElement.prototype.resolveBannerFontFamilyForRender(
      normalizedBannerFont,
      panel
    );
  const usesClearviewBannerFont =
    typeof isClearviewTextFontFamily === "function"
      ? isClearviewTextFontFamily(normalizedBannerFont) ||
        isClearviewTextFontFamily(renderedBannerFont)
      : /^Clearview\s|^Series\s(?:1|2|3|4|5WR|5|6)\b/i.test(
          String(normalizedBannerFont || renderedBannerFont || "")
        );

  if (usesClearviewBannerFont) {
    container.classList.add("clearviewBannerFont");
  }

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
    if (banner?.isRoadName === true || String(banner?.bannerClass || "").split(/\s+/).includes("bannerRoadName")) {
      return false;
    }
    const bannerInfo = ShieldElement.prototype.getBannerDisplayInfo(banner.bannerValue);
    return !bannerInfo.quoted && bannerInfo.isTollPlaque;
  });

  const hasTruckBanner = banners.some((banner) => {
    if (banner?.isRoadName === true || String(banner?.bannerClass || "").split(/\s+/).includes("bannerRoadName")) {
      return false;
    }
    const bannerInfo = ShieldElement.prototype.getBannerDisplayInfo(banner.bannerValue);
    return !bannerInfo.quoted && bannerInfo.isTruckPlaque;
  });

  const hasDetourBanner = banners.some((banner) => {
    if (banner?.isRoadName === true || String(banner?.bannerClass || "").split(/\s+/).includes("bannerRoadName")) {
      return false;
    }
    const bannerInfo = ShieldElement.prototype.getBannerDisplayInfo(banner.bannerValue);
    return !bannerInfo.quoted && bannerInfo.isDetourPlaque;
  });

  if (hasTollBanner) {
    container.classList.add("tollStackedBanner");
  }

  if (hasTruckBanner) {
    container.classList.add("truckStackedBanner");
  }

  if (hasDetourBanner) {
    container.classList.add("detourStackedBanner");
  }

  const isSidePosition =
    normalizedPosition === "Left" || normalizedPosition === "Right";
  const isBilingualDirectionBanner = container.classList.contains(
    "bilingualDirectionBanner"
  );

  if (isSidePosition) {
    container.classList.add("sideBannerStack");
  }
  const hasPlainEnlargedBanner = banners.some((banner) => {
    const bannerInfo = ShieldElement.prototype.getBannerDisplayInfo(
      banner.bannerValue
    );
    const bannerIndent =
      typeof banner.indentFirstLetter === "boolean"
        ? banner.indentFirstLetter
        : indentFirstLetter;
    const isRoadName =
      banner.isRoadName === true ||
      String(banner.bannerClass || "")
        .split(/\s+/)
        .includes("bannerRoadName");

    return (
      !isRoadName &&
      bannerIndent !== false &&
      !bannerInfo.isSpecialPlaque
    );
  });

  // Normal enlarged-letter side stacks share the shield's grid-row start.
  // Their lower lines remain in normal flow and do not alter the top line.
  if (
    isSidePosition &&
    !isBilingualDirectionBanner &&
    !hasTollBanner &&
    !hasTruckBanner &&
    !hasDetourBanner &&
    hasPlainEnlargedBanner
  ) {
    container.classList.add("plainEnlargedSideBannerStack");
  }

  banners.forEach(
    ({
      bannerClass,
      bannerValue,
      containerClass,
      indentFirstLetter: bannerSpecificIndent,
      smallCaps: bannerSpecificSmallCaps,
      bannerLetterSpacing: bannerSpecificLetterSpacing,
      bannerFontFamily: bannerSpecificFontFamily,
      fontSizeCss: bannerSpecificFontSizeCss,
      backgroundColor: bannerSpecificBackgroundColor,
      isMultilineRoadName,
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
        bannerSpecificFontSizeCss || fontSizeCss,
        bannerIndent,
        bannerSpecificFontFamily || bannerFontFamily,
        bannerSmallCaps,
        panel,
        typeof bannerSpecificLetterSpacing === "number"
          ? bannerSpecificLetterSpacing
          : bannerLetterSpacing,
        bannerSpecificBackgroundColor
      );

      if (isMultilineRoadName) {
        bannerEl.classList.add("multilineRoadName");
      }

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
  smallCaps = true,
  panel = null,
  bannerLetterSpacing = 0,
  bannerBackgroundColor = "Inherit"
) {
  const container = document.createElement("div");
  container.className = containerClass;
  container.classList.add("bannerSlot");

  const normalizedPosition = ShieldElement.prototype.normalizeBannerPosition(
    position
  );
  container.classList.add(`bannerSlot-${normalizedPosition.toLowerCase()}`);

  const normalizedBannerFont =
    ShieldElement.prototype.normalizeBannerFontFamily(bannerFontFamily);
  const renderedBannerFont =
    ShieldElement.prototype.resolveBannerFontFamilyForRender(
      normalizedBannerFont,
      panel
    );
  const usesClearviewBannerFont =
    typeof isClearviewTextFontFamily === "function"
      ? isClearviewTextFontFamily(normalizedBannerFont) ||
        isClearviewTextFontFamily(renderedBannerFont)
      : /^Clearview\s|^Series\s(?:1|2|3|4|5WR|5|6)\b/i.test(
          String(normalizedBannerFont || renderedBannerFont || "")
        );

  if (usesClearviewBannerFont) {
    container.classList.add("clearviewBannerFont");
  }

  const bannerInfo = ShieldElement.prototype.getBannerDisplayInfo(bannerValue);
  const isRoadNameBanner = String(bannerClass || "")
    .split(/\s+/)
    .includes("bannerRoadName");

  if (!isRoadNameBanner && !bannerInfo.quoted && bannerInfo.isTollPlaque) {
    container.classList.add("tollBannerSlot");
  }

  if (!isRoadNameBanner && !bannerInfo.quoted && bannerInfo.isTruckPlaque) {
    container.classList.add("truckBannerSlot");
  }

  if (!isRoadNameBanner && !bannerInfo.quoted && bannerInfo.isDetourPlaque) {
    container.classList.add("detourBannerSlot");
  }

  const bannerEl = ShieldElement.prototype.createBannerElement(
    bannerClass,
    bannerValue,
    fontSizeCss,
    indentFirstLetter,
    bannerFontFamily,
    smallCaps,
    panel,
    bannerLetterSpacing,
    bannerBackgroundColor
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

    const legacyVariantKey =
      ShieldElement.prototype.formatVariantKey(normalized);
    const migratedVariant =
      ShieldElement.prototype.resolveLegacyVariantAlias(
        config?.legacyVariantAliases?.[legacyVariantKey],
        routeNumber
      );
    if (migratedVariant && allowed.includes(migratedVariant)) {
      return migratedVariant;
    }

    return allowed[0] || normalized;
  }
  const fallback = allowed[0] || ShieldElement.prototype.defaultVariant;
  const inferred = ShieldElement.prototype.getVariantFromRoute(routeNumber, config);
  return allowed.includes(inferred) ? inferred : fallback;
};

ShieldElement.prototype.migrateLegacyBlockVariant = function (
  desiredVariant,
  routeNumber,
  config
) {
  if (typeof desiredVariant !== "string") {
    return desiredVariant;
  }
  const requested = desiredVariant.trim();
  const allowed = config?.variants || [];
  // A third digit must select the wide panel at the same physical height,
  // even when the user previously selected an explicit 1-2 digit construction.
  if (config?.value === "FL" && /1-2 Digit$/.test(requested) &&
      ShieldElement.prototype.getRouteCharacterCount(routeNumber) >= 3) {
    const key = ShieldElement.prototype.formatVariantKey(requested);
    const height = config.physicalDimensionsByVariant?.[key]?.heightIn;
    const wide = allowed.find((variant) => {
      const candidate = ShieldElement.prototype.formatVariantKey(variant);
      return config.routeNumberByVariant?.[candidate]?.variablePanelWidth &&
        config.physicalDimensionsByVariant?.[candidate]?.heightIn === height;
    });
    if (wide) return wide;
  }
  if (
    !requested ||
    requested.toLowerCase() === "auto" ||
    allowed.includes(requested)
  ) {
    return desiredVariant;
  }
  const legacyKey = ShieldElement.prototype.formatVariantKey(requested);
  const migrated = ShieldElement.prototype.resolveLegacyVariantAlias(
    config?.legacyVariantAliases?.[legacyKey],
    routeNumber
  );
  return migrated && allowed.includes(migrated) ? migrated : desiredVariant;
};

ShieldElement.prototype.resolveLegacyVariantAlias = function (
  alias,
  routeNumber
) {
  if (typeof alias === "string") {
    return alias;
  }
  if (!alias || typeof alias !== "object") {
    return null;
  }

  return ShieldElement.prototype.getRouteCharacterCount(routeNumber) >= 3
    ? alias.threeOrMore
    : alias.oneToTwo;
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

ShieldElement.prototype.limitRouteCharacters = function (
  routeNumber,
  config
) {
  const normalizedRoute = String(routeNumber ?? "").trim();
  const maximumCharacters = Math.trunc(Number(config?.maxRouteCharacters));
  if (!(maximumCharacters > 0)) {
    return normalizedRoute;
  }

  return Array.from(normalizedRoute).slice(0, maximumCharacters).join("");
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
  const characterCount =
    ShieldElement.prototype.getRouteCharacterCount(routeNumber);
  const officialAutoVariants = config?.autoVariantByCharacterCount;
  if (officialAutoVariants) {
    return characterCount >= 3
      ? officialAutoVariants.threeOrMore
      : officialAutoVariants.oneToTwo;
  }
  const supportsOneDigit =
    Array.isArray(config?.variants) && config.variants.includes("1 Digit");
  const supportsFourDigit =
    Array.isArray(config?.variants) && config.variants.includes("4 Digit");
  const supportsFiveDigit =
    Array.isArray(config?.variants) && config.variants.includes("5 Digit");
  if (supportsOneDigit && characterCount <= 1) {
    return "1 Digit";
  }
  if (supportsFiveDigit && characterCount >= 5) {
    return "5 Digit";
  }
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

ShieldElement.prototype.getShieldArtworkVariantKey = function (
  config,
  variantKey
) {
  const normalizedCode =
    ShieldElement.prototype.normalizeShieldCode(
      config?.value || config?.assetName || ""
    ).toUpperCase();

  if (
    variantKey === "3Digit" &&
    Shield.prototype.usesSharedTwoDigitArtwork(normalizedCode)
  ) {
    return "2Digit";
  }

  return variantKey;
};

ShieldElement.prototype.getRenderedShieldAssetPath = function (
  config,
  variantKey,
  {
    shieldBase = "",
    shieldBacks = false,
  } = {}
) {
  const normalizedShieldCode =
    ShieldElement.prototype.normalizeShieldCode(
      shieldBase || config?.value || config?.assetName || ""
    ).toUpperCase();
  const supportsShieldBacks =
    ShieldElement.prototype.supportsShieldBacks(config);
  const shieldBacksEnabled =
    supportsShieldBacks && shieldBacks === true;

  const artworkVariantKey =
    ShieldElement.prototype.getShieldArtworkVariantKey(
      config,
      variantKey
    );

  if (
    normalizedShieldCode === "US" &&
    (artworkVariantKey === "2Digit" || artworkVariantKey === "3Digit")
  ) {
    const usFolder = "img/shields/United States/US Route";
    return shieldBacksEnabled
      ? `${usFolder}/US-back-${artworkVariantKey}.svg`
      : `${usFolder}/US-${artworkVariantKey}.svg`;
  }

  if (
    normalizedShieldCode === "NJ" &&
    (artworkVariantKey === "2Digit" || artworkVariantKey === "3Digit")
  ) {
    return shieldBacksEnabled
      ? `img/shields/United States/NJ/NJ-${artworkVariantKey}.svg`
      : `img/shields/United States/DE-${artworkVariantKey}.svg`;
  }

  return ShieldElement.prototype.getShieldAssetPath(
    config,
    artworkVariantKey
  );
};

ShieldElement.prototype.getShieldAssetPath = function (config, variantKey) {
  const artworkVariantKey =
    ShieldElement.prototype.getShieldArtworkVariantKey
      ? ShieldElement.prototype.getShieldArtworkVariantKey(config, variantKey)
      : variantKey;
  let path = "";

  if (
    config?.assetPathByVariant &&
    config.assetPathByVariant[artworkVariantKey]
  ) {
    path = config.assetPathByVariant[artworkVariantKey];
  } else if (config?.assetPath) {
    path = config.assetPath;
  } else {
    const assetFolder = config?.assetFolder || "img/shields";
    const assetName = config?.assetName || config?.value || "I";
    const suffix = artworkVariantKey ? `-${artworkVariantKey}` : "";
    path = `${assetFolder}/${assetName}${suffix}.svg`;
  }

  return typeof window.resolveSignMakerAsset === "function"
    ? window.resolveSignMakerAsset(path)
    : path;
};

ShieldElement.prototype.getVariantMetadata = function (
  config,
  propertyName,
  variantKey
) {
  const values = config?.[propertyName];
  if (!values || typeof values !== "object") {
    return null;
  }

  return values[variantKey] || values.Default || null;
};

// Florida shields use the official FDOT/CFX layout, not preset CSS.
ShieldElement.prototype.usesPresetFloridaRouteNumberCss = function () {
  return false;
};

ShieldElement.prototype.usesV22NumberStyle = function (config) {
  if (config?.standard === "FDOT" || config?.standard === "CFX") {
    return true;
  }
  const normalized = ShieldElement.prototype.normalizeShieldCode(
    config?.value || config?.assetName || ""
  );
  return V22_NUMBER_STYLE_SHIELDS.includes(normalized);
};

ShieldElement.prototype.isFixedRouteVariant = function (config, variantKey) {
  return (
    Array.isArray(config?.fixedRouteVariants) &&
    config.fixedRouteVariants
      .map((variant) => ShieldElement.prototype.formatVariantKey(variant))
      .includes(variantKey)
  );
};

ShieldElement.prototype.isCountyShield = function (config) {
  const normalized = ShieldElement.prototype.normalizeShieldCode(
    config?.value || config?.assetName || ""
  );

  return normalized === "C" || config?.preserveCountyText === true;
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
    dividerWidth = 1,
    dividerMeasurement = "rem",
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

DividerElement.prototype.dividerMeasurement = ["rem", "%"];
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
  constructor({
    icon = "Airplane",
    iconSize = 3,
    backgroundColor = "Inherit",
    border = false,
    borderRadius = 4,
    borderColor = "White",
    spacing = 0,
    alignment = "Center",
    invertColor = false,
    paddingHorizontal = 0,
    paddingVertical = 0,
  } = {}) {
    // Uploaded icons may load after a saved sign is restored.
    this.icon = (IconElement.prototype.icons[icon] ||
      (typeof icon === "string" && icon.startsWith("CUSTOMICON-")))
      ? icon
      : IconElement.prototype.defaultIcon;
    this.iconSize = iconSize;
    this.backgroundColor = backgroundColor;
    this.border = border;
    this.borderRadius = borderRadius;
    this.borderColor = borderColor;
    this.spacing = spacing;
    // v2.19 padding around the icon (rem); negative values pull it in.
    this.paddingHorizontal = Number.isFinite(parseFloat(paddingHorizontal)) ? parseFloat(paddingHorizontal) : 0;
    this.paddingVertical = Number.isFinite(parseFloat(paddingVertical)) ? parseFloat(paddingVertical) : 0;
    this.invertColor =
      invertColor === true ||
      invertColor === "true" ||
      invertColor === 1 ||
      invertColor === "1" ||
      invertColor === "on";
    const validAlignments = Array.isArray(TextElement.prototype.alignment)
      ? TextElement.prototype.alignment
      : [];
    this.alignment = validAlignments.includes(alignment) ? alignment : "Center";
  }

  createElement() {
    const container = document.createElement("div");
    container.className = "bE-iconElement";

    const parsedSpacing = parseFloat(this.spacing);
    const spacing = isNaN(parsedSpacing) ? 0 : parsedSpacing;
    container.style.setProperty("--spacing", spacing + "rem");
    const paddingHorizontal = parseFloat(this.paddingHorizontal) || 0;
    const paddingVertical = parseFloat(this.paddingVertical) || 0;
    if (paddingHorizontal || paddingVertical) {
      container.style.setProperty("--spacing", spacing + Math.min(paddingHorizontal, 0) + "rem");
      container.style.marginTop = container.style.marginBottom = Math.min(paddingVertical, 0) + "rem";
      container.style.paddingLeft = container.style.paddingRight = Math.max(paddingHorizontal, 0) + "rem";
      container.style.paddingTop = container.style.paddingBottom = Math.max(paddingVertical, 0) + "rem";
    }

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

    if (this.invertColor) {
      container.classList.add("invertColor");
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
  "YIELD": { label: "Yield", src: "img/icons/YIELD.svg" },
  "CONE": { label: "Cone", src: "img/icons/Cone.png" },
  "SEATBELT": { label: "Seatbelt", src: "img/icons/Seatbelt.png" },

  "ORANGE_COUNTY": { label: "Orange", src: "img/icons/orange_county.svg"},
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
  constructor({
    arrow = ArrowElement.prototype.defaultArrow,
    rotation = 0,
    size = null,
    padding = null,
    paddingHorizontal = null,
    paddingVertical = null,
    flip = false,
    alignment = "Auto",
  } = {}) {
    // v2.19 alignment; "Auto" keeps the alignment of the block before it.
    this.alignment = ["Left", "Center", "Right"].includes(alignment) ? alignment : "Auto";
    const resolveArrowKey = ArrowElement.prototype.arrows[arrow]
      ? arrow
      : ArrowElement.prototype.defaultArrow;
    this.arrow = resolveArrowKey;
    this.rotation = rotation;
    this.flip =
      flip === true ||
      flip === "true" ||
      flip === 1 ||
      flip === "1" ||
      flip === "on";

    const arrowDefinition = ArrowElement.prototype.arrows[this.arrow] || {};
    const defaultSize =
      typeof arrowDefinition.defaultSize === "number"
        ? arrowDefinition.defaultSize
        : ArrowElement.prototype.defaultSize;

    const normalizeNumber = (value, fallback = 0) => {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? fallback : parsed;
    };

    if (size === null || size === undefined || size === "") {
      this.size = defaultSize;
    } else {
      this.size = normalizeNumber(size, defaultSize);
    }

    const fallbackPadding =
      padding !== null && padding !== undefined ? padding : 0;
    this.paddingHorizontal = normalizeNumber(
      paddingHorizontal !== null && paddingHorizontal !== undefined
        ? paddingHorizontal
        : fallbackPadding,
      0
    );
    this.paddingVertical = normalizeNumber(
      paddingVertical !== null && paddingVertical !== undefined
        ? paddingVertical
        : fallbackPadding,
      0
    );
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
  TYPE_E: { label: "Type E", src: "img/arrowBlocks/TYPE_E.svg" },
  DOWN: { label: "Down", src: "img/arrowBlocks/DOWN.svg", defaultSize: 2.75 },
  DOWN_ON: {
    label: "Down (Ontario)",
    src: "img/arrowBlocks/DOWN_ON.svg",
    defaultSize: 2.75,
  },
  DOWN_ALT: {
    label: "Down (alt)",
    src: "img/arrowBlocks/DOWN_ALT.svg",
    defaultSize: 3,
  },
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
  APL_UP_CFX: { label: "APL Up CFX", src: "img/arrowBlocks/APL_UP_CFX.svg" },
  APL_UP_TURN_CFX: {
    label: "APL Up Turn CFX",
    src: "img/arrowBlocks/APL_UP_TURN_CFX.svg",
  },
  APL_TURN_CFX: {
    label: "APL Turn CFX",
    src: "img/arrowBlocks/APL_TURN_CFX.svg",
  },
};
ArrowElement.prototype.defaultArrow = "TYPE_A";
ArrowElement.prototype.defaultSize = 1.75;
ArrowElement.prototype.arrowKeys = Object.keys(ArrowElement.prototype.arrows);

class TollLogoElement {
  constructor({
    logo = TollLogoElement.prototype.defaultLogo,
    logoHeight = 3,
    spacing = 0,
    horizontalPadding = 0.2,
    verticalPadding = 0.05,
    background = false,
    backgroundColor = "White",
    alignment = "Center",
    squareIcon = false,
    borderRadius = 8,
    hasOnlyBlock = false,
  } = {}) {
    this.logo = TollLogoElement.prototype.logos[logo]
      ? logo
      : TollLogoElement.prototype.defaultLogo;
    this.logoHeight = logoHeight;
    this.spacing = spacing;
    this.background = background;
    this.squareIcon = squareIcon;
    this.borderRadius = borderRadius;
    this.backgroundColor = backgroundColor;
    this.horizontalPadding = horizontalPadding;
    this.verticalPadding = verticalPadding;
    this.hasOnlyBlock = hasOnlyBlock;
    const validAlignments = Array.isArray(TextElement.prototype.alignment)
      ? TextElement.prototype.alignment
      : [];
    this.alignment = validAlignments.includes(alignment) ? alignment : "Center";
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
  CATag: { label: "CATag", src: "img/tolls/CATag.png" },
  CAToll: { label: "CAToll", src: "img/tolls/CAToll.png" },
  Telepass: { label: "Telepass", src: "img/tolls/Telepass.png" },
  FASTag: { label: "FASTag", src: "img/tolls/FASTag.png" },
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

const resolveFullBleedDividerBorderColor = ({
  dividerBorderColor,
  rowBorderColor,
  defaultDividerColor,
  isHorizontalDivider,
  backgroundFullWidth,
  usesLightBleedBackground,
}) => {
  const normalizeColor = (color) =>
    typeof color === "string" ? color.trim().toLowerCase() : color;
  const shouldPreserveRowBorder =
    isHorizontalDivider &&
    backgroundFullWidth &&
    usesLightBleedBackground &&
    rowBorderColor &&
    normalizeColor(dividerBorderColor) === normalizeColor(defaultDividerColor);

  return shouldPreserveRowBorder ? rowBorderColor : dividerBorderColor;
};

ShieldElement.prototype.areMergeableAboveBannersEquivalent = function (
  firstDescriptor,
  secondDescriptor
) {
  if (!firstDescriptor || !secondDescriptor) {
    return false;
  }

  const firstIsSpecialPlaque =
    firstDescriptor.plaqueKind && firstDescriptor.plaqueKind !== "plain";
  const secondIsSpecialPlaque =
    secondDescriptor.plaqueKind && secondDescriptor.plaqueKind !== "plain";

  // Automatic special plaques have a dedicated rendered build. If two
  // adjacent shields use the same one, merge the visible plaque even when
  // stale editor-only banner settings differ between the shields.
  if (firstIsSpecialPlaque || secondIsSpecialPlaque) {
    return (
      firstIsSpecialPlaque &&
      secondIsSpecialPlaque &&
      firstDescriptor.plaqueKind === secondDescriptor.plaqueKind &&
      firstDescriptor.text === secondDescriptor.text &&
      firstDescriptor.bannerScale === secondDescriptor.bannerScale
    );
  }

  return (
    firstDescriptor.text === secondDescriptor.text &&
    firstDescriptor.indentFirstLetter === secondDescriptor.indentFirstLetter &&
    firstDescriptor.smallCaps === secondDescriptor.smallCaps &&
    firstDescriptor.fontSizeCss === secondDescriptor.fontSizeCss &&
    firstDescriptor.bannerFontFamily === secondDescriptor.bannerFontFamily &&
    firstDescriptor.backgroundColor === secondDescriptor.backgroundColor &&
    firstDescriptor.bannerLetterSpacing === secondDescriptor.bannerLetterSpacing &&
    firstDescriptor.bannerScale === secondDescriptor.bannerScale &&
    firstDescriptor.panelColor === secondDescriptor.panelColor &&
    firstDescriptor.plaqueKind === secondDescriptor.plaqueKind
  );
};

ShieldElement.prototype.mergeConsecutiveAboveBanners = function (container) {
  if (!container) {
    return;
  }

  const children = Array.from(container.children);
  const mergeRuns = [];
  let index = 0;

  while (index < children.length) {
    const first = children[index];
    const descriptor = first?._mergeableAboveBanner;

    if (!descriptor) {
      index += 1;
      continue;
    }

    const run = [first];
    let nextIndex = index + 1;

    while (nextIndex < children.length) {
      const next = children[nextIndex];
      const nextDescriptor = next?._mergeableAboveBanner;

      if (
        !ShieldElement.prototype.areMergeableAboveBannersEquivalent(
          descriptor,
          nextDescriptor
        )
      ) {
        break;
      }

      run.push(next);
      nextIndex += 1;
    }

    if (run.length > 1) {
      mergeRuns.push({ run, descriptor });
    }

    index = nextIndex;
  }

  if (!mergeRuns.length) {
    return;
  }

  container.classList.add("bE-hasSharedAboveBanners");

  mergeRuns.forEach(({ run, descriptor }) => {
    const runEntries = run.map((shieldElement) => {
      const shieldDescriptor = shieldElement._mergeableAboveBanner;
      const sourceBanner = shieldElement.querySelector(
        `.bannerSlot-above .${shieldDescriptor.bannerClass}`
      );

      return {
        shieldElement,
        sourceBanner,
      };
    });

    // Collapse the source banners before this detached row is inserted into the
    // document. This prevents the individual copies from flashing for one frame
    // before the shared banner is measured and positioned.
    runEntries.forEach((entry) => {
      if (entry.sourceBanner) {
        entry.sourceBanner.classList.add("bE-sharedAboveBannerSource");
      }
    });

    const sharedBanner = ShieldElement.prototype.createBannerElement(
      descriptor.bannerClass,
      descriptor.text,
      descriptor.fontSizeCss,
      descriptor.indentFirstLetter,
      descriptor.bannerFontFamily,
      descriptor.smallCaps,
      { color: descriptor.panelColor },
      descriptor.bannerLetterSpacing,
      descriptor.backgroundColor
    );

    sharedBanner.classList.add("bE-sharedAboveBannerText");
    sharedBanner.style.setProperty(
      "--bannerScale",
      String(descriptor.bannerScale || 1)
    );
    sharedBanner.style.visibility = "hidden";
    sharedBanner.setAttribute("aria-hidden", "true");
    container.appendChild(sharedBanner);

    let positionFrame = null;

    const positionSharedBanner = () => {
      positionFrame = null;

      if (!container.isConnected || !sharedBanner.isConnected) {
        return false;
      }

      const firstShield =
        runEntries[0].shieldElement.querySelector(".shield") ||
        runEntries[0].shieldElement;
      const lastShield =
        runEntries[runEntries.length - 1].shieldElement.querySelector(".shield") ||
        runEntries[runEntries.length - 1].shieldElement;
      const sourceBanner = runEntries[0].sourceBanner;

      const firstRect = firstShield.getBoundingClientRect();
      const lastRect = lastShield.getBoundingClientRect();
      const bannerRect = sharedBanner.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const sourceRect = sourceBanner?.getBoundingClientRect();

      if (
        !firstRect.width ||
        !lastRect.width ||
        !bannerRect.width ||
        !containerRect.width ||
        !sourceRect?.height
      ) {
        return false;
      }

      const naturalSpan = Math.max(0, lastRect.right - firstRect.left);
      const extraWidth = Math.max(0, bannerRect.width - naturalSpan);
      const extraPerGap =
        extraWidth > 0 && runEntries.length > 1
          ? extraWidth / (runEntries.length - 1)
          : 0;

      const baseMargins = runEntries.map((entry) => {
        const computedMarginRight = parseFloat(
          window.getComputedStyle(entry.shieldElement).marginRight
        );
        return Number.isFinite(computedMarginRight) ? computedMarginRight : 0;
      });

      const containerScaleX =
        container.offsetWidth > 0
          ? containerRect.width / container.offsetWidth
          : 1;
      const containerScaleY =
        container.offsetHeight > 0
          ? containerRect.height / container.offsetHeight
          : containerScaleX;
      const safeScaleX =
        Number.isFinite(containerScaleX) && containerScaleX > 0
          ? containerScaleX
          : 1;
      const safeScaleY =
        Number.isFinite(containerScaleY) && containerScaleY > 0
          ? containerScaleY
          : safeScaleX;

      const runCenter =
        ((firstRect.left + lastRect.right + extraWidth) / 2 -
          containerRect.left) /
        safeScaleX;
      const bannerTop =
        (sourceRect.top - containerRect.top) / safeScaleY;

      if (extraPerGap > 0) {
        runEntries.slice(0, -1).forEach((entry, entryIndex) => {
          entry.shieldElement.style.setProperty(
            "margin-right",
            baseMargins[entryIndex] + extraPerGap + "px",
            "important"
          );
        });
      }

      sharedBanner.style.setProperty("left", runCenter + "px", "important");
      sharedBanner.style.setProperty("top", bannerTop + "px", "important");

      sharedBanner.style.removeProperty("visibility");
      return true;
    };

    const schedulePosition = () => {
      if (positionFrame !== null) {
        return;
      }

      positionFrame = requestAnimationFrame(positionSharedBanner);
    };

    const positionedImmediately = positionSharedBanner();

    if (
      document.fonts &&
      document.fonts.status === "loading" &&
      document.fonts.ready
    ) {
      document.fonts.ready.then(schedulePosition).catch(schedulePosition);
    } else if (!positionedImmediately) {
      schedulePosition();
    }
  });
};

class Control {
  constructor({ rows = [], blockProperties = [] } = {}) {
    this.rows = rows;
    this.blockProperties = blockProperties;
  }

  addElement(element, properties, row, column) {
    let newElement = new element(properties);
    if (!this.rows[row]) {
      this.rows[row] = [];
      this.blockProperties[row] = this.createBlockWithNeighborBackground(row);
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

  createBlockWithNeighborBackground(row, sourceRowIndex) {
    const newBlock = new Block();
    const neighborIndexes = [];

    if (Number.isInteger(sourceRowIndex)) {
      neighborIndexes.push(sourceRowIndex);
    }

    neighborIndexes.push(row - 1, row);

    for (const index of [...new Set(neighborIndexes)]) {
      const neighborProperties = this.blockProperties[index];
      if (
        neighborProperties &&
        typeof neighborProperties.backgroundColor === "string"
      ) {
        newBlock.backgroundColor = neighborProperties.backgroundColor;
        break;
      }
    }

    return newBlock;
  }

  addRow(row, element, { sourceRowIndex } = {}) {
    const newBlockProperties = this.createBlockWithNeighborBackground(
      row,
      sourceRowIndex
    );

    if (this.rows[row] && this.rows[row].length != 0) {
      this.rows.splice(row, 0, []);
      this.blockProperties.splice(row, 0, newBlockProperties);
    } else if (!this.rows[row]) {
      this.rows[row] = [];
      this.blockProperties[row] = newBlockProperties;
    } else if (!this.blockProperties[row]) {
      this.blockProperties[row] = newBlockProperties;
    }
    this.addElement(Control.prototype.blockToClassElems[element], {}, row, 0);
  }

  duplicateRow(row) {
    let newRows = [];
    for (const e of this.rows[row]) {
      newRows.push(this.cloneElement(e));
    }
    this.rows.splice(row + 1, 0, newRows);
    this.blockProperties.splice(
      row + 1,
      0,
      this.cloneBlockProperties(this.blockProperties[row])
    );
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
      const rowBleedTop = topSpacing;
      const rowBleedBottom = bottomSpacing;
      const bleedTop = i === 0 ? signPadding.top : "0rem";
      const bleedBottom = i === totalRows - 1 ? signPadding.bottom : "0rem";
      const hasVerticalDivider = row.some(
        (elem) =>
          elem instanceof DividerElement &&
          elem.orientation === DividerElement.prototype.verticalOrientation
      );
      const flexRow = document.createElement("div");
      flexRow.className = "blockElementRow";
      flexRow.dataset.blockBackgroundColor =
        typeof properties.backgroundColor === "string"
          ? properties.backgroundColor.trim().toLowerCase()
          : "inherit";
      if (hasVerticalDivider) {
        flexRow.classList.add("hasVerticalDivider");
      }
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
      let fullBleedDividerIsHorizontal = false;
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
          fullBleedDividerIsHorizontal =
            elem.orientation !== DividerElement.prototype.verticalOrientation;
        }

        const blockElmt = elem.createElement(panel, subPanel);
        if (
          elem instanceof DividerElement &&
          elem.fullBleed === true &&
          elem.orientation === DividerElement.prototype.verticalOrientation
        ) {
          blockElmt.style.setProperty(
            "--dividerBleedTop",
            i === 0 ? bleedTop : "0rem"
          );
          blockElmt.style.setProperty(
            "--dividerBleedBottom",
            i === totalRows - 1 ? bleedBottom : "0rem"
          );
          blockElmt.style.setProperty("--dividerRowBleedTop", rowBleedTop);
          blockElmt.style.setProperty("--dividerRowBleedBottom", rowBleedBottom);
        }
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
        const resolvedDividerBorderColor =
          resolveFullBleedDividerBorderColor({
            dividerBorderColor,
            rowBorderColor: appliedFullBleedBorderColor,
            defaultDividerColor: (lib.colors && lib.colors.White) || "white",
            isHorizontalDivider: fullBleedDividerIsHorizontal,
            backgroundFullWidth: !!properties.backgroundFullWidth,
            usesLightBleedBackground,
          });
        const normalizedDividerColor =
          typeof resolvedDividerBorderColor === "string"
            ? resolvedDividerBorderColor.toLowerCase()
            : resolvedDividerBorderColor;
        flexRow.dataset.fullBleedBorderColor = normalizedDividerColor;
        appliedFullBleedBorderColor = normalizedDividerColor;
      }

      flexRow.dataset.lightBackground = usesLightBleedBackground
        ? "true"
        : "false";
      if (
        properties.backgroundFullWidth &&
        usesLightBleedBackground &&
        appliedFullBleedBorderColor
      ) {
        flexRow.dataset.fullBleedStroke = "true";
        flexRow.style.setProperty(
          "--fullBleedBorderColor",
          appliedFullBleedBorderColor
        );
      } else {
        delete flexRow.dataset.fullBleedStroke;
        flexRow.style.removeProperty("--fullBleedBorderColor");
      }

      flexRow.appendChild(leftAlignment);
      flexRow.appendChild(centerAlignment);
      flexRow.appendChild(rightAlignment);
      flexBox.appendChild(flexRow);
    }

    return flexBox;
  }
}

class GroupedBlockElement {
  constructor({
    label = GroupedBlockElement.defaultLabel,
    alignment = "Center",
    backgroundColor = "Inherit",
    padding = 0,
    borderRadius = 0,
    border = false,
    borderColor = "Inherit",
    blockElements,
  } = {}) {
    this.label =
      typeof label === "string" && label.trim().length
        ? label
        : GroupedBlockElement.defaultLabel;
    this.alignment = TextElement.prototype.alignment.includes(alignment)
      ? alignment
      : "Center";
    this.backgroundColor = TextElement.prototype.backgroundColor.includes(backgroundColor)
      ? backgroundColor
      : "Inherit";
    // Both in rem; the editor supplies strings.
    this.padding = GroupedBlockElement.normalizeLength(padding);
    this.borderRadius = GroupedBlockElement.normalizeLength(borderRadius);
    this.border = border === true;
    this.borderColor = TextElement.prototype.backgroundColor.includes(borderColor)
      ? borderColor
      : "Inherit";

    if (blockElements instanceof Control) {
      this.blockElements = blockElements;
    } else if (blockElements && Array.isArray(blockElements.rows)) {
      this.blockElements = new Control(blockElements);
    } else {
      this.blockElements = new Control({
        rows: [[new ControlTextElement({ textContent: "Grouped Block" })]],
        blockProperties: [new Block()],
      });
    }
  }

  createElement(panel, subPanel) {
    const wrapper = document.createElement("div");
    wrapper.className = "bE-groupedBlockElement";
    wrapper.dataset.groupLabel = this.label;
    const hasBackground = this.backgroundColor !== "Inherit";
    if (hasBackground) {
      wrapper.style.backgroundColor = (
        lib.colors[this.backgroundColor] || this.backgroundColor
      ).toLowerCase();
      wrapper.style.color =
        getColorBrightness(this.backgroundColor) === "light" ? "black" : "white";
    }

    const padding = GroupedBlockElement.normalizeLength(this.padding);
    const borderRadius = GroupedBlockElement.normalizeLength(this.borderRadius);
    if (padding) wrapper.style.padding = `${padding}rem`;
    if (borderRadius) wrapper.style.borderRadius = `${borderRadius}rem`;
    if (this.border) {
      // Inherit follows the group's text color; the width matches the sign's.
      wrapper.style.border = `var(--signBorderWidth, 0.2rem) solid ${
        this.borderColor === "Inherit"
          ? "currentColor"
          : (lib.colors[this.borderColor] || this.borderColor).toLowerCase()
      }`;
    }

    // Contents render as if on the group's color (e.g. Clearview W/B faces).
    const nestedPanel =
      panel && panel.sign
        ? {
          ...panel,
          ...(hasBackground ? { color: this.backgroundColor } : {}),
          sign: {
            ...panel.sign,
            padding: "0rem 0rem 0rem 0rem",
          },
        }
        : panel;
    const nestedBlockElements = this.blockElements.createElement(
      nestedPanel,
      subPanel
    );
    nestedBlockElements.classList.add("bE-groupedBlockElementContent");
    wrapper.appendChild(nestedBlockElements);
    return wrapper;
  }
}

GroupedBlockElement.defaultLabel = "Group";
GroupedBlockElement.normalizeLength = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};
GroupedBlockElement.prototype.alignment = TextElement.prototype.alignment;
GroupedBlockElement.prototype.backgroundColor = TextElement.prototype.backgroundColor;
GroupedBlockElement.prototype.borderColor = TextElement.prototype.backgroundColor;

Control.prototype.cloneBlockProperties = function (properties) {
  const clonedProperties = new Block(properties || {});
  if (properties && typeof properties === "object") {
    Object.assign(clonedProperties, properties);
  }
  return clonedProperties;
};

Control.prototype.cloneElement = function (element) {
  if (!element || typeof element !== "object") {
    return element;
  }

  const blockElemType = Control.prototype.blockToClassElems.getElem(element);
  const Constructor = blockElemType
    ? Control.prototype.blockToClassElems[blockElemType]
    : null;
  if (typeof Constructor !== "function") {
    return Object.assign({}, element);
  }

  const clonedElement = Object.assign(new Constructor(element), element);
  delete clonedElement._elementType;

  if (typeof clonedElement.fontFamily === "string") {
    clonedElement.fontFamily = normalizeTextFontFamilyName(
      clonedElement.fontFamily
    );
  }

  if (blockElemType === "ShieldElement") {
    clonedElement.bannerFontFamily =
      ShieldElement.prototype.normalizeBannerFontFamily(
        clonedElement.bannerFontFamily
      );
    clonedElement.bannerFontFamily2 =
      ShieldElement.prototype.normalizeBannerFontFamily(
        clonedElement.bannerFontFamily2 || clonedElement.bannerFontFamily
      );
  }

  if (blockElemType === "GroupedBlockElement") {
    clonedElement.blockElements =
      element.blockElements && typeof element.blockElements.clone === "function"
        ? element.blockElements.clone()
        : new Control(element.blockElements || {});
  }

  return clonedElement;
};

Control.prototype.clone = function () {
  const rows = Array.isArray(this.rows)
    ? this.rows.map((row) =>
      Array.isArray(row) ? row.map((elem) => this.cloneElement(elem)) : []
    )
    : [];
  const blockProperties = rows.map((row, index) =>
    this.cloneBlockProperties(this.blockProperties[index])
  );

  return new Control({ rows, blockProperties });
};

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
  GroupedBlockElement: GroupedBlockElement,
  // Called for every object when a post is saved, so it must be cheap: plain
  // objects and arrays return at once, and only classes are tested.
  getElem: (elemObj) => {
    const constructor = elemObj?.constructor;
    if (!constructor || constructor === Object || constructor === Array) {
      return null;
    }
    const classes = Control.prototype.blockToClassElems;
    for (const key in classes) {
      if (classes[key] === constructor) {
        return key;
      }
    }
    for (const key in classes) {
      if (key !== "getElem" && elemObj instanceof classes[key]) {
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
  GroupedBlockElement: "Grouped Block",
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
  GroupedBlockElement: "sdGroupedBlock",
};
