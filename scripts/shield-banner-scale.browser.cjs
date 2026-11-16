const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await (process.env.BROWSER==='webkit'?webkit:chromium).launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.argv[2]);await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true');
 const results=await page.evaluate(()=>{
  const panel=app.exposeToFormHandler.getCurrentPanel(),host=document.createElement('div');document.body.append(host);
  const results=[];
  for(const shieldBase of ['FL','FLToll','FLTP','FLCFX']){
   const measure=(size,on)=>{
    const element=new ShieldElement({shieldBase,shieldType:({FL:'Guide 42x36 1-2 Digit',FLToll:'40x48 Guide',FLTP:'40x48 Guide',FLCFX:'TM 36x48 CFX Jurisdiction'})[shieldBase],routeNumber:'50',shieldSize:size,scaleBannersWithShield:on,bannerType:'NORTH',bannerType2:'SOUTH'}).createElement(panel);host.replaceChildren(element);
    const banners=[...element.querySelectorAll('.bannerA,.bannerB')];
    const read=()=>banners.map(n=>[parseFloat(getComputedStyle(n).fontSize),parseFloat(getComputedStyle(n,':first-letter').fontSize)]);
    const before=read(),shieldHeight=element.querySelector('.shield').getBoundingClientRect().height;
    // The checkbox updates this variable in place without rebuilding the shield.
    element.style.setProperty('--bannerScale','1');const inPlaceOff=read();
    return {before,inPlaceOff,shieldHeight,count:banners.length,official:element.classList.contains('floridaOfficialShieldUserBannerScale')};
   };
   results.push({shieldBase,base:measure(3,false),largeOff:measure(6,false),largeOn:measure(6,true)});
  }
  host.remove();return results;
 });
 for(const r of results){
  assert.ok(r.base.official&&r.base.count>0,r.shieldBase+' renders official banners');
  assert.deepEqual(r.largeOff.before,r.base.before,r.shieldBase+' banners stay unscaled when off');
  assert.deepEqual(r.largeOn.inPlaceOff,r.base.before,r.shieldBase+' checkbox updates banners immediately');
  for(let i=0;i<r.base.count;i++)for(let j=0;j<2;j++)assert.ok(Math.abs(r.largeOn.before[i][j]-2*r.base.before[i][j])<.05,r.shieldBase+' scales banners when on');
  assert.equal(r.largeOff.shieldHeight,r.largeOn.shieldHeight,r.shieldBase+' toggle preserves shield dimensions');
 }
 assert.deepEqual(errors,[]);console.log('FDOT/CFX banners honor scaling on/off, first letters, immediate updates, and preserved shield dimensions.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
