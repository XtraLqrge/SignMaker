/* Device preferences only: applied to new signs/arrows, never existing artwork. */
window.SignMakerGuideDefaults = (() => {
  const key='signMaker.guideArrowDefaults.v1';
  const standardBase={type:'DOWN',angle:null,flip:false,size:3,padding:0.2,spacing:8.5,alignment:'Center',position:'Down'};
  const aplBase={kind:'',size:null,spacing:null,exitOnly:false};
  const kinds=['UP','UP_LEFT','UP_RIGHT','DUAL_TURN','LEFT_TURN','RIGHT_TURN','UP_CFX','UP_LEFT_CFX','UP_RIGHT_CFX','LEFT_TURN_CFX','RIGHT_TURN_CFX'];
  let stored={};try{stored=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch{}
  const standard={...standardBase},apl={...aplBase};
  const clamp=(v,min,max,fallback)=>v==null||v===''?fallback:Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):fallback;
  const normalize=()=>{
    standard.type=Object.hasOwn(ArrowElement.prototype.arrows,standard.type)?standard.type:'DOWN';
    for(const [name,min,max] of [['angle',0,360],['size',1,5],['padding',0,25],['spacing',0,25]]) standard[name]=clamp(standard[name],min,max,standardBase[name]);
    standard.flip=standard.flip===true;
    standard.alignment=['Left','Center','Right'].includes(standard.alignment)?standard.alignment:'Center';
    standard.position=['Down','Left','Right'].includes(standard.position)?standard.position:'Down';
    apl.kind=kinds.includes(apl.kind)?apl.kind:'';
    apl.size=clamp(apl.size,1,10,null);apl.spacing=clamp(apl.spacing,0,25,null);apl.exitOnly=apl.exitOnly===true;
    Sign.prototype.guideDefaults={...standard};
  };
  for(const k of Object.keys(standard))if(stored.standard?.[k]!==undefined)standard[k]=stored.standard[k];
  for(const k of Object.keys(apl))if(stored.apl?.[k]!==undefined)apl[k]=stored.apl[k];
  normalize();
  const save=()=>{normalize();try{localStorage.setItem(key,JSON.stringify({standard,apl}));}catch{}};
  const init=()=>{
    const pretty=value=>value.replace(/_/g,' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
    const build=(hostId,values,base,fields)=>{
      const host=document.getElementById(hostId);if(!host||host.dataset.guideDefaultsBound)return;
      host.dataset.guideDefaultsBound='true';host.classList.add('guideArrowDefaults');

      const controls=[];
      for(const [name,title,options,min,max] of fields){
        const row=document.createElement('div');row.className='generalSettingRow';
        const label=document.createElement('label');label.textContent=title+':';label.htmlFor=hostId+'_'+name;
        const control=document.createElement(Array.isArray(options)?'select':'input');control.id=label.htmlFor;
        if(Array.isArray(options))for(const option of options){const [value,text]=Array.isArray(option)?option:[option,pretty(option)];control.add(new Option(text,value));}
        else {control.type=options;if(options==='number'){control.min=min;control.max=max;control.step='0.05';control.placeholder='Automatic';}}
        const sync=()=>{if(control.type==='checkbox')control.checked=values[name];else control.value=values[name]??'';};sync();controls.push(sync);
        control.addEventListener('change',()=>{values[name]=control.type==='checkbox'?control.checked:control.type==='number'?(control.value===''?null:Number(control.value)):control.value;save();sync();});
        const wrapper=document.createElement('div');wrapper.className='generalSettingControl';wrapper.append(control);row.append(label,wrapper);host.append(row);
      }
      const reset=document.createElement('button');reset.type='button';reset.textContent='Reset defaults';reset.addEventListener('click',()=>{Object.assign(values,base);save();controls.forEach(fn=>fn());window.nativeSelectPickers?.forEach(p=>p.sync());});host.append(reset);
    };
    build('settingsDefaultStandardArrows',standard,standardBase,[['type','Arrow',Object.keys(ArrowElement.prototype.arrows)],['angle','Rotation (degrees)','number',0,360],['flip','Flip','checkbox'],['size','Size (rem)','number',1,5],['padding','Padding (rem)','number',0,25],['spacing','Spacing (rem)','number',0,25],['alignment','Alignment',['Left','Center','Right']],['position','Position',['Down','Left','Right']]]);
    build('settingsDefaultAPLArrows',apl,aplBase,[['kind','Arrow',[['','Automatic'],...kinds]],['size','Size (rem)','number',1,10],['spacing','Spacing (rem)','number',0,25],['exitOnly','Exit Only','checkbox']]);
  };
  return {standard,apl,init};
})();
