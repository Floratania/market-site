import fs from 'node:fs/promises';
import {localAdminToken,localSaleor} from './saleor-local-api.mjs';
import {planImport} from './saleor-import-plan.mjs';
const base=new URL('./',import.meta.url),data=JSON.parse(await fs.readFile(new URL('mosquito-export.local.json',base),'utf8'));
const row=data.catalogRows[0];
if(data.catalogRows.length!==1||row.Code.trim()!=='НФ-00001746'||data.issues.length||Date.now()-Date.parse(data.stockCheckedAt)>3600000)throw new Error('Mosquito import scope changed or source stale');
const hasStock=Number(row.AvailableMamaivtsi)>0||Number(row.AvailableMagala)>0;
const plan=hasStock&&row.Price?planImport({...data,rules:{...data.rules,onlyInStock:true},summary:{...data.summary,unknownStockVariantRows:0}})[0]:null;
const token=await localAdminToken(),api=(q,v={})=>localSaleor(q,v,token);
const check=result=>{if(!result||result.errors?.length)throw new Error(`Saleor rejected mosquito catalog update: ${result?.errors?.map(e=>e.code).join(',')||'empty result'}`);return result;};
const ctx=await api('query{channels{id slug currencyCode} productTypes(first:100){edges{node{id slug}}} categories(first:100){edges{node{id slug}}} warehouses(first:100){edges{node{id slug}}}}');
const channel=ctx.channels.find(x=>x.slug==='vs-market-ua');if(!channel||channel.currencyCode!=='UAH')throw new Error('VS Market channel missing');
const warehouses=Object.fromEntries(['mamaivtsi','magala'].map(key=>[key,ctx.warehouses.edges.find(e=>e.node.slug==='vsmarket-'+key)?.node.id]));if(Object.values(warehouses).some(x=>!x))throw new Error('Saleor warehouse missing');
let type=ctx.productTypes.edges.find(e=>e.node.slug==='vsmarket-accessories')?.node;
if(!type)type=check((await api('mutation($input:ProductTypeInput!){productTypeCreate(input:$input){productType{id slug} errors{code}}}',{input:{name:'Аксесуари VS Market',slug:'vsmarket-accessories',hasVariants:true,isShippingRequired:true,isDigital:false}})).productTypeCreate).productType;
let category=ctx.categories.edges.find(e=>e.node.slug==='vsmarket-mosquito-screens')?.node;
if(!category)category=check((await api('mutation($input:CategoryInput!){categoryCreate(input:$input){category{id slug} errors{code}}}',{input:{name:'Москітні сітки',slug:'vsmarket-mosquito-screens',externalReference:'vsmarket-category:mosquito-screens'}})).categoryCreate).category;
const stocks=[['mamaivtsi',row.AvailableMamaivtsi],['magala',row.AvailableMagala]].map(([location,amount])=>({warehouse:warehouses[location],quantity:Math.max(0,Number(amount))}));
if(stocks.some(s=>!Number.isSafeInteger(s.quantity)))throw new Error('Invalid mosquito stock quantity');
const sku=row.Code.trim();
const existing=await api('query($sku:String!){productVariant(sku:$sku){id sku product{id externalReference}}}',{sku});
let product=existing.productVariant?{id:existing.productVariant.product.id,externalReference:existing.productVariant.product.externalReference,variants:[{id:existing.productVariant.id,sku}]}:null;
if(product&&product.externalReference!==`vsmarket:${row.ProductRef}`)throw new Error('Mosquito SKU belongs to another product');
if(!product){
 if(!plan){console.log(JSON.stringify({sku,published:false,reason:'No available stock or retail price'}));process.exit(0);}
 const result=check((await api('mutation($products:[ProductBulkCreateInput!]!){productBulkCreate(products:$products,errorPolicy:REJECT_EVERYTHING){count errors{code path} results{product{id variants{id sku}} errors{code path}}}}',{products:[{name:'Москітна сітка дверна',slug:plan.slug,externalReference:plan.externalReference,productType:type.id,category:category.id,metadata:[...plan.metadata,{key:'storefront_accessory_kind',value:'door-mosquito-screen'}],privateMetadata:plan.privateMetadata,channelListings:[{channelId:channel.id,isPublished:true,visibleInListings:true,isAvailableForPurchase:true}],variants:[{attributes:[],sku,name:plan.name.trim(),trackInventory:true,externalReference:plan.variantExternalReference,stocks,privateMetadata:plan.privateMetadata,channelListings:[{channelId:channel.id,price:Number(plan.price)}]}]}]})).productBulkCreate);
 product=check(result.results?.[0]).product;if(result.count!==1||!product?.variants?.some(v=>v.sku===sku))throw new Error('Mosquito product creation incomplete');
}else{
 if(!product.variants.some(v=>v.sku===sku))throw new Error('Existing source reference has unexpected SKU');
 const variant=product.variants.find(v=>v.sku===sku);
 check((await api('mutation($id:ID!,$stocks:[StockInput!]!){productVariantStocksUpdate(variantId:$id,stocks:$stocks){errors{code}}}',{id:variant.id,stocks})).productVariantStocksUpdate);
 if(hasStock&&row.Price)check((await api('mutation($id:ID!,$input:[ProductVariantChannelListingAddInput!]!){productVariantChannelListingUpdate(id:$id,input:$input){errors{code}}}',{id:variant.id,input:[{channelId:channel.id,price:Number(row.Price)}]})).productVariantChannelListingUpdate);
 check((await api('mutation($id:ID!,$input:ProductChannelListingUpdateInput!){productChannelListingUpdate(id:$id,input:$input){errors{code}}}',{id:product.id,input:{updateChannels:[{channelId:channel.id,isPublished:!!(hasStock&&row.Price),visibleInListings:!!(hasStock&&row.Price),isAvailableForPurchase:!!(hasStock&&row.Price)}]}})).productChannelListingUpdate);
}
const snapshot={updatedAt:data.stockCheckedAt,items:[['mamaivtsi',row.AvailableMamaivtsi],['magala',row.AvailableMagala]].map(([location,amount])=>({sku,location,quantity:Math.max(0,Number(amount)),updatedAt:data.stockCheckedAt}))};
await fs.writeFile(new URL('mosquito-stock.local.json',base),JSON.stringify(snapshot));
console.log(JSON.stringify({sku,published:!!(hasStock&&row.Price),price:row.Price?Number(row.Price):null,mamaivtsi:snapshot.items[0].quantity,magala:snapshot.items[1].quantity}));
