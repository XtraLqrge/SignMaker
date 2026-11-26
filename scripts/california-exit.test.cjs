const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {Node}=require('./fixtures/mobile-dom.cjs'),{cascade}=require('./fixtures/css-cascade.cjs');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8'),manifest=JSON.parse(read('build-manifest.json'));
const assets=['public/js/CaliforniaExit.js'],built=manifest.assets.find(asset=>asset.source==='js/CaliforniaExit.js');if(built)assets.push('public/'+built.output);
const camel=name=>name.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());
function fixture(file){
  const nodes=new Map(),jobs=[],make=(tag='div')=>{const node=new Node(tag);node.style.marginTop='';node.style.alignSelf='';node.style.getPropertyValue=name=>node.style[camel(name)]||'';node.style.setProperty=(name,value)=>node.style[camel(name)]=value;node.style.removeProperty=name=>delete node.style[camel(name)];return node;};
  const document={getElementById:id=>nodes.get(id)||null,documentElement:make('html')};
  const style=node=>({fontSize:'16px',borderTopWidth:node.classList.contains('sign')||node.classList.contains('blockElementRow')?'10px':'0px',borderLeftWidth:node.classList.contains('sign')?'10px':'0px',borderRightWidth:node.classList.contains('sign')?'10px':'0px',paddingTop:'0px',borderTopLeftRadius:'4px',borderTopRightRadius:'4px',...node.style});
  const c=vm.createContext({window:{},document,console,getComputedStyle:style,requestAnimationFrame:fn=>{jobs.push(fn);return jobs.length;},cancelAnimationFrame(){}});
  vm.runInContext(read('public/js/ExitTab.js')+';this.Exit=ExitTab;',c);vm.runInContext(read(file),c);
  const html=make('html'),panel=make(),surface=make(),sign=make();panel.className='panel';surface.className='signContainer';sign.className='sign';html.append(panel);panel.append(surface);surface.append(sign);
  let width=400;Object.defineProperty(sign,'offsetWidth',{get:()=>Math.max(width,parseFloat(sign.style.minWidth)||0)});Object.defineProperty(sign,'offsetHeight',{get:()=>Math.max(200,parseFloat(sign.style.minHeight)||0)});
  let scale=1;const rect=(left,top,w,h)=>({left:left*scale,top:top*scale,right:(left+w)*scale,bottom:(top+h)*scale,width:w*scale,height:h*scale});
  sign.getBoundingClientRect=()=>rect(0,0,sign.offsetWidth,sign.offsetHeight);
  const row=make();row.className='blockElementRow';sign.append(row);row.getBoundingClientRect=()=>rect(0,10,sign.offsetWidth,90);
  const group=(alignment,left,w)=>{const node=make(),block=make('span');node.className='blockElement'+alignment;node.dataset.blockAlignment=alignment;node.append(block);row.append(node);node.getBoundingClientRect=()=>rect(left,20+(parseFloat(node.style.marginTop)||0),w,50);block.getBoundingClientRect=()=>rect(left,20+(parseFloat(block.parentElement.style.marginTop)||0)+(parseFloat(block.style.marginTop)||0),w,50);return node;};
  const left=group('Left',20,90),right=group('Right',210,170),model={exitTabs:[]};
  const entry=(position='Right',number='EXIT 20A')=>{const index=model.exitTabs.length,tabModel={variant:'California',position,number,cornerRadius:.25,fullBorder:false,showLeft:true,bilingual:true,topOffset:true};model.exitTabs.push(tabModel);
    const container=make(),holder=make(),tab=make();container.className='exitTabContainer';holder.className='exitTabHolder';tab.className='exitTab';holder.append(tab);container.append(holder);
    container.getBoundingClientRect=()=>{const isLeft=container.dataset.californiaSide==='left',x=isLeft?10+(parseFloat(container.style.left)||0):sign.offsetWidth-10-150-(parseFloat(container.style.right)||0);return rect(x,10+(parseFloat(container.style.top)||0),150,50);};
    return {exitTabCont:container,exitTabIndex:index};};
  return {c,api:c.window.CaliforniaExit,make,nodes,panel,surface,sign,left,right,row,model,entry,jobs,set width(value){width=value;},set scale(value){scale=value;}};
}
for(const file of assets){
  test(`${file}: legacy checkbox data becomes a dedicated type and rendering ignores incompatible flags`,()=>{
    const h=fixture(file),old={variant:'Default',caStyle:true,position:'Center',width:'Out',number:'EXIT 20A',fullBorder:false,showLeft:true,bilingual:true,topOffset:true,dragOffsetRem:5,dragSnapAnchor:{kind:'tab'}};
    const rendered=h.api.view(old);assert.equal(old.variant,'California');assert.equal(old.position,'Right');assert.equal(old.width,'Narrow');assert.equal(old.dragOffsetRem,0);assert.equal(old.dragSnapAnchor,undefined);
    assert.equal(rendered.variant,'Default');assert.equal(rendered.caStyle,true);assert.equal(rendered.showLeft,false);assert.equal(rendered.bilingual,false);assert.equal(rendered.topOffset,false);assert.equal(rendered.fullBorder,true);
    assert.equal(h.api.view(rendered),rendered);assert.equal(old.number,'EXIT 20A');
    assert.equal(new h.c.Exit({caStyle:true,number:'EXIT 44A'}).variant,'California');
    const standard={variant:'Default',caStyle:false,position:'Center',width:'Full'};assert.equal(h.api.view(standard),standard);assert.equal(standard.position,'Center');
  });
  test(`${file}: California controls offer left/right and disable width and incompatible checkboxes`,()=>{
    const h=fixture(file),select=h.make('select');select.options=['Left','Center','Right'].map(value=>({value,disabled:false,hidden:false}));select.value='Center';
    const wrapper=h.make();for(const title of ['Left alignment','Center alignment','Right alignment']){const button=h.make('button');button.title=title;wrapper.append(button);}let synced=0;select._alignmentButtonsApi={wrapper,sync(){synced++;}};h.nodes.set('exitTabPosition',select);
    for(const id of ['exitTabWidth','showLeft','fullBorder','exitTabBilingual','topOffset','minHeight','exitTabHorizontalPadding']){const input=h.make('input');input.type=id==='exitTabWidth'?'select-one':'checkbox';h.nodes.set(id,input);}
    h.api.syncEditor('California');assert.equal(select.value,'Right');assert.equal(select.options[1].hidden,true);assert.equal(wrapper.children[1].hidden,true);assert.ok(synced);
    for(const id of ['exitTabWidth','showLeft','fullBorder','exitTabBilingual','topOffset'])assert.equal(h.nodes.get(id).disabled,true);
    assert.equal(h.nodes.get('minHeight').disabled,false);assert.equal(h.nodes.get('exitTabHorizontalPadding').disabled,false);assert.equal(h.nodes.get('showLeft').checked,false);assert.equal(h.nodes.get('fullBorder').checked,true);
    h.api.syncEditor('Default');assert.equal(select.options[1].hidden,false);assert.equal(wrapper.children[1].hidden,false);assert.equal(h.nodes.get('exitTabWidth').disabled,false);
  });
  test(`${file}: corner geometry is scale-independent and only colliding content moves`,()=>{
    for(const scale of [1,.5,1.5]){
      const h=fixture(file);h.scale=scale;const entry=h.entry();h.api.mount(h.panel,h.model,[entry]);
      const box=entry.exitTabCont.getBoundingClientRect();assert.equal(box.top,0);assert.equal(box.right,h.sign.offsetWidth*scale);assert.equal(entry.exitTabCont.parentElement,h.sign);
      assert.equal(h.sign.style.borderTopRightRadius,'4px');assert.equal(h.surface.style.borderTopRightRadius,undefined);assert.equal(h.sign.style.borderTopLeftRadius,undefined);
      assert.equal(h.left.style.marginTop,'0px');assert.ok(parseFloat(h.right.children[0].style.marginTop)>0);assert.equal(h.api.clearance(h.right.children[0].getBoundingClientRect(),[box],2.4*scale)<.001,true);
      const initial=h.right.children[0].style.marginTop;h.api.refresh(h.panel);assert.equal(h.right.children[0].style.marginTop,initial,'Repeated measurement must not accumulate padding');
      h.width=500;h.api.refresh(h.panel);assert.equal(entry.exitTabCont.getBoundingClientRect().right,500*scale,'Widening for side guide arrows keeps the tab at the new corner');h.api.disconnect();
    }
  });
  test(`${file}: a sharp material corner stays square while the border keeps the custom tab radius`,()=>{
    for(const side of ['Left','Right']){
      const h=fixture(file),entry=h.entry(side),property='borderTop'+side+'Radius',tab=entry.exitTabCont.querySelector('.exitTab');
      h.surface.style[property]='0px';tab.style[property]='18px';h.model.exitTabs[0].cornerRadius=1.125;h.api.mount(h.panel,h.model,[entry]);
      assert.equal(h.sign.style[property],'18px');assert.equal(h.surface.style[property],'0px');assert.equal(tab.style[property],'18px');
      tab.style[property]='8px';h.api.refresh(h.panel);assert.equal(h.sign.style[property],'8px');assert.equal(h.surface.style[property],'0px');h.api.disconnect();
    }
  });
  test(`${file}: neighboring blocks in the same alignment group can share the top row beside a plaque`,()=>{
    const h=fixture(file),entry=h.entry(),shield=h.left.children[0],text=h.right.children[0];h.left.append(text);h.right.remove();h.api.mount(h.panel,h.model,[entry]);
    assert.equal(shield.style.marginTop,'0px');assert.ok(parseFloat(text.style.marginTop)>0);assert.ok(h.api.clearance(text.getBoundingClientRect(),[entry.exitTabCont.getBoundingClientRect()],2.4)<.001);h.api.disconnect();
  });
  test(`${file}: a nested California type uses its own model and leaves its parent unchanged`,()=>{
    const h=fixture(file),entry=h.entry('Left'),nested=h.model.exitTabs[0];h.model.exitTabs[0]={variant:'Default',position:'Right',nestedExitTabs:[nested]};entry.nestedExitTabIndex=0;h.api.mount(h.panel,h.model,[entry]);
    assert.equal(entry.exitTabCont.dataset.californiaSide,'left');assert.equal(h.model.exitTabs[0].variant,'Default');assert.equal(nested.variant,'California');h.api.disconnect();
  });
  test(`${file}: left corners, multiple plaques, empty text, and retained panels stay stable`,()=>{
    const h=fixture(file),first=h.entry('Left'),second=h.entry('Left'),empty=h.entry('Right','');h.api.mount(h.panel,h.model,[first,second,empty]);
    assert.equal(first.exitTabCont.getBoundingClientRect().left,0);assert.equal(first.exitTabCont.getBoundingClientRect().top,0);assert.equal(second.exitTabCont.getBoundingClientRect().top,50);assert.equal(empty.exitTabCont.hidden,true);
    assert.equal(h.sign.style.borderTopLeftRadius,'4px');assert.ok(parseFloat(h.left.children[0].style.marginTop)>50);assert.equal(h.right.style.marginTop,'0px');
    h.api.disconnect();h.api.mount(h.panel,h.model);assert.equal(first.exitTabCont.parentElement,h.sign);assert.equal(h.sign.querySelectorAll('.californiaExitTab').length,3);h.api.disconnect();
  });
}
test('California keeps normal minimum-height controls, compact line boxes, and adjustable horizontal padding',()=>{
  const html=read('scripts/index.source.html');assert.equal(/id="caStyle"/.test(html),false);assert.match(read('public/js/ExitTab.js'),/variants = \["Default", "California"/);
  for(const css of [read('public/css/signs.css'),read('public/'+manifest.deferredStyles)]){
    const style=cascade(css,{respectLayers:true}),container=new Node(),tab=new Node(),vertical=new Node();container.className='californiaExitTab';tab.className='exitTab verticalArrangement';vertical.className='exitTabVerticalContainer';container.append(tab);tab.append(vertical);
    assert.equal(style(container,'position'),'absolute');assert.equal(style(tab,'min-height'),'2.25rem');assert.equal(style(vertical,'gap'),'0.06em');assert.ok(style(tab,'padding').includes('--exitTabHorizontalPadding'));assert.equal(style(tab,'line-height'),'1');
  }
});
test('embedded tabs bypass external snapping and sign-shape cuts, and mount after the final arrow layout',()=>{
  const main=read('public/js/main.js');assert.match(main,/exitTab\.caStyle === true \|\| exitTab\.variant === "California"\) return/);assert.ok(/exitTab\.variant !== "California" && exitTab\.caStyle !== true &&\s+!isEmptyDefaultExitTab/.test(main));
  assert.match(main,/CaliforniaExit\?\.mount\(panelElmt, panel, caStyleExitTabs\)/);assert.equal(main.includes('// Insert CA style exit tabs at the beginning of the first subpanel'),false);
});

