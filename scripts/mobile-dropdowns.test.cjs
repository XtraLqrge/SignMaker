const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {parse, minifyJS} = require('./build.cjs');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const policySource = read('public/js/MobileDropdowns.js');
const minifiedPolicy = minifyJS(policySource);
const declarations = new Map();
function declaration(name) {
  if (declarations.has(name)) return declarations.get(name);
  const source = read('public/js/form.js'), stack = [parse(source)];
  while (stack.length) {
    const node = stack.pop();
    if (node.type === 'VariableDeclarator' && node.id.name === name) {
      const code = 'const ' + source.slice(node.start, node.end) + ';';
      declarations.set(name, code); return code;
    }
    for (const value of Object.values(node)) if (value && typeof value === 'object') {
      if (Array.isArray(value)) stack.push(...value.filter(item => item?.type));
      else if (value.type) stack.push(value);
    }
  }
  throw Error('Missing function ' + name);
}
function fixture({mobile = true, local = new Map(), session = new Map(), source = policySource} = {}) {
  const observers = [];
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.children = []; this.parentElement = null;
      this.dataset = {}; this.attributes = new Map(); this.events = new Map(); this.value = ''; this.context = '';
      this.hidden = false; this.disabled = false; this.options = []; this.open = false;
      this.offsetHeight = 44; this.offsetTop = 0; this.clientHeight = 400; this.scrollTop = 0;
      const classes = new Set();
      const notify = () => observers.filter(observer => observer.target === this).forEach(observer => observer.callback([]));
      this.classList = {
        contains: name => classes.has(name),
        add: (...names) => names.forEach(name => { if (!classes.has(name)) { classes.add(name); notify(); } }),
        remove: (...names) => names.forEach(name => { if (classes.delete(name)) notify(); }),
        toggle: (name, force) => { const enabled = force ?? !classes.has(name); enabled ? this.classList.add(name) : this.classList.remove(name); return enabled; },
      };
      Object.defineProperty(this, 'className', {get: () => [...classes].join(' '), set: value => { classes.clear(); value.split(/\s+/).filter(Boolean).forEach(name => classes.add(name)); }});
      this.style = {setProperty() {}, removeProperty() {}};
    }
    get isConnected() { return html.contains(this); }
    get childElementCount() { return this.children.length; }
    set innerHTML(value) {
      this.children.forEach(child => child.parentElement = null); this.children = [];
      const stack = [this];
      for (const match of value.matchAll(/<\/(\w+)>|<(\w+)([^>]*)>|([^<]+)/g)) {
        if (match[1]) { if (stack.length > 1) stack.pop(); continue; }
        if (match[2]) {
          const node = new Element(match[2]);
          for (const attr of match[3].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) {
            const key = attr[1], text = attr[2] || '';
            if (key === 'class') node.className = text;
            else if (key === 'id') node.id = text;
            else if (key.startsWith('data-')) node.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = text;
            node.setAttribute(key, text);
          }
          stack.at(-1).append(node); if (!['input','img','br'].includes(match[2])) stack.push(node);
        } else stack.at(-1).textContent = (stack.at(-1).textContent || '') + match[4];
      }
    }
    get selectedOptions() { return this.options.filter(option => option.value === this.value); }
    add(option) { option.parentElement = this; this.options.push(option); }
    getClientRects() { return [{}]; }
    append(...children) { for (const child of children) { child.remove(); child.parentElement = this; this.children.push(child); } }
    appendChild(child) { this.append(child); return child; }
    remove() { if (this.parentElement) { const siblings = this.parentElement.children; siblings.splice(siblings.indexOf(this), 1); this.parentElement = null; } }
    replaceWith(node) { const parent = this.parentElement, index = parent.children.indexOf(this); this.remove(); node.parentElement = parent; parent.children.splice(index, 0, node); }
    insertAdjacentElement(position, node) { assert.equal(position, 'afterend'); const parent = this.parentElement; node.remove(); node.parentElement = parent; parent.children.splice(parent.children.indexOf(this) + 1, 0, node); }
    contains(target) { for (let node = target; node; node = node.parentElement) if (node === this) return true; return false; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    hasAttribute(name) { return this.attributes.has(name); }
    matches(selector) {
      return selector.split(',').some(part => {
        part = part.trim();
        const exclusions = [...part.matchAll(/:not\(([^)]+)\)/g)];
        if (exclusions.some(match => this.matches(match[1]))) return false;
        part = part.replace(/:not\([^)]+\)/g, '');
        for (const match of part.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)) {
          const value = match[1].startsWith('data-') ? this.dataset[match[1].slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] : this.getAttribute(match[1]);
          if (value === null || value === undefined || (match[2] !== undefined && value !== match[2])) return false;
        }
        part = part.replace(/\[[^\]]+\]/g, '');
        if (part.startsWith('#')) return this.id === part.slice(1);
        const tag = part.match(/^[a-z]+/i)?.[0];
        return (!tag || this.tagName === tag.toUpperCase()) && [...part.matchAll(/\.([\w-]+)/g)].every(match => this.classList.contains(match[1]));
      });
    }
    closest(selector) { if (this.context.split(',').includes(selector)) return this; for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node; return null; }
    querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    addEventListener(type, handler) { const entries = this.events.get(type) || []; entries.push(handler); this.events.set(type, entries); }
    removeEventListener() {}
    dispatchEvent(event) { for (const handler of this.events.get(event.type) || []) handler(event); return true; }
    click() {
      const event = {type: 'click', target: this, preventDefault() {}, stopPropagation() {this.stopped = true;}, stopImmediatePropagation() {this.stopped = true; this.immediate = true;}};
      for (let node = this; node && !event.stopped; node = node.parentElement) {
        for (const handler of node.events.get('click') || []) {handler(event); if (event.immediate) break;}
      }
    }
    focus() { document.activeElement = this; }
    showModal() { this.open = true; this.openCount = (this.openCount || 0) + 1; }
    close() { this.open = false; }
  }
  const html = new Element('html'), body = new Element('body'); html.append(body);
  if (mobile) html.setAttribute('data-mobile-ui', '');
  const checkbox = new Element('input'); checkbox.id = 'appAdvancedDropdowns'; body.append(checkbox);
  const document = {body, documentElement: html, activeElement: null,
    createElement: tag => new Element(tag), createTextNode: text => Object.assign(new Element('text'), {textContent: text}),
    getElementById: id => body.querySelector('#' + id), addEventListener() {}, removeEventListener() {},
    querySelectorAll: selector => body.querySelectorAll(selector)};
  let currentBlock = {}, currentPanel = {sign: {}, exitTabs: []};
  const storage = values => ({getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)});
  const window = {localStorage: storage(local), sessionStorage: storage(session), SignMakerMobile: {active: mobile},
    addEventListener() {}, removeEventListener() {}, SignMakerDropdowns: {refresh() {}, prepareMenu() {}, positionMenu() {}}};
  const context = vm.createContext({window, document, console, Event, AbortController, setTimeout, clearTimeout,
    getComputedStyle: () => ({fontSize: '16px'}),
    Option: function(label, value) {return {value, textContent: label, label, dataset: {}};},
    MutationObserver: class {constructor(callback) {this.callback = callback; observers.push(this);} observe(target) {this.target = target;} disconnect() {this.target = null;}},
    app: {exposeToFormHandler: {getCurrentBlockElem: () => currentBlock, getCurrentPanel: () => currentPanel, getCurrentSubPanel: () => ({}), vars: {}}}});
  vm.runInContext(source, context);
  const api = window.SignMakerMobileDropdowns;
  const select = (id, value, values = []) => {
    const node = new Element('select'); node.id = id; node.value = value;
    node.options = values.map(value => ({value, textContent: value, label: value, parentElement: node, dataset: {}}));
    body.append(node); return node;
  };
  const advanced = (node, kind = 'color', options = {}) => {
    const menu = new Element('div'); body.append(menu);
    api.appendAdvanced(menu, node, kind, () => {}, options);
    assert.equal(menu.children.length, 1); menu.children[0].click(); return menu;
  };
  return {api, context, window, document, Element, html, body, checkbox, local, session, select, advanced,
    setBlock: value => currentBlock = value, setPanel: value => currentPanel = value,
    answer: value => document.getElementById('mobileAdvancedDropdownPrompt').querySelector(`[data-answer="${value}"]`).click()};
}

