/* Reproducible, dependency-free static build. Original sources stay editable. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const acorn = require('./vendor/acorn.cjs');
const cssTree = require('./vendor/css-tree.cjs');
const vm = require('node:vm');
const minifier = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'vendor/terser.min.cjs'), 'utf8'), minifier);
const {criticalCSS} = require('./critical-css.cjs');
const root = path.resolve(__dirname, '..');
const publicRoot = path.join(root, 'public');
const manifestPath = path.join(root, 'build-manifest.json');
const digest = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
const parse = text => acorn.parse(text, {ecmaVersion:'latest', sourceType:'script'});
const normalize = ast => JSON.stringify(ast, (key, value) => ['start','end','loc','range'].includes(key) ? undefined : typeof value === 'bigint' ? `${value}n` : value);
function minifyJS(source) {
  const result = minifier.Terser.minify_sync(source, {
    ecma: 2020, compress: {passes:2, unsafe:false, pure_getters:false},
    mangle: {toplevel:false}, keep_fnames:true, keep_classnames:true,
    format: {comments:/copyright|licen[cs]e|\bGPL\b/i}
  });
  if (result.error) throw result.error;
  parse(result.code);
  return result.code+'\n';
}

function compactJS(source) {
  const comments = [];
  const tokens = [...acorn.tokenizer(source, {ecmaVersion:'latest', onComment:comments})];
  const notices = comments.filter(comment => /copyright|licen[cs]e|\bGPL\b/i.test(comment.value));
  let output = notices.map(comment => `/*${comment.value.replace(/\*\//g,'* /')}*/`).join('\n')+'\n';
  let end = 0;
  for (const token of tokens) {
    const gap = source.slice(end, token.start);
    // Preserve every line-terminator boundary, including ASI and line comments.
    if (gap) output += /[\r\n\u2028\u2029]/.test(gap) ? '\n' : ' ';
    output += source.slice(token.start, token.end);
    end = token.end;
  }
  output += '\n';
  assert.equal(normalize(parse(output)), normalize(parse(source)), 'Compaction changed the JavaScript syntax tree');
  return output;
}

const sizes = text => ({bytes:Buffer.byteLength(text), gzipBytes:zlib.gzipSync(text,{level:9}).length, brotliBytes:zlib.brotliCompressSync(text).length});
function compactCSS(source) {
  const notices=[];
  const ast=cssTree.parse(source,{onComment:comment=>{
    if(/copyright|licen[cs]e|\bGPL\b/i.test(comment))notices.push(comment);
  }});
  const output=notices.map(comment=>'/*'+comment+'*/').join('\n')+'\n'+cssTree.generate(ast)+'\n';
  assert.equal(JSON.stringify(cssTree.toPlainObject(cssTree.parse(output))),JSON.stringify(cssTree.toPlainObject(ast)),'CSS compaction changed the syntax tree');
  return output;
}
function build() {
  if (fs.existsSync(manifestPath)) {
    const previous = JSON.parse(fs.readFileSync(manifestPath,'utf8'));
    for (const asset of previous.assets || []) {
      if (/^(js|css)\/[^/]+\.[a-f0-9]{16}\.(js|css)$/.test(asset.output)) fs.rmSync(path.join(publicRoot, asset.output), {force:true});
    }
  }
  // Remove older generated outputs as well as the last manifest's outputs.
  for (const folder of ['js','css']) for (const file of fs.readdirSync(path.join(publicRoot,folder))) {
    if (/\.[a-f0-9]{16}\.(?:js|css)$/.test(file)) fs.rmSync(path.join(publicRoot,folder,file));
  }
  let html = fs.readFileSync(path.join(__dirname,'index.source.html'),'utf8');
  assert.match(html, /^<!DOCTYPE html>/i, 'Standards-mode doctype is required');
  const uiFonts=JSON.parse(fs.readFileSync(path.join(__dirname,'ui-fonts.json'),'utf8'));
  const iconCoverage=JSON.parse(fs.readFileSync(path.join(__dirname,'ui-icon-coverage.json'),'utf8'));
  for(const [file,record] of Object.entries(uiFonts.files)) {
    const bytes=fs.readFileSync(path.join(publicRoot,'fonts/ui',file));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),record.sha256,'UI font checksum: '+file);
  }
  assert.equal(uiFonts.files[iconCoverage.file].sha256,iconCoverage.sha256,'Icon coverage must match the included font');
  for(const name of require('./ui-icons.cjs').collect(root,html))assert.ok(iconCoverage.verifiedIconNames.includes(name),'Missing icon glyph: '+name);
  html=html.replace('<!-- UI_ICON_PRELOAD -->',`<link rel="preload" as="font" type="font/woff2" href="fonts/ui/${iconCoverage.file}" crossorigin>`);
  const assets = [];
  const emitted = new Map();
  const adapted = new Map();
  const adapt = relative => {
    if (adapted.has(relative)) return adapted.get(relative);
    let source = fs.readFileSync(path.join(publicRoot,relative),'utf8');
    if (relative === 'js/main.js') source = source.replace('js/HtmlToImage.js', emitJS('js/HtmlToImage.js'));
    if (relative === 'js/Control.js') source = source.replace('IconFallbacks.js?v=773d7c4b80c1', path.basename(emitJS('js/IconFallbacks.js')));
    if (relative === 'js/Shield.js') source = source.replace('"ShieldFallbacks.js"',JSON.stringify(path.basename(emitJS('js/ShieldFallbacks.js'))));
    adapted.set(relative,source);
    return source;
  };
  const emitJS = relative => {
    if (emitted.has(relative)) return emitted.get(relative);
    const source = adapt(relative);
    const output = minifyJS(source);
    const target = relative.replace(/\.js$/, `.${digest(output)}.js`);
    fs.writeFileSync(path.join(publicRoot,target), output);
    assets.push({source:relative, output:target, original:sizes(source), optimized:sizes(output)});
    emitted.set(relative,target);
    return target;
  };
  // Inline the small early font hint helper, eliminating a parser-blocking trip.
  const fontSource=fs.readFileSync(path.join(publicRoot,'js/FontLoader.js'),'utf8');
  const fontHelper=compactJS(fontSource).replace(/<\/script/gi,'<\\/script');
  html=html.replace(/<script\b[^>]*src="js\/FontLoader\.js[^"\s]*"[^>]*><\/script>/,()=>'<script data-font-loader>\n'+fontHelper+'</script>');
  const editorNames = new Set(['AlignmentButtons','NativeSelect','FDOTSupports','IconPicker','form','IndexDB','CustomShields','MergeUI','Settings22','DropdownTheme']);
  const core=[], editor=[];
  html = html.replace(/<script\b[^>]*\bsrc="(js\/[^"?]+)(?:\?[^"\s]*)?"[^>]*><\/script>/g, (tag,relative) => {
    if (relative === 'js/Startup.js') return '<!-- STARTUP_SCRIPT -->';
    (editorNames.has(path.basename(relative,'.js')) ? editor : core).push(relative);
    return '';
  });
  // Retain script boundaries: early files intentionally probe classes that
  // are declared by later scripts. Concatenation changes typeof/TDZ behavior.
  const coreTargets=core.map(emitJS), editorTargets=editor.map(emitJS);
  const styles = [];
  html = html.replace(/<link\b[^>]*\bhref="(css\/[^"?]+)(?:\?[^"\s]*)?"[^>]*>/g, (_,relative) => {
    styles.push(relative);
    return styles.length === 1 ? '<!-- APP_STYLES -->' : '';
  });
  // Preserve the rule/declaration tree and cascade order, without source spacing.
  const cssSource = styles.map(relative => `/* ${relative} */\n`+fs.readFileSync(path.join(publicRoot,relative),'utf8')).join('\n');
  const css=compactCSS(cssSource);
  const cssTarget = `css/app.${digest(css)}.css`;
  fs.writeFileSync(path.join(publicRoot,cssTarget),css);
  const critical=compactCSS(criticalCSS(styles,file=>fs.readFileSync(path.join(publicRoot,file),'utf8')));
  const criticalTarget=`css/sign.${digest(critical)}.css`;
  fs.writeFileSync(path.join(publicRoot,criticalTarget),critical);
  html = html.replace('<!-- APP_STYLES -->', `<link href="${criticalTarget}" rel="stylesheet" type="text/css">`);
  assets.push({sources:styles,output:cssTarget,original:sizes(cssSource),optimized:sizes(css)});
  assets.push({critical:true,output:criticalTarget,optimized:sizes(critical)});
  html = html.replace('<!-- STARTUP_SCRIPT -->', `<script defer src="${emitJS('js/Startup.js')}" data-editor-scripts='${JSON.stringify(editorTargets)}' data-editor-css="${cssTarget}"></script>\n`+coreTargets.map(source=>`<script defer src="${source}"></script>`).join('\n'));
  fs.writeFileSync(path.join(publicRoot,'index.html'),html);
  const cached = assets.map(asset => `/${asset.output}\n  Cache-Control: public, max-age=31536000, immutable`).join('\n\n');
  // A placeholder matches one path segment, without overlapping /fonts/ui/*.
  const legacyFonts='/fonts/:font\n  Cache-Control: public, max-age=86400';
  fs.writeFileSync(path.join(publicRoot,'_headers'), `# Generated by scripts/build.cjs\n/\n  Cache-Control: no-cache\n\n/index.html\n  Cache-Control: no-cache\n\n${legacyFonts}\n\n/fonts/ui/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/img/*\n  Cache-Control: public, max-age=86400\n\n${cached}\n`);
  const startup = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match => match[1]);
  const totals = startup.reduce((sum,relative) => {
    const size=sizes(fs.readFileSync(path.join(publicRoot,relative),'utf8'));
    for (const key of Object.keys(size)) sum[key]+=size[key];
    return sum;
  },{bytes:0,gzipBytes:0,brotliBytes:0});
  const manifest = {format:2,scriptCount:startup.length,localStylesheetCount:1,deferredEditor:editorTargets,deferredStyles:cssTarget,startupJS:totals,criticalCSS:sizes(critical),inlineFontHelper:sizes(fontHelper),uiIconFont:{file:'fonts/ui/'+iconCoverage.file,bytes:iconCoverage.bytes,names:uiFonts.iconNames.length},assets};
  fs.writeFileSync(manifestPath, JSON.stringify(manifest,null,2)+'\n');
  console.log(`Built ${startup.length} scripts, one local stylesheet; startup JS ${totals.bytes.toLocaleString()} bytes (${totals.brotliBytes.toLocaleString()} Brotli estimate).`);
  return manifest;
}
if (require.main === module) build();
module.exports = {build, compactJS, compactCSS, minifyJS, normalize, parse};
