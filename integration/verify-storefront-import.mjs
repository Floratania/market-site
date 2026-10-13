import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const report=JSON.parse(await fs.readFile(new URL('saleor-import-result.local.json',import.meta.url),'utf8'));
const data=JSON.parse(await fs.readFile(new URL(`exports/${report.source}/catalog.local.json`,import.meta.url),'utf8'));
const origin='http://127.0.0.1:8790';
const response=await fetch(`${origin}/api/catalog`);assert.equal(response.status,200);
const catalog=await response.json();assert.equal(catalog.products.length,report.published);
assert.equal(catalog.stockVerified,false,'a snapshot is not a verified live stock bridge');
assert.equal(catalog.stockSnapshotAt,data.stockCheckedAt);
for(const product of catalog.products){
 const row=data.catalogRows.find(row=>row.Code===product.sku);
 assert.ok(row);assert.equal(product.price,Number(row.Price));assert.equal(product.currency,'UAH');
 for(const [key,column] of [['mamaivtsi','AvailableMamaivtsi'],['magala','AvailableMagala']]){
   const stock=catalog.stock.find(item=>item.sku===product.sku&&item.location===key);
   assert.ok(stock);assert.equal(stock.quantity,Math.max(0,Number(row[column])));
 }
}
const product=catalog.products[0];
const page=await fetch(`${origin}/products/${product.slug}?variant=${encodeURIComponent(product.id)}`);assert.equal(page.status,200);
const html=await page.text();assert.match(html,/<title>/);assert.ok(html.includes('VS Market'));
assert.equal((await fetch(`${origin}/`)).status,200);
await fs.writeFile(new URL('storefront-import-verification.json',import.meta.url),JSON.stringify({checkedAt:new Date().toISOString(),published:catalog.products.length,allPricesMatched:true,warehouseQuantitiesMatched:true,stockSource:'dated snapshot; not live confirmed',productUrl:`${origin}/products/${product.slug}?variant=${encodeURIComponent(product.id)}`},null,2));
console.log(JSON.stringify({storefront:origin,products:catalog.products.length,stockEntries:catalog.stock.length,stockSnapshotAt:catalog.stockSnapshotAt,productPage:page.status}));
