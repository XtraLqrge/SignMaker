/* Resolve the stylesheet cascade for DOM fixtures without simulating box layout. */
const css = require('../vendor/css-tree.cjs');
const list = node => node.children || [];
const selectors = node => list(node).flatMap(child => child.type === 'SelectorList' ? list(child) : child.type === 'Selector' ? [child] : []);
const specificity = node => {
  if (node.type === 'IdSelector') return 1000000;
  if (['ClassSelector', 'AttributeSelector'].includes(node.type)) return 1000;
  if (node.type === 'TypeSelector') return node.name === '*' ? 0 : 1;
  if (node.type === 'PseudoClassSelector') {
    if (node.name === 'where') return 0;
    if (['is', 'not', 'has'].includes(node.name)) return Math.max(0, ...selectors(node).map(specificity));
    return 1000;
  }
  return list(node).reduce((sum, child) => sum + specificity(child), 0);
};
const attribute = (node, name) => {
  if (name === 'id') return node.id || null;
  if (name === 'class') return node.className || null;
  if (['type', 'hidden', 'disabled', 'checked', 'open'].includes(name)) return typeof node[name] === 'boolean' ? node[name] ? '' : null : node[name] || null;
  return node.getAttribute(name);
};
function compound(parts, node) {
  if (!node || node.nodeType !== 1) return false;
  return parts.every(part => {
    if (part.type === 'TypeSelector') return part.name === '*' || node.tagName === part.name.toUpperCase();
    if (part.type === 'IdSelector') return node.id === part.name;
    if (part.type === 'ClassSelector') return node.classList.contains(part.name);
    if (part.type === 'AttributeSelector') {
      const actual = attribute(node, part.name.name), expected = part.value?.value ?? part.value?.name ?? '';
      if (actual === null) return false;
      if (!part.matcher) return true;
      if (part.matcher === '=') return actual === expected;
      if (part.matcher === '^=') return actual.startsWith(expected);
      if (part.matcher === '$=') return actual.endsWith(expected);
      if (part.matcher === '*=') return actual.includes(expected);
      if (part.matcher === '~=') return actual.split(/\s+/).includes(expected);
      return false;
    }
    if (part.type === 'PseudoClassSelector') {
      if (['is', 'where'].includes(part.name)) return selectors(part).some(selector => matches(selector, node));
      if (part.name === 'not') return !selectors(part).some(selector => matches(selector, node));
      if (part.name === 'root') return node.tagName === 'HTML';
      if (part.name === 'disabled') return !!node.disabled;
      if (part.name === 'only-child') return node.parentElement?.children.length === 1;
      if (part.name === 'first-child') return node.parentElement?.children[0] === node;
      if (part.name === 'last-child') return node.parentElement?.children.at(-1) === node;
      if (part.name === 'checked') return !!node.checked;
      return false;
    }
    return false;
  });
}
function matches(selector, node) {
  const parts = list(selector);
  const check = (end, target) => {
    let split = end - 1;
    while (split >= 0 && parts[split].type !== 'Combinator') split--;
    if (!compound(parts.slice(split + 1, end), target)) return false;
    if (split < 0) return true;
    const combinator = parts[split].name;
    if (combinator === '>') return check(split, target.parentElement);
    if (combinator === ' ') { for (let parent = target.parentElement; parent; parent = parent.parentElement) if (check(split, parent)) return true; }
    return false;
  };
  return check(parts.length, node);
}
function cascade(source) {
  const ast = css.toPlainObject(css.parse(source)), rules = [];
  const collect = nodes => {
    for (const node of nodes) {
      if (node.type === 'Rule' && node.prelude?.type === 'SelectorList') {
        for (const selector of list(node.prelude)) rules.push({ selector, specificity: specificity(selector), declarations: list(node.block).filter(item => item.type === 'Declaration') });
      } else if (node.type === 'Atrule' && node.block && node.name === 'layer') collect(list(node.block));
    }
  };
  collect(list(ast));
  return (node, property) => {
    let winner;
    for (const rule of rules) {
      const declarations = rule.declarations.filter(declaration => declaration.property === property);
      if (!declarations.length || !matches(rule.selector, node)) continue;
      for (const declaration of declarations) {
        const score = (declaration.important ? 1e12 : 0) + rule.specificity;
        if (!winner || score >= winner.score) winner = { score, value: css.generate(css.fromPlainObject(declaration.value)) };
      }
    }
    return winner?.value;
  };
}
module.exports = { cascade };
