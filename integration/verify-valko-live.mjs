import fs from 'node:fs/promises';
const source=JSON.parse(await fs.readFile(new URL('valko-export.local.json',import.meta.url),'utf8'));
const expected=source.catalogRows.filter(r=>r.VariantRef==='0x00000000000000000000000000000000'&&r.Code.trim()!=='НФ-00001746'&&r.Price&&(Number(r.AvailableMamaivtsi)>0||Number(r.AvailableMagala)>0));
const response=await fetch('http://127.0.0.1:8790/api/catalog');if(!response.ok)throw new Error('Catalog unavailable');const data=await response.json();
const checked=[];
for(const row of expected){const matches=data.products.filter(p=>p.sku===row.Code.trim());if(matches.length!==1||matches[0].price!==Number(row.Price))throw new Error('Accessory SKU/price mismatch');
 for(const [location,q] of [['mamaivtsi',row.AvailableMamaivtsi],['magala',row.AvailableMagala]]){const stock=data.stock.filter(s=>s.sku===row.Code.trim()&&s.location===location);if(stock.length!==1||stock[0].quantity!==Math.max(0,Number(q)))throw new Error('Accessory stock mismatch');}checked.push(matches[0]);}
const hiddenHandles=source.catalogRows.filter(r=>/ручк/i.test(r.Name)&&Number(r.AvailableMamaivtsi)<=0&&Number(r.AvailableMagala)<=0);
if(hiddenHandles.some(r=>data.products.some(p=>p.sku===r.Code.trim())))throw new Error('Out-of-stock handle was published');
console.log(JSON.stringify({catalog:data.products.length,verified:checked.length,categories:checked.reduce((m,p)=>(m[p.category]=(m[p.category]||0)+1,m),{}),handlesWithStock:checked.filter(p=>/ручк/i.test(p.name)).length}));
