/* Shared drag feedback. Use individual rotate/scale so a drag never replaces
   an arrow's orientation or an element's positioning transform. */
window.SignMakerDragFeedback = (() => {
  let active = [], pending = null;
  const end = () => {
    clearTimeout(pending); pending = null;
    for (const node of active) {
      node.classList.remove('dragWiggle');
      node.style.removeProperty('--drag-wiggle-delay');
    }
    active = [];
  };
  const begin = nodes => {
    end();
    active = [...new Set(nodes)].filter(node => node?.isConnected && !node.closest('.panelHiddenFromPost,.hiddenFromPost'));
    active.forEach((node, index) => {
      node.style.setProperty('--drag-wiggle-delay', `${-(index % 6) * 0.02}s`);
      node.classList.add('dragWiggle');
    });
  };
  const groups = [
    '.textEditorBlock', '.sMControlRow', '.panelListButton',
    '.subPanelTabGroup[data-draggable-subpanel="true"]',
    '.exitTabButton,.exitTabNestedButton', '.aplArrowListItem'
  ];
  document.addEventListener('dragstart', event => {
    end();
    const source = event.target.closest('[draggable="true"]');
    if (!source) return;
    // Wait for the target's drag handler: controls inside draggable rows may
    // cancel native dragging, including handlers that stop propagation.
    pending = setTimeout(() => {
      pending = null;
      if (event.defaultPrevented || !source.isConnected) return;
      const group = groups.find(selector => source.closest(selector));
      let nodes = group ? [...document.querySelectorAll(group)] : [source];
      if (source.id === 'sMSPCreateElement') nodes.push(...document.querySelectorAll('.textEditorBlock'));
      if (source.classList.contains('templateDragging')) nodes.push(...document.querySelectorAll('.panelDragRoot'));
      begin(nodes);
    }, 0);
  }, true);
  for (const type of ['drop', 'dragend', 'pointerup', 'pointercancel']) document.addEventListener(type, end, true);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') end(); }, true);
  window.addEventListener('blur', end);
  window.addEventListener('resize', end);
  return {begin, end};
})();
