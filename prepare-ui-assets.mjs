import fs from 'node:fs/promises';
await fs.mkdir('public/assets/icons',{recursive:true});
for(const name of ['search','shopping-cart','sun','moon','window','door','settings','arrow-right','file-description','x','adjustments-horizontal','chevron-down']) {
  const r=await fetch(`https://raw.githubusercontent.com/tabler/tabler-icons/main/icons/outline/${name}.svg`);
  if(!r.ok) throw new Error(`${name}: ${r.status}`);
  await fs.writeFile(`public/assets/icons/${name}.svg`,await r.text());
}
const r=await fetch('https://raw.githubusercontent.com/tabler/tabler-icons/main/LICENSE');
if(r.ok) await fs.writeFile('public/assets/icons/LICENSE',await r.text());
const css=await fetch('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
let fonts=await css.text();
let count=0;
for(const url of new Set(fonts.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g)||[])) {
 const result=await fetch(url); if(!result.ok)throw new Error('Font download failed');
 const file=`inter-${count++}.ttf`; await fs.writeFile(`public/assets/${file}`,Buffer.from(await result.arrayBuffer())); fonts=fonts.replaceAll(url,`/assets/${file}`);
}
await fs.writeFile('public/assets/fonts.css',fonts);
console.log('Icons and Inter downloaded.');
