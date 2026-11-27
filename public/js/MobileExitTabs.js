/* Phone number fields retain the original inputs and their model bindings. */
window.SignMakerMobileExitTabs = (() => {
  let enabled = false, root, observer;
  const records = new Map(), pairedChecks = [];
  const number = (value, fallback) => value !== '' && Number.isFinite(Number(value)) ? Number(value) : fallback;
  const bounds = input => ({ min: number(input.min, -Infinity), max: number(input.max, Infinity), step: records.get(input)?.increment || Math.max(0.000001, number(input.step, 1)) });
  const clean = value => String(Number(value.toFixed(10)));
  const normalize = (value, min, max, step, fallback = 0) => {
    let next = Math.max(min, Math.min(max, number(value, fallback)));
    return String(next);
  };
  const stepValue = (value, direction, min, max, step) =>
    clean(Math.max(min, Math.min(max, number(value, Number.isFinite(min) ? min : 0) + direction * step)));
  const remember = node => {
    const marker = document.createComment('desktop input position'); node.before(marker); return marker;
  };
  const valid = input => input.value !== '' && Number.isFinite(Number(input.value)) &&
    (typeof input.checkValidity !== 'function' || input.checkValidity());
  const sync = () => {
    if (!enabled) return;
    for (const record of records.values()) {
      const { input, up, down } = record;
      if (input.step !== "any") { record.increment = Math.max(0.000001, number(input.step, record.increment)); input.step = "any"; }
      if (!up) continue;
      const caption = record.titleNode?.textContent.trim();
      if (caption && input.getAttribute('aria-label') !== caption) {
        input.setAttribute('aria-label', caption);
        up.setAttribute('aria-label', `Increase ${caption}`); down.setAttribute('aria-label', `Decrease ${caption}`);
      }
      if (document.activeElement !== input && valid(input)) record.lastGood = input.value;
      const { min, max, step } = bounds(input);
      const value = valid(input) ? input.value : record.lastGood;
      up.disabled = input.disabled || Number(stepValue(value, 1, min, max, step)) === Number(value);
      down.disabled = input.disabled || Number(stepValue(value, -1, min, max, step)) === Number(value);
      record.wrapper.classList.toggle('isDisabled', input.disabled);
    }
  };
  const bind = input => {
    const record = { input, lastGood: input.value, originalType: input.type, originalStep: input.getAttribute('step'), increment: Math.max(0.000001, number(input.step, 1)) };
    input.addEventListener('input', () => {
      if (!enabled || !valid(input)) return;
      record.lastGood = input.value;
      formHandler.readForm({ target: input, deferHistoryEnd: true });
      sync();
    });
    // Normalize before the existing change listener reads the field.
    input.addEventListener('change', () => {
      if (!enabled) return;
      const { min, max, step } = bounds(input);
      input.value = normalize(input.value, min, max, step, number(record.lastGood, 0));
      record.lastGood = input.value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      sync();
    }, true);
    input.addEventListener('blur', () => {
      if (!enabled) return;
      if (!valid(input)) input.dispatchEvent(new Event('change', { bubbles: true }));
      if (typeof app !== 'undefined') app.exposeToFormHandler.endUndoableChange();
    });
    input.addEventListener('keydown', event => {
      if (enabled && event.key === 'Enter') { event.preventDefault(); input.blur(); }
    });
    records.set(input, record);
    return record;
  };
  const mount = input => {
    const record = records.get(input) || bind(input);
    if (record.wrapper) return;
    record.homes = [];
    record.inputHome = remember(input);
    let field = input.closest('.exitTabSliderGroup');
    record.generated = !field;
    if (!field) {
      field = document.createElement('div');
      field.className = 'exitTabSliderGroup';
      const labels = Array.from(root.querySelectorAll(`label[for="${input.id}"]`));
      const title = labels[0];
      (title || input).before(field);
      for (const label of labels) {
        record.homes.push([remember(label), label]);
        field.append(label);
        if (label !== title) label.classList.add('mobileExitLegacyValue');
      }
    }
    record.field = field;
    field.classList.add('mobileExitNumberField');
    const title = field.querySelector(`label[for="${input.id}"]`);
    record.titleNode = title;
    const caption = title?.textContent.trim() || input.getAttribute('aria-label') || input.id;
    input.type = 'number'; input.step = 'any';
    input.inputMode = 'decimal';
    input.setAttribute('aria-label', caption);
    const wrapper = document.createElement('div'); wrapper.className = 'mobileExitStepper';
    wrapper.append(input);
    const buttons = document.createElement('div'); buttons.className = 'mobileExitStepButtons';
    for (const [direction, icon, word] of [[1, 'keyboard_arrow_up', 'Increase'], [-1, 'keyboard_arrow_down', 'Decrease']]) {
      const button = document.createElement('button'); button.type = 'button';
      button.setAttribute('aria-label', `${word} ${caption}`);
      const glyph = document.createElement('span'); glyph.className = 'material-symbols-outlined';
      glyph.setAttribute('aria-hidden', 'true'); glyph.textContent = icon; button.append(glyph);
      button.addEventListener('pointerdown', event => event.preventDefault());
      button.addEventListener('click', event => {
        event.preventDefault();
        if (!enabled || input.disabled) return;
        const { min, max, step } = bounds(input);
        input.value = stepValue(valid(input) ? input.value : record.lastGood, direction, min, max, step);
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      buttons.append(button);
      record[direction > 0 ? 'up' : 'down'] = button;
    }
    wrapper.append(buttons); field.append(wrapper); record.wrapper = wrapper;
    if (input.id === 'exitTabCornerRadius') {
      const inherit = document.getElementById('exitTabUsePanelCornerRadius');
      if (inherit) {
        record.homes.push([remember(inherit), inherit]);
        const label = document.createElement('label'); label.className = 'mobileExitRadiusInheritance';
        label.htmlFor = inherit.id;
        const text = document.createElement('span'); text.textContent = 'Use panel radius';
        label.append(inherit, text); field.append(label); record.inheritLabel = label;
      }
      if (title) { record.title = title; record.originalTitle = title.textContent; title.textContent = 'Corner radius (rem)'; }
    }
    observer.observe(input, { attributes: true, attributeFilter: ['disabled', 'min', 'max', 'step'] });
  };
  const unmount = record => {
    if (!record.wrapper) return;
    const { input } = record;
    record.inputHome.after(input); record.inputHome.remove();
    for (const [marker, node] of record.homes) {
      marker.after(node); marker.remove(); node.classList.remove('mobileExitLegacyValue');
    }
    record.inheritLabel?.remove();
    if (record.title) record.title.textContent = record.originalTitle;
    record.wrapper.remove(); record.wrapper = null;
    record.field.classList.remove('mobileExitNumberField');
    if (record.generated) record.field.remove();
    input.type = record.originalType;
    if (record.originalStep === null && record.increment === 1) input.removeAttribute('step'); else input.setAttribute('step', String(record.increment));
    input.removeAttribute('inputmode');
  };
  const setActive = active => {
    active = !!active;
    if (active === enabled) { if (active) sync(); return; }
    root = document.querySelector('.sMModal.exitTabConfig');
    if (!root) return;
    enabled = active;
    if (active) {
      observer ||= new MutationObserver(sync);
      root.querySelectorAll('input[type="range"]').forEach(mount);
      for (const panel of root.querySelectorAll('.exitTabCheckboxPanel')) {
        for (const label of Array.from(panel.children).filter(node => node.tagName === 'LABEL')) {
          const input = label.nextElementSibling;
          if (input?.type !== 'checkbox' || label.htmlFor !== input.id) continue;
          const marker = remember(input); label.append(input); label.classList.add('mobileExitCheckOption');
          pairedChecks.push({ label, input, marker });
        }
      }
      sync();
    } else {
      observer?.disconnect();
      records.forEach(unmount);
      for (const { label, input, marker } of pairedChecks.splice(0)) {
        marker.after(input); marker.remove(); label.classList.remove('mobileExitCheckOption');
      }
    }
  };
  return { setActive, sync, normalize, stepValue };
})();
