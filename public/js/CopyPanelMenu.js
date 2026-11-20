/* The copy-panel chooser loads with the rest of the editor controls. */
window.SignMakerCopyPanelMenu = (() => {
  const closeCopyPanelContextMenu = (restoreFocus = false) => {
    const menu = document.getElementById("copyPanelContextMenu");
    if (!menu || menu.classList.contains("hidden")) return;
    menu.classList.add("hidden");
    document.getElementById("copySign")?.setAttribute("aria-expanded", "false");
    if (restoreFocus) document.getElementById("copySign")?.focus({preventScroll: true});
  };

  const openCopyPanelContextMenu = (event, { getExportablePanelGroups, copySignToClipboard, copySignInProgress }) => {
    event.preventDefault();
    event.stopPropagation();
    const menu = document.getElementById("copyPanelContextMenu");
    const trigger = document.getElementById("copySign");
    if (!menu || !trigger || copySignInProgress) return;
    // A transformed toolbar makes fixed coordinates relative to the toolbar.
    // Portal to the body so pointer coordinates work at every placement/scale.
    document.body.appendChild(menu);
    menu.replaceChildren();
    const groups = getExportablePanelGroups();
    for (const group of groups) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "menuitem");
      button.tabIndex = -1;
      button.textContent = "Copy Panel " + group.label + (group.indices.length > 1 ? " (stacked)" : "");
      button.dataset.panelIndex = String(group.topIndex);
      button.addEventListener("click", () => {
        closeCopyPanelContextMenu(true);
        copySignToClipboard(group.topIndex);
      });
      menu.appendChild(button);
    }
    if (!groups.length) {
      const empty = document.createElement("button");
      empty.type = "button";
      empty.disabled = true;
      empty.setAttribute("role", "menuitem");
      empty.textContent = "No visible panels to copy";
      menu.appendChild(empty);
    }
    menu.onkeydown = keyEvent => {
      const items = [...menu.querySelectorAll("button:not(:disabled)")];
      const index = items.indexOf(document.activeElement);
      let next;
      if (keyEvent.key === "ArrowDown") next = (index + 1) % items.length;
      if (keyEvent.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
      if (keyEvent.key === "Home") next = 0;
      if (keyEvent.key === "End") next = items.length - 1;
      if (next !== undefined) { keyEvent.preventDefault(); items[next]?.focus(); }
      if (keyEvent.key === "Tab") closeCopyPanelContextMenu(true);
    };
    menu.style.left = "0px";
    menu.style.top = "0px";
    menu.classList.remove("hidden");
    const bounds = menu.getBoundingClientRect();
    const anchor = trigger.getBoundingClientRect();
    const keyboard = event.type === "keydown" || (!event.clientX && !event.clientY);
    const x = keyboard ? anchor.left : event.clientX;
    const y = keyboard ? anchor.bottom : event.clientY;
    menu.style.left = Math.max(8, Math.min(x, window.innerWidth - bounds.width - 8)) + "px";
    menu.style.top = Math.max(8, Math.min(y, window.innerHeight - bounds.height - 8)) + "px";
    trigger.setAttribute("aria-expanded", "true");
    (menu.querySelector("button:not(:disabled)") || menu).focus({preventScroll: true});
  };

  return { open: openCopyPanelContextMenu, close: closeCopyPanelContextMenu };
})();
