// Input-to-paint latency of common editing interactions, comparing two
// builds: node scripts/bench-ui.cjs <webkit|chromium> <baseline-url> <url>
const pw = require("playwright");
const engine = process.argv[2] || "webkit";
const [baselineUrl, currentUrl] = [process.argv[3] || "http://127.0.0.1:8767", process.argv[4] || "http://127.0.0.1:8765"];
const scenario = async (url) => {
  const browser = await pw[engine].launch();
  const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
  await page.addInitScript(() => {
    window.__lat = [];
    const track = (event) => {
      if (window.__muted) return;
      const ts = performance.now();
      requestAnimationFrame(() => requestAnimationFrame(() => window.__lat.push({ type: event.type, ms: performance.now() - ts })));
    };
    for (const type of ["click", "input", "keydown"]) addEventListener(type, track, true);
  });
  await page.goto(url);
  await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
  await page.evaluate(() => { localStorage.clear(); document.getElementById("closeWelcome")?.click(); for (let i = 0; i < 3; i++) app.newPanel(); });
  await page.waitForTimeout(800);
  const results = {};
  const measure = async (name, action) => {
    await page.evaluate(() => { window.__lat = []; });
    try { await action(); } catch (error) { console.error(name, error.message.split("\n").slice(0, 6).join(" | ")); results[name] = "n/a"; return; }
    await page.waitForTimeout(200);
    const lat = (await page.evaluate(() => window.__lat.map((l) => l.ms))).sort((a, b) => a - b);
    if (!lat.length) { results[name] = "n/a"; return; }
    results[name] = `${lat[lat.length >> 1].toFixed(0)}/${lat[lat.length - 1].toFixed(0)}`;
  };
  const closeMenu = async () => { const m = await page.evaluate(() => document.getElementById("sMConfigBar").dataset.currentMenu); if (m) await page.evaluate((m) => document.getElementById(m).click(), m); await page.waitForTimeout(150); };
  await closeMenu();
  for (const id of ["postConfig", "panelStyleConfig", "exitTabConfig", "subPanelConfig", "guideArrowConfig", "templates", "appSettingsConfig"]) {
    await measure("open " + id, async () => { for (let i = 0; i < 3; i++) { await page.locator("#" + id).click({ timeout: 2000 }); await page.waitForTimeout(150); await page.locator("#" + id).click({ timeout: 2000 }); await page.waitForTimeout(150); } });
  }
  await measure("panel list + switch", async () => {
    for (let i = 0; i < 3; i++) {
      if (!(await page.locator("#panelList .panelListButton").first().isVisible())) { await page.locator("#panelSelector").click({ timeout: 4000 }); await page.waitForTimeout(400); }
      await page.locator("#panelList .panelListButton").nth(i % 3).click({ timeout: 4000, force: true }); await page.waitForTimeout(300);
    }
    await closeMenu();
  });
  await page.locator("#exitTabConfig").click(); await page.waitForTimeout(300);
  await measure("drag slider", async () => {
    const box = await page.locator("#minHeight").boundingBox();
    await page.mouse.move(box.x + 3, box.y + box.height / 2); await page.mouse.down();
    for (let x = 3; x < box.width - 3; x += 3) await page.mouse.move(box.x + x, box.y + box.height / 2);
    await page.mouse.up();
  });
  await measure("type exit number", async () => { await page.locator("#exitNumber").click(); await page.keyboard.type("EXIT 12A", { delay: 20 }); });
  await closeMenu();
  await page.locator("#subPanelConfig").click(); await page.waitForTimeout(300);
  await measure("click block chip", async () => { for (let i = 0; i < 4; i++) { await page.locator(".textEditorBlock").first().click({ position: { x: 20, y: 10 }, timeout: 2000 }); await page.waitForTimeout(120); } });
  await measure("type block text", async () => { const f = page.locator("#sdCtrlText_textContent, textarea[id$=textContent]").first(); await f.click(); await page.keyboard.type(" Street", { delay: 20 }); });
  await measure("open dropdown + choose", async () => {
    for (const label of ["Center", "Left", "Center"]) {
      const sel = page.locator("#sdCtrlText_alignment");
      const id = await sel.getAttribute("id");
      if (await page.locator(`#${id}-button`).count()) { await page.locator(`#${id}-button`).click({ timeout: 2000 }); await page.locator(".symbolPickerMenu.open .symbolPickerItem").filter({ has: page.locator(".symbolPickerLabel", { hasText: new RegExp(`^${label}$`) }) }).first().click({ timeout: 2000 }); }
      else await sel.selectOption(label);
      await page.waitForTimeout(150);
    }
  });
  // The same real key presses in both builds: focus the dropdown (native in
  // v2.2, the picker's trigger now) and type an option's first letter.
  await measure("dropdown by keyboard", async () => {
    const target = (await page.locator("#sdCtrlText_alignment-button").count())
      ? page.locator("#sdCtrlText_alignment-button") : page.locator("#sdCtrlText_alignment");
    for (const key of ["l", "c", "r", "c"]) {
      await target.focus();
      await page.keyboard.press(key);
      await page.waitForTimeout(150);
    }
  });
  await browser.close();
  return results;
};
(async () => {
  const old = [await scenario(baselineUrl), await scenario(baselineUrl)];
  const cur = [await scenario(currentUrl), await scenario(currentUrl)];
  console.log(engine, "- input to painted frame, median/max ms (two runs each)");
  console.log("interaction".padEnd(28), "baseline".padStart(16), "now".padStart(16));
  for (const k of Object.keys(cur[0])) console.log(k.padEnd(28), old.map((r) => r[k]).join("  ").padStart(16), cur.map((r) => r[k]).join("  ").padStart(16));
})();
