import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {localSaleor,localAdminToken} from './saleor-local-api.mjs';
const base=new URL('./',import.meta.url),report=JSON.parse(await fs.readFile(new URL('product-enrichment.local.json',base),'utf8'));
const candidates=report.products.filter(p=>p.dimensionLayout==='gabarit:length-width');
const token=await localAdminToken(),api=(query,variables={})=>localSaleor(query,variables,token);
const query=`query($after:String){products(first:100,after:$after){pageInfo{hasNextPage endCursor} edges{node{id name externalReference metadata{key value} privateMetadata{key value} variants{id sku externalReference metadata{key value} privateMetadata{key value} attributes{attribute{id externalReference} values{name}} media{id} stocks{id quantity} channelListings{channel{id} price{amount currency}}}}}}}`;
async function load(){const rows=[];let after=null;do{const page=(await api(query,{after})).products;rows.push(...page.edges.map(e=>e.node));after=page.pageInfo.hasNextPage?page.pageInfo.endCursor:null;}while(after);return rows;}
const products=await load(),sources=new Map(products.map(p=>[p.externalReference,p])),variants=new Map(products.flatMap(p=>p.variants.map(v=>[v.externalReference,{variant:v,parent:p}])));
const metadata=(list,key)=>list.find(m=>m.key===key)?.value;
const specs=list=>JSON.parse(metadata(list,'public_specs')||'[]');
const attrs=(await api(`query{attributes(first:100){edges{node{id externalReference inputType unit}}}}`)).attributes.edges.map(e=>e.node);
const dimensions=new Map(['width','height'].map(key=>[key,attrs.find(a=>a.externalReference===`vsmarket-spec:${key}`&&a.inputType==='NUMERIC'&&a.unit==='MM')]));
if([...dimensions.values()].some(a=>!a))throw new Error('Native millimetre attributes missing');
const patch=(old,desired)=>[...old.filter(s=>!['width','height'].includes(s.key)),...desired];
const plans=candidates.map(row=>{
 const source=sources.get(`vsmarket:${row.productRef}`),entry=variants.get(`vsmarket:${row.productRef}:0x00000000000000000000000000000000`);
 if(!source||metadata(source.privateMetadata,'integration')!=='vsmarket-1c'||!entry||metadata(entry.parent.privateMetadata,'integration')!=='vsmarket-1c-model'||metadata(entry.variant.privateMetadata,'1c_source_product_id')!==String(Buffer.from(source.id,'base64').toString().split(':')[1]))throw new Error('Imported product ownership mismatch');
 const desired=row.specs.filter(s=>['width','height'].includes(s.key));
 if(desired.length!==2||desired.some(s=>s.unit!=='мм'||!/^\d+(\.\d+)?$/.test(s.value)||Number(s.value)<=0))throw new Error('Incomplete gabarit pair');
 return {row,source,...entry,desired,before:specs(entry.variant.metadata).filter(s=>['width','height'].includes(s.key))};
});
console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'plan',variants:plans.length,models:new Set(plans.map(p=>p.parent.id)).size,target:plans.filter(p=>p.variant.sku==='25-00000668').map(p=>({sku:p.variant.sku,before:p.before,after:p.desired})),ambiguous:report.issues.filter(i=>i.reason==='ambiguous-gabarit-dimensions').length},null,2));
if(!process.argv.includes('--apply'))process.exit(0);
await fs.mkdir(new URL('backups/',base),{recursive:true});
await fs.writeFile(new URL(`backups/gabarit-dimensions-before-${Date.now()}.json`,base),JSON.stringify(plans.map(({source,variant,parent})=>({source,variant,parentMetadata:parent.metadata,parentId:parent.id})),null,2),{flag:'wx'});
const check=result=>{if(result.errors?.length)throw new Error(JSON.stringify(result.errors));};
let count=0;
for(const plan of plans){
 const {row,source,variant,desired}=plan;
 const native=desired.map(s=>({id:dimensions.get(s.key).id,numeric:s.value}));
 const sourceSpecs=patch(specs(source.metadata),desired),variantSpecs=patch(specs(variant.metadata),desired);
 const privateMetadata=[{key:'1c_dimension_sources',value:JSON.stringify(row.dimensionSources)},{key:'1c_dimension_unit',value:'mm'},{key:'1c_specs_checked_at',value:report.checkedAt}];
 check((await api(`mutation($id:ID!,$input:ProductInput!){productUpdate(id:$id,input:$input){errors{field code message}}}`,{id:source.id,input:{attributes:native,metadata:[{key:'public_specs',value:JSON.stringify(sourceSpecs)}],privateMetadata:[...privateMetadata,{key:'1c_specs_sha256',value:crypto.createHash('sha256').update(JSON.stringify(sourceSpecs)).digest('hex')}]}})).productUpdate);
 check((await api(`mutation($id:ID!,$input:ProductVariantInput!){productVariantUpdate(id:$id,input:$input){errors{field code message}}}`,{id:variant.id,input:{attributes:native,metadata:[{key:'public_specs',value:JSON.stringify(variantSpecs)}],privateMetadata}})).productVariantUpdate);
 variant.metadata=variant.metadata.filter(m=>m.key!=='public_specs').concat({key:'public_specs',value:JSON.stringify(variantSpecs)});
 count++;if(count%10===0)console.log(`Updated dimensions ${count}/${plans.length}`);
}
for(const parent of new Map(plans.map(p=>[p.parent.id,p.parent])).values()){
 const first=specs(parent.variants[0].metadata);
 const common=first.filter(s=>parent.variants.every(v=>specs(v.metadata).some(x=>x.key===s.key&&x.value===s.value&&x.unit===s.unit)));
 // Recalculate only common dimensions, keeping all other model metadata intact.
 const updated=patch(specs(parent.metadata),common.filter(s=>['width','height'].includes(s.key)));
 check((await api(`mutation($id:ID!,$input:ProductInput!){productUpdate(id:$id,input:$input){errors{field code message}}}`,{id:parent.id,input:{metadata:[{key:'public_specs',value:JSON.stringify(updated)}]}})).productUpdate);
}
const after=await load(),afterVariants=new Map(after.flatMap(p=>p.variants.map(v=>[v.id,v])));
for(const {variant,desired,before,source} of plans){
 const current=afterVariants.get(variant.id),currentSpecs=specs(current.metadata);
 for(const s of desired){
  assert.equal(currentSpecs.find(x=>x.key===s.key)?.value,s.value);
  assert.equal(current.attributes.find(a=>a.attribute.externalReference===`vsmarket-spec:${s.key}`)?.values[0]?.name,s.value);
 }
 assert.deepEqual(current.media,variant.media);assert.deepEqual(current.stocks,variant.stocks);assert.deepEqual(current.channelListings,variant.channelListings);
 assert.deepEqual(currentSpecs.filter(s=>!['width','height'].includes(s.key)),specs(variant.metadata).filter(s=>!['width','height'].includes(s.key)));
}
const result={importedAt:new Date().toISOString(),updatedVariants:plans.length,updatedModels:new Set(plans.map(p=>p.parent.id)).size,ambiguous:report.issues.filter(i=>i.reason==='ambiguous-gabarit-dimensions'),target:plans.filter(p=>p.variant.sku==='25-00000668').map(p=>({sku:p.variant.sku,dimensions:p.desired})),verified:true};
await fs.writeFile(new URL('gabarit-import-result.local.json',base),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
