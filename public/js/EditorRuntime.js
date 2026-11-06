/* Closed editors keep their source values without constructing picker DOM. */
window.SignMakerEditorRuntime=(()=>{
  const pending=new Map();
  let initialized=false,queued=false,flushing=false;
  const yieldToMain=()=>typeof window.scheduler?.yield==='function'
    ? window.scheduler.yield() : new Promise(resolve=>setTimeout(resolve,0));
  const isActive=element=>{
    if(!element?.isConnected)return false;
    if(element.closest('.assetHiddenSetting'))return false;
    const dialog=element.closest('dialog');
    if(dialog&&!dialog.open)return false;
    const modal=element.closest('.sMModal');
    if(modal){
      const current=document.getElementById('sMConfigBar')?.dataset.currentMenu;
      if(!current||!modal.classList.contains(current))return false;
    }
    for(let parent=element.parentElement;parent;parent=parent.parentElement){
      if(parent.hidden||parent.classList.contains('hidden')||parent.classList.contains('tabHidden'))return false;
      if(parent!==modal&&parent.style.display==='none')return false;
    }
    return true;
  };
  const defer=(element,kind,build)=>{
    if(isActive(element)){pending.delete(element);return false;}
    const previous=pending.get(element);
    if(!previous||previous.kind==='native'||previous.kind===kind)pending.set(element,{kind,build});
    return true;
  };
  const ensureElement=element=>{
    const job=pending.get(element);
    if(!job)return;
    pending.delete(element);
    if(element.isConnected)job.build();
  };
  const ensure=()=>{
    if(flushing)return;
    flushing=true;
    try{
      for(const [element,job] of [...pending]){
        if(!element.isConnected){pending.delete(element);continue;}
        if(isActive(element))ensureElement(element);
      }
    }finally{flushing=false;}
  };
  const schedule=()=>{
    if(queued||!pending.size)return;
    queued=true;queueMicrotask(()=>{queued=false;ensure();});
  };
  const init=()=>{
    if(initialized)return;initialized=true;
    const observer=new MutationObserver(schedule);
    const modals=document.querySelector('.modals');
    if(modals)observer.observe(modals,{attributes:true,subtree:true,attributeFilter:['data-current-menu','open','hidden']});
    for(const dialog of document.querySelectorAll('dialog'))if(!modals?.contains(dialog))observer.observe(dialog,{attributes:true,attributeFilter:['open']});
    document.addEventListener('click',event=>{
      if(pending.size&&event.target.closest?.('.sMModal,dialog,.sMConfigOption'))schedule();
    },true);
    ensure();
  };
  return {init,isActive,defer,ensureElement,ensure,schedule,yieldToMain,pendingKind:element=>pending.get(element)?.kind,pendingCount:()=>pending.size};
})();
