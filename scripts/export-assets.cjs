/* Script-loadable asset packs: Safari cannot fetch file:// resources for export. */
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const crypto=require('node:crypto');
const mime={'.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.otf':'font/otf','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif'};
function buildExportAssets(publicRoot){
  const packs=new Map(),index={},assets=[],fontFaces=[];
  for(const file of fs.readdirSync(path.join(publicRoot,'css')).filter(file=>file.endsWith('.css')&&!/\.[a-f0-9]{16}\.css$/.test(file))){
    const css=fs.readFileSync(path.join(publicRoot,'css',file),'utf8');
    for(const match of css.matchAll(/@font-face\s*\{[^}]+\}/g)){
      const family=match[0].match(/font-family\s*:\s*([^;]+)/i)?.[1].trim().replace(/^["']|["']$/g,'');
      if(family)fontFaces.push({family,cssText:match[0],stylesheet:'css/'+file});
    }
  }
  const visit=relative=>{
    for(const entry of fs.readdirSync(path.join(publicRoot,relative),{withFileTypes:true})){
      const name=relative+'/'+entry.name;
      if(entry.isDirectory()){visit(name);continue;}
      const type=mime[path.extname(name).toLowerCase()];if(!type)continue;
      if(relative==='img/other-symbols'&&entry.name!=='QC-Exit.svg')continue;
      // WOFF2 is the preferred, complete font set used by the shipped styles.
      if(relative.startsWith('fonts')&&!name.endsWith('.woff2'))continue;
      const group=relative;
      if(!packs.has(group))packs.set(group,{});
      packs.get(group)[name]='data:'+type+';base64,'+fs.readFileSync(path.join(publicRoot,name)).toString('base64');
    }
  };
  visit('fonts');visit('img');
  const folder=path.join(publicRoot,'export-assets');fs.mkdirSync(folder,{recursive:true});
  for(const file of fs.readdirSync(folder))if(/^[a-f0-9]{16}\.js$/.test(file))fs.rmSync(path.join(folder,file));
  for(const [group,records]of packs){
    const packed=zlib.gzipSync(JSON.stringify(records),{level:9,mtime:0}).toString('base64');
    const source=`window.SignMakerExportAssets.register(${JSON.stringify(group)},${JSON.stringify(packed)});\n`;
    const hash=crypto.createHash('sha256').update(source).digest('hex').slice(0,16);
    const output='export-assets/'+hash+'.js';fs.writeFileSync(path.join(publicRoot,output),source);
    for(const name of Object.keys(records))index[name]=[group,output];
    assets.push({output,exportOnly:true,bytes:Buffer.byteLength(source)});
  }
  return {index,assets,fontFaces};
}
module.exports={buildExportAssets};
