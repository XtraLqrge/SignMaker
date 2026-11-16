/* Pointer dragging keeps panel placement independent of the post's rails. */
window.SignMakerPanelDrag = (() => {
  let activeGesture = null;
  const snapPairs = [["top", "top"], ["bottom", "bottom"], ["center", "center"], ["top", "bottom"], ["bottom", "top"]];
  const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));
  const middle = rect => (rect.top + rect.bottom) / 2;
  const anchor = (rect, name) => name === "center" ? middle(rect) : rect[name];

  const snapOffset = ({ offset, startOffset, rect, peers, units, limit = 6, tolerance = 8, disabled = false }) => {
    let value = clamp(offset, limit), nearest = value, snap = null, distance = tolerance + 0.001;
    if (disabled || !Number.isFinite(units) || units <= 0) return { offset: value, snap };
    const travel = (offset - startOffset) * units;
    for (const peer of peers) {
      const horizontalGap = Math.max(0, peer.rect.left - rect.right, rect.left - peer.rect.right);
      if (horizontalGap > Math.max(80, units * 12)) continue;
      for (const [ownEdge, peerEdge] of snapPairs) {
        const y = anchor(peer.rect, peerEdge);
        const anchorShift = y - anchor(rect, ownEdge);
        if (Math.abs(anchorShift) < 1 || anchorShift * travel <= 0) continue;
        const candidate = startOffset + anchorShift / units;
        const delta = Math.abs(anchorShift - travel);
        if (candidate < -limit || candidate > limit || delta > tolerance || delta >= distance) continue;
        distance = delta;
        nearest = candidate;
        snap = { peer, y };
      }
    }
    if (snap) value = nearest;
    return { offset: Math.round(value * 10000) / 10000, snap };
  };

  const dropPosition = (peers, centerX, fromIndex, startCenter) => {
    const direction = Math.sign(centerX - startCenter);
    if (!direction) return null;
    let previousCenter = startCenter;
    let crossed = -1;
    for (let i = direction > 0 ? 0 : peers.length - 1; i >= 0 && i < peers.length; i += direction) {
      const peer = peers[i];
      if ((peer.index - fromIndex) * direction <= 0) continue;
      const peerCenter = (peer.rect.left + peer.rect.right) / 2;
      const threshold = previousCenter + (peerCenter - previousCenter) / 3;
      if ((centerX - threshold) * direction < 0) break;
      crossed = i;
      previousCenter = peerCenter;
    }
    if (crossed < 0) return null;
    const peer = peers[crossed];
    if (direction < 0) return { index: peer.index, peer, before: true };
    const next = peers[crossed + 1];
    return next
      ? { index: next.index, peer: next, before: true }
      : { index: peer.endIndex + 1, peer, before: false };
  };

  const signBounds = root => {
    const signs = root.matches(".panelStack")
      ? Array.from(root.querySelectorAll(":scope > .panel > .signContainer"))
      : [root.querySelector(":scope > .signContainer")].filter(Boolean);
    const boxes = signs.map(sign => typeof PanelBorders !== 'undefined'
      ? PanelBorders.bodyBounds(sign) : sign.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
    if (!boxes.length) return null;
    const left = Math.min(...boxes.map(rect => rect.left)), right = Math.max(...boxes.map(rect => rect.right));
    const top = Math.min(...boxes.map(rect => rect.top)), bottom = Math.max(...boxes.map(rect => rect.bottom));
    return { left, right, top, bottom, width: right - left, height: bottom - top };
  };

  const bind = (handle, root, { index, getOffset, getEndIndex, onCommit, limit = 6 }) => {
    handle.classList.add("panelDragHandle");
    handle.draggable = false;
    root.classList.add("panelDragRoot");
    root.dataset.dragPanelIndex = String(index);
    root.style.top = `${getOffset()}rem`;
    handle.addEventListener("dragstart", event => event.preventDefault());
    handle.addEventListener("pointerdown", event => {
      if (activeGesture || event.button !== 0 || event.isPrimary === false || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.target.closest("button,input,textarea,select,a,[contenteditable='true']")) return;
      const doc = handle.ownerDocument, view = doc.defaultView;
      const startOffset = getOffset(), startX = event.clientX, startY = event.clientY;
      let rect, units, peers;
      const state = { axis: null, offset: startOffset, drop: null, latest: event, frame: null, guide: null, snap: null };
      activeGesture = state;

      const paint = () => {
        state.frame = null;
        const latest = state.latest;
        if (state.axis === "horizontal") {
          const startCenter = (rect.left + rect.right) / 2;
          const drop = dropPosition(peers, startCenter + latest.clientX - startX, index, startCenter);
          if (drop?.peer !== state.drop?.peer || drop?.before !== state.drop?.before) {
            state.drop?.peer.element.classList.remove("dropBefore", "dropAfter");
            drop?.peer.element.classList.add(drop.before ? "dropBefore" : "dropAfter");
          }
          state.drop = drop;
          return;
        }
        const result = snapOffset({ offset: startOffset + (latest.clientY - startY) / units, startOffset, rect, peers, units, limit, disabled: latest.altKey });
        if (state.offset !== result.offset) {
          state.offset = result.offset;
          root.style.top = `${result.offset}rem`;
        }
        const snap = result.snap;
        if (snap?.peer === state.snap?.peer && snap?.y === state.snap?.y) return;
        state.snap = snap;
        if (snap) {
          if (!state.guide) {
            state.guide = doc.createElement("div");
            state.guide.className = "panelDragSnapGuide";
            state.guide.setAttribute("aria-hidden", "true");
            doc.body.appendChild(state.guide);
          }
          const left = Math.min(rect.left, snap.peer.rect.left), right = Math.max(rect.right, snap.peer.rect.right);
          Object.assign(state.guide.style, { display: "block", left: `${left}px`, top: `${snap.y}px`, width: `${right - left}px` });
        } else if (state.guide) state.guide.style.display = "none";
      };
      const move = moveEvent => {
        if (moveEvent.pointerId !== event.pointerId) return;
        if (!state.axis) {
          const dx = Math.abs(moveEvent.clientX - startX);
          const dy = Math.abs(moveEvent.clientY - startY);
          if (Math.max(dx, dy) < 5) return;
          if (!root.isConnected) return finish(moveEvent, true);
          const horizontal = dx > dy;
          rect = signBounds(root);
          if (!rect) return finish(moveEvent, true);
          if (!horizontal) {
            const scale = root.offsetWidth ? root.getBoundingClientRect().width / root.offsetWidth : 1;
            units = (parseFloat(view.getComputedStyle(doc.documentElement).fontSize) || 16) * scale;
            if (!(units > 0)) return finish(moveEvent, true);
          }
          peers = Array.from(root.parentElement.children)
            .filter(node => node !== root && node.matches(".panel,.panelStack") && !node.classList.contains("panelHiddenFromPost"))
            .map(node => {
              const peerIndex = Number(node.dataset.dragPanelIndex ?? node.dataset.stackTopPanelIndex ?? node.dataset.panelIndex);
              return { element: node, index: peerIndex, endIndex: horizontal ? getEndIndex(peerIndex) : peerIndex, rect: signBounds(node) };
            }).filter(peer => Number.isInteger(peer.index) && peer.rect);
          state.axis = horizontal ? "horizontal" : "vertical";
          root.classList.add("panelDragging");
          doc.documentElement.classList.add("panelDragActive");
          handle.setPointerCapture?.(event.pointerId);
        }
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        state.latest = moveEvent;
        if (state.frame === null) state.frame = view.requestAnimationFrame(paint);
      };
      const finish = (endEvent, cancelled) => {
        if (endEvent.pointerId !== undefined && endEvent.pointerId !== event.pointerId) return;
        if (state.frame !== null) view.cancelAnimationFrame(state.frame);
        // Vertical drops keep the previewed snap unless Alt bypasses it.
        if (!cancelled && state.axis === "horizontal") {
          state.latest = endEvent;
          paint();
        } else if (!cancelled && state.axis === "vertical" && (!state.snap || endEvent.altKey)) {
          state.latest = { clientY: state.latest.clientY, altKey: endEvent.altKey };
          paint();
        }
        view.removeEventListener("pointermove", move, true);
        view.removeEventListener("pointerup", up, true);
        view.removeEventListener("pointercancel", cancel, true);
        view.removeEventListener("keydown", key, true);
        view.removeEventListener("blur", cancel);
        view.removeEventListener("resize", cancel);
        handle.removeEventListener("lostpointercapture", cancel);
        if (handle.hasPointerCapture?.(event.pointerId)) handle.releasePointerCapture(event.pointerId);
        root.classList.remove("panelDragging");
        doc.documentElement.classList.remove("panelDragActive");
        state.drop?.peer.element.classList.remove("dropBefore", "dropAfter");
        state.guide?.remove();
        activeGesture = null;
        if (!state.axis) return;
        const blockClick = click => { click.preventDefault(); click.stopImmediatePropagation(); };
        doc.addEventListener("click", blockClick, true);
        view.setTimeout(() => doc.removeEventListener("click", blockClick, true), 0);
        if (cancelled) root.style.top = `${startOffset}rem`;
        else onCommit(state.offset, state.drop?.index ?? index);
      };
      const up = endEvent => finish(endEvent, false);
      const cancel = endEvent => finish(endEvent, true);
      const key = keyEvent => {
        if (keyEvent.key !== "Escape") return;
        keyEvent.preventDefault(); keyEvent.stopPropagation(); finish(keyEvent, true);
      };
      view.addEventListener("pointermove", move, { capture: true, passive: false });
      view.addEventListener("pointerup", up, true);
      view.addEventListener("pointercancel", cancel, true);
      view.addEventListener("keydown", key, true);
      view.addEventListener("blur", cancel);
      view.addEventListener("resize", cancel);
      handle.addEventListener("lostpointercapture", cancel);
    });
  };
  return { bind, snapOffset, dropPosition };
})();
