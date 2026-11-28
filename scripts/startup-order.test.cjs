const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {parse, minifyJS} = require('./build.cjs');
const {Node, Event} = require('./fixtures/mobile-dom.cjs');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('public/js/main.js');
const manifest = JSON.parse(read('build-manifest.json'));
function declaration(name) {
  const pending = [parse(source)];
  while (pending.length) {
    const node = pending.pop();
    if (node.type === 'VariableDeclarator' && node.id.name === name) return 'const ' + source.slice(node.start, node.end) + ';';
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) pending.push(...value.filter(child => child?.type));
      else if (value?.type) pending.push(value);
    }
  }
  throw Error('Missing startup declaration ' + name);
}
const renderStart = source.indexOf('          const markSelectedRenderedSubpanel =');
const renderEnd = source.indexOf('          const g_top =', renderStart);
assert.ok(renderStart >= 0 && renderEnd > renderStart);
const renderDispatch = source.slice(renderStart, renderEnd);
const program = `
let initializationStarted=false,post,currentlySelectedPanelIndex=0;
const currentlySelectedSubPanelIndex=0,currentlySelectedRowIndex=0,currentlySelectedBlockIndex=0,currentlyEditingGroupPath=[];
${declaration('FIRST_RUN_POST_TYPE')}
${declaration('refreshDynamicPanelBorders')}
const redraw=()=>{
  note('paint');
  note('post:' + post.polePosition);
  for(const [index,panel] of post.panels.entries()){
    const {panelElmt,signElmt,blockMasterElmt}=createPaintDom();
    const caStyleExitTabs=[];
    ${renderDispatch}
    bindRenderedBlockSelection(blockMasterElmt,0);
    refreshDynamicPanelBorders(panelElmt);
  }
};
const loadSavedAppState=async snapshot=>{
  if(!snapshot)return false;
  post.panels[0].sign.arrowMode=snapshot.mode;
  return true;
};
${declaration('init')}
this.run=init;
`;
function harness({minified=false, snapshot=null, preferences=false} = {}) {
  const events = [], requested = [], nodes = [], selections = [];
  let requestedEditor;
  const editorRequested = new Promise(resolve => requestedEditor = resolve);
  const html = new Node('html');
  const make = tag => new Node(tag);
  const note = event => events.push(event);
  const supportSource = manifest.assets.find(asset => asset.source === 'js/FDOTSupports.js').output;
  const createPaintDom = () => {
    const panelElmt=make('div'),signElmt=make('div'),blockMasterElmt=make('div'),row=make('div'),block=make('div');
    panelElmt.className='panel';signElmt.className='sign';blockMasterElmt.className='blockElementMaster';row.className='blockElementRow';
    block.setAttribute('data-sign-row','0');block.setAttribute('data-sign-block','0');
    row.append(block);blockMasterElmt.append(row);signElmt.append(blockMasterElmt);panelElmt.append(signElmt);
    const result={panelElmt,signElmt,blockMasterElmt,block};nodes.push(result);return result;
  };
  const storage={getItem:key=>key==='signMaker.autosave.v1' ? snapshot && 'saved' : preferences && key==='signMaker.postColor' ? 'Green' : null};
  const window={localStorage:storage,addEventListener(){},performance:{mark:note,measure:note},
    SignMakerFonts:{preparePost:async()=>{},prepareElement:async()=>{}},
    SignMakerDiagrammatics:{render:()=>note('diagrammatic'),attachSubpanel(){}},
    SignMakerRoundabout:{directions:['left','thru','right'],render:()=>{note('roundabout');return {exits:{}};}}
  };
  const document={currentScript:{dataset:{editorScripts:JSON.stringify(manifest.deferredEditor),editorCss:manifest.deferredStyles}},
    documentElement:html,visibilityState:'visible',fonts:{ready:Promise.resolve()},createElement:make,
    head:{appendChild:node=>{
      if (node.src === supportSource) {
        note('post-support-request');
        node.onload();
        return;
      }
      requested.push(node);note('editor-request');requestedEditor();
    }},
    getElementById:()=>nodes.at(-1)?.panelElmt,querySelectorAll:()=>[],addEventListener(){}};
  const c=vm.createContext({window,document,console,Promise,setTimeout,clearTimeout,note,createPaintDom,
    requestAnimationFrame:callback=>callback(),Post:class {constructor(){this.panels=[];}newPanel(){this.panels.push({sign:{arrowMode:'standard',subPanels:[]}});}},
    DEFAULT_POST_POSITION:'Right',getDefaultPanelSpacing:()=>1,ensureExtendedGuideArrowOptions(){},bindDownloadResolutionControl(){},
    getRestoreOnRefreshMode:()=>'always',readSavedAppStateSnapshot:async()=>snapshot,prepareIconImagesForPost:async()=>{},
    initializeVmsRendering:()=>note('vms-ready'),migrateSavedSignTypographyOnce:async()=>null,CustomShields:class {},exposeToFormHandler:{},
    formHandler:{init:async(_api,{beforeUI})=>{await beforeUI();note('form-ready');},updateForm:()=>note('form-update'),showWelcomeTutorial:()=>note('welcome')},
    finishTemplateEditorSessionUi(){},applyRenderedExitTabAnchors(){},schedulePanelBorderGradientUpdate(){},schedulePostViewportLayoutUpdate(){},
    VmsPanel:{refreshPreviews(){}},saveAppState(){},bindPostViewportLayoutWatcher(){},
    PanelBorders:{refreshAll:()=>note('border-refresh')},applyPanelBorderGradient:()=>note('border-paint'),getResolvedCssColorValue:value=>value,
    normalizeArrowMode:mode=>mode,createShield(){},selectRenderedPanelArea:selection=>selections.push(selection)});
  vm.runInContext(read('public/js/Sign.js'),c);
  vm.runInContext(read('public/js/Startup.js'),c);
  vm.runInContext(minified ? minifyJS(program) : program,c);
  const run=c.run();
  // Retain rejected initialization as the test result, including failures before a request is made.
  const waitForEditor=()=>Promise.race([editorRequested,run.then(()=>{throw Error('Initialization finished before loading its editor');})]);
  const releaseEditor=()=>{
    const layout=manifest.assets.find(asset=>asset.source==='js/SpecialPanelLayout.js').output;
    for(const node of requested){
      if(node.src===layout)vm.runInContext(read('public/'+layout),c);
      node.onload();
    }
  };
  return {events,requested,nodes,selections,html,window,run,waitForEditor,releaseEditor};
}
for(const minified of [false,true]) {
  const name=minified?'minified':'source';
  test(`${name}: a fresh preview paints before deferred code and binds the first sign after it loads`,async()=>{
    const h=harness({minified});await h.waitForEditor();
    assert.equal(h.nodes.length,1);assert.equal(h.window.SignMakerSpecialPanelLayout,undefined);
    assert.ok(h.events.indexOf('paint')<h.events.indexOf('editor-request'));
    assert.ok(h.events.indexOf('post-support-request') < h.events.indexOf('paint'));
    assert.ok(h.events.includes('post:FDOTCantileverRight'));
    assert.ok(h.events.includes('border-paint'));assert.ok(h.events.includes('border-refresh'));
    assert.notEqual(h.html.dataset.appReady,'true');assert.equal(h.nodes[0].block.events.has('click'),false);
    h.releaseEditor();await h.run;
    assert.equal(h.html.dataset.appReady,'true');assert.equal(h.nodes.length,2);
    assert.ok(h.events.indexOf('welcome')>h.events.indexOf('signmaker:editor-ready'));
    assert.ok(h.nodes[1].block.events.has('click'));
    h.nodes[1].block.dispatchEvent(new Event('click'));
    assert.equal(h.selections.length,1);assert.equal(h.selections[0].blockIndex,0);
  });
  for(const mode of ['diagrammatic','roundabout'])test(`${name}: restored ${mode} signs wait for deferred rendering services`,async()=>{
    const h=harness({minified,snapshot:{mode}});await h.waitForEditor();
    assert.equal(h.nodes.length,0);assert.equal(h.window.SignMakerSpecialPanelLayout,undefined);
    h.releaseEditor();await h.run;
    assert.equal(h.html.dataset.appReady,'true');assert.equal(h.nodes.length,1);assert.ok(h.events.includes(mode));
    assert.ok(!h.events.includes('welcome'));
  });
  test(`${name}: stored post preferences also wait for the editor before the first sign paint`,async()=>{
    const h=harness({minified,preferences:true});await h.waitForEditor();assert.equal(h.nodes.length,0);
    h.releaseEditor();await h.run;assert.equal(h.html.dataset.appReady,'true');assert.equal(h.nodes.length,1);
    assert.ok(!h.events.includes('welcome'));
  });
}
