/* Shared picker appearance and geometry. Menus are fully sized before they open. */
window.SignMakerDropdowns = (() => {
  const owners='.symbolPicker,.fontPicker,.colorPicker,.shieldPicker,.profilePicker';
  const portals=new Map();
  let initialized=false;
  const animationPreference='signMaker.dropdownAnimations';
  let animationsEnabled=true;
  try{animationsEnabled=window.localStorage?.getItem(animationPreference)!=='false';}catch{}
  document.documentElement.dataset.dropdownAnimations=String(animationsEnabled);
  // Appearance and chevrons are CSS-driven; only open menus need JavaScript.
  const put=(node,properties)=>Object.entries(properties).forEach(([key,value])=>{
    if(node.style.getPropertyValue(key)!==value||node.style.getPropertyPriority(key)!=='important')node.style.setProperty(key,value,'important');
  });
  let removalObserver=null;
  const release=menu=>{
    const state=portals.get(menu);
    state?.animation?.cancel();state?.observer.disconnect();portals.delete(menu);
    if(!portals.size){removalObserver?.disconnect();removalObserver=null;}
  };
  const watchOpenMenus=()=>{
    if(removalObserver)return;
    removalObserver=new MutationObserver(()=>{
      for(const [menu,state] of portals)if(!state.owner.isConnected){release(menu);menu.remove();}
    });
    removalObserver.observe(document.body,{childList:true,subtree:true});
  };
  const prepareMenu=menu=>{
    menu.dataset.dropdownReady='false';
    put(menu,{'visibility':'hidden','opacity':'0','pointer-events':'none','transition':'none','animation':'none'});
  };
  const closeMenu=menu=>{
    portals.get(menu)?.animation?.cancel();
    prepareMenu(menu);
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden','true');
    menu.inert=true;
    release(menu);
  };
  const animateOpen=(menu,state)=>{
    if(!animationsEnabled||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||typeof menu.animate!=='function')return;
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
  };
  const setOpen=(menu,owner,openClass='open')=>{
    const state=portals.get(menu);
    const requested=owner.isConnected&&!owner.hidden&&!owner.classList.contains('hidden')&&owner.classList.contains(openClass);
    if(!requested)menu.dataset.dropdownReady='false';
    const open=requested&&menu.dataset.dropdownReady==='true'&&state?.anchorVisible!==false;
    menu.classList.toggle('open',open);
    menu.setAttribute('aria-hidden',String(!open));
    menu.inert=!open;
    put(menu,{'opacity':open?'1':'0','visibility':open?'visible':'hidden','pointer-events':open?'auto':'none'});
    if(state){
      if(open&&!state.open)animateOpen(menu,state);
      if(!open){state.animation?.cancel();state.animation=null;}
      state.open=open;
    }
    if(!requested)release(menu);
  };
  // Specialized pickers share the native picker's hold/release and keyboard behavior.
  const triggerSelector='.fontPickerTrigger,.colorPickerTrigger,.shieldPickerTrigger,.profilePickerTrigger,.blockTypeInlinePickerTrigger';
  const itemSelector='.fontPickerFontItem[data-font-value],.fontPickerFamilyItem[data-family-value],.colorPickerItem[data-color-value],[role="option"],.shieldPickerItem';
  const triggerMenus=new WeakMap();
  let held=null,suppressClick=null;
  const rows=menu=>[...menu.querySelectorAll(itemSelector)].filter(item=>!item.disabled&&item.getClientRects().length);
  const choose=item=>{
    if(item.matches('.fontPickerFontItem,.fontPickerFamilyItem,.colorPickerItem'))
      item.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0}));
    else item.click();
  };
  document.addEventListener('pointerdown',event=>{
    const trigger=event.target.closest(triggerSelector);
    if(!trigger||trigger.disabled||event.button!==0||event.pointerType==='touch')return;
    event.preventDefault();
    trigger.focus({preventScroll:true});
    trigger.click();
    held=trigger;
  },true);
  document.addEventListener('pointerup',event=>{
    if(!held)return;
    const trigger=held;held=null;
    const menu=triggerMenus.get(trigger);
    const target=document.elementFromPoint(event.clientX,event.clientY);
    const item=target?.closest(itemSelector);
    suppressClick={trigger,menu};
    setTimeout(()=>{suppressClick=null;},0);
    if(item&&menu?.contains(item)){event.preventDefault();choose(item);}
  },true);
  document.addEventListener('pointercancel',()=>{held=null;},true);
  document.addEventListener('click',event=>{
    if(!event.isTrusted||!suppressClick)return;
    const {trigger,menu}=suppressClick;
    if(trigger.contains(event.target)||menu?.contains(event.target)){
      event.preventDefault();event.stopImmediatePropagation();suppressClick=null;
    }
  },true);
  document.addEventListener('keydown',event=>{
    const trigger=event.target.closest(triggerSelector);
    if(!trigger||event.ctrlKey||event.metaKey||event.altKey||event.isComposing)return;
    if(!['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(event.key)&&event.key.length!==1)return;
    let menu=triggerMenus.get(trigger);
    if(!menu?.classList.contains('open')){trigger.click();menu=triggerMenus.get(trigger);}
    if(!menu)return;
    const options=rows(menu);if(!options.length)return;
    event.preventDefault();event.stopImmediatePropagation();
    let index=options.findIndex(item=>item.classList.contains('keyboardActive'));
    if(event.key==='Enter'||event.key===' '){if(index>=0)choose(options[index]);return;}
    if(event.key==='Home')index=0;
    else if(event.key==='End')index=options.length-1;
    else if(event.key==='ArrowDown')index=(index+1)%options.length;
    else if(event.key==='ArrowUp')index=(index-1+options.length)%options.length;
    else{
      const key=event.key.toLowerCase();
      const offset=Array.from({length:options.length},(_,i)=>(index+1+i)%options.length)
        .find(i=>String(options[i].dataset.fontValue||options[i].dataset.familyValue||options[i].dataset.colorValue||options[i].textContent).trim().toLowerCase().startsWith(key));
      if(offset===undefined)return;
      index=offset;
    }
    options.forEach((item,i)=>item.classList.toggle('keyboardActive',i===index));
    options[index].scrollIntoView({block:'nearest'});
  },true);
  const positionMenu=(menu,trigger,{minWidth=12.5,maxWidth=24,openClass='open',beside=null,anchor=null,fitContent=false}={})=>{
    triggerMenus.set(trigger,menu);
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
      watchOpenMenus();
    }
    const savedScrollTop=menu.scrollTop;
    menu.classList.add('smDropdownMenu');
    const triggerRect=trigger.getBoundingClientRect();
    const reference=anchor?.isConnected?anchor:trigger;
    let rect=reference===trigger?triggerRect:reference.getBoundingClientRect();
    const settingsContent=trigger.closest(':is(#settings22Modal, #postStyleModal) .sMModalContent');
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
    const contentHeight=menu.scrollHeight*scale;
    if(settingsContent){
      const contentRect=settingsContent.getBoundingClientRect();
      if(!previous&&!beside){
        const desiredRoom=Math.min(contentHeight,5*rem*scale);
        const missingRoom=rect.bottom+gap+edge+desiredRoom-viewportHeight;
        const scrollBy=Math.min(missingRoom,rect.top-contentRect.top-gap);
        if(scrollBy>0){
          settingsContent.scrollTop+=scrollBy/scale;
          rect=reference.getBoundingClientRect();
        }
      }
      portals.get(menu).anchorVisible=rect.bottom>contentRect.top&&rect.bottom<=contentRect.bottom+1;
    }
    const below=Math.max(0,viewportHeight-rect.bottom-edge-gap),above=Math.max(0,rect.top-edge-gap);
    const upwards=!settingsContent&&below<Math.min(contentHeight,240*scale)&&above>below;
    const available=upwards?above:below;
    const maxHeight=available/scale;
    const paintedHeight=Math.min(menu.scrollHeight,maxHeight)*scale;
    let left=Math.max(edge,Math.min(rect.left,viewportWidth-width*scale-edge));
    if(beside){const anchor=beside.getBoundingClientRect();left=anchor.right+gap+width*scale<viewportWidth-edge?anchor.right+gap:Math.max(edge,anchor.left-width*scale-gap);}
    const top=upwards?rect.top-gap-paintedHeight:rect.bottom+gap;
    put(menu,{'left':(left-dialogRect.left)/portalScale+'px','right':'auto','top':(top-dialogRect.top)/portalScale+'px','bottom':'auto','max-height':Math.max(0,maxHeight)+'px'});
    menu.classList.toggle('opensUp',upwards);
    menu.dataset.dropdownReady='true';
    setOpen(menu,owner,openClass);
    menu.scrollTop=savedScrollTop;
    return {left,top,width:width*scale,height:paintedHeight,scale};
  };
  // Kept for callers that update labels; CSS applies without a DOM scan.
  const refresh=()=>{};
  const init=()=>{initialized=true;};
  return {init,refresh,positionMenu,prepareMenu,closeMenu,getAnimationsEnabled:()=>animationsEnabled,setAnimationsEnabled};
})();
