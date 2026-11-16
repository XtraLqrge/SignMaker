/*
class Shield {
   * Creates anew a route shield.
   * @param {string} [type="I-"] - Type of shield.
   * @param {number} [routeNumber="1"] - Route number to display on shield.
   * @param {boolean} [to=false] - Whether or not the shield should be signed as "TO".
   * @param {string} [bannerType] - Directional banner to display.
   * @param {string} [bannerPosition] - Where to place the directional banner relative to the shield.
  constructor({
    type = "I",
    routeNumber = "1",
    to = false,
    indentFirstLetter = true,
    fontSize = "1.4rem",
    specialBannerType,
    bannerType,
    bannerType2,
    bannerPosition,
  } = {}) {
    if (Object.keys(this.types).includes(type)) {
      this.type = type;
    } else {
      this.type = "I";
    }
    this.type = type;
    this.routeNumber = routeNumber;
    this.to = to;
    this.indentFirstLetter = indentFirstLetter;
    this.fontSize = fontSize;

    if (this.bannerTypes.includes(bannerType)) {
      this.bannerType = bannerType;
    } else {
      this.bannerType = this.bannerTypes[0];
    }
    if (this.bannerTypes.includes(bannerType2)) {
      this.bannerType2 = bannerType2;
    } else {
      this.bannerType2 = this.bannerTypes[0];
    }

    if (this.bannerPositions.includes(bannerPosition)) {
      this.bannerPosition = bannerPosition;
    } else {
      this.bannerPosition = this.bannerPositions[0];
    }

    let selectedSpecialBannerType =
      this.specialBannerTypes[type][specialBannerType];

    if (selectedSpecialBannerType == undefined) {
      this.specialBannerType = this.bannerTypes[0];
    } else {
      if (routeNumber.length >= selectedSpecialBannerType) {
        this.specialBannerType = specialBannerType;
      } else {
        this.specialBannerType = this.bannerTypes[0];
      }
    }
  }
}
*/


/* CFX APL artwork bundled here for the arrow renderer. Florida shield artwork
   is loaded from the project image folders. */
