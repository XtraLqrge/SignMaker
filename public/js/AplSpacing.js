/* Keep APL arrows evenly spaced across subpanels. Text wider than a middle
   subpanel's arrows widens every gap by the same factor instead of opening one
   large gap, and extra text room on the edge subpanels goes to the outer side.
   main.js calls this before it links the content and arrow column widths. */
window.SignMakerAplSpacing = (contentCells, arrowCells, remPx) => {
  const last = arrowCells.length - 1;
  if (last < 1) return;
  // The values main.js rendered, kept so repeated syncs never compound.
  const base = (node, read) => Number(node.dataset.aplBase ??= read()) || 0;
  const columns = arrowCells.map(cell => {
    const box = cell.querySelector(':scope > .subpanelAplArrows');
    const slots = box ? [...box.querySelectorAll(':scope > .aplArrowSlot')] : [];
    const margins = slots.map(slot => {
      slot.dataset.aplBaseRight ??= parseFloat(slot.style.marginRight) || 0;
      return [base(slot, () => parseFloat(slot.style.marginLeft) || 0), Number(slot.dataset.aplBaseRight)];
    });
    return { box, slots, margins, total: margins.reduce((sum, [left, right]) => sum + left + right, 0) };
  });
  const naturalWidthRem = cell => {
    const container = cell.querySelector(':scope > .signContentContainer');
    const saved = container && ['width', 'min-width'].map(name =>
      [name, container.style.getPropertyValue(name), container.style.getPropertyPriority(name)]);
    for (const node of [cell, container]) {
      node?.style.setProperty('width', 'max-content', 'important');
      node?.style.setProperty('min-width', '0', 'important');
    }
    const width = cell.offsetWidth;
    cell.style.removeProperty('width');
    cell.style.removeProperty('min-width');
    saved?.forEach(([name, value, priority]) => value
      ? container.style.setProperty(name, value, priority) : container.style.removeProperty(name));
    return width / remPx;
  };
  let scale = 1;
  columns.forEach((column, i) => {
    if (i > 0 && i < last && column.total > 0) {
      scale = Math.max(scale, naturalWidthRem(contentCells[i]) / column.total);
    }
  });
  columns.forEach(({ box, slots, margins }, i) => {
    if (!box) return;
    let width = 0;
    slots.forEach((slot, j) => {
      // The sign's outer edges keep their fixed padding.
      const left = i === 0 && j === 0 ? margins[j][0] : margins[j][0] * scale;
      const right = i === last && j === slots.length - 1 ? margins[j][1] : margins[j][1] * scale;
      slot.style.marginLeft = left + 'rem';
      slot.style.marginRight = right + 'rem';
      width += left + right;
    });
    box.style.setProperty('justify-content', i === 0 ? 'flex-end' : i === last ? 'flex-start' : 'center', 'important');
    if (width > 0) {
      for (const cell of [contentCells[i], arrowCells[i]]) cell?.style.setProperty('--aplSubpanelMinWidth', width + 'rem');
    }
  });
  // Shared Exit Only plaques are centred by offsets measured in the same spacing.
  for (const [selector, property] of [
    ['.aplExitOnlySharedLabel', '--aplExitOnlySharedCenterOffset'],
    ['.aplExitOnlyBoundarySharedLabel', '--aplExitOnlyBoundaryCenterOffset'],
  ]) {
    for (const label of arrowCells[0].parentElement?.querySelectorAll(selector) || []) {
      if (!label.style.getPropertyValue(property)) continue;
      label.style.setProperty(property, base(label, () => parseFloat(label.style.getPropertyValue(property)) || 0) * scale + 'rem');
    }
  }
};
