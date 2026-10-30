// Floating dropdown for a native <select>, shared with SignalMaker (GPL-3.0).
// The select stays the source of truth: it keeps its value and change events.
(() => {
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]
  ));
  let sequence = 0;
  // Every picker, so callers can resync after setting select values in code.
  window.nativeSelectPickers = new Set();
  // customColors ({ add(value), remove(value) }) adds a "Custom…" row that
  // opens the system color chooser, and remove buttons on options marked
  // data-custom-color.
  window.createNativeSelectPicker = (select, label, { colorForValue, textStyleForValue, minMenuWidth = 180, customColors } = {}) => {
    const id = `native-select-${++sequence}`;
    const wrapper = document.createElement('div');
    wrapper.className = 'symbolPicker dimensionInputs';
    const trigger = document.createElement('button');
    trigger.id = `${select.id || id}-button`;
    trigger.type = 'button';
    trigger.className = 'nativeSelectTrigger';
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-controls', id);
    trigger.setAttribute('aria-expanded', 'false');
    const swatchMarkup = colorForValue ? '<span class="colorPickerSwatch" aria-hidden="true"></span>' : '';
    trigger.innerHTML = swatchMarkup + '<span class="symbolPickerLabel"></span><svg class="symbolPickerCaret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.25 9.25l4.75 4.75 4.75-4.75"/></svg>';
    wrapper.append(trigger);
    select.classList.add('nativeSelectSource');
    select.insertAdjacentElement('afterend', wrapper);
    // The trigger shows and hides with its select.
    const syncVisibility = () => {
      wrapper.hidden = select.hidden || select.classList.contains('hidden') ||
        select.style.display === 'none';
    };
    // Pickers are created for every select, often (the block list rebuilds its
    // type menus on each refresh), so the menu is built on first open and the
    // document and window listeners exist only while it is open.
    const openListeners = [];
    const listen = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      openListeners.push([target, type, handler, options]);
    };
    const unlisten = () => {
      openListeners.splice(0).forEach(([target, type, handler, options]) =>
        target.removeEventListener(type, handler, options));
    };
    const attributeObserver = new MutationObserver(() => { syncVisibility(); sync(); });
    attributeObserver.observe(select, { attributes: true, attributeFilter: ['hidden', 'class', 'style', 'disabled'] });
    let menu = null;
    let open = false;
    let active = 0;
    let pointer = null;
    let pointerClick = false;
    let colorInput = null;
    const entries = () => [...select.options].filter(option => !option.hidden);
    function updateLabel(element, option) {
      element.textContent = option?.textContent ?? '';
      if (textStyleForValue) Object.assign(element.style, textStyleForValue(option?.value));
    }
    // SignMaker's square swatches, including its checkerboard/slash for
    // transparent colors. Keep palette colors unchanged in either theme.
    function updateSwatch(element, value) {
      if (!colorForValue) return;
      const color = colorForValue(value);
      element.style.background = color || '';
      element.classList.toggle('specialColorSwatch', !color);
    }

    function close(restoreFocus = false) {
      open = false;
      pointer = null;
      unlisten();
      wrapper.classList.remove('open');
      menu?.classList.remove('open');
      menu?.setAttribute('aria-hidden', 'true');
      if (menu) menu.inert = true;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.removeAttribute('aria-activedescendant');
      if (restoreFocus && trigger.isConnected && !trigger.disabled) trigger.focus({ preventScroll: true });
    }
    function position() {
      if (!open) return;
      if (!trigger.isConnected || !trigger.getClientRects().length) { close(); return; }
      const rect = trigger.getBoundingClientRect();
      const edge = 8, gap = 3;
      // Match the scale of the window the trigger sits in.
      const zoom = trigger.closest('.modals')
        ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sm-app-zoom')) || 1
        : 1;
      const width = Math.min(Math.max(rect.width, minMenuWidth * zoom), window.innerWidth - edge * 2);
      const below = Math.max(0, window.innerHeight - rect.bottom - edge - gap);
      const above = Math.max(0, rect.top - edge - gap);
      // Heights here are on-screen pixels; the menu's own box is scaled by zoom.
      // Read before writing any style, so opening lays the page out once.
      const contentHeight = menu.scrollHeight * zoom;
      if (menu.style.getPropertyValue('--menuZoom') !== String(zoom)) menu.style.setProperty('--menuZoom', zoom);
      const upwards = below < Math.min(contentHeight, 200) && above > below;
      const height = Math.min(contentHeight, window.innerHeight * 0.65, upwards ? above : below);
      // A scaled box keeps its unscaled layout height, anchored by transform-origin.
      Object.assign(menu.style, { width: `${width / zoom}px`, maxHeight: `${height / zoom}px`,
        left: `${Math.max(edge, Math.min(rect.left, window.innerWidth - width - edge))}px`,
        top: `${upwards ? rect.top - gap - height / zoom : rect.bottom + gap}px` });
      menu.classList.toggle('opensUp', upwards);
    }
    function highlight(index) {
      const options = entries();
      const count = options.length + (customColors ? 1 : 0);
      active = count ? (index + count) % count : 0;
      const row = menu.children[active];
      if (!row) return;
      [...menu.children].forEach((item, itemIndex) => item.classList.toggle('active', itemIndex === active));
      trigger.setAttribute('aria-activedescendant', row.id);
      if (row.offsetTop < menu.scrollTop) menu.scrollTop = row.offsetTop;
      else if (row.offsetTop + row.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = row.offsetTop + row.offsetHeight - menu.clientHeight;
    }
    // Skip the work when nothing the trigger shows has changed.
    let syncedState = '';
    function sync() {
      const state = `${select.value}\u0000${select.disabled}\u0000${select.options.length}\u0000${select.selectedOptions[0]?.textContent ?? ''}`;
      if (!open && state === syncedState) return;
      syncedState = state;
      const options = entries();
      const option = options.find(item => item.value === select.value);
      updateLabel(trigger.querySelector('.symbolPickerLabel'), option);
      if (colorForValue) updateSwatch(trigger.querySelector('.colorPickerSwatch'), select.value);
      trigger.setAttribute('aria-label', `${label}: ${option?.textContent ?? ''}`);
      trigger.disabled = select.disabled;
      if (trigger.disabled) close();
      if (open) {
        syncRows(options);
        position();
      }
    }
    function syncRows(options) {
      [...menu.querySelectorAll('[data-native-index]')].forEach((row, index) => {
        updateLabel(row.querySelector('.symbolPickerLabel'), options[index]);
        const selected = options[index]?.value === select.value;
        row.classList.toggle('selected', selected);
        row.setAttribute('aria-selected', String(selected));
        row.querySelector('.symbolPickerCheck').textContent = selected ? '✓' : '';
        if (colorForValue) updateSwatch(row.querySelector('.colorPickerSwatch'), options[index]?.value);
      });
    }
    const hit = event => document.elementFromPoint(event.clientX, event.clientY) || event.target;
    function ensureMenu() {
      if (menu) return;
      menu = document.createElement('div');
      menu.id = id;
      menu.className = 'symbolPickerMenu';
      menu.setAttribute('role', 'listbox');
      menu.setAttribute('aria-label', label);
      menu.setAttribute('aria-hidden', 'true');
      menu.inert = true;
      // A menu for a select inside a modal dialog must sit in that dialog to
      // show above it.
      (select.closest('dialog') || document.body).append(menu);
      menu.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.pointerType === 'touch' || !event.target.closest('[data-native-index]')) return;
        event.preventDefault();
        pointer = event.pointerId;
      });
      menu.addEventListener('pointermove', event => {
        const row = event.target.closest('[data-native-index]');
        if (open && row && event.pointerType !== 'touch') highlight(Number(row.dataset.nativeIndex));
      });
      menu.addEventListener('click', event => {
        event.stopPropagation();
        if (open && runAction(event.target)) return;
        const row = event.target.closest('[data-native-index]');
        if (open && row) choose(Number(row.dataset.nativeIndex));
      });
    }
    function listenWhileOpen() {
      listen(document, 'pointermove', event => {
        if (pointer === null || pointer !== event.pointerId) return;
        const row = hit(event)?.closest('[data-native-index]');
        if (row && menu.contains(row)) highlight(Number(row.dataset.nativeIndex));
      }, true);
      listen(document, 'pointerup', event => {
        if (pointer === null || pointer !== event.pointerId) return;
        pointer = null;
        const target = hit(event);
        if (menu.contains(target) && (target.closest('[data-picker-remove], [data-picker-custom]'))) {
          event.preventDefault();
          runAction(target);
          return;
        }
        const row = target?.closest('[data-native-index]');
        if (row && menu.contains(row)) { event.preventDefault(); choose(Number(row.dataset.nativeIndex)); }
        else if (!trigger.contains(target)) close(true);
      }, true);
      listen(document, 'pointercancel', event => {
        if (pointer === null || pointer !== event.pointerId) return;
        pointerClick = false;
        close(true);
      }, true);
      listen(document, 'pointerdown', event => {
        if (open && !wrapper.contains(event.target) && !menu.contains(event.target)) close();
      }, true);
      listen(window, 'resize', position);
      listen(window, 'scroll', position, true);
    }
    function renderItems(options) {
      const removeMarkup = (option, index) => customColors && option.dataset.customColor
        ? `<span class="symbolPickerRemove" role="button" title="Remove ${escape(option.textContent)}" data-picker-remove="${index}">×</span>`
        : '';
      menu.innerHTML = options.map((option, index) => `<button type="button" id="${id}-${index}" class="symbolPickerItem${option.value === select.value ? ' selected' : ''}" role="option" aria-selected="${option.value === select.value}" tabindex="-1" data-native-index="${index}" ${option.disabled ? 'disabled' : ''}>${swatchMarkup}<span class="symbolPickerLabel">${escape(option.textContent)}</span>${removeMarkup(option, index)}<span class="symbolPickerCheck" aria-hidden="true">${option.value === select.value ? '✓' : ''}</span></button>`).join('') +
        (customColors ? `<button type="button" id="${id}-custom" class="symbolPickerItem symbolPickerCustom" role="option" tabindex="-1" data-picker-custom>Custom…</button>` : '');
    }
    function show() {
      if (trigger.disabled) return;
      ensureMenu();
      if (!open) listenWhileOpen();
      const options = entries();
      renderItems(options);
      open = true;
      wrapper.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
      menu.setAttribute('aria-hidden', 'false');
      menu.inert = false;
      sync();
      void menu.offsetHeight;
      menu.classList.add('open');
      highlight(Math.max(0, options.findIndex(option => option.value === select.value)));
      trigger.focus({ preventScroll: true });
    }
    // Picker actions run on pointerup (a drag-release) or click, before row choice.
    function runAction(target) {
      const remove = target?.closest('[data-picker-remove]');
      if (remove) {
        const option = entries()[Number(remove.dataset.pickerRemove)];
        if (option) customColors.remove(option.value);
        sync();
        show();
        return true;
      }
      if (target?.closest('[data-picker-custom]')) {
        close(true);
        const input = colorInput || document.createElement('input');
        if (!colorInput) {
          colorInput = input;
          input.type = 'color';
          input.tabIndex = -1;
          input.setAttribute('aria-label', 'Custom colour');
          Object.assign(input.style, { position: 'absolute', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none' });
          wrapper.append(input);
        }
        input.value = /^#[0-9a-f]{6}$/i.test(colorForValue?.(select.value) || '') ? colorForValue(select.value) : '#000000';
        input.onchange = () => {
          customColors.add(input.value);
          select.value = input.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          sync();
        };
        input.click();
        return true;
      }
      return false;
    }
    // The change runs at once, so the sign redraws in the same frame as the
    // new label. The form refresh it triggers waits until after that paint
    // (see form.js), which keeps this within a frame.
    function choose(index) {
      const option = entries()[index];
      if (!option || option.disabled || trigger.disabled) return;
      close(true);
      if (select.value === option.value) return;
      select.value = option.value;
      sync();
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // Build the (hidden) menu once the pointer or focus reaches the trigger,
    // in its own task, so the first open doesn't pay for it. Rows can show
    // their own fonts or colours, which the browser prepares on first use.
    let prepared = false;
    const prepare = () => {
      if (prepared || menu) return;
      prepared = true;
      setTimeout(() => {
        if (menu || !trigger.isConnected) return;
        ensureMenu();
        const options = entries();
        renderItems(options);
        syncRows(options);
      }, 0);
    };
    trigger.addEventListener('pointerenter', prepare);
    trigger.addEventListener('focus', prepare);
    trigger.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.pointerType === 'touch' || trigger.disabled) return;
      event.preventDefault();
      if (open) close();
      else { show(); pointer = event.pointerId; }
      pointerClick = true;
    });
    trigger.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (pointerClick && event.detail !== 0) { pointerClick = false; return; }
      pointerClick = false;
      if (open) close(); else show();
    });
    trigger.addEventListener('keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || trigger.disabled) return;
      if (event.key === 'Tab') { close(); return; }
      if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(true); return; }
      if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        if (!open) { show(); return; }
        highlight(event.key === 'Home' ? 0 : event.key === 'End' ? entries().length - (customColors ? 0 : 1) : active + (event.key === 'ArrowDown' ? 1 : -1));
      } else if (['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        if (open && customColors && active === entries().length) runAction(menu.querySelector('[data-picker-custom]'));
        else if (open) choose(active); else show();
      } else if (event.key.length === 1) {
        const index = entries().findIndex(option => option.textContent.toLowerCase().startsWith(event.key.toLowerCase()));
        if (index < 0) return;
        event.preventDefault();
        if (open) highlight(index); else choose(index);
      }
    });
    for (const element of select.labels ?? []) element.addEventListener('click', event => { event.preventDefault(); trigger.focus(); });
    select.addEventListener('change', sync);
    syncVisibility();
    sync();
    const destroy = () => {
      close();
      attributeObserver.disconnect();
      menu?.remove();
      wrapper.remove();
      select.classList.remove('nativeSelectSource');
      window.nativeSelectPickers.delete(picker);
      pickersBySelect.delete(select);
    };
    const picker = { sync, close, destroy, select, wrapper };
    window.nativeSelectPickers.add(picker);
    pickersBySelect.set(select, picker);
    return picker;
  };

  // Converts every select already on the page and any added later with
  // convert(select), and destroys the pickers of selects that are removed.
  const pickersBySelect = new Map();
  window.observeNativeSelects = (convert) => {
    const tryConvert = (select) => {
      if (!pickersBySelect.has(select) && !select.classList.contains('nativeSelectSource')) convert(select);
    };
    document.querySelectorAll('select').forEach(tryConvert);
    new MutationObserver((mutations) => {
      let removed = false;
      for (const mutation of mutations) {
        if (mutation.removedNodes.length) removed = true;
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.tagName === 'SELECT') tryConvert(node);
          else if (node.firstElementChild) node.querySelectorAll('select').forEach(tryConvert);
        }
      }
      if (removed) {
        pickersBySelect.forEach((picker, select) => { if (!select.isConnected) picker.destroy(); });
      }
    }).observe(document.body, { childList: true, subtree: true });
  };
})();
