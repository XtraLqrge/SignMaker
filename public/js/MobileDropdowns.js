/* Mobile menus filter the view, never the saved sign or its native options. */
window.SignMakerMobileDropdowns = (() => {
  const keys = {
    enabled: 'signMaker.mobile.advancedDropdowns',
    session: 'signMaker.mobile.advancedDropdowns.session',
    uses: 'signMaker.mobile.advancedDropdowns.uses',
    asked: 'signMaker.mobile.advancedDropdowns.asked',
    neverAsk: 'signMaker.mobile.advancedDropdowns.neverAsk',
  };
  const read = (storage, key, fallback = null) => {
    try { return window[storage]?.getItem(key) ?? fallback; } catch { return fallback; }
  };
  const write = (storage, key, value) => {
    try { window[storage]?.setItem(key, String(value)); } catch {}
  };
  const savedPreference = read('localStorage', keys.enabled);
  let permanent = savedPreference === null ? null : savedPreference === 'true';
  let session = read('sessionStorage', keys.session) === 'true';
  let uses = Math.max(0, Number(read('sessionStorage', keys.uses, '0')) || 0);
  let asked = read('sessionStorage', keys.asked) === 'true';
  let neverAsk = read('localStorage', keys.neverAsk) === 'true';
  let revision = 0, rowId = 0, dialog = null, dontAsk = null, returnFocus = null;
  const records = new Set();
  const temporary = new WeakMap();
  const isMobile = () => window.SignMakerMobile?.active === true || document.documentElement.hasAttribute('data-mobile-ui');
  const getEnabled = () => session || (permanent === null ? !isMobile() : permanent);
  const bridge = () => typeof app === 'undefined' ? null : app.exposeToFormHandler;
  const ownerFor = source => {
    const api = bridge();
    if (!api || source.closest?.('#settings22Modal')) return source;
    const panel = api.getCurrentPanel?.();
    if (source.closest?.('.exitTabConfig')) {
      const tab = panel?.exitTabs?.[api.vars.currentlySelectedExitTabIndex];
      return tab?.nestedExitTabs?.[api.vars.currentlySelectedNestedExitTabIndex] || tab || panel;
    }
    if (source.closest?.('.subPanelConfig')) {
      if (typeof api.getActiveBlockElements === 'function') {
        const control = api.getActiveBlockElements();
        return control?.rows?.[api.vars.currentlySelectedRowIndex]?.[api.vars.currentlySelectedBlockIndex] || control || panel || source;
      }
      return api.getCurrentBlockElem?.() || api.getCurrentSubPanel?.() || panel;
    }
    if (source.closest?.('.guideArrowConfig')) return panel?.sign || panel;
    if (source.closest?.('.postStyleConfig')) return api.getPost?.();
    return panel || source;
  };
  const stateFor = source => {
    const owner = ownerFor(source);
    let state = temporary.get(source);
    if (!state || state.owner !== owner) {
      state = { owner, expanded: false };
      temporary.set(source, state);
    }
    return state;
  };
  const fontSource = source => {
    const pairs = {
      settingsDefaultsControlTextFontFamily: 'settingsDefaultsControlTextFont',
      settingsDefaultsAdvisoryFontFamily: 'settingsDefaultsAdvisoryFont',
      settingsDefaultsActionFontFamily: 'settingsDefaultsActionFont',
    };
    return document.getElementById(pairs[source.id]) || source;
  };
  const fontChoices = (source, mode = 'allFontsGrouped') => {
    const control = /^sdCtrlText_|^settingsDefaultsControlText/.test(source.id || '') || !!source.closest?.('[data-property="sdCtrlText"]');
    return [
      { label: 'Highway Gothic', fontValue: control ? 'Series EM' : 'Series E' },
      { label: 'Clearview', fontValue: control ? 'Series 5' : 'Series 4' },
    ].map(item => ({ ...item, value: mode === 'family' ? item.label : item.fontValue }));
  };
  const isBasic = (source, kind, value, { mode } = {}) => {
    if (kind === 'font') {
      const actual = mode === 'family' ? fontSource(source).value : value;
      if (mode === 'family' && fontSource(source) === source) return ['Highway Gothic', 'Clearview'].includes(actual);
      return !actual || fontChoices(source).some(item => item.fontValue === actual);
    }
    if (kind === 'arrow') return !value || ['DOWN', 'TYPE_A', 'TYPE_B'].includes(value);
    if (kind === 'color') {
      const option = Array.from(source.options || []).find(item => item.value === value);
      if (option?.dataset?.customColor === 'true') return false;
      const text = String(value || '').trim();
      return !text || /^(Green|Blue|Brown|Yellow|White|Black)$/i.test(text) ||
        [text, option?.textContent || option?.label || ''].some(label => /^(Inherit|Match\b.*|Panel Color|Default|Transparent|None)$/i.test(label.trim()));
    }
    return true;
  };
  const view = (source, kind, options = {}) => {
    if (!source || !kind || getEnabled()) return { simple: false };
    return { simple: !stateFor(source).expanded && isBasic(source, kind, options.value ?? source.value, options) };
  };
  const entries = (source, kind, items, options = {}) => {
    if (!view(source, kind, options).simple) return items;
    if (kind === 'font') {
      return fontChoices(source, options.mode).map(choice => {
        const original = items.find(item => item.value === choice.value);
        return { value: choice.value, textContent: choice.label, label: choice.label,
          parentElement: source, disabled: original?.disabled || false, ...choice };
      });
    }
    return items.filter(item => kind === 'arrow'
      ? ['DOWN', 'TYPE_A', 'TYPE_B'].includes(item.value)
      : isBasic(source, kind, item.value, options));
  };
  const fontLabel = (source, value, mode) => view(source, 'font', { value, mode }).simple
    ? fontChoices(source, mode).find(item => item.value === value)?.label || null : null;
  const syncSetting = () => {
    const checkbox = document.getElementById('appAdvancedDropdowns');
    if (checkbox) checkbox.checked = getEnabled();
  };
  const refresh = () => {
    revision++;
    syncSetting();
    for (const record of records) {
      if (!record.element.isConnected) { records.delete(record); continue; }
      record.refresh();
    }
  };
  const setEnabled = enabled => {
    permanent = !!enabled;
    session = false;
    write('localStorage', keys.enabled, permanent);
    write('sessionStorage', keys.session, false);
    for (const record of records) temporary.delete(record.source);
    refresh();
  };
  const resolvePrompt = answer => {
    asked = true;
    write('sessionStorage', keys.asked, true);
    if (dontAsk?.checked) {
      neverAsk = true;
      write('localStorage', keys.neverAsk, true);
    }
    if (answer === 'yes') setEnabled(true);
    else if (answer === 'session') {
      session = true;
      write('sessionStorage', keys.session, true);
      refresh();
    }
    dialog?.close();
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  };
  const ask = () => {
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'mobileAdvancedDropdownPrompt';
      dialog.setAttribute('aria-labelledby', 'mobileAdvancedDropdownTitle');
      dialog.setAttribute('aria-describedby', 'mobileAdvancedDropdownMessage');
      const title = document.createElement('h2');
      title.id = 'mobileAdvancedDropdownTitle';
      title.textContent = 'Enable advanced dropdowns?';
      const message = document.createElement('p');
      message.id = 'mobileAdvancedDropdownMessage';
      message.textContent = 'Would you like to permanently enable the full dropdowns? You can change this later in Settings.';
      const actions = document.createElement('div');
      actions.className = 'mobileAdvancedDropdownActions';
      for (const [text, answer] of [['Yes', 'yes'], ['For this session only', 'session'], ['No', 'no']]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = text;
        button.dataset.answer = answer;
        button.addEventListener('click', () => resolvePrompt(answer));
        actions.append(button);
      }
      const label = document.createElement('label');
      label.className = 'mobileAdvancedDropdownNeverAsk';
      dontAsk = document.createElement('input');
      dontAsk.type = 'checkbox';
      dontAsk.id = 'mobileAdvancedDropdownDontAsk';
      label.append(dontAsk, document.createTextNode("Don't ask this again"));
      dialog.append(title, message, actions, label);
      dialog.addEventListener('click', event => event.stopPropagation());
      dialog.addEventListener('cancel', event => { event.preventDefault(); resolvePrompt('no'); });
      document.body.append(dialog);
    }
    asked = true;
    write('sessionStorage', keys.asked, true);
    dialog.showModal();
  };
  const reveal = source => {
    stateFor(source).expanded = true;
    uses++;
    write('sessionStorage', keys.uses, uses);
  };
  const closed = source => {
    const state = temporary.get(source);
    if (!state?.expanded) return false;
    state.expanded = false;
    return true;
  };
  const appendAdvanced = (menu, source, kind, render, options = {}) => {
    if (!view(source, kind, options).simple) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'mobile-dropdown-advanced-' + (++rowId);
    button.className = 'mobileDropdownAdvanced';
    button.dataset.mobileDropdownAdvanced = 'true';
    button.setAttribute('role', 'option');
    button.textContent = 'Advanced...';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      reveal(source);
      render();
      if (uses >= 3 && !asked && !neverAsk && !getEnabled()) {
        returnFocus = source._fontPickerApi?.wrapper.querySelector('button') ||
          source._colorPickerApi?.trigger || menu._mobileDropdownTrigger || button;
        ask();
      }
    });
    menu.append(button);
  };
  const register = (source, element, render) => {
    for (const record of records) if (!record.element.isConnected) records.delete(record);
    const record = { source, element, refresh: render };
    records.add(record);
    return () => { records.delete(record); temporary.delete(source); };
  };
  document.getElementById('appAdvancedDropdowns')?.addEventListener('change', event => setEnabled(event.target.checked));
  document.addEventListener('keydown', event => {
    if (dialog?.open && event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      resolvePrompt('no');
    }
  }, true);
  new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ['data-mobile-ui'] });
  syncSetting();
  return { view, entries, fontChoices, fontSource, fontLabel, isBasic, getEnabled, setEnabled, appendAdvanced, closed, register,
    get revision() { return revision; } };
})();
