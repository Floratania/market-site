import fs from 'node:fs/promises';
const read=async name=>JSON.parse(await fs.readFile(new URL(name,import.meta.url),'utf8'));
const audit=await read('missing-product-types.local.json'),details=await read('product-details-source.local.json');
const report=await read('saleor-import-result.local.json');
const source=await read(`exports/${report.source}/catalog.local.json`);
console.log(JSON.stringify({sourceKeys:Object.keys(source),productSample:source.products[0],detailSample:details.products[0],typeProperties:details.properties.filter(p=>/тип.*констр|вид.*констр/i.test(p.PropertyName)).slice(0,3),sourceDate:details.checkedAt},null,2));
const mapped=audit.items.map(p=>{const src=details.products.find(d=>d.Code===p.sku);return {sku:p.sku,sourceRef:src?.ProductRef,properties:details.properties.filter(d=>d.ProductRef===src?.ProductRef&&/тип.*констр/i.test(d.PropertyName))};});
console.log(JSON.stringify({missing:audit.missingSkus,foundSource:mapped.filter(p=>p.sourceRef).length,withTypeProperty:mapped.filter(p=>p.properties.some(v=>(v.ReferencedValue||v.StringValue||v.TextValue||'').trim())).length,samples:mapped.slice(0,4)},null,2));
