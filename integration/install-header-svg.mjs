import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sourceFile='C:/Users/tetiana.flora/.codex/attachments/6c06f085-5081-45bc-b1d2-6a805724c323/Вставлений текст.txt';
const source=await readFile(sourceFile,'utf8');
if(!/<svg\b[^>]*viewBox="0 0 730 110"/.test(source)||/<(?:script|foreignObject|iframe)\b|\bon\w+\s*=|<!ENTITY|(?:xlink:)?href\s*=/i.test(source))throw new Error('Unexpected SVG content');
const publicDir=new URL('../public/',import.meta.url);
await copyFile(sourceFile,new URL('assets/icons/brand-logo.svg',publicDir));
const cart=source.replace(/<svg\b[^>]*>/,'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 109" width="130" height="109">');
await writeFile(new URL('assets/icons/brand-cart.svg',publicDir),cart);
for(const name of ['index.html','account.html']){
  const file=new URL(name,publicDir);let html=await readFile(file,'utf8');
  const old='<span class="brand-logo-frame"><img class="brand-logo" src="/logo.png" alt="VS Market"></span><span class="brand-compact" aria-hidden="true"><img src="/assets/brand-compact.png" alt="" width="1246" height="701"></span>';
  if(!html.includes(old))throw new Error('Header logo markup missing: '+name);
  html=html.replace(old,'<span class="brand-logo-frame"><img class="brand-logo" src="/assets/icons/brand-logo.svg" alt="VS Market" width="730" height="110"></span><span class="brand-mobile-cart" aria-hidden="true"><img src="/assets/icons/brand-cart.svg" alt="" width="130" height="109"></span>');
  html=html.replace('/assets/brand-variants.css?v=20261008-7','/assets/brand-variants.css?v=20261008-11');
  await writeFile(file,html);
}
console.log('Original SVG installed unchanged; mobile cart uses a cropped SVG viewBox. Source SHA-256: '+createHash('sha256').update(await readFile(sourceFile)).digest('hex'));
