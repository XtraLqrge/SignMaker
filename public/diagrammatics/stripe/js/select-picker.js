// Adapted from SignalMaker/js/native-select.js and its head indication picker.
// Original SignMaker/SignalMaker floating-picker styling and interactions, GPL-3.0.
// StripeMaker adds automatic enhancement, dynamic-control cleanup and dialog support.
(() => {
  const app = window.StripeMaker ??= {};
  const escape = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let current = null;
  const pickers = new Map();
  let sequence = 0;
  app.createNativeSelectPicker = (select, label, { colorForValue, textStyleForValue, iconForValue, minMenuWidth = 180 } = {}) => {
    const id = `native-select-${++sequence}`;
    const lifetime=new AbortController(),signal=lifetime.signal;
    const listen=(target,type,callback,capture=false)=>target.addEventListener(type,callback,{capture,signal});
    let api;
    const wrapper = document.createElement('div');
    wrapper.className = 'symbolPicker dimensionInputs';
    if(!select.id)select.id=`${id}-source`;
    const trigger = document.createElement('button');
    trigger.id = `${select.id}-button`;
    trigger.type = 'button';
    trigger.className = 'nativeSelectTrigger';
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-controls', id);
    trigger.setAttribute('aria-expanded', 'false');
    const swatchMarkup = colorForValue ? '<span class="colorPickerSwatch" aria-hidden="true"></span>' : '';
    const iconMarkup = iconForValue ? '<span class="nativeSelectIcon" aria-hidden="true"></span>' : '';
    trigger.innerHTML = swatchMarkup + iconMarkup + '<span class="symbolPickerLabel"></span><svg class="symbolPickerCaret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.25 9.25l4.75 4.75 4.75-4.75"/></svg>';
    wrapper.append(trigger);
    select.classList.add('pickerSource');
    select.tabIndex=-1;
    select.setAttribute('aria-hidden','true');
    select.insertAdjacentElement('afterend', wrapper);
    const menu = document.createElement('div');
    menu.id = id;
    menu.className = 'symbolPickerMenu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', label);
    menu.setAttribute('aria-hidden', 'true');
    menu.inert = true;
    document.body.append(menu);
    let open = false;
    let active = 0;
    let pointer = null;
    let pointerClick = false;
    const entries = () => [...select.options].filter(option => !option.hidden && !option.closest('optgroup[hidden]'));
    const disabled = option => option.disabled || option.parentElement?.disabled;
    const labelText = () => select.getAttribute('aria-label') || [...(select.labels??[])].map(l=>l.textContent.trim()).join(' ') || label;
    function updateLabel(element, option) {
      const text=option?.textContent??'';
      if(element.textContent!==text)element.textContent=text;
      if (textStyleForValue) Object.assign(element.style, textStyleForValue(option?.value));
    }
    // SignMaker's square swatches, including its checkerboard/slash for
    // transparent colors. Keep palette colors unchanged in either theme.
    function updateSwatch(element, value) {
      if (!colorForValue) return;
      const color = colorForValue(value);
      element.style.background = color || '';
      element.classList.toggle('specialColorSwatch', !color);
    }

    function close(restoreFocus = false) {
      open = false;
      if(current===api)current=null;
      pointer = null;
      wrapper.classList.remove('open');
      menu.classList.remove('open');
      menu.setAttribute('aria-hidden', 'true');
      menu.inert = true;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.removeAttribute('aria-activedescendant');
      if (restoreFocus && trigger.isConnected && !trigger.disabled) trigger.focus({ preventScroll: true });
    }
    function position() {
      if (!open) return;
      if (!trigger.isConnected || !trigger.getClientRects().length) { close(); return; }
      const rect = trigger.getBoundingClientRect();
      const edge = 8, gap = 3;
      const width = Math.min(Math.max(rect.width, minMenuWidth), window.innerWidth - edge * 2);
      const below = Math.max(0, window.innerHeight - rect.bottom - edge - gap);
      const above = Math.max(0, rect.top - edge - gap);
      const upwards = below < Math.min(menu.scrollHeight, 200) && above > below;
      const height = Math.min(menu.scrollHeight, window.innerHeight * 0.65, upwards ? above : below);
      Object.assign(menu.style, { width: `${width}px`, maxHeight: `${height}px`,
        left: `${Math.max(edge, Math.min(rect.left, window.innerWidth - width - edge))}px`,
        top: `${upwards ? rect.top - gap - height : rect.bottom + gap}px` });
      menu.classList.toggle('opensUp', upwards);
    }
    function highlight(index) {
      const options = entries();
      if(!options.length)return;
      const direction=index<active?-1:1;
      active = (index + options.length) % options.length;
      for(let tries=0;tries<options.length&&disabled(options[active]);tries++)active=(active+direction+options.length)%options.length;
      const row = menu.children[active];
      if (!row) return;
      [...menu.children].forEach((item, itemIndex) => item.classList.toggle('active', itemIndex === active));
      trigger.setAttribute('aria-activedescendant', row.id);
      if (row.offsetTop < menu.scrollTop) menu.scrollTop = row.offsetTop;
      else if (row.offsetTop + row.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = row.offsetTop + row.offsetHeight - menu.clientHeight;
    }
    function sync() {
      const options = entries();
      const option = options.find(item => item.value === select.value);
      updateLabel(trigger.querySelector('.symbolPickerLabel'), option);
      if(iconForValue)trigger.querySelector('.nativeSelectIcon').innerHTML=iconForValue(select.value);
      if (colorForValue) updateSwatch(trigger.querySelector('.colorPickerSwatch'), select.value);
      trigger.setAttribute('aria-label', `${labelText()}: ${option?.textContent??''}`);
      menu.setAttribute('aria-label',labelText());
      wrapper.hidden=select.hidden;
      for(const attr of ['aria-describedby','title','data-help']){const value=select.getAttribute(attr);if(value!==null)trigger.setAttribute(attr,value);else trigger.removeAttribute(attr);}
      trigger.disabled = select.matches(':disabled');
      if (trigger.disabled || wrapper.hidden) close();
      if (open) {
        [...menu.children].forEach((row, index) => {
          updateLabel(row.querySelector('.symbolPickerLabel'), options[index]);
          if(iconForValue)row.querySelector('.nativeSelectIcon').innerHTML=iconForValue(options[index]?.value);
          const selected = options[index]?.value === select.value;
          row.classList.toggle('selected', selected);
          row.setAttribute('aria-selected', String(selected));
          row.querySelector('.symbolPickerCheck').textContent = selected ? '✓' : '';
          if (colorForValue) updateSwatch(row.querySelector('.colorPickerSwatch'), options[index]?.value);
        });
        position();
      }
    }
    function show() {
      sync();
      if (trigger.disabled || !entries().length) return;
      if(current&&current!==api)current.close();
      current=api;
      // Modal dialogs live in the browser top layer; their menu must live there too.
      (select.closest('dialog[open]')??document.body).append(menu);
      const options = entries();
      menu.innerHTML = options.map((option, index) => `<button type="button" id="${id}-${index}" class="symbolPickerItem${option.value === select.value ? ' selected' : ''}" role="option" aria-selected="${option.value === select.value}" tabindex="-1" data-native-index="${index}" ${disabled(option) ? 'disabled aria-disabled="true"' : ''}>${swatchMarkup}${iconMarkup}<span class="symbolPickerLabel">${escape(option.textContent)}</span><span class="symbolPickerCheck" aria-hidden="true">${option.value === select.value ? '✓' : ''}</span></button>`).join('');
      open = true;
      wrapper.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
      menu.setAttribute('aria-hidden', 'false');
      menu.inert = false;
      sync();
      void menu.offsetHeight;
      menu.classList.add('open');
      highlight(Math.max(0, options.findIndex(option => option.value === select.value)));
      trigger.focus({ preventScroll: true });
    }
    function choose(index) {
      const option = entries()[index];
      if (!option || disabled(option) || trigger.disabled) return;
      close(true);
      if (select.value === option.value) return;
      select.value = option.value;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      sync();
    }
    listen(trigger, 'pointerdown', event => {
      if (event.button !== 0 || event.pointerType === 'touch' || trigger.disabled) return;
      event.preventDefault();
      if (open) close();
      else { show(); pointer = event.pointerId; }
      pointerClick = true;
    });
    listen(trigger, 'click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (pointerClick && event.detail !== 0) { pointerClick = false; return; }
      pointerClick = false;
      if (open) close(); else show();
    });
    listen(menu, 'pointerdown', event => {
      if (event.button !== 0 || event.pointerType === 'touch' || !event.target.closest('[data-native-index]')) return;
      event.preventDefault();
      pointer = event.pointerId;
    });
    listen(menu, 'pointermove', event => {
      const row = event.target.closest('[data-native-index]');
      if (open && row && event.pointerType !== 'touch') highlight(Number(row.dataset.nativeIndex));
    });
    listen(menu, 'click', event => {
      event.stopPropagation();
      const row = event.target.closest('[data-native-index]');
      if (open && row) choose(Number(row.dataset.nativeIndex));
    });
    const hit = event => document.elementFromPoint(event.clientX, event.clientY) || event.target;
    listen(document, 'pointermove', event => {
      if (pointer === null || pointer !== event.pointerId) return;
      const row = hit(event)?.closest('[data-native-index]');
      if (row && menu.contains(row)) highlight(Number(row.dataset.nativeIndex));
    }, true);
    listen(document, 'pointerup', event => {
      if (pointer === null || pointer !== event.pointerId) return;
      pointer = null;
      const target = hit(event);
      const row = target?.closest('[data-native-index]');
      if (row && menu.contains(row)) { event.preventDefault(); choose(Number(row.dataset.nativeIndex)); }
      else if (!trigger.contains(target)) close(true);
    }, true);
    listen(document, 'pointercancel', event => {
      if (pointer === null || pointer !== event.pointerId) return;
      pointerClick = false;
      close(true);
    }, true);
    listen(document, 'pointerdown', event => {
      if (open && !wrapper.contains(event.target) && !menu.contains(event.target)) close();
    }, true);
    listen(window, 'keydown', event => {
      if(event.target!==trigger && !(open&&event.key==='Escape'))return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || trigger.disabled) return;
      if (event.key === 'Tab') { close(); return; }
      if (event.key === 'Escape' && open) { event.preventDefault(); event.stopImmediatePropagation(); close(true); return; }
      if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        if (!open) { show(); return; }
        highlight(event.key === 'Home' ? 0 : event.key === 'End' ? entries().length - 1 : active + (event.key === 'ArrowDown' ? 1 : -1));
      } else if (['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        if (open) choose(active); else show();
      } else if (event.key.length === 1) {
        const index = entries().findIndex(option => !disabled(option)&&option.textContent.toLowerCase().startsWith(event.key.toLowerCase()));
        if (index < 0) return;
        event.preventDefault();
        if (open) highlight(index); else choose(index);
      }
    }, true);
    for (const element of select.labels ?? []) listen(element, 'click', event => { event.preventDefault(); trigger.focus(); });
    listen(select, 'change', sync);
    listen(window, 'resize', position);
    listen(window, 'scroll', position, true);
    const observer=new MutationObserver(()=>{if(open)close();sync();});
    observer.observe(select,{attributes:true,childList:true,subtree:true,characterData:true});
    // App editors assign values without emitting change. Preserve that API and
    // synchronize the visible trigger without introducing an undo step.
    for(const property of ['value','selectedIndex']){
      const descriptor=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,property);
      Object.defineProperty(select,property,{configurable:true,get(){return descriptor.get.call(this);},set(value){descriptor.set.call(this,value);sync();}});
    }
    listen(select,'focus',()=>trigger.focus());
    api={sync,close,position,trigger,wrapper,dispose(){close();observer.disconnect();lifetime.abort();menu.remove();wrapper.remove();select.classList.remove('pickerSource');select.removeAttribute('aria-hidden');select.removeAttribute('tabindex');delete select.value;delete select.selectedIndex;}};
    sync();
    return api;
  };
  document.addEventListener('DOMContentLoaded',()=>{
    const enhance=select=>{
      if(pickers.has(select)||select.multiple||select.size>1)return;
      const picker=app.createNativeSelectPicker(select,select.id||'Choose an option',{iconForValue:select.pickerIconForValue});pickers.set(select,picker);
    };
    const scan=node=>{
      if(node.nodeType!==1||node.namespaceURI!=='http://www.w3.org/1999/xhtml')return;
      if(node.matches('select'))enhance(node);
      node.querySelectorAll('select').forEach(enhance);
    };
    scan(document.body);
    new MutationObserver(records=>{
      for(const record of records){
        if(record.type==='childList')for(const node of record.addedNodes)scan(node);
        if(record.type==='attributes'&&record.target instanceof HTMLSelectElement)pickers.get(record.target)?.sync();
      }
      for(const [select,picker] of pickers)if(!select.isConnected){picker.dispose();pickers.delete(select);}
      current?.position();
    }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','disabled','open']});
    document.addEventListener('reset',()=>queueMicrotask(()=>{for(const picker of pickers.values())picker.sync();}));
  });
})();
