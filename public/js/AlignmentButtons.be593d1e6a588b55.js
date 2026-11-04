

window.SignMakerAlignmentButtons = (() => {
const directions = ['Left', 'Center', 'Right'];
const normalize = value => String(value || '').trim().toLowerCase();
const matches = select => {
const values = [...select.options].map(option => normalize(option.value));
const name = [select.id, select.getAttribute('aria-label'), select.labels?.[0]?.textContent].join(' ');
return /alignment/i.test(name) || select.id === 'exitTabPosition' ||
(values.length === 3 && directions.every(value => values.includes(normalize(value))));
};
const create = (select, label) => {
if (select._alignmentButtonsApi) return select._alignmentButtonsApi;
const style = getComputedStyle(select);
const width = select.style.width || (parseFloat(style.width) > 0 ? style.width : '6rem');
const wrapper = document.createElement('div');
wrapper.className = 'alignmentButtons dimensionInputs';
wrapper.style.width = width;
wrapper.style.margin = style.margin || '0';
wrapper.setAttribute('role', 'group');
wrapper.setAttribute('aria-label', label);
const buttons = directions.map(direction => {
const button = document.createElement('button');
button.type = 'button';
button.textContent = direction[0];
button.title = direction + ' alignment';
button.setAttribute('aria-label', button.title);
wrapper.appendChild(button);
return button;
});
const optionFor = direction => [...select.options].find(option => normalize(option.value) === normalize(direction));
const sync = () => {
wrapper.hidden = select.hidden || select.classList.contains('hidden') || select.style.display === 'none';
buttons.forEach((button, index) => {
const option = optionFor(directions[index]);
const selected = !!option && select.value === option.value;
button.disabled = select.disabled || !option || option.disabled || option.hidden || !!option.parentElement?.disabled;
button.classList.toggle('selected', selected);
button.setAttribute('aria-pressed', String(selected));
});
};
const choose = index => {
sync();
if (buttons[index].disabled) return;
const value = optionFor(directions[index]).value;
if (select.value !== value) {
select.value = value;
select.dispatchEvent(new Event('input', { bubbles: true }));
select.dispatchEvent(new Event('change', { bubbles: true }));
}
sync();
};
buttons.forEach((button, index) => {
button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); choose(index); });
button.addEventListener('keydown', event => {
if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
event.preventDefault();
sync();
const available = buttons.map((item, i) => item.disabled ? -1 : i).filter(i => i >= 0);
if (!available.length) return;
const step = event.key === 'ArrowLeft' ? -1 : 1;
const next = event.key === 'Home' ? available[0] : event.key === 'End' ? available[available.length - 1] :
available[(available.indexOf(index) + step + available.length) % available.length];
choose(next);
buttons[next].focus();
});
});
const focus = event => {
event.preventDefault();
(buttons.find(button => button.getAttribute('aria-pressed') === 'true' && !button.disabled) || buttons.find(button => !button.disabled))?.focus();
};
for (const element of select.labels || []) element.addEventListener('click', focus);
select.classList.add('nativeSelectSource', 'alignmentButtonsSource');
select.insertAdjacentElement('afterend', wrapper);
select.addEventListener('change', sync);
select.addEventListener('input', sync);
const observer = new MutationObserver(sync);
observer.observe(select, { attributes: true, childList: true, subtree: true });
const picker = {
select, wrapper, alignmentButtons: true, sync, close() {},
destroy() {
observer.disconnect();
select.removeEventListener('change', sync);
select.removeEventListener('input', sync);
for (const element of select.labels || []) element.removeEventListener('click', focus);
wrapper.remove();
select.classList.remove('nativeSelectSource', 'alignmentButtonsSource');
delete select._alignmentButtonsApi;
window.nativeSelectPickers.delete(picker);
}
};
select._alignmentButtonsApi = picker;
window.nativeSelectPickers.add(picker);
sync();
return picker;
};
return { matches, create };
})();