window.SIGNMAKER_PORTED_ASSETS = window.SIGNMAKER_PORTED_ASSETS || {};
Object.assign(window.SIGNMAKER_PORTED_ASSETS, {"img/arrows/APL_UP_CFX.svg":"data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+Cjxzdmcgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgdmlld0JveD0iMCAwIDMxMSA3NTIiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSIgeG1sbnM6c2VyaWY9Imh0dHA6Ly93d3cuc2VyaWYuY29tLyIgc3R5bGU9ImZpbGwtcnVsZTpldmVub2RkO2NsaXAtcnVsZTpldmVub2RkO3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbWl0ZXJsaW1pdDoyOyI+CiAgICA8ZyB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwxLC0zMDAuNjYxNjQxLC01ODEuNDU5NjQ0KSI+CiAgICAgICAgPGcgaWQ9IlVwIj4KICAgICAgICAgICAgPHBhdGggZD0iTTQxNS4wMjQsMTMzMi45NjRMNDk4Ljk5MSwxMzMyLjk3OUw0OTguOTkxLDc1Ni4xMDhDNDk4Ljk5MSw3NTYuMTA4IDUxOS41NjcsNzU5LjU2MyA1NDMuMDk4LDc2My41MTRDNTUzLjkzNCw3NjUuMzM0IDU2NC43NzEsNzYwLjI5MSA1NzAuMzU3LDc1MC44MjlDNTc1Ljk0NCw3NDEuMzY4IDU3NS4xMjUsNzI5LjQ0MyA1NjguMjk4LDcyMC44MzRDNTIyLjkwNCw2NjMuNTkgNDU3Ljc3NSw1ODEuNDYgNDU3Ljc3NSw1ODEuNDZDNDU3Ljc3NSw1ODEuNDYgMzkyLjUwNiw2NjMuMzQzIDM0Ni4xMDUsNzIxLjU1N0MzMzkuMTQ5LDczMC4yODQgMzM4LjM5Miw3NDIuNDI5IDM0NC4yMTIsNzUxLjk1MkMzNTAuMDMyLDc2MS40NzQgMzYxLjE4NSw3NjYuMzQgMzcyLjEyNCw3NjQuMTNDMzk1LjMwNiw3NTkuNDQ3IDQxNS4xNyw3NTUuNDM0IDQxNS4xNyw3NTUuNDM0TDQxNS4wMjQsMTMzMi45NjRaIiBzdHlsZT0iZmlsbDojZmZmOyIvPgogICAgICAgIDwvZz4KICAgIDwvZz4KPC9zdmc+Cg==","img/arrows/APL_UP_TURN_CFX.svg":"data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+Cjxzdmcgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgdmlld0JveD0iMCAwIDY0MCA3NTIiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSIgeG1sbnM6c2VyaWY9Imh0dHA6Ly93d3cuc2VyaWYuY29tLyIgc3R5bGU9ImZpbGwtcnVsZTpldmVub2RkO2NsaXAtcnVsZTpldmVub2RkO3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbWl0ZXJsaW1pdDoyOyI+CiAgICA8ZyB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwxLC05ODYuODczOTYyLC01ODEuNDU5NjQ0KSI+CiAgICAgICAgPGcgaWQ9IlVwLVR1cm4iIHNlcmlmOmlkPSJVcCBUdXJuIj4KICAgICAgICAgICAgPGcgdHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsMSw2ODYuMjEyMzIxLDApIj4KICAgICAgICAgICAgICAgIDxwYXRoIGQ9Ik00MTUuMDI0LDEzMzIuOTY0TDQ5OC45OTEsMTMzMi45NzlMNDk4Ljk5MSw3NTYuMTA4QzQ5OC45OTEsNzU2LjEwOCA1MTkuNTY3LDc1OS41NjMgNTQzLjA5OCw3NjMuNTE0QzU1My45MzQsNzY1LjMzNCA1NjQuNzcxLDc2MC4yOTEgNTcwLjM1Nyw3NTAuODI5QzU3NS45NDQsNzQxLjM2OCA1NzUuMTI1LDcyOS40NDMgNTY4LjI5OCw3MjAuODM0QzUyMi45MDQsNjYzLjU5IDQ1Ny43NzUsNTgxLjQ2IDQ1Ny43NzUsNTgxLjQ2QzQ1Ny43NzUsNTgxLjQ2IDM5Mi41MDYsNjYzLjM0MyAzNDYuMTA1LDcyMS41NTdDMzM5LjE0OSw3MzAuMjg0IDMzOC4zOTIsNzQyLjQyOSAzNDQuMjEyLDc1MS45NTJDMzUwLjAzMiw3NjEuNDc0IDM2MS4xODUsNzY2LjM0IDM3Mi4xMjQsNzY0LjEzQzM5NS4zMDYsNzU5LjQ0NyA0MTUuMTcsNzU1LjQzNCA0MTUuMTcsNzU1LjQzNEw0MTUuMDI0LDEzMzIuOTY0WiIgc3R5bGU9ImZpbGw6I2ZmZjsiLz4KICAgICAgICAgICAgPC9nPgogICAgICAgICAgICA8ZyB0cmFuc2Zvcm09Im1hdHJpeCgwLjcwNzEwNywwLjcwNzEwNywtMC43MDcxMDcsMC43MDcxMDcsMTcxNC4xMDM4NTgsOS45MTMxOTMpIj4KICAgICAgICAgICAgICAgIDxwYXRoIGQ9Ik00MTUuMDI0LDEyNDguMTExTDQ5OC45OTEsMTI0OC4xMjZMNDk4Ljk5MSw3NTYuMTA4QzQ5OC45OTEsNzU2LjEwOCA1MTkuNTY3LDc1OS41NjMgNTQzLjA5OCw3NjMuNTE0QzU1My45MzQsNzY1LjMzNCA1NjQuNzcxLDc2MC4yOTEgNTcwLjM1Nyw3NTAuODI5QzU3NS45NDQsNzQxLjM2OCA1NzUuMTI1LDcyOS40NDMgNTY4LjI5OCw3MjAuODM0QzUyMi45MDQsNjYzLjU5IDQ1Ny43NzUsNTgxLjQ2IDQ1Ny43NzUsNTgxLjQ2QzQ1Ny43NzUsNTgxLjQ2IDM5Mi41MDYsNjYzLjM0MyAzNDYuMTA1LDcyMS41NTdDMzM5LjE0OSw3MzAuMjg0IDMzOC4zOTIsNzQyLjQyOSAzNDQuMjEyLDc1MS45NTJDMzUwLjAzMiw3NjEuNDc0IDM2MS4xODUsNzY2LjM0IDM3Mi4xMjQsNzY0LjEzQzM5NS4zMDYsNzU5LjQ0NyA0MTUuMTcsNzU1LjQzNCA0MTUuMTcsNzU1LjQzNEw0MTUuMDI0LDEyNDguMTExWiIgc3R5bGU9ImZpbGw6I2ZmZjsiLz4KICAgICAgICAgICAgPC9nPgogICAgICAgIDwvZz4KICAgIDwvZz4KPC9zdmc+Cg==","img/arrows/APL_TURN_CFX.svg":"data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+Cjxzdmcgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgdmlld0JveD0iMCAwIDUwMiA1MDEiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSIgeG1sbnM6c2VyaWY9Imh0dHA6Ly93d3cuc2VyaWYuY29tLyIgc3R5bGU9ImZpbGwtcnVsZTpldmVub2RkO2NsaXAtcnVsZTpldmVub2RkO3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbWl0ZXJsaW1pdDoyOyI+CiAgICA8ZyB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwxLC0xODcwLjI0MzY4MSwtNzQ0Ljc2MzA1MykiPgogICAgICAgIDxnIHRyYW5zZm9ybT0ibWF0cml4KDAuNzA3MTA3LDAuNzA3MTA3LC0wLjcwNzEwNywwLjcwNzEwNywyNDU5LjMyNTA3OSw5LjkxMzE5MykiPgogICAgICAgICAgICA8ZyBpZD0iVHVybiI+CiAgICAgICAgICAgICAgICA8cGF0aCBkPSJNNDE1LjAyNCwxMjQ4LjExMUw0OTguOTkxLDEyNDguMTI2TDQ5OC45OTEsNzU2LjEwOEM0OTguOTkxLDc1Ni4xMDggNTE5LjU2Nyw3NTkuNTYzIDU0My4wOTgsNzYzLjUxNEM1NTMuOTM0LDc2NS4zMzQgNTY0Ljc3MSw3NjAuMjkxIDU3MC4zNTcsNzUwLjgyOUM1NzUuOTQ0LDc0MS4zNjggNTc1LjEyNSw3MjkuNDQzIDU2OC4yOTgsNzIwLjgzNEM1MjIuOTA0LDY2My41OSA0NTcuNzc1LDU4MS40NiA0NTcuNzc1LDU4MS40NkM0NTcuNzc1LDU4MS40NiAzOTIuNTA2LDY2My4zNDMgMzQ2LjEwNSw3MjEuNTU3QzMzOS4xNDksNzMwLjI4NCAzMzguMzkyLDc0Mi40MjkgMzQ0LjIxMiw3NTEuOTUyQzM1MC4wMzIsNzYxLjQ3NCAzNjEuMTg1LDc2Ni4zNCAzNzIuMTI0LDc2NC4xM0MzOTUuMzA2LDc1OS40NDcgNDE1LjE3LDc1NS40MzQgNDE1LjE3LDc1NS40MzRMNDE1LjAyNCwxMjQ4LjExMVoiIHN0eWxlPSJmaWxsOiNmZmY7Ii8+CiAgICAgICAgICAgIDwvZz4KICAgICAgICA8L2c+CiAgICA8L2c+Cjwvc3ZnPgo="});

