// Independent dimension checks from FDOT 700-102 sheet 15 and CFX sheets 5-6.
const { webkit } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const baseURL = process.argv[2] || "http://127.0.0.1:8765";
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage();
    await page.route("**/*", r => new URL(r.request().url()).origin === new URL(baseURL).origin ? r.continue() : r.abort());
    await page.goto(baseURL);
    await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
    const results = await page.evaluate(async () => {
      const checks = [];
      const check = (label, actual, expected, tolerance = 0.02) => {
        if (Math.abs(actual - expected) > tolerance) throw new Error(`${label}: ${actual}, expected ${expected}`);
        checks.push(label);
      };
      const load = async (asset) => {
        const host = document.createElement("div");
        host.innerHTML = await (await fetch(asset)).text();
        document.body.append(host);
        return host;
      };
      const folder = "img/shields/United States/Florida/FDOT/";
      for (const [size, cap, top, second, silhouetteTop, silhouetteHeight, textWidth, border] of [
        ["30x36", 5, 3, 10.5, 18, 15, 22.5, 0.75],
        ["40x48", 7, 3.7, 14.1, 24.5, 20.4, 32.6, 0.75],
        ["48x60", 8, 5.4, 17.4, 29.4, 25.6, 37.2, 1.25],
      ]) {
        const host = await load(folder + `Turnpike-${size}.svg`);
        const svg = host.querySelector("svg");
        const root = svg.getBoundingClientRect();
        const scale = svg.viewBox.baseVal.width / root.width;
        const box = (selector) => {
          const r = svg.querySelector(selector).getBoundingClientRect();
          return { x: (r.x - root.x) * scale, y: (r.y - root.y) * scale, w: r.width * scale, h: r.height * scale };
        };
        const heading = box("#turnpike-heading > path");
        const name = box("#turnpike-name > path");
        const silhouette = box("#florida-silhouette");
        check(`${size} heading cap`, heading.h, cap);
        check(`${size} heading top`, heading.y, top);
        check(`${size} second cap`, name.h, cap);
        check(`${size} second top`, name.y, second);
        check(`${size} heading width`, box("#turnpike-heading").w, textWidth);
        check(`${size} silhouette top`, silhouette.y, silhouetteTop);
        check(`${size} silhouette height`, silhouette.h, silhouetteHeight);
        check(`${size} border`, Number(svg.querySelector("rect[stroke]").getAttribute("stroke-width")), border);
        check(`${size} silhouette components`, (svg.querySelector("#florida-silhouette path").getAttribute("d").match(/M/g) || []).length, 2, 0);
        host.remove();
      }
      const composite = await load(folder + "Turnpike-Toll-30x48.svg");
      if (composite.querySelector("image,use")) throw new Error("Turnpike TOLL must be self-contained vector artwork");
      check("composite nominal height", composite.querySelector("svg").viewBox.baseVal.height, 48);
      composite.remove();
      for (const [relative, width, height, radius, inset, borderWidth, divider, cap, legendWidth] of [
        ["FDOT/Toll-24x30.svg", 24, 30, 1.5, 0, 0.75, 0.5, 4, null],
        ["FDOT/Toll-40x48.svg", 40, 48, 3, 0, 0.75, 0.8, 6, null],
        ["FDOT/Toll-48x60.svg", 48, 60, 3, 0, 0.75, 0.8, 6, null],
        ...["TM", "TM-ALT"].flatMap(kind => [
          [`CFX/CFX-${kind}-36x48.svg`, 36, 48, 2, 0.75, 1, 1, 6, 21.8],
          [`CFX/CFX-${kind}-48x60.svg`, 48, 60, 3, 0.75, 1, 1, 8, 29],
        ]),
      ]) {
        const host = await load("img/shields/United States/Florida/" + relative);
        const svg = host.querySelector("svg");
        const paths = [...svg.children].filter(e => e.tagName === "path");
        const isCfx = relative.startsWith("CFX");
        const inner = paths[isCfx ? 2 : 1].getBBox();
        check(`${relative} width`, svg.viewBox.baseVal.width, width);
        check(`${relative} height`, svg.viewBox.baseVal.height, height);
        check(`${relative} top radius`, Number(paths[0].getAttribute("d").match(/A([\d.]+)/)[1]), radius);
        check(`${relative} inner rail`, inner.x, inset + borderWidth);
        if (isCfx) check(`${relative} white inset`, paths[1].getBBox().x, inset);
        const rects = [...svg.children].filter(e => e.tagName === "rect");
        check(`${relative} divider`, Number(rects.at(-1).getAttribute("height")), divider);
        const letters = paths.slice(isCfx ? 3 : 2, -1);
        check(`${relative} TOLL cap`, letters[0].getBBox().height, cap);
        if (legendWidth) {
          const left = letters[0].getBBox().x;
          const last = letters.at(-1).getBBox();
          check(`${relative} TOLL width`, last.x + last.width - left, legendWidth);
          check(`${relative} Florida stroke`, Number(paths.at(-1).getAttribute("stroke-width")), 1);
        }
        host.remove();
      }
      for (const base of ["FL", "FLToll", "FLCFXToll"]) {
        const config = ShieldElement.prototype.getBlockShieldConfig(base);
        check(`${base} route limit`, ShieldElement.prototype.limitRouteCharacters("1234", config).length, 3, 0);
      }
      const state = ShieldElement.prototype.getBlockShieldConfig("FL");
      for (const size of ["42x36", "36x30", "30x24"]) {
        const migrated = ShieldElement.prototype.migrateLegacyBlockVariant(`Guide ${size} 1-2 Digit`, "888", state);
        if (!migrated.endsWith("3 Digit")) throw new Error("Narrow state marker retained for three digits");
      }
      for (const [base, old, expected] of [["FLToll", "Old", "Old (Legacy)"], ["FLToll", "Selmon", "Selmon (Legacy)"], ["FLCFXToll", "Old", "Old (Legacy)"]]) {
        const config = ShieldElement.prototype.getBlockShieldConfig(base);
        if (ShieldElement.prototype.migrateLegacyBlockVariant(old, "408", config) !== expected) throw new Error("Legacy toll artwork was lost");
      }
      return checks;
    });
    assert.ok(results.length >= 30);
    console.log(`PASS: ${results.length} artwork dimensions, vector composite, route limits and legacy migrations.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
