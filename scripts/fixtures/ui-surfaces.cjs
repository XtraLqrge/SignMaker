const {Node,parse}=require('./mobile-dom.cjs');
const targets=[
  '#export','#panelStyleConfig','#subPanelConfig','.historyBar','#downloadContent','#downloadContents','#downloadPreview',
  '.subPanelConfig .sMModalBar','.subPanelConfig .sMModalTab.selected','#baselineActiveSubpanelTab',
  '.textEditorBlock.selected','#baselineAlignmentButton','#iconPickerUploadedTab','#iconPickerBuiltInTab',
  '#sdCtrlText_textContent','#sdAdvisory_textContent','#sdShield_routeNumber','#sdShield_shieldSize',
  '#sdBlock_topPadding','#sdBlock_topPaddingVal','#sdBlock_width','label[for="sdBlock_topPadding"]',
  'label[for="sdBlock_width"]','#baselineDownloadButton','.iconPickerDisplayControls','.sdBlockMarginControls',
];
const properties=['display','background','background-color','color','font','font-size','font-weight','font-family','text-decoration','padding','margin','width','min-width','max-width','height','min-height','border-radius','gap','grid-template-columns'];
function surface(html,mobile,theme){
  const tree=parse('<body>'+html.split('<body>')[1].split('</body>')[0]+'</body>'),form=tree.querySelector('form');tree.setAttribute('data-theme',theme);
  if(mobile){tree.setAttribute('data-mobile-ui','');const editor=new Node('section');editor.id='mobileEditor';editor.setAttribute('data-menu','subPanelConfig');form.append(editor);editor.append(tree.querySelector('.modals'));}
  const tab=new Node('div'),caption=new Node('button');tab.className='subPanelTabGroup active';caption.className='subPanelTabButton';caption.id='baselineActiveSubpanelTab';caption.textContent=mobile?'1':'Subpanel 1';tab.append(caption);tree.querySelector('#subPanelList').append(tab);
  const group=new Node('div'),button=new Node('button');group.className='alignmentButtons';button.id='baselineAlignmentButton';button.className='activated';button.textContent='C';group.append(button);tree.querySelector('#sdCtrlText_alignment').after(group);
  const download=new Node('button');download.id='baselineDownloadButton';download.className='selected';download.textContent='1';tree.querySelector('#downloadPanelButtons').append(download);
  return tree;
}
function capture(tree,style){
  return Object.fromEntries(targets.map(selector=>{const node=tree.querySelector(selector);if(!node)throw Error('Missing surface '+selector);
    return [selector,Object.fromEntries(properties.map(property=>[property,style(node,property)??null]))];}));
}
module.exports={surface,capture,targets,properties};
