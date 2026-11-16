/* Mobile fields keep their original controls, listeners, and desktop positions. */
window.SignMakerMobileForms = (() => {
  let active = false, observer, frame = 0, refreshing = false, serial = 0;
  let currentRoots = [], currentPane = null, dialogs = [], bar, properties;
  const layouts = new Map(), numbers = new Map();
  const prepared = new Set(), dirty = new Set(), modalCache = new Map();
  const excluded = '.exitTabConfig, #smSPBlockProperties, .mobileNumberControl, .mobileRangeSource';
  const finite = (value, fallback) => value !== '' && Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clean = value => String(Number(value.toFixed(10)));
  const limits = record => {
    const input = record.input, fallback = record.range || input;
    return { min: finite(input.min, finite(fallback.min, -Infinity)), max: finite(input.max, finite(fallback.max, Infinity)),
      step: record.increment, any: true };
  };
  const normalize = (value, { min, max, step, any }, fallback = 0) => {
    let next = Math.max(min, Math.min(max, finite(value, fallback)));
    if (!any) { const base = Number.isFinite(min) ? min : 0; next = base + Math.round((next - base) / step) * step; }
    return String(Math.max(min, Math.min(max, next)));
  };
  const stepValue = (value, direction, bounds) => {
    const { min, max, step, any } = bounds, base = Number.isFinite(min) ? min : 0;
    const current = finite(value, base), index = (current - base) / step;
    const next = any ? current + direction * step : base + (direction > 0 ? Math.floor(index + 1e-8) + 1 : Math.ceil(index - 1e-8) - 1) * step;
    return clean(Math.max(min, Math.min(max, next)));
  };
  const hidden = node => !!node && (node.hidden || node.classList.contains('hidden') || node.classList.contains('assetHiddenSetting') || node.style.display === 'none');
  const setHidden = (node, value) => { if (node.hidden !== value) node.hidden = value; };
  const remember = node => { const marker = document.createComment('desktop field position'); node.before(marker); return marker; };
  const move = (record, node, parent) => { record.homes.push([remember(node), node]); parent.append(node); };
  const labelFor = input => input.id ? document.querySelector(`label[for="${input.id}"]`) : null;
  const pickerFor = input => {
    const next = input.nextElementSibling;
    return input.tagName === 'SELECT' && next?.matches('.symbolPicker, .fontPicker, .colorPicker, .alignmentButtons, .shieldPicker') ? next : null;
  };
  const pairFor = range => {
    const ids = [range.id + 'Val', range.id + 'Value', range.id.replace(/Slider$/, '')];
    for (const id of ids) { const node = id && document.getElementById(id); if (node !== range && node?.type === 'number') return node; }
    const next = range.nextElementSibling;
    if (next?.type === 'number') return next;
    const parent = range.parentElement;
    return parent.querySelectorAll('input[type="range"]').length === 1 && parent.querySelectorAll('input[type="number"]').length === 1
      ? parent.querySelector('input[type="number"]') : null;
  };
  const conditionalNames = { numeralFormattingSize: 'Numeral size (%)', bannerFormattingSize: 'Banner size (%)',
    bannerFirstLetterSize: 'Banner first letter (%)', smallLettersSize: 'Small letter size (%)' };
  const organizeRow = root => {
    if (layouts.has(root) || root.closest('.mobileTextForm, .mobileIconForm, .mobileShieldForm, .exitTabConfig')) return;
    const record = { root, homes: [], fields: [], rows: [] };
    const used = new Set();
    for (const label of Array.from(root.children).filter(node => node.tagName === 'LABEL' && node.htmlFor)) {
      const input = document.getElementById(label.htmlFor);
      if (!input || input.parentElement !== root || used.has(input) || label.contains(input)) continue;
      const picker = pickerFor(input), pair = input.type === 'range' ? pairFor(input) : null;
      const tail = (pair || picker || input).nextElementSibling;
      const card = document.createElement('div'); card.className = 'mobileField';
      card.classList.toggle('mobileCheckField', input.type === 'checkbox');
      label.before(card); move(record, label, card); move(record, input, card); used.add(input);
      if (picker) move(record, picker, card);
      if (pair) { move(record, pair, card); used.add(pair); }
      if (tail?.tagName === 'BUTTON' && /reset/i.test(tail.className + tail.id)) move(record, tail, card);
      record.fields.push({ card, input, label });
    }
    if (record.fields.length) { root.classList.add('mobileFieldsRow'); layouts.set(root, record); }
  };
  const organizeText = root => {
    if (layouts.has(root)) return;
    const record = { root, homes: [], fields: [], rows: Array.from(root.children) };
    const grid = document.createElement('div'); grid.className = 'mobileFieldsGrid';
    const consumed = new Set();
    const field = (input, label, generated = false) => {
      if (!input || consumed.has(input) || input.closest('.mobileField')) return;
      const card = document.createElement('div'); card.className = 'mobileField';
      const wide = /_(textContent|fontFamily)$/.test(input.id);
      card.classList.toggle('mobileFieldWide', wide);
      card.classList.toggle('mobileCheckField', input.type === 'checkbox');
      if (generated) card.append(label); else move(record, label, card);
      const picker = pickerFor(input), pair = input.type === 'range' ? pairFor(input) : null;
      move(record, input, card); consumed.add(input);
      if (picker) move(record, picker, card);
      if (pair) { move(record, pair, card); consumed.add(pair); }
      grid.append(card); record.fields.push({ card, input, label });
    };
    for (const label of Array.from(root.querySelectorAll('label[for]'))) {
      const input = document.getElementById(label.htmlFor);
      if (input && root.contains(input) && !input.closest('.fontPickerMenu, .colorPickerMenu')) field(input, label);
    }
    for (const input of Array.from(root.querySelectorAll('input[type="number"]'))) {
      if (consumed.has(input) || input.closest('.mobileField')) continue;
      const label = document.createElement('label'); label.htmlFor = input.id;
      label.textContent = conditionalNames[input.id.split('_').at(-1)] || input.getAttribute('data-tooltip') || input.getAttribute('aria-label') || 'Value';
      field(input, label, true);
    }
    record.rows.forEach(row => row.classList?.add('mobileOriginalRow'));
    root.classList.add('mobileTextForm'); root.append(grid); record.grid = grid; layouts.set(root, record);
  };
  const specialRecord = root => ({ root, homes: [], fields: [], rows: [], extras: [], titles: [], classes: [] });
  const addClass = (record, node, name) => { if (node) { node.classList.add(name); record.classes.push([node, name]); } };
  const group = (record, parent, name) => { const node = document.createElement('div'); node.className = name; parent.append(node); record.extras.push(node); return node; };
  const pack = (record, parent, { input, nodes = [], title, label = null, visible = input, wide = false, track = true }) => {
    if (!input) return null;
    const card = document.createElement('div'); card.className = 'mobileField';
    card.classList.toggle('mobileFieldWide', wide); card.classList.toggle('mobileCheckField', input.type === 'checkbox');
    if (label?.contains(input)) label = null;
    if (label) {
      move(record, label, card);
      if (title) { record.titles.push([label, label.textContent]); label.textContent = title; }
    } else { label = document.createElement('label'); label.htmlFor = input.id; label.textContent = title; card.append(label); }
    const picker = pickerFor(input);
    for (const node of [...new Set([input, picker, ...nodes].filter(Boolean))]) move(record, node, card);
    parent.append(card);
    if (track) record.fields.push({ card, input: visible, label });
    return card;
  };
  const organizeIcon = root => {
    if (layouts.has(root)) return;
    const record = specialRecord(root), main = root.querySelector('.sdIconMainColumn');
    if (!main) return;
    const get = suffix => document.getElementById('sdIcon_' + suffix);
    record.rows = Array.from(main.children).filter(node => !node.classList.contains('sdIconPickerRow'));
    record.rows.forEach(node => node.classList.add('mobileOriginalRow'));
    const grid = group(record, main, 'mobileFieldsGrid mobileIconFields');
    for (const [key, title, rangeKey, resetKey] of [
      ['iconSize', 'Size', 'iconSizeSlider', 'sizeReset'], ['backgroundColor', 'Background'],
      ['invertColors', 'Invert colors'], ['border', 'Border'],
      ['paddingHorizontalVal', 'Horizontal padding', 'paddingHorizontal', 'paddingHorizontalReset'],
      ['paddingVerticalVal', 'Vertical padding', 'paddingVertical', 'paddingVerticalReset'],
    ]) {
      const input = get(key), range = rangeKey && get(rangeKey);
      pack(record, grid, { input, title, label: labelFor(range || input), nodes: [range, resetKey && get(resetKey)].filter(Boolean) });
    }
    const alignment = get('alignment'), buttons = root.querySelector('.sdIconAlignmentButtons');
    if (alignment && buttons) pack(record, grid, { input: alignment, nodes: [buttons], visible: buttons, title: 'Alignment', wide: true });
    root.classList.add('mobileIconForm'); layouts.set(root, record);
  };
  const organizeShield = root => {
    if (layouts.has(root)) return;
    const record = specialRecord(root), get = suffix => document.getElementById('sdShield_' + suffix);
    const top = root.querySelector('.sdShieldTopRow');
    if (!top) return;
    addClass(record, top, 'mobileShieldTopRow');
    const grid = group(record, top, 'mobileShieldTopGrid');
    pack(record, grid, { input: get('shieldBase'), nodes: [root.querySelector('.sdShieldBasePickerHost')], title: 'Shield', track: false });
    pack(record, grid, { input: get('routeNumber'), title: 'Route' });
    const details = group(record, top, 'mobileShieldDetailsGrid');
    pack(record, details, { input: get('shieldSize'), nodes: [get('shieldSizeSlider')], title: 'Size', label: labelFor(get('shieldSize')) });
    pack(record, details, { input: get('shieldType'), nodes: [root.querySelector('.sdShieldVariantPickerHost')], title: 'Variant', label: labelFor(get('shieldType')), track: false });
    root.querySelectorAll('.sdShieldBannerRow').forEach((row, index) => {
      addClass(record, row, 'mobileShieldBannerRow');
      const suffix = index ? '2' : '', primary = group(record, row, 'mobileShieldBannerGrid');
      const text = get('bannerCustomText' + suffix), size = get('bannerFontSize' + (index + 1) + 'Display');
      pack(record, primary, { input: text, title: 'Banner ' + (index + 1), label: labelFor(text) });
      const position = get('bannerPosition' + suffix), positionButtons = row.querySelector('.sdShieldPositionButtons');
      pack(record, primary, { input: position, nodes: [positionButtons], visible: positionButtons, title: 'Position' });
      const cap = get('indentFirstLetter' + suffix), capButtons = row.querySelector('.sdShieldCapButtons');
      const capCard = pack(record, primary, { input: cap, nodes: [capButtons], visible: capButtons, title: 'EFL' });
      capCard?.classList.remove('mobileCheckField');
      addClass(record, capCard, 'mobileShieldCapField');
      pack(record, primary, { input: size, title: 'Size', label: labelFor(size) });
      const styles = group(record, row, 'mobileShieldBannerStyles');
      pack(record, styles, { input: get('bannerFontFamily' + (index + 1)), title: 'Font' });
      pack(record, styles, { input: get('bannerBackgroundColor' + (index + 1)), title: 'Color' });
    });
    const road = root.querySelector('.sdShieldRoadNameRow');
    if (road) {
      addClass(record, road, 'mobileShieldRoadNameRow');
      const primary = group(record, road, 'mobileShieldRoadNameGrid');
      pack(record, primary, { input: get('roadName'), title: 'Road name', label: labelFor(get('roadName')) });
      pack(record, primary, { input: get('roadNameFontSizeDisplay'), title: 'Size', label: labelFor(get('roadNameFontSizeDisplay')) });
      const styles = group(record, road, 'mobileShieldBannerStyles');
      pack(record, styles, { input: get('roadNameFontFamily'), title: 'Font' });
      pack(record, styles, { input: get('bannerLetterSpacingVal'), nodes: [get('bannerLetterSpacing')], title: 'Letter spacing', label: labelFor(get('bannerLetterSpacing')) });
    }
    root.classList.add('mobileShieldForm'); layouts.set(root, record);
  };
  const valid = input => input.value !== '' && Number.isFinite(Number(input.value)) && !input.validity?.badInput;
  const mountNumber = (input, range = null) => {
    if (numbers.has(input) || input.closest(excluded)) return;
    const record = { input, range, homes: [], last: input.value, constraints: new Map(), inputStep: input.getAttribute('step'), rangeStep: range?.getAttribute('step'),
      increment: Math.max(0.000001, finite(input.step, finite(range?.step, 1))) };
    const title = labelFor(range || input), existingCard = input.closest('.mobileField');
    const tail = input.nextElementSibling;
    const card = existingCard || document.createElement('div');
    record.card = card; record.generatedCard = !existingCard;
    if (!existingCard) {
      card.className = 'mobileField mobileNumericField';
      (range || input).before(card);
      const label = document.createElement('label');
      label.textContent = title?.textContent.trim() || input.getAttribute('aria-label') || input.getAttribute('data-tooltip') || 'Value';
      card.append(label); record.label = label;
      if (title) title.classList.add('mobileRangeLabel');
    }
    if (!input.id) { input.id = 'mobile-number-' + (++serial); record.generatedId = true; }
    const caption = card.querySelector('label');
    if (caption) { record.caption = caption; record.originalFor = caption.htmlFor; caption.htmlFor = input.id; }
    const control = document.createElement('div'); control.className = 'mobileNumberControl';
    move(record, input, control);
    const buttons = document.createElement('div'); buttons.className = 'mobileNumberButtons';
    for (const [direction, icon, word] of [[1, 'keyboard_arrow_up', 'Increase'], [-1, 'keyboard_arrow_down', 'Decrease']]) {
      const button = document.createElement('button'); button.type = 'button';
      const glyph = document.createElement('span'); glyph.className = 'material-symbols-outlined'; glyph.textContent = icon; glyph.setAttribute('aria-hidden', 'true');
      button.append(glyph); button.setAttribute('aria-label', `${word} ${caption?.textContent.trim() || 'value'}`);
      button.addEventListener('pointerdown', event => event.preventDefault());
      button.addEventListener('click', () => {
        if (!active || input.disabled || range?.disabled) return;
        input.value = stepValue(valid(input) ? input.value : record.last, direction, limits(record));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        syncNumber(record);
      });
      buttons.append(button); record[direction > 0 ? 'up' : 'down'] = button;
    }
    control.append(buttons); card.append(control); record.control = control; record.title = title;
    if (record.generatedCard && tail?.tagName === 'BUTTON' && /reset/i.test(tail.className + tail.id)) {
      move(record, tail, card); tail.classList.add('mobileFieldReset'); record.reset = tail;
    }
    if (range) {
      range.classList.add('mobileRangeSource');
      for (const key of ['min', 'max', 'step']) if (!input.getAttribute(key) && range.getAttribute(key)) {
        record.constraints.set(key, input.getAttribute(key)); input.setAttribute(key, range.getAttribute(key));
      }
    }
    input.step = 'any';
    if (range) range.step = 'any';
    const inputHandler = event => {
      if (!active) return;
      if (record.proxy) event.stopPropagation();
      if (!valid(input)) return;
      const value = Number(input.value), bounds = limits(record);
      if (value < bounds.min || value > bounds.max) return;
      record.last = input.value;
      if (record.proxy) { range.value = input.value; range.dispatchEvent(new Event('input', { bubbles: true })); }
      syncNumber(record);
    };
    const changeHandler = event => {
      if (!active) return;
      if (record.proxy) event.stopPropagation();
      input.value = normalize(input.value, limits(record), finite(record.last, 0)); record.last = input.value;
      if (record.proxy) {
        range.value = input.value; range.dispatchEvent(new Event('input', { bubbles: true })); range.dispatchEvent(new Event('change', { bubbles: true }));
      }
      syncNumber(record);
    };
    const blurHandler = () => {
      if (!active) return;
      if (!valid(input) || input.value !== normalize(input.value, limits(record), finite(record.last, 0))) input.dispatchEvent(new Event('change', { bubbles: true }));
      if (record.proxy) range.dispatchEvent(new Event('blur'));
    };
    input.addEventListener('input', inputHandler); input.addEventListener('change', changeHandler, true); input.addEventListener('blur', blurHandler);
    record.listeners = [inputHandler, changeHandler, blurHandler];
    numbers.set(input, record);
    return record;
  };
  const syncNumber = record => {
    const { input, range, up, down } = record;
    if (input.step !== 'any') { record.increment = Math.max(0.000001, finite(input.step, record.increment)); input.step = 'any'; }
    if (range && range.step !== 'any') { record.increment = Math.max(0.000001, finite(range.step, record.increment)); range.step = 'any'; }
    if (record.proxy) {
      for (const key of ['min', 'max', 'step']) if (input[key] !== range[key]) input[key] = range[key];
      if (input.disabled !== range.disabled) input.disabled = range.disabled;
      if (document.activeElement !== input && input.value !== range.value) input.value = range.value;
    }
    if (document.activeElement !== input && valid(input)) record.last = input.value;
    const bounds = limits(record), value = valid(input) ? input.value : record.last;
    const disabled = input.disabled || !!range?.disabled;
    const atMax = disabled || Number(stepValue(value, 1, bounds)) === Number(value);
    const atMin = disabled || Number(stepValue(value, -1, bounds)) === Number(value);
    if (up.disabled !== atMax) up.disabled = atMax;
    if (down.disabled !== atMin) down.disabled = atMin;
    record.control.classList.toggle('isDisabled', disabled);
    if (record.generatedCard) setHidden(record.card, record.proxy ? hidden(range) : hidden(input));
    const caption = record.title?.textContent.trim();
    if (record.label && caption && record.label.textContent !== caption) record.label.textContent = caption;
  };
  const rowSelector = '.sdShieldEditorRow, .sdShieldCountyRow, .sdShieldBannerRow, .sdShieldRoadNameRow, .sdIconControlRow, .standardArrowRow, .exitOnlyRow, .individualArrowSpacingRow, .generalSettingRow, .settingsRangeControl, .panelPaddingRow, .panelStyleSliderControl';
  const available = node => {
    if (!node?.isConnected) return false;
    if (properties?.contains(node) && !currentPane?.contains(node)) return false;
    for (let parent = node; parent; parent = parent.parentElement) {
      if ((!parent.classList.contains('mobileField') && hidden(parent)) || parent.classList.contains('tabHidden') || parent.classList.contains('mobileOriginalRow')) return false;
      if (currentRoots.includes(parent)) return true;
    }
    return false;
  };
  const rootsForEditor = () => {
    const menu = bar?.dataset.currentMenu || '';
    if (menu && !modalCache.has(menu)) modalCache.set(menu, document.querySelector('.sMModal.' + menu));
    const modal = modalCache.get(menu), roots = modal ? [modal] : [];
    for (const dialog of dialogs) if (dialog.open || ['flex', 'block'].includes(dialog.style.display)) roots.push(dialog);
    return roots;
  };
  const observe = () => {
    if (!active || !observer) return;
    if (bar) observer.observe(bar, { attributes: true, attributeFilter: ['data-current-menu'] });
    if (properties) observer.observe(properties, { attributes: true, subtree: true, attributeFilter: ['class', 'hidden'] });
    for (const root of currentRoots) observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'disabled', 'min', 'max', 'step', 'data-current-menu'] });
    for (const dialog of dialogs) observer.observe(dialog, { attributes: true, attributeFilter: ['style', 'open', 'hidden'] });
  };
  const scan = root => {
    if (!root.matches('.subPanelConfig') && !root.closest('.subPanelConfig')) return;
    root.querySelectorAll('.sdIconEditorLayout').forEach(node => { if (available(node)) organizeIcon(node); });
    root.querySelectorAll('.sdShieldEditorLayout').forEach(node => { if (available(node)) organizeShield(node); });
    root.querySelectorAll('.sdCtrlTextLayout').forEach(node => { if (available(node)) organizeText(node); });
    root.querySelectorAll(rowSelector).forEach(node => { if (available(node)) organizeRow(node); });
    for (const range of root.querySelectorAll('input[type="range"]')) {
      if (!available(range) || range.closest(excluded)) continue;
      let input = pairFor(range), proxy = false;
      if (!input) { input = document.createElement('input'); input.type = 'number'; input.value = range.value; range.after(input); proxy = true; }
      const record = mountNumber(input, range);
      if (record) record.proxy = proxy;
    }
    for (const input of root.querySelectorAll('input[type="number"]')) {
      if (available(input) && !input.closest(excluded)) mountNumber(input);
    }
  };
  const refresh = () => {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    if (!active || refreshing) return;
    refreshing = true;
    try {
      const roots = rootsForEditor();
      const pane = Array.from(properties?.children || []).find(node => node.hasAttribute('data-property') && !hidden(node)) || null;
      if (pane !== currentPane || roots.length !== currentRoots.length || roots.some((root, index) => root !== currentRoots[index])) {
        roots.forEach(root => dirty.add(root));
      }
      currentRoots = roots; currentPane = pane;
      // Layout mutations are observed only after this batch, so they cannot queue another batch.
      onMutation(observer?.takeRecords?.() || [], false);
      observer?.disconnect();
      for (const root of currentRoots) if (!prepared.has(root) || dirty.has(root)) {
        scan(root); prepared.add(root); dirty.delete(root);
      }
      for (const [input, record] of numbers) {
        if (!input.isConnected) { numbers.delete(input); continue; }
        if (available(record.range || input)) syncNumber(record);
      }
      for (const [root, record] of layouts) {
        if (!root.isConnected) { layouts.delete(root); continue; }
        if (available(root)) for (const { card, input, label } of record.fields) setHidden(card, hidden(input) || hidden(label));
      }
    } finally { refreshing = false; observe(); }
  };
  const schedule = () => { if (active && !frame) frame = window.requestAnimationFrame(refresh); };
  const onMutation = (mutations, queue = true) => {
    let changed = false;
    for (const mutation of mutations) {
      const target = mutation.target;
      if (target === bar || dialogs.includes(target) || (target.parentElement === properties && mutation.type === 'attributes')) { changed = true; continue; }
      // Renderer changes and button classes do not rebuild input layouts.
      if (target.closest?.('.mobileNumberControl') && target.tagName !== 'INPUT') continue;
      if (mutation.type === 'childList') {
        if (![...mutation.addedNodes, ...mutation.removedNodes].some(node => node.nodeType === 1 &&
          (node.matches('input, select, .mobileField') || node.querySelector('input, select')))) continue;
      } else if (!target.matches?.('input, select, label') && mutation.attributeName !== 'data-current-menu') continue;
      for (const root of currentRoots) if (root.contains(target)) dirty.add(root);
      changed = true;
    }
    if (changed && queue) schedule();
  };
  const setActive = value => {
    value = !!value;
    if (active === value) { if (active) refresh(); return; }
    active = value;
    if (active) {
      bar = document.getElementById('sMConfigBar'); properties = document.getElementById('smSPProperties');
      dialogs = Array.from(document.querySelectorAll('dialog'));
      observer ||= new MutationObserver(onMutation);
      refresh();
    } else {
      observer?.disconnect(); window.cancelAnimationFrame(frame); frame = 0;
      for (const record of numbers.values()) {
        const { input, range } = record;
        input.removeEventListener('input', record.listeners[0]); input.removeEventListener('change', record.listeners[1], true); input.removeEventListener('blur', record.listeners[2]);
        for (const [marker, node] of record.homes) { marker.after(node); marker.remove(); }
        record.control.remove(); if (record.generatedCard) record.card.remove();
        record.reset?.classList.remove('mobileFieldReset');
        record.title?.classList.remove('mobileRangeLabel'); range?.classList.remove('mobileRangeSource');
        if (record.caption) record.caption.htmlFor = record.originalFor;
        for (const [key, original] of record.constraints) { if (original === null) input.removeAttribute(key); else input.setAttribute(key, original); }
        if (record.inputStep === null) input.removeAttribute('step'); else input.setAttribute('step', record.inputStep);
        if (range) { if (record.rangeStep === null) range.removeAttribute('step'); else range.setAttribute('step', record.rangeStep); }
        if (record.proxy) input.remove(); else if (record.generatedId) input.removeAttribute('id');
      }
      numbers.clear();
      for (const record of layouts.values()) {
        for (const [marker, node] of record.homes) { marker.after(node); marker.remove(); }
        for (const [node, text] of record.titles || []) node.textContent = text;
        for (const [node, name] of record.classes || []) node.classList.remove(name);
        record.extras?.forEach(node => node.remove());
        record.grid?.remove(); record.rows.forEach(row => row.classList?.remove('mobileOriginalRow')); record.root.classList.remove('mobileTextForm', 'mobileFieldsRow');
        record.root.classList.remove('mobileIconForm', 'mobileShieldForm');
      }
      layouts.clear();
      prepared.clear(); dirty.clear(); modalCache.clear(); currentRoots = []; currentPane = null; dialogs = [];
    }
  };
  return { setActive, refresh, normalize, stepValue };
})();
