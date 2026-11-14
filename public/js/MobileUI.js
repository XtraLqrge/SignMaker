/* The phone workspace reuses the editors and leaves the sign document intact. */
window.SignMakerMobile = (() => {
  const query = '(max-width: 900px), (pointer: coarse) and (max-width: 1280px)';
  const media = window.matchMedia(query);
  const titles = {
    panelSelector: 'Panels', panelStyleConfig: 'Panel style', exitTabConfig: 'Exit tabs',
    subPanelConfig: 'Subpanels', guideArrowConfig: 'Guide arrows', postStyleConfig: 'Post style',
    templates: 'Templates', appSettingsConfig: 'Settings', mobileMore: 'More',
  };
  let active = null, initialized = false, frame = 0, exporting = false, readyObserver;
  let workspace, canvas, bar, editor, editorTitle, more, panelPicker, previous, next, count;
  let canvasHome, modalsHome, modals, history, pickerHome, utilityHomes = [];
  let exportPreview, exportPreviewHome;
  let resizeObserver, observedPanel, lastMenu = '', lastIndex = -1, focusOrigin = null;
  let wholePost = false, wholePostToggle, gestures;
  const getApp = () => typeof app !== 'undefined' ? app : null;
  const currentIndex = () => getApp()?.exposeToFormHandler.vars.currentlySelectedPanelIndex ?? 0;

  const wantsMobileWorkspace = () => {
    if (new URLSearchParams(window.location.search).get('mobile') === '1') return true;
    const widths = [window.innerWidth, document.documentElement.clientWidth, window.visualViewport?.width]
      .filter(value => Number.isFinite(value) && value > 0);
    const touchScreen = window.navigator?.maxTouchPoints > 0 && window.screen?.width > 0 && window.screen.width <= 900;
    return media.matches || (widths.length > 0 && Math.min(...widths) <= 900) || touchScreen;
  };

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
    wholePost = false;
    closeEditor();
    getApp().changeEditingPanel(index, { suppressFlash: true });
    window.scrollTo({ top: 0, behavior: 'auto' });
    schedule();
  };
  const selectPanel = index => {
    const panel = getApp()?.getPost()?.panels[index];
    if (!panel) return;
    wholePost = false;
    if (panel.hiddenFromPost) getApp().togglePanelHidden(index);
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
    const wholePostLabel = document.createElement('label');
    wholePostLabel.className = 'mobileWholePostOption';
    wholePostToggle = document.createElement('input');
    wholePostToggle.type = 'checkbox';
    wholePostToggle.id = 'mobileShowWholePost';
    wholePostToggle.addEventListener('change', () => {
      wholePost = wholePostToggle.checked;
      gestures?.cancel();
      closeEditor();
      window.scrollTo({ top: 0, behavior: 'auto' });
      schedule();
    });
    const wholePostText = document.createElement('span');
    wholePostText.textContent = 'Show entire post';
    wholePostLabel.append(wholePostText, wholePostToggle);
    panelPicker.prepend(wholePostLabel);
    const reorderHint = document.createElement('p');
    reorderHint.className = 'mobilePanelReorderHint';
    reorderHint.textContent = 'Hold a panel box to reorder it.';
    wholePostLabel.after(reorderHint);
    history = bar.querySelector('.historyBar');
    canvasHome = markHome(canvas);
    modalsHome = markHome(modals);
    pickerHome = markHome(panelPicker);
    exportPreview = document.getElementById('downloadPreview');
    if (exportPreview) exportPreviewHome = markHome(exportPreview);
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
    gestures = window.SignMakerMobileGestures?.install({ canvas, getApp, isActive: () => active,
      isWholePost: () => wholePost, selectPanel });
    document.addEventListener('keydown', event => {
      if (active && event.key === 'Escape' && bar.dataset.currentMenu === 'mobileMore') closeEditor();
    });
    document.getElementById('copySign').addEventListener('click', event => {
      if (!active) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      gestures?.cancel();
      getApp()?.copySignToClipboard(wholePost ? undefined : getApp().getMobileExportPanelIndex());
    }, true);
    document.getElementById('export').addEventListener('click', () => {
      if (active) {
        gestures?.cancel();
        getApp()?.prepareMobilePanelExport();
      }
    }, true);
    new MutationObserver(schedule).observe(bar, { attributes: true, attributeFilter: ['data-current-menu'] });
    new MutationObserver(schedule).observe(document.getElementById('panelContainer'), { childList: true, subtree: true });
    resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(workspace);
    window.SignMakerMobileSubpanels?.init();
  };

  const prepareEditor = menu => {
    if (!active) return;
    editor.dataset.menu = menu || '';
    editor.hidden = !menu;
    modals.hidden = menu === 'mobileMore';
    window.SignMakerMobileExitTabs?.sync();
    window.SignMakerMobileForms?.refresh();
    window.SignMakerMobileSubpanels?.refresh();
  };

  const mountPanelPicker = node => {
    if (active && node && node.parentElement !== editor) editor.append(node);
    return node;
  };
  const fitPreview = panel => {
    if (!panel || exporting) return;
    const post = document.getElementById('postContainer');
    let height = panel.offsetHeight, width = panel.offsetWidth;
    let minX = 0, minY = 0;
    if (wholePost) {
      const rect = post.getBoundingClientRect();
      const scale = post.offsetWidth > 0 && rect.width > 0 ? rect.width / post.offsetWidth : 1;
      width = post.offsetWidth;
      height = post.offsetHeight;
      for (const node of post.querySelectorAll('.panel:not(.panelHiddenFromPost), .post, .fdotSupport')) {
        const bounds = node.getBoundingClientRect();
        if (!bounds.width || !bounds.height) continue;
        const left = (bounds.left - rect.left) / scale, top = (bounds.top - rect.top) / scale;
        minX = Math.min(minX, left);
        minY = Math.min(minY, top);
        width = Math.max(width, left + bounds.width / scale);
        height = Math.max(height, top + bounds.height / scale);
      }
      width -= minX;
      height -= minY;
    }
    const metrics = previewMetrics(width, height, canvas.clientWidth - 24,
      Math.max(40, Math.min((window.innerHeight || 700) * (editor.hidden ? 0.45 : 0.28),
        workspace.clientHeight - bar.offsetHeight - 240)));
    const scaleValue = String(metrics.scale);
    const heightValue = `${metrics.height}px`;
    if (post.style.getPropertyValue('--mobile-sign-scale') !== scaleValue) post.style.setProperty('--mobile-sign-scale', scaleValue);
    post.style.setProperty('--mobile-post-width', `${width * metrics.scale}px`);
    post.style.setProperty('--mobile-post-x', `${-minX}px`);
    post.style.setProperty('--mobile-post-y', `${-minY}px`);
    if (canvas.style.height !== heightValue) canvas.style.height = heightValue;
  };
  const sync = () => {
    frame = 0;
    if (!active || exporting) return;
    canvas.classList.toggle('mobileWholePost', wholePost);
    wholePostToggle.checked = wholePost;
    workspace.querySelector('.mobileTapHint').textContent = wholePost
      ? 'Tap a panel to edit it. Hold a panel until it shakes, then drag left or right to reorder.'
      : 'Tap text, an exit tab, or an arrow to edit it.';
    const index = currentIndex();
    const panels = Array.from(document.querySelectorAll('#panelContainer .panel'));
    let selected = null;
    for (const panel of panels) {
      const current = Number(panel.dataset.panelIndex) === index;
      panel.classList.toggle('mobileCurrentPanel', current);
      panel.inert = !wholePost && !current;
      if (current || wholePost) {
        panel.removeAttribute('aria-hidden');
        if (current) selected = panel;
      } else panel.setAttribute('aria-hidden', 'true');
    }
    const measuredNode = wholePost ? document.getElementById('postContainer') : selected;
    if (observedPanel !== measuredNode) {
      if (observedPanel) resizeObserver.unobserve(observedPanel);
      observedPanel = measuredNode;
      if (observedPanel) resizeObserver.observe(observedPanel);
    }
    const length = getApp()?.getPost()?.panels.length || 0;
    const countLabel = wholePost ? 'Entire post' : length ? `Panel ${index + 1} of ${length}` : 'No panels';
    if (count.textContent !== countLabel) count.textContent = countLabel;
    previous.disabled = wholePost || index <= 0;
    next.disabled = wholePost || index >= length - 1;
    const menu = bar.dataset.currentMenu || '';
    editor.dataset.menu = menu;
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
    gestures?.cancel();
    active = enabled;
    document.documentElement.toggleAttribute('data-mobile-ui', active);
    window.SignMakerMobileExitTabs?.setActive(active);
    window.SignMakerMobileForms?.setActive(active);
    workspace.hidden = !active;
    if (active) {
      workspace.insertBefore(canvas, workspace.querySelector('.mobileTapHint'));
      canvas.classList.add('mobileCanvas');
      editor.append(modals);
      mountPanelPicker(panelPicker);
      workspace.querySelector('.mobileHeader').append(history);
      for (const [, node] of utilityHomes) if (node !== history) more.append(node);
      workspace.querySelector('.mobileHeader').prepend(document.getElementById('copySign'), document.getElementById('export'));
      document.querySelector('#downloadContents .downloadActionButtons')?.before(exportPreview);
      bar.classList.remove('invisible');
    } else {
      canvas.classList.remove('mobileCanvas');
      canvas.style.removeProperty('height');
      restore(canvasHome, canvas);
      restore(modalsHome, modals);
      modals.hidden = false;
      restore(pickerHome, panelPicker);
      if (exportPreview) restore(exportPreviewHome, exportPreview);
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
    createWorkspace();
    initialized = true;
    const update = () => {
      setActive(wantsMobileWorkspace());
      schedule();
    };
    media.addEventListener('change', update);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    document.fonts?.ready.then(schedule);
    update();
  };
  const connect = () => {
    const ready = () => {
      if (document.documentElement.dataset.appReady !== 'true') return;
      init();
      readyObserver?.disconnect();
      readyObserver = null;
    };
    if (document.documentElement.dataset.appReady === 'true') {
      ready();
      return;
    }
    readyObserver = new MutationObserver(ready);
    readyObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-app-ready'] });
  };
  return { init, connect, get active() { return active; }, get showingWholePost() { return active && wholePost; },
    schedule, prepareEditor, mountPanelPicker, withFullLayout, previewMetrics, wantsMobileWorkspace };
})();
window.SignMakerMobile.connect();
