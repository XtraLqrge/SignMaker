/* The opt-in controls picker availability. Saved signs can still render the family. */
window.SignMakerHighwayVar = (() => {
  const family = 'Highway VAR';
  const storageKey = 'signMaker.highwayVarFonts';
  const fonts = [];
  for (const grade of ['', 'G-1', 'G-2']) {
    for (let series = 1; series <= 9; series++) {
      fonts.push(family + ' Series ' + series + (grade ? ' ' + grade : ''));
    }
  }

  let enabled = false;
  try { enabled = window.localStorage.getItem(storageKey) === 'true'; } catch {}
  const belongsToFamily = name => name === family || fonts.includes(name);
  const allows = name => enabled || !belongsToFamily(name);
  const checkbox = document.getElementById?.('appHighwayVarFonts');
  const syncSetting = () => {
    if (checkbox) checkbox.checked = enabled;
    document.documentElement?.toggleAttribute?.('data-highway-var-fonts', enabled);
  };
  syncSetting();
  checkbox?.addEventListener('change', () => {
    enabled = checkbox.checked;
    try { window.localStorage.setItem(storageKey, String(enabled)); } catch {}
    syncSetting();
  });

  const install = () => {
    if (typeof TextElement === 'undefined' || typeof ExitTab === 'undefined') return false;
    for (const [prototype, key] of [[TextElement.prototype, 'fontFamily'], [ExitTab.prototype, 'fontFamilies']]) {
      const existing = prototype[key] || [];
      prototype[key] = existing.concat(fonts.filter(font => !existing.includes(font)));
    }
    if (typeof LEGACY_FONT_TO_DISPLAY_ALIAS !== 'undefined') {
      for (const name of [family, ...fonts]) {
        LEGACY_FONT_TO_DISPLAY_ALIAS[name.replace(family, 'OC Highway VAR2')] = name;
      }
    }
    return true;
  };
  if (!install()) document.addEventListener('DOMContentLoaded', install, { once: true });
  return { allows };
})();
