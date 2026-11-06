/* Shared picker appearance and geometry. Menus are fully sized before they open. */
window.SignMakerDropdowns = (() => {
  const triggers='.nativeSelectTrigger,.fontPickerTrigger,.colorPickerTrigger,.shieldPickerTrigger,.profilePickerTrigger,.blockTypeInlinePickerTrigger';
  const menus='.symbolPickerMenu,.fontPickerMenu,.colorPickerMenu,.shieldPickerPopover,.blockTypePickerPopover,.profilePickerMenu';
  const options='.symbolPickerItem,.fontPickerItem,.colorPickerItem,.shieldPickerItem,.profilePickerItem';
  const icons='.colorPickerSwatch,.shieldPickerTriggerIcon,.shieldPickerItemIcon,.arrowPickerIconHolder,.colorPickerAddIcon';
  const caretSelector='.symbolPickerCaret,.fontPickerTriggerCaret,.colorPickerTriggerCaret,.shieldPickerTriggerCaret,.profilePickerTriggerCaret';
  const owners='.symbolPicker,.fontPicker,.colorPicker,.shieldPicker,.profilePicker';
  const portals=new Map();
  let initialized=false;
  const animationPreference='signMaker.dropdownAnimations';
  let animationsEnabled=true;
  try{animationsEnabled=window.localStorage?.getItem(animationPreference)!=='false';}catch{}
  document.documentElement.dataset.dropdownAnimations=String(animationsEnabled);
  const all=(root,selector)=>[...(root.matches?.(selector)?[root]:[]),...root.querySelectorAll(selector)];
  const put=(node,properties)=>Object.entries(properties).forEach(([key,value])=>{
    if(node.style.getPropertyValue(key)!==value||node.style.getPropertyPriority(key)!=='important')node.style.setProperty(key,value,'important');
  });
  const withIcon=node=>[...node.querySelectorAll(icons)].some(icon=>!icon.hidden&&icon.style.display!=='none');
  const controlHeight=node=>{
    const owner=node.matches?.(owners)?node:node.closest(owners);
    if(owner?.classList.contains('headerFooterPicker'))return '1.2rem';
    if(node.classList.contains('fontPickerTrigger')||owner?.classList.contains('fontPicker'))return '1.6rem';
    return owner?.previousElementSibling?.matches('.sdShieldBannerFontSelect,.sdShieldRoadNameFontSelect,.sdShieldBannerBackgroundColorSelect')?'1.32rem':'1.35rem';
  };
  const decorateCaret=trigger=>{
    const inline=trigger.classList.contains('blockTypeInlinePickerTrigger');
    const open=trigger.closest(owners)?.classList.contains('open');
    for(const caret of trigger.querySelectorAll(caretSelector)){
      caret.classList.add('smDropdownCaret');
      const viewBox=inline?'6 6 12 12':'4 4 16 16';
      if(caret.tagName.toLowerCase()==='svg')caret.setAttribute('viewBox',viewBox);
      else if(caret.dataset.dropdownCaret!==viewBox){
        caret.dataset.dropdownCaret=viewBox;
        caret.innerHTML='<svg viewBox="'+viewBox+'" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.25 9.25l4.75 4.75 4.75-4.75"/></svg>';
      }
      const size=inline?'1.35rem':'1.05rem';
      put(caret,{'position':'static','width':size,'min-width':size,'max-width':size,'height':size,'min-height':size,'max-height':size,'flex':'0 0 '+size,'margin':'0 0 0 auto','padding':'0','color':'currentColor','font-size':'0','line-height':'0','transform':open?'rotate(180deg)':'rotate(0deg)','background':'none','transition':animationsEnabled?'transform 160ms ease-in-out':'none'});
    }
  };
  const decorate=root=>{
    for(const wrapper of all(root,'.colorPicker,.smColorPicker')){
      const height=controlHeight(wrapper);
      put(wrapper,{'width':wrapper.closest('.settings22Window')?'100%':'var(--sm-color-width, 10rem)','min-width':'0','max-width':'100%','height':height,'min-height':height,'margin':'0','box-sizing':'border-box'});
    }
    for(const wrapper of all(root,'.fontPicker')){
      const height=controlHeight(wrapper);
      put(wrapper,{'height':height,'min-height':height});
    }
    for(const trigger of all(root,triggers)){
      const inline=trigger.classList.contains('blockTypeInlinePickerTrigger');
      const height=controlHeight(trigger);
      trigger.classList.add('smDropdownTrigger');
      trigger.classList.toggle('smDropdownWithIcon',withIcon(trigger));
      trigger.classList.toggle('smDropdownPlain',!withIcon(trigger));
      put(trigger,{'display':'flex','align-items':'center','justify-content':inline?'center':'flex-start','width':inline?'1.8rem':'100%','min-width':'0','max-width':'100%','height':height,'min-height':height,'max-height':height,'font-family':'Inter, sans-serif','font-size':'0.8rem','font-weight':'400','line-height':'1.1','padding':inline?'0':'0 0.4rem','gap':'0.35rem','margin':'0','border-radius':'0','box-sizing':'border-box','background-image':'none','transition':'none','animation':'none'});
      const color=trigger.classList.contains('colorPickerTrigger')||trigger.parentElement?.classList.contains('smColorPicker');
      if(color)put(trigger,{'font-size':'0.8rem','padding':'0 0.35rem'});
      if(trigger.closest('.headerFooterPicker'))put(trigger,{'font-size':'0.7rem','padding':'0 0.35rem'});
      if(inline)put(trigger,{'background':'transparent','border':'0','color':'inherit'});
      for(const label of trigger.querySelectorAll('.fontPickerTriggerLabel'))put(label,{'font-family':'var(--sm-font-preview-family, Inter), sans-serif','font-size':'var(--sm-font-preview-size, 0.9rem)','line-height':'1.1','transform':'none'});
      for(const label of trigger.querySelectorAll('.colorPickerTriggerLabel,.shieldPickerTriggerLabel,.profilePickerTriggerLabel,.symbolPickerLabel'))put(label,{'font-size':'inherit','line-height':'1.1','min-width':'0','overflow':'hidden','text-overflow':'ellipsis','white-space':'nowrap'});
      decorateCaret(trigger);
    }
    for(const menu of all(root,menus)){
      menu.classList.add('smDropdownMenu');
      put(menu,{'background':'var(--sm-dropdown-background)','color':'var(--sm-dropdown-color)','border':'1px solid var(--sm-dropdown-border)','border-radius':'0','box-shadow':'0 0.15rem 0.4rem rgba(0,0,0,0.22)','padding':'0.1rem 0','font-family':'Inter, sans-serif','font-size':menu.classList.contains('headerFooterMenu')?'0.7rem':'0.85rem','line-height':'1.25','height':'auto','overflow-x':'hidden','box-sizing':'border-box','transition':'none','animation':'none'});
    }
    for(const option of all(root,options)){
      option.classList.add('smDropdownOption');
      option.classList.toggle('smDropdownWithIcon',withIcon(option));
      option.classList.toggle('smDropdownPlain',!withIcon(option));
      option.classList.toggle('smDropdownHasCheck',!!option.querySelector('.symbolPickerCheck'));
      option.classList.toggle('smDropdownBranch',!!option.querySelector('.shieldPickerItemCaret'));
      put(option,{'display':'flex','align-items':'center','justify-content':'flex-start','gap':'0.35rem','font-size':'var(--sm-font-preview-size, 0.85rem)','font-weight':'400','line-height':'1.25','min-width':'0','max-width':'100%','min-height':'1.55rem','height':'auto','padding':option.classList.contains('shieldPickerItem')?'0.15rem 0.4rem 0.15rem calc(0.4rem + var(--shieldPickerDepth, 0) * 1.25rem)':'0.15rem 0.4rem','border-radius':'0','margin':'0'});
      put(option,{'transition':'none','animation':'none'});
      if(option.closest('.headerFooterMenu'))put(option,{'font-size':'0.7rem','line-height':'1.1','min-height':'1.2rem','padding':'0.08rem 0.4rem'});
      if(option.classList.contains('blockTypePickerItem'))put(option,{'width':'100%','font-size':'0.8rem','min-height':'1.4rem','max-height':'none','padding':'0.15rem 0.4rem'});
    }
    for(const header of all(root,'.fontPickerFamilyHeader'))put(header,{'font-size':'0.8rem','line-height':'1.25','padding':'0.25rem 0.4rem','font-weight':'600'});
    for(const list of all(root,'.blockTypePickerList'))put(list,{'width':'100%','min-width':'0','max-width':'100%','box-sizing':'border-box'});
    for(const icon of all(root,icons)){
      if(!icon.closest('.smDropdownTrigger,.smDropdownOption'))continue;
      const size=icon.closest('.headerFooterPicker,.headerFooterMenu')?'0.75rem':'0.95rem';
      put(icon,{'width':size,'height':size,'min-width':size,'max-width':size,'flex':'0 0 '+size,'object-fit':'contain','margin':'0'});
    }
  };
  const prepareMenu=menu=>{
    menu.dataset.dropdownReady='false';
    put(menu,{'visibility':'hidden','opacity':'0','pointer-events':'none','transition':'none','animation':'none'});
  };
  const closeMenu=menu=>{
    portals.get(menu)?.animation?.cancel();
    portals.get(menu)?.owner.querySelectorAll(triggers).forEach(decorateCaret);
    prepareMenu(menu);
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden','true');
    menu.inert=true;
    portals.get(menu)?.observer.disconnect();
    portals.delete(menu);
  };
  const animateOpen=(menu,state)=>{
    if(!animationsEnabled||typeof menu.animate!=='function')return;
    const offset=menu.classList.contains('opensUp')?'0 0.15rem':'0 -0.15rem';
    // Filter and translation animate independently of the final layout and scale.
    const animation=menu.animate([{filter:'opacity(0)',translate:offset},{filter:'opacity(1)',translate:'0 0'}],{duration:160,easing:'ease-out'});
    state.animation=animation;
    animation.onfinish=()=>{if(state.animation===animation)state.animation=null;};
  };
  const setAnimationsEnabled=value=>{
    animationsEnabled=!!value;
    try{window.localStorage?.setItem(animationPreference,String(animationsEnabled));}catch{}
    document.documentElement.dataset.dropdownAnimations=String(animationsEnabled);
    if(!animationsEnabled)for(const state of portals.values()){state.animation?.cancel();state.animation=null;}
    all(document,triggers).forEach(decorateCaret);
  };
  const setOpen=(menu,owner,openClass='open')=>{
    const requested=owner.isConnected&&!owner.hidden&&!owner.classList.contains('hidden')&&owner.classList.contains(openClass);
    if(!requested)menu.dataset.dropdownReady='false';
    const open=requested&&menu.dataset.dropdownReady==='true';
    menu.classList.toggle('open',open);
    menu.setAttribute('aria-hidden',String(!open));
    menu.inert=!open;
    put(menu,{'opacity':open?'1':'0','visibility':open?'visible':'hidden','pointer-events':open?'auto':'none'});
    const state=portals.get(menu);
    if(state){
      if(open&&!state.open)animateOpen(menu,state);
      if(!open){state.animation?.cancel();state.animation=null;}
      state.open=open;
    }
    owner.querySelectorAll(triggers).forEach(decorateCaret);
  };
  const positionMenu=(menu,trigger,{minWidth=12.5,maxWidth=24,openClass='open',beside=null,anchor=null,fitContent=false}={})=>{
    const owner=trigger.closest(owners)||trigger.parentElement;
    if(!owner||!trigger.isConnected)return null;
    prepareMenu(menu);
    const portal=trigger.closest('dialog')||document.body;
    if(menu.parentElement!==portal)portal.appendChild(menu);
    const previous=portals.get(menu);
    if(!previous||previous.owner!==owner||previous.openClass!==openClass){
      previous?.observer.disconnect();
      const observer=new MutationObserver(()=>{
        if(portals.get(menu)?.observer===observer)setOpen(menu,owner,openClass);
      });
      observer.observe(owner,{attributes:true,attributeFilter:['class','hidden']});
      if(!menu.dataset.dropdownWheelBound){
        menu.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
        menu.dataset.dropdownWheelBound='true';
      }
      portals.set(menu,{owner,observer,openClass,open:false,animation:null});
    }
    const savedScrollTop=menu.scrollTop;
    decorate(trigger);decorate(menu);
    const triggerRect=trigger.getBoundingClientRect();
    const rect=anchor?.isConnected?anchor.getBoundingClientRect():triggerRect;
    const rootStyle=getComputedStyle(document.documentElement);
    const rem=parseFloat(rootStyle.fontSize)||20;
    const fallback=trigger.closest('.modals,.compactSettingsWindow')?parseFloat(rootStyle.getPropertyValue('--sm-app-zoom'))||1:1;
    const scale=trigger.offsetWidth>0&&triggerRect.width>0?triggerRect.width/trigger.offsetWidth:fallback;
    const dialog=portal.tagName==='DIALOG'?portal:null;
    const dialogRect=dialog?dialog.getBoundingClientRect():{left:0,top:0};
    const portalScale=dialog&&dialog.offsetWidth>0?dialogRect.width/dialog.offsetWidth:1;
    const zoom=scale/portalScale;
    const edge=8,gap=3,viewportWidth=window.innerWidth,viewportHeight=window.innerHeight;
    let contentWidth=0;
    if(fitContent){
      put(menu,{'display':'block','width':'max-content','min-width':'0','max-width':'none'});
      contentWidth=menu.scrollWidth+2;
    }
    const width=Math.min(Math.max(rect.width/scale,minWidth*rem,contentWidth),maxWidth*rem,(viewportWidth-edge*2)/scale);
    put(menu,{'display':'block','position':dialog?'absolute':'fixed','width':width+'px','min-width':'0','max-width':width+'px','height':'auto','max-height':'none','font-size':menu.classList.contains('headerFooterMenu')?'0.7rem':'0.85rem','transform-origin':'top left','transform':'scale('+zoom+')','overflow-y':'auto','z-index':'2147483000'});
    const below=Math.max(0,viewportHeight-rect.bottom-edge-gap),above=Math.max(0,rect.top-edge-gap);
    const contentHeight=menu.scrollHeight*scale;
    const upwards=below<Math.min(contentHeight,240*scale)&&above>below;
    const available=upwards?above:below;
    const maxHeight=available/scale;
    const paintedHeight=Math.min(menu.scrollHeight,maxHeight)*scale;
    let left=Math.max(edge,Math.min(rect.left,viewportWidth-width*scale-edge));
    if(beside){const anchor=beside.getBoundingClientRect();left=anchor.right+gap+width*scale<viewportWidth-edge?anchor.right+gap:Math.max(edge,anchor.left-width*scale-gap);}
    const top=upwards?rect.top-gap-paintedHeight:rect.bottom+gap;
    const bottom=upwards&&!beside?(dialog?dialogRect.bottom:viewportHeight)-rect.top+gap:null;
    put(menu,{'left':(left-dialogRect.left)/portalScale+'px','right':'auto','top':bottom===null?(top-dialogRect.top)/portalScale+'px':'auto','bottom':bottom===null?'auto':bottom/portalScale+'px','max-height':Math.max(0,maxHeight)+'px'});
    menu.classList.toggle('opensUp',upwards);
    menu.dataset.dropdownReady='true';
    setOpen(menu,owner,openClass);
    menu.scrollTop=savedScrollTop;
    return {left,top,width:width*scale,height:paintedHeight,scale};
  };
  const refresh=(root=document)=>decorate(root);
  const init=()=>{
    if(initialized)return;initialized=true;decorate(document);
    new MutationObserver(records=>{
      for(const record of records){
        if(record.type==='attributes'){
          if(record.target.tagName==='SELECT'&&!record.target.classList.contains('nativeSelectSource'))window.SignMakerMergeUI?.enhanceSelect(record.target);
          else if(record.target.matches?.(owners))record.target.querySelectorAll(triggers).forEach(decorateCaret);
          continue;
        }
        for(const node of record.addedNodes)if(node.nodeType===1)decorate(node);
      }
      for(const [menu,{owner,observer,animation}] of portals)if(!owner.isConnected){observer.disconnect();animation?.cancel();menu.remove();portals.delete(menu);}
    }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class']});
  };
  return {init,refresh,positionMenu,prepareMenu,closeMenu,getAnimationsEnabled:()=>animationsEnabled,setAnimationsEnabled};
})();
