/* Keep every sign rule and the visible toolbar in the first stylesheet.
   The complete stylesheet still loads before the editor becomes interactive. */
const cssTree = require('./vendor/css-tree.cjs');
const renderFiles = new Set(['page.css', 'signs.css', 'sign-foundation.css', 'ui-fonts.css']);
const shellNames = new Set(['hidden', 'material-symbols-outlined', 'sMConfigBar', 'sMConfigOption', 'buttonLabel',
  'historyBar', 'historyButton', 'undoButton', 'redoButton', 'clearAllButton', 'hideConfig', 'configHidden', 'export', 'hitbox',
  'top-right-links', 'mutcd-link', 'external-link-icon', 'toolTip', 'sMConfigOptionActive']);
const canvasName = /^(?:post|panel|alignmentGuide|signHolder|bE-|blockElement|groupedBlock|subPanel|subDivider|exitTab|guideArrow|standardArrow|aplArrow|vms)/i;
function criticalCSS(files, read) {
  const select = list => {
    const output = new cssTree.List();
    list.forEach(node => {
      if (node.type === 'Rule') {
        let keep = false, named = false;
        cssTree.walk(node.prelude, child => {
          if (child.type === 'ClassSelector' || child.type === 'IdSelector') {
            named = true;
            if (shellNames.has(child.name) || canvasName.test(child.name)) keep = true;
          }
          if (child.type === 'PseudoClassSelector' && child.name === 'root') keep = true;
        });
        if (keep || !named) output.appendData(cssTree.clone(node));
      } else if (node.type === 'Atrule' && node.block?.children) {
        if (/^(?:font-face|keyframes|-webkit-keyframes|property|layer)$/.test(node.name)) output.appendData(cssTree.clone(node));
        else {
          const copy = cssTree.clone(node);
          copy.block.children = select(copy.block.children);
          if (!copy.block.children.isEmpty) output.appendData(copy);
        }
      } else output.appendData(cssTree.clone(node));
    });
    return output;
  };
  return files.map(file => {
    // A saved sign waits for the complete stylesheet. A fresh Control-only
    // sign does not use shield artwork or legacy shield-number placement.
    if (['shields.css','legacy-shields.css'].includes(file.split('/').pop())) return '';
    const source = read(file);
    if (renderFiles.has(file.split('/').pop())) return source;
    const ast = cssTree.parse(source);
    ast.children = select(ast.children);
    return cssTree.generate(ast);
  }).join('\n');
}
module.exports = { criticalCSS };