// Artwork is served as individual SVGs. Keep the offline copies off startup.
window.SIGNMAKER_ASSET_FALLBACKS = window.SIGNMAKER_ASSET_FALLBACKS || {};
const shieldFallbackScriptUrl = new URL(
  "ShieldFallbacks.js",
  document.currentScript?.src || new URL("js/Shield.js", document.baseURI)
).href;
let shieldFallbackScriptPromise = null;
window.loadSignMakerAssetFallbacks = () => {
  if (Object.keys(window.SIGNMAKER_ASSET_FALLBACKS).length) return Promise.resolve(window.SIGNMAKER_ASSET_FALLBACKS);
  if (!shieldFallbackScriptPromise) {
    shieldFallbackScriptPromise = new Promise(resolve => {
      const script = document.createElement("script");
      let timer;
      const finish = () => {
        clearTimeout(timer);
        script.onload = script.onerror = null;
        script.remove();
        if (!Object.keys(window.SIGNMAKER_ASSET_FALLBACKS).length) shieldFallbackScriptPromise = null;
        resolve(window.SIGNMAKER_ASSET_FALLBACKS);
      };
      script.src = shieldFallbackScriptUrl;
      script.async = true;
      script.onload = script.onerror = finish;
      timer = setTimeout(finish, 8000);
      document.head.appendChild(script);
    });
  }
  return shieldFallbackScriptPromise;
};

window.getSignMakerAssetFallback = function (path) {
  const raw = String(path || "");
  if (!raw) {
    return null;
  }

  if (window.SIGNMAKER_ASSET_FALLBACKS[raw]) {
    return window.SIGNMAKER_ASSET_FALLBACKS[raw];
  }

  let normalized = raw;
  try {
    const resolved = new URL(raw, document.baseURI);
    normalized = decodeURIComponent(resolved.pathname || "").replace(/^\/+/, "");
  } catch (error) {
    try {
      normalized = decodeURIComponent(raw).replace(/^\/+/, "");
    } catch (decodeError) {}
  }

  for (const [assetPath, fallback] of Object.entries(
    window.SIGNMAKER_ASSET_FALLBACKS
  )) {
    if (
      normalized === assetPath ||
      normalized.endsWith("/" + assetPath) ||
      normalized.endsWith(assetPath)
    ) {
      return fallback;
    }
  }

  return null;
};

window.applySignMakerAssetFallback = function (
  image,
  requestedPath,
  finalFallback = ""
) {
  if (!image) {
    return;
  }

  const originalPath = requestedPath || image.getAttribute("src") || image.src || "";

  delete image.dataset.signMakerAssetFallbackTried;
  image.onerror = async () => {
    const failedSource = image.src;
    const alreadyTried = image.dataset.signMakerAssetFallbackTried === "true";
    image.dataset.signMakerAssetFallbackTried = "true";
    if (!alreadyTried) {
      await window.loadSignMakerAssetFallbacks();
      // A picker may have selected another image while the fallback loaded.
      if (image.src !== failedSource) return;
      const fallback = window.getSignMakerAssetFallback(originalPath || failedSource);
      if (fallback) {
        image.src = fallback;
        return;
      }
    }
    image.onerror = null;
    if (finalFallback) image.src = finalFallback;
  };
};

window.resolveSignMakerAsset = function (path) {
  const key = String(path || "");

  const directFallback =
    typeof window.getSignMakerAssetFallback === "function"
      ? window.getSignMakerAssetFallback(key)
      : null;

  if (directFallback) {
    return directFallback;
  }

  return window.SIGNMAKER_PORTED_ASSETS[key] || key;
};

class Shield {
  constructor({
    shieldType = "preset",
    shieldName = "Interstate",
    shieldValue = "I",
    variant = "2 Digit",

    shieldBacks = false,
    shieldBackColor = "Black",
    shieldBorderRadius = 4,

    imageType = "",
    imageData = "",
  } = {}) {
    const defaultBannerFont = ShieldElement.prototype.defaultBannerFontFamily;
    this.indentFirstLetter = true;
    this.indentFirstLetter2 = true;
    this.smallCaps = true;
    this.smallCaps2 = true;
    this.bannerFontFamily = defaultBannerFont;
    this.shieldType = shieldType;
    this.shieldName = shieldName;
    this.shieldValue = shieldValue;
    this.variant = variant;
    this.shieldBacks = shieldBacks;
    this.shieldBackColor = shieldBackColor;
    this.shieldBorderRadius = shieldBorderRadius;
    this.imageType = imageType;
    this.imageData = imageData;
  }
}

class Banner {
  constructor({
    textContent = "",
    firstLetterSize = 100,
    fontSize = 1,
    backgroundColor = "None",
    padding = .01,
    borderRadius = 4,
    fontFamily = "Series E",
    margins = {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0
    }
  } = {}) {
    this.textContent = textContent;
    this.firstLetterSize = firstLetterSize;
    this.fontSize = fontSize;
    this.backgroundColor = backgroundColor;
    this.padding = padding;
    this.borderRadius = borderRadius;
    this.fontFamily = fontFamily;
    this.margins = margins;
  }
}

class BannerGroup {
  constructor({
    position = "left",
    gap = .5,
    direction = "vertical",
  } = {}) {
    this.position = position;
    this.gap = gap;
    this.direction = direction;
  }
}

class ShieldBlock {
  constructor({ } = {}) { }
}

class ShieldContainer {
  constructor({ } = {}) { }
}

Shield.prototype.normalizeShieldName = (name) => {
  const requestedName = String(name ?? "");
  const normalizedName = requestedName.replace(/\s+/g, "");

  if (/^(?:FLTURNPIKE|FL-TURNPIKE)$/i.test(normalizedName)) {
    return "FLTP";
  }
  if (/^FLCFXTOLL$/i.test(normalizedName)) {
    return "FLCFX";
  }

  return requestedName;
};

Shield.prototype.migrateLegacyVariant = (name, variant) => {
  name = Shield.prototype.normalizeShieldName(name);
  const requestedVariant = String(variant ?? "");
  const properties = Shield.prototype.getPropertiesFromName(name);
  const legacyVariant =
    properties?.legacyVariantAliases?.[requestedVariant.replace(/\s/g, "")];
  const migratedVariant =
    typeof legacyVariant === "string"
      ? legacyVariant
      : legacyVariant?.threeOrMore || legacyVariant?.oneToTwo;

  return migratedVariant && properties?.variants?.includes(migratedVariant)
    ? migratedVariant
    : requestedVariant;
};

