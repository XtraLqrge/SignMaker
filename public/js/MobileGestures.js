/* Touch gestures distinguish scrolling, slider adjustment, and panel movement. */
window.SignMakerMobileGestures = (() => {
  const holdDelay = 420;
  const groupStart = (panels, index) => {
    while (index > 0 && panels[index]?.stackedWithPrevious === true) index--;
    return index;
  };
  const groupEnd = (panels, index) => {
    index = groupStart(panels, index) + 1;
    while (index < panels.length && panels[index]?.stackedWithPrevious === true) index++;
    return index;
  };
  const rangeValue = (input, initial, delta, width) => {
    const min = Number(input.min || 0), max = Number(input.max || 100);
    const step = input.step === 'any' ? 0 : Number(input.step || 1);
    let value = initial + delta / Math.max(1, width - 24) * (max - min);
    if (step > 0) value = min + Math.round((value - min) / step) * step;
    return String(Number(Math.max(min, Math.min(max, value)).toFixed(10)));
  };
  const install = ({ canvas, getApp, isActive, isWholePost, selectPanel }) => {
    let gesture = null, suppressClickUntil = 0;
    const models = () => getApp()?.getPost()?.panels || [];
    const stopClick = event => { event.preventDefault(); event.stopImmediatePropagation(); };
    const clear = (cancelled = false) => {
      const state = gesture;
      if (!state) return;
      gesture = null;
      window.clearTimeout(state.timer);
      if (state.kind === 'range') {
        if (state.changed) state.node.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        document.querySelectorAll('.mobilePanelWiggle, .mobilePanelMoving, .mobileDropBefore, .mobileDropAfter')
          .forEach(node => node.classList.remove('mobilePanelWiggle', 'mobilePanelMoving', 'mobileDropBefore', 'mobileDropAfter'));
        state.node.style.removeProperty('--mobile-drag-x');
        state.node.style.removeProperty('--mobile-drag-y');
        document.documentElement.classList.remove('mobilePanelDragActive');
        if (state.held || state.moved) suppressClickUntil = Date.now() + 600;
        if (!cancelled && state.held && state.moved && state.dropIndex != null) {
          getApp()?.movePanel(state.index, state.dropIndex);
          window.SignMakerMobile?.schedule();
        }
      }
    };
    const candidates = state => {
      const panels = models(), from = groupStart(panels, state.index);
      return Array.from(document.querySelectorAll(state.kind === 'list' ? '.panelListButton' : '#panelContainer .panel'))
        .filter(node => {
          const index = Number(node.dataset.panelIndex);
          return Number.isInteger(index) && !panels[index]?.hiddenFromPost && groupStart(panels, index) !== from;
        });
    };
    const start = event => {
      if (!isActive() || event.isPrimary === false || (event.button != null && event.button !== 0)) return;
      const range = event.target.closest('input[type="range"]');
      if (range && event.pointerType === 'touch' && !range.disabled) {
        clear(true);
        // Cancelling a pointer default prevents the range jump, while pan-y still permits page scrolling.
        event.preventDefault();
        gesture = { kind: 'range', node: range, id: event.pointerId, x: event.clientX, y: event.clientY,
          initial: Number(range.value), width: range.getBoundingClientRect().width, editing: false, changed: false };
        return;
      }
      const list = event.target.closest('.panelListButton');
      const panel = canvas.contains(event.target) ? event.target.closest('.panel') : null;
      if (panel) event.stopImmediatePropagation();
      if (!list && !(panel && isWholePost())) return;
      const node = list || panel, index = Number(node.dataset.panelIndex);
      if (!Number.isInteger(index) || models()[index]?.hiddenFromPost) return;
      clear(true);
      const state = gesture = { kind: list ? 'list' : 'post', node, index, id: event.pointerId,
        pointerType: event.pointerType, x: event.clientX, y: event.clientY, held: false, moved: false, dropIndex: null };
      state.timer = window.setTimeout(() => {
        if (gesture !== state || !isActive()) return;
        state.held = true;
        state.scale = state.node.offsetWidth > 0 ? state.node.getBoundingClientRect().width / state.node.offsetWidth : 1;
        node.classList.add('mobilePanelMoving');
        document.querySelectorAll(list ? '.panelListButton' : '#panelContainer .panel')
          .forEach(item => item.classList.add('mobilePanelWiggle'));
        document.documentElement.classList.add('mobilePanelDragActive');
        window.navigator?.vibrate?.(20);
      }, holdDelay);
    };
    const move = event => {
      const state = gesture;
      if (!state || event.pointerId !== state.id) return;
      if (!isActive() || !state.node.isConnected) { clear(true); return; }
      const dx = event.clientX - state.x, dy = event.clientY - state.y;
      if (state.kind === 'range') {
        if (!state.editing) {
          if (Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) { clear(true); return; }
          if (Math.abs(dx) < 9 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;
          state.editing = true;
        }
        event.preventDefault();
        const rtl = window.getComputedStyle(state.node).direction === 'rtl';
        const value = rangeValue(state.node, state.initial, rtl ? -dx : dx, state.width);
        if (value !== state.node.value) {
          state.node.value = value;
          state.changed = true;
          state.node.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }
      if (!state.held) {
        if (Math.hypot(dx, dy) > 10) { suppressClickUntil = Date.now() + 600; clear(true); }
        return;
      }
      event.preventDefault();
      state.moved ||= Math.abs(state.kind === 'list' ? dy : dx) > 10;
      if (!state.moved) return;
      state.node.style.setProperty('--mobile-drag-x', `${state.kind === 'post' ? dx / state.scale : 0}px`);
      state.node.style.setProperty('--mobile-drag-y', `${state.kind === 'list' ? dy : 0}px`);
      const panels = models(), targets = candidates(state), horizontal = state.kind === 'post';
      // Several rendered panels may share a stack. A stack moves as one group.
      const groups = new Map();
      for (const node of targets) {
        const index = groupStart(panels, Number(node.dataset.panelIndex));
        const rect = node.getBoundingClientRect(), current = groups.get(index);
        const low = horizontal ? rect.left : rect.top, high = horizontal ? rect.right : rect.bottom;
        groups.set(index, { node: current?.node || node, low: Math.min(low, current?.low ?? low), high: Math.max(high, current?.high ?? high) });
      }
      let target = null;
      const position = horizontal ? event.clientX : event.clientY;
      state.dropIndex = groupStart(panels, state.index);
      for (const [index, bounds] of groups) {
        target = { node: bounds.node, after: position >= (bounds.low + bounds.high) / 2 };
        state.dropIndex = target.after ? groupEnd(panels, index) : index;
        if (!target.after) break;
      }
      document.querySelectorAll('.mobileDropBefore, .mobileDropAfter')
        .forEach(node => node.classList.remove('mobileDropBefore', 'mobileDropAfter'));
      target?.node.classList.add(target.after ? 'mobileDropAfter' : 'mobileDropBefore');
      if (!horizontal) {
        if (event.clientY < 85) window.scrollBy(0, -14);
        else if (event.clientY > window.innerHeight - 110) window.scrollBy(0, 14);
      }
    };
    document.addEventListener('pointerdown', start, true);
    document.addEventListener('pointermove', move, { capture: true, passive: false });
    document.addEventListener('pointerup', event => { if (gesture?.id === event.pointerId) clear(); }, true);
    document.addEventListener('pointercancel', event => {
      if (gesture?.id !== event.pointerId) return;
      // Touch events continue a held list drag if a browser cancels its pointer stream for pan-y.
      if (gesture.kind === 'list' && gesture.held && gesture.pointerType === 'touch') return;
      clear(true);
    }, true);
    // A held list item can move vertically; ordinary vertical swipes remain native scrolling.
    document.addEventListener('touchmove', event => {
      if (gesture?.held && event.cancelable) event.preventDefault();
      if (gesture?.held && gesture.kind === 'list' && event.touches?.length === 1) {
        const touch = event.touches[0];
        move({ pointerId: gesture.id, clientX: touch.clientX, clientY: touch.clientY,
          preventDefault: () => { if (event.cancelable) event.preventDefault(); } });
      }
    }, { capture: true, passive: false });
    document.addEventListener('touchend', event => {
      if (gesture?.pointerType === 'touch' && !event.touches.length) clear();
    }, true);
    document.addEventListener('touchcancel', () => clear(true), true);
    document.addEventListener('click', event => {
      if (!isActive()) return;
      const list = event.target.closest('.panelListButton');
      const panel = canvas.contains(event.target) ? event.target.closest('.panel') : null;
      if ((panel || list) && Date.now() < suppressClickUntil) { stopClick(event); return; }
      if ((panel && isWholePost()) || list) {
        stopClick(event);
        selectPanel(Number((list || panel).dataset.panelIndex));
      }
    }, true);
    document.addEventListener('dragstart', event => {
      if (isActive() && (canvas.contains(event.target) || event.target.closest('.panelListButton'))) stopClick(event);
    }, true);
    document.addEventListener('contextmenu', event => {
      if (isActive() && (event.target.closest('.panelListButton') || (isWholePost() && canvas.contains(event.target)))) stopClick(event);
    }, true);
    window.addEventListener('blur', () => clear(true));
    return { cancel: () => clear(true) };
  };
  return { install, rangeValue, groupStart, groupEnd };
})();
