import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {localSaleor,localAdminToken} from './saleor-local-api.mjs';
const token=await localAdminToken(),api=(query,variables)=>localSaleor(query,variables,token);
const file=new URL('../.runtime/manage-activation-fixture.json',import.meta.url);
const checked=result=>{assert.ok(result);assert.deepEqual(result.errors,[]);return result;};
async function cleanup(saved){
 const data=await api('query($id:ID!){product(id:$id){id externalReference}}',{id:saved.id});
 if(data.product){assert.equal(data.product.externalReference,saved.externalReference);assert.ok(saved.externalReference.startsWith('vsmarket-activation-test:'));checked((await api('mutation($id:ID!){productDelete(id:$id){errors{code}}}',{id:saved.id})).productDelete);}
 await fs.unlink(file).catch(error=>{if(error.code!=='ENOENT')throw error;});
 console.log('Temporary activation test product removed');
}
if(process.argv.includes('--cleanup')){await cleanup(JSON.parse(await fs.readFile(file,'utf8')));process.exit(0);}
const context=await api('query{channels{id slug} productTypes(first:100){edges{node{id hasVariants}}} categories(first:1){edges{node{id}}}}');
const channel=context.channels.find(c=>c.slug==='vs-market-ua'),type=context.productTypes.edges.find(e=>e.node.hasVariants).node,category=context.categories.edges[0].node;
const suffix=crypto.randomUUID(),externalReference='vsmarket-activation-test:'+suffix,slug='activation-check-'+suffix,sku='QA-ACTIVATION-'+suffix;
const product=checked((await api('mutation($input:ProductCreateInput!){productCreate(input:$input){product{id} errors{code}}}',{input:{name:'Тест деактивації — тимчасова модель',slug,externalReference,productType:type.id,category:category.id}})).productCreate).product;
const saved={id:product.id,externalReference,slug,sku};await fs.mkdir(new URL('../.runtime/',import.meta.url),{recursive:true});await fs.writeFile(file,JSON.stringify(saved));
let cookie;const base='http://127.0.0.1:8790';
try{
 checked((await api('mutation($id:ID!,$input:ProductChannelListingUpdateInput!){productChannelListingUpdate(id:$id,input:$input){errors{code}}}',{id:product.id,input:{updateChannels:[{channelId:channel.id,isPublished:false,visibleInListings:true,isAvailableForPurchase:true}]}})).productChannelListingUpdate);
 const variant=checked((await api('mutation($input:ProductVariantCreateInput!){productVariantCreate(input:$input){productVariant{id} errors{code}}}',{input:{product:product.id,sku,attributes:[],trackInventory:false}})).productVariantCreate).productVariant;
 checked((await api('mutation($id:ID!,$input:[ProductVariantChannelListingAddInput!]!){productVariantChannelListingUpdate(id:$id,input:$input){errors{code}}}',{id:variant.id,input:[{channelId:channel.id,price:1}]})).productVariantChannelListingUpdate);
 checked((await api('mutation($id:ID!,$input:ProductChannelListingUpdateInput!){productChannelListingUpdate(id:$id,input:$input){errors{code}}}',{id:product.id,input:{updateChannels:[{channelId:channel.id,isPublished:true,visibleInListings:true,isAvailableForPurchase:true}]}})).productChannelListingUpdate);
 const credentials=JSON.parse(await fs.readFile(new URL('../saleor-admin.local.json',import.meta.url),'utf8'));
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:credentials.email,password:credentials.password})});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];
 const catalog=async managed=>(await(await fetch(base+(managed?'/api/manage/catalog':'/api/catalog'),{headers:managed?{Cookie:cookie}:{}})).json()).products;
 const activate=async active=>{const result=await fetch(base+'/api/manage/activation',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:JSON.stringify({productId:product.id,active})});assert.equal(result.status,200,await result.text());};
 assert.ok((await catalog(false)).some(p=>p.sku===sku));
 await activate(false);assert.ok(!(await catalog(false)).some(p=>p.sku===sku));assert.equal((await catalog(true)).find(p=>p.sku===sku)?.active,false);
 assert.equal((await fetch(base+'/products/'+slug)).status,404);
 const deniedOrder=await fetch(base+'/api/orders',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),name:'Тест',phone:'+380501234567',delivery:'manager',consent:true,lines:[{sku,quantity:1}]})});assert.equal(deniedOrder.status,409);
 await activate(true);assert.ok((await catalog(false)).some(p=>p.sku===sku));assert.equal((await catalog(true)).find(p=>p.sku===sku)?.active,true);
 console.log('Live activation verified: hidden from catalog, model page 404, checkout rejected, retained in admin, reactivation works');
 if(process.argv.includes('--keep')){await activate(false);console.log('Temporary inactive fixture retained for UI verification');}else await cleanup(saved);
}catch(error){await cleanup(saved);throw error;}
finally{if(cookie)await fetch(base+'/api/auth/logout',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:'{}'});}
