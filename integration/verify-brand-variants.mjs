import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base='http://127.0.0.1:8790';
const manifest=JSON.parse(await readFile(new URL('../public/assets/brand-originals.json',import.meta.url),'utf8'));
for(const asset of manifest){
  const response=await fetch(base+'/assets/'+asset.file);
  if(!response.ok || !response.headers.get('content-type')?.includes('image/png'))throw new Error('Logo unavailable: '+asset.file);
  const hash=createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
  if(hash!==asset.sha256)throw new Error('Logo differs from original: '+asset.file);
}
for(const route of ['/','/account/login']){
  const response=await fetch(base+route);const html=await response.text();
  if(!response.ok || !html.includes('brand-logo.svg') || !html.includes('brand-favicon') || !html.includes('/assets/brand-variants.css?v='))throw new Error('Brand markup missing: '+route);
}
const css=await fetch(base+'/assets/brand-variants.css?v=20261008-4');
if(!css.ok)throw new Error('Brand stylesheet unavailable');
console.log('Verified: 3 original PNGs served unchanged; catalog and login use brand variants; stylesheet available.');
