const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const manifest = JSON.parse(read('build-manifest.json'));
const sources = ['public/js/MobileGestures.js', 'public/' + manifest.assets.find(a => a.source === 'js/MobileGestures.js').output];
class Node {
  constructor(classes = '', index, rect = {}) {
    this.classes = new Set(classes.split(' ')); this.dataset = {}; this.parent = null; this.isConnected = true; this.events = [];
    this.style = { setProperty() {}, removeProperty() {} };
    this.classList = { contains: name => this.classes.has(name), add: (...names) => names.forEach(n => this.classes.add(n)), remove: (...names) => names.forEach(n => this.classes.delete(n)) };
    if (index != null) this.dataset.panelIndex = String(index);
    this.rect = { left: 0, top: 0, right: 100, bottom: 50, width: 100, height: 50, ...rect };
  }
  closest(selector) { for (let node = this; node; node = node.parent) if (selector === 'input[type="range"]' ? node.type === 'range' : node.classes.has(selector.slice(1))) return node; return null; }
  contains(target) { for (; target; target = target.parent) if (target === this) return true; return false; }
  getBoundingClientRect() { return this.rect; }
  dispatchEvent(event) { this.events.push(event.type); }
}
function harness(source, whole = true, models = [{}, {}, {}]) {
  const listeners = new Map(), timers = new Map(), panels = [], list = [], moves = [], selections = [], scrolls = [];
  const rootNode = new Node(), canvas = new Node(), range = new Node();
  Object.assign(range, { type: 'range', value: '50', min: '0', max: '100', step: '1', disabled: false });
  models.forEach((model, index) => {
    const node = new Node('panel', index, { left: index * 120, right: index * 120 + 100 }); node.parent = canvas; panels.push(node);
    list.push(new Node('panelListButton', index, { top: 100 + index * 60, bottom: 150 + index * 60 }));
  });
  let active = true, nextTimer = 0;
  const document = { documentElement: rootNode, addEventListener: (type, fn) => listeners.set(type, fn), querySelectorAll: selector => {
    if (selector === '.panelListButton') return list;
    if (selector === '#panelContainer .panel') return panels;
    return [...list, ...panels].filter(node => selector.split(', ').some(s => node.classes.has(s.slice(1))));
  } };
  const window = { navigator: { vibrate() {} }, innerHeight: 852, getComputedStyle: () => ({ direction: 'ltr' }),
    setTimeout: fn => { timers.set(++nextTimer, fn); return nextTimer; }, clearTimeout: id => timers.delete(id),
    scrollBy: (...args) => scrolls.push(args), addEventListener: (type, fn) => listeners.set(type, fn) };
  vm.runInNewContext(read(source), { window, document, Event, Date });
  const api = window.SignMakerMobileGestures;
  api.install({ canvas, getApp: () => ({ getPost: () => ({ panels: models }), movePanel: (...args) => moves.push(args) }),
    isActive: () => active, isWholePost: () => whole, selectPanel: index => selections.push(index) });
  const fire = (type, target, options = {}) => {
    const event = { target, pointerId: 1, pointerType: 'touch', button: 0, clientX: 20, clientY: 20, cancelable: true,
      preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...options };
    listeners.get(type)?.(event); return event;
  };
  return { api, window, panels, list, range, moves, selections, scrolls, rootNode, fire,
    hold: () => { for (const fn of [...timers.values()]) fn(); timers.clear(); }, setActive: value => active = value };
}
for (const source of sources) {
  const label = source.includes('.js') && source === sources[0] ? 'source' : 'production';
  test(`${label}: vertical range swipes and taps never change a slider`, () => {
    const h = harness(source);
    assert.equal(h.fire('pointerdown', h.range).prevented, true);
    h.fire('pointermove', h.range, { clientY: 70 }); h.fire('pointerup', h.range);
    assert.equal(h.range.value, '50'); assert.deepEqual(h.range.events, []);
    h.fire('pointerdown', h.range); h.fire('pointerup', h.range);
    assert.equal(h.range.value, '50'); assert.deepEqual(h.range.events, []);
  });
  test(`${label}: intentional horizontal range movement commits live input and one change`, () => {
    const h = harness(source);
    h.fire('pointerdown', h.range); h.fire('pointermove', h.range, { clientX: 39 });
    assert.equal(h.range.value, '75');
    h.fire('pointermove', h.range, { clientX: 58 }); h.fire('pointerup', h.range);
    assert.equal(h.range.value, '100'); assert.deepEqual(h.range.events, ['input', 'input', 'change']);
    assert.equal(h.api.rangeValue({ min: '-0.15', max: '0.15', step: '0.01' }, 0, 10, 100), '0.04');
  });
  test(`${label}: mouse ranges and desktop gestures retain their native behavior`, () => {
    const h = harness(source);
    assert.equal(h.fire('pointerdown', h.range, { pointerType: 'mouse' }).prevented, undefined);
    h.setActive(false); h.fire('pointerdown', h.panels[0]); h.hold();
    assert.equal(h.panels[0].classes.has('mobilePanelMoving'), false);
  });
  test(`${label}: scrolling cancels a pending panel hold without reordering`, () => {
    const h = harness(source);
    h.fire('pointerdown', h.list[0]); h.fire('pointermove', h.list[0], { clientY: 70 }); h.hold(); h.fire('pointerup', h.list[0]);
    assert.equal(h.rootNode.classes.has('mobilePanelDragActive'), false); assert.deepEqual(h.moves, []);
  });
  test(`${label}: held panel list boxes reorder vertically and suppress the following tap`, () => {
    const h = harness(source);
    h.fire('pointerdown', h.list[0], { clientY: 120 }); h.hold();
    assert.equal(h.list[0].classes.has('mobilePanelMoving'), true);
    assert.equal(h.fire('touchmove', h.list[0]).prevented, true);
    h.fire('pointermove', h.list[0], { clientY: 280 });
    assert.equal(h.list[2].classes.has('mobileDropAfter'), true);
    h.fire('pointerup', h.list[0]);
    assert.deepEqual(h.moves, [[0, 3]]); assert.equal(h.rootNode.classes.has('mobilePanelDragActive'), false);
    assert.equal(h.fire('click', h.list[0]).stopped, true); assert.deepEqual(h.selections, []);
  });
  test(`${label}: held panel lists scroll their sheet instead of the fixed page`, () => {
    const h = harness(source);
    const sheet = { scrollTop: 100, getBoundingClientRect: () => ({ top: 300, bottom: 800 }) };
    const closest = h.list[0].closest.bind(h.list[0]);
    h.list[0].closest = selector => selector === '#mobileEditor' ? sheet : closest(selector);
    h.fire('pointerdown', h.list[0], { clientY: 400 }); h.hold();
    h.fire('pointermove', h.list[0], { clientY: 790 });
    assert.ok(sheet.scrollTop > 100, 'Dragging near the sheet bottom reveals more panels');
    const afterDown = sheet.scrollTop;
    h.fire('pointermove', h.list[0], { clientY: 320 });
    assert.ok(sheet.scrollTop < afterDown, 'Dragging near the sheet top scrolls back');
    assert.deepEqual(h.scrolls, [], 'The page behind the sheet stays fixed');
    h.fire('pointerup', h.list[0]);
  });
  test(`${label}: whole-post panels shake after a hold and move horizontally as stack groups`, () => {
    const h = harness(source, true, [{}, { stackedWithPrevious: true }, {}]);
    h.fire('pointerdown', h.panels[1], { clientX: 150 }); h.hold();
    assert.ok(h.panels.every(p => p.classes.has('mobilePanelWiggle')));
    h.fire('pointermove', h.panels[1], { clientX: 350 }); h.fire('pointerup', h.panels[1]);
    assert.deepEqual(h.moves, [[1, 3]]);
    assert.equal(h.api.groupStart([{},{stackedWithPrevious:true},{}], 1), 0);
    assert.equal(h.api.groupEnd([{},{stackedWithPrevious:true},{}], 0), 2);
  });
  test(`${label}: touch list dragging survives a cancelled pointer stream and ends with the touch`, () => {
    const h = harness(source);
    h.fire('pointerdown', h.list[0], { clientY: 120 }); h.hold(); h.fire('pointercancel', h.list[0]);
    const movement = h.fire('touchmove', h.list[0], { touches: [{ clientX: 20, clientY: 280 }] });
    assert.equal(movement.prevented, true);
    h.fire('touchend', h.list[0], { touches: [] });
    assert.deepEqual(h.moves, [[0, 3]]);
    assert.equal(h.rootNode.classes.has('mobilePanelDragActive'), false);
  });
  test(`${label}: a whole-post tap selects only its panel, leaving element editing for the next tap`, () => {
    const h = harness(source), text = new Node(); text.parent = h.panels[1];
    h.fire('pointerdown', text); h.fire('pointerup', text);
    assert.equal(h.fire('click', text).stopped, true); assert.deepEqual(h.selections, [1]); assert.deepEqual(h.moves, []);
    const single = harness(source, false);
    assert.equal(single.fire('click', single.panels[1]).stopped, undefined); assert.deepEqual(single.selections, []);
  });
  test(`${label}: interruption cancels a held drag without mutating the post`, () => {
    const h = harness(source);
    h.fire('pointerdown', h.panels[0]); h.hold(); h.fire('pointermove', h.panels[0], { clientX: 350 });
    h.fire('pointercancel', h.panels[0]); assert.deepEqual(h.moves, []);
    assert.ok(h.panels.every(p => !p.classes.has('mobilePanelWiggle')));
  });
}
