const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {cascade}=require('./fixtures/css-cascade.cjs');
const {surface,capture}=require('./fixtures/ui-surfaces.cjs');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const expected=JSON.parse(read('scripts/fixtures/ui-surface-baseline.json'));
const html=read('scripts/index.source.html');
const sources=[...html.matchAll(/<link\b[^>]*>/g)].map(match=>match[0]).filter(tag=>/rel=["']stylesheet["']/.test(tag))
  .map(tag=>tag.match(/href=["']([^"']+)/)?.[1].split('?')[0]).filter(file=>file?.startsWith('css/'));
const sourceCSS=sources.map(file=>read('public/'+file)).join('\n');
const manifest=JSON.parse(read('build-manifest.json'));
for(const [version,css] of [['source',sourceCSS],['production',[...read('public/index.html').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match=>match[1]).join('\n')+'\n'+read('public/'+manifest.deferredStyles)]]){
  const style=cascade(css);
  for(const [kind,mobile] of [['desktop',false],['mobile',true]])for(const theme of ['light','dark']){
    test(`${version}: ${kind} ${theme} UI retains its reference appearance`,()=>{
      assert.deepEqual(capture(surface(html,mobile,theme),style),expected[kind][theme]);
    });
  }
}
test('mobile editing and touch-gesture implementations remain unchanged',()=>{
  for(const [file,hash] of Object.entries(expected.mobileLogic)){
    let source=read('public/js/'+file);
    if(file==='form.js')source=source.replace('        if (!window.SignMakerMobile?.active && (event.ctrlKey || event.metaKey)) return;\n','');
    assert.equal(crypto.createHash('sha256').update(source).digest('hex'),hash,file);
  }
});
