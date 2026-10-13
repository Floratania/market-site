import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=new URL('./',import.meta.url),report=JSON.parse(await fs.readFile(new URL('saleor-import-result.local.json',base),'utf8'));
const source=JSON.parse(await fs.readFile(new URL(`exports/${report.source}/catalog.local.json`,base),'utf8'));
const enriched=JSON.parse(await fs.readFile(new URL('product-enrichment.local.json',base),'utf8'));
const groups=JSON.parse(await fs.readFile(new URL('saleor-model-grouping.local.json',base),'utf8'));
const response=await fetch('http://127.0.0.1:8790/api/catalog',{signal:AbortSignal.timeout(120000)});assert.equal(response.status,200);
const catalog=await response.json(),bySku=new Map(catalog.products.map(p=>[p.sku,p]));
const expected=source.catalogRows.filter(r=>r.Price!==null);assert.equal(bySku.size,expected.length);assert.equal(catalog.products.length,expected.length);
assert.equal(new Set(catalog.products.map(p=>p.productId)).size,groups.models.length);
let imageProducts=0,specProducts=0;
for(const row of expected){
 const product=bySku.get(row.Code.trim());assert.ok(product);assert.equal(product.price,Number(row.Price));assert.equal(product.currency,'UAH');
 for(const [location,key] of [['mamaivtsi','AvailableMamaivtsi'],['magala','AvailableMagala']])assert.equal(catalog.stock.find(s=>s.sku===product.sku&&s.location===location)?.quantity,Math.max(0,Number(row[key])));
 const specs=enriched.products.find(p=>p.productRef===row.ProductRef).specs;
 for(const spec of specs){const found=product.specifications.find(s=>s.key===spec.key);assert.ok(found);assert.equal(found.value,spec.value);assert.equal(found.unit||'',spec.unit||'');}
 if(product.image)imageProducts++;if(specs.length)specProducts++;
}
const samples=catalog.products.filter(p=>p.media?.length).slice(0,3);
for(const product of samples){const url=new URL(product.image);assert.ok(['localhost','127.0.0.1'].includes(url.hostname));const image=await fetch(url);assert.equal(image.status,200);assert.match(image.headers.get('content-type'),/^image\//);assert.ok((await image.arrayBuffer()).byteLength>100);}
const ts1=catalog.products.filter(p=>p.name==='Двері стандарт TS1');assert.equal(ts1.length,24);assert.equal(new Set(ts1.map(p=>p.productId)).size,1);
const ternopil=catalog.products.filter(p=>p.name.includes('TERNOPIL'));assert.equal(ternopil.length,4);assert.equal(new Set(ternopil.map(p=>p.productId)).size,1);
const alias=groups.aliases.find(a=>a.sku===ts1[0].sku),redirect=await fetch('http://127.0.0.1:8790/products/'+alias.sourceSlug,{redirect:'manual'});assert.equal(redirect.status,302);assert.equal(new URL(redirect.headers.get('location'),'http://127.0.0.1:8790').searchParams.get('variant'),alias.variantId);
const page=await fetch('http://127.0.0.1:8790/products/'+alias.modelSlug+'?variant='+encodeURIComponent(alias.variantId));assert.equal(page.status,200);
const result={verifiedAt:new Date().toISOString(),models:groups.models.length,variants:expected.length,productsWithPhotos:imageProducts,productsWithSpecifications:specProducts,priceAndStockMatches:expected.length,ts1Variants:ts1.length,ternopilVariants:ternopil.length};
await fs.writeFile(new URL('model-catalog-verification.json',base),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
