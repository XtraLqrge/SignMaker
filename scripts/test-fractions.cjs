// Uses the existing browser test setup and a running local server.
const assert = require('node:assert/strict');
const { webkit } = require('playwright');
(async () => {
  const browser = await webkit.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.argv[2] || 'http://127.0.0.1:8769');
    await page.waitForFunction(() => typeof app !== 'undefined' && app.getPost()?.panels.length);
    await page.locator('#closeWelcome').click();
    // The original rendering is the default: typed text, with the font's
    // Unicode glyph only when numerals are enlarged.
    const legacy = await page.evaluate(() => {
      const post = app.getPost();
      const render = (options) => {
        const el = new TextElement({ textContent: '1 1/2 MILE', ...options }).createElement({color:'Green'});
        return { groups: el.querySelectorAll('.bE-signFractionGroup').length, text: el.textContent };
      };
      const label = document.createElement('div');
      label.textContent = 'EXIT 1½';
      formatRemainingSignFractions(label);
      return { setting: post.signFractions, checkbox: document.getElementById('signFractions').checked,
        plain: render({}), enlarged: render({ useNumeralFormatting: true }),
        label: label.querySelectorAll('.bE-signFractionGroup').length };
    });
    assert.deepEqual(legacy, { setting: false, checkbox: false,
      plain: { groups: 0, text: '1 1/2 MILE' }, enlarged: { groups: 0, text: '1 ½ MILE' }, label: 0 });
    // Everything below covers sign fractions, turned on through the setting.
    await page.evaluate(() => {
      const checkbox = document.getElementById('signFractions');
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));
    });
    assert.equal(await page.evaluate(() => app.getPost().signFractions), true, 'Sign Fractions checkbox must update the sign');
    // Safari's document.fonts.check() is true before declared faces load.
    // Rendering first must not cache fallback-font metrics (e.g. serif digits).
    const fallbackCached = await page.evaluate(async () => {
      const fonts = ['Series D', 'Series E', 'Series EM'];
      for (const fontFamily of fonts) new TextElement({ textContent: '1 1/2 MILE', fontFamily }).createElement({color:'Green'});
      await Promise.all(fonts.map(f => document.fonts.load(`100px "${f}"`)));
      const ctx = document.createElement('canvas').getContext('2d');
      return fonts.filter(f => {
        ctx.font = `1000px "${f}"`;
        return Math.abs(getSignFractionMetrics(f, '0').ascent * 1000 - ctx.measureText('0').actualBoundingBoxAscent) > 1;
      });
    });
    assert.deepEqual(fallbackCached, [], 'Fraction metrics must come from the loaded sign font');
    const results = await page.evaluate(async () => {
      const fonts = ['Series B', 'Series C', 'Series D', 'Series E', 'Series EM', 'Series F',
        'Clearview 4W', 'Clearview 4B', 'Clearview 5W', 'Clearview 5B'];
      await Promise.all(fonts.map(f => document.fonts.load(`100px "${f}"`)));
      const host = document.createElement('div');
      host.id = 'fraction-test';
      host.style = 'position:absolute;top:0;left:0;z-index:99999;background:green;color:white;padding:24px';
      document.body.append(host);
      const checks = [];
      for (const fontFamily of fonts) {
        for (const useNumeralFormatting of [false, true]) {
          const textContent = 'EXIT 1 1/2 MILES';
          const t = new TextElement({ textContent, fontFamily, useNumeralFormatting });
          const el = t.createElement({ color: fontFamily.endsWith('B') ? 'White' : 'Green' });
          host.append(el);
          const group = el.querySelector('.bE-signFractionGroup');
          const children = [...group.children];
          const m = getSignFractionMetrics(fontFamily, '0');
          const cap = m.ascent + m.descent;
          const scale = useNumeralFormatting ? 1.5 : 1;
          const wholeWidth = getSignFractionMetrics(fontFamily, '1').width * scale;
          const numeratorLeft = parseFloat(children[1].style.left) - getSignFractionMetrics(fontFamily, '1').left;
          const rect = group.getBoundingClientRect();
          checks.push({ fontFamily, useNumeralFormatting,
            heightRatio: parseFloat(group.style.height) / cap,
            gapRatio: (numeratorLeft - wholeWidth) / (cap * scale),
            widthRatio: (parseFloat(group.style.width) - wholeWidth - cap * scale * 0.5) / cap,
            numeralScale: parseFloat(children[0].style.fontSize),
            fontMatch: children.every(child => getComputedStyle(child).fontFamily === getComputedStyle(el).fontFamily),
            visible: rect.width > 0 && rect.height > 0,
            savedText: t.textContent });
        }
      }
      const counts = {};
      for (const value of ['½', '1½', '1 1/2', '1⁄2', '1/10', '11/20', '21/24', '1/2 3/4', '1/0', '1/2/2026', 'ABC1/2']) {
        const el = new TextElement({ textContent: value }).createElement({color:'Green'});
        counts[value] = el.querySelectorAll('.bE-signFractionGroup').length;
      }
      const blocks = [ControlTextElement, ActionMessageElement, AdvisoryMessageElement, ElectronicSignElement];
      const blockCounts = blocks.map(C => {
        const block = new C();
        block.textContent = '1 ½ MILES';
        return block.createElement({color:'Green'}).querySelectorAll('.bE-signFractionGroup').length;
      });
      const multi = new TextElement({textContent:'1/2 MILE\\n1 3/4 MILES'}).createElement({color:'Green'});
      const legacy = document.createElement('div');
      legacy.style.fontFamily = '"Series E"';
      legacy.textContent = 'EXIT 1½';
      host.append(legacy);
      formatRemainingSignFractions(legacy);
      formatRemainingSignFractions(legacy);
      return { checks, counts, blockCounts, lines: multi.children.length,
        fractions: multi.querySelectorAll('.bE-signFractionGroup').length,
        legacyCount: legacy.querySelectorAll('.bE-signFractionGroup').length };
    });
    for (const c of results.checks) {
      const label = `${c.fontFamily} numeral formatting=${c.useNumeralFormatting}`;
      assert(Math.abs(c.heightRatio - 1.5) < 0.001, label);
      assert(Math.abs(c.gapRatio - 0.5) < 0.001, label);
      assert(Math.abs(c.widthRatio - (c.fontFamily.startsWith('Clearview 5') ? 2.2 : 2)) < 0.001, label);
      assert.equal(c.numeralScale, c.useNumeralFormatting ? 1.5 : 1, label);
      assert(c.fontMatch && c.visible, label);
      assert.equal(c.savedText, 'EXIT 1 1/2 MILES');
    }
    assert.deepEqual(results.counts, {'½':1,'1½':1,'1 1/2':1,'1⁄2':1,'1/10':1,'11/20':1,'21/24':1,'1/2 3/4':2,'1/0':0,'1/2/2026':0,'ABC1/2':0});
    assert.deepEqual(results.blockCounts, [1,1,1,1]);
    assert.equal(results.lines, 2);
    assert.equal(results.fractions, 2);
    assert.equal(results.legacyCount, 1);
    await page.screenshot({path:'/tmp/signmaker-fractions.png'});
    // Export an actual sign, intercepting clipboard writes inside this isolated
    // browser context. Confirm the fraction's region contains real glyph pixels.
    const exported = await page.evaluate(async () => {
      document.querySelector('#fraction-test').remove();
      const post = app.getPost();
      post.copySignsOnly = true;
      post.copyScale = 4;
      post.panels[0].sign.subPanels[0].blockElements = new Control({
        rows: [[new ActionMessageElement({textContent:'1 1/2 MILES',fontFamily:'Clearview 4'})]],
        blockProperties:[new Block()],
      });
      app.setPost(post);
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      let blob;
      Object.defineProperty(navigator.clipboard, 'write', {
        value: async items => { blob = await items[0].getType('image/png'); },
      });
      const sign = document.querySelector('#panel0 .sign').getBoundingClientRect();
      const fraction = document.querySelector('#panel0 .bE-signFractionGroup').getBoundingClientRect();
      const copied = await app.copyPanelToClipboard(0);
      if (!copied || !blob) return false;
      const image = new Image();
      const url = URL.createObjectURL(blob);
      try {
        image.src = url;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image,0,0);
        const scale = canvas.width / sign.width;
        const pixels = ctx.getImageData(
          Math.floor((fraction.left-sign.left)*scale),
          Math.floor((fraction.top-sign.top)*scale),
          Math.ceil(fraction.width*scale),Math.ceil(fraction.height*scale)).data;
        let white = 0;
        for(let i=0;i<pixels.length;i+=4) {
          if(pixels[i]>220 && pixels[i+1]>220 && pixels[i+2]>220 && pixels[i+3]>220) white++;
        }
        return white > 100;
      } finally { URL.revokeObjectURL(url); }
    });
    assert.equal(exported, true, 'Fraction glyphs must survive PNG export');
    // Check painted pixels, not just CSS boxes: a line with a fraction must sit
    // exactly like the same font's plain text, with the fraction centered on
    // the letters. Series E previously drifted from Series D/EM in Safari.
    const inkClusters = async (selector) => {
      const png = await page.locator(selector).screenshot();
      return page.evaluate(async base64 => {
        const image = new Image();
        image.src = 'data:image/png;base64,' + base64;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image,0,0);
        const data = ctx.getImageData(0,0,canvas.width,canvas.height).data;
        const clusters = [];
        let current = null;
        for (let x=0;x<canvas.width;x++) {
          let top = -1, bottom = -1;
          for (let y=0;y<canvas.height;y++) {
            const i=(y*canvas.width+x)*4;
            if(data[i]>220 && data[i+1]>220 && data[i+2]>220) { if (top < 0) top = y; bottom = y; }
          }
          if (top < 0) continue;
          if (current && x - current.right <= 4) {
            current.right = x; current.top = Math.min(current.top, top); current.bottom = Math.max(current.bottom, bottom);
          } else clusters.push(current = { right: x, top, bottom });
        }
        return clusters.map(c => ({ ...c, center: (c.top + c.bottom) / 2 }));
      }, png.toString('base64'));
    };
    for (const fontFamily of ['Series D', 'Series E', 'Series EM', 'Clearview 5W'])
    for (const useNumeralFormatting of [false, true]) {
      const label = `${fontFamily} numeral formatting=${useNumeralFormatting}`;
      await page.evaluate(async ([fontFamily, useNumeralFormatting]) => {
        for (const [id, textContent] of [['fraction-line', '1 1/2 MILE'], ['plain-line', '12 MILE']]) {
          const host = document.createElement('div');
          host.id = id;
          host.style = 'position:absolute;left:0;z-index:999999;width:1400px;background:green;color:white';
          host.style.top = id === 'plain-line' ? '400px' : '0';
          host.append(new TextElement({textContent,fontFamily,fontSize:500,useNumeralFormatting}).createElement({color:'Green'}));
          document.body.append(host);
        }
        await document.fonts.ready;
      }, [fontFamily, useNumeralFormatting]);
      const withFraction = await inkClusters('#fraction-line');
      const plain = await inkClusters('#plain-line');
      await page.evaluate(() => document.querySelectorAll('#fraction-line, #plain-line').forEach(e => e.remove()));
      const letter = withFraction.at(-1);
      const fraction = withFraction.reduce((a, b) => (b.bottom - b.top > a.bottom - a.top ? b : a));
      const whole = withFraction[0];
      assert(Math.abs(letter.top - plain.at(-1).top) <= 1, `${label} line moved: ${letter.top} vs ${plain.at(-1).top}`);
      assert(Math.abs(fraction.center - letter.center) <= 2, `${label} fraction is ${fraction.center - letter.center}px off the letters`);
      // Enlarged numerals center on the letters; normal ones share their baseline.
      assert(Math.abs(whole.center - letter.center) <= 2, `${label} whole number is ${whole.center - letter.center}px off the letters`);
      assert(Math.abs(plain[0].center - plain.at(-1).center) <= 2, `${label} numeral is ${plain[0].center - plain.at(-1).center}px off the letters`);
      if (!useNumeralFormatting) assert(Math.abs(whole.bottom - letter.bottom) <= 1, `${label} whole number baseline differs`);
    }
    assert.deepEqual(errors, []);
    console.log('Fraction rendering passed: 20 font/size combinations, parsing, all text blocks, multiline and legacy labels.');
  } finally { await browser.close(); }
})();