test('mobile font choices map control text and all other text without rewriting existing fonts', () => {
  const f = fixture();
  for (const [id, fonts] of [['sdCtrlText_fontFamily', ['Series EM', 'Series 5']], ['sdAdvisory_fontFamily', ['Series E', 'Series 4']], ['exitTabFontFamily', ['Series E', 'Series 4']], ['sdShield_bannerFontFamily1', ['Series E', 'Series 4']]]) {
    const node = f.select(id, fonts[0], ['Series C', ...fonts]);
    const entries = f.api.entries(node, 'font', node.options);
    assert.deepEqual(Array.from(entries, item => item.value), fonts);
    assert.deepEqual(Array.from(entries, item => item.label), ['Highway Gothic', 'Clearview']);
    assert.equal(f.api.fontLabel(node, fonts[0]), 'Highway Gothic');
    assert.equal(node.value, fonts[0]); assert.equal(node.options.length, 3);
    node.value = 'Series C'; assert.equal(f.api.view(node, 'font').simple, false);
    assert.equal(f.api.fontLabel(node, 'Series C'), null); assert.equal(node.value, 'Series C');
  }
});
test('simple colors preserve inherited defaults and exclude saved colors and extra palette colors', () => {
  const f = fixture(), node = f.select('panelColor', 'Green', ['Inherit','Match BG','Match Text','Panel Color','Green','Blue','Brown','Yellow','White','Black','Red','Orange','#AABBCC']);
  node.options.at(-1).dataset.customColor = 'true';
  const allowed = f.api.entries(node, 'color', node.options).map(option => option.value);
  assert.deepEqual(Array.from(allowed), ['Inherit','Match BG','Match Text','Panel Color','Green','Blue','Brown','Yellow','White','Black']);
  assert.equal(node.options.length, 13); assert.equal(node.value, 'Green');
  f.advanced(node); assert.equal(f.api.entries(node, 'color', node.options), node.options);
});
test('standard and Exit Only arrow menus expose only Down, Type A, and Type B by default', () => {
  const f = fixture();
  const items = ['None','DOWN','DOWN_ALT','TYPE_A','TYPE_A_EXTENDED','TYPE_B','TYPE_C_45','TYPE_E'].map(value => ({value}));
  for (const id of ['standardArrowType', 'exitArrowType']) {
    const node = f.select(id, 'DOWN');
    assert.deepEqual(Array.from(f.api.entries(node, 'arrow', items), item => item.value), ['DOWN','TYPE_A','TYPE_B']);
    f.advanced(node, 'arrow'); assert.equal(f.api.entries(node, 'arrow', items), items);
  }
});
test('one-off expansion belongs to one dropdown and closes unless that element has an advanced value', () => {
  const f = fixture(), font = f.select('sdCtrlText_fontFamily', 'Series EM'), color = f.select('sdCtrlText_backgroundColor', 'Green');
  font.context = color.context = '.subPanelConfig';
  const first = {}; f.setBlock(first);
  f.advanced(font, 'font'); assert.equal(f.api.view(font, 'font').simple, false); assert.equal(f.api.view(color, 'color').simple, true);
  f.api.closed(font); assert.equal(f.api.view(font, 'font').simple, true);
  f.advanced(font, 'font'); font.value = 'Series D'; f.api.closed(font);
  assert.equal(f.api.view(font, 'font').simple, false);
  f.setBlock({}); font.value = 'Series EM'; assert.equal(f.api.view(font, 'font').simple, true);
  f.setBlock(first); font.value = 'Series D'; assert.equal(f.api.view(font, 'font').simple, false);
});
test('empty subpanels can open color settings without requesting a missing text element', () => {
  const f = fixture(), node = f.select('subPanelBackgroundColor', 'Green'), control = {rows: []};
  node.context = '.subPanelConfig';
  f.context.app.exposeToFormHandler.getActiveBlockElements = () => control;
  f.context.app.exposeToFormHandler.getCurrentBlockElem = () => {throw Error('No selected block');};
  assert.equal(f.api.view(node, 'color').simple, true);
  f.advanced(node); assert.equal(f.api.view(node, 'color').simple, false);
  f.api.closed(node); assert.equal(f.api.view(node, 'color').simple, true);
});
test('the prompt counts Advanced clicks across different menus and No keeps simplified menus', () => {
  const f = fixture();
  f.advanced(f.select('panelColor', 'Green')); f.advanced(f.select('sdCtrlText_fontFamily', 'Series EM'), 'font');
  assert.equal(f.document.getElementById('mobileAdvancedDropdownPrompt'), null);
  const arrow = f.select('exitArrowType', 'DOWN'); f.advanced(arrow, 'arrow');
  const dialog = f.document.getElementById('mobileAdvancedDropdownPrompt');
  assert.equal(dialog.open, true); assert.equal(dialog.openCount, 1);
  assert.deepEqual(dialog.querySelector('.mobileAdvancedDropdownActions').children.map(node => node.textContent), ['Yes','For this session only','No']);
  assert.equal(dialog.children.at(-1).className, 'mobileAdvancedDropdownNeverAsk');
  f.answer('no'); assert.equal(dialog.open, false); assert.equal(f.api.getEnabled(), false);
  assert.equal(f.api.view(arrow, 'arrow').simple, false, 'Answering does not consume the expanded menu');
  f.api.closed(arrow); f.advanced(arrow, 'arrow'); assert.equal(dialog.openCount, 1);
});
test('the promotion popup overrides hidden-dialog styles only while open', () => {
  const cssTree = require('./vendor/css-tree.cjs');
  const ast = cssTree.parse(read('public/css/form.css') + '\n' + read('public/css/mobile.css'));
  const rules = [];
  cssTree.walk(ast, {visit: 'Rule', enter(rule) {
    const selector = cssTree.generate(rule.prelude);
    if (!['dialog','dialog:not([open])','#mobileAdvancedDropdownPrompt','#mobileAdvancedDropdownPrompt[open]'].includes(selector)) return;
    rule.block.children.forEach(declaration => {
      if (declaration.property === 'display') rules.push({selector, value: cssTree.generate(declaration.value), score: (selector.includes('#') ? 100 : 0) + (selector.includes('[') ? 10 : 0)});
    });
  }});
  const display = open => rules.filter(rule => !rule.selector.endsWith('[open]') || open)
    .filter(rule => !rule.selector.includes(':not([open])') || !open)
    .sort((a, b) => a.score - b.score).at(-1).value;
  assert.equal(display(false), 'none'); assert.equal(display(true), 'block');
});
test('Yes persists advanced menus and the settings checkbox can disable them again', () => {
  const f = fixture(); for (let i = 0; i < 3; i++) f.advanced(f.select('color' + i, 'Green'));
  f.answer('yes'); assert.equal(f.api.getEnabled(), true); assert.equal(f.checkbox.checked, true);
  const next = fixture({local: f.local}); assert.equal(next.api.getEnabled(), true);
  next.checkbox.checked = false; next.checkbox.dispatchEvent({type: 'change', target: next.checkbox});
  assert.equal(next.api.getEnabled(), false);
  assert.equal(fixture({local: next.local}).api.getEnabled(), false);
});
test('session-only advanced menus survive reload in that tab and expire with a new session', () => {
  const f = fixture(); for (let i = 0; i < 3; i++) f.advanced(f.select('color' + i, 'Green'));
  f.answer('session'); assert.equal(f.api.getEnabled(), true); assert.equal(f.checkbox.checked, true);
  assert.equal(f.local.has('signMaker.mobile.advancedDropdowns'), false);
  assert.equal(fixture({local: f.local, session: f.session}).api.getEnabled(), true);
  assert.equal(fixture({local: f.local}).api.getEnabled(), false);
  f.checkbox.checked = false; f.checkbox.dispatchEvent({type: 'change', target: f.checkbox});
  assert.equal(f.api.getEnabled(), false); assert.equal(f.session.get('signMaker.mobile.advancedDropdowns.session'), 'false');
});
test("Don't ask this again suppresses future sessions without enabling advanced menus", () => {
  const f = fixture(); for (let i = 0; i < 3; i++) f.advanced(f.select('color' + i, 'Green'));
  f.document.getElementById('mobileAdvancedDropdownDontAsk').checked = true; f.answer('no');
  const next = fixture({local: f.local});
  for (let i = 0; i < 4; i++) next.advanced(next.select('color' + i, 'Green'));
  assert.equal(next.document.getElementById('mobileAdvancedDropdownPrompt'), null); assert.equal(next.api.getEnabled(), false);
});
test('the Advanced click count continues across reloads within one session', () => {
  const f = fixture(); for (let i = 0; i < 2; i++) f.advanced(f.select('color' + i, 'Green'));
  const next = fixture({local: f.local, session: f.session}); next.advanced(next.select('standardArrowType', 'DOWN'), 'arrow');
  assert.equal(next.document.getElementById('mobileAdvancedDropdownPrompt').open, true);
});
test('desktop defaults retain full menus and the production policy behaves like its editable source', () => {
  for (const source of [policySource, minifiedPolicy]) {
    const f = fixture({mobile: false, source}), node = f.select('panelColor', 'Green', ['Green','Red','Orange']);
    assert.equal(f.api.getEnabled(), true); assert.equal(f.checkbox.checked, true);
    assert.equal(f.api.entries(node, 'color', node.options), node.options);
    f.window.SignMakerMobile.active = true; f.html.setAttribute('data-mobile-ui', '');
    assert.equal(f.api.getEnabled(), false); assert.deepEqual(Array.from(f.api.entries(node, 'color', node.options), option => option.value), ['Green']);
  }
});

