/* Loaded only for file:// image exports; normal web exports use HTTP assets. */
window.SignMakerExportAssets = (() => {
  const index = /* EXPORT_ASSET_INDEX */ {};
  const fontFaces = /* EXPORT_FONT_FACES */ [];
  const packs = new Map();
  const requests = new Map();
  const root = new URL('../', document.currentScript.src);
  const register = (group, packed) => {
    const bytes = Uint8Array.from(atob(packed), c => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const decoded = new Response(stream).json();
    decoded.catch(() => {});
    packs.set(group, decoded);
  };
  const read = async source => {
    const url = new URL(source, document.baseURI);
    const base = decodeURIComponent(root.pathname);
    const pathname = decodeURIComponent(url.pathname);
    if(url.protocol !== 'file:' || !pathname.startsWith(base))throw new Error('Export asset is outside this project: '+url.href);
    const name=pathname.slice(base.length),entry=index[name];
    if(!entry)throw new Error('Missing bundled export asset: '+name);
    const [group,file]=entry;
    if(!requests.has(group)){
      requests.set(group,new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        const finish=error=>{clearTimeout(timer);script.remove();script.onload=script.onerror=null;error?reject(error):resolve();};
        const timer=setTimeout(()=>finish(new Error('Export asset load timed out: '+group)),20000);
        script.onload=()=>finish(packs.has(group)?null:new Error('Invalid export asset pack: '+group));
        script.onerror=()=>finish(new Error('Unable to load export assets: '+group));
        script.src=new URL(file,root).href;document.head.appendChild(script);
      }).catch(error=>{requests.delete(group);packs.delete(group);throw error;}));
    }
    await requests.get(group);
    try {
      const data=(await packs.get(group))[name];
      if(!data)throw new Error('Export asset is absent from its pack: '+name);
      return data;
    } catch(error) {
      requests.delete(group);packs.delete(group);throw error;
    }
  };
  return {register,read,fontFaces};
})();
