import fs from 'node:fs/promises';
import {localSaleor,localAdminToken,localSaleorUrl} from './saleor-local-api.mjs';
import {planImport} from './saleor-import-plan.mjs';
import {manuallyDisabled} from './product-activation.mjs';
import {manualPrice} from './product-editor.mjs';

const base=new URL('./',import.meta.url);
const folders=(await fs.readdir(new URL('exports/',base))).filter(name=>/^catalog-\d/.test(name)).sort().reverse();
if(!folders.length)throw new Error('Run catalog export first');
const source=new URL(`exports/${folders[0]}/catalog.local.json`,base);
const data=JSON.parse(await fs.readFile(source,'utf8'));
const plans=planImport(data);
console.log(JSON.stringify({source:folders[0],products:plans.length,published:plans.filter(row=>row.publish).length,drafts:plans.filter(row=>!row.publish).length,categories:[...new Set(plans.map(row=>row.category))]}));
if(process.argv.includes('--plan'))process.exit(0);
const token=await localAdminToken();
const api=(query,variables={})=>localSaleor(query,variables,token);
function check(result){if(result.errors?.length)throw new Error(`Import validation failed: ${result.errors.map(e=>`${e.code||''}:${e.field||e.path||''}:${e.message||''}`).join('; ')}`);return result;}
let context=await api(`query{channels{id slug currencyCode warehouses{id name} taxConfiguration{id pricesEnteredWithTax displayGrossPrices}} productTypes(first:100){edges{node{id name slug}}} categories(first:100){edges{node{id name slug}}} warehouses(first:100){edges{node{id name slug}}} shippingZones(first:100){edges{node{id name}}}}`);
const channel=context.channels.find(row=>row.slug==='vs-market-ua');
if(!channel||channel.currencyCode!=='UAH')throw new Error('Local VS Market UAH channel unavailable');
if(!channel.taxConfiguration.pricesEnteredWithTax||!channel.taxConfiguration.displayGrossPrices){
 check((await api(`mutation($id:ID!,$input:TaxConfigurationUpdateInput!){taxConfigurationUpdate(id:$id,input:$input){errors{field code message}}}`,{id:channel.taxConfiguration.id,input:{pricesEnteredWithTax:true,displayGrossPrices:true}})).taxConfigurationUpdate);
}
let productType=context.productTypes.edges.map(edge=>edge.node).find(row=>row.slug==='vsmarket-windows-doors');
if(!productType)productType=check((await api(`mutation($input:ProductTypeInput!){productTypeCreate(input:$input){productType{id name slug} errors{field code message}}}`,{input:{name:'Вікна та двері VS Market',slug:'vsmarket-windows-doors',hasVariants:true,isShippingRequired:true,isDigital:false}})).productTypeCreate).productType;
const categories=new Map();
for(const name of [...new Set(plans.map(row=>row.category))]){
 const slug=name==='Вікна'?'vsmarket-windows':name==='Двері'?'vsmarket-doors':`vsmarket-group-${Buffer.from(name).toString('hex').slice(0,80)}`;
 let category=context.categories.edges.map(edge=>edge.node).find(row=>row.slug===slug);
 if(!category)category=check((await api(`mutation($input:CategoryInput!){categoryCreate(input:$input){category{id name slug} errors{field code message}}}`,{input:{name,slug,externalReference:`vsmarket-category:${name}`}})).categoryCreate).category;
 categories.set(name,category.id);
}
const warehouses=new Map();
for(const [key,name] of [['mamaivtsi','Мамаївці'],['magala','Магала']]){
 const slug=`vsmarket-${key}`;
 let warehouse=context.warehouses.edges.map(edge=>edge.node).find(row=>row.slug===slug);
 if(!warehouse)warehouse=check((await api(`mutation($input:WarehouseCreateInput!){createWarehouse(input:$input){warehouse{id name slug} errors{field code message}}}`,{input:{name:`VS Market — ${name}`,slug,externalReference:`vsmarket-warehouse:${key}`,address:{country:'UA',city:name,skipValidation:true}}})).createWarehouse).warehouse;
 warehouses.set(key,warehouse.id);
}
const connected=channel.warehouses.map(row=>row.id);
const addWarehouses=[...warehouses.values()].filter(id=>!connected.includes(id));
if(addWarehouses.length)check((await api(`mutation($id:ID!,$input:ChannelUpdateInput!){channelUpdate(id:$id,input:$input){errors{field code message}}}`,{id:channel.id,input:{addWarehouses}})).channelUpdate);
if(!context.shippingZones.edges.some(edge=>edge.node.name==='VS Market — Україна')){
 check((await api(`mutation($input:ShippingZoneCreateInput!){shippingZoneCreate(input:$input){shippingZone{id} errors{field code message}}}`,{input:{name:'VS Market — Україна',countries:['UA'],addWarehouses:[...warehouses.values()],addChannels:[channel.id]}})).shippingZoneCreate);
}
const existing=[];
let after=null;
do{
 const page=await api(`query($after:String){products(first:100,after:$after){pageInfo{hasNextPage endCursor} edges{node{id name slug externalReference category{id} metadata{key value} privateMetadata{key value} channelListings{channel{id} isPublished visibleInListings isAvailableForPurchase} variants{id name sku trackInventory externalReference privateMetadata{key value} stocks{warehouse{id} quantity} channelListings{channel{id} price{amount currency}}}}}}}`,{after});
 existing.push(...page.products.edges.map(edge=>edge.node));after=page.products.pageInfo.hasNextPage?page.products.pageInfo.endCursor:null;
}while(after);
const byRef=new Map(existing.map(row=>[row.externalReference,row]));
const variantsByRef=new Map(existing.flatMap(product=>product.variants.map(variant=>[variant.externalReference,{variant,parent:product}])));
const availableVariantRefs=new Set(plans.filter(p=>p.publish).map(p=>p.variantExternalReference));
for(const product of existing.filter(p=>p.privateMetadata.some(m=>m.key==='integration'&&m.value==='vsmarket-1c-model'))){
 if(product.variants.some(v=>v.channelListings.some(l=>l.channel.id===channel.id&&l.price)&&!availableVariantRefs.has(v.externalReference)))throw new Error('A previously published model SKU is absent or has no price in the new export. Review required; existing records and stock are preserved.');
}
for(const plan of plans){const sourceProduct=byRef.get(plan.externalReference);if(sourceProduct?.privateMetadata.some(m=>m.key==='1c_specs_sha256'))plan.metadata=plan.metadata.filter(m=>m.key!=='public_specs');}
for(const plan of plans){
 const conflict=existing.find(product=>product.externalReference!==plan.externalReference&&(product.slug===plan.slug||product.variants.some(variant=>variant.sku===plan.sku&&variant.externalReference!==plan.variantExternalReference)));
 if(conflict)throw new Error('An unrelated product conflicts with an import SKU or slug; nothing overwritten');
}
const newPlans=plans.filter(plan=>!byRef.has(plan.externalReference));
const stockInputs=plan=>plan.stocks.map(row=>({warehouse:warehouses.get(row.location),quantity:row.quantity}));
const privateMeta=plan=>[...plan.privateMetadata,{key:'1c_stock_raw',value:JSON.stringify(plan.stocks)}];
const inputFor=plan=>({name:plan.name,slug:plan.slug,externalReference:plan.externalReference,productType:productType.id,category:categories.get(plan.category),metadata:plan.metadata,privateMetadata:privateMeta(plan),
 channelListings:[{channelId:channel.id,isPublished:plan.publish,visibleInListings:plan.publish,isAvailableForPurchase:plan.publish}],
 variants:[{attributes:[],sku:plan.sku,name:plan.sku,trackInventory:true,externalReference:plan.variantExternalReference,stocks:stockInputs(plan),privateMetadata:privateMeta(plan),
   channelListings:plan.publish?[{channelId:channel.id,price:plan.price}]:[]}]});
