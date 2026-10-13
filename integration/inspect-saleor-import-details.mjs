import fs from 'node:fs/promises';
import {localSaleor,localAdminToken} from './saleor-local-api.mjs';
const token=await localAdminToken();
let types='kind name';for(let i=0;i<6;i++)types=`kind name ofType{${types}}`;
const names=['ProductBulkCreate','ProductVariantStocksUpdate','ProductChannelListingUpdateInput','ProductInput'];
const data=await localSaleor(`query{${names.map((name,i)=>`t${i}:__type(name:"${name}"){name fields{name type{${types}}} inputFields{name type{${types}}}}`).join(' ')} channels{id slug} shippingZones(first:100){edges{node{id name}}} products(first:100){totalCount edges{node{id name slug externalReference}}}}`,{},token);
await fs.writeFile(new URL('saleor-import-details.local.json',import.meta.url),JSON.stringify(data,null,2));
const textType=t=>!t?'?':t.name||`${t.kind}(${textType(t.ofType)})`;
for(let i=0;i<names.length;i++){const t=data[`t${i}`];console.log(t.name,JSON.stringify((t.fields||t.inputFields).map(f=>({name:f.name,type:textType(f.type)}))));}
console.log(JSON.stringify({channels:data.channels,shippingZones:data.shippingZones,existingProducts:data.products.totalCount}));
const resultType=data.t0.fields.find(f=>f.name==='results');let inner=resultType.type;while(inner.ofType)inner=inner.ofType;
const result=await localSaleor(`query{__type(name:"${inner.name}"){name fields{name type{${types}}}}}`,{},token);
console.log('Bulk result',JSON.stringify(result));
