import fs from 'node:fs/promises';
import {localAdminToken,localSaleor} from './saleor-local-api.mjs';
import {planImport} from './saleor-import-plan.mjs';
import {zeroRef} from './catalog-export-format.mjs';
import {manualPrice} from './product-editor.mjs';
import {manuallyDisabled} from './product-activation.mjs';
const base=new URL('./',import.meta.url),data=JSON.parse(await fs.readFile(new URL('valko-export.local.json',base),'utf8'));
if(Date.now()-Date.parse(data.stockCheckedAt)>3600000||data.issues.length)throw new Error('Refresh or review Valko source');
const rows=data.catalogRows.filter(r=>r.VariantRef===zeroRef&&r.Code.trim()!=='НФ-00001746');
const eligible=rows.filter(r=>r.Price&&(Number(r.AvailableMamaivtsi)>0||Number(r.AvailableMagala)>0));
const plans=planImport({...data,catalogRows:eligible,rules:{...data.rules,onlyInStock:true}});
const categoryName=row=>/^Підвіконня/i.test(row.Name)?'Підвіконня':'Фурнітура';
const kind=row=>/ручк/i.test(row.Name)?'Ручки':/^Підвіконня/i.test(row.Name)?'Підвіконня':/розширювач/i.test(row.Name)?'Розширювачі':/з.єднувач/i.test(row.Name)?'З’єднувачі':/дотягувач/i.test(row.Name)?'Дотягувачі':/жалюзі|ролет/i.test(row.Name)?'Жалюзі та ролети':/піна/i.test(row.Name)?'Монтажна піна':'Комплектуючі';
const token=await localAdminToken(),api=(q,v={})=>localSaleor(q,v,token),check=r=>{if(!r||r.errors?.length)throw new Error('Valko update rejected: '+(r?.errors?.map(e=>e.code).join(',')||'empty'));return r;};
const context=await api('query{channels{id slug} productTypes(first:100){edges{node{id slug}}} categories(first:100){edges{node{id name slug}}} warehouses(first:100){edges{node{id slug}}}}');
const channel=context.channels.find(c=>c.slug==='vs-market-ua'),type=context.productTypes.edges.find(e=>e.node.slug==='vsmarket-accessories')?.node;
const warehouses=Object.fromEntries(['mamaivtsi','magala'].map(key=>[key,context.warehouses.edges.find(e=>e.node.slug==='vsmarket-'+key)?.node.id]));
if(!channel||!type||Object.values(warehouses).some(x=>!x))throw new Error('Accessory import context missing');
const categories=new Map();for(const name of [...new Set(plans.map(p=>categoryName({Name:p.name})))]){
 let cat=context.categories.edges.find(e=>e.node.name===name)?.node;
 if(!cat)cat=check((await api('mutation($input:CategoryInput!){categoryCreate(input:$input){category{id name} errors{code}}}',{input:{name,slug:name==='Підвіконня'?'vsmarket-window-sills':'vsmarket-hardware',externalReference:'vsmarket-category:'+name}})).categoryCreate).category;
 categories.set(name,cat.id);
}
const existing=[];let after=null;do{const d=await api('query($after:String){products(first:100,after:$after){pageInfo{hasNextPage endCursor} edges{node{id externalReference privateMetadata{key value} channelListings{channel{id} isPublished} variants{id sku privateMetadata{key value} stocks{warehouse{id} quantity} channelListings{channel{id} price{amount}}}}}}}',{after});existing.push(...d.products.edges.map(e=>e.node));after=d.products.pageInfo.hasNextPage?d.products.pageInfo.endCursor:null;}while(after);
const bySku=new Map(existing.flatMap(p=>p.variants.map(v=>[v.sku,{product:p,variant:v}])));
for(const plan of plans){const e=bySku.get(plan.sku);if(e&&e.product.externalReference!==plan.externalReference)throw new Error('Accessory SKU ownership conflict');}
const stockInput=row=>[['mamaivtsi',row.AvailableMamaivtsi],['magala',row.AvailableMagala]].map(([place,q])=>{const quantity=Math.max(0,Number(q));if(!Number.isSafeInteger(quantity))throw new Error('Fractional accessory stock requires unit review');return {warehouse:warehouses[place],quantity};});
const newPlans=plans.filter(p=>!bySku.has(p.sku));
for(let i=0;i<newPlans.length;i+=30){const batch=newPlans.slice(i,i+30);const r=check((await api('mutation($products:[ProductBulkCreateInput!]!){productBulkCreate(products:$products,errorPolicy:REJECT_EVERYTHING){count errors{code path} results{product{id variants{id sku}} errors{code path}}}}',{products:batch.map(p=>{
 const row=rows.find(r=>r.Code.trim()===p.sku),meta=p.privateMetadata.filter(m=>m.key!=='integration').concat({key:'integration',value:'vsmarket-1c-accessory'});
 return {name:p.name.trim(),slug:p.slug,externalReference:p.externalReference,category:categories.get(categoryName(row)),productType:type.id,metadata:[...p.metadata,{key:'public_specs',value:JSON.stringify([{key:'product_type',label:'Тип виробу',value:kind(row),filterable:true}])}],privateMetadata:meta,channelListings:[{channelId:channel.id,isPublished:true,visibleInListings:true,isAvailableForPurchase:true}],variants:[{attributes:[],sku:p.sku,name:p.name.trim(),trackInventory:true,externalReference:p.variantExternalReference,privateMetadata:meta,stocks:stockInput(row),channelListings:[{channelId:channel.id,price:Number(p.price)}]}]};})})).productBulkCreate);if(r.count!==batch.length||r.results.some(x=>x.errors.length))throw new Error('Incomplete Valko import');}