const imported=[];
for(let offset=0;offset<newPlans.length;offset+=30){
 const batch=newPlans.slice(offset,offset+30);
 const result=check((await api(`mutation($products:[ProductBulkCreateInput!]!){productBulkCreate(products:$products,errorPolicy:REJECT_EVERYTHING){count errors{path code message} results{product{id slug externalReference variants{id sku}} errors{path code message}}}}`,{products:batch.map(inputFor)})).productBulkCreate);
 for(const item of result.results){check(item);if(!item.product)throw new Error('Import returned an empty product');imported.push(item.product);}
 if(result.count!==batch.length)throw new Error('Incomplete bulk import');
 console.log(`Created ${Math.min(offset+30,newPlans.length)}/${newPlans.length} products`);
}
let updated=0,unchanged=0;
const metadataMatches=(existing,desired)=>desired.every(wanted=>existing.some(current=>current.key===wanted.key&&current.value===wanted.value));
for(const plan of plans.filter(row=>byRef.has(row.externalReference))){
 const product=byRef.get(plan.externalReference);
 if(!product.privateMetadata.some(row=>row.key==='integration'&&row.value==='vsmarket-1c'))throw new Error('Existing product ownership mismatch');
 const owned=variantsByRef.get(plan.variantExternalReference),variant=owned?.variant;
 const grouped=owned?.parent.privateMetadata.some(m=>m.key==='integration'&&m.value==='vsmarket-1c-model')===true;
 if(!variant||(!grouped&&product.variants.length!==1))throw new Error('Existing product variant mapping changed; manual review needed');
 const variantName=variant.privateMetadata.find(item=>item.key==='storefront_variant_name_override')?.value||(grouped?plan.name:plan.sku);
 const desiredName=product.privateMetadata.find(item=>item.key==='storefront_name_override')?.value||plan.name;
 const productChanged=product.name!==desiredName||product.category?.id!==categories.get(plan.category)||!metadataMatches(product.metadata,plan.metadata)||!metadataMatches(product.privateMetadata,privateMeta(plan));
 const variantChanged=variant.sku!==plan.sku||variant.name!==variantName||variant.trackInventory!==true||!metadataMatches(variant.privateMetadata,privateMeta(plan));
 const stocksChanged=stockInputs(plan).some(stock=>variant.stocks.find(row=>row.warehouse.id===stock.warehouse)?.quantity!==stock.quantity);
 const desiredPrice=manualPrice(variant.privateMetadata,channel.slug)??Number(plan.price);
 const priceChanged=plan.publish&&Number(variant.channelListings.find(row=>row.channel.id===channel.id)?.price?.amount)!==desiredPrice;
 const listing=product.channelListings.find(row=>row.channel.id===channel.id);
 const publishSource=plan.publish&&!grouped&&!manuallyDisabled(product.privateMetadata,channel.slug);
 const listingChanged=!listing||listing.isPublished!==publishSource||listing.visibleInListings!==publishSource||listing.isAvailableForPurchase!==publishSource;
 if(productChanged)check((await api(`mutation($id:ID!,$input:ProductInput!){productUpdate(id:$id,input:$input){errors{field code message}}}`,{id:product.id,input:{name:desiredName,category:categories.get(plan.category),metadata:[...plan.metadata,...product.metadata.filter(item=>item.key.startsWith('storefront_'))],privateMetadata:[...privateMeta(plan),...product.privateMetadata.filter(item=>item.key.startsWith('storefront_'))]}})).productUpdate);
 if(variantChanged)check((await api(`mutation($id:ID!,$input:ProductVariantInput!){productVariantUpdate(id:$id,input:$input){errors{field code message}}}`,{id:variant.id,input:{sku:plan.sku,name:variantName,trackInventory:true,privateMetadata:[...privateMeta(plan),...variant.privateMetadata.filter(item=>item.key.startsWith('storefront_'))]}})).productVariantUpdate);
 if(stocksChanged)check((await api(`mutation($id:ID!,$stocks:[StockInput!]!){productVariantStocksUpdate(variantId:$id,stocks:$stocks){errors{field code message}}}`,{id:variant.id,stocks:stockInputs(plan)})).productVariantStocksUpdate);
 if(priceChanged)check((await api(`mutation($id:ID!,$input:[ProductVariantChannelListingAddInput!]!){productVariantChannelListingUpdate(id:$id,input:$input){errors{field code message}}}`,{id:variant.id,input:[{channelId:channel.id,price:desiredPrice}]})).productVariantChannelListingUpdate);
 if(listingChanged)check((await api(`mutation($id:ID!,$input:ProductChannelListingUpdateInput!){productChannelListingUpdate(id:$id,input:$input){errors{field code message}}}`,{id:product.id,input:{updateChannels:[{channelId:channel.id,isPublished:publishSource,visibleInListings:publishSource,isAvailableForPurchase:publishSource,addVariants:publishSource?[variant.id]:[]}]}})).productChannelListingUpdate);
 imported.push({id:product.id,slug:plan.slug,externalReference:plan.externalReference,variants:[{id:variant.id,sku:plan.sku}]});
 if(productChanged||variantChanged||stocksChanged||priceChanged||listingChanged){updated++;if(updated%50===0)console.log(`Updated ${updated} products`);}else unchanged++;
}
const snapshot={source:'1C snapshot',updatedAt:data.stockCheckedAt,items:plans.flatMap(plan=>plan.stocks.map(stock=>({sku:plan.sku,location:stock.location,quantity:stock.quantity,updatedAt:data.stockCheckedAt})))};
await fs.writeFile(new URL('saleor-import-stock.local.json',base),JSON.stringify(snapshot,null,2));
const report={importedAt:new Date().toISOString(),source:folders[0],channel:channel.slug,products:plans.length,created:newPlans.length,updated,unchanged,
 published:plans.filter(row=>row.publish).length,drafts:plans.filter(row=>!row.publish).map(row=>({sku:row.sku,name:row.name,reason:'missing retail price'})),
 warehouses:Object.fromEntries(warehouses),negativeStockClamped:data.stocks.filter(row=>Number(row.Available)<0).length,stockCheckedAt:data.stockCheckedAt,
 api:localSaleorUrl,productsImported:imported};
await fs.writeFile(new URL('saleor-import-result.local.json',base),JSON.stringify(report,null,2));
console.log(JSON.stringify({created:newPlans.length,updated,unchanged,published:report.published,drafts:report.drafts.length,warehouses:warehouses.size}));
