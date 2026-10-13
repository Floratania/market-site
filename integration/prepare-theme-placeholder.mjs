import fs from 'node:fs/promises';
const svg=await fs.readFile(new URL('../public/assets/icons/brand-cart-transparent.svg',import.meta.url),'utf8');
if(!svg.includes('viewBox="0 0 130 109"'))throw new Error('Cart viewBox missing');
await fs.writeFile(new URL('../public/assets/icons/brand-placeholder.svg',import.meta.url),svg.replace('width="730" height="110"','width="130" height="109"'));
const file=new URL('../public/app.js',import.meta.url);
const app=await fs.readFile(file,'utf8');
await fs.writeFile(file,app.replaceAll('src="/brand-icon.svg"','src="/assets/icons/brand-placeholder.svg"'));
console.log('Transparent original brand cart prepared for photo placeholders');
