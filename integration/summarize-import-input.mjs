import fs from 'node:fs/promises';
const base=new URL('./',import.meta.url);
const data=JSON.parse(await fs.readFile(new URL('exports/catalog-2026-10-08T10-23-04-959Z/catalog.local.json',base),'utf8'));
const groups={};for(const row of data.products)groups[row.GroupName]=(groups[row.GroupName]||0)+1;
console.log(JSON.stringify({groups,fractionalStocks:data.stocks.filter(row=>!Number.isInteger(Number(row.Available))).map(({ProductRef,WarehouseCode,Available})=>({ProductRef,WarehouseCode,Available})),negativeStocks:data.stocks.filter(row=>Number(row.Available)<0).length,priceUnits:[...new Set(data.prices.map(row=>`${row.UnitReferenceType}:${row.UnitRef}`))]},null,2));
const schema=JSON.parse(await fs.readFile(new URL('saleor-import-schema.local.json',base),'utf8'));
const typeText=t=>!t?'?':t.name || (t.kind==='NON_NULL'?`${typeText(t.ofType)}!`:`[${typeText(t.ofType)}]`);
for(const t of schema.types.filter(t=>t)){
 console.log(t.name,JSON.stringify((t.inputFields||t.fields).map(f=>({name:f.name,type:typeText(f.type)}))));
}
console.log('Mutations',JSON.stringify(schema.mutations.map(m=>({name:m.name,args:m.args.map(a=>({name:a.name,type:typeText(a.type)}))}))));
