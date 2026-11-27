/* Compact pointed popover follows StripeMaker's css/menus.css .nodeMenu. */
window.SignMakerBlockMenu = (() => {
  let menu=null,anchor=null;
  const close=(focus=false)=>{if(!menu)return;menu.hidden=true;if(focus&&anchor?.isConnected)anchor.focus({preventScroll:true});anchor=null;};
  const open=event=>{
    event.preventDefault();event.stopPropagation();
    app.closeCopyPanelContextMenu();
    if(!menu){menu=document.createElement('ul');menu.className='blockContextMenu';menu.role='menu';menu.setAttribute('aria-label','Block actions');document.body.append(menu);
      menu.addEventListener('keydown',e=>{
        if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);return;}
        if(e.key==='Tab'){close(true);return;}
        const buttons=[...menu.querySelectorAll('button:not(:disabled)')];let i=buttons.indexOf(document.activeElement);
        if(e.key==='ArrowDown')i=(i+1)%buttons.length;else if(e.key==='ArrowUp')i=(i-1+buttons.length)%buttons.length;else if(e.key==='Home')i=0;else if(e.key==='End')i=buttons.length-1;else return;
        e.preventDefault();buttons[i]?.focus();
      });
    }
    const b=app.exposeToFormHandler,row=b.vars.currentlySelectedRowIndex,block=b.vars.currentlySelectedBlockIndex;
    const element=b.getCurrentBlockElem();
    anchor=document.querySelector(`.textEditorBlock[data-row="${row}"][data-block="${block}"]`);
    if(anchor)anchor.tabIndex=-1;
    const rows=b.getCurrentSubPanel()?.blockElements?.rows||[];
    const items=[
      {label:'Edit block',run:()=>formHandler.ensureSubpanelMenuOpen()},
      {label:'Duplicate',run:()=>app.duplicateControlElem()},
      {label:'Duplicate into new row',run:()=>b.duplicateBlockIntoNewRow(row,block)},
      null,
      {label:'Cut',run:()=>app.cutSubpanelClipboard()},
      {label:'Copy',run:()=>app.copySubpanelClipboard()},
      {label:'Paste after',disabled:!app.hasSubpanelClipboard(),run:()=>app.pasteSubpanelClipboard({pasteAfter:true})},
    ];
    if(element instanceof GroupedBlockElement)items.push(null,{label:'Edit group contents',run:()=>app.enterGroupElement(row,block)},{label:'Ungroup',run:()=>app.ungroupSelectedBlockElement()});
    items.push(null,{label:'Delete',disabled:rows.reduce((n,r)=>n+r.length,0)<=1,run:()=>app.delControlElem(row,block)});
    menu.replaceChildren(...items.map(item=>{const li=document.createElement('li');li.role=item?'presentation':'separator';if(item){const button=document.createElement('button');button.type='button';button.role='menuitem';button.textContent=item.label;button.disabled=!!item.disabled;button.addEventListener('click',()=>{close(true);item.run();});li.append(button);}return li;}));
    menu.hidden=false;
    const box=menu.getBoundingClientRect(),margin=8,gap=10;
    const right=event.clientX+gap+box.width+margin<=innerWidth;
    const top=Math.min(Math.max(event.clientY-22,margin),Math.max(margin,innerHeight-box.height-margin));
    menu.dataset.side=right?'right':'left';menu.style.left=Math.max(margin,Math.min(innerWidth-box.width-margin,right?event.clientX+gap:event.clientX-gap-box.width))+'px';menu.style.top=top+'px';
    menu.style.setProperty('--pointer-y',Math.min(Math.max(event.clientY-top,12),box.height-12)+'px');menu.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
  };
  document.addEventListener('contextmenu',event=>{
    const target=event.target.closest('.textEditorBlock');if(!target||event.target.closest('input,textarea,[contenteditable="true"]'))return;
    event.preventDefault();app.setSelectedRowAndBlock(Number(target.dataset.row),Number(target.dataset.block));open(event);
  });
  document.addEventListener('pointerdown',event=>{if(menu&&!menu.contains(event.target))close();},true);
  window.addEventListener('resize',()=>close());window.addEventListener('blur',()=>close());
  document.addEventListener('scroll',event=>{if(menu&&!menu.contains(event.target))close();},true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')close(true);});
  return {open,close};
})();
