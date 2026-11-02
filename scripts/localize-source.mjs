// Run once when introducing localisation. Re-running only extracts new messages.
import ts from '../work/translation-tools/package/lib/typescript.js';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(), messages=new Set();
const attrs=new Set(['placeholder','title','alt','aria-label','aria-description']);
function natural(s){return !/^\.{1,2}\//.test(s)&&/\p{L}/u.test(s)&&!/^\s*(?:https?:|\/|#|[\w.-]+\.(?:png|jpg|json|csv|webp)|[\w-]+(?:\/[\w-]+)+)/i.test(s)&&!s.includes('process.env')&&s.length<15000;}
function jsxText(s){return s.split(/\r?\n/).map((line,i,a)=>{let x=line.replace(/\t/g,' ');if(i)x=x.replace(/^ +/,'');if(i<a.length-1)x=x.replace(/ +$/,'');return x+(x&&i<a.length-1?' ':'');}).join('');}
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for(const file of [...files('app'),...files('native-api/app'),...files('lib')].filter(f=>/\.tsx?$/.test(f)&&!f.includes('i18n')&&!f.endsWith('.test.ts'))){
 const source=fs.readFileSync(file,'utf8'), sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS), edits=[];
 const instrument=process.argv.includes('--instrument')&&file.endsWith('.tsx')&&!file.endsWith('layout.tsx')&&!source.includes('/i18n/Language');
 function walk(n){
  if(ts.isPropertyAssignment(n)&&['en','fr'].includes(n.name.getText(sf).replaceAll("'",'').replaceAll('"','')))return;
  if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)){if(natural(n.text))messages.add(n.text);}
  if(ts.isTemplateExpression(n)){const text=n.head.text+n.templateSpans.map((s,i)=>`{${i}}`+s.literal.text).join('');if(natural(text))messages.add(text);}
  if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.PlusToken&&!(ts.isBinaryExpression(n.parent)&&n.parent.operatorToken.kind===ts.SyntaxKind.PlusToken)){
   let index=0,hasText=false;function flatten(value){if(ts.isBinaryExpression(value)&&value.operatorToken.kind===ts.SyntaxKind.PlusToken)return flatten(value.left)+flatten(value.right);if(ts.isStringLiteral(value)||ts.isNoSubstitutionTemplateLiteral(value)){hasText=true;return value.text;}return `{${index++}}`;}
   const text=flatten(n);if(hasText&&natural(text))messages.add(text);
  }
  if(ts.isJsxText(n)){const text=jsxText(n.text);if(text.trim()){messages.add(text);if(instrument)edits.push({start:n.pos,end:n.end,text:`<T>{${JSON.stringify(text)}}</T>`});}}
  if(instrument&&ts.isJsxExpression(n)&&n.expression&&(ts.isJsxElement(n.parent)||ts.isJsxFragment(n.parent))){edits.push({start:n.getStart(sf),end:n.getStart(sf)+1,text:'<T>{'},{start:n.end-1,end:n.end,text:'}</T>'});}
  if(instrument&&(ts.isJsxElement(n)||ts.isJsxSelfClosingElement(n))){const open=ts.isJsxElement(n)?n.openingElement:n;const name=open.tagName.getText(sf);if(/^[a-z]/.test(name)&&open.attributes.properties.some(p=>ts.isJsxAttribute(p)&&attrs.has(p.name.getText(sf)))){
    const key=open.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(sf)==='key');
    edits.push({start:n.getStart(sf),end:n.getStart(sf),text:`<A${key?' '+key.getText(sf):''}>`},{start:n.end,end:n.end,text:'</A>'});
  }}
  ts.forEachChild(n,walk);
 }
 walk(sf);
 if(instrument&&edits.length){let next=source;for(const e of edits.sort((a,b)=>b.start-a.start||b.end-a.end||Number(a.text.startsWith('</'))-Number(b.text.startsWith('</'))))next=next.slice(0,e.start)+e.text+next.slice(e.end);let relative=path.relative(path.dirname(file),'app/i18n/Language').replaceAll('\\','/');if(!relative.startsWith('.'))relative='./'+relative;const pos=sf.statements[0]&&ts.isExpressionStatement(sf.statements[0])&&ts.isStringLiteral(sf.statements[0].expression)?sf.statements[0].end:0;next=next.slice(0,pos)+`\nimport {T, A} from '${relative}';\n`+next.slice(pos);fs.writeFileSync(file,next);}
}
fs.mkdirSync('work/translations',{recursive:true});fs.writeFileSync('work/translations/ui-source.json',JSON.stringify([...messages].sort(),null,2));console.log('UI/source messages:',messages.size);
