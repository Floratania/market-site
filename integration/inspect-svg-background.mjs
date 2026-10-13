import fs from 'node:fs/promises';
const svg=await fs.readFile(new URL('../public/assets/icons/brand-logo.svg',import.meta.url),'utf8');
const paths=[...svg.matchAll(/<path\b[^>]+>/g)].map(match=>match[0]);
for(let index=0;index<paths.length;index++){
 const tag=paths[index],d=/d="([^"]*)"/.exec(tag)[1];console.log('path',index,/fill="([^"]*)"/.exec(tag)?.[1]);
 console.log(d.split(/(?=M)/).map(part=>part.slice(0,150)).join('\n'));
}
