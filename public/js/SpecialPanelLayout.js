/* Render special arrow panels without adding their editor layout to startup. */
window.SignMakerSpecialPanelLayout = (() => {
  const render = ({ mode, panel, index, signElmt, createShield,
    markSelectedRenderedSubpanel, bindRenderedBlockSelection, selectRenderedPanelArea }) => {
          if (mode === "roundabout") {
            const model=window.SignMakerRoundabout.render(signElmt,panel.sign);
            window.SignMakerRoundabout.directions.forEach((direction,subPanelIndex)=>{
              const subPanel=panel.sign.subPanels[subPanelIndex];
              if(!subPanel||!model.exits[direction])return;
              const frame=document.createElement('div');frame.className=`subPanelDisplay roundaboutDestination roundabout-${direction}`;
              frame.dataset.panelIndex=String(index);frame.dataset.subpanelIndex=String(subPanelIndex);
              markSelectedRenderedSubpanel(frame,subPanelIndex);
              const contents=document.createElement('div');contents.className=`signContentContainer shieldPosition${panel.sign.shieldPosition}`;
              const shields=document.createElement('div');shields.className='shieldsContainer';createShield(subPanel.shields,shields);contents.append(shields);
              const blocks=subPanel.blockElements.createElement(panel,subPanel);bindRenderedBlockSelection(blocks,subPanelIndex);contents.append(blocks);frame.append(contents);
              frame.addEventListener('click',e=>{e.stopPropagation();selectRenderedPanelArea({panelIndex:index,subPanelIndex,menu:'subpanel',flashTarget:frame});});
              signElmt.append(frame);
            });
            signElmt.addEventListener('click',event=>{event.stopPropagation();selectRenderedPanelArea({panelIndex:index,menu:'guideArrows',guideMode:'roundabout',suppressRedraw:true});});
            return true;
          }

          if (mode === "diagrammatic") {
            signElmt.classList.add("diagrammaticSign");
            window.SignMakerDiagrammatics.render(signElmt, panel.sign);
            panel.sign.subPanels.forEach((subPanel,subPanelIndex)=>{
              const frame=document.createElement('div');frame.className='subPanelDisplay diagrammaticSubpanel';
              frame.dataset.panelIndex=String(index);frame.dataset.subpanelIndex=String(subPanelIndex);
              markSelectedRenderedSubpanel(frame,subPanelIndex);
              const contents=document.createElement('div');contents.className=`signContentContainer shieldPosition${panel.sign.shieldPosition}`;
              const shields=document.createElement('div');shields.className='shieldsContainer';createShield(subPanel.shields,shields);contents.append(shields);
              const blocks=subPanel.blockElements.createElement(panel,subPanel);bindRenderedBlockSelection(blocks,subPanelIndex);contents.append(blocks);frame.append(contents);
              signElmt.append(frame);
              window.SignMakerDiagrammatics.attachSubpanel(frame,panel.sign,subPanelIndex,contents);
              const selectAssembly = event => {
                if (event.target.closest('.diagrammaticSubpanelHandle')) return;
                if (window.SignMakerDiagrammatics.openAssembly({frame,sign:panel.sign,index:subPanelIndex,panelIndex:index,selectRenderedPanelArea})) {
                  event.preventDefault();event.stopImmediatePropagation();
                }
              };
              frame.addEventListener('pointerdown',e=>e.stopPropagation());
              frame.addEventListener('click',selectAssembly,true);
              frame.addEventListener('contextmenu',selectAssembly,true);
              frame.addEventListener('click',e=>{e.stopPropagation();selectRenderedPanelArea({panelIndex:index,subPanelIndex,menu:'subpanel',flashTarget:frame});});
            });
            renderQuebecMarker(panel,index,signElmt,selectRenderedPanelArea);
            signElmt.addEventListener("click", (event) => {
              event.stopPropagation();
              selectRenderedPanelArea({ panelIndex: index, menu: "guideArrows",
                guideMode: "diagrammatic", suppressRedraw: true });
            });
            return true;
          }

    return false;
  };
  // Extend full-bleed vertical dividers through surrounding padding to the sign
  // edge or other content; a transform keeps the row height unchanged.
  const layoutVerticalFullBleedDividers = (signElmt) => {
    const dividers = signElmt.querySelectorAll(".dividerElement.vertical.fullBleed");
    dividers.forEach((divider) => { divider.style.transform = ""; });

    for (const divider of dividers) {
      const rect = divider.getBoundingClientRect();
      if (!rect.height || !divider.offsetHeight) continue;
      let top = rect.top, bottom = rect.bottom;

      for (let element = divider; element !== signElmt && element.parentElement; element = element.parentElement) {
        const parent = element.parentElement;
        const style = window.getComputedStyle(parent);
        const elementStyle = window.getComputedStyle(element);
        const parentRect = parent.getBoundingClientRect();
        const innerTop = parentRect.top + (parseFloat(style.borderTopWidth) || 0);
        const innerBottom = parentRect.bottom - (parseFloat(style.borderBottomWidth) || 0);
        const topSpace = (parseFloat(style.paddingTop) || 0) + Math.max(0, parseFloat(elementStyle.marginTop) || 0);
        const bottomSpace = (parseFloat(style.paddingBottom) || 0) + Math.max(0, parseFloat(elementStyle.marginBottom) || 0);
        if (top - innerTop <= topSpace + 0.5) top = Math.min(top, innerTop);
        if (innerBottom - bottom <= bottomSpace + 0.5) bottom = Math.max(bottom, innerBottom);
      }

      if (top === rect.top && bottom === rect.bottom) continue;
      const layoutScale = divider.offsetHeight / rect.height;
      divider.style.transform =
        `translateY(${(top - rect.top) * layoutScale}px) scaleY(${(bottom - top) / rect.height})`;
    }
  };

  const renderWarningFace = (signElmt, post, getResolvedCssColorValue) => {
      if (signElmt.closest('.panel.warningDiamond')) {
        const container = signElmt.parentElement;
        let face = container.querySelector(':scope > .warningDiamondFace');
        if (!face) {
          face = document.createElement('div');
          face.className = 'warningDiamondFace';
          face.setAttribute('aria-hidden', 'true');
          container.prepend(face);
        }
        const panel = signElmt.closest('.panel');
        const index = Number(panel.dataset.panelIndex);
        const color = getResolvedCssColorValue(post.panels[index]?.color) || 'var(--yellow)';
        face.style.backgroundColor = color;
        face.style.borderColor = getComputedStyle(signElmt).color;
        // A centered upright rectangle fits a diamond whose diagonal is w+h.
        const extent = Math.ceil(signElmt.offsetWidth + signElmt.offsetHeight);
        container.style.setProperty('--warningDiamondExtent', extent + 'px');
        return true;
      }
    return false;
  };
          const bindRenderedBlockSelection = (blockMasterElmt, { index, subPanelIndex,
            currentlyEditingGroupPath, currentlySelectedPanelIndex, currentlySelectedSubPanelIndex,
            currentlySelectedRowIndex, currentlySelectedBlockIndex, selectRenderedPanelArea }) => {
            const bindControl = (master, groupPath = []) => {
              master.dataset.panelIndex = String(index);
              master.dataset.subpanel = String(subPanelIndex);
              const samePath = JSON.stringify(groupPath) === JSON.stringify(currentlyEditingGroupPath);
              const rows = Array.from(master.children).filter(element => element.classList.contains("blockElementRow"));
              rows.forEach((rowElmt, rowIndex) => {
                rowElmt.dataset.signRow = String(rowIndex);
                rowElmt.classList.toggle("selectedRenderedBlockRow", samePath && index === currentlySelectedPanelIndex && subPanelIndex === currentlySelectedSubPanelIndex && rowIndex === currentlySelectedRowIndex);
                rowElmt.addEventListener("click", event => {
                  if (event.target.closest("[data-sign-row][data-sign-block]")?.closest(".blockElementMaster") === master) return;
                  event.stopPropagation();
                  selectRenderedPanelArea({ panelIndex:index, subPanelIndex, rowIndex, blockIndex:0, groupPath, menu:"subpanel", flashTarget:rowElmt });
                });
              });
              master.querySelectorAll("[data-sign-row][data-sign-block]").forEach(blockElmt => {
                if (blockElmt.closest(".blockElementMaster") !== master) return;
                const rowIndex = Number(blockElmt.dataset.signRow), blockIndex = Number(blockElmt.dataset.signBlock);
                blockElmt.classList.toggle("selectedRenderedBlockElement", samePath && index === currentlySelectedPanelIndex && subPanelIndex === currentlySelectedSubPanelIndex && rowIndex === currentlySelectedRowIndex && blockIndex === currentlySelectedBlockIndex);
                blockElmt.addEventListener("click", event => {
                  event.preventDefault(); event.stopPropagation();
                  selectRenderedPanelArea({ panelIndex:index, subPanelIndex, rowIndex, blockIndex, groupPath, menu:"subpanel", flashTarget:blockElmt });
                });
                blockElmt.addEventListener("contextmenu", event => {
                  event.preventDefault(); event.stopPropagation();
                  selectRenderedPanelArea({ panelIndex:index, subPanelIndex, rowIndex, blockIndex, groupPath, menu:"subpanel", flashTarget:blockElmt });
                  window.SignMakerBlockMenu?.open(event);
                });
                const nested = blockElmt.querySelector(".bE-groupedBlockElementContent");
                if (nested) bindControl(nested, groupPath.concat({ rowIndex, blockIndex }));
              });
            };
            if (blockMasterElmt) bindControl(blockMasterElmt);
          };

  const renderQuebecMarker = (panel,panelIndex,host,selectRenderedPanelArea) => {
    const {sign}=panel;
    if(!sign.quebecExitMarkerEnabled)return;
    const position=String(sign.quebecExitMarkerPosition||'').replace(/^Bottom\s+/i,'').trim().toLowerCase();
    const alignment=position==='left'?'Left':position==='right'?'Right':'Center';
    const marker=document.createElement('div');marker.className=`qcExitMarker qcOnSign qc${alignment}`;
    marker.classList.toggle('flipped',!!sign.quebecExitMarkerFlipped);
    const width=Number(sign.quebecExitMarkerSizeRem)||3.05;
    marker.style.setProperty('--qc-marker-width',width+'rem');
    marker.style.setProperty('--qc-marker-height',width*.387+'rem');
    marker.style.setProperty('--qc-marker-font-size',width*.33+'rem');
    const image=document.createElement('img');image.className='qcExitMarkerImg';
    image.src='img/other-symbols/QC-Exit.svg';image.alt='Quebec exit marker';
    const number=document.createElement('span');number.className='qcExitMarkerNumber';
    number.textContent=String(sign.quebecExitMarkerNumber||'1').trim();
    marker.append(image,number);
    const exitTabIndex=panel.exitTabs?.findIndex(tab=>tab?.variant==='Quebec Exit Marker'&&String(tab.number||'').trim());
    if(exitTabIndex>=0){
      marker.dataset.exitTabIndex=String(exitTabIndex);
      marker.addEventListener('click',event=>{
        event.stopPropagation();selectRenderedPanelArea({panelIndex,exitTabIndex,menu:'exitTabs',flashTarget:marker});
      });
    }
    host.append(marker);
  };
  const addSubpanel = ({sign,bounds,panelIndex,selectRenderedPanelArea,updateForm,redraw,clamp}) => {
    if(sign?.arrowMode!=='diagrammatic'||!bounds||!['x','y','width','height'].every(k=>Number.isFinite(bounds[k])))return;
    const diagrammatics=window.SignMakerDiagrammatics;
    sign.subPanels.forEach((subPanel,index)=>{
      subPanel.diagrammaticBounds=diagrammatics.assemblyBounds(sign,index);
    });
    sign.newSubPanel();
    const subPanelIndex=sign.subPanels.length-1,subPanel=sign.subPanels[subPanelIndex];
    const x=clamp(bounds.x,0,.99),y=clamp(bounds.y,0,.99);
    subPanel.diagrammaticBounds={x,y,width:clamp(bounds.width,.01,1-x),height:clamp(bounds.height,.01,1-y)};
    diagrammatics.selectAssembly(subPanel);
    selectRenderedPanelArea({panelIndex,subPanelIndex,menu:'guideArrows',guideMode:'diagrammatic',suppressRedraw:true});
    updateForm();redraw();
  };
  const editModel = (sign, kind, change, updateForm, redraw, shouldRedraw = true) => {
    if (!sign) return;
    const service = kind === "roundabout" ? window.SignMakerRoundabout : window.SignMakerDiagrammatics;
    sign[kind] = service.normalize(sign[kind]);
    if (kind === "roundabout") change(sign[kind]); else change(sign[kind], sign);
    if (shouldRedraw) { updateForm(); redraw(); }
  };
  return { render, layoutVerticalFullBleedDividers, renderWarningFace, bindRenderedBlockSelection, addSubpanel, editModel };
})();
