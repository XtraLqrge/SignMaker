class Node {
  constructor(tag = 'div', text = '') {
    this.tagName = tag.toUpperCase(); this.nodeType = tag === '#comment' ? 8 : tag === '#text' ? 3 : 1;
    this.childNodes = []; this.parentElement = null; this.attrs = new Map(); this.events = new Map(); this.style = { display: '' };
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
    else if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    else if (['id', 'name', 'type', 'value', 'min', 'max', 'step'].includes(key)) this[key] = value;
    else if (['disabled', 'hidden', 'checked'].includes(key)) this[key] = true;
  }
  getAttribute(key) { return this.attrs.get(key) ?? null; }
  removeAttribute(key) { this.attrs.delete(key); if(['id','min','max','step'].includes(key)) this[key]=''; }
  matches(selector) {
    const simple = (node, query) => {
      if (node.nodeType !== 1) return false;
      const tag = query.match(/^[a-z][a-z0-9-]*/i)?.[0]; if (tag && node.tagName !== tag.toUpperCase()) return false;
      for (const [, key, value] of query.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
        if (value === undefined ? !node.attrs.has(key) : String(key === 'for' ? node.htmlFor : node[key] ?? node.getAttribute(key)) !== value) return false;
      }
      return [...query.replace(/\[[^\]]*\]/g, '').matchAll(/([.#])([\w-]+)/g)].every(([, kind, name]) => kind === '#' ? node.id === name : node.classes.has(name));
    };
    return selector.split(',').some(part => {
      const chain = part.trim().replace(/\s*>\s*/g, ' > ').split(/\s+(?![^[]*\])/); let node = this;
      if (!simple(node, chain.pop())) return false;
      while (chain.length) {
        const query = chain.pop();
        if (query === '>') { node = node.parentElement; if (!node || !simple(node, chain.pop())) return false; }
        else { do { node = node.parentElement; } while (node && !simple(node, query)); if (!node) return false; }
      }
      return true;
    });
  }
  get isConnected() { return this.tagName === 'HTML' || !!this.parentElement?.isConnected; }
  contains(target) { for(let node=target;node;node=node.parentElement) if(node===this) return true; return false; }
  hasAttribute(key) { return this.attrs.has(key); }
  removeEventListener(type, handler, capture=false) { this.events.set(type, (this.events.get(type)||[]).filter(item=>item.handler!==handler||item.capture!==capture)); }
  closest(selector) { for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node; return null; }
  querySelectorAll(selector) { return this.childNodes.flatMap(node => [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  append(...nodes) { for (const node of nodes) { node.remove(); this.childNodes.push(node); node.parentElement = this; } }
  appendChild(node) { this.append(node); return node; }
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
    if(event.bubbles && !event.stopped && this.parentElement) this.parentElement.bubble(event);
    return !event.defaultPrevented;
  }
  bubble(event) { for(const item of this.events.get(event.type)||[]) item.handler.call(this,event); if(!event.stopped) this.parentElement?.bubble(event); }
  get validity() { return { badInput: this.value !== '' && !Number.isFinite(Number(this.value)) }; }
  checkValidity() {
    const value = Number(this.value), min = this.min === '' ? -Infinity : Number(this.min), max = this.max === '' ? Infinity : Number(this.max);
    const step = Number(this.step || 1), index = (value - (Number.isFinite(min) ? min : 0)) / step;
    return this.disabled || this.value !== '' && Number.isFinite(value) && value >= min && value <= max && (this.step === 'any' || Math.abs(index - Math.round(index)) < 1e-7);
  }
}
function parse(source) {
  const document = new Node('html'), stack = [document];
  for (const match of source.matchAll(/<!--[\s\S]*?-->|<\/[\w-]+\s*>|<[\w-]+\b[^>]*>|[^<]+/g)) {
    const token = match[0];
    if (token.startsWith('<!--')) continue;
    if (token.startsWith('</')) { const name=token.match(/^<\/([\w-]+)/)[1].toUpperCase(); while(stack.length>1 && stack.at(-1).tagName!==name) stack.pop(); if(stack.length>1)stack.pop(); continue; }
    if (!token.startsWith('<')) { stack.at(-1).append(new Node('#text', token)); continue; }
    const tag = token.match(/^<([\w-]+)/)[1], node = new Node(tag);
    for (const [, key, double, single, bare] of token.slice(tag.length + 1, -1).matchAll(/([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      node.setAttribute(key, double ?? single ?? bare ?? '');
    }
    stack.at(-1).append(node);
    if (!token.endsWith('/>') && !['input', 'br', 'img', 'hr', 'meta', 'link', 'source'].includes(tag)) stack.push(node);
  }
  return document;
}
class Event {
  constructor(type, options = {}) { this.type = type; Object.assign(this, options); }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this.stopped = true; }
}

module.exports = { Node, Event, parse };
