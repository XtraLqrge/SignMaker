const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({window:{}});vm.runInContext(fs.readFileSync('public/js/Roundabout.js','utf8'),context);
const roundabout=context.window.SignMakerRoundabout;
test('roundabout exits retain fixed left/thru/right subpanel mapping',()=>{
 assert.deepEqual(Array.from(roundabout.directions),['left','thru','right']);
 for(const bypass of [false,true])for(let flags=0;flags<8;flags++){
  const exits=Object.fromEntries(roundabout.directions.map((name,i)=>[name,!!(flags&(1<<i))]));
  const svg=roundabout.artwork({bypass,exits});
  for(const name of roundabout.directions)assert.equal(svg.includes(`data-exit="${name}"`),exits[name]);
  assert.ok(!svg.includes('dasharray'));assert.ok(svg.includes('fill="white"'));
 }
 assert.notEqual(roundabout.artwork({}),roundabout.artwork({bypass:true}));
});
test('assembly size is independent of the bypass and exit selection',()=>{
 const model=roundabout.normalize({size:27,bypass:true,exits:{thru:false}});
 assert.equal(model.size,27);assert.equal(model.bypass,true);assert.equal(model.exits.thru,false);
 assert.equal(roundabout.normalize({}).size,18);
});
test('roundabout padding is independent on each side and accepts zero',()=>{
 const model=roundabout.normalize({padding:{left:4,bottom:0}});
 assert.deepEqual(JSON.parse(JSON.stringify(model.padding)),{top:1.5,right:1.5,bottom:0,left:4});
});
