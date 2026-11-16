(() => {
  // Undo and redo, following SignalMaker's js/history.js (GPL-3.0): snapshots of
  // the drawing, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z (and Ctrl+Y off the Mac), and
  // typing in a number field counts as one step until the field is left.
  //
  // A snapshot is every sheet's scale, roads, joints, gore markings, medians, intersections, signs,
  // lateral pavement markings, and Auto
  // tapers setting. Sheets themselves
  // (uploads, removal, order) and the view aren't undo steps; restoring a
  // snapshot leaves sheets it doesn't mention alone.
  window.StripeMaker ??= {};
  window.StripeMaker.startHistory = ({ sheets, onRestore, report }) => {
    const HISTORY_LIMIT = 100;
    const undoStack = [];
    const redoStack = [];
    const undoButton = document.getElementById("undoButton");
    const redoButton = document.getElementById("redoButton");
    const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent);
    let applyingHistory = false;
    let pendingBefore = null;
    let editingInput = null;
    const serialize = () => JSON.stringify(Object.fromEntries(sheets.all.map(sheet => [sheet.id, {
      inchesPerPixel: sheet.inchesPerPixel ?? null, roads: sheet.roads ?? [], joints: sheet.joints ?? [], gores: sheet.gores ?? [],
      intersections: sheet.intersections ?? [], signs: sheet.signs ?? [], matchLines: sheet.matchLines ?? [], markings: sheet.markings ?? [], lines: sheet.lines ?? [], medians: sheet.medians ?? [], bridges: sheet.bridges ?? [], surfaces: sheet.surfaces ?? [], speedZones: sheet.speedZones ?? [], vehicleSpawns: sheet.vehicleSpawns ?? [], autoTapers: Boolean(sheet.autoTapers),
    }])));
    let currentSnapshot = serialize();

    function updateButtons() {
      const pendingChange = pendingBefore !== null && pendingBefore !== serialize();
      undoButton.disabled = !undoStack.length && !pendingChange;
      redoButton.disabled = !redoStack.length || pendingChange;
    }

    function push(stack, snapshot) {
      if (stack.at(-1) === snapshot) return;
      stack.push(snapshot);
      if (stack.length > HISTORY_LIMIT) stack.shift();
    }

    function commit(before, after) {
      if (before !== after) {
        push(undoStack, before);
        redoStack.length = 0;
      }
      currentSnapshot = after;
      updateButtons();
    }

    function finishChange() {
      if (pendingBefore === null) return;
      const before = pendingBefore;
      pendingBefore = null;
      editingInput = null;
      commit(before, serialize());
    }

    function beginChange(input) {
      if (applyingHistory || editingInput === input) return;
      finishChange();
      pendingBefore = serialize();
      editingInput = input;
    }

    function record() {
      if (applyingHistory) return;
      if (pendingBefore !== null) updateButtons();
      else commit(currentSnapshot, serialize());
    }

    // Uploading, restoring, or removing a sheet changes what a snapshot covers
    // without being an edit.
    function rebase() {
      if (applyingHistory || pendingBefore !== null) return;
      currentSnapshot = serialize();
      updateButtons();
    }

    function restore(snapshot) {
      applyingHistory = true;
      try {
        const restored = JSON.parse(snapshot);
        const changed = sheets.all.filter(sheet => restored[sheet.id]);
        for (const sheet of changed) Object.assign(sheet, restored[sheet.id]);
        onRestore(changed);
        currentSnapshot = serialize();
      } finally {
        applyingHistory = false;
        updateButtons();
      }
    }

    function travel(from, to, message) {
      finishChange();
      if (applyingHistory || !from.length) return;
      document.activeElement?.blur();
      push(to, serialize());
      restore(from.pop());
      report(message);
    }
    const undo = () => travel(undoStack, redoStack, "Undone.");
    const redo = () => travel(redoStack, undoStack, "Redone.");
    function runWithUndo(callback) {
      finishChange();
      pendingBefore = serialize();
      try { return callback(); }
      finally { finishChange(); }
    }

    for (const [button, label, shortcut, ariaShortcut, action] of [
      [undoButton, "Undo", isMac ? "⌘Z" : "Ctrl+Z", isMac ? "Meta+Z" : "Control+Z", undo],
      [redoButton, "Redo", isMac ? "⌘⇧Z" : "Ctrl+Y / Ctrl+Shift+Z", isMac ? "Meta+Shift+Z" : "Control+Y Control+Shift+Z", redo],
    ]) {
      button.title = `${label} (${shortcut})`;
      button.setAttribute("aria-label", button.title);
      button.setAttribute("aria-keyshortcuts", ariaShortcut);
      button.addEventListener("click", action);
    }

    const continuousInput = target => target?.matches?.('.editor input:not([type="checkbox"]):not([type="file"]), .editor textarea');
    document.addEventListener("input", event => {
      if (continuousInput(event.target)) beginChange(event.target);
    }, true);
    document.addEventListener("change", event => {
      if (event.target === editingInput) finishChange();
    });
    document.addEventListener("focusout", event => {
      if (event.target === editingInput) finishChange();
    });
    document.addEventListener("pointerdown", event => {
      if (event.target !== editingInput) finishChange();
    }, true);
    document.addEventListener("click", event => {
      if (event.target !== editingInput) finishChange();
    }, true);

    document.addEventListener("keydown", event => {
      if (event.defaultPrevented || event.isComposing || event.altKey) return;
      if (isMac ? !event.metaKey || event.ctrlKey : !event.ctrlKey || event.metaKey) return;
      const key = event.key.toLowerCase();
      const isUndo = key === "z" && !event.shiftKey;
      const isRedo = key === "z" && event.shiftKey || !isMac && key === "y" && !event.shiftKey;
      if (!isUndo && !isRedo) return;
      // Dialog fields keep their native text undo.
      if (document.querySelector("dialog[open]") || event.target?.closest?.('[contenteditable="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      if (isUndo) undo();
      else redo();
    }, true);
    updateButtons();
    return { record, rebase, undo, redo, runWithUndo,
      capture() { finishChange();return {undo:[...undoStack],redo:[...redoStack]}; },
      resume(state) { pendingBefore=null;editingInput=null;undoStack.splice(0,undoStack.length,...(state?.undo??[]));redoStack.splice(0,redoStack.length,...(state?.redo??[]));currentSnapshot=serialize();updateButtons(); },
      diagnostics: ids => {
        const subset = value => value === null ? null : Object.fromEntries(Object.entries(JSON.parse(value)).filter(([id])=>ids.includes(Number(id))));
        return {undo:undoStack.map(subset),redo:redoStack.map(subset),pending:subset(pendingBefore),current:subset(serialize()),editingInput:editingInput?.id??null};
      }
    };
  };
})();
