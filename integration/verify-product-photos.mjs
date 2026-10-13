import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {uniqueProductPhotos} from './product-enrichment.mjs';
const base=new URL('./',import.meta.url),source=JSON.parse(await fs.readFile(new URL('product-photos-manifest.local.json',base),'utf8'));
const groups=JSON.parse(await fs.readFile(new URL('saleor-model-grouping.local.json',base),'utf8'));
const sourceRefs=new Map(JSON.parse(await fs.readFile(new URL('model-groups.local.json',base),'utf8')).groups.flatMap(g=>g.members.map(m=>[m.sku,m.productRef])));
const response=await fetch('http://127.0.0.1:8790/api/catalog');assert.equal(response.status,200);const catalog=await response.json();
let images=0,multiple=0,two=0;const histogram={};
for(const product of catalog.products){
 const ref=sourceRefs.get(product.sku);assert.ok(ref);
 const expected=uniqueProductPhotos(source.photos.filter(p=>p.productRef===ref));
 assert.equal(product.media.length,expected.length,`Photo count mismatch for ${product.sku}`);
 images+=product.media.length;if(product.media.length>1)multiple++;if(product.media.length===2)two++;
 histogram[product.media.length]=(histogram[product.media.length]||0)+1;
}
const sample=catalog.products.find(p=>p.media.length===2);assert.ok(sample);
for(const photo of sample.media){const image=await fetch(photo.url);assert.equal(image.status,200);assert.match(image.headers.get('content-type'),/^image\//);}
const page=await fetch(`http://127.0.0.1:8790/products/${sample.slug}?variant=${encodeURIComponent(sample.id)}`);assert.equal(page.status,200);const html=await page.text();assert.match(html,/product-media.css\?v=/);assert.match(html,/id="photo-viewer"/);assert.match(html,/app.js\?v=/);
const css=await fetch('http://127.0.0.1:8790/product-media.css?v=20261008-2');assert.equal(css.status,200);assert.match(await css.text(),/object-fit:contain/);
const result={verifiedAt:new Date().toISOString(),variants:catalog.products.length,photos:images,multiPhotoVariants:multiple,variantsWithTwoPhotos:two,histogram,sample:{name:sample.name,sku:sample.sku,url:`http://127.0.0.1:8790/products/${sample.slug}?variant=${encodeURIComponent(sample.id)}`}};
await fs.writeFile(new URL('product-photo-verification.json',base),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