test('California minimum height honors zero and small values in horizontal and vertical layouts',()=>{
  const main=read('public/js/main.js'),nodes=[require('./build.cjs').parse(main)];let block;
  while(nodes.length){const node=nodes.pop();if(node.type==='IfStatement'&&node.test.type==='MemberExpression'&&node.test.property.name==='_californiaRender'){block=main.slice(node.start,node.end);break;}for(const value of Object.values(node))if(Array.isArray(value))nodes.push(...value.filter(item=>item?.type));else if(value?.type)nodes.push(value);}
  assert.ok(block,'The render branch must honor the California minimum without a vertical floor');
  for(const minimum of [0,.05,.25,1,3.5])for(const verticalArrangement of [true,false]){
    const exitTab={_californiaRender:true,minHeight:minimum,verticalArrangement,variant:'Default'},exitTabElmt={style:{}};
    vm.runInNewContext(block,{exitTab,exitTabElmt,ExitTab:{prototype:{defaultMinHeight:2.25}}});assert.equal(exitTabElmt.style.minHeight,minimum+'rem');
  }
  const exitTab={_californiaRender:false,minHeight:.05,verticalArrangement:true,variant:'Default'},exitTabElmt={style:{}};
  vm.runInNewContext(block,{exitTab,exitTabElmt,ExitTab:{prototype:{defaultMinHeight:2.25}}});assert.equal(exitTabElmt.style.minHeight,'calc(3.75rem + 2 * var(--exitTabVerticalPadding, 0rem))','Standard tabs keep their minimum and add the requested vertical padding');
});
