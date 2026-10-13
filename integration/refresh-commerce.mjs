import fs from 'node:fs/promises';
import {localSaleor,localAdminToken} from './saleor-local-api.mjs';
import {manualPrice} from './product-editor.mjs';
export function operationalRows(data,variants){
 if(!Array.isArray(data.catalogRows)||Date.now()-Date.parse(data.stockCheckedAt)>120000||!Number.isFinite(Date.parse(data.stockCheckedAt)))throw new Error('Stale source');
 const rows=new Map(data.catalogRows.filter(r=>r.VariantRef==='0x00000000000000000000000000000000').map(r=>[r.Code.trim(),r]));
 return variants.map(v=>{
  const row=rows.get(v.sku);
  if(!row)throw new Error('Source SKU missing; review required');
  const stocks=[['mamaivtsi',row.AvailableMamaivtsi,row.ReservedMamaivtsi],['magala',row.AvailableMagala,row.ReservedMagala]].map(([location,available,reserved])=>{
   const quantity=Math.max(0,Number(available));if(!Number.isSafeInteger(quantity)||!Number.isFinite(Number(reserved)))throw new Error('Invalid stock');
   return {sku:v.sku,location,quantity,reserved:Number(reserved)};
  });
  const price=manualPrice(v.privateMetadata||[],'vs-market-ua')??Number(row.Price);
  if(!Number.isFinite(price)||price<=0||row.PriceStatus==='review')throw new Error('Price requires review');
  return {variant:v,price,stocks};
 });
}
export async function refreshCommerce(){
 const base=new URL('./',import.meta.url),data=JSON.parse(await fs.readFile(new URL('operational-export.local.json',base),'utf8'));
 const token=await localAdminToken(),api=(q,v)=>localSaleor(q,v,token);
 const context=await api('query{channels{id slug} warehouses(first:100){edges{node{id slug}}}}');
 const channel=context.channels.find(c=>c.slug==='vs-market-ua');if(!channel)throw new Error('Channel unavailable');
 const warehouses=Object.fromEntries(['mamaivtsi','magala'].map(place=>[place,context.warehouses.edges.find(e=>e.node.slug==='vsmarket-'+place)?.node.id]));
 if(Object.values(warehouses).some(v=>!v))throw new Error('Warehouses unavailable');
 let after=null;const variants=[];
 do{
  const page=await api('query($after:String){products(first:100,after:$after){pageInfo{hasNextPage endCursor} edges{node{privateMetadata{key value} variants{id sku privateMetadata{key value} stocks{warehouse{id} quantity} channelListings{channel{slug} price{amount}}}}}}}',{after});
  for(const {node} of page.products.edges)if(node.privateMetadata.some(m=>m.key==='integration'&&m.value==='vsmarket-1c-model'))variants.push(...node.variants);
  after=page.products.pageInfo.hasNextPage?page.products.pageInfo.endCursor:null;
 }while(after);
 if(!variants.length)throw new Error('No managed variants');
 const plans=operationalRows(data,variants);
 const check=result=>{if(result.errors?.length)throw new Error('Saleor update rejected');};
 let changed=0;
 for(const {variant,price,stocks} of plans){
  if(stocks.some(s=>variant.stocks.find(r=>r.warehouse.id===warehouses[s.location])?.quantity!==s.quantity)){
   check((await api('mutation($id:ID!,$stocks:[StockInput!]!){productVariantStocksUpdate(variantId:$id,stocks:$stocks){errors{code}}}',{id:variant.id,stocks:stocks.map(s=>({warehouse:warehouses[s.location],quantity:s.quantity}))})).productVariantStocksUpdate);changed++;
  }
  if(Number(variant.channelListings.find(c=>c.channel.slug===channel.slug)?.price?.amount)!==price){
   check((await api('mutation($id:ID!,$input:[ProductVariantChannelListingAddInput!]!){productVariantChannelListingUpdate(id:$id,input:$input){errors{code}}}',{id:variant.id,input:[{channelId:channel.id,price}]})).productVariantChannelListingUpdate);changed++;
  }
 }
 const snapshot={updatedAt:data.stockCheckedAt,pricesUpdatedAt:data.stockCheckedAt,items:plans.flatMap(p=>p.stocks),products:plans.length};
 const target=new URL('saleor-import-stock.local.json',base),temporary=new URL('saleor-import-stock.local.json.tmp',base);
 await fs.writeFile(temporary,JSON.stringify(snapshot));await fs.rename(temporary,target);
 console.log(JSON.stringify({updatedAt:snapshot.updatedAt,products:plans.length,changed}));
}
if(process.argv[1]?.endsWith('refresh-commerce.mjs'))await refreshCommerce();