function installFontPicker(f) {
  const families = [{family: 'Highway Gothic', fonts: ['Series C','Series E','Series EM']}, {family: 'Clearview', fonts: ['Series 4','Series 5','Series 5WR']}];
  Object.assign(f.context, {syncFontSelectOptionLabels() {}, getUiFontDisplayName: value => value,
    getFontPickerPreviewFontForFamily: family => families.find(item => item.family === family)?.fonts[0] || 'Series E',
    resolveFontPickerPreviewFont: value => value, getFontPickerDisplaySize: () => '16px', isHighwayGothicUiFont: value => /^Series [A-Z]/.test(value),
    getFontPickerFamilies: () => families, getFontsForPickerFamily: family => families.find(item => item.family === family)?.fonts || [],
    closeAllFontPickers: except => f.document.querySelectorAll('.fontPicker').filter(node => node !== except).forEach(node => node.classList.remove('open')),
    setNativeFontSelectValue: (node, value) => {node.value = value;},
    syncAllFontPickers: () => f.document.querySelectorAll('select').forEach(node => node._fontPickerApi?.sync())});
  vm.runInContext(declaration('createFontPicker') + 'this.makeFont=createFontPicker;', f.context);
  return f.context.makeFont;
}
test('the real font picker renders family labels, expands once, and retains a specific advanced font', () => {
  const f = fixture(), select = f.select('sdCtrlText_fontFamily', 'Series EM');
  const make = installFontPicker(f), picker = make({selectEl: select, mode: 'allFontsGrouped'});
  const trigger = picker.wrapper.querySelector('button'); trigger.click();
  assert.deepEqual(picker.menu.children.map(node => node.textContent), ['Highway Gothic','Clearview','Advanced...']);
  assert.equal(select.value, 'Series EM');
  picker.menu.children[1].click(); assert.equal(select.value, 'Series 5');
  trigger.click(); picker.menu.querySelector('.mobileDropdownAdvanced').click();
  assert.equal(picker.menu.querySelectorAll('.fontPickerFontItem').length, 6);
  const specific = picker.menu.querySelectorAll('.fontPickerFontItem').find(node => node.dataset.fontValue === 'Series C');
  picker.menu.dispatchEvent({type: 'pointerdown', pointerType: 'touch', target: specific, preventDefault() {throw Error('Touch scrolling was prevented');}});
  assert.equal(select.value, 'Series 5'); specific.click();
  assert.equal(select.value, 'Series C'); trigger.click();
  assert.equal(picker.menu.querySelector('.mobileDropdownAdvanced'), null);
  assert.equal(picker.wrapper.querySelector('.fontPickerTriggerLabel').textContent, 'Series C');
});
test('the real default-family font picker selects the requested font rather than the first series', () => {
  const f = fixture(), family = f.select('settingsDefaultsControlTextFontFamily', 'Highway Gothic');
  const font = f.select('settingsDefaultsControlTextFont', 'Series EM');
  const picker = installFontPicker(f)({selectEl: family, mode: 'family'});
  picker.wrapper.querySelector('button').click(); picker.menu.children[1].click();
  assert.equal(family.value, 'Clearview'); assert.equal(font.value, 'Series 5');
});
test('the real arrow picker filters only its mobile source and restores every desktop entry on Advanced', () => {
  const f = fixture(), source = f.select('standardArrowType', 'DOWN'), mount = f.document.createElement('select');
  f.body.append(mount);
  vm.runInContext(declaration('findArrowPickerEntryByValue') + declaration('createFlatArrowPicker') + 'this.makeArrow=createFlatArrowPicker;', f.context);
  const chosen = [], items = ['None','DOWN','DOWN_ALT','TYPE_A','TYPE_A_EXTENDED','TYPE_B'].map(value => ({value, label: value}));
  const picker = f.context.makeArrow({mount, value: 'DOWN', mobileSource: source, items, createPreviewNode: () => null, onChange: value => chosen.push(value)});
  const trigger = picker.element.querySelector('button'); trigger.click();
  const list = picker.element.querySelector('.arrowPickerList');
  assert.equal(list.children.length, 4); list.children[2].click(); assert.deepEqual(chosen, ['TYPE_B']);
  trigger.click(); list.querySelector('.mobileDropdownAdvanced').click(); assert.equal(list.children.length, items.length);
  trigger.click(); trigger.click(); assert.equal(list.children.length, 4, 'Closing without an advanced selection restores the simple list');
});