Shield.prototype.getDirectoryFromShield = (name, variant) => {
  name = Shield.prototype.normalizeShieldName(name);
  variant = Shield.prototype.migrateLegacyVariant(name, variant).replace(
    /\s/g,
    ""
  );

  const properties = Shield.prototype.getPropertiesFromName(name);

  const sharedTwoDigitArtwork = new Set([
    "C", "AK", "AZLOOP", "CO", "CT", "DC", "HI", "MN", "MNBUS", "MT2", "NC", "NELINK", "NESPUR", "NH", "NM", "NV", "TN", "VA2", "WA", "AB", "AB2", "ABTC", "BC", "BCYH", "BCTC", "MB", "MB2", "MBTC", "NB", "NBCONN", "NBLOCAL", "NBTC", "NLTC", "NSCONN", "NSTC", "ON2", "ON3", "ONTC", "PEI", "QC2", "QCTC", "SK", "SK2", "SKTC", "TCH", "TCHLEAF"
  ]);

  if (
    variant === "3Digit" &&
    sharedTwoDigitArtwork.has(String(properties?.assetName || name || "").toUpperCase())
  ) {
    variant = "2Digit";
  }

  const mappedAsset = properties?.assetPathByVariant?.[variant];

  if (mappedAsset) {
    return typeof window.resolveSignMakerAsset === "function"
      ? window.resolveSignMakerAsset(mappedAsset)
      : mappedAsset;
  }

  if (properties?.assetPath) {
    return typeof window.resolveSignMakerAsset === "function"
      ? window.resolveSignMakerAsset(properties.assetPath)
      : properties.assetPath;
  }

  let directory = "img/shields/";
  const search = (dir, str) => {
    for (const category in dir) {
      const cat = dir[category];
      if (cat.type == "category") {
        const catSearch = search(cat, str, category);
        if (catSearch != null) {
          return (cat.folder || category) + "/" + catSearch;
        }
      } else if (cat.type == "shield" && category == name) {
        str += cat.folder ? cat.folder + "/" : "";
        const assetName = cat.assetName || name;
        if (cat.variants.length > 0 && variant) {
          str += assetName + "-" + variant + ".svg";
        } else {
          str += assetName + ".svg";
        }
        return str;
      }
    }
    return null;
  };

  directory += search(Shield.prototype.shieldDirectory, "", "");

  return typeof window.resolveSignMakerAsset === "function"
    ? window.resolveSignMakerAsset(directory)
    : directory;
};

Shield.prototype.getPropertiesFromName = (name) => {
  name = Shield.prototype.normalizeShieldName(name);
  const search = (dir, str) => {
    for (const category in dir) {
      const cat = dir[category];
      if (cat.type == "category") {
        const catSearch = search(cat, str, category);
        if (catSearch != null) {
          return catSearch;
        }
      } else if (cat.type == "shield" && category == name) {
        return cat;
      }
    }
    return null;
  };
  return search(Shield.prototype.shieldDirectory, "", "");
};

