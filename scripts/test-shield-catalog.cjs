// Renders every shield base and variant in WebKit and checks its artwork loads.
const { webkit } = require("playwright");
(async () => {
  const baseURL = process.argv[2] || "http://127.0.0.1:8765";
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage();
    const failedRequests = [];
    page.on("requestfailed", (request) => failedRequests.push(request.url()));
    page.on("response", (response) => {
      if (response.status() >= 400) failedRequests.push(response.url());
    });
    await page.goto(baseURL);
    await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
    const results = await page.evaluate(async () => {
      const failures = [];
      let rendered = 0;
      const routeFor = (variant) =>
        /5 Digit/.test(variant) ? "12345" : /4 Digit/.test(variant) ? "1234"
          : /3 Digit/.test(variant) ? "123" : /1 Digit/.test(variant) ? "1" : "12";
      for (const config of ShieldElement.prototype.blockShieldBases) {
        for (const variant of config.variants.length ? config.variants : ["Auto"]) {
          const post = app.getPost();
          post.panels[0].sign.subPanels[0].blockElements.rows = [[
            new ShieldElement({ shieldBase: config.value, shieldType: variant, routeNumber: routeFor(variant) }),
          ]];
          app.setPost(post);
          const img = document.querySelector("#panelContainer .shield img");
          if (!img) {
            if (!document.querySelector("#panelContainer .shield svg")) {
              failures.push(`${config.value} / ${variant}: no artwork element`);
            }
            continue;
          }
          if (!img.complete || !img.naturalWidth) {
            await new Promise((resolve) => {
              img.addEventListener("load", resolve, { once: true });
              img.addEventListener("error", resolve, { once: true });
              setTimeout(resolve, 3000);
            });
          }
          if (!img.naturalWidth) failures.push(`${config.value} / ${variant}: ${img.getAttribute("src")}`);
          else rendered++;
        }
      }
      return { failures, rendered };
    });
    const missing = [...new Set(failedRequests)].filter((url) => url.includes("/img/shields/"));
    if (results.failures.length || missing.length) {
      console.error([...results.failures, ...missing.map((url) => `404 ${decodeURIComponent(url)}`)].join("\n"));
      process.exitCode = 1;
    } else {
      console.log(`PASS: ${results.rendered} shield variants rendered with their artwork.`);
    }
  } finally {
    await browser.close();
  }
})();