test('the native picker keeps color actions hidden until Advanced and supports its keyboard action', () => {
  const f = fixture(); vm.runInContext(read('public/js/NativeSelect.js'), f.context);
  const select = f.select('bannerBackgroundColor', 'Green', ['Inherit','Green','Blue','Brown','Yellow','White','Black','Red','#AABBCC']);
  select.options.at(-1).dataset.customColor = 'true';
  const picker = f.window.createNativeSelectPicker(select, 'Color', {colorForValue: value => value, customColors: {add() {}, remove() {}}});
  const trigger = picker.wrapper.querySelector('button'); trigger.click();
  const menu = f.document.querySelectorAll('.symbolPickerMenu')[0];
  assert.equal(menu.querySelectorAll('[role="option"]').length, 8);
  assert.equal(menu.querySelector('[data-picker-custom]'), null);
  trigger.dispatchEvent({type: 'keydown', key: 'End', preventDefault() {}});
  trigger.dispatchEvent({type: 'keydown', key: 'Enter', preventDefault() {}});
  assert.ok(menu.querySelector('[data-picker-custom]'));
  const find = value => menu.querySelectorAll('[data-native-index]').find(row => row.querySelector('.symbolPickerLabel').textContent === value);
  find('Red').click(); assert.equal(select.value, 'Red'); trigger.click(); assert.ok(menu.querySelector('[data-picker-custom]'));
  find('Green').click(); trigger.click(); assert.equal(menu.querySelector('[data-picker-custom]'), null);
  assert.equal(select.options.length, 9, 'Saved custom colors remain in the native source');
});

