/* Search changes the menu view without changing its source options or value. */
window.SignMakerPickerSearch = (() => {
  const normalize = text => String(text || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const matches = (text, query) => String(query || '').trim().split(/\s+/).every(word => normalize(text).includes(normalize(word)));
  const navigators = new WeakMap();
  const navigate = (input, key) => navigators.get(input)?.(key);
  const typeInto = (input, key) => {
    input.value += key;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
  };
  const filterTree = (nodes, query) => {
    if (!String(query || '').trim()) return { nodes, expanded: [] };
    const expanded = [];
    const visit = (entries, parents = []) => entries.flatMap(node => {
      const path = parents.concat([node.label, node.value].filter(Boolean));
      const children = node.children ? visit(node.children, path) : [];
      if (!matches(path.join(' '), query) && !children.length) return [];
      if (children.length && node.id) expanded.push(node.id);
      return [{ ...node, ...(node.children ? { children } : {}) }];
    });
    return { nodes: visit(nodes), expanded };
  };
  const create = ({ menu, label, onChange, onClose, items }) => {
    const bar = document.createElement('div');
    bar.className = 'pickerSearchBar';
    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'pickerSearchInput';
    input.placeholder = 'Search ' + label.toLowerCase() + '…';
    input.setAttribute('aria-label', 'Search ' + label.toLowerCase());
    for (const [key, value] of [['autocomplete', 'off'], ['autocorrect', 'off'], ['autocapitalize', 'off'], ['spellcheck', 'false']]) input.setAttribute(key, value);
    input.dataset.editorBehaviorBound = 'true';
    bar.appendChild(input);
    menu.prepend(bar);
    const empty = document.createElement('div');
    empty.className = 'pickerSearchEmpty';
    empty.textContent = 'No matching ' + label.toLowerCase();
    empty.setAttribute('role', 'status');
    empty.hidden = true;
    menu.appendChild(empty);
    menu.classList.add('searchablePicker');
    const query = () => input.value.trim();
    const setCount = count => { empty.hidden = count !== 0; };
    const filterItems = (content, selector = '.fontPickerItem') => {
      let count = 0;
      for (const item of content.querySelectorAll(selector)) {
        const family = item.closest('.fontPickerFamilyBlock')?.querySelector('.fontPickerFamilyHeader')?.textContent || '';
        item.hidden = !matches([family, item.textContent, item.dataset.fontValue, item.dataset.familyValue, item.dataset.searchText].filter(Boolean).join(' '), query());
        if (!item.hidden) count++;
      }
      for (const group of content.querySelectorAll('.fontPickerFamilyBlock')) {
        group.hidden = !Array.from(group.querySelectorAll(selector)).some(item => !item.hidden);
      }
      setCount(count);
      return count;
    };
    input.addEventListener('input', event => { event.stopPropagation(); onChange(query()); });
    input.addEventListener('search', event => { event.stopPropagation(); onChange(query()); });
    bar.addEventListener('pointerdown', event => event.stopPropagation());
    bar.addEventListener('click', event => event.stopPropagation());
    navigators.set(input, key => {
      const choices = items().filter(item => !item.hidden && !item.disabled && !item.closest('[hidden]'));
      if (!choices.length) return false;
      const current = choices.indexOf(document.activeElement);
      const index = key === 'Home' ? 0 : key === 'End' ? choices.length - 1 : key === 'ArrowUp'
        ? (current <= 0 ? choices.length - 1 : current - 1) : (current + 1) % choices.length;
      choices[index].focus({ preventScroll: true });
      choices[index].scrollIntoView({ block: 'nearest' });
      return true;
    });
    menu.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.isComposing) return;
      const typing = event.target === input;
      if (!typing && !event.ctrlKey && !event.altKey && !event.metaKey &&
          event.key !== ' ' && window.SignMakerDropdowns?.textKey?.(event.key)) {
        event.preventDefault(); event.stopPropagation();
        typeInto(input, event.key);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation();
        if (query()) { input.value = ''; onChange(''); input.focus(); }
        else onClose?.();
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault(); event.stopPropagation();
        if (!typing) event.target.click?.();
        else if (query()) items().find(item => !item.hidden && !item.disabled)?.click();
        return;
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || (typing && ['Home', 'End'].includes(event.key))) return;
      if (navigate(input, event.key)) { event.preventDefault(); event.stopPropagation(); }
    });
    return { input, get query() { return query(); }, filterItems, setCount,
      reset({ notify = true } = {}) { input.value = ''; empty.hidden = true; if (notify) onChange(''); } };
  };
  return { create, matches, filterTree, typeInto, navigate };
})();
