import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=new URL('./',import.meta.url),report=JSON.parse(await fs.readFile(new URL('product-enrichment.local.json',base),'utf8'));
const {products}=await fetch('http://127.0.0.1:8790/api/catalog').then(r=>r.json());
const candidates=report.products.filter(p=>p.dimensionLayout==='gabarit:length-width');
const source=JSON.parse(await fs.readFile(new URL('product-details-source.local.json',base),'utf8'));
const skuByRef=new Map(source.products.map(p=>[p.ProductRef,p.Code.trim()]));
let verified=0;
for(const row of candidates){
 const product=products.find(p=>p.sku===skuByRef.get(row.productRef));
 assert.ok(product,`Public SKU missing ${skuByRef.get(row.productRef)}`);
 for(const s of row.specs.filter(s=>['width','height'].includes(s.key))){assert.equal(product.specifications.find(x=>x.key===s.key)?.value,s.value);assert.equal(product.specifications.find(x=>x.key===s.key)?.unit,'мм');}
 verified++;
}
const target=products.find(p=>p.sku==='25-00000668');
console.log(JSON.stringify({verified,publicVariants:products.length,target:{sku:target.sku,url:`http://127.0.0.1:8790/products/${target.slug}?variant=${encodeURIComponent(target.id)}`,dimensions:target.specifications.filter(s=>['width','height'].includes(s.key))}},null,2));
