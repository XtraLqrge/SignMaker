/* Compact element previews and touch selection share the existing sign models. */
window.SignMakerMobileSubpanels = (() => {
  const appBridge = () => typeof app === 'undefined' ? null : app.exposeToFormHandler;
  const active = () => !!window.SignMakerMobile?.active;
  const symbols = {
    ControlTextElement: 'text_fields',
    ActionMessageElement: 'campaign',
    AdvisoryMessageElement: 'warning',
    DividerElement: 'horizontal_rule',
    BeaconElement: 'lightbulb',
    ElectronicSignElement: 'display_settings',
    GroupedBlockElement: 'folder',
  };
  const selectionPayload = (control, selected, vars = {}) => {
    const rows = [];
    (control?.rows || []).forEach((row, rowIndex) => {
      const indices = row.map((element, index) => selected.has(element) ? index : -1).filter(index => index >= 0);
      if (indices.length) rows.push({ rowIndex, selectedBlockIndices: indices, fullRow: indices.length === row.length });
    });
    return { panelIndex: vars.currentlySelectedPanelIndex, subPanelIndex: vars.currentlySelectedSubPanelIndex,
      rows, selectedBlockCount: rows.reduce((count, row) => count + row.selectedBlockIndices.length, 0),
      selectedRowCount: rows.length, standardOnly: false, allowEmpty: true };
  };
  const editBlocks = (control, selected, action, emptyElement) => {
    const payload = selectionPayload(control, selected);
    for (const entry of payload.rows.slice().reverse()) {
      const row = control.rows[entry.rowIndex];
      if (entry.fullRow) {
        if (action === 'delete') {
          control.rows.splice(entry.rowIndex, 1);
          control.blockProperties.splice(entry.rowIndex, 1);
        } else {
          control.rows.splice(entry.rowIndex + 1, 0, row.map(element => control.cloneElement(element)));
          control.blockProperties.splice(entry.rowIndex + 1, 0, control.cloneBlockProperties(control.blockProperties[entry.rowIndex]));
        }
      } else for (const index of entry.selectedBlockIndices.slice().reverse()) {
        if (action === 'delete') row.splice(index, 1);
        else row.splice(index + 1, 0, control.cloneElement(row[index]));
      }
    }
    if (!control.rows.length && emptyElement) {
      control.rows.push([emptyElement()]);
      control.blockProperties.push(control.cloneBlockProperties({}));
    }
    return payload.selectedBlockCount;
  };
  const globalKey = index => index === -2 ? 'globalTopBlockElements' : 'globalBottomBlockElements';
  const subpanelRef = (sign, index) => index < 0 ? globalKey(index) : sign?.subPanels[index];
  const editSubpanels = (sign, selected, action, createGlobalCopy) => {
    const oldOrder = sign.subPanels.slice();
    for (let index = oldOrder.length - 1; index >= 0; index--) {
      if (!selected.has(oldOrder[index])) continue;
      if (action === 'duplicate') sign.duplicateSubPanel(index);
      else if (sign.subPanels.length > 1) sign.deleteSubPanel(index);
    }
    for (const key of ['globalTopBlockElements', 'globalBottomBlockElements']) {
      if (!selected.has(key)) continue;
      if (action === 'delete') delete sign[key];
      else if (sign[key] && createGlobalCopy) {
        const copy = createGlobalCopy(sign[key]);
        sign.subPanels.splice(key === 'globalTopBlockElements' ? 0 : sign.subPanels.length, 0, copy);
      }
    }
    if (Array.isArray(sign.aplArrows)) {
      sign.aplArrows = sign.aplArrows.filter(arrow => {
        const key = arrow.placement === 'divider' ? 'dividerAfterSubPanelIndex' : 'subPanelIndex';
        const oldIndex = arrow[key];
        if (!Number.isInteger(oldIndex) || oldIndex < 0) return true;
        const index = sign.subPanels.indexOf(oldOrder[oldIndex]);
        if (index < 0 || (key === 'dividerAfterSubPanelIndex' && index >= sign.subPanels.length - 1)) return false;
        arrow[key] = index;
        return true;
      });
    }
  };
  const makeVisual = (element, kind, panel) => {
    const visual = document.createElement('span');
    visual.className = 'mobileBlockVisual';
    visual.setAttribute('aria-hidden', 'true');
    if (['ShieldElement', 'ArrowElement', 'TollLogoElement', 'IconElement'].includes(kind)) {
      try {
        const rendered = element.createElement(panel);
        const image = rendered.querySelector(kind === 'ShieldElement' ? '.shieldImg' : 'img');
        if (image?.getAttribute('src')) {
          const thumbnail = document.createElement('img');
          thumbnail.src = image.getAttribute('src');
          thumbnail.alt = '';
          thumbnail.draggable = false;
          if (kind === 'ArrowElement') {
            thumbnail.style.rotate = `${Number(element.rotation) || 0}deg`;
            thumbnail.style.scale = element.flip ? '-1 1' : '1';
          }
          visual.append(thumbnail);
          return visual;
        }
      } catch (_) {}
    }
    const symbol = document.createElement('span');
    symbol.className = 'material-symbols-outlined blockElementSymbol';
    symbol.setAttribute('aria-hidden', 'true');
    symbol.textContent = symbols[kind] || 'widgets';
    visual.append(symbol);
    return visual;
  };
  const chooseLabels = (available, widths, minimums, gap = 8) => {
    const full = widths.map(() => true);
    let total = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * gap;
    const order = widths.map((width, index) => ({ index, saving: width - minimums[index] }))
      .sort((a, b) => b.saving - a.saving);
    for (const { index, saving } of order) {
      if (total <= available) break;
      if (saving <= 0) continue;
      full[index] = false;
      total -= saving;
    }
    return full;
  };
  let measuringContext;
  const fitRowLabels = row => {
    const blocks = Array.from(row.querySelectorAll('.textEditorBlock'));
    if (!blocks.length || row.classList.contains('mobileEditorDragging')) return;
    const style = window.getComputedStyle?.(row);
    const width = row.clientWidth || row.getBoundingClientRect().width;
    if (!width) return;
    const gap = parseFloat(style?.columnGap) || 8;
    const padding = (parseFloat(style?.paddingLeft) || 10) + (parseFloat(style?.paddingRight) || 10);
    const available = width - padding;
    if (!measuringContext) measuringContext = document.createElement('canvas').getContext?.('2d');
    const minimums = [], widths = [];
    for (const block of blocks) {
      const caption = block.querySelector('.textEditorBlockLabel');
      const title = caption?.textContent || block.title;
      const font = window.getComputedStyle?.(caption || block);
      const size = parseFloat(font?.fontSize) || 14;
      const textWidth = measuringContext ? (measuringContext.font = `${font?.fontWeight || 600} ${size}px ${font?.fontFamily || 'Inter, sans-serif'}`,
        measuringContext.measureText(title).width) : title.length * size * 0.6;
      const grouped = !!block.querySelector('.mergeEditGroup');
      const minimum = mode === 'blocks' ? 90 : grouped ? 104 : 68;
      const controls = mode === 'blocks' ? 42 : grouped ? 82 : 34;
      minimums.push(minimum);
      widths.push(Math.max(minimum, Math.ceil(textWidth + controls)));
    }
    const full = chooseLabels(available, widths, minimums, gap);
    blocks.forEach((block, index) => block.classList.toggle('mobileFullLabel', full[index]));
  };
  let initialized = false, mode = '', context = null, selected = new Set(), toolbar, actions, label, editor;
  let gesture = null, ignoreClickUntil = 0, refreshing = false;
  const visualKeys = new WeakMap();
  const bridge = () => appBridge();
  const control = () => bridge()?.getActiveBlockElements?.() || bridge()?.getCurrentSubPanel?.()?.blockElements;
  const sign = () => bridge()?.getCurrentPanel?.()?.sign;
  const stop = event => { event.preventDefault(); event.stopImmediatePropagation(); };
  const allNodes = () => Array.from(document.querySelectorAll(mode === 'subpanels' ? '#subPanelList .subPanelTabGroup' : '#sMSPTextList .textEditorBlock, #sMSPTextList .sMControlRow'));
  const refFor = node => node.matches('.subPanelTabGroup') ? subpanelRef(sign(), Number(node.dataset.subpanelIndex))
    : node.matches('.textEditorBlock') ? control()?.rows[Number(node.dataset.row)]?.[Number(node.dataset.block)]
      : control()?.rows[Number(node.dataset.dataRow)];
  const check = node => {
    const ref = refFor(node);
    if (Array.isArray(ref)) return ref.length > 0 && ref.every(element => selected.has(element));
    return selected.has(ref);
  };
  const toggle = (node, value = !check(node)) => {
    const ref = refFor(node);
    for (const item of Array.isArray(ref) ? ref : [ref]) {
      if (item == null) continue;
      value ? selected.add(item) : selected.delete(item);
    }
    refresh();
  };
  const cancelGesture = () => {
    if (!gesture) return;
    window.clearTimeout(gesture.timer);
    gesture.node.style.removeProperty('--mobile-editor-drag-x');
    gesture.node.style.removeProperty('--mobile-editor-drag-y');
    gesture.node.classList.remove('mobileEditorDragging');
    gesture = null;
    document.querySelectorAll('.mobileEditorDropBefore, .mobileEditorDropAfter').forEach(node => node.classList.remove('mobileEditorDropBefore', 'mobileEditorDropAfter'));
  };
  const exit = () => {
    cancelGesture(); mode = ''; selected.clear(); context = null;
    if (editor) delete editor.dataset.jiggle;
    if (toolbar) toolbar.hidden = true;
    if (initialized && active()) document.querySelectorAll('#sMSPTextList .sMControlRow').forEach(fitRowLabels);
  };
  const enter = kind => {
    mode = kind === 'subpanel' ? 'subpanels' : 'blocks';
    context = mode === 'subpanels' ? sign() : control();
    selected.clear();
    refresh();
  };
  const checkbox = node => {
    let input = Array.from(node.children).find(child => child.classList.contains('mobileJiggleCheck'));
    if (!input) {
      input = document.createElement('input'); input.type = 'checkbox'; input.className = 'mobileJiggleCheck';
      input.setAttribute('aria-label', `Select ${node.getAttribute('aria-label') || node.title || (node.matches('.sMControlRow') ? 'row ' + (Number(node.dataset.dataRow) + 1) : node.textContent.trim())}`);
      input.addEventListener('change', () => toggle(node, input.checked));
      node.prepend(input);
    }
    input.checked = check(node);
  };
  const refresh = () => {
    if (!initialized || refreshing) return;
    refreshing = true;
    try {
      if (!active() || document.getElementById('sMConfigBar').dataset.currentMenu !== 'subPanelConfig') { exit(); return; }
      const currentControl = control(), currentSign = sign();
      if (mode && context !== (mode === 'subpanels' ? currentSign : currentControl)) exit();
      document.querySelectorAll('#sMSPTextList .textEditorBlock').forEach(node => {
        const element = currentControl?.rows[Number(node.dataset.row)]?.[Number(node.dataset.block)];
        if (!element) return;
        const kind = Control.prototype.blockToClassElems.getElem(element) || element.constructor.name;
        const title = element.label || Control.prototype.blockElements[kind] || 'Element';
        node.setAttribute('aria-label', title); node.title = title;
        const key = ['ShieldElement', 'ArrowElement', 'TollLogoElement', 'IconElement'].includes(kind) ? kind + JSON.stringify(element) : kind;
        if (visualKeys.get(node) !== key) {
          node.querySelector('.mobileBlockVisual')?.remove();
          node.prepend(makeVisual(element, kind, bridge().getCurrentPanel()));
          visualKeys.set(node, key);
        }
      });
      if (mode) {
        editor.dataset.jiggle = mode;
        allNodes().forEach(checkbox);
        const count = mode === 'subpanels' ? Array.from(selected).filter(ref => typeof ref === 'string' || currentSign.subPanels.includes(ref)).length
          : selectionPayload(currentControl, selected).selectedBlockCount;
        const text = count ? `${count} selected` : mode === 'subpanels' ? 'Select subpanels' : 'Select elements or rows';
        if (label.textContent !== text) label.textContent = text;
        toolbar.hidden = false; actions.hidden = count === 0;
        toolbar.querySelector('[data-jiggle-action="copy"]').hidden = mode === 'subpanels';
      }
      document.querySelectorAll('#sMSPTextList .sMControlRow').forEach(fitRowLabels);
    } finally { refreshing = false; }
  };
  const perform = action => {
    if (!mode || !selected.size) return;
    const api = bridge(), currentControl = control(), currentSign = sign();
    if (action === 'copy') {
      const result = api.copySubpanelClipboard(selectionPayload(currentControl, selected, api.vars));
      if (result?.copied) { formHandler.updateForm(); label.textContent = `${result.copiedBlockCount} copied`; }
      return;
    }
    document.activeElement?.blur?.();
    const selectedSubpanel = currentSign.subPanels[api.vars.currentlySelectedSubPanelIndex];
    api.beginUndoableChange();
    try {
      if (mode === 'blocks') editBlocks(currentControl, selected, action, () => {
        const element = new ControlTextElement(); element.textContent = ''; return element;
      });
      else editSubpanels(currentSign, selected, action, source => {
        const subpanel = new SubPanels({}); subpanel.blockElements = source.clone(); return subpanel;
      });
      selected.clear();
      if (mode === 'subpanels') api.changeEditingSubPanel(Math.max(0, currentSign.subPanels.indexOf(selectedSubpanel)));
      else api.setSelectedRowAndBlock(0, 0);
      formHandler.updateForm(); api.redraw();
    } finally { api.endUndoableChange(); }
    refresh();
  };
  const nodeAt = target => {
    const tab = target.closest('#subPanelList .subPanelTabGroup');
    if (tab) return { node: tab, kind: 'subpanel' };
    const block = target.closest('#sMSPTextList .textEditorBlock');
    if (block) return { node: block, kind: 'block' };
    const row = target.closest('#sMSPTextList .sMControlRow');
    return row ? { node: row, kind: 'row' } : null;
  };
  const start = event => {
    if (!active() || event.isPrimary === false || (event.button != null && event.button !== 0)) return;
    if (event.target.closest('input, select, textarea, .blockTypeInlinePicker, .mergeEditGroup, .sMControlRowPasteButton, #mobileJiggleToolbar')) return;
    const item = nodeAt(event.target);
    if (!item) return;
    event.stopImmediatePropagation(); cancelGesture();
    const state = gesture = { ...item, id: event.pointerId, pointerType: event.pointerType,
      x: event.clientX, y: event.clientY, held: false, moved: false, destination: null };
    state.timer = window.setTimeout(() => {
      if (gesture !== state || !state.node.isConnected) return;
      if (!mode || (mode === 'subpanels') !== (state.kind === 'subpanel')) enter(state.kind);
      state.held = true;
      state.node.classList.add('mobileEditorDragging');
    }, mode ? 180 : 420);
  };
  const move = event => {
    const state = gesture;
    if (!state || event.pointerId !== state.id) return;
    const dx = event.clientX - state.x, dy = event.clientY - state.y;
    if (!state.held) { if (Math.hypot(dx, dy) > 10) { ignoreClickUntil = Date.now() + 500; cancelGesture(); } return; }
    event.preventDefault();
    if (Math.hypot(dx, dy) <= 8 && !state.moved) return;
    state.moved = true;
    state.node.style.setProperty('--mobile-editor-drag-x', `${state.kind === 'row' ? 0 : dx}px`);
    state.node.style.setProperty('--mobile-editor-drag-y', `${state.kind === 'subpanel' ? 0 : dy}px`);
    let target, before;
    if (state.kind === 'subpanel') {
      if (Number(state.node.dataset.subpanelIndex) < 0) return;
      const tabs = Array.from(document.querySelectorAll('#subPanelList .subPanelTabGroup')).filter(node => node !== state.node && Number(node.dataset.subpanelIndex) >= 0);
      target = tabs.find(node => event.clientX < (node.getBoundingClientRect().left + node.getBoundingClientRect().right) / 2) || tabs.at(-1);
      if (target) {
        before = event.clientX < (target.getBoundingClientRect().left + target.getBoundingClientRect().right) / 2;
        state.destination = [Number(target.dataset.subpanelIndex) + (before ? 0 : 1)];
      }
    } else {
      const rows = Array.from(document.querySelectorAll('#sMSPTextList .sMControlRow')).filter(node => state.kind !== 'row' || node !== state.node);
      const row = rows.find(node => event.clientY < node.getBoundingClientRect().bottom) || rows.at(-1);
      if (!row) return;
      if (state.kind === 'row') {
        target = row; before = event.clientY < (row.getBoundingClientRect().top + row.getBoundingClientRect().bottom) / 2;
        state.destination = [Number(row.dataset.dataRow) + (before ? 0 : 1)];
      } else {
        const blocks = Array.from(row.querySelectorAll('.textEditorBlock')).filter(node => node !== state.node);
        target = blocks.find(node => event.clientX < (node.getBoundingClientRect().left + node.getBoundingClientRect().right) / 2) || blocks.at(-1);
        if (target) {
          before = event.clientX < (target.getBoundingClientRect().left + target.getBoundingClientRect().right) / 2;
          state.destination = [Number(row.dataset.dataRow), Number(target.dataset.block) + (before ? 0 : 1)];
        }
      }
    }
    document.querySelectorAll('.mobileEditorDropBefore, .mobileEditorDropAfter').forEach(node => node.classList.remove('mobileEditorDropBefore', 'mobileEditorDropAfter'));
    if (target !== state.node) target?.classList.add(before ? 'mobileEditorDropBefore' : 'mobileEditorDropAfter');
    if (event.clientY < 90) window.scrollBy(0, -12);
    else if (event.clientY > window.innerHeight - 110) window.scrollBy(0, 12);
  };
  const finish = cancelled => {
    const state = gesture;
    if (!state) return;
    if (state.held || state.moved) ignoreClickUntil = Date.now() + 600;
    const destination = state.destination;
    cancelGesture();
    if (cancelled || !state.moved || !destination) return;
    selected.clear();
    if (state.kind === 'subpanel') bridge().moveSubPanel(Number(state.node.dataset.subpanelIndex), ...destination);
    else if (state.kind === 'row') bridge().moveRow(Number(state.node.dataset.dataRow), ...destination);
    else bridge().moveControlElem(Number(state.node.dataset.row), Number(state.node.dataset.block), ...destination);
    refresh();
  };
  const init = () => {
    if (initialized) return;
    editor = document.getElementById('mobileEditor');
    if (!editor) return;
    initialized = true;
    toolbar = document.createElement('div'); toolbar.id = 'mobileJiggleToolbar'; toolbar.hidden = true;
    label = document.createElement('span'); label.setAttribute('role', 'status');
    actions = document.createElement('div'); actions.className = 'mobileJiggleActions';
    for (const action of ['delete', 'duplicate', 'copy']) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.jiggleAction = action;
      button.textContent = action[0].toUpperCase() + action.slice(1);
      button.addEventListener('click', () => perform(action)); actions.append(button);
    }
    const done = document.createElement('button'); done.type = 'button'; done.textContent = 'Done'; done.addEventListener('click', exit);
    toolbar.append(label, done, actions); editor.querySelector('.mobileEditorHeader').after(toolbar);
    const observer = new MutationObserver(refresh);
    for (const id of ['sMSPTextList', 'subPanelList']) {
      const node = document.getElementById(id); if (node) observer.observe(node, { childList: true });
    }
    observer.observe(document.getElementById('sMConfigBar'), { attributes: true, attributeFilter: ['data-current-menu'] });
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(refresh).observe(document.getElementById('sMSPTextList'));
    window.addEventListener('resize', refresh);
    document.fonts?.ready?.then(refresh);
    document.addEventListener('pointerdown', start, true);
    document.addEventListener('pointermove', move, { capture: true, passive: false });
    document.addEventListener('pointerup', event => { if (event.pointerId === gesture?.id) finish(false); }, true);
    document.addEventListener('pointercancel', event => {
      if (event.pointerId === gesture?.id && !(gesture.held && gesture.pointerType === 'touch')) finish(true);
    }, true);
    document.addEventListener('touchmove', event => {
      if (!gesture?.held) return;
      if (event.cancelable) event.preventDefault();
      const touch = event.touches[0];
      if (touch) move({ pointerId: gesture.id, clientX: touch.clientX, clientY: touch.clientY, preventDefault() {} });
    }, { capture: true, passive: false });
    document.addEventListener('touchend', event => { if (gesture?.pointerType === 'touch' && !event.touches.length) finish(false); }, true);
    document.addEventListener('touchcancel', () => finish(true), true);
    document.addEventListener('click', event => {
      if (!active()) return;
      const item = nodeAt(event.target); if (!item) return;
      if (Date.now() < ignoreClickUntil && !event.target.classList.contains('mobileJiggleCheck')) { stop(event); return; }
      if (!mode) return;
      if (event.target.classList.contains('mobileJiggleCheck')) { event.stopImmediatePropagation(); return; }
      if ((mode === 'subpanels') !== (item.kind === 'subpanel')) { exit(); return; }
      stop(event); toggle(item.node);
    }, true);
    for (const name of ['dragstart', 'contextmenu']) document.addEventListener(name, event => {
      if (active() && nodeAt(event.target)) stop(event);
    }, true);
    document.addEventListener('keydown', event => { if (mode && event.key === 'Escape') { stop(event); exit(); } }, true);
    window.addEventListener('blur', () => finish(true));
  };
  return { init, refresh, exit, perform, enter, selectionPayload, editBlocks, editSubpanels, makeVisual, chooseLabels, get mode() { return mode; } };
})();
