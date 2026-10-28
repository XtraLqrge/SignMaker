/* Prioritize the current sign's fonts before constructing the editor menus. */
window.SignMakerFonts = (() => {
  const definitions = {
  "Series E": {
    "src": "fonts/Roadgeek2014SeriesE.woff2",
    "weight": "400"
  },
  "Series C": {
    "src": "fonts/Roadgeek2014SeriesC.woff2",
    "weight": "400"
  },
  "Series B": {
    "src": "fonts/Roadgeek2014SeriesB.woff2",
    "weight": "400"
  },
  "Series D": {
    "src": "fonts/Roadgeek2014SeriesD.woff2",
    "weight": "400"
  },
  "Series F": {
    "src": "fonts/Roadgeek2014SeriesF.woff2",
    "weight": "400"
  },
  "Series EM": {
    "src": "fonts/Roadgeek2014SeriesEM.woff2",
    "weight": "400"
  },
  "Series EEM": {
    "src": "fonts/Roadgeek2014SeriesEEM.woff2",
    "weight": "400"
  },
  "Clearview 2B": {
    "src": "fonts/ClearviewHwy-Two-B.woff2",
    "weight": "400"
  },
  "Clearview 3B": {
    "src": "fonts/ClearviewHwy-Three-B.woff2",
    "weight": "400"
  },
  "Clearview 2W": {
    "src": "fonts/ClearviewHwy-Two-W.woff2",
    "weight": "400"
  },
  "Clearview 4W": {
    "src": "fonts/ClearviewHwy-Four-W.woff2",
    "weight": "400"
  },
  "Clearview 3W": {
    "src": "fonts/ClearviewHwy-Three-W.woff2",
    "weight": "400"
  },
  "Clearview 4B": {
    "src": "fonts/ClearviewHwy-Four-B.woff2",
    "weight": "400"
  },
  "Clearview 5B": {
    "src": "fonts/ClearviewHwy-Five-B.woff2",
    "weight": "400"
  },
  "Clearview 5W": {
    "src": "fonts/ClearviewHwy-Five-W.woff2",
    "weight": "400"
  },
  "Clearview 5WR": {
    "src": "fonts/ClearviewHwy-Five-W-R.woff2",
    "weight": "400"
  },
  "Clearview 6B": {
    "src": "fonts/ClearviewHwy-Six-B.woff2",
    "weight": "400"
  },
  "Clearview 6W": {
    "src": "fonts/ClearviewHwy-Six-W.woff2",
    "weight": "400"
  },
  "Clearview 1B": {
    "src": "fonts/ClearviewHwy-One-B.woff2",
    "weight": "400"
  },
  "Clearview 1W": {
    "src": "fonts/ClearviewHwy-One-W.woff2",
    "weight": "400"
  },
  "Electronic Highway Sign": {
    "src": "fonts/ElectronicHighwaySign.woff2",
    "weight": "400"
  },
  "Modern VMS": {
    "src": "fonts/ModernVMS.woff2",
    "weight": "400"
  },
  "Transport Regular": {
    "src": "fonts/Roadgeek 2005 Transport Medium Regular.woff2",
    "weight": "400"
  },
  "Transport Heavy": {
    "src": "fonts/Roadgeek 2005 Transport Heavy Regular.woff2",
    "weight": "400"
  },
  "DIN 1451 Regular": {
    "src": "fonts/Roadgeek 2005 Mittelschrift Regular.woff2",
    "weight": "400"
  },
  "DIN 1451 Narrow": {
    "src": "fonts/Roadgeek 2005 Engschrift Regular.woff2",
    "weight": "400"
  },
  "Motorway Permanent": {
    "src": "fonts/Motorway Permanent.woff2",
    "weight": "400"
  },
  "Motorway Temporary": {
    "src": "fonts/Motorway Temporary.woff2",
    "weight": "400"
  },
  "Rawlinson Regular": {
    "src": "fonts/Rawlinson Regular.woff2",
    "weight": "400"
  },
  "Rawlinson Bold": {
    "src": "fonts/Rawlinson Bold.woff2",
    "weight": "700"
  },
  "Helvetica Neue Thin": {
    "src": "fonts/HelveticaNeue-Thin.woff2",
    "weight": "100"
  },
  "Helvetica Neue Light": {
    "src": "fonts/HelveticaNeue-Light.woff2",
    "weight": "300"
  },
  "Helvetica Neue Roman": {
    "src": "fonts/HelveticaNeue-Roman.woff2",
    "weight": "400"
  },
  "Helvetica Neue Medium": {
    "src": "fonts/HelveticaNeue-Medium.woff2",
    "weight": "500"
  },
  "Helvetica Neue Bold": {
    "src": "fonts/HelveticaNeue-Bold.woff2",
    "weight": "700"
  },
  "ITC Stone Sans Regular": {
    "src": "fonts/ITC Stone Sans Regular.woff2",
    "weight": "400"
  },
  "ITC Stone Sans Semibold": {
    "src": "fonts/ITC Stone Sans Semibold Regular.woff2",
    "weight": "600"
  }
};
  const aliases = {
    "Series 1": ["Clearview 1B", "Clearview 1W"], "Series 2": ["Clearview 2B", "Clearview 2W"],
    "Series 3": ["Clearview 3B", "Clearview 3W"], "Series 4": ["Clearview 4B", "Clearview 4W"],
    "Series 5": ["Clearview 5B", "Clearview 5W"], "Series 6": ["Clearview 6B", "Clearview 6W"],
    "Series 5R": ["Clearview 5WR"], "Series 5WR": ["Clearview 5WR"],
    "Transport": ["Transport Regular"], "DIN 1451": ["DIN 1451 Regular"],
    "ITC Stone Sans Bold": ["ITC Stone Sans Semibold"],
    "Helvetica Thin": ["Helvetica Neue Thin"], "Helvetica Light": ["Helvetica Neue Light"],
    "Helvetica Roman": ["Helvetica Neue Roman"], "Helvetica Medium": ["Helvetica Neue Medium"],
    "Helvetica Bold": ["Helvetica Neue Bold"],
    "Highway Gothic": ["Series E"], "Highway Gothic Wide": ["Series EM"]
  };
  const hintKey = "signMaker.fontHints.v1", preloaded = new Set(), requests = new Map();
  let startupDeadline = 0;
  const canonicalNames = new Map(Object.keys(definitions).map((name) => [name.toLowerCase(), name]));
  const add = (families, raw, owner, panel) => {
    if (typeof raw !== "string") return;
    let name = raw.trim().replace(/^["']|["']$/g, "");
    if (typeof resolveTextFontFamilyForRender === "function" && owner) {
      name = resolveTextFontFamilyForRender(name, owner, panel);
    }
    for (const candidate of aliases[name] || [name]) {
      const family = canonicalNames.get(candidate.toLowerCase());
      if (family) families.add(family);
      if (candidate === "Motorway Permanent") families.add("Transport Regular");
      if (candidate === "Motorway Temporary") families.add("Transport Heavy");
    }
  };
  const collectPost = (model) => {
    const families = new Set(), visited = new WeakSet();
    const walk = (value, panel) => {
      if (!value || typeof value !== "object" || visited.has(value)) return;
      visited.add(value);
      if (value.sign && typeof value.sign === "object") panel = value.sign;
      for (const [key, child] of Object.entries(value)) {
        if (/font(?:Family)?\d*$/i.test(key)) add(families, child, value, panel);
        if (child && typeof child === "object") walk(child, panel);
      }
      if (typeof value.shieldBase === "string") {
        families.add("Series D"); families.add("Series E");
      }
    };
    walk(model, null);
    return families;
  };
  const preload = (family) => {
    if (preloaded.has(family) || !definitions[family]) return;
    preloaded.add(family);
    const link = document.createElement("link");
    link.rel = "preload"; link.as = "font"; link.type = "font/woff2";
    link.href = new URL(definitions[family].src, document.baseURI).href;
    link.crossOrigin = "anonymous"; link.fetchPriority = "high";
    document.head.appendChild(link);
  };
  const load = (family) => {
    if (!definitions[family] || !document.fonts?.load) return Promise.resolve();
    if (!requests.has(family)) {
      preload(family);
      const definition = definitions[family];
      try {
        requests.set(family, document.fonts.load(
          definition.weight + ' 16px "' + family + '"', "0A"
        ).catch(() => []));
      } catch (error) { requests.set(family, Promise.resolve([])); }
    }
    return requests.get(family);
  };
  const wait = (families) => {
    if (!families.size) return Promise.resolve();
    const ready = Promise.allSettled(Array.from(families, load));
    // A failed or stalled request must not leave the sign hidden indefinitely.
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, Math.max(0, (startupDeadline || Date.now() + 1200) - Date.now()));
      ready.then(() => { clearTimeout(timer); resolve(); });
    });
  };
  const collectElement = (root) => {
    const families = new Set();
    if (!root) return families;
    for (const element of [root, ...root.querySelectorAll("*")]) {
      if (!Array.from(element.childNodes).some((node) => node.nodeType === 3 && node.textContent.trim())) continue;
      try {
        for (const family of getComputedStyle(element).fontFamily.split(",")) add(families, family);
      } catch (error) {}
    }
    return families;
  };
  const remember = (root) => {
    const families = collectElement(root);
    try { localStorage.setItem(hintKey, JSON.stringify(Array.from(families))); } catch (error) {}
    return families;
  };
  const early = () => {
    const families = new Set();
    try {
      if (localStorage.getItem("signMaker.restoreOnRefresh") !== "never") {
        const hints = JSON.parse(localStorage.getItem(hintKey) || "[]");
        if (Array.isArray(hints)) hints.slice(0, 64).forEach((name) => add(families, name));
        if (!families.size) {
          const snapshot = JSON.parse(localStorage.getItem("signMaker.autosave.v1") || "null");
          collectPost(snapshot?.post).forEach((name) => families.add(name));
        }
      }
      if (!families.size) {
        const defaults = JSON.parse(localStorage.getItem("signMaker.settingsDefaults") || "{}");
        collectPost(defaults).forEach((name) => families.add(name));
      }
    } catch (error) {}
    if (!families.size) { families.add("Clearview 5WR"); families.add("Series EEM"); }
    families.forEach(preload);
  };
  early();
  return {
    preparePost: (post) => {
      startupDeadline = Date.now() + 1200;
      return wait(collectPost(post));
    },
    prepareElement: (root) => wait(remember(root)),
    remember
  };
})();