const snapshot={updatedAt:data.stockCheckedAt,items:[]};let updated=0;
for(const entry of bySku.values()){
 if(!entry.product.privateMetadata.some(m=>m.key==='integration'&&m.value==='vsmarket-1c-accessory'))continue;
 const row=rows.find(r=>r.Code.trim()===entry.variant.sku);if(!row)throw new Error('Imported accessory missing in source');
 const stocks=stockInput(row),price=manualPrice(entry.variant.privateMetadata,'vs-market-ua')??Number(row.Price);
 const active=stocks.some(s=>s.quantity>0)&&row.PriceStatus==='candidate'&&price>0&&!manuallyDisabled(entry.product.privateMetadata,'vs-market-ua');
 let changed=false;
 if(stocks.some(s=>entry.variant.stocks.find(x=>x.warehouse.id===s.warehouse)?.quantity!==s.quantity)){check((await api('mutation($id:ID!,$stocks:[StockInput!]!){productVariantStocksUpdate(variantId:$id,stocks:$stocks){errors{code}}}',{id:entry.variant.id,stocks})).productVariantStocksUpdate);changed=true;}
 if(price>0&&row.PriceStatus==='candidate'&&Number(entry.variant.channelListings.find(c=>c.channel.id===channel.id)?.price?.amount)!==price){check((await api('mutation($id:ID!,$input:[ProductVariantChannelListingAddInput!]!){productVariantChannelListingUpdate(id:$id,input:$input){errors{code}}}',{id:entry.variant.id,input:[{channelId:channel.id,price}]})).productVariantChannelListingUpdate);changed=true;}
 if(entry.product.channelListings.find(c=>c.channel.id===channel.id)?.isPublished!==active){check((await api('mutation($id:ID!,$input:ProductChannelListingUpdateInput!){productChannelListingUpdate(id:$id,input:$input){errors{code}}}',{id:entry.product.id,input:{updateChannels:[{channelId:channel.id,isPublished:active,visibleInListings:active,isAvailableForPurchase:active}]}})).productChannelListingUpdate);changed=true;}
 if(changed)updated++;
}
const tracked=new Set([...plans.map(p=>p.sku),...[...bySku.values()].filter(e=>e.product.privateMetadata.some(m=>m.key==='integration'&&m.value==='vsmarket-1c-accessory')).map(e=>e.variant.sku)]);
for(const row of rows.filter(r=>tracked.has(r.Code.trim())))for(const [location,q] of [['mamaivtsi',row.AvailableMamaivtsi],['magala',row.AvailableMagala]])snapshot.items.push({sku:row.Code.trim(),location,quantity:Math.max(0,Number(q)),updatedAt:data.stockCheckedAt});
await fs.writeFile(new URL('valko-stock.local.json',base),JSON.stringify(snapshot));
console.log(JSON.stringify({created:newPlans.length,updated,published:plans.length,categories:plans.reduce((m,p)=>(m[categoryName({Name:p.name})]=(m[categoryName({Name:p.name})]||0)+1,m),{})}));
