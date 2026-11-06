/* Check literal and state-dependent icon names before producing a build. */
const fs=require('node:fs');
const path=require('node:path');
const acorn=require('./vendor/acorn.cjs');
const namesFrom=node=>{
  if(!node)return[];
  if(node.type==='Literal'&&typeof node.value==='string')return[node.value];
  if(node.type==='ConditionalExpression')return[...namesFrom(node.consequent),...namesFrom(node.alternate)];
  if(node.type==='TemplateLiteral'&&!node.expressions.length)return[node.quasis[0].value.cooked];
  return[];
};
function collect(root,html){
  const required=new Set();
  const add=value=>{if(/^[a-z]+(?:_[a-z]+)*$/.test(value.trim()))required.add(value.trim());};
  const spans=text=>{
    for(const match of text.matchAll(/<span\b[^>]*material-symbols-outlined[^>]*>\s*([a-z_]+)\s*<\/span>/g))add(match[1]);
  };
  spans(html);
  for(const file of fs.readdirSync(path.join(root,'public/js')).filter(file=>file.endsWith('.js')&&!/\.[a-f0-9]{16}\.js$/.test(file))){
    const source=fs.readFileSync(path.join(root,'public/js',file),'utf8');
    if(!source.includes('material-symbols-outlined'))continue;
    spans(source);
    const ast=acorn.parse(source,{ecmaVersion:'latest'}),nodes=[],stack=[ast],symbols=new Set();
    while(stack.length){
      const node=stack.pop();nodes.push(node);
      for(const value of Object.values(node))if(value&&typeof value==='object'){
        if(Array.isArray(value))stack.push(...value.filter(item=>item?.type));else if(value.type)stack.push(value);
      }
    }
    for(const node of nodes){
      if(node.type==='AssignmentExpression'&&node.left.type==='MemberExpression'&&node.left.property.name==='className'&&namesFrom(node.right).some(value=>value.includes('material-symbols-outlined')))symbols.add(node.left.object.name);
      if(node.type==='VariableDeclarator'&&node.init?.type==='CallExpression'&&namesFrom(node.init.arguments[0]).some(value=>value.includes('.material-symbols-outlined')))symbols.add(node.id.name);
    }
    for(const node of nodes){
      if(node.type==='AssignmentExpression'&&node.left.type==='MemberExpression'&&['textContent','innerText'].includes(node.left.property.name)&&symbols.has(node.left.object.name))namesFrom(node.right).forEach(add);
      if(node.type==='CallExpression'&&node.callee.name==='createTemplateActionButton')namesFrom(node.arguments[1]).forEach(add);
      if(node.type==='CallExpression'&&node.callee.name==='flashDownloadActionButton')namesFrom(node.arguments[2]).forEach(add);
    }
  }
  return [...required].sort();
}
module.exports={collect};
