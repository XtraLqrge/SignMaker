/* The phone workspace reuses the editors and leaves the sign document intact. */
window.SignMakerMobile = (() => {
  const query = '(max-width: 900px), (pointer: coarse) and (max-width: 1280px)';
  const media = window.matchMedia(query);
  const titles = {
    panelSelector: 'Panels', panelStyleConfig: 'Panel style', exitTabConfig: 'Exit tabs',
    subPanelConfig: 'Subpanels', guideArrowConfig: 'Guide arrows', postStyleConfig: 'Post style',
    templates: 'Templates', appSettingsConfig: 'Settings', mobileMore: 'More',
  };
  let active = null, initialized = false, frame = 0, exporting = false;
  let workspace, canvas, bar, editor, editorTitle, more, panelPicker, previous, next, count;
  let canvasHome, modalsHome, modals, history, pickerHome, utilityHomes = [];
  let resizeObserver, observedPanel, lastMenu = '', lastIndex = -1, focusOrigin = null;
  const getApp = () => typeof app !== 'undefined' ? app : null;
  const currentIndex = () => getApp()?.exposeToFormHandler.vars.currentlySelectedPanelIndex ?? 0;

  const previewMetrics = (width, height, availableWidth, availableHeight) => {
    if (![width, height, availableWidth, availableHeight].every(value => Number.isFinite(value) && value > 0)) {
      return { scale: 1, height: 180 };
    }
    const scale = Math.min(1, availableWidth / width, availableHeight / height);
    return { scale, height: Math.max(180, Math.ceil(height * scale + 40)) };
  };
  const button = (label, icon, onClick) => {
    const node = document.createElement('button');
    node.type = 'button';
    node.setAttribute('aria-label', label);
    node.title = label;
    const glyph = document.createElement('span');
    glyph.className = 'material-symbols-outlined';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = icon;
    node.append(glyph);
    node.addEventListener('click', onClick);
    return node;
  };
  const markHome = node => {
    const marker = document.createComment('desktop position');
    node.before(marker);
    return marker;
  };
  const restore = (marker, node) => marker?.after(node);
  const triggerFor = menu => menu === 'panelSelector'
    ? document.getElementById('panelSelector') : document.getElementById(menu);

  const closeEditor = ({ returnFocus = false } = {}) => {
    const menu = bar.dataset.currentMenu;
    if (menu === 'mobileMore') bar.dataset.currentMenu = '';
    else if (menu) triggerFor(menu)?.click();
    if (returnFocus) (focusOrigin?.isConnected ? focusOrigin : document.getElementById('mobileMore'))?.focus();
    schedule();
  };
  const toggleMore = () => {
    if (bar.dataset.currentMenu === 'mobileMore') closeEditor();
    else {
      closeEditor();
      bar.dataset.currentMenu = 'mobileMore';
      schedule();
    }
  };
  const changePanel = delta => {
    const panels = getApp()?.getPost()?.panels || [];
    const index = Math.max(0, Math.min(panels.length - 1, currentIndex() + delta));
    if (index === currentIndex()) return;
    closeEditor();
    getApp().changeEditingPanel(index, { suppressFlash: true });
    window.scrollTo({ top: 0, behavior: 'auto' });
    schedule();
  };

  const createWorkspace = () => {
    const form = document.forms.signMaker;
    canvas = document.querySelector('main');
    bar = document.getElementById('sMConfigBar');
    modals = form.querySelector('.modals');
    panelPicker = document.getElementById('panelSelect');
    history = bar.querySelector('.historyBar');
    canvasHome = markHome(canvas);
    modalsHome = markHome(modals);
    pickerHome = markHome(panelPicker);
    workspace = document.createElement('div');
    workspace.id = 'mobileWorkspace';
    workspace.hidden = true;

    const header = document.createElement('header');
    header.className = 'mobileHeader';
    const historyHome = markHome(history);
    utilityHomes.push([historyHome, history]);
    header.append(history);
    workspace.append(header);

    const navigator = document.createElement('nav');
    navigator.className = 'mobilePanelNavigation';
    navigator.setAttribute('aria-label', 'Current panel');
    previous = button('Previous panel', 'chevron_left', () => changePanel(-1));
    next = button('Next panel', 'chevron_right', () => changePanel(1));
    count = document.createElement('span');
    count.setAttribute('aria-live', 'polite');
    const add = button('Add panel', 'add', () => {
      closeEditor();
      getApp()?.newPanel();
      schedule();
    });
    navigator.append(previous, count, next, add);
    workspace.append(navigator);

    const hint = document.createElement('p');
    hint.className = 'mobileTapHint';
    hint.textContent = 'Tap text, an exit tab, or an arrow to edit it.';
    editor = document.createElement('section');
    editor.id = 'mobileEditor';
    editor.setAttribute('aria-labelledby', 'mobileEditorTitle');
    editor.hidden = true;
    const editorHeader = document.createElement('div');
    editorHeader.className = 'mobileEditorHeader';
    editorTitle = document.createElement('h2');
    editorTitle.id = 'mobileEditorTitle';
    const done = button('Done', 'check', () => closeEditor({ returnFocus: true }));
    editorHeader.append(editorTitle, done);
    more = document.createElement('div');
    more.id = 'mobileMoreActions';
    more.hidden = true;
    for (const id of ['export', 'importJSON', 'copySign', 'templates', 'postStyleConfig', 'nightMode', 'appSettingsConfig']) {
      const node = document.getElementById(id);
      utilityHomes.push([markHome(node), node]);
      more.append(node);
    }
    editor.append(editorHeader, more);
    workspace.append(canvas, hint, editor);
    form.prepend(workspace);

    const moreButton = button('More', 'menu_open', toggleMore);
    moreButton.id = 'mobileMore';
    moreButton.className = 'sMConfigOption';
    const label = document.createElement('span');
    label.textContent = 'More';
    moreButton.append(label);
    bar.append(moreButton);
    bar.setAttribute('aria-label', 'Sign editing tools');
    for (const node of document.querySelectorAll('.sMConfigOption')) {
      if (node.tagName !== 'DIV') continue;
      node.setAttribute('role', 'button');
      node.tabIndex = 0;
      node.addEventListener('keydown', event => {
        if (!active || !['Enter', ' '].includes(event.key) || event.target !== node) return;
        event.preventDefault();
        (node.querySelector('#panelSelector') || node).click();
      });
    }

    const primaryLabels = { panelStyleConfig: 'Style', exitTabConfig: 'Exit tabs', subPanelConfig: 'Blocks', guideArrowConfig: 'Arrows' };
    for (const [id, text] of Object.entries(primaryLabels)) {
      const node = document.getElementById(id);
      const label = node.querySelector('span:not(.material-symbols-outlined)');
      label.dataset.desktopLabel = label.textContent;
      label.dataset.mobileLabel = text;
    }
    workspace.addEventListener('click', event => {
      if (event.target.closest('#mobileMoreActions .sMConfigOption')) schedule();
    });
    bar.addEventListener('click', event => {
      const trigger = event.target.closest('.sMConfigOption');
      if (active && trigger) focusOrigin = trigger.id ? trigger : document.getElementById('panelSelector').parentElement;
    }, true);
    // Canvas gestures select content; they never start the desktop drag tools.
    document.addEventListener('pointerdown', event => {
      if (active && canvas.contains(event.target)) event.stopImmediatePropagation();
    }, true);
    document.addEventListener('dragstart', event => {
      if (active && canvas.contains(event.target)) event.preventDefault();
    }, true);
    document.addEventListener('keydown', event => {
      if (active && event.key === 'Escape' && bar.dataset.currentMenu === 'mobileMore') closeEditor();
    });
    document.getElementById('copySign').addEventListener('click', event => {
      if (!active) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      getApp()?.copySignToClipboard(getApp().getMobileExportPanelIndex());
    }, true);
    document.getElementById('export').addEventListener('click', () => {
      if (active) getApp()?.prepareMobilePanelExport();
    }, true);
    new MutationObserver(schedule).observe(bar, { attributes: true, attributeFilter: ['data-current-menu'] });
    new MutationObserver(schedule).observe(document.getElementById('panelContainer'), { childList: true, subtree: true });
    resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(workspace);
  };

  const mountPanelPicker = node => {
    if (active && node && node.parentElement !== editor) editor.append(node);
    return node;
  };
  const fitPreview = panel => {
    if (!panel || exporting) return;
    const post = document.getElementById('postContainer');
    const height = panel.offsetHeight;
    const width = panel.offsetWidth;
    const metrics = previewMetrics(width, height, canvas.clientWidth - 24,
      Math.max(40, Math.min((window.innerHeight || 700) * (editor.hidden ? 0.45 : 0.28),
        workspace.clientHeight - bar.offsetHeight - 240)));
    const scaleValue = String(metrics.scale);
    const heightValue = `${metrics.height}px`;
    if (post.style.getPropertyValue('--mobile-sign-scale') !== scaleValue) post.style.setProperty('--mobile-sign-scale', scaleValue);
    if (canvas.style.height !== heightValue) canvas.style.height = heightValue;
  };
  const sync = () => {
    frame = 0;
    if (!active || exporting) return;
    const index = currentIndex();
    const panels = Array.from(document.querySelectorAll('#panelContainer .panel'));
    let selected = null;
    for (const panel of panels) {
      const current = Number(panel.dataset.panelIndex) === index;
      panel.classList.toggle('mobileCurrentPanel', current);
      panel.inert = !current;
      if (current) {
        panel.removeAttribute('aria-hidden');
        selected = panel;
      } else panel.setAttribute('aria-hidden', 'true');
    }
    if (observedPanel !== selected) {
      if (observedPanel) resizeObserver.unobserve(observedPanel);
      observedPanel = selected;
      if (selected) resizeObserver.observe(selected);
    }
    const length = getApp()?.getPost()?.panels.length || 0;
    const countLabel = length ? `Panel ${index + 1} of ${length}` : 'No panels';
    if (count.textContent !== countLabel) count.textContent = countLabel;
    previous.disabled = index <= 0;
    next.disabled = index >= length - 1;
    const menu = bar.dataset.currentMenu || '';
    const changed = menu !== lastMenu || index !== lastIndex;
    editor.hidden = !menu;
    more.hidden = menu !== 'mobileMore';
    document.getElementById('mobileMore').classList.toggle('selected', menu === 'mobileMore');
    editorTitle.textContent = titles[menu] || 'Edit sign';
    if (menu === 'panelSelector') mountPanelPicker(panelPicker);
    if (menu === 'mobileMore') {
      modals.hidden = true;
    } else modals.hidden = false;
    for (const node of bar.querySelectorAll('.sMConfigOption')) {
      node.setAttribute('aria-expanded', String(node.classList.contains('selected')));
    }
    fitPreview(selected);
    // Each tool opens at the top of its own sheet; the preview never scrolls away.
    if (changed) editor.scrollTop = 0;
    lastMenu = menu;
    lastIndex = index;
  };
  function schedule() {
    if (active && !frame && !exporting) frame = window.requestAnimationFrame(sync);
  }

  const setActive = enabled => {
    if (enabled === active) return;
    closeEditor();
    active = enabled;
    document.documentElement.toggleAttribute('data-mobile-ui', active);
    workspace.hidden = !active;
    if (active) {
      workspace.insertBefore(canvas, workspace.querySelector('.mobileTapHint'));
      canvas.classList.add('mobileCanvas');
      editor.append(modals);
      mountPanelPicker(panelPicker);
      workspace.querySelector('.mobileHeader').append(history);
      for (const [, node] of utilityHomes) if (node !== history) more.append(node);
      workspace.querySelector('.mobileHeader').prepend(document.getElementById('copySign'), document.getElementById('export'));
      bar.classList.remove('invisible');
    } else {
      canvas.classList.remove('mobileCanvas');
      canvas.style.removeProperty('height');
      restore(canvasHome, canvas);
      restore(modalsHome, modals);
      modals.hidden = false;
      restore(pickerHome, panelPicker);
      for (const [marker, node] of utilityHomes) restore(marker, node);
      document.querySelectorAll('.mobileCurrentPanel, #panelContainer .panel[inert]').forEach(node => {
        node.classList.remove('mobileCurrentPanel');
        node.inert = false;
        node.removeAttribute('aria-hidden');
      });
    }
    for (const node of document.querySelectorAll('[data-mobile-label]')) node.textContent = active ? node.dataset.mobileLabel : node.dataset.desktopLabel;
    window.dispatchEvent(new Event('resize'));
    schedule();
  };

  // Export clones use the full document layout, independent of the phone stage.
  const withFullLayout = callback => {
    if (!active || exporting) return callback();
    const post = document.getElementById('postContainer');
    const transform = post.style.transform;
    const opacity = canvas.style.opacity;
    exporting = true;
    canvas.style.opacity = '0';
    canvas.classList.remove('mobileCanvas');
    post.style.transform = 'none';
    try { return callback(); }
    finally {
      post.style.transform = transform;
      canvas.classList.add('mobileCanvas');
      canvas.style.opacity = opacity;
      exporting = false;
      schedule();
    }
  };
  const init = () => {
    if (initialized) return;
    initialized = true;
    createWorkspace();
    const update = () => setActive(new URLSearchParams(window.location.search).get('mobile') === '1' || media.matches);
    media.addEventListener('change', update);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    document.fonts?.ready.then(schedule);
    update();
  };
  return { init, get active() { return active; }, schedule, mountPanelPicker, withFullLayout, previewMetrics };
})();
