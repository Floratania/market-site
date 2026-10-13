import fs from 'node:fs/promises';
const root=new URL('../public/',import.meta.url);
const original=await fs.readFile(new URL('assets/icons/brand-logo.svg',root),'utf8');
const paths=[...original.matchAll(/<path\b[^>]+>/g)].map(match=>match[0]);
const white=/d="([^"]*)"/.exec(paths[0])[1].split(/(?=M)/);
const letters=white.filter(part=>part.startsWith('M298.3 34.5')||part.startsWith('M198.68 24.01'));
if(letters.length!==2)throw new Error('Expected the original V and S outlines');
const content=paths[1]+`\n<path d="${letters.join('')}" fill="#ffffff" fill-rule="evenodd"/>`;
const svg=original.replace(paths[0],'').replace(paths[1],content).replace(paths[2],'');
await fs.writeFile(new URL('assets/icons/brand-logo-transparent.svg',root),svg);
await fs.writeFile(new URL('assets/icons/brand-cart-transparent.svg',root),svg.replace(/viewBox="[^"]+"/,'viewBox="0 0 130 109"'));
for(const file of ['index.html','account.html']){
 const target=new URL(file,root);let html=await fs.readFile(target,'utf8');
 html=html.replace('/assets/icons/brand-logo.svg','/assets/icons/brand-logo-transparent.svg').replace('/assets/icons/brand-cart.svg','/assets/icons/brand-cart-transparent.svg').replaceAll('?v=20261008-13','?v=20261008-14');
 await fs.writeFile(target,html);
}
console.log('Created transparent vector header variants; original logo retained, VS letters remain white.');
