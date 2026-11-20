/* Preserve painted banner text without changing the live sign's line boxes. */
window.SignMakerBannerExport = (() => {
  const selector = ".specialShieldPlaque, .bannerA.customBannerBackground, .bannerB.customBannerBackground";

  const captureText = (source, rect, scale, width, height, density) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * density);
    canvas.height = Math.ceil(height * density);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.scale(density, density);
    context.textBaseline = "alphabetic";
    context.textAlign = "left";
    const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let painted = false;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim()) continue;
      const style = window.getComputedStyle(node.parentElement);
      if (style.visibility === "hidden" || style.display === "none") continue;
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      context.fillStyle = style.color;
      context.fontKerning = style.fontKerning;
      context.fontVariantCaps = style.fontVariantCaps;
      context.fontStretch = style.fontStretch;
      const ascent = context.measureText(node.textContent).fontBoundingBoxAscent;
      if (!Number.isFinite(ascent)) return null;
      // Range rectangles expose the actual font box in the editor. Its top plus
      // the font ascent gives the baseline, independent of descender padding.
      const transform = text => style.textTransform === "uppercase" ? text.toUpperCase()
        : style.textTransform === "lowercase" ? text.toLowerCase() : text;
      if ("letterSpacing" in context && "wordSpacing" in context) {
        context.letterSpacing = style.letterSpacing === "normal" ? "0px" : style.letterSpacing;
        context.wordSpacing = style.wordSpacing === "normal" ? "0px" : style.wordSpacing;
        if (/[\r\n]/.test(node.textContent)) {
          // Each extra banner line has its own baseline in the live sign.
          for (const line of node.textContent.matchAll(/[^\r\n]+/g)) {
            range.setStart(node, line.index);
            range.setEnd(node, line.index + line[0].length);
            const box = range.getBoundingClientRect();
            context.fillText(transform(line[0]), (box.left - rect.left) / scale, (box.top - rect.top) / scale + ascent);
          }
        } else {
          range.selectNodeContents(node);
          const box = range.getBoundingClientRect();
          context.fillText(transform(node.textContent), (box.left - rect.left) / scale, (box.top - rect.top) / scale + ascent);
        }
      } else {
        // Older canvas implementations cannot apply CSS character spacing.
        // Measure each character's painted position instead of guessing it.
        let offset = 0;
        for (const character of node.textContent) {
          range.setStart(node, offset);
          offset += character.length;
          range.setEnd(node, offset);
          const box = range.getBoundingClientRect();
          context.fillText(transform(character), (box.left - rect.left) / scale, (box.top - rect.top) / scale + ascent);
        }
      }
      painted = true;
    }
    if (!painted) return null;
    const image = document.createElement("img");
    image.src = canvas.toDataURL();
    image.alt = "";
    image.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;max-width:none;margin:0;padding:0;border:0;pointer-events:none;";
    return image;
  };

  const freeze = (sourceRoot, cloneRoot, scale = 1, density = 4) => {
    const sources = [sourceRoot, ...sourceRoot.querySelectorAll("*")];
    const clones = [cloneRoot, ...cloneRoot.querySelectorAll("*")];
    sources.forEach((source, index) => {
      const clone = clones[index];
      if (!clone || !source.matches(selector)) return;
      const rect = source.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const width = rect.width / scale, height = rect.height / scale;
      clone.style.setProperty("box-sizing", "border-box", "important");
      for (const property of ["width", "min-width", "max-width"]) clone.style.setProperty(property, width + "px", "important");
      for (const property of ["height", "min-height", "max-height"]) clone.style.setProperty(property, height + "px", "important");
      // Special plaques have no enlarged first-letter pseudo-element. Capture
      // their glyphs using the live font and baseline before image serialization
      // can substitute a different line box. Keep the original hidden text so
      // the clone retains the same inline baseline and layout participation.
      if (!source.classList.contains("specialShieldPlaque")) return;
      const image = captureText(source, rect, scale, width, height, density);
      if (!image) return;
      const text = document.createElement("span");
      text.style.visibility = "hidden";
      text.append(...clone.childNodes);
      clone.replaceChildren(text, image);
      clone.style.setProperty("position", "relative", "important");
    });
  };
    const freezeLayout = (sourceRoot, cloneRoot, normalizeMeasurement) => {
      if (!sourceRoot || !cloneRoot) {
        return;
      }

      const layoutSelectors = [
        ".panel",
        ".panelStack",
        ".exitTabContainer",
        ".exitTabHolder",
        ".exitTab",
        ".signContainer",
        ".sign",
        ".signHolder",
        ".globalTop",
        ".globalBottom",
        ".subPanelDisplay",
        ".signContentContainer",
        ".blockElementMaster",
        ".guideArrows",
        ".aplArrows",
      ].join(", ");

      const sourceNodes = [sourceRoot, ...sourceRoot.querySelectorAll("*")];
      const cloneNodes = [cloneRoot, ...cloneRoot.querySelectorAll("*")];

      sourceNodes.forEach((sourceNode, nodeIndex) => {
        const cloneNode = cloneNodes[nodeIndex];

        if (!cloneNode || !sourceNode.matches || !sourceNode.matches(layoutSelectors)) {
          return;
        }

        const rect = sourceNode.getBoundingClientRect();

        if (!rect.width || !rect.height) {
          return;
        }

        const computedStyle = window.getComputedStyle(sourceNode);
        const widthPx = normalizeMeasurement(rect.width) + "px";
        const heightPx = normalizeMeasurement(rect.height) + "px";

        const shouldFreezeAsBorderBox =
          sourceNode.classList.contains("hasPanelOuterBorder") ||
          sourceNode.classList.contains("sign") && sourceNode.classList.contains("hasSideGuideArrow");

        cloneNode.style.boxSizing = shouldFreezeAsBorderBox
          ? "border-box"
          : computedStyle.boxSizing || "border-box";
        cloneNode.style.width = widthPx;
        cloneNode.style.minWidth = widthPx;
        cloneNode.style.maxWidth = widthPx;

        if (
          sourceNode.classList.contains("sign") ||
          sourceNode.classList.contains("signContainer") ||
          sourceNode.classList.contains("exitTabContainer") ||
          sourceNode.classList.contains("exitTabHolder") ||
          sourceNode.classList.contains("exitTab") ||
          sourceNode.classList.contains("globalTop") ||
          sourceNode.classList.contains("globalBottom") ||
          sourceNode.classList.contains("guideArrows") ||
          sourceNode.classList.contains("aplArrows")
        ) {
          cloneNode.style.height = heightPx;
          cloneNode.style.minHeight = heightPx;
        }
      });
    };

  return { freeze, freezeLayout };
})();
