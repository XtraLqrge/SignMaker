const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('build-manifest.json'));
const sources = ['public/js/MobileExitTabs.js', 'public/' + manifest.assets.find(asset => asset.source === 'js/MobileExitTabs.js').output];
const html = read('scripts/index.source.html').split('<div class="sMModal exitTabConfig"')[1].split('<div class="sMModal subPanelConfig"')[0];

class Node {
  constructor(tag = 'div', text = '') {
    this.tagName = tag.toUpperCase(); this.nodeType = tag === '#comment' ? 8 : tag === '#text' ? 3 : 1;
    this.childNodes = []; this.parentElement = null; this.attrs = new Map(); this.events = new Map();
    this.classes = new Set(); this.dataset = {}; this._text = text; this.value = ''; this.type = '';
    this.min = ''; this.max = ''; this.step = ''; this.id = ''; this.htmlFor = ''; this.name = ''; this.disabled = false;
    this.classList = { add: (...keys) => keys.forEach(key => this.classes.add(key)), remove: (...keys) => keys.forEach(key => this.classes.delete(key)),
      contains: key => this.classes.has(key), toggle: (key, on = !this.classes.has(key)) => { on ? this.classes.add(key) : this.classes.delete(key); return on; } };
  }
  get children() { return this.childNodes.filter(node => node.nodeType === 1); }
  get nextElementSibling() { const list = this.parentElement?.children || []; return list[list.indexOf(this) + 1] || null; }
  get className() { return [...this.classes].join(' '); }
  set className(value) { this.classes = new Set(value.split(/\s+/).filter(Boolean)); }
  get textContent() { return this._text + this.childNodes.filter(node => node.nodeType !== 8).map(node => node.textContent).join(''); }
  set textContent(value) { this.childNodes.forEach(node => node.parentElement = null); this.childNodes = []; this._text = String(value); }
  set innerHTML(value) { this.textContent = value; }
  get innerHTML() { return this.textContent; }
  setAttribute(key, value) {
    value = String(value); this.attrs.set(key, value);
    if (key === 'class') this.className = value;
    else if (key === 'for') this.htmlFor = value;
    else if (['id', 'name', 'type', 'value', 'min', 'max', 'step'].includes(key)) this[key] = value;
    else if (['disabled', 'hidden', 'checked'].includes(key)) this[key] = true;
  }
  getAttribute(key) { return this.attrs.get(key) ?? null; }
  removeAttribute(key) { this.attrs.delete(key); }
  matches(selector) {
    const query = selector.trim();
    if (this.nodeType !== 1) return false;
    const tag = query.match(/^[a-z]+/i)?.[0]; if (tag && this.tagName !== tag.toUpperCase()) return false;
    for (const [, key, value] of query.matchAll(/\[([\w-]+)="([^"]*)"\]/g)) {
      if (String(key === 'for' ? this.htmlFor : this[key] ?? this.getAttribute(key)) !== value) return false;
    }
    return [...query.replace(/\[[^\]]*\]/g, '').matchAll(/([.#])([\w-]+)/g)]
      .every(([, kind, name]) => kind === '#' ? this.id === name : this.classes.has(name));
  }
  closest(selector) { for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node; return null; }
  querySelectorAll(selector) { return this.childNodes.flatMap(node => [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  append(...nodes) { for (const node of nodes) { node.remove(); this.childNodes.push(node); node.parentElement = this; } }
  before(node) { node.remove(); const list = this.parentElement.childNodes; list.splice(list.indexOf(this), 0, node); node.parentElement = this.parentElement; }
  after(node) { node.remove(); const list = this.parentElement.childNodes; list.splice(list.indexOf(this) + 1, 0, node); node.parentElement = this.parentElement; }
  remove() { if (this.parentElement) { const list = this.parentElement.childNodes; list.splice(list.indexOf(this), 1); this.parentElement = null; } }
  addEventListener(type, handler, capture = false) { const handlers = this.events.get(type) || []; handlers.push({ handler, capture }); this.events.set(type, handlers); }
  dispatchEvent(event) {
    event.target = this;
    const handlers = this.events.get(event.type) || [];
    for (const item of handlers.filter(item => item.capture)) item.handler.call(this, event);
    this['on' + event.type]?.call(this, event);
    for (const item of handlers.filter(item => !item.capture)) item.handler.call(this, event);
    return !event.defaultPrevented;
  }
  checkValidity() {
    const value = Number(this.value), min = this.min === '' ? -Infinity : Number(this.min), max = this.max === '' ? Infinity : Number(this.max);
    const step = Number(this.step || 1), index = (value - (Number.isFinite(min) ? min : 0)) / step;
    return this.disabled || this.value !== '' && Number.isFinite(value) && value >= min && value <= max && Math.abs(index - Math.round(index)) < 1e-7;
  }
}
function parse(source) {
  const document = new Node('html'), stack = [document];
  for (const match of source.matchAll(/<!--[\s\S]*?-->|<\/[\w-]+\s*>|<[\w-]+\b[^>]*>|[^<]+/g)) {
    const token = match[0];
    if (token.startsWith('<!--')) continue;
    if (token.startsWith('</')) { stack.pop(); continue; }
    if (!token.startsWith('<')) { stack.at(-1).append(new Node('#text', token)); continue; }
    const tag = token.match(/^<([\w-]+)/)[1], node = new Node(tag);
    for (const [, key, double, single, bare] of token.slice(tag.length + 1, -1).matchAll(/([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      node.setAttribute(key, double ?? single ?? bare ?? '');
    }
    stack.at(-1).append(node);
    if (!['input', 'br', 'img', 'hr'].includes(tag)) stack.push(node);
  }
  return document;
}
class Event {
  constructor(type, options = {}) { this.type = type; Object.assign(this, options); }
  preventDefault() { this.defaultPrevented = true; }
}
function ui(source) {
  const tree = parse('<div class="sMModal exitTabConfig"' + html), calls = [];
  const inputs = tree.querySelectorAll('input[type="range"]'), byId = id => tree.querySelector('#' + id);
  const document = { activeElement: null, createElement: tag => new Node(tag), createComment: text => new Node('#comment', text),
    querySelector: selector => tree.querySelector(selector), getElementById: byId };
  const formHandler = { readForm(options) { calls.push({ options, values: Object.fromEntries(inputs.map(input => [input.id, input.value])) }); } };
  let historyEnds = 0;
  const context = vm.createContext({ window: {}, document, Event, formHandler, console,
    app: { exposeToFormHandler: { endUndoableChange() { historyEnds++; } } }, MutationObserver: class { observe() {} disconnect() {} } });
  for (const node of tree.querySelectorAll('input')) for (const type of ['input', 'change']) {
    const code = node.getAttribute('on' + type); if (code) node['on' + type] = vm.runInContext(`(function(event) { ${code} })`, context);
  }
  const originals = inputs.map(input => ({ input, parent: input.parentElement, children: [...input.parentElement.childNodes], type: input.type, name: input.name }));
  const panel = tree.querySelector('.exitTabCheckboxPanel'), checkOrder = [...panel.childNodes];
  const corner = byId('exitTabCornerRadius'), inherit = byId('exitTabUsePanelCornerRadius'), inheritParent = inherit.parentElement;
  inherit.onchange = () => { corner.disabled = inherit.checked || byId('squareCorners').checked; formHandler.readForm(); };
  vm.runInContext(read(source), context);
  const api = context.window.SignMakerMobileExitTabs; api.setActive(true);
  const buttons = input => input.closest('.mobileExitStepper').querySelectorAll('button');
  return { api, inputs, byId, document, tree, calls, originals, panel, checkOrder, inheritParent, historyEnds: () => historyEnds,
    up: id => buttons(byId(id))[0], down: id => buttons(byId(id))[1], fire: (node, type) => node.dispatchEvent(new Event(type, { bubbles: true })) };
}
for (const source of sources) {
  const name = source === sources[0] ? 'source' : 'production';
  test(`${name}: every exit slider including optional asset fields keeps its original node and binding`, () => {
    const h = ui(source);
    assert.equal(h.inputs.length, 9); assert.equal(h.tree.querySelectorAll('input[type="range"]').length, 0);
    assert.equal(h.tree.querySelectorAll('.mobileExitStepper').length, 9);
    for (const original of h.originals) {
      assert.equal(h.byId(original.input.id), original.input); assert.equal(original.input.name, original.name);
      assert.equal(original.input.type, 'number'); assert.ok(original.input.getAttribute('aria-label'));
      assert.equal(h.up(original.input.id).type, 'button'); assert.equal(h.down(original.input.id).type, 'button');
    }
  });
  test(`${name}: fractional and negative values step exactly and stop at their limits`, () => {
    const h = ui(source);
    for (const [id, start, up, down] of [['borderThickness', '0.1', '0.11', '0.1'], ['minHeight', '2', '2.05', '2'],
      ['nestedTabSpacing', '0.1', '0.2', '0.1'], ['exitTabHorizontalPadding', '-0.5', '-0.4', '-0.5'], ['qcExitMarkerSize', '3.3', '3.35', '3.3']]) {
      const input = h.byId(id); input.value = start; h.api.sync(); h.fire(h.up(id), 'click'); assert.equal(input.value, up);
      h.fire(h.down(id), 'click'); assert.equal(input.value, down);
      input.value = input.max; h.api.sync(); assert.equal(h.up(id).disabled, true); h.fire(h.up(id), 'click'); assert.equal(input.value, input.max);
      input.value = input.min; h.api.sync(); assert.equal(h.down(id).disabled, true); h.fire(h.down(id), 'click'); assert.equal(input.value, input.min);
    }
  });
  test(`${name}: stepping retains inline input formatting and commits through the original change handler`, () => {
    const h = ui(source), input = h.byId('minHeight'); input.value = '2'; h.api.sync(); h.calls.length = 0;
    h.fire(h.up('minHeight'), 'click');
    assert.equal(h.byId('minValue').innerHTML, '2.0');
    assert.equal(h.calls.length, 2); assert.equal(h.calls[0].options.target, input); assert.equal(h.calls[0].options.deferHistoryEnd, true);
    assert.equal(h.calls[1].options, undefined); assert.equal(h.calls[1].values.minHeight, '2.05');
    h.document.activeElement = input; input.value = '2.1'; h.fire(input, 'input');
    assert.equal(h.calls.at(-1).values.minHeight, '2.1'); h.fire(input, 'blur'); assert.equal(h.historyEnds(), 1);
  });
  test(`${name}: changing to an icon or logo uses live bounds, labels, and decimal steps`, () => {
    const h = ui(source), input = h.byId('fontSize');
    input.min = '1'; input.max = '6'; input.step = '0.1'; input.value = '3';
    h.byId('fontSizeLabel').textContent = 'Icon Size (rem):'; h.api.sync(); h.fire(h.up('fontSize'), 'click');
    assert.equal(input.value, '3.1'); assert.equal(input.getAttribute('aria-label'), 'Icon Size (rem):');
    assert.equal(h.up('fontSize').getAttribute('aria-label'), 'Increase Icon Size (rem):');
    input.min = '10'; input.max = '40'; input.step = '1'; input.value = '18'; h.api.sync(); h.fire(h.up('fontSize'), 'click');
    assert.equal(input.value, '19');
  });
  test(`${name}: invalid typing waits for commit and is normalized before the model reads it`, () => {
    const h = ui(source), input = h.byId('minHeight'); h.document.activeElement = input; input.value = '2.5'; h.fire(input, 'input');
    h.calls.length = 0; input.value = ''; h.fire(input, 'input'); assert.equal(h.calls.length, 0);
    h.fire(input, 'change'); assert.equal(input.value, '2.5'); assert.equal(h.calls.at(-1).values.minHeight, '2.5');
    input.value = '9'; h.fire(input, 'change'); assert.equal(input.value, '5'); assert.equal(h.calls.at(-1).values.minHeight, '5');
    input.value = '-1'; h.fire(input, 'change'); assert.equal(input.value, '0');
    input.value = '1.23'; h.fire(input, 'blur'); assert.equal(input.value, '1.25'); assert.equal(h.calls.at(-1).values.minHeight, '1.25');
  });
  test(`${name}: radius inheritance and the existing reset handlers still control the original field`, () => {
    const h = ui(source), input = h.byId('exitTabCornerRadius'), inherit = h.byId('exitTabUsePanelCornerRadius');
    input.disabled = true; h.api.sync(); const start = input.value; assert.equal(h.up(input.id).disabled, true);
    h.fire(h.up(input.id), 'click'); assert.equal(input.value, start);
    assert.ok(inherit.closest('.mobileExitRadiusInheritance'));
    h.byId('squareCorners').checked = false; inherit.checked = false; h.fire(inherit, 'change'); h.api.sync();
    h.fire(h.up(input.id), 'click'); assert.equal(input.value, '0.8');
    const reset = h.byId('exitTabCornerRadiusReset'); reset.addEventListener('click', () => { input.value = '0.5'; h.fire(input, 'change'); });
    h.fire(reset, 'click'); assert.equal(h.calls.at(-1).values.exitTabCornerRadius, '0.5');
    const fullBorder = h.byId('fullBorder'); assert.equal(fullBorder.parentElement.htmlFor, 'fullBorder');
    assert.equal(h.byId('exitTabTransparent').parentElement.classList.contains('assetHiddenSetting'), true);
  });
  test(`${name}: returning to desktop restores original input positions, labels, types, and checkbox order`, () => {
    const h = ui(source), originalRadiusLabel = 'Set Corner Radius (rem):';
    h.api.setActive(false);
    assert.equal(h.tree.querySelectorAll('.mobileExitStepper').length, 0);
    for (const original of h.originals) {
      assert.equal(original.input.type, original.type); assert.equal(original.input.parentElement, original.parent);
      assert.deepEqual(original.parent.childNodes, original.children);
    }
    assert.equal(h.byId('exitTabUsePanelCornerRadius').parentElement, h.inheritParent);
    assert.equal(h.inheritParent.querySelector('label').textContent, originalRadiusLabel);
    assert.deepEqual(h.panel.childNodes, h.checkOrder);
    h.calls.length = 0; const input = h.byId('minHeight'); input.value = '3'; h.fire(input, 'input'); assert.equal(h.calls.length, 0);
    h.api.setActive(true); h.api.setActive(true); assert.equal(h.tree.querySelectorAll('.mobileExitStepper').length, 9);
    h.fire(h.up('minHeight'), 'click'); assert.equal(input.value, '3.05'); assert.equal(h.calls.length, 2);
  });
}
