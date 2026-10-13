import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {localSaleor,localAdminToken} from './saleor-local-api.mjs';
import {planImport} from './saleor-import-plan.mjs';
const base=new URL('./',import.meta.url);
const report=JSON.parse(await fs.readFile(new URL('saleor-import-result.local.json',base),'utf8'));
const data=JSON.parse(await fs.readFile(new URL(`exports/${report.source}/catalog.local.json`,base),'utf8'));
const plans=planImport(data),token=await localAdminToken();
const products=[];
let after=null;
do{
 const page=await localSaleor(`query($after:String){products(first:100,after:$after){pageInfo{hasNextPage endCursor} edges{node{id name externalReference category{name} channelListings{channel{slug} isPublished} variants{id sku stocks{warehouse{id} quantity} channelListings{channel{slug} price{amount currency}}}}}}}`,{after},token);
 products.push(...page.products.edges.map(edge=>edge.node));after=page.products.pageInfo.hasNextPage?page.products.pageInfo.endCursor:null;
}while(after);
assert.equal(products.filter(row=>row.externalReference?.startsWith('vsmarket:')).length,plans.length);
for(const plan of plans){
 const product=products.find(row=>row.externalReference===plan.externalReference);
 assert.ok(product);assert.equal(product.name,plan.name);assert.equal(product.category.name,plan.category);
 assert.equal(product.variants.length,1);const variant=product.variants[0];assert.equal(variant.sku,plan.sku);
 const listing=product.channelListings.find(row=>row.channel.slug===report.channel);assert.equal(listing.isPublished,plan.publish);
 const price=variant.channelListings.find(row=>row.channel.slug===report.channel)?.price;
 if(plan.publish){assert.equal(Number(price.amount),Number(plan.price));assert.equal(price.currency,'UAH');}else assert.ok(!price);
 for(const stock of plan.stocks){assert.equal(variant.stocks.find(row=>row.warehouse.id===report.warehouses[stock.location])?.quantity,stock.quantity);}
}
const publicProducts=[];after=null;
do{
 const page=await localSaleor(`query($after:String){products(first:100,after:$after,channel:"vs-market-ua"){pageInfo{hasNextPage endCursor} edges{node{id slug variants{sku quantityAvailable pricing{price{gross{amount currency}}}}}}}}`,{after});
 publicProducts.push(...page.products.edges.map(edge=>edge.node));after=page.products.pageInfo.hasNextPage?page.products.pageInfo.endCursor:null;
}while(after);
assert.equal(publicProducts.length,plans.filter(plan=>plan.publish).length);
for(const product of publicProducts){
 assert.equal(product.variants.length,1);const variant=product.variants[0],plan=plans.find(row=>row.sku===variant.sku);
 assert.ok(plan?.publish);assert.equal(variant.pricing.price.gross.amount,Number(plan.price));assert.equal(variant.pricing.price.gross.currency,'UAH');
 assert.equal(variant.quantityAvailable,plan.stocks.reduce((total,row)=>total+row.quantity,0));
}
console.log(`Saleor verified: ${products.length} imported products, ${publicProducts.length} visible with exact UAH gross prices; both warehouse stocks match the 1C snapshot.`);
await fs.writeFile(new URL('saleor-import-verification.json',base),JSON.stringify({verifiedAt:new Date().toISOString(),source:report.source,imported:plans.length,published:publicProducts.length,drafts:plans.length-publicProducts.length,allPricesMatched:true,allWarehouseStocksMatched:true},null,2));
