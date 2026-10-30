/* v2.19 startup font loading: preload the fonts the last sign used, and keep
   the sign hidden (data-sign-loading) until they load or 1.2s pass, so it
   doesn't paint in a fallback font and then reflow. */
window.SignMakerFonts = (() => {
  // family: [woff2 file, weight], matching css/page.css.
  const definitions = {
    "Series E": ["fonts/Roadgeek2014SeriesE.woff2", "400"],
    "Series C": ["fonts/Roadgeek2014SeriesC.woff2", "400"],
    "Series B": ["fonts/Roadgeek2014SeriesB.woff2", "400"],
    "Series D": ["fonts/Roadgeek2014SeriesD.woff2", "400"],
    "Series F": ["fonts/Roadgeek2014SeriesF.woff2", "400"],
    "Series EM": ["fonts/Roadgeek2014SeriesEM.woff2", "400"],
    "Series EEM": ["fonts/Roadgeek2014SeriesEEM.woff2", "400"],
    "Clearview 2B": ["fonts/ClearviewHwy-Two-B.woff2", "400"],
    "Clearview 3B": ["fonts/ClearviewHwy-Three-B.woff2", "400"],
    "Clearview 2W": ["fonts/ClearviewHwy-Two-W.woff2", "400"],
    "Clearview 4W": ["fonts/ClearviewHwy-Four-W.woff2", "400"],
    "Clearview 3W": ["fonts/ClearviewHwy-Three-W.woff2", "400"],
    "Clearview 4B": ["fonts/ClearviewHwy-Four-B.woff2", "400"],
    "Clearview 5B": ["fonts/ClearviewHwy-Five-B.woff2", "400"],
    "Clearview 5W": ["fonts/ClearviewHwy-Five-W.woff2", "400"],
    "Clearview 5WR": ["fonts/ClearviewHwy-Five-W-R.woff2", "400"],
    "Clearview 6B": ["fonts/ClearviewHwy-Six-B.woff2", "400"],
    "Clearview 6W": ["fonts/ClearviewHwy-Six-W.woff2", "400"],
    "Clearview 1B": ["fonts/ClearviewHwy-One-B.woff2", "400"],
    "Clearview 1W": ["fonts/ClearviewHwy-One-W.woff2", "400"],
    "Electronic Highway Sign": ["fonts/ElectronicHighwaySign.woff2", "400"],
    "Modern VMS": ["fonts/ModernVMS.woff2", "400"],
    "Transport": ["fonts/Transport.woff2", "500"],
    "Transport Heavy": ["fonts/Roadgeek 2005 Transport Heavy Regular.woff2", "400"],
    "DIN 1451 Regular": ["fonts/Roadgeek 2005 Mittelschrift Regular.woff2", "400"],
    "DIN 1451 Narrow": ["fonts/Roadgeek 2005 Engschrift Regular.woff2", "400"],
    "Motorway Permanent": ["fonts/Motorway Permanent.woff2", "400"],
    "Motorway Temporary": ["fonts/Motorway Temporary.woff2", "400"],
    "Rawlinson Regular": ["fonts/Rawlinson Regular.woff2", "400"],
    "Rawlinson Bold": ["fonts/Rawlinson Bold.woff2", "400"],
    "ITC Stone Sans Regular": ["fonts/ITC Stone Sans Regular.woff2", "400"],
    "ITC Stone Sans Bold": ["fonts/ITC Stone Sans Semibold Regular.woff2", "400"],
    "Helvetica Thin": ["fonts/HelveticaNeue-Thin.woff2", "400"],
    "Helvetica Light": ["fonts/HelveticaNeue-Light.woff2", "400"],
    "Helvetica Roman": ["fonts/HelveticaNeue-Roman.woff2", "400"],
    "Helvetica Medium": ["fonts/HelveticaNeue-Medium.woff2", "400"],
    "Helvetica Bold": ["fonts/HelveticaNeue-Bold.woff2", "400"]
  };
  const aliases = {
    // v2.19 names and the Clearview names before their B/W variant is chosen.
    "Series 1": ["Clearview 1B", "Clearview 1W"], "Series 2": ["Clearview 2B", "Clearview 2W"],
    "Series 3": ["Clearview 3B", "Clearview 3W"], "Series 4": ["Clearview 4B", "Clearview 4W"],
    "Series 5": ["Clearview 5B", "Clearview 5W"], "Series 6": ["Clearview 6B", "Clearview 6W"],
    "Clearview 1": ["Clearview 1B", "Clearview 1W"], "Clearview 2": ["Clearview 2B", "Clearview 2W"],
    "Clearview 3": ["Clearview 3B", "Clearview 3W"], "Clearview 4": ["Clearview 4B", "Clearview 4W"],
    "Clearview 5": ["Clearview 5B", "Clearview 5W"], "Clearview 6": ["Clearview 6B", "Clearview 6W"],
    "Series 5R": ["Clearview 5WR"], "Series 5WR": ["Clearview 5WR"],
    "Transport Regular": ["Transport"], "DIN 1451": ["DIN 1451 Regular"],
    "ITC Stone Sans Semibold": ["ITC Stone Sans Bold"],
    "Helvetica Neue Thin": ["Helvetica Thin"], "Helvetica Neue Light": ["Helvetica Light"],
    "Helvetica Neue Roman": ["Helvetica Roman"], "Helvetica Neue Medium": ["Helvetica Medium"],
    "Helvetica Neue Bold": ["Helvetica Bold"],
    "Motorway Permanent": ["Motorway Permanent", "Transport"],
    "Motorway Temporary": ["Motorway Temporary", "Transport Heavy"],
  };
  const hintKey = "signMaker.fontHints.v1", preloaded = new Set(), requests = new Map();
  let startupDeadline = 0;
  const canonicalNames = new Map(Object.keys(definitions).map((name) => [name.toLowerCase(), name]));
  const add = (families, raw, owner, panel) => {
    if (typeof raw !== "string") return;
    let name = raw.trim().replace(/^["']|["']$/g, "");
    if (owner && typeof resolveTextFontFamilyForRender === "function") {
      try {
        name = resolveTextFontFamilyForRender(name, owner, panel) || name;
      } catch (error) {
        // Fall back to both Clearview variants below.
      }
    }
    for (const candidate of aliases[name] || [name]) {
      const family = canonicalNames.get(candidate.toLowerCase());
      if (family) families.add(family);
    }
  };
  const collectPost = (model) => {
    const families = new Set(), visited = new WeakSet();
    const walk = (value, panel) => {
      if (!value || typeof value !== "object" || visited.has(value)) return;
      visited.add(value);
      if (value.sign && typeof value.sign === "object") panel = value;
      for (const [key, child] of Object.entries(value)) {
        if (/font(?:Family)?\d*$/i.test(key)) add(families, child, value, panel);
        if (child && typeof child === "object") walk(child, panel);
      }
      // Route numbers and banners use Highway Gothic.
      if (typeof value.shieldBase === "string") {
        families.add("Series D");
        families.add("Series E");
      }
    };
    walk(model, null);
    return families;
  };
  const preload = (family) => {
    if (preloaded.has(family) || !definitions[family]) return;
    preloaded.add(family);
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "font";
    link.type = "font/woff2";
    link.href = new URL(definitions[family][0], document.baseURI).href;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  };
  const load = (family) => {
    if (!definitions[family] || !document.fonts?.load) return Promise.resolve();
    if (!requests.has(family)) {
      preload(family);
      try {
        requests.set(family, document.fonts.load(
          `${definitions[family][1]} 16px "${family}"`, "0A"
        ).catch(() => []));
      } catch (error) {
        requests.set(family, Promise.resolve([]));
      }
    }
    return requests.get(family);
  };
  // A failed or stalled request must not leave the sign hidden.
  const wait = (families) => {
    if (!families.size) return Promise.resolve();
    const ready = Promise.allSettled(Array.from(families, load));
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, Math.max(0, (startupDeadline || Date.now() + 1200) - Date.now()));
      ready.then(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  };
  const collectElement = (root) => {
    const families = new Set();
    if (!root) return families;
    for (const element of [root, ...root.querySelectorAll("*")]) {
      if (!Array.from(element.childNodes).some((node) => node.nodeType === 3 && node.textContent.trim())) continue;
      for (const family of getComputedStyle(element).fontFamily.split(",")) add(families, family);
    }
    return families;
  };
  // Remember the fonts on screen so the next load can preload them early.
  const remember = (root) => {
    const families = collectElement(root);
    try {
      localStorage.setItem(hintKey, JSON.stringify(Array.from(families)));
    } catch (error) {
      // Hints are optional.
    }
    return families;
  };
  const early = () => {
    const families = new Set();
    try {
      if (localStorage.getItem("signMaker.restoreOnRefresh") !== "never") {
        const hints = JSON.parse(localStorage.getItem(hintKey) || "[]");
        if (Array.isArray(hints)) hints.slice(0, 64).forEach((name) => add(families, name));
        if (!families.size) {
          const session = JSON.parse(localStorage.getItem("signMaker.session") || "null");
          collectPost(session?.post || session).forEach((name) => families.add(name));
        }
      }
    } catch (error) {
      // Fall through to the defaults.
    }
    if (!families.size) {
      families.add("Clearview 5WR");
      families.add("Series EEM");
    }
    families.forEach(preload);
  };
  early();
  return {
    preparePost: (post) => {
      startupDeadline = Date.now() + 1200;
      return wait(collectPost(post));
    },
    prepareElement: (root) => wait(remember(root)),
    remember,
  };
})();
