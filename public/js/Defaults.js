// Defaults are applied only when the editor creates a block, never on restore/copy.
const blockDefaults = (() => {
  const storageKey = "signMaker.blockDefaults";
  const builtInPanelRadius = Panel.prototype.defaultBorderRadius;
  const textFields = [
    ["textContent", "Text"], ["fontFamily", "Font"],
    ["fontSize", "Text size (%)", 50, 250, 1],
    ["textColor", "Text color"], ["backgroundColor", "Background color"],
  ];
  const groups = [
    [Panel, "Sign", "panel", [["borderRadius", "Sign border radius (rem)", 0, 5, 0.05]]],
    [ControlTextElement, "Control Text", "sdCtrlText", textFields],
    [ShieldElement, "Shields", "sdShield", [
      ["shieldBase", "Shield type"], ["routeNumber", "Route number"],
      ["shieldSize", "Shield size (rem)", 2, 4, 0.1],
      ["bannerPosition", "1st banner position"], ["bannerPosition2", "2nd banner position"],
      ["bannerFontFamily1", "1st banner font"], ["bannerFontFamily2", "2nd banner font"],
      ["roadNameFontFamily", "Road name font"],
      ["scaleBannersWithShield", "Scale banners", "checkbox"],
      ["bannerLetterSpacing", "Letter spacing (em)", -0.15, 0.5, 0.01],
    ]],
    [ActionMessageElement, "Action Message", "sdActionMessage", textFields],
    [AdvisoryMessageElement, "Advisory Message", "sdAdvisory", textFields],
    [ArrowElement, "Arrow", "sdArrow", [
      ["arrow", "Arrow", () => ArrowElement.prototype.arrows],
      ["rotation", "Rotation (deg)", 0, 360, 1],
      ["size", "Size (rem)", 0.1, 20, 0.05],
      ["paddingHorizontal", "Horizontal padding (rem)", 0, 10, 0.5],
      ["paddingVertical", "Vertical padding (rem)", 0, 10, 0.5],
    ]],
    [IconElement, "Icon", "sdIcon", [
      ["icon", "Icon", () => IconElement.prototype.icons],
      ["iconSize", "Size (rem)", 0.5, 12, 0.1],
      ["backgroundColor", "Background color"], ["border", "Border", "checkbox"],
      ["spacing", "Spacing (rem)", 0, 8, 0.1], ["alignment", "Alignment"],
    ]],
    [TollLogoElement, "Toll Logo", "sdTollLogo", [
      ["logo", "Toll logo", () => TollLogoElement.prototype.logos],
      ["logoHeight", "Size (rem)", 0.5, 12, 0.1],
      ["spacing", "Spacing (rem)", 0, 8, 0.1],
      ["borderRadius", "Border radius (px)", 0, 100, 1],
      ["background", "Background", "checkbox"], ["backgroundColor", "Background color"],
      ["horizontalPadding", "Horizontal BG padding (rem)", 0, 1, 0.05],
      ["verticalPadding", "Vertical BG padding (rem)", 0, 1, 0.05],
      ["squareIcon", "Square icon", "checkbox"], ["hasOnlyBlock", "Show Only Block", "checkbox"],
    ]],
  ];
  let saved = {};
  let controls = [];
  const persist = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(saved)); }
    catch (error) { console.warn("Unable to save block defaults", error); }
  };
  const valid = (control, value) => {
    if (control.type === "checkbox") return typeof value === "boolean";
    if (control.tagName === "SELECT") return Array.from(control.options).some(option => option.value === value);
    if (control.type === "number") {
      return typeof value === "number" && Number.isFinite(value) &&
        value >= Number(control.min) && value <= Number(control.max);
    }
    return typeof value === "string";
  };
  const init = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (stored && typeof stored === "object" && !Array.isArray(stored)) saved = stored;
    } catch (error) { console.warn("Unable to load block defaults", error); }
    const category = document.getElementById("defaultsCategory");
    const fields = document.getElementById("defaultsFields");
    const sections = [];
    for (const [Constructor, title, prefix, definitions] of groups) {
      const key = Constructor.name;
      category.add(new Option(title, key));
      const section = document.createElement("fieldset");
      section.hidden = sections.length !== 0;
      const legend = document.createElement("legend");
      legend.textContent = title;
      section.append(legend);
      const builtIn = new Constructor();
      const clean = {};
      for (const [property, labelText, type, minMax, step] of definitions) {
        const source = document.getElementById(`${prefix}_${property}`);
        const control = document.createElement(typeof type === "function" || source?.tagName === "SELECT" ? "select" : "input");
        control.id = `defaults_${key}_${property}`;
        if (typeof type === "function") {
          for (const [value, definition] of Object.entries(type())) {
            control.add(new Option(definition.label || value, value));
          }
        } else if (control.tagName === "SELECT") {
          for (const option of source.options) control.add(new Option(option.text, option.value));
        } else if (typeof type === "number") {
          control.type = "number";
          control.min = type;
          control.max = minMax;
          control.step = step;
        } else {
          control.type = type || "text";
        }
        const initial = builtIn[property];
        if (valid(control, saved[key]?.[property])) clean[property] = saved[key][property];
        const value = Object.hasOwn(clean, property) ? clean[property] : initial;
        if (control.type === "checkbox") control.checked = !!value;
        else control.value = value ?? "";
        const label = document.createElement("label");
        label.htmlFor = control.id;
        label.textContent = `${labelText}: `;
        section.append(label, control, document.createElement("br"));
        control.addEventListener("input", () => {
          const next = control.type === "checkbox" ? control.checked : control.type === "number" ? control.valueAsNumber : control.value;
          if (!valid(control, next) || !control.checkValidity()) return;
          saved[key] = { ...saved[key], [property]: next };
          if (Constructor === Panel) Panel.prototype.defaultBorderRadius = next;
          persist();
        });
        controls.push({ control, initial });
      }
      saved[key] = clean;
      if (Constructor === Panel && Object.hasOwn(clean, "borderRadius")) {
        Panel.prototype.defaultBorderRadius = clean.borderRadius;
      }
      sections.push(section);
      fields.append(section);
    }
    category.addEventListener("change", () => {
      sections.forEach((section, index) => { section.hidden = groups[index][0].name !== category.value; });
    });
    document.getElementById("resetBlockDefaults").addEventListener("click", () => {
      saved = {};
      Panel.prototype.defaultBorderRadius = builtInPanelRadius;
      persist();
      for (const { control, initial } of controls) {
        if (control.type === "checkbox") control.checked = !!initial;
        else control.value = initial ?? "";
      }
      window.nativeSelectPickers.forEach((picker) => picker.sync());
    });
  };
  const create = Constructor => {
    const options = saved[Constructor.name] || {};
    const block = new Constructor(options);
    // The legacy advisory constructor doesn't forward these text options.
    if (Constructor === AdvisoryMessageElement) {
      for (const property of ["textContent", "fontSize"]) {
        if (Object.hasOwn(options, property)) block[property] = options[property];
      }
    }
    return block;
  };
  return { init, create };
})();
