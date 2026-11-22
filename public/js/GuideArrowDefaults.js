/* Device preferences only: applied to new signs/arrows, never existing artwork. */
window.SignMakerGuideDefaults = (() => {
  const key='signMaker.guideArrowDefaults.v1';
  const standardBase={type:'DOWN',angle:null,flip:false,size:3,padding:0.2,spacing:8.5,alignment:'Center',position:'Down'};
  const aplBase={kind:'',size:null,spacing:null,exitOnly:false};
  // Sign field names, so Post.newPanel can copy them straight onto a new sign.
  const exitBase={exitArrowType:'DOWN',exitArrowAngle:null,exitArrowFlip:false,exitArrowSize:3,exitArrowPadding:0.2,exitArrowHorizontalPadding:0.2,exitArrowSpacing:8.5,
    exitOnlyLeftText:'EXIT',exitOnlyRightText:'ONLY',exitTextFont:'Series E',exitTextSize:70,exitTextSpacing:0,exitTextColor:'Inherit',
    exitBackgroundColor:'Yellow',exitBorderColor:'Inherit',exitTopBorder:false,exitColorEdges:true,exitTexasBorder:true,exitForceSubpanelWidth:false};
  const kinds=['UP','UP_LEFT','UP_RIGHT','DUAL_TURN','LEFT_TURN','RIGHT_TURN','UP_CFX','UP_LEFT_CFX','UP_RIGHT_CFX','LEFT_TURN_CFX','RIGHT_TURN_CFX'];
  let stored={};try{stored=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch{}
  const standard={...standardBase},apl={...aplBase},exitOnly={...exitBase};
  const clamp=(v,min,max,fallback)=>v==null||v===''?fallback:Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):fallback;
  const normalize=()=>{
    standard.type=Object.hasOwn(ArrowElement.prototype.arrows,standard.type)?standard.type:'DOWN';
    for(const [name,min,max] of [['angle',0,360],['size',1,5],['padding',0,25],['spacing',0,25]]) standard[name]=clamp(standard[name],min,max,standardBase[name]);
    standard.flip=standard.flip===true;
    standard.alignment=['Left','Center','Right'].includes(standard.alignment)?standard.alignment:'Center';
    standard.position=['Down','Left','Right'].includes(standard.position)?standard.position:'Down';
    apl.kind=kinds.includes(apl.kind)?apl.kind:'';
    apl.size=clamp(apl.size,1,10,null);apl.spacing=clamp(apl.spacing,0,25,null);apl.exitOnly=apl.exitOnly===true;
    exitOnly.exitArrowType=Object.hasOwn(ArrowElement.prototype.arrows,exitOnly.exitArrowType)?exitOnly.exitArrowType:'DOWN';
    exitOnly.exitArrowAngle=clamp(exitOnly.exitArrowAngle,0,359,null);
    for(const [name,min,max] of [['exitArrowSize',1,5],['exitArrowPadding',0,4],['exitArrowHorizontalPadding',0,4],['exitArrowSpacing',0,25],['exitTextSize',50,100],['exitTextSpacing',-0.15,0.15]]) exitOnly[name]=clamp(exitOnly[name],min,max,exitBase[name]);
    for(const name of ['exitArrowFlip','exitTopBorder','exitColorEdges','exitTexasBorder','exitForceSubpanelWidth']) exitOnly[name]=typeof exitOnly[name]==='boolean'?exitOnly[name]:exitBase[name];
    for(const name of ['exitOnlyLeftText','exitOnlyRightText']) exitOnly[name]=typeof exitOnly[name]==='string'?exitOnly[name]:exitBase[name];
    for(const name of ['exitTextFont','exitTextColor','exitBackgroundColor','exitBorderColor']) exitOnly[name]=typeof exitOnly[name]==='string'&&exitOnly[name].trim()?exitOnly[name]:exitBase[name];
    Sign.prototype.guideDefaults={...standard};
  };
  for(const k of Object.keys(standard))if(stored.standard?.[k]!==undefined)standard[k]=stored.standard[k];
  for(const k of Object.keys(apl))if(stored.apl?.[k]!==undefined)apl[k]=stored.apl[k];
  for(const k of Object.keys(exitOnly))if(stored.exitOnly?.[k]!==undefined)exitOnly[k]=stored.exitOnly[k];
  normalize();
  // Post.newPanel applies these to new panels only; loaded signs keep their values.
  // A null ("Automatic") angle keeps the sign's computed one. Panels created during
  // startup, before this script loaded, are still untouched and get them now.
  Post.applyDefaults=sign=>{for(const k in exitOnly)if(exitOnly[k]!==null)sign[k]=exitOnly[k];};
  Post.pendingDefaults?.splice(0).forEach(Post.applyDefaults);
  const save=()=>{normalize();try{localStorage.setItem(key,JSON.stringify({standard,apl,exitOnly}));}catch{}};
  const init=()=>{
    const pretty=value=>value.replace(/_/g,' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
    const build=(hostId,values,base,fields)=>{
      const host=document.getElementById(hostId);if(!host||host.dataset.guideDefaultsBound)return;
      host.dataset.guideDefaultsBound='true';host.classList.add('guideArrowDefaults');

      const controls=[];
      for(const [name,title,rawOptions,min,max,step] of fields){
        const options=typeof rawOptions==='function'?rawOptions():rawOptions;
        const row=document.createElement('div');row.className='generalSettingRow';
        const label=document.createElement('label');label.textContent=title+':';label.htmlFor=hostId+'_'+name;
        const control=document.createElement(Array.isArray(options)?'select':'input');control.id=label.htmlFor;
        if(Array.isArray(options))for(const option of options){const [value,text]=Array.isArray(option)?option:[option,pretty(option)];control.add(new Option(text,value));}
        else {control.type=options;if(options==='number'){control.min=min;control.max=max;control.step=step||'0.05';control.placeholder='Automatic';}}
        // Text fields show a line break as \n, matching the Exit Only editor.
        if(options==='text')control.title='Type \\n for a new line';
        const sync=()=>{if(control.type==='checkbox')control.checked=values[name];else if(control.type==='text')control.value=String(values[name]??'').replace(/\r\n?|\n/g,'\\n');else control.value=values[name]??'';};sync();controls.push(sync);
        control.addEventListener('change',()=>{values[name]=control.type==='checkbox'?control.checked:control.type==='number'?(control.value===''?null:Number(control.value)):control.type==='text'?control.value.replace(/\\n/g,'\n'):control.value;save();sync();});
        const wrapper=document.createElement('div');wrapper.className='generalSettingControl';wrapper.append(control);row.append(label,wrapper);host.append(row);
      }
      const reset=document.createElement('button');reset.type='button';reset.textContent='Reset defaults';reset.addEventListener('click',()=>{Object.assign(values,base);save();controls.forEach(fn=>fn());window.nativeSelectPickers?.forEach(p=>p.sync());});host.append(reset);
    };
    build('settingsDefaultStandardArrows',standard,standardBase,[['type','Arrow',Object.keys(ArrowElement.prototype.arrows)],['angle','Rotation (degrees)','number',0,360],['flip','Flip','checkbox'],['size','Size (rem)','number',1,5],['padding','Padding (rem)','number',0,25],['spacing','Spacing (rem)','number',0,25],['alignment','Alignment',['Left','Center','Right']],['position','Position',['Down','Left','Right']]]);
    // Fonts and colors come from the Exit Only editor's own lists.
    const editorOptions=(id,fallback)=>{const list=[...(document.getElementById(id)?.options||[])].map(o=>[o.value,o.textContent]);return list.length?list:fallback.map(v=>[v,v]);};
    const colors=first=>[first,...Object.keys(lib.colors).filter(c=>c!==first)];
    build('settingsDefaultExitOnly',exitOnly,exitBase,[['exitArrowType','Arrow',Object.keys(ArrowElement.prototype.arrows)],['exitArrowAngle','Angle (degrees)','number',0,359,'1'],['exitArrowFlip','Flip arrow','checkbox'],
      ['exitArrowSize','Arrow size (rem)','number',1,5,'0.1'],['exitArrowPadding','Arrow padding up/down (rem)','number',0,4,'0.05'],['exitArrowHorizontalPadding','Arrow padding left/right (rem)','number',0,4,'0.05'],['exitArrowSpacing','Arrow spacing (rem)','number',0,25,'0.1'],
      ['exitOnlyLeftText','Left text','text'],['exitOnlyRightText','Right text','text'],['exitTextFont','Font',()=>editorOptions('exitTextFont',TextElement.prototype.fontFamily)],
      ['exitTextSize','Text size (%)','number',50,100,'5'],['exitTextSpacing','Letter spacing','number',-0.15,0.15,'0.01'],['exitTextColor','Text color',()=>editorOptions('exitTextColor',colors('Inherit'))],
      ['exitBackgroundColor','Background',()=>editorOptions('exitBackgroundColor',colors('Yellow'))],['exitBorderColor','Border',()=>editorOptions('exitBorderColor',colors('Inherit'))],
      ['exitTopBorder','Top border','checkbox'],['exitColorEdges','Color corners','checkbox'],['exitTexasBorder','Texas border','checkbox'],['exitForceSubpanelWidth','Force subpanel width','checkbox']]);
    build('settingsDefaultAPLArrows',apl,aplBase,[['kind','Arrow',[['','Automatic'],...kinds]],['size','Size (rem)','number',1,10],['spacing','Spacing (rem)','number',0,25],['exitOnly','Exit Only','checkbox']]);
  };
  return {standard,apl,exitOnly,init};
})();