Shield.prototype.shieldDirectory = {
  "United States": {
    type: "category",
      Interstate: {
        type: "category",
        folder: "Interstate",

        I: {
          type: "shield",
          name: "Interstate",
          variants: ["2 Digit", "3 Digit"],
        },
        "I-BUS": {
          type: "shield",
          name: "Interstate Business",
          variants: ["2 Digit", "3 Digit"],
        },
        "I-BL": {
          type: "shield",
          name: "Interstate Business Loop",
          variants: ["2 Digit", "3 Digit"],
        },
        "I-BS": {
          type: "shield",
          name: "Interstate Business Spur",
          variants: ["2 Digit", "3 Digit"],
        },
        "I-DL": {
          type: "shield",
          name: "Interstate Downtown Loop",
          variants: ["2 Digit", "3 Digit"],
        },
        "I-DS": {
          type: "shield",
          name: "Interstate Downtown Spur",
          variants: ["2 Digit", "3 Digit"],
        },
        "I-F": {
          type: "shield",
          name: "Future Interstate",
          variants: ["2 Digit", "3 Digit"],
        },
      },
      "US Route": {
        type: "category",
        folder: "US Route",

        US: {
          type: "shield",
          name: "U.S. Route",
          variants: ["2 Digit", "3 Digit"],
        },
        "US-CA": {
          type: "shield",
          name: "U.S. Route (CA style)",
          variants: ["2 Digit", "3 Digit"],
        },
      },
    AL: { type: "shield", name: "Alabama", variants: ["2 Digit", "3 Digit"] },
    AK: { type: "shield", name: "Alaska", variants: ["2 Digit", "3 Digit"] },
    Arizona: {
      type: "category",
      folder: "AZ",
      AZ: {
        type: "shield",
        name: "Arizona",
        variants: ["2 Digit", "3 Digit"],
      },
      AZLOOP: {
        type: "shield",
        name: "Arizona (Loop)",
        variants: ["3 Digit"],
      },
    },
    AR: { type: "shield", name: "Arkansas", variants: ["2 Digit", "3 Digit"] },
    CA: {
      type: "shield",
      name: "California",
      variants: ["2 Digit", "3 Digit"],
    },
    CO: { type: "shield", name: "Colorado", variants: ["2 Digit", "3 Digit"] },
    CT: {
      type: "shield",
      name: "Connecticut",
      variants: ["2 Digit", "3 Digit"],
    },
    DE: { type: "shield", name: "Delaware", variants: ["2 Digit", "3 Digit"] },
    DC: {
      type: "shield",
      name: "District of Columbia",
      variants: ["2 Digit", "3 Digit"],
    },
    Florida: {
      type: "category",
      FL: {
        type: "shield",
        name: "State Route",
        variants: [
          "2 Digit (42×36)",
          "3 Digit (58×36)",
          "2 Digit (36×30)",
          "3 Digit (58×30)",
          "2 Digit (30×24)",
          "3 Digit (58×24)",
        ],
      },
      FLToll: {
        type: "shield",
        name: "FDOT Toll",
        variants: ["40×48", "48×60"],
      },
      FLCFX: {
        type: "shield",
        name: "CFX Toll",
        variants: [
          "CFX Guide",
          "CFX Overhead",
          "FDOT Guide",
          "FDOT Overhead",
        ],
      },
      FLTP: {
        type: "shield",
        name: "Florida's Turnpike",
        variants: ["Guide", "Overhead", "Toll Banner"],
      },
    },
    GA: {
      type: "category",
      GA: { type: "shield", name: "Georgia", variants: ["2 Digit", "3 Digit"] },
      GALOOP: {
        type: "shield",
        name: "Georgia (Loop)",
        variants: ["2 Digit", "3 Digit"],
      },
      GASPUR: {
        type: "shield",
        name: "Georgia (Spur)",
        variants: ["2 Digit", "3 Digit"],
      },
      GAALT: {
        type: "shield",
        name: "Georgia (Alternate)",
        variants: ["2 Digit", "3 Digit"],
      },
      GABYP: {
        type: "shield",
        name: "Georgia (Bypass)",
        variants: ["2 Digit", "3 Digit"],
      },
      GACONN: {
        type: "shield",
        name: "Georgia (Connector)",
        variants: ["2 Digit", "3 Digit"],
      },
    },
    HI: { type: "shield", name: "Hawaii", variants: ["2 Digit", "3 Digit"] },
    ID: { type: "shield", name: "Idaho", variants: ["2 Digit", "3 Digit"] },
    IL: { type: "shield", name: "Illinois", variants: ["2 Digit", "3 Digit"] },
    IN: { type: "shield", name: "Indiana", folder: "IN", variants: ["2 Digit", "3 Digit"] },
    IA: { type: "shield", name: "Iowa", variants: ["2 Digit", "3 Digit"] },
    KS: { type: "shield", name: "Kansas", folder: "KS", variants: ["2 Digit", "3 Digit"] },
    KY: { type: "shield", name: "Kentucky", folder: "KY", variants: ["2 Digit", "3 Digit"] },
    LA: {
      type: "shield",
      name: "Louisiana",
      variants: ["2 Digit", "3 Digit", "4 Digit"],
      assetPathByVariant: {
        "2Digit": "img/shields/United States/LA/LA-2Digit.svg",
        "3Digit": "img/shields/United States/LA/LA-3Digit.svg",
        "4Digit": "img/shields/United States/LA/LA-4Digit.svg",
      },
    },
    ME: { type: "shield", name: "Maine", folder: "ME", variants: ["2 Digit", "3 Digit"] },
    MD: { type: "shield", name: "Maryland", variants: ["2 Digit", "3 Digit"] },
    MA: {
      type: "shield",
      name: "Massachusetts",
      folder: "MA",
      variants: ["2 Digit", "3 Digit"],
    },
    MI: { type: "shield", name: "Michigan", variants: ["2 Digit", "3 Digit"] },
    MN: {
      type: "category",
      MN: { type: "shield", name: "Minnesota", variants: ["2 Digit"] },
      MNBUS: {
        type: "shield",
        name: "Minnesota (Business)",
        variants: ["2 Digit"],
      },
      MNCo: {
        type: "shield",
        name: "Minnesota County",
        variants: ["2 Digit", "3 Digit"],
      },
    },
    MS: {
      type: "shield",
      name: "Mississippi",
      variants: ["2 Digit", "3 Digit"],
    },
    MO: { type: "shield", name: "Missouri", variants: ["2 Digit", "3 Digit"] },
    MT: { type: "shield", name: "Montana", variants: ["2 Digit", "3 Digit"] },
    "MT 2nd": {
      type: "shield",
      name: "Montana (2nd)",
      assetName: "MT2",
      variants: ["2 Digit", "3 Digit"],
    },
    NE: {
      type: "category",
      NE: {
        type: "shield",
        name: "Nebraska",
        variants: ["2 Digit", "3 Digit"],
      },
      NELINK: {
        type: "shield",
        name: "Nebraska (Link)",
        variants: ["2 Digit"],
      },
      NESPUR: {
        type: "shield",
        name: "Nebraska (Spur)",
        variants: ["2 Digit"],
      },
    },
    NV: {
      type: "category",
      folder: "NV",
      NV: {
        type: "shield",
        name: "Nevada",
        variants: ["2 Digit"],
        legacyVariantAliases: {
          "3Digit": "2 Digit",
        },
      },
      NVCC: {
        type: "shield",
        name: "Clark County",
        variants: ["2 Digit"],
      },
    },
    NH: {
      type: "shield",
      name: "New Hampshire",
      variants: ["2 Digit", "3 Digit"],
    },
    NJ: {
      type: "shield",
      name: "New Jersey",
      folder: "NJ",
      variants: ["2 Digit", "3 Digit"],
    },
    NM: {
      type: "shield",
      name: "New Mexico",
      variants: ["2 Digit", "3 Digit"],
    },
    NY: { type: "shield", name: "New York", folder: "NY", variants: ["2 Digit", "3 Digit"] },
    NC: {
      type: "shield",
      name: "North Carolina",
      variants: ["2 Digit", "3 Digit"],
    },
    ND: {
      type: "shield",
      name: "North Dakota",
      variants: ["2 Digit", "3 Digit"],
    },
      OH: {
        type: "category",
        OH: { type: "shield", name: "Ohio", variants: ["2 Digit", "3 Digit"] },
      },
    OK: { type: "shield", name: "Oklahoma", folder: "OK", variants: ["2 Digit", "3 Digit"] },
    OR: { type: "shield", name: "Oregon", variants: ["2 Digit", "3 Digit"] },
    PA: {
      type: "shield",
      name: "Pennsylvania",
      folder: "PA",
      variants: ["2 Digit", "3 Digit"],
    },
    RI: {
      type: "shield",
      name: "Rhode Island",
      variants: ["2 Digit", "3 Digit"],
    },
    SC: {
      type: "shield",
      name: "South Carolina",
      variants: ["2 Digit", "3 Digit"],
    },
    SD: {
      type: "shield",
      name: "South Dakota",
      variants: ["2 Digit", "3 Digit"],
    },
    TN: { type: "shield", name: "Tennessee", variants: ["2 Digit", "3 Digit"] },
    "TN 2nd": {
      type: "shield",
      name: "Tennessee (2nd)",
      assetName: "TN2",
      variants: ["2 Digit", "3 Digit"],
    },
    TX: {
      type: "category",
      TX: { type: "shield", name: "Texas", variants: ["2 Digit", "3 Digit"] },
      TXLOOP: {
        type: "shield",
        name: "Texas (Loop)",
        variants: ["2 Digit", "3 Digit"],
      },
      TXSPUR: {
        type: "shield",
        name: "Texas (Spur)",
        variants: ["2 Digit", "3 Digit"],
      },
      TXTOLL: {
        type: "shield",
        name: "Texas (Toll)",
        variants: ["2 Digit", "3 Digit"],
      },
      TXEXPRESS: {
        type: "shield",
        name: "Texas (Express)",
        variants: ["2 Digit", "3 Digit"],
      },
      TXFM: { type: "shield", name: "Texas (FM)", variants: ["4 Digit"] },
      TXPARK: { type: "shield", name: "Texas (Park)", variants: ["2 Digit"] },
      TXRM: { type: "shield", name: "Texas (RM)", variants: ["2 Digit"] },
      TXBELTWAY: {
        type: "shield",
        name: "Texas (Beltway)",
        variants: ["2 Digit"],
      },
    },
    UT: { type: "shield", name: "Utah", variants: ["2 Digit", "3 Digit"] },
    VT: { type: "shield", name: "Vermont", variants: ["2 Digit", "3 Digit"] },
    "VT 2nd": {
      type: "shield",
      name: "Vermont (2nd)",
      assetName: "VT2",
      variants: ["2 Digit", "3 Digit"],
    },
    VA: { type: "shield", name: "Virginia", variants: ["2 Digit", "3 Digit"] },
    "VA 2nd": {
      type: "shield",
      name: "Virginia (2nd)",
      assetName: "VA2",
      variants: ["2 Digit", "3 Digit"],
    },
    WA: {
      type: "shield",
      name: "Washington",
      variants: ["2 Digit", "3 Digit"],
    },
    WV: {
      type: "shield",
      name: "West Virginia",
      variants: ["2 Digit", "3 Digit"],
    },
      Wisconsin: {
        type: "category",
        folder: "WI",

        WI: {
          type: "shield",
          name: "Wisconsin",
          variants: ["2 Digit", "3 Digit"],
        },
        WICo: {
          type: "shield",
          name: "Wisconsin County",
          variants: ["2 Digit", "3 Digit"],
        },
      },
    WY: { type: "shield", name: "Wyoming", variants: ["2 Digit", "3 Digit"] },
    C: {
      type: "shield",
      name: "County",
      variants: ["Standard", "Green"],
      assetPathByVariant: {
        Standard: "img/shields/United States/C-2Digit.svg",
        Green: "img/shields/United States/C2-2Digit.svg",
      },
      legacyVariantAliases: {
        Auto: "Standard",
        "2Digit": "Standard",
        "3Digit": "Standard",
      },
      county: true,
    },
  },
  Canada: {
    type: "category",
    PEI: {
      type: "shield",
      name: "Prince Edward Island",
      folder: "PEI",
      variants: ["2 Digit", "3 Digit"],
    },
    NS: {
      type: "shield",
      name: "Nova Scotia",
      folder: "NS",
      variants: ["2 Digit", "3 Digit"],
    },
    QC: { type: "shield", name: "Quebec", folder: "QC", variants: ["2 Digit", "3 Digit"] },
    "QC 2nd": {
      type: "shield",
      name: "Quebec (alt)",
      folder: "QC",
      assetName: "QC2",
      variants: ["2 Digit", "3 Digit"],
    },
    NL: {
      type: "shield",
      name: "Newfoundland and Labrador",
      folder: "NL",
      variants: ["2 Digit", "3 Digit"],
    },
    "New Brunswick": {
      type: "category",
      folder: "NB",
      NB: {
        type: "shield",
        name: "New Brunswick",
        variants: ["2 Digit", "3 Digit"],
      },
      NBCONN: {
        type: "shield",
        name: "New Brunswick (Connector)",
        variants: ["3 Digit"],
      },
      NBLOCAL: {
        type: "shield",
        name: "New Brunswick (Local)",
        variants: ["3 Digit"],
      },
    },
  },
  Australia: {
    type: "category",
    ALPHANUM: {
      type: "shield",
      name: "Alphanumeric",
      variants: ["2 Digit", "3 Digit", "4 Digit"],
    },
    NAT: {
      type: "shield",
      name: "National Route",
      variants: ["1 Digit", "2 Digit", "3 Digit"],
    },
    SR: {
      type: "shield",
      name: "State Route",
      variants: ["2 Digit"],
    },
    NR: {
      type: "shield",
      name: "National Route",
      variants: ["2 Digit"],
    },
    MR: {
      type: "shield",
      name: "Metroad",
      variants: ["1 Digit", "2 Digit"],
    },
    "TOLLBLUE": {
        type: "shield",
        name: "Tollway",
        variants: ["2 Digit", "3 Digit", "4 Digit"],
    },
    "TD": {
        type: "shield",
        name: "Tourist Drive",
        variants: ["2 Digit", "3 Digit"],
    },
    "FNSW": {
        type: "shield",
        name: "Freeway - NSW (Retired)",
        variants: ["2 Digit"],
    },
  },
  "New Zealand": {
    type: "category",
    SH: {
      type: "shield",
      name: "State Highway",
      variants: ["1 Digit", "2 Digit"],
    },
  },
};

