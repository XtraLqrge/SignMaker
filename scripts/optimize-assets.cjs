/* Lossless PNG recompression, including PNGs embedded inside SVG image tags.
   SVG geometry, text, metadata, raster pixels and non-IDAT PNG chunks stay intact. */
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const table=Array.from({length:256},(_,value)=>{for(let n=0;n<8;n++)value=value&1?0xedb88320^(value>>>1):value>>>1;return value>>>0;});
const crc32=buffer=>{let value=0xffffffff;for(const byte of buffer)value=table[(value^byte)&255]^(value>>>8);return(value^0xffffffff)>>>0;};
function chunks(buffer){
  if(!buffer.subarray(0,8).equals(signature))throw Error('Invalid PNG signature');
  const result=[];let offset=8;
  while(offset<buffer.length){
    const length=buffer.readUInt32BE(offset),end=offset+length+12;
    if(end>buffer.length)throw Error('Truncated PNG');
    const type=buffer.toString('ascii',offset+4,offset+8),data=buffer.subarray(offset+8,offset+8+length);
    result.push({type,data,raw:buffer.subarray(offset,end)});offset=end;
    if(type==='IEND')break;
  }
  if(offset!==buffer.length)throw Error('Unexpected trailing PNG data');
  return result;
}
function recompressPNG(buffer){
  const parts=chunks(buffer);
  if(parts.some(part=>part.type==='acTL'))return buffer;
  const raster=zlib.inflateSync(Buffer.concat(parts.filter(part=>part.type==='IDAT').map(part=>part.data)));
  const packed=zlib.deflateSync(raster,{level:9});
  // Verify the filtered raster byte for byte before replacing its compression.
  if(!zlib.inflateSync(packed).equals(raster))throw Error('Raster verification failed');
  const payload=Buffer.concat([Buffer.from('IDAT'),packed]);
  const chunk=Buffer.alloc(payload.length+8);chunk.writeUInt32BE(packed.length,0);payload.copy(chunk,4);chunk.writeUInt32BE(crc32(payload),payload.length+4);
  let added=false;
  const output=Buffer.concat([signature,...parts.flatMap(part=>part.type!=='IDAT'?[part.raw]:added?[]:(added=true,[chunk]))]);
  return output.length<buffer.length?output:buffer;
}
const files=folder=>fs.readdirSync(folder,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(folder,entry.name)):[path.join(folder,entry.name)]);
function optimize(root=path.resolve(__dirname,'../public')){
  const changed=[];let before=0,after=0,embeddedPNGs=0;
  for(const file of files(root).filter(file=>/\.(png|svg)$/i.test(file))){
    const original=fs.readFileSync(file);let output=original;
    if(/\.png$/i.test(file))output=recompressPNG(original);
    else{
      const source=original.toString('utf8');
      const rewritten=source.replace(/data:image\/png;base64,([A-Za-z0-9+/=\r\n]+)/g,(whole,encoded)=>{
        try{const input=Buffer.from(encoded,'base64'),compressed=recompressPNG(input);if(compressed.length===input.length)return whole;embeddedPNGs++;return 'data:image/png;base64,'+compressed.toString('base64');}catch{return whole;}
      });
      output=Buffer.from(rewritten);
    }
    before+=original.length;after+=output.length;
    if(output.length<original.length){fs.writeFileSync(file,output);changed.push({file:path.relative(root,file).split(path.sep).join('/'),before:original.length,after:output.length});}
  }
  const report={method:'PNG IDAT recompression only, filtered raster bytes verified identical',before,after,savedBytes:before-after,embeddedPNGs,changed};
  fs.writeFileSync(path.resolve(__dirname,'../asset-optimization.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`Lossless assets: ${changed.length} files, ${(before-after).toLocaleString()} bytes saved.`);
  return report;
}
if(require.main===module)optimize();
module.exports={chunks,recompressPNG,optimize};
