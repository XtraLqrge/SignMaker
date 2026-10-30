// Picks an option through the SignalMaker dropdown that replaces a <select>.
// `choice` is an option value, or { label }.
module.exports.choose = async (page, selector, choice) => {
  const select = page.locator(selector);
  const label = await select.evaluate((element, choice) => {
    const option = [...element.options].find((item) => typeof choice === "object"
      ? item.textContent.trim() === choice.label : item.value === choice);
    if (!option) throw new Error(`No option ${JSON.stringify(choice)} in #${element.id}`);
    return option.textContent.trim();
  }, choice);
  const id = await select.getAttribute("id");
  await page.locator(`#${id}-button`).click();
  await page.locator(".symbolPickerMenu.open .symbolPickerItem")
    .filter({ has: page.locator(".symbolPickerLabel", { hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }) })
    .first().click();
  // The picker applies the change after the next paint.
  await select.evaluate((element) => new Promise((resolve) => {
    const check = () => element.dataset.pendingChange ? requestAnimationFrame(check) : resolve();
    check();
  }));
};