test('the native font picker uses the same two named choices for other text', () => {
  const f = fixture(); vm.runInContext(read('public/js/NativeSelect.js'), f.context);
  const select = f.select('templateEditorVariantFont', 'Series E', ['Series B','Series E','Series 4']);
  const picker = f.window.createNativeSelectPicker(select, 'Font', {textStyleForValue: value => ({fontFamily: value})});
  const trigger = picker.wrapper.querySelector('button'); trigger.click();
  const menu = f.document.querySelectorAll('.symbolPickerMenu')[0];
  assert.deepEqual(menu.querySelectorAll('[data-native-index]').map(row => row.querySelector('.symbolPickerLabel').textContent), ['Highway Gothic','Clearview']);
  menu.querySelectorAll('[data-native-index]')[1].click(); assert.equal(select.value, 'Series 4');
  assert.equal(trigger.querySelector('.symbolPickerLabel').textContent, 'Clearview');
});

test('the real color picker hides custom creation and saved colors until expanded, without losing their values', () => {
  const f = fixture(), saved = {id: 'purple', name: 'Saved purple', value: '#AABBCC'};
  const select = f.select('sdCtrlText_backgroundColor', 'Green', ['Inherit','Match BG','Green','Blue','Brown','Yellow','White','Black','Red','#AABBCC']);
  select.options.at(-1).dataset.customColor = 'true';
  select.options.at(-1).textContent = saved.name;
  Object.assign(f.context, {
    isColorSelectElement: () => true, ensureCustomColorOptionsForSelect() {},
    fitColorPickerTriggerLabelText() {}, getColorOptionIconValue: value => value,
    normalizeCustomCssColorValue: value => value, getCustomColorComparableValue: value => value?.toLowerCase(),
    loadCustomColorRecords: () => [saved], isDefaultColorValueForCustomPicker: () => false,
    getCustomColorDisplayName: record => record.name,
    closeAllColorPickers: except => f.document.querySelectorAll('.colorPicker').filter(node => node !== except).forEach(node => node.classList.remove('open')),
    ensureNativeColorSelectOption(node, value) {if (!node.options.some(option => option.value === value)) node.add({value, textContent: value, dataset: {}});},
    syncAllColorPickers: () => select._colorPickerApi.sync(),
  });
  vm.runInContext(declaration('createColorPicker') + 'this.makeColor=createColorPicker;', f.context);
  const picker = f.context.makeColor(select); picker.trigger.click();
  assert.equal(picker.menu.querySelector('.colorPickerCustomColorButton'), null);
  assert.deepEqual(picker.menu.querySelectorAll('[data-color-value]').map(node => node.dataset.colorValue), ['Inherit','Match BG','Green','Blue','Brown','Yellow','White','Black']);
  picker.menu.querySelector('.mobileDropdownAdvanced').click();
  assert.ok(picker.menu.querySelector('.colorPickerCustomColorButton'));
  const custom = picker.menu.querySelectorAll('[data-color-value]').find(node => node.dataset.colorValue === saved.value);
  picker.menu.dispatchEvent({type: 'pointerdown', pointerType: 'touch', target: custom, preventDefault() {throw Error('Touch scrolling was prevented');}});
  assert.equal(select.value, 'Green'); custom.click();
  assert.equal(select.value, saved.value); picker.trigger.click();
  assert.ok(picker.menu.querySelector('.colorPickerCustomColorButton'));
  assert.equal(picker.wrapper.querySelector('.colorPickerTriggerLabel').textContent, saved.name);
  picker.menu.querySelectorAll('[data-color-value]').find(node => node.dataset.colorValue === 'Green').click();
  picker.trigger.click(); assert.equal(picker.menu.querySelector('.colorPickerCustomColorButton'), null);
  assert.equal(select.options.length, 10);
});
