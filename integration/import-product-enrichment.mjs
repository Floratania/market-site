import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {localSaleor,localAdminToken,localSaleorUrl} from './saleor-local-api.mjs';
import {propertyDefinitions,uniqueProductPhotos} from './product-enrichment.mjs';
const base=new URL('./',import.meta.url);
const enrichment=JSON.parse(await fs.readFile(new URL('product-enrichment.local.json',base),'utf8'));
const photoSource=JSON.parse(await fs.readFile(new URL('product-photos-manifest.local.json',base),'utf8'));
const importReport=JSON.parse(await fs.readFile(new URL('saleor-import-result.local.json',base),'utf8'));
if(enrichment.dimensionUnit!=='mm')throw new Error('Dimension unit must be confirmed before import');
const token=await localAdminToken(),api=(query,variables={})=>localSaleor(query,variables,token);
// Workers can briefly disagree on issuance time after Docker resumes from sleep.
await new Promise(resolve=>setTimeout(resolve,3000));
const check=result=>{if(result.errors?.length)throw new Error(JSON.stringify(result.errors));return result;};
const context=await api(`query{attributes(first:100){edges{node{id slug inputType unit externalReference}}} productTypes(first:100){edges{node{id slug productAttributes{id}}}}}`);
const productType=context.productTypes.edges.map(e=>e.node).find(p=>p.slug==='vsmarket-windows-doors');if(!productType)throw new Error('Imported product type missing');
const attributes=new Map();
for(const def of propertyDefinitions){
 const slug=`vsmarket-${def.key.replaceAll('_','-')}`,externalReference=`vsmarket-spec:${def.key}`,inputType=def.numeric?'NUMERIC':'DROPDOWN';
 let attribute=context.attributes.edges.map(e=>e.node).find(a=>a.slug===slug);
 if(attribute&&(attribute.externalReference!==externalReference||attribute.inputType!==inputType||(def.numeric&&attribute.unit!=='MM')))throw new Error('Attribute ownership or definition conflict');
 if(!attribute)attribute=check((await api(`mutation($input:AttributeCreateInput!){attributeCreate(input:$input){attribute{id slug inputType unit externalReference} errors{field code message}}}`,{input:{name:def.label,slug,externalReference,type:'PRODUCT_TYPE',inputType,...(def.numeric?{unit:'MM'}:{}),valueRequired:false,visibleInStorefront:true,filterableInStorefront:def.filterable,filterableInDashboard:true}})).attributeCreate).attribute;
 attributes.set(def.key,attribute.id);
}
const operations=[...attributes.values()].filter(id=>!productType.productAttributes.some(a=>a.id===id)).map(id=>({id,type:'PRODUCT'}));
if(operations.length)check((await api(`mutation($id:ID!,$operations:[ProductAttributeAssignInput!]!){productAttributeAssign(productTypeId:$id,operations:$operations){errors{field code message}}}`,{id:productType.id,operations})).productAttributeAssign);
const products=[];let after=null;
do{const page=await api(`query($after:String){products(first:100,after:$after){pageInfo{hasNextPage endCursor} edges{node{id externalReference metadata{key value} privateMetadata{key value} media{id url alt}}}}}`,{after});products.push(...page.products.edges.map(e=>e.node));after=page.products.pageInfo.hasNextPage?page.products.pageInfo.endCursor:null;}while(after);
const byRef=new Map(products.map(p=>[p.externalReference,p]));
const allMediaIds=new Set(products.flatMap(p=>p.media.map(m=>m.id)));
const allowed=new Set(importReport.productsImported.map(p=>p.externalReference));
const journal=new URL('product-photo-import.local.jsonl',base),uploaded=new Map();
try{for(const line of (await fs.readFile(journal,'utf8')).split('\n').filter(Boolean)){const row=JSON.parse(line);uploaded.set(`${row.productRef}:${row.sha256}`,row);}}catch(error){if(error.code!=='ENOENT')throw error;}
let updated=0,unchanged=0,createdPhotos=0;
const results=[];
for(const row of enrichment.products){
 const ref=`vsmarket:${row.productRef}`;if(!allowed.has(ref))throw new Error('Enrichment outside imported catalog');
 const product=byRef.get(ref);if(!product||!product.privateMetadata.some(m=>m.key==='integration'&&m.value==='vsmarket-1c'))throw new Error('Product ownership mismatch');
 const text=JSON.stringify(row.specs),hash=crypto.createHash('sha256').update(text).digest('hex');
 if(!product.privateMetadata.some(m=>m.key==='1c_specs_sha256'&&m.value===hash)||!product.metadata.some(m=>m.key==='public_specs'&&m.value===text)){
  check((await api(`mutation($id:ID!,$input:ProductInput!){productUpdate(id:$id,input:$input){errors{field code message}}}`,{id:product.id,input:{attributes:row.specs.map(s=>({id:attributes.get(s.key),...(['width','height'].includes(s.key)?{numeric:s.value}:{values:[s.value]})})),metadata:[{key:'public_specs',value:text}],privateMetadata:[{key:'1c_specs_sha256',value:hash},{key:'1c_specs_checked_at',value:enrichment.checkedAt},{key:'1c_dimension_unit',value:'mm'}]}})).productUpdate);updated++;
 }else unchanged++;
 const photos=uniqueProductPhotos(photoSource.photos.filter(p=>p.productRef===row.productRef)),mediaIds=[];
 for(const photo of photos){
  const key=`${row.productRef}:${photo.sha256}`;let existing=uploaded.get(key);
  if(existing&&!allMediaIds.has(existing.mediaId))existing=null;
  if(!existing){
   if(!/^product-photos\/[0-9a-f]{64}\.(jpg|png|gif)$/.test(photo.path))throw new Error('Invalid local image path');
   const bytes=await fs.readFile(new URL(photo.path,base));
   if(crypto.createHash('sha256').update(bytes).digest('hex')!==photo.sha256)throw new Error('Source image checksum mismatch');
   const form=new FormData();
   form.append('operations',JSON.stringify({query:'mutation($input:ProductMediaCreateInput!){productMediaCreate(input:$input){media{id url alt} errors{field code message}}}',variables:{input:{product:product.id,alt:photo.title,image:null}}}));
   form.append('map',JSON.stringify({'0':['variables.input.image']}));form.append('0',new Blob([bytes],{type:photo.mime}),`${photo.sha256}.${photo.path.split('.').at(-1)}`);
   let response,payload;
   for(let attempt=0;attempt<6;attempt++){
    response=await fetch(localSaleorUrl,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form,signal:AbortSignal.timeout(120000)});payload=await response.json();
    if(!payload.errors?.some(e=>e.message==='The token is not yet valid (iat)'))break;
    await new Promise(resolve=>setTimeout(resolve,2000));
   }
   if(!response.ok||payload.errors)throw new Error(`Photo upload failed: ${payload.errors?.map(e=>e.message).join('; ')||response.status}`);
   const media=check(payload.data.productMediaCreate).media;if(!media)throw new Error('Empty media upload');
   existing={productRef:row.productRef,fileRef:photo.fileRef,sha256:photo.sha256,mediaId:media.id,url:media.url};
   await fs.appendFile(journal,JSON.stringify(existing)+'\n');uploaded.set(key,existing);product.media.push(media);allMediaIds.add(media.id);createdPhotos++;
  }
  mediaIds.push(existing.mediaId);
 }
 const sourceMediaIds=mediaIds.filter(id=>product.media.some(m=>m.id===id));
 if(sourceMediaIds.length){
  const order=[...sourceMediaIds,...product.media.map(m=>m.id).filter(id=>!sourceMediaIds.includes(id))];
  if(order.some((id,i)=>product.media[i]?.id!==id))check((await api(`mutation($id:ID!,$ids:[ID!]!){productMediaReorder(productId:$id,mediaIds:$ids){errors{field code message}}}`,{id:product.id,ids:order})).productMediaReorder);
 }
 results.push({productRef:row.productRef,productId:product.id,specCount:row.specs.length,mediaIds});
 if(results.length%25===0)console.log(`Enriched ${results.length}/${enrichment.products.length}; uploaded ${createdPhotos} photos`);
}
const report={importedAt:new Date().toISOString(),products:results.length,updated,unchanged,attributes:attributes.size,createdPhotos,photos:results.reduce((n,p)=>n+p.mediaIds.length,0),productsWithPhotos:results.filter(p=>p.mediaIds.length).length,sourceIssues:enrichment.issues,results};
await fs.writeFile(new URL('saleor-enrichment-result.local.json',base),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,results:undefined,sourceIssues:report.sourceIssues.length},null,2));
