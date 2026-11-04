

window.SignMakerMergeUI = (() => {
let initialized = false;
let scheduled = false;
const element = id => document.getElementById(id);
const stored = key => { try { return localStorage.getItem(key); } catch { return null; } };
const remember = (key, value) => { try { localStorage.setItem(key, String(value)); } catch {} };
ShieldElement.oldInterstateNumberPositioning = stored("signMaker.oldInterstateNumberPositioning") === "true";
const initialRadius = stored("signMaker.defaultSignRadius");
if (initialRadius !== null && Number.isFinite(Number(initialRadius))) {
Panel.prototype.defaultBorderRadius = Math.max(0, Math.min(5, Number(initialRadius)));
}
const addOptions = (id, values) => {
const select = element(id);
if (!select || select.options.length) return;
values.forEach(value => select.add(new Option(value, value)));
};
const queueSync = () => {
if (scheduled) return;
scheduled = true;
requestAnimationFrame(() => { scheduled = false; sync(); });
};
const sync = () => {
if (!initialized || typeof app === "undefined") return;
const bridge = app.exposeToFormHandler;
const path = bridge.getGroupEditingPath();
const group = bridge.getActiveGroupElement();
element("sMSPGroupNav")?.classList.toggle("hidden", !group);
if (element("sMSPGroupLabel")) {
element("sMSPGroupLabel").textContent = path.length
? `Editing ${group?.label || "Group"}${path.length > 1 ? ` · Level ${path.length}` : ""}` : "";
}
const selected = bridge.getCurrentBlockElem?.();
const isGroup = selected instanceof GroupedBlockElement;
if (element("sMSPUngroupSelectedBlock")) element("sMSPUngroupSelectedBlock").disabled = !isGroup;
if (element("sMSPEditSelectedGroup")) element("sMSPEditSelectedGroup").disabled = !isGroup;
if (element("sMSPGroupSelectedBlocks")) {
element("sMSPGroupSelectedBlocks").disabled = (formHandler.getMergeGroupSelectionRefs?.().length || 0) < 2;
}
window.nativeSelectPickers?.forEach(picker => picker.sync());
};
const convertSelect = select => {
const runtime=window.SignMakerEditorRuntime;
const pendingKind=runtime?.pendingKind(select);
if(pendingKind&&pendingKind!=='native')return;
if (select._shieldPickerApi || select._shieldVariantPickerApi || select.classList.contains("shieldPickerNativeSource") || select.multiple || select.hidden || select.classList.contains("hidden") ||
select.getAttribute("aria-hidden") === "true" || select.classList.contains("blockTypeInlineSelect") ||
select.classList.contains('nativeSelectSource')) return;
if(runtime?.defer(select,'native',()=>convertSelect(select)))return;
if(getComputedStyle(select).display==='none')return;
if (select.nextElementSibling?.matches(".fontPicker, .colorPicker, .shieldPicker, .symbolPicker") ||
select.classList.contains("fontPickerSource") || select.classList.contains("colorPickerSource")) return;
const label = select.getAttribute("aria-label") || select.labels?.[0]?.textContent.trim() || select.title || "Choose an option";
const values = [...select.options].map(option => option.value);
const isColor = values.some(value => Object.hasOwn(lib.colors, value)) && values.every(value => !value || Object.hasOwn(lib.colors, value) || ["Inherit","Transparent","None"].includes(value) || CSS.supports("color",value));
const options = isColor ? { colorForValue: value => lib.colors[value] || (CSS.supports("color", value) ? value : "") } : /font/i.test(select.id) ? { textStyleForValue: value => ({ fontFamily: value || "Inter, sans-serif" }) } : {};
const picker = window.createNativeSelectPicker(select, label, options);
if (!picker.alignmentButtons) picker.wrapper.style.width = select.style.width || "";
};
const init = () => {
if (initialized) return;
initialized = true;
addOptions("sdGroupedBlock_alignment", TextElement.prototype.alignment);
addOptions("sdGroupedBlock_backgroundColor", TextElement.prototype.backgroundColor);
addOptions("sdGroupedBlock_borderColor", TextElement.prototype.backgroundColor);
for (const [id, placement] of [["mergeAddHeader", "header"], ["mergeAddFooter", "footer"]]) {
const select = element(id);
Object.keys(lib.colors).forEach(color => select.add(new Option(color, color)));
select.addEventListener("change", () => {
const color = select.value;
select.value = "";
if (color) app.addHeaderFooter(placement, color);
sync();
});
}
element("sMSPGroupSelectedBlocks").addEventListener("click", () => app.groupSelectedBlockElements(formHandler.getMergeGroupSelectionRefs()));
element("sMSPUngroupSelectedBlock").addEventListener("click", () => app.ungroupSelectedBlockElement());
element("sMSPEditSelectedGroup").addEventListener("click", () => app.enterGroupElement());
element("copySign").addEventListener("click",()=>app.copySignToClipboard());
element("copySign").addEventListener("contextmenu",event=>app.openCopyPanelContextMenu(event));
document.addEventListener("click",event=>{if(!event.target.closest("#copyPanelContextMenu"))element("copyPanelContextMenu").classList.add("hidden");});
element("sMSPExitGroup").addEventListener("click", () => app.exitGroupElement());
document.querySelectorAll('[data-property="sdGroupedBlock"] input, [data-property="sdGroupedBlock"] select, #sdShield_numberStyle')
.forEach(field => {
const event = field.tagName === "SELECT" || field.type === "checkbox" ? "change" : "input";
field.addEventListener(event, () => { formHandler.readForm(); queueSync(); });
});
const oldPosition = element("appOldInterstateNumberPositioning");
oldPosition.checked = stored("signMaker.oldInterstateNumberPositioning") === "true";
ShieldElement.oldInterstateNumberPositioning = oldPosition.checked;
oldPosition.addEventListener("change", () => {
ShieldElement.oldInterstateNumberPositioning = oldPosition.checked;
remember("signMaker.oldInterstateNumberPositioning", oldPosition.checked);
app.exposeToFormHandler.redraw();
});
const radius = element("mergeDefaultSignRadius");
const savedRadius = stored("signMaker.defaultSignRadius");
if (savedRadius !== null && Number.isFinite(Number(savedRadius))) {
Panel.prototype.defaultBorderRadius = Math.max(0, Math.min(5, Number(savedRadius)));
}
radius.value = String(Panel.prototype.defaultBorderRadius);
radius.addEventListener("change", () => {
if (!radius.checkValidity() || !Number.isFinite(radius.valueAsNumber)) return;
Panel.prototype.defaultBorderRadius = radius.valueAsNumber;
remember("signMaker.defaultSignRadius", radius.valueAsNumber);
});
element("sMSPTextList").addEventListener("click", queueSync);
window.observeNativeSelects(convertSelect);
sync();
};
return { init, sync, enhanceSelect:convertSelect };
})();
