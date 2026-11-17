/* Mobile composition uses the original inputs so uploads, variants and saving
   keep the same behavior. Markers restore the desktop form without cloning it. */
window.SignMakerMobileShieldMaker = (() => {
  let active = false, dialog, body, frame, stage, observer, resizeObserver;
  let dock, actions, fields, saveIcon, originalSaveIcon;
  let homes = [];
  const byId = id => document.getElementById(id);
  const node = (tag, className) => {
    const element = document.createElement(tag);
    element.className = className;
    return element;
  };
  const move = (element, target) => {
    if (!element) return;
    const marker = document.createComment('shield maker desktop position');
    element.before(marker);
    homes.push([marker, element]);
    target.append(element);
  };
  const fit = () => {
    if (!active || !dialog.open) return;
    const viewport = window.visualViewport;
    dialog.style.setProperty('--mobile-shield-height', `${viewport?.height || window.innerHeight}px`);
    dialog.style.setProperty('--mobile-shield-top', `${viewport?.offsetTop || 0}px`);
    const width = stage.offsetWidth, height = stage.offsetHeight;
    if (!width || !height || !frame.clientWidth || !frame.clientHeight) return;
    const scale = Math.min(4.75, (frame.clientWidth - 24) / width, (frame.clientHeight - 20) / height);
    frame.style.setProperty('--customShieldPreviewScale', String(Math.max(Number.EPSILON, scale)));
  };
  const setActive = enabled => {
    if (active === enabled) return;
    dialog = byId('customShieldMaker');
    if (!dialog) return;
    active = enabled;
    if (!active) {
      observer.disconnect();
      resizeObserver?.disconnect();
      window.visualViewport?.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('scroll', fit);
      window.removeEventListener('resize', fit);
      byId('customShieldMakerPreviewImg').removeEventListener('load', fit);
      for (const button of dialog.querySelectorAll('.customShieldMakerAlignmentButton')) button.textContent = button.dataset.shieldDesktopLabel;
      for (const [marker, element] of homes) { marker.after(element); marker.remove(); }
      homes = [];
      for (const element of [dock, actions, fields]) element.remove();
      saveIcon.textContent = originalSaveIcon;
      dialog.classList.remove('mobileShieldMaker');
      dialog._syncCustomShieldMakerInputs?.();
      frame.style.removeProperty('--customShieldPreviewScale');
      dialog.style.removeProperty('--mobile-shield-height');
      dialog.style.removeProperty('--mobile-shield-top');
      return;
    }
    const shell = dialog.querySelector('.customShieldMakerShell');
    body = dialog.querySelector('.customShieldMakerBody');
    frame = dialog.querySelector('.customShieldMakerPreviewFrame');
    stage = dialog.querySelector('.customShieldMakerPreviewStage');
    dock = node('section', 'mobileShieldPreview');
    dock.setAttribute('aria-label', 'Preview and digit variants');
    actions = node('div', 'mobileShieldHeaderActions');
    const transfer = node('div', 'mobileShieldTransferActions');
    const finish = node('div', 'mobileShieldFinishActions');
    actions.append(transfer, finish);
    fields = node('section', 'mobileShieldPage'); fields.id = 'mobileShieldFields';
    fields.setAttribute('aria-label', 'Route number settings');
    const nameRow = node('div', 'mobileShieldNameRow');
    body.before(dock); dialog.querySelector('.customShieldMakerHeader').append(actions);
    body.append(fields);
    dock.append(nameRow);
    move(dialog.querySelector('.customShieldMakerNameField'), nameRow);
    move(byId('customShieldMakerUploadButton'), nameRow);
    move(frame, dock);
    move(dialog.querySelector('.customShieldMakerVariantSection'), dock);
    move(byId('customShieldMakerRouteInput').closest('label'), fields);
    move(dialog.querySelector('.customShieldMakerPreviewDropdowns'), fields);
    move(dialog.querySelector('.customShieldMakerControls'), fields);
    move(byId('customShieldMakerDeleteButton'), fields);
    for (const id of ['customShieldMakerImportButton', 'customShieldMakerExportButton']) move(byId(id), transfer);
    for (const id of ['customShieldMakerSaveButton', 'customShieldMakerClose']) move(byId(id), finish);
    saveIcon = byId('customShieldMakerSaveButton').querySelector('.material-symbols-outlined');
    originalSaveIcon = saveIcon.textContent;
    saveIcon.textContent = 'check';
    for (const button of dialog.querySelectorAll('.customShieldMakerAlignmentButton')) {
      const original = button.textContent;
      button.dataset.shieldDesktopLabel = original;
      button.textContent = ({left: 'Left', center: 'Center', right: 'Right'})[button.dataset.alignment];
    }
    dialog.classList.add('mobileShieldMaker');
    dialog._syncCustomShieldMakerInputs?.();
    if (dialog.open) dialog._ensureCustomShieldMakerPickers?.();
    observer = new MutationObserver(fit);
    observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(fit);
      resizeObserver.observe(frame); resizeObserver.observe(stage);
    }
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('scroll', fit);
    byId('customShieldMakerPreviewImg').addEventListener('load', fit);
    fit();
  };
  return { setActive, fit };
})();