// Current Florida route-marker catalogue. These definitions intentionally
// replace the older raster-backed Florida entries above while retaining their
// legacy codes so existing saves continue to load.
(() => {
  const unitedStates = Shield.prototype.shieldDirectory["United States"];
  const florida = unitedStates.Florida;
  const fdotFolder = "img/shields/United States/Florida/FDOT";
  const cfxFolder = "img/shields/United States/Florida/CFX";

  const routeStyle = (
    capHeightIn,
    fontFamily,
    topIn,
    horizontalPlacement = {},
    fontFamilyByCharacterCount = null
  ) => ({
    capHeightIn,
    fontFamily,
    topIn,
    color: "#000000",
    ...horizontalPlacement,
    ...(fontFamilyByCharacterCount
      ? { fontFamilyByCharacterCount }
      : {}),
  });
  const dimensions = (widthIn, heightIn) => ({ widthIn, heightIn });
  const variableGuidePanel = (rightClearanceIn) => ({
    minWidthIn: 48,
    maxWidthIn: 58,
    assetWidthIn: 48,
    rightClearanceIn,
  });

  florida.FL = {
    type: "shield",
    name: "FDOT Florida State Route",
    variants: [
      "Guide 42x36 1-2 Digit",
      "Guide 48-58x36 3 Digit",
      "Guide 36x30 1-2 Digit",
      "Guide 48-58x30 3 Digit",
      "Guide 30x24 1-2 Digit",
      "Guide 48-58x24 3 Digit",
    ],
    className: "FL FDOTSTATE",
    standard: "FDOT",
    officialDimensions: true,
    maxRouteCharacters: 3,
    assetPathByVariant: {
      "Guide42x361-2Digit": `${fdotFolder}/Florida-Guide-42x36-1to2.svg`,
      "Guide48-58x363Digit": `${fdotFolder}/Florida-Guide-48x36-3plus.svg`,
      "Guide36x301-2Digit": `${fdotFolder}/Florida-Guide-36x30-1to2.svg`,
      "Guide48-58x303Digit": `${fdotFolder}/Florida-Guide-48x30-3plus.svg`,
      "Guide30x241-2Digit": `${fdotFolder}/Florida-Guide-30x24-1to2.svg`,
      "Guide48-58x243Digit": `${fdotFolder}/Florida-Guide-48x24-3plus.svg`,
    },
    physicalDimensionsByVariant: {
      "Guide42x361-2Digit": dimensions(42, 36),
      "Guide48-58x363Digit": dimensions(48, 36),
      "Guide36x301-2Digit": dimensions(36, 30),
      "Guide48-58x303Digit": dimensions(48, 30),
      "Guide30x241-2Digit": dimensions(30, 24),
      "Guide48-58x243Digit": dimensions(48, 24),
    },
    routeNumberByVariant: {
      "Guide42x361-2Digit": routeStyle(15, "Series D", 14.75, {
        rightIn: 31,
      }),
      "Guide48-58x363Digit": routeStyle(15, "Series D", 14.75, {
        leftIn: 1.25,
        variablePanelWidth: variableGuidePanel(11),
      }),
      "Guide36x301-2Digit": routeStyle(15, "Series D", 11.75, {
        rightIn: 27.25,
      }),
      "Guide48-58x303Digit": routeStyle(15, "Series D", 11.75, {
        leftIn: 1.25,
        variablePanelWidth: variableGuidePanel(8.75),
      }),
      "Guide30x241-2Digit": routeStyle(12, "Series D", 9.25, {
        rightIn: 21.75,
      }),
      "Guide48-58x243Digit": routeStyle(12, "Series D", 9.25, {
        leftIn: 1.25,
        variablePanelWidth: variableGuidePanel(8.25),
      }),
    },
    autoVariantByCharacterCount: {
      oneToTwo: "Guide 42x36 1-2 Digit",
      threeOrMore: "Guide 48-58x36 3 Digit",
    },
    legacyVariantAliases: {
      "2DigitOverhead": "Guide 42x36 1-2 Digit",
      "3DigitOverhead": "Guide 48-58x36 3 Digit",
      "Guide48-58x363+Digit": "Guide 48-58x36 3 Digit",
      "Guide48-58x303+Digit": "Guide 48-58x30 3 Digit",
      "Guide48-58x243+Digit": "Guide 48-58x24 3 Digit",
      "Guide58x363+Digit": "Guide 48-58x36 3 Digit",
      "Guide53x303+Digit": "Guide 48-58x30 3 Digit",
      "Guide48x243+Digit": "Guide 48-58x24 3 Digit",
      "2Digit": "Guide 42x36 1-2 Digit",
      "3Digit": "Guide 48-58x36 3 Digit",
      // v2.19 names
      "StateRoute—2Digit(42×36)": "Guide 42x36 1-2 Digit",
      "StateRoute—3Digit(58×36)": "Guide 48-58x36 3 Digit",
      "StateRoute—2Digit(36×30)": "Guide 36x30 1-2 Digit",
      "StateRoute—3Digit(58×30)": "Guide 48-58x30 3 Digit",
      "StateRoute—2Digit(30×24)": "Guide 30x24 1-2 Digit",
      "StateRoute—3Digit(58×24)": "Guide 48-58x24 3 Digit",
      "2Digit(42×36)": "Guide 42x36 1-2 Digit",
      "3Digit(58×36)": "Guide 48-58x36 3 Digit",
      "2Digit(36×30)": "Guide 36x30 1-2 Digit",
      "3Digit(58×30)": "Guide 48-58x30 3 Digit",
      "2Digit(30×24)": "Guide 30x24 1-2 Digit",
      "3Digit(58×24)": "Guide 48-58x24 3 Digit",
      "Freeway48x361-3Digit": {
        oneToTwo: "Guide 42x36 1-2 Digit",
        threeOrMore: "Guide 48-58x36 3 Digit",
      },
      Freeway48x364Digit: "Guide 48-58x36 3 Digit",
      "Independent24x241-2Digit": "Guide 30x24 1-2 Digit",
      "Independent24x243DigitCluster": "Guide 48-58x24 3 Digit",
      "Independent30x243-4Digit": "Guide 48-58x24 3 Digit",
    },
  };

  florida.FLToll = {
    type: "shield",
    name: "FDOT Toll Route",
    variants: ["40x48 Guide", "48x60 Overhead", "24x30 Route Marker", "Old (Legacy)", "Selmon (Legacy)"],
    fixedRouteVariants: ["Selmon (Legacy)"],
    className: "FL toll FDOTTOLL",
    standard: "FDOT",
    officialDimensions: true,
    maxRouteCharacters: 3,
    assetPathByVariant: {
      "40x48Guide": `${fdotFolder}/Toll-40x48.svg`,
      "48x60Overhead": `${fdotFolder}/Toll-48x60.svg`,
      "24x30RouteMarker": `${fdotFolder}/Toll-24x30.svg`,
      "Old(Legacy)": "img/shields/United States/Florida/FLToll-Old.svg",
      "Selmon(Legacy)": "img/shields/United States/Florida/FLToll-Selmon.png",
    },
    physicalDimensionsByVariant: {
      "40x48Guide": dimensions(40, 48),
      "48x60Overhead": dimensions(48, 60),
      "24x30RouteMarker": dimensions(24, 30),
    },
    routeNumberByVariant: {
      "40x48Guide": routeStyle(10, "Series D", 25, { centerXIn: 17.112 }),
      "48x60Overhead": routeStyle(12, "Series D", 28, { centerXIn: 19.76 }),
      "24x30RouteMarker": routeStyle(6, "Series D", 16, { centerXIn: 10.588 }),
    },
    legacyVariantAliases: {
      // v2.19 names
      "FDOTToll—40×48": "40x48 Guide",
      "FDOTToll—48×60": "48x60 Overhead",
      "40×48": "40x48 Guide",
      "48×60": "48x60 Overhead",
      Current: "40x48 Guide",
      Old: "Old (Legacy)",
      Selmon: "Selmon (Legacy)",
    },
  };

  florida.FLCFX = {
    type: "shield",
    name: "CFX Toll Route",
    variants: [
      "TM 36x48 CFX Jurisdiction",
      "TM 48x60 CFX Jurisdiction",
      "TM-ALT 36x48 FDOT Jurisdiction",
      "TM-ALT 48x60 FDOT Jurisdiction",
      "Old (Legacy)",
    ],
    className: "FL cfxtoll CFXTOLL",
    standard: "CFX",
    officialDimensions: true,
    maxRouteCharacters: 3,
    assetPathByVariant: {
      TM36x48CFXJurisdiction: `${cfxFolder}/CFX-TM-36x48.svg`,
      TM48x60CFXJurisdiction: `${cfxFolder}/CFX-TM-48x60.svg`,
      "TM-ALT36x48FDOTJurisdiction": `${cfxFolder}/CFX-TM-ALT-36x48.svg`,
      "TM-ALT48x60FDOTJurisdiction": `${cfxFolder}/CFX-TM-ALT-48x60.svg`,
      "Old(Legacy)": "img/shields/United States/Florida/FLCFXToll-Old.svg",
    },
    physicalDimensionsByVariant: {
      TM36x48CFXJurisdiction: dimensions(36, 48),
      TM48x60CFXJurisdiction: dimensions(48, 60),
      "TM-ALT36x48FDOTJurisdiction": dimensions(36, 48),
      "TM-ALT48x60FDOTJurisdiction": dimensions(48, 60),
    },
    routeNumberByVariant: {
      TM36x48CFXJurisdiction: routeStyle(12, "Series D", 22.53, {
        centerXIn: 15.64,
        maxWidthIn: 22.84,
        allowOpticalSpacing: true,
      }),
      TM48x60CFXJurisdiction: routeStyle(15, "Series D", 27.89, {
        centerXIn: 20.48,
        maxWidthIn: 31.84,
        allowOpticalSpacing: true,
      }),
      "TM-ALT36x48FDOTJurisdiction": routeStyle(12, "Series D", 22.53, {
        centerXIn: 15.64,
        maxWidthIn: 22.84,
        allowOpticalSpacing: true,
      }),
      "TM-ALT48x60FDOTJurisdiction": routeStyle(15, "Series D", 27.89, {
        centerXIn: 20.48,
        maxWidthIn: 31.84,
        allowOpticalSpacing: true,
      }),
    },
    legacyVariantAliases: {
      Current: "TM 36x48 CFX Jurisdiction",
      Old: "Old (Legacy)",
      // v2.19 names
      "CFXToll—CFXGuide": "TM 36x48 CFX Jurisdiction",
      "CFXToll—CFXOverhead": "TM 48x60 CFX Jurisdiction",
      "CFXToll—FDOTGuide": "TM-ALT 36x48 FDOT Jurisdiction",
      "CFXToll—FDOTOverhead": "TM-ALT 48x60 FDOT Jurisdiction",
      CFXGuide: "TM 36x48 CFX Jurisdiction",
      CFXOverhead: "TM 48x60 CFX Jurisdiction",
      FDOTGuide: "TM-ALT 36x48 FDOT Jurisdiction",
      FDOTOverhead: "TM-ALT 48x60 FDOT Jurisdiction",
    },
  };

  florida.FLTP = {
    type: "shield",
    name: "FDOT Florida's Turnpike",
    variants: [
      "40x48 Guide",
      "48x60 Overhead",
      "30x36 Route Marker",
      "Toll",
    ],
    className: "FL FDOTTURNPIKE",
    standard: "FDOT",
    officialDimensions: true,
    suppressRouteNumber: true,
    assetPathByVariant: {
      "40x48Guide": `${fdotFolder}/Turnpike-40x48.svg`,
      "48x60Overhead": `${fdotFolder}/Turnpike-48x60.svg`,
      "30x36RouteMarker": `${fdotFolder}/Turnpike-30x36.svg`,
      Toll: `${fdotFolder}/Turnpike-Toll-30x48.svg`,
    },
    physicalDimensionsByVariant: {
      "40x48Guide": dimensions(40, 48),
      "48x60Overhead": dimensions(48, 60),
      "30x36RouteMarker": dimensions(30, 36),
      // Nominal size of the vector composite; not an issued FDOT panel.
      Toll: dimensions(30, 48),
    },
    legacyVariantAliases: {
      Standard: "40x48 Guide",
      // v2.19 names
      "Florida'sTurnpike—Guide": "40x48 Guide",
      "Florida'sTurnpike—Overhead": "48x60 Overhead",
      "Florida'sTurnpike—TollBanner": "Toll",
      Guide: "40x48 Guide",
      Overhead: "48x60 Overhead",
      TollBanner: "Toll",
    },
  };
})();

Shield.prototype.bannerTypes = [
  "North",
  "East",
  "South",
  "West",
  "Arterial",
  "Jct",
  "Begin",
  "End",
  "Spur",
  "Alt",
  "Truck",
  "Business",
  "Bus",
  "Byp",
  "Loop",
  "Express",
  "Local",
  "Inner",
  "Outer",
  "Future",
  "Toll",
  "City",
  "Conn",
  "To",
  "Turnpike",
  "Nord",
  "Est",
  "Sud",
  "Ouest",
];
Shield.prototype.bannerPositions = ["Above", "Right", "Left"];
