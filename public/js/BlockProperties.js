/* Per-element layout settings are independent of the row that contains them. */
window.SignMakerBlockProperties = (() => {
  const numeric = { topPadding: [-5, 10], bottomPadding: [-5, 10], leftPadding: [0, 10], rightPadding: [0, 10], leftMargin: [-5, 10], rightMargin: [-5, 10], width: [0, 100] };
  const normalize = value => {
    const result = Object.assign(new Block(value || {}), { leftMargin: value?.leftMargin ?? 0, rightMargin: value?.rightMargin ?? 0 });
    for (const [key, [min, max]] of Object.entries(numeric)) {
      const parsed = parseFloat(result[key]);
      result[key] = Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : 0;
    }
    for (const key of ['backgroundFullWidth', 'stretchLeft', 'stretchCenter', 'stretchRight']) result[key] = result[key] !== false;
    if (typeof result.backgroundColor !== 'string' || !result.backgroundColor.trim()) result.backgroundColor = 'Inherit';
    if (typeof result.borderColor !== 'string' || !result.borderColor.trim()) result.borderColor = 'Match BG';
    return result;
  };
  const color = value => (lib.colors[value] || value || '').toLowerCase();
  const light = value => ['Orange', 'White', 'Yellow', 'Fluorescent Yellow-Green', 'Fluorescent Pink'].includes(value);
  const paddingTypes = () => [ControlTextElement, ActionMessageElement, ShieldElement, BeaconElement, DividerElement];
  const applyPadding = (element, node) => {
    if (!paddingTypes().includes(element?.constructor) || !node) return;
    const horizontal = Math.max(0, parseFloat(element.paddingHorizontal) || 0);
    const vertical = Math.max(0, parseFloat(element.paddingVertical) || 0);
    if (!horizontal && !vertical) return;
    node.classList.add('hasBlockPadding');
    node.style.setProperty('--blockPaddingH', horizontal + 'rem');
    node.style.setProperty('--blockPaddingV', vertical + 'rem');
    if (element instanceof DividerElement) node.style.marginTop = node.style.marginBottom = vertical + 'rem';
  };
  const renderElement = (element, node) => {
    applyPadding(element, node);
    if (!element?.blockProperties) return node;
    const properties = normalize(element.blockProperties), defaults = normalize();
    if (Object.keys(properties).every(key => properties[key] === defaults[key])) return node;
    const frame = document.createElement('div'), paint = document.createElement('div');
    frame.className = 'elementPropertiesFrame'; paint.className = 'elementPropertiesPaint';
    const alignment = ['Left', 'Right'].includes(element.alignment) ? element.alignment : 'Center';
    frame.style.justifyContent = { Left: 'flex-start', Center: 'center', Right: 'flex-end' }[alignment];
    frame.style.marginTop = properties.topPadding + 'rem';
    frame.style.marginBottom = properties.bottomPadding + 'rem';
    frame.style.marginLeft = properties.leftMargin + 'rem';
    frame.style.marginRight = properties.rightMargin + 'rem';
    frame.style.flexGrow = properties.width ? '0' : properties['stretch' + alignment] ? '1' : '0';
    if (properties.width) frame.style.width = properties.width + 'rem';
    paint.style.paddingLeft = properties.leftPadding + 'rem'; paint.style.paddingRight = properties.rightPadding + 'rem';
    paint.style.justifyContent = frame.style.justifyContent;
    if (properties.backgroundFullWidth) paint.style.width = '100%';
    const hasBackground = properties.backgroundColor !== 'Inherit';
    if (hasBackground) {
      paint.style.backgroundColor = color(properties.backgroundColor);
      paint.style.color = light(properties.backgroundColor) ? 'black' : 'white';
    }
    if (hasBackground || properties.borderColor !== 'Match BG') {
      paint.style.border = 'var(--panelBorderWidth, 0.2rem) solid ' +
        color(properties.borderColor === 'Match BG' ? light(properties.backgroundColor) ? 'Black' : 'White' : properties.borderColor);
    }
    paint.append(node); frame.append(paint);
    return frame;
  };

  let bridge, root, editingElement = null;
  const field = key => document.getElementById('sdElement_' + key);
  const finish = () => {
    if (!editingElement) return;
    editingElement = null;
    bridge?.endUndoableChange?.();
  };
  const commit = (key, value) => {
    const element = bridge?.getCurrentBlockElem?.();
    if (!element) return;
    const next = normalize({ ...element.blockProperties, [key]: value });
    if (normalize(element.blockProperties)[key] === next[key]) return;
    if (editingElement !== element) { finish(); bridge.beginUndoableChange?.(); editingElement = element; }
    element.blockProperties = next;
    bridge.redraw?.();
  };
  const syncPairs = (key, value, force = false) => {
    for (const node of root.querySelectorAll('[data-element-property="' + key + '"]')) {
      if (!force && node === document.activeElement) continue;
      if (node.type === 'checkbox') node.checked = value;
      else {
        if (node.type === 'range') node.value = Math.max(Number(node.min), Math.min(Number(node.max), Number(value)));
        else node.value = value;
      }
      node._colorPickerApi?.sync();
    }
  };
  const syncColorOptions = key => {
    const target = field(key), source = document.getElementById('sdBlock_' + key);
    if (!target || !source) return;
    const values = new Set(Array.from(target.options, option => option.value));
    for (const option of source.options) if (!values.has(option.value)) target.add(new Option(option.textContent, option.value));
  };
  const bind = () => {
    if (root.dataset.elementPropertiesBound) return;
    root.dataset.elementPropertiesBound = 'true';
    const read = event => {
      const input = event.target, key = input.dataset.elementProperty;
      if (!key) return;
      let value = input.type === 'checkbox' ? input.checked : input.value;
      if (numeric[key]) {
        if (value === '' || !Number.isFinite(Number(value))) return;
        const [min, max] = numeric[key]; value = Math.max(min, Math.min(max, Number(value)));
      }
      if (event.type === 'change' && numeric[key]) input.value = value;
      syncPairs(key, value); commit(key, value);
      if (event.type === 'change') finish();
    };
    root.addEventListener('input', read);
    root.addEventListener('change', read);
    root.addEventListener('focusout', event => {
      const key = event.target.dataset.elementProperty;
      if (numeric[key]) syncPairs(key, normalize(bridge?.getCurrentBlockElem?.()?.blockProperties)[key], true);
      if (!root.contains(event.relatedTarget)) finish();
    });
    for (const button of root.querySelectorAll('[data-element-reset]')) button.addEventListener('click', () => {
      const key = button.dataset.elementReset, value = normalize()[key];
      syncPairs(key, value, true); commit(key, value); finish();
    });
  };
  const sync = (element, prefix, api) => {
    bridge = api; root = document.getElementById('smSPElementProperties');
    if (!root) return;
    if (editingElement && editingElement !== element) finish();
    root.hidden = !element;
    if (!element) return;
    bind(); syncColorOptions('backgroundColor'); syncColorOptions('borderColor');
    const values = normalize(element.blockProperties);
    for (const key of Object.keys(values)) {
      const select = field(key);
      if (select?.tagName === 'SELECT' && !Array.from(select.options).some(option => option.value === values[key])) select.add(new Option(values[key], values[key]));
      syncPairs(key, values[key]);
    }
  };
  return { normalize, renderElement, applyPadding, sync, finish };
})();
