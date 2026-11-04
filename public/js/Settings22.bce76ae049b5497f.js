

window.SignMakerSettings22=(()=>{
let preferences=null,initialized=false,lastState='';
const field=id=>document.getElementById(id);
const refreshPickers=()=>{
window.SignMakerEditorRuntime?.ensure();
window.nativeSelectPickers?.forEach(picker=>{if(window.SignMakerEditorRuntime?.isActive(picker.select))picker.sync();});
};
const sync=()=>{
if(!preferences)return;
const state=JSON.stringify([preferences.getTheme(),preferences.getScale(),preferences.getToolbar(),preferences.getKeybind(),preferences.getRestore(),window.SignMakerDropdowns.getAnimationsEnabled()]);
if(state===lastState)return;
lastState=state;
field('appThemeMode').value=preferences.getTheme();
field('appUiScale').value=String(preferences.getScale());
field('appUiScaleValue').textContent=field('appUiScale').value+'%';
field('appToolbarPosition').value=preferences.getToolbar();
field('appKeybindMode').value=preferences.getKeybind();
field('restoreOnRefresh').value=preferences.getRestore();
field('appDropdownAnimations').checked=window.SignMakerDropdowns.getAnimationsEnabled();
refreshPickers();
};
const showDefaults=()=>{
const selected=field('defaultsCategory').value;
field('defaultsFields').querySelectorAll('fieldset').forEach(section=>section.hidden=section.id!==selected);
refreshPickers();
};
const showTab=id=>{
const modal=field('settings22Modal');if(!modal)return;
modal.dataset.currentMenu=id;
modal.querySelectorAll('.sMModalContent > div').forEach(pane=>pane.classList.toggle('tabHidden',pane.id!==id));
modal.querySelectorAll('.sMModalTab').forEach(tab=>tab.classList.toggle('selected',tab.dataset.tab===id));
if(id==='sMDefaults')showDefaults();
else refreshPickers();
};
const init=api=>{
preferences=api;
if(initialized){sync();return;}
initialized=true;
field('appThemeMode').addEventListener('change',()=>{preferences.setTheme(field('appThemeMode').value);sync();});
field('appUiScale').addEventListener('input',()=>field('appUiScaleValue').textContent=field('appUiScale').value+'%');
field('appUiScale').addEventListener('change',()=>{preferences.setScale(field('appUiScale').value);sync();});
field('appToolbarPosition').addEventListener('change',()=>{preferences.setToolbar(field('appToolbarPosition').value);sync();});
field('appKeybindMode').addEventListener('change',()=>{preferences.setKeybind(field('appKeybindMode').value);sync();});
field('restoreOnRefresh').addEventListener('change',()=>{preferences.setRestore(field('restoreOnRefresh').value);sync();});
field('appDropdownAnimations').addEventListener('change',()=>{window.SignMakerDropdowns.setAnimationsEnabled(field('appDropdownAnimations').checked);sync();});
field('defaultsCategory').addEventListener('change',showDefaults);
field('settings22Modal').querySelectorAll('.sMModalTab').forEach(tab=>tab.addEventListener('click',()=>showTab(tab.dataset.tab)));
field('copySignsOnly').addEventListener('change',()=>{
const bridge=app.exposeToFormHandler;bridge.beginUndoableChange();app.getPost().copySignsOnly=field('copySignsOnly').checked;bridge.endUndoableChange();
});
new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme-mode','data-config-position','data-dropdown-animations','style']});
showDefaults();sync();
};
const showLegacyPage=id=>{
if(id==='settingsGeneral'||id==='settingsInterface')showTab('sMAppSettings');
else if(id==='settingsControls')showTab('sMAppShortcuts');
else {const category=field('defaultsCategory');if([...category.options].some(option=>option.value===id))category.value=id;showTab('sMDefaults');}
};
return {init,sync,showDefaults,showTab,showLegacyPage};
})();
