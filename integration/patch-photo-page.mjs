import fs from 'node:fs/promises';
const url=new URL('../public/app.js',import.meta.url);let source=await fs.readFile(url,'utf8');
const from='<div class="product-page-layout">${productArt(product,\'product-page-art\')}';
if(!source.includes(from))throw new Error('Product page image anchor missing');
source=source.replace(from,'<div class="product-page-layout">${productGallery(product)}');
await fs.writeFile(url,source);
