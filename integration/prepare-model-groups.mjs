import fs from 'node:fs/promises';
import {groupModels} from './model-grouping.mjs';
const base=new URL('./',import.meta.url),report=JSON.parse(await fs.readFile(new URL('saleor-import-result.local.json',base),'utf8'));
const data=JSON.parse(await fs.readFile(new URL(`exports/${report.source}/catalog.local.json`,base),'utf8'));
const enrichment=JSON.parse(await fs.readFile(new URL('product-enrichment.local.json',base),'utf8'));
const groups=groupModels(data.catalogRows,enrichment);
await fs.writeFile(new URL('model-groups.local.json',base),JSON.stringify({createdAt:new Date().toISOString(),inStockRefs:data.products.map(p=>p.ProductRef),groups},null,2));
console.log(JSON.stringify({models:groups.length,variants:groups.reduce((n,g)=>n+g.members.length,0),multiVariantModels:groups.filter(g=>g.members.length>1).length,largest:groups.filter(g=>g.members.length>1).sort((a,b)=>b.members.length-a.members.length).slice(0,15).map(g=>({name:g.name,count:g.members.length})),examples:groups.filter(g=>/TS1|TERNOPIL|UMAN/.test(g.name)).map(g=>({name:g.name,count:g.members.length}))},null,2));
